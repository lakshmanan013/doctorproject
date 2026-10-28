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
        final LocalDateTime lastSentAt;
        int attempts;
        boolean verified;
        LocalDateTime verifiedAt;

        OtpEntry(String otp, LocalDateTime expiry) {
            this.otp = otp;
            this.expiry = expiry;
            this.lastSentAt = LocalDateTime.now();
            this.attempts = 0;
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

        OtpEntry existing = otpStore.get(normalizedPhone);
        if (existing != null && existing.lastSentAt != null &&
                existing.lastSentAt.plusSeconds(30).isAfter(LocalDateTime.now())) {
            long remaining = java.time.Duration.between(LocalDateTime.now(), existing.lastSentAt.plusSeconds(30)).getSeconds();
            throw new BadRequestException("Please wait " + (remaining > 0 ? remaining : 1) + " seconds before requesting another OTP.");
        }

        String otp = OtpUtil.generateOtp(4);
        LocalDateTime expiry = LocalDateTime.now().plusMinutes(10);
        otpStore.put(normalizedPhone, new OtpEntry(otp, expiry));

        log.info("Generated 4-digit registration phone OTP for {}", maskPhone(normalizedPhone));

        try {
            messagingProviderService.sendOtp(normalizedPhone, otp);
            log.info("Sent phone verification OTP to {}", maskPhone(normalizedPhone));
        } catch (Exception ex) {
            log.error("Failed to send SMS OTP via provider: {}", ex.getMessage());
            throw new BadRequestException("Failed to send OTP SMS to your mobile number: " + ex.getMessage());
        }

        return new SendPhoneOtpResponse(true, "OTP sent successfully to your phone number.", rawPhone.trim(), null);
    }

    public VerifyPhoneOtpResponse verifyPhoneOtp(String rawPhone, String enteredOtp) {
        String normalizedPhone = normalizePhone(rawPhone);

        OtpEntry entry = otpStore.get(normalizedPhone);
        if (entry == null || entry.expiry.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("OTP has expired or was not requested. Please request a new OTP.");
        }

        if (entry.attempts >= 5) {
            otpStore.remove(normalizedPhone);
            throw new BadRequestException("Too many incorrect attempts. This OTP has been invalidated for security. Please request a new code.");
        }

        boolean matchesOtp = entry.otp != null && entry.otp.equals(enteredOtp != null ? enteredOtp.trim() : "");

        if (enteredOtp == null || !matchesOtp) {
            entry.attempts++;
            if (entry.attempts >= 5) {
                otpStore.remove(normalizedPhone);
                throw new BadRequestException("Too many incorrect attempts. This OTP has been invalidated for security. Please request a new code.");
            }
            int remaining = 5 - entry.attempts;
            throw new BadRequestException("Invalid OTP code. " + remaining + " attempt" + (remaining > 1 ? "s" : "") + " remaining.");
        }

        entry.verified = true;
        entry.verifiedAt = LocalDateTime.now();

        log.info("Phone number {} verified successfully via OTP.", maskPhone(normalizedPhone));

        return new VerifyPhoneOtpResponse(true, "Phone number verified successfully.", rawPhone.trim());
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) return "****";
        return phone.substring(0, Math.min(3, phone.length())) + "****" + phone.substring(phone.length() - 2);
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
