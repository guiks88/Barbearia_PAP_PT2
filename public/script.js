import { auth, database } from "./firebase-config.js"
import { ref, get, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError, installMojibakeAutoFix, updateClientAreaNav } from "./utils.js"

const helpTexts = {
  register: {
    title: "Como me registo?",
    content: `
      <h3>Registo de Cliente - Passo a Passo</h3>
      <ol>
        <li><strong>Clique em "Registar como Cliente"</strong> na pÃ¡gina inicial</li>
        <li><strong>Preencha os seus dados:</strong>
          <ul>
            <li>Nome completo</li>
            <li>Email (serÃ¡ usado para login)</li>
            <li>Telefone (9 dÃ­gitos)</li>
            <li>Senha (mÃ­nimo 6 caracteres)</li>
          </ul>
        </li>
        <li><strong>Clique em "Registar"</strong></li>
        <li><strong>SerÃ¡ automaticamente redirecionado</strong> para a pÃ¡gina de marcaÃ§Ãµes</li>
      </ol>
      <p><strong>Dica:</strong> ApÃ³s o registo, jÃ¡ pode fazer marcaÃ§Ãµes imediatamente!</p>
      <a href="client-register.html" class="help-action-btn">Registar Agora</a>
      <button class="help-back-btn" onclick="showHelpOptions()">â† Voltar</button>
    `,
  },
  booking: {
    title: "Como faÃ§o uma marcaÃ§Ã£o?",
    content: `
      <h3>Fazer uma MarcaÃ§Ã£o - Passo a Passo</h3>
      <ol>
        <li><strong>FaÃ§a login na pÃ¡gina de marcaÃ§Ãµes</strong> usando seu email/nome e senha</li>
        <li><strong>Escolha o serviÃ§o desejado:</strong>
          <ul>
            <li>Corte de Cabelo - 15â‚¬ (30 min)</li>
            <li>Barba - 10â‚¬ (20 min)</li>
            <li>Corte + Barba - 22â‚¬ (45 min)</li>
            <li>Sobrancelha - 5â‚¬ (10 min)</li>
            <li>Pacote Completo - 35â‚¬ (60 min)</li>
          </ul>
        </li>
        <li><strong>Selecione o barbeiro</strong> da sua preferÃªncia</li>
        <li><strong>Escolha a data e horÃ¡rio</strong> disponÃ­veis</li>
        <li><strong>Confirme a marcaÃ§Ã£o</strong></li>
      </ol>
      <p><strong>Importante:</strong> O sistema verifica automaticamente a disponibilidade do barbeiro!</p>
      <a href="bookings.html" class="help-action-btn">Fazer MarcaÃ§Ã£o</a>
      <button class="help-back-btn" onclick="showHelpOptions()">â† Voltar</button>
    `,
  },
  login: {
    title: "Como faÃ§o login?",
    content: `
      <h3>Login de Cliente</h3>
      <p><strong>Se jÃ¡ tem uma conta registada:</strong></p>
      <ol>
        <li><strong>VÃ¡ para "Fazer MarcaÃ§Ã£o"</strong> na pÃ¡gina inicial</li>
        <li><strong>Insira o seu email ou nome</strong> (ambos funcionam)</li>
        <li><strong>Insira a sua senha</strong></li>
        <li><strong>Clique em "Autenticar"</strong></li>
      </ol>
      <p><strong>Esqueceu a senha?</strong> Entre em contacto com a barbearia para redefinir.</p>
      <p><strong>Ainda nÃ£o tem conta?</strong> FaÃ§a o registo primeiro!</p>
      <a href="bookings.html" class="help-action-btn">Ir para Login</a>
      <button class="help-back-btn" onclick="showHelpOptions()">â† Voltar</button>
    `,
  },
  prices: {
    title: "Tabela de PreÃ§os",
    content: `
      <h3>ServiÃ§os e PreÃ§os por Barbeiro</h3>
      <p><strong>JoÃ£o Pedro (EconÃ³mico)</strong><br>
      Corte 14â‚¬ (25 min) Â· Barba 9â‚¬ (20 min) Â· Corte + Barba 20â‚¬ (40 min) Â· Sobrancelha 5â‚¬ (10 min) Â· Completo 32â‚¬ (55 min)</p>
      <p><strong>Ana (IntermÃ©dio)</strong><br>
      Corte 15â‚¬ (30 min) Â· Barba 10â‚¬ (20 min) Â· Corte + Barba 22â‚¬ (45 min) Â· Sobrancelha 5â‚¬ (10 min) Â· Completo 35â‚¬ (60 min)</p>
      <p><strong>Manuel (Premium)</strong><br>
      Corte 18â‚¬ (35 min) Â· Barba 12â‚¬ (25 min) Â· Corte + Barba 26â‚¬ (55 min) Â· Sobrancelha 6â‚¬ (10 min) Â· Completo 42â‚¬ (70 min)</p>
      <ul style="list-style: none; padding: 0;">
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">JoÃ£o Pedro</strong><br>
          Perfil econÃ³mico
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Ana</strong><br>
          Perfil intermÃ©dio
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Manuel</strong><br>
          Perfil premium
        </li>
      </ul>
      <p><strong>HorÃ¡rio de funcionamento:</strong> 09:00 - 19:00</p>
      <a href="bookings.html" class="help-action-btn">Fazer MarcaÃ§Ã£o</a>
      <button class="help-back-btn" onclick="showHelpOptions()">â† Voltar</button>
    `,
  },
  admin: {
    title: "Acesso de Administrador",
    content: `
      <h3>Painel de AdministraÃ§Ã£o</h3>
      <p><strong>Se Ã© administrador da barbearia:</strong></p>
      <ol>
        <li><strong>Clique em "Entrar como Admin"</strong></li>
        <li><strong>FaÃ§a login com suas credenciais</strong></li>
        <li><strong>Acesse o painel de gestÃ£o</strong> onde pode:
          <ul>
            <li>Registar e gerir barbeiros</li>
            <li>Ver todas as marcaÃ§Ãµes</li>
            <li>Gerir clientes</li>
            <li>Cancelar marcaÃ§Ãµes</li>
          </ul>
        </li>
      </ol>
      <p><strong>Nota:</strong> Apenas 1 administrador Ã© permitido no sistema por motivos de seguranÃ§a.</p>
      <a href="admin-login.html" class="help-action-btn">Login Admin</a>
      <button class="help-back-btn" onclick="showHelpOptions()">â† Voltar</button>
    `,
  },
}

let teamSchedulesListenerBound = false
let promotionsListenerBound = false
let storeHoursListenerBound = false
let teamStatsListenerBound = false
let haircutsListenerBound = false
let logoListenerBound = false
let teamStatsPollIntervalId = null
let shopProductsCache = []
let featuredProductsCache = []
let cartState = {}
let productsListenerBound = false
let cartNoticeCount = loadCartNoticeCount()

installMojibakeAutoFix()

const PAP_IMPORTED_PRODUCTS = []

const PAP_FALLBACK_PRODUCTS = []

function getSafeStock(product) {
  return Math.max(0, Number(product?.stock || 0))
}

function formatEuro(value) {
  return `${Number(value || 0).toFixed(2)}â‚¬`
}

function getCartQuantityForProduct(productId) {
  if (!productId) return 0
  return Math.max(0, Number(cartState?.[productId]?.qty || 0))
}

function getAvailableStockForProduct(product) {
  const stock = getSafeStock(product)
  const alreadyInCart = getCartQuantityForProduct(product?.id)
  return Math.max(0, stock - alreadyInCart)
}

function getPendingShopProductId() {
  const fromSession = (sessionStorage.getItem('pendingShopProductId') || '').trim()
  if (fromSession) return fromSession
  const fromQuery = (new URLSearchParams(window.location.search).get('product') || '').trim()
  return fromQuery
}

function isClientLoggedInForCart() {
  return sessionStorage.getItem('isClient') === 'true' && !!auth.currentUser
}

function updateCartBadge() {
  const badgeEl = document.getElementById('cartBadge')
  if (!badgeEl) return
  badgeEl.textContent = String(cartNoticeCount)
  badgeEl.classList.toggle('hidden', cartNoticeCount <= 0)
}

