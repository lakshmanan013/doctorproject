import React, { useState, useEffect, useRef, useCallback } from "react";
import Video from "twilio-video";
import axios from "axios";
import {
  Video as VideoIcon,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Users,
  MessageSquare,
  Maximize2,
  Minimize2,
  Activity,
  Send,
  X,
  Check,
  Copy,
  LayoutGrid,
  User,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  broadcastTelehealthEvent,
  subscribeTelehealthEvents,
} from "../../utils/telehealthRoomManager";
import "./TwilioConsultationRoom.css";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function TwilioConsultationRoom({
  roomName = "ZenveConsultationRoom",
  identity = "Participant",
  displayName = "User",
  role = "patient", // "doctor" | "patient"
  patientName = "Pet Patient",
  doctorName = "Dr. Attending Vet",
  reason = "Telehealth Video Consultation",
  onLeave = () => { },
  showClinicalDrawer = false,
  clinicalDrawerComponent = null,
}) {
  // Call status
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [providerMode, setProviderMode] = useState("twilio"); // "twilio" | "webrtc_hd"
  const [callDuration, setCallDuration] = useState(0);

  // Audio / Video states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Layout & UI
  const [viewMode, setViewMode] = useState("gallery"); // "gallery" | "speaker"
  const [activeDrawer, setActiveDrawer] = useState(showClinicalDrawer ? "clinical" : null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: "System",
      text: "Welcome to Zenve Video Consultation. Audio & video are encrypted HD.",
      time: "Now",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Remote participant info
  const [remoteConnected, setRemoteConnected] = useState(false);

  // Media Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const roomContainerRef = useRef(null);

  // Active instances refs
  const twilioRoomRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnRef = useRef(null);
  const signalTimerRef = useRef(null);
  const lastSignalIdRef = useRef(0);
  const broadcastChannelRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const isCreatingOffer = useRef(false);

  // Stable references for props to prevent re-renders tearing down WebRTC
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  const identityRef = useRef(identity);
  identityRef.current = identity;

  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;

  const roleRef = useRef(role);
  roleRef.current = role;

  // -------------------------------------------------------------
  // 1. Call Duration Timer
  // -------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // -------------------------------------------------------------
  // Signaling & Handlers
  // -------------------------------------------------------------
  const cleanupConnection = useCallback(() => {
    if (signalTimerRef.current) {
      clearInterval(signalTimerRef.current);
      signalTimerRef.current = null;
    }
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.close();
      } catch (_err) {
        void _err;
      }
      broadcastChannelRef.current = null;
    }
    if (peerConnRef.current) {
      try {
        peerConnRef.current.close();
      } catch (_err) {
        void _err;
      }
      peerConnRef.current = null;
    }
    if (twilioRoomRef.current) {
      try {
        twilioRoomRef.current.disconnect();
      } catch (_err) {
        void _err;
      }
      twilioRoomRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    iceCandidatesQueue.current = [];
  }, []);

  const sendSignal = useCallback(async (signalData) => {
    const payload = {
      sender: identityRef.current,
      senderRole: roleRef.current,
      room: roomNameRef.current,
      ...signalData,
    };
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(payload);
      } catch (_err) {
        void _err;
      }
    }
    try {
      await axios.post("/api/doctors/twilio/signal/", {
        room: roomNameRef.current,
        sender: identityRef.current,
        data: payload,
      });
    } catch (_err) {
      void _err;
    }
  }, []);

  const createAndSendOffer = useCallback(async () => {
    const pc = peerConnRef.current;
    if (!pc || isCreatingOffer.current) return;
    try {
      isCreatingOffer.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      await sendSignal({ type: "OFFER", sdp: pc.localDescription });
    } catch (e) {
      console.warn("Offer creation error:", e);
    } finally {
      isCreatingOffer.current = false;
    }
  }, [sendSignal]);

  const handleSignalMessage = useCallback(async (msg) => {
    if (!msg) return;
    const sender = msg.sender || msg.senderRole;
    if (sender === identityRef.current) return;

    const rawType = (msg.type || "").toUpperCase();

    // Check for call termination signal from Doctor
    if (rawType === "END_CALL" || rawType === "CALL_ENDED" || rawType === "ROOM_COMPLETED") {
      if (roleRef.current !== "doctor") {
        toast("The doctor has ended the consultation.", { icon: "📞" });
        cleanupConnection();
        onLeaveRef.current?.({ endedByDoctor: true, reason: "doctor_ended_signal" });
        return;
      }
    }

    const pc = peerConnRef.current;
    if (!pc) return;

    try {
      if (rawType === "PEER_JOINED" || rawType === "PEER_READY" || rawType === "JOIN") {
        if (roleRef.current === "doctor") {
          // Doctor creates & dispatches offer whenever patient arrives
          await createAndSendOffer();
        } else {
          sendSignal({ type: "PEER_READY", role: "patient" });
        }
      } else if (rawType === "OFFER" && roleRef.current !== "doctor") {
        const sdp = msg.sdp || msg;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        // Flush queued ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const cand = iceCandidatesQueue.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (_e) {}
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ type: "ANSWER", sdp: pc.localDescription });
        setRemoteConnected(true);
      } else if (rawType === "ANSWER" && roleRef.current === "doctor") {
        if (pc.signalingState !== "stable") {
          const sdp = msg.sdp || msg;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          // Flush queued ICE candidates
          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (_e) {}
          }
          setRemoteConnected(true);
        }
      } else if (rawType === "ICE_CANDIDATE" || rawType === "CANDIDATE") {
        const candidate = msg.candidate || msg;
        if (candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (_e) {}
          } else {
            iceCandidatesQueue.current.push(candidate);
          }
        }
      } else if (rawType === "CHAT") {
        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            sender: msg.senderName || "Remote User",
            text: msg.text,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      console.warn("Signal processing error:", err);
    }
  }, [cleanupConnection, createAndSendOffer, sendSignal]);

  const pollSignals = useCallback(async () => {
    try {
      const res = await axios.get(
        `/api/doctors/twilio/signal/?room=${encodeURIComponent(
          roomNameRef.current
        )}&since=${lastSignalIdRef.current}&sender=${encodeURIComponent(identityRef.current)}`
      );
      if (res.data) {
        const msgs = res.data.messages || [];
        if (res.data.latest_id) {
          lastSignalIdRef.current = res.data.latest_id;
        }
        msgs.forEach((m) => {
          if (m.data) {
            handleSignalMessage(m.data);
          }
        });
      }
    } catch (_err) {
      void _err;
    }
  }, [handleSignalMessage]);

  const handleTwilioParticipant = useCallback((participant) => {
    setRemoteConnected(true);

    const subscribeTrack = (track) => {
      if (track.kind === "video" && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      } else if (track.kind === "audio" && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
    };

    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed && publication.track) {
        subscribeTrack(publication.track);
      }
    });

    participant.on("trackSubscribed", subscribeTrack);
    participant.on("trackUnsubscribed", (track) => {
      track.detach();
    });
  }, []);

  const startWebRtcFallback = useCallback((localStream) => {
    setConnectionStatus("connected");

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        broadcastChannelRef.current = new BroadcastChannel(`zenve_webrtc_${roomNameRef.current}`);
        broadcastChannelRef.current.onmessage = (e) => {
          if (e.data && e.data.sender !== identityRef.current) {
            handleSignalMessage(e.data);
          }
        };
      } catch (_err) {
        void _err;
      }
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnRef.current = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {
            /* Autoplay handled by browser */
          });
        }
        setRemoteConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "ICE_CANDIDATE", candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setRemoteConnected(true);
      } else if (
        (state === "disconnected" || state === "closed" || state === "failed") &&
        roleRef.current !== "doctor"
      ) {
        setTimeout(() => {
          if (peerConnRef.current && peerConnRef.current.connectionState !== "connected") {
            toast("Doctor has ended the consultation.", { icon: "👋" });
            cleanupConnection();
            onLeaveRef.current?.({ endedByDoctor: true, reason: "doctor_peer_disconnected" });
          }
        }, 1200);
      }
    };

    // Announce presence to peer
    sendSignal({ type: "PEER_JOINED", role: roleRef.current });

    if (roleRef.current === "doctor") {
      setTimeout(() => {
        createAndSendOffer();
      }, 600);
    }

    pollSignals();
    if (signalTimerRef.current) clearInterval(signalTimerRef.current);
    signalTimerRef.current = setInterval(pollSignals, 900);
  }, [cleanupConnection, createAndSendOffer, handleSignalMessage, pollSignals, sendSignal]);

  // -------------------------------------------------------------
  // 2. Fetch Token & Connect
  // -------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const initConnection = async () => {
      try {
        setConnectionStatus("connecting");

        // 1. Get user media (webcam + mic) - reuse stream if already alive to avoid camera blinking
        let localStream = localStreamRef.current;
        const isStreamActive =
          localStream &&
          localStream.active &&
          localStream.getVideoTracks().some((t) => t.readyState === "live");

        if (!isStreamActive) {
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            localStreamRef.current = localStream;
          } catch (mediaErr) {
            console.warn("Could not capture local media:", mediaErr);
            toast.error("Webcam or Microphone permission required.");
          }
        }

        if (localVideoRef.current && localStream) {
          if (localVideoRef.current.srcObject !== localStream) {
            localVideoRef.current.srcObject = localStream;
          }
          localVideoRef.current.play().catch(() => {
            /* Autoplay handled by user action */
          });
        }

        // 2. Request Twilio Token from backend
        let tokenData = null;
        try {
          const res = await axios.get(
            `/api/doctors/twilio/token/?room_name=${encodeURIComponent(
              roomName
            )}&identity=${encodeURIComponent(identity)}&role=${role}`
          );
          tokenData = res.data;
        } catch (tokenErr) {
          console.warn("Backend token fetch error, using fallback:", tokenErr);
        }

        if (isCancelled) return;

        // 3. If Live Twilio is enabled, connect via Twilio SDK
        if (tokenData && tokenData.is_live_twilio && tokenData.token) {
          setProviderMode("twilio");
          try {
            const room = await Video.connect(tokenData.token, {
              name: roomName,
              audio: true,
              video: { width: 1280, height: 720 },
            });

            if (isCancelled) {
              room.disconnect();
              return;
            }

            twilioRoomRef.current = room;
            setConnectionStatus("connected");
            toast.success("Connected to Twilio HD Room");

            // Attach local video track
            room.localParticipant.videoTracks.forEach((publication) => {
              if (publication.track && localVideoRef.current) {
                publication.track.attach(localVideoRef.current);
              }
            });

            // Handle existing participants
            room.participants.forEach(handleTwilioParticipant);

            // Handle incoming participants
            room.on("participantConnected", (p) => {
              handleTwilioParticipant(p);
              toast.success(`${p.identity || "Participant"} joined the call!`);
            });

            room.on("participantDisconnected", (p) => {
              setRemoteConnected(false);
              const isDoctor =
                (p.identity || "").toLowerCase().includes("doctor") ||
                roleRef.current !== "doctor";

              if (isDoctor && roleRef.current !== "doctor") {
                toast("Doctor has ended the video consultation.", { icon: "👋" });
                cleanupConnection();
                onLeaveRef.current?.({ endedByDoctor: true, reason: "doctor_disconnected" });
              } else {
                toast.info(`${p.identity || "Participant"} left the call.`);
              }
            });

            room.on("disconnected", () => {
              setConnectionStatus("disconnected");
              if (roleRef.current !== "doctor") {
                cleanupConnection();
                onLeaveRef.current?.({ endedByDoctor: true, reason: "room_disconnected" });
              }
            });

            return;
          } catch (twilioErr) {
            console.warn("Twilio connect failed, falling back to WebRTC:", twilioErr);
          }
        }

        // 4. Fallback: High-Definition WebRTC Peer Connection with signaling
        setProviderMode("webrtc_hd");
        startWebRtcFallback(localStream);
      } catch (err) {
        console.error("Initialization error:", err);
        setConnectionStatus("disconnected");
      }
    };

    initConnection();

    return () => {
      isCancelled = true;
      cleanupConnection();
    };
  }, [roomName, identity, role]);

  // Subscribe to external telehealth room completion events
  useEffect(() => {
    const unsubscribe = subscribeTelehealthEvents((event) => {
      if (
        event?.type === "ROOM_COMPLETED" &&
        (event.roomCode === roomName || event.oldRoomCode === roomName || !event.roomCode)
      ) {
        if (role !== "doctor") {
          toast("The consultation was completed by your veterinarian.", { icon: "📋" });
          cleanupConnection();
          onLeave({ endedByDoctor: true, reason: "telehealth_event_completed" });
        }
      }
    });

    return () => unsubscribe();
  }, [cleanupConnection, onLeave, role, roomName]);

