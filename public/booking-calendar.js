import { auth, database } from "./firebase-config.js"
import { ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

const isBarberSession = sessionStorage.getItem("isBarber") === "true"
if (isBarberSession) {
  window.location.href = "barber-panel.html"
}

const urlParams = new URLSearchParams(window.location.search)
const currentMode = urlParams.get('mode')
const isManageMode = currentMode === 'manage' || currentMode === 'cancel'
const isCancelMode = currentMode === 'cancel'

// Estado da marcação
const bookingState = {
  service: null,
  serviceName: '',
  servicePrice: 0,
  serviceDuration: 0,
  barber: null,
  barberName: '',
  barberWorkingHours: [],
  barberSpecialSchedules: { day: {}, week: {}, month: {} },
  barberWorkingDays: [1, 2, 3, 4, 5], // Seg-Sex por defeito
  date: null,
  time: null,
  client: null,
  clientName: null,
  clientEmail: null,
  clientUid: null,
  clientBookings: [],
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  availableSlots: {},
  bookings: []
}

// Horários de trabalho padrão (9h às 19h)
const defaultWorkingHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

// Função para gerar horários do barbeiro
function generateWorkingHours(startTime, endTime, stepMinutes = 30) {
  const slots = []
  const [startHour, startMinute] = String(startTime || '09:00').split(':').map(Number)
  const [endHour, endMinute] = String(endTime || '19:00').split(':').map(Number)

  let current = startHour * 60 + (startMinute || 0)
  const end = endHour * 60 + (endMinute || 0)

  if (Number.isNaN(current) || Number.isNaN(end) || current > end) {
    return defaultWorkingHours
  }

  while (current <= end) {
    const hour = Math.floor(current / 60)
    const minute = current % 60
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    current += stepMinutes
  }

  return slots
}

function getIsoWeekKey(dateStr) {
  const date = parseDateString(dateStr)
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getSpecialScheduleForDate(dateStr) {
  const special = bookingState.barberSpecialSchedules || {}

  const daySchedule = special.day?.[dateStr]
  if (daySchedule?.start && daySchedule?.end) return daySchedule

  const weekSchedule = special.week?.[getIsoWeekKey(dateStr)]
  if (weekSchedule?.start && weekSchedule?.end) return weekSchedule

  const monthSchedule = special.month?.[dateStr.slice(0, 7)]
  if (monthSchedule?.start && monthSchedule?.end) return monthSchedule

  return null
}

function getWorkingHoursForDate(dateStr) {
  const specialSchedule = getSpecialScheduleForDate(dateStr)
  if (specialSchedule) {
    return generateWorkingHours(specialSchedule.start, specialSchedule.end)
  }

  if (bookingState.barberWorkingHours.length > 0) {
    return bookingState.barberWorkingHours
  }

  return defaultWorkingHours
}

function getDateString(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}

function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isDateBeforeToday(dateStr) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const selectedDate = parseDateString(dateStr)
  return selectedDate < todayStart
}

function isPastTimeSlot(dateStr, timeStr) {
  const now = new Date()
  const todayStr = getDateString(now)

  if (dateStr !== todayStr) {
    return false
  }

  const [hour, minute] = timeStr.split(':').map(Number)
  const slotMinutes = hour * 60 + minute
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return slotMinutes <= nowMinutes
}

function showBookingSteps() {
  document.getElementById('step-manage-bookings')?.classList.add('hidden')
  document.getElementById('step-auth').classList.add('hidden')
  document.getElementById('step-services').classList.remove('hidden')
}

function showManageBookingsStep() {
  document.getElementById('step-services').classList.add('hidden')
  document.getElementById('step-barber').classList.add('hidden')
  document.getElementById('step-datetime').classList.add('hidden')
  document.getElementById('step-success').classList.add('hidden')
  document.getElementById('step-auth').classList.add('hidden')
  document.getElementById('step-manage-bookings').classList.remove('hidden')
}

function showAuthStep() {
  document.getElementById('step-manage-bookings')?.classList.add('hidden')
  document.getElementById('step-auth').classList.remove('hidden')
  document.getElementById('step-services').classList.add('hidden')
}

function handlePostAuthSuccess() {
  if (isManageMode) {
    showManageBookingsStep()
    loadClientBookings()
    return
  }
  showBookingSteps()
}

function initPageMode() {
  if (!isManageMode) return

  const authDescription = document.getElementById('authStepDescription')
  if (authDescription) {
    authDescription.textContent = isCancelMode
      ? 'Entre na sua conta para cancelar marcações existentes.'
      : 'Entre na sua conta para ver as suas marcações e poder adiar ou anular.'
  }

  const openRegisterLink = document.getElementById('openRegisterLink')
  if (openRegisterLink) {
    const registerPrompt = openRegisterLink.closest('p')
    if (registerPrompt) registerPrompt.classList.add('hidden')
  }

  const registerBox = document.getElementById('authRegisterBox')
  if (registerBox) {
    registerBox.classList.add('hidden')
  }
}

function applyClientProfile(user, clientData, fallbackEmail = '') {
  bookingState.clientUid = user.uid
  bookingState.clientName = clientData?.name || ''
  bookingState.clientEmail = clientData?.email || fallbackEmail || user.email || ''
  bookingState.clientPhoneComplete = clientData?.phone || ''
  bookingState.clientPhone = (clientData?.phone || '').replace(/^\+351/, '')
  bookingState.clientCountry = 'PT'
  bookingState.client = {
    name: bookingState.clientName,
    email: bookingState.clientEmail,
    phone: bookingState.clientPhone
  }
}

function initAutoClientSession() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()

      if (!user) {
        resolve(false)
        return
      }

      try {
        const clientSnapshot = await get(ref(database, `clients/${user.uid}`))
        if (!clientSnapshot.exists()) {
          resolve(false)
          return
        }

        applyClientProfile(user, clientSnapshot.val(), user.email || '')
        handlePostAuthSuccess()
        resolve(true)
      } catch (error) {
        console.error('Erro ao validar sessão de cliente:', error)
        resolve(false)
      }
    })
  })
}

