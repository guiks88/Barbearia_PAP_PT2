import { auth, database, firebaseConfig, firestore, AUTH_ACTION_URL } from "./firebase-config.js"
import { ref, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
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
secondaryAuth.languageCode = "pt"

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
  products: {},
  storeSettings: {},
}

let editingPromotionId = null
let editingProductId = null
let editingBarberId = null
let barberModalEscBound = false
let revenueViewMode = 'barber' // 'barber' or 'service'

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

function timeToMinutes(timeValue) {
  const [hour, minute] = String(timeValue || "00:00").split(":").map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function getBookingDateTime(booking) {
  if (!booking?.date) return null
  const timeValue = booking?.time || "00:00"
  const dateTime = new Date(`${booking.date}T${timeValue}:00`)
  if (Number.isNaN(dateTime.getTime())) return null
  return dateTime
}

function isBookingInPast(booking) {
  const dateTime = getBookingDateTime(booking)
  if (!dateTime) return false
  return dateTime < new Date()
}

function buildHourOptions(selected) {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
    .map((hour) => `<option value="${hour}" ${selected === hour ? "selected" : ""}>${hour}</option>`)
    .join("")
}

function buildHourOptionsRange(selected, minHour, maxHour) {
  const min = Number(minHour)
  const max = Number(maxHour)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return buildHourOptions(selected)
  }

  return Array.from({ length: max - min + 1 }, (_, i) => String(i + min).padStart(2, "0"))
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
            <p class="barber-front-info"><strong>Nota média:</strong> ${averageRating > 0 ? averageRating.toFixed(1) : "0.0"} / 5 (${ratingCount})</p>
          </div>
          <div class="barber-back" style="display:none; margin-top:8px;">
            <p><strong>Cortes concluídos:</strong> ${completedCuts}</p>
            <p><strong>Nota média:</strong> ${averageRating > 0 ? averageRating.toFixed(1) : "0.0"} / 5 (${ratingCount})</p>
          </div>
          <script>/* attach toggle after render */</script>
          <div class="booking-actions">
}

function setBarberListVisibility(isVisible) {
  const listCard = document.getElementById("barberListCard")
  const barbersTab = document.getElementById("barbers-tab")
  if (!listCard) return
  listCard.classList.toggle("hidden", !isVisible)
  if (isVisible) {
    listCard.style.removeProperty("display")
  } else {
    listCard.style.setProperty("display", "none", "important")
  }
  barbersTab?.classList.toggle("barber-form-active", !isVisible)
}

function setBarberEditOnlyMode(isActive) {
  const barbersTab = document.getElementById("barbers-tab")
  const modal = document.getElementById("barberFormModal")
  if (!barbersTab) return

  barbersTab.dataset.editOnly = isActive ? "true" : "false"

  if (modal) {
    if (isActive) {
      modal.style.setProperty("display", "flex", "important")
    } else {
      modal.style.removeProperty("display")
    }
  }

  Array.from(barbersTab.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return

    if (child.id === "barberFormModal") {
      child.style.display = isActive ? "flex" : ""
      return
    }

    child.style.display = isActive ? "none" : ""
  })
}

function setupBarberFormTimes(storeSettings = state.storeSettings) {
  const startHour = document.getElementById("barberStartHour")
  const startMinute = document.getElementById("barberStartMinute")
  const endHour = document.getElementById("barberEndHour")
  const endMinute = document.getElementById("barberEndMinute")
  const lunchStartHour = document.getElementById("barberLunchStartHour")
  const lunchStartMinute = document.getElementById("barberLunchStartMinute")
  const lunchEndHour = document.getElementById("barberLunchEndHour")
  const lunchEndMinute = document.getElementById("barberLunchEndMinute")

  if (!startHour || !startMinute || !endHour || !endMinute || !lunchStartHour || !lunchStartMinute || !lunchEndHour || !lunchEndMinute) return

  const storeStart = parseTimeValue(storeSettings?.openingHours?.start || "09:00", "09", "00")
  const storeEnd = parseTimeValue(storeSettings?.openingHours?.end || "19:00", "19", "00")
  const lunchStart = parseTimeValue(storeSettings?.lunchBreak?.start || "13:00", "13", "00")
  const lunchEnd = parseTimeValue(storeSettings?.lunchBreak?.end || "14:00", "14", "00")

  startHour.innerHTML = buildHourOptionsRange(storeStart.hour, storeStart.hour, storeEnd.hour)
  startMinute.innerHTML = buildMinuteOptions(storeStart.minute)
  endHour.innerHTML = buildHourOptionsRange(storeEnd.hour, storeStart.hour, storeEnd.hour)
  endMinute.innerHTML = buildMinuteOptions(storeEnd.minute)
  lunchStartHour.innerHTML = buildHourOptionsRange(lunchStart.hour, storeStart.hour, storeEnd.hour)
  lunchStartMinute.innerHTML = buildMinuteOptions(lunchStart.minute)
  lunchEndHour.innerHTML = buildHourOptionsRange(lunchEnd.hour, storeStart.hour, storeEnd.hour)
  lunchEndMinute.innerHTML = buildMinuteOptions(lunchEnd.minute)
}

function setupTopTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab

      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))
      document.getElementById(`${tab}-tab`).classList.add("active")
      handleAdminTabActivation(tab)
    })
  })
}

function activateAdminTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab)
  })

  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))
  document.getElementById(`${tab}-tab`)?.classList.add("active")
  handleAdminTabActivation(tab)
}

function handleAdminTabActivation(tab) {
  if (tab === "bookings") {
    ensureBookingDefaults()
    renderBookings()
  }

  if (tab === "revenue") {
    ensureRevenueDefaults()
    updateRevenue()
  }
}

