/**
 * Telehealth WebRTC Peer-to-Peer Manager
 * Connects Doctor and Pet Parent live video feeds across tabs/devices
 * using native RTCPeerConnection and BroadcastChannel signaling.
 */

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class TelehealthPeer {
  constructor({ roomId, role = "doctor", localStream = null, onRemoteStream = null, onConnectionStateChange = null }) {
    this.roomId = roomId;
    this.role = role;
    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    this.peerConnection = null;
    this.channel = null;
    this.isDestroyed = false;

    this.initChannel();
    this.initPeerConnection();
  }

  initChannel() {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    try {
      this.channel = new BroadcastChannel(`zenve_webrtc_${this.roomId}`);
      this.channel.onmessage = (e) => this.handleSignalMessage(e.data);

      // Announce presence
      setTimeout(() => {
        this.sendSignal({ type: "PEER_JOINED", role: this.role });
      }, 500);
    } catch (err) {
      console.warn("BroadcastChannel error in WebRTC:", err);
    }
  }

  sendSignal(data) {
    if (this.channel && !this.isDestroyed) {
      try {
        this.channel.postMessage({ ...data, senderRole: this.role, roomId: this.roomId });
      } catch (err) {
        console.warn("Signal send failed:", err);
      }
    }
  }

  initPeerConnection() {
    if (typeof window === "undefined" || !("RTCPeerConnection" in window)) return;

    try {
      this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Handle incoming remote stream tracks
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (this.onRemoteStream) {
            this.onRemoteStream(event.streams[0]);
          }
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({ type: "ICE_CANDIDATE", candidate: event.candidate });
        }
      };

      // Connection state changes
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

  async handleSignalMessage(message) {
    if (!message || message.senderRole === this.role || this.isDestroyed) return;

    const { type, sdp, candidate, role } = message;

    try {
      if (type === "PEER_JOINED") {
        if (this.role === "doctor") {
          await this.createAndSendOffer();
        } else if (this.role === "parent") {
          this.sendSignal({ type: "PEER_READY", role: "parent" });
        }
      } else if (type === "PEER_READY") {
        if (this.role === "doctor") {
          await this.createAndSendOffer();
        }
      } else if (type === "OFFER" && sdp) {
        if (!this.peerConnection) this.initPeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.sendSignal({ type: "ANSWER", sdp: this.peerConnection.localDescription });
      } else if (type === "ANSWER" && sdp) {
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } else if (type === "ICE_CANDIDATE" && candidate) {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.warn("Signal handling error:", err);
    }
  }

  async createAndSendOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
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
  }
}
