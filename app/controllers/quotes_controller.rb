class QuotesController < ApplicationController
  before_action :authenticate_user!, except: [:index, :show]
  before_action :set_quote, only: [:show, :edit, :update, :destroy]
  before_action :require_owner, only: [:edit, :update, :destroy]

  def index
    @quotes = Quote.includes(:user, :comments, :likes)
                  .order(created_at: :desc)
  end

  def show
    @comment = Comment.new
  end

  def new
    @quote = Quote.new(content: params[:content])
  end

  def create
    @quote = current_user.quotes.new(quote_params)

    if @quote.save
      redirect_to @quote, notice: "Quote created successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @quote.update(quote_params)
      redirect_to @quote, notice: "Quote updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @quote.destroy

    redirect_to quotes_path, notice: "Quote deleted successfully."
  end

  private

  def set_quote
    @quote = Quote.find(params[:id])
  end

  def require_owner
    unless @quote.user == current_user
      redirect_to @quote, alert: "You can only manage your own quotes."
    end
  end

  def quote_params
    params.require(:quote).permit(:content)
  end
end