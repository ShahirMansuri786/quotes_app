class AddIndexesToChat < ActiveRecord::Migration[8.1]
  def change
    add_index :conversation_participants,
              [:conversation_id, :user_id],
              unique: true
    add_index :messages,
              [:conversation_id, :created_at]
  end
end