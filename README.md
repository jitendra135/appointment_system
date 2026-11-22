# Appointment Management System

A simple clinic scheduling app with a React and Vite frontend and a small Node.js API. The API stores appointment data in `server/appointments.json`, which is created locally and excluded from Git.

## GitHub Pages demo

The public demo is available at [https://jitendra135.github.io/appointment_system/](https://jitendra135.github.io/appointment_system/). GitHub Actions builds and deploys it whenever changes are pushed to `main`.

Since GitHub Pages only hosts static files, the Pages build uses browser storage instead of the Node.js API. Demo appointments and settings are saved in the current browser on the current device; they are not shared with other visitors and clearing the site's browser storage resets them. This is for demonstration only: do not enter real patient information.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run server
```

In a second terminal:

```bash
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

## Demo sign-in

- User ID: `admin`
- Password: `admin`

This is a demo-only, browser-side login, not production authentication. Do not use real patient information or deploy it as a secure service. Appointment reminders are recorded in the app but are not sent by email or SMS.
