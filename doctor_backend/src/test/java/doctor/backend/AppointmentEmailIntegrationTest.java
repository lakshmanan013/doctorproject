package doctor.backend;

import doctor.backend.dto.email.EmailResponse;
import doctor.backend.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class AppointmentEmailIntegrationTest {

    @Autowired
    private EmailService emailService;

    @Test
    void testAppointmentConfirmationEmailSending() {
        EmailResponse response = emailService.sendAppointmentConfirmationEmail(
                "no-replyzenveappointments@zenvevet.com",
                "Rahul Sharma",
                "Buddy",
                "Canine",
                "Golden Retriever",
                "Dr. Sarah Jenkins",
                "Zenve Veterinary Care",
                "123 Green Valley Road, Indiranagar, Bangalore - 560038",
                "+91 9876543210",
                LocalDate.now().plusDays(2),
                LocalTime.of(11, 0),
                "In Clinic Consultation",
                "Annual Wellness Exam & DHPPiL Booster",
                "Please bring previous vaccination passport",
                "Confirmed"
        );

        assertNotNull(response);
        assertEquals("SENT", response.getStatus(), "Email delivery should be SENT but got: " + response.getErrorMessage());
        assertEquals("APPOINTMENT_BOOKING", response.getType());
    }

    @Test
    void testAppointmentRescheduledEmailSending() {
        EmailResponse response = emailService.sendAppointmentConfirmationEmail(
                "no-replyzenveappointments@zenvevet.com",
                "Priya Verma",
                "Milo",
                "Feline",
                "Persian Cat",
                "Dr. Sarah Jenkins",
                "Zenve Veterinary Care",
                "123 Green Valley Road, Indiranagar, Bangalore - 560038",
                "+91 9876543210",
                LocalDate.now().plusDays(3),
                LocalTime.of(16, 30),
                "In Clinic Consultation",
                "Routine Dental Scaling & Checkup",
                "Fast pet for 8 hours prior to appointment",
                "Rescheduled"
        );

        assertNotNull(response);
        assertEquals("SENT", response.getStatus(), "Email delivery should be SENT but got: " + response.getErrorMessage());
        assertEquals("APPOINTMENT_RESCHEDULED", response.getType());
    }
}
