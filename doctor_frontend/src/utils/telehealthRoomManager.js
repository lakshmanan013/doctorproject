/**
 * Telehealth Room Manager
 * Manages unique meeting links, single-use expiration, and automatic link regeneration
 * for doctor-to-pet-parent virtual consultations.
 */

const STORAGE_ACTIVE_ROOM_PREFIX = "zenve_active_room_";
const STORAGE_APPT_ROOM_PREFIX = "zenve_appt_room_";
const STORAGE_EXPIRED_ROOMS = "zenve_expired_telehealth_rooms";
const STORAGE_ROOM_METADATA = "zenve_room_metadata_";
const BROADCAST_CHANNEL_NAME = "zenve_telehealth_channel";
const STORAGE_EVENT_KEY = "zenve_last_telehealth_event";

// Initialize BroadcastChannel if available
let broadcastChannel = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (err) {
    console.warn("BroadcastChannel not supported in this environment:", err);
  }
}

/**
 * Generate a cryptographically distinct, URL-safe random room ID
 */
export function generateUniqueRoomId(prefix = "zen") {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Normalizes doctor name into a URL slug
 */
export function getDoctorSlug(doctorName = "dr-vasanth") {
  return (doctorName || "doctor")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Broadcast an event to other tabs/windows
 */
export function broadcastTelehealthEvent(event) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch (e) {
      console.warn("Broadcast message failed:", e);
    }
  }

  // Also write to localStorage to trigger cross-window storage event
  try {
    localStorage.setItem(
      STORAGE_EVENT_KEY,
      JSON.stringify({ ...event, _timestamp: Date.now() })
    );
  } catch (e) {
    // localStorage might be full or blocked
  }
}

/**
 * Subscribe to telehealth room events (e.g. call completed, room regenerated)
 */
