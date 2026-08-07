create table if not exists public.event_families (
  event_id text not null references public.events(id) on delete cascade,
  family_id text not null references public.billing_units(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, family_id)
);

alter table public.events
  add column if not exists families_linked boolean not null default false;

create index if not exists event_families_family_id_idx on public.event_families(family_id);
create index if not exists event_families_group_id_idx on public.event_families(group_id);

alter table public.event_families enable row level security;

drop policy if exists event_families_all on public.event_families;
create policy event_families_all on public.event_families for all
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

grant select, insert, update, delete on table public.event_families to authenticated;

alter table public.event_families replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_families'
  ) then
    alter publication supabase_realtime add table public.event_families;
  end if;
end
$$;
