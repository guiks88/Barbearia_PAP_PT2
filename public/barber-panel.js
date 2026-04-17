import { database } from "./firebase-config.js"
import { ref, get, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { showSuccess, showError } from "./utils.js"

let barberId = null
let barberName = null
let barberEmail = null
let allBookings = []

window.addEventListener("load", () => {
  barberId = sessionStorage.getItem("barberId")
  barberName = sessionStorage.getItem("barberName")
  barberEmail = sessionStorage.getItem("barberEmail")
  const isBarber = sessionStorage.getItem("isBarber")

  if (!barberId || !isBarber) {
    showError("Acesso negado. Por favor, faca login como barbeiro.")
    setTimeout(() => {
      window.location.href = "barber-login.html"
    }, 2000)
    return
  }

  document.getElementById("barberNameDisplay").textContent = barberName || "Barbeiro"
  document.getElementById("barberEmailDisplay").textContent = barberEmail || ""

  const today = new Date().toISOString().split("T")[0]
  document.getElementById("dateFilter").value = today

  loadBookings()

  document.getElementById("dateFilter").addEventListener("change", () => {
    displayBookings()
  })
})

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")

  showSuccess("Logout efetuado com sucesso!")

  setTimeout(() => {
    window.location.href = "barber-login.html"
  }, 1000)
})

function getLifecycleLabel(booking) {
  if (booking.status === "cancelled") return "Anulada"
  if (booking.status === "cancel_requested") return "Cancelamento pendente"
  return "Ativa"
}

function getExecutionStatus(booking) {
  return booking.executionStatus || "pending"
}

function getExecutionLabel(booking) {
  const status = getExecutionStatus(booking)
  if (status === "in_progress") return "A ser concluida"
  if (status === "completed") return "Concluida"
  return "Nao concluida"
}

function getExecutionClass(booking) {
  const status = getExecutionStatus(booking)
  if (status === "in_progress") return "is-progress"
  if (status === "completed") return "is-completed"
  return "is-pending"
}

function getLifecycleClass(booking) {
  if (booking.status === "cancelled") return "is-cancel"
  if (booking.status === "cancel_requested") return "is-warning"
  return "is-pending"
}

function loadBookings() {
  const bookingsRef = ref(database, "bookings")

  onValue(bookingsRef, (snapshot) => {
    if (!snapshot.exists()) {
      allBookings = []
      displayBookings()
      updateStats()
      return
    }

    const bookingsData = snapshot.val()
    allBookings = Object.entries(bookingsData)
      .map(([id, booking]) => ({ id, ...booking }))
      .filter((booking) => booking.barberId === barberId)
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date)
        }
        return (a.time || "").localeCompare(b.time || "")
      })

    displayBookings()
    updateStats()
  })
}

function renderBookingActions(booking) {
  if (booking.status === "cancelled") {
    return '<p style="font-size: 0.85rem; color: #fca5a5;">Marcacao anulada</p>'
  }

  if (booking.status === "cancel_requested") {
    return '<p style="font-size: 0.85rem; color: #fcd34d;">A aguardar aprovacao do admin</p>'
  }

  const executionStatus = getExecutionStatus(booking)

  let actions = ""
  if (executionStatus === "pending") {
    actions += `<button class="btn btn-primary" onclick="startCut('${booking.id}')">Iniciar corte</button>`
  } else if (executionStatus === "in_progress") {
    actions += `<button class="btn btn-primary" onclick="completeCut('${booking.id}')">Concluir corte</button>`
  } else {
    actions += `<button class="btn btn-secondary" disabled>Corte concluido</button>`
  }

  actions += `<button class="btn btn-secondary" onclick="requestCancel('${booking.id}')">Pedir cancelamento</button>`
  return actions
}

