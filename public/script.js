import { database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"

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
      <h3>Serviços e Preços</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Corte de Cabelo</strong><br>
          15€ - 30 minutos
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Barba</strong><br>
          10€ - 20 minutos
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Corte + Barba</strong><br>
          22€ - 45 minutos (Poupe 3€!)
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Sobrancelha</strong><br>
          5€ - 10 minutos
        </li>
        <li style="background: rgba(212, 175, 55, 0.1); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
          <strong style="color: #d4af37;">Pacote Completo</strong><br>
          35€ - 60 minutos (Melhor valor!)
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

function timeToMinutes(timeStr) {
  const [hour, minute] = String(timeStr || '00:00').split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

async function initStoreStatusBadge() {
  const badge = document.getElementById('storeStatusBadge')
  if (!badge) return

  const fallbackOpen = [1, 2, 3, 4, 5]
  const fallbackOpening = { start: '09:00', end: '19:00' }

  try {
    const snapshot = await get(ref(database, 'storeSettings'))
    const settings = snapshot.exists() ? snapshot.val() : {}

    const openDays = Array.isArray(settings.openDays) && settings.openDays.length ? settings.openDays : fallbackOpen
    const openingStart = settings.openingHours?.start || fallbackOpening.start
    const openingEnd = settings.openingHours?.end || fallbackOpening.end
    const lunchStart = settings.lunchBreak?.start || '13:00'
    const lunchEnd = settings.lunchBreak?.end || '14:00'

    const now = new Date()
    const currentDay = now.getDay()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const isOpenDay = openDays.includes(currentDay)
    const isInsideOpening = currentMinutes >= timeToMinutes(openingStart) && currentMinutes <= timeToMinutes(openingEnd)
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
  document.addEventListener('DOMContentLoaded', initStoreStatusBadge);
} else {
  initTabs();
  initActionMenu();
  initDownloadSiteButton();
  initCutsGallery();
  initStoreStatusBadge();
}

// Also initialize on load
window.addEventListener('load', initTabs);
window.addEventListener('load', initActionMenu);
window.addEventListener('load', initDownloadSiteButton);
window.addEventListener('load', initCutsGallery);
window.addEventListener('load', initStoreStatusBadge);
