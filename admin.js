// ============================================================
//  FLONA ICE CREAM — admin.js
//  Full admin panel with correct next prediction display
// ============================================================
import { initFB, db, fbOk, ref, set, get, onValue } from './firebase-config.js';

const PRICE = { normal:20, pro:50, ultra:100 };
let stats    = { totalSpins:0, totalRevenue:0, normal:0, pro:0, ultra:0 };
let counters = { normal:0, pro:0, ultra:0 };
let winners  = [];
let ctrlMode = 'logic';
let manualSelected = null;  // which result button is selected in manual mode

// ─────────────────────────────────────────────────────────────
//  EXACT SAME LOGIC AS game.js (for prediction display)
// ─────────────────────────────────────────────────────────────
// Normal / Pro — 20-round cycle
function logicNP(step) {
  const s = ((step - 1) % 20) + 1;
  if (s <= 4)   return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 5)  return { emoji:'🍦', label:'Win No 01',          cyclePos: s };
  if (s <= 9)   return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 10) return { emoji:'🔄', label:'Try Again',          cyclePos: s };
  if (s === 11) return { emoji:'🍦', label:'Win No 01',          cyclePos: s };
  if (s <= 15)  return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 16) return { emoji:'🔄', label:'Try Again',          cyclePos: s };
  if (s <= 19)  return { emoji:'🧊', label:'Empty',              cyclePos: s };
  return              { emoji:'🏆', label:'Grand Prize (No 04)', cyclePos: s };
}

// Ultra — 23-round cycle
function logicUltra(step) {
  const s = ((step - 1) % 23) + 1;
  if (s <= 4)   return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 5)  return { emoji:'🍨', label:'Win No 02',          cyclePos: s };
  if (s <= 9)   return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 10) return { emoji:'🔄', label:'Try Again',          cyclePos: s };
  if (s === 11) return { emoji:'🍨', label:'Win No 02',          cyclePos: s };
  if (s <= 15)  return { emoji:'🧊', label:'Empty',              cyclePos: s };
  if (s === 16) return { emoji:'🔄', label:'Try Again',          cyclePos: s };
  if (s <= 22)  return { emoji:'🧊', label:'Empty',              cyclePos: s };
  return              { emoji:'🏆', label:'Grand Prize (No 04)', cyclePos: s };
}

// Helper: get next prediction info for a mode
function getNextPrediction(mode, currentStep) {
  const nextStep = currentStep + 1;
  return mode === 'ultra' ? logicUltra(nextStep) : logicNP(nextStep);
}

// Helper: get current step position in cycle
function getCycleInfo(mode, step) {
  if (step === 0) return { cyclePos: 0, cycleMax: mode === 'ultra' ? 23 : 20 };
  const cycleMax = mode === 'ultra' ? 23 : 20;
  const cyclePos = ((step - 1) % cycleMax) + 1;
  return { cyclePos, cycleMax };
}

// ─────────────────────────────────────────────────────────────
//  CHART
// ─────────────────────────────────────────────────────────────
let chart;
function renderChart() {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById('rc'); if (!ctx) return;
  const d = [
    (stats.normal||0) * PRICE.normal,
    (stats.pro||0)    * PRICE.pro,
    (stats.ultra||0)  * PRICE.ultra,
  ];
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Normal Rs.20', 'Pro Rs.50', 'Ultra Rs.100'],
      datasets: [{
        data: d,
        backgroundColor: ['rgba(255,183,197,.78)', 'rgba(152,255,152,.78)', 'rgba(206,147,216,.78)'],
        borderColor:      ['#FF8FA3', '#66BB6A', '#AB47BC'],
        borderWidth: 2, borderRadius: 10, borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: v => 'Rs.' + v.formattedValue } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: 'rgba(165,214,167,.8)', callback: v => 'Rs.' + v }, grid: { color: 'rgba(255,255,255,.06)' } },
        x: { ticks: { color: 'rgba(165,214,167,.8)' }, grid: { display: false } },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD UPDATE