function loadCartNoticeCount() {
  try {
    return Math.max(0, Number(localStorage.getItem('cartNoticeCount') || 0))
  } catch (error) {
    console.warn('Erro ao carregar notificações do carrinho:', error)
    return 0
  }
}

function saveCartNoticeCount() {
  try {
    localStorage.setItem('cartNoticeCount', String(cartNoticeCount))
  } catch (error) {
    console.warn('Erro ao guardar notificações do carrinho:', error)
  }
}

function incrementCartNotice(amount = 1) {
  const cartPanel = document.getElementById('shopCartPanel')
  if (cartPanel && !cartPanel.classList.contains('hidden')) {
    return
  }
  cartNoticeCount = Math.max(0, cartNoticeCount + Math.max(0, amount))
  saveCartNoticeCount()
  updateCartBadge()
}

function clearCartNotice() {
  cartNoticeCount = 0
  saveCartNoticeCount()
  updateCartBadge()
}

function redirectToLoginForProduct(productId) {
  if (!productId) return
  sessionStorage.setItem('pendingShopProductId', productId)
  window.location.href = `login.html?product=${encodeURIComponent(productId)}`
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

  const activateTab = (targetTab, activeLink = null) => {
    if (!targetTab) return

    tabLinks.forEach(l => l.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const targetLink = activeLink || Array.from(tabLinks).find((l) => l.getAttribute('data-tab') === targetTab)
    if (targetLink) {
      targetLink.classList.add('active')
    }

    const targetContent = document.getElementById(targetTab);
    if (targetContent) {
      targetContent.classList.add('active');
    } else {
      console.warn('Content element not found for tab:', targetTab);
    }
  }

  tabLinks.forEach((link, index) => {
    console.log(`Tab ${index}:`, link.getAttribute('data-tab'), link);
    
    link.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const targetTab = this.getAttribute('data-tab');
      console.log('Tab clicked:', targetTab);
      
      activateTab(targetTab, this)
      console.log('Tab classes after click:', this.className);
      const targetContent = document.getElementById(targetTab);
      console.log('Target content element:', targetContent);
    });
  });

  const params = new URLSearchParams(window.location.search)
  const queryTab = params.get('tab')
  const hashTab = window.location.hash.replace('#', '').trim()
  const initialTab = (queryTab || hashTab || '').trim()
  if (initialTab) {
    activateTab(initialTab)
  }
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

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }

  const tempInput = document.createElement('textarea')
  tempInput.value = text
  tempInput.setAttribute('readonly', '')
  tempInput.style.position = 'absolute'
  tempInput.style.left = '-9999px'
  document.body.appendChild(tempInput)
  tempInput.select()

  const success = document.execCommand('copy')
  tempInput.remove()

  if (success) {
    return Promise.resolve()
  }

  return Promise.reject(new Error('Copy failed'))
}

function initContactCopyActions() {
  const items = document.querySelectorAll('.action-sheet-item[data-copy-text]')
  if (!items.length) return

  items.forEach((item) => {
    if (item.dataset.copyBound === 'true') return
    item.dataset.copyBound = 'true'

    item.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      const textToCopy = item.dataset.copyText || item.textContent.trim()
      const label = item.dataset.copyLabel || 'Contacto'

      try {
        await copyTextToClipboard(textToCopy)
        showSuccess(`${label} copiado.`)
      } catch (error) {
        console.error('Erro ao copiar contacto:', error)
        showError('Nao foi possivel copiar o contacto.')
      }
    })
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
      { name: 'ClÃ¡ssico Curto', image: 'https://images.pexels.com/photos/1453005/pexels-photo-1453005.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'DegradÃ© Alto', image: 'https://images.pexels.com/photos/2076932/pexels-photo-2076932.jpeg?auto=compress&cs=tinysrgb&w=600' },
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
      ? 'InspiraÃ§Ãµes de barba e acabamento para o seu prÃ³ximo visual.'
      : 'InspiraÃ§Ãµes de cortes de cabelo para escolher o seu estilo.'

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
    const nameEl = member.querySelector('h3')
    const barberName = nameEl?.textContent?.trim()
    const bookButton = member.querySelector('.team-book-btn')
    if (!barberName || !bookButton) return
    if (bookButton.dataset.quickBookingBound === 'true') return
    bookButton.dataset.quickBookingBound = 'true'

    if (isBarberSession) {
      bookButton.disabled = true
      bookButton.textContent = 'Indisponivel'
      return
    }

    bookButton.setAttribute('aria-label', `Marcar com ${barberName}`)

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

    bookButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      goToBooking()
    })
  })
}