function ensureBookingDefaults() {
  const dateFrom = document.getElementById("bookingDateFrom")
  const dateTo = document.getElementById("bookingDateTo")
  const priorityCancel = document.getElementById("bookingPriorityCancel")
  const today = new Date()
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  if (dateFrom && !dateFrom.value) dateFrom.value = todayValue
  if (dateTo && !dateTo.value) dateTo.value = todayValue
  if (priorityCancel && priorityCancel.checked === false && priorityCancel.dataset.userChanged !== "true") {
    priorityCancel.checked = true
  }
}

function ensureRevenueDefaults() {
  const dayInput = document.getElementById("revenueDay")
  const monthInput = document.getElementById("revenueMonth")
  const today = new Date()
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const monthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

  if (dayInput && !dayInput.value) dayInput.value = todayValue
  if (monthInput && !monthInput.value) monthInput.value = monthValue
}

function setupScheduleTabs() {
  const storeBtn = document.getElementById("scheduleStoreTabBtn")
  const exceptionsBtn = document.getElementById("scheduleExceptionsTabBtn")
  const storePanel = document.getElementById("scheduleStorePanel")
  const exceptionsPanel = document.getElementById("scheduleExceptionsPanel")
  if (!storeBtn || !exceptionsBtn || !storePanel || !exceptionsPanel) return

  const activate = (target) => {
    const isStore = target === "store"
    storePanel.style.display = isStore ? "" : "none"
    exceptionsPanel.style.display = isStore ? "none" : ""
    storeBtn.classList.toggle("btn-primary", isStore)
    storeBtn.classList.toggle("btn-secondary", !isStore)
    exceptionsBtn.classList.toggle("btn-primary", !isStore)
    exceptionsBtn.classList.toggle("btn-secondary", isStore)
  }

  storeBtn.addEventListener("click", () => activate("store"))
  exceptionsBtn.addEventListener("click", () => activate("exceptions"))
  activate("store")
}

function setupPromotionTabs() {
  const formBtn = document.getElementById("promotionFormTabBtn")
  const listBtn = document.getElementById("promotionListTabBtn")
  const formPanel = document.getElementById("promotionFormPanel")
  const listPanel = document.getElementById("promotionListPanel")
  if (!formBtn || !listBtn || !formPanel || !listPanel) return

  const activate = (target) => {
    const isForm = target === "form"
    formPanel.style.display = isForm ? "" : "none"
    listPanel.style.display = isForm ? "none" : ""
    formBtn.classList.toggle("btn-primary", isForm)
    formBtn.classList.toggle("btn-secondary", !isForm)
    listBtn.classList.toggle("btn-primary", !isForm)
    listBtn.classList.toggle("btn-secondary", isForm)
  }

  formBtn.addEventListener("click", () => activate("form"))
  listBtn.addEventListener("click", () => activate("list"))
  activate("form")
}

function setupProductTabs() {
  const formBtn = document.getElementById("productFormTabBtn")
  const listBtn = document.getElementById("productListTabBtn")
  const formPanel = document.getElementById("productFormPanel")
  const listPanel = document.getElementById("productListPanel")
  if (!formBtn || !listBtn || !formPanel || !listPanel) return

  const activate = (target) => {
    const isForm = target === "form"
    formPanel.style.display = isForm ? "" : "none"
    listPanel.style.display = isForm ? "none" : ""
    formBtn.classList.toggle("btn-primary", isForm)
    formBtn.classList.toggle("btn-secondary", !isForm)
    listBtn.classList.toggle("btn-primary", !isForm)
    listBtn.classList.toggle("btn-secondary", isForm)
  }

  formBtn.addEventListener("click", () => activate("form"))
  listBtn.addEventListener("click", () => activate("list"))
  activate("form")
}

function setupBarberFormMode() {
  const modal = document.getElementById("barberFormModal")
  const openBtn = document.getElementById("openCreateBarberBtn")
  const backBtn = document.getElementById("closeBarberModalBtn")
  const backdrop = document.getElementById("barberFormBackdrop")
  if (!modal || !openBtn || !backBtn || !backdrop) return

  openBtn.addEventListener("click", () => {
    openBarberForm()
  })

  backBtn.addEventListener("click", () => {
    closeBarberForm()
  })

  backdrop.addEventListener("click", () => {
    closeBarberForm()
  })

  if (!barberModalEscBound) {
    barberModalEscBound = true
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return
      if (modal.classList.contains("hidden")) return
      closeBarberForm()
    })
  }
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
    "clientSearchName",
    "clientSearchEmail",
    "clientSearchPhone",
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
  // Revenue view mode buttons
  const byBarberBtn = document.getElementById("revenueByBarberBtn")
  const byServiceBtn = document.getElementById("revenueByServiceBtn")
  
  if (byBarberBtn && byServiceBtn) {
    byBarberBtn.addEventListener("click", () => {
      revenueViewMode = 'barber'
      byBarberBtn.classList.add('btn-primary')
      byBarberBtn.classList.remove('btn-secondary')
      byServiceBtn.classList.remove('btn-primary')
      byServiceBtn.classList.add('btn-secondary')
      updateRevenue()
    })
    
    byServiceBtn.addEventListener("click", () => {
      revenueViewMode = 'service'
      byServiceBtn.classList.add('btn-primary')
      byServiceBtn.classList.remove('btn-secondary')
      byBarberBtn.classList.remove('btn-primary')
      byBarberBtn.classList.add('btn-secondary')
      updateRevenue()
    })
  }
  
  // Period filter controls
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
    name: normalize(document.getElementById("clientSearchName")?.value),
    email: normalize(document.getElementById("clientSearchEmail")?.value),
    phone: normalize(document.getElementById("clientSearchPhone")?.value),
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
    if (filters.name && !normalize(client.name).includes(filters.name)) return false
    if (filters.email && !normalize(client.email).includes(filters.email)) return false
    if (filters.phone && !normalize(client.phone).includes(filters.phone)) return false

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

