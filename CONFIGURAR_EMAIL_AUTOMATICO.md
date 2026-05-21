# Configurar envio automatico de relatorio por email

Este projeto usa uma Cloud Function (`sendBookingReport`) com o servico Resend para enviar o relatorio da marcacao automaticamente.

## 1) Pre-requisitos
- Node.js instalado (inclui npm/npx)
- Firebase CLI instalado e autenticado (`firebase login`)
- Conta Resend com dominio/remetente validado

## 2) Instalar dependencias das funcoes
Na raiz do projeto:

```bash
cd functions
npm install
```

## 3) Configurar variaveis de ambiente da Function
Na raiz do projeto:

```bash
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set REPORTS_FROM_EMAIL
```

Sugestao para `REPORTS_FROM_EMAIL`:
`Barbearia Joao Castro <noreply@seudominio.com>`

## 4) Fazer deploy
Na raiz do projeto:

```bash
firebase deploy --only functions,hosting
```

## 5) Como funciona no site
- Ao confirmar uma marcacao, o frontend chama `POST /api/send-booking-report`.
- O Hosting reencaminha para a Cloud Function.
- A Function envia email para o cliente com template HTML + resumo em texto.

## 6) Erros comuns
- `firebase` nao reconhecido: instalar Firebase CLI.
- `npx` nao reconhecido: instalar Node.js.
- Erro de remetente no Resend: validar dominio/remetente no painel Resend.
