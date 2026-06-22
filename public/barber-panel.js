import { auth, database } from "./firebase-config.js"
import { ref, get, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

let barberId = null
let barberName = null
let barberEmail = null
let allBookings = []
let currentViewMode = "all"

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
    dateFromInput: document.getElementById("dateFrom"),
    dateToInput: document.getElementById("dateTo"),
    timeFromInput: document.getElementById("timeFrom"),
    timeToInput: document.getElementById("timeTo"),
    clientSearchNameInput: document.getElementById("clientSearchName"),
    clientSearchEmailInput: document.getElementById("clientSearchEmail"),
    clientSearchPhoneInput: document.getElementById("clientSearchPhone"),
    serviceSearchInput: document.getElementById("serviceSearch"),
  }
}

function syncFilterControlsUI() {
  return
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

function getWeekRangeFromInput(weekValue) {
  const raw = String(weekValue || "").trim()
  const match = raw.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const week = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null

  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setDate(jan4.getDate() - (jan4Day - 1))

  const start = new Date(mondayWeek1)
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function setupPeriodInputsUI() {
  const period = String(document.getElementById("bookingFilterPeriod")?.value || "all")
  const dayWrap = document.getElementById("bookingDayWrap")
  const weekWrap = document.getElementById("bookingWeekWrap")
  const monthWrap = document.getElementById("bookingMonthWrap")
  const yearWrap = document.getElementById("bookingYearWrap")
  const fromWrap = document.getElementById("bookingDateFromWrap")
  const toWrap = document.getElementById("bookingDateToWrap")
  const dayInput = document.getElementById("bookingDay")
  const weekInput = document.getElementById("bookingWeek")
  const monthInput = document.getElementById("bookingMonth")
  const yearInput = document.getElementById("bookingYear")
  const fromInput = document.getElementById("dateFrom")
  const toInput = document.getElementById("dateTo")

  const isDay = period === "day"
  const isWeek = period === "week"
  const isMonth = period === "month"
  const isYear = period === "year"
  const isRange = period === "between-dates"

  dayWrap?.classList.toggle("hidden", !isDay)
  weekWrap?.classList.toggle("hidden", !isWeek)
  monthWrap?.classList.toggle("hidden", !isMonth)
  yearWrap?.classList.toggle("hidden", !isYear)
  fromWrap?.classList.toggle("hidden", !isRange)
  toWrap?.classList.toggle("hidden", !isRange)

  if (dayInput) dayInput.disabled = !isDay
  if (weekInput) weekInput.disabled = !isWeek
  if (monthInput) monthInput.disabled = !isMonth
  if (yearInput) yearInput.disabled = !isYear
  if (fromInput) fromInput.disabled = !isRange
  if (toInput) toInput.disabled = !isRange
}

function initializeDateRangeControls() {
  const now = new Date()
  const periodSelect = document.getElementById("bookingFilterPeriod")
  const yearSelect = document.getElementById("bookingYear")
  const dayInput = document.getElementById("bookingDay")
  const weekInput = document.getElementById("bookingWeek")
  const monthInput = document.getElementById("bookingMonth")
  const fromInput = document.getElementById("dateFrom")
  const toInput = document.getElementById("dateTo")

  if (periodSelect && !periodSelect.value) {
    periodSelect.value = "all"
  }

  if (yearSelect && !yearSelect.options.length) {
    const baseYear = now.getFullYear()
    for (let offset = -2; offset <= 2; offset += 1) {
      const year = String(baseYear + offset)
      const option = document.createElement("option")
      option.value = year
      option.textContent = year
      yearSelect.appendChild(option)
    }
    yearSelect.value = String(baseYear)
  }

  if (dayInput && !dayInput.value) dayInput.value = toDateInputValue(now)
  if (weekInput && !weekInput.value) {
    const weekYear = now.getFullYear()
    const jan4 = new Date(weekYear, 0, 4)
    const jan4Day = jan4.getDay() || 7
    const mondayWeek1 = new Date(jan4)
    mondayWeek1.setDate(jan4.getDate() - (jan4Day - 1))
    const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - mondayWeek1) / 86400000)
    const weekNumber = Math.floor(diffDays / 7) + 1
    weekInput.value = `${weekYear}-W${String(weekNumber).padStart(2, "0")}`
  }
  if (monthInput && !monthInput.value) {
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }
  if (fromInput) fromInput.value = ""
  if (toInput) toInput.value = ""

  currentViewMode = "all"
  setActiveStatCard(null)
  setupPeriodInputsUI()
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
  const period = String(document.getElementById("bookingFilterPeriod")?.value || "all")
  const dayInput = document.getElementById("bookingDay")
  const weekInput = document.getElementById("bookingWeek")
  const monthInput = document.getElementById("bookingMonth")
  const yearInput = document.getElementById("bookingYear")
  const fromInput = document.getElementById("dateFrom")
  const toInput = document.getElementById("dateTo")

  if (period === "all") return null

  if (period === "day" && dayInput?.value) {
    const start = getDateOnly(dayInput.value)
    const end = getDateOnly(dayInput.value)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === "week" && weekInput?.value) {
    return getWeekRangeFromInput(weekInput.value)
  }

  if (period === "month" && monthInput?.value) {
    const [year, month] = monthInput.value.split("-").map(Number)
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null
    const start = new Date(year, month - 1, 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(year, month, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === "year" && yearInput?.value) {
    const year = Number(yearInput.value)
    if (!Number.isFinite(year)) return null
    const start = new Date(year, 0, 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(year, 11, 31)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === "between-dates") {
    if (!fromInput?.value && !toInput?.value) return null
    const fallbackStart = fromInput?.value || toInput?.value
    const fallbackEnd = toInput?.value || fromInput?.value
    const start = getDateOnly(fallbackStart)
    const end = getDateOnly(fallbackEnd)
    end.setHours(23, 59, 59, 999)
    if (start > end) {
      return {
        start: getDateOnly(fallbackEnd),
        end: new Date(start.getTime() + 86399999),
      }
    }
    return { start, end }
  }

  return null
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
  const nameInput = document.getElementById("clientSearchName")
  const emailInput = document.getElementById("clientSearchEmail")
  const phoneInput = document.getElementById("clientSearchPhone")
  const serviceInput = document.getElementById("serviceSearch")
  const timeFromInput = document.getElementById("timeFrom")
  const timeToInput = document.getElementById("timeTo")
  const pendingOnlyCheckbox = document.getElementById("pendingOnlyCheckbox")
  const nameSearch = normalizeText(nameInput?.value)
  const emailSearch = normalizeText(emailInput?.value)
  const phoneSearch = normalizeText(phoneInput?.value)
  const serviceSearch = normalizeText(serviceInput?.value)
  const timeFrom = timeFromInput?.value || ""
  const timeTo = timeToInput?.value || ""
  const pendingOnly = !!pendingOnlyCheckbox?.checked
  const dateRange = getDateRangeForFilter()

  let filteredBookings = allBookings

  if (dateRange) {
    filteredBookings = filteredBookings.filter((booking) => {
      const bookingDate = getDateOnly(booking.date)
      return bookingDate >= dateRange.start && bookingDate <= dateRange.end
    })
  }

  if (nameSearch || emailSearch || phoneSearch || serviceSearch) {
    filteredBookings = filteredBookings.filter((booking) => {
      const nameValue = normalizeText(booking.clientName)
      const emailValue = normalizeText(booking.clientEmail)
      const phoneValue = normalizeText(booking.clientPhone)
      const serviceValue = normalizeText(formatServiceName(booking.service))
      if (nameSearch && !nameValue.includes(nameSearch)) return false
      if (emailSearch && !emailValue.includes(emailSearch)) return false
      if (phoneSearch && !phoneValue.includes(phoneSearch)) return false
      if (serviceSearch && !serviceValue.includes(serviceSearch)) return false
      return true
    })
  }

  if (timeFrom || timeTo) {
    filteredBookings = filteredBookings.filter((booking) => {
      const bookingTime = String(booking.time || "")
      if (!bookingTime) return false
      if (timeFrom && bookingTime < timeFrom) return false
      if (timeTo && bookingTime > timeTo) return false
      return true
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

    if (nameSearch || emailSearch || phoneSearch || serviceSearch) {
      emptyMessage = "Nenhuma marcação encontrada para a pesquisa aplicada"
    } else if (pendingOnly) {
      emptyMessage = "Não há marcações por concluir para os filtros aplicados"
    } else if (dateRange) {
      emptyMessage = "Não há marcações no intervalo selecionado"
    }

    container.innerHTML = `
      <div class="no-appointments">
        <p>${emptyMessage}</p>
        <p style="font-size: 0.9rem; color: #999;">Ajuste os filtros para tentar novamente.</p>
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
        <h3>ðŸ‘¤ ${booking.clientName}</h3>
        <p>ðŸ“§ ${booking.clientEmail || 'Email não disponível'}</p>
        <p>ðŸ“± ${booking.clientPhone || 'Telefone não disponível'}</p>
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

async function recalculateBarberStats(barberUid) {
  if (!barberUid) return

  const bookingsSnapshot = await get(ref(database, "bookings"))
  const bookings = bookingsSnapshot.exists() ? Object.values(bookingsSnapshot.val() || {}) : []

  const completedBookings = bookings.filter((booking) => {
    if (!booking || booking.barberId !== barberUid) return false
    if ((booking.executionStatus || "pending") !== "completed") return false
    const status = booking.status || "active"
    return status !== "cancelled" && status !== "expired"
  })

  const completedCuts = completedBookings.length
  const ratings = completedBookings
    .map((booking) => Number(booking.rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0.5)

  const ratingCount = ratings.length
  const ratingTotal = ratings.reduce((sum, value) => sum + value, 0)
  const averageRating = ratingCount > 0 ? Number((ratingTotal / ratingCount).toFixed(2)) : 0

  await update(ref(database, `barbers/${barberUid}`), {
    completedCuts,
    ratingCount,
    ratingTotal: Number(ratingTotal.toFixed(2)),
    avgRating: averageRating,
    averageRating,
    ratingAverage: averageRating,
    notaMedia: averageRating,
    updatedAt: new Date().toISOString(),
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
      showError("Sem permissão no Firebase. Ã‰ necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao iniciar corte: " + error.message)
  }
}

window.completeCut = async (bookingId) => {
  try {
    const booking = allBookings.find((item) => item.id === bookingId)
    if (!booking) {
      showError("Marcação não encontrada.")
      return
    }

    const plannedDuration = Number(booking.serviceDuration || 0) || 30
    const startedAt = booking.startedAt ? new Date(booking.startedAt) : null
    const completedAt = new Date()
    let actualDurationMinutes = plannedDuration
    if (startedAt && !Number.isNaN(startedAt.getTime())) {
      const diffMinutes = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000))
      actualDurationMinutes = Math.min(plannedDuration, Math.max(5, diffMinutes))
    }

    await patchBooking(bookingId, {
      executionStatus: "completed",
      completedAt: completedAt.toISOString(),
      actualDurationMinutes,
    })
    try {
      await recalculateBarberStats(booking.barberId || barberId)
    } catch (statsError) {
      console.warn("Sem permissão para atualizar agregados do barbeiro:", statsError)
      // Fallback: increment completed cuts locally on barber record
      try {
        const targetId = booking.barberId || barberId
        if (targetId) {
          const barberSnap = await get(ref(database, `barbers/${targetId}`))
          const current = barberSnap.exists() ? barberSnap.val() : {}
          const completedCuts = Number(current.completedCuts || 0) + 1
          await update(ref(database, `barbers/${targetId}`), {
            completedCuts,
            updatedAt: new Date().toISOString(),
          })
        }
      } catch (fallbackError) {
        console.warn("Sem permissão para incrementar cortes concluidos:", fallbackError)
      }
    }
    syncLocalBooking(bookingId, {
      executionStatus: "completed",
      completedAt: completedAt.toISOString(),
      actualDurationMinutes,
    })
    displayBookings()
    showSuccess("Corte concluído.")
  } catch (error) {
    if (String(error?.message || "").toUpperCase().includes("PERMISSION_DENIED")) {
      showError("Sem permissão no Firebase. Ã‰ necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao concluir corte: " + error.message)
  }
}

window.requestCancel = async (bookingId) => {
  const booking = allBookings.find((item) => item.id === bookingId)
  if (booking?.executionStatus === "completed" || booking?.status === "expired" || booking?.status === "cancelled") {
    showError("Não é possível cancelar uma marcação concluída ou expirada.")
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
      showError("Sem permissão no Firebase. Ã‰ necessário publicar as regras atualizadas da base de dados.")
      return
    }
    showError("Erro ao pedir cancelamento: " + error.message)
  }
}

// Atualizar estatísticas
function updateStats() {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const todayCountEl = document.getElementById("todayCount")
  const weekCountEl = document.getElementById("weekCount")
  const monthCountEl = document.getElementById("monthCount")
  
  // Marcações de hoje
  const todayBookings = allBookings.filter(b => b.date === todayStr)
  if (todayCountEl) {
    todayCountEl.textContent = todayBookings.length
  }

  // Marcações desta semana
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  
  const weekBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.date)
    return bookingDate >= startOfWeek && bookingDate <= endOfWeek
  })
  if (weekCountEl) {
    weekCountEl.textContent = weekBookings.length
  }

  // Marcações deste mês
  const monthBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.date)
    return bookingDate.getMonth() === today.getMonth() && 
           bookingDate.getFullYear() === today.getFullYear()
  })
  if (monthCountEl) {
    monthCountEl.textContent = monthBookings.length
  }
}

function setupStatsFilters() {
  const cards = document.querySelectorAll(".stat-card.clickable")
  if (!cards.length) return

  cards.forEach((card) => {
    const activate = () => {
      const mode = card.dataset.viewMode
      if (!mode) return

      const dateFromInput = document.getElementById("dateFrom")
      const dateToInput = document.getElementById("dateTo")
      const hasDateRange = Boolean(dateFromInput?.value || dateToInput?.value)
      if (currentViewMode === mode && hasDateRange) {
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
    dateFromInput,
    dateToInput,
    timeFromInput,
    timeToInput,
    clientSearchNameInput,
    clientSearchEmailInput,
    clientSearchPhoneInput,
    serviceSearchInput,
  } = getFilterElements()
  const pendingOnlyCheckbox = document.getElementById("pendingOnlyCheckbox")
  const periodSelect = document.getElementById("bookingFilterPeriod")
  const dayInput = document.getElementById("bookingDay")
  const weekInput = document.getElementById("bookingWeek")
  const monthInput = document.getElementById("bookingMonth")
  const yearInput = document.getElementById("bookingYear")
  ;[
    clientSearchNameInput,
    clientSearchEmailInput,
    clientSearchPhoneInput,
    serviceSearchInput,
  ].forEach((input) => {
    if (!input) return
    input.addEventListener("input", () => displayBookings())
  })

  if (pendingOnlyCheckbox) {
    pendingOnlyCheckbox.addEventListener("change", () => {
      displayBookings()
    })
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      currentViewMode = periodSelect.value || "all"
      setActiveStatCard(null)
      setupPeriodInputsUI()
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }

  ;[dayInput, weekInput, monthInput, yearInput].forEach((input) => {
    if (!input) return
    input.addEventListener("change", () => {
      currentViewMode = periodSelect?.value || "all"
      updateViewModeLabel()
      displayBookings()
    })
  })

  if (dateFromInput) {
    dateFromInput.addEventListener("change", () => {
      currentViewMode = periodSelect?.value || "between-dates"
      setActiveStatCard(null)
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }

  if (dateToInput) {
    dateToInput.addEventListener("change", () => {
      currentViewMode = periodSelect?.value || "between-dates"
      setActiveStatCard(null)
      syncFilterControlsUI()
      updateViewModeLabel()
      displayBookings()
    })
  }

  if (timeFromInput) timeFromInput.addEventListener("change", () => displayBookings())
  if (timeToInput) timeToInput.addEventListener("change", () => displayBookings())
}

function setActiveStatCard(mode) {
  document.querySelectorAll(".stat-card.clickable").forEach((card) => {
    card.classList.toggle("active-filter", !!mode && card.dataset.viewMode === mode)
  })
}

function updateViewModeLabel() {
  const label = document.getElementById("viewModeLabel")
  if (!label) return

  const period = String(document.getElementById("bookingFilterPeriod")?.value || "all")
  if (period === "all") {
    label.textContent = "A mostrar: todo o período (mais próximas primeiro)"
    return
  }
  if (period === "day") {
    label.textContent = "A mostrar: período de dia"
    return
  }
  if (period === "week") {
    label.textContent = "A mostrar: período de semana"
    return
  }
  if (period === "month") {
    label.textContent = "A mostrar: período de mês"
    return
  }
  if (period === "year") {
    label.textContent = "A mostrar: período de ano"
    return
  }
  label.textContent = "A mostrar: período entre datas"
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

