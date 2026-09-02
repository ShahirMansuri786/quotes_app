class ConversationsController < ApplicationController
  before_action :authenticate_user!

  def index
    @users = User.where.not(id: current_user.id)
  end

  def create
    @other_user = User.find(params[:user_id])

    @conversation = find_or_create_conversation(@other_user)

    redirect_to conversation_path(@conversation)
  end

  def show
    @conversation = current_user.conversations.find(params[:id])

    # Mark all unread messages from other users in this conversation as read
    updated = @conversation.messages
                           .where.not(user_id: current_user.id)
                           .where(read: false)
                           .update_all(read: true)

    if updated > 0
      ActionCable.server.broadcast(
        "user_#{current_user.id}",
        {
          type: "unread_count",
          unread_count: current_user.unread_messages_count,
          conversation_id: @conversation.id
        }
      )
    end

    @messages = @conversation.messages
                             .includes(:user)
                             .order(:created_at)

    @other_user = @conversation.users
                              .where.not(id: current_user.id)
                              .first

    @message = Message.new
  end

  private

  def find_or_create_conversation(other_user)
    conversation = Conversation
      .joins(:conversation_participants)
      .where(conversation_participants: { user_id: current_user.id })
      .where(
        id: ConversationParticipant
          .where(user_id: other_user.id)
          .select(:conversation_id)
      )
      .first

    return conversation if conversation

    conversation = Conversation.create!

    ConversationParticipant.create!(
      conversation: conversation,
      user: current_user
    )

    ConversationParticipant.create!(
      conversation: conversation,
      user: other_user
    )

    conversation
  end
end