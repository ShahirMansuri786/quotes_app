import { Controller } from "@hotwired/stimulus"
import { subscribeToChat, sendTyping, unsubscribeFromChat, markConversationAsRead } from "channels/chat_channel"

const EMOJI_CATEGORIES = {
  smileys: [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
    "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
    "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
    "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
    "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺"
  ],
  gestures: [
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
    "👆", "🖕", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👊",
    "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
    "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "👀"
  ],
  hearts: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌",
    "💋", "💯", "🔥", "✨", "🌟", "⭐", "💫", "💥", "💢", "💦"
  ],
  celebration: [
    "🎉", "🎊", "🎈", "🎂", "🍰", "🧁", "🎁", "🎇", "🎆", "🥂",
    "🍻", "🍺", "🍷", "🍾", "🍹", "🍸", "🏆", "🥇", "🥈", "🥉",
    "🏅", "🎖️", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎵"
  ],
  objects: [
    "💡", "📱", "💻", "⌨️", "🖥️", "📷", "📸", "📹", "🎥", "📞",
    "☎️", "📟", "🔋", "🔌", "🕯️", "📚", "📖", "📝", "✏️", "📌",
    "📍", "📎", "🔑", "🗝️", "🔒", "🔓", "🔔", "🔕", "🚀", "🛸"
  ]
}

export default class extends Controller {
  static targets = [
    "input",
    "status",
    "fileInput",
    "mediaPreview",
    "previewStrip",
    "emojiPicker",
    "emojiBtn",
    "emojiSearch",
    "emojiGrid",
    "lightbox",
    "lightboxImg",
    "form"
  ]

  connect() {
    this.conversationId = this.element.dataset.conversationId
    this.currentUserId = this.element.dataset.currentUserId

    if (!this.conversationId) {
      return
    }

    console.log("Starting chat subscription:", this.conversationId)
    subscribeToChat(this.conversationId, this.currentUserId)

    this.markAsRead()
    this.scrollToBottom()

    this.isTyping = false
    this.lastTypingTime = 0
    this.stopTypingTimeout = null

    this.selectedFiles = []
    this.activeEmojiCategory = "smileys"

    this.boundMarkAsRead = this.markAsRead.bind(this)
    window.addEventListener("focus", this.boundMarkAsRead)
    this.element.addEventListener("click", this.boundMarkAsRead)

    this.boundHandleOutsideClick = this.handleOutsideClick.bind(this)
    document.addEventListener("click", this.boundHandleOutsideClick)

    this.initEmojiPicker()
  }

