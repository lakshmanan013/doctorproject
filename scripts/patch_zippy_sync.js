const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'doctor_backend', 'src', 'main', 'java', 'doctor', 'backend', 'service', 'ZippyCrmSyncService.java');
let content = fs.readFileSync(file, 'utf8');

// Normalize line breaks to \n for uniform replacements
content = content.replace(/\r\n/g, '\n');

// 1. Imports
if (!content.includes('import org.springframework.beans.factory.ObjectProvider;')) {
  content = content.replace(
    'import org.springframework.stereotype.Service;',
    'import org.springframework.beans.factory.ObjectProvider;\nimport org.springframework.scheduling.annotation.Scheduled;\nimport org.springframework.stereotype.Service;'
  );
  console.log('Imports added.');
}

// 2. Field & Constructor
const oldFieldsAndCtor = `    private final MedicineRepository medicineRepository;
    private final MedicineBatchRepository medicineBatchRepository;

    public ZippyCrmSyncService(
            ZippyCrmProperties properties,
            UserRepository userRepository,
            DoctorProfileRepository doctorProfileRepository,
            OwnerRepository ownerRepository,
            PatientRepository patientRepository,
            AppointmentRepository appointmentRepository,
            PrescriptionRepository prescriptionRepository,
            MedicalRecordRepository medicalRecordRepository,
            VaccinationRepository vaccinationRepository,
            FollowUpRepository followUpRepository,
            MedicineRepository medicineRepository,
            MedicineBatchRepository medicineBatchRepository) {
        this.properties = properties;
        this.userRepository = userRepository;
        this.doctorProfileRepository = doctorProfileRepository;
        this.ownerRepository = ownerRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.vaccinationRepository = vaccinationRepository;
        this.followUpRepository = followUpRepository;
        this.medicineRepository = medicineRepository;
        this.medicineBatchRepository = medicineBatchRepository;
    }`;

const newFieldsAndCtor = `    private final MedicineRepository medicineRepository;
    private final MedicineBatchRepository medicineBatchRepository;
    private final ObjectProvider<InvoiceRepository> invoiceRepositoryProvider;

    public ZippyCrmSyncService(
            ZippyCrmProperties properties,
            UserRepository userRepository,
            DoctorProfileRepository doctorProfileRepository,
            OwnerRepository ownerRepository,
            PatientRepository patientRepository,
            AppointmentRepository appointmentRepository,
            PrescriptionRepository prescriptionRepository,
            MedicalRecordRepository medicalRecordRepository,
            VaccinationRepository vaccinationRepository,
            FollowUpRepository followUpRepository,
            MedicineRepository medicineRepository,
            MedicineBatchRepository medicineBatchRepository,
            ObjectProvider<InvoiceRepository> invoiceRepositoryProvider) {
        this.properties = properties;
        this.userRepository = userRepository;
        this.doctorProfileRepository = doctorProfileRepository;
        this.ownerRepository = ownerRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.vaccinationRepository = vaccinationRepository;
        this.followUpRepository = followUpRepository;
        this.medicineRepository = medicineRepository;
        this.medicineBatchRepository = medicineBatchRepository;
        this.invoiceRepositoryProvider = invoiceRepositoryProvider;
    }`;

if (content.includes(oldFieldsAndCtor)) {
  content = content.replace(oldFieldsAndCtor, newFieldsAndCtor);
  console.log('Fields & constructor updated.');
} else {
  console.log('Error: oldFieldsAndCtor not matched.');
}

// 3. PostConstruct & Scheduled
const oldInit = `    @PostConstruct
    public void init() {
        if (!properties.isEnabled()) {
            log.info("Zippy CRM sync is disabled.");
            return;
        }

        // Run sync asynchronously in the background so Spring Boot startup and HTTP requests are not blocked
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(1500);
                cleanupLegacyCommerceData();
                syncAll();
            } catch (Exception e) {
                log.warn("Could not perform initial background sync to Zippy CRM: {}", e.getMessage());
            }
        });
    }`;

