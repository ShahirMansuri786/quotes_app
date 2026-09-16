class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user

  has_many_attached :attachments

  after_create_commit :broadcast_message
  after_create_commit :broadcast_to_recipients

  validates :content, presence: true, unless: -> { attachments.attached? }

  scope :unread, -> { where(read: false) }
  scope :read, -> { where(read: true) }

  def attachment_payload
    return [] unless attachments.attached?

    attachments.map do |att|
      {
        id: att.id,
        filename: att.filename.to_s,
        content_type: att.content_type,
        byte_size: att.byte_size,
        url: Rails.application.routes.url_helpers.rails_blob_url(att, only_path: true),
        is_image: att.image?,
        is_video: att.video?
      }
    end
  end

  private

  def broadcast_message
    ActionCable.server.broadcast(
      "conversation_#{conversation_id}",
      {
        id: id,
        user_id: user_id,
        content: content,
        attachments: attachment_payload,
        created_at: created_at.strftime("%I:%M %p")
      }
    )
  end

  def broadcast_to_recipients
    preview_text = if content.present?
      content.truncate(40)
    elsif attachments.attached?
      attachments.any?(&:video?) ? "🎥 Video" : "📷 Photo"
    else
      "Sent a message"
    end

    conversation.users.where.not(id: user_id).find_each do |recipient|
      ActionCable.server.broadcast(
        "user_#{recipient.id}",
        {
          type: "unread_count",
          unread_count: recipient.unread_messages_count,
          conversation_id: conversation_id,
          sender_id: user_id,
          sender_name: user.name,
          preview: preview_text,
          sender_unread_count: recipient.unread_messages_count_for(user)
        }
      )
    end
  end
end