import React, { useRef, useState } from "react";
import { FiUploadCloud, FiTrash2, FiCheck, FiCheckCircle, FiLoader } from "react-icons/fi";
import toast from "react-hot-toast";
import { convertPaperSignatureToDigital } from "../../utils/signatureProcessor";
import "./ImageUploadBox.css";

/**
 * ImageUploadBox
 * Handles image file selection, background removal (for signatures on paper),
 * compression to Base64 data URL, preview, and removal.
 */
export default function ImageUploadBox({
  label = "",
  value = "",
  onChange,
  placeholderIcon = null,
  helperText = "PNG, JPG up to 5MB",
  shape = "standard", // "standard" | "circle" | "wide" | "signature"
  isSignature = false,
  required = false,
  badgeText = "",
  height = null,
}) {
  const fileInputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file size must be less than 8MB");
      return;
    }

    setProcessing(true);

    try {
      if (isSignature || shape === "signature") {
        // Convert paper handwritten signature to transparent digital signature
        const digitalSigUrl = await convertPaperSignatureToDigital(file, {
          enhanceInk: true,
          inkColor: "original",
        });
        onChange?.(digitalSigUrl);
        toast.success("Signature digitized & background removed!");
      } else {
        // Standard image compression via Canvas
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDimension = 1200;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            onChange?.(dataUrl);
            toast.success(`${label || "Image"} uploaded successfully`);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Image processing error:", err);
      toast.error("Failed to process image. Please try again.");
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onChange?.("");
  };

  const isSig = isSignature || shape === "signature";

  return (
    <div className={`img-upload-field shape-${shape} ${isSig ? "is-signature-field" : ""}`}>
      {(label || badgeText) && (
        <div className="img-upload-header">
          {label && (
            <label className="img-upload-label">
              {label} {required && <span className="req-asterisk">*</span>}
            </label>
          )}
          {badgeText && <span className="img-upload-badge">{badgeText}</span>}
        </div>
      )}

      <div
        className={`img-upload-zone ${value ? "has-image" : ""} ${isSig ? "signature-zone" : ""}`}
        style={height ? { minHeight: `${height}px`, height: `${height}px` } : {}}
        onClick={() => !processing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {processing ? (
          <div className="img-processing-state">
            <FiLoader className="spin-icon" size={20} />
            <span>{isSig ? "Digitizing signature..." : "Processing image..."}</span>
          </div>
        ) : value ? (
          <div
            className={`img-preview-wrap ${isSig ? "signature-preview-wrap" : ""}`}
            style={height ? { minHeight: `${height}px`, height: `${height}px` } : {}}
          >
            {isSig && <div className="sig-ledger-grid" />}

            <img
              src={value}
              alt={label || "Signature preview"}
              className={`img-preview ${isSig ? "signature-img-preview" : ""}`}
              style={
                height
                  ? {
                      height: `${height}px`,
                      objectFit: "contain",
                    }
                  : {}
              }
            />

            <div className="img-preview-overlay">
              <button
                type="button"
                className="img-action-btn replace-btn"
                title="Upload New"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUploadCloud size={13} /> Change
              </button>
              <button
                type="button"
                className="img-action-btn remove-btn"
                title="Remove"
                onClick={handleRemove}
              >
                <FiTrash2 size={13} />
              </button>
            </div>

            <span className="img-uploaded-tag sig-digital-tag">
              <FiCheckCircle size={11} /> {isSig ? "Digital Format" : "Uploaded"}
            </span>
          </div>
        ) : (
          <div className="img-placeholder-content">
            <div className="img-icon-circle">
              {placeholderIcon || <FiUploadCloud size={18} />}
            </div>
            <div className="img-prompt-text">
              <span className="upload-cta">
                {isSig ? "Upload paper signature" : "Click to upload"}
              </span>{" "}
              {isSig ? "photo (auto-digitized)" : "or drag & drop"}
            </div>
            <span className="img-helper-sub">
              {isSig ? "Sign on plain white paper & upload photo" : helperText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