function initTeamFlipCards() {
  const teamMembers = document.querySelectorAll('.team-member')
  if (!teamMembers.length) return

  const isTouchDevice = window.matchMedia('(hover: none)').matches
  if (!isTouchDevice) return

  let activeMember = null

  teamMembers.forEach((member) => {
    if (member.dataset.flipBound === 'true') return
    member.dataset.flipBound = 'true'

    member.addEventListener('click', (e) => {
      if (e.target.closest('.team-book-btn')) return
      if (activeMember && activeMember !== member) {
        activeMember.classList.remove('is-flipped')
      }

      if (member.classList.contains('is-flipped')) {
        member.classList.remove('is-flipped')
        activeMember = null
        return
      }

      member.classList.add('is-flipped')
      activeMember = member
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

function isUserLoggedIn() {
  return (
    sessionStorage.getItem('isClient') === 'true' ||
    sessionStorage.getItem('isBarber') === 'true' ||
    sessionStorage.getItem('isAdmin') === 'true' ||
    Boolean(auth.currentUser)
  )
}

const TEAM_BARBER_SCHEDULES = {
  ana: { start: '09:00', end: '18:00', lunchStart: '13:00', lunchEnd: '14:00' },
  'joao pedro': { start: '09:00', end: '19:00', lunchStart: '12:30', lunchEnd: '13:30' },
  manuel: { start: '10:00', end: '19:00', lunchStart: '14:00', lunchEnd: '15:00' },
}

const TEAM_FALLBACK_IMAGES = {
  manuel: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&h=120&fit=crop',
  ana: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&h=120&fit=crop',
  'joao pedro': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=120&h=120&fit=crop',
}

const DEFAULT_TEAM_IMAGE = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&h=120&fit=crop'

const DEFAULT_SERVICE_LIST = [
  { id: 'corte', name: 'Corte de Cabelo', price: 15, duration: 30 },
  { id: 'barba', name: 'Barba', price: 10, duration: 20 },
  { id: 'corte-barba', name: 'Corte + Barba', price: 22, duration: 45 },
  { id: 'sobrancelha', name: 'Sobrancelha', price: 5, duration: 10 },
  { id: 'completo', name: 'Pacote Completo', price: 35, duration: 60 },
]

const DEFAULT_TEAM_BARBERS = [
  {
    id: 'joao-pedro',
    name: 'João Pedro',
    specialty: 'Económico',
    description: 'Servico rapido e economico para quem quer eficiencia no dia a dia',
    imageUrl: TEAM_FALLBACK_IMAGES['joao pedro'],
    workingHours: { start: '09:00', end: '19:00' },
    lunchBreak: { start: '12:30', end: '13:30' },
    services: [
      { id: 'corte', name: 'Corte de Cabelo', price: 14, duration: 25 },
      { id: 'barba', name: 'Barba', price: 9, duration: 20 },
      { id: 'corte-barba', name: 'Corte + Barba', price: 20, duration: 40 },
      { id: 'sobrancelha', name: 'Sobrancelha', price: 5, duration: 10 },
      { id: 'completo', name: 'Pacote Completo', price: 32, duration: 55 },
    ],
  },
  {
    id: 'ana',
    name: 'Ana',
    specialty: 'Intermédio',
    description: 'Ritmo intermedio com equilibrio entre precisao, tempo e preco',
    imageUrl: TEAM_FALLBACK_IMAGES.ana,
    workingHours: { start: '09:00', end: '18:00' },
    lunchBreak: { start: '13:00', end: '14:00' },
    services: [
      { id: 'corte', name: 'Corte de Cabelo', price: 15, duration: 30 },
      { id: 'barba', name: 'Barba', price: 10, duration: 20 },
      { id: 'corte-barba', name: 'Corte + Barba', price: 22, duration: 45 },
      { id: 'sobrancelha', name: 'Sobrancelha', price: 5, duration: 10 },
      { id: 'completo', name: 'Pacote Completo', price: 35, duration: 60 },
    ],
  },
  {
    id: 'manuel',
    name: 'Manuel',
    specialty: 'Premium',
    description: 'Cortes premium, mais demorados e com acabamento de alto detalhe',
    imageUrl: TEAM_FALLBACK_IMAGES.manuel,
    workingHours: { start: '10:00', end: '19:00' },
    lunchBreak: { start: '14:00', end: '15:00' },
    services: [
      { id: 'corte', name: 'Corte de Cabelo', price: 18, duration: 35 },
      { id: 'barba', name: 'Barba', price: 12, duration: 25 },
      { id: 'corte-barba', name: 'Corte + Barba', price: 26, duration: 55 },
      { id: 'sobrancelha', name: 'Sobrancelha', price: 6, duration: 10 },
      { id: 'completo', name: 'Pacote Completo', price: 42, duration: 70 },
    ],
  },
]

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeServiceId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeBarberServices(services) {
  if (!Array.isArray(services) || !services.length) {
    return DEFAULT_SERVICE_LIST.map((service) => ({ ...service }))
  }

  const normalized = services
    .map((service, index) => {
      const name = String(service?.name || '').trim()
      const price = Number(service?.price || 0)
      const duration = Number(service?.duration || 0)
      const id = String(service?.id || normalizeServiceId(name) || `service_${index}`)
      return { id, name, price, duration }
    })
    .filter((service) => service.name && service.price > 0 && service.duration > 0)

  return normalized.length ? normalized : DEFAULT_SERVICE_LIST.map((service) => ({ ...service }))
}

function formatServicePrice(value) {
  const numericValue = Number(value || 0)
  if (!Number.isFinite(numericValue)) return '0€'
  return Number.isInteger(numericValue)
    ? `${numericValue}€`
    : `${numericValue.toFixed(2)}€`
}

function getFallbackTeamImage(barberName) {
  const normalized = normalizePersonName(barberName)
  if (TEAM_FALLBACK_IMAGES[normalized]) return TEAM_FALLBACK_IMAGES[normalized]

  const matchKey = Object.keys(TEAM_FALLBACK_IMAGES).find((key) => {
    return normalized.includes(key) || key.includes(normalized)
  })
  if (matchKey) return TEAM_FALLBACK_IMAGES[matchKey]

  return DEFAULT_TEAM_IMAGE
}

function getBarberDescription(barber) {
  return (
    barber?.note ||
    barber?.nota ||
    barber?.description ||
    barber?.descricao ||
    barber?.bio ||
    barber?.specialty ||
    'Barbeiro profissional'
  )
}

function getBarberSchedule(barber) {
  const configured = getConfiguredTeamSchedule(barber?.name || '')
  return {
    start: barber?.workingHours?.start || configured?.start || null,
    end: barber?.workingHours?.end || configured?.end || null,
    lunchStart: barber?.lunchBreak?.start || configured?.lunchStart || null,
    lunchEnd: barber?.lunchBreak?.end || configured?.lunchEnd || null,
  }
}

function buildTeamStatsFromBarbers(barbers) {
  const stats = {}
  barbers.forEach((barber) => {
    const key = normalizePersonName(barber?.name || barber?.nome || '')
    if (!key) return

    const ratingCount = Number(barber?.ratingCount ?? barber?.ratingsCount ?? barber?.totalRatings ?? 0) || 0
    const averageRating = Number(barber?.avgRating ?? barber?.averageRating ?? barber?.ratingAverage ?? barber?.notaMedia ?? 0) || 0
    const ratingTotal = Number(barber?.ratingTotal ?? barber?.ratingSum ?? 0) || (ratingCount > 0 ? averageRating * ratingCount : 0)
    const completedCuts = Number(barber?.completedCuts ?? barber?.totalCuts ?? barber?.cortesFeitos ?? barber?.cutsCount ?? 0) || 0

    stats[key] = {
      ratingCount,
      ratingTotal,
      completedCuts,
    }
  })

  return stats
}

function buildPublicBarbersFromSnapshot(snapshot) {
  const raw = snapshot.exists() ? snapshot.val() : {}
  const allEntries = Object.entries(raw).filter(([, barber]) => barber)
  const activeEntries = allEntries.filter(([, barber]) => barber.isActive !== false)

  if (!activeEntries.length && allEntries.length === 0) {
    return { barbers: DEFAULT_TEAM_BARBERS.map((barber) => ({ ...barber })), usedFallback: true }
  }

  const barbers = activeEntries.map(([id, barber]) => ({ id, ...barber }))
  return { barbers, usedFallback: false }
}

function renderTeamMembers(barbers) {
  const grid = document.getElementById('teamGrid') || document.querySelector('.team-grid')
  if (!grid) return

  if (!barbers.length) {
    grid.innerHTML = '<div class="empty-state">Sem barbeiros ativos no momento.</div>'
    return
  }

  const sorted = [...barbers].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt'))

  grid.innerHTML = sorted
    .map((barber) => {
      const name = barber?.name || barber?.nome || 'Barbeiro'
      const imageUrl = barber?.imageUrl || barber?.photoUrl || barber?.avatarUrl || getFallbackTeamImage(name)
      const schedule = getBarberSchedule(barber)
      const scheduleLabel = schedule.start && schedule.end ? `Horario: ${schedule.start} - ${schedule.end}` : 'Horario: a definir'
      const lunchLabel = schedule.lunchStart && schedule.lunchEnd ? `Almoco: ${schedule.lunchStart} - ${schedule.lunchEnd}` : 'Almoco: a definir'
      const description = getBarberDescription(barber)

      return `
        <div class="team-member" data-barber-name="${escapeHtml(name)}">
          <div class="team-card-inner">
            <div class="team-card-face team-card-front">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" class="member-avatar">
              <h3>${escapeHtml(name)}</h3>
              <p class="member-role member-schedule">${escapeHtml(scheduleLabel)}</p>
              <p class="member-role member-lunch">${escapeHtml(lunchLabel)}</p>
            </div>
            <div class="team-card-face team-card-back">
              <p class="member-role member-description">${escapeHtml(description)}</p>
              <div class="member-public-stats">
                <p class="member-rating">
                  <i class="bi bi-star-fill" aria-hidden="true"></i>
                  <span class="member-rating-value" data-barber-rating>0.0</span>
                  <span class="member-rating-total">/5</span>
                  <span class="member-rating-count" data-barber-rating-count>(0 avaliacoes)</span>
                </p>
                <p class="member-cuts" data-barber-cuts>0 cortes concluidos</p>
              </div>
              <button type="button" class="btn btn-primary btn-small team-book-btn">Marcar</button>
            </div>
          </div>
        </div>
      `
    })
    .join('')
}

function renderPriceLists(barbers) {
  const container = document.getElementById('barberPricesList')
  if (!container) return

  if (!barbers.length) {
    container.innerHTML = '<div class="empty-state">Sem barbeiros ativos no momento.</div>'
    return
  }

  const sorted = [...barbers].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt'))

  container.innerHTML = sorted
    .map((barber, index) => {
      const name = barber?.name || barber?.nome || 'Barbeiro'
      const specialty = barber?.specialty || barber?.especialidade || ''
      const label = specialty ? `${name} (${specialty})` : name
      const services = normalizeBarberServices(barber?.services)
      const headingStyle = index === 0 ? '' : ' style="margin-top: 1.25rem;"'

      return `
        <h4 class="subsection-title"${headingStyle}>${escapeHtml(label)}</h4>
        <div class="services-list">
          ${services.map((service) => `
            <div class="service-item">
              <div class="service-info">
                <h4>${escapeHtml(service.name)}</h4>
                <p class="service-duration">${Number(service.duration || 0)} minutos</p>
              </div>
              <p class="service-price">${formatServicePrice(service.price)}</p>
            </div>
          `).join('')}
        </div>
      `
    })
    .join('')
}

function renderAboutContent(settings = {}) {
  const container = document.getElementById('aboutContent')
  if (!container) return

  if (!container.dataset.fallbackHtml) {
    container.dataset.fallbackHtml = container.innerHTML
  }

  const aboutText = String(settings?.aboutText || settings?.about || '').trim()
  if (!aboutText) {
    container.innerHTML = container.dataset.fallbackHtml
    return
  }

  container.innerHTML = ''
  aboutText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').trim())
    .filter(Boolean)
    .forEach((paragraph) => {
      const p = document.createElement('p')
      p.className = 'about-text'
      p.textContent = paragraph
      container.appendChild(p)
    })
}

function getConfiguredTeamSchedule(barberName) {
  const normalizedName = normalizePersonName(barberName)
  if (TEAM_BARBER_SCHEDULES[normalizedName]) return TEAM_BARBER_SCHEDULES[normalizedName]

  const keys = Object.keys(TEAM_BARBER_SCHEDULES)
  const partialMatch = keys.find((key) => normalizedName.includes(key) || key.includes(normalizedName))
  if (!partialMatch) return null

  return TEAM_BARBER_SCHEDULES[partialMatch]
}

function formatRatingValue(value) {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue.toFixed(1)
  }

  return '0.0'
}

function formatRatingCountLabel(count) {
  const safeCount = Math.max(0, Number(count) || 0)
  const label = safeCount === 1 ? 'avaliacao' : 'avaliacoes'
  return `(${safeCount} ${label})`
}

function formatCompletedCutsLabel(count) {
  const safeCount = Math.max(0, Number(count) || 0)
  const label = safeCount === 1 ? 'corte concluido' : 'cortes concluidos'
  return `${safeCount} ${label}`
}

function resolveTeamStatsKey(stats, barberName) {
  const normalizedName = normalizePersonName(barberName)
  if (stats[normalizedName]) return normalizedName

  const keys = Object.keys(stats)
  return keys.find((key) => normalizedName.includes(key) || key.includes(normalizedName)) || null
}

function computeStoreAverageFromStats(stats) {
  const perBarberAverages = Object.values(stats)
    .filter((entry) => Number(entry?.ratingCount || 0) > 0)
    .map((entry) => Number(entry.ratingTotal || 0) / Number(entry.ratingCount || 1))

  if (!perBarberAverages.length) return 0

  const sum = perBarberAverages.reduce((acc, value) => acc + value, 0)
  return sum / perBarberAverages.length
}

function applyTeamStatsToUi(members, stats) {
  const storeAverageEl = document.getElementById('storeAverageRating')
  if (storeAverageEl) {
    storeAverageEl.textContent = formatRatingValue(computeStoreAverageFromStats(stats))
  }

  members.forEach((member) => {
    const barberName = member.getAttribute('data-barber-name') || ''
    const statsKey = resolveTeamStatsKey(stats, barberName)
    const barberStats = statsKey ? stats[statsKey] : null

    const ratingCount = Math.max(0, Number(barberStats?.ratingCount || 0))
    const ratingAverage = ratingCount > 0
      ? Number(barberStats?.ratingTotal || 0) / ratingCount
      : 0
    const completedCuts = Math.max(0, Number(barberStats?.completedCuts || 0))

    const ratingValueEl = member.querySelector('[data-barber-rating]')
    const ratingCountEl = member.querySelector('[data-barber-rating-count]')
    const cutsEl = member.querySelector('[data-barber-cuts]')

    if (ratingValueEl) {
      ratingValueEl.textContent = formatRatingValue(ratingAverage)
    }

    if (ratingCountEl) {
      ratingCountEl.textContent = formatRatingCountLabel(ratingCount)
    }

    if (cutsEl) {
      cutsEl.textContent = formatCompletedCutsLabel(completedCuts)
    }
  })
}

async function loadTeamStatsFromBarbersFallback(members) {
  try {
    const snapshot = await get(ref(database, 'barbers'))
    if (!snapshot.exists()) return

    const stats = {}
    const entries = Object.values(snapshot.val() || {})
    entries.forEach((barber) => {
      const barberName = barber?.name || barber?.nome || ''
      const key = normalizePersonName(barberName)
      if (!key) return

      const ratingCount = Number(
        barber?.ratingCount ??
        barber?.ratingsCount ??
        barber?.totalRatings ??
        barber?.avaliacoesTotal ??
        0,
      ) || 0

      const averageRating = Number(
        barber?.avgRating ??
        barber?.averageRating ??
        barber?.ratingAverage ??
        barber?.notaMedia ??
        0,
      ) || 0

      const completedCuts = Number(
        barber?.completedCuts ??
        barber?.totalCuts ??
        barber?.cortesFeitos ??
        barber?.cutsCount ??
        0,
      ) || 0

      stats[key] = {
        ratingCount,
        ratingTotal: ratingCount > 0 ? averageRating * ratingCount : 0,
        completedCuts,
      }
    })

    applyTeamStatsToUi(members, stats)

    // Also apply public barber info (note/description) to the team cards when available
    try {
      const barbersByKey = {}
      entries.forEach((b) => {
        const nameKey = normalizePersonName(b?.name || b?.nome || '')
        if (nameKey) barbersByKey[nameKey] = b
      })

      members.forEach((member) => {
        const barberName = member.getAttribute('data-barber-name') || member.querySelector('h3')?.textContent || ''
        const key = normalizePersonName(barberName)
        let barber = barbersByKey[key]
        if (!barber) {
          barber = Object.values(barbersByKey).find((b) => {
            const candidate = normalizePersonName(b?.name || b?.nome || '')
            return candidate && (candidate.includes(key) || key.includes(candidate))
          })
        }

        const descEl = member.querySelector('.member-description')
        if (descEl) {
          const note = barber?.note || barber?.nota || barber?.description || barber?.descricao || barber?.bio || ''
          if (note) descEl.textContent = String(note)
        }
      })
    } catch (err) {
      console.warn('Erro ao aplicar notas/descricoes da lista de barbeiros:', err)
    }
  } catch (error) {
    console.error('Erro ao carregar estatisticas fallback da equipa:', error)
  }
}

function initTeamRatings() {
  const members = document.querySelectorAll('.team-member[data-barber-name]')
  if (!members.length) return
  if (teamStatsListenerBound) return
  teamStatsListenerBound = true

  onValue(ref(database, 'barbers'), (snapshot) => {
    const entries = snapshot.exists() ? Object.values(snapshot.val() || {}) : []
    const stats = {}
    entries.forEach((barber) => {
      const key = normalizePersonName(barber?.name || barber?.nome || '')
      if (!key) return
      const ratingCount = Number(barber?.ratingCount || 0) || 0
      const averageRating = Number(barber?.avgRating ?? barber?.averageRating ?? barber?.ratingAverage ?? barber?.notaMedia ?? 0) || 0
      const completedCuts = Number(barber?.completedCuts ?? barber?.totalCuts ?? barber?.cortesFeitos ?? barber?.cutsCount ?? 0) || 0
      stats[key] = {
        ratingCount,
        ratingTotal: ratingCount > 0 ? averageRating * ratingCount : 0,
        completedCuts,
      }
    })
    applyTeamStatsToUi(members, stats)
  })
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
      const start = barber?.workingHours?.start || configured?.start || null
      const end = barber?.workingHours?.end || configured?.end || null

      scheduleEl.textContent = start && end ? `Horario: ${start} - ${end}` : 'Horario: a definir'

      if (lunchEl) {
        const lunchStart = barber?.lunchBreak?.start || configured?.lunchStart || null
        const lunchEnd = barber?.lunchBreak?.end || configured?.lunchEnd || null
        lunchEl.textContent = lunchStart && lunchEnd ? `Almoco: ${lunchStart} - ${lunchEnd}` : 'Almoco: a definir'
      }
    })
  } catch (error) {
    console.error('Erro ao carregar horarios da equipa:', error)
  }
}

// Real-time listening for barber updates to sync team schedule
function setupTeamSchedulesListener() {
  if (teamSchedulesListenerBound) return
  teamSchedulesListenerBound = true
  teamStatsListenerBound = true
  onValue(ref(database, 'barbers'), (snapshot) => {
    const { barbers, usedFallback } = buildPublicBarbersFromSnapshot(snapshot)
    renderTeamMembers(barbers)
    renderPriceLists(barbers)
    initTeamQuickBooking()
    initTeamFlipCards()

    const members = document.querySelectorAll('.team-member[data-barber-name]')
    if (members.length) {
      const stats = buildTeamStatsFromBarbers(barbers)
      applyTeamStatsToUi(members, stats)

      if (usedFallback) {
        loadTeamStatsFromBarbersFallback(members)
      }
    }
  })
}

// Load and display promotions
async function loadPromotions() {
  const promotionsList = document.getElementById('promotionsList')
  const emptyPromotions = document.getElementById('emptyPromotions')
  const promotionsLocked = document.getElementById('promotionsLocked')
  if (!promotionsList) return
  if (!isUserLoggedIn()) {
    if (promotionsLocked) promotionsLocked.style.display = 'block'
    if (emptyPromotions) emptyPromotions.style.display = 'none'
    promotionsList.innerHTML = ''
    return
  }

  if (promotionsLocked) promotionsLocked.style.display = 'none'
  if (promotionsListenerBound) return
  promotionsListenerBound = true

  try {
    onValue(ref(database, 'promotions'), (snapshot) => {
      const promotions = snapshot.exists() ? snapshot.val() : {}
      const activePromotions = Object.entries(promotions)
        .filter(([_, promo]) => promo.isActive !== false)
        .sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0))

      if (activePromotions.length === 0) {
        promotionsList.innerHTML = ''
        if (emptyPromotions) emptyPromotions.style.display = 'block'
        return
      }

      if (emptyPromotions) emptyPromotions.style.display = 'none'
      
      promotionsList.innerHTML = activePromotions
        .map(([_, promo]) => `
          <div style="background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow);">
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: start;">
              <div>
                <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">${promo.title || 'PromoÃ§Ã£o'}</h3>
                <p style="color: var(--color-text-secondary); margin-bottom: 1rem;">${promo.description || ''}</p>
                <div style="background: rgba(62, 167, 184, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--color-accent);">
                  <p style="margin: 0.5rem 0;"><strong>CondiÃ§Ã£o:</strong> ${promo.minCompletedCuts || 10} cortes concluÃ­dos</p>
                  <p style="margin: 0.5rem 0;"><strong>PrÃ©mio:</strong> ${promo.rewardText || 'NÃ£o especificado'}</p>
                </div>
              </div>
              <span style="background: var(--color-accent); color: white; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">Ativa</span>
            </div>
          </div>
        `)
        .join('')
    })
  } catch (error) {
    console.error('Erro ao carregar promoÃ§Ãµes:', error)
  }
}

