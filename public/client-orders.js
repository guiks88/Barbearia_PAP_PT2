import { auth, database } from "./firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { ref, onValue, query, orderByChild, equalTo, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { showSuccess, showError, installMojibakeAutoFix, updateClientAreaNav } from "./utils.js"

const listEl = document.getElementById("clientOrdersList")
const clientOrdersLogoutBtn = document.getElementById("clientOrdersLogoutBtn")

installMojibakeAutoFix()
updateClientAreaNav()

function clearKnownSession() {
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

if (clientOrdersLogoutBtn && clientOrdersLogoutBtn.dataset.bound !== "true") {
  clientOrdersLogoutBtn.dataset.bound = "true"
  clientOrdersLogoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Erro ao terminar sessão nos pedidos:", error)
    }
    clearKnownSession()
    showSuccess("Sessão terminada.")
    setTimeout(() => {
      window.location.href = "index.html"
    }, 700)
  })
}

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
      const status = order.status || 'pending'
      const isLocked = status === 'ready' || status === 'completed'
      const isCancelled = status === 'cancelled'
      return `
        <article class="client-booking-card order-card">
          <div class="order-card-header">
            <h3>Pedido ${id}</h3>
            <span class="status-pill ${status === 'completed'
              ? 'is-completed'
              : status === 'ready'
                ? 'is-progress'
                : status === 'cancelled'
                  ? 'is-cancelled'
                  : 'is-warning'}">${statusLabel(status)}</span>
          </div>
          <p><strong>Data:</strong> ${formatDateTime(order.createdAt)}</p>
          <p><strong>Total:</strong> ${total}</p>
          <div class="order-items">
            ${items.map((item) => `<p>${item.qty || 0}x ${item.name || "Produto"} (${Number(item.lineTotal || 0).toFixed(2)})</p>`).join("")}
          </div>
          ${!isLocked && !isCancelled ? `
            <div class="order-actions">
              <button class="btn btn-secondary order-edit-btn" data-order-id="${id}">Editar</button>
              <button class="btn btn-danger order-cancel-btn" data-order-id="${id}">Cancelar</button>
            </div>
          ` : ''}
        </article>
      `
    })
    .join("")
}

async function cancelOrder(orderId, order) {
  try {
    if (!order || order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') {
      showError('Não é possível cancelar este pedido.')
      return
    }
    const updates = []
    for (const item of order.items || []) {
      try {
        const pSnap = await get(ref(database, `products/${item.productId}`))
        const p = pSnap.exists() ? pSnap.val() : {}
        const newStock = Number(p.stock || 0) + Number(item.qty || 0)
        updates.push(update(ref(database, `products/${item.productId}`), { stock: newStock, updatedAt: new Date().toISOString() }))
      } catch (e) { console.warn('Erro ao restaurar stock para', item.productId, e) }
    }
    await Promise.all(updates)
    await update(ref(database, `orders/${orderId}`), { status: 'cancelled', cancelledAt: new Date().toISOString() })
    showSuccess('Pedido cancelado e stock restabelecido.')
  } catch (err) { console.error(err); showError('Erro ao cancelar pedido.') }
}

async function editOrder(orderId, order) {
  try {
    if (!order || order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') {
      showError('Não é possível editar este pedido.')
      return
    }
    const cart = JSON.parse(localStorage.getItem('cartItems') || '{}')
    for (const item of order.items || []) {
      try {
        const pSnap = await get(ref(database, `products/${item.productId}`))
        const p = pSnap.exists() ? pSnap.val() : {}
        const newStock = Number(p.stock || 0) + Number(item.qty || 0)
        await update(ref(database, `products/${item.productId}`), { stock: newStock, updatedAt: new Date().toISOString() })
      } catch (e) { console.warn('Erro ao restaurar stock para', item.productId, e) }
      cart[item.productId] = { id: item.productId, name: item.name, price: item.price, qty: item.qty, stock: Number(item.stock || 0) }
    }
    await update(ref(database, `orders/${orderId}`), { status: 'cancelled', cancelledAt: new Date().toISOString() })
    localStorage.setItem('cartItems', JSON.stringify(cart))
    showSuccess('Pedido pronto para edição no carrinho.')
    window.location.href = 'shop.html'
  } catch (err) { console.error(err); showError('Erro ao iniciar edição do pedido.') }
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

    try {
      const editButtons = listEl.querySelectorAll('.order-edit-btn')
      editButtons.forEach((btn) => {
        if (btn.dataset.bound === 'true') return
        btn.dataset.bound = 'true'
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-order-id')
          const order = orders[id]
          if (!order) return
          await editOrder(id, order)
        })
      })

      const cancelButtons = listEl.querySelectorAll('.order-cancel-btn')
      cancelButtons.forEach((btn) => {
        if (btn.dataset.bound === 'true') return
        btn.dataset.bound = 'true'
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-order-id')
          const order = orders[id]
          if (!order) return
          await cancelOrder(id, order)
        })
      })
    } catch (err) {
      console.error('Erro ao ligar botões de editar/cancelar:', err)
    }
  }, (error) => {
    console.error("Erro ao carregar pedidos do cliente:", error)
    if (listEl) {
      listEl.innerHTML = '<div class="empty-state">Não foi possível carregar os pedidos agora.</div>'
    }
  })
})

