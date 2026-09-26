import React, { useRef, useState } from "react";
import {
  FiUploadCloud,
  FiTrash2,
  FiCheckCircle,
  FiLoader,
  FiEdit2,
  FiFeather,
} from "react-icons/fi";
import toast from "react-hot-toast";
import SignatureStudioModal from "./SignatureStudioModal";
import "./ImageUploadBox.css";


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

  // Signature studio modal state
  const [studioOpen, setStudioOpen] = useState(false);
  const [pendingSignatureSource, setPendingSignatureSource] = useState(null);

  const isSig = isSignature || shape === "signature";

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be less than 10MB");
      return;
    }

    if (isSig) {
      // For signatures, read data URL and launch Interactive Studio Modal
      const reader = new FileReader();
      reader.onload = (event) => {
        setPendingSignatureSource(event.target.result);
        setStudioOpen(true);
      };
      reader.onerror = () => {
        toast.error("Could not read image file");
      };
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }


    setProcessing(true);
    try {
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
    } catch (err) {
      console.error("Image processing error:", err);
      toast.error("Failed to process image. Please try again.");
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  };

  const handleApplySignature = (digitizedDataUrl) => {
    setStudioOpen(false);
    setPendingSignatureSource(null);
    onChange?.(digitizedDataUrl);
    toast.success("Digital signature applied successfully!");
  };

  const handleOpenExistingInStudio = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!value) return;
    setPendingSignatureSource(value);
    setStudioOpen(true);
  };

  const handleReplaceClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!processing && fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleZoneClick = (e) => {
    if (processing) return;
    if (!value && fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div
      className={`img-upload-field shape-${shape} ${isSig ? "is-signature-field" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {(label || badgeText) && (
        <div className="img-upload-header" onClick={(e) => e.stopPropagation()}>
          {label && (
            <span className="img-upload-label">
              {label} {required && <span className="req-asterisk">*</span>}
            </span>
          )}
          {badgeText && <span className="img-upload-badge">{badgeText}</span>}
        </div>
      )}

      <div
        className={`img-upload-zone ${value ? "has-image" : ""} ${isSig ? "signature-zone" : ""}`}
        style={height ? { minHeight: `${height}px`, height: `${height}px` } : {}}
        onClick={handleZoneClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />

        {processing ? (
          <div className="img-processing-state">
            <FiLoader className="spin-icon" size={20} />
            <span>Processing image...</span>
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

            <div className="img-preview-overlay" onClick={(e) => e.stopPropagation()}>
              {isSig && (
                <button
                  type="button"
                  className="img-action-btn edit-sig-btn"
                  title="Edit & Recrop in Studio"
                  aria-label="Edit in Studio"
                  onClick={handleOpenExistingInStudio}
                >
                  <FiEdit2 size={13} /> Edit
                </button>
              )}
              <button
                type="button"
                className="img-action-btn replace-btn"
                title={isSig ? "Upload New Signature" : "Upload New Image"}
                aria-label={isSig ? "Upload New Signature" : "Upload New Image"}
                onClick={handleReplaceClick}
              >
                <FiUploadCloud size={13} /> {isSig ? "New" : "Change"}
              </button>
              <button
                type="button"
                className="img-action-btn remove-btn"
                title={isSig ? "Remove Signature" : "Remove Image"}
                aria-label={isSig ? "Remove Signature" : "Remove Image"}
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
              {placeholderIcon || (isSig ? <FiFeather size={18} /> : <FiUploadCloud size={18} />)}
            </div>
            <div className="img-prompt-text">
              <span className="upload-cta">
                {isSig ? "Upload paper signature" : "Click to upload"}
              </span>{" "}
              {isSig ? "photo (auto-crop & rotate)" : "or drag & drop"}
            </div>
            <span className="img-helper-sub">
              {isSig ? "Sign on white paper & upload photo" : helperText}
            </span>
          </div>
        )}
      </div>

      {/* Interactive Signature Studio Modal */}
      {isSig && studioOpen && (
        <SignatureStudioModal
          isOpen={studioOpen}
          imageSource={pendingSignatureSource}
          onClose={() => {
            setStudioOpen(false);
            setPendingSignatureSource(null);
          }}
          onApply={handleApplySignature}
        />
      )}
    </div>
  );
}