// ─────────────────────────────────────────────────────────────
function dash() {
  $('tr',  'Rs.' + (stats.totalRevenue||0).toLocaleString());
  $('ts',  (stats.totalSpins||0) + ' spins');
  $('nSp', stats.normal||0);  $('nRv', 'Rs.' + ((stats.normal||0)*PRICE.normal).toLocaleString());
  $('pSp', stats.pro||0);     $('pRv', 'Rs.' + ((stats.pro||0)*PRICE.pro).toLocaleString());
  $('uSp', stats.ultra||0);   $('uRv', 'Rs.' + ((stats.ultra||0)*PRICE.ultra).toLocaleString());

  // Step counters
  $('cN', counters.normal||0);
  $('cP', counters.pro||0);
  $('cU', counters.ultra||0);

  // Cycle position (e.g. "Round 5 / 20")
  const ciN = getCycleInfo('normal', counters.normal||0);
  const ciP = getCycleInfo('pro',    counters.pro||0);
  const ciU = getCycleInfo('ultra',  counters.ultra||0);
  $('cpN', counters.normal === 0 ? '–' : `Round ${ciN.cyclePos} / ${ciN.cycleMax}`);
  $('cpP', counters.pro    === 0 ? '–' : `Round ${ciP.cyclePos} / ${ciP.cycleMax}`);
  $('cpU', counters.ultra  === 0 ? '–' : `Round ${ciU.cyclePos} / ${ciU.cycleMax}`);

  // Next spin prediction
  const pN = getNextPrediction('normal', counters.normal||0);
  const pP = getNextPrediction('pro',    counters.pro||0);
  const pU = getNextPrediction('ultra',  counters.ultra||0);

  setNextPrediction('nN', pN);
  setNextPrediction('nP', pP);
  setNextPrediction('nU', pU);

  renderChart();
  renderW();
}

function $(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function setNextPrediction(id, pred) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = `<span style="font-size:1.1em">${pred.emoji}</span> ${pred.label} <small style="opacity:.6">(Round ${pred.cyclePos})</small>`;
}

