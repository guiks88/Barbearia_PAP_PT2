import { database } from "./firebase-config.js"
import { ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { showSuccess, showError, SERVICE_DURATION } from "./utils.js"

let authenticatedClient = null

window.addEventListener("load", () => {
  const clientEmail = sessionStorage.getItem("clientEmail")
  const clientName = sessionStorage.getItem("clientName")

  if (clientEmail && clientName) {
    authenticatedClient = { email: clientEmail, name: clientName }
    showBookingForm()
  }
})

document.getElementById("clientLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const emailOrName = document.getElementById("loginEmail").value.trim()
  const password = document.getElementById("loginPassword").value

  try {
    const clientsRef = ref(database, "clients")
    const snapshot = await get(clientsRef)

    if (!snapshot.exists()) {
      showError("Cliente não encontrado. Por favor, registe-se primeiro.")
      return
    }

    const clients = snapshot.val()

    const client = Object.values(clients).find(
      (c) => (c.email === emailOrName || c.name === emailOrName) && c.password === password,
    )

    if (!client) {
      showError("Email/Nome ou senha incorretos.")
      return
    }

    authenticatedClient = client
    sessionStorage.setItem("clientEmail", client.email)
    sessionStorage.setItem("clientName", client.name)

    showSuccess("Autenticado com sucesso!")
    showBookingForm()
  } catch (error) {
    showError("Erro ao autenticar: " + error.message)
  }
})

function showBookingForm() {
  document.getElementById("clientLoginForm").style.display = "none"
  document.getElementById("bookingForm").style.display = "block"
  document.getElementById("clientNameDisplay").textContent = authenticatedClient.name
  document.getElementById("clientEmailDisplay").textContent = authenticatedClient.email

  loadBarbers()
}

function loadBarbers() {
  const barbersRef = ref(database, "barbers")

  onValue(barbersRef, (snapshot) => {
    const select = document.getElementById("barber")
    select.innerHTML = '<option value="">Selecione um barbeiro</option>'

    if (snapshot.exists()) {
      const barbers = snapshot.val()
      Object.entries(barbers).forEach(([id, barber]) => {
        const option = document.createElement("option")
        option.value = id
        option.textContent = barber.name
        select.appendChild(option)
      })
    }
  })
}

async function isBarberAvailable(barberId, date, time, serviceType) {
  const bookingsRef = ref(database, "bookings")
  const snapshot = await get(bookingsRef)

  if (!snapshot.exists()) {
    return true
  }

  const bookings = snapshot.val()
  const serviceDuration = SERVICE_DURATION[serviceType]

  const [hours, minutes] = time.split(":").map(Number)
  const startTime = hours * 60 + minutes
  const endTime = startTime + serviceDuration

  for (const booking of Object.values(bookings)) {
    if (booking.barberId === barberId && booking.date === date) {
      const [bookingHours, bookingMinutes] = booking.time.split(":").map(Number)
      const bookingStartTime = bookingHours * 60 + bookingMinutes
      const bookingDuration = SERVICE_DURATION[booking.service]
      const bookingEndTime = bookingStartTime + bookingDuration

      if (
        (startTime >= bookingStartTime && startTime < bookingEndTime) ||
        (endTime > bookingStartTime && endTime <= bookingEndTime) ||
        (startTime <= bookingStartTime && endTime >= bookingEndTime)
      ) {
        return false
      }
    }
  }

  return true
}

function showBookingConfirmation() {
  const modal = document.createElement("div")
  modal.className = "confirmation-modal"
  modal.innerHTML = `
    <div class="confirmation-modal-content">
      <h3>Marcação criada com sucesso!</h3>
      <p>Deseja fazer outra marcação ou sair?</p>
      <div class="confirmation-buttons">
        <button id="newBookingBtn" class="btn btn-primary">Nova Marcação</button>
        <button id="logoutBtn" class="btn btn-secondary">Sair</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  document.getElementById("newBookingBtn").addEventListener("click", () => {
    modal.remove()
    document.getElementById("service").value = ""
    document.getElementById("barber").value = ""
    document.getElementById("date").value = ""
    document.getElementById("time").value = ""
  })

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("clientEmail")
    sessionStorage.removeItem("clientName")
    window.location.href = "index.html"
  })
}

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  if (!authenticatedClient) {
    showError("Por favor, autentique-se primeiro.")
    return
  }

  const barberId = document.getElementById("barber").value
  const date = document.getElementById("date").value
  const time = document.getElementById("time").value
  const service = document.getElementById("service").value

  const available = await isBarberAvailable(barberId, date, time, service)

  if (!available) {
    showError("Este barbeiro já tem uma marcação neste horário. Por favor, escolha outro horário ou barbeiro.")
    return
  }

  const bookingsRef = ref(database, "bookings")
  const newBookingRef = push(bookingsRef)

  const newBooking = {
    clientName: authenticatedClient.name,
    clientEmail: authenticatedClient.email,
    clientPhone: authenticatedClient.phone || "",
    service: service,
    barberId: barberId,
    date: date,
    time: time,
    createdAt: new Date().toISOString(),
  }

  try {
    await set(newBookingRef, newBooking)

    showSuccess("Marcação criada com sucesso!")

    setTimeout(() => {
      showBookingConfirmation()
    }, 1000)
  } catch (error) {
    showError("Erro ao criar marcação: " + error.message)
  }
})

document.getElementById("date").min = new Date().toISOString().split("T")[0]
