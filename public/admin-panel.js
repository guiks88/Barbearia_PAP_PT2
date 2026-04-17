import { auth, database, firebaseConfig, firestore } from "./firebase-config.js"
import { ref, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
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

const SERVICE_PRICES = {
  corte: 15,
  barba: 10,
  "corte-barba": 22,
  sobrancelha: 5,
  completo: 35,
}

const SERVICE_NAMES = {
  corte: "Corte de Cabelo",
  barba: "Barba",
  "corte-barba": "Corte + Barba",
  sobrancelha: "Sobrancelha",
  completo: "Pacote Completo",
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const state = {
  barbers: {},
  bookings: {},
  clients: {},
  promotions: {},
  storeSettings: {},
}

let editingPromotionId = null
let editingBarberId = null

function normalize(value) {
  return String(value || "").toLowerCase().trim()
}

function dateOnly(dateLike) {
  if (!dateLike) return null
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isDateInRange(dateLike, fromLike, toLike) {
  const date = dateOnly(dateLike)
  if (!date) return false

  const from = dateOnly(fromLike)
  const to = dateOnly(toLike)

  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function toTimeValue(hour, minute) {
  return `${hour}:${minute}`
}

function parseTimeValue(timeValue, fallbackHour = "09", fallbackMinute = "00") {
  const [h, m] = String(timeValue || `${fallbackHour}:${fallbackMinute}`).split(":")
  return {
    hour: String(h || fallbackHour).padStart(2, "0"),
    minute: String(m || fallbackMinute).padStart(2, "0"),
  }
}

function buildHourOptions(selected) {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
    .map((hour) => `<option value="${hour}" ${selected === hour ? "selected" : ""}>${hour}</option>`)
    .join("")
}

function buildMinuteOptions(selected) {
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))
  return minutes
    .map((minute) => `<option value="${minute}" ${selected === minute ? "selected" : ""}>${minute}</option>`)
    .join("")
}

function getSelectTime(hourId, minuteId) {
  const hour = document.getElementById(hourId)?.value || "00"
  const minute = document.getElementById(minuteId)?.value || "00"
  return toTimeValue(hour, minute)
}

function setupBarberFormTimes() {
  const startHour = document.getElementById("barberStartHour")
  const startMinute = document.getElementById("barberStartMinute")
  const endHour = document.getElementById("barberEndHour")
  const endMinute = document.getElementById("barberEndMinute")

  if (!startHour || !startMinute || !endHour || !endMinute) return

  startHour.innerHTML = buildHourOptions("09")
  startMinute.innerHTML = buildMinuteOptions("00")
  endHour.innerHTML = buildHourOptions("19")
  endMinute.innerHTML = buildMinuteOptions("00")
}

function setupTopTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab

      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))
      document.getElementById(`${tab}-tab`).classList.add("active")
    })
  })
}

function setupBarberFormMode() {
  const createCard = document.getElementById("barberCreateCard")
  const openBtn = document.getElementById("openCreateBarberBtn")
  const cancelBtn = document.getElementById("cancelBarberFormBtn")
  if (!createCard || !openBtn || !cancelBtn) return

  openBtn.addEventListener("click", () => {
    openBarberForm()
  })

  cancelBtn.addEventListener("click", () => {
    closeBarberForm()
  })
}

function setupFilters() {
  const ids = [
    "barberSearchName",
    "barberSearchEmail",
    "barberSearchPhone",
    "barberSearchSpecialty",
    "bookingSearchClientName",
    "bookingSearchClientPhone",
    "bookingSearchClientEmail",
    "bookingSearchService",
    "bookingSearchBarber",
    "bookingDateFrom",
    "bookingDateTo",
    "clientSearch",
    "clientDateFrom",
    "clientDateTo",
  ]

  ids.forEach((id) => {
    const input = document.getElementById(id)
    if (!input) return

    const rerender = () => {
      renderBarbers()
      renderBookings()
      renderClients()
      renderStoreSchedule()
      updateRevenue()
    }

    input.addEventListener("input", rerender)
    input.addEventListener("change", rerender)
  })
}

