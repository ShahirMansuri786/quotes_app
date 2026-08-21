class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :quote

  validates :content, presence: true
end