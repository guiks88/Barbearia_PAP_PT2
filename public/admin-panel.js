import { auth, database, firebaseConfig, firestore } from "./firebase-config.js"
import { ref, push, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
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

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]
const state = {
  barbers: {},
  bookings: {},
  clients: {},
}

function normalize(value) {
  return String(value || "").toLowerCase().trim()
}

function toDateOnly(dateLike) {
  if (!dateLike) return null
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isDateBetween(dateLike, startLike, endLike) {
  const date = toDateOnly(dateLike)
  if (!date) return false

  const start = toDateOnly(startLike)
  const end = toDateOnly(endLike)

  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function composeTime(hourId, minuteId) {
  const hour = document.getElementById(hourId)?.value || "00"
  const minute = document.getElementById(minuteId)?.value || "00"
  return `${hour}:${minute}`
}

function applyTimeToSelects(hourId, minuteId, timeValue) {
  const [hour = "00", minute = "00"] = String(timeValue || "00:00").split(":")
  const hourEl = document.getElementById(hourId)
  const minuteEl = document.getElementById(minuteId)
  if (hourEl) hourEl.value = hour.padStart(2, "0")
  if (minuteEl) minuteEl.value = minute.padStart(2, "0")
}

function buildHourOptions(selected = "09") {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
    .map((h) => `<option value="${h}" ${h === selected ? "selected" : ""}>${h}</option>`)
    .join("")
}

function buildMinuteOptions(selected = "00") {
  const minutes = ["00", "15", "30", "45"]
  return minutes.map((m) => `<option value="${m}" ${m === selected ? "selected" : ""}>${m}</option>`).join("")
}

function buildTimePicker(prefix, value) {
  const [hour = "09", minute = "00"] = String(value || "09:00").split(":")
  return `
    <div class="time-select-group">
      <select id="${prefix}-hour" class="time-select">
        ${buildHourOptions(hour)}
      </select>
      <span>:</span>
      <select id="${prefix}-minute" class="time-select">
        ${buildMinuteOptions(minute)}
      </select>
    </div>
  `
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
    document.getElementById("adminNameDisplay").textContent = `Ola, ${adminData.name}`

    return true
  } catch (error) {
    console.error("Error verifying admin:", error)
    return false
  }
}

function setupTopTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"))
      document.getElementById(`${tab}-tab`).classList.add("active")
    })
  })
}

function setupBarberSubTabs() {
  const createCard = document.getElementById("barberCreateCard")
  const listCard = document.getElementById("barberListCard")

  document.querySelectorAll(".subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.subtab
      document.querySelectorAll(".subtab-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      if (mode === "create") {
        createCard.classList.remove("hidden")
        listCard.classList.add("hidden")
      } else {
        listCard.classList.remove("hidden")
        createCard.classList.add("hidden")
      }
    })
  })
}

function setupStaticTimeSelects() {
  const startHour = document.getElementById("barberStartHour")
  const startMinute = document.getElementById("barberStartMinute")
  const endHour = document.getElementById("barberEndHour")
  const endMinute = document.getElementById("barberEndMinute")

  if (startHour) startHour.innerHTML = buildHourOptions("09")
  if (startMinute) startMinute.innerHTML = buildMinuteOptions("00")
  if (endHour) endHour.innerHTML = buildHourOptions("19")
  if (endMinute) endMinute.innerHTML = buildMinuteOptions("00")
}

function setupFilterListeners() {
  const rerender = [
    "barberSearchName",
    "barberSearchEmail",
    "barberSearchPhone",
    "barberSearchSpecialty",
    "clientSearch",
    "clientCreatedFrom",
    "clientCreatedTo",
    "bookingSearchClientName",
    "bookingSearchClientEmail",
    "bookingSearchClientPhone",
    "bookingSearchService",
    "bookingSearchBarber",
    "bookingDateStart",
    "bookingDateEnd",
  ]

  rerender.forEach((id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.addEventListener("input", () => {
      renderBarbers()
      renderClients()
      renderBookings()
    })
    el.addEventListener("change", () => {
      renderBarbers()
      renderClients()
      renderBookings()
    })
  })
}

