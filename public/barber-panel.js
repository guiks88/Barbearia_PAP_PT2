import { auth, database } from "./firebase-config.js"
import { ref, get, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

let barberId = null
let barberName = null
let barberEmail = null
let allBookings = []

// Verificar autenticação
window.addEventListener("load", () => {
  barberId = sessionStorage.getItem("barberId")
  barberName = sessionStorage.getItem("barberName")
  barberEmail = sessionStorage.getItem("barberEmail")
  const isBarber = sessionStorage.getItem("isBarber")

  if (!barberId || !isBarber) {
    showError("Acesso negado. Por favor, faça login como barbeiro.")
    setTimeout(() => {
      window.location.href = "barber-login.html"
    }, 2000)
    return
  }

  onAuthStateChanged(auth, (user) => {
    if (!user || user.uid !== barberId) {
      sessionStorage.removeItem("barberId")
      sessionStorage.removeItem("barberName")
      sessionStorage.removeItem("barberEmail")
      sessionStorage.removeItem("isBarber")
      showError("Sessão expirada. Faça login novamente.")
      setTimeout(() => {
        window.location.href = "barber-login.html"
      }, 1200)
      return
    }

    // Exibir informações do barbeiro
    document.getElementById("barberNameDisplay").textContent = barberName || "Barbeiro"
    document.getElementById("barberEmailDisplay").textContent = barberEmail || ""

    // Definir data de hoje como padrão
    const today = new Date().toISOString().split("T")[0]
    document.getElementById("dateFilter").value = today

    // Carregar marcações
    loadBookings()

    // Listener para mudança de data
    document.getElementById("dateFilter").addEventListener("change", () => {
      displayBookings()
    })
  })
})

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).catch(() => {})
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")
  
  showSuccess("Logout efetuado com sucesso!")
  
  setTimeout(() => {
    window.location.href = "barber-login.html"
  }, 1000)
})

// Carregar marcações em tempo real
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
      .filter(booking => booking.barberId === barberId)
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date)
        }
        return a.time.localeCompare(b.time)
      })

    displayBookings()
    updateStats()
  })
}

// Exibir marcações filtradas por data
function displayBookings() {
  const container = document.getElementById("appointmentsContainer")
  const selectedDate = document.getElementById("dateFilter").value
  
  const filteredBookings = allBookings.filter(booking => booking.date === selectedDate)

  autoCancelExpiredBookings(filteredBookings)

  if (filteredBookings.length === 0) {
    container.innerHTML = `
      <div class="no-appointments">
        <p>Não há marcações para esta data</p>
        <p style="font-size: 0.9rem; color: #999;">Selecione outra data para ver suas marcações</p>
      </div>
    `
    return
  }

  container.innerHTML = filteredBookings.map(booking => `
    <div class="appointment-card">
      <div class="appointment-time">
        ${booking.time}
      </div>
      <div class="appointment-details">
        <h3>👤 ${booking.clientName}</h3>
        <p>📧 ${booking.clientEmail || 'Email não disponível'}</p>
        <p>📱 ${booking.clientPhone || 'Telefone não disponível'}</p>
        <div class="status-badges">
          <span class="status-pill ${getExecutionClass(booking)}">${getExecutionLabel(booking)}</span>
          <span class="status-pill ${getLifecycleClass(booking)}">${getLifecycleLabel(booking)}</span>
        </div>
        <div class="appointment-actions">
          ${renderActions(booking)}
        </div>
      </div>
      <div class="appointment-service">
        ${formatServiceName(booking.service)}
      </div>
    </div>
  `).join('')
}

function getExecutionLabel(booking) {
  const status = booking.executionStatus || "pending"
  if (status === "in_progress") return "A ser concluída"
  if (status === "completed") return "Concluída"
  return "Não concluída"
}

function getExecutionClass(booking) {
  const status = booking.executionStatus || "pending"
  if (status === "in_progress") return "is-progress"
  if (status === "completed") return "is-completed"
  return "is-pending"
}

function getLifecycleLabel(booking) {
  if (booking.status === "cancelled") return "Anulada"
  if (booking.status === "cancel_requested") return "Cancelamento pendente"
  return "Ativa"
}

function getLifecycleClass(booking) {
  if (booking.status === "cancelled") return "is-cancelled"
  if (booking.status === "cancel_requested") return "is-warning"
  return "is-pending"
}

function renderActions(booking) {
  if (booking.status === "cancelled") {
    return `<button class="btn btn-secondary" disabled>Marcação anulada</button>`
  }

  if (booking.status === "cancel_requested") {
    return `<button class="btn btn-secondary" disabled>A aguardar aprovação admin</button>`
  }

  const executionStatus = booking.executionStatus || "pending"
  const buttons = []
  const minutesFromBooking = getMinutesFromBooking(booking)
  const tooEarly = minutesFromBooking < -120
  const tooLate = minutesFromBooking > 60

  if (executionStatus === "pending") {
    if (tooLate) {
      buttons.push(`<button class="btn btn-secondary" disabled>Prazo expirado (+1h)</button>`)
    } else if (tooEarly) {
      buttons.push(`<button class="btn btn-secondary" disabled>Disponível até 2h antes</button>`)
    } else {
      buttons.push(`<button class="btn btn-primary" onclick="startCut('${booking.id}')">Iniciar corte</button>`)
    }
  } else if (executionStatus === "in_progress") {
    buttons.push(`<button class="btn btn-primary" onclick="completeCut('${booking.id}')">Concluir corte</button>`)
  } else {
    buttons.push(`<button class="btn btn-secondary" disabled>Corte concluído</button>`)
  }

  buttons.push(`<button class="btn btn-secondary" onclick="requestCancel('${booking.id}')">Pedir cancelamento</button>`)
  return buttons.join("")
}

