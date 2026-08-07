alter policy groups_select on public.groups to authenticated;
alter policy groups_update on public.groups to authenticated;
alter policy groups_delete on public.groups to authenticated;
alter policy memberships_select on public.group_memberships to authenticated;
alter policy memberships_delete on public.group_memberships to authenticated;
alter policy units_all on public.billing_units to authenticated;
alter policy members_all on public.members to authenticated;
alter policy events_all on public.events to authenticated;
alter policy attendance_all on public.attendance to authenticated;
alter policy expenses_all on public.expenses to authenticated;
alter policy invites_select on public.group_invites to authenticated;
alter policy invites_insert on public.group_invites to authenticated;
alter policy invites_update on public.group_invites to authenticated;

alter policy receipts_select on storage.objects to authenticated;
alter policy receipts_insert on storage.objects to authenticated;
alter policy receipts_update on storage.objects to authenticated;
alter policy receipts_delete on storage.objects to authenticated;

create index attendance_updated_by_idx on public.attendance(updated_by);
create index events_updated_by_idx on public.events(updated_by);
create index expenses_billing_unit_id_idx on public.expenses(billing_unit_id);
create index expenses_updated_by_idx on public.expenses(updated_by);
create index group_invites_created_by_idx on public.group_invites(created_by);
create index groups_created_by_idx on public.groups(created_by);
