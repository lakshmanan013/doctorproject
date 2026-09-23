
package doctor.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    private String fullName;

    @Column(unique = true)
    private String phone;

    private String role; // DOCTOR, ADMIN, RECEPTIONIST, NURSE

    private boolean active = true;

    // =========================
    // Admin approval
    // =========================

    // "PENDING", "APPROVED", "REJECTED". Defaults to PENDING on new
    // doctor registrations. Defaulting in Java rather than a DB column
    // DEFAULT keeps hibernate ddl-auto=update happy when adding the
    // column to a "users" table that may already have rows. AuthService
    // treats a null value the same as PENDING.
    private String approvalStatus = "PENDING";

    private String rejectionReason;

    // =========================
    // Password reset
    // =========================

    private String resetToken;

    private LocalDateTime resetTokenExpiry;

    private boolean emailVerified = false;

    private boolean phoneVerified = false;

    private String otp;

    private LocalDateTime otpExpiry;

    // True once verifyOtp() has accepted the correct OTP for the
    // current resetToken. resetPassword() refuses to run without this,
    // so a resetToken alone (leaked/guessed) is never enough to change
    // the password - the OTP step must also have been passed.
    private boolean otpVerified = false;

    // =========================
    // Image & Upload fields
    // =========================

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String profileImage;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String clinicInsideImage;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String clinicOutsideImage;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String digitalSignatureImage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(String approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getResetToken() {
        return resetToken;
    }

    public void setResetToken(String resetToken) {
        this.resetToken = resetToken;
    }

    public LocalDateTime getResetTokenExpiry() {
        return resetTokenExpiry;
    }

    public void setResetTokenExpiry(LocalDateTime resetTokenExpiry) {
        this.resetTokenExpiry = resetTokenExpiry;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public boolean isPhoneVerified() {
        return phoneVerified;
    }

    public void setPhoneVerified(boolean phoneVerified) {
        this.phoneVerified = phoneVerified;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }

    public LocalDateTime getOtpExpiry() {
        return otpExpiry;
    }

    public void setOtpExpiry(LocalDateTime otpExpiry) {
        this.otpExpiry = otpExpiry;
    }

    public boolean isOtpVerified() {
        return otpVerified;
    }

    public void setOtpVerified(boolean otpVerified) {
        this.otpVerified = otpVerified;
    }

    public String getProfileImage() {
        return profileImage;
    }

    public void setProfileImage(String profileImage) {
        this.profileImage = profileImage;
    }

    public String getClinicInsideImage() {
        return clinicInsideImage;
    }

    public void setClinicInsideImage(String clinicInsideImage) {
        this.clinicInsideImage = clinicInsideImage;
    }

    public String getClinicOutsideImage() {
        return clinicOutsideImage;
    }

    public void setClinicOutsideImage(String clinicOutsideImage) {
        this.clinicOutsideImage = clinicOutsideImage;
    }

    public String getDigitalSignatureImage() {
        return digitalSignatureImage;
    }

    public void setDigitalSignatureImage(String digitalSignatureImage) {
        this.digitalSignatureImage = digitalSignatureImage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
