import { auth, database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const helpTexts = {
  register: {
    title: "Como me registo?",
    content: `
      <h3>Registo de Cliente - Passo a Passo</h3>
      <ol>
        <li><strong>Clique em "Registar como Cliente"</strong> na página inicial</li>
        <li><strong>Preencha os seus dados:</strong>
          <ul>
            <li>Nome completo</li>
            <li>Email (será usado para login)</li>
            <li>Telefone (9 dígitos)</li>
            <li>Senha (mínimo 6 caracteres)</li>
          </ul>
        </li>
        <li><strong>Clique em "Registar"</strong></li>
        <li><strong>Será automaticamente redirecionado</strong> para a página de marcações</li>
      </ol>
      <p><strong>Dica:</strong> Após o registo, já pode fazer marcações imediatamente!</p>
      <a href="client-register.html" class="help-action-btn">Registar Agora</a>
      <button class="help-back-btn" onclick="showHelpOptions()">← Voltar</button>
    `,
  },
  booking: {
    title: "Como faço uma marcação?",
    content: `
      <h3>Fazer uma Marcação - Passo a Passo</h3>
      <ol>
        <li><strong>Faça login na página de marcações</strong> usando seu email/nome e senha</li>
        <li><strong>Escolha o serviço desejado:</strong>
          <ul>
            <li>Corte de Cabelo - 15€ (30 min)</li>
            <li>Barba - 10€ (20 min)</li>
            <li>Corte + Barba - 22€ (45 min)</li>
            <li>Sobrancelha - 5€ (10 min)</li>
            <li>Pacote Completo - 35€ (60 min)</li>
          </ul>
        </li>
        <li><strong>Selecione o barbeiro</strong> da sua preferência</li>
        <li><strong>Escolha a data e horário</strong> disponíveis</li>
        <li><strong>Confirme a marcação</strong></li>
      </ol>
      <p><strong>Importante:</strong> O sistema verifica automaticamente a disponibilidade do barbeiro!</p>
      <a href="bookings.html" class="help-action-btn">Fazer Marcação</a>
      <button class="help-back-btn" onclick="showHelpOptions()">← Voltar</button>
    `,
  },
  login: {
    title: "Como faço login?",
    content: `
      <h3>Login de Cliente</h3>
      <p><strong>Se já tem uma conta registada:</strong></p>
      <ol>
        <li><strong>Vá para "Fazer Marcação"</strong> na página inicial</li>
        <li><strong>Insira o seu email ou nome</strong> (ambos funcionam)</li>
        <li><strong>Insira a sua senha</strong></li>
        <li><strong>Clique em "Autenticar"</strong></li>
      </ol>
      <p><strong>Esqueceu a senha?</strong> Entre em contacto com a barbearia para redefinir.</p>
      <p><strong>Ainda não tem conta?</strong> Faça o registo primeiro!</p>
      <a href="bookings.html" class="help-action-btn">Ir para Login</a>
      <button class="help-back-btn" onclick="showHelpOptions()">← Voltar</button>
    `,
  },
  prices: {
    title: "Tabela de Preços",
    content: `
      <h3>Serviços e Preços por Barbeiro</h3>
      <p><strong>João Pedro (Económico)</strong><br>
      Corte 14€ (25 min) · Barba 9€ (20 min) · Corte + Barba 20€ (40 min) · Sobrancelha 5€ (10 min) · Completo 32€ (55 min)</p>
      <p><strong>Ana (Intermédio)</strong><br>
      Corte 15€ (30 min) · Barba 10€ (20 min) · Corte + Barba 22€ (45 min) · Sobrancelha 5€ (10 min) · Completo 35€ (60 min)</p>
      <p><strong>Manuel (Premium)</strong><br>
      Corte 18€ (35 min) · Barba 12€ (25 min) · Corte + Barba 26€ (55 min) · Sobrancelha 6€ (10 min) · Completo 42€ (70 min)</p>
      <ul style="list-style: none; padding: 0;">
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">João Pedro</strong><br>
          Perfil económico
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Ana</strong><br>
          Perfil intermédio
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Manuel</strong><br>
          Perfil premium
        </li>
      </ul>
      <p><strong>Horário de funcionamento:</strong> 09:00 - 19:00</p>
      <a href="bookings.html" class="help-action-btn">Fazer Marcação</a>
      <button class="help-back-btn" onclick="showHelpOptions()">← Voltar</button>
    `,
  },
  admin: {
    title: "Acesso de Administrador",
    content: `
      <h3>Painel de Administração</h3>
      <p><strong>Se é administrador da barbearia:</strong></p>
      <ol>
        <li><strong>Clique em "Entrar como Admin"</strong></li>
        <li><strong>Faça login com suas credenciais</strong></li>
        <li><strong>Acesse o painel de gestão</strong> onde pode:
          <ul>
            <li>Registar e gerir barbeiros</li>
            <li>Ver todas as marcações</li>
            <li>Gerir clientes</li>
            <li>Cancelar marcações</li>
          </ul>
        </li>
      </ol>
      <p><strong>Nota:</strong> Apenas 1 administrador é permitido no sistema por motivos de segurança.</p>
      <a href="admin-login.html" class="help-action-btn">Login Admin</a>
      <button class="help-back-btn" onclick="showHelpOptions()">← Voltar</button>
    `,
  },
}

// Only add event listeners if elements exist
const helpButton = document.getElementById("helpButton")
const helpModal = document.getElementById("helpModal")
const closeHelp = document.querySelector(".close-help")
const helpContent = document.getElementById("helpContent")
const helpOptions = document.querySelectorAll(".help-option-btn")

if (helpButton) {
  helpButton.addEventListener("click", () => {
    helpModal.classList.add("active")
    showHelpOptions()
  })
}

if (closeHelp) {
  closeHelp.addEventListener("click", () => {
    helpModal.classList.remove("active")
  })
}

if (helpModal) {
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove("active")
    }
  })
}

