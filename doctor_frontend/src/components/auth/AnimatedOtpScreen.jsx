import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCheck,
  FiAlertCircle,
  FiRefreshCw,
  FiArrowLeft,
  FiLock,
  FiShield,
  FiX,
  FiCheckCircle,
  FiSmartphone,
} from "react-icons/fi";
import "./AnimatedOtpScreen.css";

// Radial sparkle offsets for success celebration burst
const SPARKLE_PARTICLES = [
  { x: 0, y: -64, delay: 0 },
  { x: 45, y: -45, delay: 0.04 },
  { x: 64, y: 0, delay: 0.08 },
  { x: 45, y: 45, delay: 0.12 },
  { x: 0, y: 64, delay: 0.16 },
  { x: -45, y: 45, delay: 0.2 },
  { x: -64, y: 0, delay: 0.24 },
  { x: -45, y: -45, delay: 0.28 },
];

/**
 * AnimatedOtpScreen
 *
 * Implements the premium dark-minimal OTP verification interface:
 * - Perfectly aligned with Zenve Practice OS & Doctor Portal UI
 * - Mathematically centered Orbital Morphing from row to circle
 * - Synchronized 360-degree orbital rotation with upright digits
 * - Center implosion into dual-gradient glowing perimeter spinner
 * - Joyful emerald success badge with stroke checkmark & particle burst
 * - Energetic shake on error with instant auto-recovery
 */
