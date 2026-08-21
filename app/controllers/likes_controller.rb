class LikesController < ApplicationController
  before_action :authenticate_user!

  def create
    @quote = Quote.find(params[:quote_id])

    @quote.likes.find_or_create_by(user: current_user)

    redirect_to @quote
  end

  def destroy
    @quote = Quote.find(params[:quote_id])

    like = @quote.likes.find_by(user: current_user)
    like&.destroy

    redirect_to @quote
  end
end