package doctor.backend.service;

import doctor.backend.config.FrontendProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sends the password-reset link and OTP by email with rich HTML styling.
 */
@Service
public class PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

    private final EmailService emailService;
    private final FrontendProperties frontendProperties;

    public PasswordResetMailer(EmailService emailService,
                                FrontendProperties frontendProperties) {
        this.emailService = emailService;
        this.frontendProperties = frontendProperties;
    }

    public void sendResetLink(String toEmail, String token) {
        String link = frontendProperties.getBaseUrl() + "/reset-password?token=" + token;
        String subject = "Reset your Zenve VetCare password";
        String plainText =
                "We received a request to reset your password.\n\n" +
                "Reset it here (expires in 30 minutes): " + link + "\n\n" +
                "If you didn't request this, you can ignore this email.";

        String htmlBody = """
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Reset Password</title></head>
            <body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;">
              <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
                <div style="background-color:#FFFFFF;padding:18px 24px;text-align:center;border-bottom:1px solid #E2E8F0;">
                  <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration:none;">
                    <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height:48px;max-width:170px;height:auto;object-fit:contain;vertical-align:middle;border:0;" />
                  </a>
                </div>
                <div style="background:linear-gradient(135deg,#003822 0%,#0D9488 60%,#059669 100%);padding:28px 24px;text-align:center;color:#FFF;">
                  <h2 style="margin:0;font-size:22px;font-weight:800;">ZENVE VET</h2>
                  <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">The Professional Network for Animal Healthcare</p>
                </div>
                <div style="padding:28px 24px;line-height:1.6;">
                  <h3 style="margin:0 0 12px;font-size:18px;color:#0F172A;">Password Reset Request</h3>
                  <p style="font-size:14px;color:#475569;">We received a request to reset the password for your Zenve Vet account. Click the button below to set a new password:</p>
                  <div style="text-align:center;margin:24px 0;">
                    <a href="%s" style="display:inline-block;background:#0D9488;color:#FFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">Reset Password →</a>
                  </div>
                  <p style="font-size:12px;color:#64748B;">This link expires in 30 minutes. If you did not request this, please ignore this email.</p>
                </div>
                <div style="background:#0F172A;padding:18px;text-align:center;color:#94A3B8;font-size:11px;">
                  Sent automatically by no-reply@zenvevet.com • Zenve Pets Healthcare Pvt. Ltd.
                </div>
              </div>
            </body>
            </html>
            """.formatted(link);

        try {
            emailService.sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "PASSWORD_RESET_LINK");
        } catch (Exception ex) {
            log.warn("Could not email password reset link to {}: {}. Reset link: {}",
                    toEmail, ex.getMessage(), link);
        }
    }

    // =====================================================
    // OTP-based forgot-password flow (see AuthService).
    // =====================================================

    public void sendOtp(String toEmail, String otp) {
        sendOtp(toEmail, null, otp);
    }

    public void sendOtp(String toEmail, String recipientName, String otp) {
        try {
            emailService.sendPasswordResetOtpEmail(toEmail, recipientName, otp, 10);
        } catch (Exception ex) {
            log.warn("Could not email password reset OTP to {}: {}. OTP: {}",
                    toEmail, ex.getMessage(), otp);
        }
    }
}
