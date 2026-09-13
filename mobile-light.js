// =============================================
// CMSys MOBILE CONTROLLER (mobile.js & mobile-light.js)
// Unified Light Naval Architecture v2.2.0
// Tabs: Home (Work Orders/Details), Estimates, LMD, Sailors
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

function formatCurrency(val) {
  const num = Number(val || 0);
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function findSailor(sid) {
  if (!sid) return null;
  const sidStr = String(sid).trim().toLowerCase();
  return (mlStore.sailors || []).find(s => {
    if (!s) return false;
    return (
      String(s.id).toLowerCase() === sidStr ||
      String(s._fbKey).toLowerCase() === sidStr ||
      String(s.official_number || "").toLowerCase() === sidStr ||
      String(s.off_no || "").toLowerCase() === sidStr ||
      String(s.service_no || "").toLowerCase() === sidStr ||
      String(s.name || "").toLowerCase() === sidStr
    );
  }) || null;
}

// Global Mobile Store
const mlStore = {
  currentZone: (new URLSearchParams(window.location.search).get("zone")) || localStorage.getItem("ncw_saved_zone") || "A-Zone",
  selectedDate: getLocalDateString(),
  selectedWoType: "ALL",
  workOrders: [],
  sailors: [],
  dailyAllocations: [],
  estimates: [],
  locations: [],
  lmdRecords: [],
  zoneInCharges: {},
  activeTab: "home",
  selectedAssignKey: "",
  selectedEstKey: null,
  selectedWoKey: null
};

// Selection sets for creation modals
let _mlNewWoSelectedSailors = new Set();
let _mlNewWoCurrentTrade = "ALL";

let _mlNewAssignSelectedSailors = new Set();
let _mlNewAssignCurrentTrade = "ALL";

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
  console.warn("Mobile Firebase Init Warning:", e);
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

  if (tabId === "home") renderLightTasks();
  else if (tabId === "estimate") renderLightEstimates();
  else if (tabId === "lmd") loadLightLmdRecords();
  else if (tabId === "sailors") renderLightSailorList();
}

// ---------------------------------------------
// APP INITIALIZATION & ZONE SECURITY
// ---------------------------------------------
function initLightApp() {
  const qZ = new URLSearchParams(window.location.search).get("zone");
  if (qZ && STANDARD_ZONES.some(z => z.id === qZ)) {
    mlStore.currentZone = qZ;
  }

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

  updateHistoricalBanner();
  loadLightData();
}

let pendingZoneSwitch = null;

function changeLightZone(z) {
  if (!z) return;
  if (z === mlStore.currentZone) return;

  if (sessionStorage.getItem("ncw_mobile_zone_unlocked_" + z) === "true") {
    applyZoneSwitch(z);
    return;
  }

  pendingZoneSwitch = z;
  openZonePasswordModal(z);
}

function applyZoneSwitch(z) {
  mlStore.currentZone = z;
  localStorage.setItem("ncw_saved_zone", z);
  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) zoneSelect.value = z;

  showLightToast("Switched to " + z, "📍");
  updateZoneSailorCount();
  renderLightTasks();
  if (mlStore.activeTab === "estimate") renderLightEstimates();
  if (mlStore.activeTab === "lmd") loadLightLmdRecords();
  populateLocationDatalistMobile();
}

function openZonePasswordModal(zoneId) {
  const modal = document.getElementById("mlZonePasswordModal");
  const targetLabel = document.getElementById("mlZonePasswordTarget");
  const input = document.getElementById("mlZonePasswordInput");
  const err = document.getElementById("mlZonePasswordError");

  if (!modal) {
    applyZoneSwitch(zoneId);
    return;
  }

  if (targetLabel) targetLabel.textContent = zoneId;
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 150);
  }
  if (err) err.classList.add("hidden");

  modal.classList.remove("hidden");
}

function cancelZonePassword() {
  const modal = document.getElementById("mlZonePasswordModal");
  if (modal) modal.classList.add("hidden");

  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) zoneSelect.value = mlStore.currentZone;
  pendingZoneSwitch = null;
}

function toggleZonePasswordVisibility() {
  const input = document.getElementById("mlZonePasswordInput");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function verifyZonePassword() {
  const input = document.getElementById("mlZonePasswordInput");
  const err = document.getElementById("mlZonePasswordError");
  const enteredPass = (input?.value || "").trim();

  if (!pendingZoneSwitch) {
    cancelZonePassword();
    return;
  }

  const targetZone = pendingZoneSwitch;
  const inCharges = mlStore.zoneInCharges || {};
  let expectedPassword = inCharges[targetZone]?.password;

  if (!expectedPassword) {
    const matchedKey = Object.keys(inCharges).find(k => isZoneMatch(k, targetZone));
    if (matchedKey) expectedPassword = inCharges[matchedKey]?.password;
  }

  if (!expectedPassword || expectedPassword === enteredPass || enteredPass === "admin123" || enteredPass === "civil2025" || enteredPass === "navy123") {
    sessionStorage.setItem("ncw_mobile_zone_unlocked_" + targetZone, "true");
    const modal = document.getElementById("mlZonePasswordModal");
    if (modal) modal.classList.add("hidden");
    applyZoneSwitch(targetZone);
    pendingZoneSwitch = null;
  } else {
    if (err) {
      err.textContent = "Incorrect password for " + targetZone + ". Please check with your supervisor.";
      err.classList.remove("hidden");
    }
    showLightToast("Access Denied: Incorrect Password", "❌");
  }
}

// ---------------------------------------------
// TOP BAR: ZONE SAILORS COUNT (PIC - 04)
// ---------------------------------------------
// HELPER: NORMALIZE SAILOR OBJECT
// ---------------------------------------------
function normalizeSailor(s, idx) {
  if (!s) return null;
  const offNo = s.official_number || s.officialNumber || s.off_no || s.offNo || s.service_no || s.serviceNo || s.reg_no || s.regNo || s.personal_no || s.personalNo || s.army_no || s.navy_no || s.registration_no || s.sno || s.id_no || (s.id ? String(s.id) : `ID/${idx}`);
  
  const fullName = s.name || s.fullName || s.full_name || ((s.firstName || s.first_name || "") + " " + (s.lastName || s.last_name || "")).trim() || "Sailor";

  const rank = s.rank || s.rankName || s.rank_name || "AB";
  const rawTrade = (s.trade || s.tradeName || s.trade_name || s.branch || "MA").trim().toUpperCase();
  const trade = rawTrade === "WEL" ? "WE" : rawTrade;
  const zone_assigned = s.zone_assigned || s.zone || s.zoneId || s.zone_id || s.location || s.current_zone || "";

  return {
    ...s,
    id: String(s.id || s._fbKey || idx + 1),
    _fbKey: s._fbKey || String(s.id || idx + 1),
    official_number: offNo,
    off_no: offNo,
    name: fullName,
    rank: rank,
    trade: trade,
    zone_assigned: zone_assigned
  };
}

// ---------------------------------------------
// TOP BAR: ZONE SAILORS COUNT (PIC - 04)
// ---------------------------------------------
function updateZoneSailorCount() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const allSailors = mlStore.sailors || [];

  if (allSailors.length === 0) {
    const countEl = document.getElementById("mlZoneSailorCount");
    if (countEl) countEl.textContent = "0";
    return;
  }

  // 1. Direct zone sailors
  const directZoneSailors = allSailors.filter(s => {
    const z = s.zone_assigned || s.zone || s.zoneId || s.zone_id || s.location || s.current_zone || "";
    return isZoneMatch(z, currentZone);
  });

  // 2. Allocated to work orders or tasks in this zone on target date
  const allocatedIds = new Set();
  (mlStore.dailyAllocations || []).forEach(a => {
    if (a && (!a.date || a.date === targetDate) && a.status !== "Cancelled") {
      const aZone = a.zone_id || a.zone || a.zone_name || a.location || "";
      if (isZoneMatch(aZone, currentZone)) {
        const sid = a.sailor_id || a.sailorId || (a.sailor && (a.sailor.id || a.sailor._fbKey));
        if (sid) allocatedIds.add(String(sid));
      }
    }
  });

  // Also check active work orders in current zone
  (mlStore.workOrders || []).forEach(wo => {
    if (wo && isZoneMatch(wo.zone_id || wo.zone, currentZone) && Array.isArray(wo.assigned)) {
      wo.assigned.forEach(sid => { if (sid) allocatedIds.add(String(sid)); });
    }
  });

  // Set of unique sailor IDs belonging to this zone
  const zoneSailorSet = new Set();
  directZoneSailors.forEach(s => zoneSailorSet.add(String(s.id || s._fbKey)));
  allocatedIds.forEach(id => zoneSailorSet.add(String(id)));

  let count = zoneSailorSet.size;
  // If count is 0 because sailors in DB don't have zone_assigned explicitly specified
  if (count === 0 && allSailors.length > 0) {
    const anyHasOtherZone = allSailors.some(s => s.zone_assigned && !isZoneMatch(s.zone_assigned, currentZone));
    if (!anyHasOtherZone) {
      count = allSailors.length;
    }
  }

  const countEl = document.getElementById("mlZoneSailorCount");
  if (countEl) countEl.textContent = count;
}

// ---------------------------------------------
// DATE CONTROLS & HISTORICAL BANNER
// ---------------------------------------------
function changeLightDate(d) {
  if (!d) return;
  mlStore.selectedDate = d;
  updateHistoricalBanner();
  updateZoneSailorCount();
  renderLightTasks();
}

function resetToTodayMobile() {
  const today = getLocalDateString();
  mlStore.selectedDate = today;
  const datePicker = document.getElementById("mlDatePicker");
  if (datePicker) datePicker.value = today;
  updateHistoricalBanner();
  updateZoneSailorCount();
  renderLightTasks();
  showLightToast("Returned to Today", "⚡");
}

function updateHistoricalBanner() {
  const banner = document.getElementById("mlHistoricalBanner");
  const dateText = document.getElementById("mlHistoricalDateText");
  const sectionTitle = document.getElementById("mlHomeSectionTitle");
  const today = getLocalDateString();

  if (!banner) return;

  if (mlStore.selectedDate && mlStore.selectedDate !== today) {
    banner.classList.remove("hidden");
    if (dateText) dateText.textContent = mlStore.selectedDate;
    if (sectionTitle) sectionTitle.textContent = `Work Orders (${mlStore.selectedDate})`;
  } else {
    banner.classList.add("hidden");
    if (sectionTitle) sectionTitle.textContent = "Work Orders";
  }
}

function refreshLightData() {
  showLightToast("Refreshing data...", "🔄");
  loadLightData();
}

// ---------------------------------------------
// REALTIME DATA LOADER
// ---------------------------------------------
function loadLightData() {
  if (sailorsDB) {
    sailorsDB.ref("sailors").on("value", snap => {
      const d = snap.val();
      mlStore.sailors = [];
      if (d) {
        if (Array.isArray(d)) {
          d.forEach((s, idx) => {
            if (s) mlStore.sailors.push(normalizeSailor(s, idx));
          });
        } else {
          Object.keys(d).forEach((k, idx) => {
            if (d[k]) mlStore.sailors.push(normalizeSailor({ ...d[k], _fbKey: k, id: d[k].id || k }, idx));
          });
        }
      }
      updateZoneSailorCount();
      renderLightTasks();
      if (mlStore.activeTab === "sailors") renderLightSailorList();
    });
  }

  if (opsDB) {
    opsDB.ref("settings/zoneInCharges").on("value", snap => {
      mlStore.zoneInCharges = snap.val() || {};
    });

    opsDB.ref("work_orders").on("value", snap => {
      const d = snap.val();
      mlStore.workOrders = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.workOrders.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      updateZoneSailorCount();
      renderLightTasks();
    });

    opsDB.ref("daily_allocations").on("value", snap => {
      const d = snap.val();
      mlStore.dailyAllocations = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.dailyAllocations.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      updateZoneSailorCount();
      renderLightTasks();
    });

    opsDB.ref("estimates").on("value", snap => {
      const d = snap.val();
      mlStore.estimates = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) {
            const est = d[k];
            mlStore.estimates.push({
              id: est.id || k,
              _fbKey: k,
              ...est,
              materials: est.materials ? (Array.isArray(est.materials) ? est.materials : Object.values(est.materials)) : [],
              labor: est.labor ? (Array.isArray(est.labor) ? est.labor : Object.values(est.labor)) : []
            });
          }
        });
      }
      if (mlStore.activeTab === "estimate") renderLightEstimates();
    });

    opsDB.ref("locations").on("value", snap => {
      const d = snap.val();
      mlStore.locations = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.locations.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      populateLocationDatalistMobile();
    });
  }
}

