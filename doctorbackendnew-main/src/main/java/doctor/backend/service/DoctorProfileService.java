package doctor.backend.service;

import doctor.backend.entity.DoctorProfile;
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

        // Ensure images from User table are reflected if not yet on DoctorProfile
        if (profile.getProfileImage() == null || profile.getProfileImage().isBlank()) {
            userRepository.findById(userId).ifPresent(user -> {
                if (user.getProfileImage() != null && !user.getProfileImage().isBlank()) {
                    profile.setProfileImage(user.getProfileImage());
                    repository.save(profile);
                }
            });
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
                        saved.getCity(),
                        saved.getPincode(),
                        saved.getProfileImage()
                );
            });
        } catch (Exception ignored) {
        }

        return saved;
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