function setupRevenueControls() {
  const filterSelect = document.getElementById("revenueFilter")
  const monthInput = document.getElementById("revenueMonth")
  const yearSelect = document.getElementById("revenueYear")
  const startInput = document.getElementById("revenueStartDate")
  const endInput = document.getElementById("revenueEndDate")

  if (!filterSelect || !monthInput || !yearSelect || !startInput || !endInput) return

  const now = new Date()
  const currentYear = now.getFullYear()
  monthInput.value = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`

  yearSelect.innerHTML = ""
  for (let y = currentYear + 1; y >= currentYear - 6; y -= 1) {
    yearSelect.innerHTML += `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`
  }

  const refreshRevenue = () => {
    const mode = filterSelect.value
    monthInput.disabled = mode !== "month"
    yearSelect.disabled = mode !== "year"

    const disableDateRange = mode === "all"
    startInput.disabled = disableDateRange
    endInput.disabled = disableDateRange

    updateRevenue()
  }

  filterSelect.addEventListener("change", refreshRevenue)
  monthInput.addEventListener("change", refreshRevenue)
  yearSelect.addEventListener("change", refreshRevenue)
  startInput.addEventListener("change", refreshRevenue)
  endInput.addEventListener("change", refreshRevenue)

  refreshRevenue()
}

function setupScheduleFilterActions() {
  window.toggleScopedInputs = (barberId) => {
    const scope = document.getElementById(`schedule-scope-${barberId}`)?.value || "day"

    const dayWrap = document.getElementById(`scope-day-wrap-${barberId}`)
    const weekWrap = document.getElementById(`scope-week-wrap-${barberId}`)
    const monthWrap = document.getElementById(`scope-month-wrap-${barberId}`)

    if (dayWrap) dayWrap.classList.toggle("hidden", scope !== "day")
    if (weekWrap) weekWrap.classList.toggle("hidden", scope !== "week")
    if (monthWrap) monthWrap.classList.toggle("hidden", scope !== "month")
  }
}

function filterBarbers(entries) {
  const nameQ = normalize(document.getElementById("barberSearchName")?.value)
  const emailQ = normalize(document.getElementById("barberSearchEmail")?.value)
  const phoneQ = normalize(document.getElementById("barberSearchPhone")?.value)
  const specQ = normalize(document.getElementById("barberSearchSpecialty")?.value)

  return entries.filter(([, barber]) => {
    const name = normalize(barber.name)
    const email = normalize(barber.email)
    const phone = normalize(barber.phone)
    const specialty = normalize(barber.specialty)

    if (nameQ && !name.includes(nameQ)) return false
    if (emailQ && !email.includes(emailQ)) return false
    if (phoneQ && !phone.includes(phoneQ)) return false
    if (specQ && !specialty.includes(specQ)) return false
    return true
  })
}

function filterClients(entries) {
  const query = normalize(document.getElementById("clientSearch")?.value)
  const createdFrom = document.getElementById("clientCreatedFrom")?.value || ""
  const createdTo = document.getElementById("clientCreatedTo")?.value || ""

  return entries.filter(([, client]) => {
    const name = normalize(client.name)
    const email = normalize(client.email)
    const phone = normalize(client.phone)
    const createdAt = String(client.createdAt || "").split("T")[0]

    const matchesQuery = !query || name.includes(query) || email.includes(query) || phone.includes(query)
    if (!matchesQuery) return false

    if ((createdFrom || createdTo) && !isDateBetween(createdAt, createdFrom, createdTo)) {
      return false
    }

    return true
  })
}

function filterBookings(entries) {
  const nameQ = normalize(document.getElementById("bookingSearchClientName")?.value)
  const emailQ = normalize(document.getElementById("bookingSearchClientEmail")?.value)
  const phoneQ = normalize(document.getElementById("bookingSearchClientPhone")?.value)
  const serviceQ = normalize(document.getElementById("bookingSearchService")?.value)
  const barberQ = normalize(document.getElementById("bookingSearchBarber")?.value)
  const dateStart = document.getElementById("bookingDateStart")?.value || ""
  const dateEnd = document.getElementById("bookingDateEnd")?.value || ""

  return entries.filter(([, booking]) => {
    if (nameQ && !normalize(booking.clientName).includes(nameQ)) return false
    if (emailQ && !normalize(booking.clientEmail).includes(emailQ)) return false
    if (phoneQ && !normalize(booking.clientPhone || booking.clientPhoneComplete).includes(phoneQ)) return false

    const serviceLabel = normalize(booking.serviceName || SERVICE_NAMES[booking.service] || booking.service)
    if (serviceQ && !serviceLabel.includes(serviceQ)) return false

    const barberName = normalize(booking.barberName || state.barbers[booking.barberId]?.name)
    if (barberQ && !barberName.includes(barberQ)) return false

    if ((dateStart || dateEnd) && !isDateBetween(booking.date, dateStart, dateEnd)) return false

    return true
  })
}

function getLifecycleLabel(booking) {
  if (booking.status === "cancelled") return "Concluida: Anulada"
  if (booking.status === "cancel_requested") return "Cancelamento Pendente"
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

function formatCreatedAt(iso) {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-PT")
}

function renderBarbers() {
  const container = document.getElementById("barbersList")
  if (!container) return

  const entries = filterBarbers(Object.entries(state.barbers))

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhum barbeiro encontrado</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, barber]) => {
      const workingDaysDisplay = (barber.workingDays || [1, 2, 3, 4, 5]).map((d) => DAY_NAMES[d]).join(", ")
      return `
        <div class="barber-item">
          <div>
            <h3>${barber.name || "Barbeiro"}</h3>
            <p><strong>Email:</strong> ${barber.email || "-"}</p>
            <p><strong>Telefone:</strong> ${barber.phone || "-"}</p>
            <p><strong>Especialidade:</strong> ${barber.specialty || "-"}</p>
            <p><strong>Horario:</strong> ${barber.workingHours?.start || "09:00"} - ${barber.workingHours?.end || "19:00"}</p>
            <p><strong>Dias:</strong> ${workingDaysDisplay}</p>
          </div>
          <button class="btn btn-danger" onclick="deleteBarber('${id}')">Eliminar</button>
        </div>
      `
    })
    .join("")
}

function renderClients() {
  const container = document.getElementById("clientsList")
  if (!container) return

  const entries = filterClients(Object.entries(state.clients))

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
            <p><strong>Criado em:</strong> ${formatCreatedAt(client.createdAt)}</p>
          </div>
          <button class="btn btn-danger" onclick="deleteClient('${id}')">Eliminar</button>
        </div>
      `,
    )
    .join("")
}

