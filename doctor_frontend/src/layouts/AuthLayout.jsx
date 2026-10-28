import {
  FiCalendar,
  FiFileText,
  FiPackage,
  FiShield,
} from "react-icons/fi";

import "../pages/Auth/Auth.css";

export default function AuthLayout({ children, className = "" }) {
  return (
    <div className={`auth-shell ${className}`.trim()}>

      {/* Full-Screen Hero Background Image (Dog & Cat with Stethoscope in Clinic) */}
      <div className="auth-fullscreen-bg" aria-hidden="true">
        <img
          src="/images/doctor-login-hero.jpg"
          alt="Veterinary practice care with dog and cat"
          className="auth-fullscreen-img"
        />
        <div className="auth-fullscreen-overlay" />
      </div>

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

        {/* Hero Mid Content */}
        <div className="auth-brand-mid">
          <h1 className="auth-hero-title">
            Run your clinic<br />
            from one simple<br />
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

          {/* Brand Bottom Footer */}
          <div className="auth-brand-bottom">
            <span>&copy; Zenve Technologies Inc.</span>
            <span>v2.4.1</span>
          </div>
        </div>

      </div>

      {/* -------------------- FORM PANEL -------------------- */}
      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          {/* Mobile Brand Header (< 980px) */}
          <div className="auth-mobile-brand">
            <div className="auth-mobile-brand-logo">
              <img
                src="/zenve.png"
                alt="Zenve Logo"
                className="auth-mobile-zenve-logo"
              />
            </div>
            <div className="auth-mobile-brand-text">
              <h3>Zenve Doctors</h3>
              <span className="auth-mobile-brand-tag">Veterinary Practice OS</span>
            </div>
          </div>

          {children}
        </div>
      </div>

    </div>
  );
}