  disconnect() {
    if (this.boundMarkAsRead) {
      window.removeEventListener("focus", this.boundMarkAsRead)
      this.element.removeEventListener("click", this.boundMarkAsRead)
    }

    if (this.boundHandleOutsideClick) {
      document.removeEventListener("click", this.boundHandleOutsideClick)
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

      if (!this.isTyping || now - this.lastTypingTime > 1500) {
        this.isTyping = true
        this.lastTypingTime = now
        sendTyping(this.currentUserId, true)
      }

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

  handleSubmit(event) {
    const textContent = this.hasInputTarget ? this.inputTarget.value.trim() : ""
    const hasFiles = this.selectedFiles && this.selectedFiles.length > 0

    if (textContent.length === 0 && !hasFiles) {
      if (event) event.preventDefault()
      return
    }

    this.stopTyping()

    // Reset inputs and previews on next tick after browser packages the FormData
    setTimeout(() => {
      if (this.hasInputTarget) {
        this.inputTarget.value = ""
      }
      this.clearMedia()
      this.closeEmojiPicker()
      this.scrollToBottom()
    }, 50)
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
    if (!container) return

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }

  // ========================================
  // EMOJI PICKER METHODS
  // ========================================

  initEmojiPicker() {
    if (!this.hasEmojiGridTarget) return
    this.renderEmojiCategory(this.activeEmojiCategory)
  }

  toggleEmojiPicker(event) {
    if (event) event.stopPropagation()

    if (!this.hasEmojiPickerTarget) return

    const isHidden = this.emojiPickerTarget.style.display === "none"
    if (isHidden) {
      this.emojiPickerTarget.style.display = "flex"
      if (this.hasEmojiSearchTarget) {
        this.emojiSearchTarget.value = ""
      }
      this.renderEmojiCategory(this.activeEmojiCategory)
    } else {
      this.closeEmojiPicker()
    }
  }

  closeEmojiPicker() {
    if (this.hasEmojiPickerTarget) {
      this.emojiPickerTarget.style.display = "none"
    }
  }

  switchCategory(event) {
    const target = event.currentTarget
    const category = target.dataset.category
    if (!category || !EMOJI_CATEGORIES[category]) return

    this.activeEmojiCategory = category

    const tabs = this.element.querySelectorAll(".emoji-category-tabs .category-tab")
    tabs.forEach((t) => t.classList.remove("active"))
    target.classList.add("active")

    if (this.hasEmojiSearchTarget) {
      this.emojiSearchTarget.value = ""
    }

    this.renderEmojiCategory(category)
  }

  renderEmojiCategory(category) {
    if (!this.hasEmojiGridTarget) return

    const emojis = EMOJI_CATEGORIES[category] || []
    this.emojiGridTarget.innerHTML = emojis
      .map(
        (emoji) => `
          <button type="button" class="emoji-item" data-action="click->chat#insertEmoji" data-emoji="${emoji}">
            ${emoji}
          </button>
        `
      )
      .join("")
  }

  filterEmojis(event) {
    const query = (event.target.value || "").trim().toLowerCase()
    if (!this.hasEmojiGridTarget) return

    if (!query) {
      this.renderEmojiCategory(this.activeEmojiCategory)
      return
    }

    // Search across all categories
    const all = []
    Object.values(EMOJI_CATEGORIES).forEach((list) => {
      list.forEach((emoji) => {
        if (!all.includes(emoji)) all.push(emoji)
      })
    })

    this.emojiGridTarget.innerHTML = all
      .map(
        (emoji) => `
          <button type="button" class="emoji-item" data-action="click->chat#insertEmoji" data-emoji="${emoji}">
            ${emoji}
          </button>
        `
      )
      .join("")
  }

  insertEmoji(event) {
    const emoji = event.currentTarget.dataset.emoji
    if (!emoji || !this.hasInputTarget) return

    const input = this.inputTarget
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const text = input.value

    input.value = text.substring(0, start) + emoji + text.substring(end)
    const newPos = start + emoji.length
    input.selectionStart = newPos
    input.selectionEnd = newPos
    input.focus()

    input.dispatchEvent(new Event("input", { bubbles: true }))
  }

  handleOutsideClick(event) {
    if (!this.hasEmojiPickerTarget || this.emojiPickerTarget.style.display === "none") {
      return
    }

    const clickedInsidePicker = this.emojiPickerTarget.contains(event.target)
    const clickedEmojiBtn = this.hasEmojiBtnTarget && this.emojiBtnTarget.contains(event.target)

    if (!clickedInsidePicker && !clickedEmojiBtn) {
      this.closeEmojiPicker()
    }
  }

  // ========================================
  // MEDIA ATTACHMENTS & PREVIEWS
  // ========================================

  triggerFileInput() {
    if (this.hasFileInputTarget) {
      this.fileInputTarget.click()
    }
  }

  handleFileSelect(event) {
    const newFiles = Array.from(event.target.files || [])
    if (!newFiles.length) return

    this.selectedFiles = [...this.selectedFiles, ...newFiles]
    this.syncFileInput()
    this.renderMediaPreviews()
  }

  removeFile(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10)
    if (isNaN(index)) return

    this.selectedFiles.splice(index, 1)
    this.syncFileInput()
    this.renderMediaPreviews()
  }

  syncFileInput() {
    if (!this.hasFileInputTarget) return

    try {
      const dt = new DataTransfer()
      this.selectedFiles.forEach((file) => dt.items.add(file))
      this.fileInputTarget.files = dt.files
    } catch (e) {
      console.warn("DataTransfer update failed:", e)
    }
  }

  renderMediaPreviews() {
    if (!this.hasMediaPreviewTarget || !this.hasPreviewStripTarget) return

    if (this.selectedFiles.length === 0) {
      this.mediaPreviewTarget.style.display = "none"
      this.previewStripTarget.innerHTML = ""
      return
    }

    this.mediaPreviewTarget.style.display = "block"
    this.previewStripTarget.innerHTML = ""

    this.selectedFiles.forEach((file, index) => {
      const card = document.createElement("div")
      card.className = "media-preview-card"

      const isImage = file.type.startsWith("image/")
      const isVideo = file.type.startsWith("video/")
      const objectUrl = URL.createObjectURL(file)

      let previewContent = ""
      if (isImage) {
        previewContent = `<img src="${objectUrl}" class="preview-thumb" alt="${file.name}" />`
      } else if (isVideo) {
        previewContent = `
          <div class="video-preview-thumb">
            <video src="${objectUrl}" class="preview-video-element" preload="metadata"></video>
            <span class="video-badge">🎥</span>
          </div>
        `
      } else {
        previewContent = `<div class="file-thumb">📁</div>`
      }

      card.innerHTML = `
        ${previewContent}
        <button type="button"
                class="remove-preview-btn"
                data-action="click->chat#removeFile"
                data-index="${index}"
                title="Remove file">×</button>
      `

      this.previewStripTarget.appendChild(card)
    })
  }

  clearMedia() {
    this.selectedFiles = []
    if (this.hasFileInputTarget) {
      this.fileInputTarget.value = ""
    }
    if (this.hasMediaPreviewTarget) {
      this.mediaPreviewTarget.style.display = "none"
    }
    if (this.hasPreviewStripTarget) {
      this.previewStripTarget.innerHTML = ""
    }
  }

  // ========================================
  // LIGHTBOX MODAL
  // ========================================

  openLightbox(event) {
    const src = event.currentTarget.dataset.fullSrc || event.currentTarget.src
    if (!src || !this.hasLightboxTarget || !this.hasLightboxImgTarget) return

    this.lightboxImgTarget.src = src
    this.lightboxTarget.style.display = "flex"
  }

  closeLightbox() {
    if (this.hasLightboxTarget) {
      this.lightboxTarget.style.display = "none"
    }
    if (this.hasLightboxImgTarget) {
      this.lightboxImgTarget.src = ""
    }
  }

  closeLightboxOnBackdrop(event) {
    if (event.target === this.lightboxTarget) {
      this.closeLightbox()
    }
  }
}