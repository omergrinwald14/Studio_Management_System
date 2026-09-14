-- Operational lessons. From his spec, with his own example:
--
--   "המחסן דיווח בטלפון על עובי 50 מ"מ, בפועל הקורות היו 42 מ"מ לאחר הקצעה —
--    הצריך התאמה בתכנון ה-Joinery"
--
-- That sentence is the reason the materials log tracks planned against actual,
-- and this table is where the reasoning behind such a number gets written down.
-- A figure records what happened; only prose records why, and what to do
-- differently next time.
create table public.lessons (
  id         bigint generated always as identity primary key,
  -- a lesson usually comes out of a job, but not always: some are learned in
  -- the yard or from a supplier, with no project to hang them on
  project_id bigint references public.projects (id) on delete set null,
  date       date    not null default current_date,
  text       text    not null,
  -- Tags are an array rather than their own table. The spec asks for filtering
  -- by tag, not for tags that carry data of their own, and a join table for
  -- what amounts to a handful of labels would cost more than it explains.
  tags       text[]  not null default '{}',
  created_at timestamptz not null default now()
);

create index lessons_project_idx on public.lessons (project_id);
-- GIN is what makes `tags @> '{גימור}'` fast, which is the search the library screen runs
create index lessons_tags_idx on public.lessons using gin (tags);

grant select, insert, update, delete on public.lessons to authenticated;

alter table public.lessons enable row level security;

create policy "authenticated full access" on public.lessons
  for all to authenticated using (true) with check (true);
