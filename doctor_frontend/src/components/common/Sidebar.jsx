import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, ChevronsUpDown, X } from "lucide-react";

import sidebarItems from "../../constants/sidebar";
import Logo from "./Logo";
import { useAuth } from "../../hooks/useAuth";
import { getDoctorProfile } from "../../services/doctorProfileService";

import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout, doctor: authDoctor } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [imgError, setImgError] = useState(false);

  const loadDoctorProfile = async () => {
    try {
      const data = await getDoctorProfile();
      setDoctor(data || null);
      setImgError(false);

      // Keep stored session synchronized with latest profile image state
      try {
        const stored = sessionStorage.getItem("zenve_doctor_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          const currentImg = data?.profileImage || "";
          if (parsed.profileImage !== currentImg) {
            parsed.profileImage = currentImg;
            sessionStorage.setItem("zenve_doctor_user", JSON.stringify(parsed));
          }
        }
      } catch (_) {}
    } catch {
      setDoctor(null);
    }
  };

  useEffect(() => {
    loadDoctorProfile();

    const handleDoctorProfileUpdated = (e) => {
      if (e?.detail && typeof e.detail.profileImage !== "undefined") {
        setDoctor((prev) => (prev ? { ...prev, profileImage: e.detail.profileImage } : prev));
      }
      loadDoctorProfile();
    };

    window.addEventListener("doctorProfileUpdated", handleDoctorProfileUpdated);
    return () => {
      window.removeEventListener("doctorProfileUpdated", handleDoctorProfileUpdated);
    };
  }, [authDoctor?.email]);

  const doctorName = doctor?.fullName?.trim() || authDoctor?.fullName?.trim() || "Doctor";
  const clinicName = doctor?.clinicHospital?.trim() || authDoctor?.clinicHospital?.trim() || "Clinic";
  // Strict check: if profile is empty or has no image, sidebar profile photo is also empty
  const rawImage = doctor !== null ? (doctor?.profileImage || "") : "";
  const profilePhoto =
    typeof rawImage === "string" &&
    rawImage.trim() !== "" &&
    rawImage.trim() !== "null" &&
    rawImage.trim() !== "undefined"
      ? rawImage.trim()
      : "";

  const getInitials = (name) => {
    if (!name || name === "Doctor") return "DR";
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "DR";
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const doctorInitials = getInitials(doctorName);

  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      {/* LOGO & MOBILE CLOSE BUTTON */}
      <div className="logo-section">
        <Logo />
        <button
          type="button"
          className="sidebar-mobile-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* MENU */}
      <nav className="menu-list">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.title}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "menu active" : "menu"
              }
              onClick={onClose}
            >
              <div className="menu-content">
                <Icon size={19} className="menu-icon" />
                <span className="menu-title">{item.title}</span>
              </div>

              {item.badge != null && (
                <span className="sidebar-pill-badge">{item.badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* DOCTOR PROFILE CARD */}
      <div className="sidebar-doctor-section">
        <div
          className="doctor-card"
          onClick={() => {
            navigate("/settings");
            onClose?.();
          }}
          title="Open doctor profile"
        >
          <div className="doctor-avatar">
            {profilePhoto && !imgError ? (
              <img
                src={profilePhoto}
                alt={doctorName}
                className="doctor-avatar-img"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="doctor-avatar-initials">{doctorInitials}</span>
            )}
          </div>

          <div className="doctor-info">
            <div className="doctor-info-header">
              <h4>{doctorName}</h4>
              <ChevronsUpDown size={14} className="doctor-chevron" />
            </div>
            <p className="doctor-clinic">{clinicName}</p>
            <div className="doctor-status">
              <span className="online-dot" />
              <span>Online</span>
            </div>
          </div>
        </div>

        {/* LOGOUT */}
        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            logout();
            navigate("/login");
            onClose?.();
          }}
          title="Log out"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}