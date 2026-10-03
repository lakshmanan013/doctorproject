package doctor.backend.dto.auth;

public class SendPhoneOtpResponse {

    private boolean success;
    private String message;
    private String phone;
    private String otp; // Present only in demo/dev mode when SMS provider is not active

    public SendPhoneOtpResponse() {
    }

    public SendPhoneOtpResponse(boolean success, String message, String phone) {
        this.success = success;
        this.message = message;
        this.phone = phone;
    }

    public SendPhoneOtpResponse(boolean success, String message, String phone, String otp) {
        this.success = success;
        this.message = message;
        this.phone = phone;
        this.otp = otp;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
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

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
