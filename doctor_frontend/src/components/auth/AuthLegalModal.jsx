import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FiShield,
  FiFileText,
  FiLock,
  FiDatabase,
  FiX,
  FiCheck,
  FiCheckCircle,
  FiInfo,
  FiAlertCircle,
  FiUserCheck,
  FiKey,
  FiCpu,
  FiArchive,
  FiMapPin,
  FiActivity,
} from "react-icons/fi";
import "./AuthLegalModal.css";

export const LEGAL_TABS = {
  TERMS: "terms",
  PRIVACY: "privacy",
  DATA_CONSENT: "data-consent",
  COLLECTED_DATA: "collected-data",
};

function AuthLegalModal({
  isOpen,
  onClose,
  initialTab = LEGAL_TABS.TERMS,
  onAccept,
  isAccepted = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="auth-legal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="auth-legal-modal-card" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="auth-legal-modal-header">
            <div className="auth-legal-header-title-box">
              <div className="auth-legal-icon-badge">
                <FiShield size={16} />
              </div>
              <div>
                <h2 className="auth-legal-title">Clinical Compliance &amp; Legal Policies</h2>
                <p className="auth-legal-subtitle">
                  Zenve Doctors Platform &bull; Professional Terms &amp; Consent v2.4
                </p>
              </div>
            </div>
            <button
              type="button"
              className="auth-legal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <FiX size={16} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="auth-legal-tab-nav">
            <button
              type="button"
              className={`auth-legal-tab-btn ${activeTab === LEGAL_TABS.TERMS ? "active" : ""}`}
              onClick={() => setActiveTab(LEGAL_TABS.TERMS)}
            >
              <FiFileText size={13} />
              <span>Terms &amp; Conditions</span>
            </button>

            <button
              type="button"
              className={`auth-legal-tab-btn ${activeTab === LEGAL_TABS.PRIVACY ? "active" : ""}`}
              onClick={() => setActiveTab(LEGAL_TABS.PRIVACY)}
            >
              <FiLock size={13} />
              <span>Privacy Policy</span>
            </button>

            <button
              type="button"
              className={`auth-legal-tab-btn ${activeTab === LEGAL_TABS.DATA_CONSENT ? "active" : ""}`}
              onClick={() => setActiveTab(LEGAL_TABS.DATA_CONSENT)}
            >
              <FiShield size={13} />
              <span>Data Consent</span>
            </button>

            <button
              type="button"
              className={`auth-legal-tab-btn ${activeTab === LEGAL_TABS.COLLECTED_DATA ? "active" : ""}`}
              onClick={() => setActiveTab(LEGAL_TABS.COLLECTED_DATA)}
            >
              <FiDatabase size={13} />
              <span>Data Collected</span>
            </button>
          </div>

          {/* Modal Body Content (Small, Clean, Neatable Grid) */}
          <div className="auth-legal-modal-body">
            {/* TAB 1: TERMS & CONDITIONS */}
            {activeTab === LEGAL_TABS.TERMS && (
              <div className="auth-legal-section">
                <div className="auth-legal-callout">
                  <FiInfo size={15} className="auth-legal-callout-icon" />
                  <p>
                    By using <strong>Zenve Doctors</strong>, you agree to comply with veterinary ethics, national licensing rules, and digital practice standards.
                  </p>
                </div>

                <div className="auth-legal-neat-list">
                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">01</div>
                    <div className="auth-legal-item-text">
                      <h4>Practitioner Eligibility &amp; Licensing</h4>
                      <p>Exclusive to licensed veterinarians with valid registration with national or state veterinary councils. Misrepresentation leads to immediate account termination.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">02</div>
                    <div className="auth-legal-item-text">
                      <h4>Account &amp; Credential Confidentiality</h4>
                      <p>Practitioners are solely responsible for safeguard of 2FA codes and login tokens. Clinical actions performed under your credentials carry legal responsibility.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">03</div>
                    <div className="auth-legal-item-text">
                      <h4>Digital Prescriptions &amp; Autonomy</h4>
                      <p>Veterinarians retain complete diagnostic and dosage discretion. Uploaded digital signatures constitute binding authorizations under tele-veterinary rules.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">04</div>
                    <div className="auth-legal-item-text">
                      <h4>Verification &amp; Administrative Review</h4>
                      <p>All accounts undergo medical license validation, KYC check, and clinic verification before unrestricted activation by Zenve Administration.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">05</div>
                    <div className="auth-legal-item-text">
                      <h4>Telehealth &amp; Teleconsultation Protocol</h4>
                      <p>Video consultations must adhere to telemedicine guidelines. Emergency and critical patients must be directed to in-person clinic emergency care.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRIVACY POLICY */}
            {activeTab === LEGAL_TABS.PRIVACY && (
              <div className="auth-legal-section">
                <div className="auth-legal-callout">
                  <FiLock size={15} className="auth-legal-callout-icon" />
                  <p>
                    We ensure strict confidentiality of practitioner records, clinic details, and patient clinical charts with enterprise encryption.
                  </p>
                </div>

                <div className="auth-legal-neat-list">
                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">01</div>
                    <div className="auth-legal-item-text">
                      <h4>TLS 1.3 &amp; AES-256 Encryption</h4>
                      <p>All traffic in transit is guarded by TLS 1.3 cryptographic protocols. Databases are encrypted at rest using AES-256 military-grade standards.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">02</div>
                    <div className="auth-legal-item-text">
                      <h4>Strict Zero-Ad &amp; Zero-Sale Policy</h4>
                      <p>We do not monetize, rent, or sell practitioner contact info or clinical patient charts to data brokers or advertisers under any circumstances.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">03</div>
                    <div className="auth-legal-item-text">
                      <h4>Multi-Factor &amp; Role-Based Access (RBAC)</h4>
                      <p>Access requires password plus SMS/OTP verification. System administration is segmented by role with tamper-evident audit logging.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">04</div>
                    <div className="auth-legal-item-text">
                      <h4>Statutory Archival &amp; Export Rights</h4>
                      <p>Prescription and clinical histories are retained in accordance with statutory medical record requirements. Practitioners can export data on request.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DATA CONCERN & CONSENT */}
            {activeTab === LEGAL_TABS.DATA_CONSENT && (
              <div className="auth-legal-section">
                <div className="auth-legal-callout auth-callout-warning">
                  <FiAlertCircle size={15} className="auth-legal-callout-icon" />
                  <p>
                    <strong>Informed Consent:</strong> You authorize Zenve to process essential veterinary credentials, clinical charts, and authentication telemetry.
                  </p>
                </div>

                <div className="auth-legal-neat-list">
                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">01</div>
                    <div className="auth-legal-item-text">
                      <h4>Official Veterinary Credentialing</h4>
                      <p>Validates registration certificates and council records to verify legitimate practitioner standing for animal healthcare clients.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">02</div>
                    <div className="auth-legal-item-text">
                      <h4>Authentication Telemetry &amp; Security</h4>
                      <p>Authorizes delivery of OTP verification codes to your registered phone, plus login IP logging to prevent unauthorized access.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">03</div>
                    <div className="auth-legal-item-text">
                      <h4>Central Appointment Synchronization</h4>
                      <p>Allows synchronizing non-sensitive clinic availability slots and public consult fees so pet parents can discover and book consultations.</p>
                    </div>
                  </div>

                  <div className="auth-legal-neat-item">
                    <div className="auth-legal-item-num">04</div>
                    <div className="auth-legal-item-text">
                      <h4>Data Revocation &amp; Account Closure</h4>
                      <p>You may request account deactivation at any time via <code>compliance@zenvevet.com</code>, subject to medical prescription retention laws.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: WHAT DATA WE COLLECT */}
            {activeTab === LEGAL_TABS.COLLECTED_DATA && (
              <div className="auth-legal-section">
                <div className="auth-legal-callout auth-callout-info">
                  <FiDatabase size={15} className="auth-legal-callout-icon" />
                  <p>
                    Transparent breakdown of all data collected and managed within Zenve Doctors:
                  </p>
                </div>

                    <div className="auth-data-neat-grid">
                      <div className="auth-data-neat-card">
                        <div className="auth-data-neat-badge">
                          <FiUserCheck size={13} />
                          <span>1. Practitioner Profile</span>
                        </div>
                        <ul>
                          <li><strong>Full Name &amp; Email:</strong> Identification &amp; official correspondence</li>
                          <li><strong>Phone Number:</strong> Secure 2FA SMS &amp; booking alerts</li>
                          <li><strong>Digital Signature:</strong> Rendered on official prescription PDFs</li>
                        </ul>
                      </div>

                        <div className="auth-data-neat-card">
                          <div className="auth-data-neat-badge">
                            <FiActivity size={13} />
                            <span>2. Medical Credentials</span>
                          </div>
                          <ul>
                            <li><strong>Registration No:</strong> Council validation &amp; audit trails</li>
                            <li><strong>Qualifications:</strong> BVSc, MVSc, or specializations</li>
                            <li><strong>Consultation Fees:</strong> Video &amp; in-clinic fee structure</li>
                          </ul>
                        </div>

                          <div className="auth-data-neat-card">
                            <div className="auth-data-neat-badge">
                              <FiMapPin size={13} />
                              <span>3. Clinic Details</span>
                            </div>
                            <ul>
                              <li><strong>Clinic Name &amp; Address:</strong> Practice facility location &amp; city</li>
                              <li><strong>Verification Photos:</strong> Clinic entrance &amp; inside KYC images</li>
                              <li><strong>Contact Desk:</strong> Practice landline / reception phone</li>
                            </ul>
                          </div>

                            <div className="auth-data-neat-card">
                              <div className="auth-data-neat-badge">
                                <FiCpu size={13} />
                                <span>4. Patient &amp; Telemetry</span>
                              </div>
                              <ul>
                                <li><strong>Pet &amp; Parent Details:</strong> Species, breed, age &amp; contact</li>
                                <li><strong>Clinical Records:</strong> Diagnosis, dosage &amp; vaccine charts</li>
                                <li><strong>Security Audit:</strong> Encrypted IP &amp; session timestamps</li>
                              </ul>
                            </div>
                          </div>
                        </div>
          )}
                      </div>

                      {/* Modal Footer / Acceptance CTA */}
                      <div className="auth-legal-modal-footer">
                        <div className="auth-legal-status-note">
                          {isAccepted ? (
                            <span className="auth-legal-status-accepted">
                              <FiCheckCircle size={14} /> Accepted
                            </span>
                          ) : (
                            <span className="auth-legal-status-pending">
                              <FiAlertCircle size={14} /> Acceptance required to proceed
                            </span>
                          )}
                        </div>

                        <div className="auth-legal-footer-actions">
                          <button
                            type="button"
                            className="btn btn-outline auth-legal-btn-close"
                            onClick={onClose}
                          >
                            Close
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary auth-legal-btn-accept"
                            onClick={() => {
                              if (onAccept) onAccept();
                              onClose();
                            }}
                          >
                            <FiCheck size={14} />
                            <span>I Accept All Terms</span>
                          </button>
                        </div>
                      </div>
                    </div>
    </div>,
    document.body
  );
}

export { AuthLegalModal };
                  export default AuthLegalModal;
