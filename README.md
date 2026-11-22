# Appointment Management System

A simple clinic scheduling app with a React and Vite frontend and a small Node.js API. The API stores appointment data in `server/appointments.json`, which is created locally and excluded from Git.

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