function displayBookings() {
  const container = document.getElementById("appointmentsContainer")
  const selectedDate = document.getElementById("dateFilter").value

  const filteredBookings = allBookings.filter((booking) => booking.date === selectedDate)

  if (!filteredBookings.length) {
    container.innerHTML = `
      <div class="no-appointments">
        <p>Nao ha marcacoes para esta data</p>
        <p style="font-size: 0.9rem; color: #999;">Selecione outra data para ver suas marcacoes</p>
      </div>
    `
    return
  }

  container.innerHTML = filteredBookings
    .map(
      (booking) => `
        <div class="appointment-card">
          <div class="appointment-time">
            ${booking.time || "-"}
          </div>
          <div class="appointment-details">
            <h3>${booking.clientName || "Cliente"}</h3>
            <p>${booking.clientEmail || "Email nao disponivel"}</p>
            <p>${booking.clientPhone || booking.clientPhoneComplete || "Telefone nao disponivel"}</p>
            <div class="status-badges">
              <span class="status-pill ${getExecutionClass(booking)}">${getExecutionLabel(booking)}</span>
              <span class="status-pill ${getLifecycleClass(booking)}">${getLifecycleLabel(booking)}</span>
            </div>
          </div>
          <div>
            <div class="appointment-service">
              ${formatServiceName(booking.service)}
            </div>
            <div class="appointment-actions">
              ${renderBookingActions(booking)}
            </div>
          </div>
        </div>
      `,
    )
    .join("")
}

async function saveBookingPatch(bookingId, partial) {
  const bookingRef = ref(database, `bookings/${bookingId}`)
  const snapshot = await get(bookingRef)

  if (!snapshot.exists()) {
    throw new Error("Marcacao nao encontrada")
  }

  const current = snapshot.val()
  await set(bookingRef, {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
    updatedBy: "barber",
  })
}

window.startCut = async (bookingId) => {
  try {
    await saveBookingPatch(bookingId, {
      executionStatus: "in_progress",
      startedAt: new Date().toISOString(),
    })
    showSuccess("Corte iniciado.")
  } catch (error) {
    showError("Erro ao iniciar corte: " + error.message)
  }
}

window.completeCut = async (bookingId) => {
  try {
    await saveBookingPatch(bookingId, {
      executionStatus: "completed",
      completedAt: new Date().toISOString(),
    })
    showSuccess("Corte concluido com sucesso.")
  } catch (error) {
    showError("Erro ao concluir corte: " + error.message)
  }
}

window.requestCancel = async (bookingId) => {
  const shouldCancel = window.confirm("Deseja pedir cancelamento desta marcacao? O admin precisa aprovar.")
  if (!shouldCancel) return

  try {
    await saveBookingPatch(bookingId, {
      status: "cancel_requested",
      cancellationRequest: {
        requestedBy: "barber",
        requestedAt: new Date().toISOString(),
      },
    })
    showSuccess("Pedido de cancelamento enviado para aprovacao do administrador.")
  } catch (error) {
    showError("Erro ao pedir cancelamento: " + error.message)
  }
}

function updateStats() {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  const activeBookings = allBookings.filter((b) => b.status !== "cancelled")

  const todayBookings = activeBookings.filter((b) => b.date === todayStr)
  document.getElementById("todayCount").textContent = todayBookings.length

  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  const weekBookings = activeBookings.filter((b) => {
    const bookingDate = new Date(b.date)
    return bookingDate >= startOfWeek && bookingDate <= endOfWeek
  })
  document.getElementById("weekCount").textContent = weekBookings.length

  const monthBookings = activeBookings.filter((b) => {
    const bookingDate = new Date(b.date)
    return bookingDate.getMonth() === today.getMonth() && bookingDate.getFullYear() === today.getFullYear()
  })
  document.getElementById("monthCount").textContent = monthBookings.length
}

function formatServiceName(service) {
  const serviceNames = {
    corte: "Corte de Cabelo",
    barba: "Barba",
    "corte-barba": "Corte + Barba",
    sobrancelha: "Sobrancelha",
    completo: "Pacote Completo",
  }
  return serviceNames[service] || service
}
