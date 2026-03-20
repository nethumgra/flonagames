══════════════════════════════════════════════
  FLONA ICE CREAM — README
══════════════════════════════════════════════

🚀 HOW TO OPEN
──────────────
1. VS Code → Install "Live Server" extension
2. Open flona folder in VS Code
3. Right-click index.html → "Open with Live Server"
   Game:  http://127.0.0.1:5500
   Admin: http://127.0.0.1:5500/admin.html

   On your phone: http://YOUR_PC_IP:5500
   (find IP: Windows=ipconfig, Mac=ifconfig)

🔥 FIREBASE SETUP (one-time)
─────────────────────────────
1. console.firebase.google.com
2. Project: pixora-872e3
3. Left menu → Realtime Database → Create Database
4. Region: asia-southeast1  ← IMPORTANT
5. Test mode → Enable
6. Rules → { "rules": { ".read": true, ".write": true } }

🎮 GAME LOGIC
─────────────
Normal & Pro (20-round cycle):
  1-4   ❌ Empty
  5     🍦 Win No 01
  6-9   ❌ Empty
  10    🔄 Try Again
  11    🍦 Win No 01
  12-15 ❌ Empty
  16    🔄 Try Again
  17-19 ❌ Empty
  20    🏆 Grand Prize (No 04) → restart

Ultra (23-round cycle):
  1-4   ❌ Empty
  5     🍨 Win No 02
  6-9   ❌ Empty
  10    🔄 Try Again
  11    🍨 Win No 02
  12-15 ❌ Empty
  16    🔄 Try Again
  17-22 ❌ Empty
  23    🏆 Grand Prize (No 04) → restart

⚙️ ADMIN — MANUAL MODE
───────────────────────
1. Open admin.html
2. Click "Manual Override" button
3. Choose any result (e.g. Grand Prize 🏆)
4. Next player who spins gets that result
5. Auto-reverts to Logic Mode after 1 use

══════════════════════════════════════════════
