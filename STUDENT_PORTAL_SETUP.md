# Student Portal + Student Login Management Setup

This update is built from the current master copy `student-marks-system-main.zip`.

## What this adds

- Student ID + password login
- Automatic login creation for new students with a Student ID
- Bulk creation for existing students
- Mandatory password change on first login
- Admin-visible current password, because this was explicitly requested
- Admin password change/reset
- Admin enable/disable for each student login
- Read-only student dashboard, profile, marks, attendance, schedules, notices and report-card printing
- Student-specific row-level security (RLS)
- Browser-generated report-card downloads (no permanent PDF copies required)

## 1. GitHub paths

Copy/replace these files in the repository:

```text
index.html
css/student-portal.css
js/auth.js
js/app.js
js/students.js
js/student-portal.js
js/student-accounts.js
supabase_student_portal.sql
supabase/config.toml
supabase/functions/manage-student-login/index.ts
```

You may also keep this setup guide in the repository:

```text
STUDENT_PORTAL_SETUP.md
```

The Edge Function source belongs in the GitHub repository at the path above, but GitHub Pages will not deploy it. It must also be deployed to the Supabase project as an Edge Function named `manage-student-login`.

## 2. Supabase database migration

Open **Supabase → SQL Editor → New query**, paste the complete contents of:

```text
supabase_student_portal.sql
```

then click **Run**.

The migration uses `DROP POLICY IF EXISTS` followed by `CREATE POLICY`, because PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`.

## 3. Deploy the Edge Function

Create/deploy an Edge Function named:

```text
manage-student-login
```

Use the source from:

```text
supabase/functions/manage-student-login/index.ts
```

Do not put a Supabase service-role/secret key in GitHub, JavaScript, or the browser. The function uses Supabase's server-side secret key environment variables to perform Auth admin operations.

If your Supabase project uses the hosted Dashboard deployment flow, create the function in **Supabase → Edge Functions**, paste the file contents, and deploy it. If you use the Supabase CLI, keep `supabase/config.toml` and deploy the function with the CLI.

## 4. Student account workflow

### New student

When an admin creates a student with a non-empty Student ID, the website asks the Edge Function to create the login. If that operation fails, the student record is still saved and the admin receives a warning so the login can be retried from **Student Logins**.

### Existing students

Open **School/Admin Login → Student Logins → Create Missing Accounts**. Accounts are created only for students who do not already have one.

### Student credentials

The username entered by a student is their Student ID. Internally, the implementation maps the Student ID to a synthetic Auth email so Supabase Auth can handle password authentication without requiring students to remember an email address.

Each newly provisioned account receives a generated temporary password and is marked **First Login / Change Required**.

### First login

The student must change the temporary password before normal portal access. After a successful change, the account status becomes **Changed**.

### Admin password visibility

Because the requested design allows the school admin to see the current password, the project stores the current password in a separate `student_login_credentials` table protected by admin-only RLS. This is deliberately sensitive information. Student accounts and student RLS never expose that table to students.

### Enable/disable

In **Student Logins**, an admin can enable or disable an account. Disabling updates the Auth account and the `student_accounts.is_enabled` flag. Student data RLS also requires `is_enabled = true`, so the disabled account cannot read student portal data.

## 5. First test

After the migration and Edge Function are deployed:

1. Open the school website and sign in as an **Admin**.
2. Open **Student Logins**.
3. Click **Create Missing Accounts** for a test student, or use **Create Login** on one row.
4. Copy the generated Student ID and temporary password.
5. Sign out.
6. Log in using the Student ID and temporary password.
7. Confirm that the forced password-change screen appears.
8. Set a new password.
9. Confirm the student can see only their own portal information.
10. Return to Admin → Student Logins and test **Change Password** and **Disable Login / Enable Login**.

## 6. Important operational note

The Student Portal is additive. It does not replace the existing admin/view-only workflow. The existing marks, attendance, student records and academic-session records are not copied into a second student database.

Report cards are generated in the browser for print/save, so normal student downloads do not create a new stored PDF for every student.