function computeBarberStatsFromBookings(barberId) {
  const barber = state.barbers?.[barberId] || {}
  const normalizedBarberName = normalize(barber.name || "")
  const bookings = Object.values(state.bookings || {})
  const completed = bookings.filter((booking) => {
    if (!booking) return false

    const bookingBarberId = String(booking.barberId || "").trim()
    const bookingBarberName = normalize(booking.barberName || "")
    const matchesBarber =
      bookingBarberId === barberId ||
      (normalizedBarberName && (
        bookingBarberName === normalizedBarberName ||
        bookingBarberName.includes(normalizedBarberName) ||
        normalizedBarberName.includes(bookingBarberName)
      ))

    if (!matchesBarber) return false

    const executionStatus = booking.executionStatus || booking.status || "pending"
    if (executionStatus !== "completed") return false
    const status = booking.status || "active"
    return status !== "cancelled" && status !== "expired"
  })

  const completedCuts = completed.length
  const ratings = completed
    .map((booking) => Number(booking.rating))
    .filter((value) => Number.isFinite(value) && value > 0)

  const ratingCount = ratings.length
  const ratingTotal = ratings.reduce((sum, value) => sum + value, 0)
  const averageRating = ratingCount > 0 ? ratingTotal / ratingCount : 0

  return { completedCuts, ratingCount, averageRating }
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
      const liveStats = computeBarberStatsFromBookings(id)
      const completedCuts = liveStats.completedCuts
      const ratingCount = liveStats.ratingCount
      const averageRating = liveStats.averageRating
      return `
        <div class="barber-item">
          <div>
            <h3>${barber.name || "Barbeiro"}</h3>
            <p><strong>Email:</strong> ${barber.email || "-"}</p>
            <p><strong>Telefone:</strong> ${barber.phone || "-"}</p>
            <p><strong>Especialidade:</strong> ${barber.specialty || "-"}</p>
            <p><strong>Horário:</strong> ${barber.workingHours?.start || "09:00"} - ${barber.workingHours?.end || "19:00"}</p>
            <p><strong>Almoço:</strong> ${barber.lunchBreak?.start || "13:00"} - ${barber.lunchBreak?.end || "14:00"}</p>
            <p><strong>Dias:</strong> ${days}</p>
            <p><strong>Cortes concluídos:</strong> ${completedCuts}</p>
            <p><strong>Nota média:</strong> ${averageRating > 0 ? averageRating.toFixed(1) : "0.0"} / 5 (${ratingCount})</p>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary" data-action="edit-barber" data-barber-id="${id}">Editar</button>
            <button class="btn btn-danger" data-action="delete-barber" data-barber-id="${id}">Eliminar</button>
          </div>
        </div>
      `
    })
    .join("")

  container.querySelectorAll('[data-action="edit-barber"]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-barber-id")
      if (!id) return
      window.editBarber(id)
    })
  })

  container.querySelectorAll('[data-action="delete-barber"]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-barber-id")
      if (!id) return
      window.deleteBarber(id)
    })
  })

  // attach toggle to show/hide barber-back on name click
  container.querySelectorAll('.barber-item > div > h3').forEach((h3) => {
    h3.style.cursor = 'pointer'
    h3.addEventListener('click', () => {
      const parent = h3.closest('.barber-item')
      if (!parent) return
      const back = parent.querySelector('.barber-back')
      if (!back) return
      back.style.display = back.style.display === 'none' ? '' : 'none'
    })
  })
}