const newInit = `    @PostConstruct
    public void init() {
        if (!properties.isEnabled() && !properties.isCentralDbEnabled()) {
            log.info("Central Main DB and Zippy CRM sync are disabled.");
            return;
        }

        // Run sync asynchronously in the background so Spring Boot startup and HTTP requests are not blocked
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(1500);
                cleanupLegacyCommerceData();
                syncAll();
            } catch (Exception e) {
                log.warn("Could not perform initial background sync to dual databases: {}", e.getMessage());
            }
        });
    }

    @Scheduled(fixedDelayString = "\${app.zippy-crm.sync-interval-ms:10000}", initialDelay = 10000)
    public void scheduledPeriodicSync() {
        if (!properties.isEnabled() && !properties.isCentralDbEnabled()) {
            return;
        }
        try {
            syncAll();
        } catch (Exception e) {
            log.warn("Periodic 10s auto-sync between doctor_crm and zenve_main warning: {}", e.getMessage());
        }
    }`;

if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
  console.log('PostConstruct & Scheduled updated.');
} else {
  console.log('Error: oldInit not matched.');
}

// 4. In syncAll(), add invoice syncing and update log message
const oldSyncAllEnd = `        // 11. Sync Follow-ups
        try {
            List<FollowUp> followUps = followUpRepository.findAll();
            for (FollowUp f : followUps) {
                syncFollowUp(f);
            }
            log.info("Synced {} follow-up(s) to Zippy CRM.", followUps.size());
        } catch (Exception e) {
            log.warn("Error syncing follow-ups to Zippy CRM: {}", e.getMessage());
        }

        log.info("Complete Doctor Portal synchronization to Zippy CRM finished successfully.");`;

const newSyncAllEnd = `        // 11. Sync Follow-ups
        try {
            List<FollowUp> followUps = followUpRepository.findAll();
            for (FollowUp f : followUps) {
                syncFollowUp(f);
            }
            log.info("Synced {} follow-up(s) to dual databases.", followUps.size());
        } catch (Exception e) {
            log.warn("Error syncing follow-ups to dual databases: {}", e.getMessage());
        }

        // 12. Sync Invoices
        try {
            InvoiceRepository invRepo = invoiceRepositoryProvider != null ? invoiceRepositoryProvider.getIfAvailable() : null;
            if (invRepo != null) {
                List<Invoice> invoices = invRepo.findAll();
                for (Invoice inv : invoices) {
                    syncInvoice(inv);
                }
                log.info("Synced {} invoice(s) to central/zippy databases.", invoices.size());
            }
        } catch (Exception e) {
            log.warn("Error syncing invoices to central/zippy databases: {}", e.getMessage());
        }

        log.info("Complete Doctor Portal synchronization to dual databases finished successfully.");`;

if (content.includes(oldSyncAllEnd)) {
  content = content.replace(oldSyncAllEnd, newSyncAllEnd);
  console.log('syncAll() invoice sync added.');
} else {
  console.log('Error: oldSyncAllEnd not matched.');
}

// 5. Update syncDoctor
const oldSyncDoctor = `    public void syncDoctor(User user) {
        if (user == null || !properties.isEnabled()) {
            return;
        }
        DoctorProfile profile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
        syncDoctor(user, profile);
    }

    public void syncDoctor(User user, DoctorProfile profile) {
        if (user == null || !properties.isEnabled()) {
            return;
        }
        String approvalStatus = user.getApprovalStatus();
        String verificationStatus = mapStatusToZippy(approvalStatus);

        try (Connection conn = getConnection()) {
            getOrCreateZippyDoctorId(conn, user, profile, verificationStatus);
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM doctors failed for {}: {}", user.getFullName(), e.getMessage());
        }
    }`;

