alter table public.expenses
  add column if not exists notes text;

create or replace function public.update_own_expense(
  target_expense_id text,
  new_amount numeric,
  new_title text,
  new_notes text,
  new_receipt_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare owned_expense public.expenses%rowtype;
begin
  if new_amount is null or new_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into owned_expense from public.expenses
  where id = target_expense_id
    and created_by = auth.uid()
    and deleted_at is null
    and public.has_event_access(event_id, group_id)
  for update;

  if not found then raise exception 'Expense not found or access denied'; end if;
  if new_receipt_path is not null and new_receipt_path <> (owned_expense.group_id || '/' || owned_expense.event_id || '/' || owned_expense.id || '.jpg') then
    raise exception 'Invalid receipt path';
  end if;

  update public.expenses set
    amount = round(new_amount, 2),
    description = nullif(trim(new_title), ''),
    notes = nullif(trim(new_notes), ''),
    receipt_path = new_receipt_path,
    updated_by = auth.uid(),
    updated_at = now()
  where id = target_expense_id;
end;
$$;

create policy receipts_reporter_select on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and exists (
    select 1 from public.expenses expense
    where expense.receipt_path = name and expense.created_by = (select auth.uid()) and expense.deleted_at is null
  )
);

create policy receipts_reporter_update on storage.objects for update to authenticated using (
  bucket_id = 'receipts' and exists (
    select 1 from public.expenses expense
    where expense.receipt_path = name and expense.created_by = (select auth.uid()) and expense.deleted_at is null
  )
) with check (
  bucket_id = 'receipts' and exists (
    select 1 from public.expenses expense
    where expense.receipt_path = name and expense.created_by = (select auth.uid()) and expense.deleted_at is null
  )
);

revoke all on function public.update_own_expense(text, numeric, text, text, text) from public, anon;
grant execute on function public.update_own_expense(text, numeric, text, text, text) to authenticated;
