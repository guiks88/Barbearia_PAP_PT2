import { auth, database } from "./firebase-config.js"
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { formatPhoneNumber, validatePhoneNumber, setupPhoneValidation, showSuccess, showError } from "./utils.js"

setupPhoneValidation("adminPhone")

document.getElementById("adminRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const phone = document.getElementById("adminPhone").value
  const password = document.getElementById("adminPassword").value
  const passwordConfirm = document.getElementById("adminPasswordConfirm").value
  const email = document.getElementById("adminEmail").value
  const name = document.getElementById("adminName").value

  if (!validatePhoneNumber(phone)) {
    showError("Número de telefone inválido. Use 9 dígitos começando com 9.")
    return
  }

  if (password !== passwordConfirm) {
    showError("As senhas não coincidem.")
    return
  }

  if (password.length < 6) {
    showError("A senha deve ter no mínimo 6 caracteres.")
    return
  }

  try {
    const adminsRef = ref(database, "admins")
    const snapshot = await get(adminsRef)

    if (snapshot.exists()) {
      let adminCount = 0
      snapshot.forEach(() => {
        adminCount++
      })

      if (adminCount >= 1) {
        showError("Já existe um administrador no sistema. Apenas 1 administrador é permitido.")
        return
      }

      let emailExists = false
      snapshot.forEach((childSnapshot) => {
        const admin = childSnapshot.val()
        if (admin.email === email) {
          emailExists = true
        }
      })

      if (emailExists) {
        showError("Este email já está registado.")
        return
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid

    const newAdmin = {
      name,
      email,
      phone: formatPhoneNumber(phone),
      createdAt: new Date().toISOString(),
    }

    await set(ref(database, `admins/${uid}`), newAdmin)

    showSuccess("Administrador registado com sucesso!")

    setTimeout(() => {
      signOut(auth)
      window.location.href = "admin-login.html"
    }, 2000)
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      showError("Este email já está registado no Firebase Auth.")
    } else if (error.message.includes("apiKey") || error.message.includes("projectId")) {
      showError("Firebase não está configurado! Verifique o arquivo firebase-config.js")
    } else {
      showError("Erro ao registar administrador: " + error.message)
    }
  }
})
