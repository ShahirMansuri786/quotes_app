class CommentNotificationJob < ApplicationJob
  queue_as :default

  def perform(comment_id)
    comment = Comment.includes(:user, quote: :user).find(comment_id)

    quote_owner = comment.quote.user

    # Don't notify the owner if they comment on their own quote
    return if comment.user_id == quote_owner.id

    Notification.create!(
      user: quote_owner,
      message: " #{comment.id} #{comment.user.name } commented on your quote."
    )
  end
end