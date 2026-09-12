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
      btnToday.className = "px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-500 active:scale-95 shadow-sm transition-all cursor-pointer";
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
    
    // Effective planned / deployed sailors for targetDate
    const effectiveCrew = getWorkOrderCrewForDate(w, targetDate);
    const crewCount = effectiveCrew.length;
    
    const isCommittedToday = (w.last_commit_date === targetDate || w.last_committed_date === targetDate);
    const itemType = w.assign_type ? `💼 ${w.assign_type}` : (isAssign ? "💼 ASSIGNMENT" : (w.type ? `📋 ${w.type}` : "TASK"));

    // Leader badges (In-Charge & Supervisor)
    const incDisplay = getSailorDisplayName(w.incharge);
    const supDisplay = getSailorDisplayName(w.supervisor);
    let leaderBadgesHtml = "";
    if (incDisplay || supDisplay) {
      leaderBadgesHtml = `
        <div class="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
          ${incDisplay ? `<span class="inline-flex items-center gap-1 bg-slate-900/90 text-teal-300 px-2 py-0.5 rounded-lg border border-teal-500/30 font-medium"><span>👤</span><strong class="text-[9px] text-slate-400">IC:</strong> <span class="truncate max-w-[130px]">${escapeHtml(incDisplay)}</span></span>` : ""}
          ${supDisplay ? `<span class="inline-flex items-center gap-1 bg-slate-900/90 text-sky-300 px-2 py-0.5 rounded-lg border border-sky-500/30 font-medium"><span>👮</span><strong class="text-[9px] text-slate-400">SUP:</strong> <span class="truncate max-w-[130px]">${escapeHtml(supDisplay)}</span></span>` : ""}
        </div>`;
    }

    // Status pill colors
    let statusClass = "bg-slate-700/60 text-slate-300 border-slate-600";
    if (w.status === "Active") statusClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    if (w.status === "Pending") statusClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
    if (w.status === "Hold") statusClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    if (w.status === "Completed") statusClass = "bg-blue-500/20 text-blue-300 border-blue-500/40";

    // Progress section: Only for genuine Work Orders, NEVER for Assignments!
    const progressHtml = isAssign
      ? ""
      : `
        <!-- Progress Bar & Percentage -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Progress</span>
            <span class="font-black text-teal-300">${progress}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>`;

    // 1-Tap Quick Commit Button directly on card if planned crew exists and not yet committed today
    let quickCommitHtml = "";
    if (isBackDate) {
      quickCommitHtml = `
        <div class="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-amber-300 font-bold px-1">
          <span class="flex items-center gap-1">📜 <span>Record (${targetDate})</span></span>
          <span class="text-slate-400 font-normal">${crewCount} sailor(s) deployed</span>
        </div>`;
    } else if (!isCommittedToday && w.status !== "Completed" && w.status !== "Hold" && crewCount > 0) {
      // Calculate available sailors excluding Leave/Sick
      let activeCrewCount = 0;
      effectiveCrew.forEach((sid) => {
        const s = mStore.sailors.find((sailor) => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid));
        if (s) {
          const st = (mStore.sailorStatusCache && mStore.sailorStatusCache.has(String(s.id || s._fbKey)))
            ? mStore.sailorStatusCache.get(String(s.id || s._fbKey))
            : getSailorStatusToday(s, null, targetDate);
          const isSickOrLeave = st.isLocked && (st.badgeText.includes("Sick") || st.badgeText.includes("Leave"));
          if (!isSickOrLeave) activeCrewCount++;
        } else {
          activeCrewCount++;
        }
      });

      const commitTargetCount = activeCrewCount > 0 ? activeCrewCount : crewCount;
      quickCommitHtml = `
        <div class="pt-2 border-t border-slate-700/60" onclick="event.stopPropagation()">
          <button type="button" onclick="commitQuickFromCard(event, '${w._fbKey || w.id}')" class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 flex items-center justify-center gap-1.5 active-scale transition-all cursor-pointer">
            <span>⚡</span> Proceed - Commit Daily Labour (${commitTargetCount})
          </button>
        </div>`;
    }

    return `
      <div onclick="openWoSheet('${w._fbKey || w.id}')" class="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 active-scale shadow-sm transition-all cursor-pointer space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1 flex-wrap">
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusClass}">${w.status || "Active"}</span>
              <span class="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">${itemType}</span>
              ${w.priority === "Urgent" || w.priority === "High" || w.priority === "Emergency" ? `<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">${w.priority}</span>` : ""}
              ${isCommittedToday ? `<span class="text-[9px] font-bold text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/30">✓ Committed</span>` : ""}
            </div>
            <h3 class="text-xs font-bold text-white line-clamp-2 leading-snug">${w.description || "Untitled Work Order"}</h3>
            ${w.reference_no ? `<p class="text-[10px] text-teal-400/80 font-mono mt-0.5">Ref: ${w.reference_no}</p>` : ""}
            ${leaderBadgesHtml}
          </div>
          <span class="text-base text-slate-400 font-bold shrink-0">›</span>
        </div>

        ${progressHtml}

        <div class="flex items-center justify-between pt-1 border-t border-slate-700/50 text-[10px] text-slate-400">
          <span class="flex items-center gap-1">👥 <strong class="text-slate-200">${crewCount}</strong> sailor(s) ${isBackDate ? "deployed" : "assigned"}</span>
          <span class="text-teal-400 font-bold">Tap to view details ➔</span>
        </div>

        ${quickCommitHtml}
      </div>`;
  }).join("");
}

function filterWorkOrders() {
  renderWorkOrders();
}

// =============================================
// WORK ORDER DETAIL / LABOUR SHEET LOGIC
// =============================================
// =============================================
// SAILOR STATUS & LOCK EVALUATION FOR TODAY
// =============================================
function getSailorStatusToday(sailor, currentWo, customDate = null) {
  if (!sailor) {
    return {
      isLocked: false,
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      badgeText: "✓ Available",
      reasonText: "Ready for assignment",
      icon: "✓"
    };
  }

  const today = customDate || getSelectedDate();
  const sId = String(sailor.id || "");
  const sFbKey = String(sailor._fbKey || "");
  const sOff = String(sailor.off_no || sailor.official_number || sailor.official_no || sailor.service_no || sailor.officialNumber || "").trim();
  const sOffClean = sOff.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const sOffDigits = sOff.replace(/\D/g, "");
  const currentWoId = currentWo ? String(currentWo._fbKey || currentWo.id || "") : "";

  // 1. Check Leave / Sick in sailorsDB availability
  const [year, month, day] = today.split("-");
  const monthKey = `${year}-${month}`;
  const dayKey = parseInt(day, 10).toString();
  const mAvail = mStore.availability?.[monthKey] || {};
  const dayAvail = mAvail[dayKey] || mAvail[day] || {};
  const fbStatus = dayAvail[sFbKey] || dayAvail[sId] || (sOff ? (dayAvail[sOff] || dayAvail[sOffDigits]) : null);

  const rawStatus = fbStatus || sailor.attendance || sailor.status || "";
  const statusStr = String(rawStatus).trim();

  if (/^(Sick|SIQ|S\/R|Hospital|ADM|Admit)$/i.test(statusStr)) {
    return {
      isLocked: true,
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      badgeText: "🏥 Sick",
      reasonText: statusStr || "Medical Attention",
      icon: "🏥"
    };
  }

  if (/^(Leave|NA|N\/A|L|DL|WE|HD|T\/D|M\/D|R\/D|SL|R|Off|Holiday|Absent|AWOL|නිවාඩු|ගිලන්)$/i.test(statusStr)) {
    return {
      isLocked: true,
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      badgeText: "🏖️ On Leave",
      reasonText: statusStr || "On Leave",
      icon: "🏖️"
    };
  }

  // 2. Check Long Term Projects (Out Project, Housing, Other Base)
  const checkLongTerm = (projectsObj, tag, defaultName) => {
    if (!projectsObj) return null;
    for (const pid of Object.keys(projectsObj)) {
      const proj = projectsObj[pid];
      if (proj && proj.assigned_sailors) {
        if (
          proj.assigned_sailors[sFbKey] ||
          proj.assigned_sailors[sId] ||
          (sOff && (proj.assigned_sailors[sOff] || proj.assigned_sailors[sOffDigits]))
        ) {
          return { name: (proj.name || defaultName).trim(), tag };
        }
      }
    }
    return null;
  };

  const ltOut = checkLongTerm(mStore.outProjects, "Out Project", "Out Project");
  if (ltOut) {
    return {
      isLocked: true,
      badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      badgeText: `🏕️ ${ltOut.tag}`,
      reasonText: ltOut.name,
      icon: "🏕️"
    };
  }

  const ltHousing = checkLongTerm(mStore.housingProjects, "Housing", "Housing Project");
  if (ltHousing) {
    return {
      isLocked: true,
      badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      badgeText: `🏠 ${ltHousing.tag}`,
      reasonText: ltHousing.name,
      icon: "🏠"
    };
  }

  const ltBase = checkLongTerm(mStore.otherBases, "Other Base", "Other Base");
  if (ltBase) {
    return {
      isLocked: true,
      badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      badgeText: `⚓ ${ltBase.tag}`,
      reasonText: ltBase.name,
      icon: "⚓"
    };
  }

  // 3. Check Daily Allocations for today
  if (mStore.dailyAllocations && mStore.dailyAllocations.length > 0) {
    const todayAlloc = mStore.dailyAllocations.find((a) => {
      if (a.date !== today || a.status === "Cancelled") return false;
      const aOff = String(a.official_number || a.off_no || a.sailor_id || "").trim();
      const aOffDigits = aOff.replace(/\D/g, "");
      const isThisSailor =
        String(a.sailor_id) === sId ||
        String(a.sailor_id) === sFbKey ||
        (sOff && aOff.toLowerCase() === sOff.toLowerCase()) ||
        (sOffDigits && aOffDigits && aOffDigits === sOffDigits);
      if (!isThisSailor) return false;
      if (currentWoId && String(a.work_order_id) === currentWoId) return false;
      return true;
    });

    if (todayAlloc) {
      let taskName = todayAlloc.work_order_title || todayAlloc.title || todayAlloc.location || todayAlloc.work_order_no || "";
      let taskZone = todayAlloc.zone || todayAlloc.zone_id || "";
      if (todayAlloc.work_order_id) {
        const otherWo = (mStore.workOrders || []).find((w) => String(w.id || w._fbKey) === String(todayAlloc.work_order_id));
        if (otherWo) {
          taskName = otherWo.description || otherWo.reference_no || taskName;
          taskZone = otherWo.zone_id || otherWo.zone || taskZone;
        }
      }
      const zoneDisplay = taskZone ? String(taskZone).replace(/-/g, " ") : "Another Task";
      return {
        isLocked: true,
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        badgeText: `🔒 Assigned: ${zoneDisplay}`,
        reasonText: taskName || "Allocated for today",
        icon: "🔒",
        zone: zoneDisplay
      };
    }
  }

  // 4. Check Work Orders committed / active today
  if (mStore.workOrders && mStore.workOrders.length > 0) {
    const otherWo = mStore.workOrders.find((w) => {
      const wKey = String(w._fbKey || w.id || "");
      if (currentWoId && wKey === currentWoId) return false;
      if (w.status === "Completed" || w.status === "Cancelled" || w.status === "Hold") return false;
      const isCommittedToday = (w.last_commit_date === today || w.last_committed_date === today || w.last_assigned_date === today);
      if (!isCommittedToday) return false;
      const assigned = Array.isArray(w.assigned) ? w.assigned : [];
      return assigned.some((id) => {
        const idStr = String(id).trim();
        if (idStr === sId || idStr === sFbKey) return true;
        if (sOff && idStr.toLowerCase() === sOff.toLowerCase()) return true;
        if (sOffDigits && idStr.replace(/\D/g, "") === sOffDigits) return true;
        return false;
      });
    });

    if (otherWo) {
      const zName = otherWo.zone_id || otherWo.zone || "Another Zone";
      const zoneDisplay = String(zName).replace(/-/g, " ");
      const taskName = otherWo.description || otherWo.reference_no || "Active Work Order";
      return {
        isLocked: true,
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        badgeText: `🔒 Assigned: ${zoneDisplay}`,
        reasonText: taskName,
        icon: "🔒",
        zone: zoneDisplay
      };
    }
  }

  // 5. Check Job Cards committed today
  if (mStore.jobCards && mStore.jobCards.length > 0) {
    const otherJc = mStore.jobCards.find((jc) => {
      const jKey = String(jc._fbKey || jc.id || "");
      if (currentWoId && jKey === currentWoId) return false;
      if (jc.status === "Completed" || jc.status === "Cancelled" || jc.status === "Hold") return false;
      const isCommittedToday = (jc.last_committed_date === today || jc.last_commit_date === today || jc.date === today);
      if (!isCommittedToday) return false;
      const assigned = Array.isArray(jc.assigned) ? jc.assigned : [];
      return assigned.some((id) => {
        const idStr = String(id).trim();
        if (idStr === sId || idStr === sFbKey) return true;
        if (sOff && idStr.toLowerCase() === sOff.toLowerCase()) return true;
        if (sOffDigits && idStr.replace(/\D/g, "") === sOffDigits) return true;
        return false;
      });
    });

    if (otherJc) {
      const zName = otherJc.zone_id || otherJc.zone || "Job Card";
      const zoneDisplay = String(zName).replace(/-/g, " ");
      const taskName = otherJc.description || otherJc.title || otherJc.job_card_no || "Active Job Card";
      return {
        isLocked: true,
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        badgeText: `🔒 Assigned: ${zoneDisplay}`,
        reasonText: taskName,
        icon: "🔒",
        zone: zoneDisplay
      };
    }
  }

  return {
    isLocked: false,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    badgeText: "✓ Available",
    reasonText: "Ready for assignment",
    icon: "✓"
  };
}

function showLockedSailorAlert(name, badgeText, reasonText) {
  const reason = reasonText ? ` (${reasonText})` : "";
  showToast(`⚠️ ${name} cannot be selected: ${badgeText}${reason}`, "error");
}

function toggleSailorFilterMode() {
  mStore.sailorFilterMode = mStore.sailorFilterMode === "available" ? "all" : "available";
  const btn = document.getElementById("mToggleAvailFilter");
  if (btn) {
    if (mStore.sailorFilterMode === "available") {
      btn.textContent = "Available Only";
      btn.className = "px-2.5 py-1.5 rounded-xl border text-[10px] font-bold whitespace-nowrap transition-all bg-teal-500/20 text-teal-200 border-teal-500/40 active-scale";
    } else {
      btn.textContent = "All";
      btn.className = "px-2.5 py-1.5 rounded-xl border text-[10px] font-bold whitespace-nowrap transition-all bg-slate-800 text-teal-300 border-slate-700 hover:bg-slate-700 active-scale";
    }
  }
  renderSailorQuickPicker();
}

// =============================================
// WORK ORDER DETAIL / LABOUR SHEET LOGIC
// =============================================
function populateLeaderDropdowns(filterQuery = "") {
  const inchargeSel = document.getElementById("mWoIncharge");
  const supSel = document.getElementById("mWoSupervisor");
  const artificerSel = document.getElementById("mWoArtificer");
  const badgeEl = document.getElementById("mLeaderSearchBadge");
  if (!inchargeSel || !supSel) return;

  const currentInc = inchargeSel.value;
  const currentSup = supSel.value;
  const currentArt = artificerSel ? artificerSel.value : "";

  const q = (filterQuery || "").trim().toLowerCase();

  // Filter sailors if search query is entered
  const matchedSailors = (mStore.sailors || []).filter((s) => {
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const off = (s.off_no || s.official_number || "").toLowerCase();
    const rank = (s.rank || "").toLowerCase();
    const branch = (s.trade || s.branch || "").toLowerCase();
    return name.includes(q) || off.includes(q) || rank.includes(q) || branch.includes(q);
  });

  if (badgeEl) {
    badgeEl.textContent = q ? `${matchedSailors.length} found` : "";
  }

  const buildOptions = (currentVal) => {
    const opts = ['<option value="">-- None --</option>'];

    // If currently selected sailor is not in filtered list, preserve them at the top
    if (currentVal && !matchedSailors.some((s) => String(s.id) === String(currentVal) || String(s._fbKey) === String(currentVal))) {
      const curSailor = (mStore.sailors || []).find((s) => String(s.id) === String(currentVal) || String(s._fbKey) === String(currentVal));
      if (curSailor) {
        const off = curSailor.off_no || curSailor.official_number || "";
        const label = `★ [Selected] ${curSailor.rank || ""} ${curSailor.name || curSailor.id} (${off})`.trim();
        opts.push(`<option value="${curSailor.id || curSailor._fbKey}" selected>${escapeHtml(label)}</option>`);
      } else {
        opts.push(`<option value="${currentVal}" selected>★ [Selected] ${escapeHtml(currentVal)}</option>`);
      }
    }

    matchedSailors.forEach((s) => {
      const sId = s.id || s._fbKey;
      const status = getSailorStatusToday(s, mStore.selectedWo);
      const lockTag = status.isLocked ? ` [${status.badgeText.replace(/^[^\s]+\s*/, "")}]` : "";
      const off = s.off_no || s.official_number || "";
      const branch = s.trade || s.branch || "";
      const sub = [branch, off].filter(Boolean).join(" • ");
      const subStr = sub ? ` (${sub})` : "";
      const label = `${s.rank || ""} ${s.name || s.id}${subStr}${lockTag}`.trim();
      const isSel = String(sId) === String(currentVal) ? " selected" : "";
      opts.push(`<option value="${sId}"${isSel}>${escapeHtml(label)}</option>`);
    });

    return opts.join("");
  };

  inchargeSel.innerHTML = buildOptions(currentInc);
  supSel.innerHTML = buildOptions(currentSup);
  if (artificerSel) artificerSel.innerHTML = buildOptions(currentArt);

  if (currentInc) inchargeSel.value = currentInc;
  if (currentSup) supSel.value = currentSup;
  if (artificerSel && currentArt) artificerSel.value = currentArt;
}

function filterLeaderDropdowns(val) {
  populateLeaderDropdowns(val);
  const clearBtn = document.getElementById("mLeaderSearchClear");
  if (clearBtn) {
    if (val && val.trim()) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }
}

function clearLeaderSearch() {
  const input = document.getElementById("mLeaderSearch");
  if (input) input.value = "";
  const clearBtn = document.getElementById("mLeaderSearchClear");
  if (clearBtn) clearBtn.classList.add("hidden");
  populateLeaderDropdowns("");
}

function clearIncharge() {
  const el = document.getElementById("mWoIncharge");
  if (el) el.value = "";
}

function clearSupervisor() {
  const el = document.getElementById("mWoSupervisor");
  if (el) el.value = "";
}

function clearArtificer() {
  const el = document.getElementById("mWoArtificer");
  if (el) el.value = "";
}

// =============================================
// SAILOR STATUS CACHE & SMOOTH SHEET MANAGEMENT
// =============================================
function refreshSailorStatusCache() {
  mStore.sailorStatusCache = new Map();
  const currentWo = mStore.selectedWo;
  (mStore.sailors || []).forEach((s) => {
    const key = String(s.id || s._fbKey || "");
    if (key) {
      mStore.sailorStatusCache.set(key, getSailorStatusToday(s, currentWo));
    }
  });
}

function openWoSheet(woId) {
  const wo = mStore.workOrders.find((w) => String(w._fbKey) === String(woId) || String(w.id) === String(woId));
  if (!wo) return;

  mStore.selectedWo = wo;
  const targetDate = getSelectedDate();
  const today = getLocalDateString();
  const isBackDate = targetDate !== today;

  // Load crew allocated or planned for this date
  mStore.assignedTemp = getWorkOrderCrewForDate(wo, targetDate);
  if (mStore.assignedTemp.length === 0 && !isBackDate) {
    const createdDate = getWorkOrderCreatedDate(wo);
    const isSingleDay = (wo.type === "TASK" || Boolean(wo.assign_type) || isAssignmentItem(wo) || wo.type === "ASSIGNMENT");
    if (!isSingleDay || createdDate === today) {
      mStore.assignedTemp = Array.isArray(wo.assigned) ? [...wo.assigned] : [];
    }
  }

  const titleEl = document.getElementById("mSheetTitle");
  const descEl = document.getElementById("mWoDesc");
  if (titleEl) titleEl.textContent = isBackDate ? `${wo.description || "Work Order"} (${targetDate})` : (wo.description || "Work Order");
  if (descEl) descEl.value = wo.description || "";

  const prog = Math.min(100, Math.max(0, parseInt(wo.progress) || 0));
  const progInput = document.getElementById("mProgressInput");
  const progVal = document.getElementById("mProgressVal");
  if (progInput) progInput.value = prog;
  if (progVal) progVal.textContent = `${prog}%`;

  if (document.getElementById("mWoStatus")) document.getElementById("mWoStatus").value = wo.status || "Active";
  if (document.getElementById("mWoPriority")) document.getElementById("mWoPriority").value = wo.priority || "Routine";

  const zoneBadge = document.getElementById("mSheetZoneBadge");
  if (zoneBadge) zoneBadge.textContent = String(wo.zone_id || wo.zone || mStore.currentZone).replace(/-/g, " ");

  const statusBadge = document.getElementById("mSheetStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = wo.status || "Active";
    statusBadge.className = wo.status === "Completed"
      ? "inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30"
      : wo.status === "Hold"
        ? "inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30"
        : "inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  }

  // Toggle Progress Section: Only show for Work Orders, hide for Assignments!
  const isAssign = isAssignmentItem(wo);
  const progSection = document.getElementById("mProgressSection");
  if (progSection) {
    if (isAssign) {
      progSection.classList.add("hidden");
    } else {
      progSection.classList.remove("hidden");
    }
  }

  // Budget and Authority
  if (document.getElementById("mWoAuthority")) document.getElementById("mWoAuthority").value = wo.authority_approval || wo.authority || "";
  if (document.getElementById("mWoBudget")) document.getElementById("mWoBudget").value = wo.budget_allocation || "";
  if (document.getElementById("mWoDuration")) document.getElementById("mWoDuration").value = wo.estimated_duration || "";

  // Reset leader search
  const leaderSearchInput = document.getElementById("mLeaderSearch");
  if (leaderSearchInput) leaderSearchInput.value = "";
  const leaderSearchClear = document.getElementById("mLeaderSearchClear");
  if (leaderSearchClear) leaderSearchClear.classList.add("hidden");
  const leaderSearchBadge = document.getElementById("mLeaderSearchBadge");
  if (leaderSearchBadge) leaderSearchBadge.textContent = "";

  populateLeaderDropdowns();
  if (document.getElementById("mWoIncharge")) document.getElementById("mWoIncharge").value = wo.incharge || "";
  if (document.getElementById("mWoSupervisor")) document.getElementById("mWoSupervisor").value = wo.supervisor || "";
  if (document.getElementById("mWoArtificer")) document.getElementById("mWoArtificer").value = wo.project_artificer || "";

  // Reset search box
  const searchInput = document.getElementById("mSailorSearch");
  if (searchInput) searchInput.value = "";
  const searchClear = document.getElementById("mSailorSearchClear");
  if (searchClear) searchClear.classList.add("hidden");

  // Pre-calculate status cache once for this sheet session
  refreshSailorStatusCache();

  renderAssignedTags();
  renderSailorQuickPicker();

  // Safeguard Commit button when viewing historical back-dates
  const btnProceed = document.getElementById("mBtnProceed");
  if (btnProceed) {
    if (isBackDate) {
      btnProceed.disabled = true;
      btnProceed.innerHTML = `<span>📜</span> Historical Record (${targetDate})`;
      btnProceed.classList.add("opacity-60", "cursor-not-allowed");
    } else {
      btnProceed.disabled = false;
      btnProceed.innerHTML = `<span>🚀</span> Commit Daily Labour`;
      btnProceed.classList.remove("opacity-60", "cursor-not-allowed");
    }
  }

  const sheet = document.getElementById("mWoSheet");
  if (sheet) {
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => {
      sheet.classList.remove("sheet-hidden");
    });
    document.body.style.overflow = "hidden";
  }
}

function openNewWoSheet() {
  const blankWo = {
    id: null,
    _fbKey: null,
    isNew: true,
    description: "",
    progress: 0,
    status: "Active",
    priority: "Routine",
    zone_id: mStore.currentZone,
    type: "WORK_ORDER",
    assigned: [],
    last_assigned: []
  };

  mStore.selectedWo = blankWo;
  mStore.assignedTemp = [];

  const titleEl = document.getElementById("mSheetTitle");
  const descEl = document.getElementById("mWoDesc");
  if (titleEl) titleEl.textContent = "➕ New Work Order";
  if (descEl) {
    descEl.value = "";
    descEl.placeholder = "Enter work order title / description...";
  }

  // Show progress section for Work Orders
  const progSection = document.getElementById("mProgressSection");
  if (progSection) progSection.classList.remove("hidden");

  const progInput = document.getElementById("mProgressInput");
  const progVal = document.getElementById("mProgressVal");
  if (progInput) progInput.value = 0;
  if (progVal) progVal.textContent = "0%";

  if (document.getElementById("mWoStatus")) document.getElementById("mWoStatus").value = "Active";
  if (document.getElementById("mWoPriority")) document.getElementById("mWoPriority").value = "Routine";

  const zoneBadge = document.getElementById("mSheetZoneBadge");
  if (zoneBadge) zoneBadge.textContent = String(mStore.currentZone).replace(/-/g, " ");

  const statusBadge = document.getElementById("mSheetStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = "NEW WO";
    statusBadge.className = "inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30";
  }

  if (document.getElementById("mWoAuthority")) document.getElementById("mWoAuthority").value = "";
  if (document.getElementById("mWoBudget")) document.getElementById("mWoBudget").value = "";
  if (document.getElementById("mWoDuration")) document.getElementById("mWoDuration").value = "1";

  // Reset leader search
  const leaderSearchInput = document.getElementById("mLeaderSearch");
  if (leaderSearchInput) leaderSearchInput.value = "";
  const leaderSearchClear = document.getElementById("mLeaderSearchClear");
  if (leaderSearchClear) leaderSearchClear.classList.add("hidden");
  const leaderSearchBadge = document.getElementById("mLeaderSearchBadge");
  if (leaderSearchBadge) leaderSearchBadge.textContent = "";

  populateLeaderDropdowns();
  if (document.getElementById("mWoIncharge")) document.getElementById("mWoIncharge").value = "";
  if (document.getElementById("mWoSupervisor")) document.getElementById("mWoSupervisor").value = "";
  if (document.getElementById("mWoArtificer")) document.getElementById("mWoArtificer").value = "";

  const searchInput = document.getElementById("mSailorSearch");
  if (searchInput) searchInput.value = "";
  const searchClear = document.getElementById("mSailorSearchClear");
  if (searchClear) searchClear.classList.add("hidden");

  refreshSailorStatusCache();
  renderAssignedTags();
  renderSailorQuickPicker();

  const sheet = document.getElementById("mWoSheet");
  if (sheet) {
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => {
      sheet.classList.remove("sheet-hidden");
    });
    document.body.style.overflow = "hidden";
  }
}

function openNewAssignSheet() {
  const isAdminStaff = isAdminStaffDuties(mStore.currentZone);
  const defaultAssignType = isAdminStaff ? "Admin Staff" : "In Charge";
  const defaultDesc = isAdminStaff ? "" : "In Charge";

  const blankAssign = {
    id: null,
    _fbKey: null,
    isNew: true,
    description: defaultDesc,
    progress: 0,
    status: "Active",
    priority: "Routine",
    zone_id: mStore.currentZone,
    type: "TASK",
    assign_type: defaultAssignType,
    assigned: [],
    last_assigned: []
  };

  mStore.selectedWo = blankAssign;
  mStore.assignedTemp = [];

  const titleEl = document.getElementById("mSheetTitle");
  const descEl = document.getElementById("mWoDesc");
  if (titleEl) titleEl.textContent = `➕ New Assignment (${defaultAssignType})`;
  if (descEl) {
    descEl.value = defaultDesc;
    descEl.placeholder = isAdminStaff ? "Describe Admin Staff work..." : "Assignment Description (e.g. In Charge, Standby, Base Duty)...";
  }

  // Hide progress section for Assignments (No progress bar!)
  const progSection = document.getElementById("mProgressSection");
  if (progSection) progSection.classList.add("hidden");

  const progInput = document.getElementById("mProgressInput");
  const progVal = document.getElementById("mProgressVal");
  if (progInput) progInput.value = 0;
  if (progVal) progVal.textContent = "0%";

  if (document.getElementById("mWoStatus")) document.getElementById("mWoStatus").value = "Active";
  if (document.getElementById("mWoPriority")) document.getElementById("mWoPriority").value = "Routine";

  const zoneBadge = document.getElementById("mSheetZoneBadge");
  if (zoneBadge) zoneBadge.textContent = String(mStore.currentZone).replace(/-/g, " ");

  const statusBadge = document.getElementById("mSheetStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = "ASSIGN";
    statusBadge.className = "inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
  }

  if (document.getElementById("mWoAuthority")) document.getElementById("mWoAuthority").value = "";
  if (document.getElementById("mWoBudget")) document.getElementById("mWoBudget").value = "";
  if (document.getElementById("mWoDuration")) document.getElementById("mWoDuration").value = "1";

  // Reset leader search
  const leaderSearchInput = document.getElementById("mLeaderSearch");
  if (leaderSearchInput) leaderSearchInput.value = "";
  const leaderSearchClear = document.getElementById("mLeaderSearchClear");
  if (leaderSearchClear) leaderSearchClear.classList.add("hidden");
  const leaderSearchBadge = document.getElementById("mLeaderSearchBadge");
  if (leaderSearchBadge) leaderSearchBadge.textContent = "";

  populateLeaderDropdowns();
  if (document.getElementById("mWoIncharge")) document.getElementById("mWoIncharge").value = "";
  if (document.getElementById("mWoSupervisor")) document.getElementById("mWoSupervisor").value = "";
  if (document.getElementById("mWoArtificer")) document.getElementById("mWoArtificer").value = "";

  const searchInput = document.getElementById("mSailorSearch");
  if (searchInput) searchInput.value = "";
  const searchClear = document.getElementById("mSailorSearchClear");
  if (searchClear) searchClear.classList.add("hidden");

  refreshSailorStatusCache();
  renderAssignedTags();
  renderSailorQuickPicker();

  const sheet = document.getElementById("mWoSheet");
  if (sheet) {
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => {
      sheet.classList.remove("sheet-hidden");
    });
    document.body.style.overflow = "hidden";
  }
}

// Quick 1-Tap Commit Directly From Outside Card
function commitQuickFromCard(event, woId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (!opsDB) {
    showToast("Database not connected", "error");
    return;
  }

  const wo = mStore.workOrders.find((w) => String(w._fbKey) === String(woId) || String(w.id) === String(woId));
  if (!wo) return;

  const today = getLocalDateString();

  // Effective sailors
  let crew = Array.isArray(wo.assigned) && wo.assigned.length > 0
    ? [...wo.assigned]
    : (Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0 ? [...wo.last_assigned] : []);

  if (crew.length === 0) {
    showToast("No planned sailors found for this task!", "warning");
    return;
  }

  // Filter out sailors who are on Leave or Sick today
  const activeSailorsToCommit = crew.filter((sid) => {
    const s = mStore.sailors.find((sailor) => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid));
    if (!s) return true;
    const st = (mStore.sailorStatusCache && mStore.sailorStatusCache.has(String(s.id || s._fbKey)))
      ? mStore.sailorStatusCache.get(String(s.id || s._fbKey))
      : getSailorStatusToday(s, wo);
    return !(st.isLocked && (st.badgeText.includes("Sick") || st.badgeText.includes("Leave")));
  });

  if (activeSailorsToCommit.length === 0) {
    showToast("All assigned sailors are on leave/sick today!", "error");
    return;
  }

  wo.last_commit_date = today;
  wo.last_committed_date = today;
  wo.last_assigned = [...crew];
  wo.last_assigned_date = today;
  wo.assigned = [...crew];

  const targetFbKey = wo._fbKey || wo.id;
  opsDB.ref(`work_orders/${targetFbKey}`).update({
    last_commit_date: today,
    last_committed_date: today,
    last_assigned: [...crew],
    last_assigned_date: today,
    assigned: crew
  }).then(() => {
    // Write daily allocations for each sailor
    activeSailorsToCommit.forEach((sid) => {
      const sailor = mStore.sailors.find((s) => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
      const alloc = {
        id: (mStore.dailyAllocations || []).length + 1,
        date: today,
        sailor_id: sid,
        work_order_id: wo.id,
        role_today: (sailor && sailor.id == wo.supervisor) ? "Supervisor" : ((sailor && sailor.id == wo.incharge) ? "In-Charge" : "Worker"),
        assigned_by: mStore.currentUser.name,
        status: "Active"
      };
      opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`).set(alloc);
    });

    navigator.vibrate?.([20, 50, 20]);
    showToast(`⚡ Committed daily labour (${activeSailorsToCommit.length} sailors) for "${(wo.description || 'Task').substring(0, 22)}…"`, "success");
    renderWorkOrders();
    updateZoneSailorStats();
  }).catch((err) => {
    showToast("Failed to commit: " + err.message, "error");
  });
}

