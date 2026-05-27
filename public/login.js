import { auth, database, AUTH_ACTION_URL } from "./firebase-config.js"
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import {
  browserSessionPersistence,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { showSuccess, showError } from "./utils.js"

const form = document.getElementById("unifiedLoginForm")
const submitBtn = document.getElementById("unifiedLoginBtn")
const forgotPasswordLink = document.getElementById("forgotPasswordLink")
const googleLoginBtn = document.getElementById("googleLoginBtn")
const googleLoginBtnLabel = document.getElementById("googleLoginBtnLabel")

let authPersistencePromise = null
let hasRoleRedirected = false

if (!form || !submitBtn || !forgotPasswordLink || !googleLoginBtn || !googleLoginBtnLabel) {
  throw new Error("Elementos do login não encontrados.")
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase()
}

function ensureSessionPersistence() {
  if (!authPersistencePromise) {
    authPersistencePromise = setPersistence(auth, browserSessionPersistence).catch((error) => {
      authPersistencePromise = null
      throw error
    })
  }

  return authPersistencePromise
}

ensureSessionPersistence().catch((error) => {
  console.error("Erro ao definir persistência de sessão:", error)
})

async function findRoleByUid(uid) {
  const adminSnapshot = await get(ref(database, `admins/${uid}`))
  if (adminSnapshot.exists()) {
    return { role: "admin", profile: adminSnapshot.val() }
  }

  const barberSnapshot = await get(ref(database, `barbers/${uid}`))
  if (barberSnapshot.exists()) {
    return { role: "barber", profile: barberSnapshot.val() }
  }

  const clientSnapshot = await get(ref(database, `clients/${uid}`))
  if (clientSnapshot.exists()) {
    return { role: "client", profile: clientSnapshot.val() }
  }

  return null
}

function findByEmail(snapshot, targetEmail) {
  if (!snapshot.exists()) return null

  const data = snapshot.val()
  const normalizedTarget = normalizeEmail(targetEmail)

  for (const [id, item] of Object.entries(data)) {
    const itemEmail = normalizeEmail(item?.email)
    if (itemEmail && itemEmail === normalizedTarget) {
      return { id, profile: item }
    }
  }

  return null
}

async function isEmailRegistered(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const [adminsSnapshot, barbersSnapshot, clientsSnapshot] = await Promise.all([
    get(ref(database, "admins")),
    get(ref(database, "barbers")),
    get(ref(database, "clients")),
  ])

  return Boolean(
    findByEmail(adminsSnapshot, normalized) ||
    findByEmail(barbersSnapshot, normalized) ||
    findByEmail(clientsSnapshot, normalized),
  )
}

async function migrateProfileToUidIfNeeded(role, uid, foundProfile) {
  if (!foundProfile) return null

  const rolePath = `${role}s/${uid}`
  const currentRef = ref(database, rolePath)
  const currentSnapshot = await get(currentRef)

  if (!currentSnapshot.exists()) {
    const profileToSave = {
      ...foundProfile,
      updatedAt: new Date().toISOString(),
    }
    await set(currentRef, profileToSave)
    return profileToSave
  }

  return currentSnapshot.val()
}

async function findRoleByEmailAndMigrate(uid, email) {
  const adminsSnapshot = await get(ref(database, "admins"))
  const adminMatch = findByEmail(adminsSnapshot, email)
  if (adminMatch) {
    const profile = await migrateProfileToUidIfNeeded("admin", uid, adminMatch.profile)
    return { role: "admin", profile }
  }

  const barbersSnapshot = await get(ref(database, "barbers"))
  const barberMatch = findByEmail(barbersSnapshot, email)
  if (barberMatch) {
    const profile = await migrateProfileToUidIfNeeded("barber", uid, barberMatch.profile)
    return { role: "barber", profile }
  }

  const clientsSnapshot = await get(ref(database, "clients"))
  const clientMatch = findByEmail(clientsSnapshot, email)
  if (clientMatch) {
    const profile = await migrateProfileToUidIfNeeded("client", uid, clientMatch.profile)
    return { role: "client", profile }
  }

  return null
}

async function resolveRoleData(user, email) {
  let roleData = await findRoleByUid(user.uid)
  if (!roleData) {
    roleData = await findRoleByEmailAndMigrate(user.uid, email)
  }
  return roleData
}

async function ensureClientProfileForAuthenticatedUser(user, email) {
  const uid = user.uid
  const clientRef = ref(database, `clients/${uid}`)
  const snapshot = await get(clientRef)

  if (snapshot.exists()) {
    return snapshot.val()
  }

  const profile = {
    name: user.displayName || "Cliente",
    email,
    phone: "",
    password: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await set(clientRef, profile)
  return profile
}

async function migrateLegacyClientAuth(email, password) {
  const clientsSnapshot = await get(ref(database, "clients"))
  if (!clientsSnapshot.exists()) return null

  const clients = clientsSnapshot.val()
  const normalizedEmail = normalizeEmail(email)

  for (const [legacyId, client] of Object.entries(clients)) {
    const clientEmail = normalizeEmail(client?.email)
    const clientPassword = String(client?.password || "")

    if (clientEmail !== normalizedEmail) continue
    if (!clientPassword || clientPassword !== password) continue

    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    const migratedProfile = {
      ...client,
      email,
      password: null,
      updatedAt: new Date().toISOString(),
    }

    await set(ref(database, `clients/${uid}`), migratedProfile)

    if (legacyId !== uid) {
      await set(ref(database, `clients/${legacyId}/password`), null)
      await set(ref(database, `clients/${legacyId}/migratedToUid`), uid)
      await set(ref(database, `clients/${legacyId}/updatedAt`), new Date().toISOString())
    }

    return credential.user
  }

  return null
}

function saveRoleSession(role, uid, email, profile) {
  sessionStorage.removeItem("adminId")
  sessionStorage.removeItem("adminName")
  sessionStorage.removeItem("isAdmin")
  sessionStorage.removeItem("barberId")
  sessionStorage.removeItem("barberName")
  sessionStorage.removeItem("barberEmail")
  sessionStorage.removeItem("isBarber")
  sessionStorage.removeItem("clientEmail")
  sessionStorage.removeItem("clientName")
  sessionStorage.removeItem("isClient")

  if (role === "admin") {
    sessionStorage.setItem("adminId", uid)
    sessionStorage.setItem("adminName", profile?.name || "Administrador")
    sessionStorage.setItem("isAdmin", "true")
    return
  }

  if (role === "barber") {
    sessionStorage.setItem("barberId", uid)
    sessionStorage.setItem("barberName", profile?.name || "Barbeiro")
    sessionStorage.setItem("barberEmail", email)
    sessionStorage.setItem("isBarber", "true")
    return
  }

  sessionStorage.setItem("clientEmail", email)
  sessionStorage.setItem("clientName", profile?.name || "Cliente")
  sessionStorage.setItem("isClient", "true")
}

function ensureActiveProfile(roleData) {
  const profile = roleData?.profile
  if (profile && profile.isActive === false) {
    throw new Error("Conta desativada. Fale com a barbearia para reativar.")
  }
}

function redirectByRole(role) {
  if (hasRoleRedirected) return

  if (role === "admin") {
    hasRoleRedirected = true
    sessionStorage.removeItem("pendingBookingBarber")
    window.location.href = "admin-panel.html"
    return
  }

  if (role === "barber") {
    hasRoleRedirected = true
    sessionStorage.removeItem("pendingBookingBarber")
    window.location.href = "barber-panel.html"
    return
  }

  const pendingFromSession = (sessionStorage.getItem("pendingBookingBarber") || "").trim()
  const pendingFromQuery = (new URLSearchParams(window.location.search).get("barber") || "").trim()
  const pendingBarber = pendingFromSession || pendingFromQuery
  const pendingProductFromSession = (sessionStorage.getItem("pendingShopProductId") || "").trim()
  const pendingProductFromQuery = (new URLSearchParams(window.location.search).get("product") || "").trim()
  const pendingProduct = pendingProductFromSession || pendingProductFromQuery

  hasRoleRedirected = true

  if (pendingProduct) {
    sessionStorage.setItem("pendingShopProductId", pendingProduct)
    window.location.href = `shop.html?product=${encodeURIComponent(pendingProduct)}`
    return
  }

  if (pendingBarber) {
    sessionStorage.removeItem("pendingBookingBarber")
    window.location.href = `bookings.html?barber=${encodeURIComponent(pendingBarber)}`
    return
  }

  window.location.href = "client-menu.html"
}

function needsClientEmailVerification(user, roleData) {
  const isClient = !roleData || roleData.role === "client"
  const usesPasswordLogin = user.providerData.some((provider) => provider.providerId === "password")
  return isClient && usesPasswordLogin && !user.emailVerified
}

async function blockUnverifiedClient(user, roleData, shouldResendEmail = false) {
  if (!needsClientEmailVerification(user, roleData)) return false

  if (shouldResendEmail) {
    await sendEmailVerification(user, {
      url: AUTH_ACTION_URL,
      handleCodeInApp: true,
    })
  }

  await signOut(auth)
  sessionStorage.clear()
  return true
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return

  const email = normalizeEmail(user.email)
  const roleData = await resolveRoleData(user, email)

  ensureActiveProfile(roleData)

  if (await blockUnverifiedClient(user, roleData)) {
    showError("Confirme o seu email antes de entrar. Veja a caixa de entrada ou spam.")
    return
  }

  if (!roleData) {
    const profile = await ensureClientProfileForAuthenticatedUser(user, email)
    saveRoleSession("client", user.uid, email, profile)
    redirectByRole("client")
    return
  }

  saveRoleSession(roleData.role, user.uid, email, roleData.profile)
  redirectByRole(roleData.role)
})

async function loginAndRoute(email, password) {
  await ensureSessionPersistence()

  let user = null

  try {
    const loginResult = await signInWithEmailAndPassword(auth, email, password)
    user = loginResult.user
  } catch (error) {
    const code = error?.code || ""
    const canTryLegacy =
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found"

    if (!canTryLegacy) {
      throw error
    }

    const migratedUser = await migrateLegacyClientAuth(email, password)
    if (!migratedUser) {
      throw error
    }

    user = migratedUser
  }

  const roleData = await resolveRoleData(user, email)

  if (await blockUnverifiedClient(user, roleData, true)) {
    throw new Error("Confirme o seu email antes de entrar. Enviamos novo email de verificacao.")
  }

  if (!roleData) {
    const recoveredProfile = await ensureClientProfileForAuthenticatedUser(user, email)
    saveRoleSession("client", user.uid, email, recoveredProfile)
    return "client"
  }

  saveRoleSession(roleData.role, user.uid, email, roleData.profile)
  return roleData.role
}

async function loginWithGoogleAndRoute() {
  await ensureSessionPersistence()

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })

  const result = await signInWithPopup(auth, provider)
  const user = result.user
  const email = normalizeEmail(user.email)

  if (!email) {
    await signOut(auth)
    throw new Error("Não foi possível obter o email da conta Google.")
  }

  const roleData = await resolveRoleData(user, email)
  ensureActiveProfile(roleData)
  if (!roleData) {
    const recoveredProfile = await ensureClientProfileForAuthenticatedUser(user, email)
    saveRoleSession("client", user.uid, email, recoveredProfile)
    return "client"
  }

  saveRoleSession(roleData.role, user.uid, email, roleData.profile)
  return roleData.role
}

