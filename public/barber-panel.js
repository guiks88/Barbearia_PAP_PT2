import { auth, database } from "./firebase-config.js"
import { ref, get, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

let barberId = null
let barberName = null
let barberEmail = null
let allBookings = []
let currentViewMode = "today"
const activeFilters = {
  date: true,
  client: false,
}

function clearBarberSession() {
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")
}

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
      clearBarberSession()
      showError("Sessão expirada. Faça login novamente.")
      setTimeout(() => {
        window.location.href = "barber-login.html"
      }, 1200)
      return
    }

    // Exibir informações do barbeiro
    document.getElementById("barberNameDisplay").textContent = barberName || "Barbeiro"
    document.getElementById("barberEmailDisplay").textContent = barberEmail || ""

    initializeDateRangeControls()
    setupStatsFilters()
    setupSearchAndRangeFilters()
    loadBookings()
  })
})

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth)
  } catch (_) {
    // Ignorado para garantir limpeza local mesmo em falha de rede.
  }

  clearBarberSession()
  showSuccess("Logout efetuado com sucesso!")

  setTimeout(() => {
    window.location.href = "index.html"
  }, 900)
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

function getDateOnly(dateValue) {
  return new Date(`${dateValue}T00:00:00`)
}

function toDateInputValue(dateObj) {
  return dateObj.toISOString().split("T")[0]
}

function getFilterElements() {
  return {
    toggleDateFilterBtn: document.getElementById("toggleDateFilterBtn"),
    toggleClientFilterBtn: document.getElementById("toggleClientFilterBtn"),
    dateFilterGroup: document.getElementById("dateFilterGroup"),
    clientFilterGroup: document.getElementById("clientFilterGroup"),
    dateFromInput: document.getElementById("dateFrom"),
    dateToInput: document.getElementById("dateTo"),
    clientSearchInput: document.getElementById("clientSearch"),
  }
}

function syncFilterControlsUI() {
  const { toggleDateFilterBtn, toggleClientFilterBtn, dateFilterGroup, clientFilterGroup } = getFilterElements()

  if (toggleDateFilterBtn) {
    toggleDateFilterBtn.classList.toggle("active-filter", activeFilters.date)
    toggleDateFilterBtn.setAttribute("aria-pressed", activeFilters.date ? "true" : "false")
  }

  if (toggleClientFilterBtn) {
    toggleClientFilterBtn.classList.toggle("active-filter", activeFilters.client)
    toggleClientFilterBtn.setAttribute("aria-pressed", activeFilters.client ? "true" : "false")
  }

  if (dateFilterGroup) {
    dateFilterGroup.classList.toggle("hidden", !activeFilters.date)
  }

  if (clientFilterGroup) {
    clientFilterGroup.classList.toggle("hidden", !activeFilters.client)
  }
}

function getTodayWeekMonthRanges() {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const weekStart = new Date(todayStart)
  weekStart.setDate(todayStart.getDate() - todayStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)

  return { now, todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd }
}

function setDateRangeInputs(startDate, endDate) {
  const fromInput = document.getElementById("dateFrom")
  const toInput = document.getElementById("dateTo")
  if (!fromInput || !toInput) return

  fromInput.value = toDateInputValue(startDate)
  toInput.value = toDateInputValue(endDate)
}

function initializeDateRangeControls() {
  const { todayStart, todayEnd } = getTodayWeekMonthRanges()
  setDateRangeInputs(todayStart, todayEnd)
  setActiveStatCard("today")
  syncFilterControlsUI()
  updateViewModeLabel()
}

function setDateRangeForMode(mode) {
  const { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } = getTodayWeekMonthRanges()
  if (mode === "today") {
    setDateRangeInputs(todayStart, todayEnd)
    return
  }

  if (mode === "week") {
    setDateRangeInputs(weekStart, weekEnd)
    return
  }

  if (mode === "month") {
    setDateRangeInputs(monthStart, monthEnd)
  }
}

function getDateRangeForFilter() {
  if (!activeFilters.date) return null

  const fromInput = document.getElementById("dateFrom")
  const toInput = document.getElementById("dateTo")
  if (!fromInput || !toInput || !fromInput.value || !toInput.value) return null

  const start = getDateOnly(fromInput.value)
  const end = getDateOnly(toInput.value)
  end.setHours(23, 59, 59, 999)

  if (start > end) {
    const swappedStart = getDateOnly(toInput.value)
    const swappedEnd = getDateOnly(fromInput.value)
    swappedEnd.setHours(23, 59, 59, 999)
    return {
      start: swappedStart,
      end: swappedEnd,
    }
  }

  return { start, end }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function formatBookingDateLabel(dateValue) {
  if (!dateValue) return "Data não definida"
  const dateObj = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(dateObj.getTime())) return "Data não definida"
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dateObj)
}

function getBookingTimestamp(booking) {
  const dateTime = getBookingDateTime(booking)
  return dateTime ? dateTime.getTime() : Number.POSITIVE_INFINITY
}