// Load and display store hours
async function loadStoreHours() {
  const storeHoursDisplay = document.getElementById('storeHoursDisplay')
  if (!storeHoursDisplay) return
  if (storeHoursListenerBound) return
  storeHoursListenerBound = true

  try {
    onValue(ref(database, 'storeSettings'), (snapshot) => {
      const settings = snapshot.exists() ? snapshot.val() : {}
      const now = new Date()
      const specialSchedule = getStoreSpecialScheduleForNow(now, settings)
      const openingStart = specialSchedule?.start || settings.openingHours?.start || '09:00'
      const openingEnd = specialSchedule?.end || settings.openingHours?.end || '19:00'
      const lunchStart = settings.lunchBreak?.start || '13:00'
      const lunchEnd = settings.lunchBreak?.end || '14:00'
      const scheduleLabel = specialSchedule ? 'Horario especial hoje' : 'Horario'
      
      storeHoursDisplay.innerHTML = `
        <div class="store-hours-row">
          <span class="store-hours-item"><strong>${scheduleLabel}:</strong> ${openingStart} - ${openingEnd}</span>
          <span class="store-hours-divider">|</span>
          <span class="store-hours-item"><strong>Almoco:</strong> ${lunchStart} - ${lunchEnd}</span>
        </div>
      `

      renderAboutContent(settings)
    })
  } catch (error) {
    console.error('Erro ao carregar horÃ¡rio da loja:', error)
  }
}

