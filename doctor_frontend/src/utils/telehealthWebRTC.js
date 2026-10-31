/**
 * Telehealth WebRTC Peer-to-Peer Manager
 * Connects Doctor and Pet Parent live video feeds across tabs/devices
 * using native RTCPeerConnection, BroadcastChannel, and HTTP polling fallback.
 */
import axios from "axios";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class TelehealthPeer {
  constructor({ roomId, role = "doctor", localStream = null, onRemoteStream = null, onConnectionStateChange = null, onCallEnded = null }) {
    this.roomId = roomId;
    this.role = role;
    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onCallEnded = onCallEnded;

    this.peerConnection = null;
    this.channel = null;
    this.isDestroyed = false;
    this.iceCandidatesQueue = [];
    this.signalTimer = null;
    this.lastSignalId = 0;

    this.initChannel();
    this.initPeerConnection();
    this.startSignalPolling();
  }

  initChannel() {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    try {
      this.channel = new BroadcastChannel(`zenve_webrtc_${this.roomId}`);
      this.channel.onmessage = (e) => this.handleSignalMessage(e.data);

      setTimeout(() => {
        this.sendSignal({ type: "PEER_JOINED", role: this.role });
      }, 300);
    } catch (err) {
      console.warn("BroadcastChannel error in WebRTC:", err);
    }
  }

  sendSignal(data) {
    if (this.isDestroyed) return;

    const payload = { ...data, senderRole: this.role, sender: this.role, roomId: this.roomId, room: this.roomId };

    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn("Signal broadcast failed:", err);
      }
    }

    try {
      axios.post("/api/doctors/twilio/signal/", {
        room: this.roomId,
        sender: this.role,
        data: payload,
      }).catch(() => {});
    } catch (_err) {}
  }

  startSignalPolling() {
    this.pollSignals();
    this.signalTimer = setInterval(() => {
      this.pollSignals();
    }, 900);
  }

  async pollSignals() {
    if (this.isDestroyed) return;
    try {
      const res = await axios.get(
        `/api/doctors/twilio/signal/?room=${encodeURIComponent(this.roomId)}&since=${this.lastSignalId}&sender=${encodeURIComponent(this.role)}`
      );
      if (res.data) {
        const msgs = res.data.messages || [];
        if (res.data.latest_id) {
          this.lastSignalId = res.data.latest_id;
        }
        for (const m of msgs) {
          if (m.data) {
            this.handleSignalMessage(m.data);
          }
        }
      }
    } catch (_err) {}
  }

  initPeerConnection() {
    if (typeof window === "undefined" || !("RTCPeerConnection" in window)) return;

    try {
      this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (this.onRemoteStream) {
            this.onRemoteStream(event.streams[0]);
          }
        }
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({ type: "ICE_CANDIDATE", candidate: event.candidate });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(state);
        }
      };
    } catch (err) {
      console.warn("RTCPeerConnection init error:", err);
    }
  }

  async flushIceCandidates() {
    if (!this.peerConnection) return;
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_e) {}
    }
  }

  async handleSignalMessage(message) {
    if (!message || this.isDestroyed) return;

    const sender = message.sender || message.senderRole;
    if (sender === this.role) return;

    const rawType = (message.type || "").toUpperCase();
    const sdp = message.sdp || message;
    const candidate = message.candidate || message;

    try {
      if (rawType === "END_CALL" || rawType === "ROOM_COMPLETED" || rawType === "CALL_ENDED") {
        if (this.onCallEnded) {
          this.onCallEnded(message);
        }
        return;
      }

      if (rawType === "PEER_JOINED" || rawType === "PEER_READY" || rawType === "JOIN") {
        if (this.role === "doctor") {
          await this.createAndSendOffer();
        } else {
          this.sendSignal({ type: "PEER_READY", role: "parent" });
        }
      } else if (rawType === "OFFER" && sdp) {
        if (!this.peerConnection) this.initPeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.flushIceCandidates();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.sendSignal({ type: "ANSWER", sdp: this.peerConnection.localDescription });
      } else if (rawType === "ANSWER" && sdp) {
        if (this.peerConnection && this.peerConnection.signalingState !== "stable") {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
          await this.flushIceCandidates();
        }
      } else if (rawType === "ICE_CANDIDATE" || rawType === "CANDIDATE") {
        if (candidate) {
          if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (_e) {}
          } else {
            this.iceCandidatesQueue.push(candidate);
          }
        }
      }
    } catch (err) {
      console.warn("Signal handling error:", err);
    }
  }

  async createAndSendOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);
      this.sendSignal({ type: "OFFER", sdp: this.peerConnection.localDescription });
    } catch (err) {
      console.warn("Create offer error:", err);
    }
  }

  updateLocalStream(newStream) {
    this.localStream = newStream;
    if (!this.peerConnection || !newStream) return;

    try {
      const senders = this.peerConnection.getSenders();
      newStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          this.peerConnection.addTrack(track, newStream);
        }
      });
    } catch (err) {
      console.warn("Update local stream error:", err);
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.signalTimer) {
      clearInterval(this.signalTimer);
      this.signalTimer = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch (e) {}
      this.channel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    this.iceCandidatesQueue = [];
  }
}
