import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AnimatedOtpScreen from "../../components/auth/AnimatedOtpScreen";
import { useAuth } from "../../hooks/useAuth";
import {
  verifyLoginOtp,
  resendLoginOtp,
  sendLoginPhoneOtp,
  verifyPhoneOtp,
  sendPhoneOtp,
} from "../../services/authService";
import { ROUTES } from "../../constants/routes";

export default function OtpVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { doctor, isAuthenticated, persistSession } = useAuth();

  // Retrieve state passed from previous route (e.g. Login or Register)
  const navState = location.state || {};
  const destination = navState.maskedPhone || navState.phone || navState.email || "+91 90803 41343";
  const loginSessionToken = navState.loginSessionToken || "";
  const email = navState.email || "";
  const phone = navState.phone || "";
  const flowType = navState.flowType || "LOGIN_2FA"; // "LOGIN_2FA" | "REGISTER_PHONE" | "DEMO"
  const redirectTo = navState.from || ROUTES.DASHBOARD || "/";

  // Handle Verify callback
  const handleVerify = async (code) => {
    // If testing in DEMO mode or direct URL visit without token
    if (!loginSessionToken && flowType === "DEMO") {
      await new Promise((res) => setTimeout(res, 800));
      if (code === "0000" || code === "1234" || code === "5445") {
        return { success: true };
      }
      if (code === "9999") {
        throw new Error("Invalid or expired OTP. Please check the code and try again.");
      }
      return { success: true };
    }

    // Real API integration based on flow
    if (flowType === "REGISTER_PHONE") {
      const data = await verifyPhoneOtp({
        phone: (phone || destination).trim(),
        otp: code,
      });
      return data;
    }

    // Default: 2FA Login Verification
    // autoPersist=false so that PublicRoute doesn't redirect before animation finishes!
    const data = await verifyLoginOtp(
      {
        loginSessionToken,
        email,
        phone,
        otp: code,
      },
      false
    );

    return data;
  };

  // Handle Resend callback
  const handleResend = async () => {
    if (flowType === "REGISTER_PHONE") {
      const res = await sendPhoneOtp({ phone: (phone || destination).trim() });
      toast.success(res?.message || "New OTP sent to your phone.");
      return res;
    }

    if (loginSessionToken || email) {
      const res = await resendLoginOtp({
        loginSessionToken,
        email,
      });
      toast.success(res?.message || "A new OTP has been dispatched to your phone.");
      return res;
    }

    if (phone) {
      const res = await sendLoginPhoneOtp({ phone });
      toast.success(res?.message || "A new OTP has been sent.");
      return res;
    }

    // Demo fallback
    await new Promise((res) => setTimeout(res, 600));
    toast.success("A new verification code has been simulated.");
    return { success: true };
  };

  const handleSuccess = (result) => {
    // Persist token and auth state ONLY AFTER the celebration animation completes
    if (result?.token) {
      persistSession(result);
      sessionStorage.setItem("zenve_doctor_token", result.token);
      sessionStorage.setItem("zenve_doctor_user", JSON.stringify(result));
    }
    toast.success(`Welcome back, Dr. ${result?.fullName?.split(" ")[0] || ""}`.trim());
    navigate(redirectTo, { replace: true });
  };

  const handleBack = () => {
    navigate(ROUTES.LOGIN || "/login");
  };

  return (
    <AnimatedOtpScreen
      length={4}
      destination={destination}
      heading="Let's verify your number"
      subtitle={
        <>
          We&apos;ve sent a 4-digit code to{" "}
          <strong style={{ color: "#ffffff" }}>{destination}</strong>.
          <br />
          It will auto-verify once entered.
        </>
      }
      onVerify={handleVerify}
      onResend={handleResend}
      onBack={handleBack}
      onSuccess={handleSuccess}
      redirectPath={redirectTo}
      initialCooldown={30}
    />
  );
}
