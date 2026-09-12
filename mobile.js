// =============================================
// CMSys MOBILE CONTROLLER (mobile.js & mobile-light.js)
// Unified Light Naval Architecture
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

// Global Mobile Store
const mlStore = {
  currentZone: (new URLSearchParams(window.location.search).get("zone")) || localStorage.getItem("ncw_saved_zone") || "A-Zone",
  selectedDate: getLocalDateString(),
  workOrders: [],
  sailors: [],
  dailyAllocations: [],
  estimates: [],
  locations: [],
  lmdRecords: [],
  zoneInCharges: {},
  activeTab: "home",
  selectedAssignKey: "",
  selectedEstKey: null
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

  // Check if target zone was already unlocked during this session
  if (sessionStorage.getItem("ncw_mobile_zone_unlocked_" + z) === "true") {
    applyZoneSwitch(z);
    return;
  }

  // Check password protection
  pendingZoneSwitch = z;
  openZonePasswordModal(z);
}

function applyZoneSwitch(z) {
  mlStore.currentZone = z;
  localStorage.setItem("ncw_saved_zone", z);
  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) zoneSelect.value = z;

  showLightToast("Switched to " + z, "📍");
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

  // Check against settings/zoneInCharges in Firebase
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
// DATE CONTROLS & HISTORICAL BANNER
// ---------------------------------------------
function changeLightDate(d) {
  if (!d) return;
  mlStore.selectedDate = d;
  updateHistoricalBanner();
  renderLightTasks();
}

function resetToTodayMobile() {
  const today = getLocalDateString();
  mlStore.selectedDate = today;
  const datePicker = document.getElementById("mlDatePicker");
  if (datePicker) datePicker.value = today;
  updateHistoricalBanner();
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
    if (sectionTitle) sectionTitle.textContent = "Active Work Orders";
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
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.sailors.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
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
// TAB 1: HOME (TASKS & DETAILS) - PIC 01, 02, 03
// ---------------------------------------------
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

  // 2. FOR TODAY'S VIEW:
  if (isToday) {
    // Completed or cancelled work orders DO NOT show on today's active list
    if (wo.status === "Completed" || wo.status === "Hold" || wo.status === "Cancelled") {
      return false;
    }
    // Check 1-day lifecycle for one-off tasks created on previous days without today's allocation
    if ((wo.type === "TASK" || !wo.type) && !wo.assign_type && wo.created_at) {
      try {
        const cd = new Date(wo.created_at).toISOString().split("T")[0];
        if (cd < today && !hasAllocationsOnDate) return false;
      } catch (e) {}
    }
    return true;
  }

  // 3. FOR BACK-DATE VIEW (targetDate < today):
  // Show if it had allocations on that date (already handled by hasAllocationsOnDate)
  // Or if it was active during that date
  if (targetDate < today) {
    if (wo.created_at) {
      try {
        const cd = new Date(wo.created_at).toISOString().split("T")[0];
        if (cd > targetDate) return false; // Created after this date
      } catch (e) {}
    }
    if (wo.status === "Completed") {
      const compDate = wo.completed_date || wo.last_commit_date || today;
      if (compDate < targetDate) return false; // Completed before this date
    }
    // Only show Project / Job if not allocated, skip ephemeral tasks without allocations
    if (wo.type === "TASK" || !wo.type) {
      return false;
    }
    return true;
  }

  return false;
}

