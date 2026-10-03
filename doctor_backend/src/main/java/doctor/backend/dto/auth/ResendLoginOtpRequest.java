package doctor.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;

public class ResendLoginOtpRequest {

    private String email;

    @NotBlank(message = "Login session token is required")
    private String loginSessionToken;

    public ResendLoginOtpRequest() {
    }

    public ResendLoginOtpRequest(String email, String loginSessionToken) {
        this.email = email;
        this.loginSessionToken = loginSessionToken;
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
}
