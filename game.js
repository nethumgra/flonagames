// ============================================================
//  FLONA ICE CREAM — game.js
//  Normal/Pro: 20-round cycle | Ultra: 23-round cycle
//  Admin result controller fully integrated
// ============================================================
import { initFB, db, fbOk, ref, set, get, onValue, push, serverTimestamp }
  from './firebase-config.js';

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
const S = {
  cnt:        { normal: 0, pro: 0, ultra: 0 },
  mode:       'normal',
  spinning:   false,
  soundOn:    true,
  winners:    [],
  ctrlMode:   'logic',   // 'logic' | 'manual'
  manualNext: null,      // result key when admin sets manual override
};

// ─────────────────────────────────────────────────────────────
//  EXACT LOGIC TABLES
// ─────────────────────────────────────────────────────────────
// Normal / Pro — 20-round cycle
// 1-4→empty | 5→win01 | 6-9→empty | 10→tryagain
// 11→win01 | 12-15→empty | 16→tryagain | 17-19→empty | 20→win04
// Normal / Pro — New 20-round cycle logic
function logicNP(step) {
  const s = ((step - 1) % 20) + 1;
  if (s <= 4)   return 'empty';      // 1-4: Empty
  if (s === 5)  return 'win01';      // 5: Win 01
  if (s <= 9)   return 'empty';      // 6-9: Empty
  if (s === 10) return 'tryagain';   // 10: Try Again (Updated)
  if (s === 11) return 'win01';      // 11: Win 01
  if (s <= 15)  return 'empty';      // 12-15: Empty
  if (s === 16) return 'tryagain';   // 16: Try Again
  if (s <= 19)  return 'empty';      // 17-19: Empty
  return 'win04';                    // 20: Win 04
}

// Ultra — 23-round cycle
// 1-4→empty | 5→win02 | 6-9→empty | 10→tryagain
// 11→win02 | 12-15→empty | 16→tryagain | 17-22→empty | 23→win04
function logicUltra(step) {
  const s = ((step - 1) % 22) + 1;
  if (s <= 4)   return 'empty';      // 1-4: Empty
  if (s === 5)  return 'win01';      // 5: Win 01
  if (s <= 9)   return 'empty';      // 6-9: Empty
  if (s === 10) return 'tryagain';   // 10: Try Again
  if (s === 11) return 'win02';      // 11: Win 02
  if (s <= 15)  return 'empty';      // 12-15: Empty
  if (s === 16) return 'tryagain';   // 16: Try Again
  if (s <= 21)  return 'empty';      // 17-21: Empty
  return 'win04';                    // 22: Win 04 (Grand Prize)
}

// ─────────────────────────────────────────────────────────────
//  WHEEL SEGMENTS
// ─────────────────────────────────────────────────────────────
const SEG_DEG = 60;
const SEGS = [
  { key:'empty',    label:'Empty',     emoji:'🧊', bg:'#B3E5FC', fg:'#01579B' },
  { key:'tryagain', label:'Try Again', emoji:'🔄', bg:'#FFF9C4', fg:'#E65100' },
  { key:'win01',    label:'01',     emoji:'🍦', bg:'#FCE4EC', fg:'#880E4F' },
  { key:'win02',    label:'02',     emoji:'🍨', bg:'#EDE7F6', fg:'#4A148C' },
  { key:'win03',    label:'03',     emoji:'🍧', bg:'#E8F5E9', fg:'#1B5E20' },
  { key:'win04',    label:'04 🏆',  emoji:'🏆', bg:'#FFF8E1', fg:'#BF360C' },
];

const KEY_TO_IDX = { empty:0, tryagain:1, win01:2, win02:3, win03:4, win04:5 };

const RINFO = {
  empty:    { title:'Better Luck Next Time!', sub:'No prize this time 🧊',            emoji:'🧊',   win:false, grand:false },
  tryagain: { title:'Try Again! 🔄',          sub:'One more spin — you can do it!',   emoji:'🔄✨', win:false, grand:false },
  win01:    { title:'You Won! 🍦',            sub:'Claim your No 01 Ice Cream!',      emoji:'🍦',   win:true,  grand:false },
  win02:    { title:'You Won! 🍨',            sub:'Claim your No 02 Ice Cream!',      emoji:'🍨',   win:true,  grand:false },
  win03:    { title:'You Won! 🍧',            sub:'Claim your No 03 Ice Cream!',      emoji:'🍧',   win:true,  grand:false },
  win04:    { title:'🏆 GRAND PRIZE! 🏆',    sub:'WOW! No 04 Grand Prize is yours!', emoji:'🏆✨', win:true,  grand:true  },
};

