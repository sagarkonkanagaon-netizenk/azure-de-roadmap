-- Data Dhaba accounts. Paste into Supabase: SQL Editor > New query > Run.
-- One row per user. Learners can read their own row and move their active device,
-- but only the server (service role, used later by payments) can change plan or pro_until.

create table if not exists public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  active_device     text,
  device_label      text,
  device_changed_at timestamptz,
  device_changes    int not null default 0,
  plan              text not null default 'free' check (plan in ('free', 'pro')),
  pro_until         date,
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = user_id);

-- No insert or update policies: learners change their row only through claim_device below.

create or replace function public.claim_device(p_device text, p_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into profiles (user_id, active_device, device_label, device_changed_at, device_changes)
  values (auth.uid(), left(p_device, 64), left(p_label, 80), now(), 1)
  on conflict (user_id) do update
    set active_device     = excluded.active_device,
        device_label      = excluded.device_label,
        device_changed_at = now(),
        device_changes    = profiles.device_changes
                            + case when profiles.active_device is distinct from excluded.active_device then 1 else 0 end;
end;
$$;

revoke all on function public.claim_device(text, text) from public;
grant execute on function public.claim_device(text, text) to authenticated;

-- Pro waitlist. Anyone can add themselves; nobody can read the list from the site.
-- You see it in Supabase under Table Editor > waitlist (Export to CSV from there).
create table if not exists public.waitlist (
  id         bigint generated always as identity primary key,
  name       text not null check (length(name) between 1 and 120),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and length(email) <= 200),
  plan       text check (length(plan) <= 40),
  stage      text check (length(stage) <= 40),
  want       text check (length(want) <= 1000),
  source     text check (length(source) <= 40),
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_once on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

drop policy if exists "anyone can join" on public.waitlist;
create policy "anyone can join" on public.waitlist
  for insert to anon, authenticated with check (true);
-- No select, update or delete policies: the list is private to you.

-- Learning progress saved to the account (XP, solved problems, streak days).
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 500000),
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Contact form messages. Anyone can send one; nobody can read them from the site.
-- You read them in Supabase under Table Editor > contact_messages.
create table if not exists public.contact_messages (
  id         bigint generated always as identity primary key,
  name       text not null check (length(name) between 1 and 120),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and length(email) <= 200),
  topic      text check (length(topic) <= 60),
  message    text not null check (length(message) between 10 and 4000),
  page       text check (length(page) <= 200),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "anyone can write" on public.contact_messages;
create policy "anyone can write" on public.contact_messages
  for insert to anon, authenticated with check (true);
grant insert on public.contact_messages to anon, authenticated;
-- No select, update or delete policies: messages are private to you.

-- Spam guard: forms are open to everyone, so cap how fast rows can arrive.
-- At most 3 rows per email per hour, and 60 rows per table per 10 minutes overall.
-- A bot that skips the site and calls the database directly still hits these limits.
create or replace function public.limit_form_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare per_email int; overall int;
begin
  execute format('select count(*) from public.%I where lower(email) = lower($1) and created_at > now() - interval ''1 hour''', tg_table_name)
    into per_email using new.email;
  execute format('select count(*) from public.%I where created_at > now() - interval ''10 minutes''', tg_table_name)
    into overall;
  if per_email >= 3 or overall >= 60 then
    raise exception 'Too many messages right now. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.limit_form_rate() from public;

drop trigger if exists contact_rate on public.contact_messages;
create trigger contact_rate before insert on public.contact_messages
  for each row execute function public.limit_form_rate();
drop trigger if exists waitlist_rate on public.waitlist;
create trigger waitlist_rate before insert on public.waitlist
  for each row execute function public.limit_form_rate();