const newSyncDoctor = `    public void syncDoctor(User user) {
        if (user == null || (!properties.isEnabled() && !properties.isCentralDbEnabled())) {
            return;
        }
        DoctorProfile profile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
        syncDoctor(user, profile);
    }

    public void syncDoctor(User user, DoctorProfile profile) {
        if (user == null || (!properties.isEnabled() && !properties.isCentralDbEnabled())) {
            return;
        }
        String approvalStatus = user.getApprovalStatus();
        String verificationStatus = mapStatusToZippy(approvalStatus);

        forEachTarget((conn, targetName) -> {
            getOrCreateZippyDoctorId(conn, user, profile, verificationStatus);
        });
    }`;

if (content.includes(oldSyncDoctor)) {
  content = content.replace(oldSyncDoctor, newSyncDoctor);
  console.log('syncDoctor updated.');
} else {
  console.log('Error: oldSyncDoctor not matched.');
}

// 6. Update syncOwner
const oldSyncOwner = `    public void syncOwner(Owner owner) {
        if (owner == null || !properties.isEnabled())
            return;
        try (Connection conn = getConnection()) {
            getOrCreateZippyParentId(conn, owner);
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM pet_parents failed for owner {}: {}", owner.getFullName(),
                    e.getMessage());
        }
    }`;

const newSyncOwner = `    public void syncOwner(Owner owner) {
        if (owner == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            getOrCreateZippyParentId(conn, owner);
        });
    }`;

if (content.includes(oldSyncOwner)) {
  content = content.replace(oldSyncOwner, newSyncOwner);
  console.log('syncOwner updated.');
} else {
  console.log('Error: oldSyncOwner not matched.');
}

// 7. Update syncPatient
const oldSyncPatient = `    public void syncPatient(Patient patient) {
        if (patient == null || !properties.isEnabled())
            return;
        try (Connection conn = getConnection()) {
            getOrCreateZippyPetId(conn, patient);
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM pets failed for patient {}: {}", patient.getName(), e.getMessage());
        }
    }`;

const newSyncPatient = `    public void syncPatient(Patient patient) {
        if (patient == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            getOrCreateZippyPetId(conn, patient);
        });
    }`;

if (content.includes(oldSyncPatient)) {
  content = content.replace(oldSyncPatient, newSyncPatient);
  console.log('syncPatient updated.');
} else {
  console.log('Error: oldSyncPatient not matched.');
}

// 8. Update syncAppointment
const oldSyncAppointment = `    public void syncAppointment(Appointment appointment) {
        if (appointment == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, appointment.getPatient());`;

const newSyncAppointment = `    public void syncAppointment(Appointment appointment) {
        if (appointment == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncAppointmentInternal(conn, appointment);
        });
    }

    public void syncAppointmentInternal(Connection conn, Appointment appointment) throws SQLException {
        Integer petId = getOrCreateZippyPetId(conn, appointment.getPatient());`;

if (content.includes(oldSyncAppointment)) {
  content = content.replace(oldSyncAppointment, newSyncAppointment);
  console.log('syncAppointment updated.');
} else {
  console.log('Error: oldSyncAppointment not matched.');
}

// 9. Update syncPrescription
const oldSyncRx = `    public void syncPrescription(Prescription rx) {
        if (rx == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, rx.getPatient());`;

const newSyncRx = `    public void syncPrescription(Prescription rx) {
        if (rx == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncPrescriptionInternal(conn, rx);
        });
    }

    public void syncPrescriptionInternal(Connection conn, Prescription rx) throws SQLException {
        Integer petId = getOrCreateZippyPetId(conn, rx.getPatient());`;

if (content.includes(oldSyncRx)) {
  content = content.replace(oldSyncRx, newSyncRx);
  console.log('syncPrescription updated.');
} else {
  console.log('Error: oldSyncRx not matched.');
}

// 10. Update syncMedicalRecord
const oldSyncMedRec = `    public void syncMedicalRecord(MedicalRecord record) {
        if (record == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, record.getPatient());`;

const newSyncMedRec = `    public void syncMedicalRecord(MedicalRecord record) {
        if (record == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncMedicalRecordInternal(conn, record);
        });
    }

    public void syncMedicalRecordInternal(Connection conn, MedicalRecord record) throws SQLException {
        Integer petId = getOrCreateZippyPetId(conn, record.getPatient());`;

