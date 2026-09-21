# U.M.S SASAULI URDU — Simple Teacher Access Version

## Teacher workflow
1. Open the website.
2. Enter the school password: `Mahtab@123`
3. The website automatically connects to the Supabase cloud database.
4. Teachers do not enter the Supabase URL, publishable key, email, or Supabase password.

## Important: one-time Supabase database change
The current V6 database policies allow only `authenticated` users. This simple version uses the Supabase publishable key without individual teacher accounts, so the `student_marks` table must allow the `anon` role.

Run the following in **Supabase → SQL Editor**, with the source set to **Database**:

```sql
-- Keep Row Level Security enabled.
alter table public.student_marks enable row level security;

-- Remove the old authenticated-only policies.
drop policy if exists "authenticated users can read student marks" on public.student_marks;
drop policy if exists "authenticated users can insert student marks" on public.student_marks;
drop policy if exists "authenticated users can update student marks" on public.student_marks;
drop policy if exists "authenticated users can delete student marks" on public.student_marks;

-- Allow the school web app (publishable/anon role) to work with marks.
create policy "school app can read student marks"
on public.student_marks
for select
to anon
using (true);

create policy "school app can insert student marks"
on public.student_marks
for insert
to anon
with check (true);

create policy "school app can update student marks"
on public.student_marks
for update
to anon
using (true)
with check (true);

create policy "school app can delete student marks"
on public.student_marks
for delete
to anon
using (true);
```

Realtime is already enabled for `student_marks` in the existing project. If needed, verify that `public.student_marks` appears under the `supabase_realtime` publication.

## Security note
The school password is a simple website access gate, not strong authentication. Anyone who knows the password can use the app. The Supabase publishable key is safe to ship in a browser application, but the database must be protected by RLS. **Never put a Supabase secret/service-role key in this website.**
