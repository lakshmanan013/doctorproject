/**
 * Signature Processor Utility
 * High-performance browser-based computer vision pipeline for
 * paper-to-digital signature extraction, auto-detection, cropping,
 * rotation, shadow removal, background removal, color removal, and ink enhancement.
 */

/**
 * Loads an image from a File, Blob, Image, Canvas or URL string into an HTMLImageElement
 * @param {File | Blob | HTMLImageElement | HTMLCanvasElement | string} source
 * @returns {Promise<HTMLImageElement | HTMLCanvasElement>}
 */
export function loadImage(source) {
  if (!source) {
    return Promise.reject(new Error("No image source provided"));
  }

  // If already an HTMLImageElement or Image, return immediately
  if (
    (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) ||
    (typeof Image !== "undefined" && source instanceof Image) ||
    (source && source.tagName === "IMG")
  ) {
    if (source.complete && source.naturalWidth > 0) {
      return Promise.resolve(source);
    }
    return new Promise((resolve, reject) => {
      source.onload = () => resolve(source);
      source.onerror = (err) => reject(new Error("Failed to load image element: " + err));
    });
  }

  // If already a canvas, return immediately
  if (
    (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) ||
    (source && source.tagName === "CANVAS")
  ) {
    return Promise.resolve(source);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image: " + err));

    if (typeof source === "string") {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      reject(new Error("Unsupported image source type"));
    }
  });
}

/**
 * Converts a hex color string to RGB object
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  if (!hex) return { r: 16, g: 52, b: 166 };
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
}

/**
 * Creates a canvas with the image transformed by rotation and flipping.
 * @param {HTMLImageElement | HTMLCanvasElement} img
 * @param {number} rotation - Rotation in degrees (e.g. 0, 90, 180, 270, plus fine angle)
 * @param {boolean} flipH - Horizontal flip
 * @param {boolean} flipV - Vertical flip
 * @param {number} maxDimension - Max dimension for speed and performance
 * @returns {HTMLCanvasElement}
 */
