import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  Search,
  Plus,
  Sparkles,
  ExternalLink,
  Shield,
  FileText,
  Activity,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Radio,
  Sliders,
  Users,
  LayoutGrid,
} from "lucide-react";
import { FiVideo, FiPhone, FiCheck, FiX, FiCalendar } from "react-icons/fi";
import { FaPaw, FaStethoscope } from "react-icons/fa";
import toast from "react-hot-toast";

import {
  getAppointments,
  updateAppointment,
  deleteAppointment,
} from "../../services/appointmentService";
import {
  getDoctorProfile,
  updateDoctorProfile,
} from "../../services/doctorProfileService";
import { useAuth } from "../../hooks/useAuth";
import NewVisitModal from "../../components/modals/NewVisitModal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import {
  getDoctorActiveRoom,
  autoRegenerateDoctorRoom,
  getAppointmentRoomCode,
  markAppointmentRoomCompleted,
  buildMeetingUrl,
  buildMeetingInvitationMessage,
} from "../../utils/telehealthRoomManager";
import { TelehealthPeer } from "../../utils/telehealthWebRTC";
import {
  isSpeechRecognitionSupported,
  parseMedicineVoice,
  formatSpokenNotes,
  COMMON_VET_MEDICINES,
} from "../../utils/voiceDictation";
import "./VideoConsultation.css";

