-- Add sequential, human-readable support ticket codes.
create sequence if not exists public.clickok_support_ticket_number_seq;

alter table public.clickok_support_conversations
  add column if not exists ticket_number bigint;

-- Assign stable codes to conversations that existed before this migration.
with numbered as (
  select id, nextval('public.clickok_support_ticket_number_seq') as ticket_number
  from public.clickok_support_conversations
  where ticket_number is null
  order by created_at, id
)
update public.clickok_support_conversations c
set ticket_number = numbered.ticket_number
from numbered
where c.id = numbered.id;

alter table public.clickok_support_conversations
  alter column ticket_number
  set default nextval('public.clickok_support_ticket_number_seq');

alter table public.clickok_support_conversations
  alter column ticket_number set not null;

create unique index if not exists clickok_support_conversations_ticket_number_uidx
  on public.clickok_support_conversations(ticket_number);

select setval(
  'public.clickok_support_ticket_number_seq',
  greatest(coalesce((select max(ticket_number) from public.clickok_support_conversations), 0), 1),
  coalesce((select max(ticket_number) from public.clickok_support_conversations), 0) > 0
);