if (content.includes(oldSyncMedRec)) {
  content = content.replace(oldSyncMedRec, newSyncMedRec);
  console.log('syncMedicalRecord updated.');
} else {
  console.log('Error: oldSyncMedRec not matched.');
}

// 11. Update syncVaccination
const oldSyncVac = `    public void syncVaccination(Vaccination v) {
        if (v == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, v.getPatient());`;

const newSyncVac = `    public void syncVaccination(Vaccination v) {
        if (v == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncVaccinationInternal(conn, v);
        });
    }

    public void syncVaccinationInternal(Connection conn, Vaccination v) throws SQLException {
        Integer petId = getOrCreateZippyPetId(conn, v.getPatient());`;

if (content.includes(oldSyncVac)) {
  content = content.replace(oldSyncVac, newSyncVac);
  console.log('syncVaccination updated.');
} else {
  console.log('Error: oldSyncVac not matched.');
}

// 12. Update syncFollowUp
const oldSyncFu = `    public void syncFollowUp(FollowUp followUp) {
        if (followUp == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, followUp.getPatient());
            Integer doctorId = getZippyDoctorId(conn, followUp.getDoctorId());

            if (petId == null || doctorId == null) {
                return;
            }

            LocalDate nextDate = followUp.getNextFollowUpDate() != null ? followUp.getNextFollowUpDate()
                    : (followUp.getFollowUpDate() != null ? followUp.getFollowUpDate() : LocalDate.now().plusDays(7));
            String notes = followUp.getReason() != null ? followUp.getReason()
                    : (followUp.getNotes() != null ? followUp.getNotes() : "Routine Follow-up");

            String insertRecord = "INSERT INTO medical_records (pet_id, record_type, title, diagnosis, record_date) "
                    + "VALUES (?, 'Follow-up', ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertRecord)) {
                ps.setInt(1, petId);
                ps.setString(2, "Follow-up: " + notes);
                ps.setString(3, followUp.getFindings() != null ? followUp.getFindings() : notes);
                ps.setDate(4, java.sql.Date.valueOf(nextDate));
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM follow-ups failed: {}", e.getMessage());
        }
    }`;

const newSyncFu = `    public void syncFollowUp(FollowUp followUp) {
        if (followUp == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncFollowUpInternal(conn, followUp);
        });
    }

    public void syncFollowUpInternal(Connection conn, FollowUp followUp) throws SQLException {
        Integer petId = getOrCreateZippyPetId(conn, followUp.getPatient());
        Integer doctorId = getZippyDoctorId(conn, followUp.getDoctorId());

        LocalDate nextDate = followUp.getNextFollowUpDate() != null ? followUp.getNextFollowUpDate()
                : (followUp.getFollowUpDate() != null ? followUp.getFollowUpDate() : LocalDate.now().plusDays(7));
        String notes = followUp.getReason() != null ? followUp.getReason()
                : (followUp.getNotes() != null ? followUp.getNotes() : "Routine Follow-up");

        // 1. Update clinical_follow_ups in zenve_main if table exists
        if (tableExists(conn, "clinical_follow_ups")) {
            String code = "FU-" + String.format("%05d", followUp.getId() != null ? followUp.getId() : 1);
            String petName = followUp.getPatient() != null && followUp.getPatient().getName() != null ? followUp.getPatient().getName() : "Pet";
            String parentName = "Pet Parent";
            if (followUp.getPatient() != null && followUp.getPatient().getOwner() != null && followUp.getPatient().getOwner().getFullName() != null) {
                parentName = followUp.getPatient().getOwner().getFullName();
            }
            String docName = followUp.getDoctorName() != null ? followUp.getDoctorName() : "Doctor";
            String status = followUp.getStatus() != null ? followUp.getStatus() : "SCHEDULED";
            java.sql.Date fuDate = followUp.getFollowUpDate() != null ? java.sql.Date.valueOf(followUp.getFollowUpDate()) : java.sql.Date.valueOf(LocalDate.now());
            java.sql.Date nextFuDate = java.sql.Date.valueOf(nextDate);

            String sql = "INSERT INTO clinical_follow_ups "
                    + "(id, followup_code, pet_name, parent_name, doctor_name, reason, followup_date, next_follow_up_date, status, reminder_sent, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW()) "
                    + "ON DUPLICATE KEY UPDATE reason=?, status=?, followup_date=?, next_follow_up_date=?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, followUp.getId() != null ? followUp.getId() : 1);
                stmt.setString(2, code);
                stmt.setString(3, petName);
                stmt.setString(4, parentName);
                stmt.setString(5, docName);
                stmt.setString(6, notes);
                stmt.setDate(7, fuDate);
                stmt.setDate(8, nextFuDate);
                stmt.setString(9, status);
                stmt.setString(10, notes);
                stmt.setString(11, status);
                stmt.setDate(12, fuDate);
                stmt.setDate(13, nextFuDate);
                stmt.executeUpdate();
            } catch (Exception ex) {
                log.warn("Could not insert into clinical_follow_ups: {}", ex.getMessage());
            }
        }

        // 2. Also insert into medical_records for general consultation tracking
        if (petId != null && tableExists(conn, "medical_records")) {
            String insertRecord = "INSERT INTO medical_records (pet_id, record_type, title, diagnosis, record_date) "
                    + "VALUES (?, 'Follow-up', ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertRecord)) {
                ps.setInt(1, petId);
                ps.setString(2, "Follow-up: " + notes);
                ps.setString(3, followUp.getFindings() != null ? followUp.getFindings() : notes);
                ps.setDate(4, java.sql.Date.valueOf(nextDate));
                ps.executeUpdate();
            } catch (Exception ignored) {}
        }
    }`;

