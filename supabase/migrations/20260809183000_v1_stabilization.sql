alter table public.groups
  add column if not exists currency text not null default 'ILS',
  add column if not exists child_age_threshold integer not null default 12 check (child_age_threshold between 1 and 21),
  add column if not exists child_weight numeric not null default 0.5 check (child_weight between 0 and 1),
  add column if not exists weight_mode text not null default 'automatic' check (weight_mode in ('automatic', 'manual')),
  add column if not exists rounding_mode text not null default 'nearest-0.5' check (rounding_mode in ('none', 'nearest-0.5', 'nearest-1')),
  add column if not exists report_footer text not null default 'תודה לכולם!',
  add column if not exists state_migration_version integer not null default 0;

alter table public.events
  add column if not exists child_age_threshold integer,
  add column if not exists child_weight numeric,
  add column if not exists weight_mode text,
  add column if not exists rounding_mode text;

update public.events as event
set child_age_threshold = coalesce(event.child_age_threshold, group_row.child_age_threshold),
    child_weight = coalesce(event.child_weight, group_row.child_weight),
    weight_mode = coalesce(event.weight_mode, group_row.weight_mode),
    rounding_mode = coalesce(event.rounding_mode, group_row.rounding_mode)
from public.groups as group_row
where group_row.id = event.group_id
  and (event.child_age_threshold is null or event.child_weight is null or event.weight_mode is null or event.rounding_mode is null);

alter table public.events
  alter column child_age_threshold set not null,
  alter column child_age_threshold set default 12,
  alter column child_weight set not null,
  alter column child_weight set default 0.5,
  alter column weight_mode set not null,
  alter column weight_mode set default 'automatic',
  alter column rounding_mode set not null,
  alter column rounding_mode set default 'nearest-0.5';

alter table public.events
  drop constraint if exists events_child_age_threshold_check,
  add constraint events_child_age_threshold_check check (child_age_threshold between 1 and 21),
  drop constraint if exists events_child_weight_check,
  add constraint events_child_weight_check check (child_weight between 0 and 1),
  drop constraint if exists events_weight_mode_check,
  add constraint events_weight_mode_check check (weight_mode in ('automatic', 'manual')),
  drop constraint if exists events_rounding_mode_check,
  add constraint events_rounding_mode_check check (rounding_mode in ('none', 'nearest-0.5', 'nearest-1'));

alter table public.group_invites
  add column if not exists event_id text references public.events(id) on delete cascade;

create index if not exists group_invites_event_id_idx on public.group_invites(event_id);
create unique index if not exists group_invites_one_active_per_event_idx
  on public.group_invites(event_id)
  where event_id is not null and revoked_at is null;

create or replace function public.create_event_invite(target_event_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id text;
  invite_token text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select event.group_id into target_group_id
  from public.events as event
  where event.id = target_event_id;
  if target_group_id is null or not public.is_group_owner(target_group_id) then
    raise exception 'Owner access required';
  end if;

  update public.group_invites
  set revoked_at = now()
  where event_id = target_event_id and revoked_at is null;

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.group_invites(group_id, event_id, token_hash, created_by)
  values (target_group_id, target_event_id, encode(extensions.digest(invite_token, 'sha256'), 'hex'), auth.uid());
  return invite_token;
end;
$$;

create or replace function public.join_shared_event(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id text;
  target_event_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select invite.group_id, invite.event_id
  into target_group_id, target_event_id
  from public.group_invites as invite
  where invite.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    and invite.event_id is not null
    and invite.revoked_at is null;
  if target_group_id is null or target_event_id is null then raise exception 'Invalid or revoked event invitation'; end if;

  insert into public.group_memberships(group_id, user_id, role)
  values (target_group_id, auth.uid(), 'participant')
  on conflict (group_id, user_id) do nothing;

  return jsonb_build_object('group_id', target_group_id, 'event_id', target_event_id);
end;
$$;

revoke all on function public.create_event_invite(text) from public, anon;
revoke all on function public.join_shared_event(text) from public, anon;
grant execute on function public.create_event_invite(text) to authenticated;
grant execute on function public.join_shared_event(text) to authenticated;

grant select, insert, update on table public.group_invites to authenticated;
