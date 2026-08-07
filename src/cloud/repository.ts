import type { BillingUnit, GatheringDraft, Group, Member, PersistentData } from "../domain/models";
import { supabase, ensureAnonymousSession } from "./client";

export interface CloudGroupSnapshot {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  draft?: GatheringDraft;
}

const eventId = (groupId: string) => `active-${groupId}`;

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const throwIfError = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

async function uploadReceipt(groupId: string, expenseId: string, receiptUrl?: string) {
  if (!receiptUrl?.startsWith("data:")) return receiptUrl;
  const response = await fetch(receiptUrl);
  const blob = await response.blob();
  const path = `${groupId}/${eventId(groupId)}/${expenseId}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  throwIfError(error);
  return path;
}

async function receiptUrl(path?: string | null) {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60);
  return error ? undefined : data.signedUrl;
}

export async function createSharedGroup(data: PersistentData, groupId: string) {
  await ensureAnonymousSession();
  const group = data.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("Group not found");
  const inviteToken = randomToken();
  const { error: createError } = await supabase.rpc("create_shared_group", { group_id: group.id, group_name: group.name, invite_token: inviteToken });
  throwIfError(createError);

  const units = data.billingUnits.filter((unit) => unit.groupId === groupId);
  if (units.length) throwIfError((await supabase.from("billing_units").insert(units.map((unit) => ({ id: unit.id, group_id: groupId, name: unit.name, sort_order: unit.order })))).error);
  const unitIds = new Set(units.map((unit) => unit.id));
  const members = data.members.filter((member) => unitIds.has(member.billingUnitId));
  if (members.length) throwIfError((await supabase.from("members").insert(members.map((member) => ({ id: member.id, group_id: groupId, billing_unit_id: member.billingUnitId, name: member.name, birth_date: member.birthDate, manual_weight: member.manualWeight, active: member.active, notes: member.notes, sort_order: member.order })))).error);
  const draft = data.gatheringDrafts.find((item) => item.groupId === groupId);
  if (draft) await saveCloudDraft(groupId, draft, undefined);
  return inviteToken;
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
    supabase.from("events").select("id,name,event_date,updated_at").eq("group_id", groupId).maybeSingle(),
  ]);
  throwIfError(groupResult.error); throwIfError(unitsResult.error); throwIfError(membersResult.error); throwIfError(eventResult.error);
  if (!groupResult.data) throw new Error("Shared group not found");
  const group: Group = { id: groupResult.data.id, name: groupResult.data.name };
  const units: BillingUnit[] = (unitsResult.data ?? []).map((unit) => ({ id: unit.id, groupId: unit.group_id, name: unit.name, order: unit.sort_order }));
  const members: Member[] = (membersResult.data ?? []).map((member) => ({ id: member.id, billingUnitId: member.billing_unit_id, name: member.name, birthDate: member.birth_date ?? undefined, manualWeight: member.manual_weight == null ? undefined : Number(member.manual_weight), active: member.active, notes: member.notes ?? undefined, order: member.sort_order }));
  if (!eventResult.data) return { group, units, members };
  const [attendanceResult, expensesResult] = await Promise.all([
    supabase.from("attendance").select("member_id,present").eq("event_id", eventResult.data.id),
    supabase.from("expenses").select("id,billing_unit_id,description,amount,receipt_path").eq("event_id", eventResult.data.id).is("deleted_at", null),
  ]);
  throwIfError(attendanceResult.error); throwIfError(expensesResult.error);
  const expenses = await Promise.all((expensesResult.data ?? []).map(async (expense) => ({ id: expense.id, billingUnitId: expense.billing_unit_id, description: expense.description ?? undefined, amount: Number(expense.amount), receiptUrl: await receiptUrl(expense.receipt_path) })));
  return { group, units, members, draft: { groupId, name: eventResult.data.name ?? undefined, date: eventResult.data.event_date, updatedAt: eventResult.data.updated_at, attendance: (attendanceResult.data ?? []).map((item) => ({ memberId: item.member_id, present: item.present })), expenses } };
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
  const id = eventId(groupId);
  throwIfError((await supabase.from("events").upsert({ id, group_id: groupId, name: draft.name, event_date: draft.date, updated_by: user.id, updated_at: draft.updatedAt })).error);
  if (draft.attendance.length) throwIfError((await supabase.from("attendance").upsert(draft.attendance.map((item) => ({ event_id: id, group_id: groupId, member_id: item.memberId, present: item.present, updated_by: user.id, updated_at: draft.updatedAt })))).error);
  for (const expense of draft.expenses) {
    const path = await uploadReceipt(groupId, expense.id, expense.receiptUrl);
    throwIfError((await supabase.from("expenses").upsert({ id: expense.id, event_id: id, group_id: groupId, billing_unit_id: expense.billingUnitId, description: expense.description, amount: expense.amount, receipt_path: path?.startsWith("http") ? undefined : path, updated_by: user.id, updated_at: draft.updatedAt, deleted_at: null })).error);
  }
  const currentIds = new Set(draft.expenses.map((expense) => expense.id));
  const removedIds = previous?.expenses.filter((expense) => !currentIds.has(expense.id)).map((expense) => expense.id) ?? [];
  if (removedIds.length) throwIfError((await supabase.from("expenses").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).in("id", removedIds)).error);
}

export async function clearCloudDraft(groupId: string) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("events").delete().eq("id", eventId(groupId))).error);
}

export function subscribeToCloudGroup(groupId: string, onChange: () => void) {
  const channel = supabase.channel(`group:${groupId}`);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` }, onChange);
  for (const table of ["billing_units", "members", "events", "attendance", "expenses"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `group_id=eq.${groupId}` }, onChange);
  }
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export const invitationUrl = (token: string) => `${window.location.origin}${window.location.pathname}#join=${token}`;
