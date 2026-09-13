-- Two additions to the quote builder.
--
-- 1. Labour can now be priced two ways: his own workshop days (unchanged), or
-- an employee's hours at an hourly rate. planned_days still always feeds
-- overhead (the workshop is occupied either way) — only how *labour* is priced
-- changes with the mode.
alter table public.quotes
  add column labour_mode text not null default 'days' check (labour_mode in ('days', 'hours')),
  add column hours        numeric not null default 0,
  add column hourly_rate  numeric not null default 0;

-- The rate itself lives in settings, editable like day_rate (D12) — a fact he
-- sets, not a constant in the code.
alter table public.settings
  add column hourly_rate numeric not null default 0;

-- 2. A discount, in percent, on each of the three cost components shown in the
-- breakdown — materials, labour, overhead — rather than one blanket number.
-- He sometimes wants to shave the labour line for a client and leave the
-- materials cost untouched, which a single total discount cannot express.
alter table public.quotes
  add column materials_discount numeric not null default 0 check (materials_discount between 0 and 100),
  add column labour_discount    numeric not null default 0 check (labour_discount between 0 and 100),
  add column overhead_discount  numeric not null default 0 check (overhead_discount between 0 and 100);