export function createTransformedCanvas(img, rotation = 0, flipH = false, flipV = false, maxDimension = 1000) {
  let origW = img.naturalWidth || img.width || 800;
  let origH = img.naturalHeight || img.height || 400;

  // Scale down if large for ultra-fast interactive processing
  let scale = 1;
  if (origW > maxDimension || origH > maxDimension) {
    scale = maxDimension / Math.max(origW, origH);
  }
  const drawW = Math.max(1, Math.round(origW * scale));
  const drawH = Math.max(1, Math.round(origH * scale));

  const rad = ((rotation % 360) * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const boundW = Math.max(1, Math.round(drawW * cos + drawH * sin));
  const boundH = Math.max(1, Math.round(drawW * sin + drawH * cos));

  const canvas = document.createElement("canvas");
  canvas.width = boundW;
  canvas.height = boundH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Center coordinate
  ctx.translate(boundW / 2, boundH / 2);
  if (rad !== 0) ctx.rotate(rad);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  return canvas;
}

/**
 * Analyzes pixel luminance histogram and calculates the dynamic paper threshold.
 * Handles uneven phone shadows by using the 85th percentile background luminance.
 * @param {Uint8ClampedArray} data - RGBA pixel array
 * @param {number} totalPixels
 * @param {number} thresholdOffset - user sensitivity offset (-60 to +60)
 * @returns {{ paperLum: number, paperThreshold: number, isAlreadyTransparent: boolean }}
 */
export function calculatePaperThreshold(data, totalPixels, thresholdOffset = 0) {
  const hist = new Uint32Array(256);
  let opaqueCount = 0;
  let transparentCount = 0;

  // Stride of 2 for fast sampling on large canvases
  const step = totalPixels > 100000 ? 8 : 4;
  for (let i = 0; i < data.length; i += step) {
    const a = data[i + 3];
    if (a < 35) {
      transparentCount++;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (r * 77 + g * 150 + b * 29) >> 8;
    hist[lum]++;
    opaqueCount++;
  }

  // Check if image is already a transparent digital signature
  const isAlreadyTransparent = transparentCount > (totalPixels / (step / 4)) * 0.05;

  if (isAlreadyTransparent || opaqueCount === 0) {
    return { paperLum: 255, paperThreshold: 255, isAlreadyTransparent: true };
  }

  let count = 0;
  const target85th = Math.floor(opaqueCount * 0.85);
  let paperLum = 220;
  for (let l = 0; l < 256; l++) {
    count += hist[l];
    if (count >= target85th) {
      paperLum = Math.max(140, l);
      break;
    }
  }

  // Base threshold is 88% of paper brightness + user offset
  const baseThreshold = Math.round(paperLum * 0.88);
  const paperThreshold = Math.max(90, Math.min(252, baseThreshold + thresholdOffset));

  return { paperLum, paperThreshold, isAlreadyTransparent: false };
}

/**
 * Auto-detects the tight bounding box containing the signature strokes.
 * @param {HTMLCanvasElement} canvas
 * @param {number} thresholdOffset
 * @returns {{ x: number, y: number, width: number, height: number, inkCount: number, detected: boolean }}
 */
export function detectSignatureBounds(canvas, thresholdOffset = 0) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  const { paperThreshold, isAlreadyTransparent } = calculatePaperThreshold(data, totalPixels, thresholdOffset);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let inkCount = 0;

  // Scan with a 2-pixel stride for fast auto-detection
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];

      if (isAlreadyTransparent) {
        if (a > 30) {
          inkCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } else {
        if (a < 35) continue;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum < paperThreshold - 8) {
          inkCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  const detected = inkCount > 10 && maxX > minX && maxY > minY;

  if (!detected) {
    // Default to a central 80% box if no clear strokes detected
    const marginX = Math.round(width * 0.1);
    const marginY = Math.round(height * 0.1);
    return {
      x: marginX,
      y: marginY,
      width: Math.max(10, width - marginX * 2),
      height: Math.max(10, height - marginY * 2),
      inkCount: 0,
      detected: false,
    };
  }

  // Add 4% padding around signature
  const padX = Math.max(16, Math.round((maxX - minX) * 0.04));
  const padY = Math.max(16, Math.round((maxY - minY) * 0.04));

  const cropX = Math.max(0, minX - padX);
  const cropY = Math.max(0, minY - padY);
  const cropW = Math.min(width - cropX, maxX - minX + padX * 2);
  const cropH = Math.min(height - cropY, maxY - minY + padY * 2);

  return {
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
    inkCount,
    detected: true,
  };
}

/**
 * Cleans isolated 1-2 pixel noise particles and speckles from paper fibers
 * @param {Uint8ClampedArray} data - RGBA buffer
 * @param {number} width
 * @param {number} height
 */
export function applyDespeckle(data, width, height) {
  if (width < 3 || height < 3) return;
  // High-performance single-pass neighbor check
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      if (data[idx + 3] > 30) {
        if (
          data[idx - 4 + 3] < 20 &&
          data[idx + 4 + 3] < 20 &&
          data[idx - width * 4 + 3] < 20 &&
          data[idx + width * 4 + 3] < 20
        ) {
          data[idx + 3] = 0;
        }
      }
    }
  }
}

/**
 * Full Pipeline: Converts paper signature into a digital signature with
 * custom background removal, color removal, ink recoloring, rotation, cropping,
 * and noise filtering.
 *
 * @param {Object} params
 * @param {File | Blob | HTMLImageElement | HTMLCanvasElement | string} params.imageSource
 * @param {number} [params.rotation=0]
 * @param {boolean} [params.flipH=false]
 * @param {boolean} [params.flipV=false]
 * @param {Object|null} [params.cropRect=null]
 * @param {number} [params.thresholdOffset=0]
 * @param {boolean} [params.removeBackground=true]
 * @param {string} [params.backgroundMode="transparent"]
 * @param {boolean} [params.removeColor=false]
 * @param {string} [params.inkColor="blue"]
 * @param {string} [params.customColorHex="#1034a6"]
 * @param {boolean} [params.enhanceInk=true]
 * @param {number} [params.strokeBoost=0]
 * @param {boolean} [params.despeckle=true]
 * @param {boolean} [params.invert=false]
 * @param {boolean} [params.autoTrim=true]
 * @returns {Promise<string>}
 */
