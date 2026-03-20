import { database, firestore } from "./firebase-config.js"
import { ref, push, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { formatPhoneNumber, validatePhoneNumber, setupPhoneValidation, showSuccess, showError } from "./utils.js"

setupPhoneValidation("clientPhone")

document.getElementById("clientRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const phone = document.getElementById("clientPhone").value
  const email = document.getElementById("clientEmail").value
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
    const clientsRef = ref(database, "clients")
    const snapshot = await get(clientsRef)

    if (snapshot.exists()) {
      const clients = snapshot.val()
      const emailExists = Object.values(clients).some((client) => client.email === email)

      if (emailExists) {
        showError("Este email já está registado!")
        return
      }
    }

    const newClientRef = push(clientsRef)

    const newClient = {
      name: name,
      email: email,
      phone: formatPhoneNumber(phone),
      password: password,
      createdAt: new Date().toISOString(),
    }

    await set(newClientRef, newClient)

    const clientUid = newClientRef.key
    const userDoc = {
      uid: clientUid,
      email: email,
      fullName: name,
      role: "client",
      roles: ["client"],
      birthDate: null,
      phone: formatPhoneNumber(phone),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(doc(firestore, "users", clientUid), userDoc)

    showSuccess("Cliente registado com sucesso! Redirecionando...")

    sessionStorage.setItem("clientEmail", email)
    sessionStorage.setItem("clientName", name)

    setTimeout(() => {
      window.location.href = "bookings.html"
    }, 2000)
  } catch (error) {
    if (error.message.includes("apiKey") || error.message.includes("projectId")) {
      showError("Firebase não está configurado! Verifique o arquivo firebase-config.js")
    } else {
      showError("Erro ao registar cliente: " + error.message)
    }
  }
})