function setupRevenueControls() {
  const filter = document.getElementById("revenueFilter")
  const dayInput = document.getElementById("revenueDay")
  const monthInput = document.getElementById("revenueMonth")
  const yearSelect = document.getElementById("revenueYear")
  const dateFrom = document.getElementById("revenueDateFrom")
  const dateTo = document.getElementById("revenueDateTo")
  const dayWrap = document.getElementById("revenueDayWrap")
  const monthWrap = document.getElementById("revenueMonthWrap")
  const yearWrap = document.getElementById("revenueYearWrap")
  const dateFromWrap = document.getElementById("revenueDateFromWrap")
  const dateToWrap = document.getElementById("revenueDateToWrap")

  if (!filter || !dayInput || !monthInput || !yearSelect || !dateFrom || !dateTo) return

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  dayInput.value = today
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  yearSelect.innerHTML = ""
  for (let year = now.getFullYear() + 1; year >= now.getFullYear() - 6; year -= 1) {
    yearSelect.innerHTML += `<option value="${year}" ${year === now.getFullYear() ? "selected" : ""}>${year}</option>`
  }

  const refreshUi = () => {
    const mode = filter.value

    dayInput.disabled = mode !== "day"
    monthInput.disabled = mode !== "month"
    yearSelect.disabled = mode !== "year"
    dateFrom.disabled = mode !== "between-dates"
    dateTo.disabled = mode !== "between-dates"

    if (dayWrap) dayWrap.classList.toggle("hidden", mode !== "day")
    if (monthWrap) monthWrap.classList.toggle("hidden", mode !== "month")
    if (yearWrap) yearWrap.classList.toggle("hidden", mode !== "year")
    if (dateFromWrap) dateFromWrap.classList.toggle("hidden", mode !== "between-dates")
    if (dateToWrap) dateToWrap.classList.toggle("hidden", mode !== "between-dates")

    updateRevenue()
  }

  filter.addEventListener("change", refreshUi)
  dayInput.addEventListener("change", refreshUi)
  monthInput.addEventListener("change", refreshUi)
  yearSelect.addEventListener("change", refreshUi)
  dateFrom.addEventListener("change", refreshUi)
  dateTo.addEventListener("change", refreshUi)

  refreshUi()
}

function getBarberFilterValues() {
  return {
    name: normalize(document.getElementById("barberSearchName")?.value),
    email: normalize(document.getElementById("barberSearchEmail")?.value),
    phone: normalize(document.getElementById("barberSearchPhone")?.value),
    specialty: normalize(document.getElementById("barberSearchSpecialty")?.value),
  }
}

function getBookingFilterValues() {
  return {
    clientName: normalize(document.getElementById("bookingSearchClientName")?.value),
    clientPhone: normalize(document.getElementById("bookingSearchClientPhone")?.value),
    clientEmail: normalize(document.getElementById("bookingSearchClientEmail")?.value),
    service: normalize(document.getElementById("bookingSearchService")?.value),
    barber: normalize(document.getElementById("bookingSearchBarber")?.value),
    dateFrom: document.getElementById("bookingDateFrom")?.value || "",
    dateTo: document.getElementById("bookingDateTo")?.value || "",
  }
}

function getClientFilterValues() {
  return {
    search: normalize(document.getElementById("clientSearch")?.value),
    dateFrom: document.getElementById("clientDateFrom")?.value || "",
    dateTo: document.getElementById("clientDateTo")?.value || "",
  }
}

function filterBarberEntries() {
  const filters = getBarberFilterValues()

  return Object.entries(state.barbers).filter(([, barber]) => {
    if (filters.name && !normalize(barber.name).includes(filters.name)) return false
    if (filters.email && !normalize(barber.email).includes(filters.email)) return false
    if (filters.phone && !normalize(barber.phone).includes(filters.phone)) return false
    if (filters.specialty && !normalize(barber.specialty).includes(filters.specialty)) return false
    return true
  })
}

function filterBookingEntries() {
  const filters = getBookingFilterValues()

  return Object.entries(state.bookings).filter(([, booking]) => {
    const barberName = booking.barberName || state.barbers[booking.barberId]?.name || ""
    const serviceName = booking.serviceName || SERVICE_NAMES[booking.service] || booking.service || ""
    const clientPhone = booking.clientPhone || booking.clientPhoneComplete || ""

    if (filters.clientName && !normalize(booking.clientName).includes(filters.clientName)) return false
    if (filters.clientPhone && !normalize(clientPhone).includes(filters.clientPhone)) return false
    if (filters.clientEmail && !normalize(booking.clientEmail).includes(filters.clientEmail)) return false
    if (filters.service && !normalize(serviceName).includes(filters.service)) return false
    if (filters.barber && !normalize(barberName).includes(filters.barber)) return false

    if ((filters.dateFrom || filters.dateTo) && !isDateInRange(booking.date, filters.dateFrom, filters.dateTo)) {
      return false
    }

    return true
  })
}

