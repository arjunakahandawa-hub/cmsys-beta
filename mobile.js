// =============================================
// CMSys MOBILE LIGHT CONTROLLER (mobile-light.js v2.0.0)
// Designed for older & budget smartphones.
// Fast, clean Light Naval Theme matching pic - 02.
// Tabs: Home, Estimate, LMD, Sailors
// =============================================

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const STANDARD_ZONES = [
  { id: "A-Zone", name: "A-Zone" },
  { id: "B-Zone", name: "B-Zone" },
  { id: "BC-Zone", name: "BC-Zone" },
  { id: "C-Zone", name: "C-Zone" },
  { id: "D-Zone", name: "D-Zone" },
  { id: "E-Zone", name: "E-Zone" },
  { id: "G-Zone", name: "G-Zone" },
  { id: "FH-Zone", name: "FH-Zone" },
  { id: "OTW", name: "OTW" },
  { id: "Supply-School", name: "Supply School" },
  { id: "Pump-House", name: "Pump House" },
  { id: "Carpentry-Shop", name: "Carpentry & Painter Shop" },
  { id: "Welding-Shop", name: "Welding Shop" },
  { id: "Aluminium-Workshop", name: "Aluminium Workshop" }
];

function isZoneMatch(z1, z2) {
  if (!z1 || !z2) return false;
  const s1 = String(z1).toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = String(z2).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  return false;
}

// Store
const mlStore = {
  currentZone: localStorage.getItem("ncw_saved_zone") || "A-Zone",
  selectedDate: getLocalDateString(),
  workOrders: [],
  sailors: [],
  dailyAllocations: [],
  lmdRecords: [],
  activeTab: "home",
  estCategory: "concrete",
  selectedAssignKey: ""
};

// Dual Firebase Config
const sailorsFirebaseConfig = {
  apiKey: "AIzaSyDmHdg1FfgR_-4pKJ5z0inI8-BZ21MUtvg",
  authDomain: "ce-admin-panel2025.firebaseapp.com",
  databaseURL: "https://ce-admin-panel2025-default-rtdb.firebaseio.com",
  projectId: "ce-admin-panel2025",
  storageBucket: "ce-admin-panel2025.firebasestorage.app",
  messagingSenderId: "1093761746400",
  appId: "1:1093761746400:web:1984fad8019641b2ca5785"
};

const opsFirebaseConfig = {
  apiKey: "AIzaSyCRgW9qcd42Ks_C56csNL85jXd5OsLD8q0",
  authDomain: "ncw-ps-operations.firebaseapp.com",
  databaseURL: "https://ncw-ps-operations-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ncw-ps-operations",
  storageBucket: "ncw-ps-operations.firebasestorage.app",
  messagingSenderId: "992132561625",
  appId: "1:992132561625:web:5b4f0c753c568cea66dcc8"
};

let sailorsDB = null;
let opsDB = null;

try {
  const sApp = firebase.initializeApp(sailorsFirebaseConfig, "mlSailors");
  sailorsDB = firebase.database(sApp);
  const oApp = firebase.initializeApp(opsFirebaseConfig, "mlOperations");
  opsDB = firebase.database(oApp);
} catch (e) {
  console.warn("Mobile Light Firebase Init:", e);
}

// ---------------------------------------------
// TAB SWITCHER
// ---------------------------------------------
function switchLightTab(tabId) {
  mlStore.activeTab = tabId;
  const tabs = ["home", "estimate", "lmd", "sailors"];
  
  tabs.forEach(t => {
    const view = document.getElementById(t === "home" ? "viewHome" : t === "estimate" ? "viewEstimate" : t === "lmd" ? "viewLmd" : "viewSailors");
    const btn = document.getElementById(t === "home" ? "tabBtnHome" : t === "estimate" ? "tabBtnEstimate" : t === "lmd" ? "tabBtnLmd" : "tabBtnSailors");
    
    if (view) {
      if (t === tabId) view.classList.remove("hidden");
      else view.classList.add("hidden");
    }
    if (btn) {
      if (t === tabId) {
        btn.className = "flex flex-col items-center gap-0.5 active-tab active-scale px-3 py-1 text-teal-600 font-extrabold";
      } else {
        btn.className = "flex flex-col items-center gap-0.5 text-slate-500 hover:text-slate-800 active-scale px-3 py-1 font-semibold";
      }
    }
  });

  if (tabId === "estimate") calcLightEstimate();
  else if (tabId === "lmd") loadLightLmdRecords();
  else if (tabId === "sailors") renderLightSailorList();
}