function initClientAuth() {
  const loginBox = document.getElementById('authLoginBox')
  const registerBox = document.getElementById('authRegisterBox')
  const openRegisterLink = document.getElementById('openRegisterLink')
  const openLoginLink = document.getElementById('openLoginLink')
  const loginClientBtn = document.getElementById('loginClientBtn')
  const registerClientBtn = document.getElementById('registerClientBtn')

  if (!loginBox || !registerBox || !openRegisterLink || !openLoginLink || !loginClientBtn || !registerClientBtn) {
    return
  }

  if (isManageMode) {
    const loginPrompt = openRegisterLink.closest('p')
    if (loginPrompt) {
      loginPrompt.classList.add('hidden')
    }
  }

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('351')) return `+${digits}`
    return `+351${digits}`
  }

  const switchToRegister = () => {
    loginBox.classList.add('hidden')
    registerBox.classList.remove('hidden')
  }

  const switchToLogin = () => {
    registerBox.classList.add('hidden')
    loginBox.classList.remove('hidden')
  }

  openRegisterLink.addEventListener('click', (e) => {
    e.preventDefault()
    switchToRegister()
  })

  openLoginLink.addEventListener('click', (e) => {
    e.preventDefault()
    switchToLogin()
  })

  loginClientBtn.addEventListener('click', async () => {
    const email = document.getElementById('clientLoginEmail').value.trim()
    const password = document.getElementById('clientLoginPassword').value

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Indique um email válido.')
      return
    }

    if (!password || password.length < 6) {
      showError('Indique uma senha válida (mínimo 6 caracteres).')
      return
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const user = result.user
      const snap = await get(ref(database, `clients/${user.uid}`))

      if (!snap.exists()) {
        await signOut(auth)
        showError('Conta encontrada no login, mas sem perfil de cliente. Crie a conta novamente.')
        return
      }

      const clientData = snap.val()
      applyClientProfile(user, clientData, email)

      showSuccess('Login confirmado com sucesso.')
      handlePostAuthSuccess()
    } catch (error) {
      showError('Email ou senha inválidos.')
    }
  })

  registerClientBtn.addEventListener('click', async () => {
    const name = document.getElementById('clientRegisterName').value.trim()
    const email = document.getElementById('clientRegisterEmail').value.trim()
    const password = document.getElementById('clientRegisterPassword').value
    const phoneRaw = document.getElementById('clientRegisterPhone').value.trim()
    const phone = formatPhone(phoneRaw)

    if (!name || name.length < 3) {
      showError('Indique o seu nome completo.')
      return
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Indique um email válido.')
      return
    }

    if (!password || password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      const user = result.user

      const payload = {
        name,
        email,
        phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await set(ref(database, `clients/${user.uid}`), payload)

      bookingState.clientUid = user.uid
      bookingState.clientName = payload.name
      bookingState.clientEmail = payload.email
      bookingState.clientPhoneComplete = payload.phone
      bookingState.clientPhone = payload.phone.replace(/^\+351\s?/, '')
      bookingState.clientCountry = 'PT'
      bookingState.client = {
        name: bookingState.clientName,
        email: bookingState.clientEmail,
        phone: bookingState.clientPhone
      }

      showSuccess('Conta criada com sucesso.')
      handlePostAuthSuccess()
    } catch (error) {
      if (error?.code === 'auth/email-already-in-use') {
        showError('Este email já está registado. Faça login.')
        return
      }

      showError(`Não foi possível criar a conta: ${error.message || 'tente novamente.'}`)
    }
  })
}

function getTodayDateForInput() {
  return getDateString(new Date())
}

function getBookingById(bookingId) {
  return bookingState.clientBookings.find((booking) => booking.id === bookingId) || null
}

async function hasBookingConflict(barberId, date, time, bookingIdToIgnore) {
  const snapshot = await get(ref(database, 'bookings'))
  if (!snapshot.exists()) return false

  const allBookings = snapshot.val()
  return Object.entries(allBookings).some(([id, booking]) => {
    if (!booking || id === bookingIdToIgnore) return false
    if (booking.status === 'cancelled' || booking.status === 'expired') return false
    return booking.barberId === barberId && booking.date === date && booking.time === time
  })
}

function setManageBookingsStatus(text, variant = 'muted') {
  const statusEl = document.getElementById('manageBookingsStatus')
  if (!statusEl) return

  statusEl.textContent = text
  statusEl.classList.remove('is-muted', 'is-success', 'is-error')
  statusEl.classList.add(`is-${variant}`)
}