function renderW() {
  const el = document.getElementById('awList'); if (!el) return;
  if (!winners.length) {
    el.innerHTML = '<p style="opacity:.55;text-align:center;padding:20px">No winners yet.</p>';
    return;
  }
  el.innerHTML = winners.slice(0, 50).map(w => `
    <div class="aw">
      <span class="awe">${w.emoji||'🍦'}</span>
      <div class="awi">
        <div class="awn">${w.label||'Win'}</div>
        <div class="awm">${w.mode||''} Mode</div>
      </div>
      <span class="awt">${w.time||''}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  CONTROL
// ─────────────────────────────────────────────────────────────
function setCtrl(mode, result = null) {
  ctrlMode = mode;
 if (fbOk()) try { set(ref(db(), 'flona/control'), { mode: 'logic', manualNext: null }); } catch {}
  at(mode === 'logic'
    ? '✅ Logic Mode — auto sequence active'
    : `🎯 Manual set: "${result}" — next spin will get this result`);
}

function updateCtrlUI() {
  document.getElementById('cL')?.classList.toggle('ca', ctrlMode === 'logic');
  document.getElementById('cM')?.classList.toggle('ca', ctrlMode === 'manual');

  const s = document.getElementById('cSt');
  if (s) {
    if (ctrlMode === 'manual' && manualSelected) {
      const labels = {
      };
      s.textContent = `⚙️ Manual Override ACTIVE — Next spin → ${labels[manualSelected] || manualSelected}`;
    } else if (ctrlMode === 'manual') {
      s.textContent = '⚙️ Manual Mode — Select a result below';
    } else {
      s.textContent = '✅ Logic Mode Active';
    }
  }

  const mp = document.getElementById('mp');
  if (mp) mp.style.display = ctrlMode === 'manual' ? 'grid' : 'none';

  // Highlight selected manual result button
  document.querySelectorAll('.mbtn').forEach(b => {
    b.classList.toggle('msel', ctrlMode === 'manual' && b.dataset.result === manualSelected);
  });
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE LISTENERS
// ─────────────────────────────────────────────────────────────
function listen() {
  const d = db();
  onValue(ref(d, 'flona/stats'),    s => { if (s.val()) { stats    = s.val(); dash(); } });
  onValue(ref(d, 'flona/counters'), s => { if (s.val()) { counters = s.val(); dash(); } });
  onValue(ref(d, 'flona/winners'),  s => {
    if (s.val()) {
      winners = Object.values(s.val()).sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 50);
      renderW();
    }
  });
  onValue(ref(d, 'flona/control'),  s => {
    if (s.val() && s.val().mode !== undefined) {
      ctrlMode       = s.val().mode;
      manualSelected = s.val().manualNext || null;
      updateCtrlUI();
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  COUNTER MANAGEMENT
// ─────────────────────────────────────────────────────────────
function resetCnt() {
  if (!confirm('Reset ALL step counters?\nPrize sequences restart from Round 1.')) return;
  counters = { normal:0, pro:0, ultra:0 };
  if (fbOk()) try { set(ref(db(), 'flona/counters'), counters); } catch {}
  try { localStorage.removeItem('flona_cnt'); } catch {}
  dash();
  at('🔄 All counters reset to 0!');
}

function resetSt() {
  if (!confirm('Reset ALL stats and revenue?\nCannot undo!')) return;
  stats = { totalSpins:0, totalRevenue:0, normal:0, pro:0, ultra:0 };
  if (fbOk()) try { set(ref(db(), 'flona/stats'), stats); } catch {}
  dash();
  at('🔄 All stats reset!');
}

// Manual counter adjustment
function adjustCounter(mode, delta) {
  counters[mode] = Math.max(0, (counters[mode]||0) + delta);
  if (fbOk()) try { set(ref(db(), 'flona/counters'), counters); } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem('flona_cnt') || '{}');
    saved[mode] = counters[mode];
    localStorage.setItem('flona_cnt', JSON.stringify(saved));
  } catch {}
  dash();
  at(`✏️ ${mode.charAt(0).toUpperCase()+mode.slice(1)} counter → ${counters[mode]}`);
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function at(msg, ms = 3200) {
  const t = document.getElementById('atoast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
export function initAdmin() {
  initFB();
  if (fbOk()) {
    listen();
    const d = db();
    get(ref(d, 'flona/stats'))   .then(s => { if (s.val()) { stats    = s.val(); dash(); } });
    get(ref(d, 'flona/counters')).then(s => { if (s.val()) { counters = s.val(); dash(); } });
    get(ref(d, 'flona/winners')) .then(s => {
      if (s.val()) {
        winners = Object.values(s.val()).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50);
        renderW();
      }
    });
    get(ref(d, 'flona/control')).then(s => {
      if (s.val()) {
        ctrlMode       = s.val().mode || 'logic';
        manualSelected = s.val().manualNext || null;
        updateCtrlUI();
      }
    });
    setTimeout(() => {
      const cb = document.getElementById('cb');
      if (cb) { cb.textContent = '🟢 Firebase Live'; cb.style.background = 'rgba(46,125,50,.42)'; }
    }, 1200);
  } else {
    try {
      const c = localStorage.getItem('flona_cnt');
      const w = localStorage.getItem('flona_win');
      if (c) counters = JSON.parse(c);
      if (w) winners  = JSON.parse(w);
    } catch {}
    const ob = document.getElementById('offbar');
    if (ob) ob.style.display = 'flex';
    dash();
  }

  // Control mode buttons
  document.getElementById('cL')?.addEventListener('click', () => setCtrl('logic'));
  document.getElementById('cM')?.addEventListener('click', () => {
    ctrlMode = 'manual';
    manualSelected = null;
    if (fbOk()) try { set(ref(db(), 'flona/control'), { mode: 'manual', manualNext: null }); } catch {}
    updateCtrlUI();
    at('🎯 Manual Mode — select a result below');
  });

  // Manual result buttons
  document.querySelectorAll('.mbtn').forEach(b => {
    b.addEventListener('click', () => setCtrl('manual', b.dataset.result));
  });

  // Counter adjust buttons
  document.querySelectorAll('.cnt-adj').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode  = btn.dataset.mode;
      const delta = parseInt(btn.dataset.delta, 10);
      adjustCounter(mode, delta);
    });
  });

  // Reset buttons
  document.getElementById('rCnt')?.addEventListener('click', resetCnt);
  document.getElementById('rSt') ?.addEventListener('click', resetSt);

  updateCtrlUI();
  dash();
}
