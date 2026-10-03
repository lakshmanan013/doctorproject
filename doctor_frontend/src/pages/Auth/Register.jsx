import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiCheckCircle,
  FiShield,
  FiRefreshCw,
} from "react-icons/fi";

import Button from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import AuthLayout from "../../layouts/AuthLayout";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import { sendPhoneOtp, verifyPhoneOtp } from "../../services/authService";

import "./Auth.css";

const OTP_LENGTH = 6;
const EMPTY_OTP = Array(OTP_LENGTH).fill("");

export default function Register() {
  const navigate = useNavigate();
  const { register: createAccount } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // Phone OTP States
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otp, setOtp] = useState(EMPTY_OTP);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef([]);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const phoneValue = watch("phone");

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Handle Send OTP
  const handleSendOtp = async () => {
    const rawPhone = (phoneValue || "").trim();
    if (!rawPhone || rawPhone.length < 7) {
      setError("phone", {
        type: "manual",
        message: "Please enter a valid phone number before requesting OTP",
      });
      return;
    }
    clearErrors("phone");
    setServerError("");
    setSendingOtp(true);

    try {
      const data = await sendPhoneOtp({ phone: rawPhone });
      setPhoneOtpSent(true);
      setOtp(EMPTY_OTP);
      setTimer(30);
      toast.success(data?.message || "OTP sent successfully!");
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const msg = error?.response?.data?.message || "Could not send OTP. Please try again.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (value, index) => {
    const cleanValue = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = cleanValue;
    setOtp(next);

    if (cleanValue && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = [...EMPTY_OTP];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtp(next);

    const nextFocusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[nextFocusIndex]?.focus();
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== OTP_LENGTH) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }

    setServerError("");
    setVerifyingOtp(true);

    try {
      const data = await verifyPhoneOtp({
        phone: (phoneValue || "").trim(),
        otp: enteredOtp,
      });

      setPhoneVerified(true);
      setPhoneOtpSent(false);
      clearErrors("phone");
      toast.success(data?.message || "Phone number verified successfully!");
    } catch (error) {
      const msg = error?.response?.data?.message || "Invalid or expired OTP.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleChangePhone = () => {
    setPhoneVerified(false);
    setPhoneOtpSent(false);
    setOtp(EMPTY_OTP);
  };

  const onSubmit = async (values) => {
    setServerError("");

    if (!phoneVerified) {
      setError("phone", {
        type: "manual",
        message: "Please verify your phone number with OTP first",
      });
      setServerError("Please verify your phone number with OTP before submitting.");
      toast.error("Please verify your phone number with OTP first.");
      return;
    }

    setSubmitting(true);

    try {
      const data = await createAccount({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
        phoneVerified: true,
      });

      if (data?.token) {
        toast.success(`Account created. Welcome, Dr. ${data?.fullName?.split(" ")[0] || ""}`.trim());
        navigate(ROUTES.DASHBOARD, { replace: true });
        return;
      }

      toast.success(
        data?.message ||
          "Account created. It's pending admin approval - you'll be able to log in once approved.",
        { duration: 6000 }
      );

      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Could not create your account. Please try again.";

      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-header">
        <h2>Create Doctor Account</h2>
        <p>Set up your veterinary dashboard & profile in a couple of minutes.</p>
      </div>

      {serverError && (
        <div className="auth-alert" style={{ marginBottom: 18 }}>
          <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{serverError}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Full name">
          <div className="auth-input-wrap">
            <span className="auth-input-icon">
              <FiUser size={16} />
            </span>

            <input
              type="text"
              className={`input${errors.fullName ? " input-error" : ""}`}
              placeholder="Dr. Jane Doe"
              autoComplete="name"
              {...register("fullName", {
                required: "Full name is required",
                minLength: { value: 3, message: "Enter your full name" },
              })}
            />
          </div>
          {errors.fullName && <span className="field-error">{errors.fullName.message}</span>}
        </Field>

        <Field label="Email address">
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

        {/* PHONE NUMBER FIELD WITH EMBEDDED SEND OTP & VERIFY OTP */}
        <Field label="Phone number">
          <div className={`auth-input-wrap auth-phone-field-wrap${phoneVerified ? " is-verified" : ""}`}>
            <span className="auth-input-icon">
              <FiPhone size={16} />
            </span>

            <input
              type="tel"
              readOnly={phoneVerified}
              className={`input${errors.phone ? " input-error" : ""}`}
              placeholder="9876543210"
              autoComplete="tel"
              {...register("phone", {
                required: "Phone number is required",
                pattern: {
                  value: /^[0-9+\-\s]{7,15}$/,
                  message: "Enter a valid phone number",
                },
                onChange: () => {
                  if (phoneVerified) setPhoneVerified(false);
                },
              })}
            />

            {!phoneVerified ? (
              <button
                type="button"
                className="auth-phone-action-btn"
                onClick={handleSendOtp}
                disabled={sendingOtp || (phoneOtpSent && timer > 0)}
              >
                {sendingOtp ? (
                  <>
                    <FiRefreshCw className="spin" size={13} />
                    <span>Sending...</span>
                  </>
                ) : phoneOtpSent ? (
                  timer > 0 ? `Resend (${timer}s)` : "Resend OTP"
                ) : (
                  "Send OTP"
                )}
              </button>
            ) : (
              <div className="auth-phone-verified-tag">
                <span className="auth-verified-badge">
                  <FiCheckCircle size={13} />
                  <span>Verified</span>
                </span>
                <button
                  type="button"
                  className="auth-phone-change-btn"
                  onClick={handleChangePhone}
                  title="Change phone number"
                >
                  Change
                </button>
              </div>
            )}
          </div>
          {errors.phone && <span className="field-error">{errors.phone.message}</span>}

          {/* OTP INPUT SECTION (Expands when OTP is sent & not yet verified) */}
          {phoneOtpSent && !phoneVerified && (
            <div className="auth-phone-otp-card">
              <div className="auth-phone-otp-header">
                <span className="auth-phone-otp-title">
                  <FiShield size={15} color="#4f46e5" />
                  <span>Enter 6-digit OTP sent to {phoneValue}</span>
                </span>
              </div>

              <div className="auth-phone-otp-boxes" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    onKeyDown={(e) => handleOtpKeyDown(e, index)}
                    className="auth-phone-otp-box"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="auth-phone-otp-footer">
                <button
                  type="button"
                  className="auth-phone-verify-btn"
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otp.join("").length !== OTP_LENGTH}
                >
                  {verifyingOtp ? (
                    <>
                      <FiRefreshCw className="spin" size={14} />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <FiCheckCircle size={14} />
                      <span>Verify OTP</span>
                    </>
                  )}
                </button>

                <div className="auth-phone-resend-text">
                  Didn&apos;t receive code?{" "}
                  <button
                    type="button"
                    className="auth-phone-resend-link"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || timer > 0}
                  >
                    {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Field>

        <div className="auth-form-row">
          <Field label="Password">
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <FiLock size={16} />
              </span>

              <input
                type={showPassword ? "text" : "password"}
                className={`input${errors.password ? " input-error" : ""}`}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                style={{ paddingRight: 44 }}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "At least 6 characters" },
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

          <Field label="Confirm password">
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <FiLock size={16} />
              </span>

              <input
                type={showConfirm ? "text" : "password"}
                className={`input${errors.confirmPassword ? " input-error" : ""}`}
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={{ paddingRight: 44 }}
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (value) => value === password || "Passwords do not match",
                })}
              />

              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowConfirm((prev) => !prev)}
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword.message}</span>
            )}
          </Field>
        </div>

        <Button
          type="submit"
          size="lg"
          className="auth-submit"
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="auth-form-footer">
        Already have an account?{" "}
        <Link to={ROUTES.LOGIN} className="auth-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