export default function AnimatedOtpScreen({
  length = 4,
  destination = "your phone",
  heading = "Let's verify your number",
  subtitle = null,
  successHeading = "Verified successfully",
  successSubtitle = "Your phone number has been verified.",
  onVerify,
  onResend,
  onBack,
  onSuccess,
  redirectPath = "/",
  initialCooldown = 30,
  autoSubmit = true,
  isModal = false,
  isInline = false,
  theme = "auto",
}) {
  const isLightTheme = theme === "light" || (theme === "auto" && isInline);
  const [otp, setOtp] = useState(() => Array(length).fill(""));
  const [focusedIndex, setFocusedIndex] = useState(0);

  // States: 'IDLE' | 'ORBIT' | 'SPINNING' | 'COLLAPSED' | 'SUCCESS' | 'ERROR'
  const [animState, setAnimState] = useState("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef([]);
  const isVerifyingRef = useRef(false);

  // Focus management
  useEffect(() => {
    if (animState === "IDLE") {
      const idx = Math.min(
        otp.findIndex((d) => d === "") === -1 ? length - 1 : otp.findIndex((d) => d === ""),
        length - 1
      );
      setFocusedIndex(idx >= 0 ? idx : 0);
      inputRefs.current[idx >= 0 ? idx : 0]?.focus();
    }
  }, [animState, length]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Geometric layout parameters
  const boxWidth = length <= 4 ? 58 : 46;
  const boxGap = length <= 4 ? 12 : 8;
  const boxPitch = boxWidth + boxGap;
  const orbitRadius = length <= 4 ? 52 : 62;

  // Orbital positions for each box based on cardinal / radial coordinates
  const getOrbitPosition = useCallback(
    (index) => {
      if (length === 4) {
        // 0: Top, 1: Right, 2: Bottom, 3: Left (cardinal points)
        const positions = [
          { x: 0, y: -orbitRadius }, // Top
          { x: orbitRadius, y: 0 },  // Right
          { x: 0, y: orbitRadius },  // Bottom
          { x: -orbitRadius, y: 0 }, // Left
        ];
        return positions[index] || { x: 0, y: 0 };
      }
      // For arbitrary lengths: evenly distributed around circular orbit
      const angle = (index / length) * 2 * Math.PI - Math.PI / 2;
      return {
        x: Math.round(orbitRadius * Math.cos(angle)),
        y: Math.round(orbitRadius * Math.sin(angle)),
      };
    },
    [length, orbitRadius]
  );

  // Compute Framer Motion translation target to ensure perfect convergence from flex row
  const getBoxMotionTarget = useCallback(
    (index) => {
      const orbitPos = getOrbitPosition(index);
      // Center offset of box in flex row relative to row center
      const initialOffset = (index - (length - 1) / 2) * boxPitch;

      if (animState === "ORBIT" || animState === "SPINNING") {
        return {
          x: orbitPos.x - initialOffset,
          y: orbitPos.y,
          scale: 0.85,
          opacity: 1,
          rotate: animState === "SPINNING" ? -360 : 0,
        };
      }

      if (animState === "COLLAPSED") {
        return {
          x: 0 - initialOffset,
          y: 0,
          scale: 0,
          opacity: 0,
          rotate: 0,
        };
      }

      // IDLE, ERROR, SUCCESS
      return {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        rotate: 0,
      };
    },
    [animState, getOrbitPosition, length, boxPitch]
  );

  // Verification flow orchestration
  const triggerVerification = async (codeToVerify) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setErrorMessage("");

    // Start verification promise in parallel
    const verifyPromise = (async () => {
      if (onVerify) {
        return await onVerify(codeToVerify);
      }
      // Mock fallback if demo mode
      await new Promise((res) => setTimeout(res, 950));
      return { success: true };
    })();

    // Phase 1: Morph from row into Orbital circle
    setAnimState("ORBIT");

    // Phase 2: After 360ms, start orbital rotation
    setTimeout(() => {
      setAnimState("SPINNING");
    }, 360);

    // Phase 3: After rotation (1.2s total), collapse into central spinner
    setTimeout(async () => {
      setAnimState("COLLAPSED");

      try {
        const result = await verifyPromise;

        // Phase 4: Center spinner transitions into glowing Emerald checkmark
        setTimeout(() => {
          setAnimState("SUCCESS");

          // Phase 5: Delay for celebration animation, then callback
          setTimeout(() => {
            if (onSuccess) {
              onSuccess(result);
            }
          }, 1350);
        }, 500);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Invalid OTP code. Please check and try again.";

        setTimeout(() => {
          setErrorMessage(msg);
          setAnimState("ERROR");
          isVerifyingRef.current = false;

          // Return to IDLE after error shake
          setTimeout(() => {
            setOtp(Array(length).fill(""));
            setAnimState("IDLE");
            setFocusedIndex(0);
            inputRefs.current[0]?.focus();
          }, 750);
        }, 400);
      }
    }, 1200);
  };

  // Handle digit input change
  const handleDigitChange = (index, value) => {
    if (animState !== "IDLE") return;
    const cleanDigit = value.replace(/\D/g, "").slice(-1);

    const nextOtp = [...otp];
    nextOtp[index] = cleanDigit;
    setOtp(nextOtp);

    if (cleanDigit) {
      if (index < length - 1) {
        setFocusedIndex(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
    }

    const fullCode = nextOtp.join("");
    if (fullCode.length === length && autoSubmit) {
      triggerVerification(fullCode);
    }
  };

  // Handle KeyDown (Backspace, Arrow keys)
  const handleKeyDown = (index, e) => {
    if (animState !== "IDLE") return;

    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const nextOtp = [...otp];
        nextOtp[index - 1] = "";
        setOtp(nextOtp);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      } else {
        const nextOtp = [...otp];
        nextOtp[index] = "";
        setOtp(nextOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      setFocusedIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Clipboard Paste
  const handlePaste = (e) => {
    if (animState !== "IDLE") return;
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const nextOtp = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) {
      nextOtp[i] = pasted[i];
    }
    setOtp(nextOtp);

    const targetIndex = Math.min(pasted.length, length - 1);
    setFocusedIndex(targetIndex);
    inputRefs.current[targetIndex]?.focus();

    if (pasted.length === length && autoSubmit) {
      triggerVerification(pasted);
    }
  };

  // Handle Resend Request
  const handleResend = async () => {
    if (cooldown > 0 || isResending || animState !== "IDLE") return;

    setIsResending(true);
    setErrorMessage("");

    try {
      if (onResend) {
        await onResend();
      }
      setCooldown(initialCooldown);
      setOtp(Array(length).fill(""));
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Could not resend OTP. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsResending(false);
    }
  };

  const isSuccess = animState === "SUCCESS";
  const isError = animState === "ERROR";
  const isVerifying =
    animState === "ORBIT" || animState === "SPINNING" || animState === "COLLAPSED";

  return (
    <div
      className={`otp-screen-wrapper ${isModal ? "is-modal-view" : ""} ${
        isInline ? "is-inline-view" : ""
      } ${isLightTheme ? "theme-light" : "theme-dark"} ${
        isSuccess ? "is-success" : ""
      } ${isError ? "is-error" : ""}`}
    >
      {/* Background ambient lighting */}
      <div className="otp-ambient-glow" />

      {/* Floating Back / Dismiss Button (Standalone / Modal view only) */}
      {onBack && !isSuccess && !isInline && (
        <button
          type="button"
          onClick={onBack}
          className="otp-back-floating-btn"
          aria-label="Go back or change number"
        >
          <FiArrowLeft size={14} />
          <span>Back</span>
        </button>
      )}

      {/* Centered Glass Verification Card */}
      <motion.div
        className={`otp-card-container ${isSuccess ? "is-success" : ""} ${
          isError ? "is-error" : ""
        }`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={
          isError
            ? {
                x: [0, -12, 12, -8, 8, -4, 4, 0],
                transition: { duration: 0.5 },
              }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header Icon Badge (Light theme matches Login.jsx auth-header-badge) */}
        {isLightTheme ? (
          <div className="otp-light-header-badge">
            <FiSmartphone size={24} color="#4338ca" />
          </div>
        ) : (
          <>
            {/* Brand Micro-Badge Pill */}
            <div className="otp-brand-pill">
              <span className="otp-brand-dot" />
              <span className="otp-brand-text">ZENVE PRACTICE OS</span>
              <span className="otp-brand-subtext">DOCTOR 2FA</span>
            </div>

            {/* Modal Handle pill at top */}
            <div className="otp-card-handle" />
          </>
        )}

        {/* Heading & Subtitle Header */}
        <div className="otp-header-section">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.h2
                key="success-title"
                className="otp-title"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                {successHeading}
              </motion.h2>
            ) : (
              <motion.h2
                key="default-title"
                className="otp-title"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                {heading}
              </motion.h2>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.p
                key="success-subtitle"
                className="otp-subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {successSubtitle}
              </motion.p>
            ) : (
              <motion.p
                key="default-subtitle"
                className="otp-subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {subtitle ? (
                  subtitle
                ) : (
                  <>
                    We&apos;ve sent a {length}-digit code to{" "}
                    <span className="otp-subtitle-destination">{destination}</span>.
                    <br />
                    It will auto-verify once entered.
                  </>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Error message banner */}
        {errorMessage && animState === "IDLE" && (
          <div className="otp-error-banner" role="alert">
            <FiAlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ==================================================================
            ANIMATION STAGE (Boxes -> Orbit -> Spinning -> Collapsed -> Success)
            ================================================================== */}
        <div className="otp-animation-stage">
          {/* Dashed Orbit Track Ring & Glowing Laser Beam */}
          <AnimatePresence>
            {(animState === "ORBIT" || animState === "SPINNING") && (
              <motion.div
                className="otp-orbit-track-wrapper"
                initial={{ opacity: 0, scale: 0.7, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.85, x: "-50%", y: "-50%" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div className="otp-orbit-track" />
                <div className="otp-orbit-glow-beam" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Orbit Cluster (handles synchronized 360 rotation) */}
          <motion.div
            className="otp-orbit-cluster"
            initial={{ x: "-50%", y: "-50%" }}
            animate={
              animState === "SPINNING"
                ? { rotate: 360, x: "-50%", y: "-50%" }
                : { rotate: 0, x: "-50%", y: "-50%" }
            }
            transition={
              animState === "SPINNING"
                ? { duration: 0.85, ease: [0.4, 0, 0.2, 1] }
                : { duration: 0.3 }
            }
          >
            {/* The individual OTP Digit Boxes */}
            {animState !== "COLLAPSED" && animState !== "SUCCESS" && (
              <div
                className={`otp-inputs-row ${
                  animState === "ORBIT" || animState === "SPINNING" ? "is-orbit-mode" : ""
                }`}
              >
                {otp.map((digit, index) => {
                  const isCurrent = focusedIndex === index;
                  const isFilled = Boolean(digit);
                  const isOrbiting = animState === "ORBIT" || animState === "SPINNING";
                  const motionTarget = getBoxMotionTarget(index);

                  return (
                    <motion.div
                      key={index}
                      className={`otp-box ${isCurrent ? "is-focused" : ""} ${
                        isFilled ? "is-filled" : ""
                      } ${isError ? "is-error" : ""} ${
                        isOrbiting ? "is-orbiting" : ""
                      }`}
                      onClick={() => {
                        if (animState === "IDLE") {
                          setFocusedIndex(index);
                          inputRefs.current[index]?.focus();
                        }
                      }}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={motionTarget}
                      transition={{
                        type: "spring",
                        stiffness: animState === "SPINNING" ? 300 : 380,
                        damping: animState === "SPINNING" ? 30 : 26,
                      }}
                    >
                      {/* Native input for mobile keyboard & accessibility */}
                      <input
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        onFocus={() => setFocusedIndex(index)}
                        className="otp-hidden-native-input"
                        autoComplete="one-time-code"
                        aria-label={`Digit ${index + 1} of ${length}`}
                        disabled={animState !== "IDLE"}
                      />

                      {/* Digit Display or Blinking Cursor */}
                      {digit ? (
                        <motion.span
                          key={digit}
                          className="otp-digit-text"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          {digit}
                        </motion.span>
                      ) : (
                        isCurrent &&
                        animState === "IDLE" && <div className="otp-blinking-cursor" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Center Collapsed Box with dual-gradient perimeter spinner */}
          <AnimatePresence>
            {animState === "COLLAPSED" && (
              <motion.div
                className="otp-center-spinner-box"
                initial={{ scale: 0.3, opacity: 0, x: "-50%", y: "-50%" }}
                animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
                exit={{ scale: 0.8, opacity: 0, x: "-50%", y: "-50%" }}
                transition={{ type: "spring", stiffness: 450, damping: 24 }}
              >
                <div className="otp-center-spinner-border" />
                <div className="otp-center-spinner-pulse" />
                <FiShield size={24} className="otp-center-shield-icon" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Emerald Checkmark Box & Celebration Particles */}
          <AnimatePresence>
            {animState === "SUCCESS" && (
              <motion.div
                className="otp-success-box"
                initial={{ scale: 0.4, opacity: 0, x: "-50%", y: "-50%" }}
                animate={{ scale: [0.4, 1.12, 1], opacity: 1, x: "-50%", y: "-50%" }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {/* Expanding dual sonar radar rings */}
                <div className="otp-success-pulse-ring ring-1" />
                <div className="otp-success-pulse-ring ring-2" />

                {/* Celebratory Radial Particle Sparkles */}
                <div className="otp-sparkles-container" aria-hidden="true">
                  {SPARKLE_PARTICLES.map((p, i) => (
                    <motion.span
                      key={i}
                      className="otp-sparkle-dot"
                      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                      animate={{
                        x: p.x,
                        y: p.y,
                        scale: [0, 1.4, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 0.7,
                        delay: p.delay + 0.05,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                </div>

                {/* Dynamic SVG Checkmark */}
                <motion.svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="otp-checkmark-icon"
                >
                  <motion.path
                    d="M20 6L9 17L4 12"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
                  />
                </motion.svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Verifying Status micro-badge during COLLAPSED state */}
        <AnimatePresence>
          {animState === "COLLAPSED" && (
            <motion.div
              className="otp-verifying-text-banner"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <span className="otp-verifying-dot" />
              <span>Verifying & securing credentials...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ==================================================================
            FOOTER SECTION: Resend / Countdown / Secured Lock Badge
            ================================================================== */}
        <div className="otp-footer-section">
          {isSuccess ? (
            <motion.div
              className="otp-verified-secured-badge"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <FiCheckCircle size={15} className="otp-verified-check-icon" />
              <span>Verified & Secured</span>
              <FiLock size={13} className="otp-secured-lock-icon" />
            </motion.div>
          ) : (
            <>
              <p className="otp-resend-text">
                Didn&apos;t receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isResending || animState !== "IDLE"}
                  className="otp-resend-action-btn"
                >
                  {isResending ? (
                    <>
                      <FiRefreshCw size={12} className="otp-spin-icon" />
                      <span>Resending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span className="otp-cooldown-badge">Resend in {cooldown}s</span>
                  ) : (
                    <span>Resend Code</span>
                  )}
                </button>
              </p>

              {onBack && animState === "IDLE" && (
                <button
                  type="button"
                  onClick={onBack}
                  className={isLightTheme ? "otp-back-inline-link" : "otp-change-number-btn"}
                >
                  <FiArrowLeft size={14} style={{ marginRight: 6 }} />
                  <span>
                    {isLightTheme
                      ? "Sign in with a different account or method"
                      : "Wrong number or want to change?"}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
