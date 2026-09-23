create table public.group_admin_credentials (
  group_id text primary key references public.groups(id) on delete cascade,
  code_hash text not null,
  credential_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.group_admin_sessions (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_version integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.admin_login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.event_access (
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index group_admin_sessions_user_id_idx on public.group_admin_sessions(user_id);
create index event_access_user_id_idx on public.event_access(user_id);
create index event_access_group_id_idx on public.event_access(group_id);

alter table public.group_admin_credentials enable row level security;
alter table public.group_admin_sessions enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.event_access enable row level security;

grant select on public.group_admin_sessions, public.event_access to authenticated;

create or replace function public.is_group_admin(target_group_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_admin_sessions session
    join public.group_admin_credentials credential on credential.group_id = session.group_id
    where session.group_id = target_group_id
      and session.user_id = auth.uid()
      and session.credential_version = credential.credential_version
      and session.expires_at > now()
  );
$$;

create or replace function public.has_event_access(target_event_id text, target_group_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_access access
    where access.event_id = target_event_id
      and access.group_id = target_group_id
      and access.user_id = auth.uid()
  );
$$;

create or replace function public.admin_access_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_group_id text; configured boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select group_id into target_group_id from public.group_admin_credentials order by group_id limit 1;
  if target_group_id is null then
    select group_id into target_group_id from public.group_memberships
    where user_id = auth.uid() and role = 'owner' order by group_id limit 1;
  end if;
  if target_group_id is null then return jsonb_build_object('configured', false); end if;
  select exists(select 1 from public.group_admin_credentials where group_id = target_group_id) into configured;
  return jsonb_build_object(
    'group_id', target_group_id,
    'configured', configured,
    'is_admin', public.is_group_admin(target_group_id),
    'can_bootstrap', public.is_group_owner(target_group_id)
  );
end;
$$;

create or replace function public.bootstrap_admin_code(admin_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare target_group_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(admin_code) < 8 or length(admin_code) > 128 then raise exception 'Code must contain at least 8 characters'; end if;
  select group_id into target_group_id from public.group_memberships
  where user_id = auth.uid() and role = 'owner' order by group_id limit 1;
  if target_group_id is null then raise exception 'Legacy owner access required'; end if;
  insert into public.group_admin_credentials(group_id, code_hash)
  values (target_group_id, extensions.crypt(admin_code, extensions.gen_salt('bf', 10)))
  on conflict (group_id) do nothing;
  if not found then raise exception 'Administrator code is already configured'; end if;
  insert into public.group_admin_sessions(group_id, user_id, credential_version, expires_at)
  values (target_group_id, auth.uid(), 1, now() + interval '30 days')
  on conflict (group_id, user_id) do update set credential_version = excluded.credential_version, expires_at = excluded.expires_at;
  return target_group_id;
end;
$$;

create or replace function public.login_admin(admin_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare target_group_id text; stored_hash text; current_version integer; attempt public.admin_login_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into attempt from public.admin_login_attempts where user_id = auth.uid() for update;
  if attempt.blocked_until is not null and attempt.blocked_until > now() then raise exception 'Too many attempts. Try again later'; end if;
  select group_id, code_hash, credential_version into target_group_id, stored_hash, current_version
  from public.group_admin_credentials order by group_id limit 1;
  if target_group_id is null or extensions.crypt(admin_code, stored_hash) <> stored_hash then
    insert into public.admin_login_attempts(user_id, attempts, blocked_until, updated_at)
    values (auth.uid(), 1, null, now())
    on conflict (user_id) do update set
      attempts = case when public.admin_login_attempts.updated_at < now() - interval '15 minutes' then 1 else public.admin_login_attempts.attempts + 1 end,
      blocked_until = case when public.admin_login_attempts.attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
      updated_at = now();
    raise exception 'Invalid administrator code';
  end if;
  delete from public.admin_login_attempts where user_id = auth.uid();
  insert into public.group_admin_sessions(group_id, user_id, credential_version, expires_at)
  values (target_group_id, auth.uid(), current_version, now() + interval '30 days')
  on conflict (group_id, user_id) do update set credential_version = excluded.credential_version, expires_at = excluded.expires_at;
  return target_group_id;
end;
$$;

create or replace function public.change_admin_code(admin_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_group_id text; next_version integer;
begin
  if length(admin_code) < 8 or length(admin_code) > 128 then raise exception 'Code must contain at least 8 characters'; end if;
  select group_id into target_group_id from public.group_admin_sessions
  where user_id = auth.uid() and expires_at > now() order by group_id limit 1;
  if target_group_id is null or not public.is_group_admin(target_group_id) then raise exception 'Administrator access required'; end if;
  update public.group_admin_credentials set code_hash = extensions.crypt(admin_code, extensions.gen_salt('bf', 10)), credential_version = credential_version + 1, updated_at = now()
  where group_id = target_group_id returning credential_version into next_version;
  delete from public.group_admin_sessions where group_id = target_group_id;
  insert into public.group_admin_sessions(group_id, user_id, credential_version, expires_at)
  values (target_group_id, auth.uid(), next_version, now() + interval '30 days');
end;
$$;

create or replace function public.join_shared_event(invite_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_group_id text; target_event_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select invite.group_id, invite.event_id into target_group_id, target_event_id
  from public.group_invites invite
  where invite.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex') and invite.event_id is not null and invite.revoked_at is null;
  if target_group_id is null then raise exception 'Invalid or revoked event invitation'; end if;
  insert into public.event_access(event_id, group_id, user_id)
  values (target_event_id, target_group_id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('group_id', target_group_id, 'event_id', target_event_id);
end;
$$;

create policy admin_sessions_own_select on public.group_admin_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy event_access_own_select on public.event_access for select to authenticated using (user_id = (select auth.uid()));

create policy groups_admin_all on public.groups for all to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy units_admin_all on public.billing_units for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy members_admin_all on public.members for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy events_admin_all on public.events for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy event_families_admin_all on public.event_families for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy attendance_admin_all on public.attendance for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy expenses_admin_all on public.expenses for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

create policy events_event_access_select on public.events for select to authenticated using (public.has_event_access(id, group_id));
create policy groups_event_access_select on public.groups for select to authenticated using (
  exists (select 1 from public.event_access access where access.group_id = id and access.user_id = (select auth.uid()))
);
create policy event_families_event_access_select on public.event_families for select to authenticated using (public.has_event_access(event_id, group_id));
create policy units_event_access_select on public.billing_units for select to authenticated using (
  exists (select 1 from public.event_families link where link.family_id = id and public.has_event_access(link.event_id, link.group_id))
);
create policy members_event_access_select on public.members for select to authenticated using (
  exists (select 1 from public.event_families link where link.family_id = billing_unit_id and public.has_event_access(link.event_id, link.group_id))
);
create policy expenses_event_access_insert on public.expenses for insert to authenticated with check (
  public.has_event_access(event_id, group_id) and updated_by = (select auth.uid())
);

create policy receipts_event_access_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and public.has_event_access((storage.foldername(name))[2], (storage.foldername(name))[1])
);

revoke all on function public.is_group_admin(text), public.has_event_access(text, text), public.admin_access_status(), public.bootstrap_admin_code(text), public.login_admin(text), public.change_admin_code(text), public.join_shared_event(text) from public, anon;
grant execute on function public.is_group_admin(text), public.has_event_access(text, text), public.admin_access_status(), public.bootstrap_admin_code(text), public.login_admin(text), public.change_admin_code(text), public.join_shared_event(text) to authenticated;
