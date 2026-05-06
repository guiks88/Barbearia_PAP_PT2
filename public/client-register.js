import { auth, database, firestore, AUTH_ACTION_URL } from "./firebase-config.js"
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signOut,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { formatPhoneNumber, validatePhoneNumber, setupPhoneValidation, showSuccess, showError } from "./utils.js"

setupPhoneValidation("clientPhone")

const registerForm = document.getElementById("clientRegisterForm")
const registerSubmitBtn = document.getElementById("clientRegisterSubmitBtn")
const registerStatus = document.getElementById("clientRegisterStatus")
const registerStatusText = document.getElementById("clientRegisterStatusText")
const registerCountdown = document.getElementById("clientRegisterCountdown")

let verificationIntervalId = null
let countdownIntervalId = null
let countdownRemainingSeconds = 300

function clearVerificationTimers() {
  if (verificationIntervalId) {
    window.clearInterval(verificationIntervalId)
    verificationIntervalId = null
  }
  if (countdownIntervalId) {
    window.clearInterval(countdownIntervalId)
    countdownIntervalId = null
  }
}

function clearClientSession() {
  sessionStorage.removeItem("clientEmail")
  sessionStorage.removeItem("clientName")
  sessionStorage.removeItem("isClient")
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

async function finalizeVerificationFlow() {
  const user = auth.currentUser
  if (user?.emailVerified) {
    clearVerificationTimers()
    showSuccess("Email confirmado. A entrar no menu principal...")
    window.location.href = "index.html"
    return
  }

  if (countdownRemainingSeconds <= 0) {
    clearVerificationTimers()
    try {
      if (auth.currentUser) {
        await signOut(auth)
      }
    } catch (error) {
      console.error("Erro ao terminar sessao apos timeout de verificacao:", error)
    }
    clearClientSession()
    window.location.href = "index.html"
  }
}

async function checkEmailVerificationStatus() {
  try {
    const user = auth.currentUser
    if (!user) return
    await reload(user)
    await finalizeVerificationFlow()
  } catch (error) {
    console.error("Erro ao validar verificacao de email:", error)
  }
}

function startVerificationWaitFlow() {
  clearVerificationTimers()
  countdownRemainingSeconds = 300

  if (registerCountdown) {
    registerCountdown.textContent = `A aguardar confirmação do email... ${formatCountdown(countdownRemainingSeconds)}`
  }

  countdownIntervalId = window.setInterval(async () => {
    countdownRemainingSeconds -= 1

    if (registerCountdown) {
      registerCountdown.textContent = `A aguardar confirmação do email... ${formatCountdown(countdownRemainingSeconds)}`
    }

    if (countdownRemainingSeconds <= 0) {
      await finalizeVerificationFlow()
    }
  }, 1000)

  verificationIntervalId = window.setInterval(() => {
    checkEmailVerificationStatus()
  }, 5000)

  checkEmailVerificationStatus()
}

function showRegisterStatus(email) {
  if (registerStatusText) {
    registerStatusText.textContent = `Enviamos um email de verificacao para ${email}. Abra esse email e confirme a conta antes de fazer login. Se nao aparecer, veja tambem a pasta Spam ou Lixo.`
  }

  if (registerStatus) {
    registerStatus.classList.remove("hidden")
    registerStatus.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  if (registerForm) {
    registerForm.classList.add("hidden")
  }

  if (googleRegisterBtn) {
    googleRegisterBtn.classList.add("hidden")
  }

  startVerificationWaitFlow()
}

async function saveClientProfile(uid, { name, email, phone }) {
  const normalizedEmail = (email || "").trim().toLowerCase()
  const normalizedPhone = formatPhoneNumber(phone || "")

  const payload = {
    name: name || "Cliente",
    email: normalizedEmail,
    phone: normalizedPhone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await set(ref(database, `clients/${uid}`), payload)

  try {
    await setDoc(doc(firestore, "users", uid), {
      uid,
      email: normalizedEmail,
      fullName: payload.name,
      role: "client",
      roles: ["client"],
      birthDate: null,
      phone: normalizedPhone,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    const firestoreErrorCode = error?.code || ""
    if (firestoreErrorCode !== "permission-denied") {
      throw error
    }
    console.warn("Sem permissão para gravar users no Firestore. A conta cliente foi criada no Auth e RTDB.")
  }

  return payload
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const phone = document.getElementById("clientPhone").value
  const email = document.getElementById("clientEmail").value.trim().toLowerCase()
  const name = document.getElementById("clientName").value
  const password = document.getElementById("clientPassword").value

  if (!validatePhoneNumber(phone)) {
    showError("Número de telefone inválido. Use 9 dígitos começando com 9.")
    return
  }

  if (password.length < 6) {
    showError("A senha deve ter no mínimo 6 caracteres.")
    return
  }

  try {
    if (registerSubmitBtn) {
      registerSubmitBtn.disabled = true
      registerSubmitBtn.textContent = "A registar..."
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    await sendEmailVerification(credential.user, {
      url: AUTH_ACTION_URL,
      handleCodeInApp: true,
    })

    await saveClientProfile(uid, {
      name,
      email,
      phone,
    })

    sessionStorage.setItem("clientEmail", email)
    sessionStorage.setItem("clientName", name || "Cliente")
    sessionStorage.setItem("isClient", "true")

      showRegisterStatus(email)
      showSuccess("Conta criada. Verifique o seu email antes de entrar.")
  } catch (error) {
    if (registerSubmitBtn) {
      registerSubmitBtn.disabled = false
      registerSubmitBtn.textContent = "Registar"
    }

    if (error.code === "auth/email-already-in-use") {
      showError("Este email já está registado. Faça login.")
      return
    }

    if (error.message.includes("apiKey") || error.message.includes("projectId")) {
      showError("Firebase não está configurado! Verifique o arquivo firebase-config.js")
    } else {
      showError("Erro ao registar cliente: " + error.message)
    }
  }
})

const googleRegisterBtn = document.getElementById("googleRegisterBtn")
const googleRegisterBtnLabel = document.getElementById("googleRegisterBtnLabel")

if (googleRegisterBtn && googleRegisterBtnLabel) {
  googleRegisterBtn.addEventListener("click", async () => {
    googleRegisterBtn.disabled = true
    googleRegisterBtnLabel.textContent = "A criar conta com Google..."

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })

      const result = await signInWithPopup(auth, provider)
      const user = result.user
      const email = String(user.email || "").trim().toLowerCase()

      if (!email) {
        throw new Error("Não foi possível obter o email da conta Google.")
      }

      const nameInput = document.getElementById("clientName")
      const phoneInput = document.getElementById("clientPhone")
      const fallbackName = nameInput?.value?.trim() || user.displayName || "Cliente"
      const fallbackPhone = phoneInput?.value?.trim() || ""

      const profile = await saveClientProfile(user.uid, {
        name: fallbackName,
        email,
        phone: fallbackPhone,
      })

      sessionStorage.setItem("clientEmail", profile.email)
      sessionStorage.setItem("clientName", profile.name)
      sessionStorage.setItem("isClient", "true")

      showSuccess("Conta criada com Google com sucesso! Redirecionando...")
      setTimeout(() => {
        window.location.href = "index.html"
      }, 1500)
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") {
        showError("Registo com Google cancelado.")
      } else if (error.code === "auth/account-exists-with-different-credential") {
        showError("Este email já existe com outro método. Use email e senha para entrar.")
      } else {
        showError("Não foi possível criar conta com Google: " + (error.message || "tente novamente"))
      }
    } finally {
      googleRegisterBtn.disabled = false
      googleRegisterBtnLabel.textContent = "Criar conta com Google"
    }
  })
}

window.addEventListener("beforeunload", () => {
  clearVerificationTimers()
})
