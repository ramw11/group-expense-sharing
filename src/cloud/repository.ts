import { calculationSettingsFrom, defaultSettings } from "../domain/defaults";
import type { BillingUnit, Event, Expense, Group, Member, PersistentData, Settings } from "../domain/models";
import { ensureAnonymousSession, supabase } from "./client";

export interface CloudGroupSnapshot {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  events: Event[];
  settings: Settings;
  migrationVersion: number;
}

export interface OwnerConnection { groupId: string }
export interface InvitationRequest { token?: string; eventId?: string; legacyToken?: string }
export interface AdminAccessStatus { groupId?: string; configured: boolean; isAdmin: boolean; canBootstrap: boolean }

const throwIfError = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export const selectOwnedGroup = (groupIds: string[], preferredGroupId?: string) => {
  if (preferredGroupId && groupIds.includes(preferredGroupId)) return preferredGroupId;
  return [...groupIds].sort((a, b) => a.localeCompare(b))[0];
};

export const retainedReceiptPath = (expense: Pick<Expense, "receiptUrl" | "receiptPath">) =>
  expense.receiptUrl?.startsWith("data:") ? undefined : expense.receiptPath;

async function uploadReceipt(groupId: string, eventId: string, expense: Expense, upsert: boolean) {
  if (!expense.receiptUrl?.startsWith("data:")) return retainedReceiptPath(expense);
  const response = await fetch(expense.receiptUrl);
  const blob = await response.blob();
  const path = `${groupId}/${eventId}/${expense.id}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert });
  throwIfError(error);
  return path;
}

async function signedReceiptUrl(path?: string | null) {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60);
  return error ? undefined : data.signedUrl;
}

const groupSettingsRow = (settings: Settings) => ({
  currency: settings.currency,
  child_age_threshold: settings.childAgeThreshold,
  child_weight: settings.childWeight,
  weight_mode: settings.weightMode,
  rounding_mode: settings.roundingMode,
  report_footer: settings.reportFooter,
  updated_at: new Date().toISOString(),
});

export async function createSharedGroup(data: PersistentData, groupId: string) {
  await ensureAnonymousSession();
  const group = data.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("Group not found");
  const legacyToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  throwIfError((await supabase.rpc("create_shared_group", { group_id: group.id, group_name: group.name, invite_token: legacyToken })).error);
  throwIfError((await supabase.from("groups").update(groupSettingsRow(data.settings)).eq("id", group.id)).error);

  const units = data.billingUnits.filter((unit) => unit.groupId === groupId);
  if (units.length) throwIfError((await supabase.from("billing_units").upsert(units.map((unit) => ({ id: unit.id, group_id: groupId, name: unit.name, sort_order: unit.order })))).error);
  const unitIds = new Set(units.map((unit) => unit.id));
  const members = data.members.filter((member) => unitIds.has(member.billingUnitId));
  if (members.length) throwIfError((await supabase.from("members").upsert(members.map((member) => ({ id: member.id, group_id: groupId, billing_unit_id: member.billingUnitId, name: member.name, birth_date: member.birthDate, manual_weight: member.manualWeight, active: member.active, notes: member.notes, sort_order: member.order })))).error);
  for (const event of data.events.filter((item) => item.groupId === groupId)) await saveCloudEvent(groupId, event);
  throwIfError((await supabase.from("groups").update({ state_migration_version: 1 }).eq("id", groupId)).error);
}

export async function recoverOwnedGroup(preferredGroupId?: string): Promise<OwnerConnection | undefined> {
  const user = await ensureAnonymousSession();
  const result = await supabase.from("group_memberships").select("group_id").eq("user_id", user.id).eq("role", "owner");
  throwIfError(result.error);
  const groupId = selectOwnedGroup((result.data ?? []).map((item) => item.group_id), preferredGroupId);
  return groupId ? { groupId } : undefined;
}

export async function getAdminAccessStatus(): Promise<AdminAccessStatus> {
  await ensureAnonymousSession();
  const result = await supabase.rpc("admin_access_status");
  throwIfError(result.error);
  const value = result.data as { group_id?: string; configured?: boolean; is_admin?: boolean; can_bootstrap?: boolean } | null;
  return { groupId: value?.group_id, configured: Boolean(value?.configured), isAdmin: Boolean(value?.is_admin), canBootstrap: Boolean(value?.can_bootstrap) };
}

export async function bootstrapAdminCode(code: string) {
  await ensureAnonymousSession();
  const result = await supabase.rpc("bootstrap_admin_code", { admin_code: code });
  throwIfError(result.error);
  return result.data as string;
}

export async function loginAdmin(code: string) {
  await ensureAnonymousSession();
  const result = await supabase.rpc("login_admin", { admin_code: code });
  throwIfError(result.error);
  return result.data as string;
}

export async function changeAdminCode(code: string) {
  await ensureAnonymousSession();
  throwIfError((await supabase.rpc("change_admin_code", { admin_code: code })).error);
}

export async function createEventReportingToken(eventId: string) {
  await ensureAnonymousSession();
  const result = await supabase.rpc("create_event_invite", { target_event_id: eventId });
  throwIfError(result.error);
  if (typeof result.data !== "string") throw new Error("Event reporting token was not created");
  return result.data;
}

export async function joinSharedEvent(token: string) {
  await ensureAnonymousSession();
  const result = await supabase.rpc("join_shared_event", { invite_token: token });
  throwIfError(result.error);
  const value = result.data as { group_id?: string; event_id?: string } | null;
  if (!value?.group_id || !value.event_id) throw new Error("Invalid event invitation");
  return { groupId: value.group_id, eventId: value.event_id };
}

export async function joinLegacyGroup(token: string, eventId?: string) {
  await ensureAnonymousSession();
  const result = await supabase.rpc("join_shared_group", { invite_token: token });
  throwIfError(result.error);
  if (typeof result.data !== "string" || !eventId) throw new Error("Legacy event invitation is incomplete");
  return { groupId: result.data, eventId };
}

export async function findAccessibleEvent(eventId: string) {
  await ensureAnonymousSession();
  const result = await supabase.from("events").select("id,group_id").eq("id", eventId).maybeSingle();
  throwIfError(result.error);
  return result.data ? { groupId: result.data.group_id, eventId: result.data.id } : undefined;
}

export async function loadCloudGroup(groupId: string): Promise<CloudGroupSnapshot> {
  await ensureAnonymousSession();
  const [groupResult, unitsResult, membersResult, eventResult] = await Promise.all([
    supabase.from("groups").select("id,name,currency,child_age_threshold,child_weight,weight_mode,rounding_mode,report_footer,state_migration_version").eq("id", groupId).single(),
    supabase.from("billing_units").select("id,group_id,name,sort_order").eq("group_id", groupId).order("sort_order"),
    supabase.from("members").select("id,billing_unit_id,name,birth_date,manual_weight,active,notes,sort_order").eq("group_id", groupId).order("sort_order"),
    supabase.from("events").select("id,name,event_date,families_linked,child_age_threshold,child_weight,weight_mode,rounding_mode,updated_at").eq("group_id", groupId).order("updated_at", { ascending: false }),
  ]);
  throwIfError(groupResult.error); throwIfError(unitsResult.error); throwIfError(membersResult.error); throwIfError(eventResult.error);
  if (!groupResult.data) throw new Error("Shared group not found");
  const group: Group = { id: groupResult.data.id, name: groupResult.data.name };
  const settings: Settings = {
    ...defaultSettings,
    currency: groupResult.data.currency,
    childAgeThreshold: groupResult.data.child_age_threshold,
    childWeight: Number(groupResult.data.child_weight),
    weightMode: groupResult.data.weight_mode,
    roundingMode: groupResult.data.rounding_mode,
    reportFooter: groupResult.data.report_footer,
  };
  const units: BillingUnit[] = (unitsResult.data ?? []).map((unit) => ({ id: unit.id, groupId: unit.group_id, name: unit.name, order: unit.sort_order }));
  const members: Member[] = (membersResult.data ?? []).map((member) => ({ id: member.id, billingUnitId: member.billing_unit_id, name: member.name, birthDate: member.birth_date ?? undefined, manualWeight: member.manual_weight == null ? undefined : Number(member.manual_weight), active: member.active, notes: member.notes ?? undefined, order: member.sort_order }));
  const migrationVersion = groupResult.data.state_migration_version;
  if (!eventResult.data?.length) return { group, units, members, events: [], settings, migrationVersion };
  const eventIds = eventResult.data.map((event) => event.id);
  const [linksResult, attendanceResult, expensesResult] = await Promise.all([
    supabase.from("event_families").select("event_id,family_id").in("event_id", eventIds),
    supabase.from("attendance").select("event_id,member_id,present").in("event_id", eventIds),
    supabase.from("expenses").select("id,event_id,billing_unit_id,reported_by_member_id,description,amount,receipt_path").in("event_id", eventIds).is("deleted_at", null),
  ]);
  throwIfError(linksResult.error); throwIfError(attendanceResult.error); throwIfError(expensesResult.error);
  const events = await Promise.all(eventResult.data.map(async (event): Promise<Event> => ({
    id: event.id,
    groupId,
    name: event.name?.trim() || "אירוע שמור",
    date: event.event_date,
    updatedAt: event.updated_at,
    familyIds: event.families_linked ? (linksResult.data ?? []).filter((link) => link.event_id === event.id).map((link) => link.family_id) : units.map((family) => family.id),
    attendance: (attendanceResult.data ?? []).filter((item) => item.event_id === event.id).map((item) => ({ memberId: item.member_id, present: item.present })),
    calculationSettings: {
      childAgeThreshold: event.child_age_threshold,
      childWeight: Number(event.child_weight),
      weightMode: event.weight_mode,
      roundingMode: event.rounding_mode,
    },
    expenses: await Promise.all((expensesResult.data ?? []).filter((expense) => expense.event_id === event.id).map(async (expense) => ({
      id: expense.id,
      billingUnitId: expense.billing_unit_id,
      reportedByMemberId: expense.reported_by_member_id ?? undefined,
      description: expense.description ?? undefined,
      amount: Number(expense.amount),
      receiptPath: expense.receipt_path ?? undefined,
      receiptUrl: await signedReceiptUrl(expense.receipt_path),
    }))),
  })));
  return { group, units, members, events, settings, migrationVersion };
}

export async function completeLegacyStateMigration(groupId: string, settings?: Settings, eventSettingsById: Record<string, Event["calculationSettings"]> = {}) {
  await ensureAnonymousSession();
  if (settings) throwIfError((await supabase.from("groups").update(groupSettingsRow(settings)).eq("id", groupId)).error);
  for (const [eventId, snapshot] of Object.entries(eventSettingsById)) {
    throwIfError((await supabase.from("events").update({
      child_age_threshold: snapshot.childAgeThreshold,
      child_weight: snapshot.childWeight,
      weight_mode: snapshot.weightMode,
      rounding_mode: snapshot.roundingMode,
    }).eq("id", eventId).eq("group_id", groupId)).error);
  }
  throwIfError((await supabase.from("groups").update({ state_migration_version: 1 }).eq("id", groupId)).error);
}

export async function saveCloudSettings(groupId: string, settings: Settings) {
  await ensureAnonymousSession();
  throwIfError((await supabase.from("groups").update(groupSettingsRow(settings)).eq("id", groupId)).error);
}

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

export async function saveCloudEvent(groupId: string, event: Event, previous?: Event) {
  const user = await ensureAnonymousSession();
  throwIfError((await supabase.from("events").upsert({
    id: event.id,
    group_id: groupId,
    name: event.name,
    event_date: event.date,
    families_linked: true,
    child_age_threshold: event.calculationSettings.childAgeThreshold,
    child_weight: event.calculationSettings.childWeight,
    weight_mode: event.calculationSettings.weightMode,
    rounding_mode: event.calculationSettings.roundingMode,
    updated_by: user.id,
    updated_at: event.updatedAt,
  })).error);
  if (event.familyIds.length) throwIfError((await supabase.from("event_families").upsert(event.familyIds.map((familyId) => ({ event_id: event.id, family_id: familyId, group_id: groupId })))).error);
  const removedFamilyIds = previous?.familyIds.filter((familyId) => !event.familyIds.includes(familyId)) ?? [];
  if (removedFamilyIds.length) throwIfError((await supabase.from("event_families").delete().eq("event_id", event.id).in("family_id", removedFamilyIds)).error);
  if (event.attendance.length) throwIfError((await supabase.from("attendance").upsert(event.attendance.map((item) => ({ event_id: event.id, group_id: groupId, member_id: item.memberId, present: item.present, updated_by: user.id, updated_at: event.updatedAt })))).error);
  const removedMemberIds = previous?.attendance.filter((item) => !event.attendance.some((current) => current.memberId === item.memberId)).map((item) => item.memberId) ?? [];
  if (removedMemberIds.length) throwIfError((await supabase.from("attendance").delete().eq("event_id", event.id).in("member_id", removedMemberIds)).error);
  for (const expense of event.expenses) {
    const receiptPath = await uploadReceipt(groupId, event.id, expense, true);
    const values = { id: expense.id, event_id: event.id, group_id: groupId, billing_unit_id: expense.billingUnitId, reported_by_member_id: expense.reportedByMemberId, description: expense.description, amount: expense.amount, receipt_path: receiptPath, updated_by: user.id, updated_at: event.updatedAt, deleted_at: null };
    const existing = previous?.expenses.some((item) => item.id === expense.id);
    const result = existing
      ? await supabase.from("expenses").update(values).eq("id", expense.id)
      : await supabase.from("expenses").insert({ ...values, created_by: user.id });
    throwIfError(result.error);
  }
  const removedExpenseIds = previous?.expenses.filter((expense) => !event.expenses.some((current) => current.id === expense.id)).map((expense) => expense.id) ?? [];
  if (removedExpenseIds.length) throwIfError((await supabase.from("expenses").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).in("id", removedExpenseIds)).error);
}

export async function submitCloudExpense(groupId: string, eventId: string, expense: Expense) {
  const user = await ensureAnonymousSession();
  const receiptPath = await uploadReceipt(groupId, eventId, expense, false);
  throwIfError((await supabase.from("expenses").insert({ id: expense.id, event_id: eventId, group_id: groupId, billing_unit_id: expense.billingUnitId, reported_by_member_id: expense.reportedByMemberId, description: expense.description, amount: expense.amount, receipt_path: receiptPath, created_by: user.id, updated_by: user.id, updated_at: new Date().toISOString() })).error);
}

export async function updateOwnExpenseAmount(expenseId: string, amount: number) {
  await ensureAnonymousSession();
  throwIfError((await supabase.rpc("update_own_expense_amount", { target_expense_id: expenseId, new_amount: amount })).error);
}

export async function deleteCloudEvent(eventId: string) { await ensureAnonymousSession(); throwIfError((await supabase.from("events").delete().eq("id", eventId)).error); }

export function subscribeToCloudGroup(groupId: string, onChange: () => void) {
  const channel = supabase.channel(`group:${groupId}`);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` }, onChange);
  for (const table of ["billing_units", "members", "events", "event_families", "attendance", "expenses"]) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `group_id=eq.${groupId}` }, onChange);
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}

const validToken = /^[a-f0-9]{64}$/;
export function parseInvitationUrl(value: string): InvitationRequest | undefined {
  const url = new URL(value, "https://localhost");
  const legacyHash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const eventId = url.searchParams.get("event") ?? legacyHash.get("event") ?? undefined;
  const token = url.searchParams.get("access") ?? legacyHash.get("access") ?? undefined;
  if (token && validToken.test(token)) return { token, eventId };
  const legacyToken = url.searchParams.get("join") ?? legacyHash.get("join") ?? undefined;
  if (legacyToken && validToken.test(legacyToken) && eventId) return { legacyToken, eventId };
  return eventId ? { eventId } : undefined;
}

export const invitationUrl = (token: string, eventId: string, currentUrl = window.location.href) => {
  const current = new URL(currentUrl);
  const url = new URL(current.pathname, current.origin);
  url.searchParams.set("event", eventId);
  url.searchParams.set("access", token);
  return url.toString();
};

export const eventSettings = (settings: Settings) => calculationSettingsFrom(settings);
