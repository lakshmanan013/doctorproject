import React, { useState, useEffect, useRef } from "react";
import {
  WifiOff,
  ServerCrash,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Radio,
} from "lucide-react";
import "./ErrorVideoScreen.css";

/**
 * ErrorVideoScreen
 * 
 * Replaces the default white page with a high-end animated video screen whenever
 * an internet disruption, server 500 error, or unexpected crash occurs.
 * Automatically checks for restored connection and smoothly transitions back
 * to the website once the error is resolved.
 */
export default function ErrorVideoScreen({
  errorType = "offline", // "offline" | "server_error" | "runtime_error"
  errorMessage = "",
  errorDetails = null,
  videoSrc = "/videos/error-animation.mp4",
  isChecking = false,
  countdown = 5,
  isRestored = false,
  onRetry = () => {},
  onReload = () => window.location.reload(),
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Attempt video play on mount & handle browser autoplay restrictions gracefully
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay policy prevented playback, keep fallback ready
        });
      }
    }
  }, [videoSrc]);

  const toggleSound = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Configure copy based on error category
  const errorConfig = {
    offline: {
      icon: WifiOff,
      badge: "No Internet Connection",
      badgeColor: "offline-badge",
      title: "You're Currently Offline",
      description:
        "We're having trouble connecting to the internet. Please check your Wi-Fi, Ethernet, or mobile data connection.",
      solution: "The website will automatically resume as soon as your connection is back.",
    },
    server_error: {
      icon: ServerCrash,
      badge: "Server Temporarily Unavailable",
      badgeColor: "server-badge",
      title: "Server Is Taking a Rest",
      description:
        "Our backend services are momentarily unreachable or undergoing maintenance. Your data is safe.",
      solution: "We are actively pinging the server and will reconnect you automatically.",
    },
    runtime_error: {
      icon: AlertTriangle,
      badge: "Temporary Display Glitch",
      badgeColor: "runtime-badge",
      title: "Something Went Unexpectedly Wrong",
      description:
        "The application encountered an unexpected state. Rather than showing a blank screen, we are attempting a graceful recovery.",
      solution: "Automatic recovery is attempting to restore your session.",
    },
  }[errorType] || {
    icon: ServerCrash,
    badge: "Service Interrupted",
    badgeColor: "server-badge",
    title: "Connection Interrupted",
    description: "A temporary connection issue was encountered.",
    solution: "We are monitoring the connection to restore your page.",
  };

  const IconComponent = errorConfig.icon;

  return (
    <div className={`error-video-overlay ${isRestored ? "is-restoring" : ""}`}>
      {/* Ambient background glows */}
      <div className="ambient-glow glow-top-left" />
      <div className="ambient-glow glow-bottom-right" />

      <div className="error-video-container">
        {/* Header Bar */}
        <div className="error-header-bar">
          <div className="error-brand">
            <span className="brand-dot" />
            <span className="brand-name">Zenve VetCare OS</span>
          </div>

          <div className="error-status-pill">
            {isRestored ? (
              <span className="pill-status pill-restored">
                <CheckCircle2 size={15} /> Connection Restored
              </span>
            ) : isChecking ? (
              <span className="pill-status pill-checking">
                <RefreshCw size={15} className="spin-icon" /> Checking Health...
              </span>
            ) : (
              <span className={`pill-status ${errorConfig.badgeColor}`}>
                <Radio size={14} className="pulse-icon" /> {errorConfig.badge}
              </span>
            )}
          </div>
        </div>

        {/* Video / Animated Presentation Card */}
        <div className="video-viewport-wrapper">
          {/* Animated Video Element */}
          <div className="video-player-container">
            <video
              ref={videoRef}
              className="animated-error-video visible"
              autoPlay
              loop
              muted={isMuted}
              defaultMuted
              playsInline
              preload="auto"
            >
              <source src={videoSrc} type="video/mp4" />
              <source src="/videos/error-animation.mp4" type="video/mp4" />
              <source src="/videos/error-animation.webm" type="video/webm" />
              Your browser does not support the video tag.
            </video>

            {/* Sound Toggle */}
            <button
              type="button"
              className="video-sound-toggle"
              onClick={toggleSound}
              title={isMuted ? "Unmute Video" : "Mute Video"}
              aria-label="Toggle sound"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>

        {/* Content & Recovery Status Card */}
        <div className="error-info-card">
          <div className="info-main">
            <h1 className="error-title">
              {isRestored ? "Connection Restored!" : errorConfig.title}
            </h1>
            <p className="error-desc">
              {isRestored
                ? "Re-establishing your secure session. Bringing you back to the website now..."
                : errorConfig.description}
            </p>
          </div>

          {/* Auto-reconnect status countdown */}
          {!isRestored && (
            <div className="reconnect-status-box">
              <div className="status-indicator-row">
                <div className="indicator-pulse-dot" />
                <span className="status-text">
                  {isChecking ? (
                    "Testing server response..."
                  ) : (
                    <>
                      Auto-checking in <strong className="countdown-number">{countdown}s</strong>
                    </>
                  )}
                </span>
                <span className="status-hint">{errorConfig.solution}</span>
              </div>

              {/* Smooth progress bar */}
              <div className="countdown-bar-track">
                <div
                  className="countdown-bar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((5 - countdown) / 5) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* User Actions */}
          <div className="error-actions-row">
            <button
              type="button"
              className="action-btn btn-primary"
              onClick={onRetry}
              disabled={isChecking || isRestored}
            >
              <RefreshCw size={17} className={isChecking ? "spin-icon" : ""} />
              {isChecking ? "Testing Connection..." : "Reconnect Now"}
            </button>

            <button
              type="button"
              className="action-btn btn-secondary"
              onClick={onReload}
              disabled={isChecking}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>

          {/* Technical Details Accordion (for debugging) */}
          {(errorMessage || errorDetails) && (
            <div className="error-details-accordion">
              <button
                type="button"
                className="details-toggle-btn"
                onClick={() => setShowDetails((prev) => !prev)}
              >
                <span>Diagnostic Information</span>
                {showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showDetails && (
                <div className="details-content-box">
                  {errorMessage && <p className="details-message">{errorMessage}</p>}
                  {errorDetails && (
                    <pre className="details-pre">
                      {typeof errorDetails === "string"
                        ? errorDetails
                        : JSON.stringify(errorDetails, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

