import { auth, database } from "./firebase-config.js"
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
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

// Logout
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

  if (filteredBookings.length === 0) {
    container.innerHTML = `
      <div class="no-appointments">
        <p>📅 Não há marcações para esta data</p>
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
      </div>
      <div class="appointment-service">
        ${formatServiceName(booking.service)}
      </div>
    </div>
  `).join('')
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