function renderClientBookings() {
  const listEl = document.getElementById('clientBookingsList')
  if (!listEl) return

  if (bookingState.clientBookings.length === 0) {
    listEl.innerHTML = ''
    setManageBookingsStatus('Não existem marcações associadas a esta conta.', 'muted')
    return
  }

  setManageBookingsStatus('Selecione uma marcação para adiar ou anular.', 'success')
  if (isCancelMode) {
    setManageBookingsStatus('Selecione uma marcação para anular.', 'success')
  }
  listEl.innerHTML = bookingState.clientBookings.map((booking) => {
    const statusLabel = booking.status === 'expired' ? 'Expirada' : booking.status === 'cancelled' ? 'Anulada' : 'Confirmada'
    const isCancelled = booking.status === 'cancelled' || booking.status === 'expired'
    const safeDate = booking.date || ''
    const safeTime = booking.time || ''
    return `
      <div class="client-booking-card ${isCancelled ? 'is-cancelled' : ''}" data-booking-id="${booking.id}">
        <div class="client-booking-main">
          <h3>${booking.serviceName || 'Serviço'}</h3>
          <p><strong>Barbeiro:</strong> ${booking.barberName || '-'}</p>
          <p><strong>Data:</strong> ${formatDateForDisplay(safeDate)}</p>
          <p><strong>Hora:</strong> ${safeTime || '-'}</p>
          <p><strong>Estado:</strong> ${statusLabel}</p>
        </div>
        ${isCancelled ? '' : `
          <div class="client-booking-actions">
            ${isCancelMode ? '' : `<button type="button" class="btn btn-secondary manage-reschedule-btn" data-booking-id="${booking.id}">Adiar</button>`}
            <button type="button" class="btn btn-primary manage-cancel-btn" data-booking-id="${booking.id}">Anular</button>
          </div>
          <div class="manage-reschedule-panel ${isCancelMode ? 'hidden' : 'hidden'}" id="reschedule-panel-${booking.id}">
            <div class="form-group" style="margin-bottom: 0.8rem;">
              <label for="reschedule-date-${booking.id}">Nova Data</label>
              <input type="date" id="reschedule-date-${booking.id}" value="${safeDate}" min="${getTodayDateForInput()}">
            </div>
            <div class="form-group" style="margin-bottom: 0.8rem;">
              <label for="reschedule-time-${booking.id}">Nova Hora</label>
              <select id="reschedule-time-${booking.id}">
                ${defaultWorkingHours.map((slot) => `<option value="${slot}" ${slot === safeTime ? 'selected' : ''}>${slot}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn btn-primary save-reschedule-btn" data-booking-id="${booking.id}">Guardar Nova Data</button>
          </div>
        `}
      </div>
    `
  }).join('')

  if (!isCancelMode) {
    listEl.querySelectorAll('.manage-reschedule-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bookingId = btn.dataset.bookingId
        const panel = document.getElementById(`reschedule-panel-${bookingId}`)
        if (panel) panel.classList.toggle('hidden')
      })
    })
  }

  if (!isCancelMode) {
    listEl.querySelectorAll('.save-reschedule-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookingId = btn.dataset.bookingId
        await rescheduleBooking(bookingId)
      })
    })
  }

  listEl.querySelectorAll('.manage-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookingId = btn.dataset.bookingId
      await cancelBookingByClient(bookingId)
    })
  })
}

async function loadClientBookings() {
  if (!auth.currentUser) {
    showError('Faça login para gerir as suas marcações.')
    showAuthStep()
    return
  }

  setManageBookingsStatus('A carregar marcações...', 'muted')
  bookingState.clientBookings = []

  try {
    const snapshot = await get(ref(database, 'bookings'))
    if (!snapshot.exists()) {
      renderClientBookings()
      return
    }

    const allBookings = snapshot.val()
    bookingState.clientBookings = Object.entries(allBookings)
      .map(([id, booking]) => ({ id, ...booking }))
      .filter((booking) => booking.clientUid === auth.currentUser.uid)
      .sort((a, b) => {
        const left = `${a.date || ''} ${a.time || ''}`
        const right = `${b.date || ''} ${b.time || ''}`
        return left.localeCompare(right)
      })

    renderClientBookings()
  } catch (error) {
    setManageBookingsStatus('Erro ao carregar as suas marcações.', 'error')
    showError('Não foi possível carregar as marcações da sua conta.')
  }
}

async function rescheduleBooking(bookingId) {
  const booking = getBookingById(bookingId)
  if (!booking) {
    showError('Marcação não encontrada.')
    return
  }

  const dateInput = document.getElementById(`reschedule-date-${bookingId}`)
  const timeSelect = document.getElementById(`reschedule-time-${bookingId}`)
  if (!dateInput || !timeSelect) return

  const newDate = dateInput.value
  const newTime = timeSelect.value

  if (!newDate || !newTime) {
    showError('Escolha nova data e hora para adiar a marcação.')
    return
  }

  if (isDateBeforeToday(newDate) || isPastTimeSlot(newDate, newTime)) {
    showError('Escolha um horário futuro para o adiamento.')
    return
  }

  try {
    const conflict = await hasBookingConflict(booking.barberId, newDate, newTime, bookingId)
    if (conflict) {
      showError('Esse horário já está ocupado. Escolha outro horário.')
      return
    }

    await update(ref(database, `bookings/${bookingId}`), {
      date: newDate,
      time: newTime,
      updatedAt: new Date().toISOString()
    })

    showSuccess('Marcação adiada com sucesso.')
    await loadClientBookings()
  } catch (error) {
    showError('Não foi possível adiar a marcação.')
  }
}

async function cancelBookingByClient(bookingId) {
  const booking = getBookingById(bookingId)
  if (!booking) {
    showError('Marcação não encontrada.')
    return
  }

  const shouldCancel = window.confirm('Tem a certeza que quer anular esta marcação?')
  if (!shouldCancel) return

  try {
    await update(ref(database, `bookings/${bookingId}`), {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    showSuccess('Marcação anulada com sucesso.')
    await loadClientBookings()
  } catch (error) {
    showError('Não foi possível anular a marcação.')
  }
}

// ===== STEP 1: SERVIÇOS =====
function initServiceSelection() {
  const serviceCards = document.querySelectorAll('.service-card')
  
  serviceCards.forEach(card => {
    const selectBtn = card.querySelector('.select-service')
    
    selectBtn.addEventListener('click', () => {
      const service = card.dataset.service
      const price = parseInt(card.dataset.price)
      const duration = parseInt(card.dataset.duration)
      const serviceName = card.querySelector('h3').textContent
      
      bookingState.service = service
      bookingState.serviceName = serviceName
      bookingState.servicePrice = price
      bookingState.serviceDuration = duration
      
      // Atualizar UI
      serviceCards.forEach(c => c.classList.remove('selected'))
      card.classList.add('selected')
      
      // Mostrar próximo passo
      setTimeout(() => {
        document.getElementById('step-barber').classList.remove('hidden')
        document.getElementById('selected-service-name').textContent = serviceName
        document.getElementById('selected-service-price').textContent = price
        
        // Scroll suave
        document.getElementById('step-barber').scrollIntoView({ behavior: 'smooth', block: 'start' })
        
        // Carregar barbeiros
        loadBarbers()
      }, 300)
    })
  })
}

// ===== STEP 2: BARBEIROS =====
// Mapeamento de imagens por nome de barbeiro (homem=foto de homem, mulher=foto de mulher)
const maleBarberImage = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&h=120&fit=crop'
const femaleBarberImage = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&h=120&fit=crop'

const barberImages = {
  'Manuel': maleBarberImage,
  'Ana': femaleBarberImage,
  'João Pedro': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=120&h=120&fit=crop',
}

// Nomes femininos comuns em português
const femaleNames = ['ana', 'maria', 'joana', 'sara', 'sofia', 'inês', 'catarina', 'beatriz', 'mariana', 'carolina', 'rita', 'daniela', 'patrícia', 'sandra', 'paula', 'cláudia', 'teresa', 'helena', 'raquel', 'filipa', 'marta', 'isabel', 'lúcia', 'carla', 'susana', 'cristina', 'alexandra', 'fernanda', 'rosa', 'diana']

function getBarberImage(barberName) {
  // Primeiro verificar se existe imagem específica
  if (barberImages[barberName]) return barberImages[barberName]
  
  // Determinar género pelo primeiro nome
  const firstName = barberName.split(' ')[0].toLowerCase()
  if (femaleNames.includes(firstName)) {
    return femaleBarberImage
  }
  return maleBarberImage
}

const fallbackBarbers = [
  { id: 'manuel', name: 'Manuel', specialty: 'Barba e Sobrancelha' },
  { id: 'ana', name: 'Ana', specialty: 'Cortes Modernos' },
  { id: 'joao-pedro', name: 'João Pedro', specialty: 'Degradé' },
]

async function loadBarbers() {
  const barbersList = document.getElementById('barbersList')
  barbersList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">A carregar barbeiros...</p>'
  
  try {
    const currentUser = auth.currentUser
    if (!currentUser) {
      barbersList.innerHTML = '<p style="text-align: center; color: var(--color-error);">Faça login com email e senha para carregar os barbeiros.</p>'
      return
    }

    const barbersRef = ref(database, 'barbers')
    const snapshot = await get(barbersRef)
    
    if (snapshot.exists()) {
      const barbers = snapshot.val()
      barbersList.innerHTML = ''

      const barberEntries = Object.entries(barbers).filter(([, barber]) => barber)

      if (barberEntries.length === 0) {
        barberEntries.push(...fallbackBarbers.map((barber) => [barber.id, barber]))
      }
      
      barberEntries.forEach(([barberId, barber], index) => {
        const barberName = barber.name || barber.nome || barber.fullName || 'Barbeiro'
        const barberSpecialty = barber.specialty || barber.especialidade || 'Barbeiro'
        
        const barberCard = document.createElement('div')
        barberCard.className = 'barber-card'
        barberCard.dataset.barberId = barberId
        barberCard.dataset.barberName = barberName
        
        // Obter imagem adequada ao género do barbeiro
        const imageUrl = getBarberImage(barberName)
        
        barberCard.innerHTML = `
          <img src="${imageUrl}" alt="${barberName}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
          <h3>${barberName}</h3>
          <p>${barberSpecialty}</p>
        `
        
        barberCard.addEventListener('click', () => selectBarber(barberId, barberName))
        
        barbersList.appendChild(barberCard)
      })
    } else {
      barbersList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Nenhum barbeiro disponível no momento.</p>'
    }
  } catch (error) {
    console.error('Erro ao carregar barbeiros:', error)
    barbersList.innerHTML = '<p style="text-align: center; color: var(--color-error);">Erro ao carregar barbeiros.</p>'
  }
}

async function selectBarber(barberId, barberName) {
  bookingState.barber = barberId
  bookingState.barberName = barberName
  
  // Carregar horários do barbeiro
  try {
    const barberRef = ref(database, `barbers/${barberId}`)
    const snapshot = await get(barberRef)
    
    if (snapshot.exists()) {
      const barberData = snapshot.val()
      bookingState.barberSpecialSchedules = barberData.specialSchedules || { day: {}, week: {}, month: {} }
      if (barberData.workingHours && barberData.workingHours.start && barberData.workingHours.end) {
        bookingState.barberWorkingHours = generateWorkingHours(barberData.workingHours.start, barberData.workingHours.end)
      } else {
        bookingState.barberWorkingHours = defaultWorkingHours
      }
      // Carregar dias de trabalho
      if (barberData.workingDays && Array.isArray(barberData.workingDays)) {
        bookingState.barberWorkingDays = barberData.workingDays
      } else {
        bookingState.barberWorkingDays = [1, 2, 3, 4, 5] // Seg-Sex por defeito
      }
    } else {
      bookingState.barberWorkingHours = defaultWorkingHours
      bookingState.barberWorkingDays = [1, 2, 3, 4, 5]
      bookingState.barberSpecialSchedules = { day: {}, week: {}, month: {} }
    }
  } catch (error) {
    console.error('Erro ao carregar horários do barbeiro:', error)
    bookingState.barberWorkingHours = defaultWorkingHours
    bookingState.barberSpecialSchedules = { day: {}, week: {}, month: {} }
  }
  
  // Atualizar UI
  document.querySelectorAll('.barber-card').forEach(c => c.classList.remove('selected'))
  document.querySelector(`[data-barber-id="${barberId}"]`).classList.add('selected')
  
  // Carregar marcações existentes
  await loadExistingBookings(barberId)
  
  // Mostrar próximo passo
  setTimeout(() => {
    document.getElementById('step-datetime').classList.remove('hidden')
    document.getElementById('selected-service-name2').textContent = bookingState.serviceName
    document.getElementById('selected-service-price2').textContent = bookingState.servicePrice
    document.getElementById('selected-barber-name').textContent = barberName
    
    // Scroll suave
    document.getElementById('step-datetime').scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    // Inicializar calendário
    initCalendar()
  }, 300)
}

// ===== STEP 3: CALENDÁRIO =====
async function loadExistingBookings(barberId) {
  try {
    const bookingsRef = ref(database, 'bookings')
    const snapshot = await get(bookingsRef)
    
    bookingState.bookings = []
    
    if (snapshot.exists()) {
      const allBookings = snapshot.val()
      
      Object.values(allBookings).forEach(booking => {
        if (booking.barberId === barberId && booking.status !== 'cancelled' && booking.status !== 'expired') {
          bookingState.bookings.push({
            date: booking.date,
            time: booking.time
          })
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar marcações:', error)
  }
}

function initCalendar() {
  const monthSelect = document.getElementById('monthSelect')
  const yearSelect = document.getElementById('yearSelect')
  const prevBtn = document.getElementById('prevMonth')
  const nextBtn = document.getElementById('nextMonth')
  
  // Preencher anos (ano atual até +2 anos)
  const currentYear = new Date().getFullYear()
  yearSelect.innerHTML = ''
  for (let i = 0; i < 3; i++) {
    const year = currentYear + i
    const option = document.createElement('option')
    option.value = year
    option.textContent = year
    yearSelect.appendChild(option)
  }
  
  monthSelect.value = bookingState.currentMonth
  yearSelect.value = bookingState.currentYear
  
  // Event listeners
  monthSelect.addEventListener('change', (e) => {
    bookingState.currentMonth = parseInt(e.target.value)
    renderCalendar()
  })
  
  yearSelect.addEventListener('change', (e) => {
    bookingState.currentYear = parseInt(e.target.value)
    renderCalendar()
  })
  
  prevBtn.addEventListener('click', () => {
    bookingState.currentMonth--
    if (bookingState.currentMonth < 0) {
      bookingState.currentMonth = 11
      bookingState.currentYear--
    }
    monthSelect.value = bookingState.currentMonth
    yearSelect.value = bookingState.currentYear
    renderCalendar()
  })
  
  nextBtn.addEventListener('click', () => {
    bookingState.currentMonth++
    if (bookingState.currentMonth > 11) {
      bookingState.currentMonth = 0
      bookingState.currentYear++
    }
    monthSelect.value = bookingState.currentMonth
    yearSelect.value = bookingState.currentYear
    renderCalendar()
  })
  
  renderCalendar()
}

function renderCalendar() {
  const calendarDays = document.getElementById('calendarDays')
  calendarDays.innerHTML = ''
  
  const year = bookingState.currentYear
  const month = bookingState.currentMonth
  
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  
  const today = new Date()
  const todayStr = getDateString(today)
  
  // Dias do mês anterior
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const dayElement = createDayElement(day, true, false, null)
    calendarDays.appendChild(dayElement)
  }
  
  // Dias do mês atual
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    const isPast = isDateBeforeToday(dateStr)
    
    // Verificar se o barbeiro trabalha neste dia da semana
    const dayOfWeek = new Date(year, month, day).getDay()
    const isWorkingDay = bookingState.barberWorkingDays.includes(dayOfWeek)
    
    // Calcular slots disponíveis (0 se não é dia de trabalho)
    const availableSlots = isWorkingDay ? calculateAvailableSlots(dateStr) : 0
    
    const dayElement = createDayElement(day, false, isToday, dateStr, availableSlots, isPast || !isWorkingDay)
    calendarDays.appendChild(dayElement)
  }
  
  // Dias do próximo mês
  const totalCells = calendarDays.children.length
  const remainingCells = 42 - totalCells // 6 semanas * 7 dias
  
  for (let day = 1; day <= remainingCells; day++) {
    const dayElement = createDayElement(day, true, false, null)
    calendarDays.appendChild(dayElement)
  }
}

function createDayElement(day, isOtherMonth, isToday, dateStr, availableSlots = 0, isPast = false) {
  const dayElement = document.createElement('div')
  dayElement.className = 'calendar-day'
  
  if (isOtherMonth) {
    dayElement.classList.add('other-month')
  }
  
  if (isToday) {
    dayElement.classList.add('today')
  }
  
  if (isPast) {
    dayElement.classList.add('disabled')
  }
  
  if (!isOtherMonth && !isPast && availableSlots === 0) {
    dayElement.classList.add('no-slots')
  }
  
  dayElement.innerHTML = `
    <span class="day-number">${day}</span>
    ${!isOtherMonth && !isPast && availableSlots > 0 ? `<span class="slots-badge">${availableSlots} espaços livres</span>` : ''}
  `
  
  if (!isOtherMonth && !isPast && dateStr && availableSlots > 0) {
    dayElement.addEventListener('click', () => selectDate(dateStr, availableSlots, dayElement))
  }
  
  return dayElement
}

function calculateAvailableSlots(dateStr) {
  const bookedSlots = bookingState.bookings
    .filter(b => b.date === dateStr)
    .map(b => b.time)
  
  const workingHours = getWorkingHoursForDate(dateStr)
  return workingHours.filter(hour => !bookedSlots.includes(hour) && !isPastTimeSlot(dateStr, hour)).length
}

function selectDate(dateStr, availableSlots, selectedDayElement) {
  bookingState.date = dateStr
  
  // Atualizar UI
  document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'))
  if (selectedDayElement) {
    selectedDayElement.classList.add('selected')
  }
  
  // Formatar data para exibição
  const [year, month, day] = dateStr.split('-')
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const formattedDate = `${day} de ${months[parseInt(month) - 1]} de ${year}`
  
  document.getElementById('selectedDateDisplay').textContent = formattedDate
  
  if (availableSlots > 0) {
    document.getElementById('timeSlotsContainer').classList.remove('hidden')
    document.getElementById('noSlotsMessage').classList.add('hidden')
    renderTimeSlots(dateStr)    
    // Scroll automático para a área de horários
    setTimeout(() => {
      document.getElementById('timeSlotsContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)  } else {
    document.getElementById('timeSlotsContainer').classList.add('hidden')
    document.getElementById('noSlotsMessage').classList.remove('hidden')
  }
}

function renderTimeSlots(dateStr) {
  const timeSlotsList = document.getElementById('timeSlotsList')
  timeSlotsList.innerHTML = ''
  
  const bookedSlots = bookingState.bookings
    .filter(b => b.date === dateStr)
    .map(b => b.time)
  
  const workingHours = getWorkingHoursForDate(dateStr)
  
  workingHours.forEach(hour => {
    const isBooked = bookedSlots.includes(hour)
    const isPastSlot = isPastTimeSlot(dateStr, hour)
    
    const timeSlot = document.createElement('div')
    timeSlot.className = 'time-slot'
    if (isBooked) {
      timeSlot.classList.add('booked')
    }
    if (isPastSlot) {
      timeSlot.classList.add('disabled')
    }
    timeSlot.textContent = hour
    
    if (!isBooked && !isPastSlot) {
      timeSlot.addEventListener('click', () => selectTime(hour, timeSlot))
    }
    
    timeSlotsList.appendChild(timeSlot)
  })
}

function selectTime(time, selectedTimeSlot) {
  bookingState.time = time
  
  // Atualizar UI
  document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'))
  if (selectedTimeSlot) {
    selectedTimeSlot.classList.add('selected')
  }
  
  // Mostrar formulário de dados do cliente
  setTimeout(() => {
    showClientDataForm()
  }, 300)
}

// ===== FORMULÁRIO DE DADOS DO CLIENTE =====
// Mapeamento de países com códigos
const countryPhoneCodes = {
  'PT': { name: 'Portugal', code: '+351' },
  'ES': { name: 'Espanha', code: '+34' },
  'FR': { name: 'França', code: '+33' },
  'IT': { name: 'Itália', code: '+39' },
  'DE': { name: 'Alemanha', code: '+49' },
  'UK': { name: 'Reino Unido', code: '+44' },
  'BR': { name: 'Brasil', code: '+55' },
  'US': { name: 'EUA/Canadá', code: '+1' }
}

function showClientDataForm() {
  // Ocultar passo anterior
  document.getElementById('step-datetime').classList.add('hidden')
  
  // Criar formulário se não existir
  let clientDataStep = document.getElementById('step-client-data')
  if (!clientDataStep) {
    clientDataStep = document.createElement('div')
    clientDataStep.id = 'step-client-data'
    clientDataStep.className = 'card'
    
    clientDataStep.innerHTML = `
      <h2>4. Confirmar Marcação</h2>
      <div class="selected-info">
        <p><strong>Serviço:</strong> ${bookingState.serviceName} - ${bookingState.servicePrice}€</p>
        <p><strong>Barbeiro:</strong> ${bookingState.barberName}</p>
        <p><strong>Data:</strong> ${formatDateForDisplay(bookingState.date)}</p>
        <p><strong>Hora:</strong> ${bookingState.time}</p>
        <p><strong>Cliente:</strong> ${bookingState.clientName || ''}</p>
        <p><strong>Email:</strong> ${bookingState.clientEmail || ''}</p>
        <p><strong>Telefone:</strong> ${bookingState.clientPhoneComplete || ''}</p>
      </div>
      <form id="clientDataForm" class="auth-form">
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Confirmar Marcação e Enviar Relatório</button>
      </form>
    `
    document.querySelector('.booking-steps').appendChild(clientDataStep)
  }
  
  // Mostrar formulário
  clientDataStep.classList.remove('hidden')
  clientDataStep.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Adicionar event listener ao formulário
  const form = document.getElementById('clientDataForm')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!auth.currentUser) {
      showError('Sessão inválida. Faça login novamente.')
      showAuthStep()
      return
    }
    
    // Confirmar marcação
    await confirmBooking()
  }, { once: true })
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${day} de ${months[parseInt(month) - 1]} de ${year}`
}

// ===== CONFIRMAÇÃO DA MARCAÇÃO =====
async function confirmBooking() {
  if (!bookingState.barber || !bookingState.date || !bookingState.time) {
    showError('Selecione barbeiro, data e hora antes de confirmar.')
    return
  }

  if (isDateBeforeToday(bookingState.date) || isPastTimeSlot(bookingState.date, bookingState.time)) {
    showError('Não é possível confirmar horários no passado. Escolha um horário futuro.')
    document.getElementById('step-client-data').classList.add('hidden')
    document.getElementById('step-datetime').classList.remove('hidden')
    renderCalendar()
    renderTimeSlots(bookingState.date)
    return
  }

  const currentUser = auth.currentUser
  if (!currentUser) {
    showError('Sessão expirada. Entre novamente para concluir a marcação.')
    showAuthStep()
    return
  }

  try {
    await loadExistingBookings(bookingState.barber)

    const bookedSlots = bookingState.bookings
      .filter(b => b.date === bookingState.date)
      .map(b => b.time)

    if (bookedSlots.includes(bookingState.time) || isPastTimeSlot(bookingState.date, bookingState.time)) {
      showError('Este horário já não está disponível. Escolha outro horário.')
      document.getElementById('step-client-data').classList.add('hidden')
      document.getElementById('step-datetime').classList.remove('hidden')
      renderCalendar()
      renderTimeSlots(bookingState.date)
      return
    }

    const bookingsRef = ref(database, 'bookings')
    const newBookingRef = push(bookingsRef)
    
    await set(newBookingRef, {
      barberId: bookingState.barber,
      barberName: bookingState.barberName,
      service: bookingState.service,
      serviceName: bookingState.serviceName,
      servicePrice: bookingState.servicePrice,
      serviceDuration: bookingState.serviceDuration,
      date: bookingState.date,
      time: bookingState.time,
      clientUid: currentUser.uid,
      clientName: bookingState.clientName,
      clientEmail: bookingState.clientEmail || (bookingState.client ? bookingState.client.email : null),
      clientCountry: bookingState.clientCountry,
      clientPhone: bookingState.clientPhone,
      clientPhoneComplete: bookingState.clientPhoneComplete,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    })
    
    // Ocultar formulário
    document.getElementById('step-client-data').classList.add('hidden')
    
    // Mostrar tela de sucesso
    showSuccessScreen()
    
  } catch (error) {
    const errorCode = error?.code || ''
    const errorMessage = error?.message || ''

    console.error('Erro ao criar marcação:', errorCode, errorMessage, error)

    if (
      errorCode === 'PERMISSION_DENIED' ||
      errorCode === 'permission-denied' ||
      errorMessage.toLowerCase().includes('permission_denied')
    ) {
      showError('Sem permissão para gravar marcações no Firebase. Verifique as regras do Realtime Database para permitir escrita autenticada em /bookings.')
      return
    }

    showError(`Erro ao criar marcação: ${errorMessage || 'tente novamente.'}`)
  }
}

function showSuccessScreen() {
  // Ocultar passo anterior
  document.getElementById('step-datetime').classList.add('hidden')
  
  // Formatar data para exibição
  const [year, month, day] = bookingState.date.split('-')
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const formattedDate = `${day} de ${months[parseInt(month) - 1]} de ${year}`
  
  // Preencher dados de sucesso
  document.getElementById('success-service').textContent = `${bookingState.serviceName} (${bookingState.serviceDuration} min)`
  document.getElementById('success-barber').textContent = bookingState.barberName
  document.getElementById('success-date').textContent = formattedDate
  document.getElementById('success-time').textContent = bookingState.time
  document.getElementById('success-price').textContent = `${bookingState.servicePrice}€`

  const reportText = buildBookingReport(formattedDate)
  const reportEl = document.getElementById('bookingReportText')
  if (reportEl) {
    reportEl.textContent = reportText
  }
  setupReportActions(reportText)

  // Tenta abrir a composição de email automaticamente ao confirmar.
  sendReportByEmail(reportText)
  
  // Mostrar tela de sucesso
  document.getElementById('step-success').classList.remove('hidden')
  document.getElementById('step-success').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function buildBookingReport(formattedDate) {
  const clientEmail = bookingState.clientEmail || (bookingState.client ? bookingState.client.email : '')
  return `Relatório da Marcação\n\n` +
    `Cliente: ${bookingState.clientName}\n` +
    `Email: ${clientEmail}\n` +
    `Telefone: ${bookingState.clientPhoneComplete || bookingState.clientPhone || ''}\n\n` +
    `Serviço: ${bookingState.serviceName} (${bookingState.serviceDuration} min)\n` +
    `Barbeiro: ${bookingState.barberName}\n` +
    `Data: ${formattedDate}\n` +
    `Hora: ${bookingState.time}\n` +
    `Preço: ${bookingState.servicePrice}€\n\n` +
    `Estado: Confirmada\n` +
    `Criado em: ${new Date().toLocaleString('pt-PT')}`
}

function setupReportActions(reportText) {
  const sendEmailBtn = document.getElementById('sendEmailReportBtn')
  const copyBtn = document.getElementById('copyReportBtn')
  const downloadBtn = document.getElementById('downloadReportBtn')

  if (sendEmailBtn && !sendEmailBtn.dataset.bound) {
    sendEmailBtn.dataset.bound = 'true'
    sendEmailBtn.addEventListener('click', async () => {
      await sendReportByEmail(reportText)
    })
  }

  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.dataset.bound = 'true'
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(reportText)
        showSuccess('Relatório copiado para a área de transferência!')
      } catch (error) {
        showError('Não foi possível copiar o relatório.')
      }
    })
  }

  if (downloadBtn && !downloadBtn.dataset.bound) {
    downloadBtn.dataset.bound = 'true'
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'relatorio-marcacao.txt'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    })
  }
}