function updateMainAuthButton() {
  const mainAuthCta = document.getElementById('mainAuthCta')
  const mainLogoutBtn = document.getElementById('mainLogoutBtn')
  if (!mainAuthCta) return

  const setAdminUiVisibility = (isAdmin) => {
    let permissions = {}
    try {
      permissions = JSON.parse(sessionStorage.getItem('adminPermissions') || '{}') || {}
    } catch {
      permissions = {}
    }
    const isMaster = sessionStorage.getItem('isMasterAdmin') === 'true'
    document.querySelectorAll('.admin-only').forEach((element) => {
      const tab = element.getAttribute('data-admin-tab') || ''
      const canEdit = isAdmin && (isMaster || permissions?.[tab]?.edit)
      element.classList.toggle('is-admin-visible', canEdit)
      element.setAttribute('aria-hidden', canEdit ? 'false' : 'true')
    })
  }

  const setLoggedOut = () => {
    mainAuthCta.href = 'login.html'
    mainAuthCta.textContent = 'Login'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'none'
    }
    setAdminUiVisibility(false)
  }

  const setLoggedIn = () => {
    mainAuthCta.href = 'client-menu.html'
    mainAuthCta.innerHTML = '<i class="bi bi-person-check" aria-hidden="true"></i> Area do Cliente'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'inline-flex'
    }
    setAdminUiVisibility(false)
  }

  const setBarberLoggedIn = () => {
    mainAuthCta.href = 'barber-panel.html'
    mainAuthCta.innerHTML = '<i class="bi bi-journal-check" aria-hidden="true"></i> Ver marcaÃ§Ãµes dos clientes'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'inline-flex'
    }
    setAdminUiVisibility(false)
  }

  const setAdminLoggedIn = () => {
    mainAuthCta.href = 'admin-panel.html'
    mainAuthCta.innerHTML = '<i class="bi bi-shield-lock" aria-hidden="true"></i> Area de Admin'
    if (mainLogoutBtn) {
      mainLogoutBtn.style.display = 'inline-flex'
    }
    setAdminUiVisibility(true)
  }

  if (mainLogoutBtn && mainLogoutBtn.dataset.bound !== 'true') {
    mainLogoutBtn.dataset.bound = 'true'
    mainLogoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth)
      } catch (error) {
        console.error('Erro ao terminar sessÃ£o:', error)
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

  if (sessionStorage.getItem('isAdmin') === 'true') {
    setAdminLoggedIn()
  } else if (sessionStorage.getItem('isBarber') === 'true') {
    setBarberLoggedIn()
  } else if (sessionStorage.getItem('isClient') === 'true') {
    setLoggedIn()
  } else {
    setLoggedOut()
  }

  onAuthStateChanged(auth, (user) => {
    if (user && sessionStorage.getItem('isAdmin') === 'true') {
      setAdminLoggedIn()
      loadPromotions()
      initTeamRatings()
      return
    }

    if (user && sessionStorage.getItem('isBarber') === 'true') {
      setBarberLoggedIn()
      loadPromotions()
      initTeamRatings()
      return
    }

    if (user && sessionStorage.getItem('isClient') === 'true') {
      setLoggedIn()
      loadPromotions()
      initTeamRatings()
      return
    }

    if (user) {
      loadPromotions()
      initTeamRatings()
    } else {
      loadPromotions()
      initTeamRatings()
    }

    setLoggedOut()
  })
}

function loadPublicLogo() {
  if (logoListenerBound) return
  logoListenerBound = true
  onValue(ref(database, 'storeSettings/logo'), (snapshot) => {
    const logo = snapshot.exists() ? snapshot.val() : {}
    const avatar = document.querySelector('.profile-avatar')
    const image = avatar?.querySelector('img')
    if (!avatar || !image) return
    avatar.classList.toggle('hidden', logo.hidden === true)
    if (logo.hidden === true) return
    if (logo.imageUrl) image.src = logo.imageUrl
  })
}