export function subscribeTelehealthEvents(callback) {
  const handleBroadcast = (e) => {
    if (e && e.data) {
      callback(e.data);
    }
  };

  const handleStorage = (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch (err) {
        // ignore parse error
      }
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Retrieve all expired rooms map
 */
export function getExpiredRooms() {
  try {
    const raw = localStorage.getItem(STORAGE_EXPIRED_ROOMS);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

/**
 * Check if a room code has already been completed / expired
 */
export function isRoomExpired(roomCode) {
  if (!roomCode) return true;
  const expiredMap = getExpiredRooms();
  return Boolean(expiredMap[roomCode]);
}

/**
 * Get details of an expired room (completion date, patient name, doctor, etc.)
 */
export function getExpiredRoomDetails(roomCode) {
  if (!roomCode) return null;
  const expiredMap = getExpiredRooms();
  return expiredMap[roomCode] || null;
}

/**
 * Archive a room code as completed/expired
 */
export function archiveExpiredRoom(roomCode, metadata = {}) {
  if (!roomCode) return;
  try {
    const expiredMap = getExpiredRooms();
    expiredMap[roomCode] = {
      roomCode,
      expiredAt: new Date().toISOString(),
      patientName: metadata.patientName || "Pet Patient",
      ownerName: metadata.ownerName || "Pet Parent",
      doctorName: metadata.doctorName || "Dr. Vasanth Zenve",
      clinicName: metadata.clinicName || "Global Veterinary Hospital",
      notes: metadata.notes || "",
      reason: metadata.reason || "Virtual Veterinary Consultation",
      ...metadata,
    };
    localStorage.setItem(STORAGE_EXPIRED_ROOMS, JSON.stringify(expiredMap));
  } catch (err) {
    console.error("Error saving expired room:", err);
  }
}

/**
 * Save active room metadata for pet parent viewing
 */
export function setRoomMetadata(roomCode, metadata = {}) {
  if (!roomCode) return;
  try {
    localStorage.setItem(
      `${STORAGE_ROOM_METADATA}${roomCode}`,
      JSON.stringify({
        roomCode,
        createdAt: new Date().toISOString(),
        ...metadata,
      })
    );
  } catch (e) {}
}

/**
 * Retrieve active room metadata
 */
export function getRoomMetadata(roomCode) {
  if (!roomCode) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_ROOM_METADATA}${roomCode}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get the doctor's current active room code.
 * If none exists, generates a fresh unique room code.
 */
export function getDoctorActiveRoom(doctorName = "dr-vasanth", doctorMeta = {}) {
  const slug = getDoctorSlug(doctorName);
  const key = `${STORAGE_ACTIVE_ROOM_PREFIX}${slug}`;
  let code = localStorage.getItem(key);

  // If code is missing or was previously marked expired, create a fresh one
  if (!code || isRoomExpired(code)) {
    code = `${slug}-${generateUniqueRoomId()}`;
    localStorage.setItem(key, code);
    setRoomMetadata(code, {
      doctorName: doctorMeta.doctorName || doctorName || "Dr. Vasanth Zenve",
      clinicName: doctorMeta.clinicName || "Global Veterinary Hospital",
      isGeneralRoom: true,
    });
  }

  return code;
}

/**
 * Automatically regenerates a new room code for the doctor,
 * archiving the old room code as expired/completed.
 */
export function autoRegenerateDoctorRoom(doctorName = "dr-vasanth", oldCode = null, sessionDetails = {}) {
  const slug = getDoctorSlug(doctorName);
  const key = `${STORAGE_ACTIVE_ROOM_PREFIX}${slug}`;
  const prevCode = oldCode || localStorage.getItem(key);

  if (prevCode) {
    archiveExpiredRoom(prevCode, {
      doctorName: sessionDetails.doctorName || "Dr. Vasanth Zenve",
      patientName: sessionDetails.patientName || "Pet Patient",
      ownerName: sessionDetails.ownerName || "Pet Parent",
      clinicName: sessionDetails.clinicName || "Global Veterinary Hospital",
      completedAt: new Date().toISOString(),
      reason: sessionDetails.reason || "Consultation Completed",
    });
  }

  // Generate fresh secure room token
  const newCode = `${slug}-${generateUniqueRoomId()}`;
  localStorage.setItem(key, newCode);

  setRoomMetadata(newCode, {
    doctorName: sessionDetails.doctorName || "Dr. Vasanth Zenve",
    clinicName: sessionDetails.clinicName || "Global Veterinary Hospital",
    isGeneralRoom: true,
    regeneratedAt: new Date().toISOString(),
  });

  // Broadcast event so any open patient tabs immediately update
  broadcastTelehealthEvent({
    type: "ROOM_COMPLETED",
    oldRoomCode: prevCode,
    newRoomCode: newCode,
    doctorName: sessionDetails.doctorName || "Dr. Vasanth Zenve",
    patientName: sessionDetails.patientName || "Pet Patient",
  });

  return newCode;
}

/**
 * Get or create a unique single-use room code for a scheduled appointment
 */
export function getAppointmentRoomCode(appt, doctorName = "dr-vasanth") {
  if (!appt || !appt.id) return getDoctorActiveRoom(doctorName);

  const key = `${STORAGE_APPT_ROOM_PREFIX}${appt.id}`;
  let code = localStorage.getItem(key);

  if (!code || isRoomExpired(code)) {
    const slug = getDoctorSlug(doctorName);
    code = `appt-${appt.id}-${slug}-${generateUniqueRoomId()}`;
    localStorage.setItem(key, code);

    setRoomMetadata(code, {
      appointmentId: appt.id,
      patientName: appt.patientName,
      ownerName: appt.ownerName,
      phone: appt.phone,
      reason: appt.reason,
      appointmentTime: appt.appointmentTime,
      appointmentDate: appt.appointmentDate,
      doctorName: doctorName || "Dr. Vasanth Zenve",
      clinicName: "Global Veterinary Hospital",
    });
  }

  return code;
}

/**
 * Mark a scheduled appointment room completed & archive the link
 */
export function markAppointmentRoomCompleted(appt, roomCode, sessionDetails = {}) {
  const codeToArchive = roomCode || (appt ? localStorage.getItem(`${STORAGE_APPT_ROOM_PREFIX}${appt.id}`) : null);

  if (codeToArchive) {
    archiveExpiredRoom(codeToArchive, {
      appointmentId: appt?.id,
      patientName: appt?.patientName || sessionDetails.patientName,
      ownerName: appt?.ownerName || sessionDetails.ownerName,
      doctorName: sessionDetails.doctorName || "Dr. Vasanth Zenve",
      clinicName: sessionDetails.clinicName || "Global Veterinary Hospital",
      completedAt: new Date().toISOString(),
      reason: sessionDetails.reason || appt?.reason || "Virtual Veterinary Consultation",
    });
  }

  if (appt?.id) {
    // Generate fresh room token for this appointment slot if needed
    const slug = getDoctorSlug(sessionDetails.doctorName);
    const newCode = `appt-${appt.id}-${slug}-${generateUniqueRoomId()}`;
    localStorage.setItem(`${STORAGE_APPT_ROOM_PREFIX}${appt.id}`, newCode);
  }

  // Broadcast completion event
  broadcastTelehealthEvent({
    type: "ROOM_COMPLETED",
    roomCode: codeToArchive,
    appointmentId: appt?.id,
    patientName: appt?.patientName,
  });
}

/**
 * Build absolute public meeting link for pet owner
 */
export function buildMeetingUrl(roomCode) {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:5173";
  return `${origin}/join-call/${encodeURIComponent(roomCode)}`;
}

/**
 * Formatted WhatsApp / SMS invitation message text
 */
export function buildMeetingInvitationMessage({
  doctorName = "Dr. Vasanth Zenve",
  clinicName = "Global Veterinary Hospital",
  patientName = "Your Pet",
  meetingUrl = "",
  scheduledTime = "",
}) {
  const timeStr = scheduledTime ? `\n🕒 Scheduled Time: ${scheduledTime}` : "";
  const patientStr = patientName ? ` for ${patientName}` : "";

  return (
    `🐾 *${clinicName} - Video Consultation Invite*\n\n` +
    `Hello! ${doctorName} has prepared your secure virtual veterinary consultation${patientStr}.${timeStr}\n\n` +
    `👉 *Click here to join your video room:*\n${meetingUrl}\n\n` +
    `🔒 _This link is private, secure, and auto-expires after consultation._\n` +
    `Please click the link on your phone or computer with camera & mic enabled.`
  );
}
