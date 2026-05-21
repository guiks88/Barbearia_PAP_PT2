import { auth, database } from "./firebase-config.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { installMojibakeAutoFix } from "./utils.js"

const listEl = document.getElementById("clientOrdersList")

installMojibakeAutoFix()

function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-PT")
}

function statusLabel(status) {
  if (status === "completed") return "Concluído"
  if (status === "ready") return "Pronto"
  if (status === "cancelled") return "Cancelado"
  return "Pendente"
}

function renderOrders(entries) {
  if (!listEl) return
  if (!entries.length) {
    listEl.innerHTML = '<div class="empty-state">Ainda não existem pedidos associados à sua conta.</div>'
    return
  }

  listEl.innerHTML = entries
    .map(([id, order]) => {
      const items = Array.isArray(order.items) ? order.items : []
      const total = Number(order.total || 0).toFixed(2)
      return `
        <article class="client-booking-card">
          <h3>Pedido ${id}</h3>
          <p><strong>Data:</strong> ${formatDateTime(order.createdAt)}</p>
          <p><strong>Estado:</strong> ${statusLabel(order.status)}</p>
          <p><strong>Total:</strong> ${total}€</p>
          <div style="margin-top: 0.5rem;">
            ${items.map((item) => `<p style="margin: 0.2rem 0;">${item.qty || 0}x ${item.name || "Produto"} (${Number(item.lineTotal || 0).toFixed(2)}€)</p>`).join("")}
          </div>
        </article>
      `
    })
    .join("")
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html"
    return
  }

  const ordersQuery = query(ref(database, "orders"), orderByChild("clientUid"), equalTo(user.uid))
  onValue(ordersQuery, (snapshot) => {
    const orders = snapshot.exists() ? snapshot.val() : {}
    const entries = Object.entries(orders)
      .sort((a, b) => String(b[1]?.createdAt || "").localeCompare(String(a[1]?.createdAt || "")))
    renderOrders(entries)
  }, (error) => {
    console.error("Erro ao carregar pedidos do cliente:", error)
    if (listEl) {
      listEl.innerHTML = '<div class="empty-state">Não foi possível carregar os pedidos agora.</div>'
    }
  })
})
