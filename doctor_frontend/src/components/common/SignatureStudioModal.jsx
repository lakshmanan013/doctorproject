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
  FiEdit3,
  FiType,
  FiUploadCloud,
  FiTrash2,
  FiCornerUpLeft,
  FiItalic,
  FiScissors,
  FiDroplet,
  FiSlash,
  FiLayers,
  FiMoon,
  FiCheckCircle,
} from "react-icons/fi";
import {
  loadImage,
  createTransformedCanvas,
  detectSignatureBounds,
  processSignature,
  SIGNATURE_FONTS,
  SIGNATURE_COLORS,
  trimCanvasTransparency,
  generateTypedSignature,
} from "../../utils/signatureProcessor";
import Button from "../ui/Button";
import "./SignatureStudioModal.css";

export default function SignatureStudioModal({
  isOpen,
  initialTab = "draw",
  imageSource,
  doctorName = "",
  onClose,
  onApply,
  initialInkColor = "blue",
}) {
  // Active studio mode: "draw" | "type" | "upload"
  const [activeTab, setActiveTab] = useState(
    imageSource && initialTab === "upload" ? "upload" : initialTab || "draw"
  );

  // Common ink color & preview background
  const [inkColor, setInkColor] = useState(initialInkColor);
  const [previewBg, setPreviewBg] = useState("ledger"); // "ledger" | "white" | "dark"
  const [processing, setProcessing] = useState(false);

  // Background removal options
  const [backgroundMode, setBackgroundMode] = useState("transparent"); // "transparent" | "white" | "original"
  const [thresholdOffset, setThresholdOffset] = useState(0); // -60 to +60
  const [despeckle, setDespeckle] = useState(true);

  // Color removal & ink options
  const [removeColor, setRemoveColor] = useState(false); // boolean for pure monochrome black
  const [customColorHex, setCustomColorHex] = useState("#1034a6");
  const [invert, setInvert] = useState(false);
  const [strokeBoost, setStrokeBoost] = useState(0); // 0 to 3

  // ==========================================
  // TAB 1: DRAW WITH PEN STATE & REFS
  // ==========================================
  const drawCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [strokes, setStrokes] = useState([]); // Array of stroke paths { points, color, width }
  const [currentStroke, setCurrentStroke] = useState(null);
  const [penWidth, setPenWidth] = useState(3.5); // 2 | 3.5 | 5.5
  const [drawHasInk, setDrawHasInk] = useState(false);

  // ==========================================
  // TAB 2: TYPE CURSIVE FONT STATE
  // ==========================================
  const [typedText, setTypedText] = useState(
    doctorName
      ? (doctorName.toLowerCase().startsWith("dr") ? doctorName : `Dr. ${doctorName}`)
      : "Dr. Signature"
  );
  const [selectedFontId, setSelectedFontId] = useState("dancing");
  const [isSlanted, setIsSlanted] = useState(false);

  // ==========================================
  // TAB 3: SCAN PAPER SIGNATURE STATE & REFS
  // ==========================================
  const [scanImageSource, setScanImageSource] = useState(imageSource || null);
  const [loadedImg, setLoadedImg] = useState(null);
  const [rotation90, setRotation90] = useState(0); // 0, 90, 180, 270
  const [fineAngle, setFineAngle] = useState(0); // -45 to +45
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState(imageSource || "");

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

  // Current active preview result for the modal footer
  const [activePreviewUrl, setActivePreviewUrl] = useState(imageSource || "");

  // Prevent background scrolling when modal is open
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

  // Sync initial tab, doctorName, and imageSource when opening
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (doctorName) {
        setTypedText(
          doctorName.toLowerCase().startsWith("dr") ? doctorName : `Dr. ${doctorName}`
        );
      }
      if (imageSource) {
        setScanImageSource(imageSource);
        setScanPreviewUrl(imageSource);
        setActivePreviewUrl(imageSource);
      }
    }
  }, [isOpen, initialTab, doctorName, imageSource]);

  // Determine active color hex
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

  // =========================================================================
  // TAB 1: DRAW CANVAS IMPLEMENTATION
  // =========================================================================
  const redrawDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 2;
    const w = canvas.parentElement ? canvas.parentElement.clientWidth : 650;
    const h = 260;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw baseline watermark line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, h - 50);
    ctx.lineTo(w - 30, h - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Watermark "X" on left of line
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("✕", 32, h - 55);

    // Render all saved strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          const prev = stroke.points[i - 1];
          const midX = (prev.x + pt.x) / 2;
          const midY = (prev.y + pt.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx.lineTo(
          stroke.points[stroke.points.length - 1].x,
          stroke.points[stroke.points.length - 1].y
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [strokes, currentStroke]);

  useEffect(() => {
    if (activeTab === "draw") {
      redrawDrawCanvas();
    }
  }, [activeTab, redrawDrawCanvas]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    setCurrentStroke({
      color: activeColorHex,
      width: penWidth,
      points: [{ x, y }],
    });
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y }],
      };
    });
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStroke && currentStroke.points.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setDrawHasInk(true);
    }
    setCurrentStroke(null);
  };

  const handleClearDraw = () => {
    setStrokes([]);
    setCurrentStroke(null);
    setDrawHasInk(false);
    redrawDrawCanvas();
  };

  const handleUndoDraw = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      if (next.length === 0) setDrawHasInk(false);
      return next;
    });
  };

  // Convert draw canvas to trimmed transparent or white PNG
  const getDrawnSignatureDataUrl = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || strokes.length === 0) return "";
    const trimmed = trimCanvasTransparency(canvas, 16);
    if (backgroundMode === "white") {
      const whiteCanvas = document.createElement("canvas");
      whiteCanvas.width = trimmed.width;
      whiteCanvas.height = trimmed.height;
      const wCtx = whiteCanvas.getContext("2d");
      wCtx.fillStyle = "#ffffff";
      wCtx.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height);
      wCtx.drawImage(trimmed, 0, 0);
      return whiteCanvas.toDataURL("image/png");
    }
    return trimmed.toDataURL("image/png");
  }, [strokes, backgroundMode]);

  // =========================================================================
  // TAB 2: TYPE CURSIVE FONT IMPLEMENTATION
  // =========================================================================
  const selectedFontObj = SIGNATURE_FONTS.find((f) => f.id === selectedFontId) || SIGNATURE_FONTS[0];

  const getTypedSignatureDataUrl = useCallback(() => {
    if (!typedText.trim()) return "";
    return generateTypedSignature(
      typedText.trim(),
      selectedFontObj.font,
      activeColorHex,
      isSlanted,
      backgroundMode
    );
  }, [typedText, selectedFontObj, activeColorHex, isSlanted, backgroundMode]);

  // =========================================================================
  // TAB 3: SCAN PAPER SIGNATURE CV PIPELINE
  // =========================================================================
  useEffect(() => {
    if (activeTab !== "upload" || !scanImageSource) {
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
          // Immediately set initial cropRect so preview pipeline starts with ZERO waiting
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
  }, [activeTab, scanImageSource]);

  // Render transformed image on stage canvas and auto-detect bounds
  useEffect(() => {
    if (activeTab !== "upload" || !loadedImg) return;

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
  }, [activeTab, loadedImg, rotation90, fineAngle, flipH, flipV, thresholdOffset, autoDetected]);

  // Stage canvas mount & size synchronization
  useEffect(() => {
    if (activeTab === "upload" && canvasRef.current && transformedCanvasRef.current) {
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

  // Generate Scan Live Preview Debounced with background and color removal (ultra-fast 25ms response)
  useEffect(() => {
    if (activeTab !== "upload" || !loadedImg) return;

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
          setScanPreviewUrl(resultUrl);
        }
      } catch (err) {
        console.error("Scan preview processing error:", err);
      } finally {
        setProcessing(false);
      }
    }, 25);

    return () => clearTimeout(timer);
  }, [
    activeTab,
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

  const handleScanFileUpload = (e) => {
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

  // Crop drag/resize handlers for Scan mode
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

  // Compute live activePreviewUrl depending on the active tab
  useEffect(() => {
    if (activeTab === "draw") {
      if (drawHasInk) {
        const url = getDrawnSignatureDataUrl();
        setActivePreviewUrl(url);
      } else {
        setActivePreviewUrl("");
      }
    } else if (activeTab === "type") {
      const url = getTypedSignatureDataUrl();
      setActivePreviewUrl(url);
    } else if (activeTab === "upload") {
      setActivePreviewUrl(scanPreviewUrl);
    }
  }, [
    activeTab,
    drawHasInk,
    strokes,
    typedText,
    selectedFontId,
    activeColorHex,
    isSlanted,
    backgroundMode,
    scanPreviewUrl,
    getDrawnSignatureDataUrl,
    getTypedSignatureDataUrl,
  ]);

  // Apply button action
  const handleApply = () => {
    let finalUrl = "";
    if (activeTab === "draw") {
      finalUrl = getDrawnSignatureDataUrl();
    } else if (activeTab === "type") {
      finalUrl = getTypedSignatureDataUrl();
    } else if (activeTab === "upload") {
      finalUrl = scanPreviewUrl;
    }

    if (finalUrl && onApply) {
      onApply(finalUrl);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="sig-modal-backdrop" onClick={onClose}>
      <div className="sig-studio-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="sig-studio-header">
          <div className="sig-header-left">
            <div className="sig-icon-badge">
              <FiFeather size={20} />
            </div>
            <div>
              <h3 className="sig-studio-title">Digital Signature Studio</h3>
              <p className="sig-studio-subtitle">
                Background removal, color stripping, pen draw & calligraphy fonts for certified clinical signatures
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

        {/* Tab Switcher Bar */}
        <div className="sig-studio-tab-bar">
          <button
            type="button"
            className={`sig-studio-tab-btn ${activeTab === "draw" ? "active" : ""}`}
            onClick={() => setActiveTab("draw")}
          >
            <FiEdit3 size={15} />
            <span>Draw with Pen</span>
          </button>
          <button
            type="button"
            className={`sig-studio-tab-btn ${activeTab === "type" ? "active" : ""}`}
            onClick={() => setActiveTab("type")}
          >
            <FiType size={15} />
            <span>Type Cursive Font</span>
          </button>
          <button
            type="button"
            className={`sig-studio-tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            <FiUploadCloud size={15} />
            <span>Scan / Photo (Remove BG & Colour)</span>
          </button>
        </div>

        {/* Studio Main Workspace */}
        <div className="sig-studio-body">
          {/* LEFT STAGE: INTERACTIVE CREATION AREA */}
          <div className="sig-studio-stage-panel">
            {/* ---------------------------------------------------- */}
            {/* TAB 1: DRAW CANVAS                                  */}
            {/* ---------------------------------------------------- */}
            {activeTab === "draw" && (
              <div className="sig-draw-container">
                <div className="sig-draw-toolbar">
                  <div className="sig-draw-tools-left">
                    <span className="sig-draw-hint">✍️ Draw your signature on the pad using mouse or stylus:</span>
                  </div>
                  <div className="sig-draw-tools-right">
                    <button
                      type="button"
                      className="sig-tool-btn"
                      onClick={handleUndoDraw}
                      disabled={strokes.length === 0}
                      title="Undo stroke"
                    >
                      <FiCornerUpLeft size={14} /> Undo
                    </button>
                    <button
                      type="button"
                      className="sig-tool-btn danger"
                      onClick={handleClearDraw}
                      disabled={strokes.length === 0}
                      title="Clear Pad"
                    >
                      <FiTrash2 size={14} /> Clear
                    </button>
                  </div>
                </div>

                <div className="sig-draw-canvas-wrap">
                  <canvas
                    ref={drawCanvasRef}
                    className="sig-draw-canvas"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                  {!drawHasInk && (
                    <div className="sig-draw-empty-hint">
                      <span>Sign along the dotted baseline</span>
                    </div>
                  )}
                </div>

                {/* Pen Thickness Strip */}
                <div className="sig-draw-footer-controls">
                  <div className="sig-thickness-group">
                    <span className="sig-sub-label">Pen Stroke:</span>
                    <button
                      type="button"
                      className={`sig-thickness-btn ${penWidth === 2 ? "active" : ""}`}
                      onClick={() => setPenWidth(2)}
                    >
                      Fine (2px)
                    </button>
                    <button
                      type="button"
                      className={`sig-thickness-btn ${penWidth === 3.5 ? "active" : ""}`}
                      onClick={() => setPenWidth(3.5)}
                    >
                      Medium (3.5px)
                    </button>
                    <button
                      type="button"
                      className={`sig-thickness-btn ${penWidth === 5.5 ? "active" : ""}`}
                      onClick={() => setPenWidth(5.5)}
                    >
                      Bold (5.5px)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 2: TYPE CURSIVE FONT                            */}
            {/* ---------------------------------------------------- */}
            {activeTab === "type" && (
              <div className="sig-type-container">
                <div className="sig-type-input-box">
                  <label className="sig-sub-label">Enter Doctor Name or Initials:</label>
                  <div className="sig-type-input-wrap">
                    <input
                      type="text"
                      className="sig-type-text-field"
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      placeholder="e.g. Dr. Jane Doe"
                    />
                    <button
                      type="button"
                      className={`sig-slant-toggle ${isSlanted ? "active" : ""}`}
                      onClick={() => setIsSlanted((s) => !s)}
                      title="Toggle Italic Cursive Slant"
                    >
                      <FiItalic size={14} /> Slanted
                    </button>
                  </div>
                </div>

                <div className="sig-font-grid-label">
                  <span className="sig-sub-label">Select Physician Calligraphy Font:</span>
                </div>

                <div className="sig-font-grid">
                  {SIGNATURE_FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`sig-font-card ${selectedFontId === f.id ? "active" : ""}`}
                      onClick={() => setSelectedFontId(f.id)}
                    >
                      <div className="sig-font-header">
                        <span className="sig-font-name">{f.name}</span>
                        {selectedFontId === f.id && <FiCheck className="sig-font-check" size={14} />}
                      </div>
                      <div
                        className="sig-font-preview"
                        style={{
                          fontFamily: f.font,
                          color: activeColorHex,
                          fontStyle: isSlanted ? "italic" : "normal",
                        }}
                      >
                        {typedText.trim() || "Dr. Signature"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 3: SCAN PAPER SIGNATURE (CV PIPELINE)           */}
            {/* ---------------------------------------------------- */}
            {activeTab === "upload" && (
              <div className="sig-scan-container">
                <input
                  ref={scanFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleScanFileUpload}
                />

                {!loadedImg ? (
                  <div className="sig-upload-placeholder" onClick={() => scanFileInputRef.current?.click()}>
                    <FiUploadCloud size={44} className="sig-upload-icon" />
                    <h4>Upload Paper Signature Photo or Scan</h4>
                    <p>Select a photo or scan of your handwritten signature. Background and ink colors will be automatically processed.</p>
                    <button type="button" className="btn-upload-file">
                      Browse Signature Image
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="sig-toolbar">
                      <div className="sig-toolbar-group">
                        <button
                          type="button"
                          className={`sig-tool-btn highlight ${backgroundMode === "transparent" ? "active" : ""}`}
                          onClick={() => setBackgroundMode((m) => (m === "transparent" ? "white" : "transparent"))}
                          title="Toggle transparent background removal"
                        >
                          <FiScissors size={14} /> {backgroundMode === "transparent" ? "BG Removed (On)" : "Remove BG"}
                        </button>
                        <button
                          type="button"
                          className={`sig-tool-btn ${removeColor || inkColor === "monochrome" ? "active" : ""}`}
                          onClick={handleToggleRemoveColor}
                          title="Toggle Pure Black / Color Removed"
                        >
                          <FiSlash size={14} /> {removeColor || inkColor === "monochrome" ? "Colour Removed (B&W)" : "Remove Colour"}
                        </button>
                      </div>

                      <div className="sig-toolbar-group">
                        <button
                          type="button"
                          className="sig-tool-btn"
                          onClick={() => setRotation90((r) => (r - 90 + 360) % 360)}
                          title="Rotate 90° CCW"
                        >
                          <FiRotateCcw size={13} /> -90°
                        </button>
                        <button
                          type="button"
                          className="sig-tool-btn"
                          onClick={() => setRotation90((r) => (r + 90) % 360)}
                          title="Rotate 90° CW"
                        >
                          <FiRotateCw size={13} /> +90°
                        </button>
                        <button
                          type="button"
                          className="sig-tool-btn"
                          onClick={() => setFlipH((f) => !f)}
                          title="Flip Horizontal"
                        >
                          Flip H
                        </button>
                        <button
                          type="button"
                          className={`sig-tool-btn highlight ${autoDetected ? "active" : ""}`}
                          onClick={handleAutoDetect}
                          title="Auto Detect Signature Bounds"
                        >
                          <FiZap size={13} /> Auto Crop
                        </button>
                        <button
                          type="button"
                          className="sig-tool-btn"
                          onClick={() => scanFileInputRef.current?.click()}
                          title="Upload Different Photo"
                        >
                          <FiUploadCloud size={13} /> Replace
                        </button>
                      </div>
                    </div>

                    <div className="sig-canvas-stage" ref={canvasContainerRef}>
                      <canvas ref={canvasRef} className="sig-source-canvas" />

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
                          <div className="crop-grid-line h1" />
                          <div className="crop-grid-line h2" />
                          <div className="crop-grid-line v1" />
                          <div className="crop-grid-line v2" />
                        </div>
                      )}
                    </div>

                    {/* Fine angle deskew slider */}
                    <div className="sig-fine-slider-row">
                      <span className="sig-slider-title">Fine Deskew Angle:</span>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        step="0.5"
                        value={fineAngle}
                        onChange={(e) => setFineAngle(parseFloat(e.target.value))}
                        className="sig-range-slider"
                      />
                      <span className="sig-value-chip">{fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}</span>
                      {fineAngle !== 0 && (
                        <button
                          type="button"
                          className="sig-small-reset"
                          onClick={() => setFineAngle(0)}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: DIGITAL INK STYLING & LIVE PREVIEW */}
          <div className="sig-studio-settings-panel">
            {/* Live Preview Card */}
            <div className="sig-preview-card">
              <div className="sig-preview-header">
                <span className="sig-preview-title">
                  <FiEye size={14} /> Live Signature Preview
                </span>
                <div className="sig-bg-toggles">
                  <button
                    type="button"
                    className={`sig-bg-pill ${previewBg === "ledger" ? "active" : ""}`}
                    onClick={() => setPreviewBg("ledger")}
                    title="Ledger Checkerboard Grid"
                  >
                    Ledger
                  </button>
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
                        <span>Optimizing signature...</span>
                      </div>
                    ) : activeTab === "draw" ? (
                      "Draw your signature on the pad"
                    ) : activeTab === "type" ? (
                      "Type your name above"
                    ) : (
                      "Upload a signature photo or select an image"
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
                    ? "Colour Removed (B&W)"
                    : inkColor === "original"
                    ? "Original Pen Ink"
                    : "Recolored Ink"}
                </span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: BACKGROUND REMOVAL CONTROLS                   */}
            {/* ========================================================= */}
            <div className="sig-setting-card">
              <div className="sig-card-header">
                <label className="sig-setting-label">
                  <FiScissors size={14} className="sig-header-icon" /> Background Removal Option
                </label>
                <span className="sig-chip-active">
                  {backgroundMode === "transparent" ? "Transparent Active" : backgroundMode}
                </span>
              </div>

              {/* Mode Segmented Buttons */}
              <div className="sig-mode-segmented">
                <button
                  type="button"
                  className={`sig-mode-btn ${backgroundMode === "transparent" ? "active" : ""}`}
                  onClick={() => setBackgroundMode("transparent")}
                >
                  <FiCheckCircle size={13} className="sig-mode-icon" />
                  <span>Transparent (Remove BG)</span>
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

              {/* Scan Sensitivity Slider (Only in Scan Mode) */}
              {activeTab === "upload" && loadedImg && backgroundMode !== "original" && (
                <div className="sig-sub-setting-group">
                  <div className="sig-setting-header-row">
                    <span className="sig-sub-label-text">
                      <FiSun size={12} /> Sensitivity & Shadow Cut:
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
                    <span>🧼 Cleaner White (Cut Shadows)</span>
                    <span>✍️ Preserve Light Ink</span>
                  </div>

                  {/* Despeckle Toggle */}
                  <label className="sig-checkbox-toggle">
                    <input
                      type="checkbox"
                      checked={despeckle}
                      onChange={(e) => setDespeckle(e.target.checked)}
                    />
                    <span className="sig-toggle-text">Clean Paper Grain & Stray Specks (Despeckle)</span>
                  </label>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: COLOUR REMOVAL & DIGITAL INK OPTIONS          */}
            {/* ========================================================= */}
            <div className="sig-setting-card">
              <div className="sig-card-header">
                <label className="sig-setting-label">
                  <FiDroplet size={14} className="sig-header-icon" /> Colour & Ink Options
                </label>
              </div>

              {/* Quick High-Priority "Remove Colour" Toggle Button */}
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
                        ? "✓ Colour Removed (Pure Black B&W)"
                        : "Remove Colour (Pure Black B&W)"}
                    </strong>
                    <span className="sig-mono-desc">
                      Strip all pen color hues for official black & white documents
                    </span>
                  </div>
                </div>
              </button>

              {/* Ink Palette Grid */}
              <div className="sig-ink-grid-wrap">
                <span className="sig-palette-title">Or Choose Ink Color:</span>
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

                {/* Custom Color Input if selected */}
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

            {/* ========================================================= */}
            {/* SECTION 3: STROKE FULLNESS & FINE-TUNING                */}
            {/* ========================================================= */}
            {activeTab === "upload" && loadedImg && (
              <div className="sig-setting-card">
                <div className="sig-card-header">
                  <label className="sig-setting-label">
                    <FiFeather size={14} className="sig-header-icon" /> Stroke Fullness & Invert
                  </label>
                  <span className="sig-value-badge">
                    {strokeBoost === 0 ? "Normal" : `+${strokeBoost} Boost`}
                  </span>
                </div>

                <div className="sig-stroke-boost-buttons">
                  {[0, 1, 2, 3].map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={`sig-boost-btn ${strokeBoost === b ? "active" : ""}`}
                      onClick={() => setStrokeBoost(b)}
                    >
                      {b === 0 ? "Normal" : b === 1 ? "+1 Bold" : b === 2 ? "+2 Heavy" : "+3 Ultra"}
                    </button>
                  ))}
                </div>

                <label className="sig-checkbox-toggle" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={invert}
                    onChange={(e) => setInvert(e.target.checked)}
                  />
                  <span className="sig-toggle-text">Invert Colors (Light on Dark)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sig-studio-footer">
          <div className="sig-footer-tip">
            💡 <strong>Export Mode:</strong>{" "}
            {backgroundMode === "transparent" ? (
              <span className="sig-tag-highlight">Transparent PNG (No Background)</span>
            ) : backgroundMode === "white" ? (
              <span className="sig-tag-highlight">White Paper Background</span>
            ) : (
              <span className="sig-tag-highlight">Original Background Photo</span>
            )}{" "}
            {removeColor || inkColor === "monochrome" ? "• Pure Black B&W Ink" : `• ${activeColorHex}`}
          </div>
          <div className="sig-footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={!activePreviewUrl}
              className="btn-apply-sig"
            >
              <FiCheck size={16} /> Apply & Save Signature
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
