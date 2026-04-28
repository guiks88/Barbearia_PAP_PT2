import { auth } from "./firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const backBtn = document.getElementById("clientMenuBackBtn")
const logoutBtn = document.getElementById("clientMenuLogoutBtn")
const userInfo = document.getElementById("clientMenuUserInfo")

function clearClientSession() {
  sessionStorage.removeItem("clientEmail")
  sessionStorage.removeItem("clientName")
  sessionStorage.removeItem("isClient")
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")
  sessionStorage.removeItem("adminId")
  sessionStorage.removeItem("adminName")
  sessionStorage.removeItem("isAdmin")
}

if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = "index.html"
  })
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Erro ao terminar sessão:", error)
    }

    clearClientSession()
    window.location.href = "index.html"
  })
}


onAuthStateChanged(auth, (user) => {
  if (!user) {
    signOut(auth).catch(() => {})
    clearClientSession()
    window.location.href = "login.html"
    return
  }

  if (userInfo) {
    userInfo.textContent = "Obrigado por escolher a nossa barbearia. Vamos cuidar do seu visual com a máxima atenção."
  }

})
