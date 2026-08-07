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

revoke all on function public.create_shared_group(text, text, text) from public, anon;
revoke all on function public.join_shared_group(text) from public, anon;
revoke all on function public.rotate_group_invite(text, text) from public, anon;

grant execute on function public.create_shared_group(text, text, text) to authenticated;
grant execute on function public.join_shared_group(text) to authenticated;
grant execute on function public.rotate_group_invite(text, text) to authenticated;
