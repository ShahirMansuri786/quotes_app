class ChatChannel < ApplicationCable::Channel
  def subscribed
    conversation_id = params[:conversation_id]

    stream_from "conversation_#{conversation_id}"

    # Auto-mark messages as read when joining the active conversation
    user_id = current_user ? current_user.id : nil
    mark_messages_as_read(conversation_id, user_id) if user_id
  end

  def mark_as_read(data)
    conversation_id = params[:conversation_id]
    user_id = data["user_id"] || (current_user ? current_user.id : nil)
    return unless user_id

    mark_messages_as_read(conversation_id, user_id)
  end

  def typing(data)
    conversation_id = params[:conversation_id]

    ActionCable.server.broadcast(
      "conversation_#{conversation_id}",
      {
        type: "typing",
        user_id: data["user_id"],
        is_typing: data["is_typing"]
      }
    )
  end

  def unsubscribed
  end

  private

  def mark_messages_as_read(conversation_id, user_id)
    user = User.find_by(id: user_id)
    return unless user

    updated = Message.where(conversation_id: conversation_id)
                     .where.not(user_id: user.id)
                     .where(read: false)
                     .update_all(read: true)

    if updated > 0
      ActionCable.server.broadcast(
        "user_#{user.id}",
        {
          type: "unread_count",
          unread_count: user.unread_messages_count,
          conversation_id: conversation_id
        }
      )
    end
  end
end