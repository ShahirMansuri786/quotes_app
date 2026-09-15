class UserChannel < ApplicationCable::Channel
  def subscribed
    user_id = params[:user_id] || (current_user ? current_user.id : nil)

    if user_id
      stream_from "user_#{user_id}"
    else
      reject
    end
  end

  def reject_video_call(data)
    conversation_id = data["conversation_id"]
    user_id = data["user_id"] || (current_user ? current_user.id : nil)
    return unless conversation_id

    payload = {
      type: "video_call_rejected",
      conversation_id: conversation_id,
      user_id: user_id
    }

    ActionCable.server.broadcast("conversation_#{conversation_id}", payload)
    conversation = Conversation.find_by(id: conversation_id)
    if conversation
      conversation.users.where.not(id: user_id).find_each do |user|
        ActionCable.server.broadcast("user_#{user.id}", payload)
      end
    end
  end

  def unsubscribed
  end
end
