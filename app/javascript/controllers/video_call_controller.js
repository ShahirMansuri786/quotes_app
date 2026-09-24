import { Controller } from "@hotwired/stimulus"
import {
  startVideoCall,
  acceptVideoCall,
  rejectVideoCall,
  endVideoCall,
  sendVideoSignal
} from "channels/chat_channel"

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
}

export default class extends Controller {
  static targets = [
    "modal",
    "incomingModal",
    "outgoingModal",
    "activeModal",
    "callerName",
    "incomingCallerName",
    "incomingAvatar",
    "outgoingAvatar",
    "localVideo",
    "remoteVideo",
    "remoteMutedBadge",
    "remoteCameraOffOverlay",
    "remoteAvatarInitial",
    "callStatus",
    "callTimer",
    "audioBtn",
    "videoBtn",
    // Voice call specific targets
    "voiceCallCard",
    "videoFeedWrapper",
    "videoBtnWrapper",
    "incomingCallTitle",
    "outgoingCallTitle",
    "headerOverlay",
    "remoteAudio"
  ]

  connect() {
    this.conversationId = this.element.dataset.conversationId
    this.currentUserId = this.element.dataset.currentUserId
    this.currentUserName = this.element.dataset.currentUserName || "User"
    this.otherUserId = this.element.dataset.otherUserId
    this.otherUserName = this.element.dataset.otherUserName || "User"

    this.callState = "idle" // 'idle' | 'outgoing' | 'incoming' | 'connected'
    this.peerConnection = null
    this.localStream = null
    this.remoteStream = null
    this.isAudioMuted = false
    this.isVideoOff = false
    this.currentCallType = "video" // 'video' | 'voice'

    this.boundHandleVideoCallEvent = this.handleVideoCallEvent.bind(this)
    window.addEventListener("chat:video-call-event", this.boundHandleVideoCallEvent)

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("auto_accept") === "true") {
      const returnTo = urlParams.get("return_to")
      if (returnTo) {
        this.returnToUrl = decodeURIComponent(returnTo)
      }

      const callType = urlParams.get("call_type") || "video"
      this.currentCallType = callType

      // Remove ?auto_accept=true, return_to, and call_type from URL immediately so page refresh
      // does not re-trigger auto-accept
      urlParams.delete("auto_accept")
      urlParams.delete("return_to")
      urlParams.delete("call_type")
      const newSearch = urlParams.toString()
      const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "")
      history.replaceState(null, "", newUrl)