async function patchBooking(bookingId, partialData) {
  const bookingRef = ref(database, `bookings/${bookingId}`)
  const snapshot = await get(bookingRef)

  if (!snapshot.exists()) {
    throw new Error("Marcação não encontrada")
  }

  const currentData = snapshot.val()
  await set(bookingRef, {
    ...currentData,
    ...partialData,
    updatedAt: new Date().toISOString(),
    updatedBy: "barbeiro",
  })
}

function getBookingDateTime(booking) {
  if (!booking?.date || !booking?.time) return null
  const dateTime = new Date(`${booking.date}T${booking.time}:00`)
  if (Number.isNaN(dateTime.getTime())) return null
  return dateTime
}

function getMinutesFromBooking(booking) {
  const bookingDateTime = getBookingDateTime(booking)
  if (!bookingDateTime) return 0
  const now = new Date()
  return Math.round((now.getTime() - bookingDateTime.getTime()) / 60000)
}

async function autoCancelExpiredBookings(bookings) {
  const candidates = bookings.filter((booking) => {
    if (!booking) return false
    if (booking.status === "cancelled" || booking.status === "cancel_requested") return false
    if ((booking.executionStatus || "pending") !== "pending") return false
    return getMinutesFromBooking(booking) > 60
  })

  if (!candidates.length) return

  await Promise.all(
    candidates.map((booking) =>
      patchBooking(booking.id, {
        status: "cancelled",
        cancelledBy: "system",
        cancellationReason: "Não iniciado até 1h após o horário marcado",
        cancelledAt: new Date().toISOString(),
      }).catch((error) => {
        console.error("Erro no cancelamento automático:", error)
      }),
    ),
  )
}

window.startCut = async (bookingId) => {
  try {
    const booking = allBookings.find((item) => item.id === bookingId)
    if (!booking) {
      showError("Marcação não encontrada.")
      return
    }

    const minutesFromBooking = getMinutesFromBooking(booking)
    if (minutesFromBooking < -120) {
      showError("Só pode iniciar até 2 horas antes da marcação.")
      return
    }

    if (minutesFromBooking > 60) {
      showError("A marcação passou mais de 1 hora e foi automaticamente anulada.")
      await patchBooking(bookingId, {
        status: "cancelled",
        cancelledBy: "system",
        cancellationReason: "Não iniciado até 1h após o horário marcado",
        cancelledAt: new Date().toISOString(),
      })
      return
    }

    await patchBooking(bookingId, {
      executionStatus: "in_progress",
      startedAt: new Date().toISOString(),
    })
    showSuccess("Corte iniciado.")
  } catch (error) {
    if (String(error?.message || "").toUpperCase().includes("PERMISSION_DENIED")) {
      showError("Sem permissão no Firebase. É necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao iniciar corte: " + error.message)
  }
}

window.completeCut = async (bookingId) => {
  try {
    await patchBooking(bookingId, {
      executionStatus: "completed",
      completedAt: new Date().toISOString(),
    })
    showSuccess("Corte concluído.")
  } catch (error) {
    if (String(error?.message || "").toUpperCase().includes("PERMISSION_DENIED")) {
      showError("Sem permissão no Firebase. É necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao concluir corte: " + error.message)
  }
}

window.requestCancel = async (bookingId) => {
  const shouldRequest = window.confirm("Pretende pedir cancelamento desta marcação? O administrador precisa aprovar.")
  if (!shouldRequest) return

  try {
    await patchBooking(bookingId, {
      status: "cancel_requested",
      cancellationRequest: {
        requestedBy: "barbeiro",
        requestedAt: new Date().toISOString(),
      },
    })
    showSuccess("Pedido de cancelamento enviado para aprovação do administrador.")
  } catch (error) {
    if (String(error?.message || "").toUpperCase().includes("PERMISSION_DENIED")) {
      showError("Sem permissão no Firebase. É necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao pedir cancelamento: " + error.message)
  }
}

// Atualizar estatísticas
function updateStats() {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  
  // Marcações de hoje
  const todayBookings = allBookings.filter(b => b.date === todayStr)
  document.getElementById("todayCount").textContent = todayBookings.length

  // Marcações desta semana
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  
  const weekBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.date)
    return bookingDate >= startOfWeek && bookingDate <= endOfWeek
  })
  document.getElementById("weekCount").textContent = weekBookings.length

  // Marcações deste mês
  const monthBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.date)
    return bookingDate.getMonth() === today.getMonth() && 
           bookingDate.getFullYear() === today.getFullYear()
  })
  document.getElementById("monthCount").textContent = monthBookings.length
}

// Formatar nome do serviço
function formatServiceName(service) {
  const serviceNames = {
    'corte': 'Corte de Cabelo',
    'barba': 'Barba',
    'corte-barba': 'Corte + Barba',
    'sobrancelha': 'Sobrancelha',
    'completo': 'Pacote Completo'
  }
  return serviceNames[service] || service
}
