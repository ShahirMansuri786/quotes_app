class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user

  after_create_commit :broadcast_message

  validates :content, presence: true

  private

  def broadcast_message
    ActionCable.server.broadcast(
      "conversation_#{conversation_id}",
      {
        id: id,
        user_id: user_id,
        content: content,
        created_at: created_at.strftime("%H:%M")
      }
    )
  end
end