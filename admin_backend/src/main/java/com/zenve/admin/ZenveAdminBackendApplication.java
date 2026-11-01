package com.zenve.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ZenveAdminBackendApplication {

    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(ZenveAdminBackendApplication.class, args);
    }

    private static void loadDotEnv() {
        String[] possiblePaths = {
            "admin_backend/.env",
            ".env",
            "../admin_backend/.env",
            "../.env",
            "../../.env"
        };
        for (String path : possiblePaths) {
            File file = new File(path);
            if (file.exists() && file.isFile()) {
                try {
                    List<String> lines = Files.readAllLines(Paths.get(path));
                    for (String line : lines) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                        int eq = trimmed.indexOf('=');
                        if (eq > 0) {
                            String key = trimmed.substring(0, eq).trim();
                            String value = trimmed.substring(eq + 1).trim();
                            if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                                value = value.substring(1, value.length() - 1);
                            }
                            if (!value.isEmpty()) {
                                System.setProperty(key, value);
                                if ("ADMIN_DB_PASSWORD".equals(key)) {
                                    System.setProperty("DB_PASSWORD", value);
                                }
                                if ("ADMIN_DB_USER".equals(key)) {
                                    System.setProperty("DB_USER", value);
                                }
                                if ("ADMIN_DB_NAME".equals(key)) {
                                    System.setProperty("DB_NAME", value);
                                }
                                if ("ADMIN_DB_HOST".equals(key)) {
                                    System.setProperty("DB_HOST", value);
                                }
                                if ("ADMIN_DB_PORT".equals(key)) {
                                    System.setProperty("DB_PORT", value);
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }
    }
}

