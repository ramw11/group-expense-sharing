grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.groups,
  public.billing_units,
  public.members,
  public.events,
  public.attendance,
  public.expenses
to authenticated;

grant select, delete on table public.group_memberships to authenticated;
grant select, insert, update on table public.group_invites to authenticated;

alter table public.groups replica identity full;
alter table public.billing_units replica identity full;
alter table public.members replica identity full;
alter table public.events replica identity full;
alter table public.attendance replica identity full;
alter table public.expenses replica identity full;