function filterClientEntries() {
  const filters = getClientFilterValues()

  return Object.entries(state.clients).filter(([, client]) => {
    const searchTarget = `${client.name || ""} ${client.email || ""} ${client.phone || ""}`.toLowerCase()
    if (filters.search && !searchTarget.includes(filters.search)) return false

    const createdAtDate = String(client.createdAt || "").split("T")[0]
    if ((filters.dateFrom || filters.dateTo) && !isDateInRange(createdAtDate, filters.dateFrom, filters.dateTo)) {
      return false
    }

    return true
  })
}

function getLifecycleStatus(booking) {
  if (booking.status === "expired") {
    return { label: "Expirada", className: "is-warning" }
  }

  if (booking.status === "cancelled") {
    return { label: "Anulada", className: "is-cancelled" }
  }

  if (booking.status === "cancel_requested") {
    return { label: "Cancelamento pendente", className: "is-warning" }
  }

  return { label: "Ativa", className: "is-active" }
}

function getExecutionStatus(booking) {
  const value = booking.executionStatus || "pending"
  if (value === "in_progress") return { label: "A ser concluída", className: "is-progress" }
  if (value === "completed") return { label: "Concluída", className: "is-completed" }
  return { label: "Não concluída", className: "is-pending" }
}

function renderBarbers() {
  const container = document.getElementById("barbersList")
  if (!container) return

  const entries = filterBarberEntries()
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhum barbeiro encontrado</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, barber]) => {
      const days = (barber.workingDays || [1, 2, 3, 4, 5]).map((day) => DAY_NAMES[day]).join(", ")
      return `
        <div class="barber-item">
          <div>
            <h3>${barber.name || "Barbeiro"}</h3>
            <p><strong>Email:</strong> ${barber.email || "-"}</p>
            <p><strong>Telefone:</strong> ${barber.phone || "-"}</p>
            <p><strong>Especialidade:</strong> ${barber.specialty || "-"}</p>
            <p><strong>Horário:</strong> ${barber.workingHours?.start || "09:00"} - ${barber.workingHours?.end || "19:00"}</p>
            <p><strong>Dias:</strong> ${days}</p>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary" onclick="editBarber('${id}')">Editar</button>
            <button class="btn btn-danger" onclick="deleteBarber('${id}')">Eliminar</button>
          </div>
        </div>
      `
    })
    .join("")
}

function renderBookings() {
  const container = document.getElementById("allBookingsList")
  if (!container) return

  const prioritizeCancel = document.getElementById("bookingPriorityCancel")?.checked !== false
  const entries = filterBookingEntries().sort((a, b) => {
    const leftBooking = a[1]
    const rightBooking = b[1]

    if (prioritizeCancel) {
      const leftPriority = leftBooking.status === "cancel_requested" ? 1 : 0
      const rightPriority = rightBooking.status === "cancel_requested" ? 1 : 0
      if (leftPriority !== rightPriority) return rightPriority - leftPriority
    }

    const left = `${leftBooking.date || ""} ${leftBooking.time || ""}`
    const right = `${rightBooking.date || ""} ${rightBooking.time || ""}`
    return right.localeCompare(left)
  })

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhuma marcação encontrada</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, booking]) => {
      const barberName = booking.barberName || state.barbers[booking.barberId]?.name || "N/A"
      const serviceName = booking.serviceName || SERVICE_NAMES[booking.service] || booking.service || "-"
      const serviceDuration = SERVICE_DURATION[booking.service] || booking.serviceDuration || "-"
      const lifecycle = getLifecycleStatus(booking)
      const execution = getExecutionStatus(booking)

      return `
        <div class="booking-item booking-item-extended">
          <div>
            <h3>${booking.clientName || "Cliente"}</h3>
            <div class="booking-meta-grid">
              <p><strong>Email:</strong> ${booking.clientEmail || "-"}</p>
              <p><strong>Telefone:</strong> ${booking.clientPhone || booking.clientPhoneComplete || "-"}</p>
              <p><strong>Serviço:</strong> ${serviceName} (${serviceDuration} min)</p>
              <p><strong>Barbeiro:</strong> ${barberName}</p>
              <p><strong>Data:</strong> ${booking.date ? formatDate(booking.date) : "-"}</p>
              <p><strong>Horário:</strong> ${booking.time || "-"}</p>
            </div>
            <div class="status-row">
              <span class="status-pill ${lifecycle.className}">${lifecycle.label}</span>
              <span class="status-pill ${execution.className}">${execution.label}</span>
            </div>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary btn-small" onclick="editBooking('${id}')">Editar</button>
            <select class="inline-select" onchange="setExecutionStatus('${id}', this.value)">
              <option value="pending" ${execution.className === "is-pending" ? "selected" : ""}>Não concluída</option>
              <option value="in_progress" ${execution.className === "is-progress" ? "selected" : ""}>A ser concluída</option>
              <option value="completed" ${execution.className === "is-completed" ? "selected" : ""}>Concluída</option>
            </select>
            ${booking.status === "cancel_requested" ? `<button class="btn btn-primary btn-small" onclick="approveCancellation('${id}')">Aprovar cancelamento</button>` : ""}
            <button class="btn btn-danger btn-small" onclick="deleteBooking('${id}')">Cancelar</button>
          </div>
        </div>
      `
    })
    .join("")
}

