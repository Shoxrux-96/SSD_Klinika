import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' })); // photos as data URL

const PORT = Number(process.env.PORT ?? 4000);

function uid() { return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// ---------- Employees ----------
app.get('/api/employees', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, category, full_name AS "fullName", phone, email, position, specialty, experience, diploma, photo, added_at AS "addedAt", archived FROM employees ORDER BY added_at DESC');
  res.json(rows);
});
app.post('/api/employees', async (req, res) => {
  const b = req.body;
  const id = uid();
  const addedAt = Date.now();
  await pool.query(
    `INSERT INTO employees (id, category, full_name, phone, email, position, specialty, experience, diploma, photo, added_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, b.category, b.fullName, b.phone ?? '', b.email ?? '', b.position ?? '', b.specialty ?? '', b.experience ?? '', b.diploma ?? '', b.photo ?? null, addedAt],
  );
  res.json({ id, addedAt, archived: false, ...b });
});
app.patch('/api/employees/:id', async (req, res) => {
  const b = req.body;
  const fields: string[] = [];
  const vals: any[] = [];
  const map: Record<string, string> = { fullName: 'full_name', phone: 'phone', email: 'email', position: 'position', specialty: 'specialty', experience: 'experience', diploma: 'diploma', photo: 'photo', archived: 'archived', category: 'category' };
  for (const k of Object.keys(b)) {
    if (map[k]) { fields.push(`${map[k]} = $${fields.length + 1}`); vals.push(b[k]); }
  }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/employees/:id', async (req, res) => {
  await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Service Categories ----------
app.get('/api/service-categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, color FROM service_categories ORDER BY name');
  res.json(rows);
});
app.post('/api/service-categories', async (req, res) => {
  const id = uid();
  await pool.query('INSERT INTO service_categories (id, name, color) VALUES ($1,$2,$3)', [id, req.body.name, req.body.color ?? '#999']);
  res.json({ id, ...req.body });
});
app.patch('/api/service-categories/:id', async (req, res) => {
  const b = req.body;
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['name', 'color']) if (k in b) { fields.push(`${k} = $${fields.length + 1}`); vals.push(b[k]); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE service_categories SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/service-categories/:id', async (req, res) => {
  await pool.query('DELETE FROM service_categories WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Services ----------
app.get('/api/services', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, category_id AS "categoryId", name, price::float AS price, currency, som_value::float AS "somValue", doctor_share::float AS "doctorShare", archived FROM services ORDER BY name');
  res.json(rows);
});
app.post('/api/services', async (req, res) => {
  const b = req.body; const id = uid();
  await pool.query(
    `INSERT INTO services (id, category_id, name, price, currency, som_value, doctor_share, archived)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
    [id, b.categoryId, b.name, b.price ?? 0, b.currency ?? 'som', b.somValue ?? null, b.doctorShare ?? 0],
  );
  res.json({ id, archived: false, ...b });
});
app.patch('/api/services/:id', async (req, res) => {
  const b = req.body;
  const map: Record<string, string> = { categoryId: 'category_id', name: 'name', price: 'price', currency: 'currency', somValue: 'som_value', doctorShare: 'doctor_share', archived: 'archived' };
  const fields: string[] = []; const vals: any[] = [];
  for (const k of Object.keys(b)) if (map[k]) { fields.push(`${map[k]} = $${fields.length + 1}`); vals.push(b[k]); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/services/:id', async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Assignments ----------
app.get('/api/assignments', async (_req, res) => {
  const { rows } = await pool.query('SELECT employee_id AS "employeeId", service_id AS "serviceId" FROM assignments');
  res.json(rows);
});
app.post('/api/assignments/toggle', async (req, res) => {
  const { employeeId, serviceId } = req.body;
  const { rows } = await pool.query('SELECT 1 FROM assignments WHERE employee_id = $1 AND service_id = $2', [employeeId, serviceId]);
  if (rows.length) {
    await pool.query('DELETE FROM assignments WHERE employee_id = $1 AND service_id = $2', [employeeId, serviceId]);
  } else {
    await pool.query('INSERT INTO assignments (employee_id, service_id) VALUES ($1,$2)', [employeeId, serviceId]);
  }
  res.json({ ok: true });
});
app.put('/api/assignments/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  const serviceIds: string[] = req.body.serviceIds ?? [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM assignments WHERE employee_id = $1', [employeeId]);
    for (const sid of serviceIds) {
      await client.query('INSERT INTO assignments (employee_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [employeeId, sid]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  res.json({ ok: true });
});

// ---------- Appointments ----------
app.get('/api/appointments', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, date, time, patient, doctor, service, status FROM appointments ORDER BY date, time');
  res.json(rows);
});
app.post('/api/appointments', async (req, res) => {
  const b = req.body; const id = uid();
  await pool.query(
    'INSERT INTO appointments (id, date, time, patient, doctor, service, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, b.date, b.time, b.patient, b.doctor, b.service, b.status ?? 'kutilmoqda'],
  );
  res.json({ id, status: 'kutilmoqda', ...b });
});
app.patch('/api/appointments/:id', async (req, res) => {
  const b = req.body;
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['date', 'time', 'patient', 'doctor', 'service', 'status']) if (k in b) { fields.push(`${k} = $${fields.length + 1}`); vals.push(b[k]); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/appointments/:id', async (req, res) => {
  await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Patients ----------
app.get('/api/patients', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, full_name AS "fullName", phone, address, region, district, gender, birth_date AS "birthDate", passport, added_at AS "addedAt", archived FROM patients ORDER BY added_at DESC');
  res.json(rows);
});
app.post('/api/patients', async (req, res) => {
  const b = req.body; const id = uid(); const addedAt = Date.now();
  await pool.query(
    'INSERT INTO patients (id, full_name, phone, address, region, district, gender, birth_date, passport, added_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [id, b.fullName, b.phone ?? '', b.address ?? '', b.region ?? null, b.district ?? null, b.gender ?? null, b.birthDate ?? null, b.passport ?? null, addedAt],
  );
  res.json({ id, addedAt, archived: false, ...b });
});
app.patch('/api/patients/:id', async (req, res) => {
  const b = req.body;
  const map: Record<string, string> = { fullName: 'full_name', phone: 'phone', address: 'address', region: 'region', district: 'district', gender: 'gender', birthDate: 'birth_date', passport: 'passport', archived: 'archived' };
  const fields: string[] = []; const vals: any[] = [];
  for (const k of Object.keys(b)) if (map[k]) { fields.push(`${map[k]} = $${fields.length + 1}`); vals.push(b[k]); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE patients SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/patients/:id', async (req, res) => {
  await pool.query('DELETE FROM patients WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Queue ----------
app.get('/api/queue', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, number, patient, doctor, service, added_at AS "addedAt", status FROM queue ORDER BY added_at');
  res.json(rows);
});
app.post('/api/queue', async (req, res) => {
  const b = req.body; const id = uid(); const addedAt = Date.now();
  await pool.query(
    'INSERT INTO queue (id, number, patient, doctor, service, added_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, b.number, b.patient, b.doctor, b.service, addedAt, b.status ?? 'navbatda'],
  );
  res.json({ id, addedAt, status: 'navbatda', ...b });
});
app.patch('/api/queue/:id', async (req, res) => {
  const b = req.body;
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['status', 'number']) if (k in b) { fields.push(`${k} = $${fields.length + 1}`); vals.push(b[k]); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE queue SET ${fields.join(', ')} WHERE id = $${vals.length}`, vals);
  res.json({ ok: true });
});
app.delete('/api/queue/:id', async (req, res) => {
  await pool.query('DELETE FROM queue WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Health
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
