import { auth, database } from "./firebase-config.js"
import { ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

async function findBarberByEmail(email) {
  const snapshot = await get(ref(database, "barbers"))
  if (!snapshot.exists()) return null

  const targetEmail = normalizeEmail(email)
  const barbers = snapshot.val() || {}

  for (const [barberId, barber] of Object.entries(barbers)) {
    if (normalizeEmail(barber?.email) === targetEmail) {
      return {
        barberId,
        barber,
      }
    }
  }

  return null
}

document.getElementById("barberLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("barberEmail").value
  const password = document.getElementById("barberPassword").value

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid

    const barberRef = ref(database, `barbers/${uid}`)
    const snapshot = await get(barberRef)

    if (!snapshot.exists()) {
      await signOut(auth)
      showError("Senha/email incorretos.")
      return
    }

    const barberFound = snapshot.val()

    if (barberFound.isActive === false) {
      await signOut(auth)
      showError("Conta de barbeiro desativada. Fale com a barbearia.")
      return
    }

    sessionStorage.setItem("barberId", uid)
    sessionStorage.setItem("barberName", barberFound.name)
    sessionStorage.setItem("barberEmail", email)
    sessionStorage.setItem("isBarber", "true")

    showSuccess("Login efetuado com sucesso!")

    setTimeout(() => {
      window.location.href = "barber-panel.html"
    }, 1500)
  } catch (error) {
    if (
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-credential" ||
      error.code === "auth/invalid-login-credentials"
    ) {
      showError("Senha/email incorretos.")
    } else {
      showError("Erro ao fazer login: " + error.message)
    }
  }
})

const forgotToggleBtn = document.getElementById("barberForgotToggle")
const requestForm = document.getElementById("barberPasswordRequestForm")
const requestEmailInput = document.getElementById("barberResetEmail")
const requestPasswordInput = document.getElementById("barberResetPassword")
const requestPasswordConfirmInput = document.getElementById("barberResetPasswordConfirm")

if (forgotToggleBtn && requestForm) {
  forgotToggleBtn.addEventListener("click", (event) => {
    event.preventDefault()
    requestForm.classList.toggle("hidden")
    if (!requestForm.classList.contains("hidden")) {
      requestEmailInput?.focus()
    }
  })
}

if (requestForm) {
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    const email = normalizeEmail(requestEmailInput?.value)
    const proposedPassword = String(requestPasswordInput?.value || "")
    const confirmPassword = String(requestPasswordConfirmInput?.value || "")

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError("Indique um email válido.")
      return
    }

    if (!proposedPassword || proposedPassword.length < 6) {
      showError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (proposedPassword !== confirmPassword) {
      showError("As senhas não coincidem.")
      return
    }

    try {
      const barberMatch = await findBarberByEmail(email)
      if (!barberMatch) {
        showError("Senha/email incorretos.")
        return
      }

      const requestRef = push(ref(database, "barberPasswordRequests"))
      await set(requestRef, {
        barberId: barberMatch.barberId,
        barberName: barberMatch.barber?.name || "Barbeiro",
        barberEmail: email,
        status: "pending",
        requestedAt: new Date().toISOString(),
      })

      showSuccess("Pedido enviado ao admin. A nova senha será aplicada após aprovação.")
      requestForm.reset()
      requestForm.classList.add("hidden")
    } catch (error) {
      console.error("Erro ao criar pedido de alteração de senha:", error)
      showError("Não foi possível enviar o pedido agora.")
    }
  })
}
