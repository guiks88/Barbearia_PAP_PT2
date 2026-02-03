import { auth, database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

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
      showError("Esta conta não está autorizada como barbeiro.")
      return
    }

    const barberFound = snapshot.val()

    sessionStorage.setItem("barberId", uid)
    sessionStorage.setItem("barberName", barberFound.name)
    sessionStorage.setItem("isBarber", "true")

    showSuccess("Login efetuado com sucesso!")

    setTimeout(() => {
      window.location.href = "bookings.html"
    }, 1500)
  } catch (error) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      showError("Email ou senha incorretos.")
    } else {
      showError("Erro ao fazer login: " + error.message)
    }
  }
})
