-- A quote is the birth of a project, not a number floating on its own: saving one
-- creates the project immediately, parked at the הצעת מחיר stage. Accepting it
-- moves that project forward; rejecting keeps it as history (projects.lost).
-- That is why project_id is required rather than filled in later.
create table public.quotes (
  id         bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,

  -- The rates are copied in rather than read from settings at display time.
  -- Settings change — rent goes up, he raises his day rate — and a quote has to
  -- keep explaining the price he actually offered, not a price recomputed later.
  planned_days numeric not null default 0,
  day_rate     numeric not null default 0,
  overhead_day numeric not null default 0,  -- rent ÷ workshop days, at quote time

  markup     numeric not null default 0,    -- percent on top of cost
  price      numeric,                       -- the figure he offered; editable
  sent       date,
  decision_due date,                        -- when he expects an answer

  -- null = still out with the client, which is what makes it "pending"
  decision   text check (decision in ('accepted', 'rejected')),
  decided_on date,

  created_at timestamptz not null default now()
);

create index quotes_project_idx on public.quotes (project_id);

-- The lines the price was built from. They are kept because a quote he cannot
-- reopen is a dead end — and because these same lines become the project's
-- materials log later, where planned meets actual.
create table public.quote_items (
  id         bigint generated always as identity primary key,
  quote_id   bigint not null references public.quotes (id) on delete cascade,
  name       text    not null,
  qty        numeric not null default 1,
  unit_cost  numeric not null default 0,
  supplier   text,
  -- planned thickness in mm: the 50→42 story from his own lessons text is why
  -- the materials log needs dimensions and not just a cost
  thickness  numeric,
  created_at timestamptz not null default now()
);

create index quote_items_quote_idx on public.quote_items (quote_id);

grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy "authenticated full access" on public.quotes
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.quote_items
  for all to authenticated using (true) with check (true);