const PRICE = { normal:20, pro:50, ultra:100 };

// ─────────────────────────────────────────────────────────────
//  WHEEL DRAWING
// ─────────────────────────────────────────────────────────────
function drawWheel(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, cx = W/2, cy = W/2, r = cx - 4;
  const arc = (Math.PI * 2) / SEGS.length;
  ctx.clearRect(0, 0, W, W);
  SEGS.forEach((seg, i) => {
    const a0 = i * arc - Math.PI / 2;
    const a1 = a0 + arc;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = seg.bg; ctx.fill();
    const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.stroke();
    const midAngle = a0 + arc / 2;
    const labelR   = r * 0.72;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(9, Math.round(W / 15))}px Poppins,sans-serif`;
    ctx.fillStyle = seg.fg;
    ctx.fillText(seg.label, 0, 0);
    ctx.restore();
  });
  const cr = Math.max(28, W * 0.095);
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = 'rgba(46,125,50,0.4)'; ctx.lineWidth = 2; ctx.stroke();
}

// ─────────────────────────────────────────────────────────────
//  SPIN PHYSICS
// ─────────────────────────────────────────────────────────────
let totalRot = 0;
function calcFinalDeg(resultKey) {
  const idx = KEY_TO_IDX[resultKey];
  const currentRot = totalRot % 360;
  
  // ඕනෑම segment එකක් හරියටම උඩ pointer එක (12 o'clock) ගාවට එන්න 
  // අවශ්‍ය rotation එක ගණනය කිරීම.
  const target = (330 - (idx * 60) + 360) % 360;
  
  const needed = (target - currentRot + 360) % 360;
  const spins = (6 + Math.floor(Math.random() * 4)) * 360; // වට 6-10ක් අතර කැරකෙනවා
  
  // පොඩි ස්වභාවික ගතියක් දෙන්න jitter එකක් (පොඩි ගැස්සීමක්) එකතු කරමු
  const jitter = (Math.random() - 0.5) * 20; 
  
  totalRot += spins + needed + jitter;
  return totalRot;
}

// ─────────────────────────────────────────────────────────────
//  UPDATED MP3 AUDIO LOGIC (Fix for double play)
// ─────────────────────────────────────────────────────────────
const sounds = {
  // මෙහි path එක හරියටම assets/sounds/ ද කියා බලන්න
  spin: new Audio('spin.mp3'),
  win:  new Audio('win.mp3'),
  loss: new Audio('loss.mp3'),
  mode: new Audio('mode.mp3')
};

// සද්දේ overlap (දෙපාරක් ඇහෙන එක) වැලැක්වීමට මෙහෙම කරන්න
function playSnd(key) {
  if (!S.soundOn) return;
  // දැනට play වෙනවා නම් ඒක නතර කරලා මුලට ගන්න
  sounds[key].pause();
  sounds[key].currentTime = 0;
  sounds[key].play().catch(() => {});
}
// හැම සද්දයක්ම සම්පූර්ණයෙන් නතර කරන function එකක්
function stopAllSounds() {
  Object.values(sounds).forEach(s => {
    s.pause();
    s.currentTime = 0;
  });
}

function startTick() {
  if (!S.soundOn) return;
  
  // වැදගත්ම දේ: Loop එක false කරන්න
  sounds.spin.loop = false; 
  
  // කලින් play වුණ එකක් තිබුණොත් ඒක reset කරමු
  sounds.spin.pause();
  sounds.spin.currentTime = 0;
  
  // එක පාරක් පමණක් play වීමට ඉඩ දෙන්න
  sounds.spin.play().catch(() => {});
}

function stopTick() {
  sounds.spin.pause();
  sounds.spin.currentTime = 0;
}

function playWin(grand) {
  stopTick(); // මුලින් කැරකෙන සද්දය නතර කරන්න
  if (!S.soundOn) return;
  sounds.win.play().catch(() => {});
}

function playLoss() {
  stopTick(); // මුලින් කැරකෙන සද්දය නතර කරන්න
  if (!S.soundOn) return;
  sounds.loss.play().catch(() => {});
}

function playMode() {
  if (!S.soundOn) return;
  sounds.mode.currentTime = 0; // පරණ සද්දය reset කරමු
  sounds.mode.play().catch(() => {});
}
// ─────────────────────────────────────────────────────────────
//  CONFETTI
// ─────────────────────────────────────────────────────────────
function boom() {
  const cv = document.getElementById('cc'); if (!cv) return;
  const ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const CLR = ['#FFD700','#FF6B9D','#76c442','#CE93D8','#81D4FA','#FF8F00'];
  const P = Array.from({length: 160}, () => ({
    x: Math.random() * cv.width, y: -12,
    vy: 2 + Math.random() * 5, vx: (Math.random() - 0.5) * 3.5,
    r: 5 + Math.random() * 7, a: Math.random() * 360,
    spin: (Math.random() - 0.5) * 10,
    c: CLR[Math.floor(Math.random() * CLR.length)],
  }));
  let raf;
  (function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    P.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.a += p.spin;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a * Math.PI / 180);
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - p.y / cv.height);
      ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 0.55); ctx.restore();
    });
    if (P.some(p => p.y < cv.height + 20)) raf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
  setTimeout(() => { cancelAnimationFrame(raf); ctx.clearRect(0,0,cv.width,cv.height); }, 5500);
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE
// ─────────────────────────────────────────────────────────────
export function fbSetCtrl(mode, result = null) {
  S.ctrlMode   = mode;
  S.manualNext = result;
  if (fbOk()) try { set(ref(db(), 'flona/control'), { mode, manualNext: result }); } catch {}
}

function fbSave() {
  if (!fbOk()) return;
  try { set(ref(db(), 'flona/counters'), S.cnt); } catch {}
}

function fbStats() {
  if (!fbOk()) return;
  try {
    get(ref(db(), 'flona/stats')).then(snap => {
      const s = snap.val() || { totalSpins:0, totalRevenue:0, normal:0, pro:0, ultra:0 };
      s.totalSpins++;
      s.totalRevenue = (s.totalRevenue || 0) + PRICE[S.mode];
      s[S.mode] = (s[S.mode] || 0) + 1;
      set(ref(db(), 'flona/stats'), s);
    });
  } catch {}
}

function fbListen() {
  if (!fbOk()) return;
  // Admin control — real-time listener (manual override syncs instantly)
  onValue(ref(db(), 'flona/control'), snap => {
    const v = snap.val(); if (!v) return;
    if (v.mode       !== undefined) S.ctrlMode   = v.mode;
    if (v.manualNext !== undefined) S.manualNext = v.manualNext;
  });
  // Counter sync
  onValue(ref(db(), 'flona/counters'), snap => {
    const v = snap.val(); if (!v) return;
    S.cnt = { ...S.cnt, ...v };
    uiSync();
  });
  // Winners feed
  onValue(ref(db(), 'flona/winners'), snap => {
    const v = snap.val(); if (!v) return;
    S.winners = Object.values(v).sort((a, b) => (b.ts||0) - (a.ts||0)).slice(0, 50);
    renderW();
  });
}

// ─────────────────────────────────────────────────────────────
//  LOCAL STORAGE (offline fallback)
// ─────────────────────────────────────────────────────────────
const LS_CNT = 'flona_cnt', LS_WIN = 'flona_win';
function lsave() {
  try {
    localStorage.setItem(LS_CNT, JSON.stringify(S.cnt));
    localStorage.setItem(LS_WIN, JSON.stringify(S.winners.slice(0, 50)));
  } catch {}
}
function lload() {
  try {
    const c = localStorage.getItem(LS_CNT);
    const w = localStorage.getItem(LS_WIN);
    if (c) S.cnt     = { ...S.cnt,     ...JSON.parse(c) };
    if (w) S.winners = JSON.parse(w);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
//  WINNERS LIST
// ─────────────────────────────────────────────────────────────
function addWinner(rk) {
  const info = RINFO[rk];
  const entry = {
    emoji: info.emoji,
    label: info.title,
    mode:  S.mode.charAt(0).toUpperCase() + S.mode.slice(1),
    time:  new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    ts:    Date.now(),
  };
  S.winners.unshift(entry);
  if (S.winners.length > 50) S.winners.pop();
  renderW();
  if (fbOk()) try { push(ref(db(), 'flona/winners'), { ...entry, resultKey:rk, serverTime:serverTimestamp() }); } catch {}
}

function renderW() {
  const el = document.getElementById('wList'); if (!el) return;
  if (!S.winners.length) {
    el.innerHTML = '<div style="text-align:center;padding:18px;opacity:.5">No winners yet 🍦</div>';
    return;
  }
  el.innerHTML = S.winners.slice(0, 50).map(w => `
    <div class="wi">
      <span class="we">${w.emoji}</span>
      <div class="wi2"><div class="wn">${w.label}</div><div class="wm">${w.mode} Mode</div></div>
      <span class="wt">${w.time}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  UI SYNC
// ─────────────────────────────────────────────────────────────
function uiSync() {
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === S.mode));
  const mn = document.getElementById('mName');
  if (mn) mn.textContent = S.mode.charAt(0).toUpperCase() + S.mode.slice(1);
  document.getElementById('spinCnt').textContent = S.cnt[S.mode];
  document.body.classList.toggle('ultra-mode', S.mode === 'ultra');
}

