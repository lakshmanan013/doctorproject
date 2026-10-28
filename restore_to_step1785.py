import re
import json

# 1. Restore AuthLayout.jsx
auth_layout_code = '''import {
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
'''

with open('doctor_frontend/src/layouts/AuthLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(auth_layout_code.strip() + '\n')
print('AuthLayout.jsx written!')

# 2. Restore Login.jsx
login_lines = []
for idx in [1841, 1843, 1845]:
    with open(f'Login_step_{idx}.txt', 'r', encoding='utf-8') as f:
        text = f.read()
    for l in text.splitlines():
        m = re.match(r'^\s*(\d+):\s?(.*)$', l)
        if m:
            line_no = int(m.group(1))
            code = m.group(2)
            login_lines.append((line_no, code))

login_lines.sort(key=lambda x: x[0])
seen = set()
unique_code = []
for no, code in login_lines:
    if no not in seen:
        seen.add(no)
        unique_code.append(code)

print('Login.jsx total lines:', len(unique_code))
with open('doctor_frontend/src/pages/Auth/Login.jsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(unique_code) + '\n')
print('Login.jsx written!')

# 3. Restore Register.jsx
with open('doctor_frontend/src/pages/Auth/Register.jsx', 'r', encoding='utf-8') as f:
    reg_content = f.read()

step2018_replacement = '''      {/* Security Assurance Badge */}
      <div className="auth-security-badge">
        <span className="auth-security-line" />
        <span className="auth-security-content">
          <FiShield className="auth-security-icon" size={16} />
          Secure veterinary practice management
        </span>
        <span className="auth-security-line" />
      </div>
    </AuthLayout>'''
step2018_target = '    </AuthLayout>'
if step2018_replacement in reg_content:
    reg_content = reg_content.replace(step2018_replacement, step2018_target)
    print('Reverted step 2018 in Register.jsx')

step2016_replacement = '''      <div className="auth-form-header">
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
        <h2>Create Doctor Account</h2>
        <p>Sign up to start managing your clinic.</p>
      </div>'''

step2016_target = '''      <div className="auth-form-header">
        <div className="auth-card-top-logo">
          <img
            src="/zenve.png"
            alt="Zenve Logo"
            className="auth-card-logo-img"
          />
        </div>
        <h2 className="auth-header-title">Create Doctor Account</h2>
        <p className="auth-header-sub">Veterinary Practice OS</p>
      </div>'''

if step2016_replacement in reg_content:
    reg_content = reg_content.replace(step2016_replacement, step2016_target)
    print('Reverted step 2016 in Register.jsx')

with open('doctor_frontend/src/pages/Auth/Register.jsx', 'w', encoding='utf-8') as f:
    f.write(reg_content)
print('Register.jsx written!')

# 4. Restore Auth.css
with open('Auth_css_step1785.css', 'r', encoding='utf-8') as f:
    auth_css = f.read()

with open('doctor_frontend/src/pages/Auth/Auth.css', 'w', encoding='utf-8') as f:
    f.write(auth_css)
print('Auth.css written!')

