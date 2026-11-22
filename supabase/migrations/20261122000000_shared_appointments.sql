create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  patient_name text not null check (length(trim(patient_name)) > 0),
  patient_email text not null,
  patient_phone text not null default '',
  provider_id text not null,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 180),
  visit_type text not null check (length(trim(visit_type)) > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'rejected', 'cancelled', 'no-show')),
  notes text not null default '',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_patient_id_idx on public.appointments (patient_id);
create index if not exists appointments_date_time_idx on public.appointments (appointment_date, appointment_time);

alter table public.appointments enable row level security;

grant select, insert, update, delete on public.appointments to authenticated;

drop policy if exists "Patients and staff can read appointments" on public.appointments;
create policy "Patients and staff can read appointments"
  on public.appointments for select to authenticated
  using (
    patient_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'receptionist')
  );

drop policy if exists "Patients and staff can create appointments" on public.appointments;
create policy "Patients and staff can create appointments"
  on public.appointments for insert to authenticated
  with check (
    (
      patient_id = (select auth.uid())
      and status = 'scheduled'
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'patient') = 'patient'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'receptionist')
  );

drop policy if exists "Patients and staff can update appointments" on public.appointments;
create policy "Patients and staff can update appointments"
  on public.appointments for update to authenticated
  using (
    patient_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'receptionist')
  )
  with check (
    patient_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'receptionist')
  );

drop policy if exists "Staff can delete appointments" on public.appointments;
create policy "Staff can delete appointments"
  on public.appointments for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'receptionist'));

create or replace function public.guard_appointment_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'patient');
begin
  if tg_op = 'INSERT' then
    if caller_role = 'patient'
       and (new.patient_id is distinct from auth.uid() or new.status <> 'scheduled') then
      raise exception 'Patients may only request appointments for themselves.';
    end if;
  elsif caller_role = 'patient' then
    if new.patient_id is distinct from old.patient_id then
      raise exception 'Appointment ownership cannot be changed.';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('scheduled', 'confirmed') and new.status = 'cancelled') then
      raise exception 'Patients may only cancel pending or confirmed appointments.';
    end if;
  end if;

  if new.status not in ('cancelled', 'rejected', 'no-show') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.provider_id || ':' || new.appointment_date::text, 0)
    );
    if exists (
      select 1
      from public.appointments as existing
      where existing.id is distinct from new.id
        and existing.provider_id = new.provider_id
        and existing.status not in ('cancelled', 'rejected', 'no-show')
        and (new.appointment_date + new.appointment_time)
          < (existing.appointment_date + existing.appointment_time
            + pg_catalog.make_interval(mins => existing.duration_minutes))
        and (existing.appointment_date + existing.appointment_time)
          < (new.appointment_date + new.appointment_time
            + pg_catalog.make_interval(mins => new.duration_minutes))
    ) then
      raise exception 'This provider already has an appointment during that time.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointments_guard_changes on public.appointments;
create trigger appointments_guard_changes
  before insert or update on public.appointments
  for each row execute function public.guard_appointment_changes();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'appointments'
     ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end
$$;
