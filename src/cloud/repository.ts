import type { BillingUnit, Expense, GatheringDraft, Group, Member, PersistentData } from "../domain/models";
import { supabase, ensureAnonymousSession } from "./client";

export interface CloudGroupSnapshot {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  drafts: GatheringDraft[];
}

export interface OwnerConnection {
  groupId: string;
  inviteToken: string;
}

export interface InvitationRequest {
  token: string;
  eventId?: string;
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const throwIfError = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export const selectPrimaryOwnedGroup = (groupIds: string[], familyGroupIds: string[], eventGroupIds: string[]) => {
  const score = (groupId: string) => familyGroupIds.filter((id) => id === groupId).length * 10 + eventGroupIds.filter((id) => id === groupId).length;
  return [...groupIds].sort((a, b) => score(b) - score(a))[0];
};

async function uploadReceipt(groupId: string, eventId: string, expenseId: string, receiptUrl?: string, upsert = true) {
  if (!receiptUrl?.startsWith("data:")) return receiptUrl;
  const response = await fetch(receiptUrl);
  const blob = await response.blob();
  const path = `${groupId}/${eventId}/${expenseId}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert });
  throwIfError(error);
  return path;
}

async function receiptUrl(path?: string | null) {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60);
  return error ? undefined : data.signedUrl;
}

export async function createSharedGroup(data: PersistentData, groupId: string) {
  const user = await ensureAnonymousSession();
  const group = data.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("Group not found");
  const inviteToken = randomToken();
  const { error: createError } = await supabase.rpc("create_shared_group", { group_id: group.id, group_name: group.name, invite_token: inviteToken });
  if (createError) {
    const ownerResult = await supabase.from("group_memberships").select("group_id").eq("group_id", groupId).eq("user_id", user.id).eq("role", "owner").maybeSingle();
    throwIfError(ownerResult.error);
    if (!ownerResult.data) throwIfError(createError);
    throwIfError((await supabase.rpc("rotate_group_invite", { target_group_id: groupId, invite_token: inviteToken })).error);
  }

  const units = data.billingUnits.filter((unit) => unit.groupId === groupId);
  if (units.length) throwIfError((await supabase.from("billing_units").upsert(units.map((unit) => ({ id: unit.id, group_id: groupId, name: unit.name, sort_order: unit.order })))).error);
  const unitIds = new Set(units.map((unit) => unit.id));
  const members = data.members.filter((member) => unitIds.has(member.billingUnitId));
  if (members.length) throwIfError((await supabase.from("members").upsert(members.map((member) => ({ id: member.id, group_id: groupId, billing_unit_id: member.billingUnitId, name: member.name, birth_date: member.birthDate, manual_weight: member.manualWeight, active: member.active, notes: member.notes, sort_order: member.order })))).error);
  const drafts = data.gatheringDrafts.filter((item) => item.groupId === groupId);
  for (const draft of drafts) await saveCloudDraft(groupId, draft, undefined);
  return inviteToken;
}

export async function recoverOwnedGroup(): Promise<OwnerConnection | undefined> {
  const user = await ensureAnonymousSession();
  const memberships = await supabase.from("group_memberships").select("group_id").eq("user_id", user.id).eq("role", "owner");
  throwIfError(memberships.error);
  const groupIds = (memberships.data ?? []).map((item) => item.group_id);
  if (!groupIds.length) return undefined;
  const [families, events] = await Promise.all([
    supabase.from("billing_units").select("group_id").in("group_id", groupIds),
    supabase.from("events").select("group_id").in("group_id", groupIds),
  ]);
  throwIfError(families.error); throwIfError(events.error);
  const groupId = selectPrimaryOwnedGroup(groupIds, (families.data ?? []).map((item) => item.group_id), (events.data ?? []).map((item) => item.group_id));
  if (!groupId) return undefined;
  const inviteToken = randomToken();
  throwIfError((await supabase.rpc("rotate_group_invite", { target_group_id: groupId, invite_token: inviteToken })).error);
  return { groupId, inviteToken };
}

export async function joinSharedGroup(inviteToken: string) {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc("join_shared_group", { invite_token: inviteToken });
  throwIfError(error);
  return data as string;
}

export async function loadCloudGroup(groupId: string): Promise<CloudGroupSnapshot> {
  await ensureAnonymousSession();
  const [groupResult, unitsResult, membersResult, eventResult] = await Promise.all([
    supabase.from("groups").select("id,name").eq("id", groupId).single(),
    supabase.from("billing_units").select("id,group_id,name,sort_order").eq("group_id", groupId).order("sort_order"),
    supabase.from("members").select("id,billing_unit_id,name,birth_date,manual_weight,active,notes,sort_order").eq("group_id", groupId).order("sort_order"),
    supabase.from("events").select("id,name,event_date,families_linked,updated_at").eq("group_id", groupId).order("updated_at", { ascending: false }),
  ]);
  throwIfError(groupResult.error); throwIfError(unitsResult.error); throwIfError(membersResult.error); throwIfError(eventResult.error);
  if (!groupResult.data) throw new Error("Shared group not found");
  const group: Group = { id: groupResult.data.id, name: groupResult.data.name };
  const units: BillingUnit[] = (unitsResult.data ?? []).map((unit) => ({ id: unit.id, groupId: unit.group_id, name: unit.name, order: unit.sort_order }));
  const members: Member[] = (membersResult.data ?? []).map((member) => ({ id: member.id, billingUnitId: member.billing_unit_id, name: member.name, birthDate: member.birth_date ?? undefined, manualWeight: member.manual_weight == null ? undefined : Number(member.manual_weight), active: member.active, notes: member.notes ?? undefined, order: member.sort_order }));
  if (!eventResult.data?.length) return { group, units, members, drafts: [] };
  const eventIds = eventResult.data.map((event) => event.id);
  const [linksResult, attendanceResult, expensesResult] = await Promise.all([
    supabase.from("event_families").select("event_id,family_id").in("event_id", eventIds),
    supabase.from("attendance").select("event_id,member_id,present").in("event_id", eventIds),
    supabase.from("expenses").select("id,event_id,billing_unit_id,reported_by_member_id,description,amount,receipt_path").in("event_id", eventIds).is("deleted_at", null),
  ]);
  throwIfError(linksResult.error); throwIfError(attendanceResult.error); throwIfError(expensesResult.error);
  const drafts = await Promise.all(eventResult.data.map(async (event) => ({
    id: event.id,
    groupId,
    name: event.name?.trim() || "אירוע שמור",
    date: event.event_date,
    updatedAt: event.updated_at,
    familyIds: event.families_linked ? (linksResult.data ?? []).filter((link) => link.event_id === event.id).map((link) => link.family_id) : units.map((family) => family.id),
    attendance: (attendanceResult.data ?? []).filter((item) => item.event_id === event.id).map((item) => ({ memberId: item.member_id, present: item.present })),
    expenses: await Promise.all((expensesResult.data ?? []).filter((expense) => expense.event_id === event.id).map(async (expense) => ({ id: expense.id, billingUnitId: expense.billing_unit_id, reportedByMemberId: expense.reported_by_member_id ?? undefined, description: expense.description ?? undefined, amount: Number(expense.amount), receiptUrl: await receiptUrl(expense.receipt_path) }))),
  })));
  return { group, units, members, drafts };
}

export async function saveCloudGroup(group: Group) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("groups").update({ name: group.name, updated_at: new Date().toISOString() }).eq("id", group.id)).error);
}

export async function deleteCloudGroup(id: string) { await ensureAnonymousSession(); throwIfError((await supabase.from("groups").delete().eq("id", id)).error); }

export async function saveCloudUnit(unit: BillingUnit) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("billing_units").upsert({ id: unit.id, group_id: unit.groupId, name: unit.name, sort_order: unit.order, updated_at: new Date().toISOString() })).error);
}

export async function deleteCloudUnit(id: string) { await ensureAnonymousSession(); throwIfError((await supabase.from("billing_units").delete().eq("id", id)).error); }

export async function saveCloudMember(groupId: string, member: Member) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("members").upsert({ id: member.id, group_id: groupId, billing_unit_id: member.billingUnitId, name: member.name, birth_date: member.birthDate, manual_weight: member.manualWeight, active: member.active, notes: member.notes, sort_order: member.order, updated_at: new Date().toISOString() })).error);
}

export async function deleteCloudMember(id: string) { await ensureAnonymousSession(); throwIfError((await supabase.from("members").delete().eq("id", id)).error); }

export async function saveCloudDraft(groupId: string, draft: GatheringDraft, previous?: GatheringDraft) {
  const user = await ensureAnonymousSession();
  throwIfError((await supabase.from("events").upsert({ id: draft.id, group_id: groupId, name: draft.name, event_date: draft.date, families_linked: true, updated_by: user.id, updated_at: draft.updatedAt })).error);
  if (draft.familyIds.length) throwIfError((await supabase.from("event_families").upsert(draft.familyIds.map((familyId) => ({ event_id: draft.id, family_id: familyId, group_id: groupId })))).error);
  const currentFamilyIds = new Set(draft.familyIds);
  const removedFamilyIds = previous?.familyIds.filter((familyId) => !currentFamilyIds.has(familyId)) ?? [];
  if (removedFamilyIds.length) throwIfError((await supabase.from("event_families").delete().eq("event_id", draft.id).in("family_id", removedFamilyIds)).error);
  if (draft.attendance.length) throwIfError((await supabase.from("attendance").upsert(draft.attendance.map((item) => ({ event_id: draft.id, group_id: groupId, member_id: item.memberId, present: item.present, updated_by: user.id, updated_at: draft.updatedAt })))).error);
  const currentMemberIds = new Set(draft.attendance.map((item) => item.memberId));
  const removedMemberIds = previous?.attendance.filter((item) => !currentMemberIds.has(item.memberId)).map((item) => item.memberId) ?? [];
  if (removedMemberIds.length) throwIfError((await supabase.from("attendance").delete().eq("event_id", draft.id).in("member_id", removedMemberIds)).error);
  for (const expense of draft.expenses) {
    const path = await uploadReceipt(groupId, draft.id, expense.id, expense.receiptUrl);
    throwIfError((await supabase.from("expenses").upsert({ id: expense.id, event_id: draft.id, group_id: groupId, billing_unit_id: expense.billingUnitId, reported_by_member_id: expense.reportedByMemberId, description: expense.description, amount: expense.amount, receipt_path: path?.startsWith("http") ? undefined : path, updated_by: user.id, updated_at: draft.updatedAt, deleted_at: null })).error);
  }
  const currentIds = new Set(draft.expenses.map((expense) => expense.id));
  const removedIds = previous?.expenses.filter((expense) => !currentIds.has(expense.id)).map((expense) => expense.id) ?? [];
  if (removedIds.length) throwIfError((await supabase.from("expenses").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).in("id", removedIds)).error);
}

export async function submitCloudExpense(groupId: string, eventId: string, expense: Expense) {
  const user = await ensureAnonymousSession();
  const path = await uploadReceipt(groupId, eventId, expense.id, expense.receiptUrl, false);
  throwIfError((await supabase.from("expenses").insert({
    id: expense.id,
    event_id: eventId,
    group_id: groupId,
    billing_unit_id: expense.billingUnitId,
    reported_by_member_id: expense.reportedByMemberId,
    description: expense.description,
    amount: expense.amount,
    receipt_path: path?.startsWith("http") ? undefined : path,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  })).error);
}

export async function clearCloudDraft(eventId: string) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("events").delete().eq("id", eventId)).error);
}

export function subscribeToCloudGroup(groupId: string, onChange: () => void) {
  const channel = supabase.channel(`group:${groupId}`);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` }, onChange);
  for (const table of ["billing_units", "members", "events", "event_families", "attendance", "expenses"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `group_id=eq.${groupId}` }, onChange);
  }
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}

const validInviteToken = /^[a-f0-9]{64}$/;

export function parseInvitationUrl(value: string): InvitationRequest | undefined {
  const url = new URL(value, "https://localhost");
  const legacy = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token = url.searchParams.get("join") ?? legacy.get("join");
  if (!token || !validInviteToken.test(token)) return undefined;
  return { token, eventId: url.searchParams.get("event") ?? legacy.get("event") ?? undefined };
}

export const invitationUrl = (token: string, eventId?: string, currentUrl = window.location.href) => {
  const current = new URL(currentUrl);
  const url = new URL(current.pathname, current.origin);
  url.searchParams.set("join", token);
  if (eventId) url.searchParams.set("event", eventId);
  return url.toString();
};
