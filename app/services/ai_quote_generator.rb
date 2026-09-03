require "net/http"
require "json"
require "uri"

class AiQuoteGenerator

  OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
  MODEL = "llama3.2:1b"
  MODEL2 = "gemini-3.6-flash"

  def self.generate(topic, model: "ollama")

    case model.to_s
    when "ollama"
      generate_with_ollama(topic)
    when "gemini"
      generate_with_gemini(topic)
    else
      raise "Unsupported AI model: #{model}"
    end
  end

  private

  def self.generate_with_gemini(topic)
    uri = URI(
      "https://generativelanguage.googleapis.com/v1beta/interactions"
    )

    request = Net::HTTP::Post.new(uri)

    request["x-goog-api-key"] = ENV.fetch("GEMINI_API_KEY")
    request["Content-Type"] = "application/json"

    request.body = {
      model: MODEL2,
      input: <<~PROMPT
        You are an AI quote generator for an application called QuoteSpace.

        Generate ONE original quote about:

        #{topic}

        Rules:
        - Return only the quote.
        - Do not explain the quote.
        - Do not mention that you are an AI.
        - Keep it short.
        - Make it meaningful.
        - Do not include hashtags.
      PROMPT
    }.to_json

    response = Net::HTTP.start(
      uri.hostname,
      uri.port,
      use_ssl: true
    ) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error(
        "Gemini API Error: #{response.body}"
      )

      raise "Gemini API request failed"
    end

    data = JSON.parse(response.body)

    data.dig(
      "steps",
      -1,
      "content",
      0,
      "text"
    ).to_s.strip

  end

  def self.generate_with_ollama(topic)

    uri = URI(OLLAMA_URL)

    prompt = <<~PROMPT
      Generate one short and original quote about: #{topic}

      Rules:
      - Return only the quote.
      - Do not explain anything.
      - Do not add a title.
      - Keep it motivational and meaningful.
      - Keep it under 25 words.
    PROMPT

    request = Net::HTTP::Post.new(uri)

    request["Content-Type"] = "application/json"

    request.body = {
      model: MODEL,
      prompt: prompt,
      stream: false
    }.to_json

    response = Net::HTTP.start(
      uri.hostname,
      uri.port
    ) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error(
        "Ollama API Error: #{response.body}"
      )

      raise "Ollama request failed"
    end

    data = JSON.parse(response.body)

    quote = data["response"].to_s.strip

    if quote.blank?
      raise "Ollama returned an empty quote"
    end

    quote

  end

end