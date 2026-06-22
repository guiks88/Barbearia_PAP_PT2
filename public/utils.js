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

const MOJIBAKE_MAP = [
  ["Ã€", "À"], ["Ã", "Á"], ["Ã‚", "Â"], ["Ãƒ", "Ã"], ["Ã‡", "Ç"], ["Ãˆ", "È"], ["Ã‰", "É"], ["ÃŠ", "Ê"],
  ["ÃŒ", "Ì"], ["Ã", "Í"], ["Ã‘", "Ñ"], ["Ã’", "Ò"], ["Ã“", "Ó"], ["Ã”", "Ô"], ["Ã•", "Õ"], ["Ã™", "Ù"],
  ["Ãš", "Ú"], ["Ã ", "à"], ["Ã¡", "á"], ["Ã¢", "â"], ["Ã£", "ã"], ["Ã§", "ç"], ["Ã¨", "è"], ["Ã©", "é"],
  ["Ãª", "ê"], ["Ã­", "í"], ["Ã³", "ó"], ["Ã´", "ô"], ["Ãµ", "õ"], ["Ãº", "ú"], ["Ã±", "ñ"], ["Ãœ", "Ü"],
  ["â‚¬", "€"], ["Âº", "º"], ["Âª", "ª"], ["Â·", "·"], ["â†", "←"], ["â€“", "–"], ["â€”", "—"], ["Â", ""],
]

function fixMojibakeTextValue(value) {
  let result = String(value || "")
  MOJIBAKE_MAP.forEach(([from, to]) => {
    result = result.split(from).join(to)
  })
  return result
}

function fixMojibakeInNode(node) {
  if (!node) return
  if (node.nodeType === Node.TEXT_NODE) {
    const fixed = fixMojibakeTextValue(node.nodeValue || "")
    if (fixed !== node.nodeValue) node.nodeValue = fixed
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node
  if (element.hasAttribute("placeholder")) {
    element.setAttribute("placeholder", fixMojibakeTextValue(element.getAttribute("placeholder")))
  }
  if (element.hasAttribute("title")) {
    element.setAttribute("title", fixMojibakeTextValue(element.getAttribute("title")))
  }

  Array.from(element.childNodes).forEach((child) => fixMojibakeInNode(child))
}

function applyMojibakeFixToDocument() {
  if (!document?.body) return
  fixMojibakeInNode(document.body)
}

export function installMojibakeAutoFix() {
  if (window.__mojibakeAutoFixInstalled) return
  window.__mojibakeAutoFixInstalled = true

  const run = () => applyMojibakeFixToDocument()
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true })
  } else {
    run()
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((added) => fixMojibakeInNode(added))
      if (mutation.type === "characterData" && mutation.target) {
        fixMojibakeInNode(mutation.target)
      }
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

export function updateClientAreaNav() {
  const links = document.querySelectorAll('[data-client-area-nav]')
  if (!links.length) return

  const isClient = sessionStorage.getItem('isClient') === 'true'
  const label = isClient ? 'Voltar à Área de Cliente' : 'Login'
  const href = isClient ? 'client-menu.html' : 'login.html'

  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return
    link.textContent = label
    link.href = href
  })
}

export function showSuccess(message) {
  const div = document.createElement("div")
  div.className = "success-message"
  div.textContent = message
  div.style.cssText =
    "position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(92vw, 560px); background: #10b981; color: white; padding: 1rem 1.25rem; border-radius: 12px; z-index: 10000; font-size: 1rem; font-weight: 600; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3); animation: slideIn 0.3s ease-out;"
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
    "position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(92vw, 560px); background: #ef4444; color: white; padding: 1rem 1.25rem; border-radius: 12px; z-index: 10000; font-size: 1rem; font-weight: 600; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3); animation: slideIn 0.3s ease-out;"
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

