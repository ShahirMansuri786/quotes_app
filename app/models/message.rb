class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user

  after_create_commit :broadcast_message
  after_create_commit :broadcast_to_recipients

  validates :content, presence: true

  scope :unread, -> { where(read: false) }
  scope :read, -> { where(read: true) }

  private

  def broadcast_message
    ActionCable.server.broadcast(
      "conversation_#{conversation_id}",
      {
        id: id,
        user_id: user_id,
        content: content,
        created_at: created_at.strftime("%I:%M %p")
      }
    )
  end

  def broadcast_to_recipients
    conversation.users.where.not(id: user_id).find_each do |recipient|
      ActionCable.server.broadcast(
        "user_#{recipient.id}",
        {
          type: "unread_count",
          unread_count: recipient.unread_messages_count,
          conversation_id: conversation_id,
          sender_id: user_id,
          sender_name: user.name,
          sender_unread_count: recipient.unread_messages_count_for(user)
        }
      )
    end
  end
end