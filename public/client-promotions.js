import { auth, database } from "./firebase-config.js"
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const logoutBtn = document.getElementById("clientPromotionsLogoutBtn")
let promotionsListenerBound = false
let bookingsListenerBound = false
let promotionsCache = {}
let clientCompletedCuts = 0

function clearClientSession() {
  sessionStorage.removeItem("clientEmail")
  sessionStorage.removeItem("clientName")
  sessionStorage.removeItem("isClient")
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")
  sessionStorage.removeItem("adminId")
  sessionStorage.removeItem("adminName")
  sessionStorage.removeItem("isAdmin")
}

function renderClientPromotions() {
  const promotionsList = document.getElementById("promotionsList")
  const emptyPromotions = document.getElementById("emptyPromotions")
  if (!promotionsList) return

  const activePromotions = Object.entries(promotionsCache)
    .filter(([_, promo]) => promo?.isActive !== false)
    .sort((a, b) => new Date(b[1]?.createdAt || 0) - new Date(a[1]?.createdAt || 0))

  if (!activePromotions.length) {
    promotionsList.innerHTML = ""
    if (emptyPromotions) emptyPromotions.style.display = "block"
    return
  }

  if (emptyPromotions) emptyPromotions.style.display = "none"

  promotionsList.innerHTML = activePromotions
    .map(([_, promo]) => {
      const minCuts = Number(promo?.minCompletedCuts || 10)
      const remainingCuts = Math.max(0, minCuts - clientCompletedCuts)
      const progressText = remainingCuts === 0
        ? "Recompensa pronta para reivindicar."
        : `Faltam ${remainingCuts} cortes para reivindicar a recompensa.`

      return `
        <div style="background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow);">
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: start;">
            <div>
              <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">${promo?.title || "Promocao"}</h3>
              <p style="color: var(--color-text-secondary); margin-bottom: 1rem;">${promo?.description || ""}</p>
              <div style="background: rgba(62, 167, 184, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--color-accent);">
                <p style="margin: 0.5rem 0;"><strong>Condicao:</strong> ${minCuts} cortes concluidos</p>
                <p style="margin: 0.5rem 0;"><strong>Premio:</strong> ${promo?.rewardText || "Nao especificado"}</p>
                <p style="margin: 0.5rem 0;"><strong>Progresso:</strong> ${progressText}</p>
              </div>
            </div>
            <span style="background: var(--color-accent); color: white; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">Ativa</span>
          </div>
        </div>
      `
    })
    .join("")
}

function loadClientPromotions() {
  if (!promotionsListenerBound) {
    promotionsListenerBound = true
    onValue(ref(database, "promotions"), (snapshot) => {
      promotionsCache = snapshot.exists() ? snapshot.val() : {}
      renderClientPromotions()
    })
  }

  if (!bookingsListenerBound) {
    bookingsListenerBound = true
    onValue(ref(database, "bookings"), (snapshot) => {
      const user = auth.currentUser
      const allBookings = snapshot.exists() ? Object.values(snapshot.val() || {}) : []
      clientCompletedCuts = allBookings.filter((booking) => {
        if (!user) return false
        if (booking?.clientUid !== user.uid) return false
        if ((booking?.executionStatus || "pending") !== "completed") return false
        const status = booking?.status || "active"
        return status !== "cancelled" && status !== "expired"
      }).length
      renderClientPromotions()
    })
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Erro ao terminar sessao:", error)
    }

    clearClientSession()
    window.location.href = "index.html"
  })
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    signOut(auth).catch(() => {})
    clearClientSession()
    window.location.href = "login.html"
    return
  }

  loadClientPromotions()
})
