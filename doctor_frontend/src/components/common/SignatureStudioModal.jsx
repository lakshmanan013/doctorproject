import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FiRotateCcw,
  FiRotateCw,
  FiSliders,
  FiCheck,
  FiX,
  FiEye,
  FiSun,
  FiFeather,
  FiZap,
  FiUploadCloud,
  FiTrash2,
  FiScissors,
  FiDroplet,
  FiSlash,
  FiLayers,
  FiMoon,
  FiCheckCircle,
  FiRefreshCw,
  FiMove,
  FiMaximize2,
  FiGrid,
} from "react-icons/fi";
import {
  loadImage,
  createTransformedCanvas,
  detectSignatureBounds,
  processSignature,
  SIGNATURE_COLORS,
} from "../../utils/signatureProcessor";
import Button from "../ui/Button";
import "./SignatureStudioModal.css";

export default function SignatureStudioModal({
  isOpen,
  imageSource,
  doctorName = "",
  onClose,
  onApply,
  initialInkColor = "blue",
}) {
  // Uploaded Image State
  const [scanImageSource, setScanImageSource] = useState(imageSource || null);
  const [loadedImg, setLoadedImg] = useState(null);

  // Photo Axis, Angle & Alignment State
  const [rotation90, setRotation90] = useState(0);
  const [fineAngle, setFineAngle] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [showGridGuide, setShowGridGuide] = useState(true);

  // Background Check & Removal State
  const [backgroundMode, setBackgroundMode] = useState("transparent");
  const [thresholdOffset, setThresholdOffset] = useState(0);
  const [despeckle, setDespeckle] = useState(true);

  // Digital Format & Ink Options
  const [inkColor, setInkColor] = useState(initialInkColor);
  const [removeColor, setRemoveColor] = useState(false);
  const [customColorHex, setCustomColorHex] = useState("#1034a6");
  const [invert, setInvert] = useState(false);
  const [strokeBoost, setStrokeBoost] = useState(0);

  // Preview & Processing State
  const [previewBg, setPreviewBg] = useState("white");
  const [processing, setProcessing] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState(imageSource || "");

  // Refs
  const scanFileInputRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const transformedCanvasRef = useRef(null);
  const dragRef = useRef({
    isDragging: false,
    dragType: null,
    startX: 0,
    startY: 0,
    initialCrop: null,
  });

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Sync image source when opening
  useEffect(() => {
    if (isOpen) {
      if (imageSource) {
        setScanImageSource(imageSource);
        setActivePreviewUrl(imageSource);
      }
    }
  }, [isOpen, imageSource]);

  // Compute active color hex
  let activeColorHex = "#1034a6";
  if (removeColor || inkColor === "monochrome") {
    activeColorHex = "#000000";
  } else if (inkColor === "custom") {
    activeColorHex = customColorHex || "#1034a6";
  } else {
    const found = SIGNATURE_COLORS.find((c) => c.id === inkColor);
    activeColorHex = found?.hex || "#1034a6";
  }

  // Handle color removal toggle
  const handleToggleRemoveColor = () => {
    if (removeColor || inkColor === "monochrome") {
      setRemoveColor(false);
      setInkColor("blue");
    } else {
      setRemoveColor(true);
      setInkColor("monochrome");
    }
  };

  // Handle color selection
  const handleSelectColor = (colorId) => {
    if (colorId === "monochrome") {
      setRemoveColor(true);
      setInkColor("monochrome");
    } else {
      setRemoveColor(false);
      setInkColor(colorId);
    }
  };

  // Load Image when source changes
  useEffect(() => {
    if (!scanImageSource) {
      setLoadedImg(null);
      return;
    }

    let isMounted = true;
    loadImage(scanImageSource)
      .then((img) => {
        if (isMounted) {
          setLoadedImg(img);
          setRotation90(0);
          setFineAngle(0);
          setFlipH(false);
          setFlipV(false);
          setThresholdOffset(0);
          setStrokeBoost(0);
          setCropRect({
            x: 0,
            y: 0,
            width: img.naturalWidth || img.width || 800,
            height: img.naturalHeight || img.height || 400,
          });
          setAutoDetected(false);
        }
      })
      .catch((err) => {
        console.error("Signature Studio image load error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [scanImageSource]);

  // Render transformed canvas on axis changes & auto-detect
  useEffect(() => {
    if (!loadedImg) return;

    const totalRotation = rotation90 + fineAngle;
    const transformed = createTransformedCanvas(
      loadedImg,
      totalRotation,
      flipH,
      flipV,
      1000
    );
    transformedCanvasRef.current = transformed;

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = transformed.width;
      canvas.height = transformed.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(transformed, 0, 0);
    }

    if (!autoDetected) {
      const bounds = detectSignatureBounds(transformed, thresholdOffset);
      setCropRect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      setAutoDetected(bounds.detected);
    }
  }, [loadedImg, rotation90, fineAngle, flipH, flipV, thresholdOffset, autoDetected]);

  // Canvas size sync
  useEffect(() => {
    if (canvasRef.current && transformedCanvasRef.current) {
      const canvas = canvasRef.current;
      const transformed = transformedCanvasRef.current;
      if (canvas.width !== transformed.width || canvas.height !== transformed.height) {
        canvas.width = transformed.width;
        canvas.height = transformed.height;
      }
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(transformed, 0, 0);
    }
  });

  // Generate Digital Preview Pipeline (High Performance CV)
  useEffect(() => {
    if (!loadedImg) return;

    const effectiveCrop = cropRect || {
      x: 0,
      y: 0,
      width: loadedImg.naturalWidth || loadedImg.width || 800,
      height: loadedImg.naturalHeight || loadedImg.height || 400,
    };

    const timer = setTimeout(async () => {
      setProcessing(true);
      try {
        const totalRotation = rotation90 + fineAngle;
        const resultUrl = await processSignature({
          imageSource: loadedImg,
          rotation: totalRotation,
          flipH,
          flipV,
          cropRect: effectiveCrop,
          thresholdOffset,
          removeBackground: backgroundMode !== "original",
          backgroundMode,
          removeColor,
          inkColor,
          customColorHex,
          enhanceInk: true,
          strokeBoost,
          despeckle,
          invert,
        });
        if (resultUrl) {
          setActivePreviewUrl(resultUrl);
        }
      } catch (err) {
        console.error("Signature digital processing error:", err);
      } finally {
        setProcessing(false);
      }
    }, 30);

    return () => clearTimeout(timer);
  }, [
    loadedImg,
    rotation90,
    fineAngle,
    flipH,
    flipV,
    cropRect,
    thresholdOffset,
    backgroundMode,
    removeColor,
    inkColor,
    customColorHex,
    strokeBoost,
    despeckle,
    invert,
  ]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setScanImageSource(event.target.result);
      setCropRect(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Auto detect bounds
  const handleAutoDetect = () => {
    if (!transformedCanvasRef.current) return;
    const bounds = detectSignatureBounds(
      transformedCanvasRef.current,
      thresholdOffset
    );
    setCropRect({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
    setAutoDetected(true);
  };

  // Reset all axis transformations
  const handleResetAxis = () => {
    setRotation90(0);
    setFineAngle(0);
    setFlipH(false);
    setFlipV(false);
    setThresholdOffset(0);
    if (loadedImg) {
      setCropRect({
        x: 0,
        y: 0,
        width: loadedImg.naturalWidth || loadedImg.width || 800,
        height: loadedImg.naturalHeight || loadedImg.height || 400,
      });
      setAutoDetected(false);
    }
  };

  // Interactive Crop Handlers
  const handleCropMouseDown = (e, dragType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropRect || !canvasContainerRef.current) return;

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...cropRect },
    };

    window.addEventListener("mousemove", handleCropMouseMove);
    window.addEventListener("mouseup", handleCropMouseUp);
  };

  const handleCropMouseMove = (e) => {
    if (!dragRef.current.isDragging || !canvasRef.current) return;

    const { dragType, startX, startY, initialCrop } = dragRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const dx = (e.clientX - startX) * scaleX;
    const dy = (e.clientY - startY) * scaleY;

    setCropRect((prev) => {
      if (!prev || !initialCrop) return prev;
      let newX = initialCrop.x;
      let newY = initialCrop.y;
      let newW = initialCrop.width;
      let newH = initialCrop.height;

      if (dragType === "move") {
        newX = Math.max(0, Math.min(canvas.width - newW, initialCrop.x + dx));
        newY = Math.max(0, Math.min(canvas.height - newH, initialCrop.y + dy));
      } else if (dragType === "se") {
        newW = Math.max(30, Math.min(canvas.width - initialCrop.x, initialCrop.width + dx));
        newH = Math.max(20, Math.min(canvas.height - initialCrop.y, initialCrop.height + dy));
      } else if (dragType === "nw") {
        newX = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 30, initialCrop.x + dx));
        newY = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 20, initialCrop.y + dy));
        newW = initialCrop.width - (newX - initialCrop.x);
        newH = initialCrop.height - (newY - initialCrop.y);
      } else if (dragType === "ne") {
        newY = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 20, initialCrop.y + dy));
        newW = Math.max(30, Math.min(canvas.width - initialCrop.x, initialCrop.width + dx));
        newH = initialCrop.height - (newY - initialCrop.y);
      } else if (dragType === "sw") {
        newX = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 30, initialCrop.x + dx));
        newW = initialCrop.width - (newX - initialCrop.x);
        newH = Math.max(20, Math.min(canvas.height - initialCrop.y, initialCrop.height + dy));
      }

      return { x: newX, y: newY, width: newW, height: newH };
    });
  };

  const handleCropMouseUp = () => {
    dragRef.current.isDragging = false;
    window.removeEventListener("mousemove", handleCropMouseMove);
    window.removeEventListener("mouseup", handleCropMouseUp);
  };

  // Apply Signature
  const handleApply = () => {
    if (activePreviewUrl && onApply) {
      onApply(activePreviewUrl);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="sig-modal-backdrop" onClick={onClose}>
      <div className="sig-studio-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="sig-studio-header">
          <div className="sig-header-left">
            <div className="sig-icon-badge">
              <FiScissors size={20} />
            </div>
            <div>
              <h3 className="sig-studio-title">Digital Signature Editor</h3>
              <p className="sig-studio-subtitle">
                Upload paper photo, adjust axis & leveling, crop bounds, strip background, and convert to digital ink format
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sig-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={scanFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        {/* Studio Workspace */}
        <div className="sig-studio-body">
          {/* LEFT STAGE: PHOTO AXIS, ALIGNMENT & CROPPER */}
          <div className="sig-studio-stage-panel">
            {!loadedImg ? (
              <div
                className="sig-upload-placeholder"
                onClick={() => scanFileInputRef.current?.click()}
              >
                <div className="sig-upload-icon-circle">
                  <FiUploadCloud size={38} className="sig-upload-icon" />
                </div>
                <h4>Upload Paper Signature Photo</h4>
                <p>
                  Drag & drop or click to upload a photo of your signature.
                  We will automatically align the axis, remove the background, and output certified digital ink.
                </p>
                <button type="button" className="btn-upload-file">
                  <FiUploadCloud size={16} /> Choose Signature Photo
                </button>
                <span className="sig-upload-tip">Supports JPG, PNG, WebP, HEIC</span>
              </div>
            ) : (
              <div className="sig-scan-container">
                {/* Stage Toolbar */}
                <div className="sig-toolbar">
                  {/* Axis & Angle Controls */}
                  <div className="sig-toolbar-group">
                    <span className="sig-toolbar-label">Axis & Rotate:</span>
                    <button
                      type="button"
                      className="sig-tool-btn"
                      onClick={() => setRotation90((r) => (r - 90 + 360) % 360)}
                      title="Rotate 90° Counter-Clockwise"
                    >
                      <FiRotateCcw size={13} /> -90°
                    </button>
                    <button
                      type="button"
                      className="sig-tool-btn"
                      onClick={() => setRotation90((r) => (r + 90) % 360)}
                      title="Rotate 90° Clockwise"
                    >
                      <FiRotateCw size={13} /> +90°
                    </button>
                    <button
                      type="button"
                      className={`sig-tool-btn ${flipH ? "active" : ""}`}
                      onClick={() => setFlipH((f) => !f)}
                      title="Flip Horizontal (Mirror X-Axis)"
                    >
                      Flip X
                    </button>
                    <button
                      type="button"
                      className={`sig-tool-btn ${flipV ? "active" : ""}`}
                      onClick={() => setFlipV((f) => !f)}
                      title="Flip Vertical (Mirror Y-Axis)"
                    >
                      Flip Y
                    </button>
                  </div>

                  {/* Crop & Alignment Tools */}
                  <div className="sig-toolbar-group">
                    <button
                      type="button"
                      className={`sig-tool-btn highlight ${autoDetected ? "active" : ""}`}
                      onClick={handleAutoDetect}
                      title="Auto-Detect Signature Bounding Box"
                    >
                      <FiZap size={13} /> Auto Crop
                    </button>
                    <button
                      type="button"
                      className="sig-tool-btn"
                      onClick={handleResetAxis}
                      title="Reset Axis Transformations"
                    >
                      <FiRefreshCw size={13} /> Reset
                    </button>
                    <button
                      type="button"
                      className="sig-tool-btn"
                      onClick={() => scanFileInputRef.current?.click()}
                      title="Upload a Different Photo"
                    >
                      <FiUploadCloud size={13} /> Replace
                    </button>
                  </div>
                </div>

                {/* Interactive Stage Canvas & Clean Crop Box */}
                <div className="sig-canvas-stage" ref={canvasContainerRef}>
                  <canvas ref={canvasRef} className="sig-source-canvas" />

                  {/* Draggable Crop Box */}
                  {cropRect && canvasRef.current && (
                    <div
                      className="sig-crop-box"
                      style={{
                        left: `${(cropRect.x / canvasRef.current.width) * 100}%`,
                        top: `${(cropRect.y / canvasRef.current.height) * 100}%`,
                        width: `${(cropRect.width / canvasRef.current.width) * 100}%`,
                        height: `${(cropRect.height / canvasRef.current.height) * 100}%`,
                      }}
                      onMouseDown={(e) => handleCropMouseDown(e, "move")}
                    >
                      <div className="crop-corner nw" onMouseDown={(e) => handleCropMouseDown(e, "nw")} />
                      <div className="crop-corner ne" onMouseDown={(e) => handleCropMouseDown(e, "ne")} />
                      <div className="crop-corner sw" onMouseDown={(e) => handleCropMouseDown(e, "sw")} />
                      <div className="crop-corner se" onMouseDown={(e) => handleCropMouseDown(e, "se")} />
                      <div className="crop-drag-hint">
                        <FiMove size={11} /> Drag or resize box to align signature
                      </div>
                    </div>
                  )}
                </div>

                {/* Fine Angle / Tilt Leveling Slider */}
                <div className="sig-fine-slider-row">
                  <span className="sig-slider-title">
                    Fine Angle Leveling (Straighten Tilt):
                  </span>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="0.5"
                    value={fineAngle}
                    onChange={(e) => setFineAngle(parseFloat(e.target.value))}
                    className="sig-range-slider"
                  />
                  <span className="sig-value-chip">
                    {fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}
                  </span>
                  {fineAngle !== 0 && (
                    <button
                      type="button"
                      className="sig-small-reset"
                      onClick={() => setFineAngle(0)}
                    >
                      Reset 0°
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: BACKGROUND REMOVAL, DIGITAL INK & LIVE PREVIEW */}
          <div className="sig-studio-settings-panel">
            {/* Live Preview Card */}
            <div className="sig-preview-card">
              <div className="sig-preview-header">
                <span className="sig-preview-title">
                  <FiEye size={14} /> Live Digital Output
                </span>
                <div className="sig-bg-toggles">
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "white" ? "active" : ""}`}
                    onClick={() => setPreviewBg("white")}
                    title="Clean White View"
                  >
                    White
                  </button>
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "dark" ? "active" : ""}`}
                    onClick={() => setPreviewBg("dark")}
                    title="Dark Contrast View"
                  >
                    <FiMoon size={11} /> Dark
                  </button>
                </div>
              </div>

              <div className={`sig-live-preview-box bg-${previewBg}`}>
                {activePreviewUrl ? (
                  <img
                    src={activePreviewUrl}
                    alt="Digital Signature Result"
                    className="sig-live-img"
                  />
                ) : (
                  <div className="sig-preview-empty">
                    {processing ? (
                      <div className="sig-processing-pulse">
                        <span className="sig-pulse-spinner" />
                        <span>Rendering digital signature...</span>
                      </div>
                    ) : (
                      "Upload a signature photo to view digital format"
                    )}
                  </div>
                )}
              </div>

              {/* Status Badges */}
              <div className="sig-preview-badges-row">
                <span className={`sig-preview-badge ${backgroundMode === "transparent" ? "success" : "neutral"}`}>
                  <FiScissors size={11} />
                  {backgroundMode === "transparent"
                    ? "Transparent BG"
                    : backgroundMode === "white"
                      ? "White Paper BG"
                      : "Original Photo BG"}
                </span>

                <span className={`sig-preview-badge ${removeColor || inkColor === "monochrome" ? "mono" : "color"}`}>
                  <FiDroplet size={11} />
                  {removeColor || inkColor === "monochrome"
                    ? "Pure Black (B&W)"
                    : inkColor === "original"
                      ? "Original Pen Ink"
                      : "Recolored Ink"}
                </span>
              </div>
            </div>

            {/* SECTION 1: BACKGROUND REMOVAL & SHADOW FILTER */}
            <div className="sig-setting-card">
              <div className="sig-card-header">
                <label className="sig-setting-label">
                  <FiScissors size={14} className="sig-header-icon" /> 1. Background Check & Removal
                </label>
                <span className="sig-chip-active">
                  {backgroundMode === "transparent" ? "Transparent Active" : backgroundMode}
                </span>
              </div>

              {/* Background Mode Options */}
              <div className="sig-mode-segmented">
                <button
                  type="button"
                  className={`sig-mode-btn ${backgroundMode === "transparent" ? "active" : ""}`}
                  onClick={() => setBackgroundMode("transparent")}
                >
                  <FiCheckCircle size={13} className="sig-mode-icon" />
                  <span>Transparent PNG</span>
                </button>
                <button
                  type="button"
                  className={`sig-mode-btn ${backgroundMode === "white" ? "active" : ""}`}
                  onClick={() => setBackgroundMode("white")}
                >
                  <span>Clean White Paper</span>
                </button>
                <button
                  type="button"
                  className={`sig-mode-btn ${backgroundMode === "original" ? "active" : ""}`}
                  onClick={() => setBackgroundMode("original")}
                >
                  <span>Keep Original</span>
                </button>
              </div>

              {/* Shadow Cut & Paper Threshold Sensitivity */}
              {loadedImg && backgroundMode !== "original" && (
                <div className="sig-sub-setting-group">
                  <div className="sig-setting-header-row">
                    <span className="sig-sub-label-text">
                      <FiSun size={12} /> Shadow Cut & Paper Threshold:
                    </span>
                    <div className="sig-slider-val-wrap">
                      <span className="sig-value-badge">
                        {thresholdOffset > 0 ? `+${thresholdOffset}` : thresholdOffset}
                      </span>
                      {thresholdOffset !== 0 && (
                        <button
                          type="button"
                          className="sig-tiny-reset"
                          onClick={() => setThresholdOffset(0)}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="2"
                    value={thresholdOffset}
                    onChange={(e) => setThresholdOffset(parseInt(e.target.value, 10))}
                    className="sig-range-slider"
                  />
                  <div className="sig-slider-sub">
                    <span>Strip Paper Shadows & Texture</span>
                    <span>Preserve Fine Pen Lines</span>
                  </div>

                  {/* Despeckle Toggle */}
                  <label className="sig-checkbox-toggle">
                    <input
                      type="checkbox"
                      checked={despeckle}
                      onChange={(e) => setDespeckle(e.target.checked)}
                    />
                    <span className="sig-toggle-text">Clean Stray Specks & Paper Noise (Despeckle)</span>
                  </label>
                </div>
              )}
            </div>

            {/* SECTION 2: DIGITAL INK FORMAT & COLOR REMOVAL */}
            <div className="sig-setting-card">
              <div className="sig-card-header">
                <label className="sig-setting-label">
                  <FiDroplet size={14} className="sig-header-icon" /> 2. Digital Ink & Color Format
                </label>
              </div>

              {/* Quick Remove Color Banner */}
              <button
                type="button"
                className={`sig-color-remove-banner-btn ${removeColor || inkColor === "monochrome" ? "active" : ""}`}
                onClick={handleToggleRemoveColor}
              >
                <div className="sig-mono-btn-content">
                  <div className="sig-mono-icon-box">
                    <FiSlash size={16} />
                  </div>
                  <div className="sig-mono-texts">
                    <strong className="sig-mono-title">
                      {removeColor || inkColor === "monochrome"
                        ? "✓ Color Removed (Certified Pure Black)"
                        : "Remove Color (Pure Black B&W)"}
                    </strong>
                    <span className="sig-mono-desc">
                      Strip all pen color hues for official black & white documents
                    </span>
                  </div>
                </div>
              </button>

              {/* Ink Palette Grid */}
              <div className="sig-ink-grid-wrap">
                <span className="sig-palette-title">Or Format with Digital Ink:</span>
                <div className="sig-ink-options">
                  {SIGNATURE_COLORS.map((c) => {
                    const isSelected =
                      c.id === "monochrome"
                        ? removeColor || inkColor === "monochrome"
                        : inkColor === c.id && !removeColor;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`sig-ink-pill ink-${c.id} ${isSelected ? "selected" : ""}`}
                        onClick={() => handleSelectColor(c.id)}
                      >
                        {c.isColorRemove ? (
                          <span className="color-swatch mono-swatch" />
                        ) : c.isOriginal ? (
                          <span className="color-swatch orig-swatch" />
                        ) : c.isCustom ? (
                          <span className="color-swatch custom-swatch" style={{ background: customColorHex }} />
                        ) : (
                          <span className="color-swatch" style={{ background: c.hex }} />
                        )}
                        <span className="sig-ink-name">{c.name}</span>
                        {isSelected && <FiCheck className="sig-ink-check" size={13} />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Input */}
                {inkColor === "custom" && !removeColor && (
                  <div className="sig-custom-picker-row">
                    <span className="sig-sub-label-text">Select Custom Ink Hex:</span>
                    <div className="sig-custom-picker-input-wrap">
                      <input
                        type="color"
                        value={customColorHex}
                        onChange={(e) => setCustomColorHex(e.target.value)}
                        className="sig-native-color-picker"
                      />
                      <input
                        type="text"
                        value={customColorHex}
                        onChange={(e) => setCustomColorHex(e.target.value)}
                        className="sig-hex-input"
                        placeholder="#1034a6"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: STROKE FULLNESS & INVERT */}
            {loadedImg && (
              <div className="sig-setting-card">
                <div className="sig-card-header">
                  <label className="sig-setting-label">
                    <FiFeather size={14} className="sig-header-icon" /> 3. Stroke Fullness & Contrast
                  </label>
                </div>

                <div className="sig-stroke-boost-segmented">
                  <button
                    type="button"
                    className={`sig-boost-btn ${strokeBoost === 0 ? "active" : ""}`}
                    onClick={() => setStrokeBoost(0)}
                  >
                    Regular Ink
                  </button>
                  <button
                    type="button"
                    className={`sig-boost-btn ${strokeBoost === 1 ? "active" : ""}`}
                    onClick={() => setStrokeBoost(1)}
                  >
                    +1 Boost
                  </button>
                  <button
                    type="button"
                    className={`sig-boost-btn ${strokeBoost === 2 ? "active" : ""}`}
                    onClick={() => setStrokeBoost(2)}
                  >
                    +2 Bold Ink
                  </button>
                </div>

                <label className="sig-checkbox-toggle" style={{ marginTop: "10px" }}>
                  <input
                    type="checkbox"
                    checked={invert}
                    onChange={(e) => setInvert(e.target.checked)}
                  />
                  <span className="sig-toggle-text">Invert Colors (For Dark Background Photos)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sig-studio-footer">
          <div className="sig-footer-tip">
            💡 <strong>Format:</strong>{" "}
            {backgroundMode === "transparent" ? (
              <span className="sig-tag-highlight">Transparent PNG</span>
            ) : backgroundMode === "white" ? (
              <span className="sig-tag-highlight">Clean White Paper</span>
            ) : (
              <span className="sig-tag-highlight">Original Background</span>
            )}{" "}
            {removeColor || inkColor === "monochrome" ? "• Pure Black B&W" : `• ${activeColorHex}`}{" "}
            {fineAngle !== 0 ? `• ${fineAngle}° Tilt Adjusted` : ""}
          </div>
          <div className="sig-footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={!activePreviewUrl || !loadedImg}
              className="btn-apply-sig"
            >
              <FiCheck size={16} /> Apply & Save Digital Signature
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
