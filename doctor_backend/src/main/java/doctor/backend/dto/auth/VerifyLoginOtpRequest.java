package doctor.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;

public class VerifyLoginOtpRequest {

    private String email;

    @NotBlank(message = "Login session token is required")
    private String loginSessionToken;

    @NotBlank(message = "OTP is required")
    private String otp;

    public VerifyLoginOtpRequest() {
    }

    public VerifyLoginOtpRequest(String email, String loginSessionToken, String otp) {
        this.email = email;
        this.loginSessionToken = loginSessionToken;
        this.otp = otp;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getLoginSessionToken() {
        return loginSessionToken;
    }

    public void setLoginSessionToken(String loginSessionToken) {
        this.loginSessionToken = loginSessionToken;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
