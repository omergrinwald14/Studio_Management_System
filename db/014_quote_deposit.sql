-- How much of the price the client pays up front to start the job.
--
-- Stored as a percentage rather than an amount so it follows the price: if he
-- edits the quote down, a fixed deposit figure would quietly become a larger
-- share of a smaller job. The document shows both the percentage and the shekel
-- figure it works out to.
alter table public.quotes
  add column deposit_percent numeric not null default 0
    check (deposit_percent between 0 and 100);
