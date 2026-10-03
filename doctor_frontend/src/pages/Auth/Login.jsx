import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiShield,
  FiSmartphone,
  FiArrowLeft,
  FiCheckCircle,
  FiRefreshCw
} from "react-icons/fi";

import Button from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import AuthLayout from "../../layouts/AuthLayout";
import { useAuth } from "../../hooks/useAuth";
import { resendLoginOtp } from "../../services/authService";
import { ROUTES } from "../../constants/routes";

import "./Auth.css";

const EMPTY_OTP = ["", "", "", "", "", ""];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyLoginOtp } = useAuth();

  // Mode: "CREDENTIALS" | "2FA_OTP"
  const [step, setStep] = useState("CREDENTIALS");

  // 2FA session state
  const [twoFaData, setTwoFaData] = useState({
    loginSessionToken: "",
    maskedPhone: "",
    email: "",
    devOtp: "",
  });

  const [otp, setOtp] = useState(EMPTY_OTP);
  const otpInputRefs = useRef([]);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: "", password: "" },
  });

  const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first OTP box when entering 2FA step
  useEffect(() => {
    if (step === "2FA_OTP") {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Step 1: Submit Credentials
  const onSubmitCredentials = async (values) => {
    setServerError("");
    setSubmitting(true);

    try {
      const email = values.email.trim().toLowerCase();
      const data = await login({
        email,
        password: values.password,
      });

      if (data?.requires2Fa) {
        // Backend issued a 2FA phone challenge
        setTwoFaData({
          loginSessionToken: data.loginSessionToken,
          maskedPhone: data.maskedPhone || "registered mobile number",
          email: data.email || email,
          devOtp: data.devOtp || "",
        });
        setOtp(EMPTY_OTP);
        setStep("2FA_OTP");
        setResendCooldown(30);
        toast.success(data.message || `OTP sent to ${data.maskedPhone || "your phone"}`);
        return;
      }

      // If already logged in directly (e.g. without 2FA challenge)
      toast.success(`Welcome back, Dr. ${data?.fullName?.split(" ")[0] || ""}`.trim());
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Invalid email or password. Please try again.";

      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Handle OTP Digit Changes
  const handleOtpChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto verify when 6th digit entered
    const fullOtp = newOtp.join("");
    if (fullOtp.length === 6) {
      handleVerifyOtp(fullOtp);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...EMPTY_OTP];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);

    if (pasted.length === 6) {
      otpInputRefs.current[5]?.focus();
      handleVerifyOtp(pasted);
    } else {
      otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  // Step 2: Verify Login OTP
  const handleVerifyOtp = async (enteredOtpParam) => {
    const enteredOtp = (typeof enteredOtpParam === "string" ? enteredOtpParam : otp.join("")).trim();

    if (enteredOtp.length !== 6) {
      setServerError("Please enter the complete 6-digit OTP.");
      toast.error("Please enter the full 6-digit OTP.");
      return;
    }

    setServerError("");
    setVerifyingOtp(true);

    try {
      const data = await verifyLoginOtp({
        email: twoFaData.email,
        loginSessionToken: twoFaData.loginSessionToken,
        otp: enteredOtp,
      });

      toast.success(`Welcome back, Dr. ${data?.fullName?.split(" ")[0] || ""}`.trim());
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Invalid or expired OTP. Please try again.";

      setServerError(message);
      toast.error(message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 2: Resend Login OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendingOtp) return;

    setServerError("");
    setResendingOtp(true);

    try {
      const data = await resendLoginOtp({
        email: twoFaData.email,
        loginSessionToken: twoFaData.loginSessionToken,
      });

      setResendCooldown(30);
      setOtp(EMPTY_OTP);
      if (data?.devOtp) {
        setTwoFaData((prev) => ({ ...prev, devOtp: data.devOtp }));
      }
      toast.success(data?.message || "A new OTP has been sent to your registered mobile number.");
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const msg = error?.response?.data?.message || "Could not resend OTP. Please try again.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setResendingOtp(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep("CREDENTIALS");
    setServerError("");
    setOtp(EMPTY_OTP);
  };

  return (
    <AuthLayout>
      {step === "CREDENTIALS" ? (
        <>
          <div className="auth-form-header">
            <div className="auth-header-badge">
              <svg
                className="auth-paw-cross-svg"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 4 Paw Toes */}
                <ellipse cx="14" cy="16" rx="3.5" ry="5.5" transform="rotate(-15 14 16)" fill="#3730a3" />
                <ellipse cx="21" cy="11.5" rx="3.5" ry="5.5" transform="rotate(-5 21 11.5)" fill="#3730a3" />
                <ellipse cx="29" cy="11.5" rx="3.5" ry="5.5" transform="rotate(5 29 11.5)" fill="#3730a3" />
                <ellipse cx="36" cy="16" rx="3.5" ry="5.5" transform="rotate(15 36 16)" fill="#3730a3" />
                
                {/* Main Paw Pad */}
                <path
                  d="M15 28C13.5 32.5 16.5 39 25 39C33.5 39 36.5 32.5 35 28C33.5 23.5 28.5 23.5 25 25.5C21.5 23.5 16.5 23.5 15 28Z"
                  fill="#3730a3"
                />
                {/* White Medical Cross inside main pad */}
                <path
                  d="M23.5 29H26.5V32H29.5V35H26.5V38H23.5V35H20.5V32H23.5V29Z"
                  fill="#FFFFFF"
                />
              </svg>
            </div>

            <h2>Welcome Doctor</h2>
            <p>Sign in to manage your clinic, patients, and schedule.</p>
          </div>

          {serverError && (
            <div className="auth-alert" style={{ marginBottom: 18 }}>
              <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{serverError}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit(onSubmitCredentials)} noValidate>
            <Field label="Email address" required>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiMail size={16} />
                </span>

                <input
                  type="email"
                  className={`input${errors.email ? " input-error" : ""}`}
                  placeholder="doctor@example.com"
                  autoComplete="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                />
              </div>
              {errors.email && <span className="field-error">{errors.email.message}</span>}
            </Field>

            <Field label="Password" required>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiLock size={16} />
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  className={`input${errors.password ? " input-error" : ""}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                  {...register("password", {
                    required: "Password is required",
                  })}
                />

                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password.message}</span>}
            </Field>

            <div className="auth-form-meta">
              <label className="auth-checkbox">
                <input type="checkbox" {...register("remember")} />
                Remember me
              </label>

              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="auth-submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="auth-form-footer">
            Don&apos;t have an account?{" "}
            <Link to={ROUTES.REGISTER} className="auth-link">
              Create one
            </Link>
          </p>
        </>
      ) : (
        /* 2FA PHONE OTP VERIFICATION STEP */
        <div className="auth-2fa-step-container">
          <div className="auth-form-header">
            <div className="auth-header-badge auth-2fa-badge">
              <FiSmartphone size={24} color="#4338ca" />
            </div>

            <h2>Two-Factor Verification</h2>
            <p>
              We sent a 6-digit verification code to your registered mobile number:{" "}
              <strong style={{ color: "#1e1b4b", display: "inline-block", marginTop: 4 }}>
                {twoFaData.maskedPhone}
              </strong>
            </p>
          </div>

          {serverError && (
            <div className="auth-alert" style={{ marginBottom: 18 }}>
              <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{serverError}</span>
            </div>
          )}

          {twoFaData.devOtp && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                color: "#166534",
              }}
            >
              <span>Test OTP: <strong>{twoFaData.devOtp}</strong></span>
              <button
                type="button"
                onClick={() => {
                  const digits = twoFaData.devOtp.split("").slice(0, 6);
                  setOtp(digits);
                  handleVerifyOtp(twoFaData.devOtp);
                }}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Auto Fill
              </button>
            </div>
          )}

          <div className="auth-phone-otp-card" style={{ marginTop: 0 }}>
            <div className="auth-phone-otp-header">
              <span>Enter 6-Digit OTP</span>
              <span className="auth-phone-otp-hint">Code expires in 10 minutes</span>
            </div>

            <div className="auth-phone-otp-inputs">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  className="auth-phone-otp-box"
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <div className="auth-phone-otp-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resendingOtp}
                className="auth-phone-resend-btn"
              >
                <FiRefreshCw
                  size={13}
                  className={resendingOtp ? "auth-spin-icon" : ""}
                  style={{ marginRight: 4 }}
                />
                {resendingOtp
                  ? "Resending..."
                  : resendCooldown > 0
                  ? `Resend OTP (${resendCooldown}s)`
                  : "Resend OTP"}
              </button>

              <Button
                type="button"
                onClick={() => handleVerifyOtp(otp.join(""))}
                disabled={verifyingOtp || otp.join("").length !== 6}
                size="md"
                style={{ minWidth: 140 }}
              >
                {verifyingOtp ? "Verifying..." : "Verify & Sign In"}
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="auth-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
              }}
            >
              <FiArrowLeft size={16} />
              Sign in with a different account
            </button>
          </div>
        </div>
      )}

      {/* Security Assurance Badge */}
      <div className="auth-security-badge">
        <span className="auth-security-line" />
        <span className="auth-security-content">
          <FiShield className="auth-security-icon" size={16} />
          Secure veterinary practice management
        </span>
        <span className="auth-security-line" />
      </div>
    </AuthLayout>
  );
}
