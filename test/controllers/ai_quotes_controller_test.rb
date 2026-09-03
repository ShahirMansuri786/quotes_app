require "test_helper"

class AiQuotesControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get ai_quotes_index_url
    assert_response :success
  end
end
