/**
 * Signature Processor Utility
 * Converts photos/scans of handwritten signatures on paper into
 * crisp, transparent digital signatures.
 */

/**
 * Converts a signature image on paper into a transparent digital signature.
 * @param {File | Blob | string} imageSource - File object or image data URL
 * @param {Object} options
 * @param {boolean} options.enhanceInk - Whether to boost ink contrast and color
 * @param {string} options.inkColor - "original" | "blue" | "dark"
 * @returns {Promise<string>} - Resolves with transparent PNG Base64 data URL
 */
export async function convertPaperSignatureToDigital(imageSource, options = {}) {
  const {
    enhanceInk = true,
    inkColor = "original", // "original" | "blue" | "dark"
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const result = processSignatureImage(img, { enhanceInk, inkColor });
        resolve(result);
      } catch (err) {
        console.error("Signature processing error:", err);
        // Fallback to original image if processing fails
        resolve(img.src);
      }
    };

    img.onerror = (err) => {
      console.error("Failed to load image for signature processing:", err);
      reject(err);
    };

    if (typeof imageSource === "string") {
      img.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    } else {
      reject(new Error("Invalid image source provided"));
    }
  });
}

function processSignatureImage(img, { enhanceInk, inkColor }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Optimal max dimension for processing speed and crisp quality
  const maxDim = 1200;
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

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
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // 1. Calculate luminance histogram to determine paper background brightness level
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[lum]++;
  }

  // Find 85th percentile luminance representing the white paper background
  let count = 0;
  const target85th = Math.floor(totalPixels * 0.85);
  let paperLum = 220;
  for (let l = 0; l < 256; l++) {
    count += hist[l];
    if (count >= target85th) {
      paperLum = Math.max(170, l);
      break;
    }
  }

  // Dynamic threshold for white paper vs pen ink
  const paperThreshold = Math.max(140, Math.round(paperLum * 0.88));

  // Bounds for auto-cropping ink strokes
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let inkCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum >= paperThreshold) {
      // Paper background -> 100% transparent
      data[i + 3] = 0;
    } else {
      // Ink stroke detected
      const strokeDiff = paperThreshold - lum;
      // Smooth alpha with antialiased curve
      const alpha = Math.min(255, Math.round(Math.pow(strokeDiff / (paperThreshold * 0.6), 0.75) * 255));

      if (alpha > 25) {
        inkCount++;
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      data[i + 3] = alpha;

      if (enhanceInk) {
        const isBlueInk = b > r + 8 && b > g + 4;

        if (inkColor === "blue" || (inkColor === "original" && isBlueInk)) {
          // Digital Royal Blue Ink (DocuSign / Medical Rx Style)
          data[i] = 16;     // R
          data[i + 1] = 52;  // G
          data[i + 2] = 166; // B
        } else {
          // Digital Deep Executive Charcoal / Slate Ink
          data[i] = 15;     // R
          data[i + 1] = 23;  // G
          data[i + 2] = 42;  // B
        }
      }
    }
  }

  // If no ink was detected or bounding box invalid, return original canvas
  if (inkCount < 10 || maxX <= minX || maxY <= minY) {
    return canvas.toDataURL("image/png");
  }

  // 2. Put processed image data back
  ctx.putImageData(imgData, 0, 0);

  // 3. Auto-crop tightly around signature bounding box with slight margin
  const padding = 16;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;

  const croppedCtx = croppedCanvas.getContext("2d");
  croppedCtx.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  return croppedCanvas.toDataURL("image/png");
}
