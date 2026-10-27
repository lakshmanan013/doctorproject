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
import org.springframework.mail.javamail.JavaMailSenderImpl;
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
                                : "no-replyzenvedoctors@zenvevet.com";
                String senderName = (mailProperties.getSenderName() != null
                                && !mailProperties.getSenderName().isBlank())
                                                ? mailProperties.getSenderName().trim()
                                                : "Zenve Doctors";

                if (!fromEmail.contains("@")) {
                        senderName = fromEmail;
                        fromEmail = "no-replyzenvedoctors@zenvevet.com";
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

	private InternetAddress resolveAppointmentFromAddress() {
		String fromEmail = (mailProperties.getAppointmentFrom() != null && !mailProperties.getAppointmentFrom().isBlank())
				? mailProperties.getAppointmentFrom().trim()
				: "no-replyzenveappointments@zenvevet.com";
		String senderName = (mailProperties.getAppointmentSenderName() != null
				&& !mailProperties.getAppointmentSenderName().isBlank())
						? mailProperties.getAppointmentSenderName().trim()
						: "Zenve Appointments";

		if (!fromEmail.contains("@")) {
			senderName = fromEmail;
			fromEmail = "no-replyzenveappointments@zenvevet.com";
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

	private JavaMailSenderImpl appointmentMailSenderInstance = null;

	private synchronized JavaMailSender getAppointmentMailSender() {
		if (appointmentMailSenderInstance == null) {
			JavaMailSenderImpl impl = new JavaMailSenderImpl();
			impl.setHost(mailProperties.getAppointmentHost() != null ? mailProperties.getAppointmentHost() : "mail.zenvevet.com");
			impl.setPort(mailProperties.getAppointmentPort() > 0 ? mailProperties.getAppointmentPort() : 465);
			impl.setUsername(mailProperties.getAppointmentUsername() != null ? mailProperties.getAppointmentUsername() : "no-replyzenveappointments@zenvevet.com");
			impl.setPassword(mailProperties.getAppointmentPassword() != null ? mailProperties.getAppointmentPassword() : "zenveappointments@zenve123");
			impl.setProtocol("smtps");
			impl.setDefaultEncoding(StandardCharsets.UTF_8.name());

			java.util.Properties props = impl.getJavaMailProperties();
			props.put("mail.smtp.auth", "true");
			props.put("mail.smtp.ssl.enable", "true");
			props.put("mail.smtp.socketFactory.port", String.valueOf(impl.getPort()));
			props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
			props.put("mail.smtp.socketFactory.fallback", "false");
			props.put("mail.smtp.connectiontimeout", "10000");
			props.put("mail.smtp.timeout", "10000");
			props.put("mail.smtp.writetimeout", "10000");

			appointmentMailSenderInstance = impl;
		}
		return appointmentMailSenderInstance;
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
        // 1A. NEW DOCTOR REGISTRATION WELCOME EMAIL
        // =====================================================

        public EmailResponse sendDoctorRegistrationWelcomeEmail(String toEmail, String doctorName, String clinicHospital, String phone) {
                String displayName = (doctorName != null && !doctorName.isBlank())
                                ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : ("Dr. " + doctorName))
                                : "Dr. Practitioner";
                String displayClinic = (clinicHospital != null && !clinicHospital.isBlank()) ? clinicHospital : "Clinical Practice";
                String displayPhone = (phone != null && !phone.isBlank()) ? phone : "Registered Mobile";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";
                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Zenve Doctors: Welcome, " + displayName + " — Registration Received";
                String htmlBody = buildDoctorRegistrationWelcomeHtml(displayName, toEmail, displayClinic, displayPhone, appUrl, senderEmail);
                String plainText = String.format(
                                "Dear %s,\n\n" +
                                "Welcome to Zenve Doctors! Your practitioner account has been successfully created.\n\n" +
                                "We are excited to welcome you into a dedicated, collaborative ecosystem designed exclusively for healthcare and clinical professionals.\n\n" +
                                "Registration Details:\n" +
                                "- Website: %s\n" +
                                "- Registered Name: %s\n" +
                                "- Registered Email: %s\n" +
                                "- Mobile: %s\n" +
                                "- Practice / Clinic: %s\n" +
                                "- Sender: %s\n" +
                                "- Status: PENDING ADMIN VERIFICATION\n\n" +
                                "What you can do with Zenve Doctors:\n" +
                                "- 📅 Smart Appointment Scheduling: Manage in-clinic appointments, token queues, and automated reminders.\n" +
                                "- 💊 Instant Digital Prescriptions: Create official digital prescriptions with drug dosages and instant PDF exports.\n" +
                                "- 🏥 Comprehensive Patient Records (EHR): Track complete clinical histories, diagnostics, and treatment plans.\n" +
                                "- 💳 Seamless Billing & Invoicing: Issue medical invoices, track consultation fees, and generate digital receipts.\n\n" +
                                "Our administration team is reviewing your clinical credentials. You will receive an official approval email once verified.\n\n" +
                                "If you have any questions, reach out to us at support@zenvevet.com.\n\n" +
                                "Best regards,\nZenve Doctors Team\nhttps://doctor.zenvevet.com",
                                displayName, appUrl, displayName, toEmail, displayPhone, displayClinic, senderEmail);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "DOCTOR_REGISTRATION_WELCOME");
        }

        // =====================================================
        // 1B. DOCTOR ACCOUNT APPROVED EMAIL
        // =====================================================

        public EmailResponse sendDoctorApprovedEmail(String toEmail, String doctorName, String specialty, String clinicHospital) {
                String displayName = (doctorName != null && !doctorName.isBlank())
                                ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : ("Dr. " + doctorName))
                                : "Dr. Practitioner";
                String displaySpecialty = (specialty != null && !specialty.isBlank()) ? specialty : "General Medicine & Surgery";
                String displayClinic = (clinicHospital != null && !clinicHospital.isBlank()) ? clinicHospital : "Zenve Doctors Clinic";
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";
                String loginUrl = appUrl.replaceAll("/+$", "") + "/login";
                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Zenve Doctors: Official Welcome, " + displayName + " — Your Account is Ready";
                String htmlBody = buildDoctorApprovedHtml(displayName, toEmail, displaySpecialty, displayClinic, loginUrl, appUrl, senderEmail);
                String plainText = String.format(
                                "Dear %s,\n\n" +
                                "Welcome to Zenve Doctors! Your practitioner account has been successfully created.\n\n" +
                                "We are excited to welcome you into a dedicated, collaborative ecosystem designed exclusively for healthcare and clinical professionals.\n\n" +
                                "Account Details:\n" +
                                "- Website: %s\n" +
                                "- Registered Name: %s\n" +
                                "- Registered Email: %s\n" +
                                "- Clinical Specialty: %s\n" +
                                "- Sender: %s\n\n" +
                                "Platform Features:\n" +
                                "- 📅 Smart Appointment Scheduling: Manage in-clinic appointments, token queues, and automated reminders.\n" +
                                "- 💊 Instant Digital Prescriptions: Create official digital prescriptions with drug dosages and instant PDF exports.\n" +
                                "- 🏥 Comprehensive Patient Records (EHR): Track complete clinical histories, diagnostics, and treatment plans.\n" +
                                "- 💳 Seamless Billing & Invoicing: Issue medical invoices, track consultation fees, and generate digital receipts.\n\n" +
                                "Sign in now: %s\n\n" +
                                "Need assistance or have questions? Our clinical support team is here to assist at support@zenvevet.com.\n\n" +
                                "Best regards,\nZenve Doctors Platform\nhttps://doctor.zenvevet.com",
                                displayName, appUrl, displayName, toEmail, displaySpecialty, senderEmail, loginUrl);

                return sendHtmlEmail(toEmail, subject, htmlBody, plainText, null, null, "DOCTOR_APPROVED");
        }

        // Legacy compatibility
        public EmailResponse sendDoctorWelcomeEmail(String toEmail, String doctorName, String specialty) {
                return sendDoctorApprovedEmail(toEmail, doctorName, specialty, null);
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

                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Zenve Doctors: Password Reset Verification Code (" + otpCode + ")";
                String htmlBody = buildPasswordResetOtpHtml(displayName, toEmail, otpCode, expiryMinutes, appUrl, senderEmail);
                String plainText = String.format(
                                "Hello %s,\n\n" +
                                                "We received a request to reset the password for your Zenve Doctors account.\n"
                                                +
                                                "Your One-Time Password (OTP) is: %s\n\n" +
                                                "This code will expire in %d minutes.\n" +
                                                "If you did not request this code, please ignore this email.\n\n" +
                                                "Best regards,\nZenve Doctors Security Team\nhttps://doctor.zenvevet.com",
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
                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Zenve Doctors: Your Password Has Been Successfully Changed 🔒";
                String htmlBody = buildPasswordChangedSuccessHtml(displayName, toEmail, timestamp, appUrl, senderEmail);
                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "This notification confirms that the password for your Zenve Doctors account registered under %s was successfully updated on %s.\n\n"
                                                +
                                                "If you made this change, no further action is required.\n" +
                                                "If you DID NOT make this change, please reset your password immediately or contact support@zenvevet.com.\n\n"
                                                +
                                                "Best regards,\nZenve Doctors Security Team\nhttps://doctor.zenvevet.com",
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

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Valued Patient";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Patient";
                String displayDoctor = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Doctor";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName
                                : "Zenve Doctors Clinic";
                String dateStr = (visitDate != null && !visitDate.isBlank()) ? visitDate : LocalDateNowStr();
                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String cleanPetFile = displayPet.replaceAll("[^a-zA-Z0-9_-]", "-").toLowerCase();
                String attachmentFilename = "Prescription-" + cleanPetFile + "-" + dateStr + ".pdf";

                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Official Prescription: " + displayPet + " — " + displayClinic;
                String htmlBody = buildPrescriptionEmailHtml(
                                displayOwner, displayPet, displayDoctor, displayClinic, clinicAddress,
                                clinicPhone, dateStr, diagnosis, instructions, followUpDate,
                                attachmentFilename, appUrl, toEmail, senderEmail);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "Please find attached the official digital prescription for %s issued by %s at %s on %s.\n"
                                                +
                                                "Diagnosis: %s\n" +
                                                "Instructions: %s\n" +
                                                "Follow-up: %s\n\n" +
                                                "The complete prescription PDF has been attached to this email (%s).\n\n"
                                                +
                                                "Best regards,\n%s\nZenve Doctors • https://doctor.zenvevet.com",
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

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Valued Patient";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Patient";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName
                                : "Zenve Doctors Clinic";
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

                String senderEmail = resolveFromAddress().getAddress();

                String subject = "Payment Receipt: ₹" + paidStr + " for " + displayPet + " — " + displayClinic;
                String htmlBody = buildPaymentReceiptHtml(
                                displayOwner, displayPet, displayClinic, invNum, txnId,
                                paidStr, totalStr, dueStr, pMethod, timeStr, appUrl, toEmail, senderEmail);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                                "Thank you for your payment. We have successfully received payment of ₹%s for %s at %s.\n\n"
                                                +
                                                "Receipt / Transaction ID: %s\n" +
                                                "Invoice Number: %s\n" +
                                                "Payment Method: %s\n" +
                                                "Payment Date: %s\n" +
                                                "Amount Paid: ₹%s\n" +
                                                "Total Invoice Amount: ₹%s\n" +
                                                "Remaining Due: ₹%s\n\n" +
                                                "Thank you for trusting %s!\n" +
                                                "Zenve Doctors • https://doctor.zenvevet.com",
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

                String displayOwner = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Valued Patient";
                String displayPet = (petName != null && !petName.isBlank()) ? petName : "Patient";
                String displayDoctor = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Doctor";
                String displayClinic = (clinicName != null && !clinicName.isBlank()) ? clinicName : "Zenve Doctors Clinic";
                String typeStr = (appointmentType != null && !appointmentType.isBlank()) ? appointmentType : "In Clinic Consultation";
                String statusStr = (status != null && !status.isBlank()) ? status : "Confirmed";

                DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy");
                String dateFormatted = appointmentDate != null ? appointmentDate.format(dateFmt) : "Scheduled Date";

                DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("hh:mm a");
                String timeFormatted = appointmentTime != null ? appointmentTime.format(timeFmt) : "Scheduled Time";

                String appUrl = (mailProperties.getAppUrl() != null && !mailProperties.getAppUrl().isBlank())
                                ? mailProperties.getAppUrl()
                                : "https://doctor.zenvevet.com";

                String subjectPrefix = "Appointment Confirmed";
                if ("Cancelled".equalsIgnoreCase(statusStr)) {
                    subjectPrefix = "Appointment Cancelled";
                } else if ("Rescheduled".equalsIgnoreCase(statusStr)) {
                    subjectPrefix = "Appointment Rescheduled";
                } else if ("Scheduled".equalsIgnoreCase(statusStr)) {
                    subjectPrefix = "Appointment Scheduled";
                }

                String senderEmail = resolveAppointmentFromAddress().getAddress();

                String subject = subjectPrefix + ": " + displayPet + " with " + displayDoctor + " on " + dateFormatted + " — " + displayClinic;

                String htmlBody = buildAppointmentConfirmationEmailHtml(
                                displayOwner, displayPet, species, breed, displayDoctor, displayClinic,
                                clinicAddress, clinicPhone, dateFormatted, timeFormatted, typeStr,
                                reason, notes, statusStr, appUrl, toEmail, senderEmail);

                String plainText = String.format(
                                "Dear %s,\n\n" +
                                "Your appointment has been successfully scheduled and confirmed.\n\n" +
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
                                "• Bring any previous medical reports, prescriptions, or investigation records.\n" +
                                "• If you need to reschedule or have questions, please call %s.\n\n" +
                                "Thank you for choosing %s!\n" +
                                "Zenve Doctors • %s",
                                displayOwner,
                                displayPet, (species != null ? species : "Patient") + (breed != null && !breed.isBlank() ? " • " + breed : ""),
                                displayDoctor, displayClinic,
                                (clinicAddress != null && !clinicAddress.isBlank() ? clinicAddress : "Refer to clinic profile"),
                                (clinicPhone != null && !clinicPhone.isBlank() ? clinicPhone : "Available via portal"),
                                dateFormatted, timeFormatted, typeStr,
                                (reason != null && !reason.isBlank() ? reason : "Consultation / Examination"),
                                statusStr,
                                (clinicPhone != null && !clinicPhone.isBlank() ? clinicPhone : displayClinic),
                                displayClinic, appUrl
                );

                return sendAppointmentHtmlEmail(toEmail, subject, htmlBody, plainText, null, null,
                        "Cancelled".equalsIgnoreCase(statusStr) ? "APPOINTMENT_CANCELLED" :
                        "Rescheduled".equalsIgnoreCase(statusStr) ? "APPOINTMENT_RESCHEDULED" :
                        "APPOINTMENT_BOOKING");
        }

        // =====================================================
        // 6B. DISPATCH APPOINTMENT EMAIL (DEDICATED APPOINTMENT GATEWAY)
        // =====================================================

        public EmailResponse sendAppointmentHtmlEmail(
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
                emailLog.setType(type != null ? type : "APPOINTMENT_BOOKING");
                emailLog.setProvider("SMTP_APPOINTMENTS");

                try {
                        InternetAddress fromAddress = resolveAppointmentFromAddress();
                        String textPart = (plainTextAlternative != null && !plainTextAlternative.isBlank())
                                        ? plainTextAlternative
                                        : subject;
                        String htmlPart = (htmlContent != null && !htmlContent.isBlank())
                                        ? htmlContent
                                        : textPart;

                        boolean sent = false;
                        try {
                                JavaMailSender activeSender = getAppointmentMailSender();
                                MimeMessage mimeMessage = activeSender.createMimeMessage();
                                MimeMessageHelper helper = new MimeMessageHelper(
                                                mimeMessage,
                                                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                                                StandardCharsets.UTF_8.name());

                                helper.setFrom(fromAddress);
                                helper.setReplyTo(fromAddress);
                                helper.setTo(toEmail.trim());
                                helper.setSubject(subject);
                                helper.setText(textPart, htmlPart);

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

                                activeSender.send(mimeMessage);
                                sent = true;
                                emailLog.setStatus("SENT");
                                log.info("[Zenve Mail] Dispatched appointment email '{}' to: <{}> via direct appointment SMTP", type, toEmail);
                        } catch (Exception ex) {
                                log.warn("[Zenve Mail] Direct auth for appointment mail encountered issue ({}). Engaging verified domain sender with From: {}",
                                                ex.getMessage(), fromAddress.getAddress());
                        }

                        if (!sent) {
                                MimeMessage fallbackMessage = mailSender.createMimeMessage();
                                MimeMessageHelper fallbackHelper = new MimeMessageHelper(
                                                fallbackMessage,
                                                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                                                StandardCharsets.UTF_8.name());

                                fallbackHelper.setFrom(fromAddress);
                                fallbackHelper.setReplyTo(fromAddress);
                                fallbackHelper.setTo(toEmail.trim());
                                fallbackHelper.setSubject(subject);
                                fallbackHelper.setText(textPart, htmlPart);

                                if (htmlPart != null && htmlPart.contains("cid:zenveLogo")) {
                                        byte[] lBytes = getLogoBytes();
                                        if (lBytes != null && lBytes.length > 0) {
                                                fallbackHelper.addInline("zenveLogo", new ByteArrayResource(lBytes), "image/png");
                                        }
                                }

                                if (attachmentBytes != null && attachmentFilename != null && !attachmentFilename.isBlank()) {
                                        fallbackHelper.addAttachment(
                                                        attachmentFilename,
                                                        new ByteArrayResource(attachmentBytes),
                                                        "application/pdf");
                                }

                                mailSender.send(fallbackMessage);
                                emailLog.setStatus("SENT");
                                log.info("[Zenve Mail] Dispatched appointment email '{}' to: <{}> via domain SMTP sender with From: {}",
                                                type, toEmail, fromAddress.getAddress());
                        }
                } catch (Exception ex) {
                        log.error("[Zenve Mail] Failed to send appointment email to <{}>: {}", toEmail, ex.getMessage());
                        emailLog.setStatus("FAILED");
                        emailLog.setErrorMessage("Email delivery failed: " + ex.getMessage());
                }

                EmailLog saved = emailLogRepository.save(emailLog);
                return mapToResponse(saved);
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
        // HTML BUILDERS (Matching Zenve Doctors Brand System)
        // =====================================================

        private String uniqueDispatchRef() {
                return java.util.UUID.randomUUID().toString().substring(0, 8);
        }

        private String buildDoctorRegistrationWelcomeHtml(String doctorName, String email, String clinic, String phone, String appUrl, String senderEmail) {
                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Welcome to Zenve Doctors</title>
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
                                    .feature-box { background-color: #F0FDF4; border: 1px solid #D1FAE5; border-left: 4px solid #10B981; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
                                    .feature-item { margin-bottom: 12px; font-size: 13.5px; color: #1E293B; line-height: 1.55; }
                                    .feature-item:last-child { margin-bottom: 0; }
                                    .feature-item strong { color: #065F46; }
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
                                          <span class="brand-badge">OFFICIAL WELCOME</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">India's Premier Clinical Practice &amp; Doctors Network</p>
                                      </div>
                                      <div class="content">
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Welcome to <strong>Zenve Doctors</strong>! Your practitioner registration has been received. We are excited to welcome you into a dedicated, collaborative ecosystem designed exclusively for healthcare and clinical professionals. Your registration has been submitted to our administration team for credential verification.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Website</td>
                                            <td class="value"><a href="%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Name</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Email</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Mobile Number</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinic / Practice</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Account Status</td>
                                            <td class="value"><span class="status-tag">PENDING ADMIN VERIFICATION ⏳</span></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="feature-box">
                                          <div class="feature-item">
                                            <strong>📅 Smart Appointment Scheduling:</strong> Manage in-clinic consultations, walk-in token queues, and automated patient reminders.
                                          </div>
                                          <div class="feature-item">
                                            <strong>💊 Instant Digital Prescriptions:</strong> Create standardized prescriptions with drug dosages, instructions, and instant branded PDF generation.
                                          </div>
                                          <div class="feature-item">
                                            <strong>🏥 Comprehensive Patient Records (EHR):</strong> Maintain complete clinical histories, previous diagnoses, lab reports, and treatment timelines.
                                          </div>
                                          <div class="feature-item">
                                            <strong>💳 Seamless Billing &amp; Invoicing:</strong> Issue itemized invoices, record consultation fees, and send instant digital receipts.
                                          </div>
                                        </div>

                                        <div class="help-box">
                                          Need assistance or have questions? Our clinical support team is here to assist at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated welcome message was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(appUrl, doctorName, appUrl, appUrl, doctorName, email, email, phone, clinic, senderEmail, senderEmail, appUrl, email, senderEmail, uniqueDispatchRef());
        }

        private String buildDoctorApprovedHtml(String doctorName, String email, String specialty, String clinic, String loginUrl, String appUrl, String senderEmail) {
                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Welcome to Zenve Doctors</title>
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
                                    .feature-box { background-color: #F0FDF4; border: 1px solid #D1FAE5; border-left: 4px solid #10B981; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
                                    .feature-item { margin-bottom: 12px; font-size: 13.5px; color: #1E293B; line-height: 1.55; }
                                    .feature-item:last-child { margin-bottom: 0; }
                                    .feature-item strong { color: #065F46; }
                                    .cta-container { text-align: center; margin: 30px 0 24px 0; }
                                    .cta-btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 34px; border-radius: 8px; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35); letter-spacing: 0.02em; }
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
                                          <span class="brand-badge">OFFICIAL WELCOME</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">India's Premier Clinical Practice &amp; Doctors Network</p>
                                      </div>
                                      <div class="content">
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Welcome to <strong>Zenve Doctors</strong>! Your practitioner account has been successfully created. We are excited to welcome you into a dedicated, collaborative ecosystem designed exclusively for healthcare and clinical professionals.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Website</td>
                                            <td class="value"><a href="%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Name</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Registered Email</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Specialty</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="feature-box">
                                          <div class="feature-item">
                                            <strong>📅 Smart Appointment Scheduling:</strong> Manage in-clinic consultations, walk-in token queues, and automated patient reminders.
                                          </div>
                                          <div class="feature-item">
                                            <strong>💊 Instant Digital Prescriptions:</strong> Create standardized prescriptions with drug dosages, instructions, and instant branded PDF generation.
                                          </div>
                                          <div class="feature-item">
                                            <strong>🏥 Comprehensive Patient Records (EHR):</strong> Maintain complete clinical histories, previous diagnoses, lab reports, and treatment timelines.
                                          </div>
                                          <div class="feature-item">
                                            <strong>💳 Seamless Billing &amp; Invoicing:</strong> Issue itemized invoices, record consultation fees, and send instant digital receipts.
                                          </div>
                                        </div>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">Access Your Zenve Doctors Account &rarr;</a>
                                        </div>

                                        <div class="help-box">
                                          Need assistance or have questions? Our clinical support team is here to assist at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated welcome message was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(appUrl, doctorName, appUrl, appUrl, doctorName, email, email, specialty, senderEmail, senderEmail, loginUrl, appUrl, email, senderEmail, uniqueDispatchRef());
        }

        private String buildPasswordResetOtpHtml(String recipientName, String email, String otpCode, int expiryMinutes,
                        String appUrl, String senderEmail) {
                String spacedOtp = otpCode != null ? String.join("  ", otpCode.split("")) : "• • • • • •";

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Security Verification - Zenve Doctors</title>
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
                                    .otp-card { background-color: #F0FDF4; border: 2px dashed #0D9488; border-radius: 12px; padding: 24px 20px; text-align: center; margin: 24px 0; }
                                    .otp-label { display: block; font-size: 12px; font-weight: 700; color: #065F46; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
                                    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0D9488; margin: 8px 0; }
                                    .otp-meta { display: inline-block; font-size: 12px; color: #047857; margin-top: 6px; font-weight: 600; background: #D1FAE5; padding: 4px 14px; border-radius: 12px; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                                    .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                                    .status-tag { display: inline-block; background: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; letter-spacing: 0.02em; border: 1px solid #FDE68A; }
                                    .alert-box { background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 24px 0; font-size: 13px; color: #92400E; line-height: 1.55; }
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
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">Practice Management &amp; Clinical Security</p>
                                      </div>
                                      <div class="content">
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          We received a request to reset the password for your <strong>Zenve Doctors</strong> practitioner account. Please use the One-Time Password (OTP) verification code below to authorize this request and set your new password.
                                        </p>

                                        <div class="otp-card">
                                          <span class="otp-label">Verification Code (OTP)</span>
                                          <div class="otp-code">%s</div>
                                          <span class="otp-meta">⏳ Valid for %d minutes &nbsp;|&nbsp; Single-use only</span>
                                        </div>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Account Email</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Security Action</td>
                                            <td class="value"><strong>Password Reset Verification</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Code Validity</td>
                                            <td class="value">%d Minutes</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Security Status</td>
                                            <td class="value"><span class="status-tag">PENDING CONFIRMATION 🔒</span></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Portal</td>
                                            <td class="value"><a href="%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="alert-box">
                                          ⚠️ <strong>Security Notice:</strong> If you did not initiate this password reset request, please disregard this email. Your password and account remain completely safe and protected.
                                        </div>

                                        <div class="help-box">
                                          Need assistance or suspect unauthorized access? Our clinical support team is here to assist at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated security verification was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(appUrl, recipientName, spacedOtp, expiryMinutes, email, email, expiryMinutes, senderEmail, senderEmail, appUrl, appUrl, appUrl, email, senderEmail, uniqueDispatchRef());
        }

        private String buildPasswordChangedSuccessHtml(String recipientName, String email, String timestamp,
                        String appUrl, String senderEmail) {
                String loginUrl = appUrl.endsWith("/") ? (appUrl + "login") : (appUrl + "/login");

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Password Changed Successfully - Zenve Doctors</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #00875A 0%%, #059669 50%%, #0D9488 100%%); padding: 38px 24px 34px 24px; text-align: center; color: #FFFFFF; }
                                    .logo-badge { background-color: #FFFFFF; border-radius: 12px; display: inline-block; padding: 10px 22px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.5); }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 5px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
                                    .brand-title { margin: 12px 0 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; }
                                    .brand-subtitle { margin: 8px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 400; color: #E6FFFA; }
                                    .content { padding: 34px 28px; line-height: 1.65; color: #334155; }
                                    .status-badge { display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; line-height: 1.6; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                                    .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                                    .status-tag { display: inline-block; background: #ECFDF5; color: #047857; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; letter-spacing: 0.02em; border: 1px solid #A7F3D0; }
                                    .cta-container { text-align: center; margin: 30px 0 24px 0; }
                                    .cta-btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 34px; border-radius: 8px; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35); letter-spacing: 0.02em; }
                                    .danger-box { background-color: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #EF4444; border-radius: 8px; padding: 14px 18px; margin: 24px 0 10px 0; font-size: 13px; color: #991B1B; line-height: 1.55; }
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
                                          <span class="brand-badge">SECURITY CONFIRMATION</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">Account Security &amp; Practice Protection</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">✓ PASSWORD UPDATED SUCCESSFULLY</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          This notification confirms that the password for your <strong>Zenve Doctors</strong> practitioner account registered under <strong>%s</strong> was successfully updated.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Account Email</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Updated On</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Security Status</td>
                                            <td class="value"><span class="status-tag">ACTIVE &amp; SECURED</span></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Encryption Standard</td>
                                            <td class="value">TLS 1.3 / End-to-End Encrypted</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Portal</td>
                                            <td class="value"><a href="%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">Sign In to Your Account &rarr;</a>
                                        </div>

                                        <div class="danger-box">
                                          ⚠️ <strong>Didn't authorize this change?</strong> If you did not make this change, please reset your password immediately or contact our clinical security team at <a href="mailto:support@zenvevet.com" style="color: #991B1B; font-weight: 700; text-decoration: underline;">support@zenvevet.com</a>.
                                        </div>

                                        <div class="help-box">
                                          Need assistance? Our clinical support team is here to assist at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated security confirmation was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(appUrl, recipientName, email, email, email, timestamp, senderEmail, senderEmail, appUrl, appUrl, loginUrl, appUrl, email, senderEmail, uniqueDispatchRef());
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
                        String attachmentFilename,
                        String appUrl,
                        String toEmail,
                        String senderEmail) {

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Prescription for %s - Zenve Doctors</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #00875A 0%%, #059669 50%%, #0D9488 100%%); padding: 38px 24px 34px 24px; text-align: center; color: #FFFFFF; }
                                    .logo-badge { background-color: #FFFFFF; border-radius: 12px; display: inline-block; padding: 10px 22px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.5); }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 5px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
                                    .brand-title { margin: 12px 0 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; }
                                    .brand-subtitle { margin: 8px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 400; color: #E6FFFA; }
                                    .content { padding: 34px 28px; line-height: 1.65; color: #334155; }
                                    .status-badge { display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; line-height: 1.6; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                                    .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                                    .feature-box { background-color: #F0FDF4; border: 1px solid #D1FAE5; border-left: 4px solid #10B981; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
                                    .notes-box { background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 22px 0; font-size: 13px; color: #92400E; line-height: 1.55; }
                                    .attachment-box { background-color: #F0FDF4; border: 2px dashed #0D9488; border-radius: 10px; padding: 18px 20px; margin: 22px 0; text-align: center; }
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
                                          <span class="brand-badge">OFFICIAL PRESCRIPTION</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">%s &nbsp;|&nbsp; Certified Clinical Prescription</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">📎 OFFICIAL PRESCRIPTION PDF ATTACHED</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Dr. <strong>%s</strong> from <strong>%s</strong> has issued an official clinical prescription for <strong>%s</strong> on %s.
                                        </p>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Patient Name</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Guardian / Owner</td>
                                            <td class="value">%s</td>
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
                                            <td class="label">Consultation Date</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinical Diagnosis</td>
                                            <td class="value"><strong style="color: #0D9488;">%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Follow-Up Date</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                        </table>

                                        %s

                                        <div class="attachment-box">
                                          <div style="font-weight: 700; color: #065F46; font-size: 14.5px; margin-bottom: 4px;">📎 Attached: %s</div>
                                          <div style="font-size: 12.5px; color: #047857; line-height: 1.5;">Complete printable digital prescription with clinic header, valid license certification, and doctor signature. Ready for pharmacy dispensing.</div>
                                        </div>

                                        <table class="details-table" style="margin-top: 18px;">
                                          <tr>
                                            <td class="label">Clinic Phone</td>
                                            <td class="value"><a href="tel:%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Clinic Address</td>
                                            <td class="value">%s</td>
                                          </tr>
                                        </table>

                                        <div class="help-box">
                                          Need assistance or have prescription queries? Contact <strong>%s</strong> or email our clinical support at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This official prescription was sent to <strong style="color: #94A3B8;">%s</strong> on behalf of <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(
                                                petName,
                                                appUrl,
                                                clinicName,
                                                ownerName, doctorName, clinicName, petName, dateStr,
                                                petName, ownerName, doctorName, clinicName, dateStr,
                                                diagnosis != null ? diagnosis : "General Health Examination",
                                                followUpDate != null && !followUpDate.isBlank() ? followUpDate : "As needed",
                                                senderEmail, senderEmail,
                                                (instructions != null && !instructions.isBlank())
                                                                ? ("<div class='notes-box'><strong>Care Instructions &amp; Advice:</strong><br>"
                                                                                + instructions + "</div>")
                                                                : "",
                                                attachmentFilename,
                                                clinicPhone != null ? clinicPhone : "—",
                                                clinicPhone != null ? clinicPhone : "—",
                                                clinicAddress != null ? clinicAddress : "Zenve Clinical Network",
                                                clinicName,
                                                appUrl,
                                                toEmail,
                                                clinicName,
                                                uniqueDispatchRef());
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
                        String appUrl,
                        String toEmail,
                        String senderEmail) {

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Payment Receipt - %s - Zenve Doctors</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #00875A 0%%, #059669 50%%, #0D9488 100%%); padding: 38px 24px 34px 24px; text-align: center; color: #FFFFFF; }
                                    .logo-badge { background-color: #FFFFFF; border-radius: 12px; display: inline-block; padding: 10px 22px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.5); }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 5px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
                                    .brand-title { margin: 12px 0 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; }
                                    .brand-subtitle { margin: 8px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 400; color: #E6FFFA; }
                                    .content { padding: 34px 28px; line-height: 1.65; color: #334155; }
                                    .status-badge { display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; line-height: 1.6; }
                                    .amount-card { background-color: #F0FDF4; border: 1px solid #D1FAE5; border-radius: 12px; padding: 22px 20px; text-align: center; margin: 24px 0; }
                                    .amount-label { font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
                                    .amount-val { font-size: 38px; font-weight: 800; color: #065F46; margin: 6px 0; }
                                    .amount-mode { display: inline-block; background: #D1FAE5; color: #065F46; padding: 4px 14px; border-radius: 14px; font-size: 12px; font-weight: 600; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                                    .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                                    .status-tag { display: inline-block; background: #ECFDF5; color: #047857; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; letter-spacing: 0.02em; border: 1px solid #A7F3D0; }
                                    .cta-container { text-align: center; margin: 30px 0 24px 0; }
                                    .cta-btn { display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 13px 34px; border-radius: 8px; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35); letter-spacing: 0.02em; }
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
                                          <span class="brand-badge">OFFICIAL PAYMENT RECEIPT</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">%s &nbsp;|&nbsp; Billing &amp; Practice Network</p>
                                      </div>
                                      <div class="content">
                                        <div class="status-badge">✓ PAYMENT RECEIVED SUCCESSFULLY</div>
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          Thank you for your payment. This email confirms that we have successfully received payment for <strong>%s</strong> at <strong>%s</strong>.
                                        </p>

                                        <div class="amount-card">
                                          <div class="amount-label">Amount Paid</div>
                                          <div class="amount-val">₹%s</div>
                                          <div class="amount-mode">Payment Mode: %s</div>
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
                                            <td class="label">Patient Name</td>
                                            <td class="value"><strong>%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Billed To</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Date &amp; Time</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Total Invoice Amount</td>
                                            <td class="value">₹%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Remaining Balance Due</td>
                                            <td class="value"><strong style="color: #D97706;">₹%s</strong></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Payment Status</td>
                                            <td class="value"><span class="status-tag">SUCCESS ✓</span></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                        </table>

                                        <div class="cta-container">
                                          <a href="%s" class="cta-btn">View Invoice &amp; Medical Records &rarr;</a>
                                        </div>

                                        <div class="help-box">
                                          Need billing assistance or have questions? Contact <strong>%s</strong> or email our billing support team at <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated payment receipt was sent to <strong style="color: #94A3B8;">%s</strong> on behalf of <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(
                                                clinicName,
                                                appUrl,
                                                clinicName,
                                                ownerName, petName, clinicName,
                                                amountPaid, paymentMethod,
                                                transactionId, invoiceNumber, petName, ownerName, timeStr, totalAmount, dueAmount,
                                                senderEmail, senderEmail,
                                                appUrl,
                                                clinicName,
                                                appUrl,
                                                toEmail,
                                                clinicName,
                                                uniqueDispatchRef());
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
                        String appUrl,
                        String toEmail,
                        String senderEmail) {

                String breedText = (breed != null && !breed.isBlank()) ? (" • " + breed) : "";
                String speciesText = (species != null && !species.isBlank()) ? species : "Patient";
                String reasonText = (reason != null && !reason.isBlank()) ? reason : "General Health Consultation";
                String addressText = (clinicAddress != null && !clinicAddress.isBlank()) ? clinicAddress : "Clinic Premises";
                String phoneText = (clinicPhone != null && !clinicPhone.isBlank()) ? clinicPhone : "Available in portal";
                String notesHtml = (notes != null && !notes.isBlank())
                                ? String.format("<div class=\"notes-box\"><strong>Doctor's / Clinical Notes:</strong><br>%s</div>", notes)
                                : "";

                boolean isCancelled = "Cancelled".equalsIgnoreCase(status);
                boolean isRescheduled = "Rescheduled".equalsIgnoreCase(status);

                String badgeText = isCancelled ? "APPOINTMENT CANCELLED"
                                : isRescheduled ? "APPOINTMENT RESCHEDULED"
                                : "APPOINTMENT CONFIRMATION";

                String statusBadgeHtml = isCancelled
                                ? "<div style=\"display: inline-block; background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px;\">✕ APPOINTMENT CANCELLED</div>"
                                : isRescheduled
                                ? "<div style=\"display: inline-block; background: #FEF3C7; border: 1px solid #FDE68A; color: #D97706; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px;\">🔄 APPOINTMENT RESCHEDULED</div>"
                                : "<div class=\"status-badge\">✓ APPOINTMENT " + (status != null ? status.toUpperCase() : "CONFIRMED") + "</div>";

                String statusTagHtml = isCancelled
                                ? "<span class=\"status-tag\" style=\"background: #FEF2F2; color: #DC2626; border-color: #FECACA;\">CANCELLED</span>"
                                : isRescheduled
                                ? "<span class=\"status-tag\" style=\"background: #FEF3C7; color: #D97706; border-color: #FDE68A;\">RESCHEDULED</span>"
                                : "<span class=\"status-tag\" style=\"background: #ECFDF5; color: #047857; border-color: #A7F3D0;\">" + (status != null ? status.toUpperCase() : "CONFIRMED") + "</span>";

                String introText = isCancelled
                                ? String.format("Your scheduled appointment for <strong>%s</strong> with <strong>%s</strong> at <strong>%s</strong> has been cancelled.", petName, doctorName, clinicName)
                                : isRescheduled
                                ? String.format("Your appointment for <strong>%s</strong> with <strong>%s</strong> at <strong>%s</strong> has been rescheduled to the updated date and time below.", petName, doctorName, clinicName)
                                : String.format("Your appointment for <strong>%s</strong> has been successfully booked with <strong>%s</strong> at <strong>%s</strong>.", petName, doctorName, clinicName);

                return """
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Appointment - %s - Zenve Doctors</title>
                                  <style>
                                    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
                                    .wrapper { width: 100%%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
                                    .header { background: linear-gradient(135deg, #00875A 0%%, #059669 50%%, #0D9488 100%%); padding: 38px 24px 34px 24px; text-align: center; color: #FFFFFF; }
                                    .logo-badge { background-color: #FFFFFF; border-radius: 12px; display: inline-block; padding: 10px 22px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.5); }
                                    .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 20px; padding: 5px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
                                    .brand-title { margin: 12px 0 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; }
                                    .brand-subtitle { margin: 8px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 400; color: #E6FFFA; }
                                    .content { padding: 34px 28px; line-height: 1.65; color: #334155; }
                                    .status-badge { display: inline-block; background: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 16px; margin-bottom: 16px; }
                                    .greeting { font-size: 19px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
                                    .intro { font-size: 14.5px; color: #475569; margin-bottom: 22px; line-height: 1.6; }
                                    .date-card { background-color: #F0FDF4; border: 2px solid #0D9488; border-radius: 12px; padding: 20px; text-align: center; margin: 22px 0; }
                                    .date-main { font-size: 21px; font-weight: 800; color: #065F46; margin-bottom: 6px; }
                                    .time-sub { font-size: 15px; font-weight: 700; color: #0D9488; }
                                    .details-table { width: 100%%; border-collapse: collapse; margin: 22px 0; font-size: 13.5px; background: #F8FAFC; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
                                    .details-table td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; }
                                    .details-table tr:last-child td { border-bottom: none; }
                                    .details-table .label { color: #475569; font-weight: 600; width: 38%%; font-size: 13px; }
                                    .details-table .value { color: #0F172A; font-weight: 500; font-size: 13.5px; }
                                    .status-tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; letter-spacing: 0.02em; border: 1px solid transparent; }
                                    .feature-box { background-color: #F0FDF4; border: 1px solid #D1FAE5; border-left: 4px solid #10B981; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
                                    .notes-box { background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #92400E; line-height: 1.55; }
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
                                          <span class="brand-badge">%s</span>
                                        </div>
                                        <h1 class="brand-title">Zenve Doctors</h1>
                                        <p class="brand-subtitle">%s &nbsp;|&nbsp; Clinical Healthcare Network</p>
                                      </div>
                                      <div class="content">
                                        %s
                                        <div class="greeting">Dear %s,</div>
                                        <p class="intro">
                                          %s
                                        </p>

                                        <div class="date-card">
                                          <div class="date-main">%s</div>
                                          <div class="time-sub">⏰ %s &nbsp;|&nbsp; %s</div>
                                        </div>

                                        <table class="details-table">
                                          <tr>
                                            <td class="label">Patient Name</td>
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
                                            <td class="value"><a href="tel:%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a></td>
                                          </tr>
                                          <tr>
                                            <td class="label">Reason for Visit</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Appointment Status</td>
                                            <td class="value">%s</td>
                                          </tr>
                                          <tr>
                                            <td class="label">Sender</td>
                                            <td class="value"><a href="mailto:%s" style="color: #0D9488; text-decoration: underline;">%s</a></td>
                                          </tr>
                                        </table>

                                        %s

                                        <div class="feature-box">
                                          <div style="font-weight: 700; color: #065F46; margin-bottom: 8px; font-size: 13.5px;">📋 Important Appointment Checklist:</div>
                                          <ul style="margin: 0; padding-left: 18px; line-height: 1.7; font-size: 13px; color: #1E293B;">
                                            <li>Please arrive 10 minutes prior to your scheduled consultation time.</li>
                                            <li>Bring any previous medical reports, prescriptions, or investigation records.</li>
                                            <li>Carry a valid photo ID and this appointment confirmation for smooth check-in.</li>
                                            <li>If you need to reschedule or have questions, please contact %s.</li>
                                          </ul>
                                        </div>

                                        <div class="help-box">
                                          Need assistance or have questions? Contact <strong>%s</strong> at <a href="tel:%s" style="color: #0D9488; text-decoration: underline; font-weight: 600;">%s</a> or email <a href="mailto:support@zenvevet.com" style="color: #0D9488; text-decoration: underline; font-weight: 600;">support@zenvevet.com</a>.
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
                                          This automated appointment notification was sent to <strong style="color: #94A3B8;">%s</strong> from <strong style="color: #94A3B8;">%s</strong>.<br>
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
                                """
                                .formatted(
                                                clinicName,
                                                appUrl,
                                                badgeText,
                                                clinicName,
                                                statusBadgeHtml,
                                                ownerName,
                                                introText,
                                                dateFormatted, timeFormatted, appointmentType,
                                                petName, speciesText, breedText,
                                                doctorName, clinicName, addressText, phoneText, phoneText,
                                                reasonText, statusTagHtml,
                                                senderEmail, senderEmail,
                                                notesHtml,
                                                clinicName,
                                                clinicName, phoneText, phoneText,
                                                appUrl,
                                                toEmail,
                                                senderEmail,
                                                uniqueDispatchRef());
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