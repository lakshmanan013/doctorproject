package doctor.backend.controller;


import doctor.backend.dto.auth.AuthResponse;
import doctor.backend.dto.auth.ForgotPasswordRequest;
import doctor.backend.dto.auth.ForgotPasswordResponse;
import doctor.backend.dto.auth.LoginRequest;
import doctor.backend.dto.auth.MessageResponse;
import doctor.backend.dto.auth.RegisterRequest;
import doctor.backend.dto.auth.ResetPasswordRequest;
import doctor.backend.dto.auth.VerifyOtpRequest;
import doctor.backend.dto.auth.VerifyOtpResponse;
import doctor.backend.dto.auth.SendPhoneOtpRequest;
import doctor.backend.dto.auth.SendPhoneOtpResponse;
import doctor.backend.dto.auth.VerifyPhoneOtpRequest;
import doctor.backend.dto.auth.VerifyPhoneOtpResponse;
import doctor.backend.service.AuthService;
import doctor.backend.service.PhoneOtpService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PhoneOtpService phoneOtpService;

    public AuthController(AuthService authService, PhoneOtpService phoneOtpService) {
        this.authService = authService;
        this.phoneOtpService = phoneOtpService;
    }

    // =====================================================
    // PHONE OTP FOR DOCTOR ACCOUNT CREATION
    // POST /api/auth/send-phone-otp
    // POST /api/auth/verify-phone-otp
    // =====================================================

    @PostMapping("/send-phone-otp")
    public ResponseEntity<SendPhoneOtpResponse> sendPhoneOtp(@Valid @RequestBody SendPhoneOtpRequest request) {
        return ResponseEntity.ok(phoneOtpService.sendPhoneOtp(request.getPhone()));
    }

    @PostMapping("/verify-phone-otp")
    public ResponseEntity<VerifyPhoneOtpResponse> verifyPhoneOtp(@Valid @RequestBody VerifyPhoneOtpRequest request) {
        return ResponseEntity.ok(phoneOtpService.verifyPhoneOtp(request.getPhone(), request.getOtp()));
    }

    // =====================================================
    // DOCTOR CREATE ACCOUNT
    // POST /api/auth/register
    // =====================================================

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {

        AuthResponse response = authService.register(request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // =====================================================
    // DOCTOR LOGIN
    // POST /api/auth/login
    // POST /api/auth/verify-login-otp
    // POST /api/auth/resend-login-otp
    // =====================================================

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {

        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/verify-login-otp")
    public ResponseEntity<AuthResponse> verifyLoginOtp(@Valid @RequestBody doctor.backend.dto.auth.VerifyLoginOtpRequest request) {

        return ResponseEntity.ok(authService.verifyLoginOtp(request));
    }

    @PostMapping("/resend-login-otp")
    public ResponseEntity<AuthResponse> resendLoginOtp(@Valid @RequestBody doctor.backend.dto.auth.ResendLoginOtpRequest request) {

        return ResponseEntity.ok(authService.resendLoginOtp(request));
    }

    // =====================================================
    // CURRENT LOGGED-IN DOCTOR
    // GET /api/auth/me
    // =====================================================

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(authService.getCurrentUser(userDetails.getUsername()));
    }

    // =====================================================
    // FORGOT PASSWORD — step 1: email a 6-digit OTP
    // POST /api/auth/forgot-password
    // =====================================================

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {

        return ResponseEntity.ok(authService.forgotPassword(request.getEmail()));
    }

    // =====================================================
    // FORGOT PASSWORD — step 2: verify the OTP
    // POST /api/auth/verify-otp
    // =====================================================

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {

        return ResponseEntity.ok(
                authService.verifyOtp(request.getEmail(), request.getOtp(), request.getResetToken()));
    }

    // =====================================================
    // FORGOT PASSWORD — step 3: set the new password
    // POST /api/auth/reset-password
    // =====================================================

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {

        return ResponseEntity.ok(
                authService.resetPassword(request.getEmail(), request.getResetToken(), request.getNewPassword()));
    }
}
