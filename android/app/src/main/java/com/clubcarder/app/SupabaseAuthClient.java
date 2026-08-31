package com.clubcarder.app;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.io.UnsupportedEncodingException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class SupabaseAuthClient {
    interface Callback {
        void complete(JSONObject response, String error);
    }

    private final String baseUrl;
    private final String publishableKey;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    SupabaseAuthClient(String baseUrl, String publishableKey) {
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.publishableKey = publishableKey;
    }

    boolean isConfigured() {
        return baseUrl.startsWith("https://") && !publishableKey.trim().isEmpty();
    }

    void signInWithPassword(String email, String password, Callback callback) {
        JSONObject body = new JSONObject();
        put(body, "email", email);
        put(body, "password", password);
        request("/auth/v1/token?grant_type=password", body, callback);
    }

    void sendPhoneOtp(String phone, Callback callback) {
        JSONObject body = new JSONObject();
        put(body, "phone", phone);
        put(body, "channel", "sms");
        put(body, "create_user", true);
        request("/auth/v1/otp", body, callback);
    }

    void verifyPhoneOtp(String phone, String token, Callback callback) {
        JSONObject body = new JSONObject();
        put(body, "phone", phone);
        put(body, "token", token);
        put(body, "type", "sms");
        request("/auth/v1/verify", body, callback);
    }

    void signUp(String name, String dateOfBirth, String email, String password, Callback callback) {
        JSONObject metadata = new JSONObject();
        put(metadata, "full_name", name);
        put(metadata, "date_of_birth", dateOfBirth);

        JSONObject body = new JSONObject();
        put(body, "email", email);
        put(body, "password", password);
        put(body, "data", metadata);
        String redirect = encode("https://clubcarder.com");
        request("/auth/v1/signup?redirect_to=" + redirect, body, callback);
    }

    void sendPasswordReset(String email, Callback callback) {
        JSONObject body = new JSONObject();
        put(body, "email", email);
        String redirect = encode("https://clubcarder.com/auth/reset-password");
        request("/auth/v1/recover?redirect_to=" + redirect, body, callback);
    }

    void exchangeRefreshToken(String refreshToken, Callback callback) {
        JSONObject body = new JSONObject();
        put(body, "refresh_token", refreshToken);
        request("/auth/v1/token?grant_type=refresh_token", body, callback);
    }

    private void request(String path, JSONObject body, Callback callback) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(baseUrl + path).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(20_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("apikey", publishableKey);
                connection.setRequestProperty("X-Client-Info", "clubcarder-android-native/1.0");

                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(payload.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
                String text = readAll(stream);
                JSONObject response = text.isEmpty() ? new JSONObject() : new JSONObject(text);
                if (status >= 200 && status < 300) {
                    callback.complete(response, null);
                } else {
                    callback.complete(null, errorMessage(response, status));
                }
            } catch (IOException | JSONException error) {
                callback.complete(null, error.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static String errorMessage(JSONObject response, int status) {
        String[] keys = {"error_description", "message", "msg", "error"};
        for (String key : keys) {
            String value = response.optString(key, "").trim();
            if (!value.isEmpty()) return value;
        }
        return "Authentication failed (" + status + ")";
    }

    private static String readAll(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private static void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value);
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) return "";
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }
}
