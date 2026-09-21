# U.M.S SASAULI URDU — Marks Details v5

## What's new
- Printable marks folio is now **A4 Landscape**, so 6-subject classes have enough horizontal space and subject headings do not overlap.
- Class-specific printable pages remain supported.
- Default school details:
  - School: U.M.S SASAULI URDU
  - District: Muzaffarpur
  - Block: Aurai
- Classes 1–2: Urdu, English, Mathematics
- Classes 3–5: Urdu, English, Hindi/Rashtrabhasa, Mathematics, Environmental Science
- Classes 6–8: Urdu, English, Hindi/Rashtrabhasa, Mathematics, Science, Social Science
- Added optional **Supabase cloud mode** for shared online data and multi-person working.

## Important: online multi-person mode
GitHub Pages itself is only the website host. To store shared student data online, this version uses Supabase.

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL below.
3. In the website, enter the Supabase project URL and **anon/public key**, then create/sign in to a user account.
4. Give each authorised teacher their own account. All authenticated users share the same database. With Supabase Realtime enabled for the table, changes are pushed to other open copies of the website.

### Supabase SQL

```sql
create table if not exists public.student_marks (
  id text primary key,
  class_no integer not null,
  section text default '',
  roll integer not null,
  student_name text not null,
  marks jsonb not null default '{}'::jsonb,
  full_marks numeric not null default 50,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.student_marks enable row level security;

-- Enable the table for Supabase Realtime in the Supabase dashboard (Database / Publications) if it is not already enabled.

create policy "authenticated users can read student marks"
on public.student_marks for select
to authenticated
using (true);

create policy "authenticated users can insert student marks"
on public.student_marks for insert
to authenticated
with check (true);

create policy "authenticated users can update student marks"
on public.student_marks for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete student marks"
on public.student_marks for delete
to authenticated
using (true);
```

For production use, tighten the policies if different teachers should have different permissions.

### Security
Use only the Supabase **anon/public key** in the website. Never put a Supabase service-role key in GitHub or the browser.

The cloud feature requires internet access. Without cloud credentials, the app continues to work locally in the browser.

## GitHub Pages
Replace the existing `index.html` with this version and commit it. GitHub Pages will publish the new version.


## Sorting
The Student List has a Sort By control:
- Roll Number — Low to High
- Roll Number — High to Low
- Student Name — A to Z
- Student Name — Z to A
- Percentage — Highest to Lowest
- Percentage — Lowest to Highest
- Total Marks — Highest to Lowest
- Total Marks — Lowest to Highest
- Grade — A to F
- Grade — F to A

Sorting changes only the displayed order. The printable Marks Folio always uses roll-number order for official record keeping.