function renderBookings() {
  const container = document.getElementById("allBookingsList")
  if (!container) return

  const prioritizeCancel = document.getElementById("bookingPriorityCancel")?.checked !== false
  const entries = filterBookingEntries().sort((a, b) => {
    const leftBooking = a[1]
    const rightBooking = b[1]
    const leftInactive = leftBooking.status === "cancelled" || leftBooking.status === "expired"
    const rightInactive = rightBooking.status === "cancelled" || rightBooking.status === "expired"

    const leftBucket = leftInactive ? 2 : prioritizeCancel && leftBooking.status === "cancel_requested" ? 0 : 1
    const rightBucket = rightInactive ? 2 : prioritizeCancel && rightBooking.status === "cancel_requested" ? 0 : 1

    if (leftBucket !== rightBucket) return leftBucket - rightBucket

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
      const isInactive = booking.status === "cancelled" || booking.status === "expired"
      const showLifecycle = booking.executionStatus !== "completed"
      const canCancel = !isInactive && booking.status !== "cancel_requested" && booking.executionStatus !== "completed"
      const canReactivate = booking.status === "cancelled"

      return `
        <div class="booking-item booking-item-extended ${isInactive ? "is-inactive" : ""}">
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
              ${showLifecycle ? `<span class="status-pill ${lifecycle.className}">${lifecycle.label}</span>` : ""}
              <span class="status-pill ${execution.className}">${execution.label}</span>
            </div>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary btn-small" onclick="editBooking('${id}')">Editar</button>
            <select class="inline-select" onchange="setExecutionStatus('${id}', this.value)" ${isInactive ? "disabled" : ""}>
              <option value="pending" ${execution.className === "is-pending" ? "selected" : ""}>Não concluída</option>
              <option value="in_progress" ${execution.className === "is-progress" ? "selected" : ""}>A ser concluída</option>
              <option value="completed" ${execution.className === "is-completed" ? "selected" : ""}>Concluída</option>
            </select>
            ${booking.status === "cancel_requested" ? `<button class="btn btn-primary btn-small" onclick="approveCancellation('${id}')">Aprovar cancelamento</button>` : ""}
            ${booking.status === "cancel_requested" ? `<button class="btn btn-secondary btn-small" onclick="rejectCancellation('${id}')">Recusar cancelamento</button>` : ""}
            ${canReactivate ? `<button class="btn btn-primary btn-small" onclick="reactivateBooking('${id}')">Reativar</button>` : ""}
            ${booking.executionStatus === "completed" ? `<button class="btn btn-secondary btn-small" disabled>Concluída</button>` : ""}
            ${booking.status === "expired" ? `<button class="btn btn-secondary btn-small" disabled>Expirada</button>` : ""}
            ${canCancel ? `<button class="btn btn-danger btn-small" onclick="deleteBooking('${id}')">Cancelar</button>` : ""}
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

function resetProductForm() {
  const form = document.getElementById("productForm")
  if (!form) return

  form.reset()
  editingProductId = null

  const stock = document.getElementById("productStock")
  const promo = document.getElementById("productPromo")
  const sales = document.getElementById("productSales")
  const active = document.getElementById("productActive")
  const saveBtn = document.getElementById("productSaveBtn")

  if (stock) stock.value = "0"
  if (promo) promo.value = "0"
  if (sales) sales.value = "0"
  if (active) active.checked = true
  if (saveBtn) saveBtn.textContent = "Guardar produto"
}

function renderProducts() {
  const container = document.getElementById("productsListAdmin")
  if (!container) return

  const entries = Object.entries(state.products || {}).sort((a, b) => {
    const left = a[1]?.createdAt || ""
    const right = b[1]?.createdAt || ""
    return right.localeCompare(left)
  })

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Sem produtos registados</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, product]) => {
      const price = Number(product.price || 0).toFixed(2)
      const promo = Number(product.promoPercent || 0)
      const stock = Number(product.stock || 0)
      const sales = Number(product.salesCount || 0)
      const isActive = product.isActive !== false
      return `
        <div class="barber-item">
          <div>
            <h3>${product.name || "Produto"}</h3>
            <p><strong>Preço:</strong> ${price}€</p>
            <p><strong>Promoção:</strong> ${promo}%</p>
            <p><strong>Stock:</strong> ${stock}</p>
            <p><strong>Vendas:</strong> ${sales}</p>
            <p><strong>Estado:</strong> <span class="status-pill ${isActive ? "is-active" : "is-cancelled"}">${isActive ? "Ativo" : "Inativo"}</span></p>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary btn-small" data-action="edit-product" data-product-id="${id}">Editar</button>
            <button class="btn btn-danger btn-small" data-action="delete-product" data-product-id="${id}">Eliminar</button>
          </div>
        </div>
      `
    })
    .join("")

  container.querySelectorAll('[data-action="edit-product"]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-product-id")
      if (!id) return
      window.editProduct(id)
    })
  })

  container.querySelectorAll('[data-action="delete-product"]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-product-id")
      if (!id) return
      window.deleteProduct(id)
    })
  })
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

function setupProductForm() {
  const form = document.getElementById("productForm")
  const cancelBtn = document.getElementById("productCancelEditBtn")
  const seedBtn = document.getElementById("seedProductsBtn")
  if (!form || !cancelBtn) return

  if (!form.dataset.bound) {
    form.dataset.bound = "true"
    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const name = document.getElementById("productName")?.value?.trim() || ""
      const price = Number(document.getElementById("productPrice")?.value || 0)
      const imageUrl = document.getElementById("productImage")?.value?.trim() || ""
      const stock = Number(document.getElementById("productStock")?.value || 0)
      const promoPercent = Number(document.getElementById("productPromo")?.value || 0)
      const salesCount = Number(document.getElementById("productSales")?.value || 0)
      const description = document.getElementById("productDescription")?.value?.trim() || ""
      const isActive = document.getElementById("productActive")?.checked !== false

      if (!name || !Number.isFinite(price) || price <= 0) {
        showError("Preencha nome e preço do produto.")
        return
      }

      const id = editingProductId || `product_${Date.now()}`
      const previous = state.products[id] || {}

      const payload = {
        name,
        price,
        imageUrl,
        stock: Number.isFinite(stock) ? stock : 0,
        promoPercent: Number.isFinite(promoPercent) ? promoPercent : 0,
        salesCount: Number.isFinite(salesCount) ? salesCount : 0,
        description,
        isActive,
        createdAt: previous.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      try {
        await set(ref(database, `products/${id}`), payload)
        showSuccess(editingProductId ? "Produto atualizado com sucesso!" : "Produto criado com sucesso!")
        resetProductForm()
      } catch (error) {
        showError("Erro ao guardar produto: " + error.message)
      }
    })
  }

  if (!cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "true"
    cancelBtn.addEventListener("click", () => {
      resetProductForm()
    })
  }

  // Seed products button removed per request

  resetProductForm()
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
  const storeDefaults = getSpecialScheduleDefaults("store", "")
  setupSpecialScheduleTimes(storeDefaults)
  renderSpecialSchedulesList()
}

function normalizeSpecialSchedules(value) {
  return {
    day: value?.day || {},
    week: value?.week || {},
    month: value?.month || {},
  }
}

function formatSpecialPeriodLabel(period, key) {
  if (period === "day") return `Dia ${key}`
  if (period === "week") return `Semana ${key}`
  return `Mês ${key}`
}

function getSpecialScheduleDefaults(targetValue, barberIdValue) {
  const storeStart = state.storeSettings.openingHours?.start || "09:00"
  const storeEnd = state.storeSettings.openingHours?.end || "19:00"
  const storeLunchStart = state.storeSettings.lunchBreak?.start || "13:00"
  const storeLunchEnd = state.storeSettings.lunchBreak?.end || "14:00"

  if (targetValue === "barber") {
    const barber = state.barbers?.[barberIdValue]
    return {
      start: barber?.workingHours?.start || storeStart,
      end: barber?.workingHours?.end || storeEnd,
      lunchBreak: {
        start: barber?.lunchBreak?.start || storeLunchStart,
        end: barber?.lunchBreak?.end || storeLunchEnd,
      },
    }
  }

  return {
    start: storeStart,
    end: storeEnd,
    lunchBreak: { start: storeLunchStart, end: storeLunchEnd },
  }
}

function setupSpecialScheduleTimes(defaults = {}) {
  const startHour = document.getElementById("specialScheduleStartHour")
  const startMinute = document.getElementById("specialScheduleStartMinute")
  const endHour = document.getElementById("specialScheduleEndHour")
  const endMinute = document.getElementById("specialScheduleEndMinute")
  const lunchStartHour = document.getElementById("specialScheduleLunchStartHour")
  const lunchStartMinute = document.getElementById("specialScheduleLunchStartMinute")
  const lunchEndHour = document.getElementById("specialScheduleLunchEndHour")
  const lunchEndMinute = document.getElementById("specialScheduleLunchEndMinute")
  if (!startHour || !startMinute || !endHour || !endMinute) return

  const start = parseTimeValue(defaults.start || "09:00", "09", "00")
  const end = parseTimeValue(defaults.end || "19:00", "19", "00")
  const lunchStart = parseTimeValue(defaults.lunchBreak?.start || "13:00", "13", "00")
  const lunchEnd = parseTimeValue(defaults.lunchBreak?.end || "14:00", "14", "00")

  startHour.innerHTML = buildHourOptions(start.hour)
  startMinute.innerHTML = buildMinuteOptions(start.minute)
  endHour.innerHTML = buildHourOptions(end.hour)
  endMinute.innerHTML = buildMinuteOptions(end.minute)

  if (lunchStartHour && lunchStartMinute) {
    lunchStartHour.innerHTML = buildHourOptions(lunchStart.hour)
    lunchStartMinute.innerHTML = buildMinuteOptions(lunchStart.minute)
  }
  if (lunchEndHour && lunchEndMinute) {
    lunchEndHour.innerHTML = buildHourOptions(lunchEnd.hour)
    lunchEndMinute.innerHTML = buildMinuteOptions(lunchEnd.minute)
  }
}

function populateSpecialScheduleBarberSelect() {
  const select = document.getElementById("specialScheduleBarberId")
  if (!select) return

  const entries = Object.entries(state.barbers || {})
  if (!entries.length) {
    select.innerHTML = "<option value=''>Sem barbeiros disponíveis</option>"
    return
  }

  select.innerHTML = entries
    .map(([id, barber]) => `<option value="${id}">${barber?.name || "Barbeiro"}</option>`)
    .join("")
}

function getSpecialScheduleReferenceType(period) {
  if (period === "week") return "week"
  if (period === "month") return "month"
  return "date"
}

function getCurrentSpecialScheduleSource() {
  const target = document.getElementById("specialScheduleTarget")?.value || "store"
  if (target === "store") {
    return {
      title: "Loja",
      schedules: normalizeSpecialSchedules(state.storeSettings?.specialSchedules),
      target: "store",
      barberId: null,
    }
  }

  const barberId = document.getElementById("specialScheduleBarberId")?.value || ""
  const barber = state.barbers?.[barberId]
  return {
    title: barber?.name || "Barbeiro",
    schedules: normalizeSpecialSchedules(barber?.specialSchedules),
    target: "barber",
    barberId,
  }
}

function renderSpecialSchedulesList() {
  const container = document.getElementById("specialSchedulesList")
  if (!container) return

  const source = getCurrentSpecialScheduleSource()
  const rows = []

  ;["day", "week", "month"].forEach((period) => {
    Object.entries(source.schedules[period] || {}).forEach(([key, schedule]) => {
      if (!schedule?.start || !schedule?.end) return
      rows.push({
        period,
        key,
        start: schedule.start,
        end: schedule.end,
        lunchStart: schedule?.lunchBreak?.start || "",
        lunchEnd: schedule?.lunchBreak?.end || "",
      })
    })
  })

  rows.sort((a, b) => `${a.period}-${a.key}`.localeCompare(`${b.period}-${b.key}`))

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Sem exceções definidas para ${source.title}.</div>`
    return
  }

  container.innerHTML = rows
    .map(
      (row) => `
      <div class="barber-item">
        <div>
          <h3>${source.title}</h3>
          <p><strong>Período:</strong> ${formatSpecialPeriodLabel(row.period, row.key)}</p>
          <p><strong>Horário:</strong> ${row.start} - ${row.end}</p>
          ${row.lunchStart && row.lunchEnd ? `<p><strong>Almoço:</strong> ${row.lunchStart} - ${row.lunchEnd}</p>` : ""}
        </div>
        <div class="booking-actions">
          <button class="btn btn-danger btn-small" data-action="delete-special-schedule" data-target="${source.target}" data-barber-id="${source.barberId || ""}" data-period="${row.period}" data-key="${row.key}">Remover</button>
        </div>
      </div>
    `,
    )
    .join("")

  container.querySelectorAll('[data-action="delete-special-schedule"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.getAttribute("data-target") || "store"
      const period = button.getAttribute("data-period") || "day"
      const key = button.getAttribute("data-key") || ""
      const barberId = button.getAttribute("data-barber-id") || ""
      if (!key) return

      const path =
        target === "barber"
          ? `barbers/${barberId}/specialSchedules/${period}/${key}`
          : `storeSettings/specialSchedules/${period}/${key}`

      try {
        await remove(ref(database, path))
        showSuccess("Exceção removida com sucesso!")
      } catch (error) {
        showError("Erro ao remover exceção: " + error.message)
      }
    })
  })
}