async function sendReportByEmail(reportText) {
  const clientEmail = bookingState.clientEmail || (bookingState.client ? bookingState.client.email : '')
  if (!clientEmail) {
    showError('Email do cliente não encontrado para envio do relatório.')
    return
  }

  const sendEmailBtn = document.getElementById('sendEmailReportBtn')
  if (sendEmailBtn) {
    sendEmailBtn.disabled = true
    sendEmailBtn.textContent = 'A enviar...'
  }

  try {
    const response = await fetch('/api/send-booking-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: clientEmail,
        reportText,
        booking: {
          clientName: bookingState.clientName,
          clientEmail,
          clientPhone: bookingState.clientPhoneComplete || bookingState.clientPhone || '',
          serviceName: bookingState.serviceName,
          serviceDuration: bookingState.serviceDuration,
          barberName: bookingState.barberName,
          date: bookingState.date,
          time: bookingState.time,
          price: bookingState.servicePrice,
        },
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok || payload?.success !== true) {
      throw new Error(payload?.message || 'Não foi possível enviar o relatório por email.')
    }

    showEmailSentPopup(clientEmail, 'Relatório enviado com sucesso para o seu email.')
    showSuccess('Relatório enviado com sucesso!')
  } catch (error) {
    console.error('Erro ao enviar relatório por email:', error)
    showError(error?.message || 'Falha ao enviar relatório por email.')
  } finally {
    if (sendEmailBtn) {
      sendEmailBtn.disabled = false
      sendEmailBtn.textContent = 'Enviar Relatório por Email'
    }
  }
}

