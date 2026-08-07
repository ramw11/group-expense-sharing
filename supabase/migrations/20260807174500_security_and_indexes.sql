revoke all on function public.create_shared_group(text, text, text) from public, anon;
revoke all on function public.join_shared_group(text) from public, anon;
revoke all on function public.rotate_group_invite(text, text) from public, anon;
revoke all on function public.is_group_member(text) from public, anon;
revoke all on function public.is_group_owner(text) from public, anon;

grant execute on function public.create_shared_group(text, text, text) to authenticated;
grant execute on function public.join_shared_group(text) to authenticated;
grant execute on function public.rotate_group_invite(text, text) to authenticated;
grant execute on function public.is_group_member(text) to authenticated;
grant execute on function public.is_group_owner(text) to authenticated;

create index attendance_group_id_idx on public.attendance(group_id);
create index attendance_member_id_idx on public.attendance(member_id);
create index billing_units_group_id_idx on public.billing_units(group_id);
create index expenses_event_id_idx on public.expenses(event_id);
create index expenses_group_id_idx on public.expenses(group_id);
create index group_invites_group_id_idx on public.group_invites(group_id);
create index group_memberships_user_id_idx on public.group_memberships(user_id);
create index members_billing_unit_id_idx on public.members(billing_unit_id);
create index members_group_id_idx on public.members(group_id);

drop policy memberships_delete on public.group_memberships;
create policy memberships_delete on public.group_memberships for delete
using (user_id = (select auth.uid()) or public.is_group_owner(group_id));
