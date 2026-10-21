package doctor.backend.service;

import doctor.backend.config.ZippyCrmProperties;
import doctor.backend.entity.*;
import doctor.backend.repository.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional
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
    private final MedicineRepository medicineRepository;
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
            stmt.executeUpdate("DELETE FROM seller_stores WHERE business_name LIKE 'Zenve%' OR business_name = 'Zenve Doctor Clinic'");
            stmt.execute("SET FOREIGN_KEY_CHECKS = 1");
            log.info("Cleaned up legacy commerce orders and payments from Zippy CRM pet_management database.");
        } catch (Exception e) {
            log.warn("Could not clean legacy commerce tables in Zippy CRM: {}", e.getMessage());
        }
    }

    public synchronized void syncAll() {
        if (!properties.isEnabled()) {
            return;
        }

        log.info("Starting comprehensive sync of Doctor Portal to Zippy CRM (pet_management)...");

        // 0. Import Products from Zippy CRM into Doctor Website Inventory
        try {
            importProductsFromZippyCrm();
        } catch (Exception e) {
            log.warn("Error importing products from Zippy CRM: {}", e.getMessage());
        }

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

        // 1b. Sync Clinics & Hospitals
        try {
            syncAllClinicsHospitals();
            log.info("Synced clinics and hospitals to Zippy CRM.");
        } catch (Exception e) {
            log.warn("Error syncing clinics and hospitals to Zippy CRM: {}", e.getMessage());
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

        DoctorProfile currentProfile = profile;
        if (currentProfile == null) {
            currentProfile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
        }

        String phone = (currentProfile != null && currentProfile.getPhone() != null && !currentProfile.getPhone().isBlank())
                ? currentProfile.getPhone().trim()
                : (user.getPhone() != null ? user.getPhone().trim() : "");

        String name = (currentProfile != null && currentProfile.getFullName() != null && !currentProfile.getFullName().isBlank())
                ? currentProfile.getFullName().trim()
                : (user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName().trim()
                        : "Dr. Unknown");
        String userName = (user.getFullName() != null && !user.getFullName().isBlank()) ? user.getFullName().trim()
                : "";
        String userPhone = (user.getPhone() != null && !user.getPhone().isBlank()) ? user.getPhone().trim() : "";
        String email = user.getEmail() != null ? user.getEmail().trim() : "";

        String qualification = (currentProfile != null && currentProfile.getQualification() != null
                && !currentProfile.getQualification().isBlank())
                        ? currentProfile.getQualification().trim()
                        : "BVSc & AH";

        String specializations = (currentProfile != null && currentProfile.getSpeciality() != null
                && !currentProfile.getSpeciality().isBlank())
                        ? currentProfile.getSpeciality().trim()
                        : "Veterinarian";

        String city = (currentProfile != null && currentProfile.getCity() != null && !currentProfile.getCity().isBlank())
                ? currentProfile.getCity().trim()
                : ((currentProfile != null && currentProfile.getClinicHospital() != null
                        && !currentProfile.getClinicHospital().isBlank())
                                ? currentProfile.getClinicHospital().trim()
                                : "Bangalore");

        String area = (currentProfile != null && currentProfile.getArea() != null && !currentProfile.getArea().isBlank())
                ? currentProfile.getArea().trim()
                : "";

        String councilRegistration = (currentProfile != null && currentProfile.getCouncilRegistration() != null && !currentProfile.getCouncilRegistration().isBlank())
                ? currentProfile.getCouncilRegistration().trim()
                : "";

        int pincode = (currentProfile != null && currentProfile.getPincode() != null)
                ? currentProfile.getPincode()
                : 560001;

        int experienceYears = (currentProfile != null && currentProfile.getExperience() != null)
                ? currentProfile.getExperience()
                : 5;

        double consultationFee = (currentProfile != null && currentProfile.getConsultationFee() != null)
                ? currentProfile.getConsultationFee()
                : 500.0;

        double followUpFee = (currentProfile != null && currentProfile.getFollowUpFee() != null)
                ? currentProfile.getFollowUpFee()
                : 300.0;

        int slotLength = (currentProfile != null && currentProfile.getSlotLength() != null)
                ? currentProfile.getSlotLength()
                : 15;

        boolean videoConsultationEnabled = currentProfile != null && Boolean.TRUE.equals(currentProfile.getVideoConsultationEnabled());

        String digitalSignatureName = (currentProfile != null && currentProfile.getDigitalSignatureName() != null && !currentProfile.getDigitalSignatureName().isBlank())
                ? currentProfile.getDigitalSignatureName().trim()
                : "";

        String secondarySignatureName = (currentProfile != null && currentProfile.getSecondarySignatureName() != null && !currentProfile.getSecondarySignatureName().isBlank())
                ? currentProfile.getSecondarySignatureName().trim()
                : "";

        boolean vetRegVerified = currentProfile != null && currentProfile.isVeterinaryRegistrationVerified();
        boolean kycVerified = currentProfile != null && currentProfile.isKycVerified();
        boolean digSigVerified = currentProfile != null && currentProfile.isDigitalSignatureVerified();
        boolean councilVerified = currentProfile != null && currentProfile.isStateCouncilSyncVerified();

        boolean isActive = !"rejected".equalsIgnoreCase(verificationStatus);

        String digitsOnly = phone.replaceAll("[^0-9]", "");
        String last10 = digitsOnly.length() >= 10 ? digitsOnly.substring(digitsOnly.length() - 10) : digitsOnly;
        String userDigitsOnly = userPhone.replaceAll("[^0-9]", "");
        String userLast10 = userDigitsOnly.length() >= 10 ? userDigitsOnly.substring(userDigitsOnly.length() - 10)
                : userDigitsOnly;

        String clinicName = (currentProfile != null && currentProfile.getClinicHospital() != null && !currentProfile.getClinicHospital().isBlank())
                ? currentProfile.getClinicHospital().trim()
                : "";

        String clinicPhone = (currentProfile != null && currentProfile.getClinicPhone() != null && !currentProfile.getClinicPhone().isBlank())
                ? currentProfile.getClinicPhone().trim()
                : "";

        String facilityType = (currentProfile != null && currentProfile.getFacilityType() != null && !currentProfile.getFacilityType().isBlank())
                ? currentProfile.getFacilityType().trim()
                : "Clinic";

        String selectSql = "SELECT id, profile_image, signature_image, clinic_inside_image, clinic_outside_image, "
                + "clinic_name, clinic_hospital, clinic_phone, hospital_phone, facility_type, "
                + "area, council_registration, follow_up_fee, slot_length, video_consultation_enabled, "
                + "digital_signature_name, secondary_signature_name, secondary_signature_image, "
                + "veterinary_registration_verified, kyc_verified, digital_signature_verified, state_council_sync_verified "
                + "FROM doctors WHERE (phone = ? AND phone != '') OR (phone LIKE ? AND ? != '') "
                + "OR (phone = ? AND phone != '') OR (phone LIKE ? AND ? != '') "
                + "OR (email = ? AND email != '') OR name = ? OR name = ? ORDER BY id ASC LIMIT 1";
        Integer existingId = null;
        String zippyProfImg = null, zippySigImg = null, zippyInsideImg = null, zippyOutsideImg = null;
        String zippyClinic = null, zippyPhone = null, zippyFacility = null;
        String zippySecSigImg = null;

        ensureDoctorColumns(conn);

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
                    zippyProfImg = rs.getString("profile_image");
                    zippySigImg = rs.getString("signature_image");
                    try {
                        zippyInsideImg = rs.getString("clinic_inside_image");
                        zippyOutsideImg = rs.getString("clinic_outside_image");
                        zippyClinic = rs.getString("clinic_name");
                        if (zippyClinic == null || zippyClinic.isBlank()) zippyClinic = rs.getString("clinic_hospital");
                        zippyPhone = rs.getString("clinic_phone");
                        if (zippyPhone == null || zippyPhone.isBlank()) zippyPhone = rs.getString("hospital_phone");
                        zippyFacility = rs.getString("facility_type");
                        zippySecSigImg = rs.getString("secondary_signature_image");
                        
                        String zArea = rs.getString("area");
                        if (zArea != null && !zArea.isBlank() && (currentProfile != null && (currentProfile.getArea() == null || currentProfile.getArea().isBlank()))) {
                            currentProfile.setArea(zArea);
                        }
                        String zCouncil = rs.getString("council_registration");
                        if (zCouncil != null && !zCouncil.isBlank() && (currentProfile != null && (currentProfile.getCouncilRegistration() == null || currentProfile.getCouncilRegistration().isBlank()))) {
                            currentProfile.setCouncilRegistration(zCouncil);
                        }
                    } catch (Exception ignored) {}
                }
            }
        }

        // Bi-directional synchronization: if Zippy has clinic / images but DoctorProfile in doctortest doesn't, import them!
        boolean imported = false;
        if (currentProfile != null) {
            if (zippyProfImg != null && !zippyProfImg.isBlank() && (currentProfile.getProfileImage() == null || currentProfile.getProfileImage().isBlank())) {
                currentProfile.setProfileImage(zippyProfImg);
                user.setProfileImage(zippyProfImg);
                imported = true;
            }
            if (zippySigImg != null && !zippySigImg.isBlank() && (currentProfile.getDigitalSignatureImage() == null || currentProfile.getDigitalSignatureImage().isBlank())) {
                currentProfile.setDigitalSignatureImage(zippySigImg);
                user.setDigitalSignatureImage(zippySigImg);
                imported = true;
            }
            if (zippySecSigImg != null && !zippySecSigImg.isBlank() && (currentProfile.getSecondarySignatureImage() == null || currentProfile.getSecondarySignatureImage().isBlank())) {
                currentProfile.setSecondarySignatureImage(zippySecSigImg);
                user.setSecondarySignatureImage(zippySecSigImg);
                imported = true;
            }
            if (zippyInsideImg != null && !zippyInsideImg.isBlank() && (currentProfile.getClinicInsideImage() == null || currentProfile.getClinicInsideImage().isBlank())) {
                currentProfile.setClinicInsideImage(zippyInsideImg);
                user.setClinicInsideImage(zippyInsideImg);
                imported = true;
            }
            if (zippyOutsideImg != null && !zippyOutsideImg.isBlank() && (currentProfile.getClinicOutsideImage() == null || currentProfile.getClinicOutsideImage().isBlank())) {
                currentProfile.setClinicOutsideImage(zippyOutsideImg);
                user.setClinicOutsideImage(zippyOutsideImg);
                imported = true;
            }
            if (zippyClinic != null && !zippyClinic.isBlank() && (currentProfile.getClinicHospital() == null || currentProfile.getClinicHospital().isBlank())) {
                currentProfile.setClinicHospital(zippyClinic);
                imported = true;
            }
            if (zippyPhone != null && !zippyPhone.isBlank() && (currentProfile.getClinicPhone() == null || currentProfile.getClinicPhone().isBlank())) {
                currentProfile.setClinicPhone(zippyPhone);
                imported = true;
            }
            if (zippyFacility != null && !zippyFacility.isBlank() && (currentProfile.getFacilityType() == null || currentProfile.getFacilityType().isBlank())) {
                currentProfile.setFacilityType(zippyFacility);
                imported = true;
            }
            if (imported) {
                userRepository.save(user);
                doctorProfileRepository.save(currentProfile);
            }
        }

        String profImgToSend = currentProfile != null && currentProfile.getProfileImage() != null ? currentProfile.getProfileImage() : user.getProfileImage();
        String sigImgToSend = currentProfile != null && currentProfile.getDigitalSignatureImage() != null ? currentProfile.getDigitalSignatureImage() : user.getDigitalSignatureImage();
        String secSigImgToSend = currentProfile != null && currentProfile.getSecondarySignatureImage() != null ? currentProfile.getSecondarySignatureImage() : user.getSecondarySignatureImage();
        String insideImgToSend = currentProfile != null && currentProfile.getClinicInsideImage() != null ? currentProfile.getClinicInsideImage() : user.getClinicInsideImage();
        String outsideImgToSend = currentProfile != null && currentProfile.getClinicOutsideImage() != null ? currentProfile.getClinicOutsideImage() : user.getClinicOutsideImage();

        if (existingId != null) {
            String updateSql = "UPDATE doctors SET name = ?, qualification = ?, specializations = ?, phone = ?, "
                    + "city = ?, pincode = ?, experience_years = ?, consultation_fee = ?, verification_status = ?, is_active = ?, email = ?, "
                    + "clinic_name = ?, clinic_hospital = ?, clinic_phone = ?, hospital_phone = ?, facility_type = ?, "
                    + "profile_image = COALESCE(?, profile_image), signature_image = COALESCE(?, signature_image), "
                    + "clinic_inside_image = COALESCE(?, clinic_inside_image), clinic_outside_image = COALESCE(?, clinic_outside_image), "
                    + "area = ?, council_registration = ?, follow_up_fee = ?, slot_length = ?, video_consultation_enabled = ?, "
                    + "digital_signature_name = ?, secondary_signature_name = ?, secondary_signature_image = COALESCE(?, secondary_signature_image), "
                    + "veterinary_registration_verified = ?, kyc_verified = ?, digital_signature_verified = ?, state_council_sync_verified = ? "
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
                updateStmt.setString(12, clinicName);
                updateStmt.setString(13, clinicName);
                updateStmt.setString(14, clinicPhone);
                updateStmt.setString(15, clinicPhone);
                updateStmt.setString(16, facilityType);
                updateStmt.setString(17, profImgToSend);
                updateStmt.setString(18, sigImgToSend);
                updateStmt.setString(19, insideImgToSend);
                updateStmt.setString(20, outsideImgToSend);
                updateStmt.setString(21, area);
                updateStmt.setString(22, councilRegistration);
                updateStmt.setDouble(23, followUpFee);
                updateStmt.setInt(24, slotLength);
                updateStmt.setBoolean(25, videoConsultationEnabled);
                updateStmt.setString(26, digitalSignatureName);
                updateStmt.setString(27, secondarySignatureName);
                updateStmt.setString(28, secSigImgToSend);
                updateStmt.setBoolean(29, vetRegVerified);
                updateStmt.setBoolean(30, kycVerified);
                updateStmt.setBoolean(31, digSigVerified);
                updateStmt.setBoolean(32, councilVerified);
                updateStmt.setInt(33, existingId);
                updateStmt.executeUpdate();
            }
            syncClinicHospital(conn, clinicName, clinicPhone, facilityType);
            return existingId;
        } else {
            String insertSql = "INSERT INTO doctors (name, qualification, specializations, phone, city, pincode, "
                    + "experience_years, consultation_fee, verification_status, is_active, email, "
                    + "clinic_name, clinic_hospital, clinic_phone, hospital_phone, facility_type, "
                    + "profile_image, signature_image, clinic_inside_image, clinic_outside_image, "
                    + "area, council_registration, follow_up_fee, slot_length, video_consultation_enabled, "
                    + "digital_signature_name, secondary_signature_name, secondary_signature_image, "
                    + "veterinary_registration_verified, kyc_verified, digital_signature_verified, state_council_sync_verified) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
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
                insertStmt.setString(12, clinicName);
                insertStmt.setString(13, clinicName);
                insertStmt.setString(14, clinicPhone);
                insertStmt.setString(15, clinicPhone);
                insertStmt.setString(16, facilityType);
                insertStmt.setString(17, profImgToSend);
                insertStmt.setString(18, sigImgToSend);
                insertStmt.setString(19, insideImgToSend);
                insertStmt.setString(20, outsideImgToSend);
                insertStmt.setString(21, area);
                insertStmt.setString(22, councilRegistration);
                insertStmt.setDouble(23, followUpFee);
                insertStmt.setInt(24, slotLength);
                insertStmt.setBoolean(25, videoConsultationEnabled);
                insertStmt.setString(26, digitalSignatureName);
                insertStmt.setString(27, secondarySignatureName);
                insertStmt.setString(28, secSigImgToSend);
                insertStmt.setBoolean(29, vetRegVerified);
                insertStmt.setBoolean(30, kycVerified);
                insertStmt.setBoolean(31, digSigVerified);
                insertStmt.setBoolean(32, councilVerified);
                insertStmt.executeUpdate();
                syncClinicHospital(conn, clinicName, clinicPhone, facilityType);
                try (ResultSet rs = insertStmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        }
        return null;
    }

    public void syncAllClinicsHospitals() {
        if (!properties.isEnabled()) return;
        try (Connection conn = getConnection()) {
            ensureClinicHospitalTable(conn);

            // 1. Scan doctor profiles from Doctor Portal
            List<DoctorProfile> profiles = doctorProfileRepository.findAll();
            for (DoctorProfile p : profiles) {
                String cName = p.getClinicHospital();
                if (cName != null && !cName.isBlank()) {
                    String phone = (p.getClinicPhone() != null && !p.getClinicPhone().isBlank()) ? p.getClinicPhone() : p.getPhone();
                    syncClinicHospital(conn, cName, phone, p.getFacilityType());
                }
            }

            // 2. Scan distinct clinics from Zippy CRM doctors table
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT DISTINCT clinic_name, clinic_hospital, clinic_phone, hospital_phone, facility_type, phone FROM doctors "
                         + "WHERE (clinic_name IS NOT NULL AND clinic_name != '') OR (clinic_hospital IS NOT NULL AND clinic_hospital != '')")) {
                while (rs.next()) {
                    String cName = rs.getString("clinic_name");
                    if (cName == null || cName.isBlank()) cName = rs.getString("clinic_hospital");
                    String cPhone = rs.getString("clinic_phone");
                    if (cPhone == null || cPhone.isBlank()) cPhone = rs.getString("hospital_phone");
                    if (cPhone == null || cPhone.isBlank()) cPhone = rs.getString("phone");
                    String fType = rs.getString("facility_type");
                    if (cName != null && !cName.isBlank()) {
                        syncClinicHospital(conn, cName, cPhone, fType);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not query doctors for clinics in Zippy CRM: {}", e.getMessage());
            }

            // 3. If clinics_hospitals is still completely empty, seed with starter clinics so the CRM table is populated
            boolean hasAny = false;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT id FROM clinics_hospitals LIMIT 1")) {
                if (rs.next()) hasAny = true;
            } catch (Exception ignored) {}

            if (!hasAny) {
                String[][] defaults = {
                    {"Zenve Central Veterinary Hospital", "Hospital", "+91 98765 43210"},
                    {"City Pet Care Clinic", "Clinic", "+91 98765 12345"},
                    {"Cessna Lifeline Veterinary Center", "Specialty Referral Center", "+91 80 4112 3456"}
                };
                for (String[] def : defaults) {
                    syncClinicHospital(conn, def[0], def[2], def[1]);
                }
            }
        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM clinics_hospitals failed: {}", e.getMessage());
        }
    }

    private void ensureClinicHospitalTable(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            String createTable = "CREATE TABLE IF NOT EXISTS clinics_hospitals ("
                    + "id INT AUTO_INCREMENT PRIMARY KEY, "
                    + "name VARCHAR(255) NOT NULL, "
                    + "facility_type VARCHAR(100) DEFAULT 'Clinic', "
                    + "phone VARCHAR(50) DEFAULT '', "
                    + "emergency_available BOOLEAN DEFAULT TRUE, "
                    + "open_24x7 BOOLEAN DEFAULT TRUE, "
                    + "verification_status VARCHAR(50) DEFAULT 'verified', "
                    + "rating FLOAT DEFAULT 4.8, "
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    + ")";
            stmt.executeUpdate(createTable);
        } catch (Exception e) {
            log.warn("Could not ensure clinics_hospitals table: {}", e.getMessage());
        }
    }

    public void syncClinicHospital(Connection conn, String clinicName, String clinicPhone, String facilityType) {
        if (conn == null || clinicName == null || clinicName.isBlank()) {
            return;
        }
        try {
            ensureClinicHospitalTable(conn);
            String checkSql = "SELECT id FROM clinics_hospitals WHERE name = ? OR (phone = ? AND phone != '') LIMIT 1";
            Integer existingClinicId = null;
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setString(1, clinicName.trim());
                checkStmt.setString(2, (clinicPhone != null && !clinicPhone.isBlank()) ? clinicPhone.trim() : "__none__");
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        existingClinicId = rs.getInt("id");
                    }
                }
            }

            String facility = (facilityType != null && !facilityType.isBlank()) ? facilityType.trim() : "Clinic";
            String phone = (clinicPhone != null) ? clinicPhone.trim() : "";

            if (existingClinicId != null) {
                String updateSql = "UPDATE clinics_hospitals SET name = ?, facility_type = ?, phone = ?, "
                        + "emergency_available = 1, open_24x7 = 1, verification_status = 'verified', rating = 4.8 "
                        + "WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setString(1, clinicName.trim());
                    updateStmt.setString(2, facility);
                    updateStmt.setString(3, phone);
                    updateStmt.setInt(4, existingClinicId);
                    updateStmt.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO clinics_hospitals (name, facility_type, phone, emergency_available, open_24x7, verification_status, rating) "
                        + "VALUES (?, ?, ?, 1, 1, 'verified', 4.8)";
                try (PreparedStatement insertStmt = conn.prepareStatement(insertSql)) {
                    insertStmt.setString(1, clinicName.trim());
                    insertStmt.setString(2, facility);
                    insertStmt.setString(3, phone);
                    insertStmt.executeUpdate();
                }
            }
            log.info("Synced clinic '{}' with facility type '{}' and phone '{}' to clinics_hospitals in Zippy CRM", clinicName, facility, phone);
        } catch (Exception e) {
            log.warn("Could not sync clinic to clinics_hospitals in Zippy CRM: {}", e.getMessage());
        }
    }

    private void ensureDoctorColumns(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN clinic_name VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN clinic_hospital VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN clinic_phone VARCHAR(50) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN hospital_phone VARCHAR(50) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN facility_type VARCHAR(100) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN area VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN council_registration VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN follow_up_fee DOUBLE NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN slot_length INT NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN video_consultation_enabled BOOLEAN DEFAULT FALSE"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN digital_signature_name VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN secondary_signature_name VARCHAR(255) NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN secondary_signature_image LONGTEXT NULL"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN veterinary_registration_verified BOOLEAN DEFAULT FALSE"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN kyc_verified BOOLEAN DEFAULT FALSE"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN digital_signature_verified BOOLEAN DEFAULT FALSE"); } catch (Exception ignored) {}
            try { stmt.executeUpdate("ALTER TABLE doctors ADD COLUMN state_council_sync_verified BOOLEAN DEFAULT FALSE"); } catch (Exception ignored) {}
        } catch (Exception e) {
            log.warn("Could not alter doctors table in Zippy CRM: {}", e.getMessage());
        }
    }

    public void importDoctorImagesFromZippy(User user, DoctorProfile profile) {
        if (user == null || !properties.isEnabled()) return;
        try (Connection conn = getConnection()) {
            String phone = (profile != null && profile.getPhone() != null && !profile.getPhone().isBlank())
                    ? profile.getPhone().trim()
                    : (user.getPhone() != null ? user.getPhone().trim() : "");
            String email = user.getEmail() != null ? user.getEmail().trim() : "";
            String digitsOnly = phone.replaceAll("[^0-9]", "");
            String last10 = digitsOnly.length() >= 10 ? digitsOnly.substring(digitsOnly.length() - 10) : digitsOnly;

            String selectSql = "SELECT id, profile_image, signature_image, clinic_inside_image, clinic_outside_image, "
                    + "clinic_name, clinic_hospital, clinic_phone, hospital_phone, facility_type "
                    + "FROM doctors WHERE (email = ? AND email != '') OR (phone = ? AND phone != '') OR (phone LIKE ? AND ? != '') ORDER BY id ASC LIMIT 1";
            Integer docId = null;
            String profImg = null, sigImg = null, insideImg = null, outsideImg = null, secSigImg = null;
            String zippyClinic = null, zippyPhone = null, zippyFacility = null;
            try (PreparedStatement ps = conn.prepareStatement(selectSql)) {
                ps.setString(1, email);
                ps.setString(2, phone);
                ps.setString(3, "%" + last10);
                ps.setString(4, last10);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        docId = rs.getInt("id");
                        profImg = rs.getString("profile_image");
                        sigImg = rs.getString("signature_image");
                        try {
                            insideImg = rs.getString("clinic_inside_image");
                            outsideImg = rs.getString("clinic_outside_image");
                            zippyClinic = rs.getString("clinic_name");
                            if (zippyClinic == null || zippyClinic.isBlank()) zippyClinic = rs.getString("clinic_hospital");
                            zippyPhone = rs.getString("clinic_phone");
                            if (zippyPhone == null || zippyPhone.isBlank()) zippyPhone = rs.getString("hospital_phone");
                            zippyFacility = rs.getString("facility_type");
                            secSigImg = rs.getString("secondary_signature_image");
                        } catch (Exception ignored) {}
                    }
                }
            }

            // Also check doctor_documents in pet_management if any image is still null
            if (docId != null && (profImg == null || sigImg == null || insideImg == null || outsideImg == null || secSigImg == null)) {
                String docSql = "SELECT document_type, file_data, content_type FROM doctor_documents WHERE doctor_id = ?";
                try (PreparedStatement psDoc = conn.prepareStatement(docSql)) {
                    psDoc.setInt(1, docId);
                    try (ResultSet rsDoc = psDoc.executeQuery()) {
                        while (rsDoc.next()) {
                            String dtype = rsDoc.getString("document_type") != null ? rsDoc.getString("document_type").toLowerCase() : "";
                            byte[] bytes = rsDoc.getBytes("file_data");
                            String ctype = rsDoc.getString("content_type");
                            if (bytes != null && bytes.length > 0) {
                                String mime = (ctype != null && ctype.contains("image")) ? ctype : "image/jpeg";
                                String b64 = "data:" + mime + ";base64," + java.util.Base64.getEncoder().encodeToString(bytes);
                                if (dtype.contains("profile") && profImg == null) profImg = b64;
                                else if (dtype.contains("secondary") && secSigImg == null) secSigImg = b64;
                                else if (dtype.contains("signature") && sigImg == null) sigImg = b64;
                                else if (dtype.contains("inside") && insideImg == null) insideImg = b64;
                                else if (dtype.contains("outside") && outsideImg == null) outsideImg = b64;
                            }
                        }
                    }
                }
            }

            boolean updated = false;
            DoctorProfile prof = profile != null ? profile : doctorProfileRepository.findByUserId(user.getId()).orElseGet(() -> {
                DoctorProfile np = new DoctorProfile();
                np.setUserId(user.getId());
                return np;
            });

            if (profImg != null && !profImg.isBlank() && (prof.getProfileImage() == null || prof.getProfileImage().isBlank())) {
                prof.setProfileImage(profImg);
                user.setProfileImage(profImg);
                updated = true;
            }
            if (sigImg != null && !sigImg.isBlank() && (prof.getDigitalSignatureImage() == null || prof.getDigitalSignatureImage().isBlank())) {
                prof.setDigitalSignatureImage(sigImg);
                user.setDigitalSignatureImage(sigImg);
                updated = true;
            }
            if (secSigImg != null && !secSigImg.isBlank() && (prof.getSecondarySignatureImage() == null || prof.getSecondarySignatureImage().isBlank())) {
                prof.setSecondarySignatureImage(secSigImg);
                user.setSecondarySignatureImage(secSigImg);
                updated = true;
            }
            if (insideImg != null && !insideImg.isBlank() && (prof.getClinicInsideImage() == null || prof.getClinicInsideImage().isBlank())) {
                prof.setClinicInsideImage(insideImg);
                user.setClinicInsideImage(insideImg);
                updated = true;
            }
            if (outsideImg != null && !outsideImg.isBlank() && (prof.getClinicOutsideImage() == null || prof.getClinicOutsideImage().isBlank())) {
                prof.setClinicOutsideImage(outsideImg);
                user.setClinicOutsideImage(outsideImg);
                updated = true;
            }
            if (zippyClinic != null && !zippyClinic.isBlank() && (prof.getClinicHospital() == null || prof.getClinicHospital().isBlank())) {
                prof.setClinicHospital(zippyClinic);
                updated = true;
            }
            if (zippyPhone != null && !zippyPhone.isBlank() && (prof.getClinicPhone() == null || prof.getClinicPhone().isBlank())) {
                prof.setClinicPhone(zippyPhone);
                updated = true;
            }
            if (zippyFacility != null && !zippyFacility.isBlank() && (prof.getFacilityType() == null || prof.getFacilityType().isBlank())) {
                prof.setFacilityType(zippyFacility);
                updated = true;
            }

            if (updated) {
                userRepository.save(user);
                doctorProfileRepository.save(prof);
                log.info("Successfully imported images from Zippy CRM pet_management into doctortest for {}", user.getEmail());
            }
        } catch (Exception e) {
            log.warn("Failed to import doctor images from Zippy CRM: {}", e.getMessage());
        }
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

            // Determine consultation fee as the total prescription amount
            double fee = 500.0;
            Prescription matchingRx = null;
            if (appointment.getPatient() != null && appointment.getPatient().getId() != null) {
                List<Prescription> rxs = prescriptionRepository.findByPatientIdAndPrescriptionDate(
                        appointment.getPatient().getId(), date);
                if (!rxs.isEmpty()) {
                    matchingRx = rxs.get(0);
                } else {
                    List<Prescription> allRxs = prescriptionRepository.findByPatientId(
                            appointment.getPatient().getId());
                    if (!allRxs.isEmpty()) {
                        matchingRx = allRxs.get(allRxs.size() - 1);
                    }
                }
            }

            if (matchingRx != null) {
                fee = getPrescriptionTotalAmount(matchingRx);
            } else {
                DoctorProfile profile = appointment.getDoctorId() != null
                        ? doctorProfileRepository.findByUserId(appointment.getDoctorId()).orElse(null)
                        : null;
                fee = (profile != null && profile.getConsultationFee() != null)
                        ? profile.getConsultationFee()
                        : 500.0;
            }

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
                    updateStmt.setDouble(4, fee);
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
                    insertStmt.setDouble(8, fee);
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

            // Also update consultation_fee in Zippy CRM appointments table for this patient visit
            double totalPrescriptionAmount = getPrescriptionTotalAmount(rx);
            String updateApptSql = "UPDATE appointments SET consultation_fee = ?, payment_status = 'Paid', status = 'Completed' WHERE pet_id = ? AND doctor_id = ? AND appointment_date = ?";
            try (PreparedStatement updateApptStmt = conn.prepareStatement(updateApptSql)) {
                updateApptStmt.setDouble(1, totalPrescriptionAmount);
                updateApptStmt.setInt(2, petId);
                updateApptStmt.setInt(3, doctorId);
                updateApptStmt.setDate(4, java.sql.Date.valueOf(rxDate));
                int rows = updateApptStmt.executeUpdate();
                if (rows == 0) {
                    String fallbackSql = "UPDATE appointments SET consultation_fee = ?, payment_status = 'Paid', status = 'Completed' WHERE pet_id = ? AND doctor_id = ? ORDER BY id DESC LIMIT 1";
                    try (PreparedStatement fbStmt = conn.prepareStatement(fallbackSql)) {
                        fbStmt.setDouble(1, totalPrescriptionAmount);
                        fbStmt.setInt(2, petId);
                        fbStmt.setInt(3, doctorId);
                        fbStmt.executeUpdate();
                    }
                }
            }

        } catch (SQLException e) {
            log.warn("Direct DB sync to Zippy CRM prescriptions failed: {}", e.getMessage());
        }
    }

    public double getPrescriptionTotalAmount(Prescription rx) {
        if (rx == null) {
            return 500.0;
        }

        double medTotal = 0.0;
        if (rx.getItems() != null) {
            for (PrescriptionItem item : rx.getItems()) {
                if (item.getMedicine() != null && item.getMedicine().getPrice() != null) {
                    int qty = parseQuantity(item.getQuantity());
                    medTotal += item.getMedicine().getPrice() * qty;
                }
            }
        }

        double doctorConsultFee = 0.0;
        if (rx.getDoctorId() != null) {
            DoctorProfile profile = doctorProfileRepository.findByUserId(rx.getDoctorId()).orElse(null);
            if (profile != null && profile.getConsultationFee() != null) {
                doctorConsultFee = profile.getConsultationFee();
            }
        }

        if (doctorConsultFee <= 0 && medTotal <= 0) {
            doctorConsultFee = 500.0;
        }

        return medTotal + doctorConsultFee;
    }

    private int parseQuantity(String quantity) {
        if (quantity == null || quantity.isBlank()) {
            return 1;
        }
        StringBuilder digits = new StringBuilder();
        for (char c : quantity.trim().toCharArray()) {
            if (Character.isDigit(c)) {
                digits.append(c);
            } else if (digits.length() > 0) {
                break;
            }
        }
        if (digits.length() == 0) {
            return 1;
        }
        try {
            return Math.max(1, Integer.parseInt(digits.toString()));
        } catch (Exception e) {
            return 1;
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

    // =========================================================================
    // 10. PRODUCT / INVENTORY SYNC FROM ZIPPY CRM
    // =========================================================================

    public void importProductsFromZippyCrm() {
        if (!properties.isEnabled()) {
            return;
        }

        try (Connection conn = getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();

            // 1. Check for 'products' table in Zippy CRM pet_management database
            boolean productsTableExists = false;
            try (ResultSet rs = meta.getTables(null, null, "products", null)) {
                if (rs.next()) {
                    productsTableExists = true;
                }
            }

            if (!productsTableExists) {
                log.info("Zippy CRM products table does not exist in pet_management database.");
                return;
            }

            boolean inventoryTableExists = false;
            try (ResultSet rs = meta.getTables(null, null, "inventory", null)) {
                if (rs.next()) {
                    inventoryTableExists = true;
                }
            }

            Set<String> columnNames = new HashSet<>();
            try (ResultSet rs = meta.getColumns(null, null, "products", null)) {
                while (rs.next()) {
                    columnNames.add(rs.getString("COLUMN_NAME").toLowerCase());
                }
            }

            String selectSql;
            if (inventoryTableExists) {
                selectSql = "SELECT p.*, i.available_quantity AS inv_available_quantity, i.reorder_level AS inv_reorder_level "
                          + "FROM products p LEFT JOIN inventory i ON i.product_id = p.id";
            } else {
                selectSql = "SELECT * FROM products";
            }

            int count = 0;
            Set<String> zippyProductNames = new HashSet<>();
            try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery(selectSql)) {
                while (rs.next()) {
                    String name = getStringFromRs(rs, columnNames, "name", "title", "product_name");
                    if (name == null || name.isBlank()) {
                        continue;
                    }

                    zippyProductNames.add(name.trim().toLowerCase());

                    String category = getStringFromRs(rs, columnNames, "category", "category_name", "type");
                    if (category == null || category.isBlank()) {
                        category = "General";
                    }

                    String brand = getStringFromRs(rs, columnNames, "brand", "manufacturer", "vendor");
                    if (brand == null || brand.isBlank()) {
                        brand = "Zippy Pharmacy";
                    }

                    String description = getStringFromRs(rs, columnNames, "description", "short_description", "details");
                    String dosageForm = getStringFromRs(rs, columnNames, "dosage_form", "form");
                    if (dosageForm == null || dosageForm.isBlank()) {
                        dosageForm = "Tablets";
                    }

                    String strength = getStringFromRs(rs, columnNames, "strength", "power");
                    String unit = getStringFromRs(rs, columnNames, "unit", "pack_unit");
                    if (unit == null || unit.isBlank()) {
                        unit = "units";
                    }

                    Double price = getDoubleFromRs(rs, columnNames, "price", "mrp", "cost");
                    if (price == null) {
                        price = 0.0;
                    }

                    Integer stock = null;
                    if (inventoryTableExists) {
                        try {
                            Object invStock = rs.getObject("inv_available_quantity");
                            if (invStock != null) {
                                stock = ((Number) invStock).intValue();
                            }
                        } catch (Exception ignored) {}
                    }
                    if (stock == null) {
                        stock = getIntFromRs(rs, columnNames, "stock_quantity", "stock", "quantity", "inventory");
                    }
                    if (stock == null) {
                        stock = 0;
                    }

                    Integer reorder = null;
                    if (inventoryTableExists) {
                        try {
                            Object invReorder = rs.getObject("inv_reorder_level");
                            if (invReorder != null) {
                                reorder = ((Number) invReorder).intValue();
                            }
                        } catch (Exception ignored) {}
                    }
                    if (reorder == null) {
                        reorder = getIntFromRs(rs, columnNames, "reorder_level", "min_stock", "alert_level");
                    }
                    if (reorder == null) {
                        reorder = 10;
                    }

                    String status = getStringFromRs(rs, columnNames, "status");
                    if (status == null || status.isBlank()) {
                        status = stock > 0 ? "Active" : "Low stock";
                    }

                    // Save or update in doctortest.medicines
                    Medicine medicine = medicineRepository.findByNameIgnoreCase(name.trim()).orElseGet(() -> {
                        Medicine m = new Medicine();
                        m.setName(name.trim());
                        return m;
                    });

                    medicine.setCategory(category.trim());
                    medicine.setManufacturer(brand.trim());
                    if (description != null) medicine.setDescription(description.trim());
                    medicine.setDosageForm(dosageForm.trim());
                    if (strength != null) medicine.setStrength(strength.trim());
                    medicine.setUnit(unit.trim());
                    medicine.setPrice(price);
                    medicine.setStockQuantity(stock);
                    medicine.setReorderLevel(reorder);
                    medicine.setStatus(status);

                    Medicine savedMed = medicineRepository.save(medicine);

                    // Synchronize inventory batch stock with Zippy CRM product stock
                    if (medicineBatchRepository != null) {
                        List<MedicineBatch> batches = medicineBatchRepository.findByMedicineId(savedMed.getId());
                        if (batches.isEmpty()) {
                            if (stock > 0) {
                                MedicineBatch batch = new MedicineBatch();
                                batch.setMedicine(savedMed);
                                batch.setBatchNumber("ZIP-" + (savedMed.getId() != null ? savedMed.getId() : "001") + "-B1");
                                batch.setManufacturingDate(LocalDate.now());
                                batch.setExpiryDate(LocalDate.now().plusMonths(12));
                                batch.setQuantity(stock);
                                batch.setRemainingQuantity(stock);
                                batch.setPurchasePrice(price * 0.7);
                                batch.setSellingPrice(price);
                                batch.setStatus("Active");
                                medicineBatchRepository.save(batch);
                            }
                        } else {
                            MedicineBatch targetBatch = batches.stream()
                                    .filter(b -> b.getBatchNumber() != null && b.getBatchNumber().startsWith("ZIP-"))
                                    .findFirst()
                                    .orElse(batches.get(0));

                            targetBatch.setQuantity(stock);
                            targetBatch.setRemainingQuantity(stock);
                            targetBatch.setStatus(stock > 0 ? "Active" : "Depleted");
                            medicineBatchRepository.save(targetBatch);
                        }
                    }

                    count++;
                }
            }

            // Deactivate any local medicine not present in Zippy CRM database (without violating foreign key constraints on past prescriptions)
            if (!zippyProductNames.isEmpty()) {
                List<Medicine> localMedicines = medicineRepository.findAll();
                for (Medicine localMed : localMedicines) {
                    if (localMed.getName() != null && !zippyProductNames.contains(localMed.getName().trim().toLowerCase())) {
                        if (!"Inactive".equalsIgnoreCase(localMed.getStatus())) {
                            localMed.setStatus("Inactive");
                            localMed.setStockQuantity(0);
                            medicineRepository.save(localMed);
                            log.info("Marked local medicine not in Zippy CRM as Inactive: {}", localMed.getName());
                        }
                    }
                }
            }

            log.info("Successfully fetched and synchronized {} inventory product(s) from Zippy CRM into Doctor Portal inventory.", count);

        } catch (SQLException e) {
            log.warn("Could not import products from Zippy CRM: {}", e.getMessage());
        }
    }

    /**
     * Reduces the stock quantity of a product/medicine directly in Zippy CRM's pet_management database
     * when it is distributed or prescribed in the Doctor Portal.
     */
    public void reduceProductStockInZippyCrm(String medicineName, int quantityToReduce) {
        if (!properties.isEnabled() || medicineName == null || medicineName.isBlank() || quantityToReduce <= 0) {
            return;
        }

        try (Connection conn = getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            boolean productsTableExists = false;
            try (ResultSet rs = meta.getTables(null, null, "products", null)) {
                if (rs.next()) {
                    productsTableExists = true;
                }
            }

            if (!productsTableExists) {
                log.warn("Zippy CRM products table not found in pet_management database.");
                return;
            }

            boolean inventoryTableExists = false;
            try (ResultSet rs = meta.getTables(null, null, "inventory", null)) {
                if (rs.next()) {
                    inventoryTableExists = true;
                }
            }

            String trimmedName = medicineName.trim();

            // 1. Reduce in Zippy CRM 'inventory' table (available_quantity)
            if (inventoryTableExists) {
                String updateInvSql = "UPDATE inventory i "
                        + "JOIN products p ON i.product_id = p.id "
                        + "SET i.available_quantity = GREATEST(0, i.available_quantity - ?) "
                        + "WHERE LOWER(TRIM(p.name)) = LOWER(?) "
                        + "OR LOWER(?) LIKE CONCAT('%', LOWER(TRIM(p.name)), '%') "
                        + "OR LOWER(TRIM(p.name)) LIKE CONCAT('%', LOWER(?), '%')";
                try (PreparedStatement ps = conn.prepareStatement(updateInvSql)) {
                    ps.setInt(1, quantityToReduce);
                    ps.setString(2, trimmedName);
                    ps.setString(3, trimmedName);
                    ps.setString(4, trimmedName);
                    int updatedInvRows = ps.executeUpdate();
                    log.info("Reduced Zippy CRM inventory available_quantity by {} for product '{}' (rows: {})",
                            quantityToReduce, medicineName, updatedInvRows);
                } catch (Exception ex) {
                    log.warn("Could not update Zippy CRM inventory table: {}", ex.getMessage());
                }
            }

        } catch (SQLException e) {
            log.warn("Could not reduce product stock in Zippy CRM for '{}': {}", medicineName, e.getMessage());
        }
    }

    private String getStringFromRs(ResultSet rs, Set<String> availableCols, String... candidates) {
        for (String col : candidates) {
            if (availableCols.contains(col.toLowerCase())) {
                try {
                    String val = rs.getString(col);
                    if (val != null && !val.isBlank()) return val;
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private Double getDoubleFromRs(ResultSet rs, Set<String> availableCols, String... candidates) {
        for (String col : candidates) {
            if (availableCols.contains(col.toLowerCase())) {
                try {
                    double val = rs.getDouble(col);
                    if (!rs.wasNull()) return val;
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private Integer getIntFromRs(ResultSet rs, Set<String> availableCols, String... candidates) {
        for (String col : candidates) {
            if (availableCols.contains(col.toLowerCase())) {
                try {
                    int val = rs.getInt(col);
                    if (!rs.wasNull()) return val;
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(
                properties.getDbUrl(),
                properties.getDbUser(),
                properties.getDbPassword());
    }
}
