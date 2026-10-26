package doctor.backend;

import doctor.backend.dto.email.EmailResponse;
import doctor.backend.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class DoctorEmailIntegrationTest {

    @Autowired
    private EmailService emailService;

    @Test
    void testDoctorRegistrationWelcomeEmail() {
        EmailResponse response = emailService.sendDoctorRegistrationWelcomeEmail(
                "no-replyzenvedoctors@zenvevet.com",
                "Dr. Sarah Jenkins",
                "Zenve Companion Animal Hospital",
                "+91 9876543210"
        );

        assertNotNull(response);
        assertEquals("SENT", response.getStatus(), "Email delivery should be SENT but got: " + response.getErrorMessage());
        assertEquals("DOCTOR_REGISTRATION_WELCOME", response.getType());
    }

    @Test
    void testDoctorApprovedEmail() {
        EmailResponse response = emailService.sendDoctorApprovedEmail(
                "no-replyzenvedoctors@zenvevet.com",
                "Dr. Sarah Jenkins",
                "Small Animal Internal Medicine",
                "Zenve Companion Animal Hospital"
        );

        assertNotNull(response);
        assertEquals("SENT", response.getStatus(), "Email delivery should be SENT but got: " + response.getErrorMessage());
        assertEquals("DOCTOR_APPROVED", response.getType());
    }
}
