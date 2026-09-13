-- A board bought half for one job and half for stock is a single bank movement
-- but only half a project cost. Until now a transaction was all-or-nothing:
-- either the whole amount landed on a project or none of it did, which pushed
-- him towards splitting a real purchase into two fake ones.
--
-- The share never touches the ledger or the balance — those still sum `amount`,
-- because that is what actually left the account. It only changes how much of
-- the movement counts towards a project's cost and profitability.
alter table public.txs
  add column project_share numeric not null default 100
    check (project_share > 0 and project_share <= 100);
