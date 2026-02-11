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

    // Obter dias de trabalho selecionados
    const workingDaysCheckboxes = document.querySelectorAll('#barberWorkingDays input[type="checkbox"]:checked')
    const workingDays = Array.from(workingDaysCheckboxes).map(cb => parseInt(cb.value))

    if (workingDays.length === 0) {
      showError("Selecione pelo menos um dia de trabalho.")
      return
    }

    const newBarber = {
      name: document.getElementById("barberName").value,
      email,
      phone: formatPhoneNumber(phone),
      specialty: document.getElementById("barberSpecialty").value,
      workingHours: {
        start: startTime,
        end: endTime
      },
      workingDays: workingDays,
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
        ([id, barber]) => {
          const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          const workingDaysDisplay = barber.workingDays 
            ? barber.workingDays.map(d => dayNames[d]).join(', ')
            : 'Seg-Sex'
          return `
        <div class="barber-item">
          <div>
            <h3>${barber.name}</h3>
            <p><strong>Email:</strong> ${barber.email}</p>
            <p><strong>Telefone:</strong> ${barber.phone}</p>
            ${barber.specialty ? `<p><strong>Especialidade:</strong> ${barber.specialty}</p>` : ""}
            ${barber.workingHours ? `<p><strong>Horário:</strong> ${barber.workingHours.start} - ${barber.workingHours.end}</p>` : ""}
            <p><strong>Dias:</strong> ${workingDaysDisplay}</p>
          </div>
          <button class="btn btn-danger" onclick="deleteBarber('${id}')">Eliminar</button>
        </div>
      `}
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
loadSchedules()
loadRevenue()

// ===== GESTÃO DE HORÁRIOS =====
function loadSchedules() {
  const barbersRef = ref(database, "barbers")

  onValue(barbersRef, (snapshot) => {
    const container = document.getElementById("schedulesBarbersList")

    if (!container) return

    if (!snapshot.exists()) {
      container.innerHTML = '<div class="empty-state">Nenhum barbeiro registado</div>'
      return
    }

    const barbers = snapshot.val()
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    container.innerHTML = Object.entries(barbers)
      .map(([id, barber]) => {
        const startTime = barber.workingHours ? barber.workingHours.start : '09:00'
        const endTime = barber.workingHours ? barber.workingHours.end : '19:00'
        const workingDays = barber.workingDays || [1, 2, 3, 4, 5]

        const daysCheckboxes = dayNames.map((name, index) => {
          const checked = workingDays.includes(index) ? 'checked' : ''
          return `<label class="day-checkbox"><input type="checkbox" value="${index}" ${checked} data-barber="${id}"> ${name}</label>`
        }).join('')

        return `
          <div class="schedule-item">
            <h3>📅 ${barber.name}</h3>
            <div class="schedule-controls">
              <div class="form-group">
                <label>Início</label>
                <input type="time" id="schedule-start-${id}" value="${startTime}">
              </div>
              <div class="form-group">
                <label>Fim</label>
                <input type="time" id="schedule-end-${id}" value="${endTime}">
              </div>
              <button class="btn-save" onclick="saveSchedule('${id}')">💾 Guardar</button>
            </div>
            <div style="margin-top: 1rem;">
              <label style="color: var(--color-text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Dias de trabalho:</label>
              <div class="working-days-grid" id="schedule-days-${id}">
                ${daysCheckboxes}
              </div>
            </div>
          </div>
        `
      })
      .join("")
  })
}

window.saveSchedule = async (barberId) => {
  const startTime = document.getElementById(`schedule-start-${barberId}`).value
  const endTime = document.getElementById(`schedule-end-${barberId}`).value
  const daysContainer = document.getElementById(`schedule-days-${barberId}`)
  const checkedDays = Array.from(daysContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value))

  if (checkedDays.length === 0) {
    showError("Selecione pelo menos um dia de trabalho.")
    return
  }

  if (!startTime || !endTime) {
    showError("Defina o horário de início e fim.")
    return
  }

  try {
    const updates = {}
    updates[`barbers/${barberId}/workingHours`] = { start: startTime, end: endTime }
    updates[`barbers/${barberId}/workingDays`] = checkedDays

    const barberHoursRef = ref(database, `barbers/${barberId}/workingHours`)
    await set(barberHoursRef, { start: startTime, end: endTime })

    const barberDaysRef = ref(database, `barbers/${barberId}/workingDays`)
    await set(barberDaysRef, checkedDays)

    showSuccess("Horário atualizado com sucesso!")
  } catch (error) {
    showError("Erro ao atualizar horário: " + error.message)
  }
}

// ===== FATURAMENTO =====
const SERVICE_PRICES = {
  corte: 15,
  barba: 10,
  "corte-barba": 22,
  sobrancelha: 5,
  completo: 35,
}