const LOGIN_MESSAGES = {
  wrongPassword: "Senha/email incorretos.",
  missingAccount: "Senha/email incorretos.",
}

async function checkIfAccountExists(email) {
  try {
    return await isEmailRegistered(email)
  } catch (error) {
    console.warn("Nao foi possivel verificar se o email existe no registo:", error)
    return null
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault()

  const emailInput = document.getElementById("loginEmail")
  const passwordInput = document.getElementById("loginPassword")
  const email = normalizeEmail(emailInput?.value)
  const password = passwordInput?.value || ""

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showError("Indique um email valido.")
    return
  }

  if (!password || password.length < 6) {
    showError("Indique uma senha valida (minimo 6 caracteres).")
    return
  }

  const accountExists = await checkIfAccountExists(email)
  if (accountExists === false) {
    showError(LOGIN_MESSAGES.missingAccount)
    return
  }

  submitBtn.disabled = true
  submitBtn.textContent = "A entrar..."

  try {
    const role = await loginAndRoute(email, password)
    showSuccess("Login efetuado com sucesso.")
    redirectByRole(role)
  } catch (error) {
    const code = error?.code || ""

    if (code === "auth/wrong-password") {
      showError(LOGIN_MESSAGES.wrongPassword)
    } else if (code === "auth/user-not-found") {
      showError(LOGIN_MESSAGES.missingAccount)
    } else if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
      const registered = await checkIfAccountExists(email)
      if (registered === false) {
        showError(LOGIN_MESSAGES.missingAccount)
      } else {
        showError(LOGIN_MESSAGES.wrongPassword)
      }
    } else {
      showError(error?.message || "Nao foi possivel fazer login.")
    }

    submitBtn.disabled = false
    submitBtn.textContent = "Entrar"
  }
})

