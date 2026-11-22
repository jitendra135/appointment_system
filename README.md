# Appointment Management System

A simple clinic scheduling app with a React and Vite frontend and a small Node.js API. The API stores appointment data in `server/appointments.json`, which is created locally and excluded from Git.

## GitHub Pages app

The public demo is available at [https://jitendra135.github.io/appointment_system/](https://jitendra135.github.io/appointment_system/). GitHub Actions builds and deploys it whenever changes are pushed to `main`.

GitHub Pages hosts the frontend; Supabase Auth handles accounts and Supabase Database stores shared appointment requests. Patients see their own appointments, while accounts with a trusted staff role can view and manage clinic appointments. Provider, clinic-hours, department, and blocked-time settings remain browser-local.

New accounts have the patient role by default. Apply the database migration and assign a trusted staff role before using the admin dashboard. Do not enter real patient information until your clinic has reviewed and approved this system for that use.

### Configure shared appointments and admin access

1. Enable email sign-up. In Supabase **SQL Editor**, run [`supabase/migrations/20261122000000_shared_appointments.sql`](./supabase/migrations/20261122000000_shared_appointments.sql).
2. Set the Supabase Site URL to `https://jitendra135.github.io/appointment_system/` and allow that URL as a redirect URL.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions variables in **Settings > Secrets and variables > Actions > Variables**. Use the project URL and public publishable/anon key only; never put the `service_role` key in the frontend.
4. Create your admin account through the app's **Create account** form using your email and a private, strong password. Then run this in Supabase SQL Editor, replacing the email with that account's email:

   ```sql
   update auth.users
   set raw_app_meta_data =
     coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
   where email = 'admin@example.com';
   ```

   Confirm the statement updates exactly one account. Sign out and back in so the admin role is loaded. Do not use a shared `admin` / `admin` password on this public site.
5. Push to `main` and wait for the Pages deployment. Admins can open **Appointments**, review requests marked `scheduled`, and choose **Confirm** or **Reject**. Patients will see their request status when they sign in.
6. For local development, copy `.env.example` to `.env.local` and fill in the same two public values.

## Run locally

Requires Node.js 20 or newer and the Supabase variables above.

```bash
npm install
npm run server
```

In a second terminal:

```bash
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

Appointment reminders are recorded in the app but are not sent by email or SMS. Appointments created before the shared database migration remain in their original browser-local storage and are not automatically imported.