function renderBookings() {
  const container = document.getElementById("allBookingsList")
  if (!container) return

  const entries = filterBookings(Object.entries(state.bookings)).sort((a, b) => {
    const left = `${a[1].date || ""} ${a[1].time || ""}`
    const right = `${b[1].date || ""} ${b[1].time || ""}`
    return right.localeCompare(left)
  })

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhuma marcacao encontrada</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, booking]) => {
      const barberName = booking.barberName || state.barbers[booking.barberId]?.name || "N/A"
      const lifecycle = getLifecycleLabel(booking)
      const execution = getExecutionLabel(booking)
      const executionStatus = getExecutionStatus(booking)

      return `
        <div class="booking-item booking-item-extended">
          <div>
            <h3>${booking.clientName || "Cliente"}</h3>
            <div class="booking-meta-grid">
              <p><strong>Email:</strong> ${booking.clientEmail || "-"}</p>
              <p><strong>Telefone:</strong> ${booking.clientPhone || booking.clientPhoneComplete || "-"}</p>
              <p><strong>Servico:</strong> ${booking.serviceName || SERVICE_NAMES[booking.service] || "-"} (${SERVICE_DURATION[booking.service] || "-"} min)</p>
              <p><strong>Barbeiro:</strong> ${barberName}</p>
              <p><strong>Data:</strong> ${booking.date ? formatDate(booking.date) : "-"}</p>
              <p><strong>Horario:</strong> ${booking.time || "-"}</p>
            </div>
            <div class="status-row">
              <span class="status-pill ${booking.status === "cancelled" ? "is-cancelled" : booking.status === "cancel_requested" ? "is-warning" : "is-active"}">${lifecycle}</span>
              <span class="status-pill ${executionStatus === "completed" ? "is-completed" : executionStatus === "in_progress" ? "is-progress" : "is-pending"}">${execution}</span>
            </div>
          </div>
          <div class="booking-actions">
            <button class="btn btn-secondary btn-small" onclick="editBooking('${id}')">Editar</button>
            <select class="inline-select" onchange="setExecutionStatus('${id}', this.value)">
              <option value="pending" ${executionStatus === "pending" ? "selected" : ""}>Nao concluida</option>
              <option value="in_progress" ${executionStatus === "in_progress" ? "selected" : ""}>A ser concluida</option>
              <option value="completed" ${executionStatus === "completed" ? "selected" : ""}>Concluida</option>
            </select>
            ${booking.status === "cancel_requested" ? `<button class="btn btn-primary btn-small" onclick="approveCancellation('${id}')">Aprovar cancelamento</button>` : ""}
            <button class="btn btn-danger btn-small" onclick="deleteBooking('${id}')">Cancelar</button>
          </div>
        </div>
      `
    })
    .join("")
}

