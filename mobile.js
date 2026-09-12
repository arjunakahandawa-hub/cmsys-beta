// =============================================
// CMSys MOBILE QUICK ENTRY PORTAL (mobile.js)
// Complete Zone & Workshop support with exact parity to main admin panel
// =============================================

// Helper for UTC safe timezone processing (Sri Lanka local date)
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

function parseOfficialNumber(offNo) {
  if (!offNo) return { type: "•", num: "-" };
  const clean = offNo.trim().replace(/^[^a-zA-Z0-9]+/, "");
  const match = clean.match(/^([A-Za-z\/&]+)[\s\.\-]*(\d+[A-Za-z]*)$/);
  if (match) {
    return { type: match[1], num: match[2] };
  }
  const parts = clean.split(/[\s]+/);
  if (parts.length > 1) {
    return { type: parts[0], num: parts.slice(1).join(" ") };
  }
  if (/^\d+$/.test(clean)) {
    return { type: "•", num: clean };
  }
  return { type: "•", num: clean };
}

function getSailorDisplayName(sailorId) {
  if (!sailorId) return "";
  const s = (typeof mStore !== "undefined" && mStore.sailors)
    ? mStore.sailors.find(
        (sailor) =>
          String(sailor.id) === String(sailorId) ||
          String(sailor._fbKey) === String(sailorId) ||
          String(sailor.off_no || sailor.official_number) === String(sailorId)
      )
    : null;
  if (!s) return String(sailorId);
  const off = s.off_no || s.official_number || "";
  const rank = s.rank || "";
  const name = s.name || "";
  const offPart = off ? ` (${off})` : "";
  return `${rank} ${name}${offPart}`.trim();
}

function getWorkOrderCreatedDate(wo) {
  if (!wo) return "";
  if (wo.date) return String(wo.date).split("T")[0];
  if (wo.created_date) return String(wo.created_date).split("T")[0];
  if (wo.created_at) {
    try {
      const cd = new Date(wo.created_at);
      if (!isNaN(cd.getTime())) return cd.toISOString().split("T")[0];
    } catch (e) {}
    if (typeof wo.created_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(wo.created_at)) {
      return wo.created_at.substring(0, 10);
    }
  }
  return "";
}

function getSelectedDate() {
  return (typeof mStore !== "undefined" && mStore.selectedDate) ? mStore.selectedDate : getLocalDateString();
}

function updateDateUI() {
  const curDate = getSelectedDate();
  const today = getLocalDateString();
  const picker = document.getElementById("mDatePicker");
  const dateBadgeEl = document.getElementById("mTodayDateBadge");
  const backBanner = document.getElementById("mBackDateBanner");
  const backLabel = document.getElementById("mBackDateLabel");
  const btnToday = document.getElementById("mBtnToday");

  if (picker && picker.value !== curDate) {
    picker.value = curDate;
  }
  if (dateBadgeEl) {
    dateBadgeEl.textContent = curDate === today ? "Today" : curDate;
  }

  const isBackDate = curDate !== today;
  if (backBanner) {
    if (isBackDate) {
      backBanner.classList.remove("hidden");
      if (backLabel) {
        backLabel.textContent = `Viewing Record: ${curDate}`;
      }
    } else {
      backBanner.classList.add("hidden");
    }
  }

  if (btnToday) {
    if (isBackDate) {
      btnToday.className = "px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-slate-900 hover:bg-amber-400 active:scale-95 shadow-sm transition-all cursor-pointer animate-pulse";
      btnToday.textContent = "Back to Today";
    } else {
      btnToday.className = "px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-600 text-slate-900 hover:bg-teal-500 active:scale-95 shadow-sm transition-all cursor-pointer";
      btnToday.textContent = "Today";
    }
  }
}

function changeMobileDate(val) {
  if (!val) return;
  mStore.selectedDate = val;
  updateDateUI();
  updateZoneSailorStats();
  renderWorkOrders();
}

function navigateMobileDate(delta) {
  const cur = getSelectedDate();
  const parts = cur.split("-");
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  mStore.selectedDate = `${y}-${m}-${day}`;
  updateDateUI();
  updateZoneSailorStats();
  renderWorkOrders();
}

function jumpMobileToday() {
  mStore.selectedDate = getLocalDateString();
  updateDateUI();
  updateZoneSailorStats();
  renderWorkOrders();
}

