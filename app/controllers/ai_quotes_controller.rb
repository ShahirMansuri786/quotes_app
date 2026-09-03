class AiQuotesController < ApplicationController

  before_action :authenticate_user!

  def index
  end

  def generate
    
    topic = params[:topic].to_s.strip
    model = params[:model].presence || "ollama"

    if topic.blank?
      redirect_to ai_quotes_path,
                  alert: "Please enter a topic."
      return
    end

    @text_quote = AiQuoteGenerator.generate(topic, model: model)
    Rails.logger.info "GENERATED QUOTE: #{@text_quote.inspect}"
    
    render :index

  rescue => e
    Rails.logger.error(
      "AI Quote Error: #{e.message}"
    )

    redirect_to ai_quotes_path,
                alert: "Unable to generate quote. Please try again."
  end

end