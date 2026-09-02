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
        }
      }
    }
  )
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

