package doctor.backend.service;

import doctor.backend.dto.auth.AuthResponse;
import doctor.backend.dto.auth.ForgotPasswordResponse;
import doctor.backend.dto.auth.LoginRequest;
import doctor.backend.dto.auth.MessageResponse;
import doctor.backend.dto.auth.RegisterRequest;
import doctor.backend.dto.auth.VerifyOtpResponse;
import doctor.backend.entity.DoctorProfile;
import doctor.backend.entity.User;
import doctor.backend.exception.BadRequestException;
import doctor.backend.exception.ForbiddenException;
import doctor.backend.repository.DoctorProfileRepository;
import doctor.backend.repository.UserRepository;
import doctor.backend.security.CustomUserDetailsService;
import doctor.backend.security.JwtService;
import doctor.backend.util.OtpUtil;
import doctor.backend.dto.auth.VerifyLoginOtpRequest;
import doctor.backend.dto.auth.ResendLoginOtpRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final AdminApprovalClient adminApprovalClient;
    private final PasswordResetMailer passwordResetMailer;
    private final ZippyCrmSyncService zippyCrmSyncService;
    private final MessagingProviderService messagingProviderService;

    public AuthService(
            UserRepository userRepository,
            DoctorProfileRepository doctorProfileRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            CustomUserDetailsService userDetailsService,
            AdminApprovalClient adminApprovalClient,
            PasswordResetMailer passwordResetMailer,
            ZippyCrmSyncService zippyCrmSyncService,
            MessagingProviderService messagingProviderService) {
        this.userRepository = userRepository;
        this.doctorProfileRepository = doctorProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.adminApprovalClient = adminApprovalClient;
        this.passwordResetMailer = passwordResetMailer;
        this.zippyCrmSyncService = zippyCrmSyncService;
        this.messagingProviderService = messagingProviderService;
    }

    // =====================================================
    // REGISTER (Doctor create account)
    // =====================================================

    public AuthResponse register(RegisterRequest request) {

        String email = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("An account with this email already exists");
        }

        String phone = (request.getPhone() == null || request.getPhone().isBlank())
                ? null
                : request.getPhone().trim();

        if (phone != null && userRepository.existsByPhone(phone)) {
            throw new BadRequestException("An account with this phone number already exists");
        }

        User user = new User();
        user.setFullName(request.getFullName().trim());
        user.setEmail(email);
        user.setPhone(phone);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("DOCTOR");
        user.setActive(true);
        user.setProfileImage(request.getProfileImage());
        user.setClinicInsideImage(request.getClinicInsideImage());
        user.setClinicOutsideImage(request.getClinicOutsideImage());
        user.setDigitalSignatureImage(request.getDigitalSignatureImage());
        user.setPhoneVerified(request.isPhoneVerified());

        // Doctor registrations start PENDING. An admin must approve the
        // registration (via the Zenve admin portal) before the doctor
        // can log in.
        user.setApprovalStatus("PENDING");

        User saved = userRepository.save(user);

        // Also initialize and persist the DoctorProfile entity with uploaded images
        DoctorProfile profile = doctorProfileRepository.findByUserId(saved.getId())
                .orElseGet(DoctorProfile::new);
        profile.setUserId(saved.getId());
        profile.setFullName(saved.getFullName());
        profile.setEmail(saved.getEmail());
        profile.setPhone(saved.getPhone());
        profile.setClinicHospital(request.getClinicHospital());
        profile.setProfileImage(request.getProfileImage());
        profile.setClinicInsideImage(request.getClinicInsideImage());
        profile.setClinicOutsideImage(request.getClinicOutsideImage());
        profile.setDigitalSignatureImage(request.getDigitalSignatureImage());
        doctorProfileRepository.save(profile);

        // Let the admin backend know a new doctor is waiting for approval.
        // The account cannot log in until an admin approves it there.
        adminApprovalClient.notifyDoctorRegistered(saved);

        // Sync pending doctor to Zippy CRM
        zippyCrmSyncService.syncDoctor(saved, profile);

        // No token on purpose: registering does not log the doctor in.
        AuthResponse res = new AuthResponse(
                saved.getId(),
                saved.getFullName(),
                saved.getEmail(),
                saved.getPhone(),
                saved.getRole(),
                null,
                saved.getApprovalStatus(),
                "Your account has been created and is pending admin approval. " +
                        "You'll be able to log in once an admin approves your registration.");
        res.setProfileImage(saved.getProfileImage());
        res.setClinicInsideImage(saved.getClinicInsideImage());
        res.setClinicOutsideImage(saved.getClinicOutsideImage());
        res.setDigitalSignatureImage(saved.getDigitalSignatureImage());
        return res;
    }

    // =====================================================
    // ADMIN-CREATED ACCOUNT
    // Called by the Zenve admin backend when an admin creates a doctor
    // account directly. The account is APPROVED immediately (no pending
    // approval step) since an admin is vouching for it.
    // =====================================================

    public void createApprovedAccount(String fullName, String email, String phone, String rawPassword) {

        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("An account with this email already exists");
        }

        String normalizedPhone = (phone == null || phone.isBlank()) ? null : phone.trim();

        if (normalizedPhone != null && userRepository.existsByPhone(normalizedPhone)) {
            throw new BadRequestException("An account with this phone number already exists");
        }

        User user = new User();
        user.setFullName(fullName.trim());
        user.setEmail(normalizedEmail);
        user.setPhone(normalizedPhone);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole("DOCTOR");
        user.setActive(true);
        user.setApprovalStatus("APPROVED");

        User saved = userRepository.save(user);

        DoctorProfile profile = doctorProfileRepository.findByUserId(saved.getId())
                .orElseGet(DoctorProfile::new);
        profile.setUserId(saved.getId());
        profile.setFullName(saved.getFullName());
        profile.setEmail(saved.getEmail());
        profile.setPhone(saved.getPhone());
        doctorProfileRepository.save(profile);

        zippyCrmSyncService.syncDoctor(saved, profile);
    }

    // =====================================================
    // EXECUTIVE-CREATED ACCOUNT
    // Called when an executive adds a doctor from Zippy CRM.
    // The account is created with PENDING status until approved by admin.
    // =====================================================

    public void createPendingExecutiveAccount(doctor.backend.dto.auth.ExecutiveDoctorAddRequest request) {
        String email = request.getEmail();
        if (email == null || email.isBlank()) {
            email = "doc_" + java.util.UUID.randomUUID().toString().substring(0, 8) + "@zenve.internal";
        }
        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("An account with this email already exists");
        }

        String phone = (request.getPhone() == null || request.getPhone().isBlank()) ? null : request.getPhone().trim();
        if (phone != null && userRepository.existsByPhone(phone)) {
            throw new BadRequestException("An account with this phone number already exists");
        }

        User user = new User();
        user.setFullName(request.getFullName() != null ? request.getFullName().trim() : "Dr. Unknown");
        user.setEmail(normalizedEmail);
        user.setPhone(phone);

        String rawPassword = (request.getPassword() != null && !request.getPassword().isBlank())
                ? request.getPassword()
                : java.util.UUID.randomUUID().toString();
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole("DOCTOR");
        user.setActive(true);
        user.setApprovalStatus("PENDING");

        if (request.getProfileImage() != null && !request.getProfileImage().isBlank()) {
            user.setProfileImage(request.getProfileImage());
        }
        if (request.getClinicInsideImage() != null && !request.getClinicInsideImage().isBlank()) {
            user.setClinicInsideImage(request.getClinicInsideImage());
        }
        if (request.getClinicOutsideImage() != null && !request.getClinicOutsideImage().isBlank()) {
            user.setClinicOutsideImage(request.getClinicOutsideImage());
        }
        String sig = request.getDigitalSignatureImage() != null && !request.getDigitalSignatureImage().isBlank()
                ? request.getDigitalSignatureImage() : request.getSignatureImage();
        if (sig != null && !sig.isBlank()) {
            user.setDigitalSignatureImage(sig);
        }

        User saved = userRepository.save(user);

        DoctorProfile profile = new DoctorProfile();
        profile.setUserId(saved.getId());
        profile.setFullName(saved.getFullName());
        profile.setPhone(saved.getPhone());
        profile.setEmail(saved.getEmail());
        if (request.getQualification() != null) profile.setQualification(request.getQualification());
        if (request.getSpecializations() != null) profile.setSpeciality(request.getSpecializations());
        if (request.getExperienceYears() != null) profile.setExperience(request.getExperienceYears());
        if (request.getConsultationFee() != null) profile.setConsultationFee(request.getConsultationFee());
        if (request.getPincode() != null) profile.setPincode(request.getPincode());
        if (request.getCity() != null) profile.setCity(request.getCity());

        if (user.getProfileImage() != null) profile.setProfileImage(user.getProfileImage());
        if (user.getClinicInsideImage() != null) profile.setClinicInsideImage(user.getClinicInsideImage());
        if (user.getClinicOutsideImage() != null) profile.setClinicOutsideImage(user.getClinicOutsideImage());
        if (user.getDigitalSignatureImage() != null) profile.setDigitalSignatureImage(user.getDigitalSignatureImage());

        DoctorProfile savedProfile = doctorProfileRepository.save(profile);

        adminApprovalClient.notifyDoctorRegistered(saved);
        zippyCrmSyncService.syncDoctor(saved, savedProfile);
    }

    public void deleteAccount(String email) {
        if (email == null || email.isBlank()) return;
        userRepository.findByEmail(email.trim().toLowerCase()).ifPresent(user -> {
            doctorProfileRepository.findByUserId(user.getId()).ifPresent(doctorProfileRepository::delete);
            userRepository.delete(user);
        });
    }

    // =====================================================
    // UPDATE APPROVAL STATUS (Admin Action)
    // =====================================================

    public void updateApprovalStatus(String email, String status, String reason) {
        String normalized = email.trim().toLowerCase();
        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new BadRequestException("No account found for email: " + email));

        user.setApprovalStatus(status);
        user.setRejectionReason(reason);
        userRepository.save(user);

        DoctorProfile profile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
        zippyCrmSyncService.importDoctorImagesFromZippy(user, profile);
    }

    // =====================================================
    // LOGIN (Step 1: Validate credentials & dispatch Phone OTP)
    // =====================================================

    public AuthResponse login(LoginRequest request) {

        String email = request.getEmail().trim().toLowerCase();

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword()));
        } catch (BadCredentialsException ex) {
            throw new BadCredentialsException("Invalid email or password");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!user.isActive()) {
            throw new ForbiddenException("Your account is deactivated. Please contact support.");
        }

        String approval = user.getApprovalStatus();
        if ("PENDING".equalsIgnoreCase(approval)) {
            throw new ForbiddenException(
                    "Your registration is pending admin approval. " +
                            "You'll receive access once an administrator reviews your account.");
        }
        if ("REJECTED".equalsIgnoreCase(approval)) {
            String reason = user.getRejectionReason();
            String message = (reason != null && !reason.isBlank())
                    ? "Your registration was not approved: " + reason
                    : "Your registration was not approved by the administrator. Please contact support.";
            throw new ForbiddenException(message);
        }

        String phone = user.getPhone();
        if (phone != null && !phone.isBlank()) {
            // Generate 6-digit login OTP and challenge session token
            String otp = OtpUtil.generateOtp();
            String sessionToken = UUID.randomUUID().toString();

            user.setLoginOtp(otp);
            user.setLoginOtpExpiry(LocalDateTime.now().plusMinutes(10));
            user.setLoginSessionToken(sessionToken);
            user.setLoginSessionExpiry(LocalDateTime.now().plusMinutes(10));
            userRepository.save(user);

            String normalizedPhone = phone.replaceAll("[^0-9]", "");
            String devOtp = null;
            if (messagingProviderService.isSmsConfigured()) {
                try {
                    messagingProviderService.sendOtp(normalizedPhone, otp);
                    log.info("Sent 2FA login OTP to registered phone {}", normalizedPhone);
                } catch (Exception ex) {
                    log.warn("Failed to send 2FA login SMS: {}. Falling back to dev OTP.", ex.getMessage());
                    devOtp = otp;
                }
            } else {
                devOtp = otp;
            }

            AuthResponse challengeRes = new AuthResponse();
            challengeRes.setRequires2Fa(true);
            challengeRes.setLoginSessionToken(sessionToken);
            challengeRes.setEmail(user.getEmail());
            challengeRes.setMaskedPhone(maskPhoneNumber(phone));
            challengeRes.setMessage("OTP has been sent to your registered mobile number (" + maskPhoneNumber(phone) + ").");
            challengeRes.setDevOtp(devOtp);
            return challengeRes;
        }

        // If user has no phone number, log in directly
        return issueSuccessAuthResponse(user);
    }

    // =====================================================
    // LOGIN STEP 2: VERIFY 2FA PHONE OTP & ISSUE JWT
    // =====================================================

    public AuthResponse verifyLoginOtp(VerifyLoginOtpRequest request) {
        String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        String sessionToken = request.getLoginSessionToken() != null ? request.getLoginSessionToken().trim() : "";
        String otp = request.getOtp() != null ? request.getOtp().trim() : "";

        User user;
        if (!email.isBlank()) {
            user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadRequestException("User account not found"));
        } else if (!sessionToken.isBlank()) {
            user = userRepository.findByLoginSessionToken(sessionToken)
                    .orElseThrow(() -> new BadRequestException("Invalid or expired login session. Please sign in again."));
        } else {
            throw new BadRequestException("Invalid request");
        }

        if (user.getLoginSessionToken() == null
                || !user.getLoginSessionToken().equals(sessionToken)
                || user.getLoginSessionExpiry() == null
                || user.getLoginSessionExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Login session has expired. Please sign in again.");
        }

        if (user.getLoginOtp() == null
                || !user.getLoginOtp().equals(otp)
                || user.getLoginOtpExpiry() == null
                || user.getLoginOtpExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Invalid or expired OTP. Please check the code and try again.");
        }

        // Clear login challenge
        user.setLoginOtp(null);
        user.setLoginOtpExpiry(null);
        user.setLoginSessionToken(null);
        user.setLoginSessionExpiry(null);
        userRepository.save(user);

        return issueSuccessAuthResponse(user);
    }

    // =====================================================
    // RESEND 2FA LOGIN OTP
    // =====================================================

    public AuthResponse resendLoginOtp(ResendLoginOtpRequest request) {
        String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        String sessionToken = request.getLoginSessionToken() != null ? request.getLoginSessionToken().trim() : "";

        User user;
        if (!email.isBlank()) {
            user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadRequestException("User account not found"));
        } else if (!sessionToken.isBlank()) {
            user = userRepository.findByLoginSessionToken(sessionToken)
                    .orElseThrow(() -> new BadRequestException("Invalid or expired login session. Please sign in again."));
        } else {
            throw new BadRequestException("Invalid request");
        }

        if (user.getLoginSessionToken() == null
                || !user.getLoginSessionToken().equals(sessionToken)
                || user.getLoginSessionExpiry() == null
                || user.getLoginSessionExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Login session has expired. Please sign in again.");
        }

        String phone = user.getPhone();
        if (phone == null || phone.isBlank()) {
            throw new BadRequestException("No registered phone number found for this account.");
        }

        String otp = OtpUtil.generateOtp();
        user.setLoginOtp(otp);
        user.setLoginOtpExpiry(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        String normalizedPhone = phone.replaceAll("[^0-9]", "");
        String devOtp = null;
        if (messagingProviderService.isSmsConfigured()) {
            try {
                messagingProviderService.sendOtp(normalizedPhone, otp);
                log.info("Resent 2FA login OTP to registered phone {}", normalizedPhone);
            } catch (Exception ex) {
                log.warn("Failed to resend SMS: {}. Falling back to dev OTP.", ex.getMessage());
                devOtp = otp;
            }
        } else {
            devOtp = otp;
        }

        AuthResponse res = new AuthResponse();
        res.setRequires2Fa(true);
        res.setLoginSessionToken(sessionToken);
        res.setEmail(user.getEmail());
        res.setMaskedPhone(maskPhoneNumber(phone));
        res.setMessage("A new OTP has been sent to your registered mobile number (" + maskPhoneNumber(phone) + ").");
        res.setDevOtp(devOtp);
        return res;
    }

    private AuthResponse issueSuccessAuthResponse(User user) {
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", user.getRole());
        extraClaims.put("userId", user.getId());
        extraClaims.put("fullName", user.getFullName());

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtService.generateToken(extraClaims, userDetails);

        if (user.getProfileImage() == null || user.getClinicInsideImage() == null || user.getClinicOutsideImage() == null || user.getDigitalSignatureImage() == null) {
            DoctorProfile profile = doctorProfileRepository.findByUserId(user.getId()).orElse(null);
            zippyCrmSyncService.importDoctorImagesFromZippy(user, profile);
            user = userRepository.findById(user.getId()).orElse(user);
        }

        AuthResponse res = new AuthResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                token,
                user.getApprovalStatus(),
                null);
        res.setProfileImage(user.getProfileImage());
        res.setClinicInsideImage(user.getClinicInsideImage());
        res.setClinicOutsideImage(user.getClinicOutsideImage());
        res.setDigitalSignatureImage(user.getDigitalSignatureImage());
        return res;
    }

    private String maskPhoneNumber(String phone) {
        if (phone == null || phone.isBlank()) return "";
        String clean = phone.replaceAll("[^0-9]", "");
        if (clean.length() <= 4) return clean;
        int visibleDigits = 4;
        String lastFour = clean.substring(clean.length() - visibleDigits);
        return "+91 ******" + lastFour;
    }

    // =====================================================
    // FORGOT PASSWORD
    // =====================================================

    public ForgotPasswordResponse forgotPassword(String email) {
        String normalized = email.trim().toLowerCase();

        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new BadRequestException("No account found with this email address"));

        String otp = OtpUtil.generateOtp();
        String sessionToken = UUID.randomUUID().toString();

        user.setOtp(otp);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(10));
        user.setOtpVerified(false);
        user.setResetToken(sessionToken);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        passwordResetMailer.sendOtp(user.getEmail(), otp);

        return new ForgotPasswordResponse("An OTP has been sent to your email address.", sessionToken);
    }

    public VerifyOtpResponse verifyOtp(String email, String otp, String resetToken) {
        String normalized = email.trim().toLowerCase();

        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new BadRequestException("Invalid request"));

        if (user.getResetToken() == null
                || !user.getResetToken().equals(resetToken)
                || user.getResetTokenExpiry() == null
                || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("This reset session has expired. Please request a new OTP");
        }

        if (user.getOtp() == null
                || !user.getOtp().equals(otp)
                || user.getOtpExpiry() == null
                || user.getOtpExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Invalid or expired OTP");
        }

        String verifiedToken = UUID.randomUUID().toString();

        user.setOtp(null);
        user.setOtpExpiry(null);
        user.setOtpVerified(true);
        user.setResetToken(verifiedToken);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(15));
        userRepository.save(user);

        return new VerifyOtpResponse(true, "OTP verified successfully.", verifiedToken);
    }

    public MessageResponse resetPassword(String email, String resetToken, String newPassword) {
        String normalized = email.trim().toLowerCase();

        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new BadRequestException("Invalid request"));

        if (!user.isOtpVerified()
                || user.getResetToken() == null
                || !user.getResetToken().equals(resetToken)
                || user.getResetTokenExpiry() == null
                || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("This reset session has expired. Please start the reset process again");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setOtp(null);
        user.setOtpExpiry(null);
        user.setOtpVerified(false);
        userRepository.save(user);

        return new MessageResponse("Password has been reset successfully. You can now log in with your new password.");
    }

    // =====================================================
    // CURRENT USER (from token)
    // =====================================================

    public AuthResponse getCurrentUser(String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Account not found"));

        AuthResponse res = new AuthResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                null);
        res.setProfileImage(user.getProfileImage());
        res.setClinicInsideImage(user.getClinicInsideImage());
        res.setClinicOutsideImage(user.getClinicOutsideImage());
        res.setDigitalSignatureImage(user.getDigitalSignatureImage());
        return res;
    }
}
