insert into public.event_families (event_id, family_id, group_id)
select distinct
  event.id,
  member.billing_unit_id,
  event.group_id
from public.events as event
join public.attendance as attendance on attendance.event_id = event.id
join public.members as member
  on member.id = attendance.member_id
  and member.group_id = event.group_id
where event.families_linked = false
on conflict (event_id, family_id) do nothing;

update public.events as event
set families_linked = true
where event.families_linked = false
  and exists (
    select 1
    from public.event_families as link
    where link.event_id = event.id
  );
