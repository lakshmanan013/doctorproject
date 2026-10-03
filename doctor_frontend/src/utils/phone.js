// Phone formatting helper for standard E.164 format: a leading "+", country code, then
// the subscriber number.

// This mirrors the assumption already used for WhatsApp (utils/whatsapp.js):
// a bare 10-digit number is treated as domestic and gets +91 prefixed;
// anything that already looks like it has a country code (11+ digits) or a
// leading "+" is left alone.
const DEFAULT_COUNTRY_CODE = "91";

export function toE164(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  const withCountryCode = digits.length === 10 ? DEFAULT_COUNTRY_CODE + digits : digits;
  return `+${withCountryCode}`;
}