if (helpOptions.length > 0) {
  helpOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
      const helpType = btn.dataset.help
      showHelpContent(helpType)
    })
  })
}

// Declare help elements for functions
function showHelpOptions() {
  const helpOptions_elem = document.querySelector(".help-options")
  if (helpOptions_elem) {
    helpOptions_elem.style.display = "flex"
  }
  if (helpContent) {
    helpContent.classList.remove("active")
    helpContent.innerHTML = ""
  }
}

function showHelpContent(type) {
  const help = helpTexts[type]
  const helpOptions_elem = document.querySelector(".help-options")
  if (helpOptions_elem) {
    helpOptions_elem.style.display = "none"
  }
  if (helpContent && help) {
    helpContent.innerHTML = help.content
    helpContent.classList.add("active")
  }
}

window.showHelpOptions = showHelpOptions

// Tab functionality for index.html
function initTabs() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('Initializing tabs - Links found:', tabLinks.length, 'Contents found:', tabContents.length);
  
  if (tabLinks.length === 0) {
    console.warn('No tab links found!');
    return;
  }

  tabLinks.forEach((link, index) => {
    console.log(`Tab ${index}:`, link.getAttribute('data-tab'), link);
    
    link.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const targetTab = this.getAttribute('data-tab');
      console.log('Tab clicked:', targetTab);
      
      // Remove active class from all tabs and contents
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      this.classList.add('active');
      console.log('Tab classes after click:', this.className);
      
      const targetContent = document.getElementById(targetTab);
      console.log('Target content element:', targetContent);
      
      if (targetContent) {
        targetContent.classList.add('active');
        console.log('Content classes after click:', targetContent.className);
      } else {
        console.warn('Content element not found for tab:', targetTab);
      }
    });
  });
}

function initActionMenu() {
  const menuButton = document.getElementById('actionMenuButton')
  const actionSheet = document.getElementById('actionSheet')
  const actionSheetBackdrop = document.getElementById('actionSheetBackdrop')
  const actionSheetClose = document.getElementById('actionSheetClose')

  if (!menuButton || !actionSheet) return

  if (menuButton.dataset.actionMenuBound === 'true') return
  menuButton.dataset.actionMenuBound = 'true'

  const closeSheet = () => {
    actionSheet.classList.remove('active')
    actionSheet.setAttribute('aria-hidden', 'true')
    menuButton.setAttribute('aria-expanded', 'false')
  }

  const openSheet = () => {
    actionSheet.classList.add('active')
    actionSheet.setAttribute('aria-hidden', 'false')
    menuButton.setAttribute('aria-expanded', 'true')
  }

  const toggleSheet = () => {
    if (actionSheet.classList.contains('active')) {
      closeSheet()
    } else {
      openSheet()
    }
  }

  // Fallback global handlers for inline onclick attributes.
  window.openActionSheet = openSheet
  window.closeActionSheet = closeSheet
  window.toggleActionSheet = toggleSheet

  menuButton.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    toggleSheet()
  })

  if (actionSheetBackdrop) {
    actionSheetBackdrop.addEventListener('click', closeSheet)
  }
  if (actionSheetClose) {
    actionSheetClose.addEventListener('click', closeSheet)
  }

  document.addEventListener('click', (e) => {
    if (!actionSheet.classList.contains('active')) return
    if (actionSheet.contains(e.target) || menuButton.contains(e.target)) return
    closeSheet()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSheet()
    }
  })
}

