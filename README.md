# Appointment Management System

A simple clinic scheduling app with a React and Vite frontend and a small Node.js API. The API stores appointment data in `server/appointments.json`, which is created locally and excluded from Git.

## GitHub Pages demo

The public demo is available at [https://jitendra135.github.io/appointment_system/](https://jitendra135.github.io/appointment_system/). GitHub Actions builds and deploys it whenever changes are pushed to `main`.

Since GitHub Pages only hosts static files, the Pages build uses browser storage instead of the Node.js API. Accounts use Supabase email authentication; appointment data and settings are still saved in each account's browser on that device and are not shared with clinic staff or other visitors. Clearing the site's browser storage resets that local demo data. Do not enter real patient information.

New accounts have the patient role by default. Supabase authentication does not turn the browser-local appointment demo into a shared or production clinic system.

### Configure Supabase email authentication

1. Create a Supabase project and enable email sign-up in its Authentication settings.
2. Set the Supabase Site URL to `https://jitendra135.github.io/appointment_system/` and allow that URL as a redirect URL.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions variables in **Settings → Secrets and variables → Actions → Variables**. Use the project URL and the public publishable/anon key only; never use the `service_role` key in this frontend.
4. For local development, copy `.env.example` to `.env.local` and fill in the same two public values.

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

Appointment reminders are recorded in the app but are not sent by email or SMS. Supabase protects account sign-in, but the appointment demo data remains browser-local and is not a production clinic service.