export async function processSignature({
  imageSource,
  rotation = 0,
  flipH = false,
  flipV = false,
  cropRect = null,
  thresholdOffset = 0,
  removeBackground = true,
  backgroundMode = "transparent",
  removeColor = false,
  inkColor = "blue",
  customColorHex = "#1034a6",
  enhanceInk = true,
  strokeBoost = 0,
  despeckle = true,
  invert = false,
  autoTrim = true,
}) {
  const img = await loadImage(imageSource);
  const fullCanvas = createTransformedCanvas(img, rotation, flipH, flipV, 1000);

  // Auto-detect crop if not provided
  let effectiveCrop = cropRect;
  if (!effectiveCrop || effectiveCrop.width <= 0 || effectiveCrop.height <= 0) {
    const bounds = detectSignatureBounds(fullCanvas, thresholdOffset);
    effectiveCrop = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  // Ensure crop is within canvas bounds
  const cx = Math.max(0, Math.min(fullCanvas.width - 10, Math.round(effectiveCrop.x)));
  const cy = Math.max(0, Math.min(fullCanvas.height - 10, Math.round(effectiveCrop.y)));
  const cw = Math.max(10, Math.min(fullCanvas.width - cx, Math.round(effectiveCrop.width)));
  const ch = Math.max(10, Math.min(fullCanvas.height - cy, Math.round(effectiveCrop.height)));

  // Extract cropped area to a new canvas for segmentation
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cw;
  cropCanvas.height = ch;
  const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });
  cropCtx.drawImage(fullCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

  const imgData = cropCtx.getImageData(0, 0, cw, ch);
  const data = imgData.data;
  const totalPixels = cw * ch;

  const { paperThreshold, isAlreadyTransparent } = calculatePaperThreshold(data, totalPixels, thresholdOffset);

  // Determine effective background mode
  const effectiveBgMode = !removeBackground ? "original" : backgroundMode;

  // Target ink color RGB
  const colorPresets = {
    monochrome: { r: 0, g: 0, b: 0 },          // Pure Black / Color Removed
    dark: { r: 15, g: 23, b: 42 },              // Executive Dark Slate
    blue: { r: 16, g: 52, b: 166 },             // DocuSign / Medical Rx Royal Blue
    navy: { r: 24, g: 58, b: 120 },             // Deep Navy Blue
    emerald: { r: 4, g: 120, b: 87 },           // Clinical Forest Green
    maroon: { r: 185, g: 28, b: 28 },           // Official Seal Red
  };

  let targetRgb = colorPresets.blue;
  const isColorRemoveActive = removeColor || inkColor === "monochrome";

  if (isColorRemoveActive) {
    targetRgb = colorPresets.monochrome;
  } else if (inkColor === "custom") {
    targetRgb = hexToRgb(customColorHex);
  } else if (colorPresets[inkColor]) {
    targetRgb = colorPresets[inkColor];
  } else if (typeof inkColor === "string" && inkColor.startsWith("#")) {
    targetRgb = hexToRgb(inkColor);
  }

  // Precomputed fast power curve lookup table (256 entries) - runs 10x faster
  const alphaLookup = new Uint8Array(256);
  const denom = Math.max(1, paperThreshold * 0.52);
  const boostMult = strokeBoost > 0 ? (1 + strokeBoost * 0.28) : 1;
  for (let diff = 0; diff < 256; diff++) {
    let a = Math.round(Math.pow(diff / denom, 0.72) * 255);
    if (strokeBoost > 0) a = Math.round(a * boostMult);
    alphaLookup[diff] = Math.min(255, a);
  }

  // Iterate over pixel buffer with high performance
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];

    // CASE 1: Image is already transparent PNG (e.g. drawn or previously processed)
    if (isAlreadyTransparent) {
      if (a < 18) {
        if (effectiveBgMode === "white") {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else if (effectiveBgMode === "transparent") {
          data[i + 3] = 0;
        }
        continue;
      }

      let alpha = a;
      if (strokeBoost > 0) {
        alpha = Math.min(255, Math.round(alpha * (1 + strokeBoost * 0.25)));
      }

      if (effectiveBgMode === "white") {
        const factor = alpha / 255;
        if (isColorRemoveActive) {
          const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
          const strokeShade = Math.round(lum * 0.5);
          data[i] = Math.round(255 * (1 - factor) + strokeShade * factor);
          data[i + 1] = Math.round(255 * (1 - factor) + strokeShade * factor);
          data[i + 2] = Math.round(255 * (1 - factor) + strokeShade * factor);
        } else if (inkColor !== "original") {
          data[i] = Math.round(255 * (1 - factor) + targetRgb.r * factor);
          data[i + 1] = Math.round(255 * (1 - factor) + targetRgb.g * factor);
          data[i + 2] = Math.round(255 * (1 - factor) + targetRgb.b * factor);
        }
        data[i + 3] = 255;
      } else {
        data[i + 3] = alpha;
        if (isColorRemoveActive) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        } else if (inkColor !== "original") {
          data[i] = targetRgb.r;
          data[i + 1] = targetRgb.g;
          data[i + 2] = targetRgb.b;
        }
      }

      if (invert) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      continue;
    }

    // CASE 2: Paper photo or scan with background
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (r * 77 + g * 150 + b * 29) >> 8;

    if (lum >= paperThreshold) {
      if (effectiveBgMode === "transparent") {
        data[i + 3] = 0;
      } else if (effectiveBgMode === "white") {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    } else {
      const strokeDiff = paperThreshold - lum;
      const alpha = alphaLookup[strokeDiff];

      if (alpha < 14) {
        if (effectiveBgMode === "transparent") {
          data[i + 3] = 0;
        } else if (effectiveBgMode === "white") {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
        continue;
      }

      let strokeR = targetRgb.r;
      let strokeG = targetRgb.g;
      let strokeB = targetRgb.b;

      if (isColorRemoveActive) {
        strokeR = 0;
        strokeG = 0;
        strokeB = 0;
      } else if (inkColor === "original") {
        const gray = (r * 77 + g * 150 + b * 29) >> 8;
        const sat = 1.35;
        let nr = Math.max(0, Math.min(255, Math.round(gray + (r - gray) * sat)));
        let ng = Math.max(0, Math.min(255, Math.round(gray + (g - gray) * sat)));
        let nb = Math.max(0, Math.min(255, Math.round(gray + (b - gray) * sat)));
        const darken = Math.max(0.3, Math.min(0.85, 1 - strokeDiff / paperThreshold));
        strokeR = Math.round(nr * darken);
        strokeG = Math.round(ng * darken);
        strokeB = Math.round(nb * darken);
      }

      if (effectiveBgMode === "transparent") {
        data[i] = strokeR;
        data[i + 1] = strokeG;
        data[i + 2] = strokeB;
        data[i + 3] = alpha;
      } else if (effectiveBgMode === "white") {
        const factor = alpha / 255;
        data[i] = Math.round(255 * (1 - factor) + strokeR * factor);
        data[i + 1] = Math.round(255 * (1 - factor) + strokeG * factor);
        data[i + 2] = Math.round(255 * (1 - factor) + strokeB * factor);
        data[i + 3] = 255;
      } else {
        if (isColorRemoveActive) {
          data[i] = lum;
          data[i + 1] = lum;
          data[i + 2] = lum;
        } else if (inkColor !== "original") {
          const factor = (paperThreshold - lum) / paperThreshold;
          data[i] = Math.round(r * (1 - factor) + strokeR * factor);
          data[i + 1] = Math.round(g * (1 - factor) + strokeG * factor);
          data[i + 2] = Math.round(b * (1 - factor) + strokeB * factor);
        }
      }

      if (invert) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    }
  }

  // Clean paper noise and speckles if transparent
  if (despeckle && effectiveBgMode === "transparent") {
    applyDespeckle(data, cw, ch);
  }

  cropCtx.putImageData(imgData, 0, 0);

  // Auto-trim transparent padding if requested
  if (autoTrim && effectiveBgMode === "transparent") {
    const trimmed = trimCanvasTransparency(cropCanvas, 14);
    return trimmed.toDataURL("image/png");
  }

  return cropCanvas.toDataURL("image/png");
}

