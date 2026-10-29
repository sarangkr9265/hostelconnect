-- HostelConnect fees and library setup.
-- Run once in the Supabase SQL Editor. Safe to rerun.

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  fee_type text not null check (fee_type in ('hostel', 'gym')),
  amount numeric(10, 2) not null check (amount > 0),
  due_date date,
  description text,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fees_student_created_idx
  on public.fees (student_id, created_at desc);

alter table public.fees enable row level security;

drop policy if exists "fees_read_own_or_staff" on public.fees;
drop policy if exists "fees_staff_insert" on public.fees;
drop policy if exists "fees_staff_update" on public.fees;

create policy "fees_read_own_or_staff"
on public.fees for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_hostel_staff()));

create policy "fees_staff_insert"
on public.fees for insert to authenticated
with check ((select public.is_hostel_staff()));

create policy "fees_staff_update"
on public.fees for update to authenticated
using ((select public.is_hostel_staff()))
with check ((select public.is_hostel_staff()));

grant select, insert, update on public.fees to authenticated;