function closeWoSheet() {
  const sheet = document.getElementById("mWoSheet");
  if (sheet) {
    sheet.classList.add("sheet-hidden");
    setTimeout(() => {
      sheet.classList.add("hidden");
    }, 280);
    document.body.style.overflow = "";
  }
  mStore.selectedWo = null;
}

function handleBackdropClick(event) {
  if (event.target && event.target.id === "mWoSheet") {
    closeWoSheet();
  }
}

function appendQuickNote(note) {
  const descEl = document.getElementById("mWoDesc");
  if (!descEl) return;
  const current = descEl.value.trim();
  if (!current) {
    descEl.value = note;
  } else {
    descEl.value = current + " - " + note;
  }
  navigator.vibrate?.(10);
}

function adjustProgress(delta) {
  const current = parseInt(document.getElementById("mProgressInput")?.value) || 0;
  const nextVal = Math.min(100, Math.max(0, current + delta));
  onProgressChange(nextVal);
  navigator.vibrate?.(10);
}

function onProgressChange(val) {
  const p = parseInt(val) || 0;
  const progInput = document.getElementById("mProgressInput");
  const progVal = document.getElementById("mProgressVal");
  if (progInput) progInput.value = p;
  if (progVal) progVal.textContent = `${p}%`;
}

// Assigned Tags Rendering
function renderAssignedTags() {
  const container = document.getElementById("mAssignedTags");
  const countBadge = document.getElementById("mAssignedCountBadge");
  if (!container) return;

  const count = mStore.assignedTemp.length;
  if (countBadge) countBadge.textContent = `${count} sailor${count === 1 ? "" : "s"}`;

  if (count === 0) {
    container.innerHTML = `<span class="text-slate-500 text-[11px] italic py-0.5">No sailors assigned yet</span>`;
    return;
  }

  container.innerHTML = mStore.assignedTemp.map((sid) => {
    const s = mStore.sailors.find((x) => String(x.id) === String(sid) || String(x._fbKey) === String(sid));
    const off = s ? (s.off_no || s.official_number || "") : "";
    const name = s ? `${s.rank || ""} ${s.name || sid}${off ? ` (${off})` : ""}`.trim() : sid;
    return `
      <span class="inline-flex items-center gap-1 bg-teal-500/20 text-teal-200 border border-teal-500/40 text-xs font-semibold px-2 py-1 rounded-xl shadow-sm">
        <span>${name}</span>
        <button type="button" onclick="removeSailorFromSheet('${sid}')" class="text-teal-400 hover:text-rose-400 font-bold px-1 active-scale" title="Remove">✕</button>
      </span>`;
  }).join("");
}

