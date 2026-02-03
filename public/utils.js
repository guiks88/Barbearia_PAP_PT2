export const SERVICE_DURATION = {
  corte: 30,
  barba: 20,
  "corte-barba": 45,
  sobrancelha: 10,
  completo: 60,
}

export function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.startsWith("351")) {
    return `+${cleaned}`
  }
  if (cleaned.length === 9) {
    return `+351${cleaned}`
  }
  return phone
}

export function validatePhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, "")
  return cleaned.length === 9 && /^9\d{8}$/.test(cleaned)
}

export function setupPhoneValidation(inputId) {
  const input = document.getElementById(inputId)
  if (input) {
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "")
    })
  }
}

export function showSuccess(message) {
  const div = document.createElement("div")
  div.className = "success-message"
  div.textContent = message
  div.style.cssText =
    "position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1.25rem 2rem; border-radius: 12px; z-index: 10000; font-size: 1.1rem; font-weight: 600; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3); animation: slideIn 0.3s ease-out;"
  document.body.appendChild(div)

  setTimeout(() => {
    div.style.animation = "slideOut 0.3s ease-in"
    setTimeout(() => div.remove(), 300)
  }, 3000)
}

export function showError(message) {
  const div = document.createElement("div")
  div.className = "error-message"
  div.textContent = message
  div.style.cssText =
    "position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1.25rem 2rem; border-radius: 12px; z-index: 10000; font-size: 1.1rem; font-weight: 600; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3); animation: slideIn 0.3s ease-out;"
  document.body.appendChild(div)

  setTimeout(() => {
    div.style.animation = "slideOut 0.3s ease-in"
    setTimeout(() => div.remove(), 300)
  }, 4000)
}

export function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00")
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
}
