create extension if not exists pgcrypto;

create table public.groups (
  id text primary key,
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_memberships (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.billing_units (
  id text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.members (
  id text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  billing_unit_id text not null references public.billing_units(id) on delete cascade,
  name text not null,
  birth_date date,
  manual_weight numeric,
  active boolean not null default true,
  notes text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.events (
  id text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  name text,
  event_date date not null,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index events_one_active_per_group on public.events(group_id);

create table public.attendance (
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  present boolean not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table public.expenses (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  billing_unit_id text not null references public.billing_units(id),
  description text,
  amount numeric(12,2) not null check (amount > 0),
  receipt_path text,
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.groups(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create or replace function public.is_group_member(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_memberships
    where group_id = target_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_memberships
    where group_id = target_group_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.create_shared_group(group_id text, group_name text, invite_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.groups(id, name, created_by) values (group_id, group_name, auth.uid());
  insert into public.group_memberships(group_id, user_id, role) values (group_id, auth.uid(), 'owner');
  insert into public.group_invites(group_id, token_hash, created_by)
  values (group_id, encode(extensions.digest(invite_token, 'sha256'), 'hex'), auth.uid());
  return group_id;
end;
$$;

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
  values (target_group_id, auth.uid(), 'editor') on conflict do nothing;
  return target_group_id;
end;
$$;

create or replace function public.rotate_group_invite(target_group_id text, invite_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_owner(target_group_id) then raise exception 'Owner access required'; end if;
  update public.group_invites set revoked_at = now() where group_id = target_group_id and revoked_at is null;
  insert into public.group_invites(group_id, token_hash, created_by)
  values (target_group_id, encode(extensions.digest(invite_token, 'sha256'), 'hex'), auth.uid());
end;
$$;

alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.billing_units enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.expenses enable row level security;
alter table public.group_invites enable row level security;

create policy groups_select on public.groups for select using (public.is_group_member(id));
create policy groups_update on public.groups for update using (public.is_group_member(id)) with check (public.is_group_member(id));
create policy groups_delete on public.groups for delete using (public.is_group_owner(id));
create policy memberships_select on public.group_memberships for select using (public.is_group_member(group_id));
create policy memberships_delete on public.group_memberships for delete using (user_id = auth.uid() or public.is_group_owner(group_id));

create policy units_all on public.billing_units for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy members_all on public.members for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy events_all on public.events for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy attendance_all on public.attendance for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy expenses_all on public.expenses for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy invites_select on public.group_invites for select using (public.is_group_owner(group_id));
create policy invites_insert on public.group_invites for insert with check (public.is_group_owner(group_id));
create policy invites_update on public.group_invites for update using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

insert into storage.buckets(id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select using (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);
create policy receipts_insert on storage.objects for insert with check (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);
create policy receipts_update on storage.objects for update using (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);
create policy receipts_delete on storage.objects for delete using (
  bucket_id = 'receipts' and public.is_group_member((storage.foldername(name))[1])
);

alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.billing_units;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.expenses;
