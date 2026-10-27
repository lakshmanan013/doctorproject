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
        String subject = "Zenve Doctors: Reset Your Password";
        String plainText =
                "Hello,\n\n" +
                "We received a request to reset the password for your Zenve Doctors account.\n\n" +
                "Reset your password here (expires in 30 minutes):\n" + link + "\n\n" +
                "If you did not request a password reset, you can safely ignore this email.\n\n" +
                "Best regards,\nZenve Doctors Security Team\nhttps://doctor.zenvevet.com";

        String portalUrl = "https://doctor.zenvevet.com";
        String senderEmail = "no-replyzenvedoctors@zenvevet.com";

        String htmlBody = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Zenve Doctors Password</title>
              <style>
                body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
                .header { background: linear-gradient(135deg, #00875A 0%%, #059669 50%%, #0D9488 100%%); padding: 38px 24px 34px 24px; text-align: center; color: #FFFFFF; }
                .logo-badge { background-color: #FFFFFF; border-radius: 12px; display: inline-block; padding: 10px 22px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.5); }
                .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 5px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
                .brand-title { margin: 12px 0 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; }
                .brand-subtitle { margin: 8px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 400; color: #E6FFFA; }
                .content { padding: 34px 28px; line-height: 1.65; color: #334155; }
                .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; line-height: 1.6; }
                .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                .details-table tr:last-child td { border-bottom: none; }
                .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                .status-tag { display: inline-block; background: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; letter-spacing: 0.02em; border: 1px solid #FDE68A; }
                .alert-box { background-color: #FEF3C7; border: 1px solid #FDE68A; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 24px 0 16px 0; font-size: 13px; color: #92400E; line-height: 1.55; }
                .help-box { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; text-align: center; font-size: 13px; color: #475569; margin: 24px 0; }
                .footer { background-color: #0B132B; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; border-top: 1px solid #1E293B; }
                .footer a { color: #2DD4BF; text-decoration: none; font-weight: 500; }
              </style>
            </head>
            <body>
              <div style="background-color: #F8FAFC; padding: 32px 16px;">
                <div class="wrapper">
                  <div class="header">
                    <div class="logo-badge">
                      <a href="%s" target="_blank" style="text-decoration: none; display: block;">
                        <img src="cid:zenveLogo" alt="Zenve Doctors" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                      </a>
                    </div>
                    <div>
                      <span class="brand-badge">SECURITY VERIFICATION</span>
                    </div>
                    <h1 class="brand-title">Reset Your Password</h1>
                    <p class="brand-subtitle">Zenve Doctors &nbsp;|&nbsp; Practice Management &amp; Clinical Platform</p>
                  </div>
                  <div class="content">
                    <div class="greeting">Password Reset Request</div>
                    <p class="intro">
                      We received a request to reset the password associated with your <strong>Zenve Doctors</strong> account. Click the button below to securely set your new password:
                    </p>

                    <div style="text-align: center; margin: 30px 0 26px 0;">
                      <a href="%s" style="display: inline-block; background: linear-gradient(135deg, #00875A 0%%, #0D9488 100%%); color: #FFFFFF !important; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.02em; box-shadow: 0 4px 14px rgba(0, 135, 90, 0.35); text-align: center;">Reset Your Password &rarr;</a>
                    </div>

                    <table class="details-table">
                      <tr>
                        <td class="label">Target Account:</td>
                        <td class="value"><strong>%s</strong></td>
                      </tr>
                      <tr>
                        <td class="label">Link Validity:</td>
                        <td class="value"><span class="status-tag">30 MINUTES (ONE-TIME USE)</span></td>
                      </tr>
                      <tr>
                        <td class="label">Authorized Portal:</td>
                        <td class="value"><a href="%s" target="_blank" style="color: #0D9488; text-decoration: none; font-weight: 600;">%s</a></td>
                      </tr>
                      <tr>
                        <td class="label">Official Sender:</td>
                        <td class="value" style="font-family: monospace; color: #334155;">%s</td>
                      </tr>
                    </table>

                    <div class="alert-box">
                      &#9888;&#65039; <strong>Security Notice:</strong> For your protection, this secure link will expire in <strong>30 minutes</strong>. If you did not initiate this request, your account remains secure and you can safely ignore this email.
                    </div>

                    <div class="help-box">
                      Button not working? Copy and paste this URL into your browser:<br/>
                      <a href="%s" style="color: #0D9488; word-break: break-all; font-size: 12px; text-decoration: underline;">%s</a><br/><br/>
                      Need assistance? Contact Zenve Support: <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: none; font-weight: 600;">support@zenvevet.com</a>
                    </div>
                  </div>
                  <div class="footer">
                    <div style="margin-bottom: 8px; text-align: center;">
                      <span style="display: inline-block; background-color: #FFFFFF; border-radius: 4px; padding: 2px 6px; margin-right: 8px; vertical-align: middle; line-height: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                        <img src="cid:zenveLogo" alt="Zenve Logo" style="height: 16px; width: auto; max-width: 48px; object-fit: contain; vertical-align: middle; border: 0;" />
                      </span>
                      <span style="font-weight: 700; color: #FFFFFF; font-size: 13.5px; vertical-align: middle; display: inline-block; letter-spacing: 0.01em;">
                        Zenve Healthcare Pvt. Ltd.
                      </span>
                    </div>
                    <div style="margin-bottom: 12px; font-size: 12px; color: #94A3B8;">
                      Bengaluru, Karnataka, India &nbsp;|&nbsp; <a href="%s" style="color: #2DD4BF; text-decoration: none;">https://doctor.zenvevet.com</a>
                    </div>
                    <div style="font-size: 11px; color: #64748B; line-height: 1.5;">
                      This automated security dispatch was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
                      Please do not reply directly to this email address.
                    </div>
                    <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: transparent; mso-hide: all; opacity: 0;">
                      [ref: %s]
                    </div>
                  </div>
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                portalUrl,
                link,
                toEmail,
                portalUrl,
                portalUrl,
                senderEmail,
                link,
                link,
                portalUrl,
                toEmail,
                senderEmail,
                java.util.UUID.randomUUID().toString().substring(0, 8));

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
