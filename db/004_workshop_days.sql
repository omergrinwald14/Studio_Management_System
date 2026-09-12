-- Workshop days are a business-level measure, not a project one: "how much have
-- I worked and how much capacity is left", regardless of which job it went into.
-- That is why there is no project reference here. The per-project counter stays
-- on `projects.days`, where it exists for a different purpose entirely — loading
-- a share of the rent onto a job's profitability.
--
-- One row per date, so the same day can never be counted twice, and a week or a
-- month is a date range rather than a number someone has to maintain by hand.
create table public.workshop_days (
  date       date        primary key,
  -- a half day is real, so this is numeric rather than a boolean or an integer
  days       numeric     not null default 1 check (days > 0 and days <= 2),
  note       text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.workshop_days to authenticated;

alter table public.workshop_days enable row level security;

create policy "authenticated full access" on public.workshop_days
  for all to authenticated using (true) with check (true);