// ---------------------------------------------
// INITIALIZATION
// ---------------------------------------------
function initLightApp() {
  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) {
    zoneSelect.innerHTML = STANDARD_ZONES.map(z => 
      `<option value="${z.id}" ${z.id === mlStore.currentZone ? "selected" : ""}>${z.name}</option>`
    ).join("");
  }

  const datePicker = document.getElementById("mlDatePicker");
  if (datePicker) {
    datePicker.value = mlStore.selectedDate;
  }

  loadLightData();
}

function changeLightZone(z) {
  mlStore.currentZone = z;
  localStorage.setItem("ncw_saved_zone", z);
  renderLightTasks();
  if (mlStore.activeTab === "lmd") loadLightLmdRecords();
}

function changeLightDate(d) {
  mlStore.selectedDate = d;
  renderLightTasks();
}

function refreshLightData() {
  showLightToast("Refreshing data...", "🔄");
  loadLightData();
}

function loadLightData() {
  if (sailorsDB) {
    sailorsDB.ref("sailors").once("value", snap => {
      const d = snap.val();
      mlStore.sailors = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.sailors.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      renderLightTasks();
      if (mlStore.activeTab === "sailors") renderLightSailorList();
    });
  }

  if (opsDB) {
    opsDB.ref("work_orders").once("value", snap => {
      const d = snap.val();
      mlStore.workOrders = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.workOrders.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      renderLightTasks();
    });

    opsDB.ref("daily_allocations").once("value", snap => {
      const d = snap.val();
      mlStore.dailyAllocations = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.dailyAllocations.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      renderLightTasks();
    });
  }
}

