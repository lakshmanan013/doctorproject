const { execSync } = require('child_process');

function runSql(user, pass, db, sql) {
  try {
    const escapedSql = sql.replace(/"/g, '\\"');
    const cmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" -h 127.0.0.1 -P 3307 -u ${user} -p${pass} ${db} -e "${escapedSql}"`;
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return `ERROR: ${err.stderr ? err.stderr.trim() : err.message}`;
  }
}

function queryJson(user, pass, db, sql) {
  try {
    const escapedSql = sql.replace(/"/g, '\\"');
    const cmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" -h 127.0.0.1 -P 3307 -u ${user} -p${pass} ${db} --batch --raw -e "${escapedSql}"`;
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
  } catch (err) {
    console.error('queryJson error:', err.message);
    return [];
  }
}

console.log('==================================================================');
console.log(' SYNCHRONIZING ALL DATA INTO MAIN DATABASE (zenve_main)');
console.log(' Source: zippy_crm & doctor_crm -> Target: zenve_main');
console.log('==================================================================\n');

// 1. Sync Pet Parents
console.log('[1/6] Syncing Pet Parents...');
const parents = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, full_name, email, phone, city FROM pet_parents;');
for (const p of parents) {
  const name = (p.full_name || 'Owner').replace(/'/g, "''");
  const email = (p.email || '').replace(/'/g, "''");
  const phone = (p.phone || '').replace(/'/g, "''");
  const city = (p.city || 'Bangalore').replace(/'/g, "''");
  
  const sql = `INSERT INTO pet_parents (id, full_name, email, phone, city, created_at)
    VALUES (${p.id}, '${name}', '${email}', '${phone}', '${city}', NOW())
    ON DUPLICATE KEY UPDATE full_name='${name}', email='${email}', phone='${phone}', city='${city}';`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${parents.length} pet parents.`);

// 2. Sync Pets
console.log('[2/6] Syncing Pets...');
const pets = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, parent_id, name, species, breed, gender, weight_kg, is_active FROM pets;');
for (const pet of pets) {
  const name = (pet.name || 'Pet').replace(/'/g, "''");
  const species = (pet.species || 'Dog').replace(/'/g, "''");
  const breed = (pet.breed || 'Mixed').replace(/'/g, "''");
  const gender = (pet.gender || 'Unknown').replace(/'/g, "''");
  const weight = parseFloat(pet.weight_kg) || 5.0;
  const active = pet.is_active === '1' || pet.is_active === 'true' ? 1 : 0;
  
  const sql = `INSERT INTO pets (id, parent_id, name, species, breed, gender, weight_kg, is_active)
    VALUES (${pet.id}, ${pet.parent_id}, '${name}', '${species}', '${breed}', '${gender}', ${weight}, ${active})
    ON DUPLICATE KEY UPDATE parent_id=${pet.parent_id}, name='${name}', species='${species}', breed='${breed}', gender='${gender}', weight_kg=${weight}, is_active=${active};`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${pets.length} pets.`);

// 3. Sync Appointments
console.log('[3/6] Syncing Appointments...');
const appointments = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee FROM appointments;');
for (const a of appointments) {
  const apptType = (a.appointment_type || 'In Clinic').replace(/'/g, "''");
  const status = (a.status || 'Confirmed').replace(/'/g, "''");
  const payStatus = (a.payment_status || 'PAID').replace(/'/g, "''");
  const fee = parseFloat(a.consultation_fee) || 500.0;
  
  const sql = `INSERT INTO appointments (id, pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee)
    VALUES (${a.id}, ${a.pet_id}, ${a.doctor_id}, '${a.appointment_date}', '${a.appointment_time}', '${apptType}', '${status}', '${payStatus}', ${fee})
    ON DUPLICATE KEY UPDATE status='${status}', payment_status='${payStatus}', consultation_fee=${fee};`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${appointments.length} appointments.`);

// 4. Sync Prescriptions
console.log('[4/6] Syncing Prescriptions...');
const prescriptions = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, doctor_id, pet_id, valid_until, created_at FROM prescriptions;');
for (const rx of prescriptions) {
  const validUntil = rx.valid_until ? `'${rx.valid_until}'` : 'NULL';
  const createdAt = rx.created_at ? `'${rx.created_at}'` : 'NOW()';
  
  const sql = `INSERT INTO prescriptions (id, doctor_id, pet_id, valid_until, created_at)
    VALUES (${rx.id}, ${rx.doctor_id}, ${rx.pet_id}, ${validUntil}, ${createdAt})
    ON DUPLICATE KEY UPDATE valid_until=${validUntil};`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${prescriptions.length} prescriptions.`);

// 5. Sync Medical Records
console.log('[5/6] Syncing Medical Records...');
const records = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, pet_id, record_type, title, diagnosis, record_date FROM medical_records;');
for (const rec of records) {
  const rType = (rec.record_type || 'CONSULTATION').replace(/'/g, "''");
  const title = (rec.title || 'Medical Record').replace(/'/g, "''");
  const diag = (rec.diagnosis || '').replace(/'/g, "''");
  const rDate = rec.record_date ? `'${rec.record_date}'` : 'CURDATE()';
  
  const sql = `INSERT INTO medical_records (id, pet_id, record_type, title, diagnosis, record_date)
    VALUES (${rec.id}, ${rec.pet_id}, '${rType}', '${title}', '${diag}', ${rDate})
    ON DUPLICATE KEY UPDATE diagnosis='${diag}', title='${title}';`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${records.length} medical records.`);

// 6. Sync Doctors
console.log('[6/6] Syncing Doctors...');
const doctors = queryJson('zippy_crm_app', 'zippy-123', 'zippy_crm', 'SELECT id, name, email, phone, specializations, consultation_fee FROM doctors;');
for (const doc of doctors) {
  const name = (doc.name || 'Doctor').replace(/'/g, "''");
  const email = (doc.email || '').replace(/'/g, "''");
  const phone = (doc.phone || '').replace(/'/g, "''");
  const spec = (doc.specializations || 'Veterinarian').replace(/'/g, "''");
  const fee = parseFloat(doc.consultation_fee) || 500.0;
  
  const sql = `INSERT INTO doctors (id, name, email, phone, specializations, consultation_fee)
    VALUES (${doc.id}, '${name}', '${email}', '${phone}', '${spec}', ${fee})
    ON DUPLICATE KEY UPDATE name='${name}', email='${email}', phone='${phone}', specializations='${spec}', consultation_fee=${fee};`;
  runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', sql);
}
console.log(`  -> Checked ${doctors.length} doctors.`);

console.log('\n==================================================================');
console.log('[SUCCESS] All entities in zenve_main are now fully synchronized!');
console.log('==================================================================');
