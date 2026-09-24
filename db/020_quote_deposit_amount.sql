-- The deposit can now be a fixed shekel figure as well as a percentage.
--
-- 014 stored it only as a percentage so it would follow the price. That still
-- holds when he wants it, but clients are often told a round number ("5,000 to
-- start"), and working that back into a percentage is arithmetic he should not
-- have to do. Same shape as labour_mode (011): a mode, and the field it picks.
-- deposit_percent stays as it is, so existing quotes keep their deposit.
alter table public.quotes
  add column deposit_mode text not null default 'percent'
    check (deposit_mode in ('percent', 'amount')),
  add column deposit_amount numeric not null default 0
    check (deposit_amount >= 0);