function loadRevenue() {
  const filterSelect = document.getElementById("revenueFilter")
  const monthInput = document.getElementById("revenueMonth")

  if (!filterSelect) return

  // Definir mês atual como padrão
  const now = new Date()
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  filterSelect.addEventListener("change", () => updateRevenue())
  monthInput.addEventListener("change", () => updateRevenue())

  updateRevenue()
}

function updateRevenue() {
  const bookingsRef = ref(database, "bookings")
  const barbersRef = ref(database, "barbers")

  onValue(bookingsRef, async (bookingsSnapshot) => {
    const summaryContainer = document.getElementById("revenueSummary")
    const detailsContainer = document.getElementById("revenueDetails")

    if (!summaryContainer || !detailsContainer) return

    const filter = document.getElementById("revenueFilter").value
    const selectedMonth = document.getElementById("revenueMonth").value

    if (!bookingsSnapshot.exists()) {
      summaryContainer.innerHTML = ''
      detailsContainer.innerHTML = '<div class="empty-state">Nenhuma marcação encontrada</div>'
      return
    }

    const barbersSnapshot = await get(barbersRef)
    const barbers = barbersSnapshot.exists() ? barbersSnapshot.val() : {}

    const allBookings = bookingsSnapshot.val()
    const now = new Date()
    let filteredBookings = []

    Object.entries(allBookings).forEach(([id, booking]) => {
      const bookingDate = new Date(booking.date)
      let include = false

      if (filter === "month") {
        if (selectedMonth) {
          const [y, m] = selectedMonth.split('-').map(Number)
          include = bookingDate.getFullYear() === y && (bookingDate.getMonth() + 1) === m
        } else {
          include = bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear()
        }
      } else if (filter === "year") {
        include = bookingDate.getFullYear() === now.getFullYear()
      } else {
        include = true
      }

      if (include) {
        filteredBookings.push({ id, ...booking })
      }
    })

    // Calcular totais
    let totalRevenue = 0
    let totalBookings = filteredBookings.length
    const revenueByBarber = {}
    const revenueByService = {}

    filteredBookings.forEach(booking => {
      const price = booking.servicePrice || SERVICE_PRICES[booking.service] || 0
      totalRevenue += price

      const barberName = booking.barberName || (barbers[booking.barberId] ? barbers[booking.barberId].name : 'Desconhecido')
      revenueByBarber[barberName] = (revenueByBarber[barberName] || 0) + price

      const serviceName = booking.serviceName || booking.service
      revenueByService[serviceName] = (revenueByService[serviceName] || 0) + price
    })

    const filterLabel = filter === "month" ? "do Mês" : filter === "year" ? "do Ano" : "Total"

    summaryContainer.innerHTML = `
      <div class="revenue-card">
        <h3>💰 Faturamento ${filterLabel}</h3>
        <div class="revenue-value success">${totalRevenue}€</div>
      </div>
      <div class="revenue-card">
        <h3>📋 Marcações ${filterLabel}</h3>
        <div class="revenue-value">${totalBookings}</div>
      </div>
      <div class="revenue-card">
        <h3>📊 Média por Marcação</h3>
        <div class="revenue-value">${totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(1) : 0}€</div>
      </div>
    `

    // Detalhes por barbeiro
    let barberDetails = '<h3 style="color: var(--color-text-primary); margin-bottom: 1rem;">Faturamento por Barbeiro</h3>'
    Object.entries(revenueByBarber).sort((a, b) => b[1] - a[1]).forEach(([name, revenue]) => {
      const count = filteredBookings.filter(b => (b.barberName || (barbers[b.barberId] ? barbers[b.barberId].name : '')) === name).length
      barberDetails += `
        <div class="barber-item">
          <div>
            <h3>${name}</h3>
            <p><strong>Marcações:</strong> ${count}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 1.5rem; font-weight: 800; color: var(--color-success);">${revenue}€</p>
          </div>
        </div>
      `
    })

    // Detalhes por serviço
    barberDetails += '<h3 style="color: var(--color-text-primary); margin: 1.5rem 0 1rem;">Faturamento por Serviço</h3>'
    const serviceDisplayNames = {
      corte: "Corte de Cabelo",
      barba: "Barba",
      "corte-barba": "Corte + Barba",
      sobrancelha: "Sobrancelha",
      completo: "Pacote Completo",
    }
    Object.entries(revenueByService).sort((a, b) => b[1] - a[1]).forEach(([service, revenue]) => {
      const displayName = serviceDisplayNames[service] || service
      const count = filteredBookings.filter(b => (b.serviceName || b.service) === service).length
      barberDetails += `
        <div class="barber-item">
          <div>
            <h3>${displayName}</h3>
            <p><strong>Quantidade:</strong> ${count}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 1.5rem; font-weight: 800; color: var(--color-accent);">${revenue}€</p>
          </div>
        </div>
      `
    })

    detailsContainer.innerHTML = barberDetails
  }, { onlyOnce: true })
}
