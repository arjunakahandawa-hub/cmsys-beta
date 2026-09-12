// =============================================
// CMSys MOBILE LIGHT CONTROLLER (mobile-light.js)
// Designed specifically for older / low-end smartphones.
// Zero bloat, pure fast data entry & field progress.
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

// In-Memory Store
const mlStore = {
  currentZone: localStorage.getItem("ncw_saved_zone") || "A-Zone",
  selectedDate: getLocalDateString(),
  workOrders: [],
  sailors: [],
  dailyAllocations: [],
  inventory: [],
  selectedAssignWoKey: "",
  assignedTemp: new Set(),
  activeTab: "tasks"
};

// =============================================
// DUAL FIREBASE INITIALIZATION
// =============================================
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
  console.log("⚡ Mobile Light: Firebase connected");
} catch (e) {
  console.error("Firebase Light init error:", e);
}

// Toast
let toastTimer = null;
function showLightToast(msg, icon = "✅") {
  const t = document.getElementById("mlToast");
  const m = document.getElementById("mlToastMsg");
  const i = document.getElementById("mlToastIcon");
  if (!t) return;
  i.textContent = icon;
  m.textContent = msg;
  t.classList.remove("translate-y-24");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add("translate-y-24");
  }, 3000);
}

// Tab Switching
function switchLightTab(tabName) {
  mlStore.activeTab = tabName;
  const tabs = ["tasks", "new", "assign", "inventory"];
  tabs.forEach(t => {
    const view = document.getElementById("view" + t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById("tabBtn" + t.charAt(0).toUpperCase() + t.slice(1));
    if (view) {
      if (t === tabName) view.classList.remove("hidden");
      else view.classList.add("hidden");
    }
    if (btn) {
      if (t === tabName) btn.classList.add("active-tab");
      else btn.classList.remove("active-tab");
    }
  });

  if (tabName === "assign") {
    renderAssignDropdown();
    renderSailorChecklist();
  }
}

// Zone Selector Setup
function initZoneSelectors() {
  const sel1 = document.getElementById("mlZoneSelect");
  const sel2 = document.getElementById("mlNewZone");
  let opts = "";
  STANDARD_ZONES.forEach(z => {
    const isSel = isZoneMatch(z.id, mlStore.currentZone) ? "selected" : "";
    opts += `<option value="${z.id}" ${isSel}>${z.name}</option>`;
  });
  if (sel1) sel1.innerHTML = opts;
  if (sel2) sel2.innerHTML = opts;

  const dp = document.getElementById("mlDatePicker");
  if (dp) dp.value = mlStore.selectedDate;
}

function changeLightZone(newZone) {
  mlStore.currentZone = newZone;
  localStorage.setItem("ncw_saved_zone", newZone);
  renderLightTasks();
  if (mlStore.activeTab === "assign") {
    renderAssignDropdown();
    renderSailorChecklist();
  }
}

function changeLightDate(newDate) {
  if (!newDate) return;
  mlStore.selectedDate = newDate;
  renderLightTasks();
  if (mlStore.activeTab === "assign") {
    renderAssignDropdown();
    renderSailorChecklist();
  }
}

function refreshLightData() {
  showLightToast("Syncing with live server...", "🔄");
  renderLightTasks();
  renderSailorChecklist();
}

// =============================================
// TAB 1: RENDER TASKS & PROGRESS
// =============================================
function renderLightTasks() {
  const container = document.getElementById("mlTaskList");
  const countBadge = document.getElementById("mlTaskCount");
  if (!container) return;

  const currentZoneTasks = mlStore.workOrders.filter(wo => {
    const zid = wo.zone_id || wo.zone || "";
    return isZoneMatch(zid, mlStore.currentZone);
  });

  if (countBadge) countBadge.textContent = currentZoneTasks.length;

  if (currentZoneTasks.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
        <p class="text-sm font-bold">No tasks found in ${mlStore.currentZone}</p>
        <button type="button" onclick="switchLightTab('new')" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold active-scale">
          ➕ Create First Job
        </button>
      </div>
    `;
    return;
  }

  let html = "";
  currentZoneTasks.forEach(wo => {
    const key = wo._fbKey || wo.id;
    const desc = escapeHtml(wo.description || wo.title || "Untitled Job");
    const status = wo.status || "Active";
    const progress = parseInt(wo.progress, 10) || 0;
    const priority = wo.priority || "Medium";

    let statusCls = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (status === "Pending") statusCls = "bg-amber-500/20 text-amber-300 border-amber-500/30";
    else if (status === "Hold") statusCls = "bg-rose-500/20 text-rose-300 border-rose-500/30";
    else if (status === "Completed") statusCls = "bg-blue-500/20 text-blue-300 border-blue-500/30";

    const assignedCount = (Array.isArray(wo.assigned) ? wo.assigned.length : (wo.assigned ? Object.keys(wo.assigned).length : 0));

    html += `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusCls}">${status}</span>
              <span class="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">${priority}</span>
              <span class="text-[9px] font-bold text-teal-400 bg-slate-800 px-1.5 py-0.5 rounded">👷 ${assignedCount} Crew</span>
            </div>
            <h3 class="text-xs font-bold text-white leading-tight">${desc}</h3>
          </div>
        </div>

        <!-- Progress Slider -->
        <div class="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <div class="flex items-center justify-between text-[10px] font-bold">
            <span class="text-slate-400">Progress</span>
            <span id="progLabel_${key}" class="text-teal-400 font-mono">${progress}%</span>
          </div>
          <input type="range" min="0" max="100" step="5" value="${progress}" 
                 oninput="document.getElementById('progLabel_${key}').textContent = this.value + '%'"
                 onchange="updateTaskProgress('${key}', this.value)"
                 class="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg">
        </div>

        <!-- Action Row -->
        <div class="flex items-center gap-1.5 pt-1">
          <button type="button" onclick="quickAssignToTask('${key}')" class="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] rounded-lg border border-slate-700 active-scale flex items-center justify-center gap-1">
            <span>👥</span> Assign Crew
          </button>
          ${status !== "Active" ? `
            <button type="button" onclick="activateTask('${key}')" class="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg active-scale">
              Proceed ➔
            </button>
          ` : `
            <button type="button" onclick="toggleTaskStatus('${key}', 'Hold')" class="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] rounded-lg border border-slate-700 active-scale">
              Hold
            </button>
          `}
        </div>
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
    showLightToast(`Progress updated to ${num}%`, "📈");
  });
}

function activateTask(key) {
  if (!opsDB || !key) return;
  opsDB.ref(`work_orders/${key}`).update({
    status: "Active",
    last_updated: Date.now()
  }).then(() => {
    showLightToast("Work Order Activated / Proceeded!", "🚀");
  });
}

function toggleTaskStatus(key, newStatus) {
  if (!opsDB || !key) return;
  opsDB.ref(`work_orders/${key}`).update({
    status: newStatus,
    last_updated: Date.now()
  }).then(() => {
    showLightToast(`Status changed to ${newStatus}`, "ℹ️");
  });
}

// =============================================
// TAB 2: CREATE NEW WORK ORDER
// =============================================
function submitNewLightTask() {
  const descEl = document.getElementById("mlNewDesc");
  const zoneEl = document.getElementById("mlNewZone");
  const prioEl = document.getElementById("mlNewPriority");

  const desc = descEl ? descEl.value.trim() : "";
  const zone = zoneEl ? zoneEl.value : mlStore.currentZone;
  const prio = prioEl ? prioEl.value : "Medium";

  if (!desc) {
    showLightToast("Please enter work description!", "⚠️");
    if (descEl) descEl.focus();
    return;
  }

  const payload = {
    description: desc,
    zone_id: zone,
    priority: prio,
    status: "Active",
    progress: 0,
    start_date: mlStore.selectedDate,
    created_at: Date.now()
  };

  opsDB.ref("work_orders").push(payload).then(() => {
    if (descEl) descEl.value = "";
    showLightToast("Work Order Created Successfully! 🚀", "✅");
    mlStore.currentZone = zone;
    const sel = document.getElementById("mlZoneSelect");
    if (sel) sel.value = zone;
    switchLightTab("tasks");
  }).catch(err => {
    showLightToast("Error: " + err.message, "⚠️");
  });
}

// =============================================
// TAB 3: DAILY LABOUR ASSIGN & EVALUATION
// =============================================
function renderAssignDropdown() {
  const sel = document.getElementById("mlAssignWoSelect");
  if (!sel) return;

  const currentZoneTasks = mlStore.workOrders.filter(wo => {
    const zid = wo.zone_id || wo.zone || "";
    return isZoneMatch(zid, mlStore.currentZone);
  });

  let opts = '<option value="">-- Choose Active Work Order --</option>';
  currentZoneTasks.forEach(wo => {
    const key = wo._fbKey || wo.id;
    const isSel = key === mlStore.selectedAssignWoKey ? "selected" : "";
    const desc = escapeHtml(wo.description || "Untitled Job");
    opts += `<option value="${key}" ${isSel}>${desc}</option>`;
  });
  sel.innerHTML = opts;
}

function quickAssignToTask(woKey) {
  mlStore.selectedAssignWoKey = woKey;
  switchLightTab("assign");
}

function onAssignWoChanged() {
  const sel = document.getElementById("mlAssignWoSelect");
  mlStore.selectedAssignWoKey = sel ? sel.value : "";
  renderSailorChecklist();
}

function renderSailorChecklist() {
  const container = document.getElementById("mlSailorList");
  const countEl = document.getElementById("mlAssignSelectedCount");
  if (!container) return;

  const wo = mlStore.workOrders.find(w => (w._fbKey || w.id) === mlStore.selectedAssignWoKey);
  const assignedSet = new Set();
  if (wo && wo.assigned) {
    const arr = Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned);
    arr.forEach(id => assignedSet.add(String(id)));
  }

  // Also include today's committed allocations for this task
  (mlStore.dailyAllocations || []).forEach(da => {
    if (da.date === mlStore.selectedDate && da.work_order_id === mlStore.selectedAssignWoKey) {
      if (da.sailor_id) assignedSet.add(String(da.sailor_id));
    }
  });

  mlStore.assignedTemp = assignedSet;
  if (countEl) countEl.textContent = `${assignedSet.size} Selected`;

  // Filter sailors belonging to current zone or all if unassigned
  const zoneSailors = mlStore.sailors.filter(s => {
    const sz = s.zone_assigned || s.zone || "";
    return isZoneMatch(sz, mlStore.currentZone) || assignedSet.has(String(s.id)) || assignedSet.has(String(s._fbKey));
  });

  if (zoneSailors.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-slate-500 text-xs">No sailors assigned to ${mlStore.currentZone}</div>`;
    return;
  }

  let html = "";
  zoneSailors.forEach(s => {
    const sid = String(s.id || s._fbKey);
    const sfb = String(s._fbKey || s.id);
    const isChecked = assignedSet.has(sid) || assignedSet.has(sfb);
    const name = escapeHtml(s.name || "Unknown");
    const offNo = escapeHtml(s.official_number || s.off_no || "");
    const rank = escapeHtml(s.rank || "");
    const trade = escapeHtml(s.trade || "");

    html += `
      <label class="flex items-center justify-between p-2 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-teal-950/30' : ''}">
        <div class="flex items-center gap-2 min-w-0">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSailorSelection('${sid}', this.checked)" class="w-4 h-4 rounded accent-teal-500 cursor-pointer">
          <div class="truncate">
            <p class="text-xs font-bold text-white truncate">${rank} ${name}</p>
            <p class="text-[10px] text-slate-400 font-mono">${offNo} • <strong class="text-teal-400">${trade}</strong></p>
          </div>
        </div>
        <!-- Quick 1-Tap Evaluation (Stars/Rating) -->
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); quickEvaluateSailor('${sid}')" class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 active-scale" title="Evaluate Sailor">
          ⭐ Rate
        </button>
      </label>
    `;
  });

  container.innerHTML = html;
}

function toggleSailorSelection(sid, isChecked) {
  if (isChecked) mlStore.assignedTemp.add(sid);
  else mlStore.assignedTemp.delete(sid);

  const countEl = document.getElementById("mlAssignSelectedCount");
  if (countEl) countEl.textContent = `${mlStore.assignedTemp.size} Selected`;
}

function quickEvaluateSailor(sid) {
  const rating = prompt("Enter Sailor Evaluation (1-5 Stars or Notes):", "5");
  if (!rating) return;
  opsDB.ref(`evaluations/${mlStore.selectedDate}_${sid}`).set({
    date: mlStore.selectedDate,
    sailor_id: sid,
    rating: rating,
    timestamp: Date.now()
  }).then(() => {
    showLightToast("Sailor Evaluated: " + rating + " ⭐", "⭐");
  });
}

function commitLightLabour() {
  const woKey = mlStore.selectedAssignWoKey;
  if (!woKey) {
    showLightToast("Please select a Work Order first!", "⚠️");
    return;
  }

  const assignedArr = Array.from(mlStore.assignedTemp);
  if (assignedArr.length === 0) {
    showLightToast("No sailors selected to commit!", "⚠️");
    return;
  }

  // 1. Update work order assigned array
  opsDB.ref(`work_orders/${woKey}`).update({
    assigned: assignedArr,
    last_assigned_date: mlStore.selectedDate,
    last_updated: Date.now()
  });

  // 2. Commit to daily_allocations
  const batch = {};
  assignedArr.forEach(sid => {
    const key = `${mlStore.selectedDate}_${sid}`;
    batch[`daily_allocations/${key}`] = {
      date: mlStore.selectedDate,
      sailor_id: sid,
      work_order_id: woKey,
      zone_id: mlStore.currentZone,
      status: "Active",
      role_today: "Worker",
      timestamp: Date.now()
    };
  });

  opsDB.ref().update(batch).then(() => {
    showLightToast(`Committed ${assignedArr.length} Sailors for Today! 🚀`, "✅");
    switchLightTab("tasks");
  }).catch(err => {
    showLightToast("Error: " + err.message, "⚠️");
  });
}

// =============================================
// TAB 4: INVENTORY
// =============================================
function renderLightInventory(filter = "") {
  const container = document.getElementById("mlInvList");
  if (!container) return;

  const f = filter.toLowerCase().trim();
  const list = (mlStore.inventory || []).filter(item => {
    if (!f) return true;
    const name = (item.name || item.item_name || "").toLowerCase();
    const cat = (item.category || "").toLowerCase();
    return name.includes(f) || cat.includes(f);
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">No inventory items found.</div>`;
    return;
  }

  let html = "";
  list.forEach(it => {
    const name = escapeHtml(it.name || it.item_name || "Item");
    const qty = it.qty !== undefined ? it.qty : (it.quantity || 0);
    const unit = escapeHtml(it.unit || "units");
    const cat = escapeHtml(it.category || "General");

    html += `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-white truncate">${name}</p>
          <p class="text-[10px] text-slate-400">${cat}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="text-xs font-black text-teal-400 font-mono">${qty}</span>
          <span class="text-[9px] text-slate-400 block">${unit}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function filterLightInventory() {
  const q = document.getElementById("mlInvSearch");
  renderLightInventory(q ? q.value : "");
}

// =============================================
// REALTIME DATA LISTENERS
// =============================================
function initLightListeners() {
  initZoneSelectors();

  // 1. Work Orders Listener
  if (opsDB) {
    opsDB.ref("work_orders").on("value", snapshot => {
      const val = snapshot.val() || {};
      mlStore.workOrders = Object.entries(val).map(([k, v]) => ({
        ...v,
        _fbKey: k,
        id: v.id || k
      }));
      renderLightTasks();
      if (mlStore.activeTab === "assign") renderAssignDropdown();
    });

    // 2. Daily Allocations Listener
    opsDB.ref("daily_allocations").on("value", snapshot => {
      const val = snapshot.val() || {};
      mlStore.dailyAllocations = Object.values(val);
      if (mlStore.activeTab === "assign") renderSailorChecklist();
    });

    // 3. Inventory Listener
    opsDB.ref("inventory").on("value", snapshot => {
      const val = snapshot.val() || {};
      mlStore.inventory = Object.values(val);
      if (mlStore.activeTab === "inventory") renderLightInventory();
    });
  }

  // 4. Sailors Database Listener
  if (sailorsDB) {
    sailorsDB.ref("sailors").on("value", snapshot => {
      const val = snapshot.val() || {};
      mlStore.sailors = Object.entries(val).map(([k, v]) => ({
        ...v,
        _fbKey: k,
        id: v.id || k
      }));
      if (mlStore.activeTab === "assign") renderSailorChecklist();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initLightListeners();
});
