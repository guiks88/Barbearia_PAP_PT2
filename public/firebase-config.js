import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const firebaseConfig = {
  apiKey: "AIzaSyDicOe3s-45mfnNvk7SiZ90pq2MhtPwzcM",
  authDomain: "barbearia-sistema-a9d1a.firebaseapp.com",
  databaseURL: "https://barbearia-sistema-a9d1a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "barbearia-sistema-a9d1a",
  storageBucket: "barbearia-sistema-a9d1a.firebasestorage.app",
  messagingSenderId: "981942161598",
  appId: "1:981942161598:web:483d0698428296d20fceef",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const auth = getAuth(app)

export { firebaseConfig, app, database, auth }
