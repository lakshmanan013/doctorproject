package doctor.backend.service;

import doctor.backend.dto.auth.DoctorImageSyncRequest;
import doctor.backend.entity.DoctorProfile;
import doctor.backend.entity.User;
import doctor.backend.repository.DoctorProfileRepository;
import doctor.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class DoctorProfileService {

    private final DoctorProfileRepository repository;
    private final UserRepository userRepository;
    private final ZippyCrmSyncService zippyCrmSyncService;
    private final AdminApprovalClient adminApprovalClient;

    public DoctorProfileService(
            DoctorProfileRepository repository,
            UserRepository userRepository,
            ZippyCrmSyncService zippyCrmSyncService,
            AdminApprovalClient adminApprovalClient) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.zippyCrmSyncService = zippyCrmSyncService;
        this.adminApprovalClient = adminApprovalClient;
    }

    /**
     * Returns the profile belonging to the given doctor, creating an empty
     * one on first access. userId must come from the authenticated
     * request (CurrentUserProvider / the internal endpoint's email lookup)
     * - never from client input.
     */
    public DoctorProfile getProfile(Long userId) {

        DoctorProfile profile = repository
                .findByUserId(userId)
                .orElseGet(() -> {
                    DoctorProfile newProf = new DoctorProfile();
                    newProf.setUserId(userId);
                    return repository.save(newProf);
                });

        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            boolean updated = false;

            if ((profile.getProfileImage() == null || profile.getProfileImage().isBlank()) && user.getProfileImage() != null && !user.getProfileImage().isBlank()) {
                profile.setProfileImage(user.getProfileImage());
                updated = true;
            }
            if ((profile.getClinicInsideImage() == null || profile.getClinicInsideImage().isBlank()) && user.getClinicInsideImage() != null && !user.getClinicInsideImage().isBlank()) {
                profile.setClinicInsideImage(user.getClinicInsideImage());
                updated = true;
            }
            if ((profile.getClinicOutsideImage() == null || profile.getClinicOutsideImage().isBlank()) && user.getClinicOutsideImage() != null && !user.getClinicOutsideImage().isBlank()) {
                profile.setClinicOutsideImage(user.getClinicOutsideImage());
                updated = true;
            }
            if ((profile.getDigitalSignatureImage() == null || profile.getDigitalSignatureImage().isBlank()) && user.getDigitalSignatureImage() != null && !user.getDigitalSignatureImage().isBlank()) {
                profile.setDigitalSignatureImage(user.getDigitalSignatureImage());
                updated = true;
            }

            // If still missing any images, import directly from Zippy CRM pet_management DB
            if (profile.getProfileImage() == null || profile.getProfileImage().isBlank()
                    || profile.getClinicInsideImage() == null || profile.getClinicInsideImage().isBlank()
                    || profile.getClinicOutsideImage() == null || profile.getClinicOutsideImage().isBlank()
                    || profile.getDigitalSignatureImage() == null || profile.getDigitalSignatureImage().isBlank()) {
                zippyCrmSyncService.importDoctorImagesFromZippy(user, profile);
                DoctorProfile reloaded = repository.findByUserId(userId).orElse(profile);
                return reloaded;
            }

            if (updated) {
                return repository.save(profile);
            }
        }

        return profile;
    }

    public DoctorProfile saveProfile(
            Long userId,
            DoctorProfile profile) {

        DoctorProfile existing = repository
                .findByUserId(userId)
                .orElseGet(DoctorProfile::new);

        existing.setUserId(userId);

        existing.setFullName(
                profile.getFullName());

        existing.setQualification(
                profile.getQualification());

        existing.setSpeciality(
                profile.getSpeciality());

        existing.setCouncilRegistration(
                profile.getCouncilRegistration());

        existing.setClinicHospital(
                profile.getClinicHospital());

        existing.setPhone(
                profile.getPhone());

        existing.setEmail(
                profile.getEmail());

        existing.setDigitalSignatureName(
                profile.getDigitalSignatureName());

        existing.setConsultationFee(
                profile.getConsultationFee());

        existing.setFollowUpFee(
                profile.getFollowUpFee());

        existing.setSlotLength(
                profile.getSlotLength());

        if (profile.getVideoConsultationEnabled() != null) {
            existing.setVideoConsultationEnabled(
                    profile.getVideoConsultationEnabled());
        }

        existing.setArea(
                profile.getArea());

        existing.setCity(
                profile.getCity());

        existing.setPincode(
                profile.getPincode());

        existing.setExperience(
                profile.getExperience());

        existing.setProfileImage(profile.getProfileImage());
        existing.setClinicInsideImage(profile.getClinicInsideImage());
        existing.setClinicOutsideImage(profile.getClinicOutsideImage());
        existing.setDigitalSignatureImage(profile.getDigitalSignatureImage());

        DoctorProfile saved = repository.save(existing);

        // Also sync profile images & info to users table
        userRepository.findById(userId).ifPresent(user -> {
            user.setProfileImage(profile.getProfileImage());
            user.setClinicInsideImage(profile.getClinicInsideImage());
            user.setClinicOutsideImage(profile.getClinicOutsideImage());
            user.setDigitalSignatureImage(profile.getDigitalSignatureImage());
            if (profile.getFullName() != null && !profile.getFullName().isBlank()) {
                user.setFullName(profile.getFullName());
            }
            if (profile.getPhone() != null && !profile.getPhone().isBlank()) {
                user.setPhone(profile.getPhone());
            }
            userRepository.save(user);
        });

        zippyCrmSyncService.syncDoctor(saved);

        // Also sync location and profile info to Zenve admin approval backend
        try {
            userRepository.findById(userId).ifPresent(user -> {
                adminApprovalClient.notifyProfileUpdated(
                        user.getEmail(),
                        saved.getFullName() != null ? saved.getFullName() : user.getFullName(),
                        saved.getPhone() != null ? saved.getPhone() : user.getPhone(),
                        saved.getClinicHospital(),
                        saved.getQualification(),
                        saved.getArea(),
                        saved.getCity(),
                        saved.getPincode(),
                        saved.getProfileImage()
                );
            });
        } catch (Exception ignored) {
        }

        return saved;
    }

    public DoctorProfile updateDoctorImages(DoctorImageSyncRequest req) {
        if (req == null) return null;

        User doctor = null;
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            doctor = userRepository.findByEmail(req.getEmail().trim().toLowerCase()).orElse(null);
        }
        if (doctor == null && req.getPhone() != null && !req.getPhone().isBlank()) {
            final String p = req.getPhone().trim();
            doctor = userRepository.findAll().stream()
                    .filter(u -> u.getPhone() != null && (u.getPhone().equals(p)
                            || p.endsWith(u.getPhone()) || u.getPhone().endsWith(p)))
                    .findFirst().orElse(null);
        }

        if (doctor == null) {
            return null;
        }

        final Long docId = doctor.getId();
        DoctorProfile profile = repository.findByUserId(docId)
                .orElseGet(() -> {
                    DoctorProfile newProf = new DoctorProfile();
                    newProf.setUserId(docId);
                    return newProf;
                });

        String docType = req.getDocumentType() != null ? req.getDocumentType().toLowerCase() : "";
        String imgData = req.getImageData();

        if (imgData != null && !imgData.isBlank()) {
            if (docType.contains("inside")) {
                profile.setClinicInsideImage(imgData);
                doctor.setClinicInsideImage(imgData);
            } else if (docType.contains("outside")) {
                profile.setClinicOutsideImage(imgData);
                doctor.setClinicOutsideImage(imgData);
            } else if (docType.contains("signature")) {
                profile.setDigitalSignatureImage(imgData);
                doctor.setDigitalSignatureImage(imgData);
            } else {
                profile.setProfileImage(imgData);
                doctor.setProfileImage(imgData);
            }
        }

        if (req.getProfileImage() != null && !req.getProfileImage().isBlank()) {
            profile.setProfileImage(req.getProfileImage());
            doctor.setProfileImage(req.getProfileImage());
        }
        if (req.getClinicInsideImage() != null && !req.getClinicInsideImage().isBlank()) {
            profile.setClinicInsideImage(req.getClinicInsideImage());
            doctor.setClinicInsideImage(req.getClinicInsideImage());
        }
        if (req.getClinicOutsideImage() != null && !req.getClinicOutsideImage().isBlank()) {
            profile.setClinicOutsideImage(req.getClinicOutsideImage());
            doctor.setClinicOutsideImage(req.getClinicOutsideImage());
        }
        if (req.getDigitalSignatureImage() != null && !req.getDigitalSignatureImage().isBlank()) {
            profile.setDigitalSignatureImage(req.getDigitalSignatureImage());
            doctor.setDigitalSignatureImage(req.getDigitalSignatureImage());
        } else if (req.getSignatureImage() != null && !req.getSignatureImage().isBlank()) {
            profile.setDigitalSignatureImage(req.getSignatureImage());
            doctor.setDigitalSignatureImage(req.getSignatureImage());
        }

        userRepository.save(doctor);
        DoctorProfile savedProfile = repository.save(profile);

        try {
            adminApprovalClient.notifyProfileUpdated(
                    doctor.getEmail(),
                    savedProfile.getFullName() != null ? savedProfile.getFullName() : doctor.getFullName(),
                    savedProfile.getPhone() != null ? savedProfile.getPhone() : doctor.getPhone(),
                    savedProfile.getClinicHospital(),
                    savedProfile.getQualification(),
                    savedProfile.getArea(),
                    savedProfile.getCity(),
                    savedProfile.getPincode(),
                    savedProfile.getProfileImage()
            );
        } catch (Exception ignored) {
        }

        zippyCrmSyncService.syncDoctor(savedProfile);
        return savedProfile;
    }

    /**
     * Called by the internal endpoint the Zenve admin backend hits when an
     * admin clicks "verify" on one of the Verification panel items, for the
     * specific doctor (userId) the admin was looking at.
     */
    public DoctorProfile applyVerification(Long userId, String item) {

        DoctorProfile existing = repository
                .findByUserId(userId)
                .orElseGet(() -> {
                    DoctorProfile profile = new DoctorProfile();
                    profile.setUserId(userId);
                    return profile;
                });

        switch (item) {
            case "VETERINARY_REGISTRATION" ->
                existing.setVeterinaryRegistrationVerified(true);
            case "KYC" ->
                existing.setKycVerified(true);
            case "DIGITAL_SIGNATURE" ->
                existing.setDigitalSignatureVerified(true);
            case "STATE_COUNCIL_SYNC" ->
                existing.setStateCouncilSyncVerified(true);
            default ->
                throw new doctor.backend.exception.BadRequestException(
                        "Unknown verification item: " + item);
        }

        DoctorProfile saved = repository.save(existing);
        zippyCrmSyncService.syncDoctor(saved);
        return saved;
    }
}
