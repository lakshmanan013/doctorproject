const { execSync } = require('child_process');
const fs = require('fs');

function queryJson(db, sql) {
  const cmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" -h 127.0.0.1 -P 3307 -u zippy_crm_app -pzippy-123 ${db} --batch --raw -e "${sql}"`;
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

const sqlStatements = [
  'SET FOREIGN_KEY_CHECKS = 0;',
  'USE zenve_main;'
];

// 1. Pet Parents
const parents = queryJson('zippy_crm', 'SELECT id, full_name, email, phone, city, created_at FROM pet_parents;');
for (const p of parents) {
  const name = (p.full_name || 'Owner').replace(/'/g, "''");
  const email = (p.email || '').replace(/'/g, "''");
  const phone = (p.phone || '').replace(/'/g, "''");
  const city = (p.city || 'Bangalore').replace(/'/g, "''");
  const dt = p.created_at ? `'${p.created_at}'` : 'NOW()';
  sqlStatements.push(`INSERT INTO pet_parents (id, full_name, email, phone, city, created_at) VALUES (${p.id}, '${name}', '${email}', '${phone}', '${city}', ${dt}) ON DUPLICATE KEY UPDATE full_name='${name}', email='${email}', phone='${phone}', city='${city}';`);
}

// 2. Pets
const pets = queryJson('zippy_crm', 'SELECT id, parent_id, name, species, breed, gender, weight_kg, is_active FROM pets;');
for (const pet of pets) {
  const name = (pet.name || 'Pet').replace(/'/g, "''");
  const species = (pet.species || 'Dog').replace(/'/g, "''");
  const breed = (pet.breed || 'Mixed').replace(/'/g, "''");
  const gender = (pet.gender || 'Unknown').replace(/'/g, "''");
  const weight = parseFloat(pet.weight_kg) || 5.0;
  const active = pet.is_active === '1' || pet.is_active === 'true' ? 1 : 0;
  sqlStatements.push(`INSERT INTO pets (id, parent_id, name, species, breed, gender, weight_kg, is_active) VALUES (${pet.id}, ${pet.parent_id}, '${name}', '${species}', '${breed}', '${gender}', ${weight}, ${active}) ON DUPLICATE KEY UPDATE parent_id=${pet.parent_id}, name='${name}', species='${species}', breed='${breed}', gender='${gender}', weight_kg=${weight}, is_active=${active};`);
}

// 3. Appointments
const appointments = queryJson('zippy_crm', 'SELECT id, pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee FROM appointments;');
for (const a of appointments) {
  const apptType = (a.appointment_type || 'In Clinic').replace(/'/g, "''");
  const status = (a.status || 'Confirmed').replace(/'/g, "''");
  const payStatus = (a.payment_status || 'PAID').replace(/'/g, "''");
  const fee = parseFloat(a.consultation_fee) || 500.0;
  sqlStatements.push(`INSERT INTO appointments (id, pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee) VALUES (${a.id}, ${a.pet_id}, ${a.doctor_id}, '${a.appointment_date}', '${a.appointment_time}', '${apptType}', '${status}', '${payStatus}', ${fee}) ON DUPLICATE KEY UPDATE status='${status}', payment_status='${payStatus}', consultation_fee=${fee};`);
}

// 4. Prescriptions
const prescriptions = queryJson('zippy_crm', 'SELECT id, doctor_id, pet_id, valid_until, created_at FROM prescriptions;');
for (const rx of prescriptions) {
  const validUntil = rx.valid_until ? `'${rx.valid_until}'` : 'NULL';
  const createdAt = rx.created_at ? `'${rx.created_at}'` : 'NOW()';
  sqlStatements.push(`INSERT INTO prescriptions (id, doctor_id, pet_id, valid_until, created_at) VALUES (${rx.id}, ${rx.doctor_id}, ${rx.pet_id}, ${validUntil}, ${createdAt}) ON DUPLICATE KEY UPDATE valid_until=${validUntil};`);
}

// 5. Medical Records
const records = queryJson('zippy_crm', 'SELECT id, pet_id, record_type, title, diagnosis, record_date FROM medical_records;');
for (const rec of records) {
  const rType = (rec.record_type || 'CONSULTATION').replace(/'/g, "''");
  const title = (rec.title || 'Medical Record').replace(/'/g, "''");
  const diag = (rec.diagnosis || '').replace(/'/g, "''");
  const rDate = rec.record_date ? `'${rec.record_date}'` : 'CURDATE()';
  sqlStatements.push(`INSERT INTO medical_records (id, pet_id, record_type, title, diagnosis, record_date) VALUES (${rec.id}, ${rec.pet_id}, '${rType}', '${title}', '${diag}', ${rDate}) ON DUPLICATE KEY UPDATE diagnosis='${diag}', title='${title}';`);
}

// 6. Doctors
const doctors = queryJson('zippy_crm', 'SELECT id, name, email, phone, specializations, consultation_fee FROM doctors;');
for (const doc of doctors) {
  const name = (doc.name || 'Doctor').replace(/'/g, "''");
  const email = (doc.email || '').replace(/'/g, "''");
  const phone = (doc.phone || '').replace(/'/g, "''");
  const spec = (doc.specializations || 'Veterinarian').replace(/'/g, "''");
  const fee = parseFloat(doc.consultation_fee) || 500.0;
  sqlStatements.push(`INSERT INTO doctors (id, name, email, phone, specializations, consultation_fee) VALUES (${doc.id}, '${name}', '${email}', '${phone}', '${spec}', ${fee}) ON DUPLICATE KEY UPDATE name='${name}', email='${email}', phone='${phone}', specializations='${spec}', consultation_fee=${fee};`);
}

sqlStatements.push('SET FOREIGN_KEY_CHECKS = 1;');

fs.writeFileSync('scripts/sync_data_to_main.sql', sqlStatements.join('\n'), 'utf8');
console.log(`Generated scripts/sync_data_to_main.sql with ${sqlStatements.length} statements.`);