if (content.includes(oldSyncFu)) {
  content = content.replace(oldSyncFu, newSyncFu);
  console.log('syncFollowUp updated.');
} else {
  console.log('Error: oldSyncFu not matched.');
}

// 13. Add syncInvoice and dual target connection helpers at the bottom
const oldGetConnection = `    private Connection getConnection() throws SQLException {
        DriverManager.setLoginTimeout(3);
        return DriverManager.getConnection(
                properties.getDbUrl(),
                properties.getDbUser(),
                properties.getDbPassword());
    }`;

const newHelpersAndSyncInvoice = `    // =========================================================================
    // 12. INVOICES DUAL SYNC (clinical_invoices & invoices)
    // =========================================================================

    public void syncInvoice(Invoice invoice) {
        if (invoice == null || (!properties.isEnabled() && !properties.isCentralDbEnabled()))
            return;
        forEachTarget((conn, targetName) -> {
            syncInvoiceInternal(conn, invoice);
        });
    }

    public void syncInvoiceInternal(Connection conn, Invoice invoice) throws SQLException {
        if (invoice == null)
            return;

        String petName = "Pet";
        if (invoice.getPatientId() != null) {
            Patient p = patientRepository.findById(invoice.getPatientId()).orElse(null);
            if (p != null && p.getName() != null)
                petName = p.getName();
        }

        String parentName = "Pet Parent";
        if (invoice.getOwnerId() != null) {
            Owner o = ownerRepository.findById(invoice.getOwnerId()).orElse(null);
            if (o != null && o.getFullName() != null)
                parentName = o.getFullName();
        }

        String doctorName = "Dr. Zenve";
        if (invoice.getDoctorId() != null) {
            User u = userRepository.findById(invoice.getDoctorId()).orElse(null);
            if (u != null && u.getFullName() != null)
                doctorName = u.getFullName();
        }

        String invNum = invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : ("INV-" + invoice.getId());
        double total = invoice.getTotalAmount() != null ? invoice.getTotalAmount().doubleValue() : 0.0;
        double paid = invoice.getPaidAmount() != null ? invoice.getPaidAmount().doubleValue() : total;
        String status = invoice.getPaymentStatus() != null ? invoice.getPaymentStatus() : "PAID";
        String notes = invoice.getNotes() != null ? invoice.getNotes() : "";
        java.sql.Date invDate = invoice.getInvoiceDate() != null ? java.sql.Date.valueOf(invoice.getInvoiceDate())
                : new java.sql.Date(System.currentTimeMillis());

        if (tableExists(conn, "clinical_invoices")) {
            String sql = "INSERT INTO clinical_invoices "
                    + "(id, invoice_number, pet_name, parent_name, doctor_name, consultation_fee, medicine_fee, total_amount, paid_amount, payment_status, payment_method, notes, invoice_date, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'Cash', ?, ?, NOW()) "
                    + "ON DUPLICATE KEY UPDATE total_amount=?, paid_amount=?, payment_status=?, notes=?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, invoice.getId() != null ? invoice.getId() : 1);
                stmt.setString(2, invNum);
                stmt.setString(3, petName);
                stmt.setString(4, parentName);
                stmt.setString(5, doctorName);
                stmt.setDouble(6, total);
                stmt.setDouble(7, total);
                stmt.setDouble(8, paid);
                stmt.setString(9, status);
                stmt.setString(10, notes);
                stmt.setDate(11, invDate);
                stmt.setDouble(12, total);
                stmt.setDouble(13, paid);
                stmt.setString(14, status);
                stmt.setString(15, notes);
                stmt.executeUpdate();
            }
        }
    }

    // =========================================================================
    // DUAL-DATABASE CONNECTION AND DISPATCH INFRASTRUCTURE
    // =========================================================================

    @FunctionalInterface
    public interface TargetDbConsumer {
        void accept(Connection conn, String targetName) throws Exception;
    }

    public void forEachTarget(TargetDbConsumer consumer) {
        // Target 1: Central Consolidated Main Database (zenve_main)
        if (properties.isCentralDbEnabled() && properties.getCentralDbUrl() != null && !properties.getCentralDbUrl().isBlank()) {
            try (Connection conn = getCentralConnection()) {
                consumer.accept(conn, "zenve_main");
            } catch (Exception e) {
                log.warn("Automatic dual-save to Central DB (zenve_main) had an issue: {}", e.getMessage());
            }
        }

        // Target 2: Zippy CRM Database (zippy_crm)
        if (properties.isEnabled() && properties.getDbUrl() != null && !properties.getDbUrl().isBlank()) {
            try (Connection conn = getZippyConnection()) {
                consumer.accept(conn, "zippy_crm");
            } catch (Exception e) {
                log.warn("Automatic dual-save to Zippy CRM had an issue: {}", e.getMessage());
            }
        }
    }

    public Connection getZippyConnection() throws SQLException {
        DriverManager.setLoginTimeout(3);
        return DriverManager.getConnection(
                properties.getDbUrl(),
                properties.getDbUser(),
                properties.getDbPassword());
    }

    public Connection getCentralConnection() throws SQLException {
        DriverManager.setLoginTimeout(3);
        return DriverManager.getConnection(
                properties.getCentralDbUrl(),
                properties.getCentralDbUser(),
                properties.getCentralDbPassword());
    }

    private Connection getConnection() throws SQLException {
        if (properties.isCentralDbEnabled() && properties.getCentralDbUrl() != null && !properties.getCentralDbUrl().isBlank()) {
            try {
                return getCentralConnection();
            } catch (Exception ignored) {
            }
        }
        return getZippyConnection();
    }

    private boolean tableExists(Connection conn, String tableName) {
        try {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getTables(null, null, tableName, null)) {
                if (rs.next()) return true;
            }
            try (ResultSet rs = meta.getTables(null, null, tableName.toUpperCase(), null)) {
                if (rs.next()) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }`;

if (content.includes(oldGetConnection)) {
  content = content.replace(oldGetConnection, newHelpersAndSyncInvoice);
  console.log('Helpers and syncInvoice added.');
} else {
  console.log('Error: oldGetConnection not matched.');
}

// Convert back to CRLF
fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('ZippyCrmSyncService.java patched successfully!');
