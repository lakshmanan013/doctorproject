package doctor.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.messaging")
public class MessagingProperties {

    // Provider options: AUTO, FAST2SMS, MSG91, GENERIC_HTTP, MOCK
    private String smsProvider = "AUTO";
    private String smsApiKey = "";
    private String smsSenderId = "ZENVE";
    private String smsApiUrl = "";
    private String smsRoute = "otp"; // "otp" or "q" for fast2sms / others

    private String whatsappProvider = "AUTO";
    private String whatsappApiKey = "";
    private String whatsappPhoneNumberId = "";
    private String whatsappApiUrl = "";
    private String whatsappFrom = "";

    public boolean isSmsConfigured() {
        return (smsApiKey != null && !smsApiKey.isBlank()) || (smsApiUrl != null && !smsApiUrl.isBlank());
    }

    public boolean isWhatsAppConfigured() {
        return (whatsappApiKey != null && !whatsappApiKey.isBlank()) || (whatsappApiUrl != null && !whatsappApiUrl.isBlank());
    }

    public String getSmsProvider() {
        return smsProvider;
    }

    public void setSmsProvider(String smsProvider) {
        this.smsProvider = smsProvider;
    }

    public String getSmsApiKey() {
        return smsApiKey;
    }

    public void setSmsApiKey(String smsApiKey) {
        this.smsApiKey = smsApiKey;
    }

    public String getSmsSenderId() {
        return smsSenderId;
    }

    public void setSmsSenderId(String smsSenderId) {
        this.smsSenderId = smsSenderId;
    }

    public String getSmsApiUrl() {
        return smsApiUrl;
    }

    public void setSmsApiUrl(String smsApiUrl) {
        this.smsApiUrl = smsApiUrl;
    }

    public String getSmsRoute() {
        return smsRoute;
    }

    public void setSmsRoute(String smsRoute) {
        this.smsRoute = smsRoute;
    }

    public String getWhatsappProvider() {
        return whatsappProvider;
    }

    public void setWhatsappProvider(String whatsappProvider) {
        this.whatsappProvider = whatsappProvider;
    }

    public String getWhatsappApiKey() {
        return whatsappApiKey;
    }

    public void setWhatsappApiKey(String whatsappApiKey) {
        this.whatsappApiKey = whatsappApiKey;
    }

    public String getWhatsappPhoneNumberId() {
        return whatsappPhoneNumberId;
    }

    public void setWhatsappPhoneNumberId(String whatsappPhoneNumberId) {
        this.whatsappPhoneNumberId = whatsappPhoneNumberId;
    }

    public String getWhatsappApiUrl() {
        return whatsappApiUrl;
    }

    public void setWhatsappApiUrl(String whatsappApiUrl) {
        this.whatsappApiUrl = whatsappApiUrl;
    }

    public String getWhatsappFrom() {
        return whatsappFrom;
    }

    public void setWhatsappFrom(String whatsappFrom) {
        this.whatsappFrom = whatsappFrom;
    }
}
