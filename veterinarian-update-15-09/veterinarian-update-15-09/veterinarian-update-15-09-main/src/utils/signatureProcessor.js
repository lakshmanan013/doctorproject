/**
 * Signature Processor Utility
 * High-performance browser-based computer vision pipeline for
 * paper-to-digital signature extraction, auto-detection, cropping,
 * rotation, shadow removal, and ink enhancement.
 */

/**
 * Loads an image from a File, Blob, or URL string into an HTMLImageElement
 * @param {File | Blob | string} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error("No image source provided"));
      return;
    }
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
 * Creates a canvas with the image transformed by rotation and flipping.
 * @param {HTMLImageElement} img
 * @param {number} rotation - Rotation in degrees (e.g. 0, 90, 180, 270, plus fine angle)
 * @param {boolean} flipH - Horizontal flip
 * @param {boolean} flipV - Vertical flip
 * @param {number} maxDimension - Max dimension for speed and performance
 * @returns {HTMLCanvasElement}
 */
export function createTransformedCanvas(img, rotation = 0, flipH = false, flipV = false, maxDimension = 1400) {
  let origW = img.naturalWidth || img.width;
  let origH = img.naturalHeight || img.height;

  // Scale down if exceptionally large for fast interactive processing
  let scale = 1;
  if (origW > maxDimension || origH > maxDimension) {
    scale = maxDimension / Math.max(origW, origH);
  }
  const drawW = Math.round(origW * scale);
  const drawH = Math.round(origH * scale);

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const boundW = Math.round(drawW * cos + drawH * sin);
  const boundH = Math.round(drawW * sin + drawH * cos);

  const canvas = document.createElement("canvas");
  canvas.width = boundW;
  canvas.height = boundH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Center coordinate
  ctx.translate(boundW / 2, boundH / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  return canvas;
}

/**
 * Analyzes pixel luminance histogram and calculates the dynamic paper threshold.
 * Handles uneven phone shadows by using the 85th percentile background luminance.
 * @param {Uint8ClampedArray} data - RGBA pixel array
 * @param {number} totalPixels
 * @param {number} thresholdOffset - user sensitivity offset (-50 to +50)
 * @returns {{ paperLum: number, paperThreshold: number }}
 */
export function calculatePaperThreshold(data, totalPixels, thresholdOffset = 0) {
  const hist = new Uint32Array(256);
  let opaqueCount = 0;
  let transparentCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 35) {
      transparentCount++;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[lum]++;
    opaqueCount++;
  }

  // Check if image is already a transparent digital signature
  const isAlreadyTransparent = transparentCount > totalPixels * 0.05;

  if (isAlreadyTransparent || opaqueCount === 0) {
    return { paperLum: 255, paperThreshold: 255, isAlreadyTransparent: true };
  }

  let count = 0;
  const target85th = Math.floor(opaqueCount * 0.85);
  let paperLum = 220;
  for (let l = 0; l < 256; l++) {
    count += hist[l];
    if (count >= target85th) {
      paperLum = Math.max(150, l);
      break;
    }
  }

  // Base threshold is 88% of paper brightness + user offset
  const baseThreshold = Math.round(paperLum * 0.88);
  const paperThreshold = Math.max(110, Math.min(250, baseThreshold + thresholdOffset));

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
 * Full Pipeline: Converts paper signature into a transparent digital signature with
 * custom rotation, cropping, thresholding, and ink styling.
 *
 * @param {Object} params
 * @param {File | Blob | string} params.imageSource - Original file or data URL
 * @param {number} [params.rotation=0] - Total rotation in degrees
 * @param {boolean} [params.flipH=false] - Horizontal flip
 * @param {boolean} [params.flipV=false] - Vertical flip
 * @param {Object|null} [params.cropRect=null] - { x, y, width, height } in transformed canvas coordinates
 * @param {number} [params.thresholdOffset=0] - Threshold offset for shadow cleaning (-50 to +50)
 * @param {string} [params.inkColor="blue"] - "blue" | "dark" | "navy" | "original"
 * @param {boolean} [params.enhanceInk=true] - Boost digital contrast
 * @param {number} [params.strokeBoost=0] - Thickness/fullness boost (0 to 3)
 * @returns {Promise<string>} - Resolves with transparent PNG Base64 data URL
 */
export async function processSignature({
  imageSource,
  rotation = 0,
  flipH = false,
  flipV = false,
  cropRect = null,
  thresholdOffset = 0,
  inkColor = "blue",
  enhanceInk = true,
  strokeBoost = 0,
}) {
  const img = await loadImage(imageSource);
  const fullCanvas = createTransformedCanvas(img, rotation, flipH, flipV);

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

  // Target ink RGB presets
  const inkColors = {
    blue: { r: 16, g: 52, b: 166 },      // DocuSign / Medical Rx Royal Blue
    navy: { r: 24, g: 58, b: 120 },      // Deep Navy Blue
    dark: { r: 15, g: 23, b: 42 },       // Executive Dark Slate / Black
  };

  const selectedInk = inkColors[inkColor] || inkColors.blue;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];

    if (isAlreadyTransparent) {
      if (a < 18) {
        data[i + 3] = 0;
        continue;
      }

      let alpha = a;
      if (strokeBoost > 0) {
        alpha = Math.min(255, Math.round(alpha * (1 + strokeBoost * 0.25)));
      }
      data[i + 3] = alpha;

      if (enhanceInk) {
        if (inkColor !== "original") {
          data[i] = selectedInk.r;
          data[i + 1] = selectedInk.g;
          data[i + 2] = selectedInk.b;
        }
      }
      continue;
    }

    if (a < 30) {
      data[i + 3] = 0;
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum >= paperThreshold) {
      // Paper background -> 100% transparent
      data[i + 3] = 0;
    } else {
      // Ink stroke pixel
      const strokeDiff = paperThreshold - lum;
      // Non-linear power curve for crisp anti-aliased edge smoothing
      let alpha = Math.min(
        255,
        Math.round(Math.pow(strokeDiff / (paperThreshold * 0.55), 0.72) * 255)
      );

      if (strokeBoost > 0) {
        alpha = Math.min(255, Math.round(alpha * (1 + strokeBoost * 0.25)));
      }

      if (alpha < 18) {
        data[i + 3] = 0;
        continue;
      }

      data[i + 3] = alpha;

      if (enhanceInk) {
        if (inkColor === "original") {
          // Boost original contrast while preserving tone
          const isBlueInk = b > r + 8 && b > g + 4;
          if (isBlueInk) {
            data[i] = Math.max(0, r - 30);
            data[i + 1] = Math.max(0, g - 20);
            data[i + 2] = Math.min(255, b + 20);
          } else {
            // Darken dark ink
            data[i] = Math.max(10, Math.round(r * 0.4));
            data[i + 1] = Math.max(10, Math.round(g * 0.4));
            data[i + 2] = Math.max(15, Math.round(b * 0.4));
          }
        } else {
          // Apply digital ink color preset
          data[i] = selectedInk.r;
          data[i + 1] = selectedInk.g;
          data[i + 2] = selectedInk.b;
        }
      }
    }
  }

  cropCtx.putImageData(imgData, 0, 0);

  // Return crisp transparent PNG
  return cropCanvas.toDataURL("image/png");
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
  });
}