function loadPublicHaircuts() {
  const container = document.getElementById('haircutsGrid')
  if (!container || haircutsListenerBound) return
  haircutsListenerBound = true
  onValue(ref(database, 'haircuts'), (snapshot) => {
    const entries = Object.entries(snapshot.exists() ? snapshot.val() : {})
      .filter(([, haircut]) => haircut && haircut.isActive !== false)
      .sort((a, b) => String(a[1]?.createdAt || '').localeCompare(String(b[1]?.createdAt || '')))

    if (!entries.length) {
      container.innerHTML = '<div class="empty-state">Sem cortes publicados.</div>'
      return
    }

    container.innerHTML = entries.map(([id, haircut]) => `
      <div class="cut-card" data-cut-category="hair" data-cut-title="${escapeHtml(haircut.title || 'Corte')}" role="button" tabindex="0" aria-label="Ver ${escapeHtml(haircut.title || 'corte')}">
        ${haircut.imageUrl ? `<img src="${escapeHtml(haircut.imageUrl)}" alt="${escapeHtml(haircut.title || 'Corte')}">` : '<div class="cut-image-placeholder">Sem imagem</div>'}
        <div class="cut-info">
          <h3>${escapeHtml(haircut.title || 'Corte')}</h3>
          <p>${escapeHtml(haircut.description || '')}</p>
        </div>
      </div>
    `).join('')
    initCutsGallery()
  })
}

function renderProductCards(container, products) {
  if (!container) return

  if (!products.length) {
    container.innerHTML = '<div class="product-empty">Sem produtos disponÃ­veis.</div>'
    return
  }

  container.innerHTML = products
    .map((product) => {
      const { basePrice, finalPrice, promo } = getProductPrice(product)
      const badge = promo > 0 ? `<span class="product-badge">-${promo}%</span>` : ''
      const totalStock = getSafeStock(product)
      const availableStock = getAvailableStockForProduct(product)
      const outOfStock = availableStock <= 0
      const stockLabel = outOfStock ? 'Esgotado' : `Stock disponível: ${availableStock}`
      const image = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name || 'Produto'}" class="product-image">`
        : `<div class="product-image" style="background: var(--color-bg-secondary);"></div>`
      return `
        <div class="product-card ${outOfStock ? 'is-out-of-stock' : ''}">
          ${image}
          <div class="product-info">
            <div class="product-name">${product.name || 'Produto'}</div>
            <div class="product-description">${product.description || 'Produto disponÃ­vel na barbearia.'}</div>
            <div class="product-meta">
              <span class="product-price">${formatEuro(finalPrice)}</span>
              ${badge}
            </div>
            <div class="product-old-price ${promo > 0 ? '' : 'is-hidden'}">${formatEuro(basePrice)}</div>
            <div class="product-stock ${outOfStock ? 'is-out' : ''}">${stockLabel}</div>
            <div class="product-actions-row">
              <button type="button" class="btn btn-primary btn-small product-add" data-product-id="${product.id}" data-product-stock="${totalStock}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Esgotado' : 'Adicionar carrinho'}</button>
            </div>
          </div>
        </div>
      `
    })
    .join('')

  container.querySelectorAll('.product-add').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return
      const productId = button.getAttribute('data-product-id')
      if (!productId) return
      if (!isClientLoggedInForCart()) {
        showError('Para adicionar ao carrinho tem de ter sessÃ£o iniciada.')
        return
      }
      const product = products.find((item) => item.id === productId)
      if (!product) return
      const requestedQty = 1
      const result = addToCart(product, requestedQty)
      if (result.added <= 0) {
        showError('Sem stock disponível para esse produto.')
        return
      }
      if (result.added < result.requested) {
        showError(`Só foi possível adicionar ${result.added} unidade(s) devido ao stock disponível.`)
      }
    })
  })
}

function initAdminEditLinks() {
  const links = document.querySelectorAll('.admin-edit-link[data-admin-tab]')
  if (!links.length) return

  links.forEach((link) => {
    if (link.dataset.bound === 'true') return
    link.dataset.bound = 'true'

    link.addEventListener('click', (event) => {
      event.preventDefault()
      if (sessionStorage.getItem('isAdmin') !== 'true') {
        showError('Faça login como administrador para editar.')
        return
      }

      const tab = link.dataset.adminTab
      const focus = link.dataset.adminFocus || ''
      const params = new URLSearchParams()
      if (tab) params.set('tab', tab)
      if (focus) params.set('focus', focus)
      const query = params.toString()
      window.location.href = query ? `admin-panel.html?${query}` : 'admin-panel.html'
    })
  })
}

function getProductPrice(product) {
  const basePrice = Number(product.price || 0)
  const promo = Math.max(0, Number(product.promoPercent || 0))
  const finalPrice = promo > 0 ? basePrice * (1 - promo / 100) : basePrice
  return { basePrice, finalPrice, promo }
}

function renderFeaturedProductsFromCache() {
  const container = document.getElementById('featuredProductsGrid')
  if (!container) return
  renderProductCards(container, featuredProductsCache)
}

function loadCartState() {
  try {
    const raw = localStorage.getItem('cartItems')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    console.warn('Erro ao carregar carrinho:', error)
    return {}
  }
}

function initShopCart() {
  cartState = loadCartState()
  renderCart()
  updateCartBadge()

  const cartToggleBtn = document.getElementById('cartToggleBtn')
  const cartCloseBtn = document.getElementById('cartCloseBtn')
  const cartPanel = document.getElementById('shopCartPanel')
  const shopLogoutBtn = document.getElementById('shopLogoutBtn')

  const searchInput = document.getElementById('shopSearchInput')
  const sortSelect = document.getElementById('shopSortSelect')
  const checkoutBtn = document.getElementById('cartCheckoutBtn')
  const cancelBtn = document.getElementById('cartCancelBtn')

  if (searchInput && searchInput.dataset.bound !== 'true') {
    searchInput.dataset.bound = 'true'
    searchInput.addEventListener('input', () => renderShopProducts())
  }

  if (sortSelect && sortSelect.dataset.bound !== 'true') {
    sortSelect.dataset.bound = 'true'
    sortSelect.addEventListener('change', () => renderShopProducts())
  }

  if (checkoutBtn && checkoutBtn.dataset.bound !== 'true') {
    checkoutBtn.dataset.bound = 'true'
    checkoutBtn.addEventListener('click', async () => {
      const items = Object.values(cartState)
      if (!items.length) {
        showError('O carrinho estÃ¡ vazio.')
        return
      }

      const user = auth.currentUser
      if (!user) {
        showError('FaÃ§a login para finalizar o pedido.')
        return
      }

      const clientName = sessionStorage.getItem('clientName') || user.displayName || 'Cliente'
      const clientEmail = sessionStorage.getItem('clientEmail') || user.email || ''
      const clientUid = user.uid

      try {
        // validate stock from live data
        const updates = []
        const orderItems = []
        let subtotal = 0

        for (const item of items) {
          const productSnap = await get(ref(database, `products/${item.id}`))
          if (!productSnap.exists()) {
            showError(`Produto indisponivel: ${item.name}`)
            return
          }
          const productData = productSnap.val() || {}
          const currentStock = Number(productData.stock || 0)
          if (currentStock < item.qty) {
            showError(`Stock insuficiente para ${item.name}`)
            return
          }

          const lineTotal = Number(item.price || 0) * item.qty
          subtotal += lineTotal
          orderItems.push({
            productId: item.id,
            name: item.name,
            qty: item.qty,
            price: Number(item.price || 0),
            promoPercent: Number(item.promoPercent || 0),
            lineTotal: Number(lineTotal.toFixed(2)),
          })

          updates.push(update(ref(database, `products/${item.id}`), {
            stock: currentStock - item.qty,
            updatedAt: new Date().toISOString(),
          }))
        }

        const orderId = `order_${Date.now()}`
        const orderPayload = {
          clientUid,
          clientName,
          clientEmail,
          items: orderItems,
          subtotal: Number(subtotal.toFixed(2)),
          total: Number(subtotal.toFixed(2)),
          paymentMethod: 'pay_at_store',
          status: 'pending',
          createdAt: new Date().toISOString(),
        }

        await Promise.all([
          set(ref(database, `orders/${orderId}`), orderPayload),
          ...updates,
        ])

        setCartState({})
        showSuccess('Pedido registado. O pagamento Ã© feito na loja.')
      } catch (error) {
        showError('Nao foi possivel finalizar o pedido: ' + error.message)
      }
    })
  }

  if (cancelBtn && cancelBtn.dataset.bound !== 'true') {
    cancelBtn.dataset.bound = 'true'
    cancelBtn.addEventListener('click', () => {
      if (!Object.keys(cartState).length) return
      setCartState({})
      showSuccess('Pedido cancelado e carrinho limpo.')
    })
  }

  if (shopLogoutBtn && shopLogoutBtn.dataset.bound !== 'true') {
    shopLogoutBtn.dataset.bound = 'true'
    shopLogoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth)
      } catch (error) {
        console.error('Erro ao terminar sessão na loja:', error)
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

  if (cartToggleBtn && cartPanel && cartToggleBtn.dataset.bound !== 'true') {
    cartToggleBtn.dataset.bound = 'true'
    cartToggleBtn.addEventListener('click', () => {
      const isOpening = cartPanel.classList.contains('hidden')
      cartPanel.classList.toggle('hidden')
      if (isOpening) {
        clearCartNotice()
      }
    })
  }

  if (cartCloseBtn && cartPanel && cartCloseBtn.dataset.bound !== 'true') {
    cartCloseBtn.dataset.bound = 'true'
    cartCloseBtn.addEventListener('click', () => {
      cartPanel.classList.add('hidden')
    })
  }
}

