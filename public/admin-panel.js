import { auth, database, firebaseConfig } from "./firebase-config.js"
import { ref, push, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import {
  formatPhoneNumber,
  validatePhoneNumber,
  setupPhoneValidation,
  showSuccess,
  showError,
  formatDate,
  SERVICE_DURATION,
} from "./utils.js"

const secondaryApp = initializeApp(firebaseConfig, "secondary")
const secondaryAuth = getAuth(secondaryApp)

async function verifyAdminAccess(user) {
  try {
    const adminRef = ref(database, `admins/${user.uid}`)
    const snapshot = await get(adminRef)

    if (!snapshot.exists()) {
      await signOut(auth)
      sessionStorage.clear()
      window.location.href = "admin-login.html"
      return false
    }

    const adminData = snapshot.val()
    sessionStorage.setItem("adminId", user.uid)
    sessionStorage.setItem("adminName", adminData.name)
    sessionStorage.setItem("isAdmin", "true")
    document.getElementById("adminNameDisplay").textContent = `Olá, ${adminData.name}`

    return true
  } catch (error) {
    console.error("Error verifying admin:", error)
    return false
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    sessionStorage.clear()
    window.location.href = "admin-login.html"
    return
  }
  verifyAdminAccess(user)
})

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).finally(() => {
    sessionStorage.clear()
    window.location.href = "index.html"
  })
})

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab

    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")

    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"))
    document.getElementById(`${tab}-tab`).classList.add("active")
  })
})

setupPhoneValidation("barberPhone")

document.getElementById("barberForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("barberEmail").value
  const phone = document.getElementById("barberPhone").value
  const password = document.getElementById("barberPassword").value

  if (!validatePhoneNumber(phone)) {
    showError("Número de telefone inválido. Use 9 dígitos começando com 9.")
    return
  }

  if (!password || password.length < 6) {
    showError("A senha deve ter pelo menos 6 caracteres.")
    return
  }

  try {
    const barberCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const barberUid = barberCredential.user.uid

    const startTime = document.getElementById("barberStartTime").value
    const endTime = document.getElementById("barberEndTime").value

    const newBarber = {
      name: document.getElementById("barberName").value,
      email,
      phone: formatPhoneNumber(phone),
      specialty: document.getElementById("barberSpecialty").value,
      workingHours: {
        start: startTime,
        end: endTime
      },
      createdAt: new Date().toISOString(),
    }

    await set(ref(database, `barbers/${barberUid}`), newBarber)
    await signOut(secondaryAuth)
    e.target.reset()
    showSuccess("Barbeiro adicionado com sucesso!")
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      showError("Este email já está registado no Firebase Auth.")
    } else {
      showError("Erro ao adicionar barbeiro: " + error.message)
    }
  }
})

function loadBarbers() {
  const barbersRef = ref(database, "barbers")

  onValue(barbersRef, (snapshot) => {
    const container = document.getElementById("barbersList")

    if (!snapshot.exists()) {
      container.innerHTML = '<div class="empty-state">Nenhum barbeiro registado</div>'
      return
    }

    const barbers = snapshot.val()

    container.innerHTML = Object.entries(barbers)
      .map(
        ([id, barber]) => `
        <div class="barber-item">
          <div>
            <h3>${barber.name}</h3>
            <p><strong>Email:</strong> ${barber.email}</p>
            <p><strong>Telefone:</strong> ${barber.phone}</p>
            ${barber.specialty ? `<p><strong>Especialidade:</strong> ${barber.specialty}</p>` : ""}
            ${barber.workingHours ? `<p><strong>Horário:</strong> ${barber.workingHours.start} - ${barber.workingHours.end}</p>` : ""}
          </div>
          <button class="btn btn-danger" onclick="deleteBarber('${id}')">Eliminar</button>
        </div>
      `,
      )
      .join("")
  })
}

window.deleteBarber = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar este barbeiro?")) return

  const barberRef = ref(database, `barbers/${id}`)

  try {
    await remove(barberRef)
    showSuccess("Barbeiro eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar barbeiro: " + error.message)
  }
}

function loadAllBookings() {
  const bookingsRef = ref(database, "bookings")
  const barbersRef = ref(database, "barbers")

  onValue(bookingsRef, async (bookingsSnapshot) => {
    const container = document.getElementById("allBookingsList")

    if (!bookingsSnapshot.exists()) {
      container.innerHTML = '<div class="empty-state">Nenhuma marcação encontrada</div>'
      return
    }

    const barbersSnapshot = await get(barbersRef)
    const barbers = barbersSnapshot.exists() ? barbersSnapshot.val() : {}

    const bookings = bookingsSnapshot.val()
    const serviceNames = {
      corte: "Corte de Cabelo",
      barba: "Barba",
      "corte-barba": "Corte + Barba",
      sobrancelha: "Sobrancelha",
      completo: "Pacote Completo",
    }

    container.innerHTML = Object.entries(bookings)
      .map(([id, booking]) => {
        const barber = barbers[booking.barberId]
        return `
          <div class="booking-item">
            <div>
              <h3>${booking.clientName}</h3>
              <p><strong>Telefone:</strong> ${booking.clientPhone}</p>
              <p><strong>Serviço:</strong> ${serviceNames[booking.service]} (${SERVICE_DURATION[booking.service]} min)</p>
              <p><strong>Barbeiro:</strong> ${barber ? barber.name : "N/A"}</p>
              <p><strong>Data:</strong> ${formatDate(booking.date)}</p>
              <p><strong>Horário:</strong> ${booking.time}</p>
            </div>
            <button class="btn btn-danger" onclick="deleteBooking('${id}')">Cancelar</button>
          </div>
        `
      })
      .join("")
  })
}

window.deleteBooking = async (id) => {
  if (!confirm("Tem certeza que deseja cancelar esta marcação?")) return

  const bookingRef = ref(database, `bookings/${id}`)

  try {
    await remove(bookingRef)
    showSuccess("Marcação cancelada com sucesso!")
  } catch (error) {
    showError("Erro ao cancelar marcação: " + error.message)
  }
}

function loadClients() {
  const clientsRef = ref(database, "clients")

  onValue(clientsRef, (snapshot) => {
    const container = document.getElementById("clientsList")

    if (!snapshot.exists()) {
      container.innerHTML = '<div class="empty-state">Nenhum cliente registado</div>'
      return
    }

    const clients = snapshot.val()

    container.innerHTML = Object.entries(clients)
      .map(
        ([id, client]) => `
        <div class="barber-item">
          <div>
            <h3>${client.name}</h3>
            <p><strong>Email:</strong> ${client.email}</p>
            <p><strong>Telefone:</strong> ${client.phone}</p>
            <p><strong>Registado em:</strong> ${formatDate(client.createdAt.split("T")[0])}</p>
          </div>
          <button class="btn btn-danger" onclick="deleteClient('${id}')">Eliminar</button>
        </div>
      `,
      )
      .join("")
  })
}

window.deleteClient = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar este cliente? As marcações associadas serão mantidas.")) return

  const clientRef = ref(database, `clients/${id}`)

  try {
    await remove(clientRef)
    showSuccess("Cliente eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar cliente: " + error.message)
  }
}

loadBarbers()
loadAllBookings()
loadClients()
