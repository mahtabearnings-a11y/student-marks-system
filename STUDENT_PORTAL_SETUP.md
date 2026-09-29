# Student Portal Setup

## One-time Supabase setup

1. Open the Supabase SQL Editor for the same project used by the website.
2. Run `supabase_student_portal.sql`.
3. In Supabase Authentication > Users, create a login account for each student. Use the student's email and an initial password.
4. Log in to the school website as Admin. In **Students**, use **Student Login Accounts** to enter the student's Student ID and Auth email, then click **Link Login**. The SQL helper creates the student mapping.
5. Give the student their login credentials. The student can change the password after signing in.

## What students can access

- Own profile
- Own marks for their available academic sessions
- Own attendance
- Own report-card print/save flow
- Published notices
- Examination schedule
- Class timetable
- Password change

Students cannot edit marks, attendance, student records, promotions, academic sessions, or other students. Database access is protected with Row Level Security policies in the migration.

## Storage behavior

Report cards are generated in the browser and printed/saved through the browser. They are not permanently uploaded to Supabase Storage by this portal. This avoids creating a stored PDF for every student.

Notices, schedules and timetables are stored as small database records. Large files should not be added to the database; use Supabase Storage when file uploads are introduced later.

## Important

The Auth user must already exist before the Admin uses **Link Login**. This build does not expose a privileged service-role key in the browser.
