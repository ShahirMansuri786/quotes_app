import consumer from "channels/consumer"

let chatSubscription = null
let typingTimeout = null

export function subscribeToChat(conversationId, currentUserId) {
  if (chatSubscription) {
    chatSubscription.unsubscribe()
  }

  chatSubscription = consumer.subscriptions.create(
    {
      channel: "ChatChannel",
      conversation_id: conversationId
    },

    {
      connected() {
        console.log("Connected to chat:", conversationId)
        if (currentUserId) {
          markConversationAsRead(currentUserId)
        }
      },

      disconnected() {
        console.log("Disconnected from chat")
      },

      rejected() {
        console.log("Chat subscription rejected")
      },

      received(data) {
        console.log("New message/event:", data)

        if (data.type === "typing") {
          handleTypingIndicator(data)
        } else {
          // Reset typing indicator if incoming message is from the other user
          handleTypingIndicator({ user_id: data.user_id, is_typing: false })
          addMessageToChat(data)

          // If the user has this conversation open, immediately mark incoming message as read
          const container = document.querySelector(".chat-page") || document.querySelector(".messages-container")
          const activeUserId = container ? container.dataset.currentUserId : currentUserId
          if (activeUserId) {
            markConversationAsRead(activeUserId)
          }
        }
      }
    }
  )
}

export function markConversationAsRead(userId) {
  if (chatSubscription && userId) {
    chatSubscription.perform("mark_as_read", {
      user_id: userId
    })
  }
}

export function sendTyping(userId, isTyping) {
  if (chatSubscription) {
    chatSubscription.perform("typing", {
      user_id: userId,
      is_typing: isTyping
    })
  }
}

export function unsubscribeFromChat() {
  if (chatSubscription) {
    chatSubscription.unsubscribe()
    chatSubscription = null
  }
}

// ========================================
// TYPING INDICATOR
// ========================================

function handleTypingIndicator(data) {
  const container = document.querySelector(".chat-page") || document.querySelector(".messages-container")
  if (!container) return

  const currentUserId = container.dataset.currentUserId
  // Ignore our own typing events
  if (String(data.user_id) === String(currentUserId)) return

  const statusElement = document.querySelector(".chat-user-info .user-status")
  if (!statusElement) return

  if (typingTimeout) {
    clearTimeout(typingTimeout)
    typingTimeout = null
  }

  if (data.is_typing) {
    statusElement.textContent = "typing..."
    statusElement.classList.remove("online")
    statusElement.classList.add("typing")

    // Safety fallback: reset to Online after 3.5 seconds if no stop signal is received
    typingTimeout = setTimeout(() => {
      resetStatusToOnline(statusElement)
    }, 3500)
  } else {
    resetStatusToOnline(statusElement)
  }
}

function resetStatusToOnline(statusElement) {
  if (!statusElement) return
  statusElement.textContent = "Online"
  statusElement.classList.remove("typing")
  statusElement.classList.add("online")
}

// ========================================
// ADD MESSAGE TO CHAT
// ========================================

function addMessageToChat(message) {
  const container = document.querySelector(".messages-container")

  if (!container) return

  const currentUserId = container.dataset.currentUserId

  // Remove "Start the conversation" message
  const emptyChat = container.querySelector(".empty-chat")

  if (emptyChat) {
    emptyChat.remove()
  }

  const isMine =
    String(message.user_id) === String(currentUserId)

  const row = document.createElement("div")

  row.className = `message-row ${
    isMine ? "my-message" : "other-message"
  }`

  row.innerHTML = `
    <div class="message-bubble">

      <div class="message-content">
        ${escapeHtml(message.content)}
      </div>

      <small>
        ${message.created_at}
      </small>

    </div>
  `

  container.appendChild(row)

  // Scroll to latest message
  container.scrollTop = container.scrollHeight
}

function escapeHtml(text) {
  const div = document.createElement("div")

  div.textContent = text

  return div.innerHTML
}