function renderClients() {
  const container = document.getElementById("clientsList")
  if (!container) return

  const entries = filterClientEntries()

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhum cliente encontrado</div>'
    return
  }

  container.innerHTML = entries
    .map(
      ([id, client]) => `
        <div class="barber-item">
          <div>
            <h3>${client.name || "Cliente"}</h3>
            <p><strong>Email:</strong> ${client.email || "-"}</p>
            <p><strong>Telefone:</strong> ${client.phone || "-"}</p>
            <p><strong>Registado em:</strong> ${formatDate(String(client.createdAt || "").split("T")[0])}</p>
          </div>
          <button class="btn btn-danger" onclick="deleteClient('${id}')">Eliminar</button>
        </div>
      `,
    )
    .join("")
}

function resetPromotionForm() {
  const form = document.getElementById("promotionForm")
  if (!form) return

  form.reset()
  const minCuts = document.getElementById("promotionMinCuts")
  if (minCuts) minCuts.value = "10"

  const status = document.getElementById("promotionActive")
  if (status) status.value = "true"

  editingPromotionId = null
  const saveBtn = document.getElementById("promotionSaveBtn")
  if (saveBtn) saveBtn.textContent = "Guardar promoção"
}

function renderPromotions() {
  const container = document.getElementById("promotionsListAdmin")
  if (!container) return

  const entries = Object.entries(state.promotions).sort((a, b) => {
    const left = a[1]?.createdAt || ""
    const right = b[1]?.createdAt || ""
    return right.localeCompare(left)
  })

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Sem promoções registadas</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, promo]) => {
      const isActive = promo.isActive !== false
      return `
        <div class="barber-item promotion-item-admin">
          <div>
            <h3>${promo.title || "Promoção"}</h3>
            <p><strong>Descrição:</strong> ${promo.description || "-"}</p>
            <p><strong>Condição:</strong> ${promo.minCompletedCuts || 10} cortes concluídos</p>
            <p><strong>Prémio:</strong> ${promo.rewardText || "-"}</p>
            <p><strong>Estado:</strong> <span class="status-pill ${isActive ? "is-active" : "is-cancelled"}">${isActive ? "Ativa" : "Inativa"}</span></p>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary btn-small" onclick="editPromotion('${id}')">Editar</button>
            <button class="btn btn-danger btn-small" onclick="deletePromotion('${id}')">Eliminar</button>
          </div>
        </div>
      `
    })
    .join("")
}

function setupPromotionForm() {
  const form = document.getElementById("promotionForm")
  const cancelBtn = document.getElementById("promotionCancelEditBtn")
  if (!form || !cancelBtn) return

  if (!form.dataset.bound) {
    form.dataset.bound = "true"
    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const title = document.getElementById("promotionTitle")?.value?.trim() || ""
      const minCompletedCuts = Number(document.getElementById("promotionMinCuts")?.value || 10)
      const rewardText = document.getElementById("promotionRewardText")?.value?.trim() || ""
      const description = document.getElementById("promotionDescription")?.value?.trim() || ""
      const isActive = String(document.getElementById("promotionActive")?.value || "true") === "true"

      if (!title || !rewardText || !minCompletedCuts || minCompletedCuts < 1) {
        showError("Preencha os campos da promoção corretamente.")
        return
      }

      const id = editingPromotionId || `promo_${Date.now()}`
      const previous = state.promotions[id] || {}

      const payload = {
        title,
        description,
        minCompletedCuts,
        rewardText,
        isActive,
        createdAt: previous.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      try {
        await set(ref(database, `promotions/${id}`), payload)
        showSuccess(editingPromotionId ? "Promoção atualizada com sucesso!" : "Promoção criada com sucesso!")
        resetPromotionForm()
      } catch (error) {
        showError("Erro ao guardar promoção: " + error.message)
      }
    })
  }

  if (!cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "true"
    cancelBtn.addEventListener("click", () => {
      resetPromotionForm()
    })
  }

  resetPromotionForm()
}

