alter table public.expenses
  add column if not exists reported_by_member_id text references public.members(id) on delete set null;

create index if not exists expenses_reported_by_member_id_idx
  on public.expenses(reported_by_member_id);
create index if not exists events_group_id_idx on public.events(group_id);

alter table public.group_memberships
  drop constraint if exists group_memberships_role_check;

update public.group_memberships
set role = 'participant'
where role = 'editor';

alter table public.group_memberships
  add constraint group_memberships_role_check
  check (role in ('owner', 'participant'));

create or replace function public.join_shared_group(invite_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare target_group_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select group_id into target_group_id from public.group_invites
  where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex') and revoked_at is null;
  if target_group_id is null then raise exception 'Invalid or revoked invitation'; end if;
  insert into public.group_memberships(group_id, user_id, role)
  values (target_group_id, auth.uid(), 'participant') on conflict do nothing;
  return target_group_id;
end;
$$;

revoke all on function public.join_shared_group(text) from public, anon;
grant execute on function public.join_shared_group(text) to authenticated;

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update
to authenticated
using (public.is_group_owner(id))
with check (public.is_group_owner(id));

drop policy if exists memberships_select on public.group_memberships;
create policy memberships_select on public.group_memberships for select
to authenticated
using (user_id = (select auth.uid()) or public.is_group_owner(group_id));

drop policy if exists units_all on public.billing_units;
create policy units_select on public.billing_units for select
to authenticated using (public.is_group_member(group_id));
create policy units_owner_insert on public.billing_units for insert
to authenticated with check (public.is_group_owner(group_id));
create policy units_owner_update on public.billing_units for update
to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));
create policy units_owner_delete on public.billing_units for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists members_all on public.members;
create policy members_select on public.members for select
to authenticated using (public.is_group_member(group_id));
create policy members_owner_insert on public.members for insert
to authenticated with check (public.is_group_owner(group_id));
create policy members_owner_update on public.members for update
to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));
create policy members_owner_delete on public.members for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists events_all on public.events;
create policy events_select on public.events for select
to authenticated using (public.is_group_member(group_id));
create policy events_owner_insert on public.events for insert
to authenticated with check (public.is_group_owner(group_id));
create policy events_owner_update on public.events for update
to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));
create policy events_owner_delete on public.events for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists event_families_all on public.event_families;
create policy event_families_select on public.event_families for select
to authenticated using (public.is_group_member(group_id));
create policy event_families_owner_insert on public.event_families for insert
to authenticated with check (public.is_group_owner(group_id));
create policy event_families_owner_update on public.event_families for update
to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));
create policy event_families_owner_delete on public.event_families for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists attendance_all on public.attendance;
create policy attendance_select on public.attendance for select
to authenticated using (public.is_group_member(group_id));
create policy attendance_owner_insert on public.attendance for insert
to authenticated with check (public.is_group_owner(group_id));
create policy attendance_owner_update on public.attendance for update
to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));
create policy attendance_owner_delete on public.attendance for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_select on public.expenses for select
to authenticated using (public.is_group_member(group_id));
create policy expenses_participant_insert on public.expenses for insert
to authenticated with check (
  public.is_group_member(group_id)
  and updated_by = (select auth.uid())
);
create policy expenses_owner_update on public.expenses for update
to authenticated using (public.is_group_owner(group_id))
with check (public.is_group_owner(group_id));
create policy expenses_owner_delete on public.expenses for delete
to authenticated using (public.is_group_owner(group_id));

drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects for select
to authenticated using (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert
to authenticated with check (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);

drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects for update
to authenticated using (
  bucket_id = 'receipts' and public.is_group_owner((storage.foldername(name))[1])
) with check (
  bucket_id = 'receipts' and public.is_group_owner((storage.foldername(name))[1])
);

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete
to authenticated using (
  bucket_id = 'receipts' and public.is_group_owner((storage.foldername(name))[1])
);
