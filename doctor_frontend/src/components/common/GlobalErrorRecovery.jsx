import React, { Component } from "react";
import ErrorVideoScreen from "./ErrorVideoScreen";
import { checkHealth } from "../../services/api";

/**
 * GlobalErrorRecovery
 * 
 * Comprehensive Error Guard and Auto-Recovery System for Zenve VetCare:
 * 1. Catches React render crashes (ErrorBoundary) to prevent the blank white page.
 * 2. Detects device internet disconnects (offline events).
 * 3. Catches backend server errors (500, 502, 503, 504) and connection dropouts.
 * 4. Displays an animated video player with a sleek fallback animation.
 * 5. Actively monitors health & auto-reconnects smoothly back to the website
 *    as soon as the internet or server is restored.
 */
class GlobalErrorRecovery extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorType: "offline", // "offline" | "server_error" | "runtime_error"
      errorMessage: "",
      errorDetails: null,
      countdown: 5,
      isChecking: false,
      isRestored: false,
    };

    this.timerId = null;
    this.checkHealthLock = false;
  }

  // Intercept React component render crashes (prevents React blank white page)
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorType: "runtime_error",
      errorMessage: error?.message || "An unexpected application error occurred.",
      errorDetails: error?.stack || null,
      countdown: 5,
      isRestored: false,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GlobalErrorRecovery captured runtime crash:", error, errorInfo);
    this.startAutoRecoveryLoop();
  }

  componentDidMount() {
    // 1. Initial network check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.triggerError("offline", "Your device is currently offline.");
    }

    // 2. Browser Online / Offline listeners
    window.addEventListener("offline", this.handleBrowserOffline);
    window.addEventListener("online", this.handleBrowserOnline);

    // 3. API Network & Server Error listeners (from axios interceptors)
    window.addEventListener("zenve:network-error", this.handleNetworkError);
    window.addEventListener("zenve:server-error", this.handleServerError);

    // 4. Global unhandled promise rejections (optional safeguard)
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    this.stopAutoRecoveryLoop();
    window.removeEventListener("offline", this.handleBrowserOffline);
    window.removeEventListener("online", this.handleBrowserOnline);
    window.removeEventListener("zenve:network-error", this.handleNetworkError);
    window.removeEventListener("zenve:server-error", this.handleServerError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  /* ------------------- EVENT HANDLERS ------------------- */

  handleBrowserOffline = () => {
    this.triggerError("offline", "Internet connection was disconnected.");
  };

  handleBrowserOnline = () => {
    // When browser goes back online, immediately verify health and restore
    this.runHealthCheck();
  };

  handleNetworkError = (event) => {
    const detail = event?.detail || {};
    const type = detail.type === "offline" ? "offline" : "server_error";
    this.triggerError(type, detail.message || "Unable to reach the network.");
  };

  handleServerError = (event) => {
    const detail = event?.detail || {};
    this.triggerError(
      "server_error",
      detail.message || `Server error (${detail.status || "500"})`,
      detail
    );
  };

  handleUnhandledRejection = (event) => {
    // Check if the rejection was a critical network or server failure
    const reason = event?.reason;
    if (
      reason?.message?.includes("Network Error") ||
      reason?.code === "ERR_NETWORK" ||
      reason?.response?.status >= 500
    ) {
      event.preventDefault(); // Prevent default console spam
      this.triggerError(
        "server_error",
        "Backend server is temporarily unreachable.",
        reason?.message
      );
    }
  };

  /* ------------------- ERROR TRIGGER & TIMERS ------------------- */

  triggerError = (errorType, errorMessage = "", errorDetails = null) => {
    // Do not overwrite an existing error with the same one repeatedly
    this.setState(
      (prevState) => {
        if (prevState.hasError && prevState.errorType === errorType) {
          return null; // Already displaying this error
        }
        return {
          hasError: true,
          errorType,
          errorMessage,
          errorDetails,
          countdown: 5,
          isRestored: false,
          isChecking: false,
        };
      },
      () => {
        this.startAutoRecoveryLoop();
      }
    );
  };

  startAutoRecoveryLoop = () => {
    this.stopAutoRecoveryLoop();

    this.timerId = setInterval(() => {
      this.setState((prevState) => {
        if (!prevState.hasError || prevState.isRestored) {
          return null;
        }

        if (prevState.countdown <= 1) {
          // Trigger health check
          this.runHealthCheck();
          return { countdown: 5 };
        }

        return { countdown: prevState.countdown - 1 };
      });
    }, 1000);
  };

  stopAutoRecoveryLoop = () => {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  };

  /* ------------------- HEALTH & RECONNECT CHECK ------------------- */

  runHealthCheck = async () => {
    if (this.checkHealthLock) return;
    this.checkHealthLock = true;

    this.setState({ isChecking: true });

    try {
      const health = await checkHealth();

      if (health.ok) {
        // Connection & Server are back!
        this.setState({
          isChecking: false,
          isRestored: true,
        });

        // Allow user to see "Connection Restored" confirmation for 900ms before returning to app
        setTimeout(() => {
          this.stopAutoRecoveryLoop();
          this.setState({
            hasError: false,
            errorType: null,
            errorMessage: "",
            errorDetails: null,
            isRestored: false,
            countdown: 5,
          });
        }, 900);
      } else {
        // Still not reachable
        this.setState({
          isChecking: false,
          countdown: 5,
        });
      }
    } catch {
      this.setState({
        isChecking: false,
        countdown: 5,
      });
    } finally {
      this.checkHealthLock = false;
    }
  };

  handleManualRetry = () => {
    this.runHealthCheck();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, errorType, errorMessage, errorDetails, countdown, isChecking, isRestored } =
      this.state;
    const { children, videoSrc = "/videos/error-animation.mp4" } = this.props;

    if (hasError) {
      return (
        <>
          <ErrorVideoScreen
            errorType={errorType}
            errorMessage={errorMessage}
            errorDetails={errorDetails}
            videoSrc={videoSrc}
            countdown={countdown}
            isChecking={isChecking}
            isRestored={isRestored}
            onRetry={this.handleManualRetry}
            onReload={this.handleReload}
          />
          {/* Keep children mounted in hidden background when not runtime error to preserve form state */}
          {errorType !== "runtime_error" && (
            <div style={{ display: "none" }} aria-hidden="true">
              {children}
            </div>
          )}
        </>
      );
    }

    return children;
  }
}

export const triggerErrorScreen = (type = "server_error", message = "") => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(type === "offline" ? "zenve:network-error" : "zenve:server-error", {
        detail: { type, message, timestamp: Date.now() },
      })
    );
  }
};

export default GlobalErrorRecovery;
