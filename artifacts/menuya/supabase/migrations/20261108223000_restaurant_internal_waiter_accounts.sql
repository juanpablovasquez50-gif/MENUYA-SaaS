create table if not exists public.restaurant_waiters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  waiter_code text not null,
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, waiter_code),
  unique (id, business_id)
);
create index if not exists restaurant_waiters_business_active_idx on public.restaurant_waiters(business_id,is_active);
create table if not exists public.restaurant_waiter_sessions (
  id uuid primary key default gen_random_uuid(),
  waiter_id uuid not null,
  business_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  foreign key (waiter_id,business_id) references public.restaurant_waiters(id,business_id) on delete cascade
);
create index if not exists restaurant_waiter_sessions_expiry_idx on public.restaurant_waiter_sessions(expires_at);
alter table public.restaurant_waiters enable row level security;
alter table public.restaurant_waiter_sessions enable row level security;
revoke all on public.restaurant_waiters from anon,authenticated;
revoke all on public.restaurant_waiter_sessions from anon,authenticated;
