import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const cfg = {
  apiKey:            "AIzaSyCJGW3-flCwC5y8WXJCJWDvx36eEkw_I5o",
  authDomain:        "pixora-872e3.firebaseapp.com",
  projectId:         "pixora-872e3",
  storageBucket:     "pixora-872e3.firebasestorage.app",
  messagingSenderId: "315709334461",
  appId:             "1:315709334461:web:a758b041e43837df6d68d4",
  databaseURL:       "https://pixora-872e3-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let _db, _ok = false;
export function initFB() {
  try { _db = getDatabase(initializeApp(cfg)); _ok = true; console.log("✅ Firebase OK"); }
  catch(e) { console.warn("⚠️ FB offline:", e.message); }
}
export const db   = () => _db;
export const fbOk = () => _ok;
export { ref, set, get, onValue, push, serverTimestamp };
