const { execSync } = require('child_process');

function runSql(user, pass, db, sql) {
  try {
    const cmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" -h 127.0.0.1 -P 3307 -u ${user} -p${pass} ${db} -sN -e "${sql}"`;
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return `ERROR: ${err.stderr ? err.stderr.trim() : err.message}`;
  }
}

console.log('==================================================================');
console.log(' DATABASE AUDIT: doctor_crm vs admin_crm vs zenve_main');
console.log('==================================================================\n');

// 1. Check doctor_crm counts
console.log('--- 1. DOCTOR CRM (doctor_crm) ---');
const doctorTables = [
  'patients', 'owners', 'appointments', 'prescriptions',
  'prescription_items', 'medical_records', 'invoices',
  'payments', 'vaccinations', 'follow_ups', 'medicines', 'users'
];

for (const tbl of doctorTables) {
  const count = runSql('doctor_app', 'doctor-123', 'doctor_crm', `SELECT COUNT(*) FROM \`${tbl}\`;`);
  console.log(`doctor_crm.${tbl.padEnd(20)} : ${count}`);
}

// 2. Check admin_crm counts
console.log('\n--- 2. ADMIN CRM (admin_crm) ---');
const adminTables = ['admins', 'doctors', 'admin_notifications'];
for (const tbl of adminTables) {
  const count = runSql('admin_crm_app', 'admin-123', 'admin_crm', `SELECT COUNT(*) FROM \`${tbl}\`;`);
  console.log(`admin_crm.${tbl.padEnd(20)} : ${count}`);
}

// 3. Check zenve_main counts
console.log('\n--- 3. CENTRAL MAIN DB (zenve_main) ---');
const mainTables = [
  'pets', 'pet_parents', 'appointments', 'prescriptions',
  'medical_records', 'clinical_invoices', 'invoices', 'payments',
  'vaccinations', 'clinical_follow_ups', 'follow_ups', 'pharmacy_medicines',
  'doctors', 'patients', 'owners', 'users', 'admins', 'admin_admins', 'admin_doctors'
];

for (const tbl of mainTables) {
  const count = runSql('zenve_main_user', 'zenvemain-123', 'zenve_main', `SELECT COUNT(*) FROM \`${tbl}\`;`);
  console.log(`zenve_main.${tbl.padEnd(20)} : ${count}`);
}

console.log('\n==================================================================');

