import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Clock,
  Activity,
  CheckCircle2,
  RefreshCw,
  Camera,
  MessageSquare,
  Send,
  X,
  User,
  AlertCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { FaPaw } from "react-icons/fa";
import toast from "react-hot-toast";
import {
  isRoomExpired,
  getExpiredRoomDetails,
  getRoomMetadata,
  subscribeTelehealthEvents,
} from "../../utils/telehealthRoomManager";
import { TelehealthPeer } from "../../utils/telehealthWebRTC";
import "./PetParentRoom.css";

export default function PetParentRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  // State
  const [roomExpired, setRoomExpired] = useState(() => isRoomExpired(roomCode));
  const [expiredDetails, setExpiredDetails] = useState(() => getExpiredRoomDetails(roomCode));
  const [roomMeta, setRoomMeta] = useState(() => getRoomMetadata(roomCode) || {});

  // Pre-join form & controls
  const [parentName, setParentName] = useState(roomMeta.ownerName || "");
  const [petName, setPetName] = useState(roomMeta.patientName || "");
  const [hasJoined, setHasJoined] = useState(false);

  // Audio / Video states
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState("user"); // "user" or "environment"
  const [callDuration, setCallDuration] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Chat in room
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "system",
      text: "Welcome to Zenve Telehealth. Audio & video are encrypted end-to-end.",
      time: "Now",
    },
    {
      sender: "doctor",
      text: "Hello! I am ready to review your pet's symptoms and examination.",
      time: "Now",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteDoctorVideoRef = useRef(null);
  const remoteDoctorStreamRef = useRef(null);
  const timerRef = useRef(null);
  const peerRef = useRef(null);

  // View layout: "faceToFace" (default dual open cameras) | "spotlight"
  const [viewLayout, setViewLayout] = useState("faceToFace");
  const [remoteDoctorConnected, setRemoteDoctorConnected] = useState(false);

  // Check initial room status
  useEffect(() => {
    if (isRoomExpired(roomCode)) {
      setRoomExpired(true);
      setExpiredDetails(getExpiredRoomDetails(roomCode));
    } else {
      const meta = getRoomMetadata(roomCode);
      if (meta) {
        setRoomMeta(meta);
        if (meta.ownerName && !parentName) setParentName(meta.ownerName);
        if (meta.patientName && !petName) setPetName(meta.patientName);
      }
    }
  }, [roomCode]);

  // Subscribe to live telehealth broadcast events (e.g. Doctor ends call)
  useEffect(() => {
    const unsubscribe = subscribeTelehealthEvents((event) => {
      if (
        event?.type === "ROOM_COMPLETED" &&
        (event.roomCode === roomCode || event.oldRoomCode === roomCode)
      ) {
        // Doctor finalized and completed the consultation
        toast.info("The consultation has been completed by your veterinarian.");
        stopMediaStream();
        setRoomExpired(true);
        setExpiredDetails({
          roomCode,
          expiredAt: new Date().toISOString(),
          doctorName: event.doctorName || roomMeta.doctorName || "Dr. Vasanth Zenve",
          patientName: event.patientName || petName || roomMeta.patientName || "Pet Patient",
          clinicName: roomMeta.clinicName || "Global Veterinary Hospital",
          reason: "Consultation Completed & Link Expired",
        });
      }
    });

    return () => unsubscribe();
  }, [roomCode, roomMeta, petName]);

  // Handle local webcam stream with progressive fallbacks
  const startMediaStream = async () => {
    // If we already have an active stream with live tracks, keep using it
    if (
      localStreamRef.current &&
      localStreamRef.current.active &&
      localStreamRef.current.getVideoTracks().some((t) => t.readyState === "live")
    ) {
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraError(null);
      return localStreamRef.current;
    }

    stopMediaStream();

    let stream = null;
    let lastError = null;

    if (navigator?.mediaDevices?.getUserMedia) {
      // Stage 1: Ideal HD with desired facingMode and audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode || "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
      } catch (err1) {
        lastError = err1;
        // Stage 2: Basic video + audio (no resolution constraints)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (err2) {
          lastError = err2;
          // Stage 3: Video only (e.g. if microphone is missing or permission denied)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err3) {
            lastError = err3;
            // Stage 4: Minimal facingMode fallback
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
              });
            } catch (err4) {
              lastError = err4;
            }
          }
        }
      }
    }

    if (stream) {
      localStreamRef.current = stream;
      setCameraActive(true);
      setCameraError(null);

      // If WebRTC peer is already initialized, update its local stream
      if (peerRef.current?.updateLocalStream) {
        peerRef.current.updateLocalStream(stream);
      }

      if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      return stream;
    } else {
      console.warn("Camera could not be started:", lastError);
      setCameraActive(false);
      setCameraError(lastError?.name || "Camera unavailable");
      return null;
    }
  };

  const stopMediaStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start preview stream when component mounts (if not expired)
  useEffect(() => {
    if (!roomExpired) {
      startMediaStream();
    }
    return () => stopMediaStream();
  }, [roomExpired, facingMode]);

  // Synchronize local webcam stream to whichever video element is currently active in the DOM
  // Triggers whenever hasJoined, isVideoOff, viewLayout, or cameraActive changes
  useEffect(() => {
    if (isVideoOff || roomExpired) return;

    const bindStream = async () => {
      let stream = localStreamRef.current;
      if (!stream || !stream.active || !stream.getVideoTracks().some((t) => t.readyState === "live")) {
        stream = await startMediaStream();
      }

      if (localVideoRef.current && stream) {
        if (localVideoRef.current.srcObject !== stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        } else if (localVideoRef.current.paused) {
          localVideoRef.current.play().catch(() => {});
        }
      }
    };

    bindStream();
  }, [hasJoined, isVideoOff, viewLayout, facingMode, cameraActive, roomExpired]);

  // Synchronize remote doctor stream whenever layout switches or remote connects
  useEffect(() => {
    if (remoteDoctorVideoRef.current && remoteDoctorStreamRef.current) {
      if (remoteDoctorVideoRef.current.srcObject !== remoteDoctorStreamRef.current) {
        remoteDoctorVideoRef.current.srcObject = remoteDoctorStreamRef.current;
      }
      remoteDoctorVideoRef.current.play().catch(() => {});
    }
  }, [remoteDoctorConnected, viewLayout]);

  // Connect WebRTC peer connection to Doctor's live camera feed
  useEffect(() => {
    if (!hasJoined || roomExpired) return;

    peerRef.current = new TelehealthPeer({
      roomId: roomCode,
      role: "parent",
      localStream: localStreamRef.current,
      onRemoteStream: (stream) => {
        remoteDoctorStreamRef.current = stream;
        if (remoteDoctorVideoRef.current) {
          remoteDoctorVideoRef.current.srcObject = stream;
          remoteDoctorVideoRef.current.play().catch(() => {});
        }
        setRemoteDoctorConnected(true);
        toast.success("Doctor's live camera connected face-to-face!");
      },
      onConnectionStateChange: (state) => {
        if (state === "disconnected" || state === "failed" || state === "closed") {
          setRemoteDoctorConnected(false);
        }
      },
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setRemoteDoctorConnected(false);
    };
  }, [hasJoined, roomExpired, roomCode]);

  // Toggle Mute
  const handleToggleMic = () => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
    }
  };

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);

    if (nextState) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    } else {
      if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.enabled = true;
        });
      } else {
        await startMediaStream();
      }
    }
  };

  // Switch camera (front/rear)
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    toast.info("Switched camera perspective");
  };

  // Enter video room
  const handleJoinMeeting = async (e) => {
    e?.preventDefault?.();
    if (!parentName.trim()) {
      toast.error("Please enter your name to join.");
      return;
    }
    if (!isVideoOff && (!localStreamRef.current || !localStreamRef.current.active)) {
      await startMediaStream();
    }
    setHasJoined(true);
    toast.success(`Joined consultation for ${petName || "Pet"}`);
  };

  // Call timer when joined
  useEffect(() => {
    if (hasJoined && !roomExpired) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasJoined, roomExpired]);

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Send in-call chat message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      {
        sender: "parent",
        senderName: parentName || "You",
        text: chatInput.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setChatInput("");
  };

  // Pet parent leaves the call
  const handleLeaveCall = () => {
    const confirmed = window.confirm("Leave video consultation room?");
    if (!confirmed) return;

    stopMediaStream();
    setHasJoined(false);
    toast.info("You have left the video room.");
  };

  // =========================================================================
  // VIEW 1: ROOM EXPIRED / COMPLETED STATE
  // =========================================================================
  if (roomExpired) {
    const expDate = expiredDetails?.expiredAt
      ? new Date(expiredDetails.expiredAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Just now";

    return (
      <div className="pp-room-container expired-state">
        <header className="pp-room-header">
          <div className="pp-header-brand">
            <div className="pp-brand-logo">
              <FaPaw size={18} />
            </div>
            <div>
              <h2 className="pp-brand-title">Zenve Telehealth</h2>
              <span className="pp-brand-sub">Virtual Veterinary Care</span>
            </div>
          </div>
          <div className="pp-security-pill expired">
            <ShieldCheck size={14} />
            <span>Room Expired & Protected</span>
          </div>
        </header>

        <main className="pp-expired-card-wrap">
          <div className="pp-expired-card">
            <div className="pp-expired-icon-ring">
              <CheckCircle2 size={46} className="pp-success-check-icon" />
            </div>

            <span className="pp-expired-pill-badge">Consultation Concluded</span>

            <h1 className="pp-expired-title">This Consultation has Ended</h1>
            <p className="pp-expired-desc">
              Thank you for meeting with your veterinarian. For medical privacy and data security,
              all telehealth meeting links are <strong>single-use</strong> and are automatically expired
              once the doctor concludes the session.
            </p>

            <div className="pp-expired-summary-box">
              <div className="pp-esb-row">
                <span className="pp-esb-label">Attending Doctor:</span>
                <strong className="pp-esb-val">
                  {expiredDetails?.doctorName || roomMeta?.doctorName || "Dr. Vasanth Zenve"}
                </strong>
              </div>
              <div className="pp-esb-row">
                <span className="pp-esb-label">Clinic:</span>
                <span className="pp-esb-val">
                  {expiredDetails?.clinicName || roomMeta?.clinicName || "Global Veterinary Hospital"}
                </span>
              </div>
              <div className="pp-esb-row">
                <span className="pp-esb-label">Patient:</span>
                <span className="pp-esb-val">
                  {expiredDetails?.patientName || petName || "Pet Patient"}
                </span>
              </div>
              <div className="pp-esb-row">
                <span className="pp-esb-label">Concluded At:</span>
                <span className="pp-esb-val">{expDate}</span>
              </div>
            </div>

            <div className="pp-expired-info-note">
              <AlertCircle size={18} className="pp-note-icon" />
              <div>
                <strong>Next Steps:</strong> Your digital prescription and clinical examination
                findings have been filed in your pet's electronic medical record. If you require further
                advice or another follow-up, please request a new consultation link from your clinic.
              </div>
            </div>

            <div className="pp-expired-actions">
              <button
                type="button"
                className="btn-pp-done"
                onClick={() => window.close()}
              >
                Close Window
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PRE-CALL WAITING ROOM / PERMISSIONS CHECK
  // =========================================================================
  if (!hasJoined) {
    return (
      <div className="pp-room-container lobby-state">
        <header className="pp-room-header">
          <div className="pp-header-brand">
            <div className="pp-brand-logo">
              <FaPaw size={18} />
            </div>
            <div>
              <h2 className="pp-brand-title">Zenve Telehealth</h2>
              <span className="pp-brand-sub">Virtual Veterinary Care</span>
            </div>
          </div>

          <div className="pp-security-pill">
            <ShieldCheck size={14} />
            <span>256-Bit Encrypted HD Telehealth</span>
          </div>
        </header>

        <main className="pp-lobby-grid">
          {/* Left: Camera / Mic Preview Canvas */}
          <div className="pp-lobby-preview-col">
            <div className="pp-preview-viewport">
              {!isVideoOff ? (
                <video
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                      el.srcObject = localStreamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="pp-preview-video"
                />
              ) : (
                <div className="pp-preview-disabled">
                  <VideoOff size={38} />
                  <p>Camera is turned off</p>
                </div>
              )}

              <div className="pp-preview-controls-overlay">
                <button
                  type="button"
                  className={`btn-pp-preview-ctl ${isMicMuted ? "muted" : "active"}`}
                  onClick={handleToggleMic}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                  type="button"
                  className={`btn-pp-preview-ctl ${isVideoOff ? "muted" : "active"}`}
                  onClick={handleToggleVideo}
                  title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                </button>

                <button
                  type="button"
                  className="btn-pp-preview-ctl active"
                  onClick={handleFlipCamera}
                  title="Switch Front/Rear Camera"
                >
                  <RefreshCw size={18} />
                </button>
              </div>

              <div className="pp-preview-hud-tag">
                <Camera size={13} />
                <span>Adjust your pet's angle before entering</span>
              </div>
            </div>
          </div>

          {/* Right: Join Form & Doctor Availability Card */}
          <div className="pp-lobby-form-col">
            <div className="pp-doctor-card">
              <div className="pp-doctor-avatar">
                <User size={24} />
              </div>
              <div className="pp-doctor-meta">
                <span className="pp-doctor-badge">
                  <span className="pp-green-pulse" /> Doctor Ready in Room
                </span>
                <h3 className="pp-doctor-name">
                  {roomMeta.doctorName || "Dr. Vasanth Zenve"}
                </h3>
                <p className="pp-doctor-clinic">
                  {roomMeta.clinicName || "Global Veterinary Hospital"}
                </p>
              </div>
            </div>

            <form className="pp-join-form" onSubmit={handleJoinMeeting}>
              <h2 className="pp-form-title">Join Video Consultation</h2>
              <p className="pp-form-sub">
                Please enter your information to enter the consultation room.
              </p>

              <div className="pp-input-group">
                <label className="pp-input-label">Pet Parent Name *</label>
                <input
                  type="text"
                  className="pp-text-input"
                  placeholder="e.g. Rahul Sharma"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  required
                />
              </div>

              <div className="pp-input-group">
                <label className="pp-input-label">Pet Name & Breed</label>
                <input
                  type="text"
                  className="pp-text-input"
                  placeholder="e.g. Bruno (Golden Retriever)"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                />
              </div>

              <div className="pp-security-disclaimer">
                <ShieldCheck size={16} />
                <span>
                  Meeting links are <strong>single-use</strong> and auto-expire after this consultation.
                </span>
              </div>

              <button type="submit" className="btn-pp-join-primary">
                <Video size={18} />
                <span>Join Consultation Room</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ACTIVE TELEHEALTH VIDEO ROOM FOR PET PARENT
  // =========================================================================
  return (
    <div className="pp-room-container in-call-state">
      {/* Top Header */}
      <header className="pp-incall-header">
        <div className="pp-incall-header-left">
          <div className="pp-brand-logo-mini">
            <FaPaw size={14} />
          </div>
          <div className="pp-incall-call-info">
            <strong className="pp-incall-doctor-title">
              {roomMeta.doctorName || "Dr. Vasanth Zenve"}
            </strong>
            <span className="pp-incall-clinic-title">
              {roomMeta.clinicName || "Global Veterinary Hospital"}
            </span>
          </div>
        </div>

        <div className="pp-incall-header-center">
          <div className="pp-incall-timer-badge">
            <Clock size={13} />
            <span>{formatDuration(callDuration)}</span>
          </div>
          <span className="pp-incall-hd-badge">1080p WebRTC Encrypted</span>
        </div>

        <div className="pp-incall-header-right">
          <button
            type="button"
            className={`btn-pp-chat-toggle ${chatOpen ? "active" : ""}`}
            onClick={() => setChatOpen((prev) => !prev)}
            title="Open Chat Messages"
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>

          <button
            type="button"
            className="btn-pp-leave-call"
            onClick={handleLeaveCall}
            title="Leave Call"
          >
            <PhoneOff size={15} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <div className="pp-incall-stage-wrap">
        <main className="pp-incall-video-stage">
          {viewLayout === "faceToFace" ? (
            /* FACE-TO-FACE DUAL OPEN CAMERAS GRID */
            <div className="pp-f2f-grid">
              {/* Left Tile: Attending Veterinarian */}
              <div className="pp-f2f-tile doctor-tile">
                {remoteDoctorConnected ? (
                  <video
                    ref={(el) => {
                      remoteDoctorVideoRef.current = el;
                      if (el && remoteDoctorStreamRef.current && el.srcObject !== remoteDoctorStreamRef.current) {
                        el.srcObject = remoteDoctorStreamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    className="pp-f2f-video-feed"
                  />
                ) : (
                  <img
                    src="/images/telehealth-pet-patient.jpg"
                    alt="Veterinarian Consultation Room"
                    className="pp-f2f-video-feed"
                  />
                )}

                <div className="pp-f2f-hud-top">
                  <div className="pp-f2f-name-badge">
                    <span className="pp-green-pulse" />
                    <span>{roomMeta.doctorName || "Dr. Vasanth Zenve"}</span>
                  </div>
                  <div className="pp-f2f-status-pill">
                    <Activity size={12} />
                    <span>{remoteDoctorConnected ? "Live Doctor Camera" : "Doctor in Room"}</span>
                  </div>
                </div>

                <div className="pp-f2f-hud-bottom">
                  <div className="pp-f2f-info-pill">
                    <strong>Clinic:</strong> {roomMeta.clinicName || "Global Veterinary Hospital"}
                  </div>
                  <div className="pp-f2f-audio-indicator">
                    <span>1080p HD</span>
                  </div>
                </div>
              </div>

              {/* Right Tile: Pet Parent & Pet Live Camera */}
              <div className="pp-f2f-tile parent-tile">
                {!isVideoOff ? (
                  cameraError && !cameraActive ? (
                    <div className="pp-camera-error-view">
                      <VideoOff size={40} className="pp-cam-err-icon" />
                      <p className="pp-cam-err-title">Camera Permission Needed</p>
                      <p className="pp-cam-err-desc">
                        Please allow camera permissions in your browser or connect a webcam to show your face.
                      </p>
                      <button
                        type="button"
                        className="btn-pp-retry-cam"
                        onClick={() => startMediaStream()}
                      >
                        <RefreshCw size={14} /> Allow / Retry Camera
                      </button>
                    </div>
                  ) : (
                    <video
                      ref={(el) => {
                        localVideoRef.current = el;
                        if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                          el.srcObject = localStreamRef.current;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="pp-f2f-video-feed mirrored"
                    />
                  )
                ) : (
                  <div className="pp-local-pip-off" style={{ width: "100%", height: "100%" }}>
                    <VideoOff size={36} />
                    <p style={{ margin: 0 }}>Your Camera is Off</p>
                    <button
                      type="button"
                      className="btn-pp-turnon-cam"
                      onClick={handleToggleVideo}
                    >
                      Turn On Camera
                    </button>
                  </div>
                )}

                <div className="pp-f2f-hud-top">
                  <div className="pp-f2f-name-badge">
                    <span className="pp-green-pulse" />
                    <span>{parentName || "You"} ({petName || "Pet"})</span>
                  </div>
                  <div className="pp-f2f-status-pill">
                    <span>
                      {isVideoOff
                        ? "Camera Off"
                        : cameraActive
                        ? "Your Camera Open"
                        : cameraError
                        ? "Camera Inactive"
                        : "Connecting Camera..."}
                    </span>
                  </div>
                </div>

                <div className="pp-f2f-hud-bottom">
                  <div className="pp-f2f-info-pill">
                    <strong>Patient:</strong> {petName || "Pet Patient"}
                  </div>
                  <div className={`pp-f2f-audio-indicator ${isMicMuted ? "muted" : ""}`}>
                    {isMicMuted ? <MicOff size={12} /> : <Mic size={12} />}
                    <span>{isMicMuted ? "Muted" : "Live Audio"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SPOTLIGHT VIEW */
            <div className="pp-doctor-feed-container">
              {remoteDoctorConnected ? (
                <video
                  ref={(el) => {
                    remoteDoctorVideoRef.current = el;
                    if (el && remoteDoctorStreamRef.current && el.srcObject !== remoteDoctorStreamRef.current) {
                      el.srcObject = remoteDoctorStreamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className="pp-doctor-feed-image"
                />
              ) : (
                <img
                  src="/images/telehealth-pet-patient.jpg"
                  alt="Veterinarian Consultation Room"
                  className="pp-doctor-feed-image"
                />
              )}

              {/* Doctor HUD */}
              <div className="pp-doctor-hud-overlay">
                <div className="pp-hud-chip">
                  <span className="pp-green-pulse" />
                  <span>{roomMeta.doctorName || "Dr. Vasanth Zenve (Attending Vet)"}</span>
                </div>
                <div className="pp-hud-live-tag">
                  <Activity size={12} />
                  <span>{remoteDoctorConnected ? "Live Doctor Feed" : "Doctor in Room"}</span>
                </div>
              </div>

              {/* Local Pet Parent Camera PIP */}
              <div className="pp-local-pip">
                {!isVideoOff ? (
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                        el.srcObject = localStreamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="pp-local-pip-video"
                  />
                ) : (
                  <div className="pp-local-pip-off">
                    <VideoOff size={24} />
                    <span>Camera Off</span>
                  </div>
                )}
                <div className="pp-local-pip-name">
                  <span>{parentName || "You"} ({petName || "Pet"})</span>
                  {isMicMuted && <MicOff size={11} className="pp-pip-muted-icon" />}
                </div>
              </div>
            </div>
          )}

          {/* Floating Controls Dock */}
          <div className="pp-floating-dock">
            <button
              type="button"
              className={`pp-dock-btn ${isMicMuted ? "muted" : "active"}`}
              onClick={handleToggleMic}
              title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              type="button"
              className={`pp-dock-btn ${isVideoOff ? "muted" : "active"}`}
              onClick={handleToggleVideo}
              title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            <button
              type="button"
              className={`pp-dock-btn ${viewLayout === "faceToFace" ? "highlight" : "active"}`}
              onClick={() => setViewLayout((prev) => (prev === "faceToFace" ? "spotlight" : "faceToFace"))}
              title={viewLayout === "faceToFace" ? "Switch to Spotlight View" : "Face-to-Face Dual Cameras"}
            >
              <Users size={20} />
            </button>

            <button
              type="button"
              className="pp-dock-btn active"
              onClick={handleFlipCamera}
              title="Switch Front/Rear Camera"
            >
              <RefreshCw size={20} />
            </button>

            <button
              type="button"
              className={`pp-dock-btn ${chatOpen ? "highlight" : "active"}`}
              onClick={() => setChatOpen((prev) => !prev)}
              title="Chat Notes"
            >
              <MessageSquare size={20} />
            </button>

            <button
              type="button"
              className="pp-dock-btn end-call"
              onClick={handleLeaveCall}
              title="Leave Room"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </main>

        {/* In-Call Text Chat Drawer */}
        {chatOpen && (
          <aside className="pp-chat-drawer">
            <div className="pp-chat-header">
              <div className="pp-chat-title-row">
                <MessageSquare size={16} />
                <h3>Consultation Messages</h3>
              </div>
              <button
                type="button"
                className="btn-pp-chat-close"
                onClick={() => setChatOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="pp-chat-messages">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`pp-chat-bubble ${msg.sender === "parent" ? "sent" : "received"} ${
                    msg.sender === "system" ? "system" : ""
                  }`}
                >
                  {msg.senderName && <span className="pp-bubble-sender">{msg.senderName}</span>}
                  <p className="pp-bubble-text">{msg.text}</p>
                  <span className="pp-bubble-time">{msg.time}</span>
                </div>
              ))}
            </div>

            <form className="pp-chat-input-row" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="pp-chat-input"
                placeholder="Type a message to doctor..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-pp-chat-send" title="Send message">
                <Send size={15} />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
