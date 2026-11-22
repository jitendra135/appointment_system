import { createServer } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(directory, 'appointments.json');
const port = Number(process.env.API_PORT || 3001);
const statuses = new Set(['scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'rejected', 'cancelled', 'no-show']);

function dateOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const seed = {
  providers: [
    { id: 'prv-1', name: 'Dr. Aarav Sharma', specialty: 'Primary care', email: 'aarav.sharma@wellnest.in', phone: '+91 98765 43210', color: '#b75b46' },
    { id: 'prv-2', name: 'Dr. Priya Nair', specialty: 'Dermatology', email: 'priya.nair@wellnest.in', phone: '+91 98765 43211', color: '#487765' },
    { id: 'prv-3', name: 'Dr. Arjun Mehta', specialty: 'Cardiology', email: 'arjun.mehta@wellnest.in', phone: '+91 98765 43212', color: '#a88042' },
    { id: 'prv-4', name: 'Dr. Ananya Iyer', specialty: 'Pediatrics', email: 'ananya.iyer@wellnest.in', phone: '+91 98765 43213', color: '#6878a0' },
  ],
  departments: ['Primary care', 'Dermatology', 'Cardiology', 'Pediatrics'],
  blocks: [],
  clinic: { isOpen: true, openingTime: '09:00', closingTime: '18:00' },
  appointments: [
    { id: 'apt-1', patientName: 'Olivia Bennett', patientEmail: 'olivia.b@example.com', patientPhone: '(415) 555-0121', providerId: 'prv-1', date: dateOffset(0), time: '09:00', duration: 30, type: 'Annual check-up', status: 'confirmed', notes: 'Routine annual visit.' },
    { id: 'apt-2', patientName: 'James Wilson', patientEmail: 'james.w@example.com', patientPhone: '(415) 555-0173', providerId: 'prv-2', date: dateOffset(0), time: '09:30', duration: 45, type: 'Follow-up', status: 'scheduled', notes: '' },
    { id: 'apt-3', patientName: 'Amara Johnson', patientEmail: 'amara.j@example.com', patientPhone: '(415) 555-0156', providerId: 'prv-3', date: dateOffset(0), time: '10:30', duration: 30, type: 'Consultation', status: 'confirmed', notes: 'Review recent test results.' },
    { id: 'apt-4', patientName: 'Ethan Garcia', patientEmail: 'ethan.g@example.com', patientPhone: '(415) 555-0168', providerId: 'prv-4', date: dateOffset(0), time: '11:00', duration: 30, type: 'New patient', status: 'scheduled', notes: '' },
    { id: 'apt-5', patientName: 'Grace Kim', patientEmail: 'grace.k@example.com', patientPhone: '(415) 555-0119', providerId: 'prv-1', date: dateOffset(1), time: '09:30', duration: 30, type: 'Follow-up', status: 'confirmed', notes: '' },
    { id: 'apt-6', patientName: 'Lucas Martin', patientEmail: 'lucas.m@example.com', patientPhone: '(415) 555-0142', providerId: 'prv-2', date: dateOffset(2), time: '13:00', duration: 45, type: 'Consultation', status: 'scheduled', notes: '' },
    { id: 'apt-7', patientName: 'Mia Thompson', patientEmail: 'mia.t@example.com', patientPhone: '(415) 555-0104', providerId: 'prv-3', date: dateOffset(-1), time: '14:00', duration: 30, type: 'Annual check-up', status: 'completed', notes: '' },
  ],
};

async function loadStore() {
  try {
    const store = JSON.parse(await readFile(dataPath, 'utf8'));
    store.clinic ??= structuredClone(seed.clinic);
    store.departments ??= structuredClone(seed.departments);
    store.blocks ??= [];
    return store;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await saveStore(seed);
    return structuredClone(seed);
  }
}

async function saveStore(store) {
  const temporaryPath = `${dataPath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(store, null, 2));
  await rename(temporaryPath, dataPath);
}

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function validateAppointment(input, store, id) {
  const fields = ['patientName', 'providerId', 'date', 'time', 'type'];
  if (fields.some((field) => typeof input[field] !== 'string' || !input[field].trim())) return 'Complete all required appointment fields.';
  if (!store.providers.some((provider) => provider.id === input.providerId)) return 'Choose a valid provider.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Choose a valid date.';
  const [year, month, day] = input.date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return 'Choose a valid date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return 'Choose a valid appointment time.';
  const duration = Number(input.duration ?? 30);
  if (!Number.isInteger(duration) || duration < 15 || duration > 180) return 'Duration must be between 15 and 180 minutes.';
  const start = input.time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const opensAt = store.clinic.openingTime.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const closesAt = store.clinic.closingTime.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  if (start < opensAt || start + duration > closesAt) return `Appointment must fit within clinic hours (${store.clinic.openingTime}–${store.clinic.closingTime}).`;
  const conflict = store.appointments.some((appointment) => {
    if (appointment.id === id || appointment.providerId !== input.providerId || appointment.date !== input.date || ['cancelled', 'rejected', 'no-show'].includes(appointment.status)) return false;
    const otherStart = appointment.time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    return start < otherStart + appointment.duration && otherStart < start + duration;
  });
  if (conflict) return 'This provider already has an appointment during that time.';
  const blocked = (store.blocks || []).some((block) => {
    if (block.providerId !== input.providerId || block.date !== input.date) return false;
    const blockStart = block.time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    return start < blockStart + block.duration && blockStart < start + duration;
  });
  if (blocked) return 'This provider is unavailable during that time.';
  if (input.patientEmail && !/^\S+@\S+\.\S+$/.test(input.patientEmail)) return 'Enter a valid patient email address.';
  return null;
}

let requestQueue = Promise.resolve();
const server = createServer((request, response) => {
  const handleRequest = async () => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return response.end();
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const store = await loadStore();
    if (parts[0] !== 'api') return send(response, 404, { error: 'Route not found.' });
    if (parts[1] === 'health' && request.method === 'GET') return send(response, 200, { status: 'ok' });
    if (parts[1] === 'clinic' && request.method === 'GET') return send(response, 200, store.clinic);
    if (parts[1] === 'clinic' && request.method === 'PATCH') {
      const input = await readBody(request);
      const settings = { ...store.clinic, ...input };
      if (typeof settings.isOpen !== 'boolean') return send(response, 400, { error: 'Clinic status must be open or closed.' });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.openingTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.closingTime)) return send(response, 400, { error: 'Enter valid opening and closing times.' });
      const openingMinutes = settings.openingTime.split(':').reduce((total, part) => total * 60 + Number(part), 0);
      const closingMinutes = settings.closingTime.split(':').reduce((total, part) => total * 60 + Number(part), 0);
      if (openingMinutes >= closingMinutes) return send(response, 400, { error: 'Closing time must be later than opening time.' });
      store.clinic = settings;
      await saveStore(store);
      return send(response, 200, store.clinic);
    }
    if (parts[1] === 'departments' && request.method === 'GET') return send(response, 200, store.departments);
    if (parts[1] === 'departments' && request.method === 'POST') {
      const input = await readBody(request);
      const name = input.name?.trim();
      if (!name) return send(response, 400, { error: 'Department name is required.' });
      if (store.departments.some((department) => department.toLowerCase() === name.toLowerCase())) return send(response, 409, { error: 'That department already exists.' });
      store.departments.push(name);
      await saveStore(store);
      return send(response, 201, store.departments);
    }
    if (parts[1] === 'blocks' && request.method === 'GET') return send(response, 200, store.blocks);
    if (parts[1] === 'blocks' && request.method === 'POST') {
      const input = await readBody(request);
      if (typeof input.providerId !== 'string' || !store.providers.some((provider) => provider.id === input.providerId)) return send(response, 400, { error: 'Choose a valid provider.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return send(response, 400, { error: 'Choose a valid date and time.' });
      const [year, month, day] = input.date.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);
      if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return send(response, 400, { error: 'Choose a valid date.' });
      const duration = Number(input.duration || 30);
      if (!Number.isInteger(duration) || duration < 15 || duration > 180) return send(response, 400, { error: 'Duration must be between 15 and 180 minutes.' });
      const block = { id: `blk-${crypto.randomUUID()}`, providerId: input.providerId, date: input.date, time: input.time, duration, reason: input.reason?.trim() || 'Unavailable' };
      const start = Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3));
      const opening = Number(store.clinic.openingTime.slice(0, 2)) * 60 + Number(store.clinic.openingTime.slice(3));
      const closing = Number(store.clinic.closingTime.slice(0, 2)) * 60 + Number(store.clinic.closingTime.slice(3));
      if (start < opening || start + duration > closing) return send(response, 400, { error: 'Unavailable time must fit within clinic hours.' });
      const conflict = store.appointments.some((appointment) => appointment.providerId === block.providerId && appointment.date === block.date && !['cancelled', 'rejected', 'no-show'].includes(appointment.status) && Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) < Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) + block.duration && Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) < Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) + appointment.duration);
      if (conflict) return send(response, 409, { error: 'This provider already has an appointment during that time.' });
      const overlappingBlock = store.blocks.some((item) => item.providerId === block.providerId && item.date === block.date && start < Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) + item.duration && Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) < start + duration);
      if (overlappingBlock) return send(response, 409, { error: 'This provider already has unavailable time during that slot.' });
      store.blocks.push(block);
      await saveStore(store);
      return send(response, 201, block);
    }
    if (parts[1] === 'blocks' && parts[2] && request.method === 'DELETE') {
      const index = store.blocks.findIndex((block) => block.id === parts[2]);
      if (index < 0) return send(response, 404, { error: 'Unavailable time not found.' });
      store.blocks.splice(index, 1);
      await saveStore(store);
      return send(response, 200, { ok: true });
    }
    if (parts[1] === 'providers' && request.method === 'GET' && parts.length === 2) return send(response, 200, store.providers);
    if (parts[1] === 'providers' && request.method === 'POST' && parts.length === 2) {
      const input = await readBody(request);
      if (!input.name?.trim() || !input.specialty?.trim()) return send(response, 400, { error: 'Provider name and specialty are required.' });
      const provider = { id: `prv-${crypto.randomUUID()}`, name: input.name.trim(), specialty: input.specialty.trim(), email: input.email?.trim() || '', phone: input.phone?.trim() || '', color: input.color || '#487765' };
      store.providers.push(provider);
      await saveStore(store);
      return send(response, 201, provider);
    }
    if (parts[1] === 'appointments' && request.method === 'GET' && parts.length === 2) {
      let appointments = store.appointments;
      const date = url.searchParams.get('date');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const status = url.searchParams.get('status');
      if (date) appointments = appointments.filter((item) => item.date === date);
      if (from) appointments = appointments.filter((item) => item.date >= from);
      if (to) appointments = appointments.filter((item) => item.date <= to);
      if (status) appointments = appointments.filter((item) => item.status === status);
      return send(response, 200, appointments.toSorted((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    }
    if (parts[1] === 'appointments' && parts[2]) {
      const index = store.appointments.findIndex((item) => item.id === parts[2]);
      if (request.method === 'DELETE') {
        if (index < 0) return send(response, 404, { error: 'Appointment not found.' });
        store.appointments.splice(index, 1);
        await saveStore(store);
        return send(response, 200, { ok: true });
      }
      if (request.method === 'PATCH') {
        if (index < 0) return send(response, 404, { error: 'Appointment not found.' });
        const input = await readBody(request);
        const updated = { ...store.appointments[index], ...input };
        if (!statuses.has(updated.status)) return send(response, 400, { error: 'Choose a valid status.' });
        const error = validateAppointment(updated, store, updated.id);
        if (error) return send(response, 400, { error });
        store.appointments[index] = updated;
        await saveStore(store);
        return send(response, 200, updated);
      }
      if (parts[3] === 'reminder' && request.method === 'POST') {
        if (index < 0) return send(response, 404, { error: 'Appointment not found.' });
        store.appointments[index].reminderSentAt = new Date().toISOString();
        await saveStore(store);
        return send(response, 200, store.appointments[index]);
      }
    }
    if (parts[1] === 'appointments' && request.method === 'POST' && parts.length === 2) {
      const input = await readBody(request);
      const appointment = { ...input, duration: Number(input.duration || 30), status: input.status || 'scheduled' };
      const error = validateAppointment(appointment, store);
      if (error) return send(response, 400, { error });
      if (!statuses.has(appointment.status)) return send(response, 400, { error: 'Choose a valid status.' });
      appointment.id = `apt-${crypto.randomUUID()}`;
      appointment.patientName = appointment.patientName.trim();
      appointment.type = appointment.type.trim();
      appointment.notes = appointment.notes?.trim() || '';
      store.appointments.push(appointment);
      await saveStore(store);
      return send(response, 201, appointment);
    }
    return send(response, 404, { error: 'Route not found.' });
  } catch (error) {
    return send(response, error.status || 500, { error: error.status ? error.message : 'The server could not complete the request.' });
  }
  };
  requestQueue = requestQueue.then(handleRequest, handleRequest);
});

server.listen(port, '0.0.0.0', () => console.log(`Appointment API listening on http://localhost:${port}`));