function renderSchedules() {
  const container = document.getElementById("schedulesBarbersList")
  if (!container) return

  const entries = filterBarbers(Object.entries(state.barbers))

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Nenhum barbeiro encontrado</div>'
    return
  }

  container.innerHTML = entries
    .map(([id, barber]) => {
      const startTime = barber.workingHours?.start || "09:00"
      const endTime = barber.workingHours?.end || "19:00"
      const workingDays = barber.workingDays || [1, 2, 3, 4, 5]
      const checkedDays = DAY_NAMES.map((name, index) => {
        const checked = workingDays.includes(index) ? "checked" : ""
        return `<label class="day-checkbox"><input type="checkbox" value="${index}" ${checked}> ${name}</label>`
      }).join("")

      const specialStart = barber.specialSchedules?.default?.start || startTime
      const specialEnd = barber.specialSchedules?.default?.end || endTime

      return `
        <div class="schedule-item">
          <h3>${barber.name || "Barbeiro"}</h3>
          <div class="schedule-controls">
            <div class="form-group">
              <label>Inicio padrao</label>
              ${buildTimePicker(`schedule-start-${id}`, startTime)}
            </div>
            <div class="form-group">
              <label>Fim padrao</label>
              ${buildTimePicker(`schedule-end-${id}`, endTime)}
            </div>
            <button class="btn-save" onclick="saveSchedule('${id}')">Guardar padrao</button>
          </div>

          <div style="margin-top: 1rem;" id="schedule-days-${id}" class="working-days-grid">
            ${checkedDays}
          </div>

          <div class="scoped-schedule">
            <h4>Horario especifico</h4>
            <div class="schedule-controls">
              <div class="form-group">
                <label>Aplicar a</label>
                <select id="schedule-scope-${id}" class="inline-select" onchange="toggleScopedInputs('${id}')">
                  <option value="day">Dia especifico</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                </select>
              </div>
              <div class="form-group" id="scope-day-wrap-${id}">
                <label>Data</label>
                <input type="date" id="scope-day-${id}">
              </div>
              <div class="form-group hidden" id="scope-week-wrap-${id}">
                <label>Semana</label>
                <input type="week" id="scope-week-${id}">
              </div>
              <div class="form-group hidden" id="scope-month-wrap-${id}">
                <label>Mes</label>
                <input type="month" id="scope-month-${id}">
              </div>
              <div class="form-group">
                <label>Inicio</label>
                ${buildTimePicker(`scope-start-${id}`, specialStart)}
              </div>
              <div class="form-group">
                <label>Fim</label>
                ${buildTimePicker(`scope-end-${id}`, specialEnd)}
              </div>
              <button class="btn btn-primary btn-small" onclick="saveScopedSchedule('${id}')">Guardar especifico</button>
            </div>
          </div>
        </div>
      `
    })
    .join("")
}

