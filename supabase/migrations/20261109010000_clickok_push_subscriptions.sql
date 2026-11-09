create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  preferences jsonb not null default '{"new_order": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_business_unique unique (endpoint, business_id),
  constraint push_subscriptions_preferences_object check (jsonb_typeof(preferences) = 'object')
);

create index if not exists push_subscriptions_business_idx
  on public.push_subscriptions (business_id);

create index if not exists push_subscriptions_user_business_idx
  on public.push_subscriptions (user_id, business_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, public;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

drop policy if exists "Members can read their own push subscriptions" on public.push_subscriptions;
create policy "Members can read their own push subscriptions"
on public.push_subscriptions for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.business_memberships m
    where m.business_id = push_subscriptions.business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can create their own push subscriptions" on public.push_subscriptions;
create policy "Members can create their own push subscriptions"
on public.push_subscriptions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.business_memberships m
    where m.business_id = push_subscriptions.business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can update their own push subscriptions" on public.push_subscriptions;
create policy "Members can update their own push subscriptions"
on public.push_subscriptions for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.business_memberships m
    where m.business_id = push_subscriptions.business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.business_memberships m
    where m.business_id = push_subscriptions.business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can delete their own push subscriptions" on public.push_subscriptions;
create policy "Members can delete their own push subscriptions"
on public.push_subscriptions for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.business_memberships m
    where m.business_id = push_subscriptions.business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);