function clearCrewInSheet() {
  if (!mStore.assignedTemp || mStore.assignedTemp.length === 0) return;
  mStore.assignedTemp = [];
  navigator.vibrate?.(10);
  renderAssignedTags();
  renderSailorQuickPicker();
  showToast("Cleared assigned crew", "info");
}

function addAllAvailableInZone() {
  const currentZone = mStore.currentZone;
  let candidates = mStore.sailors.filter((s) => {
    const z = s.zone_assigned || s.zone || s.location_zone;
    return z && isZoneMatch(z, currentZone);
  });

  if (candidates.length === 0) {
    candidates = mStore.sailors;
  }

  let addedCount = 0;
  candidates.forEach((s) => {
    const sid = String(s.id || s._fbKey || "");
    if (!sid || mStore.assignedTemp.includes(sid)) return;

    const status = (mStore.sailorStatusCache && mStore.sailorStatusCache.has(sid))
      ? mStore.sailorStatusCache.get(sid)
      : getSailorStatusToday(s, mStore.selectedWo);

    if (!status.isLocked) {
      mStore.assignedTemp.push(sid);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    navigator.vibrate?.(15);
    renderAssignedTags();
    renderSailorQuickPicker();
    showToast(`⚡ Added ${addedCount} available sailor(s) to crew`);
  } else {
    showToast("No additional available sailors found for this zone", "info");
  }
}

function clearSailorSearch() {
  const input = document.getElementById("mSailorSearch");
  if (input) {
    input.value = "";
    input.focus();
  }
  const clearBtn = document.getElementById("mSailorSearchClear");
  if (clearBtn) clearBtn.classList.add("hidden");
  renderSailorQuickPicker();
}

let _sailorSearchDebounce = null;
function filterSailorsForAssignment() {
  const input = document.getElementById("mSailorSearch");
  const clearBtn = document.getElementById("mSailorSearchClear");
  if (clearBtn && input) {
    clearBtn.classList.toggle("hidden", !input.value.trim());
  }

  clearTimeout(_sailorSearchDebounce);
  _sailorSearchDebounce = setTimeout(() => {
    renderSailorQuickPicker();
  }, 70);
}

function renderSailorQuickPicker() {
  const container = document.getElementById("mSailorQuickPicker");
  const poolCountEl = document.getElementById("mSailorPoolCount");
  if (!container) return;

  const q = (document.getElementById("mSailorSearch")?.value || "").toLowerCase().trim();
  const qClean = q.replace(/[^a-z0-9]/g, "");
  const qDigits = q.replace(/\D/g, "");

  // 1. Filter out sailors already assigned to this current sheet
  const candidates = mStore.sailors.filter((s) => {
    const isAlreadyAssigned = mStore.assignedTemp.includes(String(s.id)) || mStore.assignedTemp.includes(String(s._fbKey));
    return !isAlreadyAssigned;
  });

  // 2. Attach live status for today from O(1) Cache
  let availableCount = 0;
  let lockedCount = 0;

  const evaluated = candidates.map((s) => {
    const sKey = String(s.id || s._fbKey || "");
    const status = (mStore.sailorStatusCache && mStore.sailorStatusCache.has(sKey))
      ? mStore.sailorStatusCache.get(sKey)
      : getSailorStatusToday(s, mStore.selectedWo);

    if (status.isLocked) {
      lockedCount++;
    } else {
      availableCount++;
    }
    return { sailor: s, status };
  });

  if (poolCountEl) {
    poolCountEl.innerHTML = `<span class="text-emerald-400 font-bold">🟢 ${availableCount}</span> • <span class="text-rose-400 font-bold">🔒 ${lockedCount}</span>`;
  }

  // 3. Filter by search and filter mode
  const filtered = evaluated.filter(({ sailor: s, status }) => {
    if (mStore.sailorFilterMode === "available" && status.isLocked) return false;
    if (!q) return true;

    const name = (s.name || "").toLowerCase();
    const rank = (s.rank || "").toLowerCase();
    const trade = (s.trade || s.branch || s.rate || "").toLowerCase();
    const offRaw = String(s.off_no || s.official_number || s.official_no || s.service_no || "").toLowerCase();
    const offClean = offRaw.replace(/[^a-z0-9]/g, "");
    const offDigits = offRaw.replace(/\D/g, "");
    const zone = (status.zone || "").toLowerCase();
    const reason = (status.reasonText || "").toLowerCase();

    return (
      name.includes(q) ||
      rank.includes(q) ||
      trade.includes(q) ||
      offRaw.includes(q) ||
      (qClean && offClean.includes(qClean)) ||
      (qDigits && offDigits.includes(qDigits)) ||
      zone.includes(q) ||
      reason.includes(q)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-500 text-[11px] font-semibold">No matching sailors found</div>`;
    return;
  }

  // 4. Sort: Available first, locked at bottom, then alphabetical
  filtered.sort((a, b) => {
    if (!a.status.isLocked && b.status.isLocked) return -1;
    if (a.status.isLocked && !b.status.isLocked) return 1;
    return (a.sailor.name || "").localeCompare(b.sailor.name || "");
  });

  // 5. Render list items (capped to 60 for ultra smooth rendering)
  container.innerHTML = filtered.slice(0, 60).map(({ sailor: s, status }) => {
    const sid = s.id || s._fbKey;
    const label = `${s.rank || ""} ${s.name || s.id}`.trim();
    const branch = s.trade || s.branch || s.rate || "Sailor";
    const offNo = s.off_no || s.official_number || s.official_no || s.service_no || "";
    const metaDisplay = offNo ? `${branch} • ${offNo}` : branch;

    if (status.isLocked) {
      const safeName = (s.name || s.id).replace(/'/g, "\\'");
      const safeBadge = (status.badgeText || "Locked").replace(/'/g, "\\'");
      const safeReason = (status.reasonText || "").replace(/'/g, "\\'");
      return `
        <div onclick="showLockedSailorAlert('${safeName}', '${safeBadge}', '${safeReason}')" class="p-2.5 flex items-center justify-between bg-slate-950/50 opacity-65 border-l-2 border-l-rose-500/80 cursor-not-allowed select-none transition-all">
          <div class="flex-1 min-w-0 pr-2">
            <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <p class="text-xs font-semibold text-slate-300 leading-tight">${label}</p>
              <span class="text-[9px] font-bold ${status.badgeClass} px-1.5 py-0.5 rounded border flex items-center gap-0.5">
                ${status.badgeText}
              </span>
            </div>
            <p class="text-[10px] text-slate-500 font-mono">${metaDisplay}</p>
            ${status.reasonText ? `<p class="text-[9px] text-slate-400/90 truncate max-w-[240px] mt-0.5 font-sans">📌 ${status.reasonText}</p>` : ""}
          </div>
          <div class="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 border border-slate-700/80 text-xs font-bold flex items-center justify-center shrink-0 shadow-inner" title="Locked - Already assigned or unavailable">
            🔒
          </div>
        </div>`;
    }

    return `
      <div onclick="addSailorToSheet('${sid}')" class="p-2.5 flex items-center justify-between hover:bg-slate-800/80 active-scale cursor-pointer bg-slate-900/30 transition-colors">
        <div class="flex-1 min-w-0 pr-2">
          <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <p class="text-xs font-bold text-white leading-tight">${label}</p>
            <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
              ✓ Available
            </span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono">${metaDisplay}</p>
        </div>
        <button type="button" class="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500 hover:text-white text-sm font-black flex items-center justify-center shrink-0 transition-all shadow-sm">
          +
        </button>
      </div>`;
  }).join("");
}

function addSailorToSheet(sid) {
  const sailor = mStore.sailors.find((s) => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
  if (sailor) {
    const sKey = String(sailor.id || sailor._fbKey || "");
    const status = (mStore.sailorStatusCache && mStore.sailorStatusCache.has(sKey))
      ? mStore.sailorStatusCache.get(sKey)
      : getSailorStatusToday(sailor, mStore.selectedWo);

    if (status.isLocked) {
      showLockedSailorAlert(sailor.name || sid, status.badgeText, status.reasonText);
      return;
    }
  }

  const idStr = String(sid);
  if (!mStore.assignedTemp.includes(idStr)) {
    mStore.assignedTemp.push(idStr);
    navigator.vibrate?.(10);
    renderAssignedTags();
    renderSailorQuickPicker();
  }
}

function removeSailorFromSheet(sid) {
  const idStr = String(sid);
  mStore.assignedTemp = mStore.assignedTemp.filter((x) => x !== idStr);
  navigator.vibrate?.(10);
  renderAssignedTags();
  renderSailorQuickPicker();
}

function restoreCrewInSheet() {
  const wo = mStore.selectedWo;
  if (!wo) return;
  if (wo.last_assigned && Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0) {
    mStore.assignedTemp = [...wo.last_assigned];
    navigator.vibrate?.(12);
    renderAssignedTags();
    renderSailorQuickPicker();
    showToast(`Restored last crew (${wo.last_assigned.length} sailors)`);
  } else {
    showToast("No previous crew recorded for this work order", "info");
  }
}

// =============================================
// COMMIT & PROCEED WORK ORDER
// =============================================
function saveWoSheet(shouldClose = true) {
  const wo = mStore.selectedWo;
  if (!wo || !opsDB) return;

  const btn = document.getElementById("mBtnSaveOnly");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  const today = getLocalDateString();
  const desc = document.getElementById("mWoDesc").value.trim() || wo.description || "New Task";
  const progress = parseInt(document.getElementById("mProgressInput").value) || 0;
  const status = document.getElementById("mWoStatus").value;
  const priority = document.getElementById("mWoPriority").value;
  const zoneVal = document.getElementById("mWoSheetZone")?.value || wo.zone_id || mStore.currentZone;
  const incharge = document.getElementById("mWoIncharge").value || null;
  const supervisor = document.getElementById("mWoSupervisor").value || null;
  const artificer = document.getElementById("mWoArtificer")?.value || null;
  const authority = document.getElementById("mWoAuthority")?.value || null;
  const budget = parseFloat(document.getElementById("mWoBudget")?.value) || null;
  const duration = parseInt(document.getElementById("mWoDuration")?.value) || null;

  wo.description = desc;
  wo.progress = progress;
  wo.status = status;
  wo.priority = priority;
  wo.zone_id = zoneVal;
  wo.incharge = incharge;
  wo.supervisor = supervisor;
  wo.project_artificer = artificer;
  wo.authority_approval = authority;
  wo.budget_allocation = budget;
  wo.estimated_duration = duration;
  wo.assigned = [...mStore.assignedTemp];

  let savePromise;
  if (wo.isNew) {
    const newRef = opsDB.ref("work_orders").push();
    wo.id = newRef.key;
    wo._fbKey = newRef.key;
    wo.isNew = false;
    wo.type = "TASK";
    wo.created_date = today;
    wo.created_by = mStore.currentUser.name;
    savePromise = newRef.set({
      description: desc,
      progress: progress,
      status: status,
      priority: priority,
      zone_id: zoneVal,
      type: "TASK",
      incharge: incharge,
      supervisor: supervisor,
      project_artificer: artificer,
      authority_approval: authority,
      budget_allocation: budget,
      estimated_duration: duration,
      created_date: today,
      created_by: mStore.currentUser.name,
      assigned: wo.assigned.length > 0 ? wo.assigned : null
    });
  } else {
    const targetFbKey = wo._fbKey || wo.id;
    savePromise = opsDB.ref(`work_orders/${targetFbKey}`).update({
      description: desc,
      progress: progress,
      status: status,
      priority: priority,
      zone_id: zoneVal,
      incharge: incharge,
      supervisor: supervisor,
      project_artificer: artificer,
      authority_approval: authority,
      budget_allocation: budget,
      estimated_duration: duration,
      assigned: wo.assigned.length > 0 ? wo.assigned : null
    });
  }

  savePromise.then(() => {
    navigator.vibrate?.(15);
    showToast("Work order saved successfully!");
    if (shouldClose) closeWoSheet();
    renderWorkOrders();
  }).catch((err) => {
    showToast("Failed to save: " + err.message, "error");
  }).finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Save";
    }
  });
}

function proceedWoSheet() {
  const wo = mStore.selectedWo;
  if (!wo || !opsDB) return;

  const btn = document.getElementById("mBtnProceed");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin">⏳</span> Committing...`;
  }

  // Auto-restore crew if empty and last_assigned exists
  if ((!mStore.assignedTemp || mStore.assignedTemp.length === 0) && wo.last_assigned && wo.last_assigned.length > 0) {
    mStore.assignedTemp = [...wo.last_assigned];
    renderAssignedTags();
  }

  if (!mStore.assignedTemp || mStore.assignedTemp.length === 0) {
    showToast("Please assign at least one sailor before proceeding!", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>🚀</span> Commit Daily Labour`;
    }
    return;
  }

  const today = getLocalDateString();
  const desc = document.getElementById("mWoDesc").value.trim() || wo.description || "New Task";
  const progress = parseInt(document.getElementById("mProgressInput").value) || 0;
  const status = document.getElementById("mWoStatus").value;
  const priority = document.getElementById("mWoPriority").value;
  const zoneVal = document.getElementById("mWoSheetZone")?.value || wo.zone_id || mStore.currentZone;
  const incharge = document.getElementById("mWoIncharge").value || null;
  const supervisor = document.getElementById("mWoSupervisor").value || null;
  const artificer = document.getElementById("mWoArtificer")?.value || null;
  const authority = document.getElementById("mWoAuthority")?.value || null;
  const budget = parseFloat(document.getElementById("mWoBudget")?.value) || null;
  const duration = parseInt(document.getElementById("mWoDuration")?.value) || null;

  wo.description = desc;
  wo.progress = progress;
  if (status !== "Hold" && status !== "Completed") {
    wo.status = "Active";
  } else {
    wo.status = status;
  }
  wo.priority = priority;
  wo.zone_id = zoneVal;
  wo.incharge = incharge;
  wo.supervisor = supervisor;
  wo.project_artificer = artificer;
  wo.authority_approval = authority;
  wo.budget_allocation = budget;
  wo.estimated_duration = duration;
  wo.last_commit_date = today;
  wo.last_committed_date = today;
  wo.last_assigned = [...mStore.assignedTemp];
  wo.last_assigned_date = today;
  wo.assigned = [...mStore.assignedTemp];

  let savePromise;
  if (wo.isNew) {
    const newRef = opsDB.ref("work_orders").push();
    wo.id = newRef.key;
    wo._fbKey = newRef.key;
    wo.isNew = false;
    wo.type = "TASK";
    wo.created_date = today;
    wo.created_by = mStore.currentUser.name;
    savePromise = newRef.set({
      description: desc,
      progress: progress,
      status: wo.status,
      priority: priority,
      zone_id: zoneVal,
      type: "TASK",
      incharge: incharge,
      supervisor: supervisor,
      project_artificer: artificer,
      authority_approval: authority,
      budget_allocation: budget,
      estimated_duration: duration,
      created_date: today,
      created_by: mStore.currentUser.name,
      last_commit_date: today,
      last_committed_date: today,
      last_assigned: [...wo.assigned],
      last_assigned_date: today,
      assigned: wo.assigned
    });
  } else {
    const targetFbKey = wo._fbKey || wo.id;
    savePromise = opsDB.ref(`work_orders/${targetFbKey}`).update({
      description: desc,
      progress: progress,
      status: wo.status,
      priority: priority,
      zone_id: zoneVal,
      incharge: incharge,
      supervisor: supervisor,
      project_artificer: artificer,
      authority_approval: authority,
      budget_allocation: budget,
      estimated_duration: duration,
      last_commit_date: today,
      last_committed_date: today,
      last_assigned: [...wo.assigned],
      last_assigned_date: today,
      assigned: wo.assigned
    });
  }

  savePromise.then(() => {
    // Write Today's Daily Allocations for each sailor
    wo.assigned.forEach((sid) => {
      const sailor = mStore.sailors.find((s) => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
      const alloc = {
        id: (mStore.dailyAllocations || []).length + 1,
        date: today,
        sailor_id: sid,
        work_order_id: wo.id,
        role_today:
          sailor && sailor.id == wo.supervisor
            ? "Supervisor"
            : sailor && sailor.id == wo.incharge
              ? "In-Charge"
              : "Worker",
        assigned_by: mStore.currentUser.name,
        status: "Active"
      };

      opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`).set(alloc);
    });

    navigator.vibrate?.([20, 50, 20]);
    closeWoSheet();
    renderWorkOrders();
    showToast(`✅ ${wo.assigned.length} sailor(s) committed to "${wo.description.substring(0, 20)}…"`, "success");
  }).catch((err) => {
    showToast("Failed to commit: " + err.message, "error");
  }).finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>🚀</span> Commit Daily Labour`;
    }
  });
}

// =============================================
// DAILY LABOUR DEPLOYMENT REPORT (PRINT / PDF)
// Parity with main admin panel Naval CE Daily LMD
// =============================================
function printMobileLmdReport() {
  const targetZone = mStore.currentZone || "A-Zone";
  const targetDate = getSelectedDate();
  const zoneObj = mStore.zones.find((z) => isZoneMatch(z.id, targetZone));
  const zoneDisplayName = zoneObj ? zoneObj.name : targetZone;

  // Filter tasks in this zone active on targetDate
  const allWorks = (mStore.workOrders || []).filter(
    (w) => isZoneMatch(w.zone_id || w.zone, targetZone) && isWorkOrderActiveOnDate(w, targetDate)
  );

  let rowsHtml = "";
  let totalSailorsCount = 0;

  allWorks.forEach((wo) => {
    const crewIds = getWorkOrderCrewForDate(wo, targetDate);
    if (!crewIds || crewIds.length === 0) return;

    const workTitle = (wo.description || wo.title || wo.reference_no || "Active Task").trim();
    rowsHtml += `
      <tr style="background-color: #f1f5f9; font-weight: bold;">
        <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
          📋 ${escapeHtml(workTitle.toUpperCase())}
        </td>
      </tr>
    `;

    crewIds.forEach((sid, idx) => {
      totalSailorsCount++;
      const s = mStore.sailors.find(
        (sailor) => String(sailor.id) === String(sid) || String(sailor._fbKey) === String(sid) || String(sailor.off_no || sailor.official_number || "").toLowerCase() === String(sid).toLowerCase()
      ) || { rank: "AB", name: `Sailor (${sid})`, trade: "—", official_number: sid };

      const parsed = parseOfficialNumber(s.off_no || s.official_number || s.service_no || "");
      rowsHtml += `
        <tr>
          <td style="text-align:center;">${String(idx + 1).padStart(2, "0")}</td>
          <td>${escapeHtml(s.rank || "AB")}</td>
          <td>${escapeHtml(s.name || "")}</td>
          <td style="text-align:center;">${escapeHtml(parsed.type)}</td>
          <td>${escapeHtml(parsed.num)}</td>
          <td style="text-align:center;">${escapeHtml(s.trade || s.branch || "—")}</td>
        </tr>
      `;
    });
  });

  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding: 25px; color: #64748b; font-size: 12px;">No sailor allocations recorded for ${escapeHtml(zoneDisplayName)} on ${targetDate}.</td></tr>`;
  }

  const crestUrl = window.location.href.split("?")[0].split("#")[0].replace("mobile.html", "").replace("index.html", "") + "logo.png";

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Daily Details - ${zoneDisplayName} (${targetDate})</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 20px; }
        .header-container { display: flex; align-items: center; justify-content: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
        .logo-img { height: 65px; margin-right: 18px; }
        .header-text { text-align: left; }
        .header-text h1 { font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .header-text h2 { font-size: 11px; font-weight: 700; color: #475569; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .meta-section { display: flex; justify-content: space-between; font-size: 10px; color: #334155; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; }
        .meta-left { font-weight: bold; line-height: 1.5; }
        .meta-right { text-align: right; line-height: 1.5; }
        
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 10px; }
        th, td { border: 1px solid #94a3b8; padding: 7px 9px; text-align: left; vertical-align: middle; }
        th { background: #f1f5f9; color: #1e293b; font-weight: bold; text-transform: uppercase; font-size: 10px; }
        
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid; }
        .sig-block { text-align: center; width: 220px; }
        .sig-block p { margin: 2px 0; }
        
        .footer { margin-top: 30px; font-size: 9px; color: #64748b; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print { 
          @page { size: A4; margin: 12mm; } 
          body { padding: 0; }
          .meta-section { background: none; border-color: #94a3b8; }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <img class="logo-img" src="${crestUrl}" alt="SLN Crest" onerror="this.style.display='none'">
        <div class="header-text">
          <h1>Sri Lanka Navy</h1>
          <h2>Captain Civil Engineering Department (E)</h2>
        </div>
      </div>
      
      <div class="meta-section">
        <div class="meta-left">
          <div>REPORT: DAILY LABOUR DEPLOYMENT SHEET (LMD)</div>
          <div>ZONE / WORKSHOP: ${escapeHtml(zoneDisplayName.toUpperCase())}</div>
          <div>TOTAL SAILORS ALLOCATED: ${totalSailorsCount}</div>
        </div>
        <div class="meta-right">
          <div>DEPLOYMENT DATE: ${targetDate}</div>
          <div>GENERATED BY: CMSys Mobile Quick Portal</div>
          <div>PRINT TIME: ${new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 8%; text-align:center;">Ser No</th>
            <th style="width: 14%;">Rank</th>
            <th style="width: 36%;">Name</th>
            <th style="width: 14%; text-align:center;">Service Type</th>
            <th style="width: 14%;">Service No</th>
            <th style="width: 14%; text-align:center;">Trade</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      
      <div class="signature-section">
        <div class="sig-block">
          <p>..................................................</p>
          <p style="font-weight: bold;">PREPARED BY - LME</p>
        </div>
        <div class="sig-block">
          <p>..................................................</p>
          <p style="font-weight: bold;">CHECKED BY (S/S INCHARGE)</p>
        </div>
        <div class="sig-block">
          <p>..................................................</p>
          <p style="font-weight: bold;">OFFICER IN CHARGE</p>
        </div>
      </div>

      <div class="footer">Generated by Sri Lanka Navy Civil Engineering CMSys • ${new Date().toLocaleString()}</div>
    </body>
    </html>
  `;

  // Attempt window.open first
  let printWin = null;
  try {
    printWin = window.open("", "_blank");
  } catch (e) {
    printWin = null;
  }

  if (printWin) {
    printWin.document.open();
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try {
        printWin.print();
      } catch (err) {
        console.warn("Print window error:", err);
      }
    }, 400);
  } else {
    // Hidden iframe fallback (works reliably on mobile if popups are blocked)
    let iframe = document.getElementById("mPrintIframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "mPrintIframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }
    iframe.srcdoc = printHtml;
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn("Iframe print error:", e);
        }
      }, 400);
    };
  }
}

// Start listeners on window load

// =============================================
// CMSys MOBILE STANDARD EXTENSIONS:
// 1. Tab Navigation & State Controller
// 2. Civil Engineering Estimate Calculator
// 3. Last Maintained Date (LMD) Facility Tracker
// 4. Compact Sailor Directory Viewer
// =============================================

let mCurrentTab = 'tasks';
let mEstCurrentCategory = 'concrete';
let mLmdRecords = [];
let mSailorDirTradeFilter = 'ALL';

// --- 1. TAB NAVIGATION CONTROLLER ---
function switchMobileTab(tabId) {
  mCurrentTab = tabId;
  const tabs = ['tasks', 'estimate', 'lmd', 'sailors'];
  
  tabs.forEach(t => {
    const view = document.getElementById(t === 'tasks' ? 'mViewTasks' : t === 'estimate' ? 'mViewEstimate' : t === 'lmd' ? 'mViewLmd' : 'mViewSailors');
    const btn = document.getElementById(t === 'tasks' ? 'mTabBtnTasks' : t === 'estimate' ? 'mTabBtnEstimate' : t === 'lmd' ? 'mTabBtnLmd' : 'mTabBtnSailors');
    
    if (view) {
      if (t === tabId) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    }
    if (btn) {
      if (t === tabId) {
        btn.className = 'flex flex-col items-center gap-0.5 text-teal-400 font-bold px-3 py-1 rounded-xl active-scale';
      } else {
        btn.className = 'flex flex-col items-center gap-0.5 text-slate-400 hover:text-white font-medium px-3 py-1 rounded-xl active-scale';
      }
    }
  });

  if (tabId === 'estimate') {
    runEstimateCalc();
  } else if (tabId === 'lmd') {
    loadLmdRecords();
  } else if (tabId === 'sailors') {
    renderMobileSailorDirectory();
  }
}

// --- 2. CIVIL ENGINEERING ESTIMATE CALCULATOR ---
function selectEstimateSubTab(cat) {
  mEstCurrentCategory = cat;
  const cats = ['concrete', 'brick', 'plaster', 'labour'];
  cats.forEach(c => {
    const sec = document.getElementById(c === 'concrete' ? 'mEstSectionConcrete' : c === 'brick' ? 'mEstSectionBrick' : c === 'plaster' ? 'mEstSectionPlaster' : 'mEstSectionLabour');
    const tabBtn = document.getElementById(c === 'concrete' ? 'mEstTabConcrete' : c === 'brick' ? 'mEstTabBrick' : c === 'plaster' ? 'mEstTabPlaster' : 'mEstTabLabour');
    if (sec) {
      if (c === cat) sec.classList.remove('hidden');
      else sec.classList.add('hidden');
    }
    if (tabBtn) {
      if (c === cat) {
        tabBtn.className = 'flex-1 py-1.5 rounded-lg bg-teal-600 text-white active-scale shadow-sm transition-all';
      } else {
        tabBtn.className = 'flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white active-scale transition-all';
      }
    }
  });
  runEstimateCalc();
}

let mLastEstimateSummary = '';
let mLastEstimateTotalCost = 0;

function runEstimateCalc() {
  const grid = document.getElementById('mEstResultsGrid');
  const summaryEl = document.getElementById('mEstSummaryText');
  const totalCostEl = document.getElementById('mEstTotalCost');
  if (!grid || !summaryEl) return;

  let cards = [];
  let summary = '';
  let totalCost = 0;

  if (mEstCurrentCategory === 'concrete') {
    const l = parseFloat(document.getElementById('mEstConcL')?.value) || 0;
    const w = parseFloat(document.getElementById('mEstConcW')?.value) || 0;
    const tInches = parseFloat(document.getElementById('mEstConcT')?.value) || 0;
    const mix = document.getElementById('mEstConcMix')?.value || '1:2:4';

    const wetVol = l * w * (tInches / 12.0); // cu.ft
    const dryVol = wetVol * 1.54; // Dry volume factor for shrinkage & voids

    let parts = [1, 2, 4];
    if (mix === '1:1.5:3') parts = [1, 1.5, 3];
    else if (mix === '1:3:6') parts = [1, 3, 6];
    else if (mix === '1:4:8') parts = [1, 4, 8];

    const sumParts = parts[0] + parts[1] + parts[2];
    const cementCuFt = (parts[0] / sumParts) * dryVol;
    const cementBags = Math.ceil(cementCuFt / 1.25); // 1 bag = 1.25 cu.ft (50kg)
    const sandCuFt = (parts[1] / sumParts) * dryVol;
    const sandCubes = (sandCuFt / 100).toFixed(2); // 1 cube = 100 cu.ft
    const metalCuFt = (parts[2] / sumParts) * dryVol;
    const metalCubes = (metalCuFt / 100).toFixed(2);

    // Approximate cost in Sri Lanka (Cement: Rs 2,400/bag, Sand: Rs 28,000/cube, Metal: Rs 26,000/cube)
    const cementCost = cementBags * 2400;
    const sandCost = parseFloat(sandCubes) * 28000;
    const metalCost = parseFloat(metalCubes) * 26000;
    totalCost = cementCost + sandCost + metalCost;

    cards = [
      { label: 'Wet Volume', val: `${wetVol.toFixed(1)} cu.ft (${(wetVol * 0.0283).toFixed(2)} m³)`, color: 'teal' },
      { label: 'Cement Bags (50kg)', val: `${cementBags} Bags`, color: 'emerald' },
      { label: 'River Sand', val: `${sandCubes} Cubes (${sandCuFt.toFixed(1)} cu.ft)`, color: 'amber' },
      { label: 'Metal (3/4 Aggregates)', val: `${metalCubes} Cubes (${metalCuFt.toFixed(1)} cu.ft)`, color: 'indigo' }
    ];

    summary = `📋 CONCRETE ESTIMATE (${mix})
Dimensions: ${l}ft × ${w}ft × ${tInches}" (Wet Vol: ${wetVol.toFixed(1)} cu.ft)
• Cement: ${cementBags} Bags (Rs ${cementCost.toLocaleString()})
• River Sand: ${sandCubes} Cubes (Rs ${sandCost.toLocaleString()})
• Aggregates (Metal): ${metalCubes} Cubes (Rs ${metalCost.toLocaleString()})
Estimated Material Total: Rs ${totalCost.toLocaleString()}`;

  } else if (mEstCurrentCategory === 'brick') {
    const l = parseFloat(document.getElementById('mEstBrickL')?.value) || 0;
    const h = parseFloat(document.getElementById('mEstBrickH')?.value) || 0;
    const type = document.getElementById('mEstBrickType')?.value || 'brick_half';

    const area = l * h; // sq.ft
    let count = 0;
    let cementBags = 0;
    let sandCubes = 0;
    let unitLabel = '';

    if (type === 'brick_half') {
      // 4.5" half brick wall: 5.5 bricks/sq.ft
      count = Math.ceil(area * 5.5);
      cementBags = Math.ceil(area * 0.07);
      sandCubes = (area * 0.0035).toFixed(2);
      unitLabel = 'Red Clay Bricks';
    } else if (type === 'brick_full') {
      // 9" full brick wall: 11 bricks/sq.ft
      count = Math.ceil(area * 11);
      cementBags = Math.ceil(area * 0.14);
      sandCubes = (area * 0.007).toFixed(2);
      unitLabel = 'Red Clay Bricks';
    } else if (type === 'block_4') {
      // 4" Cement block: 1.15 blocks/sq.ft
      count = Math.ceil(area * 1.15);
      cementBags = Math.ceil(area * 0.05);
      sandCubes = (area * 0.0025).toFixed(2);
      unitLabel = 'Cement Blocks (4")';
    } else {
      // 6" Cement block: 1.15 blocks/sq.ft
      count = Math.ceil(area * 1.15);
      cementBags = Math.ceil(area * 0.07);
      sandCubes = (area * 0.0035).toFixed(2);
      unitLabel = 'Cement Blocks (6")';
    }

    const unitPrice = type.includes('block') ? 110 : 35; // Block Rs 110, Brick Rs 35
    const unitTotal = count * unitPrice;
    const cementCost = cementBags * 2400;
    const sandCost = parseFloat(sandCubes) * 28000;
    totalCost = unitTotal + cementCost + sandCost;

    cards = [
      { label: 'Wall Surface Area', val: `${area.toFixed(0)} Sq.Ft`, color: 'teal' },
      { label: unitLabel, val: `${count} Units`, color: 'rose' },
      { label: 'Cement for Mortar', val: `${cementBags} Bags`, color: 'emerald' },
      { label: 'Sand for Mortar', val: `${sandCubes} Cubes`, color: 'amber' }
    ];

    summary = `🧱 BRICK/BLOCKWORK ESTIMATE
Wall Area: ${area.toFixed(0)} Sq.Ft (${l}ft × ${h}ft)
• ${unitLabel}: ${count} Units (Rs ${unitTotal.toLocaleString()})
• Cement Bags: ${cementBags} Bags (Rs ${cementCost.toLocaleString()})
• River Sand: ${sandCubes} Cubes (Rs ${sandCost.toLocaleString()})
Estimated Material Total: Rs ${totalCost.toLocaleString()}`;

  } else if (mEstCurrentCategory === 'plaster') {
    const area = parseFloat(document.getElementById('mEstPlasterArea')?.value) || 0;
    const thick = parseInt(document.getElementById('mEstPlasterThick')?.value, 10) || 16;
    const paintType = document.getElementById('mEstPaintType')?.value || 'emulsion';

    // 100 sq.ft plaster requires ~1.2 bags (16mm) or 0.9 bags (12mm)
    const factor = thick === 12 ? 0.009 : thick === 20 ? 0.015 : 0.012;
    const cementBags = Math.ceil(area * factor);
    const sandCubes = (area * factor * 0.06).toFixed(2);

    // 1 Gallon (4L) paint covers ~180-200 sq.ft for 2 coats
    const paintLitres = Math.ceil((area / 180) * 4);

    const cementCost = cementBags * 2400;
    const sandCost = parseFloat(sandCubes) * 28000;
    const paintCost = paintLitres * 1800; // ~Rs 1,800/L
    totalCost = cementCost + sandCost + paintCost;

    cards = [
      { label: 'Surface Area', val: `${area.toFixed(0)} Sq.Ft`, color: 'teal' },
      { label: 'Plaster Cement', val: `${cementBags} Bags`, color: 'emerald' },
      { label: 'Plaster Sand', val: `${sandCubes} Cubes`, color: 'amber' },
      { label: 'Paint Required (2 Coats)', val: `${paintLitres} Litres`, color: 'indigo' }
    ];

    summary = `🎨 PLASTER & PAINT ESTIMATE
Area: ${area.toFixed(0)} Sq.Ft (${thick}mm plaster)
• Cement: ${cementBags} Bags (Rs ${cementCost.toLocaleString()})
• Sand: ${sandCubes} Cubes (Rs ${sandCost.toLocaleString()})
• Paint (${paintType}): ${paintLitres} Litres (Rs ${paintCost.toLocaleString()})
Estimated Material Total: Rs ${totalCost.toLocaleString()}`;

  } else if (mEstCurrentCategory === 'labour') {
    const skilled = parseInt(document.getElementById('mEstSkilled')?.value, 10) || 0;
    const unskilled = parseInt(document.getElementById('mEstUnskilled')?.value, 10) || 0;
    const days = parseInt(document.getElementById('mEstDays')?.value, 10) || 0;
    const rateSkilled = parseFloat(document.getElementById('mEstRateSkilled')?.value) || 4500;
    const rateUnskilled = rateSkilled * 0.7; // ~70% of skilled rate

    const skilledCost = skilled * days * rateSkilled;
    const unskilledCost = unskilled * days * rateUnskilled;
    totalCost = skilledCost + unskilledCost;

    cards = [
      { label: 'Skilled Tradesmen', val: `${skilled} (${skilled * days} Man-Days)`, color: 'teal' },
      { label: 'Helpers / Labourers', val: `${unskilled} (${unskilled * days} Man-Days)`, color: 'emerald' },
      { label: 'Work Duration', val: `${days} Days`, color: 'indigo' },
      { label: 'Total Man-Days', val: `${(skilled + unskilled) * days} Days`, color: 'amber' }
    ];

    summary = `👷 LABOUR COST ESTIMATE
Crew: ${skilled} Skilled + ${unskilled} Helpers for ${days} Days
• Skilled Cost: Rs ${skilledCost.toLocaleString()} (${skilled * days} man-days @ ${rateSkilled})
• Helper Cost: Rs ${unskilledCost.toLocaleString()} (${unskilled * days} man-days @ ${rateUnskilled.toFixed(0)})
Estimated Labour Total: Rs ${totalCost.toLocaleString()}`;
  }

  mLastEstimateSummary = summary;
  mLastEstimateTotalCost = totalCost;

  if (totalCostEl) {
    totalCostEl.textContent = `Rs ${totalCost.toLocaleString()}`;
  }

  grid.innerHTML = cards.map(c => `
    <div class="bg-slate-800/80 p-2 rounded-xl border border-slate-700/80">
      <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${c.label}</div>
      <div class="text-xs font-black text-white font-mono mt-0.5">${c.val}</div>
    </div>
  `).join('');

  summaryEl.textContent = summary;
}

function copyEstimateSummary() {
  if (!mLastEstimateSummary) runEstimateCalc();
  navigator.clipboard?.writeText(mLastEstimateSummary).then(() => {
    showToast('📋 Estimate copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function useEstimateInWorkOrder() {
  if (!mLastEstimateSummary) runEstimateCalc();
  switchMobileTab('tasks');
  openNewWoSheet();
  
  const budgetInput = document.getElementById('mWoBudget');
  const descInput = document.getElementById('mWoDesc');
  if (budgetInput && mLastEstimateTotalCost > 0) {
    budgetInput.value = mLastEstimateTotalCost;
  }
  if (descInput) {
    descInput.value = (descInput.value ? descInput.value + '\n\n' : '') + mLastEstimateSummary;
  }
  showToast('✅ Estimate applied to new Work Order!', 'success');
}


// --- 3. LAST MAINTAINED DATE (LMD) TRACKER ---
function getZoneAssetTemplates(zone) {
  return [
    { id: 'pmp_01', name: 'Primary Water Pump #1', location: 'Pump House', cycle_days: 30, last_date: '2026-08-15', notes: 'Impeller lubrication & seal check' },
    { id: 'pmp_02', name: 'Standby Water Pump #2', location: 'Pump House', cycle_days: 30, last_date: '2026-08-10', notes: 'Motor winding test' },
    { id: 'elec_db', name: 'Main Electrical Distribution Board', location: 'Main Substation', cycle_days: 90, last_date: '2026-06-20', notes: 'Breaker thermal check' },
    { id: 'gen_set', name: 'Emergency Backup Generator', location: 'Gen Room', cycle_days: 30, last_date: '2026-08-25', notes: 'Oil & coolant level verified' },
    { id: 'ac_unit', name: 'Office A/C Condensers', location: 'Admin Block', cycle_days: 90, last_date: '2026-05-30', notes: 'Gas pressure & filter clean' },
    { id: 'roof_gtr', name: 'Roofing & Rainwater Gutters', location: 'Barracks Block', cycle_days: 180, last_date: '2026-03-15', notes: 'Cleared monsoon debris' },
    { id: 'fire_ext', name: 'Fire Extinguishers & Hydrants', location: 'Entire Zone', cycle_days: 180, last_date: '2026-04-10', notes: 'Pressure gauge verification' }
  ];
}

function loadLmdRecords() {
  const zone = mStore.currentZone || 'A-Zone';
  const cleanZone = zone.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  if (!opsDB) {
    mLmdRecords = getZoneAssetTemplates(zone);
    renderLmdList();
    return;
  }

  opsDB.ref(`lmd_records/${cleanZone}`).once('value', snapshot => {
    const data = snapshot.val();
    if (data) {
      mLmdRecords = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
      // Seed default templates for this zone
      const templates = getZoneAssetTemplates(zone);
      templates.forEach(tpl => {
        opsDB.ref(`lmd_records/${cleanZone}/${tpl.id}`).set(tpl);
      });
      mLmdRecords = templates;
    }
    renderLmdList();
  }).catch(err => {
    console.warn('LMD fetch fallback:', err);
    mLmdRecords = getZoneAssetTemplates(zone);
    renderLmdList();
  });
}

function calculateLmdStatus(lastDateStr, cycleDays) {
  if (!lastDateStr) return { status: 'OVERDUE', daysDiff: -999, nextDate: 'N/A' };
  
  const parts = lastDateStr.split('-');
  const lastD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(lastD.getTime())) return { status: 'OVERDUE', daysDiff: -999, nextDate: 'N/A' };

  const nextD = new Date(lastD);
  nextD.setDate(nextD.getDate() + (cycleDays || 30));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = nextD.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const y = nextD.getFullYear();
  const m = String(nextD.getMonth() + 1).padStart(2, '0');
  const d = String(nextD.getDate()).padStart(2, '0');
  const nextDate = `${y}-${m}-${d}`;

  if (diffDays < 0) {
    return { status: 'OVERDUE', daysDiff: diffDays, nextDate };
  } else if (diffDays <= 7) {
    return { status: 'DUE_SOON', daysDiff: diffDays, nextDate };
  } else {
    return { status: 'GOOD', daysDiff: diffDays, nextDate };
  }
}

function renderLmdList() {
  const container = document.getElementById('mLmdList');
  if (!container) return;

  const search = (document.getElementById('mLmdSearch')?.value || '').toLowerCase().trim();
  let good = 0;
  let due = 0;
  let overdue = 0;

  const filtered = mLmdRecords.filter(item => {
    const match = !search || 
      (item.name && item.name.toLowerCase().includes(search)) ||
      (item.location && item.location.toLowerCase().includes(search)) ||
      (item.notes && item.notes.toLowerCase().includes(search));
    return match;
  });

  mLmdRecords.forEach(item => {
    const calc = calculateLmdStatus(item.last_date, item.cycle_days);
    if (calc.status === 'GOOD') good++;
    else if (calc.status === 'DUE_SOON') due++;
    else overdue++;
  });

  const statGood = document.getElementById('mLmdStatGood');
  const statDue = document.getElementById('mLmdStatDue');
  const statOverdue = document.getElementById('mLmdStatOverdue');
  if (statGood) statGood.textContent = good;
  if (statDue) statDue.textContent = due;
  if (statOverdue) statOverdue.textContent = overdue;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">No facility assets match your filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const calc = calculateLmdStatus(item.last_date, item.cycle_days);
    let badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    let badgeLabel = `🟢 ${calc.daysDiff}d left`;

    if (calc.status === 'DUE_SOON') {
      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      badgeLabel = `🟡 Due in ${calc.daysDiff}d`;
    } else if (calc.status === 'OVERDUE') {
      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
      badgeLabel = `🔴 Overdue by ${Math.abs(calc.daysDiff)}d`;
    }

    return `
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h4 class="text-xs font-bold text-white truncate">${escapeHtml(item.name)}</h4>
            <p class="text-[10px] text-slate-400">📍 ${escapeHtml(item.location || 'Zone Facility')}</p>
          </div>
          <span class="text-[9px] font-black border px-2 py-0.5 rounded-full uppercase ${badgeClass}">
            ${badgeLabel}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
          <div>
            <span class="text-slate-400">Last Serviced:</span>
            <strong class="text-slate-200 font-mono ml-1">${item.last_date || 'None'}</strong>
          </div>
          <div>
            <span class="text-slate-400">Next Due:</span>
            <strong class="text-slate-200 font-mono ml-1">${calc.nextDate}</strong>
          </div>
          <div class="col-span-2 text-slate-400 text-[9px] truncate">
            📝 ${escapeHtml(item.notes || 'Routine maintenance cycle')} (${item.cycle_days || 30} days)
          </div>
        </div>

        <div class="flex items-center justify-end gap-1.5 pt-0.5">
          <button type="button" onclick="markLmdMaintainedToday('${item.id}')" class="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black active-scale flex items-center gap-1 shadow-sm">
            <span>⚡</span> Mark Serviced Today
          </button>
        </div>
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
      b.className = 'm-trade-btn px-2.5 py-1 rounded-lg bg-teal-600 text-white whitespace-nowrap active-scale';
    } else {
      b.className = 'm-trade-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap active-scale';
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
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-teal-400 shrink-0">
            ${rank}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-white truncate">${escapeHtml(name)}</h4>
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