function setupStoreScheduleTimes(settings = {}) {
  const open = parseTimeValue(settings.openingHours?.start || "09:00", "09", "00")
  const close = parseTimeValue(settings.openingHours?.end || "19:00", "19", "00")
  const lunchStart = parseTimeValue(settings.lunchBreak?.start || "13:00", "13", "00")
  const lunchEnd = parseTimeValue(settings.lunchBreak?.end || "14:00", "14", "00")

  const pairs = [
    ["storeOpenHour", "storeOpenMinute", open.hour, open.minute],
    ["storeCloseHour", "storeCloseMinute", close.hour, close.minute],
    ["storeLunchStartHour", "storeLunchStartMinute", lunchStart.hour, lunchStart.minute],
    ["storeLunchEndHour", "storeLunchEndMinute", lunchEnd.hour, lunchEnd.minute],
  ]

  pairs.forEach(([hourId, minuteId, hourValue, minuteValue]) => {
    const hourSelect = document.getElementById(hourId)
    const minuteSelect = document.getElementById(minuteId)
    if (!hourSelect || !minuteSelect) return
    hourSelect.innerHTML = buildHourOptions(hourValue)
    minuteSelect.innerHTML = buildMinuteOptions(minuteValue)
  })
}

function renderStoreSchedule() {
  const openDays = state.storeSettings.openDays || [1, 2, 3, 4, 5]
  document.querySelectorAll('#storeOpenDays input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = openDays.includes(Number(checkbox.value))
  })
  setupStoreScheduleTimes(state.storeSettings)
}

function getRevenueFilteredBookings() {
  const mode = document.getElementById("revenueFilter")?.value || "all"
  const dayValue = document.getElementById("revenueDay")?.value || ""
  const monthValue = document.getElementById("revenueMonth")?.value || ""
  const yearValue = Number(document.getElementById("revenueYear")?.value || new Date().getFullYear())
  const dateFrom = document.getElementById("revenueDateFrom")?.value || ""
  const dateTo = document.getElementById("revenueDateTo")?.value || ""

  return Object.values(state.bookings)
    .filter((booking) => booking.status !== "cancelled" && booking.status !== "expired")
    .filter((booking) => {
      const bookingDate = dateOnly(booking.date)
      if (!bookingDate) return false

      if (mode === "all") return true

      if (mode === "day") {
        if (!dayValue) return false
        return isDateInRange(booking.date, dayValue, dayValue)
      }

      if (mode === "between-dates") {
        return isDateInRange(booking.date, dateFrom, dateTo)
      }

      if (mode === "month") {
        if (!monthValue) return false
        const [year, month] = monthValue.split("-").map(Number)
        const sameMonth = bookingDate.getFullYear() === year && bookingDate.getMonth() + 1 === month
        return sameMonth
      }

      if (mode === "year") {
        return bookingDate.getFullYear() === yearValue
      }

      return true
    })
}

function updateRevenue() {
  const summaryContainer = document.getElementById("revenueSummary")
  const detailsContainer = document.getElementById("revenueDetails")
  const mode = document.getElementById("revenueFilter")?.value || "all"

  if (!summaryContainer || !detailsContainer) return

  const bookings = getRevenueFilteredBookings()
  if (!bookings.length) {
    summaryContainer.innerHTML = ""
    detailsContainer.innerHTML = '<div class="empty-state">Nenhuma marcação encontrada</div>'
    return
  }

  let totalRevenue = 0
  const revenueByBarber = {}
  const revenueByService = {}

  bookings.forEach((booking) => {
    const price = Number(booking.servicePrice || SERVICE_PRICES[booking.service] || 0)
    totalRevenue += price

    const barberName = booking.barberName || state.barbers[booking.barberId]?.name || "Desconhecido"
    const serviceName = booking.serviceName || SERVICE_NAMES[booking.service] || booking.service || "Outro"

    revenueByBarber[barberName] = (revenueByBarber[barberName] || 0) + price
    revenueByService[serviceName] = (revenueByService[serviceName] || 0) + price
  })

  const totalBookings = bookings.length
  const label =
    mode === "day"
      ? "(Período de Dias)"
      : mode === "between-dates"
        ? "(Período entre datas)"
        : mode === "month"
          ? "(Período de Mês)"
          : mode === "year"
            ? "(Período de Ano)"
            : "(Todo o Período)"

  summaryContainer.innerHTML = `
    <div class="revenue-card">
      <h3>💰 Faturamento ${label}</h3>
      <div class="revenue-value success">${totalRevenue.toFixed(2)}€</div>
    </div>
    <div class="revenue-card">
      <h3>Marcações ${label}</h3>
      <div class="revenue-value">${totalBookings}</div>
    </div>
    <div class="revenue-card">
      <h3>📊 Média por Marcação</h3>
      <div class="revenue-value">${(totalRevenue / totalBookings).toFixed(2)}€</div>
    </div>
  `

  let details = '<h3 style="color: var(--color-text-primary); margin-bottom: 1rem;">Faturamento por Barbeiro</h3>'
  Object.entries(revenueByBarber)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => {
      details += `
        <div class="barber-item">
          <div><h3>${name}</h3></div>
          <div style="text-align: right;"><p style="font-size: 1.4rem; font-weight: 800; color: var(--color-success);">${value.toFixed(2)}€</p></div>
        </div>
      `
    })

  details += '<h3 style="color: var(--color-text-primary); margin: 1.5rem 0 1rem;">Faturamento por Serviço</h3>'
  Object.entries(revenueByService)
    .sort((a, b) => b[1] - a[1])
    .forEach(([service, value]) => {
      details += `
        <div class="barber-item">
          <div><h3>${service}</h3></div>
          <div style="text-align: right;"><p style="font-size: 1.4rem; font-weight: 800; color: var(--color-accent);">${value.toFixed(2)}€</p></div>
        </div>
      `
    })

  detailsContainer.innerHTML = details
}