// -------------------------------------------------------------
// In-Call Controls (Zoom Toolbar)
// -------------------------------------------------------------
const toggleMute = () => {
  const next = !isMuted;
  setIsMuted(next);

  if (twilioRoomRef.current) {
    twilioRoomRef.current.localParticipant.audioTracks.forEach((pub) => {
      if (pub.track) {
        if (next) {
          pub.track.disable();
        } else {
          pub.track.enable();
        }
      }
    });
  }

  if (localStreamRef.current) {
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }

  toast(next ? "Microphone Muted" : "Microphone Active", {
    icon: next ? "🔇" : "🎙️",
  });
};

const toggleVideo = () => {
  const next = !isVideoOff;
  setIsVideoOff(next);

  if (twilioRoomRef.current) {
    twilioRoomRef.current.localParticipant.videoTracks.forEach((pub) => {
      if (pub.track) {
        if (next) {
          pub.track.disable();
        } else {
          pub.track.enable();
        }
      }
    });
  }

  if (localStreamRef.current) {
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  }

  toast(next ? "Camera Turned Off" : "Camera Turned On", {
    icon: next ? "🚫" : "📷",
  });
};

const toggleScreenShare = async () => {
  if (isScreenSharing) {
    setIsScreenSharing(false);
    toast("Screen sharing ended", { icon: "🖥️" });
    return;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setIsScreenSharing(true);
      toast.success("Sharing screen with consultation participants");

      const screenTrack = screenStream.getVideoTracks()[0];
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenTrack.onended = () => {
        setIsScreenSharing(false);
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      };
    } catch (err) {
      console.warn("Screen share cancelled:", err);
    }
  } else {
    toast.error("Screen sharing not supported on this browser.");
  }
};

  const handleDockEndCall = async () => {
    if (role === "doctor") {
      const confirmEnd = window.confirm(
        "End this consultation for both you and the patient? The meeting link will be completed."
      );
      if (!confirmEnd) return;

      // 1. Send signal through WebRTC & BroadcastChannel & API
      try {
        await sendSignal({
          type: "END_CALL",
          senderRole: "doctor",
          room: roomName,
          timestamp: Date.now(),
        });
      } catch (_err) {
        void _err;
      }

      // 2. Broadcast via cross-window telehealth event
      try {
        broadcastTelehealthEvent({
          type: "ROOM_COMPLETED",
          roomCode: roomName,
          doctorName,
          patientName,
        });
      } catch (_err) {
        void _err;
      }

      cleanupConnection();
      onLeave({ endedByDoctor: true, action: "doctor_end_call" });
    } else {
      const confirmLeave = window.confirm("Leave video consultation room?");
      if (!confirmLeave) return;

      cleanupConnection();
      onLeave({ endedByDoctor: false, action: "patient_leave" });
    }
  };

  const copyRoomLink = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url);
  setCopiedLink(true);
  toast.success("Meeting link copied to clipboard!");
  setTimeout(() => setCopiedLink(false), 2500);
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    roomContainerRef.current?.requestFullscreen?.();
    setIsFullscreen(true);
  } else {
    document.exitFullscreen?.();
    setIsFullscreen(false);
  }
};

