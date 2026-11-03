/**
 * ZENVE CENTRAL DATABASE (zenve_main) CONTINUOUS SYNC DAEMON
 * Runs every 10 seconds to fetch any new / updated details from doctor_crm
 * and admin_crm and replicate them directly into zenve_main.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      env[trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim();
    }
  }
  return env;
}

const env = {
  ...parseEnv(path.join(rootDir, '.env')),
  ...parseEnv(path.join(rootDir, 'central_db.env'))
};

const DB_HOST = env.CENTRAL_DB_HOST || '127.0.0.1';
const DB_PORT = env.CENTRAL_DB_PORT || '3307';
const MAIN_DB = env.CENTRAL_DB_NAME || 'zenve_main';
const MAIN_USER = env.CENTRAL_DB_USER || 'zenve_main_user';
const MAIN_PASS = env.CENTRAL_DB_PASSWORD || 'zenvemain-123';

const DOCTOR_DB = env.DOCTOR_DB_NAME || 'doctor_crm';
const DOCTOR_USER = env.DB_USER || 'doctor_app';
const DOCTOR_PASS = env.DB_PASSWORD || 'doctor-123';

const ADMIN_DB = env.ADMIN_DB_NAME || 'admin_crm';
const ADMIN_USER = env.ADMIN_DB_USER || 'admin_crm_app';
const ADMIN_PASS = env.ADMIN_DB_PASSWORD || 'admin-123';

const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe';

function queryJson(user, pass, db, sql) {
  const singleLine = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const cmd = `"${MYSQL_BIN}" -h ${DB_HOST} -P ${DB_PORT} -u ${user} -p${pass} ${db} --batch --raw -e "${singleLine}"`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  if (!out) return [];
  const lines = out.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = parts[idx] !== undefined && parts[idx] !== 'NULL' ? parts[idx].trim() : null;
    });
    rows.push(obj);
  }
  return rows;
}

function runSqlBatch(statements) {
  if (!statements || statements.length === 0) return;
  const tempPath = path.join(rootDir, 'scripts', '_temp_sync_batch.sql');
  const content = ['SET FOREIGN_KEY_CHECKS = 0;', `USE \`${MAIN_DB}\`;`, ...statements, 'SET FOREIGN_KEY_CHECKS = 1;'].join('\n');
  fs.writeFileSync(tempPath, content, 'utf8');

  try {
    const cmd = `Get-Content "${tempPath}" | & "${MYSQL_BIN}" -h ${DB_HOST} -P ${DB_PORT} -u ${MAIN_USER} -p${MAIN_PASS} ${MAIN_DB}`;
    execSync(cmd, { shell: 'powershell.exe', stdio: ['pipe', 'pipe', 'pipe'] });
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

function syncCycle() {
  const statements = [];

  // 1. Owners -> pet_parents
  const owners = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT id, full_name, email, phone, city, created_at FROM owners;
  `);
  for (const o of owners) {
    const name = (o.full_name || 'Owner').replace(/'/g, "''");
    const email = (o.email || '').replace(/'/g, "''");
    const phone = (o.phone || '').replace(/'/g, "''");
    const city = (o.city || 'Bangalore').replace(/'/g, "''");
    const dt = o.created_at ? `'${o.created_at.split('.')[0]}'` : 'NOW()';
    statements.push(`
      INSERT INTO pet_parents (id, full_name, email, phone, city, created_at)
      VALUES (${o.id}, '${name}', '${email}', '${phone}', '${city}', ${dt})
      ON DUPLICATE KEY UPDATE full_name='${name}', email='${email}', phone='${phone}', city='${city}';
    `);
  }

  // 2. Patients -> pets
  const patients = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT id, name, species, breed, gender, weight, owner_id FROM patients;
  `);
  for (const p of patients) {
    const name = (p.name || 'Pet').replace(/'/g, "''");
    const species = (p.species || 'Dog').replace(/'/g, "''");
    const breed = (p.breed || 'Mixed').replace(/'/g, "''");
    const gender = (p.gender || 'Unknown').replace(/'/g, "''");
    const weight = parseFloat(p.weight) || 5.0;
    const parentId = parseInt(p.owner_id) || 1;
    statements.push(`
      INSERT INTO pets (id, parent_id, name, species, breed, gender, weight_kg, is_active)
      VALUES (${p.id}, ${parentId}, '${name}', '${species}', '${breed}', '${gender}', ${weight}, 1)
      ON DUPLICATE KEY UPDATE parent_id=${parentId}, name='${name}', species='${species}', breed='${breed}', gender='${gender}', weight_kg=${weight};
    `);
  }

  // 3. Appointments -> appointments
  const appointments = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT id, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status
    FROM appointments;
  `);
  for (const a of appointments) {
    const petId = parseInt(a.patient_id) || 1;
    const docId = parseInt(a.doctor_id) || 1;
    const apptType = (a.appointment_type || 'In Clinic').replace(/'/g, "''");
    const status = (a.status || 'Confirmed').replace(/'/g, "''");
    statements.push(`
      INSERT INTO appointments (id, pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee)
      VALUES (${a.id}, ${petId}, ${docId}, '${a.appointment_date}', '${a.appointment_time}', '${apptType}', '${status}', 'PAID', 500.0)
      ON DUPLICATE KEY UPDATE status='${status}', appointment_date='${a.appointment_date}', appointment_time='${a.appointment_time}';
    `);
  }

  // 4. Prescriptions -> prescriptions
  const prescriptions = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT id, doctor_id, patient_id, prescription_date, created_at FROM prescriptions;
  `);
  for (const rx of prescriptions) {
    const petId = parseInt(rx.patient_id) || 1;
    const docId = parseInt(rx.doctor_id) || 1;
    const dt = rx.created_at ? `'${rx.created_at.split('.')[0]}'` : 'NOW()';
    statements.push(`
      INSERT INTO prescriptions (id, doctor_id, pet_id, valid_until, created_at)
      VALUES (${rx.id}, ${docId}, ${petId}, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ${dt})
      ON DUPLICATE KEY UPDATE doctor_id=${docId}, pet_id=${petId};
    `);
  }

  // 5. Invoices -> clinical_invoices
  const invoices = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT i.id, i.invoice_number, i.total_amount, i.paid_amount, i.payment_status, i.invoice_date, i.created_at, i.notes,
           COALESCE(p.name, 'Pet') AS pet_name,
           COALESCE(o.full_name, 'Owner') AS parent_name,
           COALESCE(u.full_name, 'Doctor') AS doctor_name
    FROM invoices i
    LEFT JOIN patients p ON i.patient_id = p.id
    LEFT JOIN owners o ON i.owner_id = o.id
    LEFT JOIN users u ON i.doctor_id = u.id;
  `);
  for (const inv of invoices) {
    const invNo = (inv.invoice_number || `INV-${inv.id}`).replace(/'/g, "''");
    const petName = (inv.pet_name || 'Pet').replace(/'/g, "''");
    const parentName = (inv.parent_name || 'Owner').replace(/'/g, "''");
    const docName = (inv.doctor_name || 'Doctor').replace(/'/g, "''");
    const total = parseFloat(inv.total_amount) || 0.0;
    const paid = parseFloat(inv.paid_amount) || total;
    const status = (inv.payment_status || 'PAID').replace(/'/g, "''");
    const notes = (inv.notes || '').replace(/'/g, "''");
    const invDate = inv.invoice_date ? `'${inv.invoice_date}'` : 'CURDATE()';
    const createdAt = inv.created_at ? `'${inv.created_at.split('.')[0]}'` : 'NOW()';
    statements.push(`
      INSERT INTO clinical_invoices (id, invoice_number, pet_name, parent_name, doctor_name, consultation_fee, medicine_fee, total_amount, paid_amount, payment_status, payment_method, notes, invoice_date, created_at)
      VALUES (${inv.id}, '${invNo}', '${petName}', '${parentName}', '${docName}', ${total}, 0, ${total}, ${paid}, '${status}', 'Cash', '${notes}', ${invDate}, ${createdAt})
      ON DUPLICATE KEY UPDATE total_amount=${total}, paid_amount=${paid}, payment_status='${status}';
    `);
  }

  // 6. Vaccinations -> vaccinations
  const vacs = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT id, patient_id, vaccine_name, vaccination_date, next_due_date, batch_number FROM vaccinations;
  `);
  for (const v of vacs) {
    const petId = parseInt(v.patient_id) || 1;
    const name = (v.vaccine_name || 'Vaccine').replace(/'/g, "''");
    const admDate = v.vaccination_date ? `'${v.vaccination_date}'` : 'CURDATE()';
    const nextDate = v.next_due_date ? `'${v.next_due_date}'` : 'NULL';
    const batch = (v.batch_number || 'BATCH-01').replace(/'/g, "''");
    statements.push(`
      INSERT INTO vaccinations (id, pet_id, vaccine_name, administered_on, next_due_on, batch_number)
      VALUES (${v.id}, ${petId}, '${name}', ${admDate}, ${nextDate}, '${batch}')
      ON DUPLICATE KEY UPDATE vaccine_name='${name}', next_due_on=${nextDate};
    `);
  }

  // 7. Follow-ups -> clinical_follow_ups
  const fus = queryJson(DOCTOR_USER, DOCTOR_PASS, DOCTOR_DB, `
    SELECT f.id, f.reason, f.follow_up_date, f.next_follow_up_date, f.status, f.created_at, f.doctor_name,
           COALESCE(p.name, 'Pet') AS pet_name,
           COALESCE(o.full_name, 'Owner') AS parent_name
    FROM follow_ups f
    LEFT JOIN patients p ON f.patient_id = p.id
    LEFT JOIN owners o ON p.owner_id = o.id;
  `);
  for (const fu of fus) {
    const code = `FU-${String(fu.id).padStart(5, '0')}`;
    const petName = (fu.pet_name || 'Pet').replace(/'/g, "''");
    const parentName = (fu.parent_name || 'Owner').replace(/'/g, "''");
    const docName = (fu.doctor_name || 'Doctor').replace(/'/g, "''");
    const reason = (fu.reason || 'Routine follow-up').replace(/'/g, "''");
    const fuDate = fu.follow_up_date ? `'${fu.follow_up_date}'` : 'CURDATE()';
    const nextDate = fu.next_follow_up_date ? `'${fu.next_follow_up_date}'` : fuDate;
    const status = (fu.status || 'SCHEDULED').replace(/'/g, "''");
    const dt = fu.created_at ? `'${fu.created_at.split('.')[0]}'` : 'NOW()';
    statements.push(`
      INSERT INTO clinical_follow_ups (id, followup_code, pet_name, parent_name, doctor_name, reason, followup_date, next_follow_up_date, status, reminder_sent, created_at)
      VALUES (${fu.id}, '${code}', '${petName}', '${parentName}', '${docName}', '${reason}', ${fuDate}, ${nextDate}, '${status}', 0, ${dt})
      ON DUPLICATE KEY UPDATE reason='${reason}', status='${status}';
    `);
  }

  // 8. Doctors -> doctors
  const doctors = queryJson(ADMIN_USER, ADMIN_PASS, ADMIN_DB, `
    SELECT id, full_name, email, phone, status FROM doctors;
  `);
  for (const d of doctors) {
    const name = (d.full_name || 'Doctor').replace(/'/g, "''");
    const email = (d.email || '').replace(/'/g, "''");
    const phone = (d.phone || '').replace(/'/g, "''");
    const st = (d.status || 'Active').replace(/'/g, "''");
    statements.push(`
      INSERT INTO doctors (id, name, email, phone, specializations, consultation_fee)
      VALUES (COALESCE((SELECT id FROM (SELECT id FROM doctors WHERE email='${email}' OR phone='${phone}' LIMIT 1) tmp), NULL), '${name}', '${email}', '${phone}', 'Veterinarian', 500.0)
      ON DUPLICATE KEY UPDATE name='${name}', email='${email}', phone='${phone}';
    `);
  }

  runSqlBatch(statements);
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] [SYNC 10s] Synchronized ${statements.length} operations into ${MAIN_DB} successfully.`);
}

console.log('==================================================================');
console.log(' ZENVE CENTRAL DATABASE (zenve_main) CONTINUOUS SYNC DAEMON');
console.log(' Target DB: zenve_main | Polling Interval: 10 seconds');
console.log('==================================================================');

// Run first cycle immediately
try {
  syncCycle();
} catch (e) {
  console.error('[SYNC ERROR]:', e.message);
}

// Then repeat every 10 seconds (10000 ms)
setInterval(() => {
  try {
    syncCycle();
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] [SYNC ERROR]:`, e.message);
  }
}, 10000);
