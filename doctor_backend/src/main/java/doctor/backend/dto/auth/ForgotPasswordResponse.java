package doctor.backend.dto.auth;

public class ForgotPasswordResponse {

    private String message;

    // Identifies this OTP session. On its own it does NOT authorize a
    // password change - verifyOtp() must also succeed before
    // resetPassword() will accept it (see AuthService).
    private String resetToken;
    private String email;
    private String maskedEmail;
    private String maskedPhone;

    public ForgotPasswordResponse() {
    }

    public ForgotPasswordResponse(String message, String resetToken) {
        this.message = message;
        this.resetToken = resetToken;
    }

    public ForgotPasswordResponse(String message, String resetToken, String email, String maskedEmail, String maskedPhone) {
        this.message = message;
        this.resetToken = resetToken;
        this.email = email;
        this.maskedEmail = maskedEmail;
        this.maskedPhone = maskedPhone;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getResetToken() {
        return resetToken;
    }

    public void setResetToken(String resetToken) {
        this.resetToken = resetToken;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMaskedEmail() {
        return maskedEmail;
    }

    public void setMaskedEmail(String maskedEmail) {
        this.maskedEmail = maskedEmail;
    }

    public String getMaskedPhone() {
        return maskedPhone;
    }

    public void setMaskedPhone(String maskedPhone) {
        this.maskedPhone = maskedPhone;
    }
}