function saveCartState() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(cartState))
  } catch (error) {
    console.warn('Erro ao guardar carrinho:', error)
  }
}

function setCartState(nextState) {
  cartState = nextState
  saveCartState()
  renderCart()
  renderFeaturedProductsFromCache()
  renderShopProducts()
}

function addToCart(product, qty = 1) {
  if (!isClientLoggedInForCart()) {
    showError('Para adicionar ao carrinho tem de ter sessÃ£o iniciada.')
    return { added: 0, requested: qty }
  }
  if (!product?.id) return { added: 0, requested: qty }
  if (getSafeStock(product) <= 0) return { added: 0, requested: qty }
  const requestedQty = Math.max(1, Number.parseInt(qty, 10) || 1)
  const current = cartState[product.id]
  const currentQty = Math.max(0, Number(current?.qty || 0))
  const totalStock = getSafeStock(product)
  const availableToAdd = Math.max(0, totalStock - currentQty)
  const acceptedQty = Math.min(requestedQty, availableToAdd)
  const nextQty = currentQty + acceptedQty
  if (acceptedQty <= 0) return { added: 0, requested: requestedQty }
  setCartState({
    ...cartState,
    [product.id]: {
      id: product.id,
      name: product.name || 'Produto',
      imageUrl: product.imageUrl || '',
      price: getProductPrice(product).finalPrice,
      promoPercent: Number(product.promoPercent || 0),
      qty: nextQty,
      stock: totalStock,
    },
  })
  incrementCartNotice(acceptedQty)
  return { added: acceptedQty, requested: requestedQty }
}

function updateCartQty(productId, delta) {
  const current = cartState[productId]
  if (!current) return
  const nextQty = Math.max(0, Math.min(current.qty + delta, current.stock || 0))
  if (nextQty === 0) {
    const nextState = { ...cartState }
    delete nextState[productId]
    setCartState(nextState)
    return
  }
  setCartState({
    ...cartState,
    [productId]: { ...current, qty: nextQty },
  })
}

function setCartQty(productId, nextQty) {
  const current = cartState[productId]
  if (!current) return
  const safeQty = Math.max(1, Math.min(Number(nextQty) || 1, current.stock || 0))
  setCartState({
    ...cartState,
    [productId]: { ...current, qty: safeQty },
  })
}

function removeFromCart(productId) {
  const nextState = { ...cartState }
  delete nextState[productId]
  setCartState(nextState)
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems')
  const emptyEl = document.getElementById('cartEmpty')
  const subtotalEl = document.getElementById('cartSubtotal')
  const totalEl = document.getElementById('cartTotal')
  const summaryEl = document.getElementById('cartSummary')
  if (!itemsEl || !subtotalEl || !totalEl || !emptyEl) return

  const items = Object.values(cartState)
  if (!items.length) {
    itemsEl.innerHTML = ''
    emptyEl.style.display = 'block'
    if (summaryEl) summaryEl.style.display = 'none'
    subtotalEl.textContent = formatEuro(0)
    totalEl.textContent = formatEuro(0)
    return
  }

  emptyEl.style.display = 'none'
  if (summaryEl) summaryEl.style.display = ''
  let subtotal = 0

  itemsEl.innerHTML = items
    .map((item) => {
      const lineTotal = item.price * item.qty
      subtotal += lineTotal
      const image = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">`
        : `<div class="cart-item-image" style="background: var(--color-bg-secondary);"></div>`
      return `
        <div class="cart-item" data-cart-id="${item.id}">
          ${image}
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${formatEuro(item.price)}</div>
            <div class="cart-item-controls">
              <button type="button" class="cart-qty-btn" data-action="decrease">-</button>
              <input type="number" class="cart-qty-input" data-action="manual" min="1" max="${Math.max(1, item.stock || 1)}" value="${item.qty}">
              <button type="button" class="cart-qty-btn" data-action="increase">+</button>
            </div>
          </div>
          <div class="cart-item-total">${formatEuro(lineTotal)}</div>
          <div class="cart-item-remove">
            <button type="button" class="cart-remove-icon" data-action="remove" aria-label="Remover produto">
              <i class="bi bi-trash3" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      `
    })
    .join('')

  subtotalEl.textContent = formatEuro(subtotal)
  totalEl.textContent = formatEuro(subtotal)

  itemsEl.querySelectorAll('.cart-item').forEach((row) => {
    const id = row.getAttribute('data-cart-id')
    if (!id) return
    row.querySelectorAll('[data-action="decrease"]').forEach((btn) => {
      btn.addEventListener('click', () => updateCartQty(id, -1))
    })
    row.querySelectorAll('[data-action="increase"]').forEach((btn) => {
      btn.addEventListener('click', async () => { try { const productSnap = await get(ref(database, `products/${id}`)); const productData = productSnap.exists() ? productSnap.val() : {}; const currentStock = Number(productData.stock || 0); const current = cartState[id] || {}; const availableToAdd = Math.max(0, currentStock - (current.qty || 0)); if (availableToAdd <= 0) { showError('Sem stock disponível para esse produto.'); return } updateCartQty(id, 1) } catch (err) { console.error('Erro ao validar stock:', err); showError('Erro ao verificar stock.') } })
    })
    row.querySelectorAll('[data-action="manual"]').forEach((input) => {
      input.addEventListener('change', () => {
        const value = Number.parseInt(input.value, 10) || 1
        setCartQty(id, value)
      })
    })
    row.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener('click', () => removeFromCart(id))
    })
  })
}

