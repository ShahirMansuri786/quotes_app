class User < ApplicationRecord
  devise :database_authenticatable,
         :registerable,
         :recoverable,
         :rememberable,
         :validatable

  has_many :quotes, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :likes, dependent: :destroy
  has_many :notifications
  has_many :conversation_participants, dependent: :destroy
  has_many :conversations, through: :conversation_participants
  has_many :messages, dependent: :destroy

  validates :name, presence: true

  def unread_messages_count
    Message.where(conversation_id: conversation_ids)
           .where.not(user_id: id)
           .where(read: false)
           .count
  end

  def unread_messages_count_for(other_user)
    conv_ids = conversation_ids & other_user.conversation_ids
    return 0 if conv_ids.empty?

    Message.where(conversation_id: conv_ids)
           .where(user_id: other_user.id)
           .where(read: false)
           .count
  end
end