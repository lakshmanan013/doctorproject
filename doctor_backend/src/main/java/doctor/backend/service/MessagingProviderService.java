package doctor.backend.service;

import doctor.backend.config.MessagingProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.*;

@Service
public class MessagingProviderService {

    private static final Logger log = LoggerFactory.getLogger(MessagingProviderService.class);

    private final MessagingProperties properties;
    private final RestTemplate restTemplate;

    public MessagingProviderService(
            MessagingProperties properties,
            RestTemplate restTemplate) {
        this.properties = properties;
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return properties.isSmsConfigured() || properties.isWhatsAppConfigured();
    }

    public boolean isSmsConfigured() {
        return properties.isSmsConfigured();
    }

    public boolean isWhatsAppConfigured() {
        return properties.isWhatsAppConfigured();
    }

    // =====================================================
    // SEND OTP (SMS)
    // =====================================================

    public String sendOtp(String rawPhone, String otp) {
        String cleanPhone = rawPhone.replaceAll("[^0-9]", "");
        String provider = resolveSmsProvider();

        log.info("Sending OTP {} to {} via provider [{}]", otp, cleanPhone, provider);

        try {
            switch (provider.toUpperCase()) {
                case "APITXT":
                    return sendApiTxtOtp(cleanPhone, otp);

                case "FAST2SMS":
                    return sendFast2SmsOtp(cleanPhone, otp);

                case "MSG91":
                    return sendMsg91Otp(cleanPhone, otp);

                case "GENERIC_HTTP":
                    return sendGenericHttp(properties.getSmsApiUrl(), properties.getSmsApiKey(), Map.of(
                            "phone", cleanPhone,
                            "otp", otp,
                            "type", "OTP",
                            "message", "Your verification OTP is " + otp
                    ));

                default:
                    break;
            }
        } catch (Exception ex) {
            log.error("Failed to send OTP to {} via {}: {}", cleanPhone, provider, ex.getMessage());
            throw new RuntimeException("SMS send failed: " + ex.getMessage());
        }

        // Development / Mock fallback
        log.info("[MOCK SMS GATEWAY] To: {} | OTP: {} | Status: SIMULATED_SENT", cleanPhone, otp);
        return "MOCK_OTP_" + UUID.randomUUID().toString().substring(0, 8);
    }

    // =====================================================
    // SEND SMS (General / Prescription / Followup)
    // =====================================================

    public String sendSms(String rawPhone, String message) {
        String cleanPhone = rawPhone.replaceAll("[^0-9]", "");
        String provider = resolveSmsProvider();

        log.info("Sending SMS to {} via provider [{}]", cleanPhone, provider);

        try {
            switch (provider.toUpperCase()) {
                case "APITXT":
                    return sendApiTxtMessage(cleanPhone, message, "sms");

                case "FAST2SMS":
                    return sendFast2SmsQuick(cleanPhone, message);

                case "GENERIC_HTTP":
                    return sendGenericHttp(properties.getSmsApiUrl(), properties.getSmsApiKey(), Map.of(
                            "phone", cleanPhone,
                            "message", message,
                            "type", "SMS"
                    ));

                default:
                    break;
            }
        } catch (Exception ex) {
            log.error("Failed to send SMS to {} via {}: {}", cleanPhone, provider, ex.getMessage());
            throw new RuntimeException("SMS send failed: " + ex.getMessage());
        }

        log.info("[MOCK SMS GATEWAY] To: {} | Msg: {} | Status: SIMULATED_SENT", cleanPhone, message);
        return "MOCK_SMS_" + UUID.randomUUID().toString().substring(0, 8);
    }

    // =====================================================
    // SEND WHATSAPP MESSAGE (Meta Cloud API / APITxT / HTTP Gateway)
    // =====================================================

    public String sendWhatsApp(String rawPhone, String message) {
        String cleanPhone = rawPhone.replaceAll("[^0-9]", "");
        String provider = resolveWhatsAppProvider();

        log.info("Sending WhatsApp message to {} via provider [{}]", cleanPhone, provider);

        try {
            switch (provider.toUpperCase()) {
                case "APITXT":
                    return sendApiTxtMessage(cleanPhone, message, "whatsapp");

                case "META":
                case "WHATSAPP_CLOUD":
                    return sendMetaWhatsApp(cleanPhone, message);

                case "GENERIC_HTTP":
                    return sendGenericHttp(properties.getWhatsappApiUrl(), properties.getWhatsappApiKey(), Map.of(
                            "phone", cleanPhone,
                            "message", message,
                            "type", "WHATSAPP",
                            "from", properties.getWhatsappFrom()
                    ));

                default:
                    break;
            }
        } catch (Exception ex) {
            log.error("Failed to send WhatsApp to {} via {}: {}", cleanPhone, provider, ex.getMessage());
            throw new RuntimeException("WhatsApp send failed: " + ex.getMessage());
        }

        log.info("[MOCK WHATSAPP GATEWAY] To: {} | Msg: {} | Status: SIMULATED_SENT", cleanPhone, message);
        return "MOCK_WA_" + UUID.randomUUID().toString().substring(0, 8);
    }

    // =====================================================
    // APITXT IMPLEMENTATION (https://apitxt.com/api/sendOTP)
    // =====================================================

