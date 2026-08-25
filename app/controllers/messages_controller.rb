class MessagesController < ApplicationController
  before_action :authenticate_user!

  def create
    @conversation = current_user.conversations.find(params[:conversation_id])

    @message = @conversation.messages.new(message_params)
    @message.user = current_user

    if @message.save

      ChatChannel.broadcast_to(
        @conversation,
        {
          id: @message.id,
          content: @message.content,
          user_id: @message.user_id,
          user_name: @message.user.name,
          created_at: @message.created_at.strftime("%I:%M %p")
        }
      )

      # redirect_to conversation_path(@conversation)
        head :no_content
    else
      redirect_to conversation_path(@conversation),
                  alert: "Message cannot be empty."
    end
  end

  private

  def message_params
    params.require(:message).permit(:content)
  end
end