function initDownloadSiteButton() {
  const downloadButton = document.getElementById('downloadSiteBtn')
  if (!downloadButton) return

  downloadButton.addEventListener('click', () => {
    const siteUrl = `${window.location.origin}/index.html`
    const fileContent = [
      'Barbearia Joao Castro',
      '',
      `Site: ${siteUrl}`,
      'Instagram: @joaocastro.barbearia',
      'Telefone: 937 277 447',
      'Email: joaoguilhermesftc88@gmail.com',
      '',
      'Abra o link do site para fazer a sua marcacao online.'
    ].join('\n')

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'barbearia-joao-castro-site.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  })
}

function initCutsGallery() {
  const cards = document.querySelectorAll('.cut-card')
  const modal = document.getElementById('cutGalleryModal')
  const backdrop = document.getElementById('cutGalleryBackdrop')
  const closeBtn = document.getElementById('cutGalleryClose')
  const titleEl = document.getElementById('cutGalleryTitle')
  const subtitleEl = document.getElementById('cutGallerySubtitle')
  const gridEl = document.getElementById('cutGalleryGrid')

  if (!cards.length || !modal || !backdrop || !closeBtn || !titleEl || !subtitleEl || !gridEl) return
  if (modal.dataset.bound === 'true') return
  modal.dataset.bound = 'true'

  const galleries = {
    hair: [
      { name: 'Clássico Curto', image: 'https://images.pexels.com/photos/1453005/pexels-photo-1453005.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Degradé Alto', image: 'https://images.pexels.com/photos/2076932/pexels-photo-2076932.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Crop Texturizado', image: 'https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Pompadour Moderno', image: 'https://images.pexels.com/photos/897270/pexels-photo-897270.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Mid Fade', image: 'https://images.pexels.com/photos/1319461/pexels-photo-1319461.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Corte Social', image: 'https://images.pexels.com/photos/1570807/pexels-photo-1570807.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    beard: [
      { name: 'Contorno Definido', image: 'https://images.pexels.com/photos/1805600/pexels-photo-1805600.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Barba Curta Alinhada', image: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Barba Completa', image: 'https://images.pexels.com/photos/3998417/pexels-photo-3998417.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Bigode + Barba', image: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Fade na Barba', image: 'https://images.pexels.com/photos/1342609/pexels-photo-1342609.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Acabamento Navalha', image: 'https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  }

  const closeModal = () => {
    modal.classList.remove('active')
    modal.setAttribute('aria-hidden', 'true')
  }

  const openModal = (title, category) => {
    const items = galleries[category] || galleries.hair
    titleEl.textContent = title
    subtitleEl.textContent = category === 'beard'
      ? 'Inspirações de barba e acabamento para o seu próximo visual.'
      : 'Inspirações de cortes de cabelo para escolher o seu estilo.'

    gridEl.innerHTML = items.map((item) => `
      <article class="cut-gallery-item">
        <img src="${item.image}" alt="${item.name}">
        <p>${item.name}</p>
      </article>
    `).join('')

    modal.classList.add('active')
    modal.setAttribute('aria-hidden', 'false')
  }

  cards.forEach((card) => {
    const title = card.dataset.cutTitle || 'Galeria de cortes'
    const category = card.dataset.cutCategory || 'hair'

    const open = () => openModal(title, category)
    card.addEventListener('click', open)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    })
  })

  backdrop.addEventListener('click', closeModal)
  closeBtn.addEventListener('click', closeModal)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal()
    }
  })
}

function initTeamQuickBooking() {
  const teamMembers = document.querySelectorAll('.team-member')
  if (!teamMembers.length) return
  const isBarberSession = sessionStorage.getItem('isBarber') === 'true'

  teamMembers.forEach((member) => {
    if (member.dataset.quickBookingBound === 'true') return
    member.dataset.quickBookingBound = 'true'

    const nameEl = member.querySelector('h3')
    const barberName = nameEl?.textContent?.trim()
    if (!barberName) return

    if (isBarberSession) {
      member.style.cursor = 'default'
      member.removeAttribute('role')
      member.removeAttribute('tabindex')
      member.removeAttribute('aria-label')
      return
    }

    member.style.cursor = 'pointer'
    member.setAttribute('role', 'button')
    member.setAttribute('tabindex', '0')
    member.setAttribute('aria-label', `Marcar com ${barberName}`)

    const goToBooking = () => {
      const isClientSession = sessionStorage.getItem('isClient') === 'true'
      if (!isClientSession) {
        sessionStorage.setItem('pendingBookingBarber', barberName)
        window.location.href = `login.html?barber=${encodeURIComponent(barberName)}`
        return
      }

      const url = `bookings.html?barber=${encodeURIComponent(barberName)}`
      window.location.href = url
    }

    member.addEventListener('click', goToBooking)
    member.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goToBooking()
      }
    })
  })
}

