const fs = require('fs');
const file = 'd:/New folder/new docotor/doctor_backend/src/main/java/doctor/backend/service/ZippyCrmSyncService.java';
let content = fs.readFileSync(file, 'utf8');

const oldInit = `        try {
            cleanupLegacyCommerceData();
            syncAll();
        } catch (Exception e) {
            log.warn("Could not perform initial sync to Zippy CRM: {}", e.getMessage());
        }`;

const newInit = `        // Run sync asynchronously in the background so Spring Boot startup and HTTP requests are not blocked
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(1500);
                cleanupLegacyCommerceData();
                syncAll();
            } catch (Exception e) {
                log.warn("Could not perform initial background sync to Zippy CRM: {}", e.getMessage());
            }
        });`;

const isCrlf = content.includes('\r\n');
const normalize = s => isCrlf ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (content.includes(normalize(oldInit))) {
  content = content.replace(normalize(oldInit), normalize(newInit));
  console.log('Replaced init successfully');
} else {
  console.log('Failed to match oldInit');
}

const oldGetConn = `    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(`;

const newGetConn = `    private Connection getConnection() throws SQLException {
        DriverManager.setLoginTimeout(3);
        return DriverManager.getConnection(`;

if (content.includes(normalize(oldGetConn))) {
  content = content.replace(normalize(oldGetConn), normalize(newGetConn));
  console.log('Replaced getConnection successfully');
} else {
  console.log('Failed to match oldGetConn');
}

fs.writeFileSync(file, content, 'utf8');

