-- The forecast assumed rent lands on the 1st of the month; it actually falls on
-- the 15th. Rather than hardcode a different day, this makes it a setting he can
-- edit himself (D12) — the day of month the rent is due.
alter table public.settings
  add column rent_day smallint not null default 15 check (rent_day between 1 and 28);

-- 28 caps the range so every month can honour the date (no Feb 30th problem).
