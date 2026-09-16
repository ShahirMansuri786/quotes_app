import consumer from "channels/consumer"

let userSubscription = null
let subscribedUserId = null

export function setupUserChannel() {
  const currentUserId = document.body ? document.body.dataset.currentUserId : null

  if (!currentUserId) {
    if (userSubscription) {
      userSubscription.unsubscribe()
      userSubscription = null
      subscribedUserId = null
    }
    return
  }

  if (userSubscription && String(subscribedUserId) === String(currentUserId)) {
    return
  }

  if (userSubscription) {
    userSubscription.unsubscribe()
  }

  subscribedUserId = currentUserId

  userSubscription = consumer.subscriptions.create(
    {
      channel: "UserChannel",
      user_id: currentUserId
    },
    {
      connected() {
        console.log("Connected to UserChannel for user:", currentUserId)
      },

      disconnected() {
        console.log("Disconnected from UserChannel")
      },

      received(data) {
        console.log("UserChannel received:", data)

        if (data.type === "unread_count") {
          updateNavbarBadge(data.unread_count)
          updateConversationRowBadge(data)
        } else if (
          data.type === "video_call_request" ||
          data.type === "video_call_accepted" ||
          data.type === "video_call_rejected" ||
          data.type === "video_call_ended" ||
          data.type === "video_signal"
        ) {
          const activeChat = document.querySelector(".chat-page")
          const activeChatConversationId = activeChat ? activeChat.dataset.conversationId : null

          // If already on the active conversation page, ChatChannel handles everything!
          // Do not show global modal and do not dispatch duplicate events.
          if (activeChatConversationId && String(activeChatConversationId) === String(data.conversation_id)) {
            return
          }

          handleGlobalVideoCallEvent(data)
        }
      }
    }
  )
}

let globalRingtoneInterval = null
let globalAudioCtx = null

function handleGlobalVideoCallEvent(data) {
  const activeChat = document.querySelector(".chat-page")
  const activeChatConversationId = activeChat ? activeChat.dataset.conversationId : null

  // If already on the active conversation page, let that page's controller handle it
  if (activeChatConversationId && String(activeChatConversationId) === String(data.conversation_id)) {
    return
  }

  const modal = document.getElementById("global-video-call-modal")
  if (!modal) return

  if (data.type === "video_call_request") {
    const currentUserId = document.body ? document.body.dataset.currentUserId : null
    if (String(data.caller_id) === String(currentUserId)) return

    const callerName = data.caller_name || "Someone"
    const callerInitial = callerName.charAt(0).toUpperCase()

    const nameEl = document.getElementById("global-caller-name")
    const avatarEl = document.getElementById("global-call-avatar")
    const acceptBtn = document.getElementById("global-call-accept-btn")
    const declineBtn = document.getElementById("global-call-decline-btn")

    if (nameEl) nameEl.textContent = callerName
    if (avatarEl) avatarEl.textContent = callerInitial

    modal.style.display = "flex"
    playGlobalRingtone()

    if (declineBtn) {
      declineBtn.onclick = () => {
        stopGlobalRingtone()
        modal.style.display = "none"
        if (userSubscription) {
          userSubscription.perform("reject_video_call", {
            user_id: currentUserId,
            conversation_id: data.conversation_id
          })
        }
      }
    }

    if (acceptBtn) {
      acceptBtn.onclick = () => {
        stopGlobalRingtone()
        modal.style.display = "none"
        const currentPath = window.location.pathname + window.location.search
        const returnParam = encodeURIComponent(currentPath)
        window.location.href = `/conversations/${data.conversation_id}?auto_accept=true&return_to=${returnParam}`
      }
    }
  } else if (data.type === "video_call_rejected" || data.type === "video_call_ended") {
    stopGlobalRingtone()
    modal.style.display = "none"
  }
}

function playGlobalRingtone() {
  stopGlobalRingtone()
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    globalAudioCtx = new AudioCtx()

    const playBeep = () => {
      if (!globalAudioCtx || globalAudioCtx.state === "closed") return
      const osc = globalAudioCtx.createOscillator()
      const gain = globalAudioCtx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(440, globalAudioCtx.currentTime)
      gain.gain.setValueAtTime(0.15, globalAudioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, globalAudioCtx.currentTime + 0.6)
      osc.connect(gain)
      gain.connect(globalAudioCtx.destination)
      osc.start()
      osc.stop(globalAudioCtx.currentTime + 0.6)
    }

    playBeep()
    globalRingtoneInterval = setInterval(playBeep, 2000)
  } catch (e) {}
}

function stopGlobalRingtone() {
  if (globalRingtoneInterval) {
    clearInterval(globalRingtoneInterval)
    globalRingtoneInterval = null
  }
  if (globalAudioCtx) {
    try { globalAudioCtx.close() } catch (e) {}
    globalAudioCtx = null
  }
}

function updateNavbarBadge(count) {
  const chatLink = document.querySelector(".chat-icon-link")
  if (!chatLink) return

  let badge = chatLink.querySelector(".unread-badge")

  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span")
      badge.className = "unread-badge"
      chatLink.appendChild(badge)
    }
    badge.textContent = count
  } else if (badge) {
    badge.remove()
  }
}

function updateConversationRowBadge(data) {
  if (!data.sender_id) return

  const userRow = document.querySelector(`[data-user-row-id="${data.sender_id}"]`)
  if (!userRow) return

  const avatarWrapper = userRow.querySelector(".user-avatar-wrapper")
  if (!avatarWrapper) return

  let badge = avatarWrapper.querySelector(".user-unread-badge")
  const count = data.sender_unread_count || 0

  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span")
      badge.className = "user-unread-badge"
      avatarWrapper.appendChild(badge)
    }
    badge.textContent = count
  } else if (badge) {
    badge.remove()
  }
}

document.addEventListener("turbo:load", setupUserChannel)
document.addEventListener("DOMContentLoaded", setupUserChannel)


