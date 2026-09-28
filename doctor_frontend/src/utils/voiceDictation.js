/**
 * Voice Dictation & Speech-to-Text Utility for Telehealth Consultations
 * Supports live examination notes dictation and smart veterinary medicine speech parsing.
 */

export const isSpeechRecognitionSupported = () => {
  return typeof window !== "undefined" && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
};

/**
 * Common veterinary medications for quick suggestions and voice matching
 */
export const COMMON_VET_MEDICINES = [
  { name: "Cefpet (Cefpodoxime)", dosage: "100mg", frequency: "Twice daily after food", duration: "7 days" },
  { name: "Apoquel (Oclacitinib)", dosage: "5.4mg", frequency: "Once daily morning", duration: "10 days" },
  { name: "Meloxicam (Melonex)", dosage: "1.5mg", frequency: "Once daily with food", duration: "5 days" },
  { name: "Amoxiclav (Augmentin)", dosage: "250mg", frequency: "Twice daily", duration: "7 days" },
  { name: "Metronidazole (Metrogyl)", dosage: "200mg", frequency: "Twice daily after food", duration: "5 days" },
  { name: "Prednisolone", dosage: "5mg", frequency: "Once daily morning", duration: "5 days" },
  { name: "NexGard Spectra", dosage: "1 Chewable Tab", frequency: "Once monthly", duration: "1 month" },
];

/**
 * Intelligent parser that extracts medicine name, dosage, frequency, and duration
 * from natural spoken English phrases.
 * Example input: "Add Cefpet 100 milligrams twice daily for 7 days"
 * Output: { name: "Cefpet", dosage: "100mg", frequency: "Twice daily", duration: "7 days" }
 */
export function parseMedicineVoice(text) {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim();
  // Strip introductory prefixes e.g. "add", "prescribe", "give", "please add"
  cleaned = cleaned.replace(/^(please\s+)?(add|prescribe|give|recommend|write|insert)\s+/i, "");

  // 1. Extract Duration: e.g. "for 7 days", "10 days", "2 weeks", "for one week"
  let duration = "";
  const durationMatch = cleaned.match(/(?:for\s+)?(\d+\s*(?:days?|weeks?|months?))/i);
  if (durationMatch) {
    duration = durationMatch[1].trim();
    cleaned = cleaned.replace(durationMatch[0], " ").trim();
  } else {
    const textDurationMatch = cleaned.match(/(?:for\s+)?(one|two|three|four|five|six|seven|ten|fourteen)\s*(days?|weeks?)/i);
    if (textDurationMatch) {
      const numMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14 };
      const n = numMap[textDurationMatch[1].toLowerCase()] || textDurationMatch[1];
      duration = `${n} ${textDurationMatch[2]}`;
      cleaned = cleaned.replace(textDurationMatch[0], " ").trim();
    }
  }

  // 2. Extract Frequency: e.g. "twice daily", "once daily", "three times a day", "after food", "every 12 hours"
  let frequency = "";
  const freqRegex = /(once daily(?:\s*(?:morning|evening|night))?|twice daily(?:\s*after food)?|three times (?:a |per )?day|thrice daily|every (?:8|12|24) hours|after food|before food|with food|at bedtime|once a day|twice a day|as needed|sos)/i;
  const freqMatch = cleaned.match(freqRegex);
  if (freqMatch) {
    frequency = freqMatch[0].trim();
    frequency = frequency.charAt(0).toUpperCase() + frequency.slice(1);
    cleaned = cleaned.replace(freqMatch[0], " ").trim();
  }

  // 3. Extract Dosage: e.g. "100mg", "100 mg", "5.4mg", "250 milligrams", "5ml", "1 tablet", "2 drops", "10 ml"
  let dosage = "";
  const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|milligrams?|ml|milliliters?|mcg|micrograms?|g|grams?|tablets?|capsules?|drops?|pills?)/i;
  const dosageMatch = cleaned.match(dosageRegex);
  if (dosageMatch) {
    let unit = dosageMatch[2].toLowerCase();
    if (unit.startsWith("milligram")) unit = "mg";
    else if (unit.startsWith("milliliter")) unit = "ml";
    else if (unit.startsWith("microgram")) unit = "mcg";
    else if (unit.startsWith("gram")) unit = "g";
    else if (unit.startsWith("tablet")) unit = "tablet";
    else if (unit.startsWith("capsule")) unit = "cap";
    else if (unit.startsWith("drop")) unit = "drops";

    dosage = `${dosageMatch[1]}${unit}`;
    cleaned = cleaned.replace(dosageMatch[0], " ").trim();
  }

  // 4. Whatever remains is the Medicine Name
  let name = cleaned.replace(/\b(for|and|with)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (name) {
    name = name
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return {
    name: name || "Medicine",
    dosage: dosage || "100mg",
    frequency: frequency || "Twice daily",
    duration: duration || "5 days",
    raw: text,
  };
}

/**
 * Format spoken examination notes, converting vocal punctuation into symbols
 * and cleanly appending new sentences.
 */
export function formatSpokenNotes(currentText, newTranscript) {
  let text = newTranscript || "";
  text = text
    .replace(/\b(period|full stop)\b/gi, ".")
    .replace(/\bcomma\b/gi, ",")
    .replace(/\b(question mark)\b/gi, "?")
    .replace(/\b(exclamation mark|exclamation point)\b/gi, "!")
    .replace(/\b(new line|next line)\b/gi, "\n")
    .replace(/\b(new paragraph)\b/gi, "\n\n");

  // Capitalize sentence beginnings
  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

  if (!currentText || !currentText.trim()) {
    return text.trim();
  }
  const trimmedCurrent = currentText.trimEnd();
  const separator = /[\n]$/.test(trimmedCurrent) ? "" : " ";
  return `${trimmedCurrent}${separator}${text.trim()}`;
}

/**
 * Initialize SpeechRecognition controller
 */
export function createSpeechRecognizer({
  onStart,
  onResult,
  onInterim,
  onEnd,
  onError,
  lang = "en-US",
  continuous = true,
  interimResults = true,
}) {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = lang || navigator.language || "en-US";
  recognition.continuous = continuous;
  recognition.interimResults = interimResults;
  recognition.maxAlternatives = 1;

  if (onStart) recognition.onstart = onStart;
  if (onError) recognition.onerror = onError;

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";

    for (let i = 0; i < event.results.length; i++) {
      const item = event.results[i];
      if (item.isFinal) {
        final += item[0].transcript + " ";
      } else {
        interim += item[0].transcript;
      }
    }

    if (onInterim && interim) onInterim(interim.trim());
    if (onResult) onResult({ final: final.trim(), interim: interim.trim(), full: (final + interim).trim() });
  };

  if (onEnd) recognition.onend = onEnd;

  return recognition;
}
