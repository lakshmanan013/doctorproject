package doctor.backend.service;

import doctor.backend.config.MailProperties;
import doctor.backend.dto.email.EmailRequest;
import doctor.backend.dto.email.EmailResponse;
import doctor.backend.entity.EmailLog;
import doctor.backend.entity.PrescriptionItem;
import doctor.backend.repository.EmailLogRepository;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Transactional
public class EmailService {

        private static final Logger log = LoggerFactory.getLogger(EmailService.class);

        private final EmailLogRepository emailLogRepository;
        private final JavaMailSender mailSender;
        private final MailProperties mailProperties;

        public EmailService(EmailLogRepository emailLogRepository, JavaMailSender mailSender,
                        MailProperties mailProperties) {
                this.emailLogRepository = emailLogRepository;
                this.mailSender = mailSender;
                this.mailProperties = mailProperties;
        }

        private InternetAddress resolveFromAddress() {
                String fromEmail = (mailProperties.getFrom() != null && !mailProperties.getFrom().isBlank())
                                ? mailProperties.getFrom().trim()
                                : "vetdoctors@zenvevet.com";
                String senderName = (mailProperties.getSenderName() != null
                                && !mailProperties.getSenderName().isBlank())
                                                ? mailProperties.getSenderName().trim()
                                                : "Doctor Zenve Vet";

                if (!fromEmail.contains("@")) {
                        senderName = fromEmail;
                        fromEmail = "vetdoctors@zenvevet.com";
                }

                try {
                        return new InternetAddress(fromEmail, senderName);
		} catch (Exception ex) {
			try {
				return new InternetAddress(fromEmail);
			} catch (Exception e) {
				return new InternetAddress();
			}
		}
	}

	private byte[] cachedLogoBytes = null;

	private synchronized byte[] getLogoBytes() {
		if (cachedLogoBytes != null && cachedLogoBytes.length > 0) {
			return cachedLogoBytes;
		}

		String[] resourcePaths = {
				"/static/zenve-email-logo.png",
				"static/zenve-email-logo.png",
				"/zenve-email-logo.png",
				"zenve-email-logo.png",
				"/static/zenve.png",
				"static/zenve.png"
		};

		for (String path : resourcePaths) {
			try (var is = getClass().getResourceAsStream(path.startsWith("/") ? path : "/" + path)) {
				if (is != null) {
					cachedLogoBytes = is.readAllBytes();
					log.info("[Zenve Mail] Loaded logo resource from: {}", path);
					return cachedLogoBytes;
				}
			} catch (Exception ignored) {
			}

			try (var is = Thread.currentThread().getContextClassLoader()
					.getResourceAsStream(path.startsWith("/") ? path.substring(1) : path)) {
				if (is != null) {
					cachedLogoBytes = is.readAllBytes();
					log.info("[Zenve Mail] Loaded logo resource via context ClassLoader from: {}", path);
					return cachedLogoBytes;
				}
			} catch (Exception ignored) {
			}
		}

		String[] filePaths = {
				"src/main/resources/static/zenve-email-logo.png",
				"doctor_backend/src/main/resources/static/zenve-email-logo.png",
				"d:/New folder/new docotor/doctor_backend/src/main/resources/static/zenve-email-logo.png"
		};
		for (String fp : filePaths) {
			try {
				java.nio.file.Path p = java.nio.file.Paths.get(fp);
				if (java.nio.file.Files.exists(p)) {
					cachedLogoBytes = java.nio.file.Files.readAllBytes(p);
					log.info("[Zenve Mail] Loaded logo resource from filesystem: {}", fp);
					return cachedLogoBytes;
				}
			} catch (Exception ignored) {
			}
		}

		log.warn("[Zenve Mail] Could not locate zenve-email-logo.png asset");
		return null;
	}

	// =====================================================
	// CORE DISPATCH: SEND HTML EMAIL WITH OPTIONAL ATTACHMENT
	// =====================================================

	public EmailResponse sendHtmlEmail(
			String toEmail,
			String subject,
			String htmlContent,
			String plainTextAlternative,
			byte[] attachmentBytes,
			String attachmentFilename,
			String type) {

		if (toEmail == null || toEmail.trim().isEmpty()) {
			throw new RuntimeException("Recipient email is required");
		}
		if (subject == null || subject.trim().isEmpty()) {
			throw new RuntimeException("Email subject is required");
		}

		EmailLog emailLog = new EmailLog();
		emailLog.setRecipient(toEmail.trim());
		emailLog.setSubject(subject.trim());
		emailLog.setMessage(
				plainTextAlternative != null && !plainTextAlternative.isBlank() ? plainTextAlternative
						: subject);
		emailLog.setType(type != null ? type : "General");
		emailLog.setProvider("SMTP");

		try {
			MimeMessage mimeMessage = mailSender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(
					mimeMessage,
					MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
					StandardCharsets.UTF_8.name());

			helper.setFrom(resolveFromAddress());
			helper.setTo(toEmail.trim());
			helper.setSubject(subject);

			String textPart = (plainTextAlternative != null && !plainTextAlternative.isBlank())
					? plainTextAlternative
					: subject;
			String htmlPart = (htmlContent != null && !htmlContent.isBlank())
					? htmlContent
					: textPart;

			helper.setText(textPart, htmlPart);

			// Attach inline brand logo if referenced in email HTML
			if (htmlPart != null && htmlPart.contains("cid:zenveLogo")) {
				byte[] lBytes = getLogoBytes();
				if (lBytes != null && lBytes.length > 0) {
					helper.addInline("zenveLogo", new ByteArrayResource(lBytes), "image/png");
				}
			}

			if (attachmentBytes != null && attachmentFilename != null && !attachmentFilename.isBlank()) {
				helper.addAttachment(
						attachmentFilename,
						new ByteArrayResource(attachmentBytes),
						"application/pdf");
			}

			mailSender.send(mimeMessage);
			emailLog.setStatus("SENT");
			log.info("[Zenve Mail] Dispatched '{}' to: <{}> via SMTP", type, toEmail);
                } catch (Exception ex) {
                        log.error("[Zenve Mail] Failed to send email to <{}>: {}", toEmail, ex.getMessage());
                        emailLog.setStatus("FAILED");
                        emailLog.setErrorMessage("Email delivery failed: " + ex.getMessage());
                }

                EmailLog saved = emailLogRepository.save(emailLog);
                return mapToResponse(saved);
        }

