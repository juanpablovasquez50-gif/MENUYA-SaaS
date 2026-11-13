-- CLICKOK Support: conversaciones internas con aislamiento por comercio.
create table if not exists public.clickok_support_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clickok_support_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  subject text not null check (char_length(btrim(subject)) between 3 and 180),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_agent_id uuid references public.clickok_support_agents(user_id) on delete set null,
  source text not null default 'portal' check (source in ('portal','assistant','email','whatsapp')),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clickok_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.clickok_support_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id),
  sender_type text not null check (sender_type in ('merchant','agent','admin')),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clickok_support_conversations_business_idx
  on public.clickok_support_conversations(business_id, status, last_message_at desc);
create index if not exists clickok_support_conversations_agent_idx
  on public.clickok_support_conversations(assigned_agent_id, status, last_message_at desc);
create index if not exists clickok_support_messages_conversation_idx
  on public.clickok_support_messages(conversation_id, created_at);

create or replace function public.clickok_support_is_agent()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clickok_support_agents a
    where a.user_id = auth.uid() and a.is_active = true
  );
$$;

create or replace function public.clickok_support_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins p where p.user_id = auth.uid());
$$;

create or replace function public.clickok_support_can_access_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

alter table public.clickok_support_agents enable row level security;
alter table public.clickok_support_conversations enable row level security;
alter table public.clickok_support_messages enable row level security;

drop policy if exists clickok_support_agents_read on public.clickok_support_agents;
create policy clickok_support_agents_read on public.clickok_support_agents
for select to authenticated
using (user_id = auth.uid() or public.clickok_support_is_agent() or public.clickok_support_is_admin());

drop policy if exists clickok_support_agents_admin_manage on public.clickok_support_agents;
create policy clickok_support_agents_admin_manage on public.clickok_support_agents
for all to authenticated
using (public.clickok_support_is_admin())
with check (public.clickok_support_is_admin());

drop policy if exists clickok_support_conversations_read on public.clickok_support_conversations;
create policy clickok_support_conversations_read on public.clickok_support_conversations
for select to authenticated
using (
  public.clickok_support_is_admin()
  or public.clickok_support_is_agent()
  or public.clickok_support_can_access_business(business_id)
);

drop policy if exists clickok_support_conversations_create on public.clickok_support_conversations;
create policy clickok_support_conversations_create on public.clickok_support_conversations
for insert to authenticated
with check (
  created_by = auth.uid()
  and assigned_agent_id is null
  and status = 'open'
  and public.clickok_support_can_access_business(business_id)
);

drop policy if exists clickok_support_conversations_agent_update on public.clickok_support_conversations;
create policy clickok_support_conversations_agent_update on public.clickok_support_conversations
for update to authenticated
using (public.clickok_support_is_agent() or public.clickok_support_is_admin())
with check (public.clickok_support_is_agent() or public.clickok_support_is_admin());

drop policy if exists clickok_support_messages_read on public.clickok_support_messages;
create policy clickok_support_messages_read on public.clickok_support_messages
for select to authenticated
using (
  exists (
    select 1 from public.clickok_support_conversations c
    where c.id = conversation_id
      and (
        public.clickok_support_is_admin()
        or public.clickok_support_is_agent()
        or public.clickok_support_can_access_business(c.business_id)
      )
  )
  and (not internal_note or public.clickok_support_is_agent() or public.clickok_support_is_admin())
);

drop policy if exists clickok_support_messages_create on public.clickok_support_messages;
create policy clickok_support_messages_create on public.clickok_support_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and (
    (
      sender_type = 'merchant'
      and internal_note = false
      and exists (
        select 1 from public.clickok_support_conversations c
        where c.id = conversation_id
          and public.clickok_support_can_access_business(c.business_id)
          and c.status in ('open','pending')
      )
    )
    or (
      sender_type in ('agent','admin')
      and (public.clickok_support_is_agent() or public.clickok_support_is_admin())
    )
  )
);

grant select on public.clickok_support_agents to authenticated;
grant insert, select, update on public.clickok_support_conversations to authenticated;
grant select, insert on public.clickok_support_messages to authenticated;
grant execute on function public.clickok_support_is_agent() to authenticated;
grant execute on function public.clickok_support_is_admin() to authenticated;
grant execute on function public.clickok_support_can_access_business(uuid) to authenticated;

create or replace function public.clickok_support_touch_conversation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  update public.clickok_support_conversations
     set last_message_at = new.created_at,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists clickok_support_message_touch on public.clickok_support_messages;
create trigger clickok_support_message_touch
after insert on public.clickok_support_messages
for each row execute function public.clickok_support_touch_conversation();

-- Add support tables to Supabase Realtime when the standard publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='clickok_support_conversations') then
      alter publication supabase_realtime add table public.clickok_support_conversations;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='clickok_support_messages') then
      alter publication supabase_realtime add table public.clickok_support_messages;
    end if;
  end if;
end $$;

insert into public.platform_settings(setting_key, setting_value, description)
values ('support.enabled', 'false'::jsonb, 'Habilita el portal CLICKOK Support para agentes y comercios')
on conflict (setting_key) do nothing;
