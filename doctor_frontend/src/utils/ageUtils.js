/**
 * Pet Age Calculation and Formatting Utilities
 * Handles exact years and months (e.g. "2 yrs 4 mos", "4 mos", "< 1 mo")
 */

export function formatPetAge(dateOfBirth, shortForm = false) {
  if (!dateOfBirth) return "—";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "—";

  const now = new Date();
  if (dob > now) return shortForm ? "0m" : "0 mos";

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(years, 0);
  months = Math.max(months, 0);

  if (years === 0 && months === 0) {
    return shortForm ? "< 1m" : "< 1 mo";
  }

  if (shortForm) {
    if (years === 0) return `${months}m`;
    if (months === 0) return `${years}y`;
    return `${years}y ${months}m`;
  }

  const yStr = years > 0 ? `${years} ${years === 1 ? "yr" : "yrs"}` : "";
  const mStr = months > 0 ? `${months} ${months === 1 ? "mo" : "mos"}` : "";

  if (years > 0 && months > 0) {
    return `${yStr} ${mStr}`;
  }
  if (years > 0) {
    return yStr;
  }
  return mStr;
}

export function ageFromDob(dateOfBirth) {
  return formatPetAge(dateOfBirth, true);
}

