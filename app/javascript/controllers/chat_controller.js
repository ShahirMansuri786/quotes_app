import { Controller } from "@hotwired/stimulus"
import { subscribeToChat, sendTyping, unsubscribeFromChat, markConversationAsRead } from "channels/chat_channel"

export default class extends Controller {
  static targets = ["input", "status"]

  connect() {
    this.conversationId = this.element.dataset.conversationId
    this.currentUserId = this.element.dataset.currentUserId

    if (!this.conversationId) {
      return
    }

    console.log("Starting chat subscription:", this.conversationId)

    subscribeToChat(this.conversationId, this.currentUserId)

    // Mark messages in this conversation as read immediately
    this.markAsRead()

    // Wait until messages are rendered, then scroll down
    this.scrollToBottom()

    this.isTyping = false
    this.lastTypingTime = 0
    this.stopTypingTimeout = null

    this.boundMarkAsRead = this.markAsRead.bind(this)
    window.addEventListener("focus", this.boundMarkAsRead)
    this.element.addEventListener("click", this.boundMarkAsRead)
  }

  disconnect() {
    if (this.boundMarkAsRead) {
      window.removeEventListener("focus", this.boundMarkAsRead)
      this.element.removeEventListener("click", this.boundMarkAsRead)
    }

    if (this.isTyping) {
      sendTyping(this.currentUserId, false)
      this.isTyping = false
    }

    if (this.stopTypingTimeout) {
      clearTimeout(this.stopTypingTimeout)
      this.stopTypingTimeout = null
    }

    unsubscribeFromChat()
  }

  markAsRead() {
    if (this.currentUserId) {
      markConversationAsRead(this.currentUserId)
    }
  }

  handleInput(event) {
    const value = event.target.value.trim()

    if (value.length > 0) {
      const now = Date.now()

      // Throttle typing broadcasts to once every 1.5 seconds while actively typing
      if (!this.isTyping || now - this.lastTypingTime > 1500) {
        this.isTyping = true
        this.lastTypingTime = now
        sendTyping(this.currentUserId, true)
      }

      // Reset the countdown to stop typing after inactivity
      if (this.stopTypingTimeout) {
        clearTimeout(this.stopTypingTimeout)
      }

      this.stopTypingTimeout = setTimeout(() => {
        this.stopTyping()
      }, 2500)
    } else {
      this.stopTyping()
    }
  }

  handleSubmit() {
    this.stopTyping()
  }

  stopTyping() {
    if (this.stopTypingTimeout) {
      clearTimeout(this.stopTypingTimeout)
      this.stopTypingTimeout = null
    }

    if (this.isTyping) {
      this.isTyping = false
      sendTyping(this.currentUserId, false)
    }
  }

  scrollToBottom() {
    const container = this.element.querySelector(".messages-container")

    if (!container) {
      return
    }

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }
}