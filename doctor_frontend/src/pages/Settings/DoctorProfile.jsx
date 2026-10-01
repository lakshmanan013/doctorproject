import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import {
  FiShield,
  FiCreditCard,
  FiSave,
  FiCamera,
  FiHome,
  FiEdit3,
  FiTrash2,
  FiCheckCircle,
  FiMapPin,
  FiNavigation,
  FiRefreshCw,
  FiVideo,
  FiFeather,
  FiType,
  FiUploadCloud,
  FiDownload,
  FiPhone,
  FiSliders,
  FiFileText,
  FiScissors,
  FiDroplet,
  FiSlash,
} from "react-icons/fi";

import Input, {
  Field,
  Select,
} from "../../components/ui/Input";

import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ImageUploadBox from "../../components/common/ImageUploadBox";
import SignatureStudioModal from "../../components/common/SignatureStudioModal";
import { downloadSignaturePng, removeSignatureBackground } from "../../utils/signatureProcessor";

import {
  getDoctorProfile,
  updateDoctorProfile,
} from "../../services/doctorProfileService";
import { useAuth } from "../../hooks/useAuth";

import "./Settings.css";

const EMPTY = {
  fullName: "",
  qualification: "",
  speciality: "",
  council: "",
  clinic: "",
  facilityType: "",
  clinicPhone: "",
  area: "",
  city: "",
  pincode: "",
  experience: "",
  phone: "",
  email: "",
  signature: "",
  consultationFee: "",
  followupFee: "",
  slotLength: "",
  videoConsultationEnabled: false,
  profileImage: "",
  clinicInsideImage: "",
  clinicOutsideImage: "",
  digitalSignatureImage: "",
  secondarySignatureImage: "",
  secondarySignatureName: "",
  prescriptionSignatureMode: "primary",
};

const VERIFICATION_ITEMS = [
  {
    label: "Veterinary registration",
    key: "veterinaryRegistrationVerified",
  },
  {
    label: "KYC verification",
    key: "kycVerified",
  },
  {
    label: "Digital signature",
    key: "digitalSignatureVerified",
  },
  {
    label: "State council sync",
    key: "stateCouncilSyncVerified",
  },
];

