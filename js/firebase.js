import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyApyC7TplFlEJphi2Llo0f54CTKrjlY-3E",
    authDomain: "portal-de-evidencias-a4c4c.firebaseapp.com",
    projectId: "portal-de-evidencias-a4c4c",
    storageBucket: "portal-de-evidencias-a4c4c.firebasestorage.app",
    messagingSenderId: "386080236470",
    appId: "1:386080236470:web:0b6ab126d6207969531717"
};

    // Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase conectado correctamente");
console.log("Authentication y Firestore inicializados");