function loadBarbers() {
  onValue(ref(database, "barbers"), (snapshot) => {
    state.barbers = snapshot.exists() ? snapshot.val() : {}
    renderBarbers()
    renderBookings()
    updateRevenue()
  })
}

function loadBookings() {
  onValue(ref(database, "bookings"), (snapshot) => {
    state.bookings = snapshot.exists() ? snapshot.val() : {}
    renderBookings()
    updateRevenue()
  })
}

function loadClients() {
  onValue(ref(database, "clients"), (snapshot) => {
    state.clients = snapshot.exists() ? snapshot.val() : {}
    renderClients()
  })
}

function loadPromotions() {
  onValue(ref(database, "promotions"), (snapshot) => {
    state.promotions = snapshot.exists() ? snapshot.val() : {}
    renderPromotions()
  })
}

function loadStoreSettings() {
  onValue(ref(database, "storeSettings"), (snapshot) => {
    state.storeSettings = snapshot.exists() ? snapshot.val() : {}
    renderStoreSchedule()
  })
}

function resetBarberForm() {
  const form = document.getElementById("barberForm")
  if (!form) return

  editingBarberId = null
  form.reset()
  setupBarberFormTimes()
  document.querySelectorAll('#barberWorkingDays input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = [1, 2, 3, 4, 5].includes(Number(checkbox.value))
  })

  const title = document.getElementById("barberFormTitle")
  const submitBtn = document.getElementById("barberSubmitBtn")
  const passwordGroup = document.getElementById("barberPasswordGroup")
  const passwordInput = document.getElementById("barberPassword")

  if (title) title.textContent = "Adicionar Barbeiro"
  if (submitBtn) submitBtn.textContent = "Adicionar Barbeiro"
  if (passwordGroup) passwordGroup.classList.remove("hidden")
  if (passwordInput) passwordInput.required = true
}

function openBarberForm(barber = null, barberId = null) {
  const createCard = document.getElementById("barberCreateCard")
  if (!createCard) return

  createCard.classList.remove("hidden")

  if (!barber) {
    resetBarberForm()
    return
  }

  editingBarberId = barberId
  document.getElementById("barberName").value = barber.name || ""
  document.getElementById("barberEmail").value = barber.email || ""
  document.getElementById("barberPhone").value = barber.phone || ""
  document.getElementById("barberSpecialty").value = barber.specialty || ""

  const start = parseTimeValue(barber.workingHours?.start || "09:00", "09", "00")
  const end = parseTimeValue(barber.workingHours?.end || "19:00", "19", "00")
  document.getElementById("barberStartHour").value = start.hour
  document.getElementById("barberStartMinute").value = start.minute
  document.getElementById("barberEndHour").value = end.hour
  document.getElementById("barberEndMinute").value = end.minute

  const workingDays = barber.workingDays || [1, 2, 3, 4, 5]
  document.querySelectorAll('#barberWorkingDays input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = workingDays.includes(Number(checkbox.value))
  })

  const title = document.getElementById("barberFormTitle")
  const submitBtn = document.getElementById("barberSubmitBtn")
  const passwordGroup = document.getElementById("barberPasswordGroup")
  const passwordInput = document.getElementById("barberPassword")

  if (title) title.textContent = "Editar Barbeiro"
  if (submitBtn) submitBtn.textContent = "Guardar Alterações"
  if (passwordGroup) passwordGroup.classList.add("hidden")
  if (passwordInput) {
    passwordInput.required = false
    passwordInput.value = ""
  }
}

