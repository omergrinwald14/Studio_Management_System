-- A heartbeat target for the daily keep-alive (D4).
--
-- Supabase pauses a free project after 7 days idle, so something has to query it
-- every day. That job runs signed out, and every other table refuses a signed-out
-- reader by design (D19) — which made the ping fail with "permission denied" and
-- turned a health check into something that succeeded only by failing.
--
-- So: one table that is deliberately readable by anyone, holding one row and no
-- information. Reading it proves the database answered; there is nothing in it to
-- leak. Every other table keeps its logged-in-only rule untouched.
create table public.ping (
  id        smallint primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

insert into public.ping (id) values (1);

grant select on public.ping to anon, authenticated;

alter table public.ping enable row level security;

create policy "anyone may read the heartbeat" on public.ping
  for select to anon, authenticated using (true);