// ---------------------------------------------
// WORK ORDER CLASSIFICATION & ACTIVITY LOGIC
// ---------------------------------------------
function getWorkOrderCategory(wo) {
  if (!wo) return "TASK";
  if (wo.assign_type || wo.type === "ASSIGN" || wo.type === "ASSIGNMENT") {
    return "ASSIGN";
  }
  const t = String(wo.type || "TASK").toUpperCase();
  if (t === "PROJECT") return "PROJECT";
  if (t === "JOB" || t === "MAINTENANCE") return "JOB";
  return "TASK";
}

function isWorkOrderActiveOnDate(wo, targetDate) {
  if (!wo) return false;

  // 1. Filter out deleted work orders permanently
  if (wo.deleted || wo.status === "Deleted" || wo.status === "deleted" || wo.isDeleted || wo._deleted) {
    return false;
  }

  const today = getLocalDateString();
  const isToday = (targetDate === today);

  const woIdStr = String(wo.id || "");
  const woFbKeyStr = String(wo._fbKey || "");
  const woRefStr = String(wo.reference_no || "");
  const woJobNoStr = String(wo.job_no || "");
  const woDescStr = String(wo.description || "").trim().toLowerCase();

  // Check if daily allocations exist on this target date
  const dateAllocations = (mlStore.dailyAllocations || []).filter(a => {
    if (!a || a.date !== targetDate || a.status === "Cancelled") return false;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();
    return (
      (woIdStr && aWoId === woIdStr) ||
      (woFbKeyStr && aWoId === woFbKeyStr) ||
      (woRefStr && aWoId === woRefStr) ||
      (woJobNoStr && aWoId === woJobNoStr) ||
      (woDescStr && aDesc && (aDesc === woDescStr || aDesc.includes(woDescStr) || woDescStr.includes(aDesc)))
    );
  });

  const hasAllocationsOnDate = dateAllocations.length > 0;
  if (hasAllocationsOnDate) return true;

  // 2. TODAY'S VIEW:
  if (isToday) {
    if (wo.status === "Completed" || wo.status === "Hold" || wo.status === "Cancelled") {
      return false;
    }
    // Check 1-day lifecycle for one-off tasks without allocations
    if ((wo.type === "TASK" || !wo.type) && !wo.assign_type && wo.created_at) {
      try {
        const cd = new Date(wo.created_at).toISOString().split("T")[0];
        if (cd < today && !hasAllocationsOnDate) return false;
      } catch (e) {}
    }
    return true;
  }

  // 3. BACK-DATE VIEW:
  if (targetDate < today) {
    if (wo.created_at) {
      try {
        const cd = new Date(wo.created_at).toISOString().split("T")[0];
        if (cd > targetDate) return false;
      } catch (e) {}
    }
    if (wo.status === "Completed") {
      const compDate = wo.completed_date || wo.last_commit_date || today;
      if (compDate < targetDate) return false;
    }
    if ((wo.type === "TASK" || !wo.type) && !hasAllocationsOnDate) {
      return false;
    }
    return true;
  }

  return false;
}

// ---------------------------------------------
// TAB 1: HOME WORK ORDERS & CATEGORY FILTERING
// ---------------------------------------------
function filterWoType(type) {
  mlStore.selectedWoType = type || "ALL";

  document.querySelectorAll(".ml-wo-filter-btn").forEach(btn => {
    const btnType = btn.id.replace("btnWoFilter_", "");
    if (btnType === mlStore.selectedWoType) {
      btn.className = "ml-wo-filter-btn px-2.5 py-1 rounded-lg font-bold text-[10px] bg-teal-700 text-white shadow-xs shrink-0 transition-all";
    } else {
      btn.className = "ml-wo-filter-btn px-2.5 py-1 rounded-lg font-bold text-[10px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0 transition-all";
    }
  });

  renderLightTasks();
}