function closeBarberForm() {
  document.getElementById("barberCreateCard")?.classList.add("hidden")
  resetBarberForm()
}

window.editBarber = (id) => {
  const barber = state.barbers[id]
  if (!barber) {
    showError("Barbeiro não encontrado.")
    return
  }
  openBarberForm(barber, id)
}

window.editPromotion = (id) => {
  const promo = state.promotions[id]
  if (!promo) {
    showError("Promoção não encontrada.")
    return
  }

  editingPromotionId = id
  const title = document.getElementById("promotionTitle")
  const minCuts = document.getElementById("promotionMinCuts")
  const rewardText = document.getElementById("promotionRewardText")
  const description = document.getElementById("promotionDescription")
  const active = document.getElementById("promotionActive")
  const saveBtn = document.getElementById("promotionSaveBtn")

  if (title) title.value = promo.title || ""
  if (minCuts) minCuts.value = String(promo.minCompletedCuts || 10)
  if (rewardText) rewardText.value = promo.rewardText || ""
  if (description) description.value = promo.description || ""
  if (active) active.value = promo.isActive === false ? "false" : "true"
  if (saveBtn) saveBtn.textContent = "Atualizar promoção"

  document.getElementById("promotions-tab")?.scrollIntoView({ behavior: "smooth", block: "start" })
}

window.deletePromotion = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar esta promoção?")) return

  try {
    await remove(ref(database, `promotions/${id}`))
    if (editingPromotionId === id) {
      resetPromotionForm()
    }
    showSuccess("Promoção eliminada com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar promoção: " + error.message)
  }
}

window.deleteBarber = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar este barbeiro?")) return

  try {
    await remove(ref(database, `barbers/${id}`))
    showSuccess("Barbeiro eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar barbeiro: " + error.message)
  }
}

window.deleteClient = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar este cliente? As marcações associadas serão mantidas.")) return

  try {
    await remove(ref(database, `clients/${id}`))
    showSuccess("Cliente eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar cliente: " + error.message)
  }
}

