import React, { useEffect, useState, useRef } from "react";

/**
 * AnimatedCounter
 * Smoothly animates numbers from 0 to their target value on page/dashboard load.
 * Supports numbers, currencies (₹, $), percentages (%), and formatted strings.
 */
export default function AnimatedCounter({
  value,
  duration = 1200,
  delay = 50,
  decimals = null,
  prefix = "",
  suffix = "",
  className = "",
}) {
  // Parse target from incoming value
  const parsed = parseValue(value, prefix, suffix, decimals);
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!parsed.isNumeric) {
      return;
    }

    const startVal = 0;
    const targetVal = parsed.targetNumber;

    let timeoutId;
    timeoutId = setTimeout(() => {
      const animate = (timestamp) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

        // Ease out expo for natural deceleration
        const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = startVal + (targetVal - startVal) * easeOut;

        setDisplayValue(current);

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(targetVal);
        }
      };

      startTimeRef.current = null;
      animRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [parsed.targetNumber, parsed.isNumeric, duration, delay]);

  if (!parsed.isNumeric) {
    return <span className={`animated-counter ${className}`.trim()}>{value ?? "—"}</span>;
  }

  // Format the intermediate/final numeric value
  const formattedNumber = formatOutput(
    displayValue,
    parsed.decimalPlaces,
    parsed.hasRupee
  );

  return (
    <span className={`animated-counter ${className}`.trim()}>
      {parsed.prefix}
      {formattedNumber}
      {parsed.suffix}
    </span>
  );
}

/**
 * Parses any incoming number or formatted string (e.g. "₹12,450", "48", "80%")
 */
function parseValue(val, overridePrefix, overrideSuffix, overrideDecimals) {
  if (val === null || val === undefined || val === "") {
    return { isNumeric: false };
  }

  if (typeof val === "number") {
    if (Number.isNaN(val)) return { isNumeric: false };
    const dec = overrideDecimals !== null ? overrideDecimals : val % 1 === 0 ? 0 : 2;
    return {
      isNumeric: true,
      targetNumber: val,
      prefix: overridePrefix || "",
      suffix: overrideSuffix || "",
      hasRupee: Boolean(overridePrefix && overridePrefix.includes("₹")),
      decimalPlaces: dec,
    };
  }

  const str = String(val).trim();
  const hasRupee = str.includes("₹") || (overridePrefix && overridePrefix.includes("₹"));

  // Check prefix
  let extractedPrefix = overridePrefix || "";
  let extractedSuffix = overrideSuffix || "";
  let cleanStr = str;

  if (!extractedPrefix) {
    if (cleanStr.startsWith("₹")) {
      extractedPrefix = "₹";
      cleanStr = cleanStr.slice(1).trim();
    } else if (cleanStr.startsWith("$")) {
      extractedPrefix = "$";
      cleanStr = cleanStr.slice(1).trim();
    }
  } else if (cleanStr.startsWith(extractedPrefix)) {
    cleanStr = cleanStr.slice(extractedPrefix.length).trim();
  }

  // Check suffix
  if (!extractedSuffix) {
    if (cleanStr.endsWith("%")) {
      extractedSuffix = "%";
      cleanStr = cleanStr.slice(0, -1).trim();
    } else if (cleanStr.endsWith("+")) {
      extractedSuffix = "+";
      cleanStr = cleanStr.slice(0, -1).trim();
    }
  } else if (cleanStr.endsWith(extractedSuffix)) {
    cleanStr = cleanStr.slice(0, -extractedSuffix.length).trim();
  }

  // Remove thousand separators
  const sanitized = cleanStr.replace(/,/g, "");
  const num = parseFloat(sanitized);

  if (Number.isNaN(num)) {
    return { isNumeric: false };
  }

  let dec = 0;
  if (overrideDecimals !== null) {
    dec = overrideDecimals;
  } else if (sanitized.includes(".")) {
    dec = sanitized.split(".")[1].length;
  }

  return {
    isNumeric: true,
    targetNumber: num,
    prefix: extractedPrefix,
    suffix: extractedSuffix,
    hasRupee,
    decimalPlaces: dec,
  };
}

/**
 * Formats numbers with appropriate locale separation (Indian locale for ₹)
 */
function formatOutput(num, decimals, hasRupee) {
  if (decimals > 0) {
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const intNum = parseInt(intPart, 10);
    const formattedInt = hasRupee
      ? intNum.toLocaleString("en-IN")
      : intNum.toLocaleString();
    return `${formattedInt}.${decPart}`;
  }

  const rounded = Math.round(num);
  return hasRupee
    ? rounded.toLocaleString("en-IN")
    : rounded.toLocaleString();
}

