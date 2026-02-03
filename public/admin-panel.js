import { database } from "./firebase-config.js"
import { ref, push, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import {
  formatPhoneNumber,
  validatePhoneNumber,
  setupPhoneValidation,
  showSuccess,
  showError,
  formatDate,
  SERVICE_DURATION,
} from "./utils.js"

const adminId = sessionStorage.getItem("adminId")
const adminName = sessionStorage.getItem("adminName")
const isAdmin = sessionStorage.getItem("isAdmin")

if (!adminId || !isAdmin || isAdmin !== "true") {
  window.location.href = "admin-login.html"
}

async function verifyAdminAccess() {
  try {
    const adminsRef = ref(database, "admins")
    const snapshot = await get(adminsRef)

    if (!snapshot.exists()) {
      sessionStorage.clear()
      window.location.href = "admin-login.html"
      return false
    }

    let adminExists = false
    snapshot.forEach((childSnapshot) => {
      if (childSnapshot.key === adminId) {
        adminExists = true
      }
    })

    if (!adminExists) {
      sessionStorage.clear()
      window.location.href = "admin-login.html"
      return false
    }

    return true
  } catch (error) {
    console.error("Error verifying admin:", error)
    return false
  }
}

verifyAdminAccess()

document.getElementById("adminNameDisplay").textContent = `Olá, ${adminName}`

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear()
  window.location.href = "index.html"
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

  const phone = document.getElementById("barberPhone").value

  if (!validatePhoneNumber(phone)) {
    showError("Número de telefone inválido. Use 9 dígitos começando com 9.")
    return
  }

  const barbersRef = ref(database, "barbers")
  const newBarberRef = push(barbersRef)

  const newBarber = {
    name: document.getElementById("barberName").value,
    email: document.getElementById("barberEmail").value,
    phone: formatPhoneNumber(phone),
    specialty: document.getElementById("barberSpecialty").value,
    createdAt: new Date().toISOString(),
  }

  try {
    await set(newBarberRef, newBarber)
    e.target.reset()
    showSuccess("Barbeiro adicionado com sucesso!")
  } catch (error) {
    showError("Erro ao adicionar barbeiro: " + error.message)
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
