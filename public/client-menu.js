import { auth } from "./firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const logoutBtn = document.getElementById("clientMenuLogoutBtn")
const userInfo = document.getElementById("clientMenuUserInfo")

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth)
    } finally {
      sessionStorage.clear()
      window.location.href = "index.html"
    }
  })
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    sessionStorage.clear()
    window.location.href = "login.html"
    return
  }

  if (userInfo) {
    userInfo.textContent = `Sessão ativa: ${user.email || "cliente"}. Escolha uma opção para continuar.`
  }
})
