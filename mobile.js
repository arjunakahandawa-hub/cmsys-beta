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
  { id: "C-Zone", name: "C-Zone" },
  { id: "D-Zone", name: "D-Zone" },
  { id: "E-Zone", name: "E-Zone" },
  { id: "G-Zone", name: "G-Zone" },
  { id: "FH-Zone", name: "FH-Zone" },
  { id: "OTW", name: "OTW" },
  { id: "Supply-School", name: "Supply School" },
  { id: "Pump-House", name: "Pump House" },
  { id: "Carpentry-Shop", name: "Carpenter & Paint Workshop" },
  { id: "Welding-Shop", name: "Welding Shop" },
  { id: "Aluminium-Workshop", name: "Aluminium Workshop" }
];

function isZoneMatch(z1, z2) {
  if (!z1 && !z2) return true;
  if (!z1 || !z2) return false;
  if (z1 === z2) return true;
  if (isAdminStaffDuties(z1) && isAdminStaffDuties(z2)) return true;

  const s1 = String(z1).trim().toLowerCase().replace(/[-_\s&]+/g, "");
  const s2 = String(z2).trim().toLowerCase().replace(/[-_\s&]+/g, "");
  if (s1 === s2) return true;

  const isCarpentryOrPaint = (s) =>
    s.includes("carpenter") ||
    s.includes("carpentry") ||
    s.includes("paintworkshop") ||
    s.includes("paintershop") ||
    s.includes("paintshop") ||
    s.includes("carpenterpaint");
  if (isCarpentryOrPaint(s1) && isCarpentryOrPaint(s2)) return true;

  const letterMap = {
    a: "azone",
    b: "bzone",
    bc: "czone",
    bczone: "czone",
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
  if (norm1 === norm2) return true;

  if (s1.includes(s2) || s2.includes(s1)) return true;

  return false;
}

function isAdminStaffDuties(zoneIdOrName) {
  if (!zoneIdOrName) return false;
  const normalized = String(zoneIdOrName).toLowerCase().replace(/[-&\s]+/g, "");
  return normalized === "adminstaffduties";
}

function formatZoneDisplayName(zoneId) {
  if (!zoneId) return "";
  if (isAdminStaffDuties(zoneId)) return "Admin & Staff Duties";
  const zObj = STANDARD_ZONES.find(
    (z) => z.id === zoneId || z.name === zoneId || isZoneMatch(z.id, zoneId)
  );
  if (zObj && zObj.name) return zObj.name;
  return zoneId;
}

function parseOfficialNumber(offNo) {
  if (!offNo) return { type: "•", num: "-" };
  const clean = String(offNo).trim().replace(/^[^a-zA-Z0-9]+/, "");
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
  return { type: "•", num: clean || "-" };
}


function findSailor(sid) {
  if (!sid) return null;
  const sidStr = String(sid).trim().toLowerCase();
  const sidDigits = sidStr.replace(/\D/g, "");
  return (mlStore.sailors || []).find(s => {
    if (!s) return false;
    if (String(s.id).toLowerCase() === sidStr) return true;
    if (String(s._fbKey).toLowerCase() === sidStr) return true;
    if (String(s._rawIndex) === sidStr) return true;
    if (String(s._zeroIndex) === sidStr) return true;
    const off = String(s.official_number || s.off_no || "").toLowerCase();
    if (off === sidStr) return true;
    if (String(s.service_no || "").toLowerCase() === sidStr) return true;
    if (String(s.name || "").toLowerCase() === sidStr) return true;
    if (sidDigits && sidDigits.length >= 4 && off.replace(/\D/g, "") === sidDigits) return true;
    return false;
  }) || null;
}


// Helper: Get persistent mobile zone across page reloads & browser restarts
function getInitialMobileZone() {
  try {
    const qZ = new URLSearchParams(window.location.search).get("zone");
    if (qZ && STANDARD_ZONES.some(z => z.id === qZ)) return qZ;
    const mobSaved = localStorage.getItem("ncw_mobile_saved_zone");
    if (mobSaved && STANDARD_ZONES.some(z => z.id === mobSaved)) return mobSaved;
    const genSaved = localStorage.getItem("ncw_saved_zone");
    if (genSaved && STANDARD_ZONES.some(z => z.id === genSaved)) return genSaved;
  } catch (e) {}
  return "A-Zone";
}

// Helper: Check if a zone has been unlocked via PIN / Password
function isZoneUnlocked(z) {
  if (!z || z === "A-Zone") return true;
  try {
    return (
      localStorage.getItem("ncw_mobile_zone_unlocked_" + z) === "true" ||
      sessionStorage.getItem("ncw_mobile_zone_unlocked_" + z) === "true"
    );
  } catch (e) {
    return false;
  }
}

// Global Mobile Store
const mlStore = {
  currentZone: getInitialMobileZone(),
  selectedDate: getLocalDateString(),
  selectedWoType: "ALL",
  workOrders: [],
  sailors: [],
  dailyAllocations: [],
  jobCards: [],
  availability: {},
  estimates: [],
  locations: [],
  lmdRecords: [],
  zoneInCharges: {},
  activeTab: "home",
  selectedAssignKey: "",
  selectedEstKey: null,
  selectedWoKey: null,
  inventory: [],
  inventoryPage: 1,
  inventoryPageSize: 25,
  selectedInventoryCategory: "ALL",
  inventoryStoreScope: "zone"
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
  const tabs = ["home", "estimate", "lmd", "inventory"];
  
  tabs.forEach(t => {
    const view = document.getElementById(t === "home" ? "viewHome" : t === "estimate" ? "viewEstimate" : t === "lmd" ? "viewLmd" : "viewInventory");
    const btn = document.getElementById(t === "home" ? "tabBtnHome" : t === "estimate" ? "tabBtnEstimate" : t === "lmd" ? "tabBtnLmd" : "tabBtnInventory");
    
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
  else if (tabId === "inventory") renderLightInventory();
}

// ---------------------------------------------
// APP INITIALIZATION & ZONE SECURITY
// ---------------------------------------------
function initLightApp() {
  const targetZone = getInitialMobileZone();
  mlStore.currentZone = targetZone;

  try {
    localStorage.setItem("ncw_mobile_saved_zone", targetZone);
  } catch (e) {}

  // Update browser URL query parameter smoothly without reload
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("zone") !== targetZone) {
      url.searchParams.set("zone", targetZone);
      window.history.replaceState({ zone: targetZone }, "", url.toString());
    }
  } catch (e) {}

  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) {
    zoneSelect.innerHTML = STANDARD_ZONES.map(z => 
      `<option value="${z.id}" ${z.id === mlStore.currentZone ? "selected" : ""}>${z.name}</option>`
    ).join("");
    zoneSelect.value = mlStore.currentZone;
  }

  const datePicker = document.getElementById("mlDatePicker");
  if (datePicker) {
    datePicker.value = mlStore.selectedDate;
  }

  updateDocumentTitleMobile(mlStore.currentZone, mlStore.selectedDate);
  updateHistoricalBanner();
  loadLightData();

  // If saved zone is not unlocked, prompt password for it
  if (mlStore.currentZone !== "A-Zone" && !isZoneUnlocked(mlStore.currentZone)) {
    pendingZoneSwitch = mlStore.currentZone;
    openZonePasswordModal(mlStore.currentZone);
  }
}

let pendingZoneSwitch = null;

function changeLightZone(z) {
  if (!z) return;
  if (z === mlStore.currentZone) return;

  if (isZoneUnlocked(z)) {
    applyZoneSwitch(z);
    return;
  }

  pendingZoneSwitch = z;
  openZonePasswordModal(z);
}

function applyZoneSwitch(z) {
  mlStore.currentZone = z;
  try {
    localStorage.setItem("ncw_mobile_saved_zone", z);
    localStorage.setItem("ncw_saved_zone", z);
  } catch (e) {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("zone", z);
    window.history.replaceState({ zone: z }, "", url.toString());
  } catch (e) {}

  const zoneSelect = document.getElementById("mlZoneSelect");
  if (zoneSelect) zoneSelect.value = z;

  showLightToast("Switched to " + formatZoneDisplayName(z), "📍");
  updateDocumentTitleMobile(z, mlStore.selectedDate);
  updateZoneSailorCount();
  renderLightTasks();
  if (mlStore.activeTab === "estimate") renderLightEstimates();
  if (mlStore.activeTab === "lmd") loadLightLmdRecords();
  mlStore.inventoryPage = 1;
  updateInventoryCategoryCounters();
  if (mlStore.activeTab === "inventory") renderLightInventory();
  populateLocationDatalistMobile();
}

