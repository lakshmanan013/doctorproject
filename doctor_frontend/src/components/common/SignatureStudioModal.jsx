import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FiRotateCcw,
  FiRotateCw,
  FiMaximize2,
  FiSliders,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiEye,
  FiSun,
  FiFeather,
  FiZap,
} from "react-icons/fi";
import {
  loadImage,
  createTransformedCanvas,
  detectSignatureBounds,
  processSignature,
} from "../../utils/signatureProcessor";
import Button from "../ui/Button";
import "./SignatureStudioModal.css";


export default function SignatureStudioModal({
  isOpen,
  imageSource,
  onClose,
  onApply,
  initialInkColor = "blue",
}) {
  const [loadedImg, setLoadedImg] = useState(null);
  const [rotation90, setRotation90] = useState(0); // 0, 90, 180, 270
  const [fineAngle, setFineAngle] = useState(0); // -45 to +45
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Crop rectangle in transformed canvas coordinate space
  const [cropRect, setCropRect] = useState(null); // { x, y, width, height }
  const [autoDetected, setAutoDetected] = useState(false);

  // Digital styling
  const [inkColor, setInkColor] = useState(initialInkColor);
  const [thresholdOffset, setThresholdOffset] = useState(0); // -40 to +40
  const [strokeBoost, setStrokeBoost] = useState(0); // 0 to 3

  // Live preview
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previewBg, setPreviewBg] = useState("ledger"); // "ledger" | "rx" | "white"

  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const transformedCanvasRef = useRef(null);

  // Dragging / Resizing crop box state
  const dragRef = useRef({
    isDragging: false,
    dragType: null,
    startX: 0,
    startY: 0,
    initialCrop: null,
  });

  // Prevent body scrolling when modal is open
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

  // Load source image
  useEffect(() => {
    if (!isOpen || !imageSource) {
      setLoadedImg(null);
      setPreviewDataUrl("");
      return;
    }

    let isMounted = true;
    loadImage(imageSource)
      .then((img) => {
        if (isMounted) {
          setLoadedImg(img);
          setRotation90(0);
          setFineAngle(0);
          setFlipH(false);
          setFlipV(false);
          setThresholdOffset(0);
          setStrokeBoost(0);
          setCropRect(null);
          setAutoDetected(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load source image in modal:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageSource]);

  const totalRotation = (rotation90 + fineAngle) % 360;

  // Build transformed canvas & perform initial auto-detection
  useEffect(() => {
    if (!loadedImg) return;

    const tCanvas = createTransformedCanvas(loadedImg, totalRotation, flipH, flipV);
    transformedCanvasRef.current = tCanvas;

    // Draw to main viewport canvas
    const viewCanvas = canvasRef.current;
    if (viewCanvas) {
      viewCanvas.width = tCanvas.width;
      viewCanvas.height = tCanvas.height;
      const ctx = viewCanvas.getContext("2d");
      ctx.drawImage(tCanvas, 0, 0);
    }

    // Auto-detect crop box if not manually set or on first load
    if (!cropRect || !autoDetected) {
      const bounds = detectSignatureBounds(tCanvas, thresholdOffset);
      setCropRect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      setAutoDetected(true);
    }
  }, [loadedImg, totalRotation, flipH, flipV, thresholdOffset]);

  // Generate real-time digital preview
  const updateLivePreview = useCallback(async () => {
    if (!imageSource || !cropRect) return;

    try {
      setProcessing(true);
      const resultUrl = await processSignature({
        imageSource,
        rotation: totalRotation,
        flipH,
        flipV,
        cropRect,
        thresholdOffset,
        inkColor,
        enhanceInk: true,
        strokeBoost,
      });
      setPreviewDataUrl(resultUrl);
    } catch (err) {
      console.error("Live preview error:", err);
    } finally {
      setProcessing(false);
    }
  }, [imageSource, totalRotation, flipH, flipV, cropRect, thresholdOffset, inkColor, strokeBoost]);

  // Debounced live preview generation
  useEffect(() => {
    const timer = setTimeout(() => {
      updateLivePreview();
    }, 80);
    return () => clearTimeout(timer);
  }, [updateLivePreview]);

  // Rotate 90 deg clockwise
  const handleRotateCw = () => {
    setRotation90((prev) => (prev + 90) % 360);
    setCropRect(null);
    setAutoDetected(false);
  };

  // Rotate 90 deg counter-clockwise
  const handleRotateCcw = () => {
    setRotation90((prev) => (prev - 90 + 360) % 360);
    setCropRect(null);
    setAutoDetected(false);
  };

  // One-click Auto Detect
  const handleAutoDetect = () => {
    if (!transformedCanvasRef.current) return;
    const bounds = detectSignatureBounds(transformedCanvasRef.current, thresholdOffset);
    setCropRect({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
    setAutoDetected(true);
  };

  // Reset to full view
  const handleResetCrop = () => {
    if (!transformedCanvasRef.current) return;
    setCropRect({
      x: 0,
      y: 0,
      width: transformedCanvasRef.current.width,
      height: transformedCanvasRef.current.height,
    });
    setRotation90(0);
    setFineAngle(0);
    setThresholdOffset(0);
    setStrokeBoost(0);
  };


  const handlePointerDown = (e, dragType) => {
    e.stopPropagation();
    e.preventDefault();

    if (!cropRect || !canvasRef.current) return;

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...cropRect },
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag.isDragging || !canvasRef.current || !transformedCanvasRef.current) return;

    const tCanvas = transformedCanvasRef.current;
    const canvasEl = canvasRef.current;
    const rect = canvasEl.getBoundingClientRect();

    // Scale ratio between screen display px and canvas coordinates
    const scaleX = tCanvas.width / rect.width;
    const scaleY = tCanvas.height / rect.height;

    const dx = (e.clientX - drag.startX) * scaleX;
    const dy = (e.clientY - drag.startY) * scaleY;
    const init = drag.initialCrop;

    let next = { ...init };
    const minSize = 30;

    switch (drag.dragType) {
      case "move":
        next.x = Math.max(0, Math.min(tCanvas.width - init.width, init.x + dx));
        next.y = Math.max(0, Math.min(tCanvas.height - init.height, init.y + dy));
        break;
      case "nw":
        next.x = Math.max(0, Math.min(init.x + init.width - minSize, init.x + dx));
        next.y = Math.max(0, Math.min(init.y + init.height - minSize, init.y + dy));
        next.width = init.width - (next.x - init.x);
        next.height = init.height - (next.y - init.y);
        break;
      case "ne":
        next.y = Math.max(0, Math.min(init.y + init.height - minSize, init.y + dy));
        next.width = Math.max(minSize, Math.min(tCanvas.width - init.x, init.width + dx));
        next.height = init.height - (next.y - init.y);
        break;
      case "sw":
        next.x = Math.max(0, Math.min(init.x + init.width - minSize, init.x + dx));
        next.width = init.width - (next.x - init.x);
        next.height = Math.max(minSize, Math.min(tCanvas.height - init.y, init.height + dy));
        break;
      case "se":
        next.width = Math.max(minSize, Math.min(tCanvas.width - init.x, init.width + dx));
        next.height = Math.max(minSize, Math.min(tCanvas.height - init.y, init.height + dy));
        break;
      case "n":
        next.y = Math.max(0, Math.min(init.y + init.height - minSize, init.y + dy));
        next.height = init.height - (next.y - init.y);
        break;
      case "s":
        next.height = Math.max(minSize, Math.min(tCanvas.height - init.y, init.height + dy));
        break;
      case "w":
        next.x = Math.max(0, Math.min(init.x + init.width - minSize, init.x + dx));
        next.width = init.width - (next.x - init.x);
        break;
      case "e":
        next.width = Math.max(minSize, Math.min(tCanvas.width - init.x, init.width + dx));
        break;
      default:
        break;
    }

    setCropRect(next);
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  // Convert cropRect into CSS percentages relative to canvas viewport
  const getCropBoxStyles = () => {
    if (!cropRect || !transformedCanvasRef.current) return { display: "none" };
    const tCanvas = transformedCanvasRef.current;
    return {
      left: `${(cropRect.x / tCanvas.width) * 100}%`,
      top: `${(cropRect.y / tCanvas.height) * 100}%`,
      width: `${(cropRect.width / tCanvas.width) * 100}%`,
      height: `${(cropRect.height / tCanvas.height) * 100}%`,
    };
  };

  const handleApply = async () => {
    if (!previewDataUrl) return;
    onApply?.(previewDataUrl);
    onClose?.();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="sig-modal-backdrop" onClick={onClose}>
      <div className="sig-studio-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sig-studio-header">
          <div className="sig-header-left">
            <div className="sig-icon-badge">
              <FiFeather size={18} />
            </div>
            <div>
              <h3 className="sig-studio-title">Digital Signature Studio</h3>
              <p className="sig-studio-subtitle">
                Crop, rotate, remove paper shadows & convert to crisp transparent digital ink
              </p>
            </div>
          </div>
          <button type="button" className="sig-close-btn" onClick={onClose} title="Close Studio">
            <FiX size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="sig-studio-body">
          {/* Left: Interactive Canvas Workspace with Crop Overlay */}
          <div className="sig-workspace-col">
            <div className="sig-toolbar-top">
              <div className="sig-tool-group">
                <button
                  type="button"
                  className="sig-tool-btn"
                  onClick={handleRotateCcw}
                  title="Rotate 90° Left"
                >
                  <FiRotateCcw size={15} />
                  <span>-90°</span>
                </button>
                <button
                  type="button"
                  className="sig-tool-btn"
                  onClick={handleRotateCw}
                  title="Rotate 90° Right"
                >
                  <FiRotateCw size={15} />
                  <span>+90°</span>
                </button>
                <button
                  type="button"
                  className={`sig-tool-btn ${flipH ? "active" : ""}`}
                  onClick={() => setFlipH((p) => !p)}
                  title="Flip Horizontal"
                >
                  Flip H
                </button>
              </div>

              <div className="sig-tool-group">
                <button
                  type="button"
                  className="sig-tool-btn highlight"
                  onClick={handleAutoDetect}
                  title="Auto-detect signature boundaries"
                >
                  <FiZap size={15} />
                  <span>Auto Detect</span>
                </button>
                <button
                  type="button"
                  className="sig-tool-btn"
                  onClick={handleResetCrop}
                  title="Reset Crop & Angles"
                >
                  <FiRefreshCw size={14} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="sig-canvas-stage" ref={canvasContainerRef}>
              <div className="sig-canvas-inner">
                <canvas ref={canvasRef} className="sig-main-canvas" />

                {/* Interactive Crop Box Overlay */}
                {cropRect && (
                  <div className="sig-crop-box" style={getCropBoxStyles()}>
                    {/* Drag Move Handle Area */}
                    <div
                      className="sig-crop-drag-area"
                      onPointerDown={(e) => handlePointerDown(e, "move")}
                    >
                      <div className="sig-crop-grid">
                        <span className="grid-h1" />
                        <span className="grid-h2" />
                        <span className="grid-v1" />
                        <span className="grid-v2" />
                      </div>
                    </div>

                    {/* Resize Handles */}
                    <div
                      className="sig-handle handle-nw"
                      onPointerDown={(e) => handlePointerDown(e, "nw")}
                    />
                    <div
                      className="sig-handle handle-ne"
                      onPointerDown={(e) => handlePointerDown(e, "ne")}
                    />
                    <div
                      className="sig-handle handle-sw"
                      onPointerDown={(e) => handlePointerDown(e, "sw")}
                    />
                    <div
                      className="sig-handle handle-se"
                      onPointerDown={(e) => handlePointerDown(e, "se")}
                    />
                    <div
                      className="sig-handle handle-n"
                      onPointerDown={(e) => handlePointerDown(e, "n")}
                    />
                    <div
                      className="sig-handle handle-s"
                      onPointerDown={(e) => handlePointerDown(e, "s")}
                    />
                    <div
                      className="sig-handle handle-w"
                      onPointerDown={(e) => handlePointerDown(e, "w")}
                    />
                    <div
                      className="sig-handle handle-e"
                      onPointerDown={(e) => handlePointerDown(e, "e")}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Fine Angle Straightening Slider */}
            <div className="sig-fine-slider-row">
              <label className="sig-slider-label">
                <FiSliders size={14} /> Fine Straighten Angle
              </label>
              <input
                type="range"
                min="-45"
                max="45"
                step="0.5"
                value={fineAngle}
                onChange={(e) => setFineAngle(parseFloat(e.target.value))}
                className="sig-range-slider"
              />
              <span className="sig-angle-readout">
                {fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}
              </span>
              {fineAngle !== 0 && (
                <button
                  type="button"
                  className="sig-small-reset"
                  onClick={() => setFineAngle(0)}
                  title="Reset angle to 0°"
                >
                  0°
                </button>
              )}
            </div>
          </div>

          {/* Right: Controls & Live Digital Preview */}
          <div className="sig-controls-col">
            {/* Live Digital Signature Preview */}
            <div className="sig-preview-card">
              <div className="sig-preview-card-header">
                <div className="sig-preview-title">
                  <FiEye size={14} /> Live Digital Output
                </div>
                <div className="sig-bg-toggles">
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "ledger" ? "active" : ""}`}
                    onClick={() => setPreviewBg("ledger")}
                    title="Transparency Ledger"
                  >
                    Ledger
                  </button>
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "rx" ? "active" : ""}`}
                    onClick={() => setPreviewBg("rx")}
                    title="Prescription Pad View"
                  >
                    Prescription Pad
                  </button>
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "white" ? "active" : ""}`}
                    onClick={() => setPreviewBg("white")}
                    title="Clean White View"
                  >
                    White
                  </button>
                </div>
              </div>

              <div className={`sig-live-preview-box bg-${previewBg}`}>
                {previewBg === "rx" && (
                  <div className="rx-pad-watermark">
                    <span className="rx-doctor-tag">Verified Doctor Signature</span>
                  </div>
                )}

                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Digital Signature Result"
                    className="sig-live-img"
                  />
                ) : (
                  <div className="sig-preview-empty">Processing signature...</div>
                )}
              </div>
            </div>

            {/* Ink Styling Options */}
            <div className="sig-setting-group">
              <label className="sig-setting-label">Digital Ink Style</label>
              <div className="sig-ink-options">
                <button
                  type="button"
                  className={`sig-ink-pill ink-blue ${inkColor === "blue" ? "selected" : ""}`}
                  onClick={() => setInkColor("blue")}
                >
                  <span className="color-swatch blue-swatch" />
                  <span>Royal Blue</span>
                </button>
                <button
                  type="button"
                  className={`sig-ink-pill ink-dark ${inkColor === "dark" ? "selected" : ""}`}
                  onClick={() => setInkColor("dark")}
                >
                  <span className="color-swatch dark-swatch" />
                  <span>Executive Black</span>
                </button>
                <button
                  type="button"
                  className={`sig-ink-pill ink-navy ${inkColor === "navy" ? "selected" : ""}`}
                  onClick={() => setInkColor("navy")}
                >
                  <span className="color-swatch navy-swatch" />
                  <span>Deep Navy</span>
                </button>
                <button
                  type="button"
                  className={`sig-ink-pill ink-original ${inkColor === "original" ? "selected" : ""}`}
                  onClick={() => setInkColor("original")}
                >
                  <span className="color-swatch orig-swatch" />
                  <span>Original Pen</span>
                </button>
              </div>
            </div>

            {/* Shadow & Background Removal Sensitivity */}
            <div className="sig-setting-group">
              <div className="sig-setting-header-row">
                <label className="sig-setting-label">
                  <FiSun size={13} /> Shadow & Background Sensitivity
                </label>
                <span className="sig-value-badge">
                  {thresholdOffset > 0 ? `+${thresholdOffset}` : thresholdOffset}
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="2"
                value={thresholdOffset}
                onChange={(e) => setThresholdOffset(parseInt(e.target.value, 10))}
                className="sig-range-slider"
              />
              <div className="sig-slider-sub">
                <span>Cleaner White</span>
                <span>Preserve Light Ink</span>
              </div>
            </div>

            {/* Stroke Thickness / Fullness */}
            <div className="sig-setting-group">
              <div className="sig-setting-header-row">
                <label className="sig-setting-label">
                  <FiFeather size={13} /> Stroke Fullness & Boost
                </label>
                <span className="sig-value-badge">
                  {strokeBoost === 0 ? "Normal" : `+${strokeBoost}`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={strokeBoost}
                onChange={(e) => setStrokeBoost(parseInt(e.target.value, 10))}
                className="sig-range-slider"
              />
              <div className="sig-slider-sub">
                <span>Natural Crisp</span>
                <span>Thicker Pen Stroke</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sig-studio-footer">
          <div className="sig-footer-tip">
            💡 <strong>Tip:</strong> Drag the crop corners or use <strong>Auto Detect</strong> to frame your signature.
          </div>
          <div className="sig-footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={!previewDataUrl || processing}
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