function sanitizeFbKey(key) {
  if (!key) return "";
  return String(key).replace(/[.#$\[\]\/]/g, "_");
}

function isAdminStaffDuties(zoneIdOrName) {
  if (!zoneIdOrName) return false;
  const normalized = zoneIdOrName.toLowerCase().replace(/[-&\s]+/g, "");
  return normalized === "adminstaffduties";
}

function isSbsZone(zoneIdOrName) {
  if (!zoneIdOrName) return false;
  const normalized = zoneIdOrName.toLowerCase().replace(/[-_\s]+/g, "");
  return normalized === "sbs" || normalized.includes("sbsrecord");
}

function isAssignmentItem(w) {
  if (!w) return false;
  const assignType = w.assign_type;
  const type = String(w.type || "").toUpperCase();
  const zone = w.zone_id || w.zone || (typeof mStore !== "undefined" ? mStore.currentZone : "");
  return Boolean(assignType) || type === "ASSIGNMENT" || (type === "TASK" && Boolean(assignType)) || isAdminStaffDuties(zone);
}

function isZoneMatch(z1, z2) {
  if (!z1 && !z2) return true;
  if (!z1 || !z2) return false;
  if (z1 === z2) return true;
  if (isAdminStaffDuties(z1) && isAdminStaffDuties(z2)) return true;
  if (isSbsZone(z1) && isSbsZone(z2)) return true;

  const s1 = String(z1).trim().toLowerCase().replace(/[-_\s&]+/g, "");
  const s2 = String(z2).trim().toLowerCase().replace(/[-_\s&]+/g, "");
  if (s1 === s2) return true;

  if ((s1.startsWith("carpenter") || s1.startsWith("carpentry")) && (s2.startsWith("carpenter") || s2.startsWith("carpentry"))) return true;

  const letterMap = {
    a: "azone",
    b: "bzone",
    c: "czone",
    d: "dzone",
    e: "ezone",
    g: "gzone",
    zonea: "azone",
    zoneb: "bzone",
    zonec: "czone",
    zoned: "dzone",
    zonee: "ezone",
    zoneg: "gzone",
    fh: "fhzone",
    zonefh: "fhzone",
    fhad: "fhzone",
    fhadzone: "fhzone",
  };
  const norm1 = letterMap[s1] || s1;
  const norm2 = letterMap[s2] || s2;
  return norm1 === norm2;
}

// Standard Zones & Workshops list
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
  { id: "Main-Store", name: "Main Store" },
  { id: "Carpentry-Shop", name: "Carpentry Shop & Painter Shop" },
  { id: "Welding-Shop", name: "Welding Shop" },
  { id: "Aluminium-Workshop", name: "Aluminium Workshop" }
];

// Helper to lock initial zone from URL query parameter or localStorage
function getInitialZone() {
  try {
    const params = new URLSearchParams(window.location.search);
    const qZone = params.get("zone");
    if (qZone && qZone.trim()) {
      localStorage.setItem("ncw_saved_zone", qZone.trim());
      return qZone.trim();
    }
  } catch (e) {}
  return localStorage.getItem("ncw_saved_zone") || "A-Zone";
}

// Global In-Memory Store
const mStore = {
  currentZone: getInitialZone(),
  selectedDate: getLocalDateString(),
  zones: [...STANDARD_ZONES],
  workOrders: [],
  sailors: [],
  sailorStatusCache: new Map(),
  dailyAllocations: [],
  jobCards: [],
  availability: {},
  outProjects: {},
  housingProjects: {},
  otherBases: {},
  selectedWo: null,
  assignedTemp: [],
  sailorFilterMode: "all", // "all" | "available"
  currentUser: {
    name: "Site Officer",
    rank: "PO1 (CE)",
    serviceNo: "NRX 12345"
  }
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
  const sailorsApp = firebase.initializeApp(sailorsFirebaseConfig, "mSailors");
  sailorsDB = firebase.database(sailorsApp);

  const opsApp = firebase.initializeApp(opsFirebaseConfig, "mOperations");
  opsDB = firebase.database(opsApp);
  console.log("⚡ CMSys Mobile: Dual Firebase connected");
} catch (e) {
  console.error("Firebase init error:", e);
}

// =============================================
// TOAST HELPER
// =============================================
let toastTimer = null;
function showToast(msg, type = "success") {
  const t = document.getElementById("mToast");
  const msgEl = document.getElementById("mToastMsg");
  const iconEl = document.getElementById("mToastIcon");
  if (!t) return;

  iconEl.textContent = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✅";
  msgEl.innerHTML = msg;

  t.classList.remove("translate-y-24");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add("translate-y-24");
  }, 3500);
}

