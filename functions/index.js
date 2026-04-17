const { onRequest } = require("firebase-functions/v2/https")
const { defineSecret } = require("firebase-functions/params")
const logger = require("firebase-functions/logger")

const RESEND_API_KEY = defineSecret("RESEND_API_KEY")
const REPORTS_FROM_EMAIL = defineSecret("REPORTS_FROM_EMAIL")

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
