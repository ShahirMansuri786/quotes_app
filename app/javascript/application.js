// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
// import "channels"

document.addEventListener("submit", (event) => {
  if (!event.target.matches(".message-form")) {
    return
  }

  const input = event.target.querySelector(".message-input")

  if (input) {
    setTimeout(() => {
      input.value = ""
      input.focus()
    }, 300)
  }
})