function normalizePersonName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const TEAM_BARBER_SCHEDULES = {
  ana: { start: '09:00', end: '18:00', lunchStart: '13:00', lunchEnd: '14:00' },
  'joao pedro': { start: '09:00', end: '19:00', lunchStart: '12:30', lunchEnd: '13:30' },
  manuel: { start: '10:00', end: '19:00', lunchStart: '14:00', lunchEnd: '15:00' },
}

function getConfiguredTeamSchedule(barberName) {
  const normalizedName = normalizePersonName(barberName)
  if (TEAM_BARBER_SCHEDULES[normalizedName]) return TEAM_BARBER_SCHEDULES[normalizedName]

  const keys = Object.keys(TEAM_BARBER_SCHEDULES)
  const partialMatch = keys.find((key) => normalizedName.includes(key) || key.includes(normalizedName))
  if (!partialMatch) return null

  return TEAM_BARBER_SCHEDULES[partialMatch]
}

async function initTeamSchedules() {
  const members = document.querySelectorAll('.team-member[data-barber-name]')
  if (!members.length) return

  try {
    const snapshot = await get(ref(database, 'barbers'))
    if (!snapshot.exists()) return

    const barbers = Object.values(snapshot.val() || {})

    members.forEach((member) => {
      const barberName = member.getAttribute('data-barber-name') || ''
      const scheduleEl = member.querySelector('.member-schedule')
      const lunchEl = member.querySelector('.member-lunch')
      if (!barberName || !scheduleEl) return

      const normalizedBarberName = normalizePersonName(barberName)
      const barber = barbers.find((item) => {
        const candidate = normalizePersonName(item?.name)
        if (!candidate) return false
        return candidate.includes(normalizedBarberName) || normalizedBarberName.includes(candidate)
      })

      const configured = getConfiguredTeamSchedule(barberName)
      const start = configured?.start || barber?.workingHours?.start || null
      const end = configured?.end || barber?.workingHours?.end || null

      scheduleEl.textContent = start && end ? `Horario: ${start} - ${end}` : 'Horario: a definir'

      if (lunchEl) {
        const lunchStart = configured?.lunchStart || barber?.lunchBreak?.start || null
        const lunchEnd = configured?.lunchEnd || barber?.lunchBreak?.end || null
        lunchEl.textContent = lunchStart && lunchEnd ? `Almoco: ${lunchStart} - ${lunchEnd}` : 'Almoco: a definir'
      }
    })
  } catch (error) {
    console.error('Erro ao carregar horarios da equipa:', error)
  }
}

function updateMainAuthButton() {
  const mainAuthCta = document.getElementById('mainAuthCta')
  const mainLogoutBtn = document.getElementById('mainLogoutBtn')
  if (!mainAuthCta) return

  const setLoggedOut = () => {
    mainAuthCta.href = 'login.html'
    mainAuthCta.textContent = 'Login'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'none'
    }
  }

  const setLoggedIn = () => {
    mainAuthCta.href = 'bookings.html'
    mainAuthCta.innerHTML = '<i class="bi bi-calendar-check" aria-hidden="true"></i> Marcar'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'inline-flex'
    }
  }

  const setBarberLoggedIn = () => {
    mainAuthCta.href = 'barber-panel.html'
    mainAuthCta.innerHTML = '<i class="bi bi-journal-check" aria-hidden="true"></i> Ver marcações dos clientes'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'inline-flex'
    }
  }

  if (mainLogoutBtn && mainLogoutBtn.dataset.bound !== 'true') {
    mainLogoutBtn.dataset.bound = 'true'
    mainLogoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth)
      } catch (error) {
        console.error('Erro ao terminar sessão:', error)
      }

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

      window.location.href = 'index.html'
    })
  }

  if (sessionStorage.getItem('isBarber') === 'true') {
    setBarberLoggedIn()
  } else if (sessionStorage.getItem('isClient') === 'true') {
    setLoggedIn()
  } else {
    setLoggedOut()
  }

  onAuthStateChanged(auth, (user) => {
    if (user && sessionStorage.getItem('isBarber') === 'true') {
      setBarberLoggedIn()
      return
    }

    if (user && sessionStorage.getItem('isClient') === 'true') {
      setLoggedIn()
      return
    }

    setLoggedOut()
  })
}

