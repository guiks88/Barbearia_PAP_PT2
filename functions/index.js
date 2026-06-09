const { onRequest } = require("firebase-functions/v2/https")
const { onValueUpdated } = require("firebase-functions/v2/database")
const { defineSecret } = require("firebase-functions/params")
const logger = require("firebase-functions/logger")
const admin = require("firebase-admin")

if (!admin.apps.length) {
  admin.initializeApp()
}

const RESEND_API_KEY = defineSecret("RESEND_API_KEY")
const REPORTS_FROM_EMAIL = defineSecret("REPORTS_FROM_EMAIL")
const STOCK_ALERT_EMAIL = "joaoguilhermesftc88@gmail.com"

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildReportHtml(booking, reportText) {
  const createdAt = new Date().toLocaleString("pt-PT")
  const bodyText = escapeHtml(reportText).replace(/\n/g, "<br>")

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background: #0f1115; padding: 20px; color: #e5e7eb;">
      <div style="max-width: 680px; margin: 0 auto; background: #1a1f2b; border: 1px solid #232838; border-radius: 12px; overflow: hidden;">
        <div style="padding: 18px 20px; border-bottom: 1px solid #232838;">
          <h2 style="margin: 0; font-size: 20px; color: #3ea7b8;">Relatório da Marcação</h2>
          <p style="margin: 8px 0 0; color: #9ca3af; font-size: 14px;">Barbearia João Castro</p>
        </div>
        <div style="padding: 20px;">
          <p style="margin: 0 0 10px;"><strong>Cliente:</strong> ${escapeHtml(booking.clientName)}</p>
          <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(booking.clientEmail)}</p>
          <p style="margin: 0 0 10px;"><strong>Telefone:</strong> ${escapeHtml(booking.clientPhone)}</p>
          <p style="margin: 0 0 10px;"><strong>Serviço:</strong> ${escapeHtml(booking.serviceName)} (${escapeHtml(booking.serviceDuration)} min)</p>
          <p style="margin: 0 0 10px;"><strong>Barbeiro:</strong> ${escapeHtml(booking.barberName)}</p>
          <p style="margin: 0 0 10px;"><strong>Data:</strong> ${escapeHtml(booking.date)}</p>
          <p style="margin: 0 0 10px;"><strong>Hora:</strong> ${escapeHtml(booking.time)}</p>
          <p style="margin: 0 0 16px;"><strong>Preço:</strong> ${escapeHtml(String(booking.price))}€</p>

          <div style="padding: 14px; border: 1px solid #232838; border-radius: 10px; background: #151922;">
            <p style="margin: 0 0 8px; font-weight: 700;">Resumo</p>
            <p style="margin: 0; color: #cbd5e1; line-height: 1.55;">${bodyText}</p>
          </div>

          <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">Enviado em ${escapeHtml(createdAt)}</p>
        </div>
      </div>
    </div>
  `
}

exports.sendBookingReport = onRequest({
  region: "europe-west1",
  timeoutSeconds: 60,
  memory: "256MiB",
  secrets: [RESEND_API_KEY, REPORTS_FROM_EMAIL],
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Método não permitido." })
    return
  }

  try {
    const apiKey = RESEND_API_KEY.value()
    const fromEmail = REPORTS_FROM_EMAIL.value()

    if (!apiKey || !fromEmail) {
      res.status(500).json({
        success: false,
        message: "Configuração de email incompleta no servidor (RESEND_API_KEY / REPORTS_FROM_EMAIL).",
      })
      return
    }

    const { to, booking, reportText } = req.body || {}

    if (!to || !booking || !reportText) {
      res.status(400).json({ success: false, message: "Dados inválidos para envio do relatório." })
      return
    }

    const html = buildReportHtml(booking, reportText)
    const text = String(reportText || "")

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: "Relatório da sua marcação - Barbearia João Castro",
        text,
        html,
      }),
    })

    const resendPayload = await resendResponse.json().catch(() => ({}))

    if (!resendResponse.ok) {
      logger.error("Erro ao enviar email via Resend", resendPayload)
      res.status(502).json({
        success: false,
        message: "Falha no serviço de email. Tente novamente em instantes.",
      })
      return
    }

    res.status(200).json({ success: true, id: resendPayload.id || null })
  } catch (error) {
    logger.error("Erro interno no envio de relatório", error)
    res.status(500).json({ success: false, message: "Erro interno ao enviar relatório." })
  }
})

exports.notifyProductOutOfStock = onValueUpdated({
  region: "europe-west1",
  ref: "/products/{productId}",
  secrets: [RESEND_API_KEY, REPORTS_FROM_EMAIL],
}, async (event) => {
  try {
    const before = event.data.before.val() || {}
    const after = event.data.after.val() || {}
    const beforeStock = Number(before.stock || 0)
    const afterStock = Number(after.stock || 0)

    if (!(beforeStock > 0 && afterStock <= 0)) return

    const apiKey = RESEND_API_KEY.value()
    const fromEmail = REPORTS_FROM_EMAIL.value()
    if (!apiKey || !fromEmail) {
      logger.error("Configuração de email incompleta para alerta de stock.")
      return
    }

    const productName = String(after.name || "Produto")
    const productId = event.params.productId
    const now = new Date().toLocaleString("pt-PT")

    const text = [
      "Alerta de stock esgotado",
      `Produto: ${productName}`,
      `ID: ${productId}`,
      `Stock atual: ${afterStock}`,
      `Data: ${now}`,
    ].join("\n")

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2>Alerta de stock esgotado</h2>
        <p><strong>Produto:</strong> ${escapeHtml(productName)}</p>
        <p><strong>ID:</strong> ${escapeHtml(productId)}</p>
        <p><strong>Stock atual:</strong> ${escapeHtml(String(afterStock))}</p>
        <p><strong>Data:</strong> ${escapeHtml(now)}</p>
      </div>
    `

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [STOCK_ALERT_EMAIL],
        subject: `Stock esgotado: ${productName}`,
        text,
        html,
      }),
    })

    if (!resendResponse.ok) {
      const payload = await resendResponse.json().catch(() => ({}))
      logger.error("Erro ao enviar alerta de stock", payload)
    }
  } catch (error) {
    logger.error("Erro interno no alerta de stock esgotado", error)
  }
})

