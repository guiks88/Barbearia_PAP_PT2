import { auth, database } from "./firebase-config.js"
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const backBtn = document.getElementById("clientMenuBackBtn")
const userInfo = document.getElementById("clientMenuUserInfo")
const openPromotionsBtn = document.getElementById("openPromotionsBtn")
const promotionsPanel = document.getElementById("promotionsPanel")
const promotionsList = document.getElementById("promotionsList")
const promotionsSummary = document.getElementById("promotionsSummary")
const promoBadge = document.getElementById("promoBadge")

if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = "index.html"
  })
}

if (openPromotionsBtn && promotionsPanel) {
  openPromotionsBtn.addEventListener("click", () => {
    promotionsPanel.classList.toggle("hidden")
  })
}

function getDefaultPromotion() {
  return {
    title: "10.º corte grátis",
    description: "Ao completar 10 cortes confirmados, o próximo corte fica gratuito.",
    minCompletedCuts: 10,
    rewardText: "1 corte grátis",
    isActive: true,
  }
}

function isPromotionEligible(promotion, completedCuts) {
  const threshold = Number(promotion.minCompletedCuts || 10)
  if (!threshold || completedCuts < threshold) return false
  return completedCuts % threshold === 0
}

async function loadClientPromotions(user) {
  const promotions = []
  try {
    const promotionsSnapshot = await get(ref(database, "promotions"))
    if (promotionsSnapshot.exists()) {
      Object.values(promotionsSnapshot.val()).forEach((promo) => {
        if (promo?.isActive !== false) {
          promotions.push({
            title: promo.title || "Promoção",
            description: promo.description || "Oferta especial para clientes.",
            minCompletedCuts: Number(promo.minCompletedCuts || 10),
            rewardText: promo.rewardText || "Oferta disponível",
            isActive: promo.isActive !== false,
          })
        }
      })
    }
  } catch (error) {
    console.error("Erro ao carregar promoções:", error)
  }

  if (!promotions.length) {
    promotions.push(getDefaultPromotion())
  }

  let completedCuts = 0
  try {
    const bookingsSnapshot = await get(ref(database, "bookings"))
    if (bookingsSnapshot.exists()) {
      completedCuts = Object.values(bookingsSnapshot.val()).filter((booking) => {
        if (!booking) return false
        if (booking.clientUid !== user.uid) return false
        if (booking.status === "cancelled") return false
        return booking.executionStatus === "completed"
      }).length
    }
  } catch (error) {
    console.error("Erro ao carregar histórico do cliente:", error)
  }

  const eligiblePromotions = promotions.filter((promo) => isPromotionEligible(promo, completedCuts))

  if (promotionsSummary) {
    promotionsSummary.textContent = eligiblePromotions.length
      ? `Tem ${eligiblePromotions.length} promoção(ões) disponível(is) para usar agora.`
      : `Ao 10.º corte, ganha 1 corte grátis. Já tem ${completedCuts} cortes concluídos.`
  }

  if (promoBadge) {
    promoBadge.textContent = String(eligiblePromotions.length || 1)
    promoBadge.classList.toggle("hidden", eligiblePromotions.length === 0)
  }

  if (promotionsList) {
    promotionsList.innerHTML = promotions
      .map((promo) => {
        const eligible = isPromotionEligible(promo, completedCuts)
        return `
          <article class="promotion-item ${eligible ? "is-eligible" : ""}">
            <h3>${promo.title}</h3>
            <p>${promo.description}</p>
            <p><strong>Condição:</strong> ${promo.minCompletedCuts} cortes concluídos</p>
            <p><strong>Prémio:</strong> ${promo.rewardText}</p>
            <p class="promotion-status">${eligible ? "Disponível para usar" : "Ainda não disponível"}</p>
          </article>
        `
      })
      .join("")
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    signOut(auth).catch(() => {})
    sessionStorage.clear()
    window.location.href = "login.html"
    return
  }

  if (userInfo) {
    userInfo.textContent = "Obrigado por escolher a nossa barbearia. Vamos cuidar do seu visual com a máxima atenção."
  }

  loadClientPromotions(user)
})
