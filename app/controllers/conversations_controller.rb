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