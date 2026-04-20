import { auth, database, firestore } from "./firebase-config.js"
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { formatPhoneNumber, validatePhoneNumber, setupPhoneValidation, showSuccess, showError } from "./utils.js"

setupPhoneValidation("clientPhone")

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

document.getElementById("clientRegisterForm").addEventListener("submit", async (e) => {
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
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    await saveClientProfile(uid, {
      name,
      email,
      phone,
    })

    showSuccess("Cliente registado com sucesso! Redirecionando...")

    sessionStorage.setItem("clientEmail", email)
    sessionStorage.setItem("clientName", name)

    setTimeout(() => {
      window.location.href = "client-menu.html"
    }, 2000)
  } catch (error) {
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

      showSuccess("Conta criada com Google com sucesso! Redirecionando...")
      setTimeout(() => {
        window.location.href = "client-menu.html"
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