/**
 * Quick 1-click helper to remove background from any signature image
 * @param {File | Blob | string} imageSource
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function removeSignatureBackground(imageSource, options = {}) {
  return processSignature({
    imageSource,
    removeBackground: true,
    backgroundMode: "transparent",
    thresholdOffset: options.thresholdOffset || 0,
    inkColor: options.inkColor || "blue",
    removeColor: options.removeColor || false,
    strokeBoost: options.strokeBoost || 0,
    despeckle: true,
    ...options,
  });
}

/**
 * Backward compatibility wrapper
 */
export async function convertPaperSignatureToDigital(imageSource, options = {}) {
  const {
    enhanceInk = true,
    inkColor = "original",
  } = options;

  return processSignature({
    imageSource,
    rotation: 0,
    thresholdOffset: 0,
    inkColor,
    enhanceInk,
    removeBackground: true,
    backgroundMode: "transparent",
  });
}

/**
 * 8 Elegant Google Fonts for Cursive Doctor Signatures
 */
export const SIGNATURE_FONTS = [
  { id: "dancing", name: "Dancing Script", font: "'Dancing Script', cursive", preview: "Dr. Signature" },
  { id: "great-vibes", name: "Great Vibes", font: "'Great Vibes', cursive", preview: "Dr. Signature" },
  { id: "alex-brush", name: "Alex Brush", font: "'Alex Brush', cursive", preview: "Dr. Signature" },
  { id: "parisienne", name: "Parisienne", font: "'Parisienne', cursive", preview: "Dr. Signature" },
  { id: "allura", name: "Allura", font: "'Allura', cursive", preview: "Dr. Signature" },
  { id: "caveat", name: "Caveat", font: "'Caveat', cursive", preview: "Dr. Signature" },
  { id: "marck", name: "Marck Script", font: "'Marck Script', cursive", preview: "Dr. Signature" },
  { id: "sacramento", name: "Sacramento", font: "'Sacramento', cursive", preview: "Dr. Signature" },
];