function getRevenueBookings() {
  const filter = document.getElementById("revenueFilter")?.value || "all"
  const selectedMonth = document.getElementById("revenueMonth")?.value || ""
  const selectedYear = Number(document.getElementById("revenueYear")?.value || new Date().getFullYear())
  const startDate = document.getElementById("revenueStartDate")?.value || ""
  const endDate = document.getElementById("revenueEndDate")?.value || ""

  return Object.entries(state.bookings)
    .map(([id, booking]) => ({ id, ...booking }))
    .filter((booking) => booking.status !== "cancelled")
    .filter((booking) => {
      const bookingDate = toDateOnly(booking.date)
      if (!bookingDate) return false

      if (filter === "all") return true

      if (filter === "day-range") {
        return isDateBetween(booking.date, startDate, endDate)
      }

      if (filter === "month") {
        if (!selectedMonth) return false
        const [year, month] = selectedMonth.split("-").map(Number)
        if (bookingDate.getFullYear() !== year || bookingDate.getMonth() + 1 !== month) return false
        if (!startDate && !endDate) return true
        return isDateBetween(booking.date, startDate, endDate)
      }

      if (filter === "year") {
        if (bookingDate.getFullYear() !== selectedYear) return false
        if (!startDate && !endDate) return true
        return isDateBetween(booking.date, startDate, endDate)
      }

      return true
    })
}