const sendChatMessage = (e) => {
  e.preventDefault();
  if (!chatInput.trim()) return;

  const newMsg = {
    id: Date.now(),
    sender: displayName || identity,
    text: chatInput.trim(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  setChatMessages((prev) => [...prev, newMsg]);
  sendSignal({
    type: "chat",
    senderName: displayName || identity,
    text: chatInput.trim(),
  });
  setChatInput("");
};

const remoteLabel = role === "doctor" ? `${patientName} (Pet Parent)` : `Dr. ${doctorName} (Veterinarian)`;
const selfLabel = role === "doctor" ? `Dr. ${doctorName} (You)` : `${patientName} (You)`;

return (
  <div className={`twilio-zoom-container ${isFullscreen ? "is-fullscreen" : ""}`} ref={roomContainerRef}>
    <audio ref={remoteAudioRef} autoPlay />

    {/* TOP BAR */}
    <header className="twilio-zoom-header">
      <div className="tz-header-left">
        <div className="tz-logo-pill">
          <span className="tz-live-dot" />
          <span className="tz-brand-text">ZENVE TELEHEALTH</span>
            <span className="tz-provider-badge" title={`Status: ${connectionStatus}`}>
              {providerMode === "twilio" ? "Twilio Cloud HD" : "Encrypted WebRTC"}
            </span>
        </div>

        <div className="tz-meeting-meta">
          <span className="tz-meeting-title">
            {role === "doctor" ? `Consultation with ${patientName}` : `Consultation with Dr. ${doctorName}`}
          </span>
          <span className="tz-meeting-divider">•</span>
          <span className="tz-meeting-reason">{reason}</span>
        </div>
      </div>

      <div className="tz-header-center">
        <div className="tz-timer-pill">
          <Activity size={14} className="tz-pulse-icon" />
          <span>{formatTimer(callDuration)}</span>
        </div>
      </div>

      <div className="tz-header-right">
        <button
          type="button"
          className="tz-header-btn"
          onClick={copyRoomLink}
          title="Copy Meeting Link"
        >
          {copiedLink ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedLink ? "Copied" : "Copy Link"}</span>
        </button>

        <button
          type="button"
          className="tz-header-btn"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </header>

    {/* MAIN MEETING STAGE */}
    <div className="twilio-zoom-stage">
      {/* VIDEO GRID */}
      <div
        className={`twilio-zoom-grid ${viewMode === "gallery" ? "view-gallery" : "view-speaker"
          } ${activeDrawer ? "has-drawer" : ""}`}
      >
        {/* TILE 1: REMOTE PARTICIPANT */}
        <div className="tz-video-tile remote-tile">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`tz-video-element ${!remoteConnected ? "is-hidden" : ""}`}
          />

          {!remoteConnected && (
            <div className="tz-video-fallback">
              <div className="tz-avatar-circle">
                <User size={48} />
              </div>
              <h4>Waiting for {role === "doctor" ? patientName : `Dr. ${doctorName}`} to join...</h4>
              <p>Room Code: <strong>{roomName}</strong></p>
              <div className="tz-waiting-pill">
                <span className="tz-waiting-spinner" />
                <span>Ready for connection</span>
              </div>
            </div>
          )}

          <div className="tz-tile-hud-bottom">
            <div className="tz-tile-name-badge">
              <span className={`tz-audio-dot ${remoteConnected ? "live" : ""}`} />
              <span>{remoteLabel}</span>
            </div>
            <div className="tz-tile-status-tag">
              {remoteConnected ? "1080p HD" : "Connecting..."}
            </div>
          </div>
        </div>

        {/* TILE 2: LOCAL PARTICIPANT (YOU) */}
        <div className={`tz-video-tile local-tile ${viewMode === "speaker" ? "pip-mode" : ""}`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`tz-video-element mirrored ${isVideoOff ? "is-hidden" : ""}`}
          />

          {isVideoOff && (
            <div className="tz-video-fallback">
              <div className="tz-avatar-circle local-avatar">
                <User size={viewMode === "speaker" ? 28 : 44} />
              </div>
              <span>Camera Turned Off</span>
            </div>
          )}

          <div className="tz-tile-hud-bottom">
            <div className="tz-tile-name-badge">
              <span className={`tz-audio-dot ${!isMuted ? "live" : "muted"}`} />
              <span>{selfLabel}</span>
            </div>
            {isMuted && (
              <div className="tz-tile-muted-badge" title="Microphone muted">
                <MicOff size={12} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIDE DRAWER */}
      {activeDrawer && (
        <aside className="twilio-zoom-drawer">
          <div className="tz-drawer-header">
            <div className="tz-drawer-title">
              {activeDrawer === "chat" && (
                <>
                  <MessageSquare size={16} />
                  <span>In-Call Chat</span>
                </>
              )}
              {activeDrawer === "participants" && (
                <>
                  <Users size={16} />
                  <span>Participants (2)</span>
                </>
              )}
              {activeDrawer === "clinical" && (
                <>
                  <Sparkles size={16} />
                  <span>Clinical Prescription & Notes</span>
                </>
              )}
            </div>
            <button
              type="button"
              className="tz-drawer-close"
              onClick={() => setActiveDrawer(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="tz-drawer-body">
            {/* CHAT TAB */}
            {activeDrawer === "chat" && (
              <div className="tz-chat-wrapper">
                <div className="tz-chat-messages">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`tz-chat-msg ${msg.sender === (displayName || identity) ? "is-self" : ""
                        }`}
                    >
                      <div className="tz-msg-meta">
                        <span className="tz-msg-sender">{msg.sender}</span>
                        <span className="tz-msg-time">{msg.time}</span>
                      </div>
                      <p className="tz-msg-text">{msg.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChatMessage} className="tz-chat-input-form">
                  <input
                    type="text"
                    placeholder="Type message to room..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="tz-chat-input"
                  />
                  <button type="submit" className="tz-chat-send-btn">
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}

            {/* PARTICIPANTS TAB */}
            {activeDrawer === "participants" && (
              <div className="tz-participants-list">
                <div className="tz-participant-row">
                  <div className="tz-part-avatar">
                    <User size={16} />
                  </div>
                  <div className="tz-part-info">
                    <span className="tz-part-name">{selfLabel}</span>
                    <span className="tz-part-role">Host • Presenter</span>
                  </div>
                  <div className="tz-part-status">
                    {isMuted ? <MicOff size={14} className="text-red" /> : <Mic size={14} className="text-green" />}
                  </div>
                </div>

                <div className="tz-participant-row">
                  <div className="tz-part-avatar remote-avatar">
                    <User size={16} />
                  </div>
                  <div className="tz-part-info">
                    <span className="tz-part-name">{remoteLabel}</span>
                    <span className="tz-part-role">
                      {remoteConnected ? "Connected" : "Invited (Awaiting)"}
                    </span>
                  </div>
                  <div className="tz-part-status">
                    <span className={`tz-presence-dot ${remoteConnected ? "online" : "offline"}`} />
                  </div>
                </div>
              </div>
            )}

            {/* DOCTOR CLINICAL DRAWER */}
            {activeDrawer === "clinical" && (
              <div className="tz-clinical-panel">
                {clinicalDrawerComponent || (
                  <div className="tz-clinical-empty">
                    <p>Clinical notes module ready.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>

    {/* ZOOM FLOATING BOTTOM CONTROL BAR */}
    <footer className="twilio-zoom-dock">
      {/* 1. Mute / Unmute */}
      <button
        type="button"
        className={`tz-dock-btn ${isMuted ? "is-muted" : "is-active"}`}
        onClick={toggleMute}
        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        <span className="tz-dock-label">{isMuted ? "Unmute" : "Mute"}</span>
      </button>

      {/* 2. Start / Stop Video */}
      <button
        type="button"
        className={`tz-dock-btn ${isVideoOff ? "is-muted" : "is-active"}`}
        onClick={toggleVideo}
        title={isVideoOff ? "Start Camera" : "Stop Camera"}
      >
        {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
        <span className="tz-dock-label">{isVideoOff ? "Start Video" : "Stop Video"}</span>
      </button>

      {/* 3. Screen Sharing */}
      <button
        type="button"
        className={`tz-dock-btn ${isScreenSharing ? "is-highlight" : "is-active"}`}
        onClick={toggleScreenShare}
        title="Share Screen"
      >
        <Share2 size={20} />
        <span className="tz-dock-label">{isScreenSharing ? "Sharing" : "Share"}</span>
      </button>

      {/* 4. Layout Mode (Gallery / Speaker) */}
      <button
        type="button"
        className={`tz-dock-btn ${viewMode === "gallery" ? "is-highlight" : "is-active"}`}
        onClick={() => setViewMode((prev) => (prev === "gallery" ? "speaker" : "gallery"))}
        title="Switch View Mode"
      >
        <LayoutGrid size={20} />
        <span className="tz-dock-label">{viewMode === "gallery" ? "Gallery" : "Speaker"}</span>
      </button>

      {/* 5. Participants Drawer */}
      <button
        type="button"
        className={`tz-dock-btn ${activeDrawer === "participants" ? "is-highlight" : "is-active"}`}
        onClick={() => setActiveDrawer((prev) => (prev === "participants" ? null : "participants"))}
        title="Show Participants"
      >
        <Users size={20} />
        <span className="tz-dock-label">People</span>
      </button>

      {/* 6. In-Call Chat */}
      <button
        type="button"
        className={`tz-dock-btn ${activeDrawer === "chat" ? "is-highlight" : "is-active"}`}
        onClick={() => setActiveDrawer((prev) => (prev === "chat" ? null : "chat"))}
        title="In-Meeting Chat"
      >
        <MessageSquare size={20} />
        <span className="tz-dock-label">Chat</span>
      </button>

      {/* 7. Doctor Clinical Tools */}
      {clinicalDrawerComponent && (
        <button
          type="button"
          className={`tz-dock-btn ${activeDrawer === "clinical" ? "is-highlight" : "is-active"}`}
          onClick={() => setActiveDrawer((prev) => (prev === "clinical" ? null : "clinical"))}
          title="Prescription & Vitals Drawer"
        >
          <Sparkles size={20} />
          <span className="tz-dock-label">Prescription</span>
        </button>
      )}

      {/* 8. End / Leave Call */}
      <button
        type="button"
        className="tz-dock-btn tz-btn-leave"
        onClick={handleDockEndCall}
        title={role === "doctor" ? "End Call for Both" : "Leave Meeting"}
      >
        <PhoneOff size={20} />
        <span className="tz-dock-label">{role === "doctor" ? "End Call" : "Leave"}</span>
      </button>
    </footer>
  </div>
);
}