        // =====================================================
        // 1. DOCTOR WELCOME EMAIL
        // =====================================================

        public EmailResponse sendDoctorWelcomeEmail(String toEmail, String doctorName, String specialty) {
                String displayName = (doctorName != null && !doctorName.isBlank())
                                ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : ("Dr. " + doctorName))
                                : "Dr. Practitioner";
                String displaySpecialty = (specialty != null && !specialty.isBlank()) ? specialty
                                : "Veterinary Medicine & Surgery";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String subject = "Official Welcome to Zenve Vet, " + displayName + "! 🐾";
                String htmlBody = buildDoctorWelcomeHtml(displayName, toEmail, displaySpecialty, appUrl);
                String plainText = String.format(
                                "Welcome to Zenve Vet, %s!\n\n" +
                                                "Your practitioner account has been successfully created.\n" +
                                                "Registered Name: %s\n" +
                                                "Registered Email: %s\n" +
                                                "Specialty: %s\n" +
                                                "Portal: %s\n\n" +
                                                "Access India's Premier Veterinary Clinical Community & Network.\n\n" +
                                                "Best regards,\nZenve Vet Team\nhttps://doctor.zenvevet.com",
                                displayName, displayName, toEmail, displaySpecialty, appUrl);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "DOCTOR_WELCOME");
        }

        // =====================================================
        // 2. PASSWORD RESET OTP EMAIL
        // =====================================================

        public EmailResponse sendPasswordResetOtpEmail(String toEmail, String doctorName, String otpCode,
                        int expiryMinutes) {
                String displayName = (doctorName != null && !doctorName.isBlank())
                                ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : ("Dr. " + doctorName))
                                : "Dr. Member";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String subject = "Zenve Vet: Password Reset Verification Code (" + otpCode + ")";
                String htmlBody = buildPasswordResetOtpHtml(displayName, toEmail, otpCode, expiryMinutes, appUrl);
                String plainText = String.format(
                                "Hello %s,\n\n" +
                                                "We received a request to reset the password for your Zenve Vet account.\n"
                                                +
                                                "Your One-Time Password (OTP) is: %s\n\n" +
                                                "This code will expire in %d minutes.\n" +
                                                "If you did not request this code, please ignore this email.\n\n" +
                                                "Best regards,\nZenve Vet Security Team\nhttps://doctor.zenvevet.com",
                                displayName, otpCode, expiryMinutes);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "PASSWORD_RESET_OTP");
        }

        // =====================================================
        // 3. PASSWORD UPDATED CONFIRMATION EMAIL
        // =====================================================

        public EmailResponse sendPasswordChangedSuccessEmail(String toEmail, String doctorName) {
                String displayName = (doctorName != null && !doctorName.isBlank())
                                ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : ("Dr. " + doctorName))
                                : "Dr. Member";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";
                String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a"));

                String subject = "Zenve Vet: Your Password Has Been Successfully Changed 🔒";
                String htmlBody = buildPasswordChangedSuccessHtml(displayName, toEmail, timestamp, appUrl);
                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "This notification confirms that the password for your Zenve Vet account registered under %s was successfully updated on %s.\n\n"
                                                +
                                                "If you made this change, no further action is required.\n" +
                                                "If you DID NOT make this change, please reset your password immediately or contact support@zenvevet.com.\n\n"
                                                +
                                                "Best regards,\nZenve Vet Security Team\nhttps://doctor.zenvevet.com",
                                displayName, toEmail, timestamp);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "PASSWORD_UPDATED");
        }

        // =====================================================
        // 4. PRESCRIPTION EMAIL WITH PDF ATTACHMENT
        // =====================================================

        public EmailResponse sendPrescriptionEmailWithPdf(
                        String toEmail,
                        String ownerName,
                        String petName,
                        String doctorName,
                        String clinicName,
                        String clinicAddress,
                        String clinicPhone,
                        String visitDate,
                        String diagnosis,
                        String instructions,
                        String followUpDate,
                        List<PrescriptionItem> items,
                        byte[] pdfBytes) {

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Pet Parent";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Your Pet";
                String displayDoctor = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Veterinary Doctor";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName
                                : "Zenve Veterinary Clinic";
                String dateStr = (visitDate != null && !visitDate.isBlank()) ? visitDate : LocalDateNowStr();
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String cleanPetFile = displayPet.replaceAll("[^a-zA-Z0-9_-]", "-").toLowerCase();
                String attachmentFilename = "Prescription-" + cleanPetFile + "-" + dateStr + ".pdf";

                String subject = "Veterinary Prescription: " + displayPet + " - " + displayClinic;
                String htmlBody = buildPrescriptionEmailHtml(
                                displayOwner, displayPet, displayDoctor, displayClinic, clinicAddress,
                                clinicPhone, dateStr, diagnosis, instructions, followUpDate, items,
                                attachmentFilename, appUrl);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "Please find attached the official digital prescription for %s issued by %s at %s on %s.\n"
                                                +
                                                "Diagnosis: %s\n" +
                                                "Instructions: %s\n" +
                                                "Follow-up: %s\n\n" +
                                                "The complete prescription PDF has been attached to this email (%s).\n\n"
                                                +
                                                "Best regards,\n%s\nhttps://doctor.zenvevet.com",
                                displayOwner, displayPet, displayDoctor, displayClinic, dateStr,
                                diagnosis != null ? diagnosis : "General Examination",
                                instructions != null ? instructions : "Follow prescribed dosage",
                                followUpDate != null ? followUpDate : "As needed",
                                attachmentFilename, displayClinic);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, pdfBytes, attachmentFilename,
                                "PRESCRIPTION");
        }

        // =====================================================
        // 5. PAYMENT RECEIPT EMAIL
        // =====================================================

        public EmailResponse sendPaymentReceiptEmail(
                        String toEmail,
                        String ownerName,
                        String petName,
                        String doctorName,
                        String clinicName,
                        String invoiceNumber,
                        String transactionId,
                        BigDecimal amountPaid,
                        BigDecimal totalAmount,
                        BigDecimal dueAmount,
                        String paymentMethod,
                        LocalDateTime paymentDate) {

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Valued Client";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Patient";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName
                                : "Zenve Veterinary Clinic";
                String invNum = (invoiceNumber != null && !invoiceNumber.isBlank()) ? invoiceNumber
                                : ("INV-" + System.currentTimeMillis() % 100000);
                String txnId = (transactionId != null && !transactionId.isBlank()) ? transactionId
                                : ("TXN" + System.currentTimeMillis() % 1000000);
                String pMethod = (paymentMethod != null && !paymentMethod.isBlank()) ? paymentMethod.toUpperCase()
                                : "CASH";
                String timeStr = (paymentDate != null)
                                ? paymentDate.format(DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a"))
                                : LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a"));
                String paidStr = amountPaid != null ? amountPaid.setScale(2).toString() : "0.00";
                String totalStr = totalAmount != null ? totalAmount.setScale(2).toString() : paidStr;
                String dueStr = dueAmount != null ? dueAmount.setScale(2).toString() : "0.00";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String subject = "Payment Receipt: ₹" + paidStr + " for " + displayPet + "'s Care - " + displayClinic;
                String htmlBody = buildPaymentReceiptHtml(
                                displayOwner, displayPet, displayClinic, invNum, txnId,
                                paidStr, totalStr, dueStr, pMethod, timeStr, appUrl);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "Thank you for your payment. We have successfully received payment of ₹%s for %s's care at %s.\n\n"
                                                +
                                                "Receipt / Transaction ID: %s\n" +
                                                "Invoice Number: %s\n" +
                                                "Payment Method: %s\n" +
                                                "Payment Date: %s\n" +
                                                "Amount Paid: ₹%s\n" +
                                                "Total Invoice Amount: ₹%s\n" +
                                                "Remaining Due: ₹%s\n\n" +
                                                "Thank you for trusting %s!\n" +
                                                "Zenve Vet Care • https://doctor.zenvevet.com",
                                displayOwner, paidStr, displayPet, displayClinic, txnId, invNum,
                                pMethod, timeStr, paidStr, totalStr, dueStr, displayClinic);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "PAYMENT_RECEIPT");
        }

        // =====================================================
        // 6. APPOINTMENT CONFIRMATION / BOOKING EMAIL
        // =====================================================

        public EmailResponse sendAppointmentConfirmationEmail(
                        String toEmail,
                        String ownerName,
                        String petName,
                        String species,
                        String breed,
                        String doctorName,
                        String clinicName,
                        String clinicAddress,
                        String clinicPhone,
                        LocalDate appointmentDate,
                        LocalTime appointmentTime,
                        String appointmentType,
                        String reason,
                        String notes,
                        String status) {

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Valued Pet Parent";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Your Pet";
                String displayDoctor = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Veterinary Doctor";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName : "Zenve Veterinary Clinic";
                String typeStr = (appointmentType != null && !appointmentType.isBlank()) ? appointmentType : "In Clinic Consultation";
                String statusStr = (status != null && !status.isBlank()) ? status : "Confirmed";

                DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy");
                String dateFormatted = appointmentDate != null ? appointmentDate.format(dateFmt) : "Scheduled Date";

                DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("hh:mm a");
                String timeFormatted = appointmentTime != null ? appointmentTime.format(timeFmt) : "Scheduled Time";

                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String subject = "Appointment Confirmed: " + displayPet + " with " + displayDoctor + " on " + dateFormatted + " - " + displayClinic;

                String htmlBody = buildAppointmentConfirmationEmailHtml(
                                displayOwner, displayPet, species, breed, displayDoctor, displayClinic,
                                clinicAddress, clinicPhone, dateFormatted, timeFormatted, typeStr,
                                reason, notes, statusStr, appUrl);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                "Your veterinary appointment has been successfully scheduled and confirmed.\n\n" +
                                "APPOINTMENT DETAILS:\n" +
                                "----------------------------------------\n" +
                                "Patient: %s (%s)\n" +
                                "Doctor: %s\n" +
                                "Clinic: %s\n" +
                                "Clinic Address: %s\n" +
                                "Clinic Phone: %s\n" +
                                "Date: %s\n" +
                                "Time: %s\n" +
                                "Visit Type: %s\n" +
                                "Reason: %s\n" +
                                "Status: %s\n" +
                                (notes != null && !notes.isBlank() ? "Notes: " + notes + "\n" : "") +
                                "----------------------------------------\n\n" +
                                "PREPARATION CHECKLIST:\n" +
                                "• Please arrive 10 minutes prior to your scheduled consultation time.\n" +
                                "• Bring any previous vaccination certificates or treatment history.\n" +
                                "• For safety, please secure dogs on a leash and place cats in a carrier.\n" +
                                "• If you need to reschedule or have questions, please call %s.\n\n" +
                                "Thank you for choosing %s!\n" +
                                "Zenve Vet Care • %s",
                                displayOwner,
                                displayPet, (species != null ? species : "Pet") + (breed != null && !breed.isBlank() ? " • " + breed : ""),
                                displayDoctor, displayClinic,
                                (clinicAddress != null && !clinicAddress.isBlank() ? clinicAddress : "Refer to clinic profile"),
                                (clinicPhone != null && !clinicPhone.isBlank() ? clinicPhone : "Available via portal"),
                                dateFormatted, timeFormatted, typeStr,
                                (reason != null && !reason.isBlank() ? reason : "Consultation / Wellness Exam"),
                                statusStr,
                                (clinicPhone != null && !clinicPhone.isBlank() ? clinicPhone : displayClinic),
                                displayClinic, appUrl
                );

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "APPOINTMENT_BOOKING");
        }

        // =====================================================
        // SEND / CREATE EMAIL LOG (General API)
        // =====================================================

        public EmailResponse sendEmail(EmailRequest request) {

                if (request.getRecipient() == null || request.getRecipient().trim().isEmpty()) {
                        throw new RuntimeException("Recipient email is required");
                }

                if (request.getSubject() == null || request.getSubject().trim().isEmpty()) {
                        throw new RuntimeException("Email subject is required");
                }

                String msg = request.getMessage() != null ? request.getMessage() : "";
                String htmlContent = request.getHtmlContent();

                // If message contains HTML tags or htmlContent is supplied, route through HTML
                // dispatcher
                if (htmlContent != null || msg.contains("<html") || msg.contains("<!DOCTYPE") || msg.contains("<div")
                                || request.getAttachmentBytes() != null) {
                        String finalHtml = htmlContent != null ? htmlContent : msg;
                        return sendHtmlEmail(
                                        request.getRecipient(),
                                        request.getSubject(),
                                        finalHtml,
                                        msg,
                                        request.getAttachmentBytes(),
                                        request.getAttachmentFilename(),
                                        request.getType() != null ? request.getType() : "General");
                }

                EmailLog emailLog = new EmailLog();
                emailLog.setRecipient(request.getRecipient());
                emailLog.setSubject(request.getSubject());
                emailLog.setMessage(msg);
                emailLog.setType(request.getType() != null && !request.getType().trim().isEmpty() ? request.getType()
                                : "General");
                emailLog.setProvider(request.getProvider() != null && !request.getProvider().trim().isEmpty()
                                ? request.getProvider()
                                : "Default");

                try {
                        MimeMessage mimeMessage = mailSender.createMimeMessage();
                        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false,
                                        StandardCharsets.UTF_8.name());

                        helper.setFrom(resolveFromAddress());
                        helper.setTo(emailLog.getRecipient());
                        helper.setSubject(emailLog.getSubject());
                        helper.setText(emailLog.getMessage());

                        mailSender.send(mimeMessage);
                        emailLog.setStatus("SENT");
                } catch (Exception ex) {
                        emailLog.setStatus("FAILED");
                        emailLog.setErrorMessage("Email delivery failed: " + ex.getMessage());
                        log.warn("[Zenve Mail] sendEmail error: {}", ex.getMessage());
                }

                EmailLog saved = emailLogRepository.save(emailLog);
                return mapToResponse(saved);
        }

        // =====================================================
        // HTML BUILDERS (Matching Zenve Vet Brand System)
        // =====================================================

        private String buildDoctorWelcomeHtml(String doctorName, String email, String specialty, String appUrl) {
                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Official Welcome to Zenve Vet</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 620px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #0F766E 0%%, #0D9488 50%%, #059669 100%%); padding: 36px 32px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
                                    .brand-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13.5px; opacity: 0.94; font-weight: 400; }
                                    .content { padding: 34px 30px; line-height: 1.6; }
                                    .greeting { font-size: 20px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 10px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 35%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .details-table a { color: #0D9488; text-decoration: none; font-weight: 600; }
                                    .feature-box { background: #F0FDF4; border-left: 4px solid #10B981; border-radius: 8px; padding: 16px 20px; margin: 22px 0; }
                                    .feature-item { margin-bottom: 12px; font-size: 13.5px; color: #1E293B; line-height: 1.5; }
                                    .feature-item:last-child { margin-bottom: 0; }
                                    .feature-item strong { color: #065F46; }
                                    .cta-container { text-align: center; margin: 30px 0 22px 0; }
                                    .cta-btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.32); }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Official Welcome</span>
                                        <h1 class="brand-title">Zenve Vet 🐾</h1>
                                        <p class="brand-subtitle">India's Premier Veterinary Clinical Community & Network</p>
                                      </div>
                                      <div class="content">
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Welcome to <strong>Zenve Vet</strong>! Your practitioner account has been successfully created. We are excited to welcome you into a dedicated, collaborative ecosystem designed exclusively for veterinary professionals.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Website</td>
                                            <td class="value"><a href="%s">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Name</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Email</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Specialty</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value">no-reply@zenvevet.com</td>
                                          </tr>
                                        </table>

                                        <div class="feature-box">
                                          <div class="feature-item">
                                            <strong>🩺 Clinical Case Exchange:</strong> Share challenging diagnostic cases, review imaging, and collaborate with veterinary surgeons and specialists.
                                          </div>
                                          <div class="feature-item">
                                            <strong>🤝 Verified Practitioner Network:</strong> Connect and build professional relationships with verified veterinarians across India.
                                          </div>
                                          <div class="feature-item">
                                            <strong>📋 Digital Rx & Clinical Management:</strong> Automatic dosing calculation, Instant PDF generation, and automated patient communication.
                                          </div>
                                        </div>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">Access Doctor Portal →</a>
                                        </div>
                                      </div>
                                      <div class="footer">
                                        Sent automatically by <strong>no-reply@zenvevet.com</strong> • Zenve Pets Healthcare Pvt. Ltd.<br>
                                        India's Premier Veterinary Network • <a href="%s">https://doctor.zenvevet.com</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(doctorName, appUrl, appUrl, doctorName, email, specialty, appUrl, appUrl);
        }

        private String buildPasswordResetOtpHtml(String recipientName, String email, String otpCode, int expiryMinutes,
                        String appUrl) {
                String spacedOtp = otpCode != null ? String.join("  ", otpCode.split("")) : "• • • • • •";

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Zenve Vet Password Reset OTP</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #003822 0%%, #0D9488 60%%, #059669 100%%); padding: 34px 30px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
                                    .brand-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13px; opacity: 0.92; font-weight: 400; }
                                    .content { padding: 34px 30px; line-height: 1.6; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; }
                                    .otp-card { background: #F0FDF4; border: 2px dashed #0D9488; border-radius: 12px; padding: 22px 20px; text-align: center; margin: 24px 0; }
                                    .otp-label { display: block; font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
                                    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #003822; margin: 6px 0; }
                                    .otp-meta { display: inline-block; font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 500; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 10px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 35%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .alert-box { background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 6px; padding: 14px 16px; margin: 22px 0; font-size: 13px; color: #92400E; }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Security Verification</span>
                                        <h1 class="brand-title">ZENVE VET</h1>
                                        <p class="brand-subtitle">The Professional Network for Animal Healthcare</p>
                                      </div>
                                      <div class="content">
                                        <div class="greeting">Hello %s,</div>
                                        <p class="intro">
                                          We received a request to reset the password for your Zenve Vet account. Please use the One-Time Password (OTP) below to verify your request and set your new password.
                                        </p>

                                        <div class="otp-card">
                                          <span class="otp-label">Verification Code (OTP)</span>
                                          <div class="otp-code">%s</div>
                                          <span class="otp-meta">Expires in %d minutes • Single-use only</span>
                                        </div>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Account Email</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Validity</td>
                                            <td class="value">%d Minutes</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Portal</td>
                                            <td class="value"><a href="%s" style="color: #0D9488; text-decoration: none; font-weight: 600;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="alert-box">
                                          ⚠️ If you did not request a password reset, please ignore this email or contact support. Your password remains completely secure.
                                        </div>
                                      </div>
                                      <div class="footer">
                                        Sent automatically by <strong>no-reply@zenvevet.com</strong> • Zenve Pets Healthcare Pvt. Ltd.<br>
                                        <a href="%s">https://doctor.zenvevet.com</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(recipientName, spacedOtp, expiryMinutes, email, expiryMinutes, appUrl,
                                                appUrl, appUrl);
        }

        private String buildPasswordChangedSuccessHtml(String recipientName, String email, String timestamp,
                        String appUrl) {
                String loginUrl = appUrl.endsWith("/") ? (appUrl + "login") : (appUrl + "/login");

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Password Changed Successfully - Zenve Vet</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #003822 0%%, #0D9488 60%%, #059669 100%%); padding: 34px 30px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
                                    .brand-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13px; opacity: 0.92; font-weight: 400; }
                                    .content { padding: 34px 30px; line-height: 1.6; }
                                    .status-badge { display: inline-flex; align-items: center; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 13px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 10px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 35%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .cta-container { text-align: center; margin: 28px 0 20px 0; }
                                    .cta-btn { display: inline-block; background-color: #003822; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 56, 34, 0.25); }
                                    .danger-box { background: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 6px; padding: 14px 16px; margin: 24px 0 10px 0; font-size: 13px; color: #991B1B; }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Security Confirmation</span>
                                        <h1 class="brand-title">ZENVE VET</h1>
                                        <p class="brand-subtitle">The Professional Network for Animal Healthcare</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">✓ Password Updated Successfully</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          This notification confirms that the password for your Zenve Vet account registered under <strong>%s</strong> was successfully updated.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Account Email</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Updated On</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Status</td>
                                            <td class="value" style="color: #047857; font-weight: 700;">Secured & Updated</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Encryption</td>
                                            <td class="value">Standard encryption (TLS)</td>
                                          </tr>
                                        </table>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">Sign In to Your Account →</a>
                                        </div>

                                        <div class="danger-box">
                                          ⚠️ <strong>Didn't request this change?</strong> If you did not make this change, please reset your password immediately or contact our security team at support@zenvevet.com.
                                        </div>
                                      </div>
                                      <div class="footer">
                                        Sent automatically by <strong>no-reply@zenvevet.com</strong> • Zenve Pets Healthcare Pvt. Ltd.<br>
                                        <a href="%s">https://doctor.zenvevet.com</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(recipientName, email, email, timestamp, loginUrl, appUrl);
        }

        private String buildPrescriptionEmailHtml(
                        String ownerName,
                        String petName,
                        String doctorName,
                        String clinicName,
                        String clinicAddress,
                        String clinicPhone,
                        String dateStr,
                        String diagnosis,
                        String instructions,
                        String followUpDate,
                        List<PrescriptionItem> items,
                        String attachmentFilename,
                        String appUrl) {

                StringBuilder medRows = new StringBuilder();
                if (items != null && !items.isEmpty()) {
                        int idx = 1;
                        for (PrescriptionItem it : items) {
                                String mName = (it.getMedicine() != null && it.getMedicine().getName() != null)
                                                ? it.getMedicine().getName()
                                                : "Medicine";
                                String dos = it.getDosage() != null ? it.getDosage() : "—";
                                String freq = it.getFrequency() != null ? it.getFrequency() : "—";
                                String dur = it.getDuration() != null ? it.getDuration() : "—";
                                String qty = it.getQuantity() != null ? it.getQuantity() : "—";
                                String inst = it.getInstructions() != null ? it.getInstructions() : "—";
                                medRows.append(String.format(
                                                "<tr><td style='padding:8px;border-bottom:1px solid #E2E8F0;font-weight:600;'>%d</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#0F172A;'>%s</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;'>%s</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;'>%s</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;'>%s</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;'>%s</td>"
                                                                +
                                                                "<td style='padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#475569;'>%s</td></tr>",
                                                idx++, mName, dos, freq, dur, qty, inst));
                        }
                } else {
                        medRows.append("<tr><td colspan='7' style='padding:12px;text-align:center;color:#64748B;'>No medications listed on this visit.</td></tr>");
                }

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Prescription for %s</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 650px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #0F766E 0%%, #0D9488 50%%, #059669 100%%); padding: 34px 30px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
                                    .brand-title { margin: 0; font-size: 25px; font-weight: 800; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13px; opacity: 0.94; }
                                    .content { padding: 32px 28px; line-height: 1.6; }
                                    .status-badge { display: inline-flex; align-items: center; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 13px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 20px; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 18px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 9px 14px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 32%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .med-table { width: 100%%; border-collapse: collapse; margin: 16px 0; font-size: 12.5px; }
                                    .med-table th { background: #0F766E; color: #FFFFFF; padding: 8px; text-align: left; font-size: 12px; }
                                    .attachment-card { background: #F0FDF4; border: 2px dashed #059669; border-radius: 10px; padding: 16px; margin: 22px 0; text-align: center; }
                                    .attachment-title { font-weight: 700; color: #065F46; font-size: 14px; margin-bottom: 4px; }
                                    .attachment-sub { font-size: 12px; color: #047857; }
                                    .notes-box { background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #92400E; }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Official Digital Prescription</span>
                                        <h1 class="brand-title">Zenve Vet Care 🐾</h1>
                                        <p class="brand-subtitle">%s</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">📎 Official Prescription PDF Attached</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Dr. <strong>%s</strong> from <strong>%s</strong> has issued a digital veterinary prescription for <strong>%s</strong> on %s.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Patient (Pet)</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Pet Parent</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Attending Doctor</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinic / Hospital</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Consultation Date</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Diagnosis</td>
                                            <td class="value" style="color: #0F766E; font-weight: 700;">%s</td>
                                          </tr>
                                        </table>

                                        <h4 style="margin: 20px 0 8px 0; color: #0F172A;">Prescribed Medications (Rx)</h4>
                                        <table class="med-table">
                                          <thead>
                                            <tr>
                                              <th>#</th>
                                              <th>Medicine</th>
                                              <th>Dosage</th>
                                              <th>Frequency</th>
                                              <th>Duration</th>
                                              <th>Qty</th>
                                              <th>Instructions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            %s
                                          </tbody>
                                        </table>

                                        %s

                                        <div class="attachment-card">
                                          <div class="attachment-title">📎 Attached: %s</div>
                                          <div class="attachment-sub">Full A4 Prescription Document with clinic branding and doctor certification. Download or print for pharmacy dispensing.</div>
                                        </div>

                                        <p style="font-size: 12.5px; color: #64748B; margin-top: 16px;">
                                          Hospital Contact: <strong>%s</strong> • Address: %s
                                        </p>
                                      </div>
                                      <div class="footer">
                                        Sent on behalf of <strong>%s</strong> by Zenve Vet Care.<br>
                                        Certified Veterinary Medical Platform • <a href="%s">https://doctor.zenvevet.com</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(
                                                petName, clinicName, ownerName, doctorName, clinicName, petName,
                                                dateStr,
                                                petName, ownerName, doctorName, clinicName, dateStr,
                                                diagnosis != null ? diagnosis : "General Health Examination",
                                                medRows.toString(),
                                                (instructions != null && !instructions.isBlank())
                                                                ? ("<div class='notes-box'><strong>Care Instructions & Advice:</strong><br>"
                                                                                + instructions + "</div>")
                                                                : "",
                                                attachmentFilename,
                                                clinicPhone != null ? clinicPhone : "—",
                                                clinicAddress != null ? clinicAddress : "Zenve Clinical Network",
                                                clinicName,
                                                appUrl);
        }

        private String buildPaymentReceiptHtml(
                        String ownerName,
                        String petName,
                        String clinicName,
                        String invoiceNumber,
                        String transactionId,
                        String amountPaid,
                        String totalAmount,
                        String dueAmount,
                        String paymentMethod,
                        String timeStr,
                        String appUrl) {

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Payment Receipt - %s</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #003822 0%%, #0D9488 60%%, #059669 100%%); padding: 34px 30px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
                                    .brand-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13px; opacity: 0.92; font-weight: 400; }
                                    .content { padding: 34px 30px; line-height: 1.6; }
                                    .status-badge { display: inline-flex; align-items: center; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 13px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 10px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; }
                                    .amount-card { background: #F0FDF4; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
                                    .amount-label { font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; }
                                    .amount-val { font-size: 34px; font-weight: 800; color: #003822; margin: 6px 0; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 10px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 38%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .cta-container { text-align: center; margin: 28px 0 16px 0; }
                                    .cta-btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3); }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Official Payment Receipt</span>
                                        <h1 class="brand-title">ZENVE VET</h1>
                                        <p class="brand-subtitle">%s</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">✓ Payment Received Successfully</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Thank you for your payment. This email confirms that we have successfully received your payment for <strong>%s</strong>'s veterinary care at <strong>%s</strong>.
                                        </p>

                                        <div class="amount-card">
                                          <div class="amount-label">Amount Paid</div>
                                          <div class="amount-val">₹%s</div>
                                          <div style="font-size: 12px; color: #059669; font-weight: 600;">Payment Mode: %s</div>
                                        </div>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Receipt / Txn ID</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Invoice Number</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Patient (Pet)</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Pet Parent</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Date & Time</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Total Invoice Amount</td>
                                            <td class="value">₹%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Remaining Balance Due</td>
                                            <td class="value" style="color: #D97706; font-weight: 700;">₹%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Payment Status</td>
                                            <td class="value" style="color: #047857; font-weight: 700;">SUCCESS</td>
                                          </tr>
                                        </table>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">View Invoice & Medical Records →</a>
                                        </div>
                                      </div>
                                      <div class="footer">
                                        Sent on behalf of <strong>%s</strong> by Zenve Vet Care.<br>
                                        Official Veterinary Billing & Practice Network • <a href="%s">https://doctor.zenvevet.com</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(
                                                clinicName, clinicName, ownerName, petName, clinicName,
                                                amountPaid, paymentMethod, transactionId, invoiceNumber,
                                                petName, ownerName, timeStr, totalAmount, dueAmount,
                                                appUrl, clinicName, appUrl);
        }

        private String buildAppointmentConfirmationEmailHtml(
                        String ownerName,
                        String petName,
                        String species,
                        String breed,
                        String doctorName,
                        String clinicName,
                        String clinicAddress,
                        String clinicPhone,
                        String dateFormatted,
                        String timeFormatted,
                        String appointmentType,
                        String reason,
                        String notes,
                        String status,
                        String appUrl) {

                String breedText = (breed != null && !breed.isBlank()) ? (" • " + breed) : "";
                String speciesText = (species != null && !species.isBlank()) ? species : "Pet";
                String reasonText = (reason != null && !reason.isBlank()) ? reason : "General Health Consultation";
                String addressText = (clinicAddress != null && !clinicAddress.isBlank()) ? clinicAddress : "Clinic Premises";
                String phoneText = (clinicPhone != null && !clinicPhone.isBlank()) ? clinicPhone : "Available in portal";
                String notesHtml = (notes != null && !notes.isBlank())
                                ? String.format("<div class=\"notes-box\"><strong>Doctor's / Clinical Notes:</strong><br>%s</div>", notes)
                                : "";

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Appointment Confirmed - %s</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #003822 0%%, #0D9488 50%%, #059669 100%%); padding: 34px 30px; text-align: center; color: #FFFFFF; }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
                                    .brand-title { margin: 0; font-size: 25px; font-weight: 800; }
                                    .brand-subtitle { margin: 6px 0 0 0; font-size: 13px; opacity: 0.94; }
                                    .content { padding: 32px 28px; line-height: 1.6; }
                                    .status-badge { display: inline-flex; align-items: center; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 20px; }
                                    .date-card { background: #F0FDF4; border: 2px solid #0D9488; border-radius: 12px; padding: 18px 20px; text-align: center; margin: 20px 0; }
                                    .date-main { font-size: 20px; font-weight: 800; color: #003822; margin-bottom: 4px; }
                                    .time-sub { font-size: 15px; font-weight: 700; color: #059669; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 10px 14px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #64748B; font-weight: 600; width: 34%%; }
                                    .details-table .value { color: #0F172A; font-weight: 500; }
                                    .checklist-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px 20px; margin: 22px 0; font-size: 13px; color: #334155; }
                                    .checklist-title { font-weight: 700; color: #0F172A; margin-bottom: 8px; font-size: 13.5px; }
                                    .checklist-list { margin: 0; padding-left: 18px; line-height: 1.7; }
                                    .notes-box { background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #92400E; }
                                    .footer { background-color: #0F172A; padding: 24px 30px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6; }
                                    .footer a { color: #14B8A6; text-decoration: none; }
                                  </style>
                                </head>
                                <body>
                                  <div style="background-color: #F8FAFC; padding: 32px 16px;">
                                    <div class="wrapper">
                                      <div style="background-color: #FFFFFF; padding: 18px 24px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                        <a href="https://doctor.zenvevet.com" target="_blank" style="text-decoration: none;">
                                          <img src="cid:zenveLogo" alt="Zenve VetCare" style="max-height: 48px; max-width: 170px; height: auto; object-fit: contain; vertical-align: middle; border: 0;" />
                                        </a>
                                      </div>
                                      <div class="header">
                                        <span class="brand-badge">Appointment Confirmation</span>
                                        <h1 class="brand-title">%s</h1>
                                        <p class="brand-subtitle">Veterinary Healthcare & Clinical Services</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">✓ Appointment %s</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Your veterinary appointment for <strong>%s</strong> has been successfully booked with <strong>%s</strong> at <strong>%s</strong>.
                                        </p>

                                        <div class="date-card">
                                          <div class="date-main">%s</div>
                                          <div class="time-sub">⏰ %s • %s</div>
                                        </div>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Patient (Pet)</td>
                                            <td class="value"><strong>%s</strong> (%s%s)</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Attending Doctor</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinic / Hospital</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinic Address</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Contact Phone</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Reason for Visit</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Status</td>
                                            <td class="value" style="color: #047857; font-weight: 700;">%s</td>
                                          </tr>
                                        </table>

                                        %s

                                        <div class="checklist-box">
                                          <div class="checklist-title">📋 Important Appointment Checklist:</div>
                                          <ul class="checklist-list">
                                            <li>Please arrive 10 minutes prior to your scheduled consultation time.</li>
                                            <li>Bring any previous vaccination certificates or treatment history.</li>
                                            <li>For safety, please secure dogs on a leash and place cats in a carrier.</li>
                                            <li>If you need to reschedule or have questions, please call %s.</li>
                                          </ul>
                                        </div>
                                      </div>
                                      <div class="footer">
                                        Sent on behalf of <strong>%s</strong> by Zenve Vet Care.<br>
                                        <a href="%s">%s</a>
                                      </div>
                                    </div>
                                  </div>
                                </body>
                                </html>
                                """
                                .formatted(
                                                clinicName, clinicName, status, ownerName, petName, doctorName, clinicName,
                                                dateFormatted, timeFormatted, appointmentType,
                                                petName, speciesText, breedText,
                                                doctorName, clinicName, addressText, phoneText,
                                                reasonText, status, notesHtml,
                                                phoneText, clinicName, appUrl, appUrl
                                );
        }

        private String LocalDateNowStr() {
                return LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
        }

        // =====================================================
        // GET ALL EMAIL LOGS
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getAllEmails() {

                return emailLogRepository.findAll()
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY ID
        // =====================================================

        @Transactional(readOnly = true)
        public EmailResponse getEmailById(Long id) {

                EmailLog emailLog = emailLogRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException(
                                                "Email log not found with id: "
                                                                + id));

                return mapToResponse(emailLog);
        }

        // =====================================================
        // GET BY RECIPIENT
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByRecipient(
                        String recipient) {

                return emailLogRepository
                                .findByRecipient(recipient)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY STATUS
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByStatus(
                        String status) {

                return emailLogRepository
                                .findByStatus(status)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY TYPE
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByType(
                        String type) {

                return emailLogRepository
                                .findByType(type)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY PROVIDER
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByProvider(
                        String provider) {

                return emailLogRepository
                                .findByProvider(provider)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY RECIPIENT + STATUS
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByRecipientAndStatus(
                        String recipient,
                        String status) {

                return emailLogRepository
                                .findByRecipientAndStatus(
                                                recipient,
                                                status)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // GET BY PROVIDER MESSAGE ID
        // =====================================================

        @Transactional(readOnly = true)
        public List<EmailResponse> getByProviderMessageId(
                        String providerMessageId) {

                return emailLogRepository
                                .findByProviderMessageId(
                                                providerMessageId)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        // =====================================================
        // UPDATE EMAIL STATUS
        // =====================================================

        public EmailResponse updateStatus(
                        Long id,
                        String status,
                        String providerMessageId,
                        String errorMessage) {

                EmailLog emailLog = emailLogRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException(
                                                "Email log not found with id: "
                                                                + id));

                if (status != null &&
                                !status.trim().isEmpty()) {

                        emailLog.setStatus(status);
                }

                if (providerMessageId != null) {

                        emailLog.setProviderMessageId(
                                        providerMessageId);
                }

                if (errorMessage != null) {

                        emailLog.setErrorMessage(
                                        errorMessage);
                }

                EmailLog updated = emailLogRepository.save(emailLog);

                return mapToResponse(updated);
        }

        // =====================================================
        // DELETE
        // =====================================================

        public void deleteEmail(Long id) {

                if (!emailLogRepository.existsById(id)) {

                        throw new RuntimeException(
                                        "Email log not found with id: " + id);
                }

                emailLogRepository.deleteById(id);
        }

        // =====================================================
        // MAP ENTITY TO RESPONSE
        // =====================================================

        private EmailResponse mapToResponse(
                        EmailLog emailLog) {

                EmailResponse response = new EmailResponse();

                response.setId(
                                emailLog.getId());

                response.setRecipient(
                                emailLog.getRecipient());

                response.setSubject(
                                emailLog.getSubject());

                response.setMessage(
                                emailLog.getMessage());

                response.setType(
                                emailLog.getType());

                response.setStatus(
                                emailLog.getStatus());

                response.setProvider(
                                emailLog.getProvider());

                response.setProviderMessageId(
                                emailLog.getProviderMessageId());

                response.setErrorMessage(
                                emailLog.getErrorMessage());

                response.setCreatedAt(
                                emailLog.getCreatedAt());

                response.setUpdatedAt(
                                emailLog.getUpdatedAt());

                return response;
        }
}