function openZonePasswordModal(zoneId) {
  const modal = document.getElementById("mlZonePasswordModal");
  const targetLabel = document.getElementById("mlZonePasswordTarget") || document.getElementById("mlZonePasswordSubtitle");
  const input = document.getElementById("mlZonePasswordInput");
  const err = document.getElementById("mlZonePasswordError");

  if (!modal) {
    applyZoneSwitch(zoneId);
    return;
  }

  if (targetLabel) targetLabel.textContent = formatZoneDisplayName(zoneId);
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

  if (!isZoneUnlocked(mlStore.currentZone)) {
    applyZoneSwitch("A-Zone");
  } else {
    const zoneSelect = document.getElementById("mlZoneSelect");
    if (zoneSelect) zoneSelect.value = mlStore.currentZone;
  }
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
  const matchedKeys = Object.keys(inCharges).filter(k => isZoneMatch(k, targetZone));
  const validPasswords = ["admin123", "civil2025", "navy123"];
  matchedKeys.forEach(k => {
    if (inCharges[k]?.password) validPasswords.push(inCharges[k].password);
  });
  if (inCharges[targetZone]?.password) validPasswords.push(inCharges[targetZone].password);

  const isMatched = (validPasswords.length === 3) || validPasswords.includes(enteredPass);

  if (isMatched) {
    try {
      localStorage.setItem("ncw_mobile_zone_unlocked_" + targetZone, "true");
      sessionStorage.setItem("ncw_mobile_zone_unlocked_" + targetZone, "true");
    } catch (e) {}
    const modal = document.getElementById("mlZonePasswordModal");
    if (modal) modal.classList.add("hidden");
    applyZoneSwitch(targetZone);
    pendingZoneSwitch = null;
  } else {
    if (err) {
      err.textContent = "Incorrect password for " + formatZoneDisplayName(targetZone) + ". Please check with your supervisor.";
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
    _rawIndex: idx + 1,
    _zeroIndex: idx,
    official_number: offNo,
    off_no: offNo,
    name: fullName,
    rank: rank,
    trade: trade,
    zone_assigned: zone_assigned
  };
}

// ---------------------------------------------
// TOP BAR: ZONE SAILORS COUNT (DESKTOP ALIGNED - PIC 02)
// ---------------------------------------------
function isAdminStaffDuties(zoneId) {
  if (!zoneId) return false;
  const s = String(zoneId).toLowerCase();
  return s.includes("admin") && s.includes("staff");
}

function isLeaveCode(val) {
  if (!val) return false;
  const str = typeof val === "string" ? val.trim() : String(val).trim();
  return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(str);
}

function isWorkOrderActiveOnDate(wo, targetDate) {
  if (!wo) return false;

  // 1. Filter out deleted work orders permanently
  if (wo.deleted || wo.status === "Deleted" || wo.status === "deleted" || wo.isDeleted || wo._deleted) {
    return false;
  }

  const today = getLocalDateString();
  if (!targetDate) targetDate = today;
  const isToday = (targetDate === today);

  const woIdStr = String(wo.id || "");
  const woFbKeyStr = String(wo._fbKey || "");
  const woRefStr = String(wo.reference_no || "");
  const woJobNoStr = String(wo.job_no || "");
  const woDescStr = String(wo.description || "").trim().toLowerCase();

  // Check if daily allocations exist on this target date
  const hasAllocationsOnDate = (mlStore.dailyAllocations || []).some(a => {
    if (!a || a.date !== targetDate || a.status === "Cancelled") return false;
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
  });

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

function getWorkOrderAssignedSailors(wo, dateStr) {
  if (!wo) return { sailors: [], isCommitted: false };
  const today = getLocalDateString();
  if (!dateStr) dateStr = today;

  const extractKeys = (val) => {
    const keys = [];
    if (!val) return keys;
    if (Array.isArray(val)) {
      val.forEach((item) => {
        if (!item) return;
        if (typeof item === "object") {
          if (item.id) keys.push(String(item.id));
          if (item._fbKey) keys.push(String(item._fbKey));
          if (item.sailor_id) keys.push(String(item.sailor_id));
          if (item.official_number) keys.push(String(item.official_number));
          if (item.service_no) keys.push(String(item.service_no));
        } else {
          keys.push(String(item).trim());
        }
      });
    } else if (typeof val === "object") {
      Object.keys(val).forEach(k => keys.push(String(k).trim()));
      Object.values(val).forEach(v => {
        if (!v) return;
        if (typeof v === "object") {
          if (v.id) keys.push(String(v.id));
          if (v._fbKey) keys.push(String(v._fbKey));
          if (v.sailor_id) keys.push(String(v.sailor_id));
          if (v.official_number) keys.push(String(v.official_number));
          if (v.service_no) keys.push(String(v.service_no));
        } else if (typeof v === "string" || typeof v === "number") {
          keys.push(String(v).trim());
        }
      });
    }
    return keys;
  };

  const assignedKeys = new Set();
  const woIdStr = String(wo.id || "");
  const woFbKeyStr = String(wo._fbKey || "");
  const woRefStr = String(wo.reference_no || "");
  const woJobNoStr = String(wo.job_no || "");
  const woDescStr = String(wo.description || "").trim().toLowerCase();

  let hasDailyRecordForDate = false;
  (mlStore.dailyAllocations || []).forEach(a => {
    if (!a || a.date !== dateStr || a.status === "Cancelled") return;
    const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
    const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();
    const aRef = String(a.reference_no || "");
    const isWoMatch =
      (woIdStr && aWoId === woIdStr) ||
      (woFbKeyStr && aWoId === woFbKeyStr) ||
      (woRefStr && (aRef === woRefStr || aWoId === woRefStr)) ||
      (woJobNoStr && aWoId === woJobNoStr) ||
      (woDescStr && aDesc && (aDesc === woDescStr || aDesc.includes(woDescStr) || woDescStr.includes(aDesc)));
    if (isWoMatch) {
      hasDailyRecordForDate = true;
      const sid = a.sailor_id || a.sailorId || a.official_number || a.offNo || "";
      if (sid) assignedKeys.add(String(sid).trim());
    }
  });

  // Fallback: If no daily allocations on this date, include planned crew from wo.assigned, then wo.last_assigned
  if (!hasDailyRecordForDate || assignedKeys.size === 0) {
    const rawAssigned = extractKeys(wo.assigned);
    if (rawAssigned.length > 0) {
      rawAssigned.forEach(k => assignedKeys.add(k));
    } else {
      const rawLast = extractKeys(wo.last_assigned);
      rawLast.forEach(k => assignedKeys.add(k));
    }
  }

  const resultSailors = [];
  assignedKeys.forEach(k => {
    const s = findSailor(k);
    if (s) resultSailors.push(s);
  });
  return { sailors: resultSailors, isCommitted: hasDailyRecordForDate };
}

function getZoneActiveSailors(zoneId, dateVal) {
  const currentZone = zoneId || mlStore.currentZone;
  const targetDate = dateVal || mlStore.selectedDate || getLocalDateString();
  const [yyyy, mm, dd] = targetDate.split("-");
  const monthKey = `${yyyy}-${mm}`;
  const dayKey = parseInt(dd, 10).toString();

  const isZoneMatchLocal = (zField) => {
    if (!zField) return false;
    if (isAdminStaffDuties(currentZone)) return isAdminStaffDuties(zField);
    return isZoneMatch(zField, currentZone);
  };

  const zoneSailorMap = new Map();

  const addSailor = (s) => {
    if (!s) return;
    const fbStatus =
      mlStore.availability &&
      mlStore.availability[monthKey] &&
      mlStore.availability[monthKey][dayKey]
        ? mlStore.availability[monthKey][dayKey][s._fbKey] || mlStore.availability[monthKey][dayKey][s.id]
        : null;
    if (
      isLeaveCode(fbStatus) ||
      (!fbStatus && isLeaveCode(s.attendance))
    ) {
      return;
    }
    const key = String(s.id || s._fbKey || s.official_number || s.service_no || s.name || "");
    if (key && !zoneSailorMap.has(key)) {
      zoneSailorMap.set(key, s);
    }
  };

  const addSailorById = (id) => {
    if (!id) return;
    if (typeof id === "object") {
      addSailor(id);
      return;
    }
    const s = findSailor(id);
    if (s) addSailor(s);
  };

  // 1. Work Orders
  (mlStore.workOrders || []).forEach((wo) => {
    if (!wo || wo.status === "Cancelled" || wo.status === "Completed") return;
    const zoneField = wo.zone_id || wo.zone || wo.zoneId || wo.zone_name || wo.location_zone || wo.location;
    if (isZoneMatchLocal(zoneField)) {
      if (isWorkOrderActiveOnDate(wo, targetDate)) {
        const { sailors: woSailors } = getWorkOrderAssignedSailors(wo, targetDate);
        woSailors.forEach(addSailor);
      }
    }
  });

  // 2. Job Cards
  (mlStore.jobCards || []).forEach((jc) => {
    if (!jc || jc.status === "Cancelled" || jc.status === "Completed") return;
    const zoneField = jc.zone_id || jc.zone || jc.zoneId || jc.zone_name || jc.location_zone || jc.location;
    if (isZoneMatchLocal(zoneField)) {
      if (isWorkOrderActiveOnDate(jc, targetDate)) {
        const { sailors: jcSailors } = getWorkOrderAssignedSailors(jc, targetDate);
        jcSailors.forEach(addSailor);
      }
    }
  });

  // 3. Daily Allocations recorded for targetDate
  (mlStore.dailyAllocations || []).forEach((alloc) => {
    if (!alloc || alloc.date !== targetDate || alloc.status === "Cancelled") return;
    const sid = alloc.sailor_id || alloc.sailorId || alloc.official_number || alloc.offNo || "";
    if (!sid) return;

    if (isZoneMatchLocal(alloc.zone_id || alloc.zone || alloc.zone_name || alloc.location)) {
      addSailorById(sid);
      return;
    }

    if (alloc.work_order_id) {
      const matchedWo = (mlStore.workOrders || []).find(
        (w) =>
          String(w.id) === String(alloc.work_order_id) ||
          String(w._fbKey) === String(alloc.work_order_id) ||
          (w.description && alloc.description && w.description.trim().toLowerCase() === alloc.description.trim().toLowerCase())
      );
      if (matchedWo && isZoneMatchLocal(matchedWo.zone_id || matchedWo.zone || matchedWo.zoneId || matchedWo.zone_name)) {
        addSailorById(sid);
        return;
      }

      const matchedJc = (mlStore.jobCards || []).find(
        (j) =>
          String(j.id) === String(alloc.work_order_id) ||
          String(j._fbKey) === String(alloc.work_order_id) ||
          (j.description && alloc.description && j.description.trim().toLowerCase() === alloc.description.trim().toLowerCase())
      );
      if (matchedJc && isZoneMatchLocal(matchedJc.zone_id || matchedJc.zone || matchedJc.zoneId || matchedJc.zone_name)) {
        addSailorById(sid);
        return;
      }
    }
  });

  return Array.from(zoneSailorMap.values());
}

function updateZoneSelectOptionsMobile() {
  const zoneSelect = document.getElementById("mlZoneSelect");
  if (!zoneSelect) return;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  Array.from(zoneSelect.options).forEach(opt => {
    const zid = opt.value;
    const baseZone = STANDARD_ZONES.find(z => z.id === zid);
    const baseName = baseZone ? baseZone.name : opt.text.split("(")[0].trim();
    const sailors = getZoneActiveSailors(zid, targetDate);
    opt.textContent = `${baseName} (🟢 ${sailors.length})`;
  });
}

function updateZoneSailorCount() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const activeSailors = getZoneActiveSailors(currentZone, targetDate);
  const count = activeSailors.length;

  const countEl = document.getElementById("mlZoneSailorCount");
  if (countEl) countEl.textContent = count;

  updateZoneSelectOptionsMobile();
}

// ---------------------------------------------
// DATE CONTROLS & HISTORICAL BANNER
// ---------------------------------------------
function changeLightDate(d) {
  if (!d) return;
  mlStore.selectedDate = d;
  updateDocumentTitleMobile(mlStore.currentZone, d);
  updateHistoricalBanner();
  updateZoneSailorCount();
  renderLightTasks();
}

function resetToTodayMobile() {
  const today = getLocalDateString();
  mlStore.selectedDate = today;
  const datePicker = document.getElementById("mlDatePicker");
  if (datePicker) datePicker.value = today;
  updateDocumentTitleMobile(mlStore.currentZone, today);
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
    sailorsDB.ref("availability").on("value", snap => {
      mlStore.availability = snap.val() || {};
      updateZoneSailorCount();
      renderLightTasks();
    });

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

    opsDB.ref("job_cards").on("value", snap => {
      const d = snap.val();
      mlStore.jobCards = [];
      if (d) {
        Object.keys(d).forEach(k => {
          if (d[k]) mlStore.jobCards.push({ id: k, _fbKey: k, ...d[k] });
        });
      }
      updateZoneSailorCount();
      renderLightTasks();
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

    opsDB.ref("inventory").on("value", snap => {
      const val = snap.val();
      mlStore.inventory = [];
      if (val) {
        Object.keys(val).forEach(k => {
          const item = val[k];
          if (item) {
            mlStore.inventory.push({
              ...item,
              _fbKey: k,
              id: item.id || k,
              category: String(item.category || "General").trim(),
              description: String(item.description || "Unnamed Material").trim(),
              deno: String(item.deno || "Nos").trim(),
              quantity: typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 0,
              cost_per_unit: parseFloat(item.cost_per_unit != null ? item.cost_per_unit : (item.cost || 0)) || 0,
              cost: parseFloat(item.cost != null ? item.cost : (item.cost_per_unit || 0)) || 0,
              location: String(item.location || "Zone Store").trim(),
              zone_id: String(item.zone_id || item.zone || "").trim(),
              book_no: String(item.book_no || item.book || item.book_number || "").trim(),
              requirement: String(item.requirement || item.project || "").trim(),
              date_added: String(item.date_added || "").trim(),
              on_charge_ref: String(item.on_charge_ref || "").trim(),
              on_charge_records: Array.isArray(item.on_charge_records) ? item.on_charge_records : [],
              off_charge_ref: String(item.off_charge_ref || "").trim(),
              off_charge_records: Array.isArray(item.off_charge_records) ? item.off_charge_records : []
            });
          }
        });
      }
      updateInventoryCategoryCounters();
      if (mlStore.activeTab === "inventory") {
        renderLightInventory();
      }
    });
  }
}

// ---------------------------------------------
// WORK ORDER CLASSIFICATION & ACTIVITY LOGIC
// ---------------------------------------------
function getWorkOrderCategory(wo) {
  if (!wo) return "TASK";
  if (
    wo.assign_type || 
    String(wo.type || "").toUpperCase() === "ASSIGN" || 
    String(wo.type || "").toUpperCase() === "ASSIGNMENT" ||
    String(wo.category || "").toUpperCase() === "ASSIGN" ||
    String(wo.category || "").toUpperCase() === "ASSIGNMENT" ||
    wo.is_assignment
  ) {
    return "ASSIGN";
  }
  const t = String(wo.type || "TASK").toUpperCase();
  if (t === "PROJECT") return "PROJECT";
  if (t === "JOB" || t === "MAINTENANCE") return "JOB";
  return "TASK";
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
    const woRefStr = String(wo.reference_no || "");
    const woJobNoStr = String(wo.job_no || "");
    const woDescStr = String(wo.description || "").trim().toLowerCase();

    const targetAllocs = (mlStore.dailyAllocations || []).filter(a => {
      if (!a || a.date !== targetDate || a.status === "Cancelled") return false;
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
    });

    const isCommittedOnTargetDate = targetAllocs.length > 0;

    let assignedIds = [];
    if (isCommittedOnTargetDate) {
      assignedIds = targetAllocs.map(a => String(a.sailor_id || a.sailorId || (a.sailor && (a.sailor.id || a.sailor._fbKey))));
    } else {
      const rawAssigned = (Array.isArray(wo.assigned) && wo.assigned.length > 0)
        ? wo.assigned
        : ((Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0)
            ? wo.last_assigned
            : (wo.assigned && typeof wo.assigned === "object" ? Object.values(wo.assigned) : []));
      assignedIds = rawAssigned.map(item => {
        if (!item) return "";
        if (typeof item === "object") return String(item.id || item._fbKey || item.sailor_id || item.official_number || item.off_no || "");
        return String(item).trim();
      }).filter(Boolean);
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
      activeBadge = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Standby (${crewCount} Planned)</span>`;
    }

    let officerBadge = "";
    if (wo.officer_review_status === "Approved") {
      officerBadge = '<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">🛡️ Approved</span>';
    }

    // Category Badge
    let typeBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
    let typeIcon = "📋";
    if (cat === "PROJECT") { typeBadgeClass = "bg-blue-50 text-blue-800 border-blue-200"; typeIcon = "📐"; }
    else if (cat === "JOB") { typeBadgeClass = "bg-amber-50 text-amber-800 border-amber-200"; typeIcon = "🔧"; }
    else if (cat === "ASSIGN") { typeBadgeClass = "bg-indigo-50 text-indigo-800 border-indigo-200"; typeIcon = "💼"; }

    const typeBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${typeBadgeClass}">${typeIcon} ${escapeHtml(wo.assign_type ? ('ASSIGN: ' + wo.assign_type) : (wo.type || 'TASK'))}</span>`;

    // Sailor Trade Breakdown & Sailor Pills
    const tradeCounts = {};
    assignedIds.forEach(sid => {
      const s = findSailor(sid);
      const tr = s ? (s.trade || s.category || "OTHER") : "OTHER";
      tradeCounts[tr] = (tradeCounts[tr] || 0) + 1;
    });
    const tradeParts = Object.entries(tradeCounts).map(([tr, cnt]) => `${cnt} ${tr}`);
    const tradeBadgeStr = tradeParts.length > 0 
      ? `<span class="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded-md text-[9px] font-bold">${tradeParts.join(', ')}</span>` 
      : '';

    let sailorPillsHtml = '';
    if (crewCount > 0) {
      sailorPillsHtml = assignedIds.slice(0, 4).map(sid => {
        const s = findSailor(sid);
        const rawName = s ? (s.name || s.off_no || 'Sailor') : ('Sailor ' + sid);
        const nameParts = rawName.trim().split(/\s+/);
        const displayShort = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : rawName.toUpperCase();
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold">
          ${escapeHtml(displayShort)} <span class="bg-amber-500 text-white px-1.5 py-0.1 rounded-full text-[8px] font-black">7.0</span>
        </span>`;
      }).join(' ');
      if (crewCount > 4) sailorPillsHtml += ` <span class="text-[9px] text-slate-400 font-bold">+${crewCount - 4} more</span>`;
    }

    // Progress Bar (Strictly ONLY for Projects & Jobs; NEVER for Assignments or other tasks)
    let progressHtml = '';
    const isProjectOrJob = (cat === 'PROJECT' || cat === 'JOB') && !wo.assign_type && !wo.is_assignment;
    if (isProjectOrJob) {
      const barColor = cat === 'PROJECT' ? 'bg-teal-600' : 'bg-blue-600';
      const textColor = cat === 'PROJECT' ? 'text-teal-700' : 'text-blue-700';
      progressHtml = `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progress</span>
            <span class="font-extrabold ${textColor}">${progress}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="${barColor} h-1.5 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>
      `;
    }

    // Duration Tag (Only for Projects & Jobs)
    let durationHtml = '';
    if (isProjectOrJob) {
      const dur = wo.duration || wo.estimated_duration || 1;
      durationHtml = `<div class="flex items-center gap-1 text-[10px] text-slate-400 font-medium"><span>🕒</span> <span>${dur}d</span></div>`;
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
      <!-- WORK ORDER CARD (PIC - 01) -->
      <div onclick="openWorkOrderDetailMobile('${key}')" class="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-teal-400 p-3.5 space-y-2.5 transition-all cursor-pointer active-scale">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${prioBadge}
          ${statusBadge}
          ${activeBadge}
          ${officerBadge}
          ${typeBadge}
        </div>

        <div>
          <h3 class="text-sm font-bold text-slate-900 leading-snug">${desc}</h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">📍 ${locDisplay}${subLoc}</p>
        </div>

        ${progressHtml}
        ${durationHtml}

        <!-- Assigned Crew Section -->
        <div class="pt-1.5 border-t border-slate-100 space-y-1.5">
          <div class="flex items-center justify-between gap-1 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-slate-700">👷 ${crewCount} ${isCommittedOnTargetDate ? 'active' : 'planned'}</span>
              ${tradeBadgeStr}
            </div>
            ${isToday ? `
              <button type="button" onclick="event.stopPropagation(); openAssignModal('${key}')" class="px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-teal-800 font-bold text-[10px] rounded-lg border border-slate-200 active-scale">
                👥 Assign
              </button>
            ` : ''}
          </div>
          ${crewCount > 0 ? `<div class="flex items-center gap-1 flex-wrap">${sailorPillsHtml}</div>` : '<span class="text-slate-400 text-xs italic block">No sailors assigned</span>'}
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

  const isAssign = Boolean(wo.assign_type || getWorkOrderCategory(wo) === "ASSIGN");
  const progSection = document.getElementById("mlWoDetailProgressSection");
  if (progSection) {
    progSection.classList.toggle("hidden", isAssign);
  }

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

  const rawAssigned = (Array.isArray(wo.assigned) && wo.assigned.length > 0)
    ? wo.assigned 
    : ((Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0)
        ? wo.last_assigned
        : (wo.assigned && typeof wo.assigned === "object" ? Object.values(wo.assigned) : []));

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
  const statEl = document.getElementById("mlEstDetailStatus") || document.getElementById("mlEstDetailStatusBadge");
  const locEl = document.getElementById("mlEstDetailLocation");
  const userEl = document.getElementById("mlEstDetailEndUser");
  const scopeEl = document.getElementById("mlEstDetailScope");
  const matList = document.getElementById("mlEstDetailMatTableBody") || document.getElementById("mlEstDetailMaterialsList");
  const matTot = document.getElementById("mlEstDetailMatTotal") || document.getElementById("mlEstDetailMaterialsTotal");
  const labList = document.getElementById("mlEstDetailLabTableBody") || document.getElementById("mlEstDetailLaborList");
  const labTot = document.getElementById("mlEstDetailLabTotal") || document.getElementById("mlEstDetailLaborTotal");
  const grandTot = document.getElementById("mlEstDetailGrandTotal");

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

  const sigEl = document.getElementById("mlEstDetailSignatories") || document.getElementById("mlEstDetailSignatures");
  if (sigEl) {
    const cb = est.createdBy || {};
    const chk = est.checkedBy || {};
    const apv = est.approvedBy || {};
    sigEl.innerHTML = `
      <div class="flex justify-between">
        <span><strong>Created By:</strong> ${escapeHtml(cb.name || "—")} (${escapeHtml(cb.rank || "")} ${escapeHtml(cb.serviceNo || cb.official_number || "")})</span>
      </div>
      <div class="flex justify-between border-t border-slate-200 pt-1">
        <span><strong>Checked By:</strong> ${escapeHtml(chk.name || "—")} (${escapeHtml(chk.rank || "")} ${escapeHtml(chk.serviceNo || chk.official_number || "")})</span>
      </div>
      <div class="flex justify-between border-t border-slate-200 pt-1 text-emerald-800">
        <span><strong>Approved By:</strong> ${escapeHtml(apv.name || "—")} (${escapeHtml(apv.rank || "")} ${escapeHtml(apv.serviceNo || apv.official_number || "")})</span>
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

// ── ESTIMATE & REPORT PDF EXPORT & PRINT FOR MOBILE (ON-DEMAND / ZERO-LAG) ──
function loadHtml2PdfMobile(callback, onError) {
  if (typeof html2pdf !== "undefined") {
    return callback();
  }
  showLightToast("Loading PDF engine...", "⏳");
  
  // Try loading local bundle first (100% offline support)
  const localScript = document.createElement("script");
  localScript.src = "html2pdf.bundle.min.js";
  localScript.onload = () => {
    if (typeof html2pdf !== "undefined") {
      callback();
    } else {
      loadCdnFallback();
    }
  };
  localScript.onerror = () => {
    loadCdnFallback();
  };

  const loadCdnFallback = () => {
    const cdnScript = document.createElement("script");
    cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    cdnScript.onload = () => {
      callback();
    };
    cdnScript.onerror = (e) => {
      console.warn("Failed to load html2pdf library from local and CDN:", e);
      showLightToast("PDF library load failed. Switching to Print...", "⚠️");
      if (typeof onError === "function") {
        onError();
      }
    };
    document.head.appendChild(cdnScript);
  };

  document.head.appendChild(localScript);
}

function buildEstimatePrintHTMLMobile(est) {
  const zoneObj = (mlStore.zones || []).find(z => z.id === (est.zone_id || mlStore.currentZone));
  const zoneName = zoneObj && zoneObj.name ? zoneObj.name : (mlStore.currentZone || "Civil Engineering Department");

  const sigBlock = (label, p) => `
    <div style="text-align:center;width:30%;">
      <div style="height:36px;border-bottom:1.5px solid #0f172a;margin-bottom:4px;"></div>
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#0f172a;">${label}</div>
      <div style="font-size:11px;font-weight:700;color:#1e293b;margin-top:2px;">${p && p.name ? escapeHtml(p.name) : "&nbsp;"}</div>
      <div style="font-size:10px;color:#475569;font-weight:600;">${p && p.rank ? escapeHtml(p.rank) : ""}${p && (p.serviceNo || p.official_number) ? " • " + escapeHtml(p.serviceNo || p.official_number) : ""}</div>
    </div>`;

  let sectionsHtml = "";
  if (est.workScopes && est.workScopes.length > 0) {
    est.workScopes.forEach((s, sIdx) => {
      const matRows = (s.materials || []).map((m, i) => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:6%;font-weight:600;">${i + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;font-weight:600;color:#0f172a;">${escapeHtml(m.description || m.name || "")}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:10%;font-weight:700;">${m.qty || 1}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:10%;">${escapeHtml(m.unit || 'Nos')}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:right;width:17%;font-family:monospace;font-weight:600;">${formatCurrency(m.cost || m.rate || 0)}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:right;width:20%;font-family:monospace;font-weight:800;color:#0f172a;">${formatCurrency((m.qty || 1) * (m.cost || 0))}</td>
        </tr>`).join("");

      const labRows = (s.labor || []).map(l => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;font-weight:700;color:#0f172a;">${escapeHtml(l.trade || "Worker")}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:20%;font-weight:700;">${l.workers || 1}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:20%;font-weight:800;color:#2563eb;">${l.manDays || l.man_days || 0}</td>
        </tr>`).join("");

      const sTotalCost = (s.materials || []).reduce((sum, m) => sum + ((m.qty || 1) * (m.cost || 0)), 0);

      sectionsHtml += `
        <div style="margin-top:8px;border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#fafbfc;page-break-inside:avoid;">
          <div style="font-size:11px;font-weight:800;border-bottom:1px solid #94a3b8;padding-bottom:3px;margin-bottom:6px;text-transform:uppercase;color:#0f172a;display:flex;justify-content:space-between;">
            <span>📌 Section ${sIdx + 1}: ${escapeHtml(s.description || "Scope")}</span>
            <span style="color:#059669;font-family:monospace;">Cost: Rs. ${formatCurrency(sTotalCost)}</span>
          </div>
          ${matRows ? `
            <table class="est-table" style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px;">
              <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #94a3b8;padding:3px 5px;width:6%;text-align:center;">#</th><th style="border:1px solid #94a3b8;padding:3px 5px;text-align:left;">Material</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:10%;text-align:center;">Qty</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:10%;text-align:center;">Unit</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:17%;text-align:right;">Cost</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:20%;text-align:right;">Total</th></tr></thead>
              <tbody>${matRows}</tbody>
            </table>` : ""}
          ${labRows ? `
            <table class="est-table" style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #94a3b8;padding:3px 5px;text-align:left;">Trade</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:20%;text-align:center;">Workers</th><th style="border:1px solid #94a3b8;padding:3px 5px;width:20%;text-align:center;">Man-Days</th></tr></thead>
              <tbody>${labRows}</tbody>
            </table>` : ""}
        </div>`;
    });
  } else {
    const materials = Array.isArray(est.materials) ? est.materials : (est.materials ? Object.values(est.materials) : []);
    const matRows = materials.length > 0
      ? materials.map((m, i) => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:6%;font-weight:600;">${i + 1}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;font-weight:600;color:#0f172a;">${escapeHtml(m.description || m.name || "")}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:10%;font-weight:700;">${m.qty || 1}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:10%;">${escapeHtml(m.unit || 'Nos')}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:right;width:17%;font-family:monospace;font-weight:600;">${formatCurrency(m.cost || m.rate || 0)}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:right;width:20%;font-family:monospace;font-weight:800;color:#0f172a;">${formatCurrency(m.total || ((m.qty || 1) * (m.cost || 0)))}</td>
          </tr>`).join("")
      : '<tr><td colspan="6" style="border:1px solid #cbd5e1;text-align:center;font-style:italic;padding:8px;color:#94a3b8;">No materials specified</td></tr>';

    const labor = Array.isArray(est.labor) ? est.labor : (est.labor ? Object.values(est.labor) : []);
    const labRows = labor.length > 0
      ? labor.map(l => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;font-weight:700;color:#0f172a;">${escapeHtml(l.trade || "Worker")}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:20%;font-weight:700;">${l.workers || 1}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;width:20%;font-weight:800;color:#2563eb;">${l.manDays || l.man_days || 0}</td>
          </tr>`).join("")
      : '<tr><td colspan="3" style="border:1px solid #cbd5e1;text-align:center;font-style:italic;padding:8px;color:#94a3b8;">No labor specified</td></tr>';

    sectionsHtml = `
      <div style="margin-top:8px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#0f172a;margin-bottom:4px;display:flex;justify-content:space-between;">
          <span>📦 Materials Required</span>
          <span style="font-family:monospace;color:#059669;">Total: Rs. ${formatCurrency(est.total_cost || 0)}</span>
        </div>
        <table class="est-table" style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:6%;text-align:center;">#</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;text-align:left;">Material Description</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:10%;text-align:center;">Qty</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:10%;text-align:center;">Unit</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:17%;text-align:right;">Unit Cost (Rs)</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:20%;text-align:right;">Total (Rs)</th>
            </tr>
          </thead>
          <tbody>${matRows}</tbody>
        </table>
      </div>

      <div style="margin-top:10px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#0f172a;margin-bottom:4px;display:flex;justify-content:space-between;">
          <span>👷 Labor Requirements</span>
          <span style="font-family:monospace;color:#2563eb;">Total: ${est.totalManDays || est.manDays || 0} Man-Days</span>
        </div>
        <table class="est-table" style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #94a3b8;padding:4px 6px;text-align:left;">Trade / Skill</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:20%;text-align:center;">Workers</th>
              <th style="border:1px solid #94a3b8;padding:4px 6px;width:20%;text-align:center;">Man-Days</th>
            </tr>
          </thead>
          <tbody>${labRows}</tbody>
        </table>
      </div>`;
  }

  const createdDate = est.created_at
    ? (typeof est.created_at === "number" ? new Date(est.created_at).toISOString().split("T")[0] : String(est.created_at).split("T")[0])
    : new Date().toISOString().split("T")[0];

  const hasSignatures = est.createdBy || est.checkedBy || est.approvedBy;
  const sigSection = hasSignatures ? `
    <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:10px;page-break-inside:avoid;">
      ${sigBlock("Created By", est.createdBy)}
      ${sigBlock("Checked By", est.checkedBy)}
      ${sigBlock("Approved By", est.approvedBy)}
    </div>` : "";

  return `
    <div class="est-sheet" style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:14px 16px;border:1.5px solid #0f172a;border-radius:8px;box-sizing:border-box;">
      <!-- Header -->
      <div style="width:100%;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:10px;">
        <table style="width:100%;border:none;border-collapse:collapse;">
          <tr>
            <td style="border:none;padding:0;width:52px;vertical-align:middle;">
              <img src="images/navy_crest_cropped.png" onerror="this.onerror=null;this.src='logo.png'" style="height:48px;width:auto;display:block;" alt="SLN Crest">
            </td>
            <td style="border:none;padding:0 0 0 12px;vertical-align:middle;">
              <div style="font-size:15px;font-weight:900;letter-spacing:0.5px;color:#0f172a;line-height:1.2;">CAPTAIN CIVIL ENGINEERING DEPARTMENT (E)</div>
              <div style="font-size:11.5px;font-weight:700;color:#334155;margin-top:2px;">${escapeHtml(zoneName)} — Cost Estimate & Bill of Quantities</div>
            </td>
            <td style="border:none;padding:0;text-align:right;vertical-align:middle;">
              <div style="font-size:14px;font-weight:900;color:#b91c1c;font-family:monospace;">${escapeHtml(est.estimate_number || "EST/--")}</div>
              <div style="font-size:11px;color:#475569;font-weight:600;font-family:monospace;margin-top:2px;">Date: ${createdDate}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Info Grid -->
      <table style="width:100%;font-size:11px;line-height:1.6;margin-bottom:8px;border:none;border-collapse:collapse;">
        <tr>
          <td style="border:none;padding:2px 0;width:34%;color:#1e293b;"><b>Ref Type:</b> ${escapeHtml(est.ref_type || est.reference_type || "Minute Sheet")}</td>
          <td style="border:none;padding:2px 0;width:38%;color:#1e293b;"><b>Ref No:</b> ${escapeHtml(est.reference_no || est.reference_doc || "—")}</td>
          <td style="border:none;padding:2px 0;width:28%;text-align:right;color:#1e293b;"><b>Type:</b> ${escapeHtml(est.project_type || est.type || "PROJECT")}</td>
        </tr>
        <tr>
          <td style="border:none;padding:2px 0;color:#1e293b;"><b>Location:</b> ${escapeHtml(est.location || "—")}</td>
          <td style="border:none;padding:2px 0;color:#1e293b;"><b>Site 2:</b> ${escapeHtml(est.location2 || est.sub_location || "—")}</td>
          <td style="border:none;padding:2px 0;text-align:right;color:#1e293b;"><b>End User:</b> ${escapeHtml(est.endUser || est.end_user || "—")}</td>
        </tr>
        <tr>
          <td colspan="3" style="border:none;padding:4px 0;color:#0f172a;font-size:11.5px;border-top:1px dashed #cbd5e1;margin-top:3px;">
            <b>Description / Scope:</b> ${escapeHtml(est.description || est.workScope || "—")}
            ${est.approvedAuthority ? ` &nbsp;|&nbsp; <b>Approval Authority:</b> ${escapeHtml(est.approvedAuthority)}` : ""}
          </td>
        </tr>
      </table>

      ${sectionsHtml}

      <!-- Grand Summary Bar -->
      <div style="margin-top:12px;border:1.5px solid #0f172a;border-radius:6px;padding:8px 12px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;page-break-inside:avoid;">
        <span>Materials: <strong style="color:#059669;font-family:monospace;">Rs. ${formatCurrency(est.total_cost || 0)}</strong></span>
        <span>Labor: <strong style="color:#2563eb;">${est.totalManDays || est.manDays || 0} Man-Days</strong></span>
        <span>Grand Total: <strong style="color:#b45309;font-weight:900;font-family:monospace;font-size:13px;">Rs. ${formatCurrency(est.total_cost || 0)}</strong></span>
      </div>

      <!-- Signatures -->
      ${sigSection}
    </div>`;
}

function exportCurrentEstimatePDFMobile(specificKey) {
  const estKey = specificKey || mlStore.selectedEstKey;
  if (!estKey) {
    showLightToast("Please open an estimate first", "⚠️");
    return;
  }
  const est = (mlStore.estimates || []).find(e => String(e._fbKey) === String(estKey) || String(e.id) === String(estKey));
  if (!est) {
    showLightToast("Estimate details not found", "❌");
    return;
  }

  // Show sleek overlay spinner
  let overlay = document.getElementById("mlPdfLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mlPdfLoadingOverlay";
    overlay.className = "fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center border border-slate-200">
        <div class="w-9 h-9 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="font-bold text-slate-800 text-xs sm:text-sm">PDF එක සකස් වෙමින් පවතී...</p>
        <p class="text-[10px] text-slate-500">Generating PDF, please wait...</p>
      </div>`;
    document.body.appendChild(overlay);
  } else {
    overlay.classList.remove("hidden");
  }

  let tempDiv = null;
  let watchdogTimer = null;
  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    if (overlay && document.body.contains(overlay)) {
      overlay.remove();
    }
    if (tempDiv && document.body.contains(tempDiv)) {
      tempDiv.remove();
    }
  };

  watchdogTimer = setTimeout(() => {
    cleanup();
    showLightToast("PDF generation timed out. Opening Print view...", "⚠️");
    printCurrentEstimateMobile(estKey);
  }, 15000);

  loadHtml2PdfMobile(() => {
    try {
      tempDiv = document.createElement("div");
      // Place offscreen to prevent UI trapping
      tempDiv.style.position = "fixed";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "0";
      tempDiv.style.width = "794px";
      tempDiv.style.zIndex = "-9999";
      tempDiv.style.backgroundColor = "#ffffff";
      tempDiv.innerHTML = `
        <style>
          .est-table th { border: 1px solid #94a3b8; padding: 4px 6px; background: #f1f5f9; text-align: left; font-size: 10px; font-weight: bold; color: #0f172a; }
          .est-table td { border: 1px solid #cbd5e1; padding: 4px 6px; word-wrap: break-word; font-size: 10px; color: #1e293b; }
        </style>
        ${buildEstimatePrintHTMLMobile(est)}
      `;
      document.body.appendChild(tempDiv);

      const safeNumber = (est.estimate_number || "EST").replace(/[^a-zA-Z0-9]/g, "_");
      const opt = {
        margin: [8, 10, 8, 10],
        filename: `Estimate_${safeNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: 794,
          width: 794,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      html2pdf()
        .set(opt)
        .from(tempDiv)
        .save()
        .then(() => {
          cleanup();
          showLightToast("PDF exported successfully! ✅", "✅");
        })
        .catch(err => {
          console.error("PDF Export Error:", err);
          cleanup();
          showLightToast("Direct download failed. Opening Print view...", "⚠️");
          printCurrentEstimateMobile(estKey);
        });
    } catch (renderErr) {
      console.error("Error setting up Estimate PDF:", renderErr);
      cleanup();
      printCurrentEstimateMobile(estKey);
    }
  }, () => {
    cleanup();
    printCurrentEstimateMobile(estKey);
  });
}

function printCurrentEstimateMobile(specificKey) {
  const estKey = specificKey || mlStore.selectedEstKey;
  if (!estKey) return;
  const est = (mlStore.estimates || []).find(e => String(e._fbKey) === String(estKey) || String(e.id) === String(estKey));
  if (!est) return;

  const printWin = window.open("", "_blank");
  if (!printWin) {
    window.print();
    return;
  }
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(est.estimate_number || "Estimate")}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body { margin: 0; padding: 12px; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .est-table th { border: 1px solid #94a3b8; padding: 4px 6px; background: #f1f5f9; text-align: left; font-size: 10px; font-weight: bold; color: #0f172a; }
        .est-table td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 10px; color: #1e293b; }
      </style>
    </head>
    <body>
      ${buildEstimatePrintHTMLMobile(est)}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// ── SAILOR CLASSIFICATION FOR ZONE DAILY DETAILS SUMMARY TABLE ──
function classifySailorForSummary(s, isInCharge) {
  if (!s) return "MA";
  const r = (s.rank || "").toUpperCase().trim();
  const t = (s.trade || "").toUpperCase().trim();

  // 1. PO: Petty Officer / Chief Petty Officer / Fleet Chief / Master Chief Artificer / Chief Artificer
  if (r.includes("PO") || r.includes("CHIEF") || r.includes("MCA") || r.includes("CA (CE)")) {
    return "PO";
  }

  // 2. LME: If rank is LME and (is actual In-Charge of the zone, OR trade is empty / N/A / CE / LME)
  if (r.includes("LME")) {
    if (isInCharge || !t || t === "CE" || t === "LME" || t === "N/A" || t === "—" || t === "-") {
      return "LME";
    }
  }

  // 3. Trade Columns (Pic - 03: MA, PA, CA, AL, SW, PL, WE, BB, WR)
  if (t === "MA" || t === "MASON") return "MA";
  if (t === "PA" || t === "PAINTER") return "PA";
  if (t === "CA" || t === "CARPENTER") return "CA";
  if (t === "AL" || t.includes("ALUM")) return "AL";
  if (t === "SW" || t.includes("SIGN")) return "SW";
  if (t === "PL" || t === "PLUMBER") return "PL";
  if (t === "WE" || t === "WEL" || t === "WL" || t === "WELDER") return "WE";
  if (t === "BB" || t.includes("BEND")) return "BB";
  if (t === "WR" || t === "RW" || t.includes("WIRE")) return "WR";

  // 4. Fallback: If rank is LME, classify as LME, else default to MA
  if (r.includes("LME")) return "LME";
  return "MA";
}

// ── DAILY ZONE WORK ORDERS PDF EXPORT FOR HOME SCREEN (ON-DEMAND / ZERO-LAG) ──
function buildZoneDailyWorkOrdersHTMLMobile(zoneId, targetDate) {
  const selectedZone = zoneId || mlStore.currentZone || "A-Zone";
  const dateVal = targetDate || mlStore.selectedDate || getLocalDateString();
  const isAll = String(selectedZone).toUpperCase() === "ALL";

  let zones = [];
  if (isAll) {
    zones = [...STANDARD_ZONES];
    if (!zones.some(z => isAdminStaffDuties(z.id || z.name))) {
      zones.push({ id: "Admin-&-Staff-Duties", name: "Admin & Staff Duties" });
    }
  } else {
    const zObj = STANDARD_ZONES.find(
      (z) => z.id === selectedZone || z.name === selectedZone || isZoneMatch(z.id, selectedZone)
    );
    if (zObj) {
      zones.push(zObj);
    } else {
      zones.push({ id: selectedZone, name: formatZoneDisplayName(selectedZone) || selectedZone });
    }
  }

  // Summary counts for all unique sailors in the report
  const seenReportSailorKeys = new Set();
  const reportSailorCounts = {
    PO: 0, LME: 0, MA: 0, PA: 0, CA: 0, AL: 0, SW: 0, PL: 0, WE: 0, BB: 0, WR: 0
  };
  let totalReportStrength = 0;

  let rowsHtml = "";
  zones.forEach((z) => {
    const isZoneMatchLocal = (zField) => {
      if (!zField) return false;
      if (isAdminStaffDuties(z.id)) return isAdminStaffDuties(zField);
      return isZoneMatch(zField, z.id);
    };

    const allWorks = [
      ...(mlStore.workOrders || []).filter(
        (wo) => isZoneMatchLocal(wo.zone_id || wo.zone || wo.zoneId || wo.zone_name || wo.location_zone || wo.location) && isWorkOrderActiveOnDate(wo, dateVal)
      ),
      ...(mlStore.jobCards || []).filter(
        (jc) => isZoneMatchLocal(jc.zone_id || jc.zone || jc.zoneId || jc.zone_name || jc.location_zone || jc.location) && isWorkOrderActiveOnDate(jc, dateVal)
      )
    ];

    // Guarantee that any work orders/job cards that have daily allocations on dateVal for this zone are included
    (mlStore.dailyAllocations || []).forEach(a => {
      if (!a || a.date !== dateVal || a.status === "Cancelled") return;
      const aZone = a.zone_id || a.zone || a.zone_name || a.location;
      const isZoneAlloc = isZoneMatchLocal(aZone);
      const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
      const aDesc = String(a.description || a.task_name || a.work_order_name || "").trim().toLowerCase();

      if (aWoId) {
        const foundWo = (mlStore.workOrders || []).find(w => String(w.id) === aWoId || String(w._fbKey) === aWoId);
        if (foundWo && (isZoneAlloc || isZoneMatchLocal(foundWo.zone_id || foundWo.zone))) {
          allWorks.push(foundWo);
        }
        const foundJc = (mlStore.jobCards || []).find(j => String(j.id) === aWoId || String(j._fbKey) === aWoId);
        if (foundJc && (isZoneAlloc || isZoneMatchLocal(foundJc.zone_id || foundJc.zone))) {
          allWorks.push(foundJc);
        }
      }
      if (isZoneAlloc && aDesc) {
        const foundByDesc = (mlStore.workOrders || []).find(w => String(w.description || "").trim().toLowerCase() === aDesc);
        if (foundByDesc) allWorks.push(foundByDesc);
      }
    });

    const seenWorkIds = new Set();
    const wos = allWorks.filter((w) => {
      const wid = String(w.id || w._fbKey || "");
      if (!wid || seenWorkIds.has(wid)) return false;
      seenWorkIds.add(wid);
      return true;
    });

    wos.sort((a, b) => {
      const aInCharge = (a.description || a.title || "").toLowerCase().includes("in charge") || a.assign_type === "In Charge";
      const bInCharge = (b.description || b.title || "").toLowerCase().includes("in charge") || b.assign_type === "In Charge";
      if (aInCharge && !bInCharge) return -1;
      if (!aInCharge && bInCharge) return 1;
      return 0;
    });

    let zoneRowsHtml = "";
    wos.forEach((wo) => {
      const { sailors } = getWorkOrderAssignedSailors(wo, dateVal);
      if (sailors && sailors.length > 0) {
        const isActualInCharge = (wo.description || "").toLowerCase().trim() === "in charge";
        const workTitle = (wo.description || wo.title || wo.reference_no || wo.job_no || "Active Work").trim();
        zoneRowsHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
              📋 ${escapeHtml(workTitle.toUpperCase())}
            </td>
          </tr>
        `;
        sailors.forEach((s, idx) => {
          const serNo = String(idx + 1).padStart(2, "0");
          const parsedOffNo = parseOfficialNumber(
            s.official_number || s.service_no || s.offNo || s.off_no || ""
          );
          zoneRowsHtml += `
            <tr>
              <td style="text-align:center;">${serNo}</td>
              <td>${escapeHtml(s.rank || "AB")}</td>
              <td>${escapeHtml(s.name || "")}</td>
              <td style="text-align:center;">${escapeHtml(parsedOffNo.type)}</td>
              <td>${escapeHtml(parsedOffNo.num)}</td>
              <td style="text-align:center;">${escapeHtml(s.trade || "—")}</td>
            </tr>
          `;

          // Tally unique sailors for the strength summary table
          const sKey = String(s.id || s._fbKey || s.official_number || s.service_no || s.name || "");
          if (sKey && !seenReportSailorKeys.has(sKey)) {
            seenReportSailorKeys.add(sKey);
            const col = classifySailorForSummary(s, isActualInCharge);
            if (reportSailorCounts[col] !== undefined) {
              reportSailorCounts[col]++;
            } else {
              reportSailorCounts.MA++;
            }
            totalReportStrength++;
          }
        });
      }
    });

    // Check for standalone zone allocations that don't have a matched work order
    const standaloneAllocs = (mlStore.dailyAllocations || []).filter(a => {
      if (!a || a.date !== dateVal || a.status === "Cancelled") return false;
      const aZone = a.zone_id || a.zone || a.zone_name || a.location;
      if (!isZoneMatchLocal(aZone)) return false;
      const aWoId = String(a.work_order_id || a.workOrderId || a.work_order || a.wo_id || "");
      const matched = wos.some(w => String(w.id) === aWoId || String(w._fbKey) === aWoId);
      return !matched;
    });

    if (standaloneAllocs.length > 0) {
      const standaloneGroups = {};
      standaloneAllocs.forEach(a => {
        const desc = a.description || a.task_name || "General Duties";
        if (!standaloneGroups[desc]) standaloneGroups[desc] = [];
        standaloneGroups[desc].push(a);
      });

      Object.entries(standaloneGroups).forEach(([desc, grpAllocs]) => {
        const grpSailors = [];
        grpAllocs.forEach(a => {
          const sid = a.sailor_id || a.sailorId || a.official_number || a.offNo || "";
          if (sid) {
            const s = findSailor(sid);
            if (s && !grpSailors.some(gs => String(gs.id || gs._fbKey) === String(s.id || s._fbKey))) {
              grpSailors.push(s);
            }
          }
        });

        if (grpSailors.length > 0) {
          zoneRowsHtml += `
            <tr style="background-color: #f1f5f9; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
                📋 ${escapeHtml(desc.toUpperCase())}
              </td>
            </tr>
          `;
          grpSailors.forEach((s, idx) => {
            const serNo = String(idx + 1).padStart(2, "0");
            const parsedOffNo = parseOfficialNumber(
              s.official_number || s.service_no || s.offNo || s.off_no || ""
            );
            zoneRowsHtml += `
              <tr>
                <td style="text-align:center;">${serNo}</td>
                <td>${escapeHtml(s.rank || "AB")}</td>
                <td>${escapeHtml(s.name || "")}</td>
                <td style="text-align:center;">${escapeHtml(parsedOffNo.type)}</td>
                <td>${escapeHtml(parsedOffNo.num)}</td>
                <td style="text-align:center;">${escapeHtml(s.trade || "—")}</td>
              </tr>
            `;

            const sKey = String(s.id || s._fbKey || s.official_number || s.service_no || s.name || "");
            if (sKey && !seenReportSailorKeys.has(sKey)) {
              seenReportSailorKeys.add(sKey);
              const col = classifySailorForSummary(s, false);
              if (reportSailorCounts[col] !== undefined) {
                reportSailorCounts[col]++;
              } else {
                reportSailorCounts.MA++;
              }
              totalReportStrength++;
            }
          });
        }
      });
    }

    if (zoneRowsHtml) {
      const zoneDisplayName = formatZoneDisplayName(z.name || z.id) || (z.name || z.id);
      rowsHtml += `
        <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <td colspan="6" style="padding: 8px 12px; font-size: 13px; text-transform: uppercase; color: #ffffff;">
            🗺️ ZONE: ${escapeHtml(zoneDisplayName.toUpperCase())}
          </td>
        </tr>
        ${zoneRowsHtml}
      `;
    }
  });

  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No allocations found for this selection on this date.</td></tr>`;
  }

  // Build dynamic summary table showing ONLY relevant categories for this zone/date
  let summaryHtml = "";
  const STANDARD_SUMMARY_COLS = ["PO", "LME", "MA", "PA", "CA", "AL", "SW", "PL", "WE", "BB", "WR"];
  const activeCols = STANDARD_SUMMARY_COLS.filter(col => (reportSailorCounts[col] || 0) > 0);
  Object.keys(reportSailorCounts).forEach(k => {
    if (reportSailorCounts[k] > 0 && !activeCols.includes(k)) {
      activeCols.push(k);
    }
  });

  if (activeCols.length > 0) {
    const colWidth = (100 / (activeCols.length + 1)).toFixed(2);
    const ths = activeCols.map(col => `<th style="width: ${colWidth}%;">${escapeHtml(col)}</th>`).join("") + `<th style="width: ${colWidth}%;" class="summary-total">TOTAL</th>`;
    const tds = activeCols.map(col => `<td>${String(reportSailorCounts[col] || 0).padStart(2, "0")}</td>`).join("") + `<td class="summary-total">${String(totalReportStrength || 0).padStart(2, "0")}</td>`;

    summaryHtml = `
      <!-- ZONE STRENGTH SUMMARY TABLE (DYNAMIC ACTIVE CATEGORIES ONLY) -->
      <div class="daily-details-summary">
        <table>
          <thead>
            <tr>${ths}</tr>
          </thead>
          <tbody>
            <tr>${tds}</tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const scopeLabel = isAll ? "ALL ZONES" : "ZONE: " + (formatZoneDisplayName(selectedZone) || selectedZone).toUpperCase();
  const logoSrc = "logo.png";

  return `
    <div class="daily-details-wrapper" style="font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 14px; background: #ffffff; max-width: 820px; margin: 0 auto; box-sizing: border-box;">
      <style>
        .daily-details-header { display: flex; align-items: center; justify-content: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
        .daily-details-logo { height: 65px; margin-right: 18px; }
        .daily-details-title { text-align: left; }
        .daily-details-title h1 { font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .daily-details-title h2 { font-size: 11px; font-weight: 700; color: #475569; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .daily-details-meta { display: flex; justify-content: space-between; font-size: 10px; color: #334155; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .daily-details-meta-left { font-weight: bold; line-height: 1.5; }
        .daily-details-meta-right { text-align: right; line-height: 1.5; }
        
        .daily-details-table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 10px; }
        .daily-details-table th, .daily-details-table td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; vertical-align: middle; }
        .daily-details-table th { background: #f1f5f9; color: #1e293b; font-weight: bold; text-transform: uppercase; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        
        .daily-details-summary { margin-top: 18px; margin-bottom: 22px; page-break-inside: avoid; }
        .daily-details-summary table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; border: 1.5px solid #0f172a; table-layout: fixed; }
        .daily-details-summary th, .daily-details-summary td { border: 1px solid #0f172a; padding: 6px 4px; text-align: center; vertical-align: middle; }
        .daily-details-summary th { background-color: #f8fafc; color: #0f172a; font-weight: 700; font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .daily-details-summary td { font-weight: 700; font-size: 11px; color: #0f172a; }
        .daily-details-summary .summary-total { background-color: #f1f5f9; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        .daily-details-signatures { margin-top: 25px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid; }
        .daily-details-sig { text-align: center; width: 220px; }
        .daily-details-sig p { margin: 2px 0; }
        
        .daily-details-footer { margin-top: 35px; font-size: 9px; color: #64748b; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>

      <div class="daily-details-header">
        <img class="daily-details-logo" src="${logoSrc}" alt="SLN Crest" onerror="this.src='logo.png'">
        <div class="daily-details-title">
          <h1>Sri Lanka Navy</h1>
          <h2>Captain Civil Engineering Department (E)</h2>
        </div>
      </div>
      
      <div class="daily-details-meta">
        <div class="daily-details-meta-left">
          <div>REPORT: DAILY DETAILS REPORT</div>
          <div>SCOPE: ${escapeHtml(scopeLabel)}</div>
        </div>
        <div class="daily-details-meta-right">
          <div>DATE: ${escapeHtml(dateVal)}</div>
          <div>GENERATED BY: NCW OPERATION SYSTEM</div>
        </div>
      </div>

      <table class="daily-details-table">
        <thead>
          <tr>
            <th style="width: 10%; text-align:center;">Ser No</th>
            <th style="width: 15%;">Rank</th>
            <th style="width: 35%;">Name</th>
            <th style="width: 15%; text-align:center;">Service Type</th>
            <th style="width: 15%;">Service No</th>
            <th style="width: 10%; text-align:center;">Trade</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      
      ${summaryHtml}

      <div class="daily-details-signatures">
        <div class="daily-details-sig">
          <p>..................................................</p>
          <p style="font-weight: bold;">PREPARED BY - LME</p>
        </div>
        <div class="daily-details-sig">
          <p>..................................................</p>
          <p style="font-weight: bold;">CHECKED BY (S/S INCHARGE)</p>
        </div>
        <div class="daily-details-sig">
          <p>..................................................</p>
          <p style="font-weight: bold;">CHECKED BY</p>
        </div>
      </div>

      <div class="daily-details-footer">Generated by NCW Operation System on ${new Date().toLocaleString()}</div>
    </div>
  `;
}

function getDailyDetailsReportTitle(zoneId, targetDate) {
  const selectedZone = zoneId || mlStore.currentZone || "A-Zone";
  const dateVal = targetDate || mlStore.selectedDate || getLocalDateString();
  const isAll = String(selectedZone).toUpperCase() === "ALL";
  const zoneDisplayName = isAll ? "ALL ZONES" : (formatZoneDisplayName(selectedZone) || selectedZone);
  return `${zoneDisplayName} | Daily Details | ${dateVal}`;
}

function updateDocumentTitleMobile(zoneId, targetDate) {
  const title = getDailyDetailsReportTitle(zoneId, targetDate);
  document.title = title;
  const titleEl = document.querySelector("title");
  if (titleEl) {
    titleEl.textContent = title;
  }
}

function openDailyReportPrintMobile() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const reportHtml = buildZoneDailyWorkOrdersHTMLMobile(currentZone, targetDate);

  const container = document.getElementById("mlPrintReportArea");
  if (container) {
    container.innerHTML = `
      <!-- In-Report Top Action Bar (Always visible on mobile screen, never pushed off-screen) -->
      <div class="no-print sticky top-0 z-20 mb-3 p-2 bg-slate-900 text-white rounded-xl border border-slate-700 shadow-md flex items-center justify-between gap-2 max-w-full" style="box-sizing: border-box;">
        <button type="button" onclick="closeDailyReportPrintMobile()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 active-scale border border-slate-700 shadow-xs shrink-0">
          <span>⬅️</span>
          <span class="hidden xs:inline">Dashboard</span>
        </button>
        <div class="flex items-center gap-1.5 shrink-0 ml-auto">
          <button type="button" onclick="exportZoneDailyWorkOrdersPDFMobile()" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs active-scale">
            <span>📥</span>
            <span>PDF</span>
          </button>
          <button type="button" onclick="closeDailyReportPrintMobile()" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1 shadow-md active-scale" title="Close Report">
            <span class="text-sm">✕</span>
            <span>Close</span>
          </button>
        </div>
      </div>
      <!-- Scrollable Report Table Wrapper (Allows table to scroll horizontally without breaking screen layout) -->
      <div class="report-table-scroll-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
        ${reportHtml}
      </div>
      <!-- In-Report Bottom Action Bar -->
      <div class="no-print mt-4 p-2.5 bg-slate-900 text-white rounded-xl border border-slate-700 shadow-md flex items-center justify-between gap-2 max-w-full" style="box-sizing: border-box;">
        <button type="button" onclick="closeDailyReportPrintMobile()" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 active-scale border border-slate-700 shadow-xs shrink-0">
          <span>⬅️</span>
          <span>Dashboard</span>
        </button>
        <div class="flex items-center gap-2 shrink-0 ml-auto">
          <button type="button" onclick="triggerNativePrintMobile()" class="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1 active-scale">
            <span>🖨️</span> Print
          </button>
          <button type="button" onclick="exportZoneDailyWorkOrdersPDFMobile()" class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs active-scale">
            <span>📥</span> Export PDF
          </button>
          <button type="button" onclick="closeDailyReportPrintMobile()" class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1 shadow-md active-scale" title="Close Report">
            <span class="text-sm">✕</span> Close
          </button>
        </div>
      </div>
    `;
  }

  const printTitle = getDailyDetailsReportTitle(currentZone, targetDate);
  const isAll = String(currentZone).toUpperCase() === "ALL";
  const zoneDisplayName = isAll ? "ALL ZONES" : (formatZoneDisplayName(currentZone) || currentZone);

  // Update modal header title text
  const titleEl = document.getElementById("mlPrintModalTitle");
  if (titleEl) titleEl.textContent = `${zoneDisplayName} - Daily Details`;
  const subEl = document.getElementById("mlPrintModalSubtitle");
  if (subEl) subEl.textContent = `${targetDate} • Print / Export Preview`;

  // Synchronize document title to requested format: "Zone or workshop name | Daily Details | Date"
  updateDocumentTitleMobile(currentZone, targetDate);

  const modal = document.getElementById("mlPrintPreviewModal");
  if (modal) {
    modal.style.removeProperty("display");
    modal.classList.remove("hidden");
  }

  // Push state to browser history so mobile hardware/gesture Back button closes the modal instead of exiting the app
  try {
    history.pushState({ modal: "dailyPrintPreview" }, "", window.location.href);
  } catch (e) {}
}

function closeDailyReportPrintMobile(triggeredByPopstate = false) {
  const modal = document.getElementById("mlPrintPreviewModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.setProperty("display", "none", "important");
    setTimeout(() => {
      modal.style.removeProperty("display");
    }, 200);
  }

  // Cleanly pop history state if closed by button click (not popstate)
  if (!triggeredByPopstate && history.state && history.state.modal === "dailyPrintPreview") {
    try {
      history.back();
    } catch (e) {}
  }
}

function triggerNativePrintMobile() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const printTitle = getDailyDetailsReportTitle(currentZone, targetDate);
  const reportHtml = buildZoneDailyWorkOrdersHTMLMobile(currentZone, targetDate);

  updateDocumentTitleMobile(currentZone, targetDate);

  // Use isolated hidden iframe for printing to prevent main window from entering @media print and hiding UI
  let printFrame = document.getElementById("mlPrintHiddenIframe");
  if (!printFrame) {
    printFrame = document.createElement("iframe");
    printFrame.id = "mlPrintHiddenIframe";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "10px";
    printFrame.style.height = "10px";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0.01";
    printFrame.style.pointerEvents = "none";
    printFrame.style.zIndex = "-9999";
    document.body.appendChild(printFrame);
  }

  try {
    const doc = printFrame.contentDocument || printFrame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(printTitle)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 12px; background: #ffffff; color: #000000; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body { padding: 0 !important; margin: 0 !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${reportHtml}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.warn("Iframe print error, falling back to window.print():", e);
        window.print();
      }
    }, 250);
  } catch (err) {
    console.warn("Iframe setup error, fallback to direct print:", err);
    window.print();
  }
}

function openDailyReportInNewWindowMobile() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const printTitle = getDailyDetailsReportTitle(currentZone, targetDate);
  const reportHtml = buildZoneDailyWorkOrdersHTMLMobile(currentZone, targetDate);

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(printTitle)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 0; background: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .tab-header { position: sticky; top: 0; z-index: 9999; background: #0f172a; color: white; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .tab-body { padding: 12px; max-width: 860px; margin: 0 auto; background: #ffffff; }
      @media print {
        @page { size: A4 portrait; margin: 8mm; }
        .tab-no-print { display: none !important; }
        body { background: #ffffff !important; padding: 0 !important; }
        .tab-body { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    </style>
  </head>
  <body>
    <div class="tab-header tab-no-print">
      <button onclick="if(window.opener){window.close();}else{window.location.href='mobile-beta.html';}" style="background: #1e293b; color: #f8fafc; border: 1px solid #334155; padding: 7px 14px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        ⬅️ Dashboard වෙත ආපසු
      </button>
      <div style="font-weight: bold; font-size: 11px; color: #38bdf8; text-align: center; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${escapeHtml(printTitle)}
      </div>
      <div style="display: flex; gap: 6px;">
        <button onclick="window.print()" style="background: #0d9488; color: white; border: none; padding: 7px 14px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          🖨️ Print
        </button>
        <button onclick="window.close()" style="background: #e11d48; color: white; border: none; padding: 7px 14px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer;">
          ✕ වසන්න
        </button>
      </div>
    </div>
    <div class="tab-body">
      ${reportHtml}
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() {
          try { window.print(); } catch (e) {}
        }, 400);
      };
    <\/script>
  </body>
</html>`);
    win.document.close();
    win.focus();
  } else {
    triggerNativePrintMobile();
  }
}

// Backward compatibility aliases
function printZoneDailyWorkOrdersMobile() {
  openDailyReportPrintMobile();
}

// ── ON-DEMAND DIRECT DAILY DETAILS PDF EXPORT WITH EXACT FILENAME ──
function exportZoneDailyWorkOrdersPDFMobile() {
  const currentZone = mlStore.currentZone;
  const targetDate = mlStore.selectedDate || getLocalDateString();
  const printTitle = getDailyDetailsReportTitle(currentZone, targetDate);

  updateDocumentTitleMobile(currentZone, targetDate);

  // Show sleek overlay spinner
  let overlay = document.getElementById("mlPdfLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mlPdfLoadingOverlay";
    overlay.className = "fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center border border-slate-200">
        <div class="w-9 h-9 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="font-bold text-slate-800 text-xs sm:text-sm">Daily Details PDF එක සකස් වෙමින් පවතී...</p>
        <p class="text-[10px] text-slate-500">Generating PDF, please wait...</p>
      </div>`;
    document.body.appendChild(overlay);
  } else {
    overlay.classList.remove("hidden");
  }

  let tempDiv = null;
  let watchdogTimer = null;
  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    if (overlay && document.body.contains(overlay)) {
      overlay.remove();
    }
    if (tempDiv && document.body.contains(tempDiv)) {
      tempDiv.remove();
    }
  };

  // 15-second watchdog timer in case html2pdf / html2canvas hangs
  watchdogTimer = setTimeout(() => {
    console.warn("Daily Details PDF generation timed out after 15s. Switching to native print.");
    cleanup();
    showLightToast("PDF generation timed out. Opening Print dialog...", "⚠️");
    triggerNativePrintMobile();
  }, 15000);

  loadHtml2PdfMobile(() => {
    try {
      const reportHtml = buildZoneDailyWorkOrdersHTMLMobile(currentZone, targetDate);
      tempDiv = document.createElement("div");
      // Place completely offscreen so it NEVER blocks or covers the mobile UI
      tempDiv.style.position = "fixed";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "0";
      tempDiv.style.width = "794px";
      tempDiv.style.zIndex = "-9999";
      tempDiv.style.backgroundColor = "#ffffff";
      tempDiv.innerHTML = `
        <style>
          body { margin: 0; padding: 12px; background: #ffffff; }
          table { border-collapse: collapse; width: 100%; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
        ${reportHtml}
      `;
      document.body.appendChild(tempDiv);

      // Format requested: "[Zone or workshop name] | Daily Details | [Date].pdf"
      const safeZone = String(formatZoneDisplayName(currentZone) || currentZone).replace(/[/\\:*?"<>]/g, "");
      const safeDate = String(targetDate).replace(/[/\\:*?"<>]/g, "-");
      const rawFileName = `${safeZone} | Daily Details | ${safeDate}.pdf`;

      const opt = {
        margin: [6, 8, 6, 8],
        filename: rawFileName,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: 794,
          width: 794,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      html2pdf()
        .set(opt)
        .from(tempDiv)
        .save()
        .then(() => {
          cleanup();
          showLightToast("PDF Exported: " + rawFileName, "✅");
        })
        .catch(err => {
          console.error("Daily Report PDF Export Error:", err);
          cleanup();
          showLightToast("Direct download failed. Opening Print dialog...", "⚠️");
          triggerNativePrintMobile();
        });
    } catch (renderErr) {
      console.error("Error setting up Daily Report PDF:", renderErr);
      cleanup();
      showLightToast("PDF error. Opening Print dialog...", "⚠️");
      triggerNativePrintMobile();
    }
  }, () => {
    // onError handler from loadHtml2PdfMobile
    cleanup();
    triggerNativePrintMobile();
  });
}

// ── SIGNATORY AUTOCOMPLETE FOR MOBILE (FIND & SEARCH) ──
function setupMobileSignatoryAutocomplete(prefix) {
  const nameInput = document.getElementById(`mlEst${prefix}Name`);
  const rankInput = document.getElementById(`mlEst${prefix}Rank`);
  const svcInput = document.getElementById(`mlEst${prefix}Svc`);
  const dropdown = document.getElementById(`mlSigDropdown_${prefix}`);
  if (!nameInput || !dropdown) return;

  let isInteractingWithDropdown = false;
  dropdown.onpointerdown = () => { isInteractingWithDropdown = true; };
  dropdown.onpointerup = () => { setTimeout(() => { isInteractingWithDropdown = false; }, 400); };
  dropdown.onmousedown = (e) => e.preventDefault();

  const closeDropdown = () => {
    dropdown.classList.add("hidden");
  };

  const renderResults = (query) => {
    const q = (query || "").trim().toLowerCase();
    let items = [];

    if (prefix === "Created") {
      items = (mlStore.sailors || []).map(s => {
        const off = s.official_number || s.off_no || s.service_no || "";
        const rank = s.rank || s.trade || "Sailor";
        return {
          name: s.name || off,
          rank: rank,
          svc: off,
          label: `${rank} ${s.name || off}`,
          sub: `${off} • ${s.trade || "Sailor"}`,
          badge: s.trade || "Sailor",
          badgeColor: "bg-blue-100 text-blue-800"
        };
      });
    } else if (prefix === "Checked") {
      const incMap = mlStore.zoneInCharges || {};
      Object.values(incMap).forEach(inc => {
        if (inc && inc.name) {
          items.push({
            name: inc.name,
            rank: inc.rank || "In-Charge",
            svc: inc.service_no || inc.official_number || "",
            label: inc.name,
            sub: `${inc.rank || "In-Charge"} • ${inc.service_no || ""} (Zone In-Charge)`,
            badge: "In-Charge",
            badgeColor: "bg-amber-100 text-amber-800"
          });
        }
      });
      (mlStore.sailors || []).forEach(s => {
        const off = s.official_number || s.off_no || s.service_no || "";
        const rank = s.rank || s.trade || "Staff";
        items.push({
          name: s.name || off,
          rank: rank,
          svc: off,
          label: `${rank} ${s.name || off}`,
          sub: `${off} • ${s.trade || "Staff"}`,
          badge: s.trade || "Staff",
          badgeColor: "bg-slate-100 text-slate-700"
        });
      });
    } else if (prefix === "Approved") {
      items.push({
        name: "",
        rank: "",
        svc: "",
        label: "🚫 Clear / Leave Blank",
        sub: "No approval signature required (Keep blank)",
        badge: "Blank",
        badgeColor: "bg-slate-100 text-slate-500"
      });

      const ceOfficersList = [
        { rank: "CAPTAIN (CE)", name: "BGL BALASURIYA", svc: "NRC 1843", desig: "CCED(E)" },
        { rank: "CDR (CE)", name: "TM VITHARANA", svc: "NRC 2541", desig: "CCEO(E)" },
        { rank: "LCDR (CE)", name: "JAJD SENARATHNA", svc: "NRC 3068", desig: "SCE(M)" },
        { rank: "LCDR (CE)", name: "JATK JAYAKODI", svc: "NRC 3542", desig: "SCE(P&P)" },
        { rank: "LCDR (CE)", name: "KMAU KAHANDAWA", svc: "NRC 3576", desig: "SCE(W/W)" },
        { rank: "LCDR (CE)", name: "HMMI JAYATHUNGA", svc: "NRC 3977", desig: "CE (W/W), CE (P&P)" },
        { rank: "LT (CE)", name: "WP DARSHANA", svc: "NRC 4126", desig: "QS (E)" },
        { rank: "LT (CE)", name: "JADU JAYASINGHE", svc: "NRC 4310", desig: "CE(M) I" },
        { rank: "LT (CE)", name: "PHKR KUMARA", svc: "NRC 4570", desig: "CE(M) II" },
      ];

      ceOfficersList.forEach(off => {
        items.push({
          name: off.name,
          rank: off.rank,
          svc: `${off.svc} - ${off.desig}`,
          label: `${off.rank} ${off.name}`,
          sub: `${off.svc} • ${off.desig}`,
          badge: off.desig,
          badgeColor: "bg-emerald-100 text-emerald-800"
        });
      });

      (mlStore.sailors || []).forEach(s => {
        const r = String(s.rank || "").toUpperCase();
        if (r.includes("LT") || r.includes("CDR") || r.includes("CAPT") || r.includes("OIC")) {
          const off = s.official_number || s.off_no || s.service_no || "";
          items.push({
            name: s.name,
            rank: s.rank || "Officer",
            svc: off,
            label: `${s.rank || "Officer"} ${s.name}`,
            sub: `${off} • Officer`,
            badge: "Officer",
            badgeColor: "bg-teal-100 text-teal-800"
          });
        }
      });

      (mlStore.users || []).forEach(u => {
        if (u.role === "Admin" || u.role === "Officer" || (u.rank && String(u.rank).toUpperCase().includes("LT"))) {
          items.push({
            name: u.name,
            rank: u.rank || "Officer",
            svc: u.serviceNo || u.official_number || "",
            label: `${u.rank || ""} ${u.name}`.trim(),
            sub: `${u.rank || "Officer"} • ${u.serviceNo || u.official_number || ""}`,
            badge: "Officer",
            badgeColor: "bg-teal-100 text-teal-800"
          });
        }
      });
    }

    if (q) {
      items = items.filter(it => {
        const haystack = `${it.name} ${it.rank} ${it.svc} ${it.sub} ${it.label}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    const seen = new Set();
    items = items.filter(it => {
      const key = `${it.name}_${it.svc}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const visibleItems = items.slice(0, 30);
    if (visibleItems.length === 0) {
      dropdown.innerHTML = `<div class="p-2.5 text-center text-slate-400 italic text-[11px]">No matches found (type freely)</div>`;
    } else {
      dropdown.innerHTML = visibleItems.map((it, idx) => `
        <div class="p-2 hover:bg-teal-50 active:bg-teal-100 cursor-pointer flex items-center justify-between gap-1 transition-colors" data-sig-idx="${idx}">
          <div class="min-w-0 flex-1 pointer-events-none">
            <p class="font-bold text-slate-800 text-xs truncate">${escapeHtml(it.label)}</p>
            <p class="text-[10px] text-slate-500 font-mono truncate">${escapeHtml(it.sub)}</p>
          </div>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${it.badgeColor} shrink-0 pointer-events-none">${escapeHtml(it.badge)}</span>
        </div>
      `).join("");
    }

    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll("[data-sig-idx]").forEach(el => {
      const onSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(el.getAttribute("data-sig-idx"), 10);
        const item = visibleItems[idx];
        if (item) {
          nameInput.value = item.name || "";
          if (rankInput) rankInput.value = item.rank || "";
          if (svcInput) svcInput.value = item.svc || "";
          closeDropdown();
        }
      };
      el.onmousedown = onSelect;
      el.ontouchend = onSelect;
      el.onclick = onSelect;
    });
  };

  nameInput.onfocus = () => renderResults(nameInput.value);
  nameInput.oninput = () => renderResults(nameInput.value);
  nameInput.onblur = () => {
    setTimeout(() => {
      if (!isInteractingWithDropdown) {
        closeDropdown();
      }
    }, 300);
  };
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
      document.getElementById("mlEstCreatedSvc").value = cb.serviceNo || cb.official_number || "";

      const chk = est.checkedBy || {};
      document.getElementById("mlEstCheckedName").value = chk.name || "";
      document.getElementById("mlEstCheckedRank").value = chk.rank || "";
      document.getElementById("mlEstCheckedSvc").value = chk.serviceNo || chk.official_number || "";

      const apv = est.approvedBy || {};
      const apvNameEl = document.getElementById("mlEstApprovedName");
      const apvRankEl = document.getElementById("mlEstApprovedRank");
      const apvSvcEl = document.getElementById("mlEstApprovedSvc");
      if (apvNameEl) apvNameEl.value = apv.name || "";
      if (apvRankEl) apvRankEl.value = apv.rank || "";
      if (apvSvcEl) apvSvcEl.value = apv.serviceNo || apv.official_number || "";

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

    document.getElementById("mlEstCreatedName").value = "";
    document.getElementById("mlEstCreatedRank").value = "";
    document.getElementById("mlEstCreatedSvc").value = "";

    const inc = (mlStore.zoneInCharges || {})[mlStore.currentZone] || {};
    document.getElementById("mlEstCheckedName").value = inc.name || "";
    document.getElementById("mlEstCheckedRank").value = inc.rank || "";
    document.getElementById("mlEstCheckedSvc").value = inc.service_no || inc.official_number || "";

    const apvNameEl = document.getElementById("mlEstApprovedName");
    const apvRankEl = document.getElementById("mlEstApprovedRank");
    const apvSvcEl = document.getElementById("mlEstApprovedSvc");
    if (apvNameEl) apvNameEl.value = "";
    if (apvRankEl) apvRankEl.value = "";
    if (apvSvcEl) apvSvcEl.value = "";

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

  setupMobileSignatoryAutocomplete("Created");
  setupMobileSignatoryAutocomplete("Checked");
  setupMobileSignatoryAutocomplete("Approved");

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

  const approvedBy = {
    name: (document.getElementById("mlEstApprovedName")?.value || "").trim(),
    rank: (document.getElementById("mlEstApprovedRank")?.value || "").trim(),
    serviceNo: (document.getElementById("mlEstApprovedSvc")?.value || "").trim()
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
      approvedBy: approvedBy,
      approvedAuthority: approvedBy.name || null,
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
      approvedBy: approvedBy,
      approvedAuthority: approvedBy.name || null,
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
// TAB 4: ZONE INVENTORY (ZERO-LAG ARCHITECTURE)
// ---------------------------------------------
function getNormalizedCategoryGroup(cat) {
  const c = String(cat || "").toUpperCase().trim();
  if (c === "BMS") return "BMS";
  if (c.includes("PAINT") || c === "PAI" || c === "PAT") return "PAINT";
  if (c.includes("PLUMB") || c === "PVC") return "PLUMBING";
  if (c.includes("METAL")) return "METAL";
  if (c.includes("TIMBER")) return "TIMBER";
  if (c.includes("ALU")) return "ALU";
  if (c.includes("ENG") || c.includes("ELEC")) return "ENG";
  return "GENERAL";
}

function toggleInventoryStoreScope() {
  mlStore.inventoryStoreScope = mlStore.inventoryStoreScope === "zone" ? "all" : "zone";
  mlStore.inventoryPage = 1;
  const btnText = document.getElementById("lblScopeText");
  if (btnText) {
    btnText.textContent = mlStore.inventoryStoreScope === "zone" ? "Zone Store" : "All Stores";
  }
  updateInventoryCategoryCounters();
  renderLightInventory();
}

function filterInventoryCategory(cat) {
  mlStore.selectedInventoryCategory = cat;
  mlStore.inventoryPage = 1;

  document.querySelectorAll(".ml-inv-filter-btn").forEach(btn => {
    btn.className = "ml-inv-filter-btn px-2.5 py-1 rounded-lg font-bold text-[10px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0 transition-all";
  });
  const activeBtn = document.getElementById(`btnInvCat_${cat}`);
  if (activeBtn) {
    activeBtn.className = "ml-inv-filter-btn px-2.5 py-1 rounded-lg font-bold text-[10px] bg-teal-700 text-white shadow-xs shrink-0 transition-all";
  }

  renderLightInventory();
}

function filterLightInventory() {
  mlStore.inventoryPage = 1;
  renderLightInventory();
}

function loadMoreInventoryChunk() {
  mlStore.inventoryPage = (mlStore.inventoryPage || 1) + 1;
  renderLightInventory();
}

function loadAllInventoryItems() {
  const zoneItems = getZoneFilteredInventory();
  mlStore.inventoryPage = Math.ceil(zoneItems.length / (mlStore.inventoryPageSize || 50)) + 2;
  renderLightInventory();
}

function getZoneFilteredInventory() {
  const allItems = mlStore.inventory || [];
  const currentZone = mlStore.currentZone || "A-Zone";
  const scope = mlStore.inventoryStoreScope || "zone";

  if (scope === "all") {
    return allItems;
  }

  return allItems.filter(item => {
    const itemZone = item.zone_id || item.zone || "";
    const itemLoc = item.location || "";
    return !itemZone || isZoneMatch(itemZone, currentZone) || isZoneMatch(itemLoc, currentZone);
  });
}

function updateInventoryCategoryCounters() {
  const zoneItems = getZoneFilteredInventory();
  const counts = {
    ALL: zoneItems.length,
    BMS: 0,
    PAINT: 0,
    PLUMBING: 0,
    METAL: 0,
    TIMBER: 0,
    ALU: 0,
    ENG: 0,
    GENERAL: 0
  };

  zoneItems.forEach(item => {
    const grp = getNormalizedCategoryGroup(item.category);
    if (counts[grp] !== undefined) counts[grp]++;
    else counts.GENERAL++;
  });

  Object.keys(counts).forEach(k => {
    const el = document.getElementById(`invCount_${k}`);
    if (el) el.textContent = counts[k];
  });
}

function renderLightInventory(isAppending = false) {
  const container = document.getElementById("mlInventoryList");
  const countEl = document.getElementById("mlInventoryCount");
  const zoneBadgeEl = document.getElementById("mlInventoryZoneBadge");
  const paginationContainer = document.getElementById("mlInventoryPagination");
  if (!container) return;

  const currentZone = mlStore.currentZone || "A-Zone";
  const scope = mlStore.inventoryStoreScope || "zone";

  if (zoneBadgeEl) {
    zoneBadgeEl.textContent = scope === "zone" ? `${formatZoneDisplayName(currentZone)} Store` : "All Base Stores";
  }

  const zoneItems = getZoneFilteredInventory();
  const q = (document.getElementById("mlInventorySearch")?.value || "").toLowerCase().trim();
  const cat = mlStore.selectedInventoryCategory || "ALL";

  const filtered = zoneItems.filter(item => {
    if (cat !== "ALL") {
      const grp = getNormalizedCategoryGroup(item.category);
      if (grp !== cat) return false;
    }
    if (q) {
      const desc = (item.description || "").toLowerCase();
      const bNo = (item.book_no || "").toLowerCase();
      const loc = (item.location || "").toLowerCase();
      const itemCat = (item.category || "").toLowerCase();
      const req = (item.requirement || "").toLowerCase();
      if (!desc.includes(q) && !bNo.includes(q) && !loc.includes(q) && !itemCat.includes(q) && !req.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pageSize = mlStore.inventoryPageSize || 50;
  const currentPage = mlStore.inventoryPage || 1;
  const totalToShow = currentPage * pageSize;
  const itemsToShow = filtered.slice(0, totalToShow);

  if (countEl) {
    countEl.textContent = filtered.length > itemsToShow.length 
      ? `${itemsToShow.length} / ${filtered.length} Items`
      : `${filtered.length} Items`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
        <span class="text-2xl">📦</span>
        <h4 class="text-xs font-bold text-slate-800">No inventory items found</h4>
        <p class="text-[10px] text-slate-400">
          ${scope === 'zone' ? `No inventory records registered under ${formatZoneDisplayName(currentZone)}.` : 'No items match your search filter.'}
        </p>
        ${scope === 'zone' ? `
          <button type="button" onclick="toggleInventoryStoreScope()" class="mt-2 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs active-scale">
            🌐 View All Base Stores (${mlStore.inventory.length})
          </button>
        ` : ''}
      </div>
    `;
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  const html = itemsToShow.map(item => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    const deno = item.deno || "Nos";
    const rowId = item._fbKey || item.id || "";
    
    let stockBadgeCls = "bg-emerald-50 text-emerald-700 border border-emerald-200";
    let stockIcon = "🟢";
    let stockLabel = "In Stock";

    if (qty <= 0) {
      stockBadgeCls = "bg-rose-50 text-rose-700 border border-rose-200";
      stockIcon = "🔴";
      stockLabel = "Out of Stock";
    } else if (qty <= 5) {
      stockBadgeCls = "bg-amber-50 text-amber-800 border border-amber-300";
      stockIcon = "🟡";
      stockLabel = "Low Stock";
    }

    const unitCost = item.cost_per_unit || item.cost || 0;
    const costStr = unitCost > 0 ? `Rs. ${formatCurrency(unitCost)} / ${deno}` : "";
    const offCount = (item.off_charge_records && item.off_charge_records.length) ? item.off_charge_records.length : 0;

    return `
      <div onclick="openInventoryDetailMobile('${rowId}')" class="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2 transition-all hover:border-teal-500 hover:shadow-md cursor-pointer active-scale">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0 pr-1">
            <h4 class="text-xs font-bold text-slate-900 leading-snug hover:text-teal-700 transition-colors">${escapeHtml(item.description)}</h4>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">${escapeHtml(item.category || 'General')}</span>
              ${item.book_no ? `<span class="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono">📖 ${escapeHtml(item.book_no)}</span>` : ''}
              ${item.requirement && item.requirement !== "General" ? `<span class="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 truncate max-w-[130px]">🎯 ${escapeHtml(item.requirement)}</span>` : ''}
              ${offCount > 0 ? `<span class="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">📤 ${offCount} Off-Charged</span>` : ''}
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${stockBadgeCls}">
              <span>${stockIcon}</span>
              <span>${qty.toLocaleString()} ${escapeHtml(deno)}</span>
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 mt-0.5">
          <span class="flex items-center gap-1 truncate max-w-[170px]">
            <span>📍</span>
            <span class="font-medium text-slate-700 truncate">${escapeHtml(item.location || 'Zone Store')}</span>
          </span>
          <div class="flex items-center gap-1.5">
            ${costStr ? `<span class="text-[9px] font-mono font-bold text-slate-600">${costStr}</span>` : `<span class="text-[9px] text-slate-400 font-medium">${stockLabel}</span>`}
            <span class="text-teal-600 font-black text-xs">›</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;

  if (paginationContainer) {
    if (itemsToShow.length < filtered.length) {
      const remaining = filtered.length - itemsToShow.length;
      const nextBatch = Math.min(remaining, pageSize);
      paginationContainer.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex gap-2">
            <button type="button" onclick="loadMoreInventoryChunk()" class="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs active-scale flex items-center justify-center gap-1.5">
              <span>📥</span>
              <span>Load More (+${nextBatch} ක්)</span>
            </button>
            <button type="button" onclick="loadAllInventoryItems()" class="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-xs active-scale flex items-center justify-center gap-1.5">
              <span>🌐</span>
              <span>Load All (ඉතිරි ${remaining} ම)</span>
            </button>
          </div>
          <div class="text-center text-[10px] text-slate-400 font-medium">
            Showing ${itemsToShow.length} of ${filtered.length} items (සම්පූර්ණ ${filtered.length} න් ${itemsToShow.length} ක් පෙන්වයි)
          </div>
        </div>
      `;
    } else {
      paginationContainer.innerHTML = `
        <div class="text-center text-[10px] text-slate-400 py-1.5 font-medium">
          ✅ Showing all ${filtered.length} items for ${scope === 'zone' ? formatZoneDisplayName(currentZone) : 'all stores'}
        </div>
      `;
    }
  }
}

// ---------------------------------------------
// MOBILE INVENTORY DETAILS & OFF-CHARGE MODALS
// ---------------------------------------------
function openInventoryDetailMobile(itemId) {
  const item = (mlStore.inventory || []).find(
    i => String(i._fbKey) === String(itemId) || String(i.id) === String(itemId)
  );
  if (!item) {
    showLightToast("Item not found", "⚠️");
    return;
  }

  const modal = document.getElementById("mlInventoryDetailModal");
  const content = document.getElementById("mlInventoryDetailContent");
  if (!modal || !content) return;

  const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
  const unitCost = parseFloat(item.cost_per_unit || item.cost || 0);
  const totalVal = qty * unitCost;

  // On-Charge records rendering
  let onChargeHtml = "";
  if (Array.isArray(item.on_charge_records) && item.on_charge_records.length > 0) {
    onChargeHtml = item.on_charge_records.map(r => `
      <div class="flex items-center justify-between p-2 bg-emerald-50/80 rounded-xl border border-emerald-100 text-xs">
        <span class="font-mono font-bold text-emerald-800">${escapeHtml(r.ref || 'On-Charge')}</span>
        <span class="font-black text-emerald-700">+${r.qty || 0} ${escapeHtml(item.deno || 'Nos')}</span>
        <span class="text-[10px] text-slate-500">${escapeHtml(r.date || '—')}</span>
      </div>
    `).join("");
  } else if (item.on_charge_ref) {
    onChargeHtml = `
      <div class="p-2 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
        <span class="font-mono font-bold text-emerald-800">${escapeHtml(item.on_charge_ref)}</span>
        <span class="text-[10px] text-slate-500">Initial On-Charge Ref</span>
      </div>
    `;
  } else {
    onChargeHtml = `<p class="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-xl">No on-charge records found</p>`;
  }

  // Off-Charge records rendering
  let offChargeHtml = "";
  if (Array.isArray(item.off_charge_records) && item.off_charge_records.length > 0) {
    offChargeHtml = item.off_charge_records.map((r, idx) => `
      <div class="p-2.5 bg-rose-50/80 rounded-xl border border-rose-100 space-y-1.5">
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-mono font-bold text-rose-800 text-[11px]">${escapeHtml(r.ref || 'NAV 254 Slip')}</span>
            ${r.dest ? `<span class="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-rose-200">→ ${escapeHtml(r.dest)}</span>` : ''}
          </div>
          <span class="font-black text-xs text-rose-600">−${r.qty || 0} ${escapeHtml(item.deno || 'Nos')}</span>
        </div>
        ${r.remarks ? `<p class="text-[10.5px] text-slate-600 italic">"${escapeHtml(r.remarks)}"</p>` : ''}
        <div class="flex items-center justify-between pt-1 border-t border-rose-100/60 text-[10px]">
          <span class="text-slate-400 font-mono">${escapeHtml(r.date || '—')}</span>
          <button type="button" onclick="printOffChargeNav254Mobile('${item._fbKey || item.id}', ${idx})" class="px-2 py-1 bg-white hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg border border-rose-300 font-bold active-scale flex items-center gap-1">
            <span>🖨️</span>
            <span>Print NAV 254</span>
          </button>
        </div>
      </div>
    `).join("");
  } else {
    offChargeHtml = `<p class="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-xl">No off-charge records yet</p>`;
  }

  content.innerHTML = `
    <div class="space-y-3">
      <!-- Description & Category (Pic 1) -->
      <div class="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Description</p>
          <p class="text-sm font-black text-slate-900 leading-snug">${escapeHtml(item.description)}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Category</p>
          <span class="inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">${escapeHtml(item.category || 'General')}</span>
        </div>
      </div>

      <!-- Quantity, Unit Cost, Total Value (Pic 1) -->
      <div class="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Quantity</p>
          <p class="text-sm sm:text-base font-black ${qty < 10 ? 'text-rose-600' : 'text-emerald-600'}">${qty.toLocaleString()} ${escapeHtml(item.deno || 'Nos')}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Unit Cost</p>
          <p class="text-xs sm:text-sm font-bold text-slate-800">Rs. ${formatCurrency(unitCost)}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Total Value</p>
          <p class="text-xs sm:text-sm font-black text-amber-600">Rs. ${formatCurrency(totalVal)}</p>
        </div>
      </div>

      <!-- Book No, Location, Requirement (Pic 1) -->
      <div class="grid grid-cols-3 gap-2">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Book No (Stock Book)</p>
          <p class="mt-0.5"><span class="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] inline-block font-mono">${escapeHtml(item.book_no || '—')}</span></p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Location</p>
          <p class="font-semibold text-slate-800 text-xs mt-0.5">${escapeHtml(item.location || 'Zone Store')}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Requirement</p>
          <p class="font-semibold text-slate-800 text-xs mt-0.5">${escapeHtml(item.requirement || 'General')}</p>
        </div>
      </div>

      <!-- Date Added & Zone -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Date Added</p>
          <p class="font-medium text-slate-700">${escapeHtml(item.date_added || '—')}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400">Zone Store</p>
          <p class="font-medium text-slate-700">${escapeHtml(item.zone_id || item.zone || mlStore.currentZone || 'A-Zone')}</p>
        </div>
      </div>

      <!-- On-Charge Records (Pic 1) -->
      <div class="border-t border-slate-200 pt-3">
        <h4 class="font-bold text-slate-700 text-xs mb-1.5 flex items-center gap-1.5">
          <span>📥</span>
          <span>On-Charge Records</span>
        </h4>
        <div class="space-y-1.5">
          ${onChargeHtml}
        </div>
      </div>

      <!-- Off-Charge Records (Pic 1) -->
      <div class="border-t border-slate-200 pt-3">
        <div class="flex items-center justify-between mb-1.5">
          <h4 class="font-bold text-slate-700 text-xs flex items-center gap-1.5">
            <span>📤</span>
            <span>Off-Charge Records</span>
          </h4>
          <span class="text-[10px] text-slate-400 font-normal">NAV 254 Demand/Supply Slip</span>
        </div>
        <div class="space-y-1.5">
          ${offChargeHtml}
        </div>
      </div>

      <!-- Off-Charge action button (Red Button matching Pic 1) -->
      <div class="border-t border-slate-200 pt-3">
        <button type="button" onclick="openOffChargeModalMobile('${item._fbKey || item.id}')" class="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-4 py-3 rounded-xl font-black text-xs active-scale shadow-md flex items-center justify-center gap-2">
          <span>📇</span>
          <span>Off-Charge to Base / Zone (Nav 254)</span>
        </button>
      </div>
    </div>
  `;

  const btnEdit = document.getElementById("mlBtnEditInventoryItem");
  if (btnEdit) {
    btnEdit.onclick = () => {
      closeInventoryDetailMobile();
      openEditInventoryModalMobile(item._fbKey || item.id);
    };
  }

  modal.classList.remove("hidden");
}

function closeInventoryDetailMobile() {
  const modal = document.getElementById("mlInventoryDetailModal");
  if (modal) modal.classList.add("hidden");
}

function openOffChargeModalMobile(itemId) {
  const item = (mlStore.inventory || []).find(
    i => String(i._fbKey) === String(itemId) || String(i.id) === String(itemId)
  );
  if (!item) {
    showLightToast("Inventory item not found", "⚠️");
    return;
  }

  closeInventoryDetailMobile();

  const modal = document.getElementById("mlOffChargeModal");
  if (!modal) return;

  document.getElementById("mlOcItemId").value = item._fbKey || item.id || "";
  document.getElementById("mlOcItemName").textContent = item.description;
  const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
  const deno = item.deno || "Nos";
  document.getElementById("mlOcItemAvailBadge").textContent = `Available: ${qty} ${deno}`;
  document.getElementById("mlOcDenoUnit").textContent = deno;

  const ocQtyInput = document.getElementById("mlOcQty");
  ocQtyInput.value = "";
  ocQtyInput.max = qty;

  const year = new Date().getFullYear();
  const randNum = String(Math.floor(10 + Math.random() * 90)).padStart(2, "0");
  document.getElementById("mlOcRef").value = `CCED/CE/FD/OUT/${randNum}/${year}`;
  document.getElementById("mlOcRemarks").value = "";
  document.getElementById("mlOcDate").value = getLocalDateString();

  const dests = [
    "BC-Zone", "A-Zone", "B-Zone", "C-Zone", "D-Zone", "E-Zone", "G-Zone", "FH-Zone", "OTW",
    "Carpentry-Shop", "Painter-Shop", "Main-Store", "SLNS TISSA", "SLNS DAKSHINA",
    "SLNS VIJAYA", "Base Store", "Civil Engineering Dept"
  ];
  const destSelect = document.getElementById("mlOcDest");
  if (destSelect) {
    destSelect.innerHTML = '<option value="">Select destination base / workshop...</option>' +
      dests.map(d => `<option value="${d}">${d}</option>`).join("");
  }

  modal.classList.remove("hidden");
}

function closeOffChargeModalMobile() {
  const modal = document.getElementById("mlOffChargeModal");
  if (modal) modal.classList.add("hidden");
}

function submitOffChargeMobile(event) {
  if (event && event.preventDefault) event.preventDefault();

  const ocId = document.getElementById("mlOcItemId").value;
  const item = (mlStore.inventory || []).find(
    i => String(i._fbKey) === String(ocId) || String(i.id) === String(ocId)
  );
  if (!item) {
    showLightToast("Inventory item not found", "⚠️");
    return;
  }

  const qtyToOff = parseFloat(document.getElementById("mlOcQty").value);
  const currentQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
  const ref = document.getElementById("mlOcRef").value.trim() || `CCED/CE/FD/OUT/${new Date().getFullYear()}`;
  const dest = document.getElementById("mlOcDest").value;
  const date = document.getElementById("mlOcDate").value || getLocalDateString();
  const remarks = document.getElementById("mlOcRemarks").value.trim();

  if (isNaN(qtyToOff) || qtyToOff <= 0 || qtyToOff > currentQty) {
    alert(`Invalid quantity! Quantity must be between 0.01 and ${currentQty}`);
    return;
  }
  if (!dest) {
    alert("Please select a destination Base / Workshop");
    return;
  }

  const targetKey = item._fbKey || item.id;
  const newQty = currentQty - qtyToOff;

  if (!Array.isArray(item.off_charge_records)) item.off_charge_records = [];
  const offRecord = { ref, qty: qtyToOff, date, dest, remarks };
  item.off_charge_records.push(offRecord);
  item.off_charge_ref = ref;
  item.quantity = newQty;

  const unitCost = parseFloat(item.cost_per_unit || item.cost || 0);

  // Cloud NAV 254 record
  try {
    const nav254CloudData = {
      voucher_no: ref.startsWith("NAV") ? ref : `NAV254/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`,
      ref_no: ref,
      date: date,
      issuing_unit: `${item.zone_id || mlStore.currentZone || "CE Dept"} Store`,
      receiving_unit: dest,
      authority: ref,
      issued_by: mlStore.activeProfileName || "Store Keeper",
      received_by: dest,
      items: [
        {
          inventory_id: targetKey,
          description: item.description,
          deno: item.deno || "Nos",
          quantity_demanded: qtyToOff,
          quantity_issued: qtyToOff,
          unit_cost: unitCost,
          total_value: unitCost * qtyToOff
        }
      ],
      remarks: remarks,
      source: "Mobile Store Off-Charge",
      created_at: Date.now()
    };
    opsDB.ref("nav254_vouchers").push(nav254CloudData);
  } catch (err) {
    console.warn("Could not save to nav254_vouchers:", err);
  }

  // Update item in Firebase RTDB
  const cleanItem = { ...item };
  delete cleanItem._fbKey;

  opsDB.ref(`inventory/${targetKey}`).set(cleanItem).then(() => {
    closeOffChargeModalMobile();
    renderLightInventory();
    showLightToast(`Off-charged ${qtyToOff} ${item.deno} → ${dest}`, "✅");

    const printIdx = item.off_charge_records.length - 1;
    if (confirm(`Material successfully off-charged to ${dest}!\n\nDo you want to view / print the authentic NAV 254 Demand/Supply Note now?`)) {
      printOffChargeNav254Mobile(targetKey, printIdx);
    }
  }).catch(err => {
    console.error("Firebase update failed:", err);
    alert("Failed to update inventory in database: " + err.message);
  });
}

// ---------------------------------------------
// ADD / EDIT INVENTORY ITEM MODAL (PIC 2)
// ---------------------------------------------
function openAddInventoryModalMobile() {
  const modal = document.getElementById("mlInventoryModal");
  if (!modal) return;

  document.getElementById("mlInvModalTitle").textContent = "Add Inventory Item";
  document.getElementById("mlInvId").value = "";
  document.getElementById("mlInvCategory").value = "General";
  document.getElementById("mlInvDate").value = getLocalDateString();
  document.getElementById("mlInvDescription").value = "";
  document.getElementById("mlInvDeno").value = "Nos";
  document.getElementById("mlInvQuantity").value = "1";
  document.getElementById("mlInvCost").value = "0";
  document.getElementById("mlInvRequirementText").value = "";
  document.getElementById("mlInvBookNo").value = "";
  document.getElementById("mlInvLocation").value = `${formatZoneDisplayName(mlStore.currentZone || 'A-Zone')} Store`;
  document.getElementById("mlInvOnCharge").value = "";

  populateInventoryModalDropdowns(mlStore.currentZone || "A-Zone");
  modal.classList.remove("hidden");
}

function openEditInventoryModalMobile(itemId) {
  const item = (mlStore.inventory || []).find(
    i => String(i._fbKey) === String(itemId) || String(i.id) === String(itemId)
  );
  if (!item) {
    showLightToast("Item not found", "⚠️");
    return;
  }

  const modal = document.getElementById("mlInventoryModal");
  if (!modal) return;

  document.getElementById("mlInvModalTitle").textContent = "Edit Inventory Item";
  document.getElementById("mlInvId").value = item._fbKey || item.id || "";
  document.getElementById("mlInvCategory").value = item.category || "General";
  document.getElementById("mlInvDate").value = item.date_added || getLocalDateString();
  document.getElementById("mlInvDescription").value = item.description || "";
  document.getElementById("mlInvDeno").value = item.deno || "Nos";
  document.getElementById("mlInvQuantity").value = item.quantity != null ? item.quantity : 0;
  document.getElementById("mlInvCost").value = item.cost_per_unit || item.cost || 0;
  document.getElementById("mlInvRequirementText").value = item.requirement || "";
  document.getElementById("mlInvBookNo").value = item.book_no || "";
  document.getElementById("mlInvLocation").value = item.location || "Zone Store";
  document.getElementById("mlInvOnCharge").value = item.on_charge_ref || "";

  populateInventoryModalDropdowns(item.zone_id || item.zone || mlStore.currentZone || "A-Zone");
  modal.classList.remove("hidden");
}

function populateInventoryModalDropdowns(selectedZone) {
  const zoneSelect = document.getElementById("mlInvZone");
  if (zoneSelect) {
    zoneSelect.innerHTML = STANDARD_ZONES.map(z => 
      `<option value="${z.id}" ${z.id === selectedZone ? 'selected' : ''}>${z.name}</option>`
    ).join("");
  }

  const reqSelect = document.getElementById("mlInvRequirementSelect");
  if (reqSelect) {
    const projects = (mlStore.workOrders || [])
      .filter(w => (w.type === 'PROJECT' || w.category === 'PROJECT') && w.title)
      .slice(0, 40);
    reqSelect.innerHTML = '<option value="">-- Choose existing project --</option>' +
      projects.map(p => `<option value="${escapeHtml(p.title)}">${escapeHtml(p.title)}</option>`).join("");
  }
}

function closeInventoryModalMobile() {
  const modal = document.getElementById("mlInventoryModal");
  if (modal) modal.classList.add("hidden");
}

function saveInventoryItemMobile(event) {
  if (event && event.preventDefault) event.preventDefault();

  const id = document.getElementById("mlInvId").value;
  const desc = document.getElementById("mlInvDescription").value.trim();
  if (!desc) {
    alert("Please enter a description for the material");
    return;
  }

  const category = document.getElementById("mlInvCategory").value || "General";
  const dateAdded = document.getElementById("mlInvDate").value || getLocalDateString();
  const deno = document.getElementById("mlInvDeno").value || "Nos";
  const quantity = parseFloat(document.getElementById("mlInvQuantity").value) || 0;
  const cost = parseFloat(document.getElementById("mlInvCost").value) || 0;
  const reqSelect = document.getElementById("mlInvRequirementSelect").value;
  const reqText = document.getElementById("mlInvRequirementText").value.trim();
  const requirement = reqText || reqSelect || "General";
  const bookNo = document.getElementById("mlInvBookNo").value.trim();
  const location = document.getElementById("mlInvLocation").value.trim() || "Zone Store";
  const onChargeRef = document.getElementById("mlInvOnCharge").value.trim();
  const zone = document.getElementById("mlInvZone").value || mlStore.currentZone || "A-Zone";

  let existingItem = null;
  if (id) {
    existingItem = (mlStore.inventory || []).find(
      i => String(i._fbKey) === String(id) || String(i.id) === String(id)
    );
  }

  const itemData = {
    ...(existingItem || {}),
    description: desc,
    category: category,
    deno: deno,
    quantity: quantity,
    cost_per_unit: cost,
    cost: cost,
    requirement: requirement,
    book_no: bookNo,
    location: location,
    on_charge_ref: onChargeRef,
    zone_id: zone,
    zone: zone,
    date_added: dateAdded,
    updated_at: Date.now()
  };
  delete itemData._fbKey;

  let promise;
  if (id) {
    promise = opsDB.ref(`inventory/${id}`).update(itemData);
  } else {
    itemData.created_at = Date.now();
    if (onChargeRef) {
      itemData.on_charge_records = [{ ref: onChargeRef, qty: quantity, date: dateAdded }];
    }
    promise = opsDB.ref("inventory").push(itemData);
  }

  promise.then(() => {
    closeInventoryModalMobile();
    showLightToast(`Material ${id ? 'updated' : 'added'} successfully!`, "✅");
    renderLightInventory();
  }).catch(err => {
    console.error("Save inventory item failed:", err);
    alert("Error saving item: " + err.message);
  });
}

// ---------------------------------------------
// AUTHENTIC NAV 254 DEMAND/SUPPLY SLIP PRINTING
// ---------------------------------------------
function resolveSailorRealRank(nameOrOffNo, fallbackTrade = "") {
  const str = String(nameOrOffNo || "").trim();
  if (Array.isArray(mlStore.sailors) && mlStore.sailors.length > 0) {
    const found = mlStore.sailors.find(s => {
      const offNo = String(s.official_number || s.off_no || "").trim();
      const sName = String(s.name || "").toLowerCase().trim();
      const fullStr = str.toLowerCase();
      return (offNo && fullStr.includes(offNo)) || (sName && fullStr.includes(sName));
    });
    if (found && found.rank && found.rank.trim()) {
      return found.rank.trim();
    }
  }

  const rankMatch = str.match(/(?:CPO|PO|LS|AB|ORD|WO|MCPO|SCPO|CWO|LCDR|LT|SLT|MID|CDR|CAPT|CMDE|RADM)\s*(?:\([A-Za-z0-9/& -]+\))?|(?:Chief Petty Officer|Petty Officer|Leading Seaman|Able Seaman|Ordinary Seaman)/i);
  if (rankMatch) return rankMatch[0].trim();
  return fallbackTrade || "—";
}

function generateOfficialNav254Html(data) {
  const refNo = data.ref_no || data.voucher_no || "CCED/CE/FD/OUT/254/01/2026";
  const suppliedBy = data.supplied_by || `Civil Engineering Department (${data.origin_zone || mlStore.currentZone || "CE Dept"})`;
  const receivedBy = data.received_by || data.target_destination || data.receiving_unit || data.zone_id || "FH Zone";
  const issueDate = data.date || getLocalDateString();
  const recipientName = data.issued_to || data.recipient_name || "EC 50091 PO(CE) SBSS JAYAWARDANA";
  const recipientRank = resolveSailorRealRank(recipientName, data.recipient_rank || data.trade || "");
  const issuedBy = data.issued_by || "Storekeeper (CE Dept)";
  const purpose = data.purpose || "Civil Engineering Works / Maintenance";
  const expectedReturn = data.expected_return_date || "—";
  const operator = mlStore.activeProfileName || "Admin Desk";
  const printTimestamp = new Date().toLocaleString("en-GB");

  const items = (data.items && data.items.length > 0) ? data.items : [
    {
      description: data.item_name || data.description || "Material Issue",
      deno: data.deno || "Nos",
      qty_supplied: data.qty || data.quantity_issued || 1,
      qty_received: data.quantity_received || data.qty || data.quantity_issued || 1,
      total_value: parseFloat(data.total_value) || ((parseFloat(data.unit_cost) || 0) * (parseFloat(data.qty) || 1))
    }
  ];

  const totalRowCount = Math.max(4, items.length);
  let rowsHtml = "";

  for (let idx = 0; idx < totalRowCount; idx++) {
    const it = items[idx];
    if (it) {
      const val = parseFloat(it.total_value || 0);
      const valRs = val > 0 ? Math.floor(val).toLocaleString("en-LK") : "—";
      const valCents = val > 0 ? String(Math.round((val % 1) * 100)).padStart(2, "0") : "";

      rowsHtml += `
        <tr style="height: 32px;">
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px; font-weight: bold;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 11.5px; font-weight: 600; text-align: left;">${it.description}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px;">${it.deno || 'Nos'}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11.5px; font-weight: bold;">${it.qty_supplied || it.qty || ''}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11.5px; font-weight: bold;">${it.qty_received || it.qty || ''}</td>
          <td style="border: 1px solid #000; padding: 0; font-size: 11px;">
            <div style="display: flex; height: 100%; align-items: center;">
              <span style="flex: 1; text-align: right; padding-right: 4px; border-right: 1px solid #000; font-weight: bold;">${valRs}</span>
              <span style="width: 25px; text-align: center; font-size: 10px;">${valCents}</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      rowsHtml += `
        <tr style="height: 32px;">
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 11px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 0; font-size: 11px;">
            <div style="display: flex; height: 100%;">
              <span style="flex: 1; border-right: 1px solid #000;">&nbsp;</span>
              <span style="width: 25px;">&nbsp;</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  return `
    <div style="font-family: 'Noto Sans Sinhala', 'Iskoola Pota', 'Abhaya Libre', 'Times New Roman', serif; color: #000; max-width: 820px; margin: 0 auto; background: #fff; padding: 18px 22px; border: 1.5px solid #000;">
      <!-- Top Form Number & Header Details (Pic 3) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="border: 1.5px solid #000; padding: 4px 10px; font-size: 12px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
          <div style="line-height: 1.2; text-align: center;">නැවි<br>NAV</div>
          <div style="font-size: 26px; font-weight: 900; line-height: 1;">} 254</div>
        </div>

        <div style="text-align: right; font-size: 10px; line-height: 1.35;">
          <div style="display: flex; align-items: flex-start; justify-content: flex-end; gap: 14px;">
            <div style="text-align: right;">
              <div style="font-weight: bold; font-family: monospace; font-size: 9.5px; color: #000;">H 029858 — 1500 (2007/12) P</div>
              <div>ශ්‍රී ලං. නා. හ. 64</div>
              <div>(Bond Quintuplicate 7 ½” x 10”)</div>
              <div>සිං/ඉං 5/67</div>
            </div>
            <div style="width: 0; height: 0; border-top: 28px solid #475569; border-left: 28px solid transparent;"></div>
          </div>
        </div>
      </div>

      <!-- Center Document Title -->
      <div style="text-align: center; margin-top: 6px; margin-bottom: 6px;">
        <h2 style="font-size: 13.5px; font-weight: bold; margin: 0; letter-spacing: 0.5px;">ඇණවුම් සැපයුම් හෝ ලැබූ පත්‍රය</h2>
        <h3 style="font-size: 11.5px; font-weight: bold; margin: 0; text-transform: uppercase;">Demand Supply Or Receipt Note</h3>
      </div>

      <!-- Top Right Serial No -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
        <div style="border: 1.5px solid #000; display: inline-flex; font-size: 11px;">
          <div style="padding: 4px 10px; border-right: 1.5px solid #000; font-weight: bold; line-height: 1.2; text-align: center;">
            අනුක්‍රමික අංකය<br>Serial No.
          </div>
          <div style="padding: 4px 14px; font-weight: 900; font-family: monospace; font-size: 12px; display: flex; align-items: center; color: #000;">
            ${refNo}
          </div>
        </div>
      </div>

      <!-- Supplied By & Received By -->
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 4px; padding-bottom: 6px;">
        <div style="width: 48%;">
          <div style="font-weight: bold;">සපයන ලද්දේ / SUPPLIED BY</div>
          <div style="font-weight: bold; font-size: 12px; padding: 2px 0; min-height: 22px; color: #000;">
            ${suppliedBy}
          </div>
          <div style="margin-top: 4px;">
            <strong>දිනය / Date:</strong> ${issueDate}
          </div>
        </div>

        <div style="width: 48%;">
          <div style="font-weight: bold;">ලබා ගත්තේ / RECEIVED BY</div>
          <div style="font-weight: bold; font-size: 12px; padding: 2px 0; min-height: 22px; color: #000;">
            ${receivedBy}
          </div>
          <div style="margin-top: 4px;">
            <strong>දිනය / Date:</strong> ${issueDate}
          </div>
        </div>
      </div>

      <!-- Main Items Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-top: 8px; margin-bottom: 12px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #000; padding: 6px 4px; width: 5%; font-size: 11px;">#</th>
            <th style="border: 1px solid #000; padding: 6px 8px; width: 44%; font-size: 11px; text-align: center;">
              විස්තරය<br><span style="font-weight: normal; font-size: 10px;">description</span>
            </th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 12%; font-size: 11px; text-align: center;">
              වර්ගය<br><span style="font-weight: normal; font-size: 10px;">Denomination</span>
            </th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 13%; font-size: 11px; text-align: center;">
              සැපයූ ප්‍රමාණය<br><span style="font-weight: normal; font-size: 10px;">Quantity Supplied</span>
            </th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 13%; font-size: 11px; text-align: center;">
              ලැබූ ප්‍රමාණය<br><span style="font-weight: normal; font-size: 10px;">Quantity Received</span>
            </th>
            <th style="border: 1px solid #000; padding: 4px; width: 13%; font-size: 11px; text-align: center;">
              වටිනාකම<br><span style="font-weight: normal; font-size: 10px;">Value</span>
              <div style="display: flex; border-top: 1px solid #000; margin-top: 2px; padding-top: 2px;">
                <span style="flex: 1; text-align: center; border-right: 1px solid #000; font-size: 9.5px; font-weight: bold;">රු. Rs.</span>
                <span style="width: 25px; text-align: center; font-size: 9.5px; font-weight: bold;">ශ. c.</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Authorizing Officer Box -->
      <div style="border: 1.5px solid #000; padding: 6px 12px; font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: bold; width: 25%; line-height: 1.3;">
          බලය දෙන නිලධාරී<br><span style="font-size: 10px;">Officer Authorizing</span>
        </div>
        <div style="width: 72%;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span>ඇණවුම Demand } ____________________________</span>
            <span>නිලය Rank } ______________</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>සැපයුම Supply } ____________________________</span>
            <span>නිලය Rank } ______________</span>
          </div>
        </div>
      </div>

      <!-- Received Stores & Rank Area -->
      <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px;">
        <div style="width: 58%;">
          <div style="font-weight: bold; line-height: 1.2;">
            ඉහත සඳහන් ගබඩා බඩු ලබා ගන්නා ලදී. }<br>
            <span style="font-size: 10px;">RECEIVED THE ABOVE STORES</span>
          </div>
          <div style="border-bottom: 1px solid #000; padding: 4px 0; font-weight: bold; font-size: 11.5px; min-height: 22px; margin-top: 4px;">
            ${recipientName}
          </div>
        </div>
        <div style="width: 38%;">
          <div style="font-weight: bold; line-height: 1.2;">
            නිලය/තරාතිරම }<br>
            <span style="font-size: 10px;">RANK / RATE</span>
          </div>
          <div style="border-bottom: 1px solid #000; padding: 4px 0; font-weight: bold; font-size: 11.5px; min-height: 22px; margin-top: 4px;">
            ${recipientRank}
          </div>
        </div>
      </div>

      <!-- Gray Area: Issued By / Purpose / Expected Return -->
      <div style="margin-top: 10px; font-size: 10px; color: #1e293b; display: flex; justify-content: space-between; border-top: 1px dashed #94a3b8; padding-top: 4px;">
        <div><strong>සැපයූ නාවිකයා / Issued By:</strong> ${issuedBy}</div>
        <div><strong>කාර්යය / Purpose:</strong> ${purpose}</div>
        <div><strong>නැවත භාරදිය යුතු දිනය:</strong> ${expectedReturn}</div>
      </div>

      <!-- System Reference & Tracking Details -->
      <div style="margin-top: 4px; font-size: 8.5px; color: #78350f; display: flex; justify-content: space-between; font-family: monospace; border-top: 1px solid #fed7aa; padding-top: 2px;">
        <span>⚙️ SYSTEM TRACKING REF: ${refNo} · SRI LANKA NAVY CE DEPT</span>
        <span>GENERATED: ${printTimestamp} · OPERATOR: ${operator}</span>
      </div>
    </div>
  `;
}

function printOffChargeNav254Mobile(itemId, recordIndex) {
  const item = (mlStore.inventory || []).find(
    i => String(i._fbKey) === String(itemId) || String(i.id) === String(itemId)
  );
  if (!item) {
    showLightToast("Item not found", "⚠️");
    return;
  }

  const rec = (item.off_charge_records || [])[recordIndex] || {
    ref: item.off_charge_ref || `CCED/CE/FD/OUT/${new Date().getFullYear()}`,
    qty: item.quantity || 1,
    dest: "Base / Zone",
    date: getLocalDateString(),
    remarks: "Off-Charge Material Issue"
  };

  const unitCost = parseFloat(item.cost_per_unit || item.cost || 0);
  const qty = parseFloat(rec.qty || 0);
  const totalVal = unitCost * qty;

  const nav254Html = generateOfficialNav254Html({
    ref_no: rec.ref || `CCED/CE/FD/OUT/${new Date().getFullYear()}`,
    supplied_by: `Civil Engineering Department (${item.zone_id || mlStore.currentZone || "CE Dept"})`,
    received_by: rec.dest || "Respective Unit / Base",
    date: rec.date || getLocalDateString(),
    items: [
      {
        description: item.description,
        deno: item.deno || "Nos",
        qty_supplied: qty,
        qty_received: qty,
        total_value: totalVal
      }
    ],
    issued_to: rec.dest || "Receiving Officer / Base In-Charge",
    trade: "CE Section",
    issued_by: mlStore.activeProfileName || "Store In-Charge (CE Dept)",
    purpose: rec.remarks || "Off-Charge Transfer to Base / Zone",
    expected_return_date: "—"
  });

  const modal = document.getElementById("mlNav254Modal");
  const area = document.getElementById("mlNav254PrintArea");
  const refHdr = document.getElementById("mlNav254RefHeader");
  if (refHdr) refHdr.textContent = `Serial No: ${rec.ref || '—'}`;
  if (area) area.innerHTML = nav254Html;
  if (modal) modal.classList.remove("hidden");
}

function closeNav254ModalMobile() {
  const modal = document.getElementById("mlNav254Modal");
  if (modal) modal.classList.add("hidden");
}

function triggerNav254PrintMobile() {
  const area = document.getElementById("mlNav254PrintArea");
  if (!area) return;
  const content = area.innerHTML;

  let iframe = document.getElementById("mlNav254PrintIframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "mlNav254PrintIframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="si">
      <head>
        <title>NAV 254 Slip</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700;900&family=Abhaya+Libre:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: auto; margin: 8mm; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
            .no-print { display: none !important; }
          }
          body { font-family: 'Noto Sans Sinhala', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 10px; background: #fff; color: #000; }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn("Iframe print error, fallback to window.print:", e);
      window.print();
    }
  }, 350);
}

function exportNav254PDFMobile() {
  const area = document.getElementById("mlNav254PrintArea");
  if (!area) return;

  if (typeof html2pdf === "undefined") {
    alert("PDF library loading. Please try Native Print if offline.");
    return;
  }

  showLightToast("Generating NAV 254 PDF...", "⏳");
  const opt = {
    margin: [6, 6, 6, 6],
    filename: `NAV254_Slip_${getLocalDateString()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(area).save().then(() => {
    showLightToast("NAV 254 PDF Downloaded!", "✅");
  }).catch(err => {
    console.error("PDF generation failed:", err);
    showLightToast("PDF export failed. Use Print button.", "⚠️");
  });
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

// ---------------------------------------------
// DEVICE BACK BUTTON / POPSTATE NAVIGATION HANDLER
// ---------------------------------------------
window.addEventListener("popstate", (event) => {
  // 1. Daily Report Print Modal
  const printModal = document.getElementById("mlPrintPreviewModal");
  if (printModal && !printModal.classList.contains("hidden")) {
    closeDailyReportPrintMobile(true);
    return;
  }

  // 2. Work Order Detail Modal
  const woModal = document.getElementById("mlWoDetailModal");
  if (woModal && !woModal.classList.contains("hidden")) {
    if (typeof closeWorkOrderDetailMobile === "function") {
      closeWorkOrderDetailMobile();
      return;
    }
  }

  // 3. New Task Modal
  const taskModal = document.getElementById("mlNewTaskModal");
  if (taskModal && !taskModal.classList.contains("hidden")) {
    if (typeof closeNewTaskModal === "function") {
      closeNewTaskModal();
      return;
    }
  }

  // 4. Assign Modal
  const assignModal = document.getElementById("mlAssignModal");
  if (assignModal && !assignModal.classList.contains("hidden")) {
    if (typeof closeAssignModal === "function") {
      closeAssignModal();
      return;
    }
  }

  // 5. Estimate Modal
  const estModal = document.getElementById("mlNewEstimateModal");
  if (estModal && !estModal.classList.contains("hidden")) {
    if (typeof closeNewEstimateModalMobile === "function") {
      closeNewEstimateModalMobile();
      return;
    }
  }

  // 6. Inventory NAV 254 Slip Modal
  const nav254Modal = document.getElementById("mlNav254Modal");
  if (nav254Modal && !nav254Modal.classList.contains("hidden")) {
    closeNav254ModalMobile();
    return;
  }

  // 7. Inventory Off-Charge Modal
  const ocModal = document.getElementById("mlOffChargeModal");
  if (ocModal && !ocModal.classList.contains("hidden")) {
    closeOffChargeModalMobile();
    return;
  }

  // 8. Inventory Add/Edit Modal
  const invModal = document.getElementById("mlInventoryModal");
  if (invModal && !invModal.classList.contains("hidden")) {
    closeInventoryModalMobile();
    return;
  }

  // 9. Inventory Detail Modal
  const invDetailModal = document.getElementById("mlInventoryDetailModal");
  if (invDetailModal && !invDetailModal.classList.contains("hidden")) {
    closeInventoryDetailMobile();
    return;
  }
});

// PRINT LIFECYCLE RECOVERY HANDLER
window.addEventListener("afterprint", () => {
  const modal = document.getElementById("mlPrintPreviewModal");
  if (modal) {
    if (modal.classList.contains("hidden")) {
      modal.style.setProperty("display", "none", "important");
    } else {
      modal.style.removeProperty("display");
      modal.classList.remove("hidden");
    }
  }
  const navModal = document.getElementById("mlNav254Modal");
  if (navModal && !navModal.classList.contains("hidden")) {
    navModal.style.removeProperty("display");
    navModal.classList.remove("hidden");
  }
});

// Global bootstrap
window.addEventListener("DOMContentLoaded", initLightApp);