// ---------------------------------------------
// TAB 1: HOME (TASKS & DETAILS) - PIC - 02 LIGHT CARD
// ---------------------------------------------
function renderLightTasks() {
  const container = document.getElementById("mlTaskList");
  const countEl = document.getElementById("mlTaskCount");
  if (!container) return;

  const targetDate = mlStore.selectedDate;
  const currentZone = mlStore.currentZone;

  const currentZoneTasks = mlStore.workOrders.filter(wo => {
    const z = wo.zone_id || wo.zone || "";
    return isZoneMatch(z, currentZone);
  });

  if (countEl) countEl.textContent = currentZoneTasks.length;

  if (currentZoneTasks.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div class="text-3xl">📋</div>
        <p class="text-xs font-bold text-slate-700">No active tasks in ${currentZone}</p>
        <button type="button" onclick="openNewTaskModal()" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold active-scale">
          ➕ Create First Job
        </button>
      </div>`;
    return;
  }

  let html = "";
  currentZoneTasks.forEach(wo => {
    const key = wo._fbKey || wo.id;
    const desc = escapeHtml(wo.description || wo.title || "Untitled Job");
    const status = wo.status || "Active";
    const progress = Math.min(100, Math.max(0, parseInt(wo.progress, 10) || 0));
    const prio = wo.priority || "Medium";
    const isCommittedToday = (wo.last_commit_date === targetDate || wo.last_committed_date === targetDate);

    // Assigned Crew
    const assignedIds = Array.isArray(wo.assigned) ? wo.assigned : (wo.assigned ? Object.values(wo.assigned) : []);
    const crewCount = assignedIds.length;

    // Badges (pic - 02)
    let prioBadge = prio === "Low" 
      ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Low</span>'
      : (prio === "High" || prio === "Urgent" 
          ? '<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🔴 ' + prio + '</span>'
          : '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟡 Medium</span>');

    const statusBadge = '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">' + escapeHtml(status) + '</span>';
    const activeTodayBadge = isCommittedToday 
      ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active Today</span>'
      : (crewCount > 0 ? '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Standby</span>' : '');

    const typeBadge = '<span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">' + (wo.type ? '📋 ' + wo.type : 'TASK') + '</span>';

    // Sailor Pills (pic - 02)
    let sailorPillsHtml = '';
    if (crewCount > 0) {
      sailorPillsHtml = assignedIds.slice(0, 3).map(sid => {
        const s = mlStore.sailors.find(sailor => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid));
        const rawName = s ? (s.name || s.off_no || 'Sailor') : ('Sailor ' + sid);
        const nameParts = rawName.split(' ');
        const displayShort = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : rawName.toUpperCase();
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">' + 
               escapeHtml(displayShort) + ' <span class="bg-orange-500 text-white px-1.5 py-0.1 rounded-full text-[8px] font-black">7.0</span></span>';
      }).join(' ');
      if (crewCount > 3) sailorPillsHtml += ' <span class="text-[9px] text-slate-400 font-bold">+' + (crewCount - 3) + '</span>';
    } else {
      sailorPillsHtml = '<span class="text-slate-400 text-xs italic">No sailors assigned yet</span>';
    }

    // Quick Commit Button
    let commitBtnHtml = '';
    if (!isCommittedToday && status !== 'Completed' && crewCount > 0) {
      commitBtnHtml = `
        <div class="pt-2 border-t border-slate-100">
          <button type="button" onclick="commitLightLabour('${key}')" class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active-scale">
            <span>⚡</span> Proceed - Commit Daily Labour (${crewCount})
          </button>
        </div>`;
    }

    html += `
      <!-- WORK ORDER CARD (PIC - 02) -->
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md p-3.5 space-y-2.5 transition-all">
        <!-- Badges Row -->
        <div class="flex items-center gap-1.5 flex-wrap">
          ${prioBadge}
          ${statusBadge}
          ${activeTodayBadge}
          ${typeBadge}
        </div>

        <!-- Title & Location -->
        <div>
          <h3 class="text-sm font-bold text-slate-900 leading-snug">${desc}</h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">📍 ${escapeHtml(wo.location || (currentZone + ' Area'))}</p>
        </div>

        <!-- Progress Slider -->
        <div class="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div class="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Progress</span>
            <span id="progLabel_${key}" class="text-teal-700 font-mono font-black">${progress}%</span>
          </div>
          <input type="range" min="0" max="100" step="5" value="${progress}" 
                 oninput="document.getElementById('progLabel_${key}').textContent = this.value + '%'"
                 onchange="updateTaskProgress('${key}', this.value)"
                 class="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 rounded-lg">
        </div>

        <!-- Assigned Crew Section -->
        <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
          <div class="flex items-center gap-1 flex-wrap flex-1">
            <span class="text-xs font-bold text-slate-700">🧑 ${crewCount} active:</span>
            ${sailorPillsHtml}
          </div>
          <button type="button" onclick="openAssignModal('${key}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-teal-800 font-bold text-[10px] rounded-lg border border-slate-200 active-scale">
            👥 Assign
          </button>
        </div>

        ${commitBtnHtml}
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateTaskProgress(key, val) {
  if (!opsDB || !key) return;
  const num = parseInt(val, 10) || 0;
  opsDB.ref(`work_orders/${key}`).update({
    progress: num,
    last_updated: Date.now()
  }).then(() => {
    showLightToast(`Progress set to ${num}%`, "📈");
  });
}

function commitLightLabour(key) {
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;
  const today = mlStore.selectedDate;
  const assigned = Array.isArray(wo.assigned) ? wo.assigned : (wo.assigned ? Object.values(wo.assigned) : []);

  if (assigned.length === 0) {
    showLightToast("No sailors assigned to commit", "⚠️");
    return;
  }

  assigned.forEach(sid => {
    opsDB.ref(`daily_allocations/${today}_${sid}`).set({
      date: today,
      sailor_id: sid,
      work_order_id: wo.id || key,
      status: "Active"
    });
  });

  opsDB.ref(`work_orders/${key}`).update({
    last_commit_date: today,
    last_committed_date: today
  }).then(() => {
    wo.last_commit_date = today;
    wo.last_committed_date = today;
    showLightToast(`Committed ${assigned.length} sailor(s)!`, "⚡");
    renderLightTasks();
  });
}

// ---------------------------------------------
// TAB 2: CIVIL ESTIMATOR (LIGHTWEIGHT)
// ---------------------------------------------
let mLightEstSummary = "";

function selectLightEstCat(cat) {
  mlStore.estCategory = cat;
  ["concrete", "brick", "plaster"].forEach(c => {
    const inputDiv = document.getElementById(c === "concrete" ? "mlEstConcInputs" : c === "brick" ? "mlEstBrickInputs" : "mlEstPlastInputs");
    const btn = document.getElementById(c === "concrete" ? "mlCatBtnConc" : c === "brick" ? "mlCatBtnBrick" : "mlCatBtnPlast");
    if (inputDiv) {
      if (c === cat) inputDiv.classList.remove("hidden");
      else inputDiv.classList.add("hidden");
    }
    if (btn) {
      if (c === cat) btn.className = "flex-1 py-1.5 rounded-lg bg-teal-600 text-white active-scale";
      else btn.className = "flex-1 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 active-scale";
    }
  });
  calcLightEstimate();
}

function calcLightEstimate() {
  const grid = document.getElementById("mlEstResultGrid");
  const costEl = document.getElementById("mlEstCost");
  const sumEl = document.getElementById("mlEstSummary");
  if (!grid || !costEl) return;

  const cat = mlStore.estCategory;
  let cards = [];
  let summary = "";
  let totalCost = 0;

  if (cat === "concrete") {
    const l = parseFloat(document.getElementById("mlConcL")?.value) || 0;
    const w = parseFloat(document.getElementById("mlConcW")?.value) || 0;
    const t = parseFloat(document.getElementById("mlConcT")?.value) || 0;
    const wetVol = l * w * (t / 12);
    const dryVol = wetVol * 1.54;

    // 1:2:4 Mix
    const cementBags = Math.ceil((1 / 7) * dryVol / 1.25);
    const sandCubes = ((2 / 7) * dryVol / 100).toFixed(2);
    const metalCubes = ((4 / 7) * dryVol / 100).toFixed(2);
    totalCost = (cementBags * 2400) + (parseFloat(sandCubes) * 28000) + (parseFloat(metalCubes) * 26000);

    cards = [
      { label: "Cement Bags", val: cementBags + " Bags" },
      { label: "River Sand", val: sandCubes + " Cubes" },
      { label: "Metal (3/4)", val: metalCubes + " Cubes" },
      { label: "Volume", val: wetVol.toFixed(1) + " cu.ft" }
    ];
    summary = `Concrete 1:2:4 (${l}ft × ${w}ft × ${t}"): ${cementBags} Cement Bags, ${sandCubes} Sand Cubes, ${metalCubes} Metal Cubes. Total: Rs ${totalCost.toLocaleString()}`;
  } else if (cat === "brick") {
    const l = parseFloat(document.getElementById("mlBrickL")?.value) || 0;
    const h = parseFloat(document.getElementById("mlBrickH")?.value) || 0;
    const area = l * h;
    const count = Math.ceil(area * 5.5);
    const cementBags = Math.ceil(area * 0.07);
    const sandCubes = (area * 0.0035).toFixed(2);
    totalCost = (count * 35) + (cementBags * 2400) + (parseFloat(sandCubes) * 28000);

    cards = [
      { label: "Clay Bricks", val: count + " Bricks" },
      { label: "Mortar Cement", val: cementBags + " Bags" },
      { label: "Mortar Sand", val: sandCubes + " Cubes" },
      { label: "Wall Area", val: area.toFixed(0) + " Sq.Ft" }
    ];
    summary = `Brickwork (${l}ft × ${h}ft): ${count} Bricks, ${cementBags} Cement Bags, ${sandCubes} Sand Cubes. Total: Rs ${totalCost.toLocaleString()}`;
  } else {
    const area = parseFloat(document.getElementById("mlPlastArea")?.value) || 0;
    const cementBags = Math.ceil(area * 0.012);
    const sandCubes = (area * 0.012 * 0.06).toFixed(2);
    const paintLitres = Math.ceil((area / 180) * 4);
    totalCost = (cementBags * 2400) + (parseFloat(sandCubes) * 28000) + (paintLitres * 1800);

    cards = [
      { label: "Plaster Cement", val: cementBags + " Bags" },
      { label: "Plaster Sand", val: sandCubes + " Cubes" },
      { label: "Paint Litres", val: paintLitres + " L" },
      { label: "Area", val: area.toFixed(0) + " Sq.Ft" }
    ];
    summary = `Plaster & Paint (${area} Sq.Ft): ${cementBags} Cement Bags, ${sandCubes} Sand, ${paintLitres}L Paint. Total: Rs ${totalCost.toLocaleString()}`;
  }

  mLightEstSummary = summary;
  costEl.textContent = `Rs ${totalCost.toLocaleString()}`;
  grid.innerHTML = cards.map(c => `
    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
      <div class="text-[9px] font-bold text-slate-500 uppercase">${c.label}</div>
      <div class="text-xs font-black text-slate-900 font-mono mt-0.5">${c.val}</div>
    </div>
  `).join("");
  if (sumEl) sumEl.textContent = summary;
}

function copyLightEstimate() {
  if (!mLightEstSummary) calcLightEstimate();
  navigator.clipboard?.writeText(mLightEstSummary).then(() => {
    showLightToast("Estimate copied to clipboard!", "📋");
  });
}

// ---------------------------------------------
// TAB 3: LMD TRACKER (LAST MAINTAINED DATE)
// ---------------------------------------------
function loadLightLmdRecords() {
  const container = document.getElementById("mlLmdList");
  if (!container) return;

  const zone = mlStore.currentZone;
  const cleanZone = zone.replace(/[^a-zA-Z0-9_-]/g, '_');

  const defaultTemplates = [
    { id: "pmp_01", name: "Water Pump #1", location: "Pump House", last_date: "2026-08-15", cycle_days: 30 },
    { id: "pmp_02", name: "Standby Pump #2", location: "Pump House", last_date: "2026-08-10", cycle_days: 30 },
    { id: "gen_01", name: "Backup Generator", location: "Gen Room", last_date: "2026-08-25", cycle_days: 30 },
    { id: "elec_01", name: "Electrical DB Panel", location: "Main Block", last_date: "2026-06-20", cycle_days: 90 }
  ];

  if (opsDB) {
    opsDB.ref(`lmd_records/${cleanZone}`).once("value", snap => {
      const data = snap.val();
      if (data) {
        mlStore.lmdRecords = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      } else {
        mlStore.lmdRecords = defaultTemplates;
      }
      renderLightLmdList();
    });
  } else {
    mlStore.lmdRecords = defaultTemplates;
    renderLightLmdList();
  }
}

function renderLightLmdList() {
  const container = document.getElementById("mlLmdList");
  if (!container) return;

  const q = (document.getElementById("mlLmdSearch")?.value || "").toLowerCase().trim();
  const filtered = mlStore.lmdRecords.filter(r => !q || (r.name && r.name.toLowerCase().includes(q)) || (r.location && r.location.toLowerCase().includes(q)));

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No records found.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => {
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <h4 class="text-xs font-bold text-slate-900">${escapeHtml(r.name)}</h4>
            <p class="text-[10px] text-slate-500">📍 ${escapeHtml(r.location || 'Zone')}</p>
          </div>
          <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">🟢 Active</span>
        </div>
        <div class="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 flex justify-between">
          <span>Last Serviced: <strong>${r.last_date || 'N/A'}</strong></span>
          <span>Cycle: <strong>${r.cycle_days || 30}d</strong></span>
        </div>
        <button type="button" onclick="markLightLmdToday('${r.id}')" class="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-[11px] font-bold active-scale shadow-xs">
          ⚡ Mark Serviced Today
        </button>
      </div>
    `;
  }).join("");
}

function filterLightLmd() {
  renderLightLmdList();
}

function markLightLmdToday(assetId) {
  const today = getLocalDateString();
  const zone = mlStore.currentZone;
  const cleanZone = zone.replace(/[^a-zA-Z0-9_-]/g, '_');

  const item = mlStore.lmdRecords.find(r => String(r.id) === String(assetId));
  if (item) item.last_date = today;

  if (opsDB) {
    opsDB.ref(`lmd_records/${cleanZone}/${assetId}`).update({ last_date: today });
  }
  showLightToast("Serviced date updated to today!", "⚡");
  renderLightLmdList();
}

// ---------------------------------------------
// TAB 4: SAILORS DIRECTORY
// ---------------------------------------------
function renderLightSailorList() {
  const container = document.getElementById("mlSailorList");
  const countEl = document.getElementById("mlSailorCount");
  if (!container) return;

  const q = (document.getElementById("mlSailorSearch")?.value || "").toLowerCase().trim();
  const sailors = mlStore.sailors || [];

  const filtered = sailors.filter(s => {
    if (!q) return true;
    const off = (s.off_no || s.official_number || "").toLowerCase();
    const name = (s.name || "").toLowerCase();
    const trade = (s.trade || s.branch || "").toLowerCase();
    return off.includes(q) || name.includes(q) || trade.includes(q);
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No sailors found.</div>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 80).map(s => {
    const off = s.off_no || s.official_number || "—";
    const rank = s.rank || "AB";
    const name = s.name || "Sailor";
    const trade = s.trade || s.branch || "General";

    return `
      <div class="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-xs font-black">
            ${rank}
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-900 leading-tight">${escapeHtml(name)}</h4>
            <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(off)} • ${escapeHtml(trade)}</span>
          </div>
        </div>
        <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">Available</span>
      </div>
    `;
  }).join("");
}

function filterLightSailors() {
  renderLightSailorList();
}

// ---------------------------------------------
// MODALS: QUICK ASSIGN & NEW TASK
// ---------------------------------------------
function openAssignModal(woKey) {
  mlStore.selectedAssignKey = woKey;
  const modal = document.getElementById("mlAssignModal");
  const picker = document.getElementById("mlAssignSailorPicker");
  if (!modal || !picker) return;

  const wo = mlStore.workOrders.find(w => String(w.id) === String(woKey) || String(w._fbKey) === String(woKey));
  const assigned = new Set((wo && Array.isArray(wo.assigned)) ? wo.assigned.map(String) : []);

  picker.innerHTML = mlStore.sailors.slice(0, 60).map(s => {
    const sid = String(s.id || s._fbKey);
    const checked = assigned.has(sid) ? "checked" : "";
    return `
      <label class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium cursor-pointer">
        <span class="text-slate-800"><strong>${s.rank || 'AB'}</strong> ${escapeHtml(s.name || s.off_no)} (${s.trade || 'MA'})</span>
        <input type="checkbox" value="${sid}" ${checked} class="ml-assign-check w-4 h-4 accent-teal-600">
      </label>
    `;
  }).join("");

  modal.classList.remove("hidden");
}

function closeAssignModal() {
  const modal = document.getElementById("mlAssignModal");
  if (modal) modal.classList.add("hidden");
}

function saveAssignedCrew() {
  const key = mlStore.selectedAssignKey;
  if (!key || !opsDB) return;

  const checks = document.querySelectorAll(".ml-assign-check:checked");
  const crew = Array.from(checks).map(c => c.value);

  opsDB.ref(`work_orders/${key}/assigned`).set(crew).then(() => {
    const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
    if (wo) wo.assigned = crew;
    closeAssignModal();
    showLightToast(`Assigned ${crew.length} sailor(s)!`, "👥");
    renderLightTasks();
  });
}

function openNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  if (modal) modal.classList.remove("hidden");
}

function closeNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  if (modal) modal.classList.add("hidden");
}

function submitNewTask() {
  const desc = (document.getElementById("mlNewDesc")?.value || "").trim();
  const prio = document.getElementById("mlNewPriority")?.value || "Medium";
  const dur = parseInt(document.getElementById("mlNewDuration")?.value, 10) || 1;

  if (!desc) {
    showLightToast("Please enter task description", "⚠️");
    return;
  }

  const zone = mlStore.currentZone;
  const newRef = opsDB.ref("work_orders").push();
  const newWo = {
    id: newRef.key,
    description: desc,
    zone_id: zone,
    status: "Active",
    priority: prio,
    progress: 0,
    duration: dur,
    created_at: Date.now()
  };

  newRef.set(newWo).then(() => {
    mlStore.workOrders.unshift(newWo);
    closeNewTaskModal();
    document.getElementById("mlNewDesc").value = "";
    showLightToast("Work Order created!", "✅");
    renderLightTasks();
  });
}

function showLightToast(msg, icon) {
  const toast = document.getElementById("mlToast");
  const msgEl = document.getElementById("mlToastMsg");
  const iconEl = document.getElementById("mlToastIcon");
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon || "✅";

  toast.classList.remove("translate-y-24");
  toast.classList.add("translate-y-0");

  setTimeout(() => {
    toast.classList.remove("translate-y-0");
    toast.classList.add("translate-y-24");
  }, 2200);
}

window.addEventListener("DOMContentLoaded", initLightApp);