function setupSpecialScheduleManager() {
  const form = document.getElementById("specialScheduleForm")
  const target = document.getElementById("specialScheduleTarget")
  const period = document.getElementById("specialSchedulePeriod")
  const reference = document.getElementById("specialScheduleReference")
  const barberWrap = document.getElementById("specialScheduleBarberWrap")
  const barberSelect = document.getElementById("specialScheduleBarberId")

  if (!form || !target || !period || !reference || !barberWrap || !barberSelect) return

  setupSpecialScheduleTimes(getSpecialScheduleDefaults(target.value, barberSelect.value))
  populateSpecialScheduleBarberSelect()

  const syncInputs = () => {
    barberWrap.classList.toggle("hidden", target.value !== "barber")
    reference.type = getSpecialScheduleReferenceType(period.value)
    reference.value = ""
    setupSpecialScheduleTimes(getSpecialScheduleDefaults(target.value, barberSelect.value))
    renderSpecialSchedulesList()
  }

  target.addEventListener("change", syncInputs)
  period.addEventListener("change", syncInputs)
  barberSelect.addEventListener("change", () => {
    setupSpecialScheduleTimes(getSpecialScheduleDefaults(target.value, barberSelect.value))
    renderSpecialSchedulesList()
  })

  if (!form.dataset.bound) {
    form.dataset.bound = "true"
    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const selectedTarget = target.value
      const selectedPeriod = period.value
      const selectedReference = reference.value
      const selectedBarberId = barberSelect.value
      const start = getSelectTime("specialScheduleStartHour", "specialScheduleStartMinute")
      const end = getSelectTime("specialScheduleEndHour", "specialScheduleEndMinute")
      const lunchStart = getSelectTime("specialScheduleLunchStartHour", "specialScheduleLunchStartMinute")
      const lunchEnd = getSelectTime("specialScheduleLunchEndHour", "specialScheduleLunchEndMinute")

      if (!selectedReference) {
        showError("Indique a referência da exceção (dia/semana/mês).")
        return
      }

      if (timeToMinutes(start) >= timeToMinutes(end)) {
        showError("O horário de início da exceção deve ser anterior ao fim.")
        return
      }

      if (selectedTarget === "barber" && !selectedBarberId) {
        showError("Selecione um barbeiro para aplicar a exceção.")
        return
      }

      const payload = {
        start,
        end,
        updatedAt: new Date().toISOString(),
      }

      if (timeToMinutes(lunchStart) < timeToMinutes(lunchEnd)) {
        payload.lunchBreak = { start: lunchStart, end: lunchEnd }
      }

      const path =
        selectedTarget === "barber"
          ? `barbers/${selectedBarberId}/specialSchedules/${selectedPeriod}/${selectedReference}`
          : `storeSettings/specialSchedules/${selectedPeriod}/${selectedReference}`

      try {
        await set(ref(database, path), payload)
        showSuccess("Exceção de horário guardada com sucesso!")
        reference.value = ""
      } catch (error) {
        showError("Erro ao guardar exceção de horário: " + error.message)
      }
    })
  }

  syncInputs()
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

  let details = ''
  
  if (revenueViewMode === 'barber') {
    details += '<h3 style="color: var(--color-text-primary); margin-bottom: 1rem;">Faturamento por Barbeiro</h3>'
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
  } else {
    details += '<h3 style="color: var(--color-text-primary); margin-bottom: 1rem;">Faturamento por Serviço</h3>'
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
  }

  detailsContainer.innerHTML = details
}

