-- Suppliers are a real table for the same reason clients are (D5): the spec asks
-- for personal notes against each one — "this yard's phone measurements are not
-- always accurate" — and a note has nowhere to live if the supplier is only ever
-- a name typed into a material line.
create table public.suppliers (
  id         bigint generated always as identity primary key,
  name       text not null,
  phone      text,
  note       text,        -- the point of the table: what he learned about them
  created_at timestamptz not null default now()
);

-- The materials log, and the differentiator of the whole system: planned versus
-- actual dimensions, not just a cost. A board ordered at 50mm arrives at 42mm
-- after planing and the entire cut plan changes — that story is from his own
-- lessons text, and it is why these two columns exist side by side.
create table public.materials (
  id          bigint generated always as identity primary key,
  project_id  bigint not null references public.projects (id) on delete cascade,
  -- the supplier may be unknown when the line is planned, and deleting a supplier
  -- must not delete the record of what was bought
  supplier_id bigint references public.suppliers (id) on delete set null,

  name        text    not null,   -- "לוחות אגוז אמריקאי"
  qty         numeric not null default 1,

  -- millimetres. planned comes from the quote or the cut plan; actual is what
  -- turned up, and the gap between them is the thing worth seeing.
  planned_thickness numeric,
  actual_thickness  numeric,
  width       numeric,
  length      numeric,

  planned_cost numeric,
  actual_cost  numeric,
  note        text,
  created_at  timestamptz not null default now()
);

create index materials_project_idx on public.materials (project_id);
create index materials_supplier_idx on public.materials (supplier_id);

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.materials to authenticated;

alter table public.suppliers enable row level security;
alter table public.materials enable row level security;

create policy "authenticated full access" on public.suppliers
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.materials
  for all to authenticated using (true) with check (true);