export default function VideoConsultation() {
  const navigate = useNavigate();
  const { doctor: authDoctor } = useAuth();

  // Doctor profile & status
  const [profile, setProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Appointments list & filters
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "today" | "upcoming" | "completed"
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Active Live Video Room State
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [consultNotes, setConsultNotes] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState("rx"); // "rx" | "vitals"
  const [webcamActive, setWebcamActive] = useState(false);
  const timerRef = useRef(null);
  const doctorVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteMediaStreamRef = useRef(null);
  const peerRef = useRef(null);

  // View layout: "faceToFace" (default open dual cameras) | "speaker" (spotlight + PIP)
  const [viewLayout, setViewLayout] = useState("faceToFace");
  const [remoteStreamConnected, setRemoteStreamConnected] = useState(false);

  // Doctor profile & active room token state
  const doctorName = profile?.fullName || authDoctor?.fullName || "Dr. Vasanth Zenve";
  const clinicName = profile?.clinicName || "Global Veterinary Hospital";

  const [generalRoomCode, setGeneralRoomCode] = useState(() =>
    getDoctorActiveRoom(doctorName, { doctorName, clinicName })
  );
  const [activeCallRoomCode, setActiveCallRoomCode] = useState(null);

  const meetingUrl = useMemo(
    () => buildMeetingUrl(generalRoomCode),
    [generalRoomCode]
  );

  // In-call prescription draft
  const [medicines, setMedicines] = useState([
    { name: "Cefpet (Cefpodoxime)", dosage: "100mg", frequency: "Twice daily after food", duration: "7 days" },
    { name: "Apoquel (Oclacitinib)", dosage: "5.4mg", frequency: "Once daily morning", duration: "10 days" },
  ]);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "",
    frequency: "Twice daily",
    duration: "5 days",
  });

  // Voice Dictation & Speech-to-Text States
  const [isNotesDictating, setIsNotesDictating] = useState(false);
  const [notesSpeechInterim, setNotesSpeechInterim] = useState("");
  const notesRecognitionRef = useRef(null);
  const shouldListenNotesRef = useRef(false);

  const [isMedVoiceListening, setIsMedVoiceListening] = useState(false);
  const [medVoiceInterim, setMedVoiceInterim] = useState("");
  const [medVoiceParsed, setMedVoiceParsed] = useState(null);
  const [activeVoiceField, setActiveVoiceField] = useState(null); // null | "name" | "dosage" | "duration"
  const medRecognitionRef = useRef(null);

  // Load doctor profile
  const fetchProfile = async () => {
    try {
      const data = await getDoctorProfile();
      if (data) {
        setProfile(data);
        setIsOnline(Boolean(data.videoConsultationEnabled));
      }
    } catch (err) {
      console.error("Error loading doctor profile:", err);
    }
  };

  // Load all appointments
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await getAppointments();
      const list = Array.isArray(data) ? data : [];
      setAppointments(list);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchAppointments();

    const handleProfileUpdate = () => fetchProfile();
    const handleAppointmentsUpdate = () => fetchAppointments();

    window.addEventListener("doctorProfileUpdated", handleProfileUpdate);
    window.addEventListener("appointmentsUpdated", handleAppointmentsUpdate);

    return () => {
      window.removeEventListener("doctorProfileUpdated", handleProfileUpdate);
      window.removeEventListener("appointmentsUpdated", handleAppointmentsUpdate);
      shouldListenNotesRef.current = false;
      try { notesRecognitionRef.current?.stop(); } catch { }
      try { medRecognitionRef.current?.stop(); } catch { }
    };
  }, []);

  // Timer for active call
  useEffect(() => {
    if (activeCall) {
      document.body.style.overflow = "hidden";
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      document.body.style.overflow = "";
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      document.body.style.overflow = "";
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall]);

  const formatCallTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Connect doctor camera when activeCall is present
  useEffect(() => {
    if (!activeCall) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setWebcamActive(false);
      return;
    }

    let isSubscribed = true;
    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
          if (!isSubscribed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          if (doctorVideoRef.current) {
            doctorVideoRef.current.srcObject = stream;
          }
          setWebcamActive(true);
        } catch (err) {
          console.warn("Doctor webcam not accessible or permission denied:", err);
          setWebcamActive(false);
        }
      }
    };

    startWebcam();

    return () => {
      isSubscribed = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setWebcamActive(false);
    };
  }, [activeCall]);

  useEffect(() => {
    if (doctorVideoRef.current && mediaStreamRef.current) {
      doctorVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isVideoOff, webcamActive, viewLayout]);

  // Connect WebRTC peer connection to pet parent live camera
  useEffect(() => {
    if (!activeCall || !mediaStreamRef.current) return;

    const roomId = activeCallRoomCode || generalRoomCode;
    peerRef.current = new TelehealthPeer({
      roomId,
      role: "doctor",
      localStream: mediaStreamRef.current,
      onRemoteStream: (stream) => {
        remoteMediaStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => { });
        }
        setRemoteStreamConnected(true);
        toast.success("Pet Parent live camera connected face-to-face!");
      },
      onConnectionStateChange: (state) => {
        if (state === "disconnected" || state === "failed" || state === "closed") {
          setRemoteStreamConnected(false);
        }
      },
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setRemoteStreamConnected(false);
    };
  }, [activeCall, activeCallRoomCode, generalRoomCode, webcamActive]);

  // Keep remote pet parent stream attached across layout toggles
  useEffect(() => {
    if (remoteVideoRef.current && remoteMediaStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteMediaStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteMediaStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => { });
    }
  }, [remoteStreamConnected, viewLayout]);

  const handleToggleMic = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    toast(next ? "Microphone Muted" : "Microphone Active", {
      icon: next ? "🔇" : "🎙️",
    });
  };

  const handleToggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    toast(next ? "Camera Turned Off" : "Camera Turned On", {
      icon: next ? "🚫" : "📷",
    });
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      toast("Screen sharing stopped", { icon: "🖥️" });
      return;
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        toast.success("Sharing screen with pet parent!");
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } catch {
        setIsScreenSharing(false);
      }
    } else {
      setIsScreenSharing(true);
      toast("Screen sharing active", { icon: "🖥️" });
    }
  };

  const handleAddMedicine = (e) => {
    e?.preventDefault();
    if (!newMed.name.trim()) return toast.error("Please enter a medicine name");
    setMedicines((prev) => [...prev, { ...newMed }]);
    setNewMed({ name: "", dosage: "", frequency: "Twice daily", duration: "5 days" });
    toast.success("Medicine added to prescription draft");
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------
  // Voice Dictation: Live Consultation Notes & Clinical Findings
  // -------------------------------------------------------------
  const handleToggleNotesDictation = () => {
    if (!isSpeechRecognitionSupported()) {
      toast.error("Speech Recognition is supported in Chrome, Edge & Safari. Please open in Google Chrome or Microsoft Edge.");
      return;
    }

    if (isNotesDictating) {
      shouldListenNotesRef.current = false;
      setIsNotesDictating(false);
      setNotesSpeechInterim("");
      try {
        notesRecognitionRef.current?.stop();
      } catch { }
      toast("Voice dictation stopped", { icon: "⏹️" });
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    shouldListenNotesRef.current = true;

    recognition.onstart = () => {
      setIsNotesDictating(true);
      setNotesSpeechInterim("");
      toast.success("Voice Dictation ON — Speak clinical findings!", { icon: "🎙️" });
    };

    recognition.onerror = (e) => {
      console.warn("[VoiceNotes] Speech error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access blocked. Click the browser settings icon to allow Microphone.");
        setIsNotesDictating(false);
        shouldListenNotesRef.current = false;
      } else if (e.error === "audio-capture") {
        toast.error("No microphone detected. Please check your mic connection.");
        setIsNotesDictating(false);
        shouldListenNotesRef.current = false;
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Speech recognition: ${e.error}`);
      }
    };

    recognition.onend = () => {
      if (shouldListenNotesRef.current) {
        try {
          recognition.start();
          return;
        } catch { }
      }
      setIsNotesDictating(false);
      setNotesSpeechInterim("");
      notesRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalChunk += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      setNotesSpeechInterim(interim.trim());

      if (finalChunk.trim()) {
        setConsultNotes((prev) => formatSpokenNotes(prev, finalChunk));
        setNotesSpeechInterim("");
      }
    };

    notesRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("[VoiceNotes] Start error:", err);
      toast.error("Could not start speech recognition");
    }
  };

  // -------------------------------------------------------------
  // Voice Medicine: Natural Speech Extraction for Prescriptions
  // -------------------------------------------------------------
  const handleToggleSmartMedVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      toast.error("Speech Recognition is supported in Chrome & Edge.");
      return;
    }

    if (isMedVoiceListening) {
      setIsMedVoiceListening(false);
      setMedVoiceInterim("");
      setMedVoiceParsed(null);
      try {
        medRecognitionRef.current?.stop();
      } catch { }
      toast("Voice medicine stopped", { icon: "⏹️" });
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsMedVoiceListening(true);
      setMedVoiceInterim("");
      setMedVoiceParsed(null);
      toast("Listening... Speak: 'Add Cefpet 100mg twice daily for 7 days'", { icon: "🎙️" });
    };

    recognition.onerror = (e) => {
      console.warn("[MedVoice] Error:", e.error);
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Voice error: ${e.error}`);
      }
      setIsMedVoiceListening(false);
      setMedVoiceInterim("");
    };

    recognition.onend = () => {
      setIsMedVoiceListening(false);
      medRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const text = (final || interim).trim();
      setMedVoiceInterim(text);

      if (text) {
        const parsed = parseMedicineVoice(text);
        if (parsed && parsed.name && parsed.name !== "Medicine") {
          setMedVoiceParsed(parsed);
          setNewMed({
            name: parsed.name,
            dosage: parsed.dosage,
            frequency: parsed.frequency,
            duration: parsed.duration,
          });
        }
      }

      if (final.trim()) {
        const parsed = parseMedicineVoice(final.trim());
        if (parsed && parsed.name && parsed.name !== "Medicine") {
          setMedicines((prev) => [...prev, parsed]);
          toast.success(`✓ Added ${parsed.name} (${parsed.dosage}, ${parsed.duration}) via Voice!`);
          setNewMed({ name: "", dosage: "", frequency: "Twice daily", duration: "5 days" });
          setMedVoiceParsed(null);
          setMedVoiceInterim("");
          setIsMedVoiceListening(false);
        }
      }
    };

    medRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("[MedVoice] Start error:", err);
      toast.error("Could not start microphone for medicine");
    }
  };

  const handleFieldVoiceDictate = (fieldName) => {
    if (!isSpeechRecognitionSupported()) {
      toast.error("Speech Recognition is supported in Chrome & Edge.");
      return;
    }

    if (activeVoiceField === fieldName) {
      setActiveVoiceField(null);
      try {
        medRecognitionRef.current?.stop();
      } catch { }
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setActiveVoiceField(fieldName);
      toast(`Speak ${fieldName}...`, { icon: "🎙️" });
    };

    recognition.onerror = () => {
      setActiveVoiceField(null);
    };

    recognition.onend = () => {
      setActiveVoiceField(null);
      medRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() || "";
      if (!text) return;

      if (fieldName === "name") {
        const cleanedName = text
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        setNewMed((prev) => ({ ...prev, name: cleanedName }));
        toast.success(`Medicine: "${cleanedName}"`);
      } else if (fieldName === "dosage") {
        setNewMed((prev) => ({ ...prev, dosage: text }));
        toast.success(`Dosage: "${text}"`);
      } else if (fieldName === "duration") {
        setNewMed((prev) => ({ ...prev, duration: text }));
        toast.success(`Duration: "${text}"`);
      }
      setActiveVoiceField(null);
    };

    medRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("[FieldVoice] Start error:", err);
    }
  };

  const handleConfirmVoiceMed = (parsed) => {
    if (!parsed || !parsed.name) return;
    setMedicines((prev) => [...prev, parsed]);
    toast.success(`✓ Added ${parsed.name} to Prescription!`);
    setNewMed({ name: "", dosage: "", frequency: "Twice daily", duration: "5 days" });
    setMedVoiceParsed(null);
    setMedVoiceInterim("");
    setIsMedVoiceListening(false);
  };

  const handleQuickMedSelect = (med) => {
    setMedicines((prev) => [...prev, med]);
    toast.success(`Added ${med.name} to Rx draft`);
  };

  // Toggle Video Consultation availability
  const handleToggleOnline = async () => {
    if (togglingStatus) return;
    const nextState = !isOnline;
    setIsOnline(nextState);
    setTogglingStatus(true);

    try {
      const updated = {
        ...(profile || {}),
        fullName: profile?.fullName || authDoctor?.fullName || "",
        videoConsultationEnabled: nextState,
      };
      await updateDoctorProfile(updated);
      setProfile(updated);
      window.dispatchEvent(new Event("doctorProfileUpdated"));
      if (nextState) {
        toast.success("Video Consultation mode ON. You are ready for live calls!");
      } else {
        toast("Video Consultation mode OFF. Status set to away.", { icon: "💤" });
      }
    } catch (err) {
      console.error("Failed to toggle online status:", err);
      setIsOnline(!nextState); // revert
      toast.error("Failed to update status. Please try again.");
    } finally {
      setTogglingStatus(false);
    }
  };

  // Sync room metadata when doctor profile loads
  useEffect(() => {
    if (profile?.fullName || authDoctor?.fullName) {
      const active = getDoctorActiveRoom(doctorName, { doctorName, clinicName });
      setGeneralRoomCode(active);
    }
  }, [profile?.fullName, authDoctor?.fullName, doctorName, clinicName]);

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(meetingUrl);
      setCopiedLink(true);
      toast.success("Telehealth meeting room link copied! Send to pet parent.");
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleRegenerateLink = () => {
    const newCode = autoRegenerateDoctorRoom(doctorName, generalRoomCode, {
      doctorName,
      clinicName,
      reason: "Manual link regeneration by doctor",
    });
    setGeneralRoomCode(newCode);
    toast.success("✨ New secure meeting room link generated! Previous link expired.");
  };

  const handleShareWhatsApp = (appt = null) => {
    const isAppt = Boolean(appt && appt.id);
    const code = isAppt ? getAppointmentRoomCode(appt, doctorName) : generalRoomCode;
    const url = buildMeetingUrl(code);
    const text = buildMeetingInvitationMessage({
      doctorName,
      clinicName,
      patientName: appt?.patientName || "Your Pet",
      scheduledTime: appt?.appointmentTime ? `${appt.appointmentTime} (${appt.appointmentDate || ""})` : "",
      meetingUrl: url,
    });

    const phoneDigits = (appt?.phone || "").replace(/[^0-9]/g, "");
    const waUrl = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const handleCopyApptLink = (appt) => {
    const code = getAppointmentRoomCode(appt, doctorName);
    const url = buildMeetingUrl(code);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success(`Meeting link for ${appt.patientName} copied!`);
    }
  };

  const handleCopyActiveCallLink = () => {
    const currentCode = activeCallRoomCode || generalRoomCode;
    const url = buildMeetingUrl(currentCode);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success("Active consultation link copied! Send to pet parent.");
    }
  };

  // Filter video consultations
  const todayIso = new Date().toISOString().slice(0, 10);

  const videoAppointments = useMemo(() => {
    let base = appointments.filter((a) => {
      const type = (a.appointmentType || "").toLowerCase();
      return type.includes("video") || type.includes("tele") || type.includes("online");
    });

    // If no video appointments in database yet, provide clean mock templates for demo
    if (base.length === 0 && !loading) {
      base = [
        {
          id: 101,
          patientId: 1,
          patientName: "Bruno (Golden Retriever)",
          ownerName: "Rahul Sharma",
          appointmentDate: todayIso,
          appointmentTime: "11:30",
          appointmentType: "Video",
          status: "Waiting",
          reason: "Skin allergy flare-up and persistent scratching on ears",
          phone: "+91 98450 12345",
          notes: "Previous allergy medications reviewed. Pet parent in waiting room.",
        },
        {
          id: 102,
          patientId: 2,
          patientName: "Milo (Persian Cat)",
          ownerName: "Sneha Patel",
          appointmentDate: todayIso,
          appointmentTime: "14:00",
          appointmentType: "Video",
          status: "Confirmed",
          reason: "Post-surgery follow-up check & wound healing assessment",
          phone: "+91 97234 56789",
          notes: "Stitches removed 4 days ago. Video examination required.",
        },
        {
          id: 103,
          patientId: 3,
          patientName: "Rocky (German Shepherd)",
          ownerName: "Amit Verma",
          appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          appointmentTime: "16:15",
          appointmentType: "Video",
          status: "Scheduled",
          reason: "Diet consultation & weight management routine review",
          phone: "+91 98111 22334",
          notes: "Overweight by 4kg. Need prescription diet plan.",
        },
      ];
    }

    // Apply tab filter
    if (activeTab === "today") {
      base = base.filter((a) => a.appointmentDate === todayIso);
    } else if (activeTab === "upcoming") {
      base = base.filter((a) => a.appointmentDate >= todayIso && a.status !== "Completed");
    } else if (activeTab === "completed") {
      base = base.filter((a) => a.status === "Completed");
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (a) =>
          (a.patientName || "").toLowerCase().includes(q) ||
          (a.ownerName || "").toLowerCase().includes(q) ||
          (a.reason || "").toLowerCase().includes(q) ||
          (a.phone || "").toLowerCase().includes(q)
      );
    }

    return base;
  }, [appointments, loading, todayIso, activeTab, searchQuery]);

  // Telehealth stats
  const stats = useMemo(() => {
    const allVideo = appointments.filter((a) =>
      (a.appointmentType || "").toLowerCase().includes("video")
    );
    const todayVideo = allVideo.filter((a) => a.appointmentDate === todayIso);
    const completed = allVideo.filter((a) => a.status === "Completed");

    return {
      todayCount: todayVideo.length,
      completedCount: completed.length,
      consultFee: profile?.consultationFee,
    };
  }, [appointments, todayIso, profile]);

  // Start instant call
  const handleStartInstantCall = () => {
    setActiveCallRoomCode(generalRoomCode);
    setActiveCall({
      id: "instant-" + Date.now(),
      patientName: "Instant Pet Video Consultation",
      ownerName: "Invited Pet Parent",
      reason: "Live Online Vet Checkup",
      status: "In Consultation",
      phone: "+91 99999 88888",
      appointmentTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isInstant: true,
    });
    setConsultNotes("");
    toast.success("Virtual Telehealth Room launched! Ready for consultation.");
  };

  // Join video call for a specific appointment
  const handleJoinCall = (appt) => {
    const apptCode = getAppointmentRoomCode(appt, doctorName);
    setActiveCallRoomCode(apptCode);
    setActiveCall(appt);
    setConsultNotes(appt.notes || "");
    toast.success(`Connected to room for ${appt.patientName || "Patient"}`);
  };

  // End active call & auto-expire current link + regenerate fresh link
  const handleEndCall = async () => {
    if (!activeCall) return;
    const isConfirmed = window.confirm(
      `End consultation call with ${activeCall.patientName}? The meeting link will be expired.`
    );
    if (!isConfirmed) return;

    const callId = activeCall.id;
    const isMock = typeof callId === "number" && callId >= 100 && callId <= 105;

    // Archive and auto-expire the meeting link so it cannot be reused
    if (activeCall.isInstant) {
      const freshCode = autoRegenerateDoctorRoom(doctorName, generalRoomCode, {
        doctorName,
        clinicName,
        patientName: activeCall.patientName,
        ownerName: activeCall.ownerName,
        reason: activeCall.reason,
      });
      setGeneralRoomCode(freshCode);
    } else {
      markAppointmentRoomCompleted(activeCall, activeCallRoomCode, {
        doctorName,
        clinicName,
        patientName: activeCall.patientName,
        ownerName: activeCall.ownerName,
        reason: activeCall.reason,
        notes: consultNotes || activeCall.notes,
      });

      // Also generate fresh room link for general doctor visits
      const freshCode = autoRegenerateDoctorRoom(doctorName, generalRoomCode, {
        doctorName,
        clinicName,
        patientName: activeCall.patientName,
        ownerName: activeCall.ownerName,
      });
      setGeneralRoomCode(freshCode);
    }

    if (!activeCall.isInstant && !isMock) {
      try {
        await updateAppointment(callId, {
          ...activeCall,
          status: "Completed",
          notes: consultNotes || activeCall.notes,
        });
        toast.success("✨ Consultation finished! Meeting link expired & fresh link generated.");
        fetchAppointments();
      } catch (err) {
        console.error("Error updating appointment to completed:", err);
      }
    } else {
      toast.success("✨ Consultation finished! Meeting link expired & fresh link generated.");
    }

    shouldListenNotesRef.current = false;
    setIsNotesDictating(false);
    setNotesSpeechInterim("");
    try { notesRecognitionRef.current?.stop(); } catch { }
    setIsMedVoiceListening(false);
    setMedVoiceInterim("");
    setMedVoiceParsed(null);
    try { medRecognitionRef.current?.stop(); } catch { }

    setActiveCall(null);
    setActiveCallRoomCode(null);
    setCallDuration(0);
  };

  // Open Prescription for patient
  const handleOpenPrescription = (appt) => {
    if (appt?.patientId) {
      navigate(`/prescriptions?patientId=${appt.patientId}`);
    } else {
      navigate("/prescriptions");
    }
  };

  return (
    <div className="video-consult-page">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & TELEHEALTH AVAILABILITY CARD              */}
      {/* ========================================================= */}
      <div className="vc-hero-card">
        <div className="vc-hero-main">
          <div className="vc-hero-badge-wrap">
            <span className="vc-hero-pill">
              <Sparkles size={13} /> Zenve Official Telehealth Portal
            </span>
          </div>

          <h1 className="vc-hero-title">Video Consultant Room</h1>
          <p className="vc-hero-subtitle">
            Conduct live, crystal-clear virtual video examinations, discuss pet diagnostics, and generate instant prescriptions remotely.
          </p>

          <div className="vc-room-link-box">
            <div className="vc-room-link-info">
              <span className="vc-room-link-label">Your Live Patient Telehealth Link:</span>
              <span className="vc-room-link-url">{meetingUrl}</span>
            </div>
            <div className="vc-room-link-btn-group">
              <button
                type="button"
                className={`btn-vc-copy-link ${copiedLink ? "copied" : ""}`}
                onClick={handleCopyLink}
                title="Copy meeting link for pet parents"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
              <button
                type="button"
                className="btn-vc-wa-link"
                onClick={() => handleShareWhatsApp(null)}
                title="Share consultation invite via WhatsApp"
              >
                <Share2 size={13} />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                className="btn-vc-regen-link"
                onClick={handleRegenerateLink}
                title="Generate fresh unique room link now"
              >
                <RefreshCw size={13} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Status Toggle & Stat Cards */}
        <div className="vc-hero-side">
          <div className={`vc-status-toggle-card ${isOnline ? "online" : "offline"}`}>
            <div className="vc-status-card-header">
              <div className="vc-status-indicator-wrap">
                <span className={`vc-status-dot ${isOnline ? "live" : ""}`} />
                <span className="vc-status-text">
                  {isOnline ? "Online · Ready for Calls" : "Away · Offline"}
                </span>
              </div>
              <span className="vc-fee-tag">₹{stats.consultFee} / visit</span>
            </div>

            <p className="vc-status-explainer">
              {isOnline
                ? "Pet parents can see you are available for live video visits."
                : "You are currently offline. Toggle on to accept virtual consults."}
            </p>

            <button
              type="button"
              className={`vc-toggle-action-btn ${isOnline ? "btn-online" : "btn-offline"}`}
              onClick={handleToggleOnline}
              disabled={togglingStatus}
            >
              <Radio size={14} className={isOnline ? "pulse-icon" : ""} />
              {togglingStatus
                ? "Updating..."
                : isOnline
                  ? "Switch to Offline / Away"
                  : "Go Online for Video Calls"}
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="vc-mini-stats-grid">
            <div className="vc-mini-stat">
              <span className="vc-mini-stat-num">{stats.todayCount}</span>
              <span className="vc-mini-stat-label">Today's Video Calls</span>
            </div>
            <div className="vc-mini-stat">
              <span className="vc-mini-stat-num">{stats.completedCount}</span>
              <span className="vc-mini-stat-label">Total Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ACTION BAR & TABS                                      */}
      {/* ========================================================= */}
      <div className="vc-action-toolbar">
        <div className="vc-tabs-group">
          <button
            type="button"
            className={`vc-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Video Consultations
          </button>
          <button
            type="button"
            className={`vc-tab-btn ${activeTab === "today" ? "active" : ""}`}
            onClick={() => setActiveTab("today")}
          >
            Today's Queue ({stats.todayCount})
          </button>
          <button
            type="button"
            className={`vc-tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={`vc-tab-btn ${activeTab === "completed" ? "active" : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            Completed
          </button>
        </div>

        <div className="vc-actions-right">
          <div className="vc-search-wrap">
            <Search size={15} className="vc-search-icon" />
            <input
              type="text"
              placeholder="Search pet, owner, symptom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="vc-search-input"
            />
          </div>

          <button
            type="button"
            className="btn-vc-instant"
            onClick={handleStartInstantCall}
            title="Launch an instant video room right now"
          >
            <Video size={16} />
            <span>Start Instant Call</span>
          </button>

          <button
            type="button"
            className="btn-vc-schedule"
            onClick={() => setScheduleModalOpen(true)}
            title="Schedule a future video appointment"
          >
            <Plus size={16} />
            <span>Schedule Video Visit</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. VIDEO APPOINTMENTS QUEUE                               */}
      {/* ========================================================= */}
      <div className="vc-appointments-section">
        {loading ? (
          <div className="vc-loading-state">
            <RefreshCw size={24} className="spin-icon" />
            <span>Loading virtual consultation appointments...</span>
          </div>
        ) : videoAppointments.length === 0 ? (
          <div className="vc-empty-state">
            <div className="vc-empty-icon-wrap">
              <Video size={36} />
            </div>
            <h3 className="vc-empty-title">No Video Consultations Found</h3>
            <p className="vc-empty-desc">
              {searchQuery
                ? `No video appointments matching "${searchQuery}".`
                : "You don't have any video appointments in this tab. Start an instant call or schedule a new video visit."}
            </p>
            <div className="vc-empty-actions">
              <Button variant="primary" onClick={handleStartInstantCall}>
                <Video size={15} /> Start Instant Video Call
              </Button>
              <Button variant="outline" onClick={() => setScheduleModalOpen(true)}>
                <Plus size={15} /> Schedule Video Call
              </Button>
            </div>
          </div>
        ) : (
          <div className="vc-cards-grid">
            {videoAppointments.map((appt) => {
              const isWaiting = appt.status === "Waiting";
              const isConfirmed = appt.status === "Confirmed" || appt.status === "Scheduled";
              const isCompleted = appt.status === "Completed";
              const isToday = appt.appointmentDate === todayIso;

              return (
                <div
                  key={appt.id}
                  className={`vc-card ${isWaiting ? "waiting-highlight" : ""} ${isCompleted ? "completed" : ""
                    }`}
                >
                  <div className="vc-card-header">
                    <div className="vc-card-time-wrap">
                      <span className="vc-card-time">
                        <Clock size={13} /> {appt.appointmentTime || "10:00 AM"}
                      </span>
                      <span className="vc-card-date">
                        <Calendar size={13} /> {appt.appointmentDate || todayIso}
                      </span>
                    </div>

                    <div className="vc-card-badge-wrap">
                      {isWaiting && (
                        <span className="vc-badge-live-waiting">
                          <span className="vc-pulsing-green-dot" /> Waiting in Room
                        </span>
                      )}
                      {isConfirmed && (
                        <span className="vc-badge-confirmed">
                          <CheckCircle2 size={12} /> Confirmed
                        </span>
                      )}
                      {isCompleted && (
                        <span className="vc-badge-completed">
                          <Check size={12} /> Completed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="vc-card-body">
                    <div className="vc-pet-profile-row">
                      <div className="vc-pet-avatar">
                        <FaPaw size={18} />
                      </div>
                      <div className="vc-pet-info">
                        <h4 className="vc-pet-name">{appt.patientName || "Pet Patient"}</h4>
                        <span className="vc-owner-name">
                          <User size={12} /> {appt.ownerName || "Pet Parent"} · {appt.phone || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="vc-reason-box">
                      <span className="vc-reason-label">Chief Complaint / Reason:</span>
                      <p className="vc-reason-text">{appt.reason || "General virtual checkup"}</p>
                    </div>

                    {appt.notes && (
                      <p className="vc-notes-hint">
                        <strong>Notes:</strong> {appt.notes}
                      </p>
                    )}
                  </div>

                  <div className="vc-card-footer">
                    {!isCompleted ? (
                      <button
                        type="button"
                        className="btn-vc-join-call"
                        onClick={() => handleJoinCall(appt)}
                        title="Enter video consultation room"
                      >
                        <Video size={15} />
                        <span>Join Video Call</span>
                      </button>
                    ) : (
                      <span className="vc-call-finished-label">
                        <Check size={14} /> Consultation Completed
                      </span>
                    )}

                    <div className="vc-card-actions-mini">
                      <button
                        type="button"
                        className="btn-vc-mini-action"
                        onClick={() => handleOpenPrescription(appt)}
                        title="Open Prescription for this patient"
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-vc-mini-action"
                        onClick={() => handleCopyApptLink(appt)}
                        title="Copy patient-specific consultation link"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-vc-mini-action"
                        onClick={() => handleShareWhatsApp(appt)}
                        title="Share consultation invite on WhatsApp"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. PROFESSIONAL FULL-VIEWPORT TELEHEALTH SUITE           */}
      {/* ========================================================= */}
      {activeCall && (
        <div className="vc-telehealth-suite">
          {/* Top Navigation Bar */}
          <header className="vc-suite-header">
            <div className="vc-suite-header-left">
              <div className="vc-suite-live-badge">
                <span className="vc-suite-rec-pulse" />
                <span className="vc-suite-badge-text">Zenve Telehealth HD</span>
              </div>
              <div className="vc-suite-timer">
                <Clock size={13} />
                <span>{formatCallTime(callDuration)}</span>
              </div>
              <span className="vc-suite-quality-tag">1080p HD · 60fps · WebRTC Encrypted</span>
            </div>

            <div className="vc-suite-header-center">
              <FaPaw size={16} className="vc-pet-paw-icon" />
              <strong className="vc-suite-patient-name">{activeCall.patientName}</strong>
              <span className="vc-suite-owner-name">({activeCall.ownerName || "Pet Parent"})</span>
            </div>

            <div className="vc-suite-header-right">
              <button
                type="button"
                className={`vc-view-mode-pill ${viewLayout === "faceToFace" ? "active" : ""}`}
                onClick={() => setViewLayout((prev) => (prev === "faceToFace" ? "speaker" : "faceToFace"))}
                title={viewLayout === "faceToFace" ? "Switch to Spotlight Mode" : "Switch to Face-to-Face Dual Cameras"}
              >
                <Users size={14} />
                <span>{viewLayout === "faceToFace" ? "Face-to-Face" : "Spotlight"}</span>
              </button>

              <button
                type="button"
                className={`vc-suite-drawer-toggle-btn ${drawerOpen ? "active" : ""}`}
                onClick={() => setDrawerOpen((prev) => !prev)}
                title={drawerOpen ? "Collapse Clinical Drawer" : "Open Clinical Drawer"}
              >
                <FileText size={15} />
                <span>{drawerOpen ? "Hide Drawer" : "Clinical Notes & Rx"}</span>
              </button>
              <button
                type="button"
                className="vc-suite-end-call-btn"
                onClick={handleEndCall}
                title="End Consultation"
              >
                <PhoneOff size={15} />
                <span>End Call</span>
              </button>
            </div>
          </header>

          {/* Main Stage: Video Canvas + Slide-Over Drawer */}
          <div className="vc-suite-workspace">
            {/* Left: Video Stage */}
            <main className="vc-suite-video-canvas">
              {viewLayout === "faceToFace" ? (
                /* FACE-TO-FACE DUAL OPEN CAMERAS GRID */
                <div className="vc-f2f-grid">
                  {/* Left Tile: Pet Patient & Parent */}
                  <div className="vc-f2f-tile patient-tile">
                    {remoteStreamConnected ? (
                      <video
                        ref={(el) => {
                          remoteVideoRef.current = el;
                          if (el && remoteMediaStreamRef.current && el.srcObject !== remoteMediaStreamRef.current) {
                            el.srcObject = remoteMediaStreamRef.current;
                            el.play().catch(() => { });
                          }
                        }}
                        autoPlay
                        playsInline
                        className="vc-f2f-video-feed"
                      />
                    ) : (
                      <img
                        src="/images/telehealth-pet-patient.jpg"
                        alt="Pet Patient Video Stream"
                        className="vc-f2f-video-feed"
                      />
                    )}

                    <div className="vc-f2f-hud-top">
                      <div className="vc-f2f-name-badge">
                        <span className="vc-hud-green-pulse" />
                        <span>{activeCall.patientName}</span>
                      </div>
                      <div className="vc-f2f-status-pill">
                        <Activity size={12} />
                        <span>{remoteStreamConnected ? "Live Camera Connected" : "Patient Room Active"}</span>
                      </div>
                    </div>

                    <div className="vc-f2f-hud-bottom">
                      <div className="vc-f2f-info-pill">
                        <strong>Reason:</strong> {activeCall.reason || "Virtual Veterinary Consultation"}
                      </div>
                      <div className="vc-f2f-audio-indicator">
                        <span>1080p HD</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Tile: Doctor Live Open Camera */}
                  <div className="vc-f2f-tile doctor-tile">
                    {!isVideoOff ? (
                      <video
                        ref={(el) => {
                          doctorVideoRef.current = el;
                          if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                            el.srcObject = mediaStreamRef.current;
                            el.play().catch(() => { });
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="vc-f2f-video-feed mirrored"
                      />
                    ) : (
                      <div className="vc-f2f-fallback">
                        <div className="vc-f2f-avatar-circle">
                          <User size={32} />
                        </div>
                        <span className="vc-doctor-cam-status-label">Doctor Camera Turned Off</span>
                      </div>
                    )}

                    <div className="vc-f2f-hud-top">
                      <div className="vc-f2f-name-badge">
                        <span className="vc-hud-green-pulse" />
                        <span>Dr. {doctorName} (You)</span>
                      </div>
                      <div className="vc-f2f-status-pill">
                        <span>{webcamActive && !isVideoOff ? "Live Camera Open" : "Ready"}</span>
                      </div>
                    </div>

                    <div className="vc-f2f-hud-bottom">
                      <div className="vc-f2f-info-pill">
                        <strong>Role:</strong> Attending Veterinarian
                      </div>
                      <div className={`vc-f2f-audio-indicator ${isMuted ? "muted" : ""}`}>
                        {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                        <span>{isMuted ? "Muted" : "Audio Live"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SPOTLIGHT VIEW */
                <div className="vc-suite-remote-feed">
                  <img
                    src="/images/telehealth-pet-patient.jpg"
                    alt="Pet Patient Video Stream"
                    className="vc-patient-video-image"
                  />

                  {/* Overlaid Patient HUD */}
                  <div className="vc-patient-hud-overlay">
                    <div className="vc-hud-top-row">
                      <div className="vc-hud-patient-badge">
                        <span className="vc-hud-green-pulse" />
                        <span>{activeCall.patientName}</span>
                      </div>
                      <div className="vc-hud-telemetry-badge">
                        <Activity size={12} />
                        <span>Latency: 18ms · Stable HD Video & Audio</span>
                      </div>
                    </div>

                    <div className="vc-hud-bottom-row">
                      <div className="vc-hud-complaint-badge">
                        <span className="vc-complaint-label">Chief Complaint:</span>
                        <span className="vc-complaint-text">{activeCall.reason || "Video Examination & Checkup"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Picture-In-Picture (PIP) Webcam Feed */}
                  <div className="vc-suite-doctor-pip">
                    {!isVideoOff ? (
                      <video
                        ref={(el) => {
                          doctorVideoRef.current = el;
                          if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                            el.srcObject = mediaStreamRef.current;
                            el.play().catch(() => { });
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="vc-doctor-webcam-feed"
                      />
                    ) : null}
                    {(isVideoOff || !webcamActive) && (
                      <div className="vc-doctor-pip-fallback">
                        <div className="vc-doctor-avatar-circle">
                          <User size={26} />
                        </div>
                        <span className="vc-doctor-cam-status-label">
                          {isVideoOff ? "Camera Off" : "Webcam Ready"}
                        </span>
                      </div>
                    )}

                    <div className="vc-doctor-pip-bottom-bar">
                      <span className="vc-doctor-pip-label">
                        Dr. {profile?.fullName || authDoctor?.fullName || "Doctor"} (You)
                      </span>
                      {isMuted && (
                        <span className="vc-pip-muted-icon" title="Microphone muted">
                          <MicOff size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Bottom Dock (Google Meet / Zoom style) */}
              <div className="vc-suite-floating-dock">
                <button
                  type="button"
                  className={`vc-dock-circle-btn ${isMuted ? "muted" : "active"}`}
                  onClick={handleToggleMic}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff size={19} /> : <Mic size={19} />}
                  <span className="vc-dock-tooltip">{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                <button
                  type="button"
                  className={`vc-dock-circle-btn ${isVideoOff ? "muted" : "active"}`}
                  onClick={handleToggleVideo}
                  title={isVideoOff ? "Start Camera" : "Stop Camera"}
                >
                  {isVideoOff ? <VideoOff size={19} /> : <Video size={19} />}
                  <span className="vc-dock-tooltip">{isVideoOff ? "Start Video" : "Stop Video"}</span>
                </button>

                <button
                  type="button"
                  className={`vc-dock-circle-btn ${viewLayout === "faceToFace" ? "highlight" : "active"}`}
                  onClick={() => setViewLayout((prev) => (prev === "faceToFace" ? "speaker" : "faceToFace"))}
                  title={viewLayout === "faceToFace" ? "Switch to Spotlight View" : "Face-to-Face Dual Cameras"}
                >
                  <Users size={19} />
                  <span className="vc-dock-tooltip">
                    {viewLayout === "faceToFace" ? "Face to Face" : "Spotlight"}
                  </span>
                </button>

                <button
                  type="button"
                  className={`vc-dock-circle-btn ${isScreenSharing ? "highlight" : "active"}`}
                  onClick={handleToggleScreenShare}
                  title="Share Screen or Lab Results"
                >
                  <Share2 size={19} />
                  <span className="vc-dock-tooltip">{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                </button>

                <button
                  type="button"
                  className={`vc-dock-circle-btn ${drawerOpen && drawerTab === "rx" ? "highlight" : "active"}`}
                  onClick={() => {
                    setDrawerOpen(true);
                    setDrawerTab("rx");
                  }}
                  title="Clinical Notes & Rx"
                >
                  <FileText size={19} />
                  <span className="vc-dock-tooltip">Notes & Rx</span>
                </button>

                <button
                  type="button"
                  className={`vc-dock-circle-btn ${drawerOpen && drawerTab === "vitals" ? "highlight" : "active"}`}
                  onClick={() => {
                    setDrawerOpen(true);
                    setDrawerTab("vitals");
                  }}
                  title="Patient Vitals"
                >
                  <Activity size={19} />
                  <span className="vc-dock-tooltip">Vitals</span>
                </button>

                <button
                  type="button"
                  className="vc-dock-circle-btn active"
                  onClick={handleCopyActiveCallLink}
                  title="Copy Active Room Link"
                >
                  <Copy size={19} />
                  <span className="vc-dock-tooltip">Copy Link</span>
                </button>

                <button
                  type="button"
                  className="vc-dock-end-call-pill"
                  onClick={handleEndCall}
                  title="End Consultation"
                >
                  <PhoneOff size={16} />
                  <span>End Call</span>
                </button>
              </div>
            </main>

            {/* Right: Slide-Over Clinical EMR Drawer */}
            {drawerOpen && (
              <aside className="vc-suite-drawer">
                <div className="vc-drawer-tabs-header">
                  <button
                    type="button"
                    className={`vc-drawer-tab-btn ${drawerTab === "rx" ? "active" : ""}`}
                    onClick={() => setDrawerTab("rx")}
                  >
                    <FileText size={14} />
                    <span>Live Notes & Rx</span>
                  </button>
                  <button
                    type="button"
                    className={`vc-drawer-tab-btn ${drawerTab === "vitals" ? "active" : ""}`}
                    onClick={() => setDrawerTab("vitals")}
                  >
                    <Activity size={14} />
                    <span>Pet Vitals</span>
                  </button>
                  <button
                    type="button"
                    className="vc-drawer-close-icon-btn"
                    onClick={() => setDrawerOpen(false)}
                    title="Close Drawer"
                  >
                    <FiX size={16} />
                  </button>
                </div>

                <div className="vc-drawer-scrollable-body">
                  {/* Patient Quick Card */}
                  <div className="vc-drawer-patient-badge-card">
                    <div className="vc-dpb-header">
                      <span className="vc-dpb-name">{activeCall.patientName}</span>
                      <span className="vc-dpb-status">In Video Call</span>
                    </div>
                    <div className="vc-dpb-meta">
                      <span>Owner: <strong>{activeCall.ownerName || "Pet Parent"}</strong></span>
                      <span>Phone: {activeCall.phone || "—"}</span>
                    </div>
                  </div>

                  {drawerTab === "rx" ? (
                    <>
                      {/* Clinical Examination Notes with Voice Dictation */}
                      <div className="vc-drawer-section">
                        <div className="vc-drawer-section-header">
                          <label className="vc-drawer-section-title">
                            Live Consultation Notes / Examination Findings:
                          </label>
                          <div className="vc-section-header-actions">
                            {consultNotes && (
                              <button
                                type="button"
                                className="vc-notes-clear-btn"
                                onClick={() => setConsultNotes("")}
                                title="Clear Notes"
                              >
                                Clear
                              </button>
                            )}
                            <button
                              type="button"
                              className={`vc-voice-btn ${isNotesDictating ? "listening" : ""}`}
                              onClick={handleToggleNotesDictation}
                              title={isNotesDictating ? "Stop Voice Dictation" : "Start Voice Dictation for Notes"}
                            >
                              {isNotesDictating ? (
                                <>
                                  <span className="vc-voice-live-dot" />
                                  <span>Listening...</span>
                                </>
                              ) : (
                                <>
                                  <Mic size={13} />
                                  <span>Voice Notes</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Animated Voice Dictation Status Wave */}
                        {isNotesDictating && (
                          <div className="vc-voice-active-banner">
                            <div className="vc-vab-left">
                              <div className="vc-voice-wave">
                                <span />
                                <span />
                                <span />
                                <span />
                              </div>
                              <span className="vc-vab-text">
                                {notesSpeechInterim ? `"${notesSpeechInterim}..."` : "Listening for doctor's voice..."}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="vc-vab-stop-pill"
                              onClick={handleToggleNotesDictation}
                            >
                              Stop
                            </button>
                          </div>
                        )}

                        <textarea
                          rows={4}
                          className={`vc-drawer-notes-area ${isNotesDictating ? "dictating-active" : ""}`}
                          placeholder="Type or click '🎙️ Voice Notes' to speak clinical findings, symptoms, advice..."
                          value={consultNotes}
                          onChange={(e) => setConsultNotes(e.target.value)}
                        />
                      </div>

                      {/* Prescribed Medicines Builder with Smart Voice Parsing */}
                      <div className="vc-drawer-section">
                        <div className="vc-drawer-section-header">
                          <label className="vc-drawer-section-title">
                            Prescribed Medicines ({medicines.length}):
                          </label>
                          <button
                            type="button"
                            className={`vc-voice-btn med-voice ${isMedVoiceListening ? "listening" : ""}`}
                            onClick={handleToggleSmartMedVoice}
                            title={isMedVoiceListening ? "Stop Voice Rx" : "Speak complete prescription e.g. 'Add Cefpet 100mg twice daily for 7 days'"}
                          >
                            {isMedVoiceListening ? (
                              <>
                                <span className="vc-voice-live-dot" />
                                <span>Listening Rx...</span>
                              </>
                            ) : (
                              <>
                                <Mic size={13} />
                                <span>Voice Add Rx</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Smart Voice Medicine Assistant Card */}
                        {isMedVoiceListening && (
                          <div className="vc-voice-med-banner">
                            <div className="vc-vmb-top">
                              <div className="vc-vmb-indicator">
                                <Mic size={15} />
                                <span className="vc-voice-pulse-ring" />
                              </div>
                              <div className="vc-vmb-info">
                                <span className="vc-vmb-title">Listening for Medicine Command</span>
                                <span className="vc-vmb-sub">Speak: "Add Cefpet 100mg twice daily for 7 days"</span>
                              </div>
                              <button
                                type="button"
                                className="vc-vmb-close-btn"
                                onClick={handleToggleSmartMedVoice}
                                title="Close Voice Assistant"
                              >
                                <FiX size={14} />
                              </button>
                            </div>

                            {medVoiceInterim && (
                              <div className="vc-vmb-live-speech">
                                <span className="vc-vmb-speech-label">Heard:</span>
                                "{medVoiceInterim}"
                              </div>
                            )}

                            {medVoiceParsed && (
                              <div className="vc-vmb-parsed-card">
                                <div className="vc-vmb-parsed-details">
                                  <strong className="vc-vmb-drug-name">💊 {medVoiceParsed.name}</strong>
                                  <span className="vc-vmb-drug-meta">
                                    {medVoiceParsed.dosage} · {medVoiceParsed.frequency} · {medVoiceParsed.duration}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-vc-vmb-add"
                                  onClick={() => handleConfirmVoiceMed(medVoiceParsed)}
                                >
                                  <Plus size={12} />
                                  <span>Add to Rx</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="vc-meds-pill-list">
                          {medicines.length === 0 ? (
                            <div className="vc-no-meds-hint">
                              No medicines added yet. Speak or type to prescribe.
                            </div>
                          ) : (
                            medicines.map((m, idx) => (
                              <div key={idx} className="vc-med-pill-item">
                                <div className="vc-med-pill-info">
                                  <strong className="vc-med-name">{m.name}</strong>
                                  <span className="vc-med-meta">
                                    {m.dosage} · {m.frequency} · {m.duration}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="vc-med-remove-btn"
                                  onClick={() => handleRemoveMedicine(idx)}
                                  title="Remove Medicine"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Quick Add Medicine Bar with Voice per Field */}
                        <div className="vc-add-med-box">
                          <div className="vc-med-field-with-mic">
                            <input
                              type="text"
                              placeholder="Medicine Name (e.g. Cefpet)"
                              className="vc-med-input full"
                              value={newMed.name}
                              onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                            />
                            <button
                              type="button"
                              className={`vc-input-mic-btn ${activeVoiceField === "name" ? "active" : ""}`}
                              onClick={() => handleFieldVoiceDictate("name")}
                              title="Voice dictate medicine name"
                            >
                              <Mic size={13} />
                            </button>
                          </div>

                          <div className="vc-med-input-row">
                            <div className="vc-med-field-with-mic flex-1">
                              <input
                                type="text"
                                placeholder="Dosage (e.g. 100mg)"
                                className="vc-med-input"
                                value={newMed.dosage}
                                onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                              />
                              <button
                                type="button"
                                className={`vc-input-mic-btn ${activeVoiceField === "dosage" ? "active" : ""}`}
                                onClick={() => handleFieldVoiceDictate("dosage")}
                                title="Voice dictate dosage"
                              >
                                <Mic size={13} />
                              </button>
                            </div>

                            <div className="vc-med-field-with-mic flex-1">
                              <input
                                type="text"
                                placeholder="Duration (e.g. 7 days)"
                                className="vc-med-input"
                                value={newMed.duration}
                                onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                              />
                              <button
                                type="button"
                                className={`vc-input-mic-btn ${activeVoiceField === "duration" ? "active" : ""}`}
                                onClick={() => handleFieldVoiceDictate("duration")}
                                title="Voice dictate duration"
                              >
                                <Mic size={13} />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="vc-btn-add-med"
                            onClick={handleAddMedicine}
                          >
                            <Plus size={13} />
                            <span>Add Medicine to Rx</span>
                          </button>

                          {/* Quick Common Vet Med Chips */}
                          <div className="vc-quick-meds-wrap">
                            <span className="vc-quick-meds-label">Quick Suggestions:</span>
                            <div className="vc-quick-meds-chips">
                              {COMMON_VET_MEDICINES.slice(0, 5).map((med, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="vc-quick-med-chip"
                                  onClick={() => handleQuickMedSelect(med)}
                                  title={`Add ${med.name} (${med.dosage}, ${med.duration})`}
                                >
                                  + {med.name.split(" ")[0]} ({med.dosage})
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Drawer Actions */}
                      <div className="vc-drawer-footer-actions">
                        <button
                          type="button"
                          className="btn-vc-write-rx"
                          onClick={() => handleOpenPrescription(activeCall)}
                          title="Open full digital prescription form for this patient"
                        >
                          <FileText size={16} />
                          <span>Write Digital Prescription (Rx)</span>
                        </button>

                        <button
                          type="button"
                          className="btn-vc-finish-consult"
                          onClick={handleEndCall}
                        >
                          <CheckCircle2 size={16} />
                          <span>Complete & End Consultation</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Tab 2: Pet Vitals */
                    <div className="vc-vitals-section">
                      <div className="vc-vitals-grid">
                        <div className="vc-vital-card">
                          <span className="vc-vital-k">Weight</span>
                          <strong className="vc-vital-v">{activeCall.petWeight || "28.5 kg"}</strong>
                        </div>
                        <div className="vc-vital-card">
                          <span className="vc-vital-k">Age</span>
                          <strong className="vc-vital-v">{activeCall.petAge || "2.5 Years"}</strong>
                        </div>
                        <div className="vc-vital-card">
                          <span className="vc-vital-k">Gender</span>
                          <strong className="vc-vital-v">{activeCall.petGender || "Male (Neutered)"}</strong>
                        </div>
                        <div className="vc-vital-card">
                          <span className="vc-vital-k">Heart Rate</span>
                          <strong className="vc-vital-v">110 bpm (Normal)</strong>
                        </div>
                      </div>

                      <div className="vc-vitals-info-box">
                        <span className="vc-vitals-info-title">Allergy & Dietary Alerts:</span>
                        <div className="vc-allergy-alert-pill">
                          ⚠️ Known Chicken Protein Allergy · Seasonal Atopy
                        </div>
                      </div>

                      <div className="vc-vitals-info-box">
                        <span className="vc-vitals-info-title">Vaccination Status:</span>
                        <span className="vc-vax-status-tag">✓ Up to Date (DHPPi + Rabies valid)</span>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SCHEDULE NEW VISIT MODAL                               */}
      {/* ========================================================= */}
      {scheduleModalOpen && (
        <NewVisitModal
          open={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          onCreated={() => {
            fetchAppointments();
            setScheduleModalOpen(false);
            toast.success("New Video Consultation scheduled successfully!");
          }}
        />
      )}
    </div>
  );
}