export default function DoctorProfile() {
  const { doctor: authDoctor } = useAuth();
  const profileFileInputRef = useRef(null);
  const clinicInsideInputRef = useRef(null);
  const clinicOutsideInputRef = useRef(null);
  const primarySigFileInputRef = useRef(null);
  const secondarySigFileInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [verifications, setVerifications] = useState({
    veterinaryRegistrationVerified: false,
    kycVerified: false,
    digitalSignatureVerified: false,
    stateCouncilSyncVerified: false,
  });

  // Digital signature studio modal state & target
  const [signatureStudioOpen, setSignatureStudioOpen] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState("primary"); // "primary" | "secondary"
  const [customStudioSource, setCustomStudioSource] = useState(null);

  const openSignatureStudio = (target = "primary", source = null) => {
    setSignatureTarget(target);
    setCustomStudioSource(source);
    setSignatureStudioOpen(true);
  };

  const handleSignatureApplied = (dataUrl) => {
    const target = signatureTarget;
    setSignatureStudioOpen(false);
    setCustomStudioSource(null);
    if (target === "secondary") {
      autoSaveField("secondarySignatureImage", dataUrl);
      toast.success("Secondary signature saved successfully!");
    } else {
      autoSaveField("digitalSignatureImage", dataUrl);
      toast.success("Primary digital signature saved successfully!");
    }
  };

  const handleRemoveSignature = (target = "primary") => {
    if (target === "secondary") {
      autoSaveField("secondarySignatureImage", "");
      toast.success("Secondary signature removed");
    } else {
      autoSaveField("digitalSignatureImage", "");
      toast.success("Primary digital signature removed");
    }
  };

  const handleDownloadSignature = (target = "primary") => {
    const dataUrl = target === "secondary" ? form.secondarySignatureImage : form.digitalSignatureImage;
    if (!dataUrl) return;
    const nameSlug = form.fullName ? form.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "_") : "doctor";
    const filename = target === "secondary" ? `${nameSlug}_secondary_signature.png` : `${nameSlug}_digital_signature.png`;
    downloadSignaturePng(dataUrl, filename);
    toast.success("Signature downloaded");
  };

  // Instant 1-click Auto Remove Background from existing signature
  const handleQuickRemoveBackground = async (target = "primary") => {
    const existing = target === "secondary" ? form.secondarySignatureImage : form.digitalSignatureImage;
    if (!existing) return;
    try {
      toast.loading("Removing paper background...", { id: "bg-remove" });
      const transparentDataUrl = await removeSignatureBackground(existing);
      if (target === "secondary") {
        autoSaveField("secondarySignatureImage", transparentDataUrl);
      } else {
        autoSaveField("digitalSignatureImage", transparentDataUrl);
      }
      toast.success("Background removed! Transparent signature saved.", { id: "bg-remove" });
    } catch (err) {
      console.error("Quick background removal failed:", err);
      toast.error("Opening editor to refine background...", { id: "bg-remove" });
      openSignatureStudio(target, existing);
    }
  };

  // Instant 1-click Remove Colour (Monochrome Pure Black)
  const handleQuickRemoveColor = async (target = "primary") => {
    const existing = target === "secondary" ? form.secondarySignatureImage : form.digitalSignatureImage;
    if (!existing) return;
    try {
      toast.loading("Stripping color to monochrome black...", { id: "color-remove" });
      const monoDataUrl = await removeSignatureBackground(existing, { removeColor: true });
      if (target === "secondary") {
        autoSaveField("secondarySignatureImage", monoDataUrl);
      } else {
        autoSaveField("digitalSignatureImage", monoDataUrl);
      }
      toast.success("Converted to pure black & white signature!", { id: "color-remove" });
    } catch (err) {
      console.error("Quick color removal failed:", err);
      toast.error("Opening editor for color adjustment...", { id: "color-remove" });
      openSignatureStudio(target, existing);
    }
  };

  const handleDirectSignatureFile = (e, target = "primary") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      // Auto-open Signature Editor with target and image source correctly passed!
      openSignatureStudio(target, dataUrl);
      toast.success("Image loaded! Background automatically removed. Tweak settings & save.");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ==========================================
  // LOCATION AUTO-FETCH & VERIFY
  // ==========================================

  const cleanCityName = (city) => {
    if (!city) return "";
    return city
      .replace(/\s*(Corporation|Municipal Corporation|City Corporation|District|Division|Municipality)\s*/gi, "")
      .trim();
  };

  const handleFetchLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsFetchingLocation(true);
    const toastId = toast.loading("Detecting current GPS location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          let detectedArea = "";
          let detectedCity = "";
          let detectedPincode = "";

          // 1. Try Nominatim OpenStreetMap reverse geocoding
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  "Accept-Language": "en",
                },
              }
            );
            if (res.ok) {
              const data = await res.json();
              const addr = data?.address || {};

              // Extract Area name (suburb, neighbourhood, residential, subdistrict, etc.)
              detectedArea = (
                addr.suburb ||
                addr.neighbourhood ||
                addr.residential ||
                addr.subdistrict ||
                addr.quarter ||
                addr.city_district ||
                addr.locality ||
                addr.village ||
                addr.hamlet ||
                ""
              ).trim();

              detectedCity = cleanCityName(
                addr.city || addr.town || addr.municipality || addr.state_district || addr.district || addr.county || ""
              );
              detectedPincode = (addr.postcode || "").trim();
            }
          } catch (e) {
            console.warn("Nominatim reverse geocoding failed, trying fallback:", e);
          }

          // 2. Fallback to BigDataCloud reverse geocode client
          if (!detectedCity || !detectedPincode || !detectedArea) {
            try {
              const bdcRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
              );
              if (bdcRes.ok) {
                const bdcData = await bdcRes.json();
                if (!detectedCity) {
                  detectedCity = cleanCityName(bdcData?.city || bdcData?.principalSubdivision || "");
                }
                if (!detectedArea) {
                  const bdcLocality = (bdcData?.locality || "").trim();
                  if (bdcLocality && bdcLocality.toLowerCase() !== detectedCity.toLowerCase()) {
                    detectedArea = bdcLocality;
                  }
                }
                if (!detectedPincode) {
                  detectedPincode = (bdcData?.postcode || "").trim();
                }
              }
            } catch (e) {
              console.warn("BigDataCloud reverse geocoding fallback failed:", e);
            }
          }

          // 3. Fallback: if pincode is available and area or city is still empty, look up Indian Postal Pincode API
          if (detectedPincode && (!detectedArea || !detectedCity)) {
            try {
              const pinClean = detectedPincode.replace(/\D/g, "");
              if (pinClean.length === 6) {
                const pinRes = await fetch(`https://api.postalpincode.in/pincode/${pinClean}`);
                if (pinRes.ok) {
                  const pinData = await pinRes.json();
                  if (pinData?.[0]?.Status === "Success" && pinData[0].PostOffice?.length > 0) {
                    const po = pinData[0].PostOffice[0];
                    if (!detectedArea) {
                      detectedArea = po.Name || "";
                    }
                    if (!detectedCity && po.District) {
                      detectedCity = cleanCityName(po.District);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Postal pincode lookup fallback failed:", e);
            }
          }

          // Clean up if area and city duplicate
          if (detectedArea && detectedCity && detectedArea.toLowerCase() === detectedCity.toLowerCase()) {
            detectedArea = "";
          }
          if (!detectedCity && detectedArea) {
            detectedCity = detectedArea;
            detectedArea = "";
          }

          if (!detectedCity && !detectedPincode && !detectedArea) {
            toast.error("Could not determine area, city or pincode from coordinates", { id: toastId });
            setIsFetchingLocation(false);
            return;
          }

          // Update form state and auto-save
          setForm((current) => {
            const newArea = detectedArea || current.area;
            const newCity = detectedCity || current.city;
            const newPincode = detectedPincode || current.pincode;

            const updated = {
              ...current,
              area: newArea,
              city: newCity,
              pincode: newPincode,
            };

            const profile = {
              fullName: updated.fullName?.trim() || "",
              qualification: updated.qualification?.trim() || "",
              speciality: updated.speciality?.trim() || "",
              councilRegistration: updated.council?.trim() || "",
              clinicHospital: updated.clinic?.trim() || "",
              facilityType: updated.facilityType?.trim() || "",
              clinicPhone: updated.clinicPhone?.trim() || "",
              area: newArea?.trim() || "",
              city: newCity?.trim() || "",
              pincode: newPincode === "" || newPincode == null ? null : Number(newPincode),
              experience: updated.experience === "" || updated.experience == null ? null : Number(updated.experience),
              phone: updated.phone?.trim() || "",
              email: updated.email?.trim() || "",
              digitalSignatureName: updated.signature?.trim() || "",
              consultationFee: updated.consultationFee === "" || updated.consultationFee == null ? null : Number(updated.consultationFee),
              followUpFee: updated.followupFee === "" || updated.followupFee == null ? null : Number(updated.followupFee),
              slotLength: updated.slotLength === "" || updated.slotLength == null ? null : Number(updated.slotLength),
              videoConsultationEnabled: Boolean(updated.videoConsultationEnabled),
              profileImage: updated.profileImage || "",
              clinicInsideImage: updated.clinicInsideImage || "",
              clinicOutsideImage: updated.clinicOutsideImage || "",
              digitalSignatureImage: updated.digitalSignatureImage || "",
              secondarySignatureImage: updated.secondarySignatureImage || "",
              secondarySignatureName: updated.secondarySignatureName?.trim() || "",
            };

            updateDoctorProfile(profile)
              .then(() => {
                window.dispatchEvent(new Event("doctorProfileUpdated"));
              })
              .catch((err) => {
                console.error("Failed to auto-save location to profile:", err);
              });

            return updated;
          });

          setLocationVerified(true);
          const locationParts = [detectedArea, detectedCity, detectedPincode].filter(Boolean);
          toast.success(
            `Location verified: ${locationParts.join(", ")}`,
            { id: toastId }
          );
        } catch (err) {
          console.error("Error processing geolocation:", err);
          toast.error("Failed to process location coordinates", { id: toastId });
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        setIsFetchingLocation(false);
        let msg = "Failed to retrieve your location";
        if (error.code === 1) {
          msg = "Location permission denied. Please allow location access in your browser.";
        } else if (error.code === 2) {
          msg = "Location unavailable. Please check your GPS / network connection.";
        } else if (error.code === 3) {
          msg = "Location request timed out. Please try again.";
        }
        toast.error(msg, { id: toastId });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // ==========================================
  // UPDATE FORM & AUTO-SAVE IMAGES
  // ==========================================

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const autoSaveField = async (key, value) => {
    setForm((current) => {
      const updated = { ...current, [key]: value };

      if (key === "secondarySignatureImage") {
        try { localStorage.setItem("doc_secondary_sig_img", value || ""); } catch (_) { }
      }
      if (key === "secondarySignatureName") {
        try { localStorage.setItem("doc_secondary_sig_name", value || ""); } catch (_) { }
      }
      if (key === "prescriptionSignatureMode") {
        try { localStorage.setItem("doc_rx_sig_mode", value || "primary"); } catch (_) { }
      }

      // Construct backend profile payload
      const profile = {
        fullName: updated.fullName?.trim() || "",
        qualification: updated.qualification?.trim() || "",
        speciality: updated.speciality?.trim() || "",
        councilRegistration: updated.council?.trim() || "",
        clinicHospital: updated.clinic?.trim() || "",
        facilityType: updated.facilityType?.trim() || "",
        clinicPhone: updated.clinicPhone?.trim() || "",
        area: updated.area?.trim() || "",
        city: updated.city?.trim() || "",
        pincode: updated.pincode === "" || updated.pincode == null ? null : Number(updated.pincode),
        experience: updated.experience === "" || updated.experience == null ? null : Number(updated.experience),
        phone: updated.phone?.trim() || "",
        email: updated.email?.trim() || "",
        digitalSignatureName: updated.fullName
          ? `${updated.fullName.toLowerCase().startsWith("dr") ? updated.fullName : `Dr. ${updated.fullName}`}${updated.qualification ? `, ${updated.qualification}` : ""}`
          : "",
        consultationFee: updated.consultationFee === "" || updated.consultationFee == null ? null : Number(updated.consultationFee),
        followUpFee: updated.followupFee === "" || updated.followupFee == null ? null : Number(updated.followupFee),
        slotLength: updated.slotLength === "" || updated.slotLength == null ? null : Number(updated.slotLength),
        videoConsultationEnabled: Boolean(updated.videoConsultationEnabled),
        profileImage: updated.profileImage || "",
        clinicInsideImage: updated.clinicInsideImage || "",
        clinicOutsideImage: updated.clinicOutsideImage || "",
        digitalSignatureImage: updated.digitalSignatureImage || "",
        secondarySignatureImage: updated.secondarySignatureImage || "",
        secondarySignatureName: updated.secondarySignatureName?.trim() || "",
      };

      // Persist directly to backend database
      updateDoctorProfile(profile)
        .then(() => {
          if (key === "profileImage") {
            window.dispatchEvent(new CustomEvent("doctorProfileUpdated", { detail: { profileImage: value } }));
          }
          window.dispatchEvent(new Event("doctorProfileUpdated"));
        })
        .catch((err) => {
          console.error(`Failed to auto-save ${key}:`, err);
        });

      return updated;
    });
  };

  const handleProfilePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

        autoSaveField("profileImage", dataUrl);
        toast.success("Profile photo uploaded & saved to database");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGenericImageSelect = (key, e, successMsg) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        autoSaveField(key, dataUrl);
        toast.success(successMsg || "Photo uploaded & saved");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ==========================================
  // LOAD PROFILE
  // ==========================================

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);

        const data = await getDoctorProfile();

        setForm({
          fullName: data?.fullName || authDoctor?.fullName || "",
          qualification: data?.qualification ?? "",
          speciality: data?.speciality ?? "",
          council: data?.councilRegistration ?? "",
          clinic: data?.clinicHospital ?? "",
          facilityType: data?.facilityType ?? "",
          clinicPhone: data?.clinicPhone ?? "",
          area: data?.area ?? "",
          city: data?.city ?? "",
          pincode: data?.pincode ?? "",
          experience: data?.experience ?? "",
          phone: data?.phone || authDoctor?.phone || "",
          email: data?.email || authDoctor?.email || "",
          signature: data?.digitalSignatureName ?? "",
          consultationFee: data?.consultationFee ?? "",
          followupFee: data?.followUpFee ?? "",
          slotLength: data?.slotLength ?? "",
          videoConsultationEnabled: data?.videoConsultationEnabled === true,
          profileImage: data?.profileImage ?? "",
          clinicInsideImage: data?.clinicInsideImage ?? "",
          clinicOutsideImage: data?.clinicOutsideImage ?? "",
          digitalSignatureImage: data?.digitalSignatureImage ?? "",
          secondarySignatureImage: data?.secondarySignatureImage || localStorage.getItem("doc_secondary_sig_img") || "",
          secondarySignatureName: data?.secondarySignatureName || localStorage.getItem("doc_secondary_sig_name") || "",
          prescriptionSignatureMode: localStorage.getItem("doc_rx_sig_mode") === "secondary" ? "secondary" : "primary",
        });

        setVerifications({
          veterinaryRegistrationVerified: data?.veterinaryRegistrationVerified ?? false,
          kycVerified: data?.kycVerified ?? false,
          digitalSignatureVerified: data?.digitalSignatureVerified ?? false,
          stateCouncilSyncVerified: data?.stateCouncilSyncVerified ?? false,
        });

        if (data?.city || data?.pincode || data?.area) {
          setLocationVerified(true);
        }
      } catch (err) {
        console.error("Error loading doctor profile:", err);
        toast.error("Failed to load doctor profile");

        setForm({
          ...EMPTY,
          fullName: authDoctor?.fullName || "",
          phone: authDoctor?.phone || "",
          email: authDoctor?.email || "",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authDoctor?.email]);

  // ==========================================
  // SAVE PROFILE
  // ==========================================

  const save = async () => {
    try {
      setSaving(true);

      const profile = {
        fullName: form.fullName.trim(),
        qualification: form.qualification.trim(),
        speciality: form.speciality.trim(),
        councilRegistration: form.council.trim(),
        clinicHospital: form.clinic.trim(),
        facilityType: form.facilityType?.trim() || "",
        clinicPhone: form.clinicPhone.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode === "" ? null : Number(form.pincode),
        experience: form.experience === "" ? null : Number(form.experience),
        phone: form.phone.trim(),
        email: form.email.trim(),
        digitalSignatureName: form.fullName
          ? `${form.fullName.toLowerCase().startsWith("dr") ? form.fullName : `Dr. ${form.fullName}`}${form.qualification ? `, ${form.qualification}` : ""}`
          : "",
        consultationFee: form.consultationFee === "" ? null : Number(form.consultationFee),
        followUpFee: form.followupFee === "" ? null : Number(form.followupFee),
        slotLength: form.slotLength === "" ? null : Number(form.slotLength),
        videoConsultationEnabled: Boolean(form.videoConsultationEnabled),
        profileImage: form.profileImage,
        clinicInsideImage: form.clinicInsideImage,
        clinicOutsideImage: form.clinicOutsideImage,
        digitalSignatureImage: form.digitalSignatureImage,
        secondarySignatureImage: form.secondarySignatureImage,
        secondarySignatureName: form.fullName
          ? `${form.fullName.toLowerCase().startsWith("dr") ? form.fullName : `Dr. ${form.fullName}`}${form.speciality ? ` · ${form.speciality}` : ""}`
          : "",
      };

      const saved = await updateDoctorProfile(profile);

      setForm((prev) => ({
        ...prev,
        fullName: saved?.fullName ?? prev.fullName,
        qualification: saved?.qualification ?? prev.qualification,
        speciality: saved?.speciality ?? prev.speciality,
        council: saved?.councilRegistration ?? prev.council,
        clinic: saved?.clinicHospital ?? prev.clinic,
        facilityType: saved?.facilityType ?? prev.facilityType,
        clinicPhone: saved?.clinicPhone ?? prev.clinicPhone,
        city: saved?.city ?? prev.city,
        pincode: saved?.pincode ?? prev.pincode,
        experience: saved?.experience ?? prev.experience,
        phone: saved?.phone ?? prev.phone,
        email: saved?.email ?? prev.email,
        signature: saved?.digitalSignatureName ?? prev.signature,
        consultationFee: saved?.consultationFee ?? prev.consultationFee,
        followupFee: saved?.followUpFee ?? prev.followupFee,
        slotLength: saved?.slotLength ?? prev.slotLength,
        videoConsultationEnabled: saved?.videoConsultationEnabled === true,
        profileImage: saved?.profileImage ?? prev.profileImage,
        clinicInsideImage: saved?.clinicInsideImage ?? prev.clinicInsideImage,
        clinicOutsideImage: saved?.clinicOutsideImage ?? prev.clinicOutsideImage,
        digitalSignatureImage: saved?.digitalSignatureImage ?? prev.digitalSignatureImage,
        secondarySignatureImage: saved?.secondarySignatureImage ?? prev.secondarySignatureImage,
        secondarySignatureName: saved?.secondarySignatureName ?? prev.secondarySignatureName,
      }));

      toast.success("Doctor profile saved successfully");
      window.dispatchEvent(new Event("doctorProfileUpdated"));
    } catch (error) {
      console.error("Failed to save doctor profile:", error);
      toast.error(
        error?.response?.data?.message || "Failed to save doctor profile"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <p className="text-muted">Loading doctor profile...</p>
      </div>
    );
  }

  return (
    <div className="settings-layout">
      {/* ===================================== */}
      {/* LEFT SIDE                             */}
      {/* ===================================== */}

      <div className="stack-6">
        {/* PROFESSIONAL DETAILS */}
        <div className="panel">
          <h3 className="settings-heading">
            <FiShield className="settings-icon" />
            Professional details
          </h3>

          {/* DOCTOR PROFILE PHOTO DISPLAY / UPLOAD */}
          <div style={{ marginBottom: 20 }}>
            {form.profileImage ? (
              <div className="doctor-avatar-preview-card">
                <div className="doctor-avatar-preview-wrap">
                  <img
                    src={form.profileImage}
                    alt={form.fullName || "Doctor Profile"}
                    className="doctor-avatar-preview-img"
                  />
                  <span className="doctor-avatar-online-indicator" title="Online" />
                </div>

                <div className="doctor-avatar-preview-meta">
                  <div className="doctor-avatar-title-row">
                    <span className="doctor-avatar-title">Doctor Profile Photo</span>
                    <span className="doctor-avatar-badge">
                      <FiCheckCircle size={12} /> Active Avatar
                    </span>
                  </div>

                  <div className="doctor-avatar-actions">
                    <button
                      type="button"
                      className="btn-avatar-change"
                      onClick={() => profileFileInputRef.current?.click()}
                    >
                      <FiCamera size={13} /> Change Photo
                    </button>
                    <button
                      type="button"
                      className="btn-avatar-remove"
                      onClick={() => {
                        autoSaveField("profileImage", "");
                        toast.success("Profile photo removed");
                      }}
                    >
                      <FiTrash2 size={13} /> Remove
                    </button>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleProfilePhotoSelect}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 300 }}>
                <ImageUploadBox
                  label="Doctor Profile Photo"
                  badgeText="Avatar"
                  value={form.profileImage}
                  onChange={(val) => {
                    autoSaveField("profileImage", val);
                    toast.success("Profile photo saved");
                  }}
                  placeholderIcon={<FiCamera size={18} />}
                  helperText="Upload official profile photo (JPG/PNG)"
                  height={96}
                />
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <Field label="Full name">
              <Input
                type="text"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
              />
            </Field>

            <Field label="Qualification">
              <Input
                type="text"
                value={form.qualification}
                onChange={(e) => update("qualification", e.target.value)}
              />
            </Field>

            <Field label="Speciality">
              <Input
                type="text"
                placeholder="e.g. Small animal surgery, Dermatology"
                value={form.speciality}
                onChange={(e) => update("speciality", e.target.value)}
              />
            </Field>

            <Field label="Council registration">
              <Input
                type="text"
                value={form.council}
                onChange={(e) => update("council", e.target.value)}
              />
            </Field>

            <Field label="Clinic / Hospital">
              <Input
                type="text"
                placeholder="e.g. Zenve Veterinary Clinic"
                value={form.clinic}
                onChange={(e) => update("clinic", e.target.value)}
              />
            </Field>

            <Field label="Hospital or Clinic phone number">
              <Input
                type="tel"
                placeholder="e.g. +91 44 2345 6789 / 98765 43210"
                value={form.clinicPhone}
                onChange={(e) => update("clinicPhone", e.target.value)}
              />
            </Field>

            <Field label="Facility type">
              <Select
                value={form.facilityType}
                onChange={(e) => update("facilityType", e.target.value)}
              >
                <option value="">Select facility type</option>
                <option value="Clinic">Clinic</option>
                <option value="Hospital">Hospital</option>
                <option value="Mobile Clinic / Home Visit">Mobile Clinic / Home Visit</option>
                <option value="Specialty Referral Center">Specialty Referral Center</option>
                <option value="Emergency Hospital">Emergency Hospital</option>
                <option value="Diagnostic Center">Diagnostic Center</option>
                <option value="Animal Shelter / NGO">Animal Shelter / NGO</option>
                <option value="Other">Other</option>
              </Select>
            </Field>

            <Field label="Experience (years)">
              <Input
                type="number"
                min="0"
                placeholder="e.g. 5"
                value={form.experience}
                onChange={(e) => update("experience", e.target.value)}
              />
            </Field>
          </div>

          <div className="form-grid-3" style={{ marginTop: 16 }}>
            <Field label="Area / Locality">
              <Input
                type="text"
                placeholder="e.g. Indiranagar, Anna Nagar"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
              />
            </Field>

            <Field label="City">
              <Input
                type="text"
                placeholder="e.g. Chennai, Bangalore"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>

            <Field label="Pincode">
              <Input
                type="number"
                placeholder="e.g. 600017"
                value={form.pincode}
                onChange={(e) => update("pincode", e.target.value)}
              />
            </Field>
          </div>

          {/* CLINIC INSIDE & OUTSIDE PHOTOS */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#334155", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <FiHome size={15} color="#6366f1" /> Clinic Photos
            </h4>
            <div className="form-grid-2" style={{ gap: 14 }}>
              {/* CLINIC INSIDE PHOTO */}
              {form.clinicInsideImage ? (
                <div className="clinic-photo-uploaded-card">
                  <div className="clinic-photo-card-top">
                    <div className="clinic-photo-card-header-left">
                      <div className="clinic-photo-icon-box">
                        <FiHome size={18} />
                      </div>
                      <div className="clinic-photo-card-info">
                        <span className="clinic-photo-card-title">Clinic Inside Photo</span>
                        <span className="clinic-photo-card-sub">Interior Photo Attached</span>
                      </div>
                    </div>
                    <span className="clinic-photo-card-badge">
                      <FiCheckCircle size={11} /> Uploaded
                    </span>
                  </div>

                  <div className="clinic-photo-card-bottom">
                    <div className="clinic-photo-card-actions">
                      <button
                        type="button"
                        className="btn-avatar-change"
                        onClick={() => clinicInsideInputRef.current?.click()}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        className="btn-avatar-remove"
                        onClick={() => {
                          autoSaveField("clinicInsideImage", "");
                          toast.success("Clinic inside photo removed");
                        }}
                      >
                        <FiTrash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                  <input
                    ref={clinicInsideInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleGenericImageSelect("clinicInsideImage", e, "Clinic inside photo updated & saved")}
                  />
                </div>
              ) : (
                <ImageUploadBox
                  label="Clinic Inside Photo"
                  badgeText="Interior"
                  value={form.clinicInsideImage}
                  onChange={(val) => {
                    autoSaveField("clinicInsideImage", val);
                    toast.success("Clinic inside photo saved");
                  }}
                  placeholderIcon={<FiHome size={18} />}
                  helperText="Waiting / Consultation room"
                  height={110}
                />
              )}

              {/* CLINIC OUTSIDE PHOTO */}
              {form.clinicOutsideImage ? (
                <div className="clinic-photo-uploaded-card">
                  <div className="clinic-photo-card-top">
                    <div className="clinic-photo-card-header-left">
                      <div className="clinic-photo-icon-box">
                        <FiHome size={18} />
                      </div>
                      <div className="clinic-photo-card-info">
                        <span className="clinic-photo-card-title">Clinic Outside Photo</span>
                        <span className="clinic-photo-card-sub">Exterior Photo Attached</span>
                      </div>
                    </div>
                    <span className="clinic-photo-card-badge">
                      <FiCheckCircle size={11} /> Uploaded
                    </span>
                  </div>

                  <div className="clinic-photo-card-bottom">
                    <div className="clinic-photo-card-actions">
                      <button
                        type="button"
                        className="btn-avatar-change"
                        onClick={() => clinicOutsideInputRef.current?.click()}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        className="btn-avatar-remove"
                        onClick={() => {
                          autoSaveField("clinicOutsideImage", "");
                          toast.success("Clinic outside photo removed");
                        }}
                      >
                        <FiTrash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                  <input
                    ref={clinicOutsideInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleGenericImageSelect("clinicOutsideImage", e, "Clinic outside photo updated & saved")}
                  />
                </div>
              ) : (
                <ImageUploadBox
                  label="Clinic Outside Photo"
                  badgeText="Exterior"
                  value={form.clinicOutsideImage}
                  onChange={(val) => {
                    autoSaveField("clinicOutsideImage", val);
                    toast.success("Clinic outside photo saved");
                  }}
                  placeholderIcon={<FiHome size={18} />}
                  helperText="Entrance / Clinic board"
                  height={110}
                />
              )}
            </div>
          </div>
        </div>

        {/* CONTACT DETAILS */}
        <div className="panel">
          <h3 className="settings-heading">
            <FiPhone className="settings-icon" />
            Contact details
          </h3>

          <div className="form-grid-2">
            <Field label="Personal phone number">
              <Input
                type="text"
                placeholder="e.g. +91 98765 43210"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>

            <Field label="Email address">
              <Input
                type="email"
                placeholder="e.g. doctor@example.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* OFFICIAL DIGITAL SIGNATURES & PRESCRIPTION SIGN-OFF */}
        <div className="panel doc-signature-panel">
          <div className="doc-sig-panel-header">
            <div>
              <h3 className="settings-heading" style={{ marginBottom: 4 }}>
                <FiFeather className="settings-icon" />
                Digital signatures & prescription sign-off
              </h3>
              <p className="doc-sig-panel-subtitle">
                Manage your primary and secondary digital signatures. Upload signature photos, level the axis, remove the paper background, and convert into certified digital ink.
              </p>
            </div>
            <div className="doc-sig-status-badge-wrap">
              {verifications.digitalSignatureVerified ? (
                <span className="doc-sig-status-badge verified">
                  <FiCheckCircle size={13} /> Council Verified
                </span>
              ) : (form.digitalSignatureImage || form.secondarySignatureImage) ? (
                <span className="doc-sig-status-badge active">
                  <FiCheckCircle size={13} /> Signatures Active
                </span>
              ) : (
                <span className="doc-sig-status-badge pending">
                  Signature Not Configured
                </span>
              )}
            </div>
          </div>

          {/* TWO SIGNATURE UPLOAD SLOTS: PRIMARY & SECONDARY */}
          <div className="doc-dual-signatures-grid">
            {/* ========================================================= */}
            {/* SIGNATURE OPTION 1: PRIMARY DIGITAL SIGNATURE             */}
            {/* ========================================================= */}
            <div className="doc-sig-slot-card primary-slot">
              <div className="doc-sig-slot-header">
                <div className="doc-sig-slot-title-group">
                  <span className="doc-sig-slot-tag primary">Signature Option 1</span>
                  <h4 className="doc-sig-slot-title">Primary Digital Signature</h4>
                  <p className="doc-sig-slot-desc">Official signature used for patient prescriptions and legal clinical documents</p>
                </div>
                {form.digitalSignatureImage && (
                  <span className="doc-sig-slot-status active">Active</span>
                )}
              </div>

              {/* Direct file input for primary signature */}
              <input
                ref={primarySigFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleDirectSignatureFile(e, "primary")}
              />

              {form.digitalSignatureImage ? (
                <>
                  <div className="doc-sig-slot-preview-box">
                    <img
                      src={form.digitalSignatureImage}
                      alt="Primary Signature"
                      className="doc-sig-slot-preview-img"
                    />
                    <div className="doc-sig-slot-overlay">
                      <button
                        type="button"
                        className="doc-sig-btn-mini highlight"
                        onClick={() => openSignatureStudio("primary", form.digitalSignatureImage)}
                        title="Edit, Align Axis, or Adjust Signature"
                      >
                        <FiEdit3 size={13} /> Edit Option
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini"
                        onClick={() => primarySigFileInputRef.current?.click()}
                        title="Upload New File"
                      >
                        <FiUploadCloud size={13} /> Replace
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini"
                        onClick={() => handleDownloadSignature("primary")}
                        title="Download Transparent PNG"
                      >
                        <FiDownload size={13} /> Save
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini danger"
                        onClick={() => handleRemoveSignature("primary")}
                        title="Remove Signature"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Quick Actions Toolbar */}
                  <div className="doc-sig-quick-actions-row">
                    <button
                      type="button"
                      className="doc-sig-quick-btn"
                      onClick={() => handleQuickRemoveBackground("primary")}
                      title="Automatically strip paper background to transparent"
                    >
                      <FiScissors size={12} /> Auto Remove BG
                    </button>
                    <button
                      type="button"
                      className="doc-sig-quick-btn"
                      onClick={() => handleQuickRemoveColor("primary")}
                      title="Convert to pure high-contrast black & white signature"
                    >
                      <FiSlash size={12} /> Remove Colour (B&W)
                    </button>
                    <button
                      type="button"
                      className="doc-sig-quick-btn studio"
                      onClick={() => openSignatureStudio("primary", form.digitalSignatureImage)}
                      title="Open full alignment and signature edit options"
                    >
                      <FiSliders size={12} /> Update Option
                    </button>
                  </div>
                </>
              ) : (
                <div className="doc-sig-slot-empty-zone">
                  <div className="doc-sig-slot-empty-prompt">
                    <FiFeather size={28} className="doc-sig-empty-icon primary" />
                    <span className="doc-sig-empty-main">Upload Primary Signature</span>
                    <span className="doc-sig-empty-sub">Upload a photo of your signature from paper or document:</span>
                  </div>
                  <div className="doc-sig-slot-action-row">
                    <button
                      type="button"
                      className="doc-sig-slot-btn highlight"
                      onClick={() => primarySigFileInputRef.current?.click()}
                      title="Upload signature photo with automatic background removal"
                    >
                      <FiUploadCloud size={14} /> Upload Signature Photo
                    </button>
                    <button
                      type="button"
                      className="doc-sig-slot-btn"
                      onClick={() => openSignatureStudio("primary")}
                      title="Open Signature Edit Option"
                    >
                      <FiEdit3 size={14} /> Edit Option
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SIGNATURE OPTION 2: SECONDARY SIGNATURE                   */}
            {/* ========================================================= */}
            <div className="doc-sig-slot-card secondary-slot">
              <div className="doc-sig-slot-header">
                <div className="doc-sig-slot-title-group">
                  <span className="doc-sig-slot-tag secondary">Signature Option 2</span>
                  <h4 className="doc-sig-slot-title">Secondary Signature</h4>
                  <p className="doc-sig-slot-desc">Alternate or secondary digital signature for prescriptions and reports</p>
                </div>
                {form.secondarySignatureImage && (
                  <span className="doc-sig-slot-status active">Active</span>
                )}
              </div>

              {/* Direct file input for secondary signature */}
              <input
                ref={secondarySigFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleDirectSignatureFile(e, "secondary")}
              />

              {form.secondarySignatureImage ? (
                <>
                  <div className="doc-sig-slot-preview-box">
                    <img
                      src={form.secondarySignatureImage}
                      alt="Secondary Signature"
                      className="doc-sig-slot-preview-img"
                    />
                    <div className="doc-sig-slot-overlay">
                      <button
                        type="button"
                        className="doc-sig-btn-mini highlight"
                        onClick={() => openSignatureStudio("secondary", form.secondarySignatureImage)}
                        title="Edit, Align Axis, or Adjust Signature"
                      >
                        <FiEdit3 size={13} /> Edit Option
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini"
                        onClick={() => secondarySigFileInputRef.current?.click()}
                        title="Upload New File"
                      >
                        <FiUploadCloud size={13} /> Replace
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini"
                        onClick={() => handleDownloadSignature("secondary")}
                        title="Download PNG"
                      >
                        <FiDownload size={13} /> Save
                      </button>
                      <button
                        type="button"
                        className="doc-sig-btn-mini danger"
                        onClick={() => handleRemoveSignature("secondary")}
                        title="Remove Signature"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Quick Actions Toolbar */}
                  <div className="doc-sig-quick-actions-row">
                    <button
                      type="button"
                      className="doc-sig-quick-btn"
                      onClick={() => handleQuickRemoveBackground("secondary")}
                      title="Automatically strip paper background to transparent"
                    >
                      <FiScissors size={12} /> Auto Remove BG
                    </button>
                    <button
                      type="button"
                      className="doc-sig-quick-btn"
                      onClick={() => handleQuickRemoveColor("secondary")}
                      title="Convert to pure high-contrast black & white signature"
                    >
                      <FiSlash size={12} /> Remove Colour (B&W)
                    </button>
                    <button
                      type="button"
                      className="doc-sig-quick-btn studio"
                      onClick={() => openSignatureStudio("secondary", form.secondarySignatureImage)}
                      title="Open full alignment and signature edit options"
                    >
                      <FiSliders size={12} /> Update Option
                    </button>
                  </div>
                </>
              ) : (
                <div className="doc-sig-slot-empty-zone">
                  <div className="doc-sig-slot-empty-prompt">
                    <FiEdit3 size={28} className="doc-sig-empty-icon secondary" />
                    <span className="doc-sig-empty-main">Upload Secondary Signature</span>
                    <span className="doc-sig-empty-sub">Upload secondary or alternate signature photo:</span>
                  </div>
                  <div className="doc-sig-slot-action-row">
                    <button
                      type="button"
                      className="doc-sig-slot-btn highlight-secondary"
                      onClick={() => secondarySigFileInputRef.current?.click()}
                      title="Upload signature photo with automatic background removal"
                    >
                      <FiUploadCloud size={14} /> Upload Secondary Signature Photo
                    </button>
                    <button
                      type="button"
                      className="doc-sig-slot-btn"
                      onClick={() => openSignatureStudio("secondary")}
                      title="Open Signature Edit Option"
                    >
                      <FiEdit3 size={14} /> Edit Option
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PRESCRIPTION SIGNATURE PREFERENCE */}
          <div className="doc-sig-preference-wrap">
            <div className="doc-rx-mode-card">
              <label className="doc-sig-meta-label">Prescription Sign-off Preference</label>
              <p className="doc-rx-mode-sub">Choose which signature appears on generated patient prescriptions:</p>

              <div className="doc-rx-mode-options">
                <label className={`doc-rx-mode-pill ${form.prescriptionSignatureMode !== "secondary" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="prescriptionSignatureMode"
                    value="primary"
                    checked={form.prescriptionSignatureMode !== "secondary"}
                    onChange={() => autoSaveField("prescriptionSignatureMode", "primary")}
                  />
                  <span>Primary Signature</span>
                </label>

                <label className={`doc-rx-mode-pill ${form.prescriptionSignatureMode === "secondary" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="prescriptionSignatureMode"
                    value="secondary"
                    checked={form.prescriptionSignatureMode === "secondary"}
                    onChange={() => autoSaveField("prescriptionSignatureMode", "secondary")}
                  />
                  <span>Secondary Signature</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* FEES & SCHEDULING */}
        <div className="panel">
          <h3 className="settings-heading">
            <FiCreditCard className="settings-icon" />
            Fees & scheduling
          </h3>

          <div className="grid-3">
            <Field label="Consultation fee (₹)">
              <Input
                type="number"
                min="0"
                value={form.consultationFee}
                onChange={(e) => update("consultationFee", e.target.value)}
              />
            </Field>

            <Field label="Follow-up fee (₹)">
              <Input
                type="number"
                min="0"
                value={form.followupFee}
                onChange={(e) => update("followupFee", e.target.value)}
              />
            </Field>

            <Field label="Slot length (min)">
              <Input
                type="number"
                min="1"
                value={form.slotLength}
                onChange={(e) => update("slotLength", e.target.value)}
              />
            </Field>
          </div>

          {/* VIDEO CONSULTATION MODE TOGGLE */}
          <div className={`video-consult-mode-card ${form.videoConsultationEnabled ? "active" : ""}`}>
            <div className="video-consult-mode-left">
              <div className={`video-consult-icon-box ${form.videoConsultationEnabled ? "active" : "inactive"}`}>
                <FiVideo size={20} />
              </div>
              <div className="video-consult-mode-info">
                <div className="video-consult-mode-title-row">
                  <span className="video-consult-mode-title">Video Consultation Mode</span>
                  <span className={`video-consult-status-badge ${form.videoConsultationEnabled ? "badge-on" : "badge-off"}`}>
                    <span className="video-consult-status-dot" />
                    {form.videoConsultationEnabled ? "MODE ON" : "MODE OFF"}
                  </span>
                </div>
                <p className="video-consult-mode-desc">
                  {form.videoConsultationEnabled
                    ? "Pet parents can book and join online video appointments with you."
                    : "Video consultation is currently disabled. Pet parents can only book in-clinic visits."}
                </p>
              </div>
            </div>

            <div className="video-consult-mode-right">
              <button
                type="button"
                className={`video-consult-toggle-btn ${form.videoConsultationEnabled ? "btn-on" : "btn-off"}`}
                onClick={() => {
                  const nextVal = !form.videoConsultationEnabled;
                  update("videoConsultationEnabled", nextVal);
                  autoSaveField("videoConsultationEnabled", nextVal);
                  toast.success(`Video consultation mode turned ${nextVal ? "ON" : "OFF"}`);
                }}
                aria-label="Toggle Video Consultation Mode"
              >
                <span className="video-consult-toggle-slider">
                  <span className="video-consult-toggle-knob" />
                </span>
                <span className="video-consult-toggle-label">
                  {form.videoConsultationEnabled ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              icon={FiSave}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* RIGHT SIDE / VERIFICATIONS            */}
      {/* ===================================== */}
      <div className="stack-6 settings-side-column">
        {/* ADMIN VERIFICATION */}
        <div className="panel settings-side">
          <h3
            className="settings-heading"
            style={{ marginBottom: 4 }}
          >
            <FiShield className="settings-icon" />
            Verification
          </h3>

          <p
            className="panel-subtitle"
            style={{ marginBottom: 16 }}
          >
            Reviewed and verified by an admin.
          </p>

          <div className="stack-3">
            {VERIFICATION_ITEMS.map((verification) => {
              const isVerified = verifications[verification.key];

              return (
                <div
                  key={verification.label}
                  className="settings-verify-row"
                >
                  <span
                    className="text-muted"
                    style={{ fontSize: 14 }}
                  >
                    {verification.label}
                  </span>

                  <Badge variant={isVerified ? "success" : "warning"}>
                    {isVerified ? "Verified" : "Pending admin review"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* LOCATION VERIFICATION */}
        <div className="panel settings-side location-verify-card">
          <div className="location-verify-header">
            <div className="location-verify-title-wrap">
              <h3 className="settings-heading" style={{ marginBottom: 2 }}>
                <FiMapPin className="settings-icon" />
                Location Verification
              </h3>
              <p className="panel-subtitle" style={{ marginBottom: 0 }}>
                GPS Location
              </p>
            </div>
            <Badge variant={isFetchingLocation ? "accent" : (locationVerified || (form.city && form.pincode) || form.area ? "success" : "warning")}>
              {isFetchingLocation ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FiRefreshCw className="spin-icon" size={11} /> Locating...
                </span>
              ) : (locationVerified || (form.city && form.pincode) || form.area) ? (
                "Verified"
              ) : (
                "Pending"
              )}
            </Badge>
          </div>

          <div className="location-details-box">
            <div className="location-info-row">
              <span className="location-info-label">Area</span>
              <span className="location-info-value">{form.area || <span className="text-muted-italic">Not set</span>}</span>
            </div>
            <div className="location-info-row">
              <span className="location-info-label">City</span>
              <span className="location-info-value">{form.city || <span className="text-muted-italic">Not set</span>}</span>
            </div>
            <div className="location-info-row">
              <span className="location-info-label">Pincode</span>
              <span className="location-info-value">{form.pincode || <span className="text-muted-italic">Not set</span>}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-location-fetch"
            disabled={isFetchingLocation}
            onClick={handleFetchLocation}
          >
            <FiNavigation size={13} className={isFetchingLocation ? "spin-icon" : ""} />
            {isFetchingLocation ? "Detecting GPS location..." : (form.area || form.city || form.pincode ? "Re-detect GPS Location" : "Auto-fetch Area, City & Pincode")}
          </button>
        </div>
      </div>

      {/* FULL-FEATURED DIGITAL SIGNATURE STUDIO MODAL */}
      {signatureStudioOpen && (
        <SignatureStudioModal
          isOpen={signatureStudioOpen}
          imageSource={
            customStudioSource ||
            (signatureTarget === "secondary"
              ? form.secondarySignatureImage
              : form.digitalSignatureImage)
          }
          doctorName={
            signatureTarget === "secondary"
              ? form.secondarySignatureName || form.fullName
              : form.fullName
          }
          onClose={() => {
            setSignatureStudioOpen(false);
            setCustomStudioSource(null);
          }}
          onApply={handleSignatureApplied}
        />
      )}
    </div>
  );
}