    private String sendApiTxtOtp(String phone, String otp) {
        String tenDigits = phone.length() > 10 ? phone.substring(phone.length() - 10) : phone;
        String baseUrl = properties.getSmsApiUrl() != null && !properties.getSmsApiUrl().isBlank()
                ? properties.getSmsApiUrl()
                : "https://apitxt.com/api/sendOTP";

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("authkey", properties.getSmsApiKey())
                .queryParam("mobile", tenDigits)
                .queryParam("otp", otp)
                .queryParam("channel", "sms");

        URI targetUri = builder.build().encode().toUri();
        log.info("APITxT sending OTP request to: {}", targetUri);

        ResponseEntity<String> response = restTemplate.getForEntity(targetUri, String.class);
        log.info("APITxT response: {}", response.getBody());

        return "APITXT_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sendApiTxtMessage(String phone, String message, String channel) {
        String tenDigits = phone.length() > 10 ? phone.substring(phone.length() - 10) : phone;
        String baseUrl = properties.getSmsApiUrl() != null && !properties.getSmsApiUrl().isBlank()
                ? properties.getSmsApiUrl()
                : "https://apitxt.com/api/sendOTP";

        String apiKey = channel.equalsIgnoreCase("whatsapp") && properties.getWhatsappApiKey() != null && !properties.getWhatsappApiKey().isBlank()
                ? properties.getWhatsappApiKey()
                : properties.getSmsApiKey();

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("authkey", apiKey)
                .queryParam("mobile", tenDigits)
                .queryParam("channel", channel)
                .queryParam("message", message);

        URI targetUri = builder.build().encode().toUri();
        log.info("APITxT sending message request to: {}", targetUri);

        ResponseEntity<String> response = restTemplate.getForEntity(targetUri, String.class);
        log.info("APITxT response: {}", response.getBody());

        return "APITXT_" + UUID.randomUUID().toString().substring(0, 8);
    }

    // =====================================================
    // OTHER PROVIDERS
    // =====================================================

    private String sendMetaWhatsApp(String rawPhone, String message) {
        String phoneId = properties.getWhatsappPhoneNumberId();
        if (phoneId == null || phoneId.isBlank()) {
            throw new RuntimeException("Meta WhatsApp Phone Number ID is missing (app.messaging.whatsapp-phone-number-id)");
        }

        String url = properties.getWhatsappApiUrl() != null && !properties.getWhatsappApiUrl().isBlank()
                ? properties.getWhatsappApiUrl()
                : "https://graph.facebook.com/v20.0/" + phoneId + "/messages";

        String digits = rawPhone.replaceAll("[^0-9]", "");
        String formattedPhone = (digits.length() == 10) ? "91" + digits : digits;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getWhatsappApiKey());

        Map<String, Object> body = new HashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", formattedPhone);
        body.put("type", "text");
        body.put("text", Map.of("preview_url", false, "body", message));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

        log.info("Meta WhatsApp Cloud API response: {}", response.getBody());
        return "META_WA_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sendFast2SmsOtp(String phone, String otp) {
        String url = properties.getSmsApiUrl() != null && !properties.getSmsApiUrl().isBlank()
                ? properties.getSmsApiUrl()
                : "https://www.fast2sms.com/dev/bulkV2";

        String tenDigits = phone.length() > 10 ? phone.substring(phone.length() - 10) : phone;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", properties.getSmsApiKey());

        Map<String, Object> body = new HashMap<>();
        body.put("variables_values", otp);
        body.put("route", "otp");
        body.put("numbers", tenDigits);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

        log.info("Fast2SMS OTP response: {}", response.getBody());
        return "FAST2SMS_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sendFast2SmsQuick(String phone, String message) {
        String url = properties.getSmsApiUrl() != null && !properties.getSmsApiUrl().isBlank()
                ? properties.getSmsApiUrl()
                : "https://www.fast2sms.com/dev/bulkV2";

        String tenDigits = phone.length() > 10 ? phone.substring(phone.length() - 10) : phone;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", properties.getSmsApiKey());

        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("language", "english");
        body.put("route", "q");
        body.put("numbers", tenDigits);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

        log.info("Fast2SMS Quick SMS response: {}", response.getBody());
        return "FAST2SMS_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sendMsg91Otp(String phone, String otp) {
        String url = "https://api.msg91.com/api/v5/otp?otp=" + otp + "&mobile=" + phone + "&authkey=" + properties.getSmsApiKey();
        HttpHeaders headers = new HttpHeaders();
        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        log.info("MSG91 OTP response: {}", response.getBody());
        return "MSG91_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sendGenericHttp(String apiUrl, String apiKey, Map<String, Object> payload) {
        if (apiUrl == null || apiUrl.isBlank()) {
            throw new RuntimeException("Generic HTTP messaging API URL is not configured");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isBlank()) {
            headers.set("Authorization", apiKey.startsWith("Bearer ") ? apiKey : "Bearer " + apiKey);
            headers.set("x-api-key", apiKey);
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

        log.info("Generic HTTP Gateway response: {}", response.getBody());
        return "HTTP_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String resolveSmsProvider() {
        String p = properties.getSmsProvider();
        if (p != null && !p.equalsIgnoreCase("AUTO") && !p.isBlank()) {
            return p;
        }
        if (properties.getSmsApiUrl() != null && properties.getSmsApiUrl().contains("apitxt.com")) {
            return "APITXT";
        }
        if (properties.getSmsApiKey() != null && !properties.getSmsApiKey().isBlank()) {
            return "APITXT";
        }
        return "MOCK";
    }

    private String resolveWhatsAppProvider() {
        String p = properties.getWhatsappProvider();
        if (p != null && !p.equalsIgnoreCase("AUTO") && !p.isBlank()) {
            return p;
        }
        if (properties.getWhatsappPhoneNumberId() != null && !properties.getWhatsappPhoneNumberId().isBlank()) {
            return "META";
        }
        if (properties.getWhatsappApiUrl() != null && properties.getWhatsappApiUrl().contains("apitxt.com")) {
            return "APITXT";
        }
        if (properties.getWhatsappApiKey() != null && !properties.getWhatsappApiKey().isBlank()) {
            return "GENERIC_HTTP";
        }
        return "MOCK";
    }
}