      this.callState = "incoming"
      this.activeCallerId = this.otherUserId
      setTimeout(() => {
        this.acceptIncomingCall()
      }, 300)
    }
  }

  disconnect() {
    window.removeEventListener("chat:video-call-event", this.boundHandleVideoCallEvent)
    this.cleanupCall()
  }

  // Action: Triggered by user clicking "Video Call" button in chat header
  startCall(event) {
    if (event) event.preventDefault()
    if (this.callState !== "idle") {
      this.cleanupCall()
    }

    this.currentCallType = "video"
    this.callState = "outgoing"
    this.showModal("outgoing")
    this.playRingtone("outgoing")

    if (this.hasCallerNameTarget) {
      this.callerNameTarget.textContent = this.otherUserName
    }
    if (this.hasOutgoingAvatarTarget) {
      this.outgoingAvatarTarget.textContent = (this.otherUserName || "U").charAt(0).toUpperCase()
    }
    if (this.hasOutgoingCallTitleTarget) {
      this.outgoingCallTitleTarget.textContent = "Calling..."
    }

    startVideoCall(this.currentUserId, this.currentUserName, "video")
  }

  // Action: Triggered by user clicking "Voice Call" button in chat header
  startVoiceCall(event) {
    if (event) event.preventDefault()
    if (this.callState !== "idle") {
      this.cleanupCall()
    }

    this.currentCallType = "voice"
    this.callState = "outgoing"
    this.showModal("outgoing")
    this.playRingtone("outgoing")

    if (this.hasCallerNameTarget) {
      this.callerNameTarget.textContent = this.otherUserName
    }
    if (this.hasOutgoingAvatarTarget) {
      this.outgoingAvatarTarget.textContent = (this.otherUserName || "U").charAt(0).toUpperCase()
    }
    if (this.hasOutgoingCallTitleTarget) {
      this.outgoingCallTitleTarget.textContent = "Voice Calling..."
    }

    startVideoCall(this.currentUserId, this.currentUserName, "voice")
  }

  // Action: Triggered when receiver clicks "Accept Call"
  async acceptIncomingCall() {
    if (this.callState !== "incoming") return

    this.stopRingtone()
    this.callState = "connecting"
    this.showModal("active")

    acceptVideoCall(this.currentUserId)

    const success = await this.setupLocalStream()
    if (!success) {
      this.endCall()
      return
    }

    this.initPeerConnection()

    // Create and send WebRTC Offer
    try {
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)
      sendVideoSignal("offer", offer, this.currentUserId, this.activeCallerId)
    } catch (err) {
      console.error("Error creating WebRTC offer:", err)
      this.endCall()
    }
  }

  // Action: Triggered when receiver clicks "Reject Call"
  rejectIncomingCall() {
    this.stopRingtone()
    rejectVideoCall(this.currentUserId)
    this.cleanupCall()
  }

  // Action: Triggered when either user clicks "End Call" or "Cancel"
  endCall() {
    if (this.callState === "idle") return

    endVideoCall(this.currentUserId)
    this.cleanupCall()
  }

  // Toggle Audio Mute
  toggleAudio() {
    if (!this.localStream) return
    this.isAudioMuted = !this.isAudioMuted
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isAudioMuted
    })

    if (this.hasAudioBtnTarget) {
      this.audioBtnTarget.classList.toggle("muted", this.isAudioMuted)
      this.audioBtnTarget.textContent = this.isAudioMuted ? "🎙️ Off" : "🎙️ On"
    }

    this.sendMediaState()
  }

  // Toggle Video Camera
  toggleVideo() {
    if (!this.localStream) return
    this.isVideoOff = !this.isVideoOff
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !this.isVideoOff
    })

    if (this.hasVideoBtnTarget) {
      this.videoBtnTarget.classList.toggle("off", this.isVideoOff)
      this.videoBtnTarget.textContent = this.isVideoOff ? "📹 Off" : "📹 On"
    }

    this.sendMediaState()
  }

  sendMediaState() {
    if (this.callState === "connected" && this.activeCallerId) {
      sendVideoSignal("media_state", {
        audioMuted: this.isAudioMuted,
        videoOff: this.isVideoOff
      }, this.currentUserId, this.activeCallerId)
    }
  }

  // Handle incoming ActionCable video call signals
  async handleVideoCallEvent(event) {
    const data = event.detail
    if (!data) return

    switch (data.type) {
      case "video_call_request":
        if (String(data.caller_id) !== String(this.currentUserId)) {
          // If we are already receiving a call from this same caller, ignore duplicate broadcast
          if (this.callState === "incoming" && String(this.activeCallerId) === String(data.caller_id)) {
            return
          }
          if (this.callState !== "idle") {
            // Already busy in another call or calling someone else, auto reject busy
            rejectVideoCall(this.currentUserId)
            return
          }

          const callType = data.call_type || "video"
          this.currentCallType = callType
          this.callState = "incoming"
          this.activeCallerId = data.caller_id
          this.showModal("incoming")

          // Update incoming card title based on call type
          if (this.hasIncomingCallTitleTarget) {
            this.incomingCallTitleTarget.textContent =
              callType === "voice" ? "Incoming Voice Call" : "Incoming Video Call"
          }

          const callerName = data.caller_name || this.otherUserName
          if (this.hasIncomingCallerNameTarget) {
            this.incomingCallerNameTarget.textContent = callerName
          }
          if (this.hasIncomingAvatarTarget) {
            this.incomingAvatarTarget.textContent = callerName.charAt(0).toUpperCase()
          }
          this.playRingtone("incoming")
        }
        break

      case "video_call_accepted":
        if (String(data.user_id) !== String(this.currentUserId)) {
          // Only caller in 'outgoing' state should process acceptance; ignore duplicate events
          if (this.callState !== "outgoing") {
            return
          }
          this.stopRingtone()
          this.callState = "connecting"
          this.showModal("active")
          this.activeCallerId = data.user_id

          const success = await this.setupLocalStream()
          if (!success) {
            this.endCall()
            return
          }
          this.initPeerConnection()
        }
        break

      case "video_call_rejected":
        if (String(data.user_id) !== String(this.currentUserId)) {
          this.stopRingtone()
          this.showStatusNotification("Call Declined")
          if (this.callEndTimeout) clearTimeout(this.callEndTimeout)
          this.callEndTimeout = setTimeout(() => this.cleanupCall(), 1500)
        }
        break

      case "video_call_ended":
        if (this.callState !== "idle") {
          this.stopRingtone()
          this.showStatusNotification("Call Ended")
          if (this.callEndTimeout) clearTimeout(this.callEndTimeout)
          this.callEndTimeout = setTimeout(() => this.cleanupCall(), 1000)
        }
        break

      case "video_signal":
        if (String(data.from_user_id) !== String(this.currentUserId)) {
          this.handleSignalData(data.signal_type, data.signal_data, data.from_user_id)
        }
        break
    }
  }

  async handleSignalData(type, signalData, fromUserId) {
    if (type === "media_state") {
      this.updateRemoteMediaState(signalData)
      return
    }

    if (!this.peerConnection) {
      console.log("PeerConnection not ready yet, queueing signal:", type)
      if (!this.pendingSignals) this.pendingSignals = []
      this.pendingSignals.push({ type, signalData, fromUserId })
      return
    }

    this.processSignalData(type, signalData, fromUserId)
  }

  async processSignalData(type, signalData, fromUserId) {
    try {
      if (type === "offer") {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData))
        const answer = await this.peerConnection.createAnswer()
        await this.peerConnection.setLocalDescription(answer)
        sendVideoSignal("answer", answer, this.currentUserId, fromUserId)
      } else if (type === "answer") {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData))
      } else if (type === "ice_candidate") {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData))
      }
    } catch (err) {
      console.error("Error processing WebRTC signal:", type, err)
    }
  }

  // WebRTC Setup — branches on call type: voice = audio only, video = audio+video
  async setupLocalStream() {
    try {
      const constraints = this.currentCallType === "voice"
        ? { audio: true, video: false }
        : { audio: true, video: true }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (this.currentCallType !== "voice" && this.hasLocalVideoTarget) {
        this.localVideoTarget.srcObject = this.localStream
      }
      return true
    } catch (err) {
      console.error("Error accessing camera/microphone:", err)
      const msg = this.currentCallType === "voice"
        ? "Could not access microphone. Please check browser permissions."
        : "Could not access camera and microphone. Please check browser permissions."
      alert(msg)
      return false
    }
  }

  initPeerConnection() {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG)

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })
    }

    // Process any signals that arrived before peerConnection was ready
    if (this.pendingSignals && this.pendingSignals.length > 0) {
      const queue = this.pendingSignals
      this.pendingSignals = []
      queue.forEach((sig) => {
        this.processSignalData(sig.type, sig.signalData, sig.fromUserId)
      })
    }

    // Remote track received
    this.peerConnection.ontrack = (event) => {
      console.log("WebRTC ontrack event:", event)
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]

        if (this.currentCallType === "voice") {
          if (this.hasRemoteAudioTarget) {
            this.remoteAudioTarget.srcObject = this.remoteStream
          }
        } else {
          if (this.hasRemoteVideoTarget) {
            this.remoteVideoTarget.srcObject = this.remoteStream
          }
        }

        this.onConnected()
      }
    }

    // ICE Candidate gathered
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendVideoSignal("ice_candidate", event.candidate, this.currentUserId, this.activeCallerId)
      }
    }

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      console.log("WebRTC Connection State:", this.peerConnection ? this.peerConnection.connectionState : "null")
      if (
        this.peerConnection && (
          this.peerConnection.connectionState === "disconnected" ||
          this.peerConnection.connectionState === "failed" ||
          this.peerConnection.connectionState === "closed"
        )
      ) {
        this.cleanupCall()
      }
    }
  }

  onConnected() {
    if (this.callState === "connected") return
    this.callState = "connected"
    if (this.hasCallStatusTarget) {
      this.callStatusTargets.forEach(el => el.textContent = "Connected")
    }
    if (this.hasRemoteAvatarInitialTarget) {
      this.remoteAvatarInitialTargets.forEach(el => el.textContent = (this.otherUserName || "U").charAt(0).toUpperCase())
    }
    this.startTimer()
    this.sendMediaState()
  }

  updateRemoteMediaState(state) {
    if (!state) return

    if (this.hasRemoteMutedBadgeTarget) {
      this.remoteMutedBadgeTarget.style.display = state.audioMuted ? "inline-flex" : "none"
    }

    // Only relevant for video calls
    if (this.currentCallType !== "voice" && this.hasRemoteCameraOffOverlayTarget) {
      this.remoteCameraOffOverlayTarget.style.display = state.videoOff ? "flex" : "none"
    }
  }

  // UI Modal visibility manager
  showModal(screen) {
    if (this.hasModalTarget) {
      this.modalTarget.style.display = "flex"
    }
    if (this.hasIncomingModalTarget) {
      this.incomingModalTarget.style.display = screen === "incoming" ? "flex" : "none"
    }
    if (this.hasOutgoingModalTarget) {
      this.outgoingModalTarget.style.display = screen === "outgoing" ? "flex" : "none"
    }
    if (this.hasActiveModalTarget) {
      this.activeModalTarget.style.display = screen === "active" ? "flex" : "none"
    }

    // When showing the active call screen, branch UI based on call type
    if (screen === "active") {
      const isVoice = this.currentCallType === "voice"

      // Show voice card or video feeds
      if (this.hasVoiceCallCardTarget) {
        this.voiceCallCardTarget.style.display = isVoice ? "flex" : "none"
      }
      if (this.hasVideoFeedWrapperTarget) {
        this.videoFeedWrapperTarget.style.display = isVoice ? "none" : "flex"
      }

      // Hide top-left overlay badge during voice calls (voice card has its own center badges)
      if (this.hasHeaderOverlayTarget) {
        this.headerOverlayTarget.style.display = isVoice ? "none" : "flex"
      }

      // Hide camera toggle button during voice calls
      if (this.hasVideoBtnWrapperTarget) {
        this.videoBtnWrapperTarget.style.display = isVoice ? "none" : ""
      }
    }
  }

  hideModal() {
    if (this.hasModalTarget) {
      this.modalTarget.style.display = "none"
    }
  }

  showStatusNotification(msg) {
    if (this.hasCallStatusTarget) {
      this.callStatusTargets.forEach(el => el.textContent = msg)
    }
  }

  // Timer logic
  startTimer() {
    this.stopTimer()
    this.callStartTime = Date.now()
    this.timerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.callStartTime) / 1000)
      const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")
      const seconds = String(elapsedSeconds % 60).padStart(2, "0")
      if (this.hasCallTimerTarget) {
        this.callTimerTargets.forEach(el => el.textContent = `${minutes}:${seconds}`)
      }
    }, 1000)
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    if (this.hasCallTimerTarget) {
      this.callTimerTargets.forEach(el => el.textContent = "00:00")
    }
  }

  // Audio Synth Ringtone (Web Audio API - no external file dependency required!)
  playRingtone(type) {
    this.stopRingtone()
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      this.audioContext = new AudioCtx()

      const playBeep = () => {
        if (!this.audioContext || this.audioContext.state === "closed") return
        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(type === "incoming" ? 440 : 520, this.audioContext.currentTime)
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.6)
        osc.connect(gain)
        gain.connect(this.audioContext.destination)
        osc.start()
        osc.stop(this.audioContext.currentTime + 0.6)
      }

      playBeep()
      this.ringtoneInterval = setInterval(playBeep, 2000)
    } catch (e) {
      console.error("Ringtone error:", e)
    }
  }

  stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval)
      this.ringtoneInterval = null
    }
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (e) {}
      this.audioContext = null
    }
  }

  // Reset and cleanup peer connection & streams
  cleanupCall() {
    if (this.callEndTimeout) {
      clearTimeout(this.callEndTimeout)
      this.callEndTimeout = null
    }

    this.stopRingtone()
    this.stopTimer()

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.hasLocalVideoTarget) {
      this.localVideoTarget.srcObject = null
    }

    if (this.hasRemoteVideoTarget) {
      this.remoteVideoTarget.srcObject = null
    }

    if (this.hasRemoteAudioTarget) {
      this.remoteAudioTarget.srcObject = null
    }

    this.pendingSignals = []

    if (this.peerConnection) {
      this.peerConnection.onconnectionstatechange = null
      this.peerConnection.ontrack = null
      this.peerConnection.onicecandidate = null
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.callState = "idle"
    this.activeCallerId = null
    this.isAudioMuted = false
    this.isVideoOff = false
    this.currentCallType = "video"

    if (this.hasAudioBtnTarget) {
      this.audioBtnTarget.classList.remove("muted")
      this.audioBtnTarget.textContent = "🎙️ On"
    }

    if (this.hasVideoBtnTarget) {
      this.videoBtnTarget.classList.remove("off")
      this.videoBtnTarget.textContent = "📹 On"
    }

    // Restore voice/video card visibility to defaults
    if (this.hasVoiceCallCardTarget) {
      this.voiceCallCardTarget.style.display = "none"
    }
    if (this.hasVideoFeedWrapperTarget) {
      this.videoFeedWrapperTarget.style.display = "flex"
    }
    if (this.hasVideoBtnWrapperTarget) {
      this.videoBtnWrapperTarget.style.display = ""
    }
    if (this.hasHeaderOverlayTarget) {
      this.headerOverlayTarget.style.display = "flex"
    }

    if (this.hasRemoteMutedBadgeTarget) {
      this.remoteMutedBadgeTarget.style.display = "none"
    }

    if (this.hasRemoteCameraOffOverlayTarget) {
      this.remoteCameraOffOverlayTarget.style.display = "none"
    }

    this.hideModal()

    if (this.returnToUrl) {
      const target = this.returnToUrl
      this.returnToUrl = null
      if (target !== window.location.pathname) {
        setTimeout(() => {
          window.location.href = target
        }, 500)
      }
    }
  }
}
