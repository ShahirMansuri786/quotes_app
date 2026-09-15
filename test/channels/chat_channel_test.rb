require "test_helper"

class ChatChannelTest < ActionCable::Channel::TestCase
  setup do
    @user = users(:one) rescue User.first
    @conversation = conversations(:one) rescue Conversation.first
  end

  test "subscribes to conversation stream" do
    subscribe conversation_id: @conversation.id
    assert subscription.confirmed?
    assert_has_stream "conversation_#{@conversation.id}"
  end

  test "broadcasts start_video_call signal" do
    subscribe conversation_id: @conversation.id
    assert_broadcast_on("conversation_#{@conversation.id}", type: "video_call_request", caller_id: @user.id, caller_name: @user.name) do
      perform :start_video_call, { caller_id: @user.id, caller_name: @user.name }
    end
  end

  test "broadcasts accept_video_call signal" do
    subscribe conversation_id: @conversation.id
    assert_broadcast_on("conversation_#{@conversation.id}", type: "video_call_accepted", user_id: @user.id) do
      perform :accept_video_call, { user_id: @user.id }
    end
  end

  test "broadcasts reject_video_call signal" do
    subscribe conversation_id: @conversation.id
    assert_broadcast_on("conversation_#{@conversation.id}", type: "video_call_rejected", user_id: @user.id) do
      perform :reject_video_call, { user_id: @user.id }
    end
  end

  test "broadcasts end_video_call signal" do
    subscribe conversation_id: @conversation.id
    assert_broadcast_on("conversation_#{@conversation.id}", type: "video_call_ended", user_id: @user.id) do
      perform :end_video_call, { user_id: @user.id }
    end
  end

  test "broadcasts video_signal data" do
    subscribe conversation_id: @conversation.id
    assert_broadcast_on("conversation_#{@conversation.id}", type: "video_signal", signal_type: "offer", signal_data: { sdp: "dummy" }, from_user_id: @user.id, target_user_id: 2) do
      perform :video_signal, { signal_type: "offer", signal_data: { sdp: "dummy" }, from_user_id: @user.id, target_user_id: 2 }
    end
  end
end
