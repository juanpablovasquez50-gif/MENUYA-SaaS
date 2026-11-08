-- Veterinary sector: patient records and appointment scheduling.
create table if not exists public.vet_patients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  species text not null check (length(btrim(species)) between 1 and 60),
  breed text,
  sex text check (sex is null or sex in ('Macho','Hembra','No especificado')),
  birth_date date,
  owner_name text not null check (length(btrim(owner_name)) between 1 and 120),
  owner_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,id)
);
create index if not exists vet_patients_business_name_idx on public.vet_patients(business_id,name);
alter table public.vet_patients enable row level security;
drop policy if exists vet_patients_read on public.vet_patients;
create policy vet_patients_read on public.vet_patients for select to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]));
drop policy if exists vet_patients_write on public.vet_patients;
create policy vet_patients_write on public.vet_patients for all to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]))
with check (private.has_business_role(business_id,array['owner','admin','manager']::text[]));

create table if not exists public.vet_appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  patient_id uuid not null,
  scheduled_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 1 and 240),
  status text not null default 'Agendada' check (status in ('Agendada','Confirmada','En consulta','Completada','Cancelada')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vet_appointments_patient_fk foreign key (business_id,patient_id)
    references public.vet_patients(business_id,id) on delete cascade
);
create index if not exists vet_appointments_business_date_idx on public.vet_appointments(business_id,scheduled_at desc);
alter table public.vet_appointments enable row level security;
drop policy if exists vet_appointments_read on public.vet_appointments;
create policy vet_appointments_read on public.vet_appointments for select to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]));
drop policy if exists vet_appointments_write on public.vet_appointments;
create policy vet_appointments_write on public.vet_appointments for all to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]))
with check (private.has_business_role(business_id,array['owner','admin','manager']::text[]));