// =============================================
// DATA FETCHING & REAL-TIME LISTENERS
// =============================================
function initListeners() {
  updateZoneSailorStats();

  // 1. Listen to Sailors DB
  if (sailorsDB) {
    sailorsDB.ref("sailors").on("value", (snap) => {
      const data = snap.val();
      mStore.sailors = [];
      if (data) {
        Object.entries(data).forEach(([key, s]) => {
          if (s) {
            s._fbKey = key;
            if (!s.id) s.id = key;
            s.off_no = String(s.off_no || s.official_number || s.official_no || s.service_no || s.officialNumber || "").trim();
            s.official_number = s.off_no;
            s.trade = String(s.trade || s.branch || s.rate || "Sailor").trim();
            s.branch = s.trade;
            mStore.sailors.push(s);
          }
        });
      }
      populateLeaderDropdowns();
      renderWorkOrders();
      updateZoneSailorStats();
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // Listen to Attendance / Leave availability
    sailorsDB.ref("availability").on("value", (snap) => {
      mStore.availability = snap.val() || {};
      updateZoneSailorStats();
      if (mStore.selectedWo) {
        populateLeaderDropdowns();
        renderSailorQuickPicker();
      }
    });
  }

  // 2. Listen to Settings (Zones / Workshops configured by Admin)
  if (opsDB) {
    opsDB.ref("settings/zones").on("value", (snap) => {
      const zonesData = snap.val();
      if (zonesData && Array.isArray(zonesData) && zonesData.length > 0) {
        mStore.zones = zonesData.filter((z) => z && (z.id || z.name) && z.active !== false && z.status !== "Inactive");
      } else {
        mStore.zones = [...STANDARD_ZONES];
      }
      updateZoneSailorStats();
      renderWorkOrders();
    });

    // 3. Listen to Work Orders
    opsDB.ref("work_orders").on("value", (snap) => {
      const data = snap.val();
      mStore.workOrders = [];
      if (data) {
        Object.entries(data).forEach(([key, w]) => {
          if (w) {
            w._fbKey = key;
            if (!w.id) w.id = key;
            w.assigned = Array.isArray(w.assigned) ? w.assigned : Object.values(w.assigned || {});
            w.last_assigned = Array.isArray(w.last_assigned) ? w.last_assigned : Object.values(w.last_assigned || {});
            mStore.workOrders.push(w);
          }
        });
      }
      renderWorkOrders();
      updateZoneSailorStats();
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // 4. Listen to Daily Allocations
    opsDB.ref("daily_allocations").on("value", (snap) => {
      const data = snap.val();
      mStore.dailyAllocations = [];
      if (data) {
        Object.entries(data).forEach(([key, a]) => {
          if (a) {
            a._fbKey = key;
            mStore.dailyAllocations.push(a);
          }
        });
      }
      renderWorkOrders();
      updateZoneSailorStats();
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // 5. Listen to Job Cards
    opsDB.ref("job_cards").on("value", (snap) => {
      const data = snap.val();
      mStore.jobCards = [];
      if (data) {
        Object.entries(data).forEach(([key, jc]) => {
          if (jc) {
            jc._fbKey = key;
            if (!jc.id) jc.id = key;
            jc.assigned = Array.isArray(jc.assigned) ? jc.assigned : Object.values(jc.assigned || {});
            mStore.jobCards.push(jc);
          }
        });
      }
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // 6. Listen to Long-Term Deployments
    opsDB.ref("out_projects").on("value", (snap) => {
      mStore.outProjects = snap.val() || {};
      if (mStore.selectedWo) renderSailorQuickPicker();
    });
    opsDB.ref("housing_projects").on("value", (snap) => {
      mStore.housingProjects = snap.val() || {};
      if (mStore.selectedWo) renderSailorQuickPicker();
    });
    opsDB.ref("other_bases").on("value", (snap) => {
      mStore.otherBases = snap.val() || {};
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // 7. Connection State Monitor
    opsDB.ref(".info/connected").on("value", (snap) => {
      const sync = document.getElementById("mSyncStatus");
      if (!sync) return;
      if (snap.val() === true) {
        sync.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Live</span>`;
        sync.className = "flex items-center gap-1 text-[10px] text-emerald-400 font-semibold shrink-0";
      } else {
        sync.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>Offline</span>`;
        sync.className = "flex items-center gap-1 text-[10px] text-amber-400 font-semibold shrink-0";
      }
    });
  }
}

// =============================================
// ACTIVE ZONE METRICS & BANNER DISPLAY
// =============================================
function updateZoneSailorStats() {
  const currentZone = mStore.currentZone;
  const targetDate = getSelectedDate();
  const today = getLocalDateString();
  const isBackDate = targetDate !== today;

  // Update Banner Title & Date
  const zoneObj = mStore.zones.find((z) => isZoneMatch(z.id, currentZone));
  const zoneName = zoneObj ? zoneObj.name : currentZone;
  const isWorkshop = (currentZone || "").includes("Shop") || (currentZone || "").includes("Workshop") || currentZone === "Main-Store";

  const bannerNameEl = document.getElementById("mZoneBannerName");
  const badgeTypeEl = document.getElementById("mZoneBadgeType");
  const dateBadgeEl = document.getElementById("mTodayDateBadge");

  if (bannerNameEl) bannerNameEl.textContent = zoneName;
  if (badgeTypeEl) badgeTypeEl.textContent = isWorkshop ? "Workshop" : "Zone";
  if (dateBadgeEl) dateBadgeEl.textContent = isBackDate ? targetDate : "Today";

  // Sync date picker UI state
  updateDateUI();

  // 1. Identify sailors belonging to this zone/workshop
  let zoneSailors = mStore.sailors.filter((s) => {
    const z = s.zone_assigned || s.zone || s.location_zone;
    return z && isZoneMatch(z, currentZone);
  });

  // 2. If zoneSailors is empty, check workshop trades or work order assignments
  if (zoneSailors.length === 0) {
    const zoneWoIds = new Set(
      mStore.workOrders
        .filter((wo) => isZoneMatch(wo.zone_id || wo.zone, currentZone))
        .map((wo) => String(wo.id || wo._fbKey))
    );
    const assignedIds = new Set();
    (mStore.dailyAllocations || []).forEach((a) => {
      if (a.date === targetDate && a.status !== "Cancelled" && zoneWoIds.has(String(a.work_order_id))) {
        assignedIds.add(String(a.sailor_id));
      }
    });
    mStore.workOrders.forEach((wo) => {
      if (isZoneMatch(wo.zone_id || wo.zone, currentZone) && wo.assigned) {
        (Array.isArray(wo.assigned) ? wo.assigned : []).forEach((id) => assignedIds.add(String(id)));
      }
    });
    if (assignedIds.size > 0) {
      zoneSailors = mStore.sailors.filter((s) => assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey)));
    }
  }

  const targetPool = zoneSailors.length > 0 ? zoneSailors : mStore.sailors;

  let availCount = 0;
  let deployedCount = 0;
  let leaveSickCount = 0;

  targetPool.forEach((s) => {
    const st = getSailorStatusToday(s, null, targetDate);
    if (st.isLocked) {
      if (st.badgeText.includes("Sick") || st.badgeText.includes("Leave")) {
        leaveSickCount++;
      } else {
        deployedCount++;
      }
    } else {
      availCount++;
    }
  });

  const strengthEl = document.getElementById("mStatStrength");
  const availEl = document.getElementById("mStatAvailable");
  const deployedEl = document.getElementById("mStatDeployed");
  const leaveEl = document.getElementById("mStatLeaveSick");

  if (strengthEl) strengthEl.textContent = targetPool.length;
  if (availEl) availEl.textContent = availCount;
  if (deployedEl) deployedEl.textContent = deployedCount;
  if (leaveEl) leaveEl.textContent = leaveSickCount;
}

function refreshData(userInitiated = false) {
  renderWorkOrders();
  updateZoneSailorStats();
  if (userInitiated) showToast("Data refreshed!");
}

// Check if work order belongs to active date
function isWorkOrderActiveOnDate(wo, targetDate) {
  if (!wo) return false;
  const today = getLocalDateString();
  const tDate = targetDate || today;

  const wid = String(wo.id || wo._fbKey || "");
  const wRef = String(wo.reference_no || "");
  const wJobNo = String(wo.job_no || "");
  const wDesc = String(wo.description || "").trim().toLowerCase();

  // 1. Check if dailyAllocations has an active allocation on target date (highest fidelity)
  const hasAlloc = (mStore.dailyAllocations || []).some((a) => {
    if (!a || a.date !== tDate || a.status === "Cancelled") return false;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();
    return (
      (wid && aWoId === wid) ||
      (wRef && aWoId === wRef) ||
      (wJobNo && aWoId === wJobNo) ||
      (wDesc && aDesc && (aDesc === wDesc || aDesc.includes(wDesc) || wDesc.includes(aDesc)))
    );
  });
  if (hasAlloc) return true;

  // 2. Check if committed / assigned on target date
  const isCommittedOnDate = (
    wo.last_commit_date === tDate ||
    wo.last_committed_date === tDate ||
    wo.last_assigned_date === tDate
  );
  if (isCommittedOnDate) return true;

  // 3. Completed items should only be shown if completed or committed on this exact target date
  if (wo.status === "Completed") {
    return wo.completed_date === tDate || wo.last_commit_date === tDate || wo.last_committed_date === tDate;
  }

  // 4. Hold items should not be shown unless explicitly allocated or committed on this date
  if (wo.status === "Hold") {
    return false;
  }

  // 5. Extract creation date
  const createdDate = getWorkOrderCreatedDate(wo);

  // 6. Single-Day Lifecycle for Tasks and Daily Assignments:
  // Tasks/Assignments created on previous days do not persist without active allocations on target date
  const isSingleDay = (
    wo.type === "TASK" ||
    Boolean(wo.assign_type) ||
    isAssignmentItem(wo) ||
    wo.type === "ASSIGNMENT"
  );

  if (isSingleDay) {
    if (createdDate) {
      // If created on a different date and no allocations on tDate, do not show
      if (createdDate !== tDate) {
        return false;
      }
      return true;
    }
    // If no createdDate known:
    if (wo.last_commit_date && wo.last_commit_date !== tDate) {
      return false;
    }
    return tDate === today;
  }

  // 7. Multi-day items (PROJECT, JOB, WORK_ORDER):
  if (createdDate && createdDate > tDate) {
    return false;
  }
  if (wo.completed_date && wo.completed_date < tDate) {
    return false;
  }

  if (wo.status === "Active" || wo.status === "Pending") {
    return true;
  }

  return false;
}

function isWorkOrderActiveToday(wo) {
  return isWorkOrderActiveOnDate(wo, getSelectedDate());
}

function getWorkOrderCrewForDate(wo, targetDate) {
  if (!wo) return [];
  const wid = String(wo.id || wo._fbKey || "");
  const wRef = String(wo.reference_no || "");
  const wJobNo = String(wo.job_no || "");
  const wDesc = String(wo.description || "").trim().toLowerCase();
  const today = getLocalDateString();
  const tDate = targetDate || today;

  // 1. Check dailyAllocations for this specific targetDate (ground truth)
  const dateAllocs = (mStore.dailyAllocations || []).filter((a) => {
    if (!a || a.date !== tDate || a.status === "Cancelled") return false;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();
    return (
      (wid && aWoId === wid) ||
      (wRef && aWoId === wRef) ||
      (wJobNo && aWoId === wJobNo) ||
      (wDesc && aDesc && (aDesc === wDesc || aDesc.includes(wDesc) || wDesc.includes(aDesc)))
    );
  });

  if (dateAllocs.length > 0) {
    return dateAllocs.map((a) => a.sailor_id || a.official_number || a.off_no).filter(Boolean);
  }

  // 2. If committed or assigned on this specific target date
  if (wo.last_commit_date === tDate || wo.last_committed_date === tDate || wo.last_assigned_date === tDate) {
    if (Array.isArray(wo.assigned) && wo.assigned.length > 0) return [...wo.assigned];
    if (Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0) return [...wo.last_assigned];
  }

  // 3. For today:
  if (tDate === today) {
    const createdDate = getWorkOrderCreatedDate(wo);
    // If created today and has planned crew:
    if (createdDate === today) {
      if (Array.isArray(wo.assigned) && wo.assigned.length > 0) return [...wo.assigned];
      if (Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0) return [...wo.last_assigned];
    }
    // Ongoing multi-day project / job:
    const isSingleDay = (wo.type === "TASK" || Boolean(wo.assign_type) || isAssignmentItem(wo) || wo.type === "ASSIGNMENT");
    if (!isSingleDay && (wo.status === "Active" || wo.status === "Pending")) {
      if (Array.isArray(wo.assigned) && wo.assigned.length > 0) return [...wo.assigned];
    }
  }

  return [];
}

// =============================================
// RENDER WORK ORDERS LIST
// =============================================
function renderWorkOrders() {
  const container = document.getElementById("mWoList");
  const countBadge = document.getElementById("mWoCountBadge");
  const titleEl = document.getElementById("mWoListTitle");
  if (!container) return;

  const q = (document.getElementById("mSearchWo")?.value || "").toLowerCase().trim();
  const currentZone = mStore.currentZone;
  const targetDate = getSelectedDate();
  const today = getLocalDateString();
  const isBackDate = targetDate !== today;

  // Filter by Zone Match & Active on selected date
  const filtered = mStore.workOrders.filter((w) => {
    const wZone = w.zone_id || w.zone || w.zoneId || w.location_zone || "";
    const matchZone = isZoneMatch(wZone, currentZone);
    if (!matchZone) return false;
    if (!isWorkOrderActiveOnDate(w, targetDate)) return false;

    if (!q) return true;
    const desc = (w.description || "").toLowerCase();
    const ref = (w.reference_no || "").toLowerCase();
    const status = (w.status || "").toLowerCase();
    const type = (w.type || w.assign_type || "").toLowerCase();

    // Search by leaders (display name, rank, official number, or id)
    const incStr = getSailorDisplayName(w.incharge).toLowerCase();
    const supStr = getSailorDisplayName(w.supervisor).toLowerCase();
    const artStr = getSailorDisplayName(w.project_artificer).toLowerCase();
    const incRaw = String(w.incharge || "").toLowerCase();
    const supRaw = String(w.supervisor || "").toLowerCase();
    const artRaw = String(w.project_artificer || "").toLowerCase();

    // Search by crew members assigned
    const crewMatches = getWorkOrderCrewForDate(w, targetDate).some((sid) => {
      const sDisplay = getSailorDisplayName(sid).toLowerCase();
      const sRaw = String(sid).toLowerCase();
      return sDisplay.includes(q) || sRaw.includes(q);
    });

    return (
      desc.includes(q) ||
      ref.includes(q) ||
      status.includes(q) ||
      type.includes(q) ||
      incStr.includes(q) ||
      supStr.includes(q) ||
      artStr.includes(q) ||
      incRaw.includes(q) ||
      supRaw.includes(q) ||
      artRaw.includes(q) ||
      crewMatches
    );
  });

  const zoneObj = mStore.zones.find((z) => isZoneMatch(z.id, currentZone));
  const zoneName = zoneObj ? zoneObj.name : currentZone;

  if (titleEl) titleEl.textContent = isBackDate ? `${zoneName} (${targetDate})` : `${zoneName} Tasks`;
  if (countBadge) countBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">
        <div class="text-3xl mb-1">📋</div>
        <p class="text-xs font-bold text-slate-400">No active work orders in ${zoneName}${isBackDate ? ` on ${targetDate}` : ""}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">${isBackDate ? "Try selecting another date or return to Today" : "Select another zone/workshop from the top menu or search"}</p>
      </div>`;
    return;
  }

  // Sort Active first, then by priority / progress
  filtered.sort((a, b) => {
    if (a.status === "Active" && b.status !== "Active") return -1;
    if (b.status === "Active" && a.status !== "Active") return 1;
    return (b.progress || 0) - (a.progress || 0);
  });

  container.innerHTML = filtered.map((w) => {
    const isAssign = isAssignmentItem(w);
    const progress = Math.min(100, Math.max(0, parseInt(w.progress) || 0));
    const targetDate = getSelectedDate();
    const effectiveCrew = getWorkOrderCrewForDate(w, targetDate);
    const crewCount = effectiveCrew.length;
    const isCommittedToday = (w.last_commit_date === targetDate || w.last_committed_date === targetDate);
    
    // Priority Badge (Matching pic - 02)
    let priorityBadge = '';
    const prio = w.priority || 'Medium';
    if (prio === 'High' || prio === 'Urgent' || prio === 'Emergency') {
      priorityBadge = '<span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🔴 ' + escapeHtml(prio) + '</span>';
    } else if (prio === 'Low') {
      priorityBadge = '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Low</span>';
    } else {
      priorityBadge = '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🟡 Medium</span>';
    }

    // Status Badge (Matching pic - 02)
    const status = w.status || 'Active';
    let statusBadge = '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">' + escapeHtml(status) + '</span>';
    if (status === 'Pending') statusBadge = '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">Pending</span>';
    else if (status === 'Hold') statusBadge = '<span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">On Hold</span>';
    else if (status === 'Completed') statusBadge = '<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">Completed</span>';

    // Active Today Badge (Matching pic - 02)
    const activeTodayBadge = isCommittedToday 
      ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active Today</span>'
      : (crewCount > 0 ? '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Standby</span>' : '');

    // Approval Badge (Matching pic - 02)
    const approvalBadge = '<span class="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-300 px-2 py-0.5 rounded-full text-[10px] font-bold">🛡️ Approved</span>';

    // Type Badge (Type P, Type J, Type T, Assignment)
    const typeLabel = w.assign_type ? ('💼 ' + w.assign_type) : (w.type ? ('📋 ' + w.type) : 'TASK');
    const typeBadge = '<span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">' + escapeHtml(typeLabel) + '</span>';

    // Calculate Trade Breakdown for Crew
    const tradeCounts = {};
    effectiveCrew.forEach(sid => {
      const s = mStore.sailors.find(sailor => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid) || String(sailor.off_no || sailor.official_number || '').toLowerCase() === String(sid).toLowerCase());
      const t = (s && (s.trade || s.branch)) || 'MA';
      const shortTrade = t.substring(0, 2).toUpperCase();
      tradeCounts[shortTrade] = (tradeCounts[shortTrade] || 0) + 1;
    });
    const tradeSummaryStr = Object.entries(tradeCounts).map(([tr, c]) => c + ' ' + tr).join(', ');

    // Sailor Pills with Ratings (Matching pic - 02: KUMARASINGHE [7.0], WIJERATHNA [7.0])
    let sailorPillsHtml = '';
    if (effectiveCrew.length > 0) {
      sailorPillsHtml = effectiveCrew.slice(0, 4).map(sid => {
        const s = mStore.sailors.find(sailor => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid) || String(sailor.off_no || sailor.official_number || '').toLowerCase() === String(sid).toLowerCase());
        const rawName = s ? (s.name || s.off_no || 'Sailor') : ('Sailor ' + sid);
        const nameParts = rawName.split(' ');
        const displayShort = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : rawName.toUpperCase();
        const score = 7.0; // Default evaluation score
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold shadow-xs">' + 
               escapeHtml(displayShort) + 
               ' <span class="bg-orange-500 text-slate-900 px-1.5 py-0.2 rounded-full text-[9px] font-black">' + score.toFixed(1) + '</span></span>';
      }).join(' ');

      if (effectiveCrew.length > 4) {
        sailorPillsHtml += ' <span class="text-[10px] text-slate-500 font-bold self-center">+' + (effectiveCrew.length - 4) + ' more</span>';
      }
    } else {
      sailorPillsHtml = '<span class="text-slate-400 text-xs italic">No sailors assigned yet</span>';
    }

    // Quick Commit Button (Proceed)
    let commitBtnHtml = '';
    if (!isCommittedToday && w.status !== 'Completed' && w.status !== 'Hold' && crewCount > 0) {
      commitBtnHtml = `
        <div class="pt-2 border-t border-slate-100" onclick="event.stopPropagation()">
          <button type="button" onclick="commitQuickFromCard(event, '${w._fbKey || w.id}')" class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active-scale transition-all">
            <span>⚡</span> Proceed - Commit Daily Labour (${crewCount})
          </button>
        </div>`;
    }

    const durationDays = w.duration || w.estimated_duration || 1;
    const locationStr = w.location || (mStore.currentZone + ' Area');

    return `
      <!-- WORK ORDER CARD (EXACT LIGHT NAVAL THEME PIC - 02) -->
      <div onclick="openWoSheet('${w._fbKey || w.id}')" class="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md p-4 space-y-3 transition-all cursor-pointer">
        
        <!-- Badges Row -->
        <div class="flex items-center gap-1.5 flex-wrap">
          ${priorityBadge}
          ${statusBadge}
          ${activeTodayBadge}
          ${approvalBadge}
          ${typeBadge}
        </div>

        <!-- Title & Location -->
        <div>
          <h3 class="text-sm font-bold text-slate-900 leading-snug hover:text-teal-700 transition-colors">${escapeHtml(w.description || 'Untitled Work Order')}</h3>
          <p class="text-xs text-slate-500 flex items-center gap-1 font-medium mt-1">
            <span>📍</span> <span>${escapeHtml(locationStr)}</span>
          </p>
        </div>

        <!-- Progress Bar (Only for non-assignments) -->
        ${!isAssign ? `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Progress</span>
            <span class="font-black text-teal-700 font-mono">${progress}%</span>
          </div>
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
            <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>` : ''}

        <!-- Duration Meta -->
        <div class="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span class="flex items-center gap-1">⏱️ ${durationDays}d</span>
          ${w.reference_no ? `<span class="text-[10px] font-mono text-slate-400">Ref: ${escapeHtml(w.reference_no)}</span>` : ''}
        </div>

        <!-- Assigned Sailors Crew (pic - 02) -->
        <div class="pt-2 border-t border-slate-100 space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-700 flex items-center gap-1">
              <span>🧑</span> ${crewCount} active
            </span>
            ${tradeSummaryStr ? `<span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">${escapeHtml(tradeSummaryStr)}</span>` : ''}
          </div>
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            ${sailorPillsHtml}
          </div>
        </div>

        ${commitBtnHtml}
      </div>
    `;
  }).join('');
}

function filterLmdList() {
  renderLmdList();
}

function markLmdMaintainedToday(assetId) {
  const item = mLmdRecords.find(a => String(a.id) === String(assetId));
  if (!item) return;

  const today = getLocalDateString();
  item.last_date = today;
  item.notes = `Serviced on ${today} by ${(mStore.currentUser && mStore.currentUser.name) || 'Duty LME'}`;

  const zone = mStore.currentZone || 'A-Zone';
  const cleanZone = zone.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (opsDB) {
    opsDB.ref(`lmd_records/${cleanZone}/${assetId}`).update({
      last_date: today,
      notes: item.notes
    });
  }

  showToast(`✅ ${item.name} marked as maintained today!`, 'success');
  renderLmdList();
}

function openNewLmdModal() {
  const modal = document.getElementById('mNewLmdModal');
  const dateInput = document.getElementById('mNewLmdDate');
  if (dateInput) dateInput.value = getLocalDateString();
  if (modal) modal.classList.remove('hidden');
}

function closeNewLmdModal() {
  const modal = document.getElementById('mNewLmdModal');
  if (modal) modal.classList.add('hidden');
}

function submitNewLmdAsset() {
  const name = (document.getElementById('mNewLmdName')?.value || '').trim();
  const location = (document.getElementById('mNewLmdLocation')?.value || '').trim();
  const date = document.getElementById('mNewLmdDate')?.value || getLocalDateString();
  const cycle = parseInt(document.getElementById('mNewLmdCycle')?.value, 10) || 90;
  const notes = (document.getElementById('mNewLmdNotes')?.value || '').trim();

  if (!name) {
    showToast('Please enter asset name', 'error');
    return;
  }

  const assetId = 'ast_' + Date.now().toString(36);
  const newAsset = {
    id: assetId,
    name,
    location,
    last_date: date,
    cycle_days: cycle,
    notes: notes || 'Registered in CMSys Mobile'
  };

  mLmdRecords.unshift(newAsset);

  const zone = mStore.currentZone || 'A-Zone';
  const cleanZone = zone.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (opsDB) {
    opsDB.ref(`lmd_records/${cleanZone}/${assetId}`).set(newAsset);
  }

  closeNewLmdModal();
  showToast('✅ New asset registered to LMD Tracker!', 'success');
  renderLmdList();
}


// --- 4. BASIC SAILOR DIRECTORY VIEWER ---
function setSailorDirTradeFilter(trade) {
  mSailorDirTradeFilter = trade;
  const btns = document.querySelectorAll('.m-trade-btn');
  btns.forEach(b => {
    if (b.textContent.toUpperCase().includes(trade) || (trade === 'ALL' && b.textContent.includes('All'))) {
      b.className = 'm-trade-btn px-2.5 py-1 rounded-lg bg-teal-600 text-slate-900 whitespace-nowrap active-scale';
    } else {
      b.className = 'm-trade-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-900 border border-slate-700 whitespace-nowrap active-scale';
    }
  });
  renderMobileSailorDirectory();
}

function filterMobileSailorDirectory() {
  renderMobileSailorDirectory();
}

function renderMobileSailorDirectory() {
  const container = document.getElementById('mSailorDirList');
  const countBadge = document.getElementById('mSailorDirTotal');
  if (!container) return;

  const search = (document.getElementById('mSailorDirSearch')?.value || '').toLowerCase().trim();
  const sailors = mStore.sailors || [];

  const filtered = sailors.filter(s => {
    const off = (s.off_no || s.official_number || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    const rank = (s.rank || '').toLowerCase();
    const trade = (s.trade || s.branch || '').toLowerCase();

    const matchesSearch = !search || off.includes(search) || name.includes(search) || rank.includes(search) || trade.includes(search);
    if (!matchesSearch) return false;

    if (mSailorDirTradeFilter !== 'ALL') {
      const target = mSailorDirTradeFilter.toLowerCase();
      if (!trade.includes(target)) return false;
    }
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Sailors`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">No sailors found matching criteria.</div>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map(s => {
    const off = s.off_no || s.official_number || '—';
    const rank = s.rank || 'AB';
    const name = s.name || 'Sailor';
    const trade = s.trade || s.branch || 'General';
    const status = s.status || 'Available';
    const isAvail = status === 'Available' || !status;

    return `
      <div class="bg-white border border-slate-200/90 shadow-sm rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-teal-400 shrink-0">
            ${rank}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-900 truncate">${escapeHtml(name)}</h4>
            <div class="flex items-center gap-1.5 text-[9px] text-slate-400">
              <span class="font-mono text-teal-300 font-semibold">${escapeHtml(off)}</span>
              <span>•</span>
              <span>${escapeHtml(trade)}</span>
            </div>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${isAvail ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}">
            ${escapeHtml(status)}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

window.addEventListener("DOMContentLoaded", () => {
  updateDateUI();
  initListeners();
});
