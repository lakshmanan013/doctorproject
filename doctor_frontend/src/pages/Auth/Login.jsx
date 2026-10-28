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
  FiSmartphone,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiRefreshCw
} from "react-icons/fi";

import Button from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import AuthLayout from "../../layouts/AuthLayout";
import { useAuth } from "../../hooks/useAuth";
import { sendLoginPhoneOtp, resendLoginOtp } from "../../services/authService";
import { ROUTES } from "../../constants/routes";
import AnimatedOtpScreen from "../../components/auth/AnimatedOtpScreen";

import "./Auth.css";

const EMPTY_OTP = ["", "", "", "", "", ""];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyLoginOtp, persistSession } = useAuth();

  // Mode: "CREDENTIALS" | "2FA_OTP"
  const [step, setStep] = useState("CREDENTIALS");

  // Login Method: "PASSWORD" | "PHONE_OTP"
  const [loginMethod, setLoginMethod] = useState("PASSWORD");

  // 2FA session state
  const [twoFaData, setTwoFaData] = useState({
    loginSessionToken: "",
    maskedPhone: "",
    email: "",
    phone: "",
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
    register: registerPasswordForm,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm({
    defaultValues: { identifier: "", password: "", remember: false },
  });

  const {
    register: registerPhoneForm,
    handleSubmit: handlePhoneSubmit,
    formState: { errors: phoneErrors },
    reset: resetPhoneForm,
  } = useForm({
    defaultValues: { phone: "" },
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

  // Step 1A: Submit Password Login (Email or Phone + Password)
  const onSubmitPassword = async (values) => {
    setServerError("");
    setSubmitting(true);

    try {
      const identifier = values.identifier.trim();
      const isEmail = identifier.includes("@");

      const payload = {
        identifier,
        password: values.password,
      };

      if (isEmail) {
        payload.email = identifier.toLowerCase();
      } else {
        payload.phone = identifier;
      }

      const data = await login(payload);

      if (data?.requires2Fa) {
        // Backend issued a 2FA phone challenge
        setTwoFaData({
          loginSessionToken: data.loginSessionToken,
          maskedPhone: data.maskedPhone || "registered mobile number",
          email: data.email || (isEmail ? identifier : ""),
          phone: isEmail ? "" : identifier,
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
        "Invalid email/phone or password. Please try again.";

      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1B: Submit Direct Phone OTP Login
  const onSubmitPhoneOtp = async (values) => {
    setServerError("");
    setSubmitting(true);

    try {
      const rawPhone = values.phone.trim();
      const data = await sendLoginPhoneOtp({ phone: rawPhone });

      setTwoFaData({
        loginSessionToken: data.loginSessionToken,
        maskedPhone: data.maskedPhone || rawPhone,
        email: data.email || "",
        phone: rawPhone,
        devOtp: data.devOtp || "",
      });
      setOtp(EMPTY_OTP);
      setStep("2FA_OTP");
      setResendCooldown(30);
      toast.success(data.message || `OTP sent to ${data.maskedPhone || rawPhone}`);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Could not send OTP to this phone number. Please check the number or register.";

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
        phone: twoFaData.phone,
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
      let data;
      if (twoFaData.email || twoFaData.loginSessionToken) {
        data = await resendLoginOtp({
          email: twoFaData.email,
          loginSessionToken: twoFaData.loginSessionToken,
        });
      } else if (twoFaData.phone) {
        data = await sendLoginPhoneOtp({ phone: twoFaData.phone });
      }

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
            <div className="auth-card-top-logo">
              <img
                src="/zenve.png"
                alt="Zenve Logo"
                className="auth-card-logo-img"
              />
            </div>
            <span className="auth-header-welcome">Welcome to</span>
            <h2 className="auth-header-title">Zenve Doctors</h2>
          </div>

          {/* Login Method Tabs */}
          <div className="auth-login-tabs">
            <button
              type="button"
              className={`auth-login-tab-btn ${loginMethod === "PASSWORD" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("PASSWORD");
                setServerError("");
              }}
            >
              <FiMail size={15} />
              <span>Email / Password</span>
            </button>

            <button
              type="button"
              className={`auth-login-tab-btn ${loginMethod === "PHONE_OTP" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("PHONE_OTP");
                setServerError("");
              }}
            >
              <FiSmartphone size={15} />
              <span>Mobile OTP</span>
            </button>
          </div>

          {serverError && (
            <div className="auth-alert" style={{ marginBottom: 18 }}>
              <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{serverError}</span>
            </div>
          )}

          {loginMethod === "PASSWORD" ? (
            /* PASSWORD LOGIN FORM (Supports Email OR Phone) */
            <form className="auth-form" onSubmit={handlePasswordSubmit(onSubmitPassword)} noValidate>
              <Field label="Email or Mobile number" required>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <FiMail size={16} />
                  </span>

                  <input
                    type="text"
                    className={`input${passwordErrors.identifier ? " input-error" : ""}`}
                    placeholder="doctor@example.com"
                    autoComplete="username"
                    {...registerPasswordForm("identifier", {
                      required: "Email or mobile number is required",
                    })}
                  />
                </div>
                {passwordErrors.identifier && (
                  <span className="field-error">{passwordErrors.identifier.message}</span>
                )}
              </Field>

              <Field label="Password" required>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <FiLock size={16} />
                  </span>

                  <input
                    type={showPassword ? "text" : "password"}
                    className={`input${passwordErrors.password ? " input-error" : ""}`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                    {...registerPasswordForm("password", {
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
                {passwordErrors.password && (
                  <span className="field-error">{passwordErrors.password.message}</span>
                )}
              </Field>

              <div className="auth-form-meta">
                <label className="auth-checkbox">
                  <input type="checkbox" {...registerPasswordForm("remember")} />
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
                <FiArrowRight size={16} strokeWidth={2.4} />
                <span>{submitting ? "Signing in..." : "Sign in"}</span>
              </Button>
            </form>
          ) : (
            /* PHONE OTP LOGIN FORM */
            <form className="auth-form" onSubmit={handlePhoneSubmit(onSubmitPhoneOtp)} noValidate>
              <Field label="Registered Mobile Number" required>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <FiSmartphone size={16} />
                  </span>

                  <input
                    type="tel"
                    className={`input${phoneErrors.phone ? " input-error" : ""}`}
                    placeholder="Enter 10-digit mobile number"
                    autoComplete="tel"
                    {...registerPhoneForm("phone", {
                      required: "Phone number is required",
                      pattern: {
                        value: /^[0-9+\-\s]{7,15}$/,
                        message: "Enter a valid phone number",
                      },
                    })}
                  />
                </div>
                {phoneErrors.phone && (
                  <span className="field-error">{phoneErrors.phone.message}</span>
                )}
              </Field>

              <div className="auth-phone-helper-hint">
                We&apos;ll send a 4-digit verification code to this number to verify and sign you in.
              </div>

              <Button
                type="submit"
                size="lg"
                className="auth-submit"
                disabled={submitting}
              >
                <FiArrowRight size={16} strokeWidth={2.4} />
                <span>{submitting ? "Sending OTP..." : "Get Login OTP"}</span>
              </Button>
            </form>
          )}

          <p className="auth-form-footer">
            Don&apos;t have an account?{" "}
            <Link to={ROUTES.REGISTER} className="auth-link">
              Create one
            </Link>
          </p>
        </>
      ) : (
        /* 2FA PHONE OTP VERIFICATION STEP (INLINE ANIMATED SCREEN) */
        <AnimatedOtpScreen
          isInline={true}
          length={4}
          destination={twoFaData.maskedPhone || "your registered phone"}
          heading="Two-Factor Verification"
          subtitle={
            <>
              Enter the 4-digit code sent to{" "}
              <strong style={{ color: "#1e1b4b" }}>{twoFaData.maskedPhone || "your phone"}</strong>.
              <br />
              It will auto-verify once entered.
            </>
          }
          onVerify={async (code) => {
            const data = await verifyLoginOtp(
              {
                email: twoFaData.email,
                phone: twoFaData.phone,
                loginSessionToken: twoFaData.loginSessionToken,
                otp: code,
              },
              false
            );
            return data;
          }}
          onResend={async () => {
            let data;
            if (twoFaData.email || twoFaData.loginSessionToken) {
              data = await resendLoginOtp({
                email: twoFaData.email,
                loginSessionToken: twoFaData.loginSessionToken,
              });
            } else if (twoFaData.phone) {
              data = await sendLoginPhoneOtp({ phone: twoFaData.phone });
            }
            toast.success(data?.message || "A new OTP has been sent to your registered mobile number.");
            return data;
          }}
          onBack={handleBackToCredentials}
          onSuccess={(data) => {
            if (data?.token) persistSession(data);
            toast.success(`Welcome back, Dr. ${data?.fullName?.split(" ")[0] || ""}`.trim());
            navigate(redirectTo, { replace: true });
          }}
          redirectPath={redirectTo}
          initialCooldown={resendCooldown || 30}
        />
      )}
    </AuthLayout>
  );
}
