class CommentsController < ApplicationController
  before_action :authenticate_user!

  def create
    @quote = Quote.find(params[:quote_id])

    @comment = @quote.comments.build(comment_params)
    @comment.user = current_user

    if @comment.save
      CommentNotificationJob.perform_later(@comment.id)

      redirect_to @quote, notice: "Comment added."
    else
      redirect_to @quote, alert: "Comment could not be added."
    end
  end

  def destroy
    @comment = Comment.find(params[:id])
    @quote = @comment.quote

    @comment.destroy

    redirect_to @quote
  end

  private

  def comment_params
    params.require(:comment).permit(:content)
  end
end