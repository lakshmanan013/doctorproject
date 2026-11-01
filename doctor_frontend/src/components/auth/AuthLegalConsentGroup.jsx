import { useState } from "react";
import { FiExternalLink } from "react-icons/fi";
import AuthLegalModal, { LEGAL_TABS } from "./AuthLegalModal";
import "./AuthLegalConsentGroup.css";

function AuthLegalConsentGroup({
  accepted,
  onToggle,
  showError = false,
  errorMessage = "Please review and accept the legal policies and data consent to proceed.",
  contextText = "proceed",
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(LEGAL_TABS.TERMS);

  const handleOpen = (tab) => {
    setSelectedTab(tab);
    setModalOpen(true);
  };

  return (
    <div className={`auth-legal-consent-group ${showError ? "has-error" : ""}`}>
      {/* Checkbox input row */}
      <label className="auth-legal-checkbox-row">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onToggle(e.target.checked)}
          className="auth-legal-native-checkbox"
          id="auth-legal-consent-cb"
        />
        <span className="auth-legal-custom-checkbox" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" className="auth-check-icon">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="auth-legal-label-text">
          I agree to the{" "}
          <button
            type="button"
            className="auth-legal-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpen(LEGAL_TABS.TERMS);
            }}
          >
            Terms &amp; Conditions
          </button>
          ,{" "}
          <button
            type="button"
            className="auth-legal-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpen(LEGAL_TABS.PRIVACY);
            }}
          >
            Privacy Policy
          </button>
          , and{" "}
          <button
            type="button"
            className="auth-legal-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpen(LEGAL_TABS.DATA_CONSENT);
            }}
          >
            Data Consent
          </button>
          .
        </span>
      </label>

        {/* Sub-row for opening the Data Collection pop-up breakdown */}
        <div className="auth-legal-sub-bar">
          <button
            type="button"
            className="auth-legal-view-details-btn"
            onClick={() => handleOpen(LEGAL_TABS.COLLECTED_DATA)}
          >
            <span>What data do we collect?</span>
            <FiExternalLink size={9} />
          </button>
        </div>

        {/* Error alert text if submitted without consent */}
        {showError && (
          <div className="auth-legal-error-alert" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Interactive Comprehensive Legal Pop-up Modal */}
        <AuthLegalModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialTab={selectedTab}
          isAccepted={accepted}
          onAccept={() => onToggle(true)}
        />
      </div>
      );
}

      export {AuthLegalConsentGroup};
      export default AuthLegalConsentGroup;
