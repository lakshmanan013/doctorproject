package doctor.backend.service;

import doctor.backend.dto.auth.SendPhoneOtpResponse;
import doctor.backend.dto.auth.VerifyPhoneOtpResponse;
import doctor.backend.exception.BadRequestException;
import doctor.backend.repository.UserRepository;
import doctor.backend.util.OtpUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PhoneOtpService {

    private static final Logger log = LoggerFactory.getLogger(PhoneOtpService.class);

    private final UserRepository userRepository;
    private final MessagingProviderService messagingProviderService;

    private static class OtpEntry {
        final String otp;
        final LocalDateTime expiry;
        boolean verified;
        LocalDateTime verifiedAt;

        OtpEntry(String otp, LocalDateTime expiry) {
            this.otp = otp;
            this.expiry = expiry;
            this.verified = false;
        }
    }

    // Key is normalized phone (e.g. digits only)
    private final ConcurrentHashMap<String, OtpEntry> otpStore = new ConcurrentHashMap<>();

    public PhoneOtpService(UserRepository userRepository, MessagingProviderService messagingProviderService) {
        this.userRepository = userRepository;
        this.messagingProviderService = messagingProviderService;
    }

    public SendPhoneOtpResponse sendPhoneOtp(String rawPhone) {
        String normalizedPhone = normalizePhone(rawPhone);

        if (normalizedPhone.length() < 7 || normalizedPhone.length() > 15) {
            throw new BadRequestException("Please enter a valid phone number (7 to 15 digits).");
        }

        if (userRepository.existsByPhone(rawPhone.trim()) || userRepository.existsByPhone(normalizedPhone)) {
            throw new BadRequestException("An account with this phone number already exists.");
        }

        String otp = OtpUtil.generateOtp();
        LocalDateTime expiry = LocalDateTime.now().plusMinutes(10);
        otpStore.put(normalizedPhone, new OtpEntry(otp, expiry));

        log.info("Generated registration phone OTP for {}: {}", normalizedPhone, otp);

        String devOtp = null;
        if (messagingProviderService.isSmsConfigured()) {
            try {
                messagingProviderService.sendOtp(normalizedPhone, otp);
                log.info("Sent phone verification OTP to {}", normalizedPhone);
            } catch (Exception ex) {
                log.warn("Failed to send SMS via configured provider: {}. Falling back to dev OTP in response.", ex.getMessage());
                devOtp = otp;
            }
        } else {
            // Development mode or provider not configured
            devOtp = otp;
        }

        String displayMsg = devOtp != null
                ? "OTP generated successfully. (OTP: " + devOtp + ")"
                : "OTP sent successfully to your phone number.";

        return new SendPhoneOtpResponse(true, displayMsg, rawPhone.trim(), devOtp);
    }

    public VerifyPhoneOtpResponse verifyPhoneOtp(String rawPhone, String enteredOtp) {
        String normalizedPhone = normalizePhone(rawPhone);

        OtpEntry entry = otpStore.get(normalizedPhone);
        if (entry == null || entry.expiry.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("OTP has expired or was not requested. Please request a new OTP.");
        }

        if (enteredOtp == null || !entry.otp.equals(enteredOtp.trim())) {
            throw new BadRequestException("Invalid OTP. Please check the 6-digit code and try again.");
        }

        entry.verified = true;
        entry.verifiedAt = LocalDateTime.now();

        log.info("Phone number {} verified successfully via OTP.", normalizedPhone);

        return new VerifyPhoneOtpResponse(true, "Phone number verified successfully.", rawPhone.trim());
    }

    public boolean isPhoneVerified(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) return false;
        String normalized = normalizePhone(rawPhone);
        OtpEntry entry = otpStore.get(normalized);
        if (entry == null || !entry.verified) return false;

        // Valid for 30 minutes after verification for completing registration
        return entry.verifiedAt != null && entry.verifiedAt.plusMinutes(30).isAfter(LocalDateTime.now());
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        return phone.replaceAll("[^0-9]", "");
    }
}
