import {
  FiCalendar,
  FiFileText,
  FiPackage,
  FiShield,
} from "react-icons/fi";

import AuthBackgroundSlideshow from "../components/auth/AuthBackgroundSlideshow";
import "../pages/Auth/Auth.css";

export default function AuthLayout({ children, className = "" }) {
  return (
    <div className={`auth-shell ${className}`.trim()}>

      {/* Looping 7-Second Crystal-Clear Background Slideshow */}
      <AuthBackgroundSlideshow />

      {/* -------------------- BRAND HERO PANEL -------------------- */}
      <div className="auth-brand">

        {/* Brand Top Header */}
        <div className="auth-brand-top">
          <div className="auth-brand-logo-icon">
            <img
              src="/zenve.png"
              alt="Zenve Logo"
              className="auth-zenve-logo"
            />
          </div>
          <div className="auth-brand-logo-text">
            <h3>Zenve Doctors</h3>
            <span className="auth-brand-badge-tag">Veterinary Practice OS</span>
          </div>
        </div>

        {/* Hero Mid Content (Compact, non-overlapping) */}
        <div className="auth-brand-mid">
          <h1 className="auth-hero-title">
            Run your clinic from one simple{" "}
            <span className="auth-hero-highlight">dashboard.</span>
          </h1>
        </div>

        {/* Brand Bottom Area (Feature icon boxes moved to bottom above footer) */}
        <div className="auth-brand-bottom-section">
          <div className="auth-brand-features" aria-label="Key features">
            <div className="auth-brand-feature" title="Smart appointment scheduling" data-tooltip="Smart scheduling">
              <div className="auth-brand-feature-icon">
                <FiCalendar size={20} />
              </div>
            </div>

            <div className="auth-brand-feature" title="Digital prescriptions & records" data-tooltip="Digital prescriptions">
              <div className="auth-brand-feature-icon">
                <FiFileText size={20} />
              </div>
            </div>

            <div className="auth-brand-feature" title="Inventory & billing" data-tooltip="Inventory & billing">
              <div className="auth-brand-feature-icon">
                <FiPackage size={20} />
              </div>
            </div>
          </div>

          {/* Brand Bottom Footer - Subtle System Tag */}
          <div className="auth-brand-bottom">
            <span>Veterinary Practice OS</span>
            <span className="auth-brand-bottom-divider">&bull;</span>
            <span className="auth-brand-bottom-version">v2.4.1</span>
          </div>
        </div>

      </div>

      {/* -------------------- FORM PANEL -------------------- */}
      <div className="auth-form-panel">
          <div className="auth-form-container">
            <div className="auth-form-wrap">
              {children}
            </div>

            {/* Form Bottom Copyright - Sleek Glassy Badge */}
            <div className="auth-form-copyright">
              <span>&copy; {new Date().getFullYear()} Zenve Technologies Inc.</span>
              <span className="auth-form-copyright-divider">&bull;</span>
              <span>All rights reserved</span>
              <span className="auth-form-copyright-divider">&bull;</span>
              <span className="auth-form-copyright-version">v2.4.1</span>
            </div>
          </div>
        </div>

      </div>
      );
}
