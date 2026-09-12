-- Phase 2: the ledger and the settings the client edits himself.
-- Table, grants and RLS policy go in one script deliberately, so no table
-- exists unprotected even briefly — the publishable key ships in the browser.

-- ---------- txs: one flat ledger, the sign carries direction ----------
create table public.txs (
  id          bigint generated always as identity primary key,
  -- null = his כללי / סדנה overhead bucket (rent, consumables), not a project cost
  project_id  bigint references public.projects (id) on delete set null,
  date        date        not null,
  description text        not null,
  category    text,
  -- positive = money in, negative = money out. One column, no type flag.
  amount      numeric     not null,
  -- owner capital: real cash, never revenue (he keeps this separation by hand today)
  capital     boolean     not null default false,
  -- a bank reconciliation row (D14): neither income nor expense
  adjust      boolean     not null default false,
  created_at  timestamptz not null default now(),
  -- a row is capital or an adjustment or an ordinary movement — never two at once
  constraint txs_flags_exclusive check (not (capital and adjust))
);

create index txs_date_idx on public.txs (date desc);
create index txs_project_idx on public.txs (project_id);

-- ---------- settings: one row, everything he can edit himself (D12) ----------
create table public.settings (
  -- the check pins the table to a single row: there is one studio, one set of settings
  id             smallint primary key default 1 check (id = 1),
  opening        numeric not null default 0,   -- opening balance of the עו"ש (D11)
  opening_date   date,
  rent           numeric not null default 0,
  days_per_month numeric not null default 8,
  day_rate       numeric not null default 0,
  updated_at     timestamptz not null default now()
);

insert into public.settings (id) values (1);

-- ---------- access ----------
grant select, insert, update, delete on public.txs to authenticated;
grant select, update on public.settings to authenticated;

alter table public.txs enable row level security;
alter table public.settings enable row level security;

-- D19: one user, so the rule is simply "signed in". using() guards reads,
-- with check() guards writes; both are needed or one direction stays closed.
create policy "authenticated full access" on public.txs
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.settings
  for all to authenticated using (true) with check (true);
