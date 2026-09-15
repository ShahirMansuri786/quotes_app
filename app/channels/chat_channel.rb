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

  def start_video_call(data)
    conversation_id = params[:conversation_id]
    caller_id = data["caller_id"] || (current_user ? current_user.id : nil)
    caller_name = data["caller_name"] || (current_user ? current_user.name : "User")

    payload = {
      type: "video_call_request",
      conversation_id: conversation_id,
      caller_id: caller_id,
      caller_name: caller_name
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    broadcast_to_other_participants(conversation_id, caller_id, payload)
  end

  def accept_video_call(data)
    conversation_id = params[:conversation_id]
    user_id = data["user_id"] || (current_user ? current_user.id : nil)

    payload = {
      type: "video_call_accepted",
      conversation_id: conversation_id,
      user_id: user_id
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    broadcast_to_other_participants(conversation_id, user_id, payload)
  end

  def reject_video_call(data)
    conversation_id = params[:conversation_id]
    user_id = data["user_id"] || (current_user ? current_user.id : nil)

    payload = {
      type: "video_call_rejected",
      conversation_id: conversation_id,
      user_id: user_id
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    broadcast_to_other_participants(conversation_id, user_id, payload)
  end

  def end_video_call(data)
    conversation_id = params[:conversation_id]
    user_id = data["user_id"] || (current_user ? current_user.id : nil)

    payload = {
      type: "video_call_ended",
      conversation_id: conversation_id,
      user_id: user_id
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    broadcast_to_other_participants(conversation_id, user_id, payload)
  end

  def video_signal(data)
    conversation_id = params[:conversation_id]
    from_user_id = data["from_user_id"] || (current_user ? current_user.id : nil)

    payload = {
      type: "video_signal",
      conversation_id: conversation_id,
      signal_type: data["signal_type"],
      signal_data: data["signal_data"],
      from_user_id: from_user_id,
      target_user_id: data["target_user_id"]
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    if data["target_user_id"].present?
      ActionCable.server.broadcast("user_#{data["target_user_id"]}", payload)
    end
  end

  def unsubscribed
  end

  private

  def broadcast_to_other_participants(conversation_id, sender_id, payload)
    conversation = Conversation.find_by(id: conversation_id)
    return unless conversation

    conversation.users.where.not(id: sender_id).find_each do |user|
      ActionCable.server.broadcast("user_#{user.id}", payload)
    end
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