function loadBarbers() {
  onValue(ref(database, "barbers"), (snapshot) => {
    const fallbackLunch = {
      start: state.storeSettings?.lunchBreak?.start || "13:00",
      end: state.storeSettings?.lunchBreak?.end || "14:00",
    }

    const rawBarbers = snapshot.exists() ? snapshot.val() : {}
    const normalizedBarbers = {}
    const missingLunchIds = []

    Object.entries(rawBarbers).forEach(([id, barber]) => {
      if (!barber) return

      const hasLunch = Boolean(barber.lunchBreak?.start && barber.lunchBreak?.end)
      normalizedBarbers[id] = hasLunch
        ? barber
        : {
            ...barber,
            lunchBreak: {
              start: fallbackLunch.start,
              end: fallbackLunch.end,
            },
          }

      if (!hasLunch) {
        missingLunchIds.push(id)
      }
    })

    if (missingLunchIds.length) {
      missingLunchIds.forEach((id) => {
        set(ref(database, `barbers/${id}/lunchBreak`), {
          start: fallbackLunch.start,
          end: fallbackLunch.end,
        }).catch((error) => {
          console.error(`Erro ao gravar hora de almoço para barbeiro ${id}:`, error)
        })
      })
    }

    state.barbers = normalizedBarbers
    populateSpecialScheduleBarberSelect()
    renderSpecialSchedulesList()
    renderBarbers()
    renderBookings()
    updateRevenue()
  })
}

