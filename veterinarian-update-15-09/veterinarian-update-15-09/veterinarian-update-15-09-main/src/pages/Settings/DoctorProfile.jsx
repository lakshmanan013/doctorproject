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
} from "react-icons/fi";

import Input, {
  Field,
} from "../../components/ui/Input";

import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ImageUploadBox from "../../components/common/ImageUploadBox";

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

      // Construct backend profile payload
      const profile = {
        fullName: updated.fullName?.trim() || "",
        qualification: updated.qualification?.trim() || "",
        speciality: updated.speciality?.trim() || "",
        councilRegistration: updated.council?.trim() || "",
        clinicHospital: updated.clinic?.trim() || "",
        area: updated.area?.trim() || "",
        city: updated.city?.trim() || "",
        pincode: updated.pincode === "" || updated.pincode == null ? null : Number(updated.pincode),
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
      };

      // Persist directly to backend database
      updateDoctorProfile(profile)
        .then(() => {
          if (key === "profileImage") {
            window.dispatchEvent(new CustomEvent("doctorProfileUpdated", { detail: { profileImage: value } }));
          }
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
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode === "" ? null : Number(form.pincode),
        experience: form.experience === "" ? null : Number(form.experience),
        phone: form.phone.trim(),
        email: form.email.trim(),
        digitalSignatureName: form.signature.trim(),
        consultationFee: form.consultationFee === "" ? null : Number(form.consultationFee),
        followUpFee: form.followupFee === "" ? null : Number(form.followupFee),
        slotLength: form.slotLength === "" ? null : Number(form.slotLength),
        videoConsultationEnabled: Boolean(form.videoConsultationEnabled),
        profileImage: form.profileImage,
        clinicInsideImage: form.clinicInsideImage,
        clinicOutsideImage: form.clinicOutsideImage,
        digitalSignatureImage: form.digitalSignatureImage,
      };

      const saved = await updateDoctorProfile(profile);

      setForm((prev) => ({
        ...prev,
        fullName: saved?.fullName ?? prev.fullName,
        qualification: saved?.qualification ?? prev.qualification,
        speciality: saved?.speciality ?? prev.speciality,
        council: saved?.councilRegistration ?? prev.council,
        clinic: saved?.clinicHospital ?? prev.clinic,
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

            <Field label="Clinic / hospital">
              <Input
                type="text"
                value={form.clinic}
                onChange={(e) => update("clinic", e.target.value)}
              />
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

        {/* CONTACT & DIGITAL SIGNATURE */}
        <div className="panel">
          <h3 className="settings-heading">
            <FiShield className="settings-icon" />
            Contact & digital signature
          </h3>

          <div className="form-grid-2">
            <Field label="Phone number">
              <Input
                type="text"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>

            <Field label="Email address">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
          </div>

          {/* DIGITAL SIGNATURE: IMAGE UPLOAD INSTEAD OF TEXT */}
          <div style={{ marginTop: 16, maxWidth: 360 }}>
            <ImageUploadBox
              label="Digital signature (Upload signature image)"
              value={form.digitalSignatureImage}
              onChange={(val) => {
                autoSaveField("digitalSignatureImage", val);
                if (val) {
                  toast.success("Digital signature saved");
                } else {
                  toast.success("Digital signature removed");
                }
              }}
              placeholderIcon={<FiEdit3 size={18} />}
              helperText="Sign on white paper & upload photo"
              shape="signature"
              isSignature={true}
              height={84}
            />
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
                Location verification
              </h3>
              <p className="panel-subtitle" style={{ marginBottom: 0 }}>
                GPS practice location verification
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
    </div>
  );
}