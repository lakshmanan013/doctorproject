package doctor.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.zippy-crm")
public class ZippyCrmProperties {

    private boolean enabled = true;
    private String baseUrl = "http://127.0.0.1:8000";
    private String dbUrl = "jdbc:mysql://127.0.0.1:3307/zippy_crm?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true&connectTimeout=3000&socketTimeout=5000";
    private String dbUser = "zippy_crm_app";
    private String dbPassword = "zippy-123";

    // Central Consolidated Main Database (zenve_main)
    private boolean centralDbEnabled = true;
    private String centralDbUrl = "jdbc:mysql://127.0.0.1:3307/zenve_main?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true&connectTimeout=3000&socketTimeout=5000";
    private String centralDbUser = "zenve_main_user";
    private String centralDbPassword = "zenvemain-123";
    private long syncIntervalMs = 10000;

    public String getDatabaseName() {
        if (dbUrl != null) {
            try {
                int q = dbUrl.indexOf('?');
                String clean = q != -1 ? dbUrl.substring(0, q) : dbUrl;
                int slash = clean.lastIndexOf('/');
                if (slash != -1 && slash < clean.length() - 1) {
                    return clean.substring(slash + 1);
                }
            } catch (Exception ignored) {
            }
        }
        return "zippy_crm";
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getDbUrl() {
        return dbUrl;
    }

    public void setDbUrl(String dbUrl) {
        this.dbUrl = dbUrl;
    }

    public String getDbUser() {
        return dbUser;
    }

    public void setDbUser(String dbUser) {
        this.dbUser = dbUser;
    }

    public String getDbPassword() {
        return dbPassword;
    }

    public void setDbPassword(String dbPassword) {
        this.dbPassword = dbPassword;
    }

    public boolean isCentralDbEnabled() {
        return centralDbEnabled;
    }

    public void setCentralDbEnabled(boolean centralDbEnabled) {
        this.centralDbEnabled = centralDbEnabled;
    }

    public String getCentralDbUrl() {
        return centralDbUrl;
    }

    public void setCentralDbUrl(String centralDbUrl) {
        this.centralDbUrl = centralDbUrl;
    }

    public String getCentralDbUser() {
        return centralDbUser;
    }

    public void setCentralDbUser(String centralDbUser) {
        this.centralDbUser = centralDbUser;
    }

    public String getCentralDbPassword() {
        return centralDbPassword;
    }

    public void setCentralDbPassword(String centralDbPassword) {
        this.centralDbPassword = centralDbPassword;
    }

    public long getSyncIntervalMs() {
        return syncIntervalMs;
    }

    public void setSyncIntervalMs(long syncIntervalMs) {
        this.syncIntervalMs = syncIntervalMs;
    }
}