window.deleteBooking = async (id) => {
  if (!confirm("Tem certeza que deseja cancelar esta marcação?")) return

  try {
    const bookingRef = ref(database, `bookings/${id}`)
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcação não encontrada.")
      return
    }

    const booking = snapshot.val()
    await set(bookingRef, {
      ...booking,
      status: "cancelled",
      cancelledBy: "admin",
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    showSuccess("Marcação cancelada com sucesso!")
  } catch (error) {
    showError("Erro ao cancelar marcação: " + error.message)
  }
}

window.approveCancellation = async (id) => {
  try {
    const bookingRef = ref(database, `bookings/${id}`)
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcação não encontrada.")
      return
    }

    const booking = snapshot.val()
    await set(bookingRef, {
      ...booking,
      status: "cancelled",
      cancellationApproved: true,
      cancellationApprovedAt: new Date().toISOString(),
      cancelledBy: "admin",
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    showSuccess("Cancelamento aprovado com sucesso!")
  } catch (error) {
    showError("Erro ao aprovar cancelamento: " + error.message)
  }
}

window.editBooking = async (id) => {
  try {
    const bookingRef = ref(database, `bookings/${id}`)
    const snapshot = await get(bookingRef)

    if (!snapshot.exists()) {
      showError("Marcação não encontrada.")
      return
    }

    const booking = snapshot.val()
    if (booking.status === "cancelled") {
      showError("Não é possível editar uma marcação anulada.")
      return
    }

    const newDate = window.prompt("Nova data (AAAA-MM-DD)", booking.date || "")
    if (!newDate) return

    const newTime = window.prompt("Novo horário (HH:MM)", booking.time || "")
    if (!newTime) return

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      showError("Data inválida. Use o formato AAAA-MM-DD.")
      return
    }

    if (!/^\d{2}:\d{2}$/.test(newTime)) {
      showError("Horário inválido. Use o formato HH:MM.")
      return
    }

    await set(bookingRef, {
      ...booking,
      date: newDate,
      time: newTime,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    })

    showSuccess("Marcação editada com sucesso!")
  } catch (error) {
    showError("Erro ao editar marcação: " + error.message)
  }
}

window.setExecutionStatus = async (id, statusValue) => {
  try {
    const bookingRef = ref(database, `bookings/${id}`)
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcação não encontrada.")
      return
    }

    const booking = snapshot.val()
    const update = {
      ...booking,
      executionStatus: statusValue,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    }

    if (statusValue === "in_progress" && !booking.startedAt) {
      update.startedAt = new Date().toISOString()
    }

    if (statusValue === "completed") {
      update.completedAt = new Date().toISOString()
    }

    await set(bookingRef, update)
    showSuccess("Estado da marcação atualizado!")
  } catch (error) {
    showError("Erro ao atualizar estado da marcação: " + error.message)
  }
}

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
    console.error("Erro ao verificar administrador:", error)
    return false
  }
}

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

  if (!editingBarberId && (!password || password.length < 6)) {
    showError("A senha deve ter pelo menos 6 caracteres.")
    return
  }

  const startTime = getSelectTime("barberStartHour", "barberStartMinute")
  const endTime = getSelectTime("barberEndHour", "barberEndMinute")

  const workingDays = Array.from(document.querySelectorAll('#barberWorkingDays input[type="checkbox"]:checked')).map((cb) => Number(cb.value))
  if (!workingDays.length) {
    showError("Selecione pelo menos um dia de trabalho.")
    return
  }

  try {
    const newBarber = {
      name: document.getElementById("barberName").value,
      email,
      phone: formatPhoneNumber(phone),
      specialty: document.getElementById("barberSpecialty").value,
      workingHours: {
        start: startTime,
        end: endTime,
      },
      workingDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (editingBarberId) {
      const existingSnapshot = await get(ref(database, `barbers/${editingBarberId}`))
      if (!existingSnapshot.exists()) {
        showError("Barbeiro não encontrado para edição.")
        return
      }

      const existing = existingSnapshot.val()
      await set(ref(database, `barbers/${editingBarberId}`), {
        ...existing,
        ...newBarber,
        createdAt: existing.createdAt || new Date().toISOString(),
      })

      await setDoc(
        doc(firestore, "users", editingBarberId),
        {
          fullName: newBarber.name,
          phone: newBarber.phone,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      closeBarberForm()
      showSuccess("Barbeiro atualizado com sucesso!")
      return
    }

    const barberCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const barberUid = barberCredential.user.uid

    await set(ref(database, `barbers/${barberUid}`), newBarber)

    await setDoc(doc(firestore, "users", barberUid), {
      uid: barberUid,
      email,
      fullName: newBarber.name,
      role: "barber",
      roles: ["barber"],
      birthDate: null,
      phone: newBarber.phone,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await signOut(secondaryAuth)
    closeBarberForm()
    showSuccess("Barbeiro adicionado com sucesso!")
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      showError("Este email já está registado no Firebase Auth.")
    } else {
      showError("Erro ao adicionar barbeiro: " + error.message)
    }
  }
})

document.getElementById("storeScheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const openDays = Array.from(document.querySelectorAll('#storeOpenDays input[type="checkbox"]:checked')).map((cb) => Number(cb.value))
  if (!openDays.length) {
    showError("Selecione pelo menos um dia em que a loja está aberta.")
    return
  }

  const payload = {
    openDays,
    openingHours: {
      start: getSelectTime("storeOpenHour", "storeOpenMinute"),
      end: getSelectTime("storeCloseHour", "storeCloseMinute"),
    },
    lunchBreak: {
      start: getSelectTime("storeLunchStartHour", "storeLunchStartMinute"),
      end: getSelectTime("storeLunchEndHour", "storeLunchEndMinute"),
    },
    updatedAt: new Date().toISOString(),
  }

  try {
    await set(ref(database, "storeSettings"), payload)
    showSuccess("Horário da loja guardado com sucesso!")
  } catch (error) {
    showError("Erro ao guardar horário da loja: " + error.message)
  }
})

document.getElementById("bookingPriorityCancel")?.addEventListener("change", () => {
  renderBookings()
})

// Inicializa controles visuais imediatamente para evitar UI sem ação
setupTopTabs()
setupBarberFormMode()
setupBarberFormTimes()
setupStoreScheduleTimes()
setupFilters()
setupRevenueControls()
setupPromotionForm()

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    sessionStorage.clear()
    window.location.href = "admin-login.html"
    return
  }

  const ok = await verifyAdminAccess(user)
  if (!ok) return

  loadBarbers()
  loadBookings()
  loadClients()
  loadPromotions()
  loadStoreSettings()
})

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).finally(() => {
    sessionStorage.clear()
    window.location.href = "index.html"
  })
})
