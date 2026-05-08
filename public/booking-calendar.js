import { auth, database, AUTH_ACTION_URL } from "./firebase-config.js"
import { ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

const isBarberSession = sessionStorage.getItem("isBarber") === "true"
if (isBarberSession) {
  window.location.href = "barber-panel.html"
}

const urlParams = new URLSearchParams(window.location.search)
const currentMode = urlParams.get('mode')
const isManageMode = currentMode === 'manage' || currentMode === 'cancel'
const isCancelMode = currentMode === 'cancel'
const preferredBarberParam = (urlParams.get('barber') || '').trim()
const REPORTS_ENABLED = false

function buildLoginRedirectUrl() {
  const barberName = preferredBarberParam || ''
  if (barberName) {
    sessionStorage.setItem('pendingBookingBarber', barberName)
    return `login.html?barber=${encodeURIComponent(barberName)}`
  }
  return 'login.html'
}

function redirectToLogin() {
  window.location.href = buildLoginRedirectUrl()
}

let authPersistencePromise = null

function ensureSessionPersistence() {
  if (!authPersistencePromise) {
    authPersistencePromise = setPersistence(auth, browserSessionPersistence).catch((error) => {
      authPersistencePromise = null
      throw error
    })
  }

  return authPersistencePromise
}

function clearAppSession() {
  sessionStorage.removeItem('clientEmail')
  sessionStorage.removeItem('clientName')
  sessionStorage.removeItem('isClient')
  sessionStorage.removeItem('barberId')
  sessionStorage.removeItem('barberName')
  sessionStorage.removeItem('barberEmail')
  sessionStorage.removeItem('isBarber')
  sessionStorage.removeItem('adminId')
  sessionStorage.removeItem('adminName')
  sessionStorage.removeItem('isAdmin')
}

function normalizeBarberKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function isClientEmailRegistered(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return false

  const snapshot = await get(ref(database, 'clients'))
  if (!snapshot.exists()) return false

  return Object.values(snapshot.val() || {}).some((client) => {
    return String(client?.email || '').trim().toLowerCase() === normalizedEmail
  })
}

// Estado da marcação
const bookingState = {
  service: null,
  serviceName: '',
  servicePrice: 0,
  serviceDuration: 0,
  barber: null,
  barberName: '',
  barberEmail: '',
  barberPhone: '',
  barberSpecialty: '',
  barberWorkingHours: [],
  barberLunchBreak: { start: null, end: null },
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
  bookings: [],
  preferredBarberRaw: preferredBarberParam,
  preferredBarberKey: normalizeBarberKey(preferredBarberParam),
  preferredBarberApplied: false,
  manageFilters: {
    service: '',
    barber: '',
    status: '',
    from: '',
    to: '',
  },
}

bookingState.storeSettings = {
  openDays: [1, 2, 3, 4, 5],
  openingHours: { start: '09:00', end: '19:00' },
  lunchBreak: { start: '13:00', end: '14:00' },
  specialSchedules: { day: {}, week: {}, month: {} },
}

const SLOT_STEP_MINUTES = 10
const MIN_ADVANCE_BOOKING_MINUTES = 60

const SERVICE_CATALOG = {
  corte: { name: 'Corte de Cabelo', price: 15, duration: 30 },
  barba: { name: 'Barba', price: 10, duration: 20 },
  'corte-barba': { name: 'Corte + Barba', price: 22, duration: 45 },
  sobrancelha: { name: 'Sobrancelha', price: 5, duration: 10 },
  completo: { name: 'Pacote Completo', price: 35, duration: 60 },
}

const BARBER_PROFILES = {
  joao_pedro: {
    tier: 'economico',
    priceMultiplier: 0.9,
    durationMultiplier: 0.9,
  },
  ana: {
    tier: 'intermedio',
    priceMultiplier: 1,
    durationMultiplier: 1,
  },
  manuel: {
    tier: 'premium',
    priceMultiplier: 1.2,
    durationMultiplier: 1.2,
  },
}

const BARBER_PROFILE_ALIASES = {
  joao_pedro: ['joao pedro', 'joão pedro', 'joao', 'pedro', 'joao-pedro', 'joão-pedro'],
  ana: ['ana'],
  manuel: ['manuel'],
}

function roundDuration(value) {
  return Math.max(10, Math.round(Number(value || 0) / 5) * 5)
}

function roundPrice(value) {
  return Math.round(Number(value || 0))
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeSearchText(value) {
  return normalizeName(value).replace(/\s+/g, ' ')
}

function resolveProfileBySpecialty(barberSpecialty) {
  const specialty = normalizeName(barberSpecialty)
  if (!specialty) return null

  if (specialty.includes('premium') || specialty.includes('detalhe') || specialty.includes('acabamento')) {
    return 'manuel'
  }

  if (specialty.includes('intermedio') || specialty.includes('equilibrio')) {
    return 'ana'
  }

  if (specialty.includes('rapido') || specialty.includes('economico') || specialty.includes('eficiencia')) {
    return 'joao_pedro'
  }

  return null
}

function resolveBarberProfileKey(barberName, barberId) {
  const normalizedName = normalizeName(barberName)
  const normalizedId = normalizeName(barberId)

  const directKey = normalizedName.replace(/\s+/g, '_')
  if (BARBER_PROFILES[directKey]) return directKey
  if (BARBER_PROFILES[normalizedId]) return normalizedId

  const aliases = Object.entries(BARBER_PROFILE_ALIASES)
  for (const [profileKey, aliasList] of aliases) {
    const hasAliasName = aliasList.some((alias) => normalizedName.includes(normalizeName(alias)))
    if (hasAliasName) return profileKey

    const hasAliasId = aliasList.some((alias) => normalizedId.includes(normalizeName(alias)))
    if (hasAliasId) return profileKey
  }

  return null
}

function getBarberProfile(barberName, barberId, barberSpecialty) {
  const profileKey =
    resolveBarberProfileKey(barberName, barberId) ||
    resolveProfileBySpecialty(barberSpecialty)

  if (!profileKey) {
    return { tier: 'economico', priceMultiplier: 1, durationMultiplier: 1 }
  }

  return BARBER_PROFILES[profileKey]
}

function getServiceConfigForBarber(serviceKey, barberName, barberId, barberSpecialty) {
  const base = SERVICE_CATALOG[serviceKey]
  if (!base) {
    return { price: bookingState.servicePrice || 0, duration: bookingState.serviceDuration || 30, name: bookingState.serviceName || 'Serviço' }
  }

  const profile = getBarberProfile(barberName, barberId, barberSpecialty)
  const price = roundPrice(base.price * profile.priceMultiplier)
  const duration = roundDuration(base.duration * profile.durationMultiplier)

  return {
    name: base.name,
    price,
    duration,
  }
}

function applyServicePricingForSelectedBarber() {
  if (!bookingState.service) return
  const config = getServiceConfigForBarber(
    bookingState.service,
    bookingState.barberName,
    bookingState.barber,
    bookingState.barberSpecialty,
  )

  bookingState.serviceName = config.name
  bookingState.servicePrice = config.price
  bookingState.serviceDuration = config.duration

  const stepDateName = document.getElementById('selected-service-name2')
  const stepDatePrice = document.getElementById('selected-service-price2')

  if (stepDateName) stepDateName.textContent = bookingState.serviceName
  if (stepDatePrice) stepDatePrice.textContent = bookingState.servicePrice
}

function updateServiceCardsForBarber(barberName) {
  const serviceCards = document.querySelectorAll('.service-card')
  serviceCards.forEach((card) => {
    const service = card.dataset.service
    if (!service) return

    const config = getServiceConfigForBarber(service, barberName, bookingState.barber, bookingState.barberSpecialty)
    card.dataset.price = String(config.price)
    card.dataset.duration = String(config.duration)

    const priceEl = card.querySelector('.price')
    const durationEl = card.querySelector('p:not(.price)')

    if (priceEl) priceEl.textContent = `${config.price}€`
    if (durationEl) durationEl.textContent = `${config.duration} minutos`
  })
}

// Horários de trabalho padrão (9h às 19h) com intervalos de 10 minutos
const defaultWorkingHours = (() => {
  const slots = []
  let current = timeToMinutes('09:00')
  const end = timeToMinutes('19:00')

  while (current <= end) {
    const hour = Math.floor(current / 60)
    const minute = current % 60
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    current += SLOT_STEP_MINUTES
  }

  return slots
})()

// Função para gerar horários do barbeiro
function generateWorkingHours(startTime, endTime, stepMinutes = SLOT_STEP_MINUTES) {
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

function timeToMinutes(timeStr) {
  const [hour, minute] = String(timeStr || '00:00').split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function normalizeSpecialSchedules(value) {
  return {
    day: value?.day || {},
    week: value?.week || {},
    month: value?.month || {},
  }
}

function getStoreSpecialScheduleForDate(dateStr) {
  const special = normalizeSpecialSchedules(bookingState.storeSettings?.specialSchedules)

  const daySchedule = special.day?.[dateStr]
  if (daySchedule?.start && daySchedule?.end) return daySchedule

  const weekSchedule = special.week?.[getIsoWeekKey(dateStr)]
  if (weekSchedule?.start && weekSchedule?.end) return weekSchedule

  const monthSchedule = special.month?.[dateStr.slice(0, 7)]
  if (monthSchedule?.start && monthSchedule?.end) return monthSchedule

  return null
}

function getStoreRuleValues(dateStr = null) {
  const settings = bookingState.storeSettings || {}
  const special = dateStr ? getStoreSpecialScheduleForDate(dateStr) : null
  const openDays = Array.isArray(settings.openDays) && settings.openDays.length ? settings.openDays : [1, 2, 3, 4, 5]
  const openingStart = special?.start || settings.openingHours?.start || '09:00'
  const openingEnd = special?.end || settings.openingHours?.end || '19:00'
  const lunchStart = settings.lunchBreak?.start || '13:00'
  const lunchEnd = settings.lunchBreak?.end || '14:00'

  return {
    openDays,
    openingStart,
    openingEnd,
    lunchStart,
    lunchEnd,
    hasSpecialSchedule: !!special,
  }
}

function applyStoreRulesToSlots(dateStr, slots) {
  const { openDays, openingStart, openingEnd, lunchStart, lunchEnd, hasSpecialSchedule } = getStoreRuleValues(dateStr)
  const dayOfWeek = parseDateString(dateStr).getDay()

  if (!hasSpecialSchedule && !openDays.includes(dayOfWeek)) {
    return []
  }

  const openingStartMinutes = timeToMinutes(openingStart)
  const openingEndMinutes = timeToMinutes(openingEnd)
  const lunchStartMinutes = timeToMinutes(lunchStart)
  const lunchEndMinutes = timeToMinutes(lunchEnd)

  return slots.filter((slot) => {
    const slotMinutes = timeToMinutes(slot)
    const insideOpening = slotMinutes >= openingStartMinutes && slotMinutes <= openingEndMinutes
    const insideLunch = slotMinutes >= lunchStartMinutes && slotMinutes < lunchEndMinutes
    return insideOpening && !insideLunch
  })
}

function applyBarberLunchBreakToSlots(slots) {
  const lunchStart = bookingState.barberLunchBreak?.start
  const lunchEnd = bookingState.barberLunchBreak?.end
  if (!lunchStart || !lunchEnd) return slots

  const lunchStartMinutes = timeToMinutes(lunchStart)
  const lunchEndMinutes = timeToMinutes(lunchEnd)
  if (lunchStartMinutes >= lunchEndMinutes) return slots

  return slots.filter((slot) => {
    const slotMinutes = timeToMinutes(slot)
    return slotMinutes < lunchStartMinutes || slotMinutes >= lunchEndMinutes
  })
}

function getDayWorkingWindow(dateStr) {
  const specialSchedule = getSpecialScheduleForDate(dateStr)
  if (specialSchedule?.start && specialSchedule?.end) {
    return {
      start: specialSchedule.start,
      end: specialSchedule.end,
    }
  }

  const baseStart = bookingState.barberWorkingHours?.[0] || '09:00'
  const baseEnd = bookingState.barberWorkingHours?.[bookingState.barberWorkingHours.length - 1] || '19:00'
  return {
    start: baseStart,
    end: baseEnd,
  }
}

function intervalOverlaps(startA, durationA, startB, durationB) {
  const endA = startA + durationA
  const endB = startB + durationB
  return startA < endB && endA > startB
}

function getBookingDurationMinutes(booking) {
  const directDuration = Number(booking?.serviceDuration || 0)
  if (directDuration > 0) return directDuration

  const byService = Number(SERVICE_CATALOG[booking?.service]?.duration || 0)
  if (byService > 0) return byService

  return 30
}

function isSlotConflictWithBookings(dateStr, slotTime, durationMinutes, excludedBookingId = null) {
  const slotStart = timeToMinutes(slotTime)
  return bookingState.bookings.some((booking) => {
    if (!booking) return false
    if (booking.date !== dateStr) return false
    if (excludedBookingId && booking.id === excludedBookingId) return false
    if (booking.status === 'cancelled' || booking.status === 'expired') return false

    const bookingStart = timeToMinutes(booking.time)
    const bookingDuration = getBookingDurationMinutes(booking)
    return intervalOverlaps(slotStart, durationMinutes, bookingStart, bookingDuration)
  })
}

function canFitSlotInSchedule(dateStr, slotTime, durationMinutes) {
  const { openingStart, openingEnd, lunchStart, lunchEnd } = getStoreRuleValues(dateStr)
  const barberWindow = getDayWorkingWindow(dateStr)

  const windowStart = Math.max(timeToMinutes(openingStart), timeToMinutes(barberWindow.start))
  const windowEnd = Math.min(timeToMinutes(openingEnd), timeToMinutes(barberWindow.end))

  const slotStart = timeToMinutes(slotTime)
  const slotEnd = slotStart + durationMinutes
  if (slotStart < windowStart || slotEnd > windowEnd) return false

  const storeLunchStart = timeToMinutes(lunchStart)
  const storeLunchEnd = timeToMinutes(lunchEnd)
  if (intervalOverlaps(slotStart, durationMinutes, storeLunchStart, storeLunchEnd - storeLunchStart)) {
    return false
  }

  const barberLunchStart = timeToMinutes(bookingState.barberLunchBreak?.start)
  const barberLunchEnd = timeToMinutes(bookingState.barberLunchBreak?.end)
  if (barberLunchEnd > barberLunchStart) {
    if (intervalOverlaps(slotStart, durationMinutes, barberLunchStart, barberLunchEnd - barberLunchStart)) {
      return false
    }
  }

  return true
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
  let workingHours = []
  const specialSchedule = getSpecialScheduleForDate(dateStr)
  if (specialSchedule) {
    workingHours = generateWorkingHours(specialSchedule.start, specialSchedule.end)
  } else if (bookingState.barberWorkingHours.length > 0) {
    workingHours = bookingState.barberWorkingHours
  } else {
    workingHours = defaultWorkingHours
  }

  const storeFiltered = applyStoreRulesToSlots(dateStr, workingHours)
  return applyBarberLunchBreakToSlots(storeFiltered)
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
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + MIN_ADVANCE_BOOKING_MINUTES

  return slotMinutes < nowMinutes
}

function showBookingSteps() {
  document.getElementById('step-manage-bookings')?.classList.add('hidden')
  document.getElementById('step-auth').classList.add('hidden')
  document.getElementById('step-services').classList.add('hidden')
  document.getElementById('step-barber').classList.remove('hidden')
  document.getElementById('step-datetime').classList.add('hidden')
  loadBarbers()
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
  redirectToLogin()
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

  if (!isManageMode && bookingState.preferredBarberRaw) {
    if (authDescription) {
      authDescription.textContent = `Faça login para continuar a marcação com ${bookingState.preferredBarberRaw}. Depois pode confirmar ou alterar.`
    }
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

  clearAppSession()
  sessionStorage.setItem('clientEmail', bookingState.clientEmail)
  sessionStorage.setItem('clientName', bookingState.clientName || 'Cliente')
  sessionStorage.setItem('isClient', 'true')
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
      await ensureSessionPersistence()

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
      const code = error?.code || ''
      if (code === 'auth/wrong-password') {
        showError('Senha incorreta.')
      } else if (code === 'auth/user-not-found') {
        showError('Esse email não está registrado. Cria uma conta.')
      } else if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        const registered = await isClientEmailRegistered(email)
        showError(registered ? 'Senha incorreta.' : 'Esse email não está registrado. Cria uma conta.')
      } else {
        showError('Não foi possível fazer login.')
      }
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
      await ensureSessionPersistence()

      const result = await createUserWithEmailAndPassword(auth, email, password)
      const user = result.user

      await sendEmailVerification(user, {
        url: AUTH_ACTION_URL,
        handleCodeInApp: true,
      })

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

async function refreshRescheduleTimeOptions(bookingId) {
  const booking = getBookingById(bookingId)
  if (!booking) return

  const dateInput = document.getElementById(`reschedule-date-${bookingId}`)
  const timeSelect = document.getElementById(`reschedule-time-${bookingId}`)
  if (!dateInput || !timeSelect) return

  const selectedDate = dateInput.value || booking.date
  if (!selectedDate) {
    timeSelect.innerHTML = '<option value="">Sem horarios disponiveis</option>'
    return
  }

  await loadExistingBookings(booking.barberId)
  const durationMinutes = getBookingDurationMinutes(booking)
  const options = []
  for (const slot of defaultWorkingHours) {
    if (isPastTimeSlot(selectedDate, slot)) continue
    const conflict = await hasBookingConflict(booking.barberId, selectedDate, slot, bookingId, durationMinutes)
    if (conflict) continue
    options.push(slot)
  }

  if (!options.length) {
    timeSelect.innerHTML = '<option value="">Sem horarios disponiveis</option>'
    timeSelect.value = ''
    return
  }

  const currentSelected = options.includes(booking.time) ? booking.time : options[0]
  timeSelect.innerHTML = options
    .map((slot) => `<option value="${slot}" ${slot === currentSelected ? 'selected' : ''}>${slot}</option>`)
    .join('')
}

function isBookingExpiredForClient(booking) {
  if (!booking?.date || !booking?.time) return false

  const lifecycle = booking.status || ''
  if (lifecycle === 'cancelled' || lifecycle === 'expired' || lifecycle === 'cancel_requested') {
    return false
  }

  const execution = booking.executionStatus || 'pending'
  if (execution !== 'pending') return false

  if (isDateBeforeToday(booking.date)) return true

  const todayStr = getDateString(new Date())
  if (booking.date === todayStr && isPastTimeSlot(booking.date, booking.time)) {
    return true
  }

  return false
}

async function expirePastClientBookings(bookings) {
  const candidates = bookings.filter((booking) => isBookingExpiredForClient(booking))
  if (!candidates.length) return bookings

  const nowIso = new Date().toISOString()
  await Promise.all(
    candidates.map((booking) =>
      update(ref(database, `bookings/${booking.id}`), {
        status: 'expired',
        cancelledBy: 'system',
        cancellationReason: 'Data da marcacao ja passou',
        cancelledAt: nowIso,
        updatedAt: nowIso,
      }).catch((error) => {
        console.error('Erro ao expirar marcacao:', error)
      }),
    ),
  )

  const expiredIds = new Set(candidates.map((booking) => booking.id))
  return bookings.map((booking) =>
    expiredIds.has(booking.id)
      ? { ...booking, status: 'expired', cancelledBy: 'system', cancellationReason: 'Data da marcacao ja passou', cancelledAt: nowIso }
      : booking,
  )
}

async function hasBookingConflict(barberId, date, time, bookingIdToIgnore, durationMinutes = 30) {
  const snapshot = await get(ref(database, 'bookings'))
  if (!snapshot.exists()) return false

  const allBookings = snapshot.val()
  const candidateStart = timeToMinutes(time)
  return Object.entries(allBookings).some(([id, booking]) => {
    if (!booking || id === bookingIdToIgnore) return false
    if (booking.status === 'cancelled' || booking.status === 'expired') return false
    if (booking.barberId !== barberId || booking.date !== date) return false

    const bookingStart = timeToMinutes(booking.time)
    const bookingDuration = getBookingDurationMinutes(booking)
    return intervalOverlaps(candidateStart, durationMinutes, bookingStart, bookingDuration)
  })
}

function setManageBookingsStatus(text, variant = 'muted') {
  const statusEl = document.getElementById('manageBookingsStatus')
  if (!statusEl) return

  statusEl.textContent = text
  statusEl.classList.remove('is-muted', 'is-success', 'is-error')
  statusEl.classList.add(`is-${variant}`)
}

function normalizeRatingValue(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  const steppedValue = Math.round(numericValue * 2) / 2
  return Math.min(5, Math.max(0, steppedValue))
}

function renderStarRatingControl(bookingId, ratingValue) {
  const safeValue = normalizeRatingValue(ratingValue)
  const fillWidth = `${(safeValue / 5) * 100}%`
  const segments = Array.from({ length: 10 }, (_, index) => {
    const segmentValue = ((index + 1) / 2).toFixed(1)
    return `<button type="button" class="star-rating-segment" data-value="${segmentValue}" aria-label="${segmentValue} estrelas"></button>`
  }).join('')

  return `
    <div class="star-rating-input" data-rating-input="${bookingId}" data-rating-value="${safeValue}">
      <div class="star-rating-visual" aria-hidden="true">
        <span class="star-rating-base">★★★★★</span>
        <span class="star-rating-fill" style="width: ${fillWidth};">★★★★★</span>
      </div>
      <div class="star-rating-segments" aria-hidden="false">
        ${segments}
      </div>
      <input type="hidden" id="rating-${bookingId}" value="${safeValue > 0 ? safeValue.toFixed(1) : ''}">
    </div>
  `
}

function bindStarRatingControls(rootElement) {
  const ratings = rootElement.querySelectorAll('.star-rating-input[data-rating-input]')
  ratings.forEach((ratingWrap) => {
    if (ratingWrap.dataset.bound === 'true') return
    ratingWrap.dataset.bound = 'true'

    const inputId = ratingWrap.dataset.ratingInput
    const hiddenInput = document.getElementById(`rating-${inputId}`)
    const fillElement = ratingWrap.querySelector('.star-rating-fill')

    const applyValue = (nextValue) => {
      const normalizedValue = normalizeRatingValue(nextValue)
      ratingWrap.dataset.ratingValue = normalizedValue.toFixed(1)
      if (hiddenInput) {
        hiddenInput.value = normalizedValue > 0 ? normalizedValue.toFixed(1) : ''
      }
      if (fillElement) {
        fillElement.style.width = `${(normalizedValue / 5) * 100}%`
      }
    }

    const segmentButtons = ratingWrap.querySelectorAll('.star-rating-segment[data-value]')
    segmentButtons.forEach((button) => {
      button.addEventListener('click', () => {
        applyValue(button.dataset.value)
        saveBookingRating(inputId, { silentSuccess: true })
      })
    })
  })
}

function getClientBookingStatusKey(booking) {
  if (booking.status === 'expired') return 'expired'
  if (booking.status === 'cancelled') return 'cancelled'
  if (booking.executionStatus === 'completed') return 'completed'
  return 'confirmed'
}

function isDateWithinRange(dateStr, fromDate, toDate) {
  if (!dateStr) return false
  if (fromDate && dateStr < fromDate) return false
  if (toDate && dateStr > toDate) return false
  return true
}

function getFilteredClientBookings() {
  const filters = bookingState.manageFilters || {}
  const serviceFilter = normalizeSearchText(filters.service)
  const barberFilter = normalizeSearchText(filters.barber)
  const statusFilter = String(filters.status || '').trim()
  const fromDate = String(filters.from || '').trim()
  const toDate = String(filters.to || '').trim()

  return bookingState.clientBookings.filter((booking) => {
    if (serviceFilter && !normalizeSearchText(booking.serviceName || booking.service || '').includes(serviceFilter)) {
      return false
    }
    if (barberFilter && !normalizeSearchText(booking.barberName || '').includes(barberFilter)) {
      return false
    }
    if (statusFilter && getClientBookingStatusKey(booking) !== statusFilter) {
      return false
    }
    if ((fromDate || toDate) && !isDateWithinRange(booking.date || '', fromDate, toDate)) {
      return false
    }
    return true
  })
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
    const isCompleted = booking.executionStatus === 'completed'
    const statusLabel = booking.status === 'expired'
      ? 'Expirada'
      : booking.status === 'cancelled'
        ? 'Anulada'
        : isCompleted
          ? 'Concluída'
          : 'Confirmada'
    const isCancelled = booking.status === 'cancelled' || booking.status === 'expired'
    const isLocked = isCancelled || isCompleted
    const ratingValue = Number(booking.rating || 0)
    const canRate = isCompleted && !isCancelled
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
        ${isLocked ? '' : `
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
              <select id="reschedule-time-${booking.id}"></select>
            </div>
            <button type="button" class="btn btn-primary save-reschedule-btn" data-booking-id="${booking.id}">Guardar Nova Data</button>
          </div>
        `}
        ${canRate ? `
          <div class="client-booking-rating">
            <label>Avaliar barbeiro</label>
            <div class="client-rating-controls">
              ${renderStarRatingControl(booking.id, ratingValue)}
            </div>
            <p class="rating-hint">${ratingValue > 0 ? `Avaliação atual: ${normalizeRatingValue(ratingValue).toFixed(1)}/5` : 'Deixe a sua avaliação ao barbeiro (aceita meia estrela).'}</p>
          </div>
        ` : isCancelled ? '' : `
          <div class="client-booking-rating is-disabled">
            <p class="rating-hint">A avaliação fica disponível após a conclusão do corte.</p>
          </div>
        `}
      </div>
    `
  }).join('')

  if (!isCancelMode) {
    listEl.querySelectorAll('.manage-reschedule-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookingId = btn.dataset.bookingId
        const panel = document.getElementById(`reschedule-panel-${bookingId}`)
        if (!panel) return
        panel.classList.toggle('hidden')
        if (!panel.classList.contains('hidden')) {
          await refreshRescheduleTimeOptions(bookingId)
        }
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

  if (!isCancelMode) {
    listEl.querySelectorAll('input[id^=\"reschedule-date-\"]').forEach((inputEl) => {
      inputEl.addEventListener('change', async () => {
        const bookingId = inputEl.id.replace('reschedule-date-', '')
        await refreshRescheduleTimeOptions(bookingId)
      })
    })
  }

  listEl.querySelectorAll('.manage-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookingId = btn.dataset.bookingId
      await cancelBookingByClient(bookingId)
    })
  })

  bindStarRatingControls(listEl)
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
        return right.localeCompare(left)
      })
    bookingState.clientBookings = await expirePastClientBookings(bookingState.clientBookings)
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
    const currentDuration = getBookingDurationMinutes(booking)

    if (!canFitSlotInSchedule(newDate, newTime, currentDuration)) {
      showError('Esse horário não cabe no período disponível do barbeiro/loja.')
      return
    }

    const conflict = await hasBookingConflict(booking.barberId, newDate, newTime, bookingId, currentDuration)
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

  if (booking.executionStatus === 'completed') {
    showError('Não é possível anular uma marcação concluída.')
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

async function saveBookingRating(bookingId, options = {}) {
  const booking = getBookingById(bookingId)
  if (!booking) {
    showError('Marcação não encontrada.')
    return
  }

  if (booking.executionStatus !== 'completed') {
    showError('A avaliação fica disponível após a conclusão do corte.')
    return
  }

  const ratingInput = document.getElementById(`rating-${bookingId}`)
  const rating = normalizeRatingValue(ratingInput?.value || 0)

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    showError('Escolha uma nota entre 1 e 5 para avaliar.')
    return
  }

  try {
    await update(ref(database, `bookings/${bookingId}`), {
      rating,
      ratingAt: new Date().toISOString(),
    })
    try {
      await recalculateBarberStats(booking.barberId)
    } catch (statsError) {
      console.warn('Sem permissão para atualizar agregados do barbeiro após avaliação:', statsError)
    }

    showSuccess('Avaliação guardada com sucesso. Obrigado!')
    await loadClientBookings()
  } catch (error) {
    showError('Não foi possível guardar a avaliação.')
  }
}

async function recalculateBarberStats(barberUid) {
  if (!barberUid) return

  const bookingsSnapshot = await get(ref(database, 'bookings'))
  const bookings = bookingsSnapshot.exists() ? Object.values(bookingsSnapshot.val() || {}) : []

  const completedBookings = bookings.filter((booking) => {
    if (!booking || booking.barberId !== barberUid) return false
    if ((booking.executionStatus || 'pending') !== 'completed') return false
    const status = booking.status || 'active'
    return status !== 'cancelled' && status !== 'expired'
  })

  const completedCuts = completedBookings.length
  const ratings = completedBookings
    .map((booking) => Number(booking.rating))
    .filter((value) => Number.isFinite(value) && value > 0)

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

// ===== STEP 1: SERVIÇOS =====
function initServiceSelection() {
  const serviceCards = document.querySelectorAll('.service-card')
  
  serviceCards.forEach(card => {
    const selectBtn = card.querySelector('.select-service')
    
    selectBtn.addEventListener('click', () => {
      const service = card.dataset.service
      const serviceName = card.querySelector('h3').textContent
      const baseConfig = SERVICE_CATALOG[service] || {
        price: parseInt(card.dataset.price || '0', 10),
        duration: parseInt(card.dataset.duration || '30', 10),
      }
      
      bookingState.service = service
      bookingState.serviceName = serviceName
      bookingState.servicePrice = baseConfig.price
      bookingState.serviceDuration = baseConfig.duration
      
      // Atualizar UI
      serviceCards.forEach(c => c.classList.remove('selected'))
      card.classList.add('selected')
      
      // Mostrar próximo passo
      setTimeout(() => {
        document.getElementById('step-services').classList.add('hidden')
        document.getElementById('step-datetime').classList.remove('hidden')
        
        // Scroll suave
        document.getElementById('step-datetime').scrollIntoView({ behavior: 'smooth', block: 'start' })

        document.getElementById('selected-service-name2').textContent = bookingState.serviceName
        document.getElementById('selected-service-price2').textContent = bookingState.servicePrice
        document.getElementById('selected-barber-name').textContent = bookingState.barberName

        initCalendar()
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
      redirectToLogin()
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
        
        barberCard.addEventListener('click', () => selectBarber(barberId, barberName, barberSpecialty))
        
        barbersList.appendChild(barberCard)
      })

      if (!bookingState.preferredBarberApplied && bookingState.preferredBarberKey) {
        const preferredMatch = barberEntries.find(([barberId, barber]) => {
          const barberName = barber?.name || barber?.nome || barber?.fullName || ''
          return (
            normalizeBarberKey(barberId) === bookingState.preferredBarberKey ||
            normalizeBarberKey(barberName) === bookingState.preferredBarberKey
          )
        })

        if (preferredMatch) {
          bookingState.preferredBarberApplied = true
          const [matchedBarberId, matchedBarber] = preferredMatch
          const matchedBarberName = matchedBarber?.name || matchedBarber?.nome || matchedBarber?.fullName || 'Barbeiro'
          showSuccess(`Barbeiro pré-selecionado: ${matchedBarberName}`)
          await selectBarber(matchedBarberId, matchedBarberName, matchedBarber?.specialty || matchedBarber?.especialidade || '')
        }
      }
    } else {
      barbersList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Nenhum barbeiro disponível no momento.</p>'
    }
  } catch (error) {
    console.error('Erro ao carregar barbeiros:', error)
    barbersList.innerHTML = '<p style="text-align: center; color: var(--color-error);">Erro ao carregar barbeiros.</p>'
  }
}

async function loadStoreSettings() {
  try {
    const snapshot = await get(ref(database, 'storeSettings'))
    if (!snapshot.exists()) return

    const settings = snapshot.val() || {}
    bookingState.storeSettings = {
      openDays: Array.isArray(settings.openDays) && settings.openDays.length ? settings.openDays : [1, 2, 3, 4, 5],
      openingHours: {
        start: settings.openingHours?.start || '09:00',
        end: settings.openingHours?.end || '19:00'
      },
      lunchBreak: {
        start: settings.lunchBreak?.start || '13:00',
        end: settings.lunchBreak?.end || '14:00'
      },
      specialSchedules: normalizeSpecialSchedules(settings.specialSchedules),
    }
  } catch (error) {
    console.error('Erro ao carregar horário da loja:', error)
  }
}

async function selectBarber(barberId, barberName, barberSpecialty = '') {
  bookingState.barber = barberId
  bookingState.barberName = barberName
  bookingState.barberSpecialty = barberSpecialty
  updateServiceCardsForBarber(barberName)
  applyServicePricingForSelectedBarber()

  await loadStoreSettings()
  
  // Carregar horários do barbeiro
  try {
    const barberRef = ref(database, `barbers/${barberId}`)
    const snapshot = await get(barberRef)
    
    if (snapshot.exists()) {
      const barberData = snapshot.val()
      bookingState.barberSpecialty = barberData.specialty || barberData.especialidade || bookingState.barberSpecialty
      bookingState.barberEmail = barberData.email || ''
      bookingState.barberPhone = barberData.phone || ''
      bookingState.barberSpecialSchedules = barberData.specialSchedules || { day: {}, week: {}, month: {} }
      const fallbackLunchStart = bookingState.storeSettings?.lunchBreak?.start || '13:00'
      const fallbackLunchEnd = bookingState.storeSettings?.lunchBreak?.end || '14:00'
      bookingState.barberLunchBreak = {
        start: barberData.lunchBreak?.start || fallbackLunchStart,
        end: barberData.lunchBreak?.end || fallbackLunchEnd,
      }
      if (barberData.workingHours && barberData.workingHours.start && barberData.workingHours.end) {
        bookingState.barberWorkingHours = generateWorkingHours(barberData.workingHours.start, barberData.workingHours.end)
      } else {
        bookingState.barberWorkingHours = defaultWorkingHours
      }
      const barberHoursEl = document.getElementById('selected-barber-hours')
      if (barberHoursEl) {
        const hoursStart = barberData.workingHours?.start || '09:00'
        const hoursEnd = barberData.workingHours?.end || '19:00'
        barberHoursEl.textContent = `${hoursStart} - ${hoursEnd}`
      }
      // Carregar dias de trabalho
      if (barberData.workingDays && Array.isArray(barberData.workingDays)) {
        bookingState.barberWorkingDays = barberData.workingDays
      } else {
        bookingState.barberWorkingDays = [1, 2, 3, 4, 5] // Seg-Sex por defeito
      }
    } else {
      bookingState.barberEmail = ''
      bookingState.barberPhone = ''
      const fallbackLunchStart = bookingState.storeSettings?.lunchBreak?.start || '13:00'
      const fallbackLunchEnd = bookingState.storeSettings?.lunchBreak?.end || '14:00'
      bookingState.barberWorkingHours = defaultWorkingHours
      bookingState.barberLunchBreak = { start: fallbackLunchStart, end: fallbackLunchEnd }
      bookingState.barberWorkingDays = [1, 2, 3, 4, 5]
      bookingState.barberSpecialSchedules = { day: {}, week: {}, month: {} }
      const barberHoursEl = document.getElementById('selected-barber-hours')
      if (barberHoursEl) {
        barberHoursEl.textContent = '09:00 - 19:00'
      }
    }
  } catch (error) {
    console.error('Erro ao carregar horários do barbeiro:', error)
    const fallbackLunchStart = bookingState.storeSettings?.lunchBreak?.start || '13:00'
    const fallbackLunchEnd = bookingState.storeSettings?.lunchBreak?.end || '14:00'
    bookingState.barberWorkingHours = defaultWorkingHours
    bookingState.barberLunchBreak = { start: fallbackLunchStart, end: fallbackLunchEnd }
    bookingState.barberSpecialSchedules = { day: {}, week: {}, month: {} }
    bookingState.barberEmail = ''
    bookingState.barberPhone = ''
    const barberHoursEl = document.getElementById('selected-barber-hours')
    if (barberHoursEl) {
      barberHoursEl.textContent = '09:00 - 19:00'
    }
  }

  updateServiceCardsForBarber(barberName)
  applyServicePricingForSelectedBarber()
  
  // Atualizar UI
  document.querySelectorAll('.barber-card').forEach(c => c.classList.remove('selected'))
  document.querySelector(`[data-barber-id="${barberId}"]`).classList.add('selected')
  
  // Carregar marcações existentes
  await loadExistingBookings(barberId)
  
  // Mostrar próximo passo
  setTimeout(() => {
    document.getElementById('step-barber').classList.add('hidden')
    document.getElementById('step-services').classList.remove('hidden')
    const selectedBarberNameService = document.getElementById('selected-barber-name-service')
    if (selectedBarberNameService) selectedBarberNameService.textContent = barberName
    
    // Scroll suave
    document.getElementById('step-services').scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      
      Object.entries(allBookings).forEach(([bookingId, booking]) => {
        if (booking.barberId === barberId && booking.status !== 'cancelled' && booking.status !== 'expired') {
          bookingState.bookings.push({
            id: bookingId,
            date: booking.date,
            time: booking.time,
            status: booking.status,
            service: booking.service,
            serviceDuration: booking.serviceDuration,
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
  const today = new Date()
  const minYear = today.getFullYear()
  const minMonth = today.getMonth()
  
  // Preencher anos (ano atual até +2 anos)
  const currentYear = minYear
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
    const selectedMonth = parseInt(e.target.value)
    const selectedYear = parseInt(yearSelect.value)
    if (selectedYear === minYear && selectedMonth < minMonth) {
      bookingState.currentMonth = minMonth
      monthSelect.value = minMonth
    } else {
      bookingState.currentMonth = selectedMonth
    }
    renderCalendar()
  })
  
  yearSelect.addEventListener('change', (e) => {
    const selectedYear = parseInt(e.target.value)
    if (selectedYear < minYear) {
      bookingState.currentYear = minYear
      yearSelect.value = String(minYear)
      bookingState.currentMonth = minMonth
      monthSelect.value = String(minMonth)
    } else {
      bookingState.currentYear = selectedYear
      if (selectedYear === minYear && bookingState.currentMonth < minMonth) {
        bookingState.currentMonth = minMonth
        monthSelect.value = String(minMonth)
      }
    }
    renderCalendar()
  })
  
  prevBtn.addEventListener('click', () => {
    const nextMonth = bookingState.currentMonth - 1
    const nextYear = nextMonth < 0 ? bookingState.currentYear - 1 : bookingState.currentYear
    const normalizedMonth = nextMonth < 0 ? 11 : nextMonth

    if (nextYear < minYear || (nextYear === minYear && normalizedMonth < minMonth)) {
      bookingState.currentYear = minYear
      bookingState.currentMonth = minMonth
    } else {
      bookingState.currentYear = nextYear
      bookingState.currentMonth = normalizedMonth
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
    
    // Verificar se o barbeiro trabalha e se a loja está aberta no dia
    const dayOfWeek = new Date(year, month, day).getDay()
    const { openDays } = getStoreRuleValues()
    const isWorkingDay = bookingState.barberWorkingDays.includes(dayOfWeek) && openDays.includes(dayOfWeek)
    
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
  const selectedDuration = Number(bookingState.serviceDuration || 30)
  const workingHours = getWorkingHoursForDate(dateStr)
  return workingHours.filter((hour) => {
    if (isPastTimeSlot(dateStr, hour)) return false
    if (!canFitSlotInSchedule(dateStr, hour, selectedDuration)) return false
    if (isSlotConflictWithBookings(dateStr, hour, selectedDuration)) return false
    return true
  }).length
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
  const selectedDuration = Number(bookingState.serviceDuration || 30)
  const workingHours = getWorkingHoursForDate(dateStr)

  const visibleSlots = workingHours.filter((hour) => {
    if (isPastTimeSlot(dateStr, hour)) return false
    if (!canFitSlotInSchedule(dateStr, hour, selectedDuration)) return false
    if (isSlotConflictWithBookings(dateStr, hour, selectedDuration)) return false
    return true
  })

  visibleSlots.forEach((hour) => {
    const timeSlot = document.createElement('div')
    timeSlot.className = 'time-slot'
    timeSlot.textContent = hour
    timeSlot.addEventListener('click', () => selectTime(hour, timeSlot))
    timeSlotsList.appendChild(timeSlot)
  })

  const timeSlotsContainer = document.getElementById('timeSlotsContainer')
  const noSlotsMessage = document.getElementById('noSlotsMessage')
  if (visibleSlots.length === 0) {
    if (timeSlotsContainer) timeSlotsContainer.classList.add('hidden')
    if (noSlotsMessage) noSlotsMessage.classList.remove('hidden')
  } else {
    if (timeSlotsContainer) timeSlotsContainer.classList.remove('hidden')
    if (noSlotsMessage) noSlotsMessage.classList.add('hidden')
  }
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
        <p><strong>Email do Barbeiro:</strong> ${bookingState.barberEmail || 'N/A'}</p>
        <p><strong>Telefone do Barbeiro:</strong> ${bookingState.barberPhone || 'N/A'}</p>
      </div>
      <form id="clientDataForm" class="auth-form">
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Confirmar Marcação</button>
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

    const selectedDuration = Number(bookingState.serviceDuration || 30)

    if (
      isPastTimeSlot(bookingState.date, bookingState.time) ||
      !canFitSlotInSchedule(bookingState.date, bookingState.time, selectedDuration) ||
      isSlotConflictWithBookings(bookingState.date, bookingState.time, selectedDuration)
    ) {
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
      rating: null,
      ratingAt: null,
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
  const successBarberEmail = document.getElementById('success-barber-email')
  const successBarberPhone = document.getElementById('success-barber-phone')
  if (successBarberEmail) successBarberEmail.textContent = bookingState.barberEmail || 'N/A'
  if (successBarberPhone) successBarberPhone.textContent = bookingState.barberPhone || 'N/A'
  document.getElementById('success-price').textContent = `${bookingState.servicePrice}€`

  if (REPORTS_ENABLED) {
    const reportText = buildBookingReport(formattedDate)
    const reportEl = document.getElementById('bookingReportText')
    if (reportEl) {
      reportEl.textContent = reportText
    }
    setupReportActions(reportText)
    sendReportByEmail(reportText)
  }
  
  // Mostrar tela de sucesso
  document.getElementById('step-success').classList.remove('hidden')
  document.getElementById('step-success').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function buildBookingReport(formattedDate) {
  const companyName = 'Barbearia João Castro'
  const companyEmail = 'joaoguilhermesftc88@gmail.com'
  const companyPhone = '937277447'
  return `Relatório da Marcação\n\n` +
    `Empresa: ${companyName}\n` +
    `Email: ${companyEmail}\n` +
    `Telefone: ${companyPhone}\n\n` +
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
  const exitToMainBtn = document.getElementById('exitToMainBtn')
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      window.location.href = 'client-menu.html'
    })
  }
  if (exitToMainBtn) {
    exitToMainBtn.addEventListener('click', () => {
      window.location.href = 'index.html'
    })
  }
}

function initClientNavigation() {
  const logoutBtn = document.getElementById('bookingLogoutBtn')

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth)
      } catch (error) {
        console.error('Erro ao terminar sessão:', error)
      }

      clearAppSession()
      window.location.href = 'index.html'
    })
  }
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
  document.getElementById('step-services').classList.add('hidden')
  document.getElementById('step-barber').classList.remove('hidden')
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
  document.getElementById('step-barber').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Inicializar quando o DOM estiver pronto
function getClientBookingStatusKey(booking) {
  if (booking.status === 'expired') return 'expired'
  if (booking.status === 'cancelled') return 'cancelled'
  if (booking.executionStatus === 'completed') return 'completed'
  return 'confirmed'
}

function isDateWithinRange(dateStr, fromDate, toDate) {
  if (!dateStr) return false
  if (fromDate && dateStr < fromDate) return false
  if (toDate && dateStr > toDate) return false
  return true
}

function getFilteredClientBookings() {
  const filters = bookingState.manageFilters || {}
  const serviceFilter = normalizeSearchText(filters.service)
  const barberFilter = normalizeSearchText(filters.barber)
  const statusFilter = String(filters.status || '').trim()
  const fromDate = String(filters.from || '').trim()
  const toDate = String(filters.to || '').trim()

  return bookingState.clientBookings.filter((booking) => {
    if (serviceFilter && !normalizeSearchText(booking.serviceName || booking.service || '').includes(serviceFilter)) return false
    if (barberFilter && !normalizeSearchText(booking.barberName || '').includes(barberFilter)) return false
    if (statusFilter && getClientBookingStatusKey(booking) !== statusFilter) return false
    if ((fromDate || toDate) && !isDateWithinRange(booking.date || '', fromDate, toDate)) return false
    return true
  })
}

function renderClientBookings() {
  const listEl = document.getElementById('clientBookingsList')
  if (!listEl) return

  if (bookingState.clientBookings.length === 0) {
    listEl.innerHTML = ''
    setManageBookingsStatus('Nao existem marcacoes associadas a esta conta.', 'muted')
    return
  }

  const filteredBookings = getFilteredClientBookings()
  if (filteredBookings.length === 0) {
    listEl.innerHTML = ''
    setManageBookingsStatus('Nenhuma marcacao encontrada para os filtros escolhidos.', 'muted')
    return
  }

  setManageBookingsStatus(isCancelMode ? 'Selecione uma marcacao para anular.' : 'Selecione uma marcacao para adiar ou anular.', 'success')
  listEl.innerHTML = filteredBookings.map((booking) => {
    const isCompleted = booking.executionStatus === 'completed'
    const isCancelled = booking.status === 'cancelled' || booking.status === 'expired'
    const isLocked = isCancelled || isCompleted
    const statusLabel = booking.status === 'expired'
      ? 'Expirada'
      : booking.status === 'cancelled'
        ? 'Anulada'
        : isCompleted
          ? 'Concluida'
          : 'Confirmada'
    const ratingValue = Number(booking.rating || 0)
    const canRate = isCompleted && !isCancelled
    const safeDate = booking.date || ''
    const safeTime = booking.time || ''
    return `
      <div class="client-booking-card ${isCancelled ? 'is-cancelled' : ''}" data-booking-id="${booking.id}">
        <div class="client-booking-main">
          <h3>${booking.serviceName || 'Servico'}</h3>
          <p><strong>Barbeiro:</strong> ${booking.barberName || '-'}</p>
          <p><strong>Data:</strong> ${formatDateForDisplay(safeDate)}</p>
          <p><strong>Hora:</strong> ${safeTime || '-'}</p>
          <p><strong>Estado:</strong> ${statusLabel}</p>
        </div>
        ${isLocked ? '' : `
          <div class="client-booking-actions">
            ${isCancelMode ? '' : `<button type="button" class="btn btn-secondary manage-reschedule-btn" data-booking-id="${booking.id}">Adiar</button>`}
            <button type="button" class="btn btn-primary manage-cancel-btn" data-booking-id="${booking.id}">Anular</button>
          </div>
          <div class="manage-reschedule-panel hidden" id="reschedule-panel-${booking.id}">
            <div class="form-group" style="margin-bottom: 0.8rem;">
              <label for="reschedule-date-${booking.id}">Nova Data</label>
              <input type="date" id="reschedule-date-${booking.id}" value="${safeDate}" min="${getTodayDateForInput()}">
            </div>
            <div class="form-group" style="margin-bottom: 0.8rem;">
              <label for="reschedule-time-${booking.id}">Nova Hora</label>
              <select id="reschedule-time-${booking.id}"></select>
            </div>
            <button type="button" class="btn btn-primary save-reschedule-btn" data-booking-id="${booking.id}">Guardar Nova Data</button>
          </div>
        `}
        ${canRate ? `
          <div class="client-booking-rating">
            <label>Avaliar barbeiro</label>
            <div class="client-rating-controls">
              ${renderStarRatingControl(booking.id, ratingValue)}
            </div>
            <p class="rating-hint">${ratingValue > 0 ? `Avaliacao atual: ${normalizeRatingValue(ratingValue).toFixed(1)}/5` : 'Deixe a sua avaliacao ao barbeiro (aceita meia estrela).'}</p>
          </div>
        ` : isCancelled ? '' : `
          <div class="client-booking-rating is-disabled">
            <p class="rating-hint">A avaliacao fica disponivel apos a conclusao do corte.</p>
          </div>
        `}
      </div>
    `
  }).join('')

  if (!isCancelMode) {
    listEl.querySelectorAll('.manage-reschedule-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookingId = btn.dataset.bookingId
        const panel = document.getElementById(`reschedule-panel-${bookingId}`)
        if (!panel) return
        panel.classList.toggle('hidden')
        if (!panel.classList.contains('hidden')) {
          await refreshRescheduleTimeOptions(bookingId)
        }
      })
    })

    listEl.querySelectorAll('.save-reschedule-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookingId = btn.dataset.bookingId
        await rescheduleBooking(bookingId)
      })
    })

    listEl.querySelectorAll('input[id^="reschedule-date-"]').forEach((inputEl) => {
      inputEl.addEventListener('change', async () => {
        const bookingId = inputEl.id.replace('reschedule-date-', '')
        await refreshRescheduleTimeOptions(bookingId)
      })
    })
  }

  listEl.querySelectorAll('.manage-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookingId = btn.dataset.bookingId
      await cancelBookingByClient(bookingId)
    })
  })

  bindStarRatingControls(listEl)
}

async function loadClientBookings() {
  if (!auth.currentUser) {
    showError('Faca login para gerir as suas marcacoes.')
    showAuthStep()
    return
  }

  setManageBookingsStatus('A carregar marcacoes...', 'muted')
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
        return right.localeCompare(left)
      })

    bookingState.clientBookings = await expirePastClientBookings(bookingState.clientBookings)
    renderClientBookings()
  } catch (error) {
    setManageBookingsStatus('Erro ao carregar as suas marcacoes.', 'error')
    showError('Nao foi possivel carregar as marcacoes da sua conta.')
  }
}

function initClientBookingFilters() {
  const serviceInput = document.getElementById('clientBookingFilterService')
  const barberInput = document.getElementById('clientBookingFilterBarber')
  const statusInput = document.getElementById('clientBookingFilterStatus')
  const fromInput = document.getElementById('clientBookingFilterFrom')
  const toInput = document.getElementById('clientBookingFilterTo')

  if (!serviceInput || !barberInput || !statusInput || !fromInput || !toInput) return
  if (serviceInput.dataset.bound === 'true') return
  serviceInput.dataset.bound = 'true'

  const applyFilters = () => {
    bookingState.manageFilters = {
      service: serviceInput.value || '',
      barber: barberInput.value || '',
      status: statusInput.value || '',
      from: fromInput.value || '',
      to: toInput.value || '',
    }
    renderClientBookings()
  }

  ;[serviceInput, barberInput].forEach((input) => {
    input.addEventListener('input', applyFilters)
  })
  ;[statusInput, fromInput, toInput].forEach((input) => {
    input.addEventListener('change', applyFilters)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  ensureSessionPersistence().catch((error) => {
    console.error('Erro ao definir persistência de sessão:', error)
  })

  initPageMode()
  initClientNavigation()
  initClientBookingFilters()

  initAutoClientSession().then((didAutoLogin) => {
    if (!didAutoLogin) {
      redirectToLogin()
      return
    }

    initServiceSelection()
    initBookingConfirmation()
    if (REPORTS_ENABLED) {
      initEmailPopup()
    }
  })
})
