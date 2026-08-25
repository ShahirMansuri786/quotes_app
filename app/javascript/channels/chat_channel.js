import consumer from "channels/consumer"

let chatSubscription = null

export function subscribeToChat(conversationId) {
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
      },

      disconnected() {
        console.log("Disconnected from chat")
      },

      rejected() {
        console.log("Chat subscription rejected")
      },

      received(data) {
        console.log("New message:", data)

        addMessageToChat(data)
      }
    }
  )
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