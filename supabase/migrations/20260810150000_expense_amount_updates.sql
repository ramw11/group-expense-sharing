alter table public.expenses
  add column if not exists created_by uuid references auth.users(id);

update public.expenses
set created_by = updated_by
where created_by is null;

alter table public.expenses
  alter column created_by set not null;

create index if not exists expenses_created_by_idx
  on public.expenses(created_by);

create policy expenses_reporter_select on public.expenses for select
to authenticated using (
  created_by = (select auth.uid())
  and public.has_event_access(event_id, group_id)
  and deleted_at is null
);

create or replace function public.update_own_expense_amount(target_expense_id text, new_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_amount is null or new_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  update public.expenses
  set amount = round(new_amount, 2), updated_by = auth.uid(), updated_at = now()
  where id = target_expense_id
    and created_by = auth.uid()
    and deleted_at is null
    and public.has_event_access(event_id, group_id);

  if not found then
    raise exception 'Expense not found or access denied';
  end if;
end;
$$;

revoke all on function public.update_own_expense_amount(text, numeric) from public, anon;
grant execute on function public.update_own_expense_amount(text, numeric) to authenticated;
