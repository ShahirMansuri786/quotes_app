class UserChannel < ApplicationCable::Channel
  def subscribed
    user_id = params[:user_id] || (current_user ? current_user.id : nil)

    if user_id
      stream_from "user_#{user_id}"
    else
      reject
    end
  end

  def unsubscribed
  end
end