function renderShopProducts() {
  const container = document.getElementById('shopProductsGrid')
  if (!container) return

  const searchValue = String(document.getElementById('shopSearchInput')?.value || '').trim().toLowerCase()
  const sortValue = String(document.getElementById('shopSortSelect')?.value || 'featured')

  let list = [...shopProductsCache]
  if (searchValue) {
    list = list.filter((product) => {
      const haystack = `${product.name || ''} ${product.description || ''}`.toLowerCase()
      return haystack.includes(searchValue)
    })
  }

  if (sortValue === 'price-asc') {
    list.sort((a, b) => getProductPrice(a).finalPrice - getProductPrice(b).finalPrice)
  } else if (sortValue === 'price-desc') {
    list.sort((a, b) => getProductPrice(b).finalPrice - getProductPrice(a).finalPrice)
  } else if (sortValue === 'name') {
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  } else {
    list.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
  }

  if (!list.length) {
    container.innerHTML = '<div class="product-empty">Sem produtos disponÃ­veis.</div>'
    return
  }

  container.innerHTML = list
    .map((product) => {
      const { basePrice, finalPrice, promo } = getProductPrice(product)
      const badge = promo > 0 ? `<span class="product-badge">-${promo}%</span>` : ''
      const totalStock = getSafeStock(product)
      const availableStock = getAvailableStockForProduct(product)
      const outOfStock = availableStock <= 0
      const stockLabel = outOfStock ? 'Esgotado' : `Stock disponível: ${availableStock}`
      const image = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name || 'Produto'}" class="product-image">`
        : `<div class="product-image" style="background: var(--color-bg-secondary);"></div>`
      return `
        <div class="product-card ${outOfStock ? 'is-out-of-stock' : ''}">
          ${image}
          <div class="product-info">
            <div class="product-name">${product.name || 'Produto'}</div>
            <div class="product-description">${product.description || 'Produto disponÃ­vel na barbearia.'}</div>
            <div class="product-meta">
              <span class="product-price">${formatEuro(finalPrice)}</span>
              ${badge}
            </div>
            <div class="product-old-price ${promo > 0 ? '' : 'is-hidden'}">${formatEuro(basePrice)}</div>
            <div class="product-stock ${outOfStock ? 'is-out' : ''}">${stockLabel}</div>
            <div class="product-actions-row">
              <input
                type="number"
                class="product-qty-input"
                min="1"
                max="${Math.max(1, availableStock)}"
                value="${outOfStock ? 0 : 1}"
                data-product-qty="${product.id}"
                ${outOfStock ? 'disabled' : ''}
                aria-label="Quantidade de ${product.name || 'produto'} para adicionar"
              >
              <button type="button" class="btn btn-primary btn-small product-add" data-product-id="${product.id}" data-product-stock="${totalStock}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Esgotado' : 'Adicionar ao carrinho'}</button>
            </div>
          </div>
        </div>
      `
    })
    .join('')

  container.querySelectorAll('.product-add').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return
      const id = button.getAttribute('data-product-id')
      const product = shopProductsCache.find((item) => item.id === id)
      if (!product) return
      if (!isClientLoggedInForCart()) {
        showError('Para adicionar ao carrinho tem de ter sessÃ£o iniciada.')
        return
      }
      const card = button.closest('.product-card')
      const qtyInput = card?.querySelector(`[data-product-qty="${id}"]`)
      const requestedQty = Math.max(1, Number.parseInt(qtyInput?.value || '1', 10) || 1)
      const result = addToCart(product, requestedQty)
      const remaining = getAvailableStockForProduct(product)
      if (qtyInput) {
        qtyInput.max = String(Math.max(1, remaining))
        qtyInput.value = remaining > 0 ? '1' : '0'
        qtyInput.disabled = remaining <= 0
      }
      if (result.added <= 0) {
        showError('Sem stock disponÃ­vel para esse produto.')
        return
      }
      if (result.added < result.requested) {
        showError(`Só foi possível adicionar ${result.added} unidade(s) devido ao stock disponível.`)
      }
    })
  })
}

function loadProducts() {
  const featuredContainer = document.getElementById('featuredProductsGrid')
  const shopContainer = document.getElementById('shopProductsGrid')
  if (!featuredContainer && !shopContainer) return
  if (productsListenerBound) return
  productsListenerBound = true

  onValue(ref(database, 'products'), (snapshot) => {
    const products = snapshot.exists() ? snapshot.val() : {}
    let entries = Object.entries(products)
      .filter(([, product]) => product && product.isActive !== false && product.name && (product.price !== undefined && product.price !== null))
      .map(([id, product]) => ({
        id,
        ...product,
        salesCount: Number(product.salesCount || 0),
      }))
    const fallbackEntries = [...PAP_FALLBACK_PRODUCTS, ...PAP_IMPORTED_PRODUCTS]
      .filter((product) => product && product.isActive !== false && product.name && (product.price !== undefined && product.price !== null))
      .map((product) => ({
        ...product,
        salesCount: Number(product.salesCount || 0),
      }))

    if (!entries.length) {
      entries = [...fallbackEntries]
    } else {
      const existingIds = new Set(entries.map((product) => product.id))
      fallbackEntries.forEach((product) => {
        if (!existingIds.has(product.id)) entries.push(product)
      })
    }

    shopProductsCache = [...entries]
    featuredProductsCache = [...entries].sort((a, b) => b.salesCount - a.salesCount).slice(0, 4)

    renderFeaturedProductsFromCache()
    renderShopProducts()

    const pendingProductId = getPendingShopProductId()
    if (shopContainer && pendingProductId) {
      const pendingProduct = shopProductsCache.find((item) => item.id === pendingProductId)
      if (pendingProduct && getSafeStock(pendingProduct) > 0) {
        addToCart(pendingProduct)
      }
      sessionStorage.removeItem('pendingShopProductId')
      const url = new URL(window.location.href)
      url.searchParams.delete('product')
      history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
    }
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
  document.addEventListener('DOMContentLoaded', initContactCopyActions);
  document.addEventListener('DOMContentLoaded', initDownloadSiteButton);
  document.addEventListener('DOMContentLoaded', initCutsGallery);
  document.addEventListener('DOMContentLoaded', initTeamQuickBooking);
  document.addEventListener('DOMContentLoaded', initTeamFlipCards);
  document.addEventListener('DOMContentLoaded', initTeamSchedules);
  document.addEventListener('DOMContentLoaded', initTeamRatings);
  document.addEventListener('DOMContentLoaded', setupTeamSchedulesListener);
  document.addEventListener('DOMContentLoaded', loadPromotions);
  document.addEventListener('DOMContentLoaded', loadProducts);
  document.addEventListener('DOMContentLoaded', loadPublicHaircuts);
  document.addEventListener('DOMContentLoaded', loadPublicLogo);
  document.addEventListener('DOMContentLoaded', initShopCart);
  document.addEventListener('DOMContentLoaded', loadStoreHours);
  document.addEventListener('DOMContentLoaded', updateMainAuthButton);
  document.addEventListener('DOMContentLoaded', updateClientAreaNav);
  document.addEventListener('DOMContentLoaded', initStoreStatusBadge);
  document.addEventListener('DOMContentLoaded', initAdminEditLinks);
} else {
  initTabs();
  initActionMenu();
  initContactCopyActions();
  initDownloadSiteButton();
  initCutsGallery();
  initTeamQuickBooking();
  initTeamFlipCards();
  initTeamSchedules();
  initTeamRatings();
  setupTeamSchedulesListener();
  loadPromotions();
  loadProducts();
  loadPublicHaircuts();
  loadPublicLogo();
  initShopCart();
  loadStoreHours();
  updateMainAuthButton();
  updateClientAreaNav();
  initStoreStatusBadge();
  initAdminEditLinks();
}

// Also initialize on load
window.addEventListener('load', initTabs);
window.addEventListener('load', initActionMenu);
window.addEventListener('load', initContactCopyActions);
window.addEventListener('load', initDownloadSiteButton);
window.addEventListener('load', initCutsGallery);
window.addEventListener('load', initTeamQuickBooking);
window.addEventListener('load', initTeamFlipCards);
window.addEventListener('load', initTeamSchedules);
window.addEventListener('load', initTeamRatings);
window.addEventListener('load', setupTeamSchedulesListener);
window.addEventListener('load', loadPromotions);
window.addEventListener('load', loadProducts);
window.addEventListener('load', loadPublicHaircuts);
window.addEventListener('load', loadPublicLogo);
window.addEventListener('load', initShopCart);
window.addEventListener('load', loadStoreHours);
window.addEventListener('load', updateMainAuthButton);
window.addEventListener('load', updateClientAreaNav);
window.addEventListener('load', initStoreStatusBadge);
window.addEventListener('load', initAdminEditLinks);






