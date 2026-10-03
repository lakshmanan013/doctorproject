package doctor.backend.dto.auth;

public class VerifyPhoneOtpResponse {

    private boolean verified;
    private String message;
    private String phone;

    public VerifyPhoneOtpResponse() {
    }

    public VerifyPhoneOtpResponse(boolean verified, String message, String phone) {
        this.verified = verified;
        this.message = message;
        this.phone = phone;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }
}