function loadBookings() {
  onValue(ref(database, "bookings"), (snapshot) => {
    state.bookings = snapshot.exists() ? snapshot.val() : {}
    renderBarbers()
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

function loadProducts() {
  onValue(ref(database, "products"), (snapshot) => {
    state.products = snapshot.exists() ? snapshot.val() : {}
    renderProducts()
  })
}

function loadStoreSettings() {
  onValue(ref(database, "storeSettings"), (snapshot) => {
    state.storeSettings = snapshot.exists() ? snapshot.val() : {}
    renderStoreSchedule()
    setupBarberFormTimes(state.storeSettings)
  })
}

function resetBarberForm() {
  const form = document.getElementById("barberForm")
  if (!form) return

  editingBarberId = null
  form.reset()
  setupBarberFormTimes(state.storeSettings)
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
  const modal = document.getElementById("barberFormModal")
  const createCard = document.getElementById("barberCreateCard")
  const openBtn = document.getElementById("openCreateBarberBtn")
  if (!modal) return

  activateAdminTab("barbers")
  modal.classList.remove("hidden")
  modal.setAttribute("aria-hidden", "false")
  modal.style.setProperty("display", "flex", "important")
  document.body.classList.add("modal-open")
  setBarberListVisibility(false)
  setBarberEditOnlyMode(true)
  if (createCard) createCard.scrollTop = 0
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  if (!barber) {
    openBtn?.classList.remove("hidden")
    resetBarberForm()
    return
  }

  openBtn?.classList.add("hidden")

  editingBarberId = barberId
  setupBarberFormTimes(state.storeSettings)
  document.getElementById("barberName").value = barber.name || ""
  document.getElementById("barberEmail").value = barber.email || ""
  document.getElementById("barberPhone").value = barber.phone || ""
  document.getElementById("barberSpecialty").value = barber.specialty || ""

  const start = parseTimeValue(barber.workingHours?.start || "09:00", "09", "00")
  const end = parseTimeValue(barber.workingHours?.end || "19:00", "19", "00")
  const lunchStart = parseTimeValue(barber.lunchBreak?.start || "13:00", "13", "00")
  const lunchEnd = parseTimeValue(barber.lunchBreak?.end || "14:00", "14", "00")
  document.getElementById("barberStartHour").value = start.hour
  document.getElementById("barberStartMinute").value = start.minute
  document.getElementById("barberEndHour").value = end.hour
  document.getElementById("barberEndMinute").value = end.minute
  document.getElementById("barberLunchStartHour").value = lunchStart.hour
  document.getElementById("barberLunchStartMinute").value = lunchStart.minute
  document.getElementById("barberLunchEndHour").value = lunchEnd.hour
  document.getElementById("barberLunchEndMinute").value = lunchEnd.minute

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

  if (createCard) createCard.scrollIntoView({ behavior: "auto", block: "start" })

  const nameInput = document.getElementById("barberName")
  nameInput?.focus()
}

function closeBarberForm() {
  const modal = document.getElementById("barberFormModal")
  const openBtn = document.getElementById("openCreateBarberBtn")
  modal?.classList.add("hidden")
  modal?.setAttribute("aria-hidden", "true")
  modal?.style.removeProperty("display")
  document.body.classList.remove("modal-open")
  setBarberListVisibility(true)
  setBarberEditOnlyMode(false)
  openBtn?.classList.remove("hidden")
  resetBarberForm()
}

window.editBarber = (id) => {
  const barber = state.barbers[id]
  if (!barber) {
    showError("Barbeiro não encontrado.")
    return
  }

  activateAdminTab("barbers")
  setBarberListVisibility(false)
  setBarberEditOnlyMode(true)
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

window.editProduct = (id) => {
  const product = state.products[id]
  if (!product) {
    showError("Produto não encontrado.")
    return
  }

  activateAdminTab("products")
  const formBtn = document.getElementById("productFormTabBtn")
  const listBtn = document.getElementById("productListTabBtn")
  const formPanel = document.getElementById("productFormPanel")
  const listPanel = document.getElementById("productListPanel")
  if (formPanel && listPanel) {
    formPanel.style.display = ""
    listPanel.style.display = "none"
  }
  formBtn?.classList.add("btn-primary")
  formBtn?.classList.remove("btn-secondary")
  listBtn?.classList.add("btn-secondary")
  listBtn?.classList.remove("btn-primary")

  editingProductId = id
  const name = document.getElementById("productName")
  const price = document.getElementById("productPrice")
  const image = document.getElementById("productImage")
  const stock = document.getElementById("productStock")
  const promo = document.getElementById("productPromo")
  const sales = document.getElementById("productSales")
  const description = document.getElementById("productDescription")
  const active = document.getElementById("productActive")
  const saveBtn = document.getElementById("productSaveBtn")

  if (name) name.value = product.name || ""
  if (price) price.value = product.price ?? ""
  if (image) image.value = product.imageUrl || ""
  if (stock) stock.value = product.stock ?? 0
  if (promo) promo.value = product.promoPercent ?? 0
  if (sales) sales.value = product.salesCount ?? 0
  if (description) description.value = product.description || ""
  if (active) active.checked = product.isActive !== false
  if (saveBtn) saveBtn.textContent = "Atualizar produto"

  document.getElementById("products-tab")?.scrollIntoView({ behavior: "smooth", block: "start" })
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

window.deleteProduct = async (id) => {
  if (!confirm("Tem certeza que deseja eliminar este produto?")) return

  try {
    await remove(ref(database, `products/${id}`))
    if (editingProductId === id) {
      resetProductForm()
    }
    showSuccess("Produto eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar produto: " + error.message)
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
    if (booking.executionStatus === "completed" || booking.status === "expired") {
      showError("Não é possível cancelar uma marcação concluída ou expirada.")
      return
    }
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
      cancellationRequest: null,
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

window.rejectCancellation = async (id) => {
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
      status: "active",
      cancellationRequest: null,
      cancellationApproved: null,
      cancellationApprovedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    })

    showSuccess("Cancelamento recusado com sucesso!")
  } catch (error) {
    showError("Erro ao recusar cancelamento: " + error.message)
  }
}

window.reactivateBooking = async (id) => {
  try {
    const bookingRef = ref(database, `bookings/${id}`)
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcação não encontrada.")
      return
    }

    const booking = snapshot.val()
    if (isBookingInPast(booking)) {
      await set(bookingRef, {
        ...booking,
        status: "expired",
        cancelledBy: "system",
        cancellationReason: "Data da marcação já passou",
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: "admin",
      })
      showError("A marcação já passou e foi marcada como expirada.")
      return
    }

    await set(bookingRef, {
      ...booking,
      status: "active",
      cancellationRequest: null,
      cancellationApproved: null,
      cancellationApprovedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    })

    showSuccess("Marcação reativada com sucesso!")
  } catch (error) {
    showError("Erro ao reativar marcação: " + error.message)
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

    const newDateTime = new Date(`${newDate}T${newTime}:00`)
    if (Number.isNaN(newDateTime.getTime())) {
      showError("Data ou horário inválidos.")
      return
    }

    if (newDateTime < new Date()) {
      showError("Não é possível mover para uma data no passado.")
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
  const lunchStartTime = getSelectTime("barberLunchStartHour", "barberLunchStartMinute")
  const lunchEndTime = getSelectTime("barberLunchEndHour", "barberLunchEndMinute")

  const workStartMinutes = timeToMinutes(startTime)
  const workEndMinutes = timeToMinutes(endTime)
  const lunchStartMinutes = timeToMinutes(lunchStartTime)
  const lunchEndMinutes = timeToMinutes(lunchEndTime)

  if (workStartMinutes >= workEndMinutes) {
    showError("O horário de início deve ser anterior ao horário de fim.")
    return
  }

  if (lunchStartMinutes >= lunchEndMinutes) {
    showError("O início do almoço deve ser anterior ao fim do almoço.")
    return
  }

  if (lunchEndMinutes - lunchStartMinutes !== 60) {
    showError("A hora de almoço do barbeiro deve ter exatamente 1 hora.")
    return
  }

  if (lunchStartMinutes < workStartMinutes || lunchEndMinutes > workEndMinutes) {
    showError("A hora de almoço do barbeiro deve estar dentro do horário de trabalho.")
    return
  }

  const storeOpenStart = state.storeSettings.openingHours?.start || "09:00"
  const storeOpenEnd = state.storeSettings.openingHours?.end || "19:00"
  const storeStartMinutes = timeToMinutes(storeOpenStart)
  const storeEndMinutes = timeToMinutes(storeOpenEnd)

  if (workStartMinutes < storeStartMinutes || workEndMinutes > storeEndMinutes) {
    showError("O horário do barbeiro deve respeitar o horário da loja.")
    return
  }

  const workingDays = Array.from(document.querySelectorAll('#barberWorkingDays input[type="checkbox"]:checked')).map((cb) => Number(cb.value))
  if (!workingDays.length) {
    showError("Selecione pelo menos um dia de trabalho.")
    return
  }

  const storeOpenDays = Array.isArray(state.storeSettings.openDays) && state.storeSettings.openDays.length
    ? state.storeSettings.openDays
    : [1, 2, 3, 4, 5]

  const invalidWorkingDay = workingDays.find((day) => !storeOpenDays.includes(day))
  if (invalidWorkingDay !== undefined) {
    showError("Os dias do barbeiro devem estar dentro dos dias de abertura da loja.")
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
      lunchBreak: {
        start: lunchStartTime,
        end: lunchEndTime,
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

    await sendEmailVerification(barberCredential.user, {
      url: AUTH_ACTION_URL,
      handleCodeInApp: true,
    })

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

  const storeStartTime = getSelectTime("storeOpenHour", "storeOpenMinute")
  const storeEndTime = getSelectTime("storeCloseHour", "storeCloseMinute")
  const storeLunchStartTime = getSelectTime("storeLunchStartHour", "storeLunchStartMinute")
  const storeLunchEndTime = getSelectTime("storeLunchEndHour", "storeLunchEndMinute")

  const storeStartMinutes = timeToMinutes(storeStartTime)
  const storeEndMinutes = timeToMinutes(storeEndTime)
  const storeLunchStartMinutes = timeToMinutes(storeLunchStartTime)
  const storeLunchEndMinutes = timeToMinutes(storeLunchEndTime)

  if (storeStartMinutes >= storeEndMinutes) {
    showError("O horário de abertura da loja deve ser anterior ao fecho.")
    return
  }

  if (storeLunchStartMinutes >= storeLunchEndMinutes) {
    showError("O início do almoço da loja deve ser anterior ao fim do almoço.")
    return
  }

  if (storeLunchStartMinutes < storeStartMinutes || storeLunchEndMinutes > storeEndMinutes) {
    showError("A pausa de almoço da loja deve estar dentro do horário de abertura.")
    return
  }

  const payload = {
    openDays,
    openingHours: {
      start: storeStartTime,
      end: storeEndTime,
    },
    lunchBreak: {
      start: storeLunchStartTime,
      end: storeLunchEndTime,
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

document.getElementById("bookingPriorityCancel")?.addEventListener("change", (event) => {
  if (event?.target instanceof HTMLElement) {
    event.target.dataset.userChanged = "true"
  }
  renderBookings()
})

// Inicializa controles visuais imediatamente para evitar UI sem ação
setupTopTabs()
setupScheduleTabs()
setupPromotionTabs()
setupProductTabs()
setupBarberFormMode()
setupBarberFormTimes()
setupStoreScheduleTimes()
setupFilters()
setupRevenueControls()
setupPromotionForm()
setupProductForm()
setupSpecialScheduleManager()

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
  loadProducts()
  loadStoreSettings()
})

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).finally(() => {
    sessionStorage.clear()
    window.location.href = "index.html"
  })
})