function sortBookingsByClosestExecution(bookings) {
  const now = Date.now()

  return [...bookings].sort((a, b) => {
    const aTime = getBookingTimestamp(a)
    const bTime = getBookingTimestamp(b)
    const aFuture = aTime >= now
    const bFuture = bTime >= now

    if (aFuture && bFuture) {
      return aTime - bTime
    }

    if (aFuture && !bFuture) {
      return -1
    }

    if (!aFuture && bFuture) {
      return 1
    }

    return bTime - aTime
  })
}

// Exibir marcações filtradas por intervalo e pesquisa
function displayBookings() {
  const container = document.getElementById("appointmentsContainer")
  const queryInput = document.getElementById("clientSearch")
  const pendingOnlyCheckbox = document.getElementById("pendingOnlyCheckbox")
  const searchValue = activeFilters.client ? normalizeText(queryInput?.value) : ""
  const pendingOnly = !!pendingOnlyCheckbox?.checked
  const dateRange = getDateRangeForFilter()

  let filteredBookings = allBookings

  if (dateRange) {
    filteredBookings = filteredBookings.filter((booking) => {
      const bookingDate = getDateOnly(booking.date)
      return bookingDate >= dateRange.start && bookingDate <= dateRange.end
    })
  }

  if (searchValue) {
    filteredBookings = filteredBookings.filter((booking) => {
      const haystack = [booking.clientName, booking.clientEmail, booking.clientPhone, booking.service]
        .map((value) => normalizeText(value))
        .join(" ")
      return haystack.includes(searchValue)
    })
  }

  if (pendingOnly) {
    filteredBookings = filteredBookings.filter((booking) => {
      const executionStatus = booking.executionStatus || "pending"
      const lifecycleStatus = booking.status || ""
      if (executionStatus === "completed") return false
      if (lifecycleStatus === "expired" || lifecycleStatus === "cancelled" || lifecycleStatus === "cancel_requested") return false
      return true
    })
  }

  filteredBookings = sortBookingsByClosestExecution(filteredBookings)

  autoCancelExpiredBookings(filteredBookings)

  if (filteredBookings.length === 0) {
    let emptyMessage = "Não há marcações com os filtros atuais"

    if (searchValue) {
      emptyMessage = "Nenhuma marcação encontrada para a pesquisa aplicada"
    } else if (pendingOnly) {
      emptyMessage = "Não há marcações por concluir para os filtros aplicados"
    } else if (activeFilters.date) {
      emptyMessage = "Não há marcações no intervalo selecionado"
    }

    container.innerHTML = `
      <div class="no-appointments">
        <p>${emptyMessage}</p>
        <p style="font-size: 0.9rem; color: #999;">Ajuste o intervalo ou a pesquisa para tentar novamente.</p>
      </div>
    `
    return
  }

  container.innerHTML = filteredBookings.map(booking => `
    <div class="appointment-card">
      <div class="appointment-time">
        ${booking.time}
        <div class="appointment-date">${formatBookingDateLabel(booking.date)}</div>
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
  if (booking.status === "expired") return "Expirada"
  if (booking.status === "cancelled") return "Anulada"
  if (booking.status === "cancel_requested") return "Cancelamento pendente"
  return "Finalizada"
}

function getLifecycleClass(booking) {
  if (booking.status === "expired") return "is-warning"
  if (booking.status === "cancelled") return "is-cancelled"
  if (booking.status === "cancel_requested") return "is-warning"
  return "is-pending"
}

function renderActions(booking) {
  if (booking.status === "expired") {
    return `<button class="btn btn-secondary" disabled>Marcação expirada</button>`
  }

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
    buttons.push(`<button class="btn btn-primary" onclick="completeCut('${booking.id}')">Finalizar corte</button>`)
  } else {
    buttons.push(`<button class="btn btn-secondary" disabled>Corte concluído</button>`)
  }

  if (executionStatus !== "completed") {
    buttons.push(`<button class="btn btn-secondary" onclick="requestCancel('${booking.id}')">Pedir cancelamento</button>`)
  }
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

function syncLocalBooking(bookingId, partialData) {
  const index = allBookings.findIndex((booking) => booking.id === bookingId)
  if (index === -1) return

  allBookings[index] = {
    ...allBookings[index],
    ...partialData,
  }
}

async function autoCancelExpiredBookings(bookings) {
  const candidates = bookings.filter((booking) => {
    if (!booking) return false
    if (booking.status === "cancelled" || booking.status === "cancel_requested" || booking.status === "expired") return false
    if ((booking.executionStatus || "pending") !== "pending") return false
    return getMinutesFromBooking(booking) > 60
  })

  if (!candidates.length) return

  await Promise.all(
    candidates.map((booking) =>
      patchBooking(booking.id, {
        status: "expired",
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
      showError("A marcação passou mais de 1 hora e ficou expirada.")
      await patchBooking(bookingId, {
        status: "expired",
        cancelledBy: "system",
        cancellationReason: "Não iniciado até 1h após o horário marcado",
        cancelledAt: new Date().toISOString(),
      })
      syncLocalBooking(bookingId, { status: "expired" })
      displayBookings()
      return
    }

    await patchBooking(bookingId, {
      executionStatus: "in_progress",
      startedAt: new Date().toISOString(),
    })
    syncLocalBooking(bookingId, {
      executionStatus: "in_progress",
      startedAt: new Date().toISOString(),
    })
    displayBookings()
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
    syncLocalBooking(bookingId, {
      executionStatus: "completed",
      completedAt: new Date().toISOString(),
    })
    displayBookings()
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
  const booking = allBookings.find((item) => item.id === bookingId)
  if (booking?.executionStatus === "completed") {
    showError("Não é possível cancelar uma marcação concluída.")
    return
  }
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
    syncLocalBooking(bookingId, {
      status: "cancel_requested",
      cancellationRequest: {
        requestedBy: "barbeiro",
        requestedAt: new Date().toISOString(),
      },
    })
    displayBookings()
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

function setupStatsFilters() {
  const cards = document.querySelectorAll(".stat-card.clickable")
  if (!cards.length) return

  cards.forEach((card) => {
    const activate = () => {
      const mode = card.dataset.viewMode
      if (!mode) return

      if (currentViewMode === mode && activeFilters.date) {
        activeFilters.date = false
        const dateFromInput = document.getElementById("dateFrom")
        const dateToInput = document.getElementById("dateTo")
        if (dateFromInput) dateFromInput.value = ""
        if (dateToInput) dateToInput.value = ""
        setActiveStatCard(null)
        currentViewMode = "all"
        syncFilterControlsUI()
        updateViewModeLabel()
        displayBookings()
        return
      }

      currentViewMode = mode
      activeFilters.date = true
      setDateRangeForMode(mode)
      setActiveStatCard(mode)
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    }

    card.addEventListener("click", activate)
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        activate()
      }
    })
  })
}

function setupSearchAndRangeFilters() {
  const {
    toggleDateFilterBtn,
    toggleClientFilterBtn,
    dateFromInput,
    dateToInput,
    clientSearchInput,
  } = getFilterElements()
  const pendingOnlyCheckbox = document.getElementById("pendingOnlyCheckbox")

  const setTodayDateRange = () => {
    const { todayStart, todayEnd } = getTodayWeekMonthRanges()
    setDateRangeInputs(todayStart, todayEnd)
  }

  if (toggleDateFilterBtn) {
    toggleDateFilterBtn.addEventListener("click", () => {
      activeFilters.date = !activeFilters.date

      if (activeFilters.date) {
        currentViewMode = "today"
        setActiveStatCard("today")
        if (!dateFromInput?.value || !dateToInput?.value) {
          setTodayDateRange()
        }
      } else {
        if (dateFromInput) dateFromInput.value = ""
        if (dateToInput) dateToInput.value = ""
        setActiveStatCard(null)
        currentViewMode = "range"
      }

      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }

  if (toggleClientFilterBtn) {
    toggleClientFilterBtn.addEventListener("click", () => {
      activeFilters.client = !activeFilters.client
      if (!activeFilters.client && clientSearchInput) {
        clientSearchInput.value = ""
      }

      syncFilterControlsUI()
      displayBookings()
    })
  }

  if (clientSearchInput) {
    clientSearchInput.addEventListener("input", () => {
      displayBookings()
    })
  }

  if (pendingOnlyCheckbox) {
    pendingOnlyCheckbox.addEventListener("change", () => {
      displayBookings()
    })
  }

  if (dateFromInput) {
    dateFromInput.addEventListener("change", () => {
      activeFilters.date = true
      currentViewMode = "range"
      setActiveStatCard(null)
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }

  if (dateToInput) {
    dateToInput.addEventListener("change", () => {
      activeFilters.date = true
      currentViewMode = "range"
      setActiveStatCard(null)
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }
}

function setActiveStatCard(mode) {
  document.querySelectorAll(".stat-card.clickable").forEach((card) => {
    card.classList.toggle("active-filter", !!mode && card.dataset.viewMode === mode)
  })
}

function updateViewModeLabel() {
  const label = document.getElementById("viewModeLabel")
  if (!label) return

  if (!activeFilters.date) {
    label.textContent = "A mostrar: todas as marcações (sem filtro de datas)"
    return
  }

  if (currentViewMode === "today") {
    label.textContent = "A mostrar: cortes de hoje"
    return
  }

  if (currentViewMode === "week") {
    label.textContent = "A mostrar: cortes desta semana"
    return
  }

  if (currentViewMode === "month") {
    label.textContent = "A mostrar: cortes deste mês"
    return
  }

  label.textContent = "A mostrar: entre datas"
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