function updateRevenue() {
  const summaryContainer = document.getElementById("revenueSummary")
  const detailsContainer = document.getElementById("revenueDetails")
  const filter = document.getElementById("revenueFilter")?.value || "all"

  if (!summaryContainer || !detailsContainer) return

  const filteredBookings = getRevenueBookings()
  if (!filteredBookings.length) {
    summaryContainer.innerHTML = ""
    detailsContainer.innerHTML = '<div class="empty-state">Nenhuma marcacao encontrada</div>'
    return
  }

  let totalRevenue = 0
  const revenueByBarber = {}
  const revenueByService = {}

  filteredBookings.forEach((booking) => {
    const price = Number(booking.servicePrice || SERVICE_PRICES[booking.service] || 0)
    totalRevenue += price

    const barberName = booking.barberName || state.barbers[booking.barberId]?.name || "Desconhecido"
    revenueByBarber[barberName] = (revenueByBarber[barberName] || 0) + price

    const serviceLabel = booking.serviceName || SERVICE_NAMES[booking.service] || booking.service || "Outro"
    revenueByService[serviceLabel] = (revenueByService[serviceLabel] || 0) + price
  })

  const totalBookings = filteredBookings.length
  const filterLabel =
    filter === "day-range"
      ? "no Periodo de Dias"
      : filter === "month"
        ? "no Periodo Mensal"
        : filter === "year"
          ? "no Ano"
          : "Total"

  summaryContainer.innerHTML = `
    <div class="revenue-card">
      <h3>Faturamento ${filterLabel}</h3>
      <div class="revenue-value success">${totalRevenue.toFixed(2)}EUR</div>
    </div>
    <div class="revenue-card">
      <h3>Marcacoes ${filterLabel}</h3>
      <div class="revenue-value">${totalBookings}</div>
    </div>
    <div class="revenue-card">
      <h3>Media por Marcacao</h3>
      <div class="revenue-value">${(totalRevenue / totalBookings).toFixed(2)}EUR</div>
    </div>
  `

  let details = '<h3 style="color: var(--color-text-primary); margin-bottom: 1rem;">Faturamento por Barbeiro</h3>'
  Object.entries(revenueByBarber)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => {
      details += `
        <div class="barber-item">
          <div><h3>${name}</h3></div>
          <div style="text-align: right;"><p style="font-size: 1.2rem; font-weight: 800; color: var(--color-success);">${value.toFixed(2)}EUR</p></div>
        </div>
      `
    })

  details += '<h3 style="color: var(--color-text-primary); margin: 1.5rem 0 1rem;">Faturamento por Servico</h3>'
  Object.entries(revenueByService)
    .sort((a, b) => b[1] - a[1])
    .forEach(([service, value]) => {
      details += `
        <div class="barber-item">
          <div><h3>${service}</h3></div>
          <div style="text-align: right;"><p style="font-size: 1.2rem; font-weight: 800; color: var(--color-accent);">${value.toFixed(2)}EUR</p></div>
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
    renderSchedules()
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
  if (!confirm("Tem certeza que deseja eliminar este cliente? As marcacoes associadas serao mantidas.")) return

  try {
    await remove(ref(database, `clients/${id}`))
    showSuccess("Cliente eliminado com sucesso!")
  } catch (error) {
    showError("Erro ao eliminar cliente: " + error.message)
  }
}

window.deleteBooking = async (id) => {
  if (!confirm("Tem certeza que deseja cancelar esta marcacao?")) return

  const bookingRef = ref(database, `bookings/${id}`)

  try {
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcacao nao encontrada.")
      return
    }

    const booking = snapshot.val()
    await set(bookingRef, {
      ...booking,
      status: "cancelled",
      cancelledBy: "admin",
      cancelledAt: new Date().toISOString(),
    })

    showSuccess("Marcacao cancelada com sucesso!")
  } catch (error) {
    showError("Erro ao cancelar marcacao: " + error.message)
  }
}

window.approveCancellation = async (id) => {
  const bookingRef = ref(database, `bookings/${id}`)
  try {
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcacao nao encontrada.")
      return
    }

    const booking = snapshot.val()
    await set(bookingRef, {
      ...booking,
      status: "cancelled",
      cancellationApproved: true,
      cancellationApprovedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
      cancelledBy: "admin",
    })

    showSuccess("Cancelamento aprovado.")
  } catch (error) {
    showError("Erro ao aprovar cancelamento: " + error.message)
  }
}

window.editBooking = async (id) => {
  const bookingRef = ref(database, `bookings/${id}`)

  try {
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcacao nao encontrada.")
      return
    }

    const booking = snapshot.val()
    if (booking.status === "cancelled") {
      showError("Nao e possivel editar uma marcacao anulada.")
      return
    }

    const newDate = window.prompt("Nova data (AAAA-MM-DD)", booking.date || "")
    if (!newDate) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      showError("Formato de data invalido. Use AAAA-MM-DD.")
      return
    }

    const newTime = window.prompt("Novo horario (HH:MM)", booking.time || "")
    if (!newTime) return
    if (!/^\d{2}:\d{2}$/.test(newTime)) {
      showError("Formato de horario invalido. Use HH:MM.")
      return
    }

    await set(bookingRef, {
      ...booking,
      date: newDate,
      time: newTime,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    })

    showSuccess("Marcacao editada com sucesso!")
  } catch (error) {
    showError("Erro ao editar marcacao: " + error.message)
  }
}

window.setExecutionStatus = async (id, newStatus) => {
  const bookingRef = ref(database, `bookings/${id}`)

  try {
    const snapshot = await get(bookingRef)
    if (!snapshot.exists()) {
      showError("Marcacao nao encontrada.")
      return
    }

    const booking = snapshot.val()
    const patch = {
      ...booking,
      executionStatus: newStatus,
      updatedAt: new Date().toISOString(),
    }

    if (newStatus === "in_progress" && !booking.startedAt) {
      patch.startedAt = new Date().toISOString()
    }

    if (newStatus === "completed") {
      patch.completedAt = new Date().toISOString()
    }

    await set(bookingRef, patch)
    showSuccess("Estado da marcacao atualizado.")
  } catch (error) {
    showError("Erro ao atualizar estado: " + error.message)
  }
}

window.saveSchedule = async (barberId) => {
  const startTime = composeTime(`schedule-start-${barberId}-hour`, `schedule-start-${barberId}-minute`)
  const endTime = composeTime(`schedule-end-${barberId}-hour`, `schedule-end-${barberId}-minute`)

  const daysContainer = document.getElementById(`schedule-days-${barberId}`)
  const checkedDays = Array.from(daysContainer.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => Number(cb.value))

  if (!startTime || !endTime) {
    showError("Defina o horario de inicio e fim.")
    return
  }

  if (!checkedDays.length) {
    showError("Selecione pelo menos um dia de trabalho.")
    return
  }

  try {
    const barberSnapshot = await get(ref(database, `barbers/${barberId}`))
    if (!barberSnapshot.exists()) {
      showError("Barbeiro nao encontrado.")
      return
    }

    const barber = barberSnapshot.val()
    await set(ref(database, `barbers/${barberId}`), {
      ...barber,
      workingHours: { start: startTime, end: endTime },
      workingDays: checkedDays,
      updatedAt: new Date().toISOString(),
    })

    showSuccess("Horario padrao atualizado com sucesso!")
  } catch (error) {
    showError("Erro ao atualizar horario: " + error.message)
  }
}

window.saveScopedSchedule = async (barberId) => {
  const scope = document.getElementById(`schedule-scope-${barberId}`)?.value || "day"
  const start = composeTime(`scope-start-${barberId}-hour`, `scope-start-${barberId}-minute`)
  const end = composeTime(`scope-end-${barberId}-hour`, `scope-end-${barberId}-minute`)

  let key = ""
  if (scope === "day") key = document.getElementById(`scope-day-${barberId}`)?.value || ""
  if (scope === "week") key = document.getElementById(`scope-week-${barberId}`)?.value || ""
  if (scope === "month") key = document.getElementById(`scope-month-${barberId}`)?.value || ""

  if (!key) {
    showError("Selecione o periodo para aplicar o horario especifico.")
    return
  }

  try {
    const barberSnapshot = await get(ref(database, `barbers/${barberId}`))
    if (!barberSnapshot.exists()) {
      showError("Barbeiro nao encontrado.")
      return
    }

    const barber = barberSnapshot.val()
    const scoped = barber.specialSchedules || {}
    const scopedType = scoped[scope] || {}

    scopedType[key] = {
      start,
      end,
      createdAt: new Date().toISOString(),
    }

    await set(ref(database, `barbers/${barberId}`), {
      ...barber,
      specialSchedules: {
        ...scoped,
        [scope]: scopedType,
      },
      updatedAt: new Date().toISOString(),
    })

    showSuccess("Horario especifico guardado com sucesso!")
  } catch (error) {
    showError("Erro ao guardar horario especifico: " + error.message)
  }
}

setupPhoneValidation("barberPhone")

document.getElementById("barberForm").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("barberEmail").value
  const phone = document.getElementById("barberPhone").value
  const password = document.getElementById("barberPassword").value

  if (!validatePhoneNumber(phone)) {
    showError("Numero de telefone invalido. Use 9 digitos comecando com 9.")
    return
  }

  if (!password || password.length < 6) {
    showError("A senha deve ter pelo menos 6 caracteres.")
    return
  }

  const startTime = composeTime("barberStartHour", "barberStartMinute")
  const endTime = composeTime("barberEndHour", "barberEndMinute")

  const workingDaysCheckboxes = document.querySelectorAll('#barberWorkingDays input[type="checkbox"]:checked')
  const workingDays = Array.from(workingDaysCheckboxes).map((cb) => Number(cb.value))

  if (!workingDays.length) {
    showError("Selecione pelo menos um dia de trabalho.")
    return
  }

  try {
    const barberCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const barberUid = barberCredential.user.uid

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

    await set(ref(database, `barbers/${barberUid}`), newBarber)

    const userDoc = {
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
    }

    await setDoc(doc(firestore, "users", barberUid), userDoc)
    await signOut(secondaryAuth)

    e.target.reset()
    setupStaticTimeSelects()
    showSuccess("Barbeiro adicionado com sucesso!")
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      showError("Este email ja esta registado no Firebase Auth.")
    } else {
      showError("Erro ao adicionar barbeiro: " + error.message)
    }
  }
})

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    sessionStorage.clear()
    window.location.href = "admin-login.html"
    return
  }

  const allowed = await verifyAdminAccess(user)
  if (!allowed) return

  setupTopTabs()
  setupBarberSubTabs()
  setupStaticTimeSelects()
  setupFilterListeners()
  setupRevenueControls()
  setupScheduleFilterActions()

  loadBarbers()
  loadBookings()
  loadClients()
})

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).finally(() => {
    sessionStorage.clear()
    window.location.href = "index.html"
  })
})
