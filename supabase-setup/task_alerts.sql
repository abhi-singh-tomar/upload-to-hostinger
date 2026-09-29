-- ─────────────────────────────────────────────────────────────
--  Run this once in Supabase → SQL Editor.
--  Creates the "tasks" table used by the new Add Task feature.
--  Do NOT upload this file to Hostinger — it's a backend setup
--  script, not part of the website.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  day date not null,
  time text not null,              -- "HH:MM", India time, the deadline
  title text not null,
  done boolean not null default false,
  notified_pre boolean not null default false,   -- has the "10 min before" push gone out?
  last_overdue_sent timestamptz,                 -- last time an "overdue" push went out
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_owner" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists tasks_user_day_idx on public.tasks (user_id, day);

-- Nothing to do for Do Not Disturb — it's stored as a plain field
-- (dnd: true/false) inside the existing settings.data jsonb column,
-- so no schema change is needed for that part.
