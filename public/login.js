import { auth, database } from "./firebase-config.js"
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import {
  GoogleAuthProvider,
  onAuthStateChanged,
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

if (!form || !submitBtn || !forgotPasswordLink || !googleLoginBtn || !googleLoginBtnLabel) {
  throw new Error("Elementos do login não encontrados.")
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase()
}

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

function saveRoleSession(role, uid, email, profile) {
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

function redirectByRole(role) {
  if (role === "admin") {
    window.location.href = "admin-panel.html"
    return
  }

  if (role === "barber") {
    window.location.href = "barber-panel.html"
    return
  }

  window.location.href = "bookings.html"
}

async function loginAndRoute(email, password) {
  const loginResult = await signInWithEmailAndPassword(auth, email, password)
  const user = loginResult.user

  const roleData = await resolveRoleData(user, email)

  if (!roleData) {
    await signOut(auth)
    throw new Error("Conta autenticada, mas sem perfil de acesso no sistema.")
  }

  saveRoleSession(roleData.role, user.uid, email, roleData.profile)
  return roleData.role
}

async function loginWithGoogleAndRoute() {
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
  if (!roleData) {
    await signOut(auth)
    throw new Error("Conta Google autenticada, mas sem perfil no sistema.")
  }

  saveRoleSession(roleData.role, user.uid, email, roleData.profile)
  return roleData.role
}

form.addEventListener("submit", async (event) => {
  event.preventDefault()

  const emailInput = document.getElementById("loginEmail")
  const passwordInput = document.getElementById("loginPassword")
  const email = normalizeEmail(emailInput?.value)
  const password = passwordInput?.value || ""

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showError("Indique um email válido.")
    return
  }

  if (!password || password.length < 6) {
    showError("Indique uma senha válida (mínimo 6 caracteres).")
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

    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      showError("Email ou senha incorretos.")
    } else {
      showError(error?.message || "Não foi possível fazer login.")
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
    await sendPasswordResetEmail(auth, email)
    showSuccess("Email de recuperação enviado. Verifique a sua caixa de entrada.")
  } catch (error) {
    const code = error?.code || ""
    if (code === "auth/user-not-found") {
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

onAuthStateChanged(auth, async (user) => {
  if (!user) return

  const currentEmail = normalizeEmail(user.email)
  if (!currentEmail) return

  try {
    const roleData = await resolveRoleData(user, currentEmail)
    if (!roleData) return

    saveRoleSession(roleData.role, user.uid, currentEmail, roleData.profile)
    redirectByRole(roleData.role)
  } catch (error) {
    console.error("Erro ao validar sessão existente:", error)
  }
})
