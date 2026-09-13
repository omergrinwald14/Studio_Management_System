-- Offcuts and leftovers sitting in the workshop. Deliberately NOT inventory
-- management, which plan.md keeps out of scope: no quantities deducted when a
-- board is used, no running balance, nothing that can silently go wrong. A stock
-- figure nobody maintains perfectly is worse than none, because it is believed.
--
-- This answers one question instead: "do I already have this, or do I buy it?"
-- He adds a row when something is left over and deletes it when it is gone.
create table public.stock (
  id         bigint generated always as identity primary key,
  name       text not null,                       -- "אגוז אמריקאי"
  -- free text on purpose: "שני לוחות", "חצי יריעה", "כמה חתיכות קטנות" are all
  -- real answers, and forcing a number here would invent precision he does not have
  amount     text,
  thickness  numeric,                             -- mm, the dimension he searches by
  width      numeric,
  length     numeric,
  -- where it came from, kept loosely: the project may be long gone
  source     text,
  note       text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.stock to authenticated;

alter table public.stock enable row level security;

create policy "authenticated full access" on public.stock
  for all to authenticated using (true) with check (true);