function showEmailSentPopup(email, customMessage = '') {
  const popup = document.getElementById('emailSentPopup')
  const message = document.getElementById('emailSentMessage')
  if (!popup || !message) return

  message.textContent = customMessage || `O relatório foi enviado para ${email}.`
  popup.classList.remove('hidden')
}

function initEmailPopup() {
  const popup = document.getElementById('emailSentPopup')
  const okBtn = document.getElementById('emailSentOkBtn')
  const backdrop = document.getElementById('emailSentBackdrop')

  if (!popup || !okBtn || !backdrop) return

  const closePopup = () => popup.classList.add('hidden')

  okBtn.addEventListener('click', closePopup)
  backdrop.addEventListener('click', closePopup)
}

// ===== STEP 4: CONFIRMAÇÃO =====
function initBookingConfirmation() {
  // Botão para voltar para a área de cliente
  const exitBtn = document.getElementById('exitBtn')
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      window.location.href = 'client-menu.html'
    })
  }
}

function initClientNavigation() {
  const backBtn = document.getElementById('bookingGoBackBtn')
  if (!backBtn) return

  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html'
  })
}

function resetBooking() {
  // Resetar estado
  bookingState.service = null
  bookingState.serviceName = ''
  bookingState.servicePrice = 0
  bookingState.serviceDuration = 0
  bookingState.barber = null
  bookingState.barberName = ''
  bookingState.barberSpecialSchedules = { day: {}, week: {}, month: {} }
  bookingState.barberWorkingDays = [1, 2, 3, 4, 5]
  bookingState.date = null
  bookingState.time = null
  
  // Resetar UI
  document.getElementById('step-services').classList.remove('hidden')
  document.getElementById('step-barber').classList.add('hidden')
  document.getElementById('step-datetime').classList.add('hidden')
  document.getElementById('step-success').classList.add('hidden')
  
  // Remover formulário de dados do cliente se existir
  const clientDataStep = document.getElementById('step-client-data')
  if (clientDataStep) clientDataStep.remove()
  
  // Limpar seleções
  document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'))
  document.querySelectorAll('.barber-card').forEach(c => c.classList.remove('selected'))
  document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'))
  document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'))
  
  // Scroll para o topo
  document.getElementById('step-services').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  initPageMode()
  initClientAuth()
  initClientNavigation()

  initAutoClientSession().then((didAutoLogin) => {
    if (!didAutoLogin) {
      showAuthStep()
    }

    initServiceSelection()
    initBookingConfirmation()
    initEmailPopup()
  })
})
