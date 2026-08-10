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
  select event.group_id into target_group_id from public.events event where event.id = target_event_id;
  if target_group_id is null or not (public.is_group_owner(target_group_id) or public.is_group_admin(target_group_id)) then
    raise exception 'Administrator access required';
  end if;
  update public.group_invites set revoked_at = now() where event_id = target_event_id and revoked_at is null;
  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.group_invites(group_id, event_id, token_hash, created_by)
  values (target_group_id, target_event_id, encode(extensions.digest(invite_token, 'sha256'), 'hex'), auth.uid());
  return invite_token;
end;
$$;

revoke all on function public.create_event_invite(text) from public, anon;
grant execute on function public.create_event_invite(text) to authenticated;
