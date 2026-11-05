# Letterhead module — update package

This is an update-only package for the existing U.M.S. SASAULI URDU Student Marks System. It includes only the files required for the new module, its Supabase backend and the small navigation integration.

## Installation order

1. **Back up the current site and Supabase database.** Keep the existing master copy unchanged.
2. Replace/add the files in this ZIP at the matching paths in the current GitHub repository. Do not delete or replace any other project files.
3. In the Supabase SQL Editor, run `supabase/migrations/202611050001_letterhead_module.sql` once.
4. Deploy the Edge Function from the project root with Supabase CLI:

   ```bash
   supabase functions deploy letterhead-translate
   ```

5. Configure the translation provider key as a Supabase secret (never add it to JavaScript, HTML, or GitHub):

   ```bash
   supabase secrets set GOOGLE_TRANSLATE_API_KEY=YOUR_GOOGLE_CLOUD_TRANSLATION_KEY
   ```

   The Google Cloud Translation API must be enabled for that key. Until this secret and function are deployed, the Letterhead editor and register can be used, but automatic Hindi translation will report that it is not configured.

6. Commit/publish the update to GitHub Pages. Sign in as an Admin and open the new **Letterhead** tab.

## What is isolated

- New Letterhead data is stored only in `letterhead_documents`, `letterhead_counters`, `letterhead_document_versions`, and `letterhead_audit_logs`.
- Existing student, marks, attendance, promotion and result tables are not modified.
- Letterhead writes go through dedicated Supabase RPCs; direct client-side table writes are revoked.
- Protected issued-document edits, moving issued documents to the Recycle Bin, restoring them and permanent deletion reuse the existing `verify_recycle_bin_security_password` RPC.
- Patrank is issued atomically as `UMS/001/2026-27`, with one sequence per academic session. Drafts do not consume a number.
- English and Hindi print in that order. Separate English-only and Hindi-only print actions are included.
- The supplied Hindi school-name artwork is cropped only to omit the “प्रभारी प्रधानाध्यापक” heading line, as requested. The original logo and signature artwork are used.

## Notes before production use

- The first issued letter should be tested with a non-critical sample and checked on A4 paper/PDF preview.
- Browser printing is used for output; choose **Save as PDF** in the browser print dialog when a PDF copy is needed. Automatic archival of PDF snapshots is not part of this update.
- Hindi machine translation must be proofread before issue, especially official terms, names, dates and designations.
- This module was prepared against the supplied master ZIP. The SQL migration has not been run against the live Supabase database from this environment.
- Drafts autosave after a short pause. Issued letters are never autosaved over the issued record; saving changes prompts for the security password and creates a revision.
- Issuance is blocked until the Hindi recipient, subject and body are present and the reviewer approval checkbox is selected. The database checks this approval as well.
