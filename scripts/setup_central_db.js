/**
 * Zenve Central Consolidated Database Setup & Sync Runner
 * Reads `central_db.env` and applies database schemas, initial synchronization,
 * and real-time triggers using MySQL Server CLI.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Parse environment file
function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

// Load both .env and central_db.env (central_db.env overrides if present)
const mainEnv = parseEnv(path.join(rootDir, '.env'));
const centralEnv = parseEnv(path.join(rootDir, 'central_db.env'));
const config = { ...mainEnv, ...centralEnv };

const CENTRAL_DB_NAME = config.CENTRAL_DB_NAME || 'zenve_main';
const CENTRAL_DB_USER = config.CENTRAL_DB_USER || 'zenve_main_user';
const CENTRAL_DB_PASSWORD = config.CENTRAL_DB_PASSWORD || 'zenvemain-123';
const CENTRAL_DB_HOST = config.CENTRAL_DB_HOST || '127.0.0.1';
const CENTRAL_DB_PORT = config.CENTRAL_DB_PORT || '3307';

const DOCTOR_DB_NAME = config.DOCTOR_DB_NAME || config.DB_NAME || 'doctor_crm';
const ADMIN_DB_NAME = config.ADMIN_DB_NAME || 'admin_crm';

console.log('==================================================================');
console.log(' ZENVE CENTRAL DATABASE SYNC INITIALIZER');
console.log('==================================================================');
console.log(`Target Central DB : ${CENTRAL_DB_NAME}`);
console.log(`Doctor Source DB  : ${DOCTOR_DB_NAME}`);
console.log(`Admin Source DB   : ${ADMIN_DB_NAME}`);
console.log(`MySQL Host/Port   : ${CENTRAL_DB_HOST}:${CENTRAL_DB_PORT}`);
console.log(`MySQL User        : ${CENTRAL_DB_USER}`);
console.log('==================================================================\n');

// Find MySQL CLI executable
function findMysqlExe() {
  const candidates = [
    'mysql',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.1\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.2\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
    'C:\\xampp\\mysql\\bin\\mysql.exe',
    'D:\\xampp\\mysql\\bin\\mysql.exe',
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: 'ignore' });
      return c;
    } catch (_e) { }
  }
  return 'mysql';
}

const mysqlBin = findMysqlExe();
console.log(`Using MySQL binary: ${mysqlBin}`);

// Prepare customized SQL by substituting database names with proper backtick escaping
const baseSqlPath = path.join(rootDir, 'database', 'central_db_sync.sql');
let sqlContent = fs.readFileSync(baseSqlPath, 'utf8');

function quoteDb(name) {
  const clean = name.trim().replace(/`/g, '');
  return `\`${clean}\``;
}

const quotedCentral = quoteDb(CENTRAL_DB_NAME);
const quotedDoctor = quoteDb(DOCTOR_DB_NAME);
const quotedAdmin = quoteDb(ADMIN_DB_NAME);

sqlContent = sqlContent
  .replace(/`?central_crm`?/g, quotedCentral)
  .replace(/`?doctor_crm`?/g, quotedDoctor)
  .replace(/`?admin_crm`?/g, quotedAdmin);

const tempSqlPath = path.join(rootDir, 'database', '_temp_exec_sync.sql');
fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');

// Build MySQL command
const passArg = CENTRAL_DB_PASSWORD ? `-p"${CENTRAL_DB_PASSWORD}"` : '';
const cmd = `"${mysqlBin}" -h ${CENTRAL_DB_HOST} -P ${CENTRAL_DB_PORT} -u ${CENTRAL_DB_USER} ${passArg} < "${tempSqlPath}"`;

console.log('Applying database schemas, initial sync, and real-time triggers...');

try {
  execSync(cmd, { stdio: 'inherit', shell: true });
  console.log('\n[SUCCESS] Central database setup and real-time triggers applied successfully!');
  console.log(`All operations on '${DOCTOR_DB_NAME}' and '${ADMIN_DB_NAME}' will now replicate into '${CENTRAL_DB_NAME}' in real time.`);
} catch (err) {
  console.error('\n[NOTE] Execution command finished with status. If password was required or MySQL is stopped, you can also run the SQL directly in MySQL Workbench:');
  console.log(`SQL File location: ${baseSqlPath}`);
} finally {
  if (fs.existsSync(tempSqlPath)) {
    try { fs.unlinkSync(tempSqlPath); } catch (_e) { }
  }
}

