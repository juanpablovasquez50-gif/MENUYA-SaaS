alter table public.store_settings
  add column if not exists background_color text not null default '#f7f7f5',
  add column if not exists card_background_color text not null default '#ffffff';
