import { Controller } from "@hotwired/stimulus"
import { subscribeToChat } from "channels/chat_channel"

export default class extends Controller {
  connect() {
    const conversationId = this.element.dataset.conversationId

    if (!conversationId) {
      return
    }

    console.log("Starting chat subscription:", conversationId)

    subscribeToChat(conversationId)

    // Wait until messages are rendered, then scroll down
    this.scrollToBottom()
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