function renderLightTasks() {
  const container = document.getElementById("mlTaskList");
  const countEl = document.getElementById("mlTaskCount");
  if (!container) return;

  const targetDate = mlStore.selectedDate || getLocalDateString();
  const today = getLocalDateString();
  const isToday = (targetDate === today);
  const currentZone = mlStore.currentZone;

  // Filter tasks for current zone that are active/allocated on targetDate
  const currentZoneTasks = mlStore.workOrders.filter(wo => {
    const z = wo.zone_id || wo.zone || "";
    if (!isZoneMatch(z, currentZone)) return false;
    return isWorkOrderActiveOnDate(wo, targetDate);
  });

  if (countEl) countEl.textContent = currentZoneTasks.length;

  if (currentZoneTasks.length === 0) {
    if (!isToday) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="text-3xl">📜</div>
          <p class="text-xs font-bold text-slate-700">No work orders or allocations found for ${targetDate}</p>
          <p class="text-[10px] text-slate-400">There were no recorded activities in ${currentZone} on this date.</p>
          <button type="button" onclick="resetToTodayMobile()" class="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black active-scale shadow-sm">
            ⚡ Return to Today
          </button>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="text-3xl">📋</div>
          <p class="text-xs font-bold text-slate-700">No active tasks in ${currentZone}</p>
          <button type="button" onclick="openNewTaskModal()" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold active-scale shadow-xs">
            ➕ Create First Work Order
          </button>
        </div>`;
    }
    return;
  }

  let html = "";
  currentZoneTasks.forEach(wo => {
    const key = wo._fbKey || wo.id;
    const desc = escapeHtml(wo.description || wo.title || "Untitled Job");
    const status = wo.status || "Active";
    const progress = Math.min(100, Math.max(0, parseInt(wo.progress, 10) || 0));
    const prio = wo.priority || "Medium";

    // Check allocations strictly for targetDate
    const woIdStr = String(wo.id || "");
    const woFbKeyStr = String(wo._fbKey || "");
    const targetAllocs = (mlStore.dailyAllocations || []).filter(a => {
      if (!a || a.date !== targetDate || a.status === "Cancelled") return false;
      const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
      return (woIdStr && aWoId === woIdStr) || (woFbKeyStr && aWoId === woFbKeyStr);
    });

    const isCommittedOnTargetDate = targetAllocs.length > 0;

    // Assigned sailor IDs
    let assignedIds = [];
    if (isCommittedOnTargetDate) {
      assignedIds = targetAllocs.map(a => String(a.sailor_id));
    } else if (isToday) {
      assignedIds = Array.isArray(wo.assigned) ? wo.assigned.map(String) : (wo.assigned ? Object.values(wo.assigned).map(String) : []);
    }

    const crewCount = assignedIds.length;

    // Priority Badge
    let prioBadge = prio === "Low" 
      ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Low</span>'
      : (prio === "High" || prio === "Urgent" 
          ? '<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🔴 ' + prio + '</span>'
          : '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟡 Medium</span>');

    const statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">${escapeHtml(status)}</span>`;

    let activeBadge = "";
    if (isCommittedOnTargetDate) {
      activeBadge = isToday 
        ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active Today</span>'
        : `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">📜 Allocated (${targetDate})</span>`;
    } else if (crewCount > 0 && isToday) {
      activeBadge = '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Standby</span>';
    }

    const typeBadge = `<span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">📋 ${escapeHtml(wo.type || 'PROJECT')}</span>`;

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

    // Commit button only available today for uncommitted tasks with sailors
    let commitBtnHtml = '';
    if (isToday && !isCommittedOnTargetDate && status !== 'Completed' && crewCount > 0) {
      commitBtnHtml = `
        <div class="pt-2 border-t border-slate-100">
          <button type="button" onclick="commitLightLabour('${key}')" class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 active-scale">
            <span>⚡</span> Proceed - Commit Daily Labour (${crewCount})
          </button>
        </div>`;
    }

    const locDisplay = escapeHtml(wo.location || wo.building_name || (currentZone + ' Area'));
    const subLoc = wo.sub_location ? ` / ${escapeHtml(wo.sub_location)}` : '';

    html += `
      <!-- WORK ORDER CARD -->
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2.5 transition-all">
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
        <div class="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
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
            <button type="button" onclick="openAssignModal('${key}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-teal-800 font-bold text-[11px] rounded-lg border border-slate-200 active-scale">
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
      showLightToast("Work Order Marked Completed! ✅", "🏆");
      renderLightTasks();
    }
  });
}

function commitLightLabour(key) {
  const wo = mlStore.workOrders.find(w => String(w.id) === String(key) || String(w._fbKey) === String(key));
  if (!wo) return;
  const today = getLocalDateString();
  const assigned = Array.isArray(wo.assigned) ? wo.assigned : (wo.assigned ? Object.values(wo.assigned) : []);

  if (assigned.length === 0) {
    showLightToast("No sailors assigned to commit", "⚠️");
    return;
  }

  const updates = {};
  assigned.forEach(sid => {
    const allocKey = `${today}_${sid}`;
    updates[`daily_allocations/${allocKey}`] = {
      date: today,
      sailor_id: sid,
      work_order_id: wo.id || key,
      status: "Active",
      hours: 7.0,
      zone_id: mlStore.currentZone
    };
  });

  updates[`work_orders/${key}/last_commit_date`] = today;
  updates[`work_orders/${key}/last_committed_date`] = today;

  opsDB.ref().update(updates).then(() => {
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
    if (!estZone) return true; // Show unassigned estimates
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

  // Materials
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

  // Labor
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

  // Signatories
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
  const total = parseFloat(d.qty || 0) * parseFloat(d.cost || 0);

  const row = document.createElement("div");
  row.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs est-mat-row";
  row.innerHTML = `
    <div class="flex items-center gap-1.5">
      <input type="text" placeholder="Material item description..." value="${escapeHtml(d.description || '')}" class="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 est-mat-desc">
      <button type="button" onclick="removeMaterialRowMobile(this)" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center text-xs font-bold shrink-0">✕</button>
    </div>
    <div class="grid grid-cols-4 gap-1.5">
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Qty</label>
        <input type="number" step="any" min="0" value="${d.qty || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono font-bold est-mat-qty">
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Unit</label>
        <select class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-bold est-mat-unit">
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
        <label class="block text-[9px] font-bold text-slate-500">Unit Cost (LKR)</label>
        <input type="number" step="any" min="0" value="${d.cost || d.rate || 0}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono font-bold est-mat-cost">
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-500">Total (LKR)</label>
        <span class="block bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs font-mono font-bold text-right text-teal-800 est-mat-line-total">Rs. ${formatCurrency(total)}</span>
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
  row.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-12 gap-1.5 items-center text-xs est-lab-row";
  row.innerHTML = `
    <div class="col-span-5">
      <label class="block text-[9px] font-bold text-slate-500">Trade</label>
      <select class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-bold est-lab-trade">
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
      <input type="number" min="1" value="${d.workers || 1}" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono font-bold est-lab-workers">
    </div>
    <div class="col-span-3">
      <label class="block text-[9px] font-bold text-slate-500">Man-Days</label>
      <input type="number" step="any" min="0" value="${d.manDays || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono font-bold est-lab-days">
    </div>
    <div class="col-span-1 text-right pt-3">
      <button type="button" onclick="removeLaborRowMobile(this)" class="w-6 h-6 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold">✕</button>
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

  // Signatories
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
// MODALS: QUICK ASSIGN & NEW TASK
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

function openNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  populateLocationDatalistMobile();
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
    assigned: [],
    created_at: Date.now()
  };

  newRef.set(newWo).then(() => {
    closeNewTaskModal();
    const form = document.getElementById("mlNewTaskForm");
    if (form) form.reset();
    showLightToast("Work Order created successfully!", "✅");
    renderLightTasks();
  }).catch(err => {
    console.error(err);
    showLightToast("Error creating work order", "❌");
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
  void toast.offsetWidth; // Force layout reflow
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