function setResUI(rk) {
  const info = RINFO[rk];
  const em   = document.getElementById('rEm');
  document.getElementById('rTit').textContent = info.title;
  document.getElementById('rSub').textContent = info.sub;
  em.textContent = info.emoji;
  em.classList.remove('wa','la'); void em.offsetWidth;
  em.classList.add((info.win || rk === 'tryagain') ? 'wa' : 'la');
  const box = document.getElementById('rBox');
  box.classList.toggle('grand', !!info.grand);
}

// ─────────────────────────────────────────────────────────────
//  SPIN HANDLER — Admin controller fully integrated
// ─────────────────────────────────────────────────────────────
function spin() {
  if (S.spinning) return;
  S.spinning = true;

  const cv  = document.getElementById('spinWheel');
  const btn = document.getElementById('spinBtn');
  btn.disabled = true; 
  btn.textContent = '⏳';

  let rk;
  let isManual = false;

  if (S.ctrlMode === 'manual' && S.manualNext) {
    rk = S.manualNext;
    isManual = true;
    S.manualNext = null;
    S.ctrlMode = 'logic';
    if (fbOk()) try { set(ref(db(), 'flona/control'), { mode: 'logic', manualNext: null }); } catch {}
  } else {
    S.cnt[S.mode]++;
    rk = S.mode === 'ultra' ? logicUltra(S.cnt[S.mode]) : logicNP(S.cnt[S.mode]);
  }

  const finalDeg = calcFinalDeg(rk);

  cv.style.transition = 'transform 9s cubic-bezier(0.15, 0, 0, 1)';
  cv.style.transform  = `rotate(${finalDeg}deg)`;
  
  startTick();

  setTimeout(() => {
    stopTick();

    cv.style.setProperty('--fd', `${finalDeg}deg`);
    cv.classList.add('wb');
    setTimeout(() => cv.classList.remove('wb'), 600);

    setResUI(rk);
    const info = RINFO[rk];
    info.win ? playWin(info.grand) : playLoss();
    if (info.grand) boom();

    addWinner(rk);
    lsave();
    
    if (!isManual) {
      if (fbOk()) try { set(ref(db(), 'flona/counters'), S.cnt); } catch {}
    }
    
    fbStats();
    document.getElementById('spinCnt').textContent = S.cnt[S.mode];

    S.spinning = false;
    btn.disabled = false; 
    btn.textContent = 'SPIN! 🎰';
  }, 9200);
}
// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
export function initGame() {
  initFB();
  lload();
  renderW();
  fbListen();

  const cv = document.getElementById('spinWheel');
  const sz = Math.min(290, window.innerWidth - 56);
  cv.width = sz; cv.height = sz;
  drawWheel(cv);

  if (fbOk()) {
    get(ref(db(), 'flona/counters')).then(s => {
      if (s.val()) { S.cnt = { ...S.cnt, ...s.val() }; uiSync(); }
    });
    get(ref(db(), 'flona/winners')).then(s => {
      if (s.val()) {
        S.winners = Object.values(s.val()).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50);
        renderW();
      }
    });
  }

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (S.spinning) return;
      S.mode = b.dataset.mode;
      playMode();
      uiSync();
    });
  });

  document.getElementById('spinBtn').addEventListener('click', spin);
  document.getElementById('sndBtn').addEventListener('click', () => {
    S.soundOn = !S.soundOn;
    document.getElementById('sndBtn').textContent = S.soundOn ? '🔊' : '🔇';
    toast(S.soundOn ? 'Sound ON 🔊' : 'Sound OFF 🔇');
  });
  document.getElementById('wTog').addEventListener('click', () => {
    const p = document.getElementById('wPan'), o = p.classList.toggle('open');
    document.getElementById('wArr').textContent = o ? '▴' : '▾';
  });

  uiSync();
}