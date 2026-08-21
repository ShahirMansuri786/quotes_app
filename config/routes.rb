Rails.application.routes.draw do
  get "comments/create"
  get "comments/destroy"
  get "likes/create"
  get "likes/destroy"
  root "quotes#index"

  devise_for :users

  resources :quotes do
    resources :comments, only: [:create, :destroy]
    resources :likes, only: [:create, :destroy]
  end
end