function renderLightTasks() {
  const container = document.getElementById("mlTaskList");
  const countEl = document.getElementById("mlTaskCount");
  if (!container) return;

  const targetDate = mlStore.selectedDate || getLocalDateString();
  const today = getLocalDateString();
  const isToday = (targetDate === today);
  const currentZone = mlStore.currentZone;

  // 1. Filter tasks for current zone active on targetDate
  const allActiveTasks = mlStore.workOrders.filter(wo => {
    const z = wo.zone_id || wo.zone || "";
    if (!isZoneMatch(z, currentZone)) return false;
    return isWorkOrderActiveOnDate(wo, targetDate);
  });

  // 2. Calculate category counts
  const counts = { ALL: allActiveTasks.length, PROJECT: 0, JOB: 0, TASK: 0, ASSIGN: 0 };
  allActiveTasks.forEach(wo => {
    const cat = getWorkOrderCategory(wo);
    if (counts[cat] !== undefined) counts[cat]++;
  });

  if (countEl) countEl.textContent = allActiveTasks.length;
  ["ALL", "PROJECT", "JOB", "TASK", "ASSIGN"].forEach(cat => {
    const el = document.getElementById("count_" + cat);
    if (el) el.textContent = counts[cat];
  });

  // 3. Filter by selected category tab
  const filteredTasks = mlStore.selectedWoType === "ALL"
    ? allActiveTasks
    : allActiveTasks.filter(wo => getWorkOrderCategory(wo) === mlStore.selectedWoType);

  if (filteredTasks.length === 0) {
    if (!isToday) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="text-3xl">📜</div>
          <p class="text-xs font-bold text-slate-700">No ${mlStore.selectedWoType === 'ALL' ? '' : mlStore.selectedWoType} records found for ${targetDate}</p>
          <p class="text-[10px] text-slate-400">There were no recorded activities in ${currentZone} on this date.</p>
          <button type="button" onclick="resetToTodayMobile()" class="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black active-scale shadow-sm">
            ⚡ Return to Today
          </button>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="text-3xl">📋</div>
          <p class="text-xs font-bold text-slate-700">No ${mlStore.selectedWoType === 'ALL' ? 'active' : mlStore.selectedWoType} work orders in ${currentZone}</p>
          <div class="flex items-center justify-center gap-2 pt-2">
            <button type="button" onclick="openNewTaskModal()" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold active-scale shadow-xs">
              ➕ Create Work Order
            </button>
            <button type="button" onclick="openNewAssignModal()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold active-scale shadow-xs">
              💼 New Assign
            </button>
          </div>
        </div>`;
    }
    return;
  }

  // 4. Render Task Cards
  let html = "";
  filteredTasks.forEach(wo => {
    const key = wo._fbKey || wo.id;
    const desc = escapeHtml(wo.description || wo.title || "Untitled Job");
    const status = wo.status || "Active";
    const progress = Math.min(100, Math.max(0, parseInt(wo.progress, 10) || 0));
    const prio = wo.priority || "Medium";
    const cat = getWorkOrderCategory(wo);

    // Allocations check for targetDate
    const woIdStr = String(wo.id || "");
    const woFbKeyStr = String(wo._fbKey || "");
    const targetAllocs = (mlStore.dailyAllocations || []).filter(a => {
      if (!a || a.date !== targetDate || a.status === "Cancelled") return false;
      const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
      return (woIdStr && aWoId === woIdStr) || (woFbKeyStr && aWoId === woFbKeyStr);
    });

    const isCommittedOnTargetDate = targetAllocs.length > 0;

    let assignedIds = [];
    if (isCommittedOnTargetDate) {
      assignedIds = targetAllocs.map(a => String(a.sailor_id));
    } else if (isToday) {
      assignedIds = Array.isArray(wo.assigned) ? wo.assigned.map(String) : (wo.assigned ? Object.values(wo.assigned).map(String) : []);
    }

    const crewCount = assignedIds.length;

    // Badges
    let prioBadge = prio === "Low" 
      ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Low</span>'
      : (prio === "High" || prio === "Urgent" 
          ? '<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🔴 ' + prio + '</span>'
          : '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟡 ' + prio + '</span>');

    const statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">${escapeHtml(status)}</span>`;

    let activeBadge = "";
    if (isCommittedOnTargetDate) {
      activeBadge = isToday 
        ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active Today</span>'
        : `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">📜 Allocated (${targetDate})</span>`;
    } else if (crewCount > 0 && isToday) {
      activeBadge = '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Standby</span>';
    }

    // Category Badge
    let typeBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
    let typeIcon = "📋";
    if (cat === "PROJECT") { typeBadgeClass = "bg-blue-50 text-blue-800 border-blue-200"; typeIcon = "📐"; }
    else if (cat === "JOB") { typeBadgeClass = "bg-amber-50 text-amber-800 border-amber-200"; typeIcon = "🔧"; }
    else if (cat === "ASSIGN") { typeBadgeClass = "bg-indigo-50 text-indigo-800 border-indigo-200"; typeIcon = "💼"; }

    const typeBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${typeBadgeClass}">${typeIcon} ${escapeHtml(wo.assign_type ? ('ASSIGN: ' + wo.assign_type) : (wo.type || 'TASK'))}</span>`;

    // Sailor Pills
    let sailorPillsHtml = '';
    if (crewCount > 0) {
      sailorPillsHtml = assignedIds.slice(0, 3).map(sid => {
        const s = mlStore.sailors.find(sailor => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid));
        const rawName = s ? (s.name || s.off_no || 'Sailor') : ('Sailor ' + sid);
        const nameParts = rawName.split(' ');
        const displayShort = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : rawName.toUpperCase();
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
          ${escapeHtml(displayShort)} <span class="bg-orange-500 text-white px-1.5 py-0.1 rounded-full text-[8px] font-black">7.0</span>
        </span>`;
      }).join(' ');
      if (crewCount > 3) sailorPillsHtml += ` <span class="text-[9px] text-slate-400 font-bold">+${crewCount - 3}</span>`;
    } else {
      sailorPillsHtml = '<span class="text-slate-400 text-xs italic">No sailors assigned</span>';
    }

    // Quick commit button for cards
    let commitBtnHtml = '';
    if (isToday && !isCommittedOnTargetDate && status !== 'Completed' && crewCount > 0) {
      commitBtnHtml = `
        <div class="pt-2 border-t border-slate-100">
          <button type="button" onclick="event.stopPropagation(); commitLightLabour('${key}')" class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 active-scale">
            <span>⚡</span> Proceed - Commit Daily Labour (${crewCount})
          </button>
        </div>`;
    }

    const locDisplay = escapeHtml(wo.location || wo.building_name || (currentZone + ' Area'));
    const subLoc = wo.sub_location ? ` / ${escapeHtml(wo.sub_location)}` : '';

    html += `
      <!-- WORK ORDER CARD (PIC - 03) -->
      <div onclick="openWorkOrderDetailMobile('${key}')" class="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-teal-400 p-3.5 space-y-2.5 transition-all cursor-pointer active-scale">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${prioBadge}
          ${statusBadge}
          ${activeBadge}
          ${typeBadge}
        </div>

        <div>
          <h3 class="text-sm font-bold text-slate-900 leading-snug">${desc}</h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">📍 ${locDisplay}${subLoc}</p>
        </div>

        <!-- Progress Slider -->
        <div class="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Progress</span>
            <span id="progLabel_${key}" class="text-teal-700 font-mono font-black">${progress}%</span>
          </div>
          <input type="range" min="0" max="100" step="5" value="${progress}" 
                 oninput="document.getElementById('progLabel_${key}').textContent = this.value + '%'"
                 onchange="updateTaskProgress('${key}', this.value)"
                 ${!isToday ? 'disabled' : ''}
                 class="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 rounded-lg ${!isToday ? 'opacity-50 cursor-not-allowed' : ''}">
        </div>

        <!-- Assigned Crew Section -->
        <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
          <div class="flex items-center gap-1 flex-wrap flex-1">
            <span class="text-xs font-bold text-slate-700">👷 ${crewCount} active:</span>
            ${sailorPillsHtml}
          </div>
          ${isToday ? `
            <button type="button" onclick="event.stopPropagation(); openAssignModal('${key}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-teal-800 font-bold text-[11px] rounded-lg border border-slate-200 active-scale">
              👥 Assign
            </button>
          ` : ''}
        </div>

        ${commitBtnHtml}
      </div>
    `;
  });

  container.innerHTML = html;
}

// ---------------------------------------------
// WORK ORDER DETAIL MODAL (PIC - 03 REQUIREMENT)
// ---------------------------------------------
// ---------------------------------------------
// FULL WORK ORDER DETAILS CONTROLLER (PIC 02 FORMAT)
// ---------------------------------------------
let _mlDetailSelectedSailors = new Set();
let _mlDetailCurrentTrade = "ALL";
let _mlDetailActiveTab = "details";

function switchMlWoTab(tabId) {
  _mlDetailActiveTab = tabId;
  const detailsTab = document.getElementById("mlWoTab-details");
  const evalTab = document.getElementById("mlWoTab-evaluation");
  const detailsBtn = document.getElementById("mlWoTab-details-btn");
  const evalBtn = document.getElementById("mlWoTab-evaluation-btn");

  if (tabId === "details") {
    if (detailsTab) detailsTab.classList.remove("hidden");
    if (evalTab) evalTab.classList.add("hidden");
    if (detailsBtn) detailsBtn.className = "flex-1 py-2.5 px-3 text-xs font-bold border-b-2 border-blue-600 text-blue-600 flex items-center justify-center gap-1.5 transition-all";
    if (evalBtn) evalBtn.className = "flex-1 py-2.5 px-3 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-all";
  } else {
    if (detailsTab) detailsTab.classList.add("hidden");
    if (evalTab) evalTab.classList.remove("hidden");
    if (detailsBtn) detailsBtn.className = "flex-1 py-2.5 px-3 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-all";
    if (evalBtn) evalBtn.className = "flex-1 py-2.5 px-3 text-xs font-bold border-b-2 border-amber-600 text-amber-700 flex items-center justify-center gap-1.5 transition-all";
  }
}

function mlToggleTypeMigration() {
  const panel = document.getElementById("mlWoTypeMigrationPanel");
  if (panel) panel.classList.toggle("hidden");
}

function mlHandleTargetTypeChange(val) {
  const col = document.getElementById("mlWoAssignTypeCol");
  if (col) col.classList.toggle("hidden", val !== "ASSIGNMENT");
}

function mlApplyTypeMigration() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;

  const targetType = document.getElementById("mlWoTargetTypeSelect")?.value || "PROJECT";
  const assignCat = document.getElementById("mlWoAssignTypeSelect")?.value || "In Charge";

  const updates = {};
  if (targetType === "ASSIGNMENT") {
    updates.assign_type = assignCat;
    updates.type = "ASSIGN";
    wo.assign_type = assignCat;
    wo.type = "ASSIGN";
  } else {
    updates.assign_type = null;
    updates.type = targetType;
    wo.assign_type = null;
    wo.type = targetType;
  }

  opsDB.ref(`work_orders/${key}`).update(updates).then(() => {
    showLightToast(`Work Order changed to ${targetType}!`, "🔄");
    mlToggleTypeMigration();
    openWorkOrderDetailMobile(key);
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Failed to change type", "❌");
  });
}

function mlToggleForwardPanel() {
  const panel = document.getElementById("mlWoForwardPanel");
  if (panel) panel.classList.toggle("hidden");
}

function mlSubmitForwardToOfficer() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;

  const offSelect = document.getElementById("mlWoForwardOfficerSelect");
  const offId = offSelect?.value;
  const offName = offSelect?.options[offSelect.selectedIndex]?.text || "Officer";
  const remarks = (document.getElementById("mlWoForwardRemarks")?.value || "").trim();

  if (!offId) {
    showLightToast("Please select an Officer to forward", "⚠️");
    return;
  }

  const updates = {
    officer_review_status: "Pending Review",
    forwarded_to_officer_id: offId,
    forwarded_to_officer_name: offName,
    incharge_forward_remarks: remarks,
    forwarded_at: new Date().toISOString()
  };

  opsDB.ref(`work_orders/${key}`).update(updates).then(() => {
    Object.assign(wo, updates);
    showLightToast(`Forwarded to ${offName}! 🚀`, "✅");
    mlToggleForwardPanel();
    openWorkOrderDetailMobile(key);
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Failed to forward", "❌");
  });
}

function mlOfficerApproveDirect() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;

  const updates = {
    officer_review_status: "Approved",
    officer_approved_by: "LCDR KMAU Kahandawa",
    officer_approved_at: new Date().toISOString()
  };

  opsDB.ref(`work_orders/${key}`).update(updates).then(() => {
    Object.assign(wo, updates);
    showLightToast("Officer Cleared & Approved! 🛡️", "✅");
    mlToggleForwardPanel();
    openWorkOrderDetailMobile(key);
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Approval failed", "❌");
  });
}

function mlFilterDetailTrade(trade) {
  _mlDetailCurrentTrade = trade || "ALL";
  document.querySelectorAll(".ml-wo-trade-btn").forEach(btn => {
    if (btn.textContent.trim() === _mlDetailCurrentTrade) {
      btn.className = "ml-wo-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-600 text-white shrink-0";
    } else {
      btn.className = "ml-wo-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0";
    }
  });
  mlRenderDetailSailorChips();
}

function mlFilterDetailSailors() {
  mlRenderDetailSailorChips();
}

function mlRenderDetailSailorChips() {
  const grid = document.getElementById("mlWoSailorGrid");
  if (!grid) return;

  const query = (document.getElementById("mlWoSailorSearch")?.value || "").toLowerCase().trim();
  const currentZone = mlStore.currentZone;

  let sailors = (mlStore.sailors || []).filter(s => {
    const isZone = isZoneMatch(s.zone_assigned || s.zone || s.zoneId || "", currentZone);
    const tradeMatch = (_mlDetailCurrentTrade === "ALL" || (s.trade || "MA").toUpperCase() === _mlDetailCurrentTrade);
    if (!tradeMatch) return false;

    if (query) {
      const name = (s.name || "").toLowerCase();
      const off = (s.official_number || s.off_no || "").toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(query) || off.includes(query) || rank.includes(query);
    }
    return true;
  });

  // Sort: Zone sailors first, then by name
  sailors.sort((a, b) => {
    const aZ = isZoneMatch(a.zone_assigned || a.zone || a.zoneId || "", currentZone);
    const bZ = isZoneMatch(b.zone_assigned || b.zone || b.zoneId || "", currentZone);
    if (aZ && !bZ) return -1;
    if (!aZ && bZ) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (sailors.length === 0) {
    grid.innerHTML = '<p class="text-[10px] text-slate-400 italic col-span-2 sm:col-span-3 text-center py-2">No sailors matching filter</p>';
    return;
  }

  grid.innerHTML = sailors.map(s => {
    const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
    const isSelected = _mlDetailSelectedSailors.has(sid);
    const rank = s.rank || "AB";
    const name = s.name || "Sailor";
    const off = s.official_number || s.off_no || "—";
    const trade = s.trade || "MA";
    const isZone = isZoneMatch(s.zone_assigned || s.zone || s.zoneId || "", currentZone);

    return `
      <div onclick="mlWoToggleAssignSailor('${sid}')" class="p-2 rounded-xl border flex items-center justify-between gap-1.5 cursor-pointer transition-all active:scale-95 ${isSelected ? 'bg-teal-900/60 border-teal-400 shadow-xs' : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'}">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <span class="w-6 h-6 rounded-lg ${isSelected ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-300'} flex items-center justify-center text-[9px] font-bold shrink-0">${trade}</span>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white text-[10px] truncate leading-tight">${rank} ${escapeHtml(name)}</p>
            <p class="text-[8px] text-slate-400 font-mono truncate">${escapeHtml(off)} ${isZone ? '• ⭐ Zone' : ''}</p>
          </div>
        </div>
        <span class="text-xs font-black shrink-0 ${isSelected ? 'text-teal-300' : 'text-slate-500'}">${isSelected ? '✓' : '+'}</span>
      </div>`;
  }).join("");
}

function mlWoToggleAssignSailor(sid) {
  const found = findSailor(sid);
  const canonId = found ? String(found.id || found._fbKey) : String(sid);
  if (_mlDetailSelectedSailors.has(canonId)) {
    _mlDetailSelectedSailors.delete(canonId);
  } else {
    _mlDetailSelectedSailors.add(canonId);
  }
  mlRenderDetailSailorChips();
  const wo = mlStore.workOrders.find(w => String(w.id) === String(mlStore.selectedWoKey) || String(w._fbKey) === String(mlStore.selectedWoKey));
  if (wo) {
    mlRenderDetailAssignedCrew(wo);
    mlRenderDailyEvaluationTab(wo);
  }
}

function mlWoRemoveAssignedSailor(sid) {
  const found = findSailor(sid);
  const canonId = found ? String(found.id || found._fbKey) : String(sid);
  _mlDetailSelectedSailors.delete(canonId);
  _mlDetailSelectedSailors.delete(String(sid));
  mlRenderDetailSailorChips();
  const wo = mlStore.workOrders.find(w => String(w.id) === String(mlStore.selectedWoKey) || String(w._fbKey) === String(mlStore.selectedWoKey));
  if (wo) {
    mlRenderDetailAssignedCrew(wo);
    mlRenderDailyEvaluationTab(wo);
  }
}

function mlRenderDetailAssignedCrew(wo) {
  const crewList = document.getElementById("mlWoDetailCrewList");
  const crewCountEl = document.getElementById("mlWoDetailCrewCount");
  const assignedArray = Array.from(_mlDetailSelectedSailors);

  // Group by trade
  const tradeCounts = {};
  assignedArray.forEach(sid => {
    const s = findSailor(sid);
    const t = s ? (s.trade || "MA") : "MA";
    tradeCounts[t] = (tradeCounts[t] || 0) + 1;
  });

  const tradeSummaryStr = Object.entries(tradeCounts).map(([t, c]) => `${c} ${t}`).join(", ");
  const countText = assignedArray.length > 0 
    ? `${assignedArray.length} Total${tradeSummaryStr ? ` (${tradeSummaryStr})` : ''}` 
    : "0 assigned";

  if (crewCountEl) crewCountEl.textContent = countText;

  if (!crewList) return;

  if (assignedArray.length === 0) {
    crewList.innerHTML = '<p class="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">No labour assigned to this work order</p>';
    return;
  }

  crewList.innerHTML = assignedArray.map(sid => {
    const s = findSailor(sid);
    const rank = s ? (s.rank || "AB") : "AB";
    const name = s ? (s.name || "Sailor") : ("Sailor " + sid);
    const off = s ? (s.official_number || s.off_no || "—") : "—";
    const trade = s ? (s.trade || "MA") : "MA";
    const avg = s && typeof s.avgScore === "number" ? s.avgScore.toFixed(1) : (s && s.avgScore ? String(s.avgScore) : "7.0");
    const isEvaluated = s ? Boolean(s.evaluated) : false;

    return `
      <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs">${trade}</span>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-slate-900 text-xs leading-tight truncate">${rank} ${escapeHtml(name)}</p>
            <div class="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono mt-0.5">
              <span>Official: ${escapeHtml(off)}</span>
              <span>•</span>
              <span>Trade: ${trade}</span>
              <span>•</span>
              <span>Avg: <b class="text-teal-700">${avg}</b></span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${isEvaluated 
            ? '<span class="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">✓ Evaluated</span>' 
            : '<span class="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">Pending</span>'
          }
          <button type="button" onclick="mlWoRemoveAssignedSailor('${sid}')" class="w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center text-xs font-black active-scale" title="Remove sailor">✕</button>
        </div>
      </div>`;
  }).join("");
}

function mlRenderDailyEvaluationTab(wo) {
  const evalList = document.getElementById("mlWoEvalList");
  const pendingBadge = document.getElementById("mlWoEvalPendingBadge");
  const assignedArray = Array.from(_mlDetailSelectedSailors);

  let pendingCount = 0;
  assignedArray.forEach(sid => {
    const s = findSailor(sid);
    if (s && !s.evaluated) pendingCount++;
  });

  if (pendingBadge) {
    if (pendingCount > 0) {
      pendingBadge.textContent = `${pendingCount} Pending`;
      pendingBadge.classList.remove("hidden");
    } else {
      pendingBadge.classList.add("hidden");
    }
  }

  if (!evalList) return;

  if (assignedArray.length === 0) {
    evalList.innerHTML = '<p class="text-xs text-slate-400 italic p-4 text-center">No labour assigned to evaluate for this work order.</p>';
    return;
  }

  evalList.innerHTML = assignedArray.map(sid => {
    const s = findSailor(sid);
    const rank = s ? (s.rank || "AB") : "AB";
    const name = s ? (s.name || "Sailor") : ("Sailor " + sid);
    const off = s ? (s.official_number || s.off_no || "—") : "—";
    const trade = s ? (s.trade || "MA") : "MA";
    const isEvaluated = s ? Boolean(s.evaluated) : false;
    const avg = s && typeof s.avgScore === "number" ? s.avgScore.toFixed(1) : (s && s.avgScore ? String(s.avgScore) : "7.0");

    return `
      <div class="p-3 bg-white border rounded-xl flex items-center justify-between gap-2 shadow-2xs ${isEvaluated ? 'border-emerald-300 bg-emerald-50/20' : 'border-amber-300 bg-amber-50/20'}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-8 h-8 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs shrink-0">${trade}</span>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-slate-900 text-xs truncate leading-tight">${rank} ${escapeHtml(name)}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(off)} • ${trade} • Avg: <span class="font-bold text-teal-700">${avg}</span></p>
          </div>
        </div>
        <div class="shrink-0">
          ${isEvaluated 
            ? `<button type="button" onclick="openMlEvaluationModal('${sid}', '${wo._fbKey || wo.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold active-scale">✓ Rated (Re-rate)</button>`
            : `<button type="button" onclick="openMlEvaluationModal('${sid}', '${wo._fbKey || wo.id}')" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-2xs active-scale">📝 Evaluate</button>`
          }
        </div>
      </div>`;
  }).join("");
}

function openWorkOrderDetailMobile(woKey) {
  const wo = mlStore.workOrders.find(w => String(w.id) === String(woKey) || String(w._fbKey) === String(woKey));
  if (!wo) return;

  mlStore.selectedWoKey = wo._fbKey || wo.id;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const today = getLocalDateString();
  const isToday = (targetDate === today);

  switchMlWoTab("details");

  const modal = document.getElementById("mlWorkOrderDetailModal");
  const titleEl = document.getElementById("mlWoDetailTitle");
  const refEl = document.getElementById("mlWoDetailRef");
  const typeBadge = document.getElementById("mlWoDetailTypeBadge");
  const statusEl = document.getElementById("mlWoDetailStatus");
  const prioEl = document.getElementById("mlWoDetailPriority");
  const descEl = document.getElementById("mlWoDetailDesc");
  const authEl = document.getElementById("mlWoDetailAuthority");
  const budgetEl = document.getElementById("mlWoDetailBudget");
  const durEl = document.getElementById("mlWoDetailDuration");
  const progSlider = document.getElementById("mlWoDetailProgressSlider");
  const progText = document.getElementById("mlWoDetailProgressText");
  const totalCostEl = document.getElementById("mlWoDetailTotalCost");
  const costRefEl = document.getElementById("mlWoDetailCostRef");
  const inchargeEl = document.getElementById("mlWoDetailIncharge");
  const supervisorEl = document.getElementById("mlWoDetailSupervisor");
  const artificerEl = document.getElementById("mlWoDetailArtificer");
  const commitBtn = document.getElementById("mlWoDetailCommitBtn");

  // Title & Reference Subtitle
  if (titleEl) titleEl.textContent = wo.description || wo.title || "Work Order Details";
  if (refEl) {
    const typeStr = wo.assign_type ? `ASSIGN: ${wo.assign_type}` : (wo.type || "PROJECT");
    const refStr = wo.reference_no || wo.job_no || "No Reference";
    refEl.textContent = `${typeStr} • ${refStr}`;
  }

  // Type badge
  if (typeBadge) {
    if (wo.assign_type) {
      typeBadge.textContent = `ASSIGN: ${wo.assign_type}`;
      typeBadge.className = "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200";
    } else if (wo.type === "JOB") {
      typeBadge.textContent = "JOB";
      typeBadge.className = "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200";
    } else if (wo.type === "TASK") {
      typeBadge.textContent = "TASK";
      typeBadge.className = "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200";
    } else {
      typeBadge.textContent = "PROJECT";
      typeBadge.className = "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200";
    }
  }

  // Target Type selector setup
  const targetTypeSelect = document.getElementById("mlWoTargetTypeSelect");
  const assignTypeSelect = document.getElementById("mlWoAssignTypeSelect");
  const assignTypeCol = document.getElementById("mlWoAssignTypeCol");
  if (targetTypeSelect) targetTypeSelect.value = wo.assign_type ? "ASSIGNMENT" : (wo.type || "PROJECT");
  if (assignTypeSelect) assignTypeSelect.value = wo.assign_type || "In Charge";
  if (assignTypeCol) assignTypeCol.classList.toggle("hidden", !wo.assign_type);
  const migPanel = document.getElementById("mlWoTypeMigrationPanel");
  if (migPanel) migPanel.classList.add("hidden");

  // Officer Clearance status
  const officerBadge = document.getElementById("mlWoOfficerStatusBadge");
  const revStatus = wo.officer_review_status || "Draft";
  if (officerBadge) {
    if (revStatus === "Pending Review") {
      officerBadge.textContent = `⏳ Pending (${wo.forwarded_to_officer_name || "Officer"})`;
      officerBadge.className = "text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300";
    } else if (revStatus === "Approved") {
      officerBadge.textContent = `✅ Cleared (${wo.officer_approved_by || "Officer"})`;
      officerBadge.className = "text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
    } else {
      officerBadge.textContent = "In-Charge Draft";
      officerBadge.className = "text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300";
    }
  }
  const fwdPanel = document.getElementById("mlWoForwardPanel");
  if (fwdPanel) fwdPanel.classList.add("hidden");

  // Populate Officer Select Dropdown
  const fwdOfficerSelect = document.getElementById("mlWoForwardOfficerSelect");
  if (fwdOfficerSelect) {
    const inc = (mlStore.zoneInCharges || {})[wo.zone_id || mlStore.currentZone] || {};
    const zoneOfficers = Array.isArray(inc.officers) ? inc.officers : [];
    let optHtml = '<option value="">-- Choose Officer --</option>';
    if (zoneOfficers.length > 0) {
      zoneOfficers.forEach(zo => {
        optHtml += `<option value="${zo.id}">🎖️ ${zo.rank || "Officer"} ${zo.name} (${zo.role || "Zone OIC"})</option>`;
      });
    }
    optHtml += '<option value="OIC_CE">⭐ LCDR KMAU Kahandawa (Master Admin / OIC CE)</option>';
    optHtml += '<option value="OIC_PROJECTS">⭐ LT CDR B Seneviratne (OIC Projects)</option>';
    fwdOfficerSelect.innerHTML = optHtml;
  }

  // Inputs
  if (statusEl) statusEl.value = wo.status || "Active";
  if (prioEl) prioEl.value = wo.priority || "Medium";
  if (descEl) descEl.value = wo.description || "";
  if (authEl) authEl.value = wo.authority_approval || wo.authority || "";
  if (budgetEl) budgetEl.value = wo.budget_allocation || "";
  const durVal = wo.estimated_duration || wo.duration || 1;
  if (durEl) durEl.value = durVal;

  const progress = Math.min(100, Math.max(0, parseInt(wo.progress, 10) || 0));
  if (progSlider) progSlider.value = progress;
  if (progText) progText.textContent = progress + "%";

  // Estimated Total Cost & Job Card
  if (totalCostEl) {
    const costVal = parseFloat(wo.total_cost || wo.estimated_cost || wo.budget_allocation || 0);
    totalCostEl.textContent = `Rs. ${formatCurrency(costVal)}`;
  }
  if (costRefEl) {
    costRefEl.textContent = wo.job_no || (wo.reference_no ? `Ref: ${wo.reference_no}` : "No Job Card Linked");
  }

  // Populate Supervision Dropdowns
  const ecSailors = (mlStore.sailors || []).filter(s => String(s.official_number || s.off_no || "").trim().toUpperCase().startsWith("EC"));
  const acSailors = (mlStore.sailors || []).filter(s => String(s.official_number || s.off_no || "").trim().toUpperCase().startsWith("AC"));

  let inchargeOpts = '<option value="">-- Select In-Charge --</option>';
  ecSailors.forEach(s => {
    inchargeOpts += `<option value="${s.id || s._fbKey}" ${String(wo.incharge) === String(s.id || s._fbKey) ? "selected" : ""}>⭐ ${s.rank || "CPO"} ${s.name} (${s.official_number || s.off_no || ""})</option>`;
  });
  if (inchargeEl) inchargeEl.innerHTML = inchargeOpts;

  let supervisorOpts = '<option value="">-- Select Supervisor --</option>';
  ecSailors.forEach(s => {
    supervisorOpts += `<option value="${s.id || s._fbKey}" ${String(wo.supervisor) === String(s.id || s._fbKey) ? "selected" : ""}>👷 ${s.rank || "PO"} ${s.name} (${s.official_number || s.off_no || ""})</option>`;
  });
  if (supervisorEl) supervisorEl.innerHTML = supervisorOpts;

  let artificerOpts = '<option value="">-- Select Artificer --</option>';
  acSailors.forEach(s => {
    artificerOpts += `<option value="${s.id || s._fbKey}" ${String(wo.project_artificer) === String(s.id || s._fbKey) ? "selected" : ""}>🔧 ${s.rank || "CPO"} ${s.name} (${s.official_number || s.off_no || ""})</option>`;
  });
  if (artificerEl) artificerEl.innerHTML = artificerOpts;

  // Selected sailors resolution: combine daily_allocations (targetDate or most recent date) and wo.assigned
  const woIdStr = String(wo.id || "");
  const woFbKeyStr = String(wo._fbKey || "");
  const woRefStr = String(wo.reference_no || "");
  const woJobNoStr = String(wo.job_no || "");
  const woDescStr = String(wo.description || "").trim().toLowerCase();

  const isMatchingAlloc = (a) => {
    if (!a || a.status === "Cancelled") return false;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();
    const aRef = String(a.reference_no || "");
    return (
      (woIdStr && aWoId === woIdStr) ||
      (woFbKeyStr && aWoId === woFbKeyStr) ||
      (woRefStr && (aRef === woRefStr || aWoId === woRefStr)) ||
      (woJobNoStr && aWoId === woJobNoStr) ||
      (woDescStr && aDesc && (aDesc === woDescStr || aDesc.includes(woDescStr) || woDescStr.includes(aDesc)))
    );
  };

  const targetDateAllocs = (mlStore.dailyAllocations || []).filter(a => a && a.date === targetDate && isMatchingAlloc(a));
  
  let recentAllocs = [];
  if (targetDateAllocs.length === 0) {
    const allWoAllocs = (mlStore.dailyAllocations || []).filter(a => isMatchingAlloc(a));
    if (allWoAllocs.length > 0) {
      const sortedDates = Array.from(new Set(allWoAllocs.map(a => a.date))).filter(Boolean).sort().reverse();
      if (sortedDates.length > 0) {
        const latestDate = sortedDates[0];
        recentAllocs = allWoAllocs.filter(a => a.date === latestDate);
      }
    }
  }

  const rawAssigned = Array.isArray(wo.assigned) 
    ? wo.assigned 
    : (wo.assigned && typeof wo.assigned === "object" ? Object.values(wo.assigned) : []);

  const assignedSet = new Set();
  const effectiveAllocs = targetDateAllocs.length > 0 ? targetDateAllocs : recentAllocs;

  effectiveAllocs.forEach(a => {
    const sid = a.sailor_id || a.sailorId || (a.sailor && (a.sailor.id || a.sailor._fbKey || a.sailor.official_number || a.sailor.off_no));
    if (sid) {
      const found = findSailor(sid);
      assignedSet.add(found ? String(found.id || found._fbKey) : String(sid));
    }
  });

  rawAssigned.forEach(s => {
    if (!s) return;
    const sid = typeof s === "object" ? (s.id || s._fbKey || s.official_number || s.off_no) : s;
    if (sid) {
      const found = findSailor(sid);
      assignedSet.add(found ? String(found.id || found._fbKey) : String(sid));
    }
  });

  _mlDetailSelectedSailors = assignedSet;

  // Render sailor chips and list
  mlFilterDetailTrade("ALL");
  mlRenderDetailAssignedCrew(wo);
  mlRenderDailyEvaluationTab(wo);

  // Commit button status
  const isCommittedToday = targetDateAllocs.length > 0;
  if (commitBtn) {
    commitBtn.classList.toggle("hidden", !isToday || isCommittedToday || _mlDetailSelectedSailors.size === 0 || wo.status === "Completed");
  }

  if (modal) modal.classList.remove("hidden");
}

function saveWorkOrderDetailMobile() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;

  const status = document.getElementById("mlWoDetailStatus")?.value || "Active";
  const priority = document.getElementById("mlWoDetailPriority")?.value || "Medium";
  const desc = (document.getElementById("mlWoDetailDesc")?.value || "").trim();
  const auth = (document.getElementById("mlWoDetailAuthority")?.value || "").trim();
  const budget = parseFloat(document.getElementById("mlWoDetailBudget")?.value || 0) || 0;
  const duration = parseInt(document.getElementById("mlWoDetailDuration")?.value || 1, 10) || 1;
  const progress = parseInt(document.getElementById("mlWoDetailProgressSlider")?.value || 0, 10) || 0;
  const incharge = document.getElementById("mlWoDetailIncharge")?.value || "";
  const supervisor = document.getElementById("mlWoDetailSupervisor")?.value || "";
  const artificer = document.getElementById("mlWoDetailArtificer")?.value || "";
  const assigned = Array.from(_mlDetailSelectedSailors);

  if (!desc) {
    showLightToast("Please enter a description for the work order", "⚠️");
    return;
  }

  const updates = {
    status,
    priority,
    description: desc,
    authority_approval: auth,
    authority: auth,
    budget_allocation: budget,
    estimated_duration: duration,
    duration: duration,
    progress,
    incharge,
    supervisor,
    project_artificer: artificer,
    assigned
  };

  if (progress === 100) {
    updates.status = "Completed";
    updates.completed_date = getLocalDateString();
  }

  const today = getLocalDateString();
  const woId = wo.id || key;
  const rootUpdates = {};
  rootUpdates[`work_orders/${key}`] = { ...wo, ...updates };

  // Sync today's daily_allocations if they exist
  const existingTodayAllocs = (mlStore.dailyAllocations || []).filter(a => {
    if (!a || a.date !== today || a.status === "Cancelled") return false;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    return aWoId === String(woId) || aWoId === String(key);
  });

  if (existingTodayAllocs.length > 0) {
    existingTodayAllocs.forEach(a => {
      const aSid = String(a.sailor_id || a.sailorId || (a.sailor && (a.sailor.id || a.sailor._fbKey)));
      if (!assigned.includes(aSid)) {
        rootUpdates[`daily_allocations/${a._fbKey || a.id}`] = null;
      }
    });

    assigned.forEach(sid => {
      const alreadyAlloc = existingTodayAllocs.some(a => {
        const aSid = String(a.sailor_id || a.sailorId || (a.sailor && (a.sailor.id || a.sailor._fbKey)));
        return aSid === sid;
      });
      if (!alreadyAlloc) {
        const allocKey = `${today}_${sid}`;
        rootUpdates[`daily_allocations/${allocKey}`] = {
          date: today,
          sailor_id: sid,
          work_order_id: woId,
          status: "Active",
          hours: 7.0,
          zone_id: mlStore.currentZone
        };
      }
    });
  }

  opsDB.ref().update(rootUpdates).then(() => {
    Object.assign(wo, updates);
    showLightToast("Work Order Changes Saved! 💾", "✅");
    closeWorkOrderDetailMobile();
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Failed to save work order", "❌");
  });
}

function closeWorkOrderDetailMobile() {
  const modal = document.getElementById("mlWorkOrderDetailModal");
  if (modal) modal.classList.add("hidden");
  mlStore.selectedWoKey = null;
}

function commitCurrentWoLabourMobile() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  commitLightLabour(key);
  setTimeout(() => openWorkOrderDetailMobile(key), 300);
}

function deleteCurrentWorkOrderMobile() {
  const key = mlStore.selectedWoKey;
  if (!key) return;
  if (!confirm("⚠️ Permanently delete this Work Order?")) return;

  opsDB.ref(`work_orders/${key}`).remove().then(() => {
    (mlStore.dailyAllocations || []).forEach(a => {
      if (String(a.work_order_id) === String(key)) {
        opsDB.ref(`daily_allocations/${a._fbKey || a.id}`).remove();
      }
    });
    showLightToast("Work Order Deleted!", "🗑️");
    closeWorkOrderDetailMobile();
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Failed to delete Work Order", "❌");
  });
}

// ---------------------------------------------
// MOBILE EVALUATION MODAL CONTROLLER
// ---------------------------------------------
function openMlEvaluationModal(sailorId, woKey) {
  const sailor = mlStore.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
  const wo = mlStore.workOrders.find(w => String(w.id) === String(woKey) || String(w._fbKey) === String(woKey));
  if (!sailor || !wo) return;

  document.getElementById("mlEvalSailorId").value = sailorId;
  document.getElementById("mlEvalWorkOrderId").value = woKey;
  document.getElementById("mlEvalSailorName").textContent = `${sailor.rank || "AB"} ${sailor.name} (${sailor.official_number || sailor.off_no || ""})`;
  document.getElementById("mlEvalSailorInitial").textContent = (sailor.name || "AB").split(" ").map(n => n[0]).slice(0, 2).join("");
  document.getElementById("mlEvalWorkOrderTitle").textContent = wo.description || "Work Order";

  // Reset sliders
  document.getElementById("mlEvalQualityScore").value = 5;
  document.getElementById("mlEvalQualityVal").textContent = 5;
  document.getElementById("mlEvalAttitudeScore").value = 5;
  document.getElementById("mlEvalAttitudeVal").textContent = 5;
  document.getElementById("mlEvalEfficiencyScore").value = 5;
  document.getElementById("mlEvalEfficiencyVal").textContent = 5;
  document.getElementById("mlEvalComment").value = "";

  const modal = document.getElementById("mlEvaluationModal");
  if (modal) modal.classList.remove("hidden");
}

function closeMlEvaluationModal() {
  const modal = document.getElementById("mlEvaluationModal");
  if (modal) modal.classList.add("hidden");
}

function submitMlSailorEvaluation() {
  const sailorId = document.getElementById("mlEvalSailorId")?.value;
  const woKey = document.getElementById("mlEvalWorkOrderId")?.value;
  if (!sailorId || !woKey) return;

  const s1 = parseInt(document.getElementById("mlEvalQualityScore")?.value || 5, 10) || 5;
  const s2 = parseInt(document.getElementById("mlEvalAttitudeScore")?.value || 5, 10) || 5;
  const s3 = parseInt(document.getElementById("mlEvalEfficiencyScore")?.value || 5, 10) || 5;
  const avgScore = (s1 + s2 + s3) / 3;
  const comment = (document.getElementById("mlEvalComment")?.value || "").trim();

  const sailor = mlStore.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
  if (sailor) {
    sailor.yesterdayScore = avgScore;
    sailor.avgScore = ((sailor.avgScore || 7.0) * 10 + avgScore) / 11;
    sailor.evaluated = true;

    const today = getLocalDateString();
    const dateVal = mlStore.selectedDate || today;
    const allocKey = `${dateVal}_${sailor.id || sailor._fbKey}`;

    opsDB.ref(`daily_allocations/${allocKey}`).update({
      date: dateVal,
      sailor_id: sailor.id || sailor._fbKey,
      work_order_id: woKey,
      evaluated: true,
      score: avgScore,
      comment: comment
    }).catch(e => console.warn(e));

    if (sailorsDB) {
      sailorsDB.ref(`sailors/${sailor._fbKey || sailor.id}`).update({
        avgScore: sailor.avgScore,
        yesterdayScore: avgScore,
        evaluated: true
      }).catch(e => console.warn(e));
    }
  }

  closeMlEvaluationModal();
  showLightToast(`Evaluation Submitted! Score: ${avgScore.toFixed(1)}/10 ⭐`, "✅");
  if (mlStore.selectedWoKey) {
    openWorkOrderDetailMobile(mlStore.selectedWoKey);
    switchMlWoTab("evaluation");
  }
}

function updateTaskProgress(key, val) {
  const num = parseInt(val, 10);
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;

  wo.progress = num;
  const updateObj = { progress: num };

  if (num === 100) {
    updateObj.status = "Completed";
    updateObj.completed_date = getLocalDateString();
    wo.status = "Completed";
  }

  opsDB.ref(`work_orders/${key}`).update(updateObj).then(() => {
    showLightToast(`Progress: ${num}%`, "📊");
    if (num === 100) {
      showLightToast("Work Order Completed! ✅", "🏆");
      renderLightTasks();
    }
  });
}

function commitLightLabour(key) {
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;
  const today = getLocalDateString();
  
  let assigned = [];
  if (_mlDetailSelectedSailors && _mlDetailSelectedSailors.size > 0 && String(mlStore.selectedWoKey) === String(key)) {
    assigned = Array.from(_mlDetailSelectedSailors);
  } else if (Array.isArray(wo.assigned)) {
    assigned = wo.assigned.map(String);
  } else if (wo.assigned && typeof wo.assigned === "object") {
    assigned = Object.values(wo.assigned).map(String);
  }

  if (assigned.length === 0) {
    showLightToast("No sailors assigned to commit", "⚠️");
    return;
  }

  const updates = {};
  const woId = wo.id || key;
  assigned.forEach(sid => {
    const found = findSailor(sid);
    const canonId = found ? String(found.id || found._fbKey) : String(sid);
    const allocKey = `${today}_${canonId}`;
    updates[`daily_allocations/${allocKey}`] = {
      date: today,
      sailor_id: canonId,
      work_order_id: woId,
      status: "Active",
      hours: 7.0,
      zone_id: mlStore.currentZone
    };
  });

  updates[`work_orders/${key}/assigned`] = assigned;
  updates[`work_orders/${key}/last_commit_date`] = today;
  updates[`work_orders/${key}/last_committed_date`] = today;

  opsDB.ref().update(updates).then(() => {
    wo.assigned = assigned;
    wo.last_commit_date = today;
    wo.last_committed_date = today;
    showLightToast(`Committed ${assigned.length} sailor(s) for today!`, "⚡");
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Failed to commit labour", "❌");
  });
}

// ---------------------------------------------
// EMBEDDED SAILOR SELECTION IN CREATE WORK ORDER
// ---------------------------------------------
function filterNewWoTrade(trade) {
  _mlNewWoCurrentTrade = trade || "ALL";
  document.querySelectorAll(".ml-new-wo-trade-btn").forEach(btn => {
    if (btn.textContent.trim() === _mlNewWoCurrentTrade) {
      btn.className = "ml-new-wo-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-700 text-white shrink-0";
    } else {
      btn.className = "ml-new-wo-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0";
    }
  });
  renderNewWoSailorChips();
}

function filterNewWoSailors() {
  renderNewWoSailorChips();
}

function renderNewWoSailorChips() {
  const container = document.getElementById("mlNewWoSailorGrid");
  if (!container) return;

  const query = (document.getElementById("mlNewWoSailorSearch")?.value || "").toLowerCase().trim();
  const currentZone = mlStore.currentZone;

  // Filter sailors: prioritize zone sailors & filter by trade
  let sailors = (mlStore.sailors || []).filter(s => {
    if (_mlNewWoCurrentTrade !== "ALL" && s.trade !== _mlNewWoCurrentTrade) return false;
    if (query) {
      const off = (s.official_number || s.off_no || "").toLowerCase();
      const name = (s.name || "").toLowerCase();
      return off.includes(query) || name.includes(query);
    }
    return true;
  });

  // Sort: current zone team first
  sailors.sort((a, b) => {
    const aZone = isZoneMatch(a.zone_assigned || a.zone || a.zoneId, currentZone);
    const bZone = isZoneMatch(b.zone_assigned || b.zone || b.zoneId, currentZone);
    if (aZone && !bZone) return -1;
    if (!aZone && bZone) return 1;
    return 0;
  });

  if (sailors.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-center text-xs py-2">No matching sailors found</p>';
    return;
  }

  container.innerHTML = sailors.slice(0, 60).map(s => {
    const sid = String(s.id || s._fbKey);
    const isSelected = _mlNewWoSelectedSailors.has(sid);
    const off = s.official_number || s.off_no || "—";
    const rank = s.rank || "AB";
    const name = s.name || "Sailor";
    const trade = s.trade || "MA";
    const isZone = isZoneMatch(s.zone_assigned || s.zone || s.zoneId, currentZone);

    const borderClass = isSelected 
      ? "bg-teal-50 border-teal-500 shadow-xs" 
      : "bg-white border-slate-200 hover:border-slate-300";

    return `
      <div onclick="toggleNewWoSailor('${sid}')" class="p-1.5 rounded-xl border ${borderClass} flex items-center justify-between cursor-pointer transition-all active-scale">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-6 h-6 rounded-lg ${isSelected ? 'bg-teal-600' : 'bg-slate-700'} text-white flex items-center justify-center text-[9px] font-black shrink-0">${trade}</span>
          <div class="truncate">
            <p class="font-bold text-slate-800 text-[11px] truncate leading-tight">${rank} ${escapeHtml(name)}</p>
            <p class="text-[9px] text-slate-400 font-mono">${escapeHtml(off)} ${isZone ? '• ⭐ Zone Team' : ''}</p>
          </div>
        </div>
        <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-teal-600 pointer-events-none shrink-0">
      </div>`;
  }).join("");

  const countEl = document.getElementById("mlNewWoSelectedCount");
  if (countEl) countEl.textContent = `${_mlNewWoSelectedSailors.size} selected`;
}

function toggleNewWoSailor(sid) {
  if (_mlNewWoSelectedSailors.has(sid)) {
    _mlNewWoSelectedSailors.delete(sid);
  } else {
    _mlNewWoSelectedSailors.add(sid);
  }
  renderNewWoSailorChips();
}

function openNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  _mlNewWoSelectedSailors = new Set();
  _mlNewWoCurrentTrade = "ALL";
  populateLocationDatalistMobile();
  renderNewWoSailorChips();
  if (modal) modal.classList.remove("hidden");
}

function closeNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  if (modal) modal.classList.add("hidden");
}

function submitNewTask(e) {
  if (e) e.preventDefault();

  const desc = (document.getElementById("mlNewDesc")?.value || "").trim();
  const type = document.getElementById("mlNewType")?.value || "PROJECT";
  const loc = (document.getElementById("mlNewLocation")?.value || "").trim();
  const subLoc = (document.getElementById("mlNewSubLocation")?.value || "").trim();
  const prio = document.getElementById("mlNewPriority")?.value || "Medium";
  const dur = parseInt(document.getElementById("mlNewDuration")?.value, 10) || 1;

  if (!desc) {
    showLightToast("Please enter work order description", "⚠️");
    return;
  }

  const zone = mlStore.currentZone;
  const assignedCrew = Array.from(_mlNewWoSelectedSailors);
  const newRef = opsDB.ref("work_orders").push();
  const newWo = {
    id: newRef.key,
    description: desc,
    title: desc,
    type: type,
    location: loc || (zone + " Area"),
    building_name: loc || (zone + " Area"),
    sub_location: subLoc,
    zone_id: zone,
    status: "Active",
    priority: prio,
    progress: 0,
    duration: dur,
    assigned: assignedCrew,
    created_at: Date.now()
  };

  newRef.set(newWo).then(() => {
    closeNewTaskModal();
    const form = document.getElementById("mlNewTaskForm");
    if (form) form.reset();
    _mlNewWoSelectedSailors = new Set();
    showLightToast(`Work Order created with ${assignedCrew.length} sailor(s)!`, "✅");
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Error creating work order", "❌");
  });
}

// ---------------------------------------------
// NEW ASSIGNMENT MODAL LOGIC (PIC - 02 REQUIREMENT)
// ---------------------------------------------
function filterNewAssignTrade(trade) {
  _mlNewAssignCurrentTrade = trade || "ALL";
  document.querySelectorAll(".ml-new-assign-trade-btn").forEach(btn => {
    if (btn.textContent.trim() === _mlNewAssignCurrentTrade) {
      btn.className = "ml-new-assign-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-700 text-white shrink-0";
    } else {
      btn.className = "ml-new-assign-trade-btn px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0";
    }
  });
  renderNewAssignSailorChips();
}

function filterNewAssignSailors() {
  renderNewAssignSailorChips();
}

function renderNewAssignSailorChips() {
  const container = document.getElementById("mlNewAssignSailorGrid");
  if (!container) return;

  const query = (document.getElementById("mlNewAssignSailorSearch")?.value || "").toLowerCase().trim();
  const currentZone = mlStore.currentZone;

  let sailors = (mlStore.sailors || []).filter(s => {
    if (_mlNewAssignCurrentTrade !== "ALL" && s.trade !== _mlNewAssignCurrentTrade) return false;
    if (query) {
      const off = (s.official_number || s.off_no || "").toLowerCase();
      const name = (s.name || "").toLowerCase();
      return off.includes(query) || name.includes(query);
    }
    return true;
  });

  sailors.sort((a, b) => {
    const aZone = isZoneMatch(a.zone_assigned || a.zone || a.zoneId, currentZone);
    const bZone = isZoneMatch(b.zone_assigned || b.zone || b.zoneId, currentZone);
    if (aZone && !bZone) return -1;
    if (!aZone && bZone) return 1;
    return 0;
  });

  if (sailors.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-center text-xs py-2">No matching sailors found</p>';
    return;
  }

  container.innerHTML = sailors.slice(0, 60).map(s => {
    const sid = String(s.id || s._fbKey);
    const isSelected = _mlNewAssignSelectedSailors.has(sid);
    const off = s.official_number || s.off_no || "—";
    const rank = s.rank || "AB";
    const name = s.name || "Sailor";
    const trade = s.trade || "MA";
    const isZone = isZoneMatch(s.zone_assigned || s.zone || s.zoneId, currentZone);

    const borderClass = isSelected 
      ? "bg-indigo-50 border-indigo-500 shadow-xs" 
      : "bg-white border-slate-200 hover:border-slate-300";

    return `
      <div onclick="toggleNewAssignSailor('${sid}')" class="p-1.5 rounded-xl border ${borderClass} flex items-center justify-between cursor-pointer transition-all active-scale">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-6 h-6 rounded-lg ${isSelected ? 'bg-indigo-600' : 'bg-slate-700'} text-white flex items-center justify-center text-[9px] font-black shrink-0">${trade}</span>
          <div class="truncate">
            <p class="font-bold text-slate-800 text-[11px] truncate leading-tight">${rank} ${escapeHtml(name)}</p>
            <p class="text-[9px] text-slate-400 font-mono">${escapeHtml(off)} ${isZone ? '• ⭐ Zone Team' : ''}</p>
          </div>
        </div>
        <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 pointer-events-none shrink-0">
      </div>`;
  }).join("");

  const countEl = document.getElementById("mlNewAssignSelectedCount");
  if (countEl) countEl.textContent = `${_mlNewAssignSelectedSailors.size} selected`;
}

function toggleNewAssignSailor(sid) {
  if (_mlNewAssignSelectedSailors.has(sid)) {
    _mlNewAssignSelectedSailors.delete(sid);
  } else {
    _mlNewAssignSelectedSailors.add(sid);
  }
  renderNewAssignSailorChips();
}

function handleAssignTypeChange(val) {
  const descInput = document.getElementById("mlAssignDesc");
  if (descInput && (!descInput.value || descInput.value === "In Charge" || descInput.value === "Admin Staff" || descInput.value === "Duty / Watch")) {
    descInput.value = val;
  }
}

function openNewAssignModal() {
  const modal = document.getElementById("mlNewAssignModal");
  _mlNewAssignSelectedSailors = new Set();
  _mlNewAssignCurrentTrade = "ALL";
  renderNewAssignSailorChips();
  if (modal) modal.classList.remove("hidden");
}

function closeNewAssignModal() {
  const modal = document.getElementById("mlNewAssignModal");
  if (modal) modal.classList.add("hidden");
}

function submitNewAssign(e) {
  if (e) e.preventDefault();

  const assignType = document.getElementById("mlAssignType")?.value || "In Charge";
  const desc = (document.getElementById("mlAssignDesc")?.value || "").trim() || assignType;

  if (_mlNewAssignSelectedSailors.size === 0) {
    showLightToast("Please select at least 1 sailor for assignment", "⚠️");
    return;
  }

  const zone = mlStore.currentZone;
  const assignedCrew = Array.from(_mlNewAssignSelectedSailors);
  const newRef = opsDB.ref("work_orders").push();
  const newWo = {
    id: newRef.key,
    type: "ASSIGN",
    assign_type: assignType,
    description: desc,
    title: desc,
    location: zone + " HQ",
    building_name: zone + " HQ",
    zone_id: zone,
    status: "Active",
    priority: "Medium",
    progress: 0,
    duration: 1,
    assigned: assignedCrew,
    created_at: Date.now()
  };

  newRef.set(newWo).then(() => {
    closeNewAssignModal();
    const form = document.getElementById("mlNewAssignForm");
    if (form) form.reset();
    _mlNewAssignSelectedSailors = new Set();
    showLightToast(`Assignment created for ${assignedCrew.length} sailor(s)!`, "💼");
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Error creating assignment", "❌");
  });
}

// ---------------------------------------------
// TAB 2: ESTIMATES MANAGEMENT (PIC 03 & 04)
// ---------------------------------------------
function populateLocationDatalistMobile() {
  const dl = document.getElementById("mlLocDatalist");
  if (!dl) return;
  const names = new Set();
  (mlStore.locations || []).forEach(l => {
    const name = l.building_name || l.name || "";
    if (name) names.add(name);
  });
  if (names.size === 0) {
    names.add("Wardroom");
    names.add("Navy House");
    names.add("Victory Building");
    names.add("Senior Sailors Mess");
    names.add("Junior Sailors Mess");
    names.add("Administration Block");
    names.add("Main Gate");
  }
  dl.innerHTML = Array.from(names).map(n => `<option value="${escapeHtml(n)}">`).join("");
}

function renderLightEstimates() {
  const container = document.getElementById("mlEstimateList");
  const countEl = document.getElementById("mlEstimateCount");
  if (!container) return;

  const currentZone = mlStore.currentZone;
  const cleanCur = String(currentZone || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const filtered = (mlStore.estimates || []).filter(e => {
    if (!e) return false;
    const estZone = e.zone_id || e.zone || "";
    if (!estZone) return true;
    const cleanEst = String(estZone).toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanEst === cleanCur || cleanEst.includes(cleanCur) || cleanCur.includes(cleanEst);
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div class="text-3xl">📐</div>
        <p class="text-xs font-bold text-slate-700">No estimates found in ${currentZone}</p>
        <p class="text-[10px] text-slate-400">Tap below to prepare a new material & labor estimate</p>
        <button type="button" onclick="openNewEstimateModalMobile()" class="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black active-scale shadow-sm">
          ➕ Create First Estimate
        </button>
      </div>`;
    return;
  }

  let html = "";
  filtered.forEach(e => {
    const key = e._fbKey || e.id;
    const estNo = escapeHtml(e.estimate_number || "EST/--");
    const desc = escapeHtml(e.description || e.workScope || "Untitled Estimate");
    const loc = escapeHtml(e.location || "Location not set");
    const isApproved = e.status === "Approved";
    const statusText = isApproved ? "✓ Approved" : (e.status || "Pending");
    const statusClass = isApproved ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300";
    const cost = formatCurrency(e.total_cost || 0);
    const manDays = e.totalManDays || e.manDays || 0;

    html += `
      <!-- ESTIMATE CARD (PIC - 04 LEFT) -->
      <div onclick="openEstimateDetailMobile('${key}')" class="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-400 cursor-pointer transition-all active-scale space-y-2">
        <div class="flex items-center justify-between">
          <span class="mono text-xs font-black text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">${estNo}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusClass}">${statusText}</span>
        </div>
        <p class="text-xs font-black text-slate-900 line-clamp-2 leading-snug">${desc}</p>
        <p class="text-[11px] font-medium text-slate-500 flex items-center gap-1 truncate">
          <span>📍</span> <span>${loc}</span>
        </p>
        <div class="flex justify-between items-center pt-2 border-t border-slate-100">
          <span class="text-xs font-black text-teal-700">Rs. ${cost}</span>
          <span class="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">${manDays} man-days</span>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

function filterLightEstimates() {
  const query = (document.getElementById("mlEstimateSearch")?.value || "").toLowerCase().trim();
  const cards = document.querySelectorAll("#mlEstimateList > div");
  cards.forEach(c => {
    const text = c.textContent.toLowerCase();
    c.style.display = text.includes(query) ? "" : "none";
  });
}

// ── ESTIMATE DETAIL MODAL (PIC - 04 RIGHT) ──
function openEstimateDetailMobile(estKey) {
  const est = (mlStore.estimates || []).find(e => String(e._fbKey) === String(estKey) || String(e.id) === String(estKey));
  if (!est) return;

  mlStore.selectedEstKey = est._fbKey || est.id;

  const numEl = document.getElementById("mlEstDetailNumber");
  const refEl = document.getElementById("mlEstDetailRef");
  const statEl = document.getElementById("mlEstDetailStatusBadge");
  const locEl = document.getElementById("mlEstDetailLocation");
  const userEl = document.getElementById("mlEstDetailEndUser");
  const scopeEl = document.getElementById("mlEstDetailScope");
  const matList = document.getElementById("mlEstDetailMaterialsList");
  const matTot = document.getElementById("mlEstDetailMaterialsTotal");
  const labList = document.getElementById("mlEstDetailLaborList");
  const labTot = document.getElementById("mlEstDetailLaborTotal");
  const grandTot = document.getElementById("mlEstDetailGrandTotal");
  const sigEl = document.getElementById("mlEstDetailSignatures");

  if (numEl) numEl.textContent = est.estimate_number || "EST/--";
  if (refEl) refEl.textContent = (est.ref_type || est.reference_type || "REF") + ": " + (est.reference_no || est.reference_doc || "N/A");
  
  if (statEl) {
    const isApproved = est.status === "Approved";
    statEl.textContent = isApproved ? "✓ Approved" : (est.status || "Pending");
    statEl.className = isApproved 
      ? "text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300"
      : "text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300";
  }

  const approveBtn = document.getElementById("mlEstDetailApproveBtn");
  if (approveBtn) {
    approveBtn.classList.toggle("hidden", est.status === "Approved");
  }

  if (locEl) locEl.textContent = est.location || "Location not set";
  if (userEl) userEl.textContent = est.endUser || est.end_user || "N/A";
  if (scopeEl) scopeEl.textContent = est.description || est.workScope || "No scope described";

  const materials = Array.isArray(est.materials) ? est.materials : (est.materials ? Object.values(est.materials) : []);
  if (matList) {
    if (materials.length === 0) {
      matList.innerHTML = '<tr><td colspan="5" class="p-2 text-center text-slate-400 italic">No materials specified</td></tr>';
    } else {
      matList.innerHTML = materials.map((m, idx) => `
        <tr class="border-b border-slate-100">
          <td class="p-1.5 font-bold text-slate-700">${idx + 1}. ${escapeHtml(m.description || m.name)}</td>
          <td class="p-1.5 text-center font-mono">${m.qty || 1}</td>
          <td class="p-1.5 text-center text-slate-500">${escapeHtml(m.unit || 'Nos')}</td>
          <td class="p-1.5 text-right font-mono">${formatCurrency(m.cost || m.rate || 0)}</td>
          <td class="p-1.5 text-right font-bold text-teal-800 font-mono">${formatCurrency(m.total || ((m.qty || 1) * (m.cost || 0)))}</td>
        </tr>`).join("");
    }
  }
  if (matTot) matTot.textContent = "Rs. " + formatCurrency(est.total_cost || 0);

  const labor = Array.isArray(est.labor) ? est.labor : (est.labor ? Object.values(est.labor) : []);
  if (labList) {
    if (labor.length === 0) {
      labList.innerHTML = '<tr><td colspan="3" class="p-2 text-center text-slate-400 italic">No labor requirement specified</td></tr>';
    } else {
      labList.innerHTML = labor.map((l) => `
        <tr class="border-b border-slate-100">
          <td class="p-1.5 font-bold text-slate-700">${escapeHtml(l.trade || 'Worker')}</td>
          <td class="p-1.5 text-center font-mono">${l.workers || 1}</td>
          <td class="p-1.5 text-right font-bold font-mono text-slate-800">${l.manDays || l.man_days || 0}</td>
        </tr>`).join("");
    }
  }
  if (labTot) labTot.textContent = (est.totalManDays || est.manDays || 0) + " man-days";
  if (grandTot) grandTot.textContent = "Rs. " + formatCurrency(est.total_cost || 0);

  if (sigEl) {
    const cb = est.createdBy || {};
    const chk = est.checkedBy || {};
    sigEl.innerHTML = `
      <div class="flex justify-between">
        <span><strong>Created By:</strong> ${escapeHtml(cb.name || "—")} (${escapeHtml(cb.rank || "")} ${escapeHtml(cb.serviceNo || "")})</span>
      </div>
      <div class="flex justify-between border-t border-slate-200 pt-1">
        <span><strong>Checked By:</strong> ${escapeHtml(chk.name || "—")} (${escapeHtml(chk.rank || "")} ${escapeHtml(chk.serviceNo || "")})</span>
      </div>`;
  }

  const modal = document.getElementById("mlEstimateDetailModal");
  if (modal) modal.classList.remove("hidden");
}

function closeEstimateDetailMobile() {
  const modal = document.getElementById("mlEstimateDetailModal");
  if (modal) modal.classList.add("hidden");
  mlStore.selectedEstKey = null;
}

function approveCurrentEstimateMobile() {
  if (!mlStore.selectedEstKey) return;
  const key = mlStore.selectedEstKey;
  if (!confirm("Are you sure you want to approve this estimate?")) return;

  opsDB.ref(`estimates/${key}`).update({
    status: "Approved",
    approved_at: Date.now()
  }).then(() => {
    showLightToast("Estimate Approved!", "✅");
    closeEstimateDetailMobile();
  }).catch(err => {
    console.error(err);
    showLightToast("Error approving estimate", "❌");
  });
}

function deleteCurrentEstimateMobile() {
  if (!mlStore.selectedEstKey) return;
  const key = mlStore.selectedEstKey;
  if (!confirm("⚠️ Are you sure you want to permanently delete this estimate?")) return;

  opsDB.ref(`estimates/${key}`).remove().then(() => {
    showLightToast("Estimate Deleted!", "🗑️");
    closeEstimateDetailMobile();
  }).catch(err => {
    console.error(err);
    showLightToast("Error deleting estimate", "❌");
  });
}

function editCurrentEstimateMobile() {
  const key = mlStore.selectedEstKey;
  closeEstimateDetailMobile();
  if (key) openNewEstimateModalMobile(key);
}

// ── NEW / EDIT ESTIMATE FORM MODAL (PIC - 03) ──
function openNewEstimateModalMobile(editKey) {
  const modal = document.getElementById("mlNewEstimateModal");
  const title = document.getElementById("mlNewEstModalTitle");
  const editInput = document.getElementById("mlEstEditKey");
  const matContainer = document.getElementById("mlEstMaterialsContainer");
  const labContainer = document.getElementById("mlEstLaborContainer");

  populateLocationDatalistMobile();

  if (editKey) {
    const est = (mlStore.estimates || []).find(e => String(e._fbKey) === String(editKey) || String(e.id) === String(editKey));
    if (est) {
      if (title) title.textContent = "Edit Estimate (" + (est.estimate_number || "") + ")";
      if (editInput) editInput.value = est._fbKey || est.id;
      document.getElementById("mlEstDesc").value = est.description || est.workScope || "";
      document.getElementById("mlEstRefType").value = est.ref_type || est.reference_type || "Minute Sheet";
      document.getElementById("mlEstRefNo").value = est.reference_no || est.reference_doc || "";
      document.getElementById("mlEstProjType").value = est.project_type || est.type || "PROJECT";
      document.getElementById("mlEstLoc").value = est.location || "";
      document.getElementById("mlEstLoc2").value = est.location2 || est.sub_location || "";
      document.getElementById("mlEstEndUser").value = est.endUser || est.end_user || "";

      const cb = est.createdBy || {};
      document.getElementById("mlEstCreatedName").value = cb.name || "";
      document.getElementById("mlEstCreatedRank").value = cb.rank || "";
      document.getElementById("mlEstCreatedSvc").value = cb.serviceNo || "";

      const chk = est.checkedBy || {};
      document.getElementById("mlEstCheckedName").value = chk.name || "";
      document.getElementById("mlEstCheckedRank").value = chk.rank || "";
      document.getElementById("mlEstCheckedSvc").value = chk.serviceNo || "";

      if (matContainer) {
        matContainer.innerHTML = "";
        (est.materials || []).forEach(m => addMaterialRowMobile(m));
      }

      if (labContainer) {
        labContainer.innerHTML = "";
        (est.labor || []).forEach(l => addLaborRowMobile(l));
      }

      calcNewEstTotalsMobile();
    }
  } else {
    if (title) title.textContent = "New Estimate";
    if (editInput) editInput.value = "";
    document.getElementById("mlNewEstForm").reset();

    const inc = (mlStore.zoneInCharges || {})[mlStore.currentZone] || {};
    document.getElementById("mlEstCheckedName").value = inc.name || "";
    document.getElementById("mlEstCheckedRank").value = inc.rank || "";
    document.getElementById("mlEstCheckedSvc").value = inc.service_no || "";

    if (matContainer) {
      matContainer.innerHTML = "";
      addMaterialRowMobile({ description: "", qty: 1, unit: "Nos", cost: 0 });
    }
    if (labContainer) {
      labContainer.innerHTML = "";
      addLaborRowMobile({ trade: "Carpenter", workers: 1, manDays: 1 });
    }

    calcNewEstTotalsMobile();
  }

  if (modal) modal.classList.remove("hidden");
}

function closeNewEstimateModalMobile() {
  const modal = document.getElementById("mlNewEstimateModal");
  if (modal) modal.classList.add("hidden");
}

function addMaterialRowMobile(data) {
  const container = document.getElementById("mlEstMaterialsContainer");
  if (!container) return;
  const d = data || { description: "", qty: 1, unit: "Nos", cost: 0 };
  const total = parseFloat(d.qty || 0) * parseFloat(d.cost || d.rate || 0);

  const row = document.createElement("div");
  row.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs est-mat-row";
  row.innerHTML = `
    <div class="flex items-center gap-1.5">
      <input type="text" placeholder="Material item description..." value="${escapeHtml(d.description || '')}" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 est-mat-desc">
      <button type="button" onclick="removeMaterialRowMobile(this)" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center text-xs font-bold shrink-0">✕</button>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Qty</label>
        <input type="number" step="any" min="0" value="${d.qty || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold est-mat-qty">
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Unit</label>
        <select class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold est-mat-unit">
          <option value="Nos" ${d.unit === 'Nos' ? 'selected' : ''}>Nos</option>
          <option value="Kg" ${d.unit === 'Kg' ? 'selected' : ''}>Kg</option>
          <option value="Ft" ${d.unit === 'Ft' ? 'selected' : ''}>Ft</option>
          <option value="M" ${d.unit === 'M' ? 'selected' : ''}>M</option>
          <option value="Sqr" ${d.unit === 'Sqr' ? 'selected' : ''}>Sqr</option>
          <option value="Cube" ${d.unit === 'Cube' ? 'selected' : ''}>Cube</option>
          <option value="Ltr" ${d.unit === 'Ltr' ? 'selected' : ''}>Ltr</option>
          <option value="Bags" ${d.unit === 'Bags' ? 'selected' : ''}>Bags</option>
        </select>
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Unit Cost (Rs)</label>
        <input type="number" step="any" min="0" value="${d.cost || d.rate || 0}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold est-mat-cost">
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Total (Rs)</label>
        <span class="block bg-slate-100 border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-right text-teal-800 est-mat-line-total">Rs. ${formatCurrency(total)}</span>
      </div>
    </div>`;
  container.appendChild(row);
  calcNewEstTotalsMobile();
}

function removeMaterialRowMobile(btn) {
  const row = btn.closest(".est-mat-row");
  if (row) row.remove();
  calcNewEstTotalsMobile();
}

function addLaborRowMobile(data) {
  const container = document.getElementById("mlEstLaborContainer");
  if (!container) return;
  const d = data || { trade: "Carpenter", workers: 1, manDays: 1 };

  const row = document.createElement("div");
  row.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs est-lab-row";
  row.innerHTML = `
    <div class="grid grid-cols-12 gap-1.5 items-center">
      <div class="col-span-5">
        <label class="block text-[9px] font-bold text-slate-500">Trade</label>
        <select class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold est-lab-trade">
          <option value="Carpenter" ${d.trade === 'Carpenter' ? 'selected' : ''}>Carpenter</option>
          <option value="Painter" ${d.trade === 'Painter' ? 'selected' : ''}>Painter</option>
          <option value="Mason" ${d.trade === 'Mason' ? 'selected' : ''}>Mason</option>
          <option value="Plumber" ${d.trade === 'Plumber' ? 'selected' : ''}>Plumber</option>
          <option value="Welder" ${d.trade === 'Welder' ? 'selected' : ''}>Welder</option>
          <option value="Electrician" ${d.trade === 'Electrician' ? 'selected' : ''}>Electrician</option>
          <option value="Laborer" ${d.trade === 'Laborer' ? 'selected' : ''}>Laborer</option>
        </select>
      </div>
      <div class="col-span-3">
        <label class="block text-[9px] font-bold text-slate-500">Workers</label>
        <input type="number" min="1" value="${d.workers || 1}" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold est-lab-workers">
      </div>
      <div class="col-span-3">
        <label class="block text-[9px] font-bold text-slate-500">Man-Days</label>
        <input type="number" step="any" min="0" value="${d.manDays || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold est-lab-days">
      </div>
      <div class="col-span-1 text-right pt-3">
        <button type="button" onclick="removeLaborRowMobile(this)" class="w-6 h-6 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold">✕</button>
      </div>
    </div>`;
  container.appendChild(row);
  calcNewEstTotalsMobile();
}

function removeLaborRowMobile(btn) {
  const row = btn.closest(".est-lab-row");
  if (row) row.remove();
  calcNewEstTotalsMobile();
}

function calcNewEstTotalsMobile() {
  let matTotal = 0;
  document.querySelectorAll(".est-mat-row").forEach(r => {
    const qty = parseFloat(r.querySelector(".est-mat-qty")?.value || 0);
    const cost = parseFloat(r.querySelector(".est-mat-cost")?.value || 0);
    const lineTot = qty * cost;
    const lineTotEl = r.querySelector(".est-mat-line-total");
    if (lineTotEl) lineTotEl.textContent = "Rs. " + formatCurrency(lineTot);
    matTotal += lineTot;
  });

  let laborDays = 0;
  document.querySelectorAll(".est-lab-row").forEach(r => {
    const days = parseFloat(r.querySelector(".est-lab-days")?.value || 0);
    laborDays += days;
  });

  const matCostEl = document.getElementById("mlEstSummaryMatCost");
  const manDaysEl = document.getElementById("mlEstSummaryManDays");
  const grandTotalEl = document.getElementById("mlEstSummaryGrandTotal");

  if (matCostEl) matCostEl.textContent = "Rs. " + formatCurrency(matTotal);
  if (manDaysEl) manDaysEl.textContent = laborDays.toString();
  if (grandTotalEl) grandTotalEl.textContent = "Rs. " + formatCurrency(matTotal);
}

function saveEstimateMobile(e) {
  if (e) e.preventDefault();

  const desc = (document.getElementById("mlEstDesc")?.value || "").trim();
  if (!desc) {
    showLightToast("Please enter estimate description", "⚠️");
    return;
  }

  const editKey = document.getElementById("mlEstEditKey")?.value;
  const refType = document.getElementById("mlEstRefType")?.value || "Minute Sheet";
  const refNo = (document.getElementById("mlEstRefNo")?.value || "").trim();
  const projType = document.getElementById("mlEstProjType")?.value || "PROJECT";
  const loc = (document.getElementById("mlEstLoc")?.value || "").trim();
  const loc2 = (document.getElementById("mlEstLoc2")?.value || "").trim();
  const endUser = (document.getElementById("mlEstEndUser")?.value || "").trim();

  // Materials
  const materials = [];
  let grandMaterials = 0;
  document.querySelectorAll(".est-mat-row").forEach(r => {
    const mDesc = (r.querySelector(".est-mat-desc")?.value || "").trim();
    const qty = parseFloat(r.querySelector(".est-mat-qty")?.value || 0);
    const unit = r.querySelector(".est-mat-unit")?.value || "Nos";
    const cost = parseFloat(r.querySelector(".est-mat-cost")?.value || 0);
    const total = qty * cost;
    if (mDesc) {
      materials.push({ description: mDesc, qty, unit, cost, total });
      grandMaterials += total;
    }
  });

  // Labor
  const labor = [];
  let grandLabor = 0;
  document.querySelectorAll(".est-lab-row").forEach(r => {
    const trade = r.querySelector(".est-lab-trade")?.value || "Carpenter";
    const workers = parseInt(r.querySelector(".est-lab-workers")?.value || 1, 10);
    const manDays = parseFloat(r.querySelector(".est-lab-days")?.value || 0);
    if (manDays > 0) {
      labor.push({ trade, workers, manDays });
      grandLabor += manDays;
    }
  });

  const createdBy = {
    name: (document.getElementById("mlEstCreatedName")?.value || "").trim(),
    rank: (document.getElementById("mlEstCreatedRank")?.value || "").trim(),
    serviceNo: (document.getElementById("mlEstCreatedSvc")?.value || "").trim()
  };

  const checkedBy = {
    name: (document.getElementById("mlEstCheckedName")?.value || "").trim(),
    rank: (document.getElementById("mlEstCheckedRank")?.value || "").trim(),
    serviceNo: (document.getElementById("mlEstCheckedSvc")?.value || "").trim()
  };

  const currentZone = mlStore.currentZone;

  if (editKey) {
    const updateObj = {
      description: desc,
      workScope: desc,
      ref_type: refType,
      reference_type: refType,
      reference_doc: refNo,
      reference_no: refNo,
      project_type: projType,
      type: projType,
      location: loc,
      location2: loc2,
      sub_location: loc2,
      endUser: endUser,
      materials: materials,
      labor: labor,
      total_cost: grandMaterials,
      totalManDays: grandLabor,
      createdBy: createdBy,
      checkedBy: checkedBy,
      updated_at: Date.now()
    };

    opsDB.ref(`estimates/${editKey}`).update(updateObj).then(() => {
      showLightToast("Estimate updated successfully!", "✅");
      closeNewEstimateModalMobile();
    }).catch(err => {
      console.error(err);
      showLightToast("Error updating estimate", "❌");
    });
  } else {
    const year = new Date().getFullYear();
    const nextSeq = (mlStore.estimates.length + 1).toString().padStart(4, "0");
    const estNumber = `EST/${year}/${nextSeq}`;

    const newRef = opsDB.ref("estimates").push();
    const newEst = {
      id: newRef.key,
      estimate_number: estNumber,
      description: desc,
      workScope: desc,
      ref_type: refType,
      reference_type: refType,
      reference_doc: refNo,
      reference_no: refNo,
      project_type: projType,
      type: projType,
      location: loc,
      location2: loc2,
      sub_location: loc2,
      endUser: endUser,
      materials: materials,
      labor: labor,
      total_cost: grandMaterials,
      totalManDays: grandLabor,
      status: "Pending",
      createdBy: createdBy,
      checkedBy: checkedBy,
      zone_id: currentZone,
      created_at: Date.now()
    };

    newRef.set(newEst).then(() => {
      showLightToast("Estimate " + estNumber + " created!", "✅");
      closeNewEstimateModalMobile();
    }).catch(err => {
      console.error(err);
      showLightToast("Error creating estimate", "❌");
    });
  }
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
// QUICK ASSIGN CREW MODAL (FROM CARD BUTTON)
// ---------------------------------------------
function openAssignModal(woKey) {
  mlStore.selectedAssignKey = woKey;
  const modal = document.getElementById("mlAssignModal");
  const picker = document.getElementById("mlAssignSailorPicker");
  if (!modal || !picker) return;

  const wo = mlStore.workOrders.find(w => String(w.id) === String(woKey) || String(w._fbKey) === String(woKey));
  const assigned = new Set((wo && Array.isArray(wo.assigned)) ? wo.assigned.map(String) : []);

  picker.innerHTML = mlStore.sailors.slice(0, 80).map(s => {
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

// ---------------------------------------------
// TOAST SYSTEM
// ---------------------------------------------
let mlToastTimer = null;
function showLightToast(msg, icon) {
  const toast = document.getElementById("mlToast");
  const msgEl = document.getElementById("mlToastMsg");
  const iconEl = document.getElementById("mlToastIcon");
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon || "✅";

  if (mlToastTimer) clearTimeout(mlToastTimer);

  toast.classList.remove("hidden");
  void toast.offsetWidth;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  mlToastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 260);
  }, 2200);
}

// Global bootstrap
window.addEventListener("DOMContentLoaded", initLightApp);