function timeToMinutes(timeStr) {
  const [hour, minute] = String(timeStr || '00:00').split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function getIsoWeekKey(dateObj) {
  const utcDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getDateString(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}

function normalizeSpecialSchedules(value) {
  return {
    day: value?.day || {},
    week: value?.week || {},
    month: value?.month || {},
  }
}

function getStoreSpecialScheduleForNow(now, settings) {
  const special = normalizeSpecialSchedules(settings?.specialSchedules)
  const dayKey = getDateString(now)
  const weekKey = getIsoWeekKey(now)
  const monthKey = dayKey.slice(0, 7)

  const daySchedule = special.day?.[dayKey]
  if (daySchedule?.start && daySchedule?.end) return daySchedule

  const weekSchedule = special.week?.[weekKey]
  if (weekSchedule?.start && weekSchedule?.end) return weekSchedule

  const monthSchedule = special.month?.[monthKey]
  if (monthSchedule?.start && monthSchedule?.end) return monthSchedule

  return null
}

async function initStoreStatusBadge() {
  const badge = document.getElementById('storeStatusBadge')
  if (!badge) return

  const fallbackOpen = [1, 2, 3, 4, 5]
  const fallbackOpening = { start: '09:00', end: '19:00' }

  try {
    const snapshot = await get(ref(database, 'storeSettings'))
    const settings = snapshot.exists() ? snapshot.val() : {}
    const now = new Date()
    const specialSchedule = getStoreSpecialScheduleForNow(now, settings)

    const openDays = Array.isArray(settings.openDays) && settings.openDays.length ? settings.openDays : fallbackOpen
    const openingStart = specialSchedule?.start || settings.openingHours?.start || fallbackOpening.start
    const openingEnd = specialSchedule?.end || settings.openingHours?.end || fallbackOpening.end
    const lunchStart = settings.lunchBreak?.start || '13:00'
    const lunchEnd = settings.lunchBreak?.end || '14:00'

    const currentDay = now.getDay()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const isOpenDay = specialSchedule ? true : openDays.includes(currentDay)
    const isInsideOpening = currentMinutes >= timeToMinutes(openingStart) && currentMinutes < timeToMinutes(openingEnd)
    const isLunchBreak = currentMinutes >= timeToMinutes(lunchStart) && currentMinutes < timeToMinutes(lunchEnd)
    const isOpen = isOpenDay && isInsideOpening && !isLunchBreak

    badge.textContent = isOpen ? 'Aberto' : 'Fechado'
    badge.classList.toggle('status-open', isOpen)
    badge.classList.toggle('status-closed', !isOpen)
  } catch (error) {
    console.error('Erro ao atualizar estado da loja:', error)
  }
}

// Initialize tabs when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabs);
  document.addEventListener('DOMContentLoaded', initActionMenu);
  document.addEventListener('DOMContentLoaded', initDownloadSiteButton);
  document.addEventListener('DOMContentLoaded', initCutsGallery);
  document.addEventListener('DOMContentLoaded', initTeamQuickBooking);
  document.addEventListener('DOMContentLoaded', initTeamSchedules);
  document.addEventListener('DOMContentLoaded', updateMainAuthButton);
  document.addEventListener('DOMContentLoaded', initStoreStatusBadge);
} else {
  initTabs();
  initActionMenu();
  initDownloadSiteButton();
  initCutsGallery();
  initTeamQuickBooking();
  initTeamSchedules();
  updateMainAuthButton();
  initStoreStatusBadge();
}

// Also initialize on load
window.addEventListener('load', initTabs);
window.addEventListener('load', initActionMenu);
window.addEventListener('load', initDownloadSiteButton);
window.addEventListener('load', initCutsGallery);
window.addEventListener('load', initTeamQuickBooking);
window.addEventListener('load', initTeamSchedules);
window.addEventListener('load', updateMainAuthButton);
window.addEventListener('load', initStoreStatusBadge);
