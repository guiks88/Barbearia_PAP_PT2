import { auth, database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("adminEmail").value
  const password = document.getElementById("adminPassword").value

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid

    const adminRef = ref(database, `admins/${uid}`)
    const snapshot = await get(adminRef)

    if (!snapshot.exists()) {
      await signOut(auth)
      showError("Esta conta não está autorizada como administrador.")
      return
    }

    const adminFound = snapshot.val()

    sessionStorage.setItem("adminId", uid)
    sessionStorage.setItem("adminName", adminFound.name)
    sessionStorage.setItem("isAdmin", "true")

    showSuccess("Login efetuado com sucesso!")

    setTimeout(() => {
      window.location.href = "admin-panel.html"
    }, 1500)
  } catch (error) {
    if (error.code === "auth/wrong-password") {
      showError("Senha incorreta.")
    } else if (error.code === "auth/user-not-found") {
      showError("Esse email não está registrado. Cria uma conta.")
    } else if (error.code === "auth/invalid-credential" || error.code === "auth/invalid-login-credentials") {
      showError("Senha incorreta.")
    } else {
      showError("Erro ao fazer login: " + error.message)
    }
  }
})
