package doctor.backend.util;

import java.security.SecureRandom;

/**
 * Generates the 4-digit numeric codes used by the OTP-based
 * forgot-password flow (see AuthService).
 */
public class OtpUtil {

    private static final SecureRandom RANDOM = new SecureRandom();

    private OtpUtil() {
    }

    /** Returns a zero-padded 4-digit code, e.g. "4545". */
    public static String generateOtp() {
        return generateOtp(4);
    }

    /**
     * Returns a zero-padded numeric code of specified length using SecureRandom.
     */
    public static String generateOtp(int length) {
        if (length <= 0)
            length = 4;
        int max = (int) Math.pow(10, length);
        int code = RANDOM.nextInt(max);
        return String.format("%0" + length + "d", code);
    }
}