/**
 * Clinical Ink Colors with Color Removal & Original Color support
 */
export const SIGNATURE_COLORS = [
  { id: "monochrome", name: "Pure Black (Color Removed)", hex: "#000000", isColorRemove: true, desc: "Stripped color, pure 100% black ink" },
  { id: "dark", name: "Executive Dark Slate", hex: "#0f172a", desc: "Charcoal executive dark tone" },
  { id: "blue", name: "DocuSign Royal Blue", hex: "#1034a6", desc: "DocuSign / prescription royal blue" },
  { id: "navy", name: "Deep Navy Blue", hex: "#183a78", desc: "Deep formal clinic navy" },
  { id: "emerald", name: "Clinical Forest Green", hex: "#047857", desc: "Veterinary clinical green" },
  { id: "maroon", name: "Official Seal Red", hex: "#b91c1c", desc: "Medical seal red" },
  { id: "original", name: "Original Pen Color", hex: null, isOriginal: true, desc: "Preserve authentic pen color" },
  { id: "custom", name: "Custom Ink Color", hex: null, isCustom: true, desc: "Choose custom hex color" },
];

/**
 * Downloads a signature PNG data URL directly to local storage
 */
export function downloadSignaturePng(dataUrl, filename = "doctor_signature.png") {
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trims blank transparent padding around any HTMLCanvasElement
 */
export function trimCanvasTransparency(sourceCanvas, padding = 16) {
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 15) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) {
    return sourceCanvas;
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(w - cropX, maxX - minX + padding * 2);
  const cropH = Math.min(h - cropY, maxY - minY + padding * 2);

  const trimmed = document.createElement("canvas");
  trimmed.width = Math.max(10, cropW);
  trimmed.height = Math.max(10, cropH);
  const tCtx = trimmed.getContext("2d");
  tCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return trimmed;
}

/**
 * Generates an ultra-crisp transparent or white PNG from typed text with a cursive font
 */
export function generateTypedSignature(
  text,
  fontCss = "'Dancing Script', cursive",
  colorHex = "#1034a6",
  slant = false,
  backgroundMode = "transparent"
) {
  if (!text || !text.trim()) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 360;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colorHex || "#000000";
  ctx.font = `${slant ? "italic " : ""}72px ${fontCss}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text.trim(), canvas.width / 2, canvas.height / 2);

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
}


