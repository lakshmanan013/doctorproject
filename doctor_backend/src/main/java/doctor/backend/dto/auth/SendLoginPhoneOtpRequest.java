package doctor.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class SendLoginPhoneOtpRequest {

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^[0-9+\\-\\s]{7,15}$", message = "Enter a valid phone number")
    private String phone;

    public SendLoginPhoneOtpRequest() {
    }

    public SendLoginPhoneOtpRequest(String phone) {
        this.phone = phone;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }
}
