class AddReadToMessages < ActiveRecord::Migration[8.1]
  def change
    add_column :messages, :read, :boolean, default: false, null: false
    add_index :messages, [:conversation_id, :read]
  end
end