forgotPasswordLink.addEventListener("click", async (event) => {
  event.preventDefault()

  const emailInput = document.getElementById("loginEmail")
  const email = normalizeEmail(emailInput?.value)

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showError("Indique o seu email para recuperar a senha.")
    return
  }

  try {
    await sendPasswordResetEmail(auth, email, {
      url: AUTH_ACTION_URL,
      handleCodeInApp: true,
    })
    showSuccess("Email de recuperação enviado. Verifique a sua caixa de entrada.")
  } catch (error) {
    const code = error?.code || ""
    if (code === "auth/user-not-found") {
      const legacySnapshot = await get(ref(database, "clients"))
      if (legacySnapshot.exists()) {
        const clients = legacySnapshot.val()
        const existsInLegacy = Object.values(clients).some((client) => normalizeEmail(client?.email) === email)
        if (existsInLegacy) {
          showError("Esta conta é antiga e ainda não tem recuperação por email. Use 'Criar conta' ou Google para ativar o novo login.")
          return
        }
      }

      showError("Não existe conta com este email.")
      return
    }

    showError("Não foi possível enviar o email de recuperação.")
  }
})

googleLoginBtn.addEventListener("click", async () => {
  googleLoginBtn.disabled = true
  googleLoginBtnLabel.textContent = "A entrar com Google..."

  try {
    const role = await loginWithGoogleAndRoute()
    showSuccess("Login com Google efetuado com sucesso.")
    redirectByRole(role)
  } catch (error) {
    const code = error?.code || ""

    if (code === "auth/popup-closed-by-user") {
      showError("Login com Google cancelado.")
    } else if (code === "auth/account-exists-with-different-credential") {
      showError("Este email já existe com outro método de login. Use email e senha.")
    } else {
      showError(error?.message || "Não foi possível entrar com Google.")
    }
  } finally {
    googleLoginBtn.disabled = false
    googleLoginBtnLabel.textContent = "Continuar com Google"
  }
})


