import { database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { showSuccess, showError } from "./utils.js"

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("adminEmail").value
  const password = document.getElementById("adminPassword").value

  try {
    const adminsRef = ref(database, "admins")
    const snapshot = await get(adminsRef)

    if (!snapshot.exists()) {
      showError("Nenhum administrador registado. Por favor, registe-se primeiro.")
      return
    }

    let adminFound = null
    let adminKey = null

    snapshot.forEach((childSnapshot) => {
      const admin = childSnapshot.val()
      if (admin.email === email && admin.password === password) {
        adminFound = admin
        adminKey = childSnapshot.key
      }
    })

    if (!adminFound) {
      showError("Email ou senha incorretos.")
      return
    }

    sessionStorage.setItem("adminId", adminKey)
    sessionStorage.setItem("adminName", adminFound.name)
    sessionStorage.setItem("isAdmin", "true")

    showSuccess("Login efetuado com sucesso!")

    setTimeout(() => {
      window.location.href = "admin-panel.html"
    }, 1500)
  } catch (error) {
    showError("Erro ao fazer login: " + error.message)
  }
})
