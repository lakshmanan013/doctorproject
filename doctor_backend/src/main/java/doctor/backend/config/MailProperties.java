package doctor.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {

    /** From address used on outbound emails. */
    private String from = "no-replyzenvedoctors@zenvevet.com";

    /** Sender name display. */
    private String senderName = "Zenve Doctors";

    /** Public portal website link. */
    private String appUrl = "https://doctor.zenvevet.com";

    // ===================================================================
    // DEDICATED APPOINTMENT OUTBOUND MAIL SETTINGS (SMTPS PORT 465)
    // ===================================================================

    private String appointmentHost = "mail.zenvevet.com";

    private int appointmentPort = 465;

    private String appointmentUsername = "no-replyzenveappointments@zenvevet.com";

    private String appointmentPassword = "zenveappointments@zenve123";

    private String appointmentFrom = "no-replyzenveappointments@zenvevet.com";

    private String appointmentSenderName = "Zenve Appointments";

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getAppUrl() {
        return appUrl;
    }

    public void setAppUrl(String appUrl) {
        this.appUrl = appUrl;
    }

    public String getAppointmentHost() {
        return appointmentHost;
    }

    public void setAppointmentHost(String appointmentHost) {
        this.appointmentHost = appointmentHost;
    }

    public int getAppointmentPort() {
        return appointmentPort;
    }

    public void setAppointmentPort(int appointmentPort) {
        this.appointmentPort = appointmentPort;
    }

    public String getAppointmentUsername() {
        return appointmentUsername;
    }

    public void setAppointmentUsername(String appointmentUsername) {
        this.appointmentUsername = appointmentUsername;
    }

    public String getAppointmentPassword() {
        return appointmentPassword;
    }

    public void setAppointmentPassword(String appointmentPassword) {
        this.appointmentPassword = appointmentPassword;
    }

    public String getAppointmentFrom() {
        return appointmentFrom;
    }

    public void setAppointmentFrom(String appointmentFrom) {
        this.appointmentFrom = appointmentFrom;
    }

    public String getAppointmentSenderName() {
        return appointmentSenderName;
    }

    public void setAppointmentSenderName(String appointmentSenderName) {
        this.appointmentSenderName = appointmentSenderName;
    }
}
