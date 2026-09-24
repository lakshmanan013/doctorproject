package doctor.backend.service;

import doctor.backend.config.ZippyCrmProperties;
import doctor.backend.entity.*;
import doctor.backend.repository.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Synchronizes clinical modules from Zenve Doctor Backend to Zippy CRM (FastAPI +
 * MySQL pet_management database).
 *
 * Keeps Zippy CRM in real-time sync with:
 * - Doctors & Doctor Profiles
 * - Pet Parents (Owners) & Pets (Patients)
 * - Appointments
 * - Prescriptions
 * - Consultations & Medical Records
 * - Follow-ups
 */
@Service
public class ZippyCrmSyncService {

    private static final Logger log = LoggerFactory.getLogger(ZippyCrmSyncService.class);

    private final ZippyCrmProperties properties;
    private final UserRepository userRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final OwnerRepository ownerRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final VaccinationRepository vaccinationRepository;
    private final FollowUpRepository followUpRepository;

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
            FollowUpRepository followUpRepository) {
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
    }

    @PostConstruct
    public void init() {
        if (!properties.isEnabled()) {
            log.info("Zippy CRM sync is disabled.");
            return;
        }

        try {
            cleanupLegacyCommerceData();
            syncAll();
        } catch (Exception e) {
            log.warn("Could not perform initial sync to Zippy CRM: {}", e.getMessage());
        }
    }

    private void cleanupLegacyCommerceData() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("SET FOREIGN_KEY_CHECKS = 0");
            stmt.executeUpdate("DELETE FROM payments WHERE order_id IS NOT NULL");
            stmt.executeUpdate("DELETE FROM order_items");
            stmt.executeUpdate("DELETE FROM orders");
            stmt.executeUpdate("DELETE FROM products");
            stmt.executeUpdate("DELETE FROM seller_stores WHERE business_name LIKE 'Zenve%' OR business_name = 'Zenve Doctor Clinic'");
            stmt.execute("SET FOREIGN_KEY_CHECKS = 1");
            log.info("Cleaned up legacy orders, order_items, products, payments, and seller stores from Zippy CRM pet_management database.");
        } catch (Exception e) {
            log.warn("Could not clean legacy commerce tables in Zippy CRM: {}", e.getMessage());
        }
    }

    public synchronized void syncAll() {
        if (!properties.isEnabled()) {
            return;
        }

        log.info("Starting comprehensive sync of Doctor Portal to Zippy CRM (pet_management)...");

        // 1. Sync Doctors
        try {
            List<User> doctors = userRepository.findAll().stream()
                    .filter(u -> "DOCTOR".equalsIgnoreCase(u.getRole()))
                    .toList();
            for (User doc : doctors) {
                syncDoctor(doc);
            }
            log.info("Synced {} doctor(s) to Zippy CRM.", doctors.size());
        } catch (Exception e) {
            log.warn("Error syncing doctors to Zippy CRM: {}", e.getMessage());
        }

        // 2. Sync Owners (Pet Parents)
        try {
            List<Owner> owners = ownerRepository.findAll();
            for (Owner owner : owners) {
                syncOwner(owner);
            }
            log.info("Synced {} owner(s) / pet parent(s) to Zippy CRM.", owners.size());
        } catch (Exception e) {
            log.warn("Error syncing owners to Zippy CRM: {}", e.getMessage());
        }

        // 3. Sync Patients (Pets)
        try {
            List<Patient> patients = patientRepository.findAll();
            for (Patient patient : patients) {
                syncPatient(patient);
            }
            log.info("Synced {} patient(s) / pet(s) to Zippy CRM.", patients.size());
        } catch (Exception e) {
            log.warn("Error syncing patients to Zippy CRM: {}", e.getMessage());
        }

        // 4. Sync Appointments
        try {
            List<Appointment> appointments = appointmentRepository.findAll();
            for (Appointment appt : appointments) {
                syncAppointment(appt);
            }
            log.info("Synced {} appointment(s) to Zippy CRM.", appointments.size());
        } catch (Exception e) {
            log.warn("Error syncing appointments to Zippy CRM: {}", e.getMessage());
        }

        // 5. Sync Prescriptions
        try {
            List<Prescription> prescriptions = prescriptionRepository.findAll();
            for (Prescription rx : prescriptions) {
                syncPrescription(rx);
            }
            log.info("Synced {} prescription(s) to Zippy CRM.", prescriptions.size());
        } catch (Exception e) {
            log.warn("Error syncing prescriptions to Zippy CRM: {}", e.getMessage());
        }

        // 6. Sync Medical Records & Consultations
        try {
            List<MedicalRecord> records = medicalRecordRepository.findAll();
            for (MedicalRecord rec : records) {
                syncMedicalRecord(rec);
            }
            log.info("Synced {} medical record(s) / consultation(s) to Zippy CRM.", records.size());
        } catch (Exception e) {
            log.warn("Error syncing medical records to Zippy CRM: {}", e.getMessage());
        }



        // 10. Sync Vaccinations
        try {
            List<Vaccination> vaccinations = vaccinationRepository.findAll();
            for (Vaccination v : vaccinations) {
                syncVaccination(v);
            }
            log.info("Synced {} vaccination(s) to Zippy CRM.", vaccinations.size());
        } catch (Exception e) {
            log.warn("Error syncing vaccinations to Zippy CRM: {}", e.getMessage());
        }

        // 11. Sync Follow-ups
        try {
            List<FollowUp> followUps = followUpRepository.findAll();
            for (FollowUp f : followUps) {
                syncFollowUp(f);
            }
            log.info("Synced {} follow-up(s) to Zippy CRM.", followUps.size());
        } catch (Exception e) {
            log.warn("Error syncing follow-ups to Zippy CRM: {}", e.getMessage());
        }

        log.info("Complete Doctor Portal synchronization to Zippy CRM finished successfully.");
    }

    // =========================================================================
    // 1. DOCTOR SYNC
    // =========================================================================

    public void syncDoctor(Long userId) {
        if (userId == null)
            return;
        userRepository.findById(userId).ifPresent(this::syncDoctor);
    }

    public void syncDoctor(DoctorProfile profile) {
        if (profile == null || profile.getUserId() == null)
            return;
        userRepository.findById(profile.getUserId()).ifPresent(user -> syncDoctor(user, profile));
    }

    public void syncDoctor(User user) {
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
    }

    private String mapStatusToZippy(String approvalStatus) {
        if (approvalStatus == null) {
            return "pending";
        }
        return switch (approvalStatus.toUpperCase()) {
            case "APPROVED" -> "verified";
            case "REJECTED" -> "rejected";
            default -> "pending";
        };
    }

    public Integer getOrCreateZippyDoctorId(Connection conn, User user, DoctorProfile profile, String verificationStatus)
            throws SQLException {
        if (user == null)
            return null;

        String phone = (profile != null && profile.getPhone() != null && !profile.getPhone().isBlank())
                ? profile.getPhone().trim()
                : (user.getPhone() != null ? user.getPhone().trim() : "");

        String name = (profile != null && profile.getFullName() != null && !profile.getFullName().isBlank())
                ? profile.getFullName().trim()
                : (user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName().trim()
                        : "Dr. Unknown");
        String userName = (user.getFullName() != null && !user.getFullName().isBlank()) ? user.getFullName().trim()
                : "";
        String userPhone = (user.getPhone() != null && !user.getPhone().isBlank()) ? user.getPhone().trim() : "";
        String email = user.getEmail() != null ? user.getEmail().trim() : "";

        String qualification = (profile != null && profile.getQualification() != null
                && !profile.getQualification().isBlank())
                        ? profile.getQualification().trim()
                        : "BVSc & AH";

        String specializations = (profile != null && profile.getSpeciality() != null
                && !profile.getSpeciality().isBlank())
                        ? profile.getSpeciality().trim()
                        : "Veterinarian";

        String city = (profile != null && profile.getCity() != null && !profile.getCity().isBlank())
                ? profile.getCity().trim()
                : ((profile != null && profile.getClinicHospital() != null
                        && !profile.getClinicHospital().isBlank())
                                ? profile.getClinicHospital().trim()
                                : "Bangalore");

        int pincode = (profile != null && profile.getPincode() != null)
                ? profile.getPincode()
                : 560001;

        int experienceYears = (profile != null && profile.getExperience() != null)
                ? profile.getExperience()
                : 5;

        double consultationFee = (profile != null && profile.getConsultationFee() != null)
                ? profile.getConsultationFee()
                : 500.0;
        boolean isActive = !"rejected".equalsIgnoreCase(verificationStatus);

        String digitsOnly = phone.replaceAll("[^0-9]", "");
        String last10 = digitsOnly.length() >= 10 ? digitsOnly.substring(digitsOnly.length() - 10) : digitsOnly;
        String userDigitsOnly = userPhone.replaceAll("[^0-9]", "");
        String userLast10 = userDigitsOnly.length() >= 10 ? userDigitsOnly.substring(userDigitsOnly.length() - 10)
                : userDigitsOnly;

        String selectSql = "SELECT id FROM doctors WHERE (phone = ? AND phone != '') OR (phone LIKE ? AND ? != '') "
                + "OR (phone = ? AND phone != '') OR (phone LIKE ? AND ? != '') "
                + "OR (email = ? AND email != '') OR name = ? OR name = ? ORDER BY id ASC LIMIT 1";
        Integer existingId = null;

        try (PreparedStatement checkStmt = conn.prepareStatement(selectSql)) {
            checkStmt.setString(1, phone);
            checkStmt.setString(2, "%" + last10);
            checkStmt.setString(3, last10);
            checkStmt.setString(4, userPhone);
            checkStmt.setString(5, "%" + userLast10);
            checkStmt.setString(6, userLast10);
            checkStmt.setString(7, email);
            checkStmt.setString(8, name);
            checkStmt.setString(9, userName);
            try (ResultSet rs = checkStmt.executeQuery()) {
                if (rs.next()) {
                    existingId = rs.getInt("id");
                }
            }
        }

        if (existingId != null) {
            String updateSql = "UPDATE doctors SET name = ?, qualification = ?, specializations = ?, phone = ?, "
                    + "city = ?, pincode = ?, experience_years = ?, consultation_fee = ?, verification_status = ?, is_active = ?, email = ? "
                    + "WHERE id = ?";
            try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                updateStmt.setString(1, name);
                updateStmt.setString(2, qualification);
                updateStmt.setString(3, specializations);
                updateStmt.setString(4, phone);
                updateStmt.setString(5, city);
                updateStmt.setInt(6, pincode);
                updateStmt.setInt(7, experienceYears);
                updateStmt.setDouble(8, consultationFee);
                updateStmt.setString(9, verificationStatus);
                updateStmt.setBoolean(10, isActive);
                updateStmt.setString(11, email);
                updateStmt.setInt(12, existingId);
                updateStmt.executeUpdate();
            }
            return existingId;
        } else {
            String insertSql = "INSERT INTO doctors (name, qualification, specializations, phone, city, pincode, "
                    + "experience_years, consultation_fee, verification_status, is_active, email) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertStmt.setString(1, name);
                insertStmt.setString(2, qualification);
                insertStmt.setString(3, specializations);
                insertStmt.setString(4, phone);
                insertStmt.setString(5, city);
                insertStmt.setInt(6, pincode);
                insertStmt.setInt(7, experienceYears);
                insertStmt.setDouble(8, consultationFee);
                insertStmt.setString(9, verificationStatus);
                insertStmt.setBoolean(10, isActive);
                insertStmt.setString(11, email);
                insertStmt.executeUpdate();
                try (ResultSet rs = insertStmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        }
        return null;
    }

    public Integer getZippyDoctorId(Connection conn, Long doctorUserId) throws SQLException {
        if (doctorUserId == null) {
            try (PreparedStatement stmt = conn.prepareStatement("SELECT id FROM doctors ORDER BY id ASC LIMIT 1")) {
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next())
                        return rs.getInt("id");
                }
            }
            return 1;
        }
        User user = userRepository.findById(doctorUserId).orElse(null);
        if (user != null) {
            DoctorProfile profile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
            return getOrCreateZippyDoctorId(conn, user, profile, mapStatusToZippy(user.getApprovalStatus()));
        }
        return 1;
    }

    // =========================================================================
    // 2. OWNER & PATIENT (PET PARENTS & PETS) SYNC
    // =========================================================================

    public void syncOwner(Owner owner) {
        if (owner == null || !properties.isEnabled())
            return;
        try (Connection conn = getConnection()) {
            getOrCreateZippyParentId(conn, owner);
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM pet_parents failed for owner {}: {}", owner.getFullName(),
                    e.getMessage());
        }
    }

    public Integer getOrCreateZippyParentId(Connection conn, Owner owner) throws SQLException {
        if (owner == null)
            return null;

        String name = owner.getFullName() != null && !owner.getFullName().isBlank() ? owner.getFullName().trim()
                : "Pet Parent";
        String phone = owner.getPhone() != null ? owner.getPhone().trim() : "";
        String email = owner.getEmail() != null && !owner.getEmail().isBlank()
                ? owner.getEmail().trim()
                : "owner_" + (owner.getId() != null ? owner.getId() : System.currentTimeMillis()) + "@zenve.vet";
        String city = owner.getCity() != null && !owner.getCity().isBlank() ? owner.getCity().trim() : "Bangalore";

        Integer existingId = null;
        String selectSql = "SELECT id FROM pet_parents WHERE (email = ? AND email != '') OR (phone = ? AND phone != '') OR full_name = ? LIMIT 1";
        try (PreparedStatement checkStmt = conn.prepareStatement(selectSql)) {
            checkStmt.setString(1, email);
            checkStmt.setString(2, phone);
            checkStmt.setString(3, name);
            try (ResultSet rs = checkStmt.executeQuery()) {
                if (rs.next()) {
                    existingId = rs.getInt("id");
                }
            }
        }

        if (existingId != null) {
            String updateSql = "UPDATE pet_parents SET full_name = ?, phone = ?, city = ? WHERE id = ?";
            try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                updateStmt.setString(1, name);
                updateStmt.setString(2, phone);
                updateStmt.setString(3, city);
                updateStmt.setInt(4, existingId);
                updateStmt.executeUpdate();
            }
            return existingId;
        } else {
            String insertSql = "INSERT INTO pet_parents (full_name, email, phone, city, created_at) VALUES (?, ?, ?, ?, NOW())";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertStmt.setString(1, name);
                insertStmt.setString(2, email);
                insertStmt.setString(3, phone);
                insertStmt.setString(4, city);
                insertStmt.executeUpdate();
                try (ResultSet rs = insertStmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        }
        return null;
    }

    public void syncPatient(Patient patient) {
        if (patient == null || !properties.isEnabled())
            return;
        try (Connection conn = getConnection()) {
            getOrCreateZippyPetId(conn, patient);
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM pets failed for patient {}: {}", patient.getName(), e.getMessage());
        }
    }

    public Integer getOrCreateZippyPetId(Connection conn, Patient patient) throws SQLException {
        if (patient == null)
            return null;

        Integer parentId = 1;
        if (patient.getOwner() != null) {
            parentId = getOrCreateZippyParentId(conn, patient.getOwner());
        } else {
            try (PreparedStatement stmt = conn.prepareStatement("SELECT id FROM pet_parents ORDER BY id ASC LIMIT 1")) {
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        parentId = rs.getInt("id");
                    } else {
                        String insertParent = "INSERT INTO pet_parents (full_name, email, phone, city, created_at) VALUES ('Default Pet Parent', 'petparent@zenve.vet', '9876543210', 'Bangalore', NOW())";
                        try (PreparedStatement ps = conn.prepareStatement(insertParent, Statement.RETURN_GENERATED_KEYS)) {
                            ps.executeUpdate();
                            try (ResultSet prs = ps.getGeneratedKeys()) {
                                if (prs.next()) parentId = prs.getInt(1);
                            }
                        }
                    }
                }
            }
        }

        String name = patient.getName() != null && !patient.getName().isBlank() ? patient.getName().trim() : "Pet";
        String species = patient.getSpecies() != null ? patient.getSpecies().trim() : "Dog";
        String breed = patient.getBreed() != null ? patient.getBreed().trim() : "Mixed";
        String gender = patient.getGender() != null ? patient.getGender().trim() : "Unknown";
        float weight = patient.getWeight() != null ? patient.getWeight().floatValue() : 5.0f;
        boolean isActive = !"INACTIVE".equalsIgnoreCase(patient.getStatus());

        Integer existingPetId = null;
        String checkSql = "SELECT id FROM pets WHERE parent_id = ? AND name = ? LIMIT 1";
        try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
            checkStmt.setInt(1, parentId);
            checkStmt.setString(2, name);
            try (ResultSet rs = checkStmt.executeQuery()) {
                if (rs.next()) {
                    existingPetId = rs.getInt("id");
                }
            }
        }

        if (existingPetId != null) {
            String updateSql = "UPDATE pets SET species = ?, breed = ?, gender = ?, weight_kg = ?, is_active = ? WHERE id = ?";
            try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                updateStmt.setString(1, species);
                updateStmt.setString(2, breed);
                updateStmt.setString(3, gender);
                updateStmt.setFloat(4, weight);
                updateStmt.setBoolean(5, isActive);
                updateStmt.setInt(6, existingPetId);
                updateStmt.executeUpdate();
            }
            return existingPetId;
        } else {
            String insertSql = "INSERT INTO pets (parent_id, name, species, breed, gender, weight_kg, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertStmt.setInt(1, parentId);
                insertStmt.setString(2, name);
                insertStmt.setString(3, species);
                insertStmt.setString(4, breed);
                insertStmt.setString(5, gender);
                insertStmt.setFloat(6, weight);
                insertStmt.setBoolean(7, isActive);
                insertStmt.executeUpdate();
                try (ResultSet rs = insertStmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        }
        return null;
    }

    // =========================================================================
    // 3. APPOINTMENTS SYNC
    // =========================================================================

    public void syncAppointment(Appointment appointment) {
        if (appointment == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, appointment.getPatient());
            Integer doctorId = getZippyDoctorId(conn, appointment.getDoctorId());

            if (petId == null || doctorId == null) {
                log.warn("Skipping appointment sync: missing pet ({}) or doctor ({})", petId, doctorId);
                return;
            }

            LocalDate date = appointment.getAppointmentDate() != null ? appointment.getAppointmentDate()
                    : LocalDate.now();
            LocalTime time = appointment.getAppointmentTime() != null ? appointment.getAppointmentTime()
                    : LocalTime.of(10, 0);
            String type = appointment.getAppointmentType() != null ? appointment.getAppointmentType() : "In Clinic";
            String status = appointment.getStatus() != null ? appointment.getStatus() : "Scheduled";
            String paymentStatus = "Completed".equalsIgnoreCase(status) ? "Paid" : "Pending";
            float fee = 500.0f;

            Integer existingId = null;
            String checkSql = "SELECT id FROM appointments WHERE pet_id = ? AND doctor_id = ? AND appointment_date = ? AND appointment_time = ? LIMIT 1";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setInt(1, petId);
                checkStmt.setInt(2, doctorId);
                checkStmt.setDate(3, java.sql.Date.valueOf(date));
                checkStmt.setTime(4, java.sql.Time.valueOf(time));
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        existingId = rs.getInt("id");
                    }
                }
            }

            if (existingId != null) {
                String updateSql = "UPDATE appointments SET appointment_type = ?, status = ?, payment_status = ?, consultation_fee = ? WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setString(1, type);
                    updateStmt.setString(2, status);
                    updateStmt.setString(3, paymentStatus);
                    updateStmt.setFloat(4, fee);
                    updateStmt.setInt(5, existingId);
                    updateStmt.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO appointments (pet_id, doctor_id, appointment_date, appointment_time, appointment_type, status, payment_status, consultation_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                    insertStmt.setInt(1, petId);
                    insertStmt.setInt(2, doctorId);
                    insertStmt.setDate(3, java.sql.Date.valueOf(date));
                    insertStmt.setTime(4, java.sql.Time.valueOf(time));
                    insertStmt.setString(5, type);
                    insertStmt.setString(6, status);
                    insertStmt.setString(7, paymentStatus);
                    insertStmt.setFloat(8, fee);
                    insertStmt.executeUpdate();
                    try (ResultSet rs = insertStmt.getGeneratedKeys()) {
                        if (rs.next()) {
                            existingId = rs.getInt(1);
                        }
                    }
                }
            }

            if (existingId != null && (appointment.getNotes() != null || appointment.getReason() != null)) {
                syncConsultationForAppointment(conn, existingId, appointment.getAppointmentType(),
                        appointment.getReason() != null ? appointment.getReason() : appointment.getNotes());
            }

        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM appointments failed: {}", e.getMessage());
        }
    }

    private void syncConsultationForAppointment(Connection conn, int appointmentId, String mode, String diagnosis)
            throws SQLException {
        Integer existingConsultId = null;
        try (PreparedStatement check = conn.prepareStatement("SELECT id FROM consultations WHERE appointment_id = ? LIMIT 1")) {
            check.setInt(1, appointmentId);
            try (ResultSet rs = check.executeQuery()) {
                if (rs.next()) existingConsultId = rs.getInt("id");
            }
        }

        if (existingConsultId != null) {
            String updateSql = "UPDATE consultations SET consultation_mode = ?, diagnosis = ? WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                ps.setString(1, mode != null ? mode : "In-Person");
                ps.setString(2, diagnosis != null ? diagnosis : "General Checkup");
                ps.setInt(3, existingConsultId);
                ps.executeUpdate();
            }
        } else {
            String insertSql = "INSERT INTO consultations (appointment_id, consultation_mode, diagnosis, created_at) VALUES (?, ?, ?, NOW())";
            try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                ps.setInt(1, appointmentId);
                ps.setString(2, mode != null ? mode : "In-Person");
                ps.setString(3, diagnosis != null ? diagnosis : "General Checkup");
                ps.executeUpdate();
            }
        }
    }

    // =========================================================================
    // 4. PRESCRIPTIONS SYNC
    // =========================================================================

    public void syncPrescription(Prescription rx) {
        if (rx == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, rx.getPatient());
            Integer doctorId = getZippyDoctorId(conn, rx.getDoctorId());

            if (petId == null || doctorId == null) {
                log.warn("Skipping prescription sync: missing pet ({}) or doctor ({})", petId, doctorId);
                return;
            }

            LocalDate validUntil = rx.getPrescriptionDate() != null ? rx.getPrescriptionDate().plusMonths(1)
                    : LocalDate.now().plusMonths(1);
            LocalDate rxDate = rx.getPrescriptionDate() != null ? rx.getPrescriptionDate() : LocalDate.now();

            String docName = rx.getDoctorName() != null && !rx.getDoctorName().isBlank() ? rx.getDoctorName()
                    : "Dr. Zenve";
            String petName = rx.getPatient() != null ? rx.getPatient().getName() : "Pet";
            String ownerName = (rx.getPatient() != null && rx.getPatient().getOwner() != null)
                    ? rx.getPatient().getOwner().getFullName()
                    : "Pet Parent";

            Integer existingId = null;
            String checkSql = "SELECT id FROM prescriptions WHERE doctor_id = ? AND pet_id = ? AND valid_until = ? LIMIT 1";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setInt(1, doctorId);
                checkStmt.setInt(2, petId);
                checkStmt.setDate(3, java.sql.Date.valueOf(validUntil));
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) existingId = rs.getInt("id");
                }
            }

            if (existingId != null) {
                String updateSql = "UPDATE prescriptions SET valid_until = ?, doc_name = ?, pet_name = ?, owner_name = ? WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setDate(1, java.sql.Date.valueOf(validUntil));
                    updateStmt.setString(2, docName);
                    updateStmt.setString(3, petName);
                    updateStmt.setString(4, ownerName);
                    updateStmt.setInt(5, existingId);
                    updateStmt.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO prescriptions (doctor_id, pet_id, valid_until, created_at, doc_name, pet_name, owner_name) VALUES (?, ?, ?, ?, ?, ?, ?)";
                try (PreparedStatement insertStmt = conn.prepareStatement(insertSql)) {
                    insertStmt.setInt(1, doctorId);
                    insertStmt.setInt(2, petId);
                    insertStmt.setDate(3, java.sql.Date.valueOf(validUntil));
                    insertStmt.setTimestamp(4, java.sql.Timestamp.valueOf(rxDate.atStartOfDay()));
                    insertStmt.setString(5, docName);
                    insertStmt.setString(6, petName);
                    insertStmt.setString(7, ownerName);
                    insertStmt.executeUpdate();
                }
            }
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM prescriptions failed: {}", e.getMessage());
        }
    }

    // =========================================================================
    // 5. MEDICAL RECORDS & CONSULTATIONS SYNC
    // =========================================================================

    public void syncMedicalRecord(MedicalRecord record) {
        if (record == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, record.getPatient());
            if (petId == null) {
                return;
            }

            LocalDate visitDate = record.getVisitDate() != null ? record.getVisitDate() : LocalDate.now();
            String recordType = "Consultation";
            String title = record.getChiefComplaint() != null && !record.getChiefComplaint().isBlank()
                    ? record.getChiefComplaint()
                    : "Veterinary Consultation";
            String diagnosis = record.getDiagnosis() != null && !record.getDiagnosis().isBlank()
                    ? record.getDiagnosis()
                    : (record.getTreatment() != null ? record.getTreatment() : "Routine Checkup");

            Integer existingId = null;
            String checkSql = "SELECT id FROM medical_records WHERE pet_id = ? AND record_date = ? AND title = ? LIMIT 1";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setInt(1, petId);
                checkStmt.setDate(2, java.sql.Date.valueOf(visitDate));
                checkStmt.setString(3, title);
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) existingId = rs.getInt("id");
                }
            }

            if (existingId != null) {
                String updateSql = "UPDATE medical_records SET record_type = ?, diagnosis = ? WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setString(1, recordType);
                    updateStmt.setString(2, diagnosis);
                    updateStmt.setInt(3, existingId);
                    updateStmt.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO medical_records (pet_id, record_type, title, diagnosis, record_date) VALUES (?, ?, ?, ?, ?)";
                try (PreparedStatement insertStmt = conn.prepareStatement(insertSql)) {
                    insertStmt.setInt(1, petId);
                    insertStmt.setString(2, recordType);
                    insertStmt.setString(3, title);
                    insertStmt.setString(4, diagnosis);
                    insertStmt.setDate(5, java.sql.Date.valueOf(visitDate));
                    insertStmt.executeUpdate();
                }
            }
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM medical_records failed: {}", e.getMessage());
        }
    }


    // =========================================================================
    // 7. VACCINATIONS SYNC
    // =========================================================================

    public void syncVaccination(Vaccination v) {
        if (v == null || !properties.isEnabled())
            return;

        try (Connection conn = getConnection()) {
            Integer petId = getOrCreateZippyPetId(conn, v.getPatient());
            if (petId == null) {
                return;
            }

            String vaccineName = v.getVaccineName() != null && !v.getVaccineName().isBlank() ? v.getVaccineName().trim()
                    : "Rabies Vaccine";
            LocalDate adminOn = v.getVaccinationDate() != null ? v.getVaccinationDate() : LocalDate.now();
            LocalDate nextDue = v.getNextDueDate() != null ? v.getNextDueDate() : adminOn.plusYears(1);
            String batch = v.getBatchNumber() != null ? v.getBatchNumber() : "BAT-" + System.currentTimeMillis();

            Integer existingId = null;
            String checkSql = "SELECT id FROM vaccinations WHERE pet_id = ? AND vaccine_name = ? AND administered_on = ? LIMIT 1";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setInt(1, petId);
                checkStmt.setString(2, vaccineName);
                checkStmt.setDate(3, java.sql.Date.valueOf(adminOn));
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) existingId = rs.getInt("id");
                }
            }

            if (existingId != null) {
                String updateSql = "UPDATE vaccinations SET next_due_on = ?, batch_number = ? WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setDate(1, java.sql.Date.valueOf(nextDue));
                    updateStmt.setString(2, batch);
                    updateStmt.setInt(3, existingId);
                    updateStmt.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO vaccinations (pet_id, vaccine_name, administered_on, next_due_on, batch_number) VALUES (?, ?, ?, ?, ?)";
                try (PreparedStatement insertStmt = conn.prepareStatement(insertSql)) {
                    insertStmt.setInt(1, petId);
                    insertStmt.setString(2, vaccineName);
                    insertStmt.setDate(3, java.sql.Date.valueOf(adminOn));
                    insertStmt.setDate(4, java.sql.Date.valueOf(nextDue));
                    insertStmt.setString(5, batch);
                    insertStmt.executeUpdate();
                }
            }
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM vaccinations failed for {}: {}", v.getVaccineName(), e.getMessage());
        }
    }

    // =========================================================================
    // 9. FOLLOW-UPS SYNC
    // =========================================================================

    public void syncFollowUp(FollowUp followUp) {
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
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(
                properties.getDbUrl(),
                properties.getDbUser(),
                properties.getDbPassword());
    }
}