exports.deleteFirebaseAuthUser = onRequest({
  region: "europe-west1",
  timeoutSeconds: 60,
  memory: "256MiB",
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Método não permitido." })
    return
  }

  try {
    const authHeader = String(req.headers.authorization || "")
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Token de autenticação em falta." })
      return
    }

    const idToken = authHeader.slice("Bearer ".length).trim()
    const decoded = await admin.auth().verifyIdToken(idToken)
    const callerUid = decoded?.uid
    if (!callerUid) {
      res.status(401).json({ success: false, message: "Token inválido." })
      return
    }

    const adminSnapshot = await admin.database().ref(`admins/${callerUid}`).get()
    if (!adminSnapshot.exists()) {
      res.status(403).json({ success: false, message: "Apenas administradores podem eliminar utilizadores." })
      return
    }

    const uid = String(req.body?.uid || "").trim()
    if (!uid) {
      res.status(400).json({ success: false, message: "UID inválido." })
      return
    }

    try {
      await admin.auth().deleteUser(uid)
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error
    }

    res.status(200).json({ success: true })
  } catch (error) {
    logger.error("Erro ao eliminar utilizador no Firebase Auth", error)
    res.status(500).json({ success: false, message: "Erro interno ao eliminar utilizador no Auth." })
  }
})

exports.updateFirebaseAuthUser = onRequest({
  region: "europe-west1",
  timeoutSeconds: 60,
  memory: "256MiB",
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "MÃ©todo nÃ£o permitido." })
    return
  }

  try {
    const authHeader = String(req.headers.authorization || "")
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Token de autenticaÃ§Ã£o em falta." })
      return
    }

    const idToken = authHeader.slice("Bearer ".length).trim()
    const decoded = await admin.auth().verifyIdToken(idToken)
    const callerUid = decoded?.uid
    if (!callerUid) {
      res.status(401).json({ success: false, message: "Token invÃ¡lido." })
      return
    }

    const adminSnapshot = await admin.database().ref(`admins/${callerUid}`).get()
    if (!adminSnapshot.exists()) {
      res.status(403).json({ success: false, message: "Apenas administradores podem atualizar utilizadores." })
      return
    }

    const uid = String(req.body?.uid || "").trim()
    const email = String(req.body?.email || "").trim().toLowerCase()
    const password = String(req.body?.password || "")
    const updates = {}

    if (email) updates.email = email
    if (password) updates.password = password

    if (!uid || !Object.keys(updates).length) {
      res.status(400).json({ success: false, message: "Dados invÃ¡lidos para atualizar utilizador." })
      return
    }

    await admin.auth().updateUser(uid, updates)
    res.status(200).json({ success: true })
  } catch (error) {
    logger.error("Erro ao atualizar utilizador no Firebase Auth", error)
    res.status(500).json({ success: false, message: "Erro interno ao atualizar utilizador no Auth." })
  }
})
