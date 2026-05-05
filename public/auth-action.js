import { auth } from "./firebase-config.js"
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showError, showSuccess } from "./utils.js"

const titleEl = document.getElementById("actionTitle")
const statusEl = document.getElementById("actionStatus")
const detailEl = document.getElementById("actionDetail")
const resetCard = document.getElementById("resetCard")
const resetForm = document.getElementById("resetForm")
const resetBtn = document.getElementById("resetBtn")
const newPasswordInput = document.getElementById("newPassword")
const confirmPasswordInput = document.getElementById("confirmPassword")

function setStatus(title, message, isError = false) {
  if (titleEl) titleEl.textContent = title
  if (statusEl) {
    statusEl.textContent = message
    statusEl.style.color = isError ? "var(--color-error)" : "var(--color-text-secondary)"
  }
}

function showDetail(text) {
  if (detailEl) {
    detailEl.textContent = text || ""
  }
}

const params = new URLSearchParams(window.location.search)
const mode = params.get("mode")
const actionCode = params.get("oobCode")

if (!mode || !actionCode) {
  setStatus("Pedido invalido", "Link incompleto. Tente novamente.", true)
} else if (mode === "verifyEmail") {
  setStatus("Confirmar email", "A verificar o seu email...")
  applyActionCode(auth, actionCode)
    .then(() => {
      setStatus("Email confirmado", "O seu email foi verificado com sucesso.")
      showSuccess("Email confirmado com sucesso.")
      setTimeout(() => {
        if (auth.currentUser) {
          sessionStorage.setItem("clientEmail", auth.currentUser.email || "")
          sessionStorage.setItem("clientName", sessionStorage.getItem("clientName") || auth.currentUser.displayName || "Cliente")
          sessionStorage.setItem("isClient", "true")
          window.location.href = "client-menu.html"
          return
        }
        window.location.href = "index.html"
      }, 1400)
    })
    .catch((error) => {
      console.error("Erro ao verificar email:", error)
      setStatus("Falha na verificacao", "Nao foi possivel confirmar o email.", true)
      showError("Nao foi possivel confirmar o email.")
    })
} else if (mode === "resetPassword") {
  setStatus("Redefinir senha", "Defina a sua nova senha.")
  if (resetCard) resetCard.classList.remove("hidden")

  verifyPasswordResetCode(auth, actionCode)
    .then((email) => {
      showDetail(email ? `Conta: ${email}` : "")
    })
    .catch((error) => {
      console.error("Erro ao validar reset:", error)
      setStatus("Link expirado", "Este link ja nao e valido. Tente novamente.", true)
      showError("Este link ja nao e valido.")
      if (resetCard) resetCard.classList.add("hidden")
    })

  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault()

      const newPassword = newPasswordInput?.value || ""
      const confirmPassword = confirmPasswordInput?.value || ""

      if (!newPassword || newPassword.length < 6) {
        showError("Indique uma senha valida (minimo 6 caracteres).")
        return
      }

      if (newPassword !== confirmPassword) {
        showError("As senhas nao coincidem.")
        return
      }

      if (resetBtn) {
        resetBtn.disabled = true
        resetBtn.textContent = "A guardar..."
      }

      try {
        await confirmPasswordReset(auth, actionCode, newPassword)
        setStatus("Senha atualizada", "A sua senha foi alterada com sucesso.")
        showSuccess("Senha atualizada com sucesso.")
        if (resetCard) resetCard.classList.add("hidden")
      } catch (error) {
        console.error("Erro ao redefinir senha:", error)
        showError("Nao foi possivel alterar a senha.")
        if (resetBtn) {
          resetBtn.disabled = false
          resetBtn.textContent = "Guardar nova senha"
        }
      }
    })
  }
} else if (mode === "verifyAndChangeEmail") {
  setStatus("Confirmar alteracao", "A confirmar a alteracao de email...")
  checkActionCode(auth, actionCode)
    .then((info) => {
      const previousEmail = info?.data?.previousEmail || info?.data?.fromEmail
      const newEmail = info?.data?.email || info?.data?.newEmail
      if (previousEmail || newEmail) {
        showDetail(`${previousEmail || ""}${previousEmail && newEmail ? " -> " : ""}${newEmail || ""}`)
      }
      return applyActionCode(auth, actionCode)
    })
    .then(() => {
      setStatus("Email alterado", "O seu email foi atualizado com sucesso.")
      showSuccess("Email alterado com sucesso.")
    })
    .catch((error) => {
      console.error("Erro ao confirmar alteracao:", error)
      setStatus("Falha na alteracao", "Nao foi possivel confirmar o email.", true)
      showError("Nao foi possivel confirmar o email.")
    })
} else {
  setStatus("Acao desconhecida", "Este link nao e suportado.", true)
}
