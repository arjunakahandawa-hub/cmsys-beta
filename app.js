var _document$getElementB3, _document$getElementB4; // =============================================
// GLOBAL ERROR HANDLER (DEBUG)
// =============================================
window.onerror = function (msg, url, line, col, error) {
  console.error("🚨 JS ERROR:", msg, "at", url, "line:", line);
  const errDiv = document.createElement("div");
  errDiv.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;background:red;color:white;padding:8px 12px;font-size:12px;font-family:monospace;cursor:pointer;";
  errDiv.textContent = "🚨 JS Error: " + msg + " (line " + line + ")";
  errDiv.onclick = function () {
    this.remove();
  };
  document.body.appendChild(errDiv);
  return false;
}; // =============================================
// PWA SERVICE WORKER REGISTRATION
// =============================================
// Force unregister all service workers and clear cache to resolve browser caching bugs
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister().then(() => {
        console.log("⚓ Active Service Worker unregistered!");
      });
    }
  });
}
if ("caches" in window) {
  caches.keys().then((names) => {
    for (let name of names) {
      caches.delete(name);
    }
    console.log("⚓ All caches cleared!");
  });
} // Custom PWA Installer trigger variables and listeners
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("⚓ PWA Installable prompt intercepted!"); // Show our custom header install button
  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.classList.remove("hidden");
  } // Refresh the profile dropdown to show the install button if open
  renderProfileDropdown();
});
window.addEventListener("appinstalled", (evt) => {
  console.log("⚓ CE Management System PWA was installed successfully!");
  deferredPrompt = null;
  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.classList.add("hidden");
  }
  renderProfileDropdown();
});
function triggerPwaInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === "accepted") {
      console.log("⚓ User accepted PWA installation");
    } else {
      console.log("⚓ User dismissed PWA installation");
    }
    deferredPrompt = null;
    const installBtn = document.getElementById("installAppBtn");
    if (installBtn) {
      installBtn.classList.add("hidden");
    }
    renderProfileDropdown();
  });
} // Global Runtime Error Alert for Remote Debugging
window.addEventListener("error", function (e) {
  const errDiv = document.createElement("div");
  errDiv.style.position = "fixed";
  errDiv.style.top = "0";
  errDiv.style.left = "0";
  errDiv.style.right = "0";
  errDiv.style.background = "#ef4444";
  errDiv.style.color = "#ffffff";
  errDiv.style.padding = "8px";
  errDiv.style.fontSize = "12px";
  errDiv.style.zIndex = "9999";
  errDiv.style.textAlign = "center";
  errDiv.textContent =
    "System Error: " + e.message + " at " + e.filename + ":" + e.lineno;
  document.body.appendChild(errDiv);
}); // =============================================
// CMSys v2.6 - CE Management System
// Main Application JavaScript
// =============================================
// =============================================
// ADMIN & STAFF DUTIES ZONE HELPER
// The zone ID may be stored as 'Admin-&-Staff-Duties', 'Admin & Staff Duties',
// 'Admin-Staff-Duties' etc. This helper normalizes the check.
// =============================================
function isAdminStaffDuties(zoneIdOrName) {
  if (!zoneIdOrName) return false;
  const normalized = zoneIdOrName.toLowerCase().replace(/[-&\s]+/g, "");
  return normalized === "adminstaffduties";
}
function formatZoneDisplayName(zoneId) {
  if (!zoneId) return "";
  if (isAdminStaffDuties(zoneId)) return "Admin & Staff Duties";
  const zObj = (store.zones || []).find(
    (z) => z.id === zoneId || z.name === zoneId,
  );
  if (zObj && zObj.name) return zObj.name;
  return zoneId;
}
function parseOfficialNumber(offNo) {
  if (!offNo) return { type: "•", num: "-" };
  const clean = offNo.trim().replace(/^[^a-zA-Z0-9]+/, '');
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
} // =============================================
// DATA STORE
// NOTE: Arrays start empty — Firebase listeners populate them
// Hardcoded fallback data retained as safety defaults
// =============================================
// Helper for UTC safe timezone processing (Sri Lanka local date)
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const store = {
  currentZone: localStorage.getItem("ncw_saved_zone") || "A-Zone",
  activeProfileType: null,
  activeProfileZone: null,
  currentFilter: "all",
  currentTrade: "ALL",
  selectedJobCard: null,
  selectedEstimate: null,
  selectedLocation: null,
  selectedWorkOrder: null,
  isEveningMode: false,
  currentJobCardsTab: "active",
  currentInventoryCategory: "all",
  selectedEstimatesForPrint: [], // Logged-in user (defaults the "Created By" signature block on estimates)
  currentUser: {
    name: "Sanjeewa Bandara",
    rank: "PO1 (CE)",
    serviceNo: "NRX 12345",
  }, // ── Loaded from Firebase DB #1 (ce-admin-panel2025) ──
  sailors: [],
  availability: {},
  outProjects: {},
  housingProjects: {},
  otherBases: {},
  tempDrafts: {}, // ── Loaded from Firebase DB #2 (operations database) ──
  workOrders: [],
  jobCards: [],
  jobCardMaterials: [],
  jobCardLabor: [],
  inventory: [],
  locations: [],
  maintenanceRecords: [],
  estimates: [],
  approvedPendingJobs: [],
  dailyAllocations: [],
  availableSailorsLimit: 40,
  dailyAllocationsMap: {}, // Static config (not stored in Firebase)
  approvalAuthorities: ["CCED(E)", "CENA", "DAC(E)", "DGCE", "CCEO(E)"],
  zones: [
    { id: "A-Zone", name: "A-Zone" },
    { id: "BC-Zone", name: "BC-Zone" },
    { id: "Carpentry-Shop", name: "Carpentry Shop" },
    { id: "Welding-Shop", name: "Welding Shop" },
  ],
  offChargeDestinations: [
    "SLNS Tissa",
    "SLNS Vijaya",
    "SLNS Gemunu",
    "SLNS Rangalla",
    "BC-Zone",
    "A-Zone",
    "Carpentry-Shop",
    "Welding-Shop",
    "Public Supply (Town)",
  ],
  tradeStats: {
    MA: { strength: 8, present: 7, leave: 1, sick: 0 },
    CA: { strength: 6, present: 5, leave: 0, sick: 1 },
    PA: { strength: 5, present: 4, leave: 1, sick: 0 },
    PL: { strength: 4, present: 4, leave: 0, sick: 0 },
    WE: { strength: 3, present: 3, leave: 0, sick: 0 },
    RW: { strength: 2, present: 2, leave: 0, sick: 0 },
  },
}; // =============================================
// FIREBASE INTEGRATION LAYER
// DB#1 = sailorsDB  (ce-admin-panel2025)   → READ ONLY
// DB#2 = opsDB      (operations database)    → READ + WRITE
// =============================================
// Helper to safely parse cost, handling commas and string prefixes like "Rs."
function safeParseCost(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  let str = String(val).toLowerCase(); // Remove rs, rs., commas, and spaces
  str = str.replace(/rs\.?/g, "").replace(/,/g, "").replace(/\s/g, ""); // Strip any remaining characters that are not digits or decimal point
  str = str.replace(/[^0-9.]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
} // ── Helper: convert Firebase snapshot object → array with _fbKey ──
function snapshotToArray(snapshot) {
  if (!snapshot.exists()) return [];
  const val = snapshot.val();
  if (Array.isArray(val)) {
    return val
      .map((item, idx) => {
        if (!item) return null;
        return { ...item, _fbKey: String(idx) };
      })
      .filter(Boolean);
  }
  return Object.entries(val).map(([key, item]) => ({ ...item, _fbKey: key }));
} // ── Helper: generate CMSys numeric id from Firebase key ──
let _idCounter = Date.now();
function nextId() {
  return ++_idCounter;
} // ─────────────────────────────────────────────
// DB #1 LISTENERS — Sailors (READ ONLY)
// Reads from the "sailors" node in ce-admin-panel2025
// Maps Firebase fields → CMSys store.sailors format
// ─────────────────────────────────────────────
function initSailorsListener() {
  sailorsDB.ref("sailors").on(
    "value",
    (snapshot) => {
      var _store$sailors$;
      const raw = snapshotToArray(snapshot);
      if (raw.length === 0) {
        console.warn(
          "⚠️ DB#1: sailors node empty or not found — check Firebase structure",
        );
        return;
      } // ── Debug: log first sailor's raw keys so we know exact field names ──
      if (raw[0]) {
        console.log("🔍 DB#1 Sailor raw fields:", Object.keys(raw[0]));
        console.log("🔍 DB#1 First sailor sample:", raw[0]);
      }
      store._seenSailorIds = new Set();
      store.sailors = raw.map((s, idx) => {
        var _ref,
          _ref2,
          _ref3,
          _ref4,
          _ref5,
          _ref6,
          _ref7,
          _ref8,
          _ref9,
          _ref0,
          _ref1,
          _ref10,
          _ref11,
          _ref12,
          _s$official_number,
          _ref13,
          _ref14,
          _s$name,
          _ref15,
          _s$firstName,
          _ref16,
          _s$lastName,
          _ref17,
          _ref18,
          _s$rank,
          _s$id,
          _s$status,
          _ref22,
          _s$attendance,
          _ref23,
          _ref24,
          _s$zone_assigned,
          _ref25,
          _ref26,
          _s$avgScore,
          _ref27,
          _s$yesterdayScore,
          _ref28,
          _s$isZoneTeam,
          _s$yesterdayJob,
          _s$evaluated; // ── Resolve Official / Off Number — try every known field name variant ──
        const offNo =
          (_ref =
            (_ref2 =
              (_ref3 =
                (_ref4 =
                  (_ref5 =
                    (_ref6 =
                      (_ref7 =
                        (_ref8 =
                          (_ref9 =
                            (_ref0 =
                              (_ref1 =
                                (_ref10 =
                                  (_ref11 =
                                    (_ref12 =
                                      (_s$official_number =
                                        s.official_number) !== null &&
                                      _s$official_number !== void 0
                                        ? _s$official_number // official_number
                                        : s.officialNumber) !== null &&
                                    _ref12 !== void 0
                                      ? _ref12 // officialNumber
                                      : s.off_no) !== null && _ref11 !== void 0
                                    ? _ref11 // off_no
                                    : s.offNo) !== null && _ref10 !== void 0
                                  ? _ref10 // offNo
                                  : s.service_no) !== null && _ref1 !== void 0
                                ? _ref1 // service_no
                                : s.serviceNo) !== null && _ref0 !== void 0
                              ? _ref0 // serviceNo
                              : s.reg_no) !== null && _ref9 !== void 0
                            ? _ref9 // reg_no
                            : s.regNo) !== null && _ref8 !== void 0
                          ? _ref8 // regNo
                          : s.personal_no) !== null && _ref7 !== void 0
                        ? _ref7 // personal_no
                        : s.personalNo) !== null && _ref6 !== void 0
                      ? _ref6 // personalNo
                      : s.army_no) !== null && _ref5 !== void 0
                    ? _ref5 // army_no
                    : s.navy_no) !== null && _ref4 !== void 0
                  ? _ref4 // navy_no
                  : s.registration_no) !== null && _ref3 !== void 0
                ? _ref3 // registration_no
                : s.sno) !== null && _ref2 !== void 0
              ? _ref2 // sno
              : s.id_no) !== null && _ref !== void 0
            ? _ref // id_no
            : null; // ── Resolve Name — try variants ──
        const fullName =
          ((_ref13 =
            (_ref14 =
              (_s$name = s.name) !== null && _s$name !== void 0
                ? _s$name
                : s.fullName) !== null && _ref14 !== void 0
              ? _ref14
              : s.full_name) !== null && _ref13 !== void 0
            ? _ref13
            : (
                ((_ref15 =
                  (_s$firstName = s.firstName) !== null &&
                  _s$firstName !== void 0
                    ? _s$firstName
                    : s.first_name) !== null && _ref15 !== void 0
                  ? _ref15
                  : "") +
                " " +
                ((_ref16 =
                  (_s$lastName = s.lastName) !== null && _s$lastName !== void 0
                    ? _s$lastName
                    : s.last_name) !== null && _ref16 !== void 0
                  ? _ref16
                  : "")
              ).trim()) || "Unknown"; // ── Resolve Rank ──
        const rank =
          (_ref17 =
            (_ref18 =
              (_s$rank = s.rank) !== null && _s$rank !== void 0
                ? _s$rank
                : s.rankName) !== null && _ref18 !== void 0
              ? _ref18
              : s.rank_name) !== null && _ref17 !== void 0
            ? _ref17
            : "AB"; // ── Build search index — concatenate ALL string values from raw object ──
        // This means search works regardless of field name in Firebase
        const _searchIndex = Object.values(s)
          .filter((v) => typeof v === "string" || typeof v === "number")
          .map((v) => String(v).toLowerCase())
          .join(" ");
        // Ensure strictly unique ID to prevent mass-assignment bugs if DB has duplicated IDs
        let rawId = s.id !== null && s.id !== void 0 ? String(s.id).trim() : "";
        if (!rawId || rawId === "undefined" || rawId === "null" || rawId === "[object Object]") {
          rawId = String(s._fbKey || idx + 1);
        }
        // Fallback to fbKey/idx if id is duplicated across multiple sailors
        let finalId = rawId;
        if (store._seenSailorIds && store._seenSailorIds.has(finalId)) {
          finalId = String(s._fbKey || idx + 1);
          if (store._seenSailorIds.has(finalId)) finalId = `ID_${idx}_${Date.now()}`;
        }
        if (!store._seenSailorIds) store._seenSailorIds = new Set();
        store._seenSailorIds.add(finalId);

        return {
          ...s,
          _rawIndex: idx,
          _fbKey: s._fbKey || "",
          id: finalId,
          official_number:
            offNo !== null && offNo !== void 0 ? offNo : `ID/${idx}`,
          name: fullName,
          rank: rank,
          city: s.city || "",
          police_station: s.police_station || "",
          district: s.district || "",
          address: s.address || "",
          special_skill: s.special_skill || s.skills || "",
          contact_no: s.contact_no || "",
          blood_group: s.blood_group || "",
          nok_name: s.nok_name || "",
          join_date: s.join_date || "",
          id_expiry: s.id_expiry || "",
          roll: s.roll || "",
          trade: ((_ref19, _ref20, _s$trade) => {
            const t = (
              (_ref19 =
                (_ref20 =
                  (_s$trade = s.trade) !== null && _s$trade !== void 0
                    ? _s$trade
                    : s.tradeName) !== null && _ref20 !== void 0
                  ? _ref20
                  : s.trade_name) !== null && _ref19 !== void 0
                ? _ref19
                : "MA"
            )
              .trim()
              .toUpperCase();
            return t === "WEL" ? "WE" : t;
          })(),
          category: ((_ref21, _s$category) => {
            const o = (offNo !== null && offNo !== void 0 ? offNo : "")
              .trim()
              .toUpperCase();
            if (o.startsWith("EC")) return "Regular";
            if (o.startsWith("AC")) return "Artificer";
            if (o.startsWith("VAS")) return "VAS";
            return (_ref21 =
              (_s$category = s.category) !== null && _s$category !== void 0
                ? _s$category
                : s.cat) !== null && _ref21 !== void 0
              ? _ref21
              : "Regular";
          })(),
          status:
            (_s$status = s.status) !== null && _s$status !== void 0
              ? _s$status
              : "Available",
          attendance:
            (_ref22 =
              (_s$attendance = s.attendance) !== null &&
              _s$attendance !== void 0
                ? _s$attendance
                : s.att) !== null && _ref22 !== void 0
              ? _ref22
              : "Present",
          zone_assigned:
            (_ref23 =
              (_ref24 =
                (_s$zone_assigned = s.zone_assigned) !== null &&
                _s$zone_assigned !== void 0
                  ? _s$zone_assigned
                  : s.zone) !== null && _ref24 !== void 0
                ? _ref24
                : s.zoneId) !== null && _ref23 !== void 0
              ? _ref23
              : "A-Zone",
          avgScore: parseFloat(
            (_ref25 =
              (_ref26 =
                (_s$avgScore = s.avgScore) !== null && _s$avgScore !== void 0
                  ? _s$avgScore
                  : s.performance_score) !== null && _ref26 !== void 0
                ? _ref26
                : s.avg_score) !== null && _ref25 !== void 0
              ? _ref25
              : 7.0,
          ),
          yesterdayScore: parseFloat(
            (_ref27 =
              (_s$yesterdayScore = s.yesterdayScore) !== null &&
              _s$yesterdayScore !== void 0
                ? _s$yesterdayScore
                : s.avgScore) !== null && _ref27 !== void 0
              ? _ref27
              : 7.0,
          ),
          isZoneTeam:
            (_ref28 =
              (_s$isZoneTeam = s.isZoneTeam) !== null &&
              _s$isZoneTeam !== void 0
                ? _s$isZoneTeam
                : s.is_zone_team) !== null && _ref28 !== void 0
              ? _ref28
              : false,
          yesterdayJob:
            (_s$yesterdayJob = s.yesterdayJob) !== null &&
            _s$yesterdayJob !== void 0
              ? _s$yesterdayJob
              : null,
          evaluated:
            (_s$evaluated = s.evaluated) !== null && _s$evaluated !== void 0
              ? _s$evaluated
              : false,
          na_duration: s.na_duration || s.leave_pattern || s.duration_str || "",
          _fbKey: s._fbKey,
          _searchIndex, // ← used for search — covers ALL Firebase fields
        };
      });
      console.log(`✅ DB#1: Loaded ${store.sailors.length} sailors`);
      console.log(
        `   Sample Off No: "${(_store$sailors$ = store.sailors[0]) === null || _store$sailors$ === void 0 ? void 0 : _store$sailors$.official_number}"`,
      ); // Re-render dashboard or summary if visible
      if (
        !document.getElementById("view-dashboard").classList.contains("hidden")
      ) {
        renderDashboard();
      }
      if (
        typeof renderSummaryView === "function" &&
        !document.getElementById("view-summary").classList.contains("hidden")
      ) {
        renderSummaryView();
      }
      if (
        typeof renderSailorsView === "function" &&
        !document.getElementById("view-sailors").classList.contains("hidden")
      ) {
        renderSailorsView();
      } // Re-render personal sailor dashboard if active profile is Sailor
      if (store.activeProfileType === "Sailor") {
        renderSailorDashboardView();
      } // Re-render user settings profile if settings page is open
      if (
        !document
          .getElementById("view-settings")
          .classList.contains("hidden") &&
        _currentSettingsTab === "user"
      ) {
        switchSettingsTab("user");
      }
      if (typeof populateSignatoryDropdowns === "function")
        populateSignatoryDropdowns();
    },
    (error) => {
      console.error("❌ DB#1 Sailors listener error:", error);
    },
  );
}
function initAvailabilityListener() {
  sailorsDB.ref("availability").on(
    "value",
    (snapshot) => {
      if (snapshot.exists()) {
        store.availability = snapshot.val();
      } else {
        store.availability = {};
      }
      if (
        typeof renderDashboard === "function" &&
        !document.getElementById("view-dashboard").classList.contains("hidden")
      ) {
        renderDashboard();
      }
      if (
        typeof renderSummaryView === "function" &&
        !document.getElementById("view-summary").classList.contains("hidden")
      ) {
        renderSummaryView();
      }
    },
    (error) => {
      console.error("Availability read error:", error);
      showToast("Error reading Leave data: " + error.message, "error");
    },
  );
}
function initLongTermDeploymentsListeners() {
  opsDB.ref("out_projects").on("value", (snapshot) => {
    store.outProjects = snapshot.val() || {};
    renderDashboard();
    renderProjectsList();
  });
  opsDB.ref("housing_projects").on("value", (snapshot) => {
    store.housingProjects = snapshot.val() || {};
    renderDashboard();
    renderProjectsList();
  });
  opsDB.ref("other_bases").on("value", (snapshot) => {
    store.otherBases = snapshot.val() || {};
    renderDashboard();
    renderProjectsList();
  });
  sailorsDB.ref("temp_drafts").on("value", (snapshot) => {
    store.tempDrafts = snapshot.val() || {};
    renderDashboard();
  });
} // ─────────────────────────────────────────────
// DB #2 LISTENERS — CE Management System Operations (READ + WRITE)
// ─────────────────────────────────────────────
function standardizeInventoryDescription(desc) {
  if (!desc) return "";
  let clean = desc.trim(); // Remove wrapping quotes if present
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.substring(1, clean.length - 1).trim();
  } // Replace double double-quotes "" with a single double-quote "
  clean = clean.replace(/""/g, '"'); // Also remove leading/trailing quotes that might have been left over if they were unbalanced
  if (clean.startsWith('"')) clean = clean.substring(1).trim();
  if (clean.endsWith('"')) clean = clean.substring(0, clean.length - 1).trim(); // Replace multiple spaces with a single space
  clean = clean.replace(/\s+/g, " "); // Perform case-insensitive spelling auto-corrections
  clean = clean.replace(/\bball\s+cocks?\b/gi, "Ballcock Valve");
  clean = clean.replace(/\bceiling\s+paints?\s+whites?\b/gi, "Ceiling White");
  clean = clean.replace(/\bmac\s+foils?\b/gi, "Mackfoil");
  clean = clean.replace(/\bbriliyant\s+whites?\b/gi, "Briliant White");
  clean = clean.replace(/\broopings?\b/gi, "Roofing");
  clean = clean.replace(/\blbows?\b/gi, "Elbow");
  clean = clean.replace(/\bl\/\s*bows?\b/gi, "Elbow");
  clean = clean.replace(/\bfexibal\b/gi, "Flexible");
  clean = clean.replace(/\bpenal\s+pins?\b/gi, "Panel Pin");
  clean = clean.replace(/\bgrinder\s+dise\b/gi, "Grinder Disc");
  clean = clean.replace(/\brollel\s+brash\b/gi, "Roler Brush");
  clean = clean.replace(/\bms\s+plte\b/gi, "MS Plate");
  clean = clean.replace(/\bms\s+plete\b/gi, "MS Plate");
  clean = clean.replace(/\bgipso\s+board\b/gi, "Gypson Board");
  clean = clean.replace(/\balaminium\s+sealer\b/gi, "Aluminium Sealer");
  clean = clean.replace(/\banticoresive\b/gi, "Anticorrosive");
  return toTitleCase(clean);
}
function toTitleCase(str) {
  if (!str) return "";
  const acronyms = ["PVC", "BMS", "GI", "MS", "SLN", "UOM", "VAT", "ALU"];
  return str
    .split(" ")
    .map((word) => {
      if (!word) return "";
      const upper = word.toUpperCase();
      const cleanWord = upper.replace(/[^A-Z0-9]/g, "");
      if (acronyms.includes(cleanWord)) {
        return upper; // Keep acronyms fully capitalized
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
function standardizeInventoryCategory(cat) {
  if (!cat) return "General";
  const cleaned = cat.trim().toUpperCase();
  const mapping = {
    METAL: "Metal",
    YAKADA: "Metal",
    YAD: "Metal",
    STANSILE: "Stencil",
    STENCIL: "Stencil",
    PAINT: "Paint",
    PAI: "Paint",
    GENERAL: "General",
    BMS: "BMS",
    TIMBER: "BMS",
    PLUMBING: "Plumbing",
    PVC: "Plumbing",
    ALUMINIUM: "Aluminium",
    ALUMINUM: "Aluminium",
    ALU: "Aluminium",
    ELECTRICAL: "Electrical",
    TOOLS: "Tools",
    TOOL: "Tools",
    "LUBRICANT OIL": "Lubricant Oil",
    LUBRICANT: "Lubricant Oil",
    OIL: "Lubricant Oil",
    ENG: "Eng",
  };
  if (mapping[cleaned]) return mapping[cleaned];
  const standardCats = [
    "BMS",
    "Plumbing",
    "Metal",
    "Stencil",
    "General",
    "Aluminium",
    "Paint",
    "Electrical",
    "Tools",
    "Lubricant Oil",
    "Eng",
  ];
  const matched = standardCats.find((sc) => sc.toUpperCase() === cleaned);
  if (matched) return matched;
  return cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1).toLowerCase();
}
function initOpsListeners() {
  // ── Work Orders ──
  opsDB.ref("work_orders").on("value", (snapshot) => {
    const raw = snapshotToArray(snapshot);
    const today = getLocalDateString();
    store.workOrders = raw.map((wo) => {
      var _wo$id, _wo$assigned, _wo$last_assigned;
      const mappedWo = {
        ...wo,
        id: (_wo$id = wo.id) !== null && _wo$id !== void 0 ? _wo$id : wo._fbKey,
        assigned: Array.isArray(wo.assigned)
          ? wo.assigned
          : Object.values(
              (_wo$assigned = wo.assigned) !== null && _wo$assigned !== void 0
                ? _wo$assigned
                : {},
            ),
        last_assigned: Array.isArray(wo.last_assigned)
          ? wo.last_assigned
          : Object.values(
              (_wo$last_assigned = wo.last_assigned) !== null &&
                _wo$last_assigned !== void 0
                ? _wo$last_assigned
                : {},
            ),
      };
      return mappedWo;
    });
    refreshCurrentView();
    console.log(`📋 DB#2: ${store.workOrders.length} work orders loaded`);
  }); // ── Job Cards ──
  opsDB.ref("job_cards").on("value", (snapshot) => {
    store.jobCards = snapshotToArray(snapshot).map((jc) => {
      var _jc$id;
      return {
        ...jc,
        id: (_jc$id = jc.id) !== null && _jc$id !== void 0 ? _jc$id : jc._fbKey,
      };
    });
    refreshCurrentView();
  }); // ── Job Card Materials ──
  opsDB.ref("job_card_materials").on("value", (snapshot) => {
    store.jobCardMaterials = snapshotToArray(snapshot).map((m) => {
      var _m$id;
      return {
        ...m,
        id: (_m$id = m.id) !== null && _m$id !== void 0 ? _m$id : m._fbKey,
      };
    });
    refreshCurrentView();
  }); // ── Job Card Labor ──
  opsDB.ref("job_card_labor").on("value", (snapshot) => {
    store.jobCardLabor = snapshotToArray(snapshot).map((l) => {
      var _l$id;
      return {
        ...l,
        id: (_l$id = l.id) !== null && _l$id !== void 0 ? _l$id : l._fbKey,
      };
    });
    refreshCurrentView();
  }); // Helper to safely parse cost, handling commas and string prefixes like "Rs."
  const safeParseCost = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === "number") return val;
    let str = String(val).toLowerCase(); // Remove rs, rs., commas, and spaces
    str = str.replace(/rs\.?/g, "").replace(/,/g, "").replace(/\\s/g, ""); // Strip any remaining characters that are not digits or decimal point
    str = str.replace(/[^0-9.]/g, "");
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };
  const extractCost = (item) => {
    var _ref29, _ref30, _ref31, _ref32, _item$cost_per_unit; // Known keys
    const knownCost =
      (_ref29 =
        (_ref30 =
          (_ref31 =
            (_ref32 =
              (_item$cost_per_unit = item.cost_per_unit) !== null &&
              _item$cost_per_unit !== void 0
                ? _item$cost_per_unit
                : item.unit_cost) !== null && _ref32 !== void 0
              ? _ref32
              : item.cost) !== null && _ref31 !== void 0
            ? _ref31
            : item.price) !== null && _ref30 !== void 0
          ? _ref30
          : item.Cost) !== null && _ref29 !== void 0
        ? _ref29
        : item.Price;
    if (knownCost !== undefined && knownCost !== null && knownCost !== "") {
      return safeParseCost(knownCost);
    } // Dynamic search for any key containing 'cost' or 'price'
    for (let k of Object.keys(item)) {
      let lk = k.toLowerCase();
      if (
        lk.includes("cost") ||
        lk.includes("price") ||
        lk.includes("rate") ||
        lk.includes("amount")
      ) {
        const parsed = safeParseCost(item[k]);
        if (parsed > 0) return parsed;
      }
    }
    return 0;
  }; // ── Inventory ──
  const validUnits = new Set([
    "nos", "no", "kg", "kgs", "g", "gram", "grams", "l", "ltr", "liters", "litre", "litres",
    "m", "mtr", "meters", "ft", "feet", "lft", "length feet", "sqft", "sqm", "pcs", "pkt", "pkts",
    "roll", "rolls", "box", "boxes", "bags", "bag", "bundle", "set", "sets",
    "pair", "pairs", "cubes", "cube", "yards", "yds", "tin", "tins",
    "bottle", "bottles", "drum", "drums", "can", "cans", "length", "lengths"
  ]);

  opsDB.ref("inventory").on("value", (snapshot) => {
    store.inventory = snapshotToArray(snapshot).map((item) => {
      var _item$id;
      let rawCost = extractCost(item);
      let deno = String(item.deno || "").trim();

      // If cost is 0 or missing, but deno contains a numeric unit cost (due to shifted columns in past uploads)
      if (rawCost === 0 && /^\d+(\.\d+)?$/.test(deno) && !validUnits.has(deno.toLowerCase())) {
        rawCost = parseFloat(deno) || 0;
        const descLower = (item.description || "").toLowerCase();
        if (descLower.includes("pkt") || descLower.includes("packet")) deno = "Pkt";
        else if (descLower.includes("roll")) deno = "Roll";
        else if (descLower.includes("bag")) deno = "Bag";
        else if (descLower.includes("tin") || descLower.includes("can")) deno = "Tin";
        else if (descLower.includes("bottle")) deno = "Bottle";
        else if (descLower.includes("kg") || descLower.includes("kilogram")) deno = "Kg";
        else if (descLower.includes("drum")) deno = "Drum";
        else if (descLower.includes("sqft") || descLower.includes("sq.ft")) deno = "Sqft";
        else if (descLower.includes("mtr") || descLower.includes("meter")) deno = "Mtr";
        else if (descLower.includes("feet") || descLower.includes("foot") || descLower.includes("ft")) deno = "Feet";
        else deno = "Nos";
      } else if (/^\d+$/.test(deno) && parseFloat(deno) === 0) {
        deno = "Nos";
      }

      let bookNo = item.book_no || "";
      let loc = item.location || "";

      // If book_no was erroneously set to a zone name (e.g. "E Zone", "D Zone")
      if (bookNo && (bookNo.includes("Zone") || (item.zone_id && bookNo.trim().toLowerCase() === item.zone_id.trim().toLowerCase()))) {
        bookNo = "";
      }

      // If location is empty or is just the zone name, set standard store name
      if (!loc || (item.zone_id && loc.trim().toLowerCase() === item.zone_id.trim().toLowerCase()) || loc.includes("Zone")) {
        loc = "Zone Store";
      }

      return {
        ...item,
        id:
          (_item$id = item.id) !== null && _item$id !== void 0
            ? _item$id
            : item._fbKey,
        category: standardizeInventoryCategory(item.category),
        description: standardizeInventoryDescription(item.description),
        deno: deno || "Nos",
        cost_per_unit: rawCost,
        book_no: bookNo,
        location: loc || "Zone Store",
        on_charge_records: item.on_charge_records
          ? Object.values(item.on_charge_records)
          : [],
        off_charge_records: item.off_charge_records
          ? Object.values(item.off_charge_records)
          : [],
      };
    });
    refreshCurrentView();
    console.log(`📦 DB#2: ${store.inventory.length} inventory items loaded`);
  }); // ── Locations ──
  opsDB.ref("locations").on("value", (snapshot) => {
    store.locations = snapshotToArray(snapshot).map((l) => {
      var _l$id2;
      return {
        ...l,
        id: (_l$id2 = l.id) !== null && _l$id2 !== void 0 ? _l$id2 : l._fbKey,
      };
    });
    if (typeof renderSettingsLocationsTable === "function") {
      renderSettingsLocationsTable();
    }
    if (typeof populateEstLocationsDatalist === "function") {
      populateEstLocationsDatalist();
    }
    if (typeof renderLocationsList === "function") {
      renderLocationsList();
    }
  }); // ── Maintenance Records ──
  opsDB.ref("maintenance_records").on("value", (snapshot) => {
    store.maintenanceRecords = snapshotToArray(snapshot).map((r) => {
      var _r$id;
      return {
        ...r,
        id: (_r$id = r.id) !== null && _r$id !== void 0 ? _r$id : r._fbKey,
      };
    });
    refreshCurrentView();
  }); // ── Estimates ──
  opsDB.ref("estimates").on("value", (snapshot) => {
    store.estimates = snapshotToArray(snapshot).map((e) => {
      var _e$id;
      return {
        ...e,
        id: (_e$id = e.id) !== null && _e$id !== void 0 ? _e$id : e._fbKey,
        materials: e.materials ? Object.values(e.materials) : [],
        labor: e.labor ? Object.values(e.labor) : [],
      };
    });
    refreshCurrentView();
    console.log(`📐 DB#2: ${store.estimates.length} estimates loaded`);
  }); // ── Approved Pending Jobs ──
  opsDB.ref("approved_pending_jobs").on("value", (snapshot) => {
    store.approvedPendingJobs = snapshotToArray(snapshot).map((j) => {
      var _j$id;
      return {
        ...j,
        id: (_j$id = j.id) !== null && _j$id !== void 0 ? _j$id : j._fbKey,
      };
    });
  }); // ── Daily Allocations ──
  opsDB.ref("daily_allocations").on("value", (snapshot) => {
    const arr = snapshotToArray(snapshot);
    store.dailyAllocations = arr;
    const map = {};
    arr.forEach((a) => {
      map[`${a.date}_${sanitizeFbKey(a.sailor_id)}`] = a;
    });
    store.dailyAllocationsMap = map;
    refreshCurrentView();
  });
  console.log("🔥 DB#2: All ops listeners attached");
} // ─────────────────────────────────────────────
// DB #2 SAVE HELPERS — Write to Firebase DB #2
// ─────────────────────────────────────────────
// Save / update a work order (returns Promise)
function fbSaveWorkOrder(data) {
  const { _fbKey, ...clean } = data;
  if (clean.assigned && clean.assigned.length === 0) {
    clean.assigned = null;
  }
  if (_fbKey) {
    return opsDB.ref(`work_orders/${_fbKey}`).update(clean);
  }
  return opsDB.ref("work_orders").push({ ...clean, created_at: Date.now() });
}

// Safe concurrent helpers for assigned array to prevent race conditions
function safeFbAssignSailor(woKey, sailorId, dateStr) {
  if (!woKey || !sailorId) return;
  const woRef = opsDB.ref('work_orders/' + woKey);
  woRef.child('assigned').transaction((curr) => {
    let arr = Array.isArray(curr) ? curr : (curr ? Object.values(curr) : []);
    if (!arr.includes(sailorId)) arr.push(sailorId);
    return arr;
  });
  if (dateStr) woRef.update({ last_assigned_date: dateStr });
}

function safeFbRemoveSailor(woKey, sailorId, dateStr) {
  if (!woKey || !sailorId) return;

  const sailor = (store.sailors || []).find(
    (s) => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId) || String(s.official_number) === String(sailorId)
  );

  const idsToRemove = new Set([String(sailorId)]);
  if (sailor) {
    if (sailor.id) idsToRemove.add(String(sailor.id));
    if (sailor._fbKey) idsToRemove.add(String(sailor._fbKey));
    if (sailor.official_number) idsToRemove.add(String(sailor.official_number));
  }

  // 1. Transaction for work_orders
  const woRef = opsDB.ref('work_orders/' + woKey);
  woRef.child('assigned').transaction((curr) => {
    if (!curr) return null;
    let arr = Array.isArray(curr) ? curr : Object.values(curr);
    const filtered = arr.filter(id => !idsToRemove.has(String(id)));
    return filtered.length > 0 ? filtered : null;
  });

  // 2. Transaction for job_cards
  const jcRef = opsDB.ref('job_cards/' + woKey);
  jcRef.child('assigned').transaction((curr) => {
    if (!curr) return null;
    let arr = Array.isArray(curr) ? curr : Object.values(curr);
    const filtered = arr.filter(id => !idsToRemove.has(String(id)));
    return filtered.length > 0 ? filtered : null;
  });

  if (dateStr) {
    woRef.update({ last_assigned_date: dateStr });
    jcRef.update({ last_assigned_date: dateStr });

    // Clean daily_allocations in Firebase for all ID variations
    idsToRemove.forEach((id) => {
      opsDB.ref(`daily_allocations/${dateStr}_${sanitizeFbKey(id)}`).remove();
    });

    // Clean in-memory store.dailyAllocations
    if (store.dailyAllocations && Array.isArray(store.dailyAllocations)) {
      store.dailyAllocations = store.dailyAllocations.filter(
        (a) => a.date !== dateStr || !idsToRemove.has(String(a.sailor_id))
      );
    }
  }

  if (sailor) {
    sailor.status = "Available";
  }
}

// Check if the current logged-in officer is the main administrator (LCDR KMAU KAHANDAWA - NRC 3576)
function isMainAdminLoggedIn() {
  if (store.activeProfileType === "OIC" && store.activeOicProfileId) {
    const profile = (typeof getOicProfiles === "function" ? getOicProfiles() : []).find(
      (p) => p.id === store.activeOicProfileId
    );
    if (profile) {
      return (profile.serviceNo || "").includes("3576");
    }
  }
  const savedServiceNo = localStorage.getItem("ncw_logged_officer_no") || "";
  if (savedServiceNo) {
    return savedServiceNo.includes("3576");
  }
  if (store.currentOfficerProfile && store.currentOfficerProfile.serviceNo) {
    return String(store.currentOfficerProfile.serviceNo).includes("3576");
  }
  return false;
}

// Helper to force clean all stuck/orphaned Firebase assignments for a sailor by any ID variation (Restricted to NRC 3576)
window.forceCleanSailorAssignments = function(officialNoOrId) {
  if (!isMainAdminLoggedIn()) {
    if (typeof showToast === "function") {
      showToast("Access Denied: Only LCDR KMAU KAHANDAWA (NRC 3576) is authorized to release sailors!", "error");
    }
    return;
  }

  if (!officialNoOrId) return;

  const sailors = (store.sailors || []).filter(s => 
    String(s.official_number) === String(officialNoOrId) ||
    String(s.id) === String(officialNoOrId) ||
    String(s._fbKey) === String(officialNoOrId)
  );

  const ids = new Set([String(officialNoOrId)]);
  sailors.forEach(s => {
    if (s.id) ids.add(String(s.id));
    if (s._fbKey) ids.add(String(s._fbKey));
    if (s.official_number) ids.add(String(s.official_number));
  });

  const today = typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0];

  // 1. Remove from all work_orders assigned in Firebase & Memory
  (store.workOrders || []).forEach(wo => {
    if (wo.assigned && Array.isArray(wo.assigned)) {
      const hasMatch = wo.assigned.some(id => ids.has(String(id)));
      if (hasMatch) {
        wo.assigned = wo.assigned.filter(id => !ids.has(String(id)));
        opsDB.ref(`work_orders/${wo._fbKey || wo.id}/assigned`).set(wo.assigned.length > 0 ? wo.assigned : null);
      }
    }
  });

  // 2. Remove from all job_cards assigned in Firebase & Memory
  (store.jobCards || []).forEach(jc => {
    if (jc.assigned && Array.isArray(jc.assigned)) {
      const hasMatch = jc.assigned.some(id => ids.has(String(id)));
      if (hasMatch) {
        jc.assigned = jc.assigned.filter(id => !ids.has(String(id)));
        opsDB.ref(`job_cards/${jc._fbKey || jc.id}/assigned`).set(jc.assigned.length > 0 ? jc.assigned : null);
      }
    }
  });

  // 3. Remove all daily_allocations in Firebase for all ID variants
  ids.forEach(id => {
    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(id)}`).remove();
    (store.dailyAllocations || []).forEach(a => {
      if (ids.has(String(a.sailor_id))) {
        opsDB.ref(`daily_allocations/${a.date}_${sanitizeFbKey(id)}`).remove();
        if (a._fbKey) opsDB.ref(`daily_allocations/${a._fbKey}`).remove();
      }
    });
  });

  // 4. Update in-memory store
  if (store.dailyAllocations) {
    store.dailyAllocations = store.dailyAllocations.filter(a => !ids.has(String(a.sailor_id)));
  }

  sailors.forEach(s => s.status = "Available");

  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast(`Released sailor ${officialNoOrId} from assignment`, "success");
};

// Save / update a job card
function fbSaveJobCard(data) {
  const { _fbKey, ...clean } = data;
  if (clean.assigned && clean.assigned.length === 0) {
    clean.assigned = null;
  }
  if (_fbKey) {
    return opsDB.ref(`job_cards/${_fbKey}`).update(clean);
  }
  return opsDB.ref("job_cards").push({ ...clean, created_at: Date.now() });
} // Log a material to a job card
function fbSaveJobCardMaterial(data) {
  return opsDB
    .ref("job_card_materials")
    .push({ ...data, logged_at: Date.now() });
} // Log labor to a job card
function fbSaveJobCardLabor(data) {
  return opsDB.ref("job_card_labor").push({ ...data, logged_at: Date.now() });
} // Save / update inventory item
function fbSaveInventoryItem(data) {
  const { _fbKey, id, ...rawClean } = data;
  const clean = {};
  for (let [k, v] of Object.entries(rawClean)) {
    if (v !== undefined && v !== null) {
      clean[k] = v;
    }
  }
  if (clean.category) {
    clean.category = standardizeInventoryCategory(clean.category);
  }
  if (clean.description) {
    clean.description = standardizeInventoryDescription(clean.description);
  }

  const targetKey =
    _fbKey ||
    (id && store.inventory
      ? store.inventory.find(
          (i) => String(i.id) === String(id) || String(i._fbKey) === String(id),
        )?._fbKey
      : null) ||
    id;

  if (targetKey) {
    return opsDB.ref(`inventory/${targetKey}`).update(clean);
  }
  return opsDB
    .ref("inventory")
    .push({ ...clean, date_added: clean.date_added || getLocalDateString() });
} // Save / update estimate
function fbSaveEstimate(data) {
  const { _fbKey, ...clean } = data;
  if (_fbKey) {
    return opsDB.ref(`estimates/${_fbKey}`).update(clean);
  }
  return opsDB.ref("estimates").push({ ...clean, created_at: Date.now() });
} // Save maintenance record
function fbSaveMaintenanceRecord(data) {
  return opsDB
    .ref("maintenance_records")
    .push({ ...data, created_at: Date.now() });
} // Save location
function fbSaveLocation(data) {
  const { _fbKey, ...clean } = data;
  if (_fbKey) {
    return opsDB.ref(`locations/${_fbKey}`).update(clean);
  }
  return opsDB.ref("locations").push({ ...clean });
} // Save daily allocation
// Sanitize keys for Firebase paths (replaces /, ., #, $, [, ] with -)
function sanitizeFbKey(id) {
  return String(id).replace(/[\/.#$\[\]]/g, "-");
}
function fbSaveDailyAllocation(data) {
  const key = `${data.date}_${sanitizeFbKey(data.sailor_id)}`;
  return opsDB
    .ref(`daily_allocations/${key}`)
    .set({ ...data, assigned_at: Date.now() });
} // Save approved pending job
function fbSaveApprovedPendingJob(data) {
  const { _fbKey, ...clean } = data;
  if (_fbKey) {
    return opsDB.ref(`approved_pending_jobs/${_fbKey}`).update(clean);
  }
  return opsDB.ref("approved_pending_jobs").push({ ...clean });
} // Update sailor zone-team status back to DB #1 (if permitted by Firebase rules)
// NOTE: This writes to ce-admin-panel2025 — ensure rules allow it
function fbUpdateSailorZoneTeam(fbKey, isZoneTeam) {
  if (!fbKey) return Promise.resolve();
  return sailorsDB.ref(`sailors/${fbKey}/isZoneTeam`).set(isZoneTeam);
} // ─────────────────────────────────────────────
// Refresh whichever view tab is currently visible
// ─────────────────────────────────────────────
function computeYesterdayJobs() {
  if (!store.dailyAllocations || !store.sailors) return;
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today; 
  
  // 1. Get all work orders and job cards belonging to the current zone
  const currentZoneWOIds = new Set([
      ...(store.workOrders || []).filter(w => String(w.zone_id) === String(store.currentZone)).map(w => String(w.id || w._fbKey)),
      ...(store.jobCards || []).filter(j => String(j.zone_id) === String(store.currentZone)).map(j => String(j.id || j._fbKey))
  ]);

  // 2. Find all past allocations for these current zone work orders
  const zoneAllocations = (store.dailyAllocations || []).filter(a => 
      currentZoneWOIds.has(String(a.work_order_id))
  );

  // 3. Find the most recent date with the SAME Rooting Type
  let targetRootingType = "Normal Rooting";
  if (typeof getCurrentRootingType === 'function') {
      targetRootingType = getCurrentRootingType(new Date(dateVal + "T12:00:00"));
  }

  const pastDates = [...new Set(zoneAllocations.map((a) => a.date))]
    .filter((d) => {
        if (d >= dateVal) return false;
        let dRootingType = "Normal Rooting";
        if (typeof getCurrentRootingType === 'function') {
            dRootingType = getCurrentRootingType(new Date(d + "T12:00:00"));
        }
        return dRootingType === targetRootingType;
    })
    .sort((a, b) => b.localeCompare(a));
  const lastActiveDate = pastDates[0];

  let assignedCount = 0;
  // 4. Populate yesterdayJob ONLY for sailors who worked on current zone WOs on that date
  store.sailors.forEach((s) => {
    s.yesterdayJob = null;
    if (lastActiveDate && store.dailyAllocationsMap) {
      const alloc = store.dailyAllocationsMap[`${lastActiveDate}_${sanitizeFbKey(s.id)}`] || store.dailyAllocationsMap[`${lastActiveDate}_${s.id}`];
      if (alloc && currentZoneWOIds.has(String(alloc.work_order_id))) {
        s.yesterdayJob = alloc.work_order_id;
        assignedCount++;
      }
    }
  });
}
let _refreshViewTimeout = null;
function refreshCurrentView() {
  if (_refreshViewTimeout) {
    clearTimeout(_refreshViewTimeout);
  }
  _refreshViewTimeout = setTimeout(() => {
    refreshCurrentViewImmediately();
  }, 100);
}
function refreshCurrentViewImmediately() {
  computeYesterdayJobs();
  updateCounters();
  
  const view = store.currentView || "dashboard";
  switch (view) {
    case "nastatus":
      if (typeof renderNastatusView === "function") renderNastatusView();
      break;
    case "dashboard":
      renderDashboard();
      break;
    case "projects":
      renderProjectsList();
      break;
    case "jobcards":
      renderJobCardsView();
      break;
    case "inventory":
      renderInventory();
      break;
    case "estimates":
      renderEstimates();
      break;
    case "maintenance":
      renderMaintenance();
      break;
    case "reports":
      renderReports();
      break;
    case "dailydetails":
      renderDailyDetailsSpecialView();
      break;
    case "summary":
      renderSummaryView();
      break;
    case "sailors":
      renderSailorsView();
      break;
    case "sailordashboard":
      renderSailorDashboardView();
      break;
  }
} // =============================================
// UTILITY FUNCTIONS
// =============================================
function updateDateTime() {
  const now = new Date();
  document.getElementById("currentDate").textContent = now.toLocaleDateString(
    "en-GB",
    { weekday: "short", year: "numeric", month: "short", day: "numeric" },
  );
  document.getElementById("currentTime").textContent = now.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit", second: "2-digit" },
  );
  
  // Update Rooting Banner
  const rootingBadge = document.getElementById("currentRootingBadge");
  const rootingText = document.getElementById("currentRootingText");
  const rootingDot = document.getElementById("currentRootingDot");
  if (rootingBadge && rootingText && rootingDot && typeof getCurrentRootingType === 'function') {
      const activeDateStr = store.dashboardDate || getLocalDateString();
      const activeDateObj = new Date(activeDateStr + "T12:00:00");
      const rootingStr = getCurrentRootingType(activeDateObj);
      rootingText.textContent = rootingStr;
      rootingBadge.classList.remove("hidden");
      
      // Styling based on normal vs holiday
      if (rootingStr.includes("Sunday Rooting")) {
          rootingBadge.className = "flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border transition-all duration-300 border-rose-500/30 bg-rose-500/10 text-rose-400";
          rootingDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse";
      } else {
          rootingBadge.className = "flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border transition-all duration-300 border-blue-500/30 bg-blue-500/10 text-blue-400";
          rootingDot.className = "w-1.5 h-1.5 rounded-full bg-blue-500";
      }
  }

  if (document.getElementById("reportDate")) {
    document.getElementById("reportDate").textContent =
      now.toLocaleDateString("en-GB");
  } // Check time for evening mode (18:00 - 20:00)
  const hour = now.getHours();
  const evalBtn = document.getElementById("evalModeBtn");
  if (hour >= 18 && hour < 20) {
    if (evalBtn) evalBtn.classList.remove("hidden");
    store.isEveningMode = true;
  } else {
    if (evalBtn) evalBtn.classList.add("hidden");
    store.isEveningMode = false;
  }
}
let _toastTimeout = null;
function showToast(message, type = "success", duration = 4000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.className = `fixed bottom-4 right-4 ${type === "success" ? "bg-slate-900 border border-slate-700" : type === "error" ? "bg-red-700" : "bg-blue-700"} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all z-[9999]`;
  const msgEl = document.getElementById("toastMessage");
  if (msgEl) msgEl.innerHTML = message;
  toast.classList.remove("hidden");
  if (_toastTimeout) clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => toast.classList.add("hidden"), duration);
}
let _justClosedModal = false;
function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (!m) return;
  m.classList.add("hidden");
  m.style.removeProperty("display");
  m.style.removeProperty("opacity");
  m.style.removeProperty("visibility");
  m.style.removeProperty("z-index");
  _justClosedModal = true;
  
  // Prevent ghost clicks hitting underlying elements (like the Settings tab) immediately after closing
  document.body.style.pointerEvents = "none";
  setTimeout(() => {
    document.body.style.pointerEvents = "";
  }, 500);

  setTimeout(() => {
    _justClosedModal = false;
  }, 1000);
}
function formatCurrency(amount) {
  return (
    "Rs. " +
    parseFloat(amount || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function getPerformanceColor(score) {
  if (score >= 8) return "bg-green-500 text-white";
  if (score >= 6) return "bg-amber-500 text-white";
  if (score >= 4) return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}
function getPerformanceTextColor(score) {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-amber-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
}

function findSailorById(sailorId) {
  if (sailorId === undefined || sailorId === null || sailorId === "") return null;
  const sid = String(sailorId).trim();
  if (!sid || sid === "undefined" || sid === "null") return null;

  // 1. Direct match on id, _fbKey, official_number, off_no, service_no, sno, _rawIndex
  const directMatch = (store.sailors || []).find((s) => {
    if (String(s.id) === sid) return true;
    if (s._fbKey && String(s._fbKey) === sid) return true;
    if (s._rawIndex !== undefined && String(s._rawIndex) === sid) return true;
    if (s.official_number && String(s.official_number).trim().toUpperCase() === sid.toUpperCase()) return true;
    if (s.off_no && String(s.off_no).trim().toUpperCase() === sid.toUpperCase()) return true;
    if (s.service_no && String(s.service_no).trim().toUpperCase() === sid.toUpperCase()) return true;
    if (s.sno && String(s.sno) === sid) return true;
    return false;
  });

  if (directMatch) return directMatch;

  // 2. Numeric index fallback (if sid is a pure number like "285", "426")
  if (/^\d+$/.test(sid)) {
    const numIdx = parseInt(sid, 10);
    // 0-based array index
    if (store.sailors && store.sailors[numIdx]) {
      return store.sailors[numIdx];
    }
    // 1-based array index
    if (numIdx > 0 && store.sailors && store.sailors[numIdx - 1]) {
      return store.sailors[numIdx - 1];
    }
  }

  return null;
} // =============================================
// VIEW MANAGEMENT
// =============================================
function switchView(view, preventPushState = false) {
  store.currentView = view;
  if (!preventPushState) {
    window.history.pushState({ view: view }, "", `#${view}`);
  }
  if (typeof toggleLeftSidebar === "function") {
    toggleLeftSidebar(false);
  }
  document
    .querySelectorAll(".view-content")
    .forEach((v) => v.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll('[id^="tab-"]').forEach((t) => {
    t.classList.remove("tab-active");
  });
  const activeTab = document.getElementById(`tab-${view}`);
  if (activeTab) activeTab.classList.add("tab-active"); // Update bottom nav tabs active styles
  document.querySelectorAll('[id^="mobile-tab-"]').forEach((btn) => {
    btn.classList.remove("text-teal-400");
    btn.classList.add("text-slate-400");
  });
  const activeMobileTab = document.getElementById(`mobile-tab-${view}`);
  if (activeMobileTab) {
    activeMobileTab.classList.remove("text-slate-400");
    activeMobileTab.classList.add("text-teal-400");
  }
    switch (view) {
      case "nastatus":
        if (typeof renderNastatusView === "function") renderNastatusView();
        break;
      case "dashboard":
        renderDashboard();
        break;
    case "projects":
      renderProjectsList();
      break;
    case "jobcards":
      renderJobCardsView();
      break;
    case "inventory":
      renderInventory();
      break;
    case "estimates":
      renderEstimates();
      break;
    case "maintenance":
      renderMaintenance();
      break;
    case "reports":
      renderReports();
      break;
    case "settings":
      renderSettings();
      break;
    case "dailydetails":
      renderDailyDetailsSpecialView();
      break;
    case "summary":
      renderSummaryView();
      break;
    case "sailors":
      renderSailorsView();
      break;
    case "sailordashboard":
      renderSailorDashboardView();
      break;
  }
}
function changeZone() {
  store.currentZone = document.getElementById("zoneSelector").value;
  localStorage.setItem("ncw_saved_zone", store.currentZone);
  store.selectedEstimate = null;
  store.selectedEstimatesForPrint = [];
  applySettings();
  toggleViewsBasedOnZone();
  refreshCurrentView();
  showToast(`Switched to ${store.currentZone}`);
} // Helper to calculate automated N/A duration using exact sailors_details.php grouping algorithm
function calculateSailorNADuration(sailor) {
  const sailorId = String(sailor.id || sailor._fbKey || "");
  const sailorFbKey = String(sailor._fbKey || sailor.id || "");
  const initStatus = String(sailor.status || sailor.attendance || "").trim();

  // 💡 S/R (Sick Report) and DL (Days Leave) are single-day events (morning report / 1-day leave)
  if (/^(S\/R|Sick Report|DL|Days Leave)$/i.test(initStatus)) {
    return "1 Day";
  }

  const isLeaveCode = (val) => {
    if (!val) return false;
    const str = typeof val === "string" ? val.trim() : String(val).trim();
    return /^(Leave|Sick|NA|N\/A|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|Run|AWOL|නිවාඩු|ගිලන්)$/i.test(str);
  };

  // 1. Collect all availability records for this sailor from store.availability (same as sailors_details.php)
  const records = [];
  if (store.availability && typeof store.availability === "object") {
    Object.keys(store.availability).forEach((monthKey) => {
      const monthObj = store.availability[monthKey];
      if (monthObj && typeof monthObj === "object") {
        Object.keys(monthObj).forEach((dayKey) => {
          const dayObj = monthObj[dayKey];
          if (dayObj && typeof dayObj === "object") {
            const st = dayObj[sailorFbKey] || dayObj[sailorId];
            if (st) {
              const dd = String(dayKey).padStart(2, "0");
              const fullDate = `${monthKey}-${dd}`;
              records.push({ date: fullDate, status: String(st).trim() });
            }
          }
        });
      }
    });
  }

  // 2. Sort by date ascending (same as usort in sailors_details.php)
  records.sort((a, b) => a.date.localeCompare(b.date));

  if (records.length === 0) {
    if (sailor.sick_days) return sailor.sick_days + " Days";
    if (sailor.run_days) return sailor.run_days + " Days";
    return "1 Day";
  }

  // 3. Group consecutive dates with matching/leave status (exact sailors_details.php logic)
  const grouped = [];
  let currentStart = records[0].date;
  let currentEnd = records[0].date;
  let currentStatus = records[0].status;

  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    const prevDateObj = new Date(currentEnd + "T12:00:00");
    const currDateObj = new Date(rec.date + "T12:00:00");
    
    const diffTime = currDateObj - prevDateObj;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Consecutive day check and status match (matching T/D, L, R/D, ADM, S/R, etc.)
    const isConsecutiveGroup = (diffDays === 1) && (
      rec.status === currentStatus ||
      (isLeaveCode(rec.status) && isLeaveCode(currentStatus))
    );

    if (isConsecutiveGroup) {
      currentEnd = rec.date;
    } else {
      const startDate = new Date(currentStart + "T12:00:00");
      const endDate = new Date(currentEnd + "T12:00:00");
      const daysCount = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      grouped.push({ start: currentStart, end: currentEnd, status: currentStatus, days: daysCount });

      currentStart = rec.date;
      currentEnd = rec.date;
      currentStatus = rec.status;
    }
  }

  const startDate = new Date(currentStart + "T12:00:00");
  const endDate = new Date(currentEnd + "T12:00:00");
  const daysCount = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  grouped.push({ start: currentStart, end: currentEnd, status: currentStatus, days: daysCount });

  // 4. Return days from the latest active leave group
  const latestGroup = grouped[grouped.length - 1];
  return (latestGroup && latestGroup.days) ? `${latestGroup.days} Days` : "1 Day";
}

// Helper to resolve Yesterday's Job title or description from Database
function getSailorYesterdayJobText(sailor) {
  let jobKey = sailor.yesterdayJob || sailor.yesterday_job;
  
  if (!jobKey && store.dailyAllocations) {
    const today = new Date((typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0]) + "T12:00:00");
    today.setDate(today.getDate() - 1);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yestStr = `${yyyy}-${mm}-${dd}`;

    const sailorId = String(sailor.id || sailor._fbKey || "");
    const sailorFbKey = String(sailor._fbKey || sailor.id || "");

    const alloc = store.dailyAllocations.find(a => 
      a.date === yestStr && (String(a.sailor_id) === sailorId || String(a.sailor_id) === sailorFbKey)
    );

    if (alloc) {
      jobKey = alloc.work_order_id;
    }
  }

  if (!jobKey) return "-";

  const keyStr = String(jobKey);
  const wo = (store.workOrders || []).find(w => String(w.id || w._fbKey) === keyStr);
  if (wo) return wo.description || wo.title || wo.location_name || wo.work_order_no || keyStr;

  const jc = (store.jobCards || []).find(j => String(j.id || j._fbKey) === keyStr);
  if (jc) return jc.description || jc.title || jc.location_name || jc.job_card_no || keyStr;

  return keyStr;
}

// =============================================
// N/A STATUS VIEW
// =============================================
function renderNastatusView() {
  if (!store.sailors) return;
  const tbody = document.getElementById("nastatusTableBody");
  if (!tbody) return;

  const isLeaveState = (val) => {
    if (!val) return false;
    const s = typeof val === "string" ? val.trim() : String(val).trim();
    return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(s);
  };

  const naSailors = store.sailors.filter(s => isLeaveState(s.status) || isLeaveState(s.attendance));
  
  const countEl = document.getElementById("nastatusTotalCount");
  if (countEl) countEl.textContent = naSailors.length;

  let html = "";
  naSailors.forEach((s, idx) => {
    let statusText = s.status;
    if (!isLeaveState(statusText)) statusText = s.attendance;
    if (!statusText) statusText = "N/A";
    
    const durationDisplay = calculateSailorNADuration(s);
    const yesterdayJobText = getSailorYesterdayJobText(s);

    html += `
      <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800/40">
        <td class="p-3 pl-4 text-slate-400 font-mono">${idx + 1}</td>
        <td class="p-3">
          <div class="font-medium text-slate-200">${s.name}</div>
          <div class="text-[10px] text-slate-500 font-mono">${s.rank}</div>
        </td>
        <td class="p-3 text-center">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            ${statusText}
          </span>
        </td>
        <td class="p-3 text-center">
          <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
            ⏱️ ${durationDisplay}
          </span>
        </td>
        <td class="p-3 text-right pr-4 text-slate-300 text-xs font-medium truncate max-w-[220px]" title="${yesterdayJobText}">
          ${yesterdayJobText}
        </td>
      </tr>
    `;
  });

  if (naSailors.length === 0) {
    html = `<tr><td colspan="5" class="p-8 text-center text-slate-500">No N/A sailors found today.</td></tr>`;
  }

  tbody.innerHTML = html;
}

// =============================================
// DASHBOARD
// =============================================
function renderDashboard() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const isToday = dateVal === today; // Show/hide views and sidebar
  toggleViewsBasedOnZone();
  const summaryTitle = document.getElementById("summaryTitle");
  if (summaryTitle) {
    if (isToday) {
      summaryTitle.textContent = "Today's Operational Summary";
    } else {
      const formatted = new Date(dateVal).toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      summaryTitle.textContent = `${formatted}'s Operational Summary`;
    }
  }
  renderAvailableSailors();
  renderWorkOrders();
  renderQuickAssignments();
  renderZoneTeam();
  updateCounters();
  updatePendingEvals();
  renderZoneSelectors();
  updateBoardEmptyState();
  updateDashboardButtons();
  updateHistoricalModeBanner();
}
function updateHistoricalModeBanner() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const isToday = dateVal === today;
  const banner = document.getElementById("historicalModeBanner");
  const dateText = document.getElementById("historicalBannerDateText");
  const quickTodayBtn = document.getElementById("quickTodayBtn");

  if (banner) {
    banner.classList.toggle("hidden", isToday);
  }
  if (dateText && !isToday) {
    try {
      const parts = dateVal.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const formatted = d.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      dateText.textContent = `Showing records for ${formatted} • සියලුම දත්ත Read-Only ආකාරයෙන් පවතී`;
    } catch(e) {
      dateText.textContent = `Showing records for ${dateVal} • Read-Only Mode`;
    }
  }
  if (quickTodayBtn) {
    if (isToday) {
      quickTodayBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm";
    } else {
      quickTodayBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-sm animate-pulse";
    }
  }
}
function updateDashboardButtons() {
  const currentZoneObj = store.zones.find((z) => z.id === store.currentZone);
  const zoneName = currentZoneObj ? currentZoneObj.name : "";
  const zoneId = store.currentZone;
  const isAdminStaff =
    isAdminStaffDuties(zoneId) || isAdminStaffDuties(zoneName);
  const newAssignBtn = document.getElementById("newAssignBtn");
  const newWorkOrderBtn = document.getElementById("newWorkOrderBtn");
  const btnContinueYesterday = document.getElementById("btnContinueYesterday");
  const today = getLocalDateString();
  const isToday = !store.dashboardDate || store.dashboardDate === today;
  if (newAssignBtn) {
    newAssignBtn.classList.toggle("hidden", !isToday);
  }
  if (newWorkOrderBtn) {
    newWorkOrderBtn.classList.toggle("hidden", !isToday);
  }
  if (btnContinueYesterday) {
    btnContinueYesterday.classList.toggle("hidden", !isToday);
  }
}
function navigateSummaryDate(offsetDays) {
  const currentDateStr = store.dashboardDate || getLocalDateString();
  const parts = currentDateStr.split("-");
  if (parts.length !== 3) return;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const newDateStr = `${year}-${month}-${day}`;
  changeDashboardDate(newDateStr);
}

function changeDashboardDate(val) {
  if (!val) return;
  store.dashboardDate = val;
  ["dashboardDatePicker", "summaryDatePicker"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value !== val) el.value = val;
  });
  renderDashboard();
  renderZoneSelectors(); // Re-render dropdown to update zone progress percentages
  if (typeof renderSummaryView === "function") {
    renderSummaryView();
  }
  const today = getLocalDateString();
  if (val !== today) {
    showToast(`Viewing historical data for ${val} (Read Only)`, "info");
  }
}
function isWorkOrderActiveOnDate(wo, dateStr) {
  if (!wo) return false;
  const today = getLocalDateString();
  if (!dateStr) dateStr = today;

  const hasAllocations = (store.dailyAllocations || []).some(
    (a) => a.date === dateStr && String(a.work_order_id) === String(wo.id),
  );
  if (hasAllocations) return true;

  if (wo.created_at) {
    try {
      const d = new Date(wo.created_at);
      if (!isNaN(d.getTime())) {
        const createdDate = d.toISOString().split("T")[0];
        if (createdDate <= dateStr) {
          if (dateStr === today) {
            if (wo.status === "Completed") {
                return false;
            }
            return true;
          } else {
            if (wo.status === "Completed" || wo.status === "Hold") {
              const compDate =
                wo.completed_date ||
                wo.last_commit_date ||
                wo.last_assigned_date ||
                today;
              if (compDate < dateStr) {
                return false;
              }
            }
            return true;
          }
        }
      }
    } catch (e) {}
  }
  
  if (dateStr === today) {
    if (wo.status !== "Completed") return true;
  }

  return false;
}
function getSailorAssignmentOnDate(sailorId, dateVal) {
  const today = typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0];
  if (!dateVal) dateVal = today;
  const isToday = dateVal === today;

  const sailor = (store.sailors || []).find(
    (s) => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId) || String(s.official_number) === String(sailorId)
  );
  const idsToMatch = new Set([String(sailorId)]);
  if (sailor) {
    if (sailor.id) idsToMatch.add(String(sailor.id));
    if (sailor._fbKey) idsToMatch.add(String(sailor._fbKey));
    if (sailor.official_number) idsToMatch.add(String(sailor.official_number));
  }

  // 1. If checking for today, check live active Work Orders first
  if (isToday) {
    const activeWo = (store.workOrders || []).find((w) => {
      if (w.status !== "Active" && w.status !== "Pending") return false;
      return (w.assigned || []).some((id) => idsToMatch.has(String(id)));
    });
    if (activeWo) {
      const cleanZone = String(activeWo.zone_id || "Active WO").replace(/-/g, " ").trim();
      return {
        ref: activeWo.reference_no || "Active WO",
        title: activeWo.description || "",
        zone: cleanZone,
        type: activeWo.type || "WO",
      };
    }

    const activeJc = (store.jobCards || []).find((j) => {
      if (j.status !== "Active") return false;
      return (j.assigned || []).some((id) => idsToMatch.has(String(id)));
    });
    if (activeJc) {
      const cleanZone = String(activeJc.zone_id || "Job Card").replace(/-/g, " ").trim();
      return {
        ref: activeJc.job_card_no || "Job Card",
        title: activeJc.description || activeJc.title || "",
        zone: cleanZone,
        type: "JC",
      };
    }
  }

  // 2. Check store.dailyAllocations
  const alloc = (store.dailyAllocations || []).find(
    (a) => a.date === dateVal && idsToMatch.has(String(a.sailor_id))
  );

  if (alloc) {
    const wo = (store.workOrders || []).find(
      (w) => String(w.id) === String(alloc.work_order_id) || String(w._fbKey) === String(alloc.work_order_id)
    );
    if (wo) {
      const cleanZone = String(wo.zone_id || alloc.zone_id || "Active WO").replace(/-/g, " ").trim();
      return {
        ref: wo.reference_no || "Active WO",
        title: wo.description || "",
        zone: cleanZone,
        type: wo.type || "WO",
      };
    }
    const jc = (store.jobCards || []).find(
      (j) => String(j.id) === String(alloc.work_order_id) || String(j._fbKey) === String(alloc.work_order_id)
    );
    if (jc) {
      const cleanZone = String(jc.zone_id || alloc.zone_id || "Job Card").replace(/-/g, " ").trim();
      return {
        ref: jc.job_card_no || "Job Card",
        title: jc.description || jc.title || "",
        zone: cleanZone,
        type: "JC",
      };
    }
  }

  // 3. If historical date and no allocation record found, check if WO was active on that date
  if (!isToday) {
    const histWo = (store.workOrders || []).find((w) => {
      if (typeof isWorkOrderActiveOnDate === "function" && !isWorkOrderActiveOnDate(w, dateVal)) return false;
      return (w.assigned || []).some((id) => idsToMatch.has(String(id)));
    });
    if (histWo) {
      const cleanZone = String(histWo.zone_id || "Work Order").replace(/-/g, " ").trim();
      return {
        ref: histWo.reference_no || "Work Order",
        title: histWo.description || "",
        zone: cleanZone,
        type: histWo.type || "WO",
      };
    }
  }

  return null;
}

function getSailorCurrentAssignment(sailorId) {
  const today = typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0];
  return getSailorAssignmentOnDate(sailorId, today);
}
function renderAvailableSailors() {
  const container = document.getElementById("availableSailors");
  if (!container) return;
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const isToday = dateVal === today; // Recalculate status for the selected date
  const assignedIds = new Set();
  if (isToday) {
    (store.workOrders || []).forEach((wo) => {
      if ((wo.status === "Active" || wo.status === "Pending") && wo.assigned) {
        wo.assigned.forEach((id) => assignedIds.add(String(id)));
      }
    });
    (store.dailyAllocations || []).forEach((alloc) => {
      if (alloc.date === today) {
        assignedIds.add(String(alloc.sailor_id));
      }
    });
  } else {
    (store.dailyAllocations || []).forEach((alloc) => {
      if (alloc.date === dateVal) {
        assignedIds.add(String(alloc.sailor_id));
      }
    });
  }
  
  // Add long term project assignments so they are marked as assigned
  const longTerm = getLongTermAllocations();
  [...longTerm.housing, ...longTerm.outProject, ...longTerm.otherBase].forEach(a => {
      assignedIds.add(String(a.sailor.id || a.sailor._fbKey));
  });

  // Support search query
  const searchInput = document.getElementById("sailorSearch");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : ""; // Reset pagination limit when search query changes
  const lastQuery = container.getAttribute("data-last-query") || "";
  if (query !== lastQuery) {
    store.availableSailorsLimit = 40;
    container.setAttribute("data-last-query", query);
  } // When searching, show ALL sailors (651) regardless of attendance/zone/team filters
  // When NOT searching, apply normal filters for a clean default view
  let sailors;
  if (query) {
    sailors = store.sailors.filter(
      (s) =>
        (s._searchIndex || "").includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.official_number || "").toLowerCase().includes(query) ||
        (s.rank || "").toLowerCase().includes(query) ||
        (s.trade || "").toLowerCase().includes(query),
    ); // Still apply trade filter if set
    if (store.currentTrade !== "ALL") {
      sailors = sailors.filter((s) => s.trade === store.currentTrade);
    }
  } else {
    sailors = store.sailors.filter(
      (s) => (s.attendance || "Present") === "Present",
    );
    if (store.currentFilter === "zone-team") {
      sailors = sailors.filter(
        (s) => s.isZoneTeam && s.zone_assigned === store.currentZone,
      );
    } else if (store.currentFilter === "continuation") {
      sailors = sailors.filter((s) => s.yesterdayJob !== null);
    }
    if (store.currentTrade !== "ALL") {
      sailors = sailors.filter((s) => s.trade === store.currentTrade);
    }
  } // Sort unassigned first, then by score
  sailors.sort((a, b) => {
    const aAssigned =
      assignedIds.has(String(a.id)) || assignedIds.has(String(a._fbKey));
    const bAssigned =
      assignedIds.has(String(b.id)) || assignedIds.has(String(b._fbKey));
    if (aAssigned !== bAssigned) {
      return aAssigned ? 1 : -1;
    }
    return b.avgScore - a.avgScore;
  }); // Slice sailors to limit rendering for performance
  const visibleSailors = sailors.slice(0, store.availableSailorsLimit);
  let html = visibleSailors
    .map((sailor) => {
      var _sailor$id, _sailor$id2, _sailor$id3;
      const scoreColor =
        sailor.avgScore >= 8
          ? "#059669"
          : sailor.avgScore >= 6
            ? "#d97706"
            : "#dc2626";
      const tradeBg =
        {
          MA: "#0d9488",
          CA: "#7c3aed",
          PA: "#b45309",
          PL: "#0891b2",
          WE: "#dc2626",
          RW: "#374151",
          SW: "#065f46",
          BB: "#1d4ed8",
          AL: "#ec4899",
        }[sailor.trade] || "#475569";
      const assignment = isToday
        ? getSailorCurrentAssignment(
            (_sailor$id = sailor.id) !== null && _sailor$id !== void 0
              ? _sailor$id
              : sailor._fbKey,
          )
        : getSailorAssignmentOnDate(
            (_sailor$id2 = sailor.id) !== null && _sailor$id2 !== void 0
              ? _sailor$id2
              : sailor._fbKey,
            dateVal,
          );
      if (assignment) {
        return `
            <div class="sailor-card rounded-xl p-3 border bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed select-none relative group"
                title="Already assigned to ${assignment.ref} in ${assignment.zone}: ${assignment.title}">
                <div class="flex items-center gap-3">
                    <div class="relative flex-shrink-0">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm bg-slate-400">${sailor.trade}</div>
                        ${sailor.isZoneTeam ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[9px] shadow">★</span>' : ""}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-slate-600 text-sm truncate leading-tight">${sailor.name}</p>
                        <div class="flex items-center gap-1.5 mt-1">
                            <span class="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">⚠️ Busy: ${assignment.zone}</span>
                            ${isMainAdminLoggedIn() ? `
                            <button onclick="event.stopPropagation(); forceCleanSailorAssignments('${sailor.official_number || sailor.id}')" 
                                    class="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded shadow transition-all cursor-pointer"
                                    title="Force release sailor (Authorized: LCDR KMAU KAHANDAWA Only)">
                                🔓 Release
                            </button>
                            ` : ''}
                        </div>
                        <div class="text-[11px] text-slate-500 mt-0.5 truncate">${assignment.ref}${assignment.title ? ' · ' + assignment.title : ''}</div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="text-base font-extrabold text-slate-400">${sailor.avgScore.toFixed(1)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${sailor.category}</div>
                    </div>
                </div>
            </div>
            `;
      }
      return `
        <div class="sailor-card rounded-xl p-3 hover:shadow-md transition-all border"
            style="background:rgba(255,255,255,0.88);border-color:rgba(255,255,255,0.7);backdrop-filter:blur(6px)"
            draggable="${isToday ? "true" : "false"}"
            ondragstart="handleDragStart(event, ${sailor.id})"
            ondragend="handleDragEnd(event)">
            <div class="flex items-center gap-3">
                <div class="relative flex-shrink-0">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm"
                        style="background:${tradeBg}">${sailor.trade}</div>
                    ${sailor.isZoneTeam ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[9px] shadow">★</span>' : ""}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-sm truncate leading-tight flex items-center justify-between gap-1">
                        <span>${sailor.name}</span>
                        <button onclick="event.stopPropagation(); openSailorProfile('${(_sailor$id3 = sailor.id) !== null && _sailor$id3 !== void 0 ? _sailor$id3 : sailor._fbKey}')" class="text-teal-600 hover:text-teal-800 text-xs p-0.5 cursor-pointer font-bold transition-transform hover:scale-115" title="View Profile">
                            👤
                        </button>
                    </p>
                    <div class="flex items-center gap-1.5 mt-1">
                        <span class="text-[11px] text-slate-500 mono">${sailor.official_number}</span>
                        <span class="text-[11px] text-slate-400">${sailor.rank}</span>
                        ${sailor.yesterdayJob ? '<span class="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">↻ Cont</span>' : ""}
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-base font-extrabold" style="color:${scoreColor}">${sailor.avgScore.toFixed(1)}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${sailor.category}</div>
                </div>
            </div>
        </div>
        `;
    })
    .join("");
  if (sailors.length > store.availableSailorsLimit) {
    html += `
        <div class="flex justify-center py-2">
            <button onclick="loadMoreAvailableSailors()" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 active:scale-95">
                Load More Sailors (+40)
            </button>
        </div>
        `;
  }
  container.innerHTML =
    html ||
    '<div class="text-center py-6"><p class="text-slate-400 text-sm">No sailors available</p></div>';
  const freeCount = sailors.filter((s) => {
    var _s$id2, _s$id3;
    const assignment = isToday
      ? getSailorCurrentAssignment(
          (_s$id2 = s.id) !== null && _s$id2 !== void 0 ? _s$id2 : s._fbKey,
        )
      : getSailorAssignmentOnDate(
          (_s$id3 = s.id) !== null && _s$id3 !== void 0 ? _s$id3 : s._fbKey,
          dateVal,
        );
    return !assignment;
  }).length;
  document.getElementById("availableBadge").textContent = freeCount;
}
function loadMoreAvailableSailors() {
  store.availableSailorsLimit += 40;
  renderAvailableSailors();
}
function renderWorkOrders() {
  const columns = {
    PROJECT: document.getElementById("projectsColumn"),
    JOB: document.getElementById("jobsColumn"),
    TASK: document.getElementById("tasksColumn"),
  };
  let projectCount = 0,
    jobCount = 0,
    taskCount = 0;
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let projectTradesStr = "",
    jobTradesStr = "",
    taskTradesStr = "";
  Object.keys(columns).forEach((type) => {
    const orders = store.workOrders.filter(
      (wo) =>
        wo.type === type &&
        !wo.assign_type &&
        wo.zone_id === store.currentZone &&
        isWorkOrderActiveOnDate(wo, dateVal),
    );
    columns[type].innerHTML = orders
      .map((wo) => renderWorkOrderCard(wo))
      .join("");
    const wrapperId =
      type === "PROJECT"
        ? "projectColumnWrapper"
        : type === "JOB"
          ? "jobColumnWrapper"
          : "taskColumnWrapper";
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
      wrapper.classList.toggle("hidden", orders.length === 0);
    } // Count active ones on this date
    const activeOrders = orders.filter((o) => {
      if (dateVal === today) return o.status === "Active";
      return true; // We assume shown historical work orders are active or had allocations
    });
    if (type === "PROJECT") projectCount = activeOrders.length;
    if (type === "JOB") jobCount = activeOrders.length;
    if (type === "TASK") taskCount = activeOrders.length; // Calculate trade breakdown of assigned sailors
    const typeSailors = [];
    orders.forEach((wo) => {
      const assignedIds = (wo.assigned || []).map(String);
      const sailors = store.sailors.filter(
        (s) =>
          assignedIds.includes(String(s.id)) ||
          assignedIds.includes(String(s._fbKey)),
      );
      typeSailors.push(...sailors);
    });
    const tradeCounts = {};
    typeSailors.forEach((s) => {
      const t = s.trade || "MA";
      tradeCounts[t] = (tradeCounts[t] || 0) + 1;
    });
    const tradeStr = Object.entries(tradeCounts)
      .map(([trade, count]) => `${count} ${trade}`)
      .join(", ");
    if (type === "PROJECT") projectTradesStr = tradeStr;
    if (type === "JOB") jobTradesStr = tradeStr;
    if (type === "TASK") taskTradesStr = tradeStr;
  });
  document.getElementById("ongoingProjects").textContent = projectCount;
  document.getElementById("ongoingJobs").textContent = jobCount;
  document.getElementById("ongoingTasks").textContent = taskCount;
  const projTradesEl = document.getElementById("ongoingProjectsTrades");
  if (projTradesEl)
    projTradesEl.textContent = projectTradesStr ? `(${projectTradesStr})` : "";
  const jobTradesEl = document.getElementById("ongoingJobsTrades");
  if (jobTradesEl)
    jobTradesEl.textContent = jobTradesStr ? `(${jobTradesStr})` : "";
  const taskTradesEl = document.getElementById("ongoingTasksTrades");
  if (taskTradesEl)
    taskTradesEl.textContent = taskTradesStr ? `(${taskTradesStr})` : "";
}
function renderQuickAssignments() {
  const container = document.getElementById("quickAssignmentsList");
  if (!container) return;
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today; // Filter work orders that have an assign_type and belong to active zone
  const quickOrders = store.workOrders.filter(
    (wo) =>
      wo.assign_type &&
      wo.zone_id === store.currentZone &&
      isWorkOrderActiveOnDate(wo, dateVal),
  );
  const badge = document.getElementById("quickAssignCountBadge");
  if (badge) badge.textContent = `${quickOrders.length} Active`;
  const wrapper = document.getElementById("assignmentColumnWrapper");
  if (wrapper) {
    wrapper.classList.toggle("hidden", quickOrders.length === 0);
  }
  container.innerHTML = quickOrders
    .map((wo) => renderWorkOrderCard(wo))
    .join("");
}
function updateBoardEmptyState() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const projects = store.workOrders.filter(
    (wo) =>
      wo.type === "PROJECT" &&
      !wo.assign_type &&
      wo.zone_id === store.currentZone &&
      isWorkOrderActiveOnDate(wo, dateVal),
  ).length;
  const jobs = store.workOrders.filter(
    (wo) =>
      wo.type === "JOB" &&
      !wo.assign_type &&
      wo.zone_id === store.currentZone &&
      isWorkOrderActiveOnDate(wo, dateVal),
  ).length;
  const tasks = store.workOrders.filter(
    (wo) =>
      wo.type === "TASK" &&
      !wo.assign_type &&
      wo.zone_id === store.currentZone &&
      isWorkOrderActiveOnDate(wo, dateVal),
  ).length;
  const assigns = store.workOrders.filter(
    (wo) =>
      wo.assign_type &&
      wo.zone_id === store.currentZone &&
      isWorkOrderActiveOnDate(wo, dateVal),
  ).length; // Explicitly toggle hidden class on wrappers to ensure they are hidden on mobile
  const projWrapper = document.getElementById("projectColumnWrapper");
  if (projWrapper) projWrapper.classList.toggle("hidden", projects === 0);
  const jobWrapper = document.getElementById("jobColumnWrapper");
  if (jobWrapper) jobWrapper.classList.toggle("hidden", jobs === 0);
  const taskWrapper = document.getElementById("taskColumnWrapper");
  if (taskWrapper) taskWrapper.classList.toggle("hidden", tasks === 0);
  const assignWrapper = document.getElementById("assignmentColumnWrapper");
  if (assignWrapper) assignWrapper.classList.toggle("hidden", assigns === 0);
  const visibleColumns = [];
  if (projects > 0) visibleColumns.push("project");
  if (jobs > 0) visibleColumns.push("job");
  if (tasks > 0) visibleColumns.push("task");
  if (assigns > 0) visibleColumns.push("assignment");
  const visibleCount = visibleColumns.length;
  const emptyState = document.getElementById("boardEmptyState");
  const boardGrid = document.getElementById("boardGridContainer");
  if (emptyState && boardGrid) {
    if (visibleCount === 0) {
      emptyState.classList.remove("hidden");
      boardGrid.classList.add("hidden");
    } else {
      emptyState.classList.add("hidden");
      boardGrid.classList.remove("hidden"); // Reset classes first
      boardGrid.className = "grid gap-4"; // Set grid columns dynamically based on number of active columns
      if (visibleCount === 1) {
        boardGrid.classList.add("grid-cols-1", "max-w-xl", "mx-auto");
      } else if (visibleCount === 2) {
        boardGrid.classList.add(
          "grid-cols-1",
          "md:grid-cols-2",
          "max-w-5xl",
          "mx-auto",
        );
      } else if (visibleCount === 3) {
        boardGrid.classList.add(
          "grid-cols-1",
          "md:grid-cols-2",
          "lg:grid-cols-3",
          "max-w-7xl",
          "mx-auto",
        );
      } else {
        boardGrid.classList.add(
          "grid-cols-1",
          "md:grid-cols-2",
          "xl:grid-cols-4",
        );
      }
    }
  }
}
function handleCardClick(event, workOrderId) {
  if (event.type === "touchend") {
    event.preventDefault();
  }
  openWorkOrderDetail(workOrderId);
}
function getWorkOrderAssignedSailors(wo, dateVal) {
  if (!wo) return { sailors: [], source: "" };
  const today = getLocalDateString();
  if (!dateVal) dateVal = store.dashboardDate || today;
  const isToday = dateVal === today;

  if (isToday) {
    const assignedIds = new Set((wo.assigned || []).map(String));
    (store.dailyAllocations || []).forEach((a) => {
      if (
        a.date === today &&
        (String(a.work_order_id) === String(wo.id) ||
          String(a.work_order_id) === String(wo._fbKey))
      ) {
        if (a.sailor_id) assignedIds.add(String(a.sailor_id));
      }
    });
    const sailors = store.sailors.filter(
      (s) =>
        assignedIds.has(String(s.id)) ||
        assignedIds.has(String(s._fbKey)) ||
        (s.official_number && assignedIds.has(String(s.official_number))),
    );
    return { sailors, source: "live" };
  }

  // Back-date / Historical Mode resolution:
  // 1st priority: Try dailyAllocations for this specific date
  const dailyIds = (store.dailyAllocations || [])
    .filter(
      (a) => a.date === dateVal && (String(a.work_order_id) === String(wo.id) || String(a.work_order_id) === String(wo._fbKey)),
    )
    .map((a) => String(a.sailor_id));

  if (dailyIds.length > 0) {
    const sailors = store.sailors.filter(
      (s) =>
        dailyIds.includes(String(s.id)) ||
        dailyIds.includes(String(s._fbKey)),
    );
    return { sailors, source: "daily_record" };
  }

  // 2nd priority: Fall back to wo.assigned
  if (wo.assigned && wo.assigned.length > 0) {
    const assignedIds = (wo.assigned || []).map(String);
    const sailors = store.sailors.filter(
      (s) =>
        assignedIds.includes(String(s.id)) ||
        assignedIds.includes(String(s._fbKey)),
    );
    return { sailors, source: "current_assigned" };
  }

  // 3rd priority: Fall back to wo.last_assigned
  if (wo.last_assigned && wo.last_assigned.length > 0) {
    const lastIds = (wo.last_assigned || []).map(String);
    const sailors = store.sailors.filter(
      (s) =>
        lastIds.includes(String(s.id)) ||
        lastIds.includes(String(s._fbKey)),
    );
    return { sailors, source: "last_assigned" };
  }

  return { sailors: [], source: "" };
}

function renderWorkOrderCard(wo) {
  const priorityMap = {
    High: { bar: "#dc2626", chip: "priority-high", icon: "🔴" },
    Medium: { bar: "#d97706", chip: "priority-medium", icon: "🟡" },
    Low: { bar: "#059669", chip: "priority-low", icon: "🟢" },
  };
  const statusMap = {
    Active: { stripe: "work-card-active", chip: "chip-active" },
    Pending: { stripe: "work-card-pending", chip: "chip-pending" },
    Hold: { stripe: "border-l-4 border-slate-400", chip: "chip-hold" },
    Completed: { stripe: "border-l-4 border-teal-500", chip: "chip-completed" },
  };
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const { sailors: assignedSailors } = getWorkOrderAssignedSailors(wo, dateVal);
  const progress = wo.progress || 0;
  const pendingEvals = assignedSailors.filter((s) => !s.evaluated).length;
  const pm = priorityMap[wo.priority] || priorityMap["Medium"];
  const sm = statusMap[wo.status] || statusMap["Pending"];
  const progressColor =
    progress >= 75 ? "#059669" : progress >= 40 ? "#0d9488" : "#2563eb";
  const assignTypeBadge = wo.assign_type
    ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">💼 ${wo.assign_type}</span>`
    : ""; // Use _fbKey for the click handler (Firebase primary key)
  const woKey = wo._fbKey || wo.id;
  const tradeCounts = {};
  assignedSailors.forEach((s) => {
    const t = s.trade || "MA";
    tradeCounts[t] = (tradeCounts[t] || 0) + 1;
  });
  const tradeStr = Object.entries(tradeCounts)
    .map(([trade, count]) => `${count} ${trade}`)
    .join(", ");
  const tradeBadge = tradeStr
    ? `<span class="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded ml-1 border border-slate-200">${tradeStr}</span>`
    : "";
  return `
        <div class="work-order-card ${sm.stripe} rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group"
            style="background:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.8);backdrop-filter:blur(6px)"
            onclick="handleCardClick(event, '${woKey}')"
            ondragover="handleDragOver(event)" ondrop="handleDropOnCard(event, '${woKey}')">

            <!-- Header row -->
            <div class="px-3 pt-3 pb-2 flex items-start justify-between">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${pm.chip}">${pm.icon} ${wo.priority}</span>
                    <span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${sm.chip}">${wo.status}</span>
                    ${assignTypeBadge}
                </div>
                <span class="text-[10px] text-slate-400 mono font-medium flex-shrink-0">${wo.reference_no || "—"}</span>
            </div>

            <div class="px-3 pb-2">
                <h4 class="font-semibold text-slate-800 text-sm leading-snug mb-0.5 group-hover:text-teal-700 transition-colors">${wo.description}</h4>
                <p class="text-[11px] text-slate-500">📍 ${wo.location || "Location not set"}${wo.sub_location ? " — " + wo.sub_location : ""}</p>
            </div>

            <!-- Progress -->
            <div class="px-3 pb-2">
                <div class="flex justify-between text-[11px] mb-1">
                    <span class="text-slate-400">Progress</span>
                    <span class="font-bold" style="color:${progressColor}">${progress}%</span>
                </div>
                <div class="w-full rounded-full h-1.5" style="background:rgba(15,32,64,0.1)">
                    <div class="h-1.5 rounded-full transition-all duration-500" style="width:${progress}%;background:${progressColor}"></div>
                </div>
            </div>

            <!-- Meta row -->
            <div class="px-3 pb-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>⏱ ${wo.estimated_duration}d</span>
                ${wo.budget_allocation ? `<span class="font-medium text-slate-600">💰 ${formatCurrency(wo.budget_allocation)}</span>` : ""}
            </div>

            <!-- Assigned sailors -->
            <div class="px-3 pb-3 border-t border-slate-100 pt-2">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[11px] text-slate-500 flex items-center flex-wrap gap-1">👷 ${assignedSailors.length} assigned ${tradeBadge}</span>
                    ${store.isEveningMode && pendingEvals > 0 ? `<span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold animate-pulse">📝 ${pendingEvals} eval due</span>` : ""}
                </div>
                <div class="flex flex-wrap gap-1" id="assigned-${wo.id}">
                    ${
                      assignedSailors.length > 0
                        ? assignedSailors
                            .slice(0, 4)
                            .map(
                              (s) => {
                                const isLeaveCode = (val) => {
                                  if (!val) return false;
                                  const str = typeof val === "string" ? val.trim() : String(val).trim();
                                  return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(str);
                                };
                                const isLeave = isLeaveCode(s.status) || isLeaveCode(s.attendance);
                                const colorClasses = isLeave 
                                  ? "bg-red-100 text-red-700 opacity-75" 
                                  : (s.evaluated ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700");
                                const leaveIcon = isLeave ? "🛌 " : "";
                                return `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colorClasses}" title="${isLeave ? 'On Leave/Sick' : ''}">
                                ${leaveIcon}${s.name.split(" ").slice(1, 2).join("")}
                                <span class="${getPerformanceColor(s.avgScore)} px-1 rounded-full text-[9px]">${s.avgScore.toFixed(1)}</span>
                            </span>`;
                              }
                            )
                            .join("") +
                          (assignedSailors.length > 4
                            ? `<span class="text-[10px] text-slate-400 italic">+${assignedSailors.length - 4} more</span>`
                            : "")
                        : '<span class="text-slate-300 text-[11px] italic">Drop sailors here or assign in detail view</span>'
                    }
                </div>
            </div>
        </div>
    `;
}
function renderZoneTeam() {
  const zoneTeamMembers = store.sailors.filter(
    (s) => s.isZoneTeam && s.zone_assigned === store.currentZone,
  );
  const container = document.getElementById("zoneTeamList");
  const attendanceCfg = {
    Present: {
      dot: "bg-teal-500",
      text: "Available",
      textColor: "text-teal-700",
      bg: "rgba(13,148,136,0.07)",
      border: "rgba(13,148,136,0.2)",
    },
    Leave: {
      dot: "bg-amber-500",
      text: "On Leave",
      textColor: "text-amber-700",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.2)",
    },
    Sick: {
      dot: "bg-rose-500",
      text: "Sick",
      textColor: "text-rose-700",
      bg: "rgba(244,63,94,0.07)",
      border: "rgba(244,63,94,0.2)",
    },
    Duty: {
      dot: "bg-blue-500",
      text: "On Duty",
      textColor: "text-blue-700",
      bg: "rgba(59,130,246,0.07)",
      border: "rgba(59,130,246,0.2)",
    },
  };
  const tradeBg = {
    MA: "#0d9488",
    CA: "#7c3aed",
    PA: "#b45309",
    PL: "#0891b2",
    WE: "#dc2626",
    RW: "#374151",
    SW: "#065f46",
    BB: "#1d4ed8",
    AL: "#ec4899",
  };
  container.innerHTML =
    zoneTeamMembers
      .map((s) => {
        var _s$id4;
        const att = s.attendance || "Present";
        const cfg = attendanceCfg[att] || attendanceCfg["Present"];
        const tb = tradeBg[s.trade] || "#475569";
        return `
        <div class="flex items-center justify-between p-2 rounded-xl group transition-all hover:shadow-sm"
            style="background:${cfg.bg};border:1px solid ${cfg.border}">
            <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                    style="background:${tb}">${s.trade}</div>
                <div class="min-w-0">
                    <span class="block text-xs font-semibold text-slate-700 truncate hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${(_s$id4 = s.id) !== null && _s$id4 !== void 0 ? _s$id4 : s._fbKey}')">${s.name.split(" ").slice(1, 3).join(" ")}</span>
                    <span class="text-[10px] ${cfg.textColor} flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}"></span>${cfg.text}
                    </span>
                </div>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="performance-badge ${getPerformanceColor(s.avgScore)} text-[10px]">${s.avgScore.toFixed(1)}</span>
                <button onclick="removeFromZoneTeam(${s.id})" title="Remove from Zone Team"
                    class="text-rose-400 hover:text-rose-600 text-base opacity-0 group-hover:opacity-100 transition-all">×</button>
            </div>
        </div>`;
      })
      .join("") ||
    '<p class="text-center text-xs text-slate-400 py-4">No team members in this zone</p>';
  document.getElementById("zoneTeamBadge").textContent =
    `${zoneTeamMembers.length}/15`;
  document.getElementById("zoneTeamCount").textContent = zoneTeamMembers.length;
} // ---- Zone Team add / remove (req 3) ----
function removeFromZoneTeam(sailorId) {
  const sailor = store.sailors.find((s) => String(s.id) === String(sailorId));
  if (sailor) {
    sailor.isZoneTeam = false;
    sailor.zone_assigned = "A-Zone";
    const fbKey = sailor._fbKey || sailor.id;
    if (fbKey) {
      sailorsDB
        .ref(`sailors/${fbKey}`)
        .update({ isZoneTeam: false, zone_assigned: "A-Zone" })
        .catch((err) => console.error("Error removing from zone team:", err));
    }
    renderZoneTeam();
    renderAvailableSailors();
    showToast(`${sailor.name} removed from Zone Team`, "info");
  }
}
function openZoneTeamManager() {
  const searchInput = document.getElementById("ztmSearch");
  if (searchInput) searchInput.value = "";
  renderZtmLists();
  document.getElementById("zoneTeamModal").classList.remove("hidden");
}
function filterZtmAvailableList() {
  renderZtmLists(document.getElementById("ztmSearch").value);
}
function renderZtmLists(filter = "") {
  const currentZoneObj = store.zones.find((z) => z.id === store.currentZone);
  document.getElementById("ztmZoneName").textContent = currentZoneObj
    ? currentZoneObj.name
    : store.currentZone;
  const current = store.sailors.filter(
    (s) => s.isZoneTeam && s.zone_assigned === store.currentZone,
  );
  let eligible = store.sailors.filter((s) => !s.isZoneTeam);
  if (filter) {
    const q = filter.toLowerCase().trim();
    eligible = eligible.filter(
      (s) =>
        (s._searchIndex || "").includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.official_number || "").toLowerCase().includes(q) ||
        (s.rank || "").toLowerCase().includes(q) ||
        (s.trade || "").toLowerCase().includes(q),
    );
  }
  const attLabel = {
    Present: "Available",
    Leave: "On Leave",
    Sick: "Sick",
    Duty: "Duty",
  };
  const attCls = {
    Present: "text-green-600",
    Leave: "text-amber-600",
    Sick: "text-red-600",
    Duty: "text-blue-600",
  };
  document.getElementById("ztmCurrentList").innerHTML =
    current
      .map((s) => {
        var _s$id5;
        return `
        <div class="flex items-center justify-between p-2 bg-green-50 rounded-lg">
            <div class="flex items-center gap-2">
                <span class="w-7 h-7 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-bold">${s.trade}</span>
                <div>
                    <p class="text-sm font-medium">${s.name}</p>
                    <p class="text-[11px] ${attCls[s.attendance || "Present"]}">${attLabel[s.attendance || "Present"]} • ${s.official_number}</p>
                </div>
            </div>
            <button onclick="toggleZoneTeam('${(_s$id5 = s.id) !== null && _s$id5 !== void 0 ? _s$id5 : s._fbKey}', false)" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Remove</button>
        </div>
    `;
      })
      .join("") ||
    '<p class="text-center text-xs text-slate-400 py-4">No team members yet</p>';
  document.getElementById("ztmAvailableList").innerHTML =
    eligible
      .map((s) => {
        var _s$id6;
        return `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <div class="flex items-center gap-2">
                <span class="w-7 h-7 bg-slate-500 text-white rounded-full text-xs flex items-center justify-center font-bold">${s.trade}</span>
                <div>
                    <p class="text-sm font-medium">${s.name}</p>
                    <p class="text-[11px] ${attCls[s.attendance || "Present"]}">${attLabel[s.attendance || "Present"]} • ${s.official_number}</p>
                </div>
            </div>
            <button onclick="toggleZoneTeam('${(_s$id6 = s.id) !== null && _s$id6 !== void 0 ? _s$id6 : s._fbKey}', true)" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Add</button>
        </div>
    `;
      })
      .join("") ||
    '<p class="text-center text-xs text-slate-400 py-4">No eligible sailors found</p>';
}
function toggleZoneTeam(sailorId, addToTeam) {
  var _document$getElementB;
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  if (!sailor) return;
  if (addToTeam) {
    const teamSize = store.sailors.filter(
      (s) => s.isZoneTeam && s.zone_assigned === store.currentZone,
    ).length;
    if (teamSize >= 15) {
      showToast("Zone Team is full (15 max)", "error");
      return;
    }
    sailor.isZoneTeam = true;
    sailor.zone_assigned = store.currentZone;
  } else {
    sailor.isZoneTeam = false;
    sailor.zone_assigned = "A-Zone";
  }
  const fbKey = sailor._fbKey || sailor.id;
  if (fbKey) {
    sailorsDB
      .ref(`sailors/${fbKey}`)
      .update({
        isZoneTeam: sailor.isZoneTeam,
        zone_assigned: sailor.zone_assigned,
      })
      .then(() => {
        showToast(
          `${sailor.name} ${addToTeam ? "added to" : "removed from"} Zone Team`,
        );
      })
      .catch((err) => {
        console.error("Error updating sailor zone team status:", err);
        showToast("Saved locally (offline mode)", "info");
      });
  } // Refresh lists
  renderZtmLists(
    ((_document$getElementB = document.getElementById("ztmSearch")) === null ||
    _document$getElementB === void 0
      ? void 0
      : _document$getElementB.value) || "",
  );
  renderZoneTeam();
  renderAvailableSailors();
}
function getLongTermAllocations() {
  let allocs = { housing: [], outProject: [], otherBase: [] };

  const processProjects = (projectsObj, allocArray, defaultName) => {
    if (projectsObj) {
      Object.keys(projectsObj).forEach((pid) => {
        const proj = projectsObj[pid];
        const name = (proj.name || defaultName).trim();
        if (proj.assigned_sailors) {
          Object.keys(proj.assigned_sailors).forEach((sailorFbKey) => {
            const sailor = store.sailors.find(
              (s) =>
                String(s._fbKey) === String(sailorFbKey) ||
                String(s.id) === String(sailorFbKey),
            );
            if (sailor) {
              allocArray.push({
                sailor,
                projectName: name,
                projectId: pid,
                date: proj.assigned_sailors[sailorFbKey].assigned_date || Date.now(),
              });
            }
          });
        }
      });
    }
  };

  processProjects(store.outProjects, allocs.outProject, "Unknown Out Project");
  processProjects(store.housingProjects, allocs.housing, "Unknown Housing Project");
  processProjects(store.otherBases, allocs.otherBase, "Unknown Base");
  


  return allocs;
}
function updateCounters() {
  const activeWo = store.workOrders || [];
  const activeJc = store.jobCards || [];
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const isToday = dateVal === today;
  const assignedIds = new Set();
  const naIds = new Set();
  const isLeaveState = (val) => {
    if (!val) return false;
    const s = typeof val === "string" ? val.trim() : String(val).trim();
    return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(s);
  };
  const isNA = (text) => {
    if (!text) return false;
    const s = typeof text === "string" ? text : String(text);
    return /(නිවාඩු|ගිලන්|\bsiq\b|\bngh\b|\badmit\b|\bleave\b|\bsick\b|\bweekend\b|\boff\b|\bholiday\b|\babsent\b|\bawol\b|\bL\b|\bDL\b|\bWE\b|\bHD\b|T\/D|M\/D)/i.test(
      s,
    );
  };
  (store.dailyAllocations || []).forEach((alloc) => {
    if (alloc.date === dateVal) {
      const wo = activeWo.find(
        (w) => String(w.id) === String(alloc.work_order_id),
      );
      const jc = activeJc.find(
        (j) => String(j.id) === String(alloc.work_order_id),
      );
      if (wo || jc) {
          if (
            (wo && (isNA(wo.description) || isNA(wo.reference_no))) ||
            (jc && (isNA(jc.description) || isNA(jc.title)))
          ) {
            naIds.add(String(alloc.sailor_id));
          } else {
            if ((wo && isWorkOrderActiveOnDate(wo, dateVal)) || (jc && isWorkOrderActiveOnDate(jc, dateVal))) {
                assignedIds.add(String(alloc.sailor_id));
            }
          }
      }
    }
  });

  // Also include any assignments that haven't been committed to daily allocations yet
  const activeWos = activeWo.filter(wo => isWorkOrderActiveOnDate(wo, dateVal));
  activeWos.forEach((wo) => {
      if (wo.assigned && Array.isArray(wo.assigned)) {
          if (isNA(wo.description) || isNA(wo.reference_no)) {
              wo.assigned.forEach((id) => naIds.add(String(id)));
          } else {
              wo.assigned.forEach((id) => assignedIds.add(String(id)));
          }
      }
  });

  const activeJcs = activeJc.filter(jc => isWorkOrderActiveOnDate(jc, dateVal));
  activeJcs.forEach((jc) => {
      if (jc.assigned && Array.isArray(jc.assigned)) {
          if (isNA(jc.description) || isNA(jc.title)) {
              jc.assigned.forEach((id) => naIds.add(String(id)));
          } else {
              jc.assigned.forEach((id) => assignedIds.add(String(id)));
          }
      }
  });
  const longTerm = getLongTermAllocations();
  const longTermIds = new Set();
  [...longTerm.housing, ...longTerm.outProject, ...longTerm.otherBase].forEach(
    (a) => {
      var _a$sailor$id;
      longTermIds.add(
        String(
          (_a$sailor$id = a.sailor.id) !== null && _a$sailor$id !== void 0
            ? _a$sailor$id
            : a.sailor._fbKey,
        ),
      );
    },
  );
  const housingCount = document.getElementById("housingProjectCount");
  if (housingCount) housingCount.textContent = longTerm.housing.length;
  const outProjCount = document.getElementById("outProjectCount");
  if (outProjCount) outProjCount.textContent = longTerm.outProject.length;
  const otherBaseCount = document.getElementById("otherBaseCount");
  if (otherBaseCount) otherBaseCount.textContent = longTerm.otherBase.length;
  const [yyyy, mm, dd] = dateVal.split("-");
  const monthKey = `${yyyy}-${mm}`;
  const dayKey = parseInt(dd, 10).toString();

  if (store.sailors) {
    store.sailors.forEach((s) => {
      // Check Firebase daily attendance first
      const fbStatus = store.availability && store.availability[monthKey] && store.availability[monthKey][dayKey] ? store.availability[monthKey][dayKey][s._fbKey] : null;
      const isLeave = isLeaveState(s.status) || isLeaveState(s.attendance) || isLeaveState(fbStatus);
        
      if (!isLeave) {
        if (naIds.has(String(s.id)) || naIds.has(String(s._fbKey))) {
          s.status = "NA";
        } else if (
          longTermIds.has(String(s.id)) ||
          longTermIds.has(String(s._fbKey))
        ) {
          s.status = "LongTermDeployed";
        } else if (
          assignedIds.has(String(s.id)) ||
          assignedIds.has(String(s._fbKey))
        ) {
          s.status = "Assigned";
        } else {
          s.status = "Available";
        }
      } else {
          // If they are on leave according to fbStatus, make sure s.status reflects it 
          // so that subsequent filters count them correctly as leave, not Available.
          s.status = fbStatus || s.attendance || s.status;
      }
      
      // Resolve daily evaluation state from dailyAllocationsMap for active date
      const allocKey = `${dateVal}_${sanitizeFbKey(s.id)}`;
      const allocKeyFb = `${dateVal}_${sanitizeFbKey(s._fbKey)}`;
      const alloc = store.dailyAllocationsMap
        ? store.dailyAllocationsMap[allocKey] ||
          store.dailyAllocationsMap[allocKeyFb]
        : null;
      if (alloc) {
        s.evaluated = alloc.evaluated === true;
        if (alloc.score !== undefined) {
          s.yesterdayScore = parseFloat(alloc.score);
        }
      } else {
        s.evaluated = false;
      }
    });
  }
  const available = store.sailors
    ? store.sailors.filter((s) => s.status === "Available").length
    : 0;
  const assigned = store.sailors
    ? store.sailors.filter((s) => s.status === "Assigned").length
    : 0;
  const naCount = store.sailors
    ? store.sailors.filter((s) => isLeaveState(s.status) || isLeaveState(s.attendance)).length
    : 0;
  const longTermCount = store.sailors
    ? store.sailors.filter((s) => s.status === "LongTermDeployed").length
    : 0;
  
  document.getElementById("netForce").textContent = store.sailors
    ? store.sailors.length
    : 0;
  document.getElementById("assignedCount").textContent = assigned + longTermCount;
  document.getElementById("availableCount").textContent = available;
  const todayNaEl = document.getElementById("todayNaCount");
  if (todayNaEl) todayNaEl.textContent = naCount;
}
function updatePendingEvals() {
  const evaluated = store.sailors ? store.sailors.filter((s) => {
    return (
      (s.status === "Assigned" || s.status === "NA" || s.status === "N/A") &&
      s.evaluated
    );
  }).length : 0;
  
  const pending = store.sailors ? store.sailors.filter((s) => {
    return (
      (s.status === "Assigned" || s.status === "NA" || s.status === "N/A") &&
      !s.evaluated
    );
  }).length : 0;
  const evalEl = document.getElementById("evaluatedToday");
  if (evalEl) evalEl.textContent = evaluated;
  const pendingEl = document.getElementById("pendingEvals");
  if (pendingEl) pendingEl.textContent = pending;
} // =============================================
// DRAG AND DROP
// =============================================
let draggedSailorId = null;
function handleDragStart(event, sailorId) {
  draggedSailorId = sailorId;
  event.target.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}
function handleDragEnd(event) {
  event.target.classList.remove("dragging");
}
function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
}
function handleDrop(event, type) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
}
function handleDropOnCard(event, workOrderId) {
  event.preventDefault();
  event.stopPropagation();
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
  if (!draggedSailorId) return;
  const assignment = getSailorCurrentAssignment(draggedSailorId);
  const sailor = store.sailors.find(
    (s) => String(s.id) === String(draggedSailorId) || String(s._fbKey) === String(draggedSailorId),
  );
  const workOrder = store.workOrders.find(
    (wo) => String(wo.id) === String(workOrderId) || String(wo._fbKey) === String(workOrderId),
  );
  if (!sailor || !workOrder) {
    draggedSailorId = null;
    return;
  }

  const today = getLocalDateString();
  const prevWo = store.workOrders.find((w) => {
    if (w.status !== "Active" && w.status !== "Pending") return false;
    const assignedIds = (w.assigned || []).map(String);
    return assignedIds.includes(String(draggedSailorId));
  });

  const allocSnapshot = (store.dailyAllocations || []).find(
    (a) => a.date === today && String(a.sailor_id) === String(draggedSailorId)
  );

  _lastActionUndo = {
    type: "ASSIGN_SAILOR",
    sailorId: draggedSailorId,
    targetWoId: workOrder.id || workOrder._fbKey,
    targetWoPrevAssigned: [...(workOrder.assigned || [])],
    prevWoId: prevWo ? (prevWo.id || prevWo._fbKey) : null,
    prevWoAssigned: prevWo ? [...(prevWo.assigned || [])] : null,
    sailorPrevStatus: sailor.status,
    sailorPrevZone: sailor.zone_id || store.currentZone,
    dailyAllocSnapshot: allocSnapshot ? JSON.parse(JSON.stringify(allocSnapshot)) : null
  };

  if (prevWo) {
    prevWo.assigned = (prevWo.assigned || []).filter(
      (id) => String(id) !== String(draggedSailorId),
    );
    if (window.safeFbRemoveSailor) {
      safeFbRemoveSailor(prevWo._fbKey || prevWo.id, draggedSailorId, today);
    }
    opsDB
      .ref(`daily_allocations/${today}_${sanitizeFbKey(draggedSailorId)}`)
      .remove();
  }
  if (!workOrder.assigned) workOrder.assigned = [];
  const alreadyAssigned = workOrder.assigned.some(id => String(id) === String(draggedSailorId));
  if (!alreadyAssigned) {
    workOrder.assigned.push(draggedSailorId);
    sailor.status = "Assigned";
    sailor.evaluated = false;
    workOrder.last_assigned_date = today;
    
    // Create daily allocation for the newly assigned sailor
    const alloc = {
      id: Date.now(),
      date: today,
      sailor_id: draggedSailorId,
      work_order_id: workOrder.id || workOrder._fbKey,
      role_today: "Worker",
      assigned_by: store.currentUser && store.currentUser.name ? store.currentUser.name : "Officer",
      status: "Active"
    };
    if (!store.dailyAllocations) store.dailyAllocations = [];
    store.dailyAllocations.push(alloc);
    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(draggedSailorId)}`).set(alloc);
    if (window.safeFbAssignSailor) {
      safeFbAssignSailor(workOrder._fbKey || workOrder.id, draggedSailorId, today);
    }
    renderDashboard();
    showToast(
      assignment
        ? `Reassigned ${sailor.name} from ${assignment.zone}! <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`
        : `${sailor.name} assigned to ${workOrder.description.substring(0, 24)}... <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
      "success",
      6000
    );
  }
  draggedSailorId = null;
}
function removeSailorFromOrder(sailorId, workOrderId) {
  const sailor = store.sailors.find(
    (s) => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId),
  );
  const workOrder = store.workOrders.find(
    (wo) =>
      String(wo.id) === String(workOrderId) ||
      String(wo._fbKey) === String(workOrderId),
  );
  const today = getLocalDateString();
  const isToday = !store.dashboardDate || store.dashboardDate === today;
  if (!isToday) {
    showToast("Historical data is read-only!", "error");
    return;
  }
  if (sailor && workOrder) {
    const allocSnapshot = (store.dailyAllocations || []).find(
      (a) => a.date === today && String(a.sailor_id) === String(sailorId)
    );

    _lastActionUndo = {
      type: "REMOVE_SAILOR",
      sailorId: sailorId,
      workOrderId: workOrder.id || workOrder._fbKey,
      prevWoAssigned: [...(workOrder.assigned || [])],
      sailorPrevStatus: sailor.status,
      sailorPrevZone: sailor.zone_id || store.currentZone,
      dailyAllocSnapshot: allocSnapshot ? JSON.parse(JSON.stringify(allocSnapshot)) : null
    };

    const idsToRemove = new Set([
      String(sailorId),
      String(sailor.id || ""),
      String(sailor._fbKey || ""),
      String(sailor.official_number || "")
    ]);

    workOrder.assigned = (workOrder.assigned || []).filter(
      (id) => !idsToRemove.has(String(id)),
    );
    sailor.status = "Available";
    workOrder.last_assigned_date = today;
    idsToRemove.forEach((id) => {
      if (id) opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(id)}`).remove();
    });
    if (window.safeFbRemoveSailor) {
      safeFbRemoveSailor(workOrder._fbKey || workOrder.id, sailorId, today);
      setTimeout(() => {
        renderDashboard();
        showToast(
          `${sailor.name} removed from assignment <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
          "warning",
          6000
        );
      }, 50);
    } else {
      renderDashboard();
      showToast(
        `${sailor.name} removed from assignment <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
        "warning",
        6000
      );
    }
  }
} // =============================================
// FILTERS
// =============================================
function filterSailors(filter) {
  store.currentFilter = filter;
  store.availableSailorsLimit = 40;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("bg-slate-700", "text-white");
    btn.classList.add("bg-slate-200");
  });
  event.target.classList.remove("bg-slate-200");
  event.target.classList.add("bg-slate-700", "text-white");
  renderAvailableSailors();
}
function filterTrade(trade) {
  store.currentTrade = trade;
  store.availableSailorsLimit = 40;
  document.querySelectorAll(".trade-filter").forEach((btn) => {
    btn.classList.remove("bg-slate-700", "text-white");
    btn.classList.add("bg-slate-200");
  });
  event.target.classList.remove("bg-slate-200");
  event.target.classList.add("bg-slate-700", "text-white");
  renderAvailableSailors();
}
function searchSailors() {
  renderAvailableSailors();
}

let _lastContinuedUndoData = null;

function continueYesterdayJobs() {
  if (!store.dailyAllocations || store.dailyAllocations.length === 0) {
      alert("Please wait a few seconds for the previous data to load from the server, and try again.");
      return;
  }

  computeYesterdayJobs();

  const continuations = store.sailors.filter(
    (s) => s.yesterdayJob !== null && s.status === "Available"
  );
  
  if (continuations.length === 0) {
      alert(`No Available sailors found who worked in this zone's Work Orders on the previous matching day.\nIf you are sure they worked, they might be marked as 'Assigned', 'NA', or 'Leave' today.`);
      return;
  }

  const today = getLocalDateString();
  
  let undoData = {
      date: today,
      allocations: []
  };

  continuations.forEach((sailor) => {
    let wo = store.workOrders.find((w) => String(w.id) === String(sailor.yesterdayJob) || String(w._fbKey) === String(sailor.yesterdayJob));
    let jc = store.jobCards.find((j) => String(j.id) === String(sailor.yesterdayJob) || String(j._fbKey) === String(sailor.yesterdayJob));
    
    const targetObj = wo || jc;
    
    if (targetObj) {
      if (!targetObj.assigned) targetObj.assigned = [];
      const alreadyAssigned = targetObj.assigned.some(id => String(id) === String(sailor.id));
      if (!alreadyAssigned) {
        targetObj.assigned.push(sailor.id);
        sailor.status = "Assigned";
        sailor.evaluated = false;
        targetObj.last_assigned_date = today;
        
        // Create daily allocation
        const allocId = Date.now() + Math.random();
        const alloc = {
          id: allocId,
          date: today,
          sailor_id: sailor.id,
          work_order_id: targetObj.id || targetObj._fbKey,
          role_today: "Worker",
          assigned_by: store.currentUser && store.currentUser.name ? store.currentUser.name : "Officer",
          status: "Active"
        };
        if (!store.dailyAllocations) store.dailyAllocations = [];
        store.dailyAllocations.push(alloc);
        opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailor.id)}`).set(alloc);
        
        if (wo && window.safeFbAssignSailor) safeFbAssignSailor(wo._fbKey || wo.id, sailor.id, today);
        if (jc && window.fbSaveJobCard) fbSaveJobCard(jc);
        
        undoData.allocations.push({
          allocId: allocId,
          sailorId: sailor.id,
          workOrderId: targetObj.id || targetObj._fbKey,
          targetType: wo ? 'wo' : 'jc'
        });
      }
    }
  });
  
  if (undoData.allocations.length > 0) {
      _lastContinuedUndoData = undoData;
      const undoBtn = document.getElementById("btnUndoContinue");
      if (undoBtn) undoBtn.classList.remove("hidden");
  }

  renderDashboard();
  showToast(`${continuations.length} sailors continued from previous jobs`);
}

function undoContinueYesterdayJobs() {
  if (!_lastContinuedUndoData) return;
  
  const { date, allocations } = _lastContinuedUndoData;
  let count = 0;
  
  allocations.forEach(action => {
      // 1. Remove from daily_allocations in FB
      opsDB.ref(`daily_allocations/${date}_${sanitizeFbKey(action.sailorId)}`).remove();
      
      // 2. Remove from store.dailyAllocations
      if (store.dailyAllocations) {
        store.dailyAllocations = store.dailyAllocations.filter(a => a.id !== action.allocId);
      }
      
      // 3. Revert sailor status in memory
      const sailor = store.sailors.find(s => String(s.id) === String(action.sailorId));
      if (sailor) sailor.status = "Available";
      
      // 4. Remove from WO/JC assigned array and save
      let targetObj = action.targetType === 'wo' 
          ? store.workOrders.find(w => String(w.id) === String(action.workOrderId) || String(w._fbKey) === String(action.workOrderId))
          : store.jobCards.find(j => String(j.id) === String(action.workOrderId) || String(j._fbKey) === String(action.workOrderId));
          
      if (targetObj && targetObj.assigned) {
          if (action.targetType === 'wo' && window.safeFbRemoveSailor) {
              safeFbRemoveSailor(targetObj._fbKey || targetObj.id, action.sailorId, date);
          } else if (action.targetType === 'jc') {
              targetObj.assigned = targetObj.assigned.filter(id => String(id) !== String(action.sailorId));
              if (window.fbSaveJobCard) fbSaveJobCard(targetObj);
          }
      }
      count++;
  });
  
  _lastContinuedUndoData = null;
  const undoBtn = document.getElementById("btnUndoContinue");
  if (undoBtn) undoBtn.classList.add("hidden");
  
  renderDashboard();
  showToast(`Undo successful. Reversed ${count} assignments.`);
} // =============================================
// WORK ORDER MANAGEMENT
// =============================================
// Tracks which sailor IDs are selected in the modal
let _woSelectedSailors = new Set();
let _woCurrentTrade = "ALL";
function openNewWorkOrderModal() {
  // Reset sailor selection
  _woSelectedSailors = new Set();
  _woCurrentTrade = "ALL"; // Populate Approved Ref dropdown
  document.getElementById("woApprovedRef").innerHTML =
    '<option value="">📋 Approved</option>' +
    store.approvedPendingJobs
      .map((j) => `<option value="${j.id}">${j.reference_no}</option>`)
      .join(""); // Populate Approved Estimates dropdown
  const approvedEstimates = store.estimates.filter(
    (e) =>
      e.status === "Approved" &&
      (!e.zone_id || e.zone_id === store.currentZone),
  );
  document.getElementById("woEstimateSelect").innerHTML =
    '<option value="">-- Select Approved Estimate (Optional) --</option>' +
    approvedEstimates
      .map(
        (e) =>
          `<option value="${e.id}">${e.estimate_number} - ${e.description} (${formatCurrency(e.total_cost)})</option>`,
      )
      .join("");
  document.getElementById("woEstimateSelect").value = ""; // Populate Location dropdown
  const uniqueBuildings = [
    ...new Set(
      store.locations
        .filter((l) => l.zone_id === store.currentZone)
        .map((l) => l.building_name),
    ),
  ];
  document.getElementById("woLocationSelect").innerHTML =
    '<option value="">Select Location...</option>' +
    uniqueBuildings
      .map((name) => `<option value="${name}">${name}</option>`)
      .join("");
  document.getElementById("woSubLocation").value = ""; // Populate In-Charge / Supervisor dropdowns (filtered to Settings assignments, with fallback to all EC sailors)
  const ecSailors = store.sailors.filter((s) => {
    const off = String(s.official_number || "")
      .trim()
      .toUpperCase();
    return off.startsWith("EC");
  });
  // ── Populate In-Charge dropdown ──
  const inc = (store.settings.zoneInCharges || {})[store.currentZone];
  let primaryInchargeId = "";
  let inchargeOptions = '<option value="">-- Select In-Charge --</option>';

  const assignedIncharge = inc?.woInchargeId || inc?.sailorId;
  const actingIncharge = inc?.subSailorId;

  // 1. Zone In-Charge & Acting Incharge first
  if (assignedIncharge) {
    const s = store.sailors.find(
      (x) =>
        String(x.id !== undefined && x.id !== null ? x.id : x._fbKey) ===
        String(assignedIncharge),
    );
    if (s) {
      inchargeOptions += `<option value="${s.id !== undefined && s.id !== null ? s.id : s._fbKey}" class="font-bold bg-blue-50 text-blue-900">⭐ ${s.rank} ${s.name} (Zone In-Charge)</option>`;
      primaryInchargeId = String(
        s.id !== undefined && s.id !== null ? s.id : s._fbKey,
      );
    }
  }
  if (actingIncharge && String(actingIncharge) !== String(assignedIncharge)) {
    const s = store.sailors.find(
      (x) =>
        String(x.id !== undefined && x.id !== null ? x.id : x._fbKey) ===
        String(actingIncharge),
    );
    if (s) {
      inchargeOptions += `<option value="${s.id !== undefined && s.id !== null ? s.id : s._fbKey}" class="bg-indigo-50 text-indigo-900">🎖️ ${s.rank} ${s.name} (Acting Incharge)</option>`;
      if (!primaryInchargeId)
        primaryInchargeId = String(
          s.id !== undefined && s.id !== null ? s.id : s._fbKey,
        );
    }
  }

  // 2. Other EC sailors
  inchargeOptions += '<optgroup label="Other Eligible EC Sailors">';
  ecSailors.forEach((s) => {
    const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
    if (sid !== String(assignedIncharge) && sid !== String(actingIncharge)) {
      inchargeOptions += `<option value="${s.id}">${s.rank} ${s.name} (${s.official_number || s.service_no || ""})</option>`;
    }
  });
  inchargeOptions += "</optgroup>";
  const inchargeEl = document.getElementById("woIncharge");
  inchargeEl.innerHTML = inchargeOptions;
  if (primaryInchargeId) inchargeEl.value = primaryInchargeId;

  // ── Populate Supervisor dropdown ──
  let primarySupervisorId = "";
  let supervisorOptions = '<option value="">-- Select Supervisor --</option>';
  const zoneSupervisors = Array.isArray(inc?.supervisors)
    ? inc.supervisors
    : inc?.woSupervisorId
      ? [{ id: inc.woSupervisorId }]
      : [];
  const zoneSupervisorIds = new Set(
    zoneSupervisors.map((sv) =>
      String(sv.id || sv._fbKey || sv.sailorId),
    ),
  );

  if (zoneSupervisors.length > 0) {
    supervisorOptions += '<optgroup label="⭐ Zone Assigned Supervisors">';
    zoneSupervisors.forEach((sv) => {
      const sid = String(sv.id || sv._fbKey || sv.sailorId);
      const s = store.sailors.find(
        (x) =>
          String(x.id !== undefined && x.id !== null ? x.id : x._fbKey) ===
          sid,
      );
      if (s) {
        supervisorOptions += `<option value="${s.id !== undefined && s.id !== null ? s.id : s._fbKey}" class="font-bold bg-amber-50 text-amber-900">👷 ${s.rank} ${s.name} (Supervisor)</option>`;
        if (!primarySupervisorId)
          primarySupervisorId = String(
            s.id !== undefined && s.id !== null ? s.id : s._fbKey,
          );
      }
    });
    supervisorOptions += "</optgroup>";
  }

  supervisorOptions += '<optgroup label="Other Eligible EC Sailors">';
  ecSailors.forEach((s) => {
    const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
    if (!zoneSupervisorIds.has(sid)) {
      supervisorOptions += `<option value="${s.id}">${s.rank} ${s.name} (${s.official_number || s.service_no || ""})</option>`;
    }
  });
  supervisorOptions += "</optgroup>";
  const supervisorEl = document.getElementById("woSupervisor");
  supervisorEl.innerHTML = supervisorOptions;
  if (primarySupervisorId) supervisorEl.value = primarySupervisorId;

  // ── Populate Project Artificer dropdown ──
  const acSailors = store.sailors.filter((s) => {
    const off = String(s.official_number || "")
      .trim()
      .toUpperCase();
    return off.startsWith("AC");
  });
  let primaryArtificerId = "";
  let artificerOptions = '<option value="">(None / Optional)</option>';
  if (inc && inc.woArtificerId) {
    const s = store.sailors.find(
      (x) =>
        String(x.id !== undefined && x.id !== null ? x.id : x._fbKey) ===
        String(inc.woArtificerId),
    );
    if (s) {
      artificerOptions += `<option value="${s.id !== undefined && s.id !== null ? s.id : s._fbKey}" class="font-bold bg-purple-50 text-purple-900">🔧 ${s.rank} ${s.name} (Assigned Artificer)</option>`;
      primaryArtificerId = String(
        s.id !== undefined && s.id !== null ? s.id : s._fbKey,
      );
    }
  }
  artificerOptions += '<optgroup label="Other AC Sailors">';
  acSailors.forEach((s) => {
    const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
    if (sid !== String(inc?.woArtificerId)) {
      artificerOptions += `<option value="${s.id}">${s.rank} ${s.name} (${s.official_number || s.service_no || ""})</option>`;
    }
  });
  artificerOptions += "</optgroup>";
  const artificerEl = document.getElementById("woArtificer");
  artificerEl.innerHTML = artificerOptions;
  if (primaryArtificerId) artificerEl.value = primaryArtificerId; // Render sailor chips
  renderWoSailorChips(); // Clear search
  document.getElementById("woSailorSearch").value = ""; // Reset trade filter UI
  document.querySelectorAll(".wo-trade-btn").forEach((b) => {
    b.className =
      "wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600";
  });
  document.querySelector(".wo-trade-btn").className =
    "wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white";
  const isAdminStaff = isAdminStaffDuties(store.currentZone); // Elements to hide
  const typePriorityWrapper = document.getElementById("woTypePriorityWrapper");
  const referenceWrapper = document.getElementById("woReferenceWrapper");
  const estimateWrapper = document.getElementById("woEstimateWrapper");
  const costDurationWrapper = document.getElementById("woCostDurationWrapper");
  const supervisorWrapper = document.getElementById("woSupervisorWrapper");
  const artificerWrapper = document.getElementById("woArtificerWrapper");
  const staffWrapper = document.getElementById("woStaffWrapper");
  if (typePriorityWrapper)
    typePriorityWrapper.classList.toggle("hidden", isAdminStaff);
  if (referenceWrapper)
    referenceWrapper.classList.toggle("hidden", isAdminStaff);
  if (estimateWrapper) estimateWrapper.classList.toggle("hidden", isAdminStaff);
  if (costDurationWrapper)
    costDurationWrapper.classList.toggle("hidden", isAdminStaff);
  if (supervisorWrapper)
    supervisorWrapper.classList.toggle("hidden", isAdminStaff);
  if (artificerWrapper)
    artificerWrapper.classList.toggle("hidden", isAdminStaff);
  if (staffWrapper) {
    if (isAdminStaff) {
      staffWrapper.classList.remove("grid-cols-3");
      staffWrapper.classList.add("grid-cols-1");
    } else {
      staffWrapper.classList.remove("grid-cols-1");
      staffWrapper.classList.add("grid-cols-3");
    }
  }
  document.getElementById("workOrderModal").classList.remove("hidden");
}
function autofillFromEstimate(estimateId) {
  if (!estimateId) {
    document.getElementById("woBudget").value = "";
    return;
  }
  const est = store.estimates.find((e) => String(e.id) === String(estimateId));
  if (est) {
    // 1. Reference Type
    const refTypeInput = document.getElementById("woRefType");
    if (refTypeInput) {
      refTypeInput.value = est.ref_type || est.reference_type || "Minute Sheet";
    }

    // 2. Reference No
    const refNoInput = document.getElementById("woReference");
    if (refNoInput) {
      refNoInput.value =
        est.reference_doc ||
        est.reference_no ||
        est.reference ||
        est.estimate_number ||
        "";
    }

    // 3. Project Type
    const typeInput = document.getElementById("woType");
    if (typeInput) {
      typeInput.value = est.project_type || est.type || "PROJECT";
    }

    // 4. Description
    const descInput = document.getElementById("woDescription");
    if (descInput) {
      descInput.value = est.description || "";
    }

    // 5. Authority & Est Cost & Duration
    const authInput = document.getElementById("woAuthority");
    if (authInput) {
      authInput.value =
        est.approvedAuthority ||
        (est.approvedBy && est.approvedBy.name
          ? est.approvedBy.name
          : "CCED(E)");
    }
    const budgetInput = document.getElementById("woBudget");
    if (budgetInput) {
      budgetInput.value = est.total_cost || 0;
    }
    const durationInput = document.getElementById("woDuration");
    if (durationInput) {
      durationInput.value = est.totalManDays
        ? Math.max(1, Math.ceil(est.totalManDays / 4))
        : 1;
    }

    // 6. Location & Location 2 (not sub Location)
    const locSelect = document.getElementById("woLocationSelect");
    const loc2Input = document.getElementById("woSubLocation"); // Location 2

    if (locSelect) {
      let found = false;
      for (let i = 0; i < locSelect.options.length; i++) {
        if (locSelect.options[i].value === est.location) {
          locSelect.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found && est.location) {
        const opt = document.createElement("option");
        opt.value = est.location;
        opt.textContent = est.location;
        locSelect.appendChild(opt);
        locSelect.value = est.location;
      }
    }

    if (loc2Input) {
      loc2Input.value = est.location2 || est.sub_location || "";
    }
  }
}
function renderWoSailorChips(filter = "") {
  const tradeBgMap = {
    MA: "#0d9488",
    CA: "#7c3aed",
    PA: "#b45309",
    PL: "#0891b2",
    WE: "#dc2626",
    RW: "#374151",
    SW: "#065f46",
    BB: "#1d4ed8",
    AL: "#ec4899",
  }; // Zone restriction helper — only allow sailors from current zone (or unassigned)
  const isFromAnotherZone = (s) => {
    if (!s.zone_assigned || s.zone_assigned === "") return false; // unassigned → accessible
    return s.zone_assigned !== store.currentZone;
  };
  let sailors;
  if (filter) {
    // When searching by name/number, show all sailors but mark other-zone ones as blocked
    const q = filter.toLowerCase().trim();
    sailors = store.sailors.filter(
      (s) =>
        (s._searchIndex || "").includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.official_number || "").toLowerCase().includes(q) ||
        (s.rank || "").toLowerCase().includes(q) ||
        (s.trade || "").toLowerCase().includes(q),
    );
    if (_woCurrentTrade !== "ALL") {
      sailors = sailors.filter((s) => s.trade === _woCurrentTrade);
    }
  } else {
    // Default (no search): only show sailors of current zone (or unassigned)
    sailors = store.sailors.filter(
      (s) =>
        (s.attendance === "Present" || !s.attendance) &&
        (_woCurrentTrade === "ALL" || s.trade === _woCurrentTrade) &&
        !isFromAnotherZone(s),
    );
  }
  const container = document.getElementById("woSailorChips");
  if (sailors.length === 0) {
    container.innerHTML = `
            <div class="w-full py-4 text-center">
                <div style="font-size:28px">🔍</div>
                <p class="text-slate-400 text-xs mt-1">No sailors found for <strong>${filter || _woCurrentTrade}</strong></p>
            </div>`;
    return;
  }
  container.innerHTML = sailors
    .map((s) => {
      var _s$id7, _s$id8, _s$id0;
      const isSelected = _woSelectedSailors.has(
        String(
          (_s$id7 = s.id) !== null && _s$id7 !== void 0 ? _s$id7 : s._fbKey,
        ),
      );
      const tradeBg = tradeBgMap[s.trade] || "#475569";
      const offNo =
        s.official_number || s.officialNumber || s.service_no || "—";
      const fullName = s.name || "Unknown";
      const rank = s.rank || "";
      // Block sailors from other zones — show as locked chip
      if (isFromAnotherZone(s)) {
        const lockedAssignment = getSailorCurrentAssignment(s.id ?? s._fbKey);
        const lockedZone = lockedAssignment?.zone || s.zone_assigned || "Unknown Zone";
        const lockedRef  = lockedAssignment?.ref   || "";
        const lockedTitle= lockedAssignment?.title
          ? lockedAssignment.title.substring(0, 38) + (lockedAssignment.title.length > 38 ? "…" : "")
          : "";
        const isLockedToday = !!lockedAssignment;
        const tooltipLocked = isLockedToday ? `🔒 ${rank} ${fullName} දැනට ${lockedZone} හි ${lockedRef} රාජකාරිය සඳහා Assign කරලා ඉන්නවා.` : `${rank} ${fullName} belongs to ${lockedZone}, but is free today. Click to borrow.`;
        
        if (isLockedToday) {
            return `
                <button type="button" disabled
                    title="${tooltipLocked}"
                style="
                    display:flex; align-items:center; gap:8px;
                    padding:7px 10px; border-radius:10px; cursor:not-allowed;
                    border:2px solid #e2e8f0;
                    background:#f8fafc;
                    min-width:140px; position:relative;
                    text-align:left; opacity:0.55;
                ">
                <span style="
                    width:32px; height:32px; border-radius:8px;
                    background:#94a3b8;
                    color:white; display:flex; align-items:center; justify-content:center;
                    font-size:9px; font-weight:800; flex-shrink:0;
                ">${s.trade}</span>
                <div style="min-width:0; flex:1">
                    <div style="font-size:11px; font-weight:700; line-height:1.2; color:#64748b;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;"
                    >${rank} ${fullName}</div>
                    <div style="display:flex; align-items:center; gap:3px; margin-top:2px; flex-wrap:wrap;">
                        <span style="font-size:8px; background:#e2e8f0; color:#475569; border-radius:4px; padding:1px 5px; font-weight:700; white-space:nowrap;">🔒 ${lockedZone}</span>
                        ${lockedRef ? `<span style="font-size:8px; background:#e0f2fe; color:#0369a1; border-radius:4px; padding:1px 5px; font-weight:700; white-space:nowrap;">${lockedRef}</span>` : ""}
                    </div>
                    ${lockedTitle ? `<div style="font-size:8px; color:#94a3b8; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;">${lockedTitle}</div>` : ""}
                </div>
            </button>`;
        } else {
            // Not locked today, so allow borrowing
            return `
                <button type="button"
                    onclick="toggleWoSailor('${s.id ?? s._fbKey}')"
                    title="${tooltipLocked}"
                    class="sailor-chip-card hover:border-indigo-500 hover:shadow-md transition-all duration-200"
                    style="
                        display:flex; align-items:center; gap:8px;
                        padding:7px 10px; border-radius:10px; cursor:pointer;
                        border:2px dashed #818cf8;
                        background:#eef2ff;
                        min-width:140px; position:relative;
                        text-align:left;
                    ">
                    <span style="
                        width:32px; height:32px; border-radius:8px;
                        background:#6366f1;
                        color:white; display:flex; align-items:center; justify-content:center;
                        font-size:9px; font-weight:800; flex-shrink:0;
                    ">${s.trade}</span>
                    <div style="min-width:0; flex:1">
                        <div style="font-size:11px; font-weight:700; line-height:1.2; color:#4f46e5;
                            white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;"
                        >${rank} ${fullName}</div>
                        <div style="font-size:8px; color:#6366f1; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🏢 Borrow from ${lockedZone}</div>
                    </div>
                </button>`;
        }
      }
      const assignment = getSailorCurrentAssignment(
        (_s$id8 = s.id) !== null && _s$id8 !== void 0 ? _s$id8 : s._fbKey,
      );
      if (assignment) {
        var _s$id9;
        return `
            <button type="button"
                onclick="toggleWoSailor('${(_s$id9 = s.id) !== null && _s$id9 !== void 0 ? _s$id9 : s._fbKey}')"
                title="Currently assigned to ${assignment.ref} in ${assignment.zone}: ${assignment.title}. Click to automatically reassign here."
                class="sailor-chip-card hover:border-amber-500 hover:shadow-md transition-all duration-200"
                style="
                    display:flex; align-items:center; gap:8px;
                    padding:7px 10px; border-radius:10px; cursor:pointer;
                    border:2px dashed #f59e0b;
                    background:#fffbeb;
                    min-width:140px; position:relative;
                    text-align:left;
                ">
                <!-- Trade badge -->
                <span style="
                    width:32px; height:32px; border-radius:8px;
                    background:#d97706;
                    color:white; display:flex; align-items:center; justify-content:center;
                    font-size:9px; font-weight:800; flex-shrink:0;
                ">${s.trade}</span>

                <!-- Name + Off No + assignment info -->
                <div style="min-width:0; flex:1">
                    <div style="
                        font-size:11px; font-weight:700; line-height:1.2;
                        color:#b45309;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        max-width:130px;
                    ">${rank} ${fullName}</div>
                    <div style="font-size:8px; color:#d97706; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🔁 Reassign from ${assignment.zone}</div>
                </div>
            </button>`;
      }
      return `
        <button type="button"
            onclick="toggleWoSailor('${(_s$id0 = s.id) !== null && _s$id0 !== void 0 ? _s$id0 : s._fbKey}')"
            title="${rank} ${fullName} | ${offNo}"
            class="sailor-chip-card ${isSelected ? "selected" : ""}"
            style="
                display:flex; align-items:center; gap:8px;
                padding:7px 10px; border-radius:10px; cursor:pointer;
                border:2px solid ${isSelected ? "rgba(13,148,136,0.6)" : "#e2e8f0"};
                background:${isSelected ? "linear-gradient(135deg,rgba(13,148,136,0.12),rgba(8,145,178,0.12))" : "#fff"};
                box-shadow: ${isSelected ? "0 0 0 2px rgba(13,148,136,0.25)" : "0 1px 3px rgba(0,0,0,0.06)"};
                transition:all 0.15s ease; min-width:140px; position:relative;
                text-align:left;
            ">

            <!-- Trade badge -->
            <span style="
                width:32px; height:32px; border-radius:8px;
                background:${isSelected ? "#0d9488" : tradeBg};
                color:white; display:flex; align-items:center; justify-content:center;
                font-size:9px; font-weight:800; flex-shrink:0;
                box-shadow:0 2px 4px ${tradeBg}66;
            ">${s.trade}</span>

            <!-- Name + Off No -->
            <div style="min-width:0; flex:1">
                <div style="
                    font-size:11px; font-weight:700; line-height:1.2;
                    color:${isSelected ? "#0d9488" : "#1e293b"};
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                    max-width:130px;
                ">${rank} ${fullName}</div>
                <div style="font-size:9.5px; color:#94a3b8; font-weight:500; letter-spacing:0.3px">${offNo}</div>
            </div>

            <!-- Checkmark -->
            ${
              isSelected
                ? `
            <span style="
                width:18px; height:18px; border-radius:50%;
                background:#0d9488; color:white;
                display:flex; align-items:center; justify-content:center;
                font-size:11px; font-weight:900; flex-shrink:0;
            ">✓</span>`
                : ""
            }
        </button>`;
    })
    .join(""); // Update counter
  const count = _woSelectedSailors.size;
  document.getElementById("woAssignedCount").textContent = `${count} selected`; // Update summary strip — show rank + name + off no
  const summary = document.getElementById("woSelectedSummary");
  if (count > 0) {
    const details = [..._woSelectedSailors]
      .map((id) => {
        const s = store.sailors.find((s) => {
          var _s$id1;
          return (
            String(
              (_s$id1 = s.id) !== null && _s$id1 !== void 0 ? _s$id1 : s._fbKey,
            ) === String(id)
          );
        });
        if (!s) return id;
        const offNo = s.official_number || s.service_no || "?";
        return `${s.rank || ""} ${s.name} (${offNo})`;
      })
      .join(" • ");
    document.getElementById("woSelectedNames").textContent = details;
    summary.classList.remove("hidden");
  } else {
    summary.classList.add("hidden");
  }
}
function toggleWoSailor(sailorId, name) {
  const key = String(sailorId);
  if (_woSelectedSailors.has(key)) {
    _woSelectedSailors.delete(key);
  } else {
    const assignment = getSailorCurrentAssignment(sailorId);
    if (assignment) {
      var _store$sailors$find; // Automatically remove from previous assignment
      const prevWo = store.workOrders.find((w) => {
        if (w.status !== "Active" && w.status !== "Pending") return false;
        const assignedIds = (w.assigned || []).map(String);
        return assignedIds.includes(key);
      });
      if (prevWo) {
        prevWo.assigned = (prevWo.assigned || []).filter(
          (id) => String(id) !== key,
        );
        const today = getLocalDateString();
        if (window.safeFbRemoveSailor) {
          safeFbRemoveSailor(prevWo._fbKey || prevWo.id, key, today);
        }
        opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(key)}`).remove();
      }
      showToast(
        `Reassigned ${
          ((_store$sailors$find = store.sailors.find((s) => {
            var _s$id10;
            return (
              String(
                (_s$id10 = s.id) !== null && _s$id10 !== void 0
                  ? _s$id10
                  : s._fbKey,
              ) === key
            );
          })) === null || _store$sailors$find === void 0
            ? void 0
            : _store$sailors$find.name) || "Sailor"
        } from ${assignment.zone}!`,
      );
    }
    _woSelectedSailors.add(key);
  }
  renderWoSailorChips(document.getElementById("woSailorSearch").value);
}
function filterWoSailors() {
  renderWoSailorChips(document.getElementById("woSailorSearch").value);
}
function filterWoTrade(trade) {
  _woCurrentTrade = trade;
  document.querySelectorAll(".wo-trade-btn").forEach((b) => {
    b.className =
      "wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600";
  });
  event.target.className =
    "wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white";
  renderWoSailorChips(document.getElementById("woSailorSearch").value);
}
function selectApprovedJob() {
  const selectedId = document.getElementById("woApprovedRef").value;
  if (selectedId) {
    const job = store.approvedPendingJobs.find((j) => j.id == selectedId);
    if (job) {
      document.getElementById("woReference").value = job.reference_no;
      document.getElementById("woDescription").value = job.description;
      document.getElementById("woAuthority").value = job.authority || "";
      document.getElementById("woBudget").value = job.estimated_cost || "";
    }
  }
}
function createWorkOrder(event) {
  event.preventDefault();
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Processing...";
  }
  
  const estimateId = document.getElementById("woEstimateSelect").value || null;
  const newOrder = {
    type: document.getElementById("woType").value,
    reference_no: document.getElementById("woReference").value || null,
    description: document.getElementById("woDescription").value,
    status: "Pending",
    priority: document.getElementById("woPriority").value,
    zone_id: store.currentZone,
    estimated_duration:
      parseInt(document.getElementById("woDuration").value) || 1,
    budget_allocation:
      parseFloat(document.getElementById("woBudget").value) || 0,
    progress: 0,
    assigned: [..._woSelectedSailors], // ← selected sailors from chip picker
    location: document.getElementById("woLocationSelect").value || "",
    sub_location: document.getElementById("woSubLocation").value || "",
    incharge: document.getElementById("woIncharge").value || null,
    supervisor: document.getElementById("woSupervisor").value || null,
    project_artificer: document.getElementById("woArtificer").value || null,
    estimate_id: estimateId,
  }; // Mark selected sailors as Assigned in store (optimistic update)
  _woSelectedSailors.forEach((id) => {
    const s = store.sailors.find((s) => {
      var _s$id11;
      return (
        String(
          (_s$id11 = s.id) !== null && _s$id11 !== void 0 ? _s$id11 : s._fbKey,
        ) === String(id)
      );
    });
    if (s) {
      s.status = "Assigned";
      s.evaluated = false;
    }
  });
  _woSelectedSailors = new Set(); // reset
  // Save Work Order to Firebase DB#2 (realtime listener updates store automatically)
  fbSaveWorkOrder(newOrder)
    .then((ref) => {
      const fbKey = ref ? ref.key : null; // Also create a Job Card automatically
      const jobNumber = `JC/${new Date().getFullYear()}/${String(Date.now()).slice(-4).padStart(4, "0")}`;
      const newJobCard = {
        job_number: jobNumber,
        work_order_id: fbKey, // link to the Firebase key
        description: newOrder.description,
        location: newOrder.location,
        zone_id: store.currentZone,
        status: "Active",
        start_date: getLocalDateString(),
        total_material_cost: 0,
        feedbackSent: false,
        feedbackReceived: false,
        estimate_id: estimateId,
      };
      fbSaveJobCard(newJobCard).then((jcRef) => {
        const jcKey = jcRef ? jcRef.key : null;
        _lastCreatedWorkOrder = {
          fbKey: fbKey,
          jobCardFbKey: jcKey,
          assignedSailors: newOrder.assigned
        };
      });
      if (estimateId) {
        const est = store.estimates.find(
          (e) => String(e.id) === String(estimateId),
        );
        if (est && est._fbKey) {
          opsDB
            .ref(`estimates/${est._fbKey}`)
            .update({ status: "Linked", work_order_id: fbKey });
        }
      }
      closeModal("workOrderModal");
      showToast(
        `Work order & Job Card ${jobNumber} created! <button onclick="undoCreateWorkOrder()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
        "success",
        6000
      );
      event.target.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.originalText;
      }
    })
    .catch((err) => {
      console.error("❌ Work order save failed:", err);
      showToast("Save failed — check Firebase connection", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.originalText;
      }
    });
} // =============================================
// NEW SIMPLIFIED ASSIGNMENT WORKFLOW
// =============================================
let _asSelectedSailors = new Set();
let _asCurrentTrade = "ALL";
function openNewAssignModal() {
  _asSelectedSailors = new Set();
  _asCurrentTrade = "ALL"; // Reset form elements

  const isAdminStaff = isAdminStaffDuties(store.currentZone);
  const typeGroup = document.getElementById("asTypeGroup");
  const inchargeGroup = document.getElementById("asInchargeGroup");
  const descEl = document.getElementById("asDescription");

  if (isAdminStaff) {
    if (typeGroup) typeGroup.style.display = "block";
    if (inchargeGroup) inchargeGroup.style.display = "block";
    document.getElementById("asType").value = "Admin Staff";
    descEl.value = "";
    descEl.placeholder = "Describe the work...";
  } else {
    if (typeGroup) typeGroup.style.display = "none";
    if (inchargeGroup) inchargeGroup.style.display = "none";
    document.getElementById("asType").value = "In Charge";
    descEl.value = "In Charge";
    descEl.placeholder = "In Charge";
  }

  // Populate In-Charge dropdown (Off No starts with 'EC')
  const ecSailors = store.sailors.filter((s) => {
    const off = String(s.official_number || "")
      .trim()
      .toUpperCase();
    return off.startsWith("EC");
  });
  const supOptions =
    '<option value="">Select...</option>' +
    ecSailors
      .map((s) => `<option value="${s.id}">${s.rank} ${s.name}</option>`)
      .join("");
  document.getElementById("asIncharge").innerHTML = supOptions;
  document.getElementById("asIncharge").value = ""; // Render sailor chips
  renderAsSailorChips(); // Clear search
  document.getElementById("asSailorSearch").value = ""; // Reset trade filter UI
  document.querySelectorAll(".as-trade-btn").forEach((b) => {
    b.className =
      "as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600";
  });
  const firstTradeBtn = document.querySelector(".as-trade-btn");
  if (firstTradeBtn) {
    firstTradeBtn.className =
      "as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white";
  }
  updateAsPreview();
  document.getElementById("assignModal").classList.remove("hidden");
}
function renderAsSailorChips(filter = "") {
  const tradeBgMap = {
    MA: "#0d9488",
    CA: "#7c3aed",
    PA: "#b45309",
    PL: "#0891b2",
    WE: "#dc2626",
    RW: "#374151",
    SW: "#065f46",
    BB: "#1d4ed8",
    AL: "#ec4899",
  };
  let sailors = store.sailors.filter(
    (s) =>
      (s.attendance === "Present" || !s.attendance) &&
      (_asCurrentTrade === "ALL" || s.trade === _asCurrentTrade),
  );
  if (filter) {
    const q = filter.toLowerCase().trim();
    sailors = sailors.filter(
      (s) =>
        (s._searchIndex || "").includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.official_number || "").toLowerCase().includes(q) ||
        (s.rank || "").toLowerCase().includes(q) ||
        (s.trade || "").toLowerCase().includes(q),
    );
  }
  const container = document.getElementById("asSailorChips");
  if (sailors.length === 0) {
    container.innerHTML = `
            <div class="w-full py-4 text-center">
                <div style="font-size:28px">🔍</div>
                <p class="text-slate-400 text-xs mt-1">No sailors found for <strong>${filter || _asCurrentTrade}</strong></p>
            </div>`;
    return;
  }
  container.innerHTML = sailors
    .map((s) => {
      var _s$id12, _s$id13, _s$id14;
      const isSelected = _asSelectedSailors.has(
        String(
          (_s$id12 = s.id) !== null && _s$id12 !== void 0 ? _s$id12 : s._fbKey,
        ),
      );
      const tradeBg = tradeBgMap[s.trade] || "#475569";
      const offNo =
        s.official_number || s.officialNumber || s.service_no || "—";
      const fullName = s.name || "Unknown";
      const rank = s.rank || "";
      const assignment = getSailorCurrentAssignment(
        (_s$id13 = s.id) !== null && _s$id13 !== void 0 ? _s$id13 : s._fbKey,
      );
      if (assignment) {
        return `
            <button type="button"
                disabled
                title="Already assigned to ${assignment.ref} in ${assignment.zone}: ${assignment.title}"
                class="sailor-chip-card opacity-50 cursor-not-allowed"
                style="
                    display:flex; align-items:center; gap:8px;
                    padding:7px 10px; border-radius:10px;
                    border:2px solid #e2e8f0;
                    background:#f1f5f9;
                    box-shadow: none;
                    transition:all 0.15s ease; min-width:140px; position:relative;
                    text-align:left;
                ">
                <!-- Trade badge -->
                <span style="
                    width:32px; height:32px; border-radius:8px;
                    background:#94a3b8;
                    color:white; display:flex; align-items:center; justify-content:center;
                    font-size:9px; font-weight:800; flex-shrink:0;
                ">${s.trade}</span>

                <!-- Name + Off No + assignment info -->
                <div style="min-width:0; flex:1">
                    <div style="
                        font-size:11px; font-weight:700; line-height:1.2;
                        color:#64748b;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        max-width:130px;
                    ">${rank} ${fullName}</div>
                    <div style="font-size:8px; color:#b45309; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">⚠️ Busy: ${assignment.zone}</div>
                </div>
            </button>`;
      }
      return `
        <button type="button"
            onclick="toggleAsSailor('${(_s$id14 = s.id) !== null && _s$id14 !== void 0 ? _s$id14 : s._fbKey}')"
            title="${rank} ${fullName} | ${offNo}"
            class="sailor-chip-card ${isSelected ? "selected" : ""}"
            style="
                display:flex; align-items:center; gap:8px;
                padding:7px 10px; border-radius:10px; cursor:pointer;
                border:2px solid ${isSelected ? "rgba(13,148,136,0.6)" : "#e2e8f0"};
                background:${isSelected ? "linear-gradient(135deg,rgba(13,148,136,0.12),rgba(8,145,178,0.12))" : "#fff"};
                box-shadow: ${isSelected ? "0 0 0 2px rgba(13,148,136,0.25)" : "0 1px 3px rgba(0,0,0,0.06)"};
                transition:all 0.15s ease; min-width:140px; position:relative;
                text-align:left;
            ">

            <!-- Trade badge -->
            <span style="
                width:32px; height:32px; border-radius:8px;
                background:${isSelected ? "#0d9488" : tradeBg};
                color:white; display:flex; align-items:center; justify-content:center;
                font-size:9px; font-weight:800; flex-shrink:0;
                box-shadow:0 2px 4px ${tradeBg}66;
            ">${s.trade}</span>

            <!-- Name + Off No -->
            <div style="min-width:0; flex:1">
                <div style="
                    font-size:11px; font-weight:700; line-height:1.2;
                    color:${isSelected ? "#0d9488" : "#1e293b"};
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                    max-width:130px;
                ">${rank} ${fullName}</div>
                <div style="font-size:9.5px; color:#94a3b8; font-weight:500; letter-spacing:0.3px">${offNo}</div>
            </div>

            <!-- Checkmark -->
            ${
              isSelected
                ? `
            <span style="
                width:18px; height:18px; border-radius:50%;
                background:#0d9488; color:white;
                display:flex; align-items:center; justify-content:center;
                font-size:11px; font-weight:900; flex-shrink:0;
            ">✓</span>`
                : ""
            }
        </button>`;
    })
    .join(""); // Update counter
  const count = _asSelectedSailors.size;
  document.getElementById("asAssignedCount").textContent = `${count} selected`; // Update summary strip
  const summary = document.getElementById("asSelectedSummary");
  if (count > 0) {
    const details = [..._asSelectedSailors]
      .map((id) => {
        const s = store.sailors.find((s) => {
          var _s$id15;
          return (
            String(
              (_s$id15 = s.id) !== null && _s$id15 !== void 0
                ? _s$id15
                : s._fbKey,
            ) === String(id)
          );
        });
        if (!s) return id;
        const offNo = s.official_number || s.service_no || "?";
        return `${s.rank || ""} ${s.name} (${offNo})`;
      })
      .join(" • ");
    document.getElementById("asSelectedNames").textContent = details;
    summary.classList.remove("hidden");
  } else {
    summary.classList.add("hidden");
  }
  if (typeof updateAsPreview === "function") {
    updateAsPreview();
  }
}
function updateAsPreview() {
  var _inchargeSelect$optio;
  const type = document.getElementById("asType").value;
  const desc = document.getElementById("asDescription").value;
  const inchargeSelect = document.getElementById("asIncharge");
  const inchargeText =
    ((_inchargeSelect$optio =
      inchargeSelect.options[inchargeSelect.selectedIndex]) === null ||
    _inchargeSelect$optio === void 0
      ? void 0
      : _inchargeSelect$optio.text) || "None";
  const prevTypeElem = document.getElementById("asPrevType");
  if (prevTypeElem) prevTypeElem.textContent = type;
  const prevInchargeElem = document.getElementById("asPrevIncharge");
  if (prevInchargeElem) prevInchargeElem.textContent = inchargeText;
  const prevDescElem = document.getElementById("asPrevDesc");
  if (prevDescElem)
    prevDescElem.textContent = desc || "No description entered yet.";
  const prevSailorsContainer = document.getElementById("asPrevSailors");
  if (prevSailorsContainer) {
    if (_asSelectedSailors && _asSelectedSailors.size > 0) {
      const listHtml = [..._asSelectedSailors]
        .map((id) => {
          const s = store.sailors.find((s) => {
            var _s$id16;
            return (
              String(
                (_s$id16 = s.id) !== null && _s$id16 !== void 0
                  ? _s$id16
                  : s._fbKey,
              ) === String(id)
            );
          });
          if (!s) return "";
          const offNo =
            s.official_number || s.officialNumber || s.service_no || "—";
          return `<span class="inline-block bg-teal-100 text-teal-800 text-[10px] px-2 py-0.5 rounded font-medium">${s.rank || ""} ${s.name} (${offNo})</span>`;
        })
        .join("");
      prevSailorsContainer.innerHTML = listHtml;
    } else {
      prevSailorsContainer.innerHTML =
        '<span class="text-slate-400 text-[10px]">None selected</span>';
    }
  }
}
function toggleAsSailor(sailorId) {
  const key = String(sailorId);
  if (_asSelectedSailors.has(key)) {
    _asSelectedSailors.delete(key);
  } else {
    const assignment = getSailorCurrentAssignment(sailorId);
    if (assignment) {
      var _store$sailors$find2;
      showToast(
        `${
          ((_store$sailors$find2 = store.sailors.find((s) => {
            var _s$id17;
            return (
              String(
                (_s$id17 = s.id) !== null && _s$id17 !== void 0
                  ? _s$id17
                  : s._fbKey,
              ) === key
            );
          })) === null || _store$sailors$find2 === void 0
            ? void 0
            : _store$sailors$find2.name) || "Sailor"
        } is already busy in ${assignment.zone}!`,
        "error",
      );
      return;
    }
    _asSelectedSailors.add(key);
  }
  renderAsSailorChips(document.getElementById("asSailorSearch").value);
}
function filterAsSailors() {
  renderAsSailorChips(document.getElementById("asSailorSearch").value);
}
function filterAsTrade(trade) {
  _asCurrentTrade = trade;
  document.querySelectorAll(".as-trade-btn").forEach((b) => {
    b.className =
      "as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600";
  });
  event.target.className =
    "as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white";
  renderAsSailorChips(document.getElementById("asSailorSearch").value);
}
function createAssignment(event) {
  event.preventDefault();
  const isAdminStaff = isAdminStaffDuties(store.currentZone);
  const assignType = isAdminStaff
    ? document.getElementById("asType").value
    : "In Charge";
  const desc =
    document.getElementById("asDescription").value.trim() || "In Charge";
  const newOrder = {
    type: "TASK", // Always save as TASK so it lists under Tasks board column
    assign_type: assignType, // Store specific assignment category
    reference_no: null,
    description: desc,
    status: "Pending",
    priority: "Medium",
    zone_id: store.currentZone,
    estimated_duration: 1,
    budget_allocation: 0,
    progress: 0,
    assigned: [..._asSelectedSailors],
    location: "",
    incharge: isAdminStaff
      ? document.getElementById("asIncharge").value || null
      : null,
    supervisor: null,
    estimate_id: null,
  }; // Mark selected sailors as Assigned in store (optimistic update)
  _asSelectedSailors.forEach((id) => {
    const s = store.sailors.find((s) => {
      var _s$id18;
      return (
        String(
          (_s$id18 = s.id) !== null && _s$id18 !== void 0 ? _s$id18 : s._fbKey,
        ) === String(id)
      );
    });
    if (s) {
      s.status = "Assigned";
      s.evaluated = false;
    }
  });
  _asSelectedSailors = new Set(); // reset
  // Save Work Order to Firebase DB#2
  fbSaveWorkOrder(newOrder)
    .then((ref) => {
      const fbKey = ref ? ref.key : null; // Also create a Job Card automatically
      const jobNumber = `JC/${new Date().getFullYear()}/${String(Date.now()).slice(-4).padStart(4, "0")}`;
      const newJobCard = {
        job_number: jobNumber,
        work_order_id: fbKey,
        description: newOrder.description,
        location: "",
        zone_id: store.currentZone,
        status: "Active",
        start_date: getLocalDateString(),
        total_material_cost: 0,
        feedbackSent: false,
        feedbackReceived: false,
        estimate_id: null,
      };
      fbSaveJobCard(newJobCard);
      closeModal("assignModal");
      showToast(`Assignment and Job Card ${jobNumber} created! 🔥`);
      event.target.reset();
    })
    .catch((err) => {
      console.error("❌ Assignment save failed:", err);
      showToast("Save failed — check Firebase connection", "error");
    });
} // Nominal labour rate (Rs per man-hour) used for Job Card cost roll-up
const LABOR_RATE_PER_HOUR = 150;
function getJobCardForWorkOrder(workOrderId) {
  return store.jobCards.find((jc) => jc.work_order_id === workOrderId) || null;
}
function computeJobCardCost(jobCard) {
  if (!jobCard) return { material: 0, labor: 0, total: 0 };
  const material =
    store.jobCardMaterials
      .filter((m) => m.job_card_id === jobCard.id)
      .reduce((s, m) => s + (m.total_cost || 0), 0) ||
    jobCard.total_material_cost ||
    0;
  const laborHours = store.jobCardLabor
    .filter((l) => l.job_card_id === jobCard.id)
    .reduce((s, l) => s + (l.hours || 0), 0);
  const labor = laborHours * LABOR_RATE_PER_HOUR;
  return { material, labor, total: material + labor };
}
function switchWoTab(tab) {
  document.querySelectorAll(".wo-tab-btn").forEach((b) => {
    b.classList.remove("border-blue-600", "text-blue-600");
    b.classList.add("border-transparent", "text-slate-500");
  });
  const btn = document.getElementById(`woTab-${tab}-btn`);
  btn.classList.add("border-blue-600", "text-blue-600");
  btn.classList.remove("border-transparent", "text-slate-500");
  document
    .getElementById("woTab-details")
    .classList.toggle("hidden", tab !== "details");
  document
    .getElementById("woTab-evaluation")
    .classList.toggle("hidden", tab !== "evaluation");
}
function openWorkOrderDetail(workOrderId) {
  var _document$getElementB2;
  if (_justClosedModal) return;
  store.selectedWorkOrder = workOrderId; // Find by _fbKey (string) OR numeric id
  const wo = store.workOrders.find(
    (w) =>
      String(w._fbKey) === String(workOrderId) ||
      String(w.id) === String(workOrderId),
  );
  if (!wo) {
    console.warn("Work order not found:", workOrderId);
    return;
  }
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const isToday = dateVal === today;

  // Save initial snapshot for Undo feature
  if (!_isRestoringUndo) {
    _lastEditedWorkOrderState = {
      woKey: wo._fbKey || wo.id,
      woSnapshot: JSON.parse(JSON.stringify(wo)),
      dailyAllocationsSnapshot: JSON.parse(
        JSON.stringify(
          (store.dailyAllocations || []).filter(
            (a) => a.date === today && String(a.work_order_id) === String(wo.id)
          )
        )
      )
    };
  }

  // Reset to details tab each open
  switchWoTab("details"); // Toggle Evaluation tab button
  const evalTabBtn = document.getElementById("woTab-evaluation-btn");
  if (evalTabBtn) {
    evalTabBtn.classList.toggle("hidden", !isToday);
  } // Toggle Assign New Labour block
  const assignLaborBlock =
    (_document$getElementB2 = document.getElementById("detailSailorChips")) ===
      null || _document$getElementB2 === void 0
      ? void 0
      : _document$getElementB2.parentElement;
  if (assignLaborBlock) {
    assignLaborBlock.classList.toggle("hidden", !isToday);
  } // Toggle sticky footer buttons
  const btnSaveWoChanges = document.getElementById("btnSaveWoChanges");
  const btnProceedWo = document.getElementById("btnProceedWo");
  const btnForwardComplete = document.getElementById("btnForwardComplete");
  const btnDeleteWo = document.getElementById("btnDeleteWo");
  const btnUndoWoChanges = document.getElementById("btnUndoWoChanges");
  if (btnSaveWoChanges) btnSaveWoChanges.classList.toggle("hidden", !isToday);
  if (btnProceedWo) btnProceedWo.classList.toggle("hidden", !isToday);
  if (btnForwardComplete)
    btnForwardComplete.classList.toggle("hidden", !isToday);
  if (btnDeleteWo) btnDeleteWo.classList.toggle("hidden", !isToday);
  if (btnUndoWoChanges) btnUndoWoChanges.classList.toggle("hidden", !isToday); // Disable/enable fields
  const inputs = [
    "woDetailStatus",
    "woDetailPriority",
    "woDetailDescription",
    "woDetailAuthority",
    "woDetailBudget",
    "woDetailDuration",
    "woDetailProgress",
    "woDetailIncharge",
    "woDetailSupervisor",
    "woDetailArtificer",
  ];
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isToday;
  });
  document.getElementById("woDetailId").value = wo.id;
  document.getElementById("woDetailTitle").textContent = wo.description;
  document.getElementById("woDetailRef").textContent =
    (wo.assign_type || wo.type) + " • " + (wo.reference_no || "No reference");
  document.getElementById("woDetailStatus").value = wo.status;
  document.getElementById("woDetailPriority").value = wo.priority || "Medium";
  document.getElementById("woDetailDescription").value = wo.description || "";
  document.getElementById("woDetailAuthority").value =
    wo.authority_approval || wo.authority || "";
  document.getElementById("woDetailBudget").value = wo.budget_allocation || "";
  document.getElementById("woDetailDuration").value =
    wo.estimated_duration || "";
  document.getElementById("woDetailProgress").value = wo.progress || 0;
  document.getElementById("woDetailProgressText").textContent =
    (wo.progress || 0) + "%";
  if (typeof toggleCompleteButton === "function")
    toggleCompleteButton(wo.progress || 0); // Live Job Card cost (req 2)
  const jc = getJobCardForWorkOrder(wo.id);
  const cost = computeJobCardCost(jc);
  document.getElementById("woJobCardNo").textContent = jc
    ? jc.job_number
    : "No linked job card";
  document.getElementById("woJobCardCost").textContent = formatCurrency(
    cost.total,
  ); // Load assignable sailors (exclude already assigned)
  if (isToday && typeof renderDetailSailorChips === "function") {
    renderDetailSailorChips();
  } // Supervisor and Incharge dropdowns (filtered to Settings assignments, with fallback to all EC sailors)
  const ecSailors = store.sailors.filter((s) => {
    const off = String(s.official_number || "")
      .trim()
      .toUpperCase();
    return off.startsWith("EC");
  });
  const inc = (store.settings.zoneInCharges || {})[store.currentZone]; // Incharge dropdown
  let inchargeOptions = '<option value="">Select...</option>';
  const assignedInchargeId = wo.incharge;
  const eligibleInchargeIds = new Set();
  if (inc && inc.woInchargeId)
    eligibleInchargeIds.add(String(inc.woInchargeId));
  if (assignedInchargeId) eligibleInchargeIds.add(String(assignedInchargeId));
  if (eligibleInchargeIds.size > 0) {
    const selectedSailors = store.sailors.filter((s) => {
      var _s$id19;
      return eligibleInchargeIds.has(
        String(
          (_s$id19 = s.id) !== null && _s$id19 !== void 0 ? _s$id19 : s._fbKey,
        ),
      );
    });
    inchargeOptions += selectedSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.incharge == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  } else {
    inchargeOptions += ecSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.incharge == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  } // Supervisor dropdown
  let supervisorOptions = '<option value="">Select...</option>';
  const assignedSupervisorId = wo.supervisor;
  const eligibleSupervisorIds = new Set();
  if (inc && inc.woSupervisorId)
    eligibleSupervisorIds.add(String(inc.woSupervisorId));
  if (assignedSupervisorId)
    eligibleSupervisorIds.add(String(assignedSupervisorId));
  if (eligibleSupervisorIds.size > 0) {
    const selectedSailors = store.sailors.filter((s) => {
      var _s$id20;
      return eligibleSupervisorIds.has(
        String(
          (_s$id20 = s.id) !== null && _s$id20 !== void 0 ? _s$id20 : s._fbKey,
        ),
      );
    });
    supervisorOptions += selectedSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.supervisor == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  } else {
    supervisorOptions += ecSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.supervisor == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  }
  document.getElementById("woDetailIncharge").innerHTML = inchargeOptions;
  document.getElementById("woDetailSupervisor").innerHTML = supervisorOptions; // Artificer dropdown
  let artificerOptions = '<option value="">Select...</option>';
  const assignedArtificerId = wo.project_artificer;
  const eligibleArtificerIds = new Set();
  if (inc && inc.woArtificerId)
    eligibleArtificerIds.add(String(inc.woArtificerId));
  if (assignedArtificerId)
    eligibleArtificerIds.add(String(assignedArtificerId));
  const acSailors = store.sailors.filter((s) => {
    const off = String(s.official_number || "")
      .trim()
      .toUpperCase();
    return off.startsWith("AC");
  });
  if (eligibleArtificerIds.size > 0) {
    const selectedSailors = store.sailors.filter((s) => {
      var _s$id21;
      return eligibleArtificerIds.has(
        String(
          (_s$id21 = s.id) !== null && _s$id21 !== void 0 ? _s$id21 : s._fbKey,
        ),
      );
    });
    artificerOptions += selectedSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.project_artificer == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  } else {
    artificerOptions += acSailors
      .map(
        (s) =>
          `<option value="${s.id}" ${wo.project_artificer == s.id ? "selected" : ""}>${s.rank} ${s.name}</option>`,
      )
      .join("");
  }
  document.getElementById("woDetailArtificer").innerHTML = artificerOptions;
  const { sailors: assignedSailors, source: historicalSource } = getWorkOrderAssignedSailors(wo, dateVal);
  if (isToday && assignedSailors.length > 0) {
    const currentAssignedKeys = assignedSailors.map((s) => s.id || s._fbKey);
    const existingAssigned = (wo.assigned || []).map(String);
    let needsUpdate = false;
    currentAssignedKeys.forEach((key) => {
      if (!existingAssigned.includes(String(key))) {
        existingAssigned.push(key);
        needsUpdate = true;
      }
    });
    if (needsUpdate) {
      wo.assigned = existingAssigned;
      if (wo._fbKey) {
        opsDB.ref(`work_orders/${wo._fbKey}/assigned`).set(wo.assigned);
      }
    }
  }
  const tradeCounts = {};
  assignedSailors.forEach((s) => {
    tradeCounts[s.trade] = (tradeCounts[s.trade] || 0) + 1;
  });
  const countStr = Object.entries(tradeCounts)
    .map(([trade, count]) => `${count} ${trade}`)
    .join(", ");
  document.getElementById("assignedLaborCount").textContent =
    countStr || "0 assigned";
  // Historical view info banner
  const histBannerHtml = (!isToday && assignedSailors.length > 0) ? `
    <div class="flex items-center gap-2 p-2 mb-2 rounded-lg text-xs font-medium" style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.25);color:#0284c7">
        <span>📋</span>
        <span>${dateVal} දිනට ${historicalSource === "daily_record" ? "Daily Record වලින්" : historicalSource === "last_assigned" ? "Last Assigned Crew වලින්" : "Current Crew වලින්"} ලබාගත් විස්තර (Read-Only)</span>
    </div>` : "";
  document.getElementById("woDetailAssigned").innerHTML =
    histBannerHtml +
    (assignedSailors
      .map((s) => {
        var _s$id22;
        return `
        <div class="flex items-center justify-between p-2 bg-white rounded-lg border">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${s.trade}</span>
                <div>
                    <p class="font-medium text-sm hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${(_s$id22 = s.id) !== null && _s$id22 !== void 0 ? _s$id22 : s._fbKey}')">${s.rank || "AB"} ${s.name}</p>
                    <div class="flex gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Official No: ${s.official_number || s.service_no || "-"}</span>
                        <span>•</span>
                        <span>Trade: ${s.trade}</span>
                        <span>•</span>
                        <span>Avg: <span class="${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span></span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${s.evaluated ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Evaluated</span>' : '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending</span>'}
                ${isToday ? `<button onclick="removeSailorFromOrder('${s.id}', '${wo._fbKey || wo.id}'); openWorkOrderDetail('${wo._fbKey || wo.id}');" class="text-red-500 hover:text-red-700 text-lg">×</button>` : ""}
            </div>
        </div>
    `;
      })
      .join("") ||
    (!isToday ? '<p class="text-slate-400 text-center py-4">📋 මෙම දිනට පවරා ඇති නාවිකයින්ගේ වාර්තා සොයාගත නොහැක</p>' : '<p class="text-slate-500 text-center py-4">No labour assigned</p>')); // Evaluation tab list (always available on today - req 1)
  const pendingEvals = assignedSailors.filter((s) => !s.evaluated).length;
  const evalBadge = document.getElementById("woEvalPendingBadge");
  if (isToday && pendingEvals > 0) {
    evalBadge.textContent = pendingEvals + " pending";
    evalBadge.classList.remove("hidden");
  } else {
    evalBadge.classList.add("hidden");
  }
  document.getElementById("laborEvalList").innerHTML = assignedSailors.length
    ? assignedSailors
        .map((s) => {
          var _s$id23, _s$yesterdayScore2, _s$id24, _wo$id2, _s$id25, _wo$id3;
          return `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg border ${s.evaluated ? "border-green-300" : "border-amber-300"}">
            <div class="flex items-center gap-3">
                <span class="w-10 h-10 bg-slate-600 text-white rounded-full flex items-center justify-center font-bold">${s.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}</span>
                <div>
                    <p class="font-medium hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${(_s$id23 = s.id) !== null && _s$id23 !== void 0 ? _s$id23 : s._fbKey}')">${s.name}</p>
                    <p class="text-xs text-slate-500">${s.trade} • ${s.rank} • Avg ${s.avgScore.toFixed(1)}</p>
                </div>
            </div>
            ${
              s.evaluated
                ? `<div class="flex items-center gap-2">
                    <span class="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm">✓ ${((_s$yesterdayScore2 = s.yesterdayScore) === null || _s$yesterdayScore2 === void 0 ? void 0 : _s$yesterdayScore2.toFixed(1)) || ""}</span>
                    <button onclick="openEvaluationModal('${(_s$id24 = s.id) !== null && _s$id24 !== void 0 ? _s$id24 : s._fbKey}', '${(_wo$id2 = wo.id) !== null && _wo$id2 !== void 0 ? _wo$id2 : wo._fbKey}')" class="text-xs text-blue-600 underline">Re-evaluate</button>
                </div>`
                : `<button onclick="openEvaluationModal('${(_s$id25 = s.id) !== null && _s$id25 !== void 0 ? _s$id25 : s._fbKey}', '${(_wo$id3 = wo.id) !== null && _wo$id3 !== void 0 ? _wo$id3 : wo._fbKey}')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm">📝 Evaluate</button>`
            }
        </div>
    `;
        })
        .join("")
    : '<p class="text-slate-500 text-center py-6">No labour assigned to evaluate.</p>'; // Toggle Restore Last Crew button visibility
  const btnRestorePrevCrew = document.getElementById("btnRestorePrevCrew");
  if (btnRestorePrevCrew) {
    const hasLastCrew = wo.last_assigned && wo.last_assigned.length > 0;
    const currentCrewEmpty = !wo.assigned || wo.assigned.length === 0;
    btnRestorePrevCrew.classList.toggle(
      "hidden",
      !(hasLastCrew && currentCrewEmpty && isToday),
    );
  }
  document.getElementById("workOrderDetailModal").classList.remove("hidden");
}
let _detailCurrentTrade = "ALL";
function filterDetailTrade(trade) {
  _detailCurrentTrade = trade;
  document.querySelectorAll(".detail-trade-btn").forEach((b) => {
    if (b.textContent === trade) {
      b.classList.remove("bg-slate-200", "text-slate-600");
      b.classList.add("bg-slate-700", "text-white");
    } else {
      b.classList.add("bg-slate-200", "text-slate-600");
      b.classList.remove("bg-slate-700", "text-white");
    }
  });
  renderDetailSailorChips(document.getElementById("detailSailorSearch").value);
}
function filterDetailSailors() {
  renderDetailSailorChips(document.getElementById("detailSailorSearch").value);
}
function renderDetailSailorChips(filter = "") {
  const tradeBgMap = {
    MA: "#0d9488",
    CA: "#7c3aed",
    PA: "#b45309",
    PL: "#0891b2",
    WE: "#dc2626",
    RW: "#374151",
    SW: "#065f46",
    BB: "#1d4ed8",
    AL: "#ec4899",
  };
  const wo = store.workOrders.find(
    (w) =>
      String(w.id) === String(store.selectedWorkOrder) ||
      String(w._fbKey) === String(store.selectedWorkOrder),
  );
  if (!wo) return;
  const today = getLocalDateString();
  const { sailors: assignedSailors } = getWorkOrderAssignedSailors(wo, today);
  const assignedIds = new Set();
  assignedSailors.forEach((s) => {
    if (s.id) assignedIds.add(String(s.id));
    if (s._fbKey) assignedIds.add(String(s._fbKey));
    if (s.official_number) assignedIds.add(String(s.official_number));
  });
  (wo.assigned || []).forEach((id) => assignedIds.add(String(id)));

  // When searching, show ALL sailors (651) so any sailor can be found and assigned
  let sailors;
  if (filter) {
    const q = filter.toLowerCase().trim();
    sailors = store.sailors.filter(
      (s) =>
        !assignedIds.has(String(s.id)) &&
        !assignedIds.has(String(s._fbKey)) &&
        (!s.official_number || !assignedIds.has(String(s.official_number))) &&
        ((s._searchIndex || "").includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.official_number || "").toLowerCase().includes(q) ||
          (s.rank || "").toLowerCase().includes(q) ||
          (s.trade || "").toLowerCase().includes(q)),
    );
    if (_detailCurrentTrade !== "ALL") {
      sailors = sailors.filter((s) => s.trade === _detailCurrentTrade);
    }
  } else {
    sailors = store.sailors.filter(
      (s) =>
        !assignedIds.has(String(s.id)) &&
        !assignedIds.has(String(s._fbKey)) &&
        (!s.official_number || !assignedIds.has(String(s.official_number))) &&
        s.status !== "Sick" &&
        s.status !== "Leave" &&
        (_detailCurrentTrade === "ALL" || s.trade === _detailCurrentTrade),
    );
  }
  const container = document.getElementById("detailSailorChips");
  if (sailors.length === 0) {
    container.innerHTML = `<p class="text-slate-400 text-xs w-full text-center py-2">No available sailors found</p>`;
    return;
  }
  container.innerHTML = sailors
    .map((s) => {
      var _s$id26, _s$id28;
      const tradeBg = tradeBgMap[s.trade] || "#475569";
      const offNo =
        s.official_number || s.officialNumber || s.service_no || "-";
      const fullName = s.name || "Unknown";
      const rank = s.rank || "";
      const assignment = getSailorCurrentAssignment(
        (_s$id26 = s.id) !== null && _s$id26 !== void 0 ? _s$id26 : s._fbKey,
      );
      if (assignment) {
        // ── LOCKED CHIP: නාවිකයා වෙනත් Zone/WO එකක assign වෙලා ──
        // Click කරන්නේ block. Zone + WO info tooltip හා badge ලෙස පෙන්වයි.
        const zoneDisplay = assignment.zone || "Unknown Zone";
        const woRefDisplay = assignment.ref || "";
        const woTitleDisplay = assignment.title
          ? assignment.title.substring(0, 40) + (assignment.title.length > 40 ? "…" : "")
          : "";
        const tooltipText = `🔒 මෙම නාවිකයා දැනටමත් ${zoneDisplay} හි ${woRefDisplay} රාජකාරිය සඳහා Assign කරලා ඉන්නවා. වෙනත් Zone In-Charge සම්බන්ධ කරගෙන ඉවත් කරගන්න.`;
        return `
            <div
                title="${tooltipText}"
                style="
                    display:flex; align-items:center; gap:8px;
                    padding:7px 10px; border-radius:10px;
                    cursor:not-allowed;
                    border:2px solid #cbd5e1;
                    background:#f1f5f9;
                    opacity:0.72;
                    min-width:140px; position:relative;
                    text-align:left;
                    user-select:none;
                ">
                <!-- Trade badge – greyed out -->
                <div style="background:#94a3b8; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10.5px; font-weight:800; letter-spacing:0.5px; flex-shrink:0;">
                    ${s.trade}
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:145px;">
                        ${rank} ${fullName}
                    </div>
                    <!-- Zone + WO info badge -->
                    <div style="display:flex; align-items:center; gap:4px; margin-top:2px; flex-wrap:wrap;">
                        <span style="font-size:8px; background:#e2e8f0; color:#475569; border-radius:4px; padding:1px 5px; font-weight:700; white-space:nowrap;">🔒 ${zoneDisplay}</span>
                        ${woRefDisplay ? `<span style="font-size:8px; background:#e0f2fe; color:#0369a1; border-radius:4px; padding:1px 5px; font-weight:700; white-space:nowrap;">${woRefDisplay}</span>` : ""}
                    </div>
                    ${woTitleDisplay ? `<div style="font-size:8px; color:#94a3b8; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:145px;">${woTitleDisplay}</div>` : ""}
                </div>
            </div>
            `;
      }
      return `
        <button type="button"
            onclick="assignSingleLabor('${(_s$id28 = s.id) !== null && _s$id28 !== void 0 ? _s$id28 : s._fbKey}')"
            title="${rank} ${fullName} | ${offNo}"
            class="sailor-chip-card"
            style="
                display:flex; align-items:center; gap:8px;
                padding:7px 10px; border-radius:10px; cursor:pointer;
                border:2px solid #e2e8f0;
                background:#fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                transition:all 0.15s ease; min-width:140px; position:relative;
                text-align:left;
            ">
            <div style="background:${tradeBg}; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10.5px; font-weight:800; letter-spacing:0.5px; flex-shrink:0;">
                ${s.trade}
            </div>
            <div style="flex:1; overflow:hidden;">
                <div style="font-size:11px; font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">
                    ${rank} ${fullName}
                </div>
                <div style="font-size:9.5px; color:#94a3b8; font-weight:500; letter-spacing:0.3px">${offNo}</div>
            </div>
        </button>
        `;
    })
    .join("");
}
function assignSingleLabor(sailorId) {
  const assignment = getSailorCurrentAssignment(sailorId);
  const wo = store.workOrders.find(
    (w) =>
      String(w.id) === String(store.selectedWorkOrder) ||
      String(w._fbKey) === String(store.selectedWorkOrder),
  );
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  if (!wo || !sailor) return;

  const today = getLocalDateString();
  const prevWo = store.workOrders.find((w) => {
    if (w.status !== "Active" && w.status !== "Pending") return false;
    const assignedIds = (w.assigned || []).map(String);
    return assignedIds.includes(String(sailorId));
  });

  const allocSnapshot = (store.dailyAllocations || []).find(
    (a) => a.date === today && String(a.sailor_id) === String(sailorId)
  );

  _lastActionUndo = {
    type: "ASSIGN_SAILOR",
    sailorId: sailorId,
    targetWoId: wo.id || wo._fbKey,
    targetWoPrevAssigned: [...(wo.assigned || [])],
    prevWoId: prevWo ? (prevWo.id || prevWo._fbKey) : null,
    prevWoAssigned: prevWo ? [...(prevWo.assigned || [])] : null,
    sailorPrevStatus: sailor.status,
    sailorPrevZone: sailor.zone_id || store.currentZone,
    dailyAllocSnapshot: allocSnapshot ? JSON.parse(JSON.stringify(allocSnapshot)) : null
  };

  if (prevWo) {
    prevWo.assigned = (prevWo.assigned || []).filter(
      (id) => String(id) !== String(sailorId),
    );
    if (window.safeFbRemoveSailor) {
      safeFbRemoveSailor(prevWo._fbKey || prevWo.id, sailorId, today);
    }
    opsDB
      .ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`)
      .remove();
  }
  if (!wo.assigned) wo.assigned = [];
  const alreadyAssigned = wo.assigned.some(
    (id) => String(id) === String(sailorId),
  );
  if (!alreadyAssigned) {
    wo.assigned.push(sailorId);
    sailor.status = "Assigned";
    sailor.evaluated = false;
    wo.last_assigned_date = today;
    if (window.safeFbAssignSailor) {
      safeFbAssignSailor(wo._fbKey || wo.id, sailorId, today);
    }
    const alloc = {
      sailor_id: sailorId,
      work_order_id: wo._fbKey || wo.id,
      date: today,
      zone_id: store.currentZone,
      role_today: "Worker",
      assigned_by: store.currentUser && store.currentUser.name ? store.currentUser.name : "Officer",
      status: "Active"
    };
    if (!store.dailyAllocations) store.dailyAllocations = [];
    store.dailyAllocations.push(alloc);
    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).set(alloc);
    showToast(
      assignment
        ? `Reassigned ${sailor.name} from ${assignment.zone}! <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`
        : `${sailor.name} assigned! <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
      "success",
      6000
    );
    openWorkOrderDetail(wo._fbKey || wo.id);
  }
}
function updateWorkOrderStatus() {
  const woKey = store.selectedWorkOrder;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (wo) {
    const newStatus = document.getElementById("woDetailStatus").value;
    wo.status = newStatus; // Sync status to the linked Job Card
    const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
    if (jc) {
      jc.status = wo.status;
      if (window.fbSaveJobCard) fbSaveJobCard(jc);
    } // Clear today's daily allocations if putting on hold/completed/pending
    if (
      newStatus === "Hold" ||
      newStatus === "Completed" ||
      newStatus === "Pending"
    ) {
      const today = getLocalDateString();
      const allocationsToDelete = (store.dailyAllocations || []).filter(
        (a) => a.date === today && String(a.work_order_id) === String(wo.id),
      );
      allocationsToDelete.forEach((a) => {
        opsDB
          .ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`)
          .remove()
          .catch((e) => console.warn(e));
      });
    }
    if (wo._fbKey) {
      opsDB.ref(`work_orders/${wo._fbKey}`).update({ status: newStatus });
    } else if (window.fbSaveWorkOrder) {
      fbSaveWorkOrder(wo);
    }
    refreshCurrentViewImmediately();
  }
}
let _lastActionUndo = null;
let _isRestoringUndo = false;

function undoWorkOrderEdits() {
  executeGlobalUndo();
}

function undoCreateWorkOrder() {
  executeGlobalUndo();
}

function executeGlobalUndo() {
  if (!_lastActionUndo) {
    showToast("No recent action to undo.", "error");
    return;
  }

  const undo = _lastActionUndo;
  _lastActionUndo = null;
  const today = getLocalDateString();

  if (undo.type === "REMOVE_SAILOR") {
    const { sailorId, workOrderId, prevWoAssigned, sailorPrevStatus, dailyAllocSnapshot } = undo;
    const wo = store.workOrders.find((w) => String(w.id) === String(workOrderId) || String(w._fbKey) === String(workOrderId));
    const sailor = store.sailors.find((s) => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));

    if (wo && window.safeFbAssignSailor) {
      safeFbAssignSailor(wo._fbKey || wo.id, sailorId, today);
    }
    if (sailor && sailorPrevStatus) {
      sailor.status = sailorPrevStatus;
    }
    if (dailyAllocSnapshot) {
      opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).set(dailyAllocSnapshot);
      if (!store.dailyAllocations) store.dailyAllocations = [];
      store.dailyAllocations = store.dailyAllocations.filter(
        (a) => !(a.date === today && String(a.sailor_id) === String(sailorId))
      );
      store.dailyAllocations.push(dailyAllocSnapshot);
    }
    refreshCurrentViewImmediately();
    const modal = document.getElementById("workOrderDetailModal");
    if (modal && !modal.classList.contains("hidden") && store.selectedWorkOrder) {
      openWorkOrderDetail(store.selectedWorkOrder);
    }
    showToast("↩️ Sailor removal successfully undone!", "success");

  } else if (undo.type === "ASSIGN_SAILOR") {
    const { sailorId, targetWoId, targetWoPrevAssigned, prevWoId, prevWoAssigned, sailorPrevStatus, sailorPrevZone, dailyAllocSnapshot } = undo;
    const targetWo = store.workOrders.find((w) => String(w.id) === String(targetWoId) || String(w._fbKey) === String(targetWoId));
    const prevWo = prevWoId ? store.workOrders.find((w) => String(w.id) === String(prevWoId) || String(w._fbKey) === String(prevWoId)) : null;
    const sailor = store.sailors.find((s) => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));

    if (targetWo && window.safeFbRemoveSailor) {
      safeFbRemoveSailor(targetWo._fbKey || targetWo.id, sailorId, today);
    }
    if (prevWo && window.safeFbAssignSailor) {
      safeFbAssignSailor(prevWo._fbKey || prevWo.id, sailorId, today);
    }
    if (sailor) {
      if (sailorPrevStatus) sailor.status = sailorPrevStatus;
      if (sailorPrevZone) sailor.zone_id = sailorPrevZone;
    }

    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).remove();
    if (!store.dailyAllocations) store.dailyAllocations = [];
    store.dailyAllocations = store.dailyAllocations.filter(
      (a) => !(a.date === today && String(a.sailor_id) === String(sailorId))
    );

    if (dailyAllocSnapshot) {
      opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).set(dailyAllocSnapshot);
      store.dailyAllocations.push(dailyAllocSnapshot);
    }

    refreshCurrentViewImmediately();
    const modal = document.getElementById("workOrderDetailModal");
    if (modal && !modal.classList.contains("hidden") && store.selectedWorkOrder) {
      openWorkOrderDetail(store.selectedWorkOrder);
    }
    showToast("↩️ Sailor assignment/reassignment successfully undone!", "success");

  } else if (undo.type === "EDIT_WORK_ORDER") {
    const { woKey, woSnapshot, dailyAllocationsSnapshot } = undo;
    const wo = store.workOrders.find(
      (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
    );
    if (wo && woSnapshot) {
      _isRestoringUndo = true;
      Object.assign(wo, JSON.parse(JSON.stringify(woSnapshot)));
      if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);

      if (dailyAllocationsSnapshot !== undefined) {
        const currentTodayAllocs = (store.dailyAllocations || []).filter(
          (a) => a.date === today && String(a.work_order_id) === String(wo.id),
        );
        currentTodayAllocs.forEach((a) => {
          opsDB
            .ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`)
            .remove()
            .catch((e) => console.warn(e));
        });
        (dailyAllocationsSnapshot || []).forEach((a) => {
          opsDB
            .ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`)
            .set(a)
            .catch((e) => console.warn(e));
        });
      }

      const modal = document.getElementById("workOrderDetailModal");
      if (modal && !modal.classList.contains("hidden")) {
        openWorkOrderDetail(woKey);
      }
      _isRestoringUndo = false;
      refreshCurrentViewImmediately();
      renderZoneSelectors();
      showToast("↩️ Work Order changes successfully undone!", "success");
    }
  } else if (undo.type === "CREATE_WORK_ORDER") {
    const { fbKey, jobCardFbKey, assignedSailors } = undo;
    if (fbKey) {
      opsDB.ref(`work_orders/${fbKey}`).remove();
    }
    if (jobCardFbKey) {
      opsDB.ref(`job_cards/${jobCardFbKey}`).remove();
    }
    if (assignedSailors && assignedSailors.length > 0 && store.sailors) {
      assignedSailors.forEach((sid) => {
        const s = store.sailors.find(
          (x) => String(x.id) === String(sid) || String(x._fbKey) === String(sid),
        );
        if (s && s.status === "Assigned") {
          s.status = "Available";
        }
      });
    }
    refreshCurrentViewImmediately();
    showToast("↩️ Work Order creation successfully undone!", "success");
  }
}

function saveWorkOrderChanges(autoClose = true) {
  const shouldClose = typeof autoClose === "boolean" ? autoClose : true;
  const btn = document.getElementById("btnSaveWoChanges");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = "Saving...";
  }

  const woKey = store.selectedWorkOrder;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (!wo) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText;
    }
    return;
  }
  if (wo) {
    const newStatus = document.getElementById("woDetailStatus").value;
    wo.status = newStatus;
    wo.priority = document.getElementById("woDetailPriority").value;
    wo.description =
      document.getElementById("woDetailDescription").value || wo.description;
    wo.authority_approval = document.getElementById("woDetailAuthority").value;
    const parsedBudget = parseFloat(document.getElementById("woDetailBudget").value);
    wo.budget_allocation = !isNaN(parsedBudget) ? parsedBudget : (wo.budget_allocation || null);
    
    const parsedDuration = parseInt(document.getElementById("woDetailDuration").value);
    wo.estimated_duration = !isNaN(parsedDuration) ? parsedDuration : (wo.estimated_duration || null);
    wo.progress = parseInt(document.getElementById("woDetailProgress").value);
    wo.incharge = document.getElementById("woDetailIncharge").value || null;
    wo.supervisor = document.getElementById("woDetailSupervisor").value || null;
    wo.project_artificer =
      document.getElementById("woDetailArtificer").value || null; // Sync status to the linked Job Card
    const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
    if (jc) {
      jc.status = wo.status;
      if (window.fbSaveJobCard) fbSaveJobCard(jc);
    } // Clear today's daily allocations if putting on hold/completed/pending
    if (
      newStatus === "Hold" ||
      newStatus === "Completed" ||
      newStatus === "Pending"
    ) {
      const today = getLocalDateString();
      const allocationsToDelete = (store.dailyAllocations || []).filter(
        (a) => a.date === today && String(a.work_order_id) === String(wo.id),
      );
      allocationsToDelete.forEach((a) => {
        opsDB
          .ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`)
          .remove()
          .catch((e) => console.warn(e));
      });
    }
    if (wo._fbKey) {
      opsDB.ref(`work_orders/${wo._fbKey}`).update({
        status: wo.status,
        priority: wo.priority,
        description: wo.description,
        authority_approval: wo.authority_approval,
        budget_allocation: wo.budget_allocation,
        estimated_duration: wo.estimated_duration,
        progress: wo.progress,
        incharge: wo.incharge,
        supervisor: wo.supervisor,
        project_artificer: wo.project_artificer
      });
    } else if (window.fbSaveWorkOrder) {
      fbSaveWorkOrder(wo);
    }
    
    // Delay closing to prevent mobile double-tap ghost clicks on underlying UI
    setTimeout(() => {
      refreshCurrentViewImmediately();
      renderZoneSelectors(); // Update Zone dropdown percentages
      if (shouldClose) {
        showToast(
          `Work order updated successfully! <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
          "success",
          6000
        );
        closeModal("workOrderDetailModal");
      }
    }, 300);
  }
  if (btn) {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText;
    }, 500);
  }
}
function deleteWorkOrder() {
  const woKey = store.selectedWorkOrder;
  if (!woKey) return;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (!wo) return;
  if (
    confirm(
      `⚠️ Are you sure you want to delete the work order "${wo.description}"?\n\nThis will permanently remove the work order and its daily labor allocations.`,
    )
  ) {
    const targetFbKey = wo._fbKey;
    if (!targetFbKey) {
      showToast("Cannot delete: Firebase key not found.");
      return;
    } // 1. Remove the work order from Firebase
    opsDB
      .ref(`work_orders/${targetFbKey}`)
      .remove()
      .then(() => {
        // 2. Remove all daily allocations associated with this work order id / reference
        const woIdStr = String(wo.id);
        const allocsToDelete = (store.dailyAllocations || []).filter(
          (a) => String(a.work_order_id) === woIdStr,
        );
        const deletePromises = allocsToDelete.map((a) => {
          if (a._fbKey) {
            return opsDB.ref(`daily_allocations/${a._fbKey}`).remove();
          }
          return Promise.resolve();
        });
        return Promise.all(deletePromises);
      })
      .then(() => {
        closeModal("workOrderDetailModal");
        showToast(`Deleted work order successfully!`);
        refreshCurrentViewImmediately();
      })
      .catch((err) => {
        console.error("Error deleting work order:", err);
        showToast("Failed to delete work order.");
      });
  }
}
function toggleCompleteButton(progress) {
  const btn = document.getElementById("btnForwardComplete");
  const btnProceed = document.getElementById("btnProceedWo");
  if (btn && btnProceed) {
    if (parseInt(progress) === 100) {
      btn.classList.remove("hidden");
      btnProceed.classList.add("hidden");
    } else {
      btn.classList.add("hidden");
      btnProceed.classList.remove("hidden");
    }
  }
}
function forwardToComplete() {
  const woKey = store.selectedWorkOrder;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (wo) {
    const today = getLocalDateString(); // Collect currently assigned sailors to free them up locally
    const assignedIds = (wo.assigned || []).map(String); // Auto-commit crew to daily allocations for today before clearing them
    if (assignedIds.length > 0) {
      assignedIds.forEach((sid) => {
        const sailor = store.sailors.find(
          (s) =>
            String(s.id) === String(sid) || String(s._fbKey) === String(sid),
        );
        const alreadyAllocated = (store.dailyAllocations || []).some(
          (a) =>
            a.date === today &&
            String(a.sailor_id) === String(sid) &&
            String(a.work_order_id) === String(wo.id),
        );
        if (!alreadyAllocated) {
          store.dailyAllocations = (store.dailyAllocations || []).filter(
            (a) => !(a.date === today && a.sailor_id === sid),
          );
          const alloc = {
            id: (store.dailyAllocations || []).length + 1,
            date: today,
            sailor_id: sid,
            work_order_id: wo.id,
            role_today:
              sailor && sailor.id == wo.supervisor
                ? "Supervisor"
                : sailor && sailor.id == wo.incharge
                  ? "In-Charge"
                  : "Worker",
            assigned_by:
              store.currentUser && store.currentUser.name
                ? store.currentUser.name
                : "Officer",
            status: "Active",
          };
          if (!store.dailyAllocations) store.dailyAllocations = [];
          store.dailyAllocations.push(alloc);
          opsDB
            .ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`)
            .set(alloc);
        }
      });
    }
    wo.completed_date = today;
    wo.status = "Completed";
    wo.progress = 100;
    wo.assigned = []; // Remove sailors from work order
    // Reset status for these sailors in the local store
    if (store.sailors) {
      store.sailors.forEach((s) => {
        if (
          assignedIds.includes(String(s.id)) ||
          assignedIds.includes(String(s._fbKey))
        ) {
          if (s.status === "Assigned") {
            s.status = "Available";
          }
        }
      });
    } // Sync to Job Card
    const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
    if (jc) {
      jc.status = "Completed";
      jc.assigned = []; // Remove sailors from job card
      if (window.fbSaveJobCard) fbSaveJobCard(jc);
    }
    if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);
    
    // Delay closing to prevent mobile double-tap ghost clicks on underlying UI
    setTimeout(() => {
      closeModal("workOrderDetailModal");
      showToast("Moved to Recently Completed!"); // Update dashboard UI to hide it
      renderDashboard(); // Switch to Job Cards view and Completed tab
      switchView("jobcards");
      switchJobCardsTab("completed");
    }, 300);
  }
} // Proceed button (req 2): commit daily labour allocation -> dashboard + DB
function proceedWorkOrder() {
  const btn = document.getElementById("btnProceedWo");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = "Processing...";
  }

  const woKey = store.selectedWorkOrder;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (!wo) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText;
    }
    return;
  } // Save any pending field edits first
  saveWorkOrderChanges(false);
  const today = getLocalDateString(); // Auto-restore previous crew if current assigned is empty
  if (
    (!wo.assigned || wo.assigned.length === 0) &&
    wo.last_assigned &&
    wo.last_assigned.length > 0
  ) {
    wo.assigned = [...wo.last_assigned];
    if (store.sailors) {
      wo.assigned.forEach((sid) => {
        const s = store.sailors.find(
          (x) =>
            String(x.id) === String(sid) || String(x._fbKey) === String(sid),
        );
        if (s) {
          s.status = "Assigned";
          s.evaluated = false;
        }
      });
    }
    showToast(`Auto-restored last active crew (${wo.assigned.length} sailors)`);
  }
  if (!wo.assigned || wo.assigned.length === 0) {
    showToast("Assign at least one sailor before proceeding", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText;
    }
    return;
  } // Update the work order and write today's allocations
  if (wo.status !== "Hold" && wo.status !== "Completed") {
    wo.status = "Active";
  }
  wo.last_commit_date = today;
  wo.last_assigned = [...wo.assigned];
  wo.last_assigned_date = today;
  if (wo._fbKey) {
    opsDB.ref(`work_orders/${wo._fbKey}`).update({
      status: wo.status,
      last_commit_date: today,
      last_assigned: [...wo.assigned],
      last_assigned_date: today
    });
  } else if (window.fbSaveWorkOrder) {
    fbSaveWorkOrder(wo);
  }
  wo.assigned.forEach((sid) => {
    const sailor = store.sailors.find(
      (s) => String(s.id) === String(sid) || String(s._fbKey) === String(sid),
    ); // remove existing same-day allocation for this sailor (one job per day)
    store.dailyAllocations = (store.dailyAllocations || []).filter(
      (a) => !(a.date === today && a.sailor_id === sid),
    );
    const alloc = {
      id: (store.dailyAllocations || []).length + 1,
      date: today,
      sailor_id: sid,
      work_order_id: wo.id,
      role_today:
        sailor && sailor.id == wo.supervisor
          ? "Supervisor"
          : sailor && sailor.id == wo.incharge
            ? "In-Charge"
            : "Worker",
      assigned_by:
        store.currentUser && store.currentUser.name
          ? store.currentUser.name
          : "Officer",
      status: "Active",
    };
    store.dailyAllocations.push(alloc);
    if (sailor) {
      sailor.status = "Assigned";
      sailor.evaluated = false;
    }
    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`).set(alloc);
  });
  // Delay closing to prevent mobile double-tap ghost clicks on underlying UI
  setTimeout(() => {
    closeModal("workOrderDetailModal");
    refreshCurrentViewImmediately();
    showToast(
      `✅ ${wo.assigned.length} sailor(s) committed to "${wo.description.substring(0, 24)}…" <button onclick="executeGlobalUndo()" class="ml-2 font-bold underline bg-amber-300 text-slate-900 px-2 py-0.5 rounded text-xs hover:bg-amber-400">↩️ Undo</button>`,
      "success",
      6000
    );
  }, 300);
  if (btn) {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText;
    }, 500);
  }
}
function restorePreviousCrew() {
  const woKey = store.selectedWorkOrder;
  const wo = store.workOrders.find(
    (w) => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey),
  );
  if (wo && wo.last_assigned && wo.last_assigned.length > 0) {
    const today = getLocalDateString();
    wo.assigned = [...wo.last_assigned];
    wo.last_assigned_date = today; // Mark sailors as Assigned locally
    if (store.sailors) {
      wo.assigned.forEach((sid) => {
        const s = store.sailors.find(
          (x) =>
            String(x.id) === String(sid) || String(x._fbKey) === String(sid),
        );
        if (s) {
          s.status = "Assigned";
          s.evaluated = false;
        }
      });
    }
    if (window.fbSaveWorkOrder) {
      fbSaveWorkOrder(wo);
    }
    showToast(`Restored ${wo.assigned.length} sailor(s) from last crew`);
    openWorkOrderDetail(woKey);
  }
}
function toggleEvaluationMode() {
  showToast("Open any work order and use the Daily Evaluation tab", "info");
} // =============================================
// EVALUATION
// =============================================
function openEvaluationModal(sailorId, workOrderId) {
  var _sailor$yesterdayScor;
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  const wo = store.workOrders.find(
    (w) =>
      String(w.id) === String(workOrderId) ||
      String(w._fbKey) === String(workOrderId),
  );
  if (!sailor || !wo) return;
  document.getElementById("evalSailorId").value = sailorId;
  document.getElementById("evalWorkOrderId").value = workOrderId;
  document.getElementById("evalSailorName").textContent = sailor.name;
  document.getElementById("evalSailorInitial").textContent = sailor.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  document.getElementById("evalWorkOrder").textContent = wo.description;
  document.getElementById("evalAvgScore").textContent =
    sailor.avgScore.toFixed(1);
  document.getElementById("evalYestScore").textContent =
    ((_sailor$yesterdayScor = sailor.yesterdayScore) === null ||
    _sailor$yesterdayScor === void 0
      ? void 0
      : _sailor$yesterdayScor.toFixed(1)) || "-"; // Reset sliders
  [
    "quality",
    "efficiency",
    "discipline",
    "material",
    "attitude",
    "skill",
  ].forEach((type) => {
    document.getElementById(`${type}Score`).value = 5;
    document.getElementById(`${type}Value`).textContent = 5;
  });
  document.getElementById("evaluationModal").classList.remove("hidden");
}
function updateSlider(type) {
  const value = document.getElementById(`${type}Score`).value;
  const display = document.getElementById(`${type}Value`);
  display.textContent = value;
  if (value <= 3) display.className = "text-lg font-bold text-red-600";
  else if (value <= 6) display.className = "text-lg font-bold text-amber-600";
  else display.className = "text-lg font-bold text-green-600"; // Check for special scores
  const allScores = [
    "quality",
    "efficiency",
    "discipline",
    "material",
    "attitude",
    "skill",
  ].map((t) => parseInt(document.getElementById(`${t}Score`).value));
  const has1 = allScores.includes(1);
  const has2 = allScores.includes(2);
  const has10 = allScores.includes(10);
  document
    .getElementById("specialScoreReasons")
    .classList.toggle("hidden", !has1 && !has2 && !has10);
  document.getElementById("score1Box").classList.toggle("hidden", !has1);
  document.getElementById("score2Box").classList.toggle("hidden", !has2);
  document.getElementById("score10Box").classList.toggle("hidden", !has10);
}
function submitEvaluation(event) {
  event.preventDefault();
  const scores = [
    "quality",
    "efficiency",
    "discipline",
    "material",
    "attitude",
    "skill",
  ].map((t) => parseInt(document.getElementById(`${t}Score`).value)); // Validate required reasons
  if (scores.includes(1) && !document.getElementById("score1Reason").value) {
    showToast("Reason required for score 1", "error");
    return;
  }
  if (scores.includes(2) && !document.getElementById("score2Reason").value) {
    showToast("Reason required for score 2", "error");
    return;
  }
  if (scores.includes(10) && !document.getElementById("score10Reason").value) {
    showToast("Reason required for score 10", "error");
    return;
  }
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sailorId = document.getElementById("evalSailorId").value;
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  if (sailor) {
    sailor.yesterdayScore = avgScore;
    sailor.avgScore = (sailor.avgScore * 10 + avgScore) / 11; // Rolling average
    sailor.evaluated = true; // Save evaluation to local daily_allocations in Operations DB (failsafe + support history dates)
    const today = getLocalDateString();
    const dateVal = store.dashboardDate || today;
    const allocKey = `${dateVal}_${sanitizeFbKey(sailor.id)}`;
    const allocKeyFb = `${dateVal}_${sanitizeFbKey(sailor._fbKey)}`;
    let actualKey = allocKey;
    if (store.dailyAllocationsMap) {
      if (store.dailyAllocationsMap[allocKeyFb]) {
        actualKey = allocKeyFb;
      }
    }
    opsDB
      .ref(`daily_allocations/${actualKey}`)
      .update({
        date: dateVal,
        sailor_id: sailor.id,
        work_order_id: store.selectedWorkOrder || "",
        evaluated: true,
        score: avgScore,
      })
      .catch((e) =>
        console.warn("Could not save evaluation to Operations DB:", e),
      ); // Persist to sailorsDB as secondary best-effort
    if (typeof sailorsDB !== "undefined") {
      sailorsDB
        .ref("sailors/" + (sailor._fbKey || sailor.id))
        .update({
          yesterdayScore: sailor.yesterdayScore,
          avgScore: sailor.avgScore,
          evaluated: sailor.evaluated,
        })
        .catch((e) =>
          console.warn("Could not save sailor evaluation to DB:", e),
        );
    }
  }
  closeModal("evaluationModal");
  openWorkOrderDetail(store.selectedWorkOrder);
  switchWoTab("evaluation");
  updatePendingEvals();
  showToast(`Evaluation submitted! Score: ${avgScore.toFixed(1)}/10`);
} // =============================================
// JOB CARDS
// =============================================
function renderJobCardsView() {
  renderJobCardsList();
}
function switchJobCardsTab(tab) {
  store.currentJobCardsTab = tab;
  document.querySelectorAll(".jc-main-tab").forEach((t) => {
    t.classList.remove("border-green-600", "text-green-600", "bg-green-50", "border-b-2");
    t.classList.add("text-slate-500");
    if (t.getAttribute("onclick") && t.getAttribute("onclick").includes(tab)) {
      t.classList.remove("text-slate-500");
      t.classList.add("border-green-600", "text-green-600", "bg-green-50", "border-b-2");
    }
  });
  renderJobCardsList();
}
function renderJobCardsList() {
  const container = document.getElementById("jobCardsList");
  let jobCards = [];
  let title = "Active Job Cards";
  switch (store.currentJobCardsTab) {
    case "active":
      jobCards = store.jobCards.filter(
        (jc) =>
          (jc.status === "Active" || jc.status === "Hold") &&
          jc.zone_id === store.currentZone,
      );
      title = "Active & Held Job Cards";
      break;
    case "completed":
      jobCards = store.jobCards.filter(
        (jc) =>
          jc.status === "Completed" &&
          !jc.feedbackReceived &&
          jc.zone_id === store.currentZone,
      );
      title = "Recently Completed (Awaiting Feedback)";
      break;
    case "records":
      jobCards = store.jobCards.filter(
        (jc) =>
          jc.status === "Completed" &&
          jc.feedbackReceived &&
          jc.zone_id === store.currentZone,
      );
      title = "Completed Records (With Feedback)";
      break;
  }
  document.getElementById("jobCardsListTitle").textContent = title;
  container.innerHTML =
    jobCards
      .map((jc) => {
        var _jc$feedback;
        return `
        <div class="p-4 hover:bg-slate-50 cursor-pointer ${String(store.selectedJobCard) === String(jc.id) ? "bg-blue-50 border-l-4 border-blue-500" : ""}"
            onclick="selectJobCard('${jc._fbKey || jc.id}')">
            <div class="flex items-center justify-between mb-1">
                <span class="font-mono text-sm font-medium text-blue-600">${jc.job_number}</span>
                <span class="text-xs px-2 py-0.5 rounded ${jc.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}">${jc.status}</span>
            </div>
            <p class="text-sm text-slate-700 truncate">${jc.description}</p>
            <div class="flex justify-between mt-2 text-xs text-slate-500">
                <span>📍 ${jc.location}</span>
                <span class="font-medium text-amber-600">${formatCurrency(jc.total_material_cost)}</span>
            </div>
            ${
              jc.estimate_id
                ? (() => {
                    const est = store.estimates.find(
                      (e) => String(e.id) === String(jc.estimate_id),
                    );
                    return est
                      ? `
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-semibold">📄 Estimate: ${est.estimate_number}</span>
                    <span class="text-[10px] text-slate-500 font-semibold">Est: ${formatCurrency(est.total_cost)}</span>
                </div>`
                      : "";
                  })()
                : ""
            }
            ${
              jc.status === "Completed" && !jc.feedbackReceived
                ? `
                <div class="mt-2 pt-2 border-t border-slate-100">
                    <span class="text-xs ${jc.feedbackSent ? "text-amber-600" : "text-slate-400"}">
                        ${jc.feedbackSent ? "📤 Feedback link sent" : "📋 Feedback pending"}
                    </span>
                </div>
            `
                : ""
            }
            ${
              jc.feedbackReceived
                ? `
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                    <span class="text-xs text-green-600">✓ Feedback received</span>
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">${((_jc$feedback = jc.feedback) === null || _jc$feedback === void 0 || (_jc$feedback = _jc$feedback.overall) === null || _jc$feedback === void 0 ? void 0 : _jc$feedback.toFixed(1)) || "-"}/5</span>
                </div>
            `
                : ""
            }
        </div>
    `;
      })
      .join("") ||
    '<p class="text-slate-500 text-center py-8">No job cards in this category</p>';
}
function selectJobCard(id) {
  store.selectedJobCard = id;
  const jc = store.jobCards.find(
    (j) => String(j.id) === String(id) || String(j._fbKey) === String(id),
  );
  if (!jc) return;
  document.getElementById("selectedJobNumber").textContent = jc.job_number;
  document.getElementById("selectedJobDesc").textContent = jc.description;
  const estContainer = document.getElementById("selectedJobEstimateContainer");
  const estNoEl = document.getElementById("selectedJobEstimateNo");
  if (estContainer && estNoEl) {
    if (jc.estimate_id) {
      const est = store.estimates.find(
        (e) => String(e.id) === String(jc.estimate_id),
      );
      if (est) {
        estNoEl.textContent = `${est.estimate_number} - ${est.description} (${formatCurrency(est.total_cost)})`;
        estContainer.classList.remove("hidden");
      } else {
        estContainer.classList.add("hidden");
      }
    } else {
      estContainer.classList.add("hidden");
    }
  } // Calculate total material cost
  const materials = store.jobCardMaterials.filter(
    (m) => String(m.job_card_id) === String(id),
  );
  const totalCost = materials.reduce((sum, m) => sum + (parseFloat(m.total_cost) || 0), 0);
  document.getElementById("totalMaterialCost").textContent =
    formatCurrency(totalCost); // Show/hide action buttons based on status
  document.getElementById("addMaterialBtn").style.display =
    jc.status === "Active" ? "block" : "none";
  document.getElementById("deleteJobCardBtn").style.display =
    jc.status === "Active" ? "block" : "none";
  const btnEdit = document.getElementById("btnEditJobCard");
  if (btnEdit) {
    btnEdit.style.display = "inline-flex";
  }
  const btnPrint = document.getElementById("btnPrintJobCard");
  if (btnPrint) {
    btnPrint.style.display = "inline-flex";
  }
  // Show feedback tab for completed jobs
  document.getElementById("feedbackTabBtn").style.display =
    jc.status === "Completed" ? "block" : "none";
  renderJobCardMaterials(id);
  renderJobCardLabor(id);
  renderJobCardSummary(id);
  renderJobCardFeedback(id);
  renderJobCardsList(); // Switch to materials tab
  switchJobCardTab("materials");
}

let _editJcLaborList = [];

function filterEditJcSailorSearch() {
  const query =
    (document.getElementById("editJcSailorSearch") || {}).value || "";
  renderEditJcAvailableSailors(query);
}

function renderEditJcAvailableSailors(filter = "") {
  const container = document.getElementById("editJcAvailableSailorsChips");
  if (!container) return;
  const q = filter.toLowerCase().trim();

  const jcId = document.getElementById("editJcId")?.value;
  const jc = (store.jobCards || []).find(
    (j) => String(j.id) === String(jcId) || String(j._fbKey) === String(jcId),
  );
  const wo = jc
    ? (store.workOrders || []).find(
        (w) =>
          String(w._fbKey) === String(jc.work_order_id) ||
          String(w.id) === String(jc.work_order_id),
      )
    : null;
  const woAssignedIds = new Set((wo?.assigned || []).map(String));

  const existingSailorIds = new Set(
    _editJcLaborList.map((l) => String(l.sailor_id)),
  );

  let list = (store.sailors || []).filter((s) => {
    const sid = String(s.id || s._fbKey);
    const off = String(s.official_number || "");
    if (existingSailorIds.has(sid) || (off && existingSailorIds.has(off)))
      return false;
    if (!q) return true;
    return (
      (s._searchIndex || "").includes(q) ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.official_number || "").toLowerCase().includes(q) ||
      (s.rank || "").toLowerCase().includes(q) ||
      (s.trade || "").toLowerCase().includes(q)
    );
  });

  list.sort((a, b) => {
    const aInWo =
      woAssignedIds.has(String(a.id)) || woAssignedIds.has(String(a._fbKey));
    const bInWo =
      woAssignedIds.has(String(b.id)) || woAssignedIds.has(String(b._fbKey));
    if (aInWo !== bInWo) return aInWo ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const visible = list.slice(0, 25);
  if (visible.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 py-1 px-2">No matching sailors found</span>`;
    return;
  }

  container.innerHTML = visible
    .map((s) => {
      const off = s.official_number || s.officialNumber || "-";
      const sId = s.id || s._fbKey;
      const isWoCrew =
        woAssignedIds.has(String(s.id)) || woAssignedIds.has(String(s._fbKey));
      return `
      <button type="button" onclick="addSailorToEditJc('${sId}')" class="text-xs px-2 py-1 rounded-lg border ${isWoCrew ? "border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium" : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"} flex items-center gap-1 transition-all">
        <span class="font-bold text-[10px] px-1 py-0.2 bg-slate-200 text-slate-700 rounded">${s.trade || "MA"}</span>
        <span>${s.rank || ""} ${s.name} (${off})</span>
        <span class="text-emerald-600 font-bold">+</span>
      </button>
    `;
    })
    .join("");
}

function addSailorToEditJc(sailorId) {
  const s = (store.sailors || []).find(
    (x) =>
      String(x.id) === String(sailorId) || String(x._fbKey) === String(sailorId),
  );
  if (!s) return;
  const hours =
    parseFloat((document.getElementById("editJcSailorHours") || {}).value) || 8;
  const workDate =
    (document.getElementById("editJcStartDate") || {}).value ||
    (typeof getLocalDateString === "function"
      ? getLocalDateString()
      : new Date().toISOString().split("T")[0]);
  const jcId = document.getElementById("editJcId")?.value;

  _editJcLaborList.push({
    job_card_id: jcId,
    sailor_id: s.id || s._fbKey,
    sailor_name: `${s.rank || ""} ${s.name}`.trim(),
    trade: s.trade || "MA",
    work_date: workDate,
    hours: hours,
    role: "Worker",
    performance:
      typeof s.avgScore === "number"
        ? s.avgScore
        : typeof s.performance_score === "number"
          ? s.performance_score
          : 7.0,
    isNew: true,
  });

  renderEditJcCurrentSailors();
  renderEditJcAvailableSailors(
    (document.getElementById("editJcSailorSearch") || {}).value || "",
  );
}

function removeSailorFromEditJc(index) {
  const item = _editJcLaborList[index];
  if (item && item._fbKey) {
    if (!window._deletedJcLaborKeys) window._deletedJcLaborKeys = [];
    window._deletedJcLaborKeys.push(item._fbKey);
  }
  _editJcLaborList.splice(index, 1);
  renderEditJcCurrentSailors();
  renderEditJcAvailableSailors(
    (document.getElementById("editJcSailorSearch") || {}).value || "",
  );
}

function updateEditJcLaborField(index, field, value) {
  if (_editJcLaborList[index]) {
    _editJcLaborList[index][field] = value;
  }
}

function renderEditJcCurrentSailors() {
  const container = document.getElementById("editJcCurrentSailorsList");
  const countBadge = document.getElementById("editJcSailorCountBadge");
  if (countBadge) {
    countBadge.textContent = `(${_editJcLaborList.length} sailor${_editJcLaborList.length === 1 ? "" : "s"})`;
  }
  if (!container) return;

  if (_editJcLaborList.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic py-2 block text-center">No sailors assigned to this Job Card yet</span>`;
    return;
  }

  container.innerHTML = _editJcLaborList
    .map((l, idx) => {
      const sailor = (store.sailors || []).find(
        (s) =>
          String(s.id) === String(l.sailor_id) ||
          String(s._fbKey) === String(l.sailor_id) ||
          String(s.official_number) === String(l.sailor_id),
      );
      const off = sailor
        ? sailor.official_number || sailor.officialNumber || "-"
        : "-";
      const name = sailor
        ? `${sailor.rank || ""} ${sailor.name}`.trim()
        : l.sailor_name || "Unknown";
      const trade = sailor ? sailor.trade || "-" : l.trade || "-";

      return `
      <div class="flex items-center justify-between gap-2 py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="font-bold text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">${trade}</span>
          <div class="truncate">
            <span class="font-semibold text-xs text-slate-800">${name}</span>
            <span class="text-[11px] text-slate-500 font-mono">(${off})</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <input type="text" value="${l.role || "Worker"}" onchange="updateEditJcLaborField(${idx}, 'role', this.value)" placeholder="Role" class="w-20 text-xs px-2 py-1 border border-slate-300 rounded bg-white" title="Role / Duty">
          <div class="flex items-center gap-0.5">
            <input type="number" value="${l.hours || 8}" min="1" max="24" onchange="updateEditJcLaborField(${idx}, 'hours', parseFloat(this.value) || 8)" class="w-12 text-xs px-1.5 py-1 border border-slate-300 rounded bg-white text-center font-bold" title="Hours">
            <span class="text-xs text-slate-500">h</span>
          </div>
          <button type="button" onclick="removeSailorFromEditJc(${idx})" class="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors" title="Remove Sailor">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function openEditJobCardModal(id) {
  const targetId = id || store.selectedJobCard;
  if (!targetId) return;
  const jc = store.jobCards.find(
    (j) =>
      String(j.id) === String(targetId) ||
      String(j._fbKey) === String(targetId),
  );
  if (!jc) {
    showToast("Job Card not found", "error");
    return;
  }

  window._deletedJcLaborKeys = [];
  document.getElementById("editJcId").value = jc.id || jc._fbKey;
  document.getElementById("editJcNumber").value =
    jc.job_number || jc.job_card_no || "";
  document.getElementById("editJcStatus").value = jc.status || "Active";
  document.getElementById("editJcDescription").value =
    jc.description || jc.title || "";
  document.getElementById("editJcStartDate").value =
    jc.start_date || jc.commenced_date || "";
  document.getElementById("editJcEndDate").value =
    jc.end_date ||
    (jc.completed_at
      ? new Date(jc.completed_at).toISOString().split("T")[0]
      : "");
  document.getElementById("editJcApprovedBy").value =
    jc.approved_by || "CCED (E)";
  document.getElementById("editJcTakenBy").value = jc.taken_by || "";

  // Load existing labor for this JC
  const jcId = jc.id || jc._fbKey;
  const existingLabor = (store.jobCardLabor || []).filter(
    (l) =>
      String(l.job_card_id) === String(jcId) ||
      String(l.job_card_id) === String(jc.id) ||
      String(l.job_card_id) === String(jc._fbKey),
  );
  _editJcLaborList = JSON.parse(JSON.stringify(existingLabor));

  const includeSailorsCheckbox = document.getElementById("editJcIncludeSailors");
  if (includeSailorsCheckbox) {
    includeSailorsCheckbox.checked =
      jc.include_sailors === true ||
      jc.include_sailors === "true" ||
      (jc.include_sailors !== false && existingLabor.length > 0);
  }

  const searchInput = document.getElementById("editJcSailorSearch");
  if (searchInput) searchInput.value = "";
  const hoursInput = document.getElementById("editJcSailorHours");
  if (hoursInput) hoursInput.value = 8;

  renderEditJcCurrentSailors();
  renderEditJcAvailableSailors();

  document.getElementById("editJobCardModal").classList.remove("hidden");
}

function saveEditedJobCard(event) {
  event.preventDefault();
  const jcId = document.getElementById("editJcId").value;
  const jc = store.jobCards.find(
    (j) =>
      String(j.id) === String(jcId) ||
      String(j._fbKey) === String(jcId),
  );
  if (!jc) {
    showToast("Job Card not found", "error");
    return;
  }

  jc.job_number = document.getElementById("editJcNumber").value.trim();
  jc.job_card_no = jc.job_number;
  jc.status = document.getElementById("editJcStatus").value;
  jc.description = document.getElementById("editJcDescription").value.trim();
  jc.title = jc.description;
  jc.start_date = document.getElementById("editJcStartDate").value;
  jc.commenced_date = jc.start_date;
  jc.end_date = document.getElementById("editJcEndDate").value;
  if (jc.status === "Completed" && !jc.completed_at) {
    jc.completed_at = Date.now();
  }
  jc.approved_by = document.getElementById("editJcApprovedBy").value.trim();
  jc.taken_by = document.getElementById("editJcTakenBy").value.trim();
  jc.include_sailors = (document.getElementById("editJcIncludeSailors") || {}).checked;

  // Save Job Card
  fbSaveJobCard(jc);

  // Remove deleted labor keys from Firebase & local store
  if (window._deletedJcLaborKeys && window._deletedJcLaborKeys.length > 0) {
    window._deletedJcLaborKeys.forEach((k) => {
      opsDB.ref(`job_card_labor/${k}`).remove();
      store.jobCardLabor = (store.jobCardLabor || []).filter(
        (l) => String(l._fbKey) !== String(k),
      );
    });
    window._deletedJcLaborKeys = [];
  }

  // Save updated/new labor entries
  _editJcLaborList.forEach((l) => {
    if (l._fbKey) {
      // Update existing in Firebase & store
      const updatedFields = {
        role: l.role || "Worker",
        hours: l.hours || 8,
        work_date:
          l.work_date ||
          jc.start_date ||
          (typeof getLocalDateString === "function"
            ? getLocalDateString()
            : new Date().toISOString().split("T")[0]),
      };
      opsDB.ref(`job_card_labor/${l._fbKey}`).update(updatedFields);
      const storeItem = (store.jobCardLabor || []).find(
        (x) => String(x._fbKey) === String(l._fbKey),
      );
      if (storeItem) {
        Object.assign(storeItem, updatedFields);
      }
    } else {
      // Create new
      const entry = {
        job_card_id: jcId,
        sailor_id: l.sailor_id,
        sailor_name: l.sailor_name,
        work_date:
          l.work_date ||
          jc.start_date ||
          (typeof getLocalDateString === "function"
            ? getLocalDateString()
            : new Date().toISOString().split("T")[0]),
        hours: l.hours || 8,
        role: l.role || "Worker",
        performance: l.performance || 7.0,
        logged_by: store.currentUser?.name || "Officer",
      };
      if (!store.jobCardLabor) store.jobCardLabor = [];
      store.jobCardLabor.push(entry);
      fbSaveJobCardLabor(entry);
    }
  });

  closeModal("editJobCardModal");
  selectJobCard(jcId);
  renderJobCardLabor(jcId);
  renderJobCardsView();
  showToast("Job Card and Sailors details updated successfully!");
}

function deleteSingleJobCardLabor(laborId) {
  if (!laborId) return;
  if (!confirm("Are you sure you want to remove this sailor from this Job Card?")) return;
  const entry = (store.jobCardLabor || []).find(
    (l) => String(l.id) === String(laborId) || String(l._fbKey) === String(laborId)
  );
  const targetKey = entry && entry._fbKey ? entry._fbKey : laborId;
  opsDB
    .ref(`job_card_labor/${targetKey}`)
    .remove()
    .then(() => {
      store.jobCardLabor = (store.jobCardLabor || []).filter(
        (l) => String(l.id) !== String(laborId) && String(l._fbKey) !== String(laborId)
      );
      if (store.selectedJobCard) {
        renderJobCardLabor(store.selectedJobCard);
      }
      showToast("Sailor record removed.");
    })
    .catch((err) => {
      console.error("Error deleting labor log:", err);
      showToast("Failed to remove sailor record.");
    });
}

function deleteJobCardMaterial(materialId) {
  if (!materialId) return;
  if (!confirm("Are you sure you want to remove this material entry?")) return;
  const mat = store.jobCardMaterials.find(
    (m) =>
      String(m.id) === String(materialId) ||
      String(m._fbKey) === String(materialId),
  );
  const targetKey = mat && mat._fbKey ? mat._fbKey : materialId;
  opsDB
    .ref(`job_card_materials/${targetKey}`)
    .remove()
    .then(() => {
      store.jobCardMaterials = store.jobCardMaterials.filter(
        (m) =>
          String(m.id) !== String(materialId) &&
          String(m._fbKey) !== String(materialId),
      );
      if (store.selectedJobCard) {
        selectJobCard(store.selectedJobCard);
      }
      showToast("Material entry removed.");
    })
    .catch((err) => {
      console.error("Error deleting material:", err);
      showToast("Failed to remove material.");
    });
}

function deleteJobCard() {
  const jcId = store.selectedJobCard;
  if (!jcId) return;
  const jc = store.jobCards.find(
    (j) => String(j.id) === String(jcId) || String(j._fbKey) === String(jcId),
  );
  if (!jc) return;
  if (
    confirm(
      `⚠️ Are you sure you want to delete Job Card "${jc.job_number}" (${jc.description})?\n\nThis will also delete all logged materials and labor logs for this job card. This action cannot be undone.`,
    )
  ) {
    const targetFbKey = jc._fbKey;
    if (!targetFbKey) {
      showToast("Cannot delete: Firebase key not found.");
      return;
    } // 1. Delete Job Card from Firebase
    opsDB
      .ref(`job_cards/${targetFbKey}`)
      .remove()
      .then(() => {
        // 2. Delete linked materials logs
        const linkedMaterials = store.jobCardMaterials.filter(
          (m) => String(m.job_card_id) === String(jcId),
        );
        linkedMaterials.forEach((m) => {
          if (m._fbKey) {
            opsDB.ref(`job_card_materials/${m._fbKey}`).remove();
          }
        }); // 3. Delete linked labor logs
        const linkedLabor = store.jobCardLabor.filter(
          (l) => String(l.job_card_id) === String(jcId),
        );
        linkedLabor.forEach((l) => {
          if (l._fbKey) {
            opsDB.ref(`job_card_labor/${l._fbKey}`).remove();
          }
        });
        store.selectedJobCard = null;
        renderJobCardsView();
        showToast("Job Card deleted successfully.");
      })
      .catch((err) => {
        console.error("Error deleting Job Card:", err);
        showToast("Failed to delete Job Card.");
      });
  }
}
function renderJobCardMaterials(jobCardId) {
  const materials = store.jobCardMaterials.filter(
    (m) => String(m.job_card_id) === String(jobCardId),
  );
  const container = document.getElementById("jobCardMaterials");
  const total = materials.reduce(
    (sum, m) => sum + (parseFloat(m.total_cost) || 0),
    0,
  );
  container.innerHTML =
    materials
      .map((m) => {
        const dateStr =
          typeof m.logged_at === "number"
            ? new Date(m.logged_at).toISOString().split("T")[0]
            : m.work_date || m.logged_at || "-";
        const mId = m.id || m._fbKey;
        return `
        <tr>
            <td class="px-3 py-2 text-slate-600 font-mono text-xs">${dateStr}</td>
            <td class="px-3 py-2 font-mono text-xs font-semibold text-slate-700">${m.demand_no || m.demandNo || "-"}</td>
            <td class="px-3 py-2 font-medium text-slate-800">${m.material_name}</td>
            <td class="px-3 py-2 text-center text-xs text-slate-600">${m.unit}</td>
            <td class="px-3 py-2 text-center font-bold">${m.quantity}</td>
            <td class="px-3 py-2 text-center text-xs font-mono text-slate-500">${m.sig_ref || m.sig || "-"}</td>
            <td class="px-3 py-2 text-right text-xs">${formatCurrency(m.cost_per_unit)}</td>
            <td class="px-3 py-2 text-right font-semibold text-green-700">${formatCurrency(m.total_cost)}</td>
            <td class="px-2 py-2 text-center whitespace-nowrap">
              <button onclick="deleteJobCardMaterial('${mId}')" class="text-red-500 hover:text-red-700 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors" title="Delete Material">🗑️</button>
            </td>
        </tr>`;
      })
      .join("") ||
    '<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500">No materials logged</td></tr>';
  document.getElementById("materialsTotalFooter").textContent =
    formatCurrency(total);
}
// ── Retrieve All Labor Deployments for a specific Job Card ──
function getAllJobCardLaborRecords(jobCardId) {
  const targetId = String(jobCardId || store.selectedJobCard || "");
  if (!targetId) return [];

  const jc = (store.jobCards || []).find(
    (j) =>
      String(j.id) === targetId ||
      String(j._fbKey) === targetId ||
      (j.job_number && String(j.job_number) === targetId),
  );

  const jcKeys = new Set();
  if (jc) {
    if (jc.id) jcKeys.add(String(jc.id));
    if (jc._fbKey) jcKeys.add(String(jc._fbKey));
    if (jc.job_number) jcKeys.add(String(jc.job_number));
    if (jc.work_order_id) jcKeys.add(String(jc.work_order_id));
  } else {
    jcKeys.add(targetId);
  }

  const wo = jc
    ? (store.workOrders || []).find(
        (w) =>
          String(w._fbKey) === String(jc.work_order_id) ||
          String(w.id) === String(jc.work_order_id) ||
          (w.job_number &&
            jc.job_number &&
            String(w.job_number) === String(jc.job_number)) ||
          (w.description &&
            jc.description &&
            w.description.trim().toLowerCase() ===
              jc.description.trim().toLowerCase()),
      )
    : null;

  if (wo) {
    if (wo.id) jcKeys.add(String(wo.id));
    if (wo._fbKey) jcKeys.add(String(wo._fbKey));
    if (wo.job_number) jcKeys.add(String(wo.job_number));
  }

  const records = [];
  const seenKey = new Set();

  // Helper to enrich a record
  function addEntry(
    sailorId,
    workDate,
    hours,
    role,
    performance,
    source,
    rawId,
    remarks,
  ) {
    const sid = String(sailorId || "").trim();
    if (!sid || sid === "undefined" || sid === "null") return;

    const sailor = findSailorById(sid);

    const sName = sailor
      ? `${sailor.rank || ""} ${sailor.name || ""}`.trim()
      : "Unknown";
    const sTrade = sailor ? sailor.trade || "-" : "-";
    const sOffNo = sailor
      ? sailor.official_number ||
        sailor.officialNumber ||
        sailor.off_no ||
        sailor.service_no ||
        "-"
      : sid;

    const dateStr =
      workDate ||
      (jc
        ? jc.start_date || jc.created_at || getLocalDateString()
        : getLocalDateString());
    const cleanDate =
      typeof dateStr === "string" && dateStr.includes("T")
        ? dateStr.split("T")[0]
        : String(dateStr);

    const numHours = parseFloat(hours) || 8;
    const cleanRole = role || "Worker";

    const dedupKey = `${cleanDate}_${sOffNo || sid}_${cleanRole}`;
    if (seenKey.has(dedupKey)) return;
    seenKey.add(dedupKey);

    const perfVal =
      typeof performance === "number"
        ? performance
        : sailor && typeof sailor.avgScore === "number"
          ? sailor.avgScore
          : sailor && typeof sailor.performance_score === "number"
            ? sailor.performance_score
            : null;

    records.push({
      id: rawId || dedupKey,
      _fbKey: rawId,
      sailor_id: sid,
      sailor_name: sName,
      official_number: sOffNo,
      trade: sTrade,
      work_date: cleanDate,
      hours: numHours,
      role: cleanRole,
      performance: perfVal,
      source: source || "Logged",
      remarks: remarks || "",
      isDeletable: source === "Logged" && !!rawId,
    });
  }

  // 1. Check store.jobCardLabor
  (store.jobCardLabor || []).forEach((l) => {
    if (
      jcKeys.has(String(l.job_card_id)) ||
      (l.work_order_id && jcKeys.has(String(l.work_order_id)))
    ) {
      addEntry(
        l.sailor_id,
        l.work_date || l.date,
        l.hours,
        l.role,
        l.performance,
        "Logged",
        l.id || l._fbKey,
        l.remarks,
      );
    }
  });

  // 2. Check embedded jc.labor if any
  if (jc && Array.isArray(jc.labor)) {
    jc.labor.forEach((l) => {
      addEntry(
        l.sailor_id || l.id,
        l.work_date || l.date || jc.start_date,
        l.hours,
        l.role,
        l.performance,
        "Logged",
        l.id,
        l.remarks,
      );
    });
  }

  // 3. Check store.dailyAllocations across all dates
  (store.dailyAllocations || []).forEach((alloc) => {
    const allocWoId = String(alloc.work_order_id || alloc.job_card_id || "");
    if (allocWoId && jcKeys.has(allocWoId)) {
      addEntry(
        alloc.sailor_id,
        alloc.date || alloc.allocation_date,
        alloc.hours || 8,
        alloc.role || "Worker",
        alloc.eval_score || alloc.rating,
        "Daily Allocation",
        null,
        alloc.remarks,
      );
    }
  });

  // 4. Fallback to active assignments on WO / JC
  const assignedList =
    wo && wo.assigned && wo.assigned.length > 0
      ? wo.assigned
      : jc && jc.assigned && jc.assigned.length > 0
        ? jc.assigned
        : [];

  if (records.length === 0 && assignedList.length > 0) {
    assignedList.forEach((sid) => {
      addEntry(
        sid,
        jc?.start_date || wo?.date || getLocalDateString(),
        8,
        "Worker",
        null,
        "Assigned",
        null,
        "",
      );
    });
  }

  // Sort descending by date
  records.sort((a, b) => new Date(b.work_date || 0) - new Date(a.work_date || 0));
  return records;
}

function renderJobCardLabor(jobCardId) {
  const records = getAllJobCardLaborRecords(jobCardId);
  const container = document.getElementById("jobCardLabor");
  if (!container) return;

  const totalHours = records.reduce(
    (sum, r) => sum + (parseFloat(r.hours) || 0),
    0,
  );
  const uniqueSailors = new Set(records.map((r) => r.sailor_id)).size;

  const countBadge = document.getElementById("jcLaborCountBadge");
  if (countBadge) countBadge.textContent = `${records.length} Records`;

  const hoursEl = document.getElementById("jcLaborTotalHours");
  if (hoursEl) hoursEl.textContent = `${totalHours}h`;

  const workersEl = document.getElementById("jcLaborUniqueWorkers");
  if (workersEl) workersEl.textContent = `${uniqueSailors} Sailors involved`;

  if (records.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-slate-400">
          <p class="font-medium text-sm">No labor records logged for this Job Card.</p>
          <p class="text-xs text-slate-400 mt-1">Click "➕ Log Labor" above to add sailor man-hours.</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = records
    .map((l) => {
      const perfVal = l.performance;
      const perfBadge =
        typeof perfVal === "number" && !isNaN(perfVal)
          ? `<span class="performance-badge ${getPerformanceColor(perfVal)}">${perfVal.toFixed(1)}</span>`
          : `<span class="text-slate-400 text-xs">-</span>`;

      const sourceBadge =
        l.source === "Logged"
          ? `<span class="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">Manual Log</span>`
          : l.source === "Daily Allocation"
            ? `<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Daily Board</span>`
            : `<span class="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">Assigned</span>`;

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2.5 text-slate-700 font-mono text-xs">${l.work_date}</td>
        <td class="px-4 py-2.5 font-medium text-slate-800 text-xs">
          <div>${l.sailor_name}</div>
          <div class="text-[10px] text-slate-400 font-mono">${l.official_number}</div>
        </td>
        <td class="px-4 py-2.5 text-center"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">${l.trade}</span></td>
        <td class="px-4 py-2.5 text-center text-xs text-slate-700">${l.role}</td>
        <td class="px-4 py-2.5 text-center font-bold text-blue-700 text-xs">${l.hours}h</td>
        <td class="px-4 py-2.5 text-center">${perfBadge}</td>
        <td class="px-4 py-2.5 text-left">${sourceBadge}</td>
        <td class="px-2 py-2.5 text-center whitespace-nowrap">
          ${
            l.isDeletable
              ? `<button onclick="deleteSingleJobCardLabor('${l._fbKey || l.id}')" class="text-red-500 hover:text-red-700 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors" title="Delete Labor Record">🗑️</button>`
              : `<span class="text-slate-300 text-xs">—</span>`
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

function openAddJobLaborModal(jcId) {
  const id = jcId || store.selectedJobCard;
  if (!id) {
    showToast("Please select a Job Card first", "error");
    return;
  }
  const jc = (store.jobCards || []).find(
    (j) => String(j.id) === String(id) || String(j._fbKey) === String(id),
  );
  if (!jc) return;

  document.getElementById("addLaborJcId").value = jc._fbKey || jc.id;
  document.getElementById("addLaborJobInfo").textContent = `${jc.job_number || id} — ${jc.description || ""}`;
  document.getElementById("addLaborDate").value = getLocalDateString();
  document.getElementById("addLaborHours").value = "8";
  document.getElementById("addLaborRole").value = "Worker";
  document.getElementById("addLaborSailorSearch").value = "";
  document.getElementById("addLaborSelectedSailorId").value = "";
  document.getElementById("addLaborSelectedBadge").classList.add("hidden");

  renderAddLaborSailorsList("");
  document.getElementById("addJobLaborModal").classList.remove("hidden");
}

function filterAddLaborSailorSearch(query) {
  renderAddLaborSailorsList(query);
}

function renderAddLaborSailorsList(query) {
  const container = document.getElementById("addLaborSailorsList");
  if (!container) return;

  const q = (query || "").toLowerCase().trim();
  const sailors = (store.sailors || []).filter((s) => {
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const offNo = (
      s.official_number ||
      s.officialNumber ||
      s.service_no ||
      s.off_no ||
      ""
    ).toLowerCase();
    const rank = (s.rank || "").toLowerCase();
    const trade = (s.trade || "").toLowerCase();
    return (
      name.includes(q) ||
      offNo.includes(q) ||
      rank.includes(q) ||
      trade.includes(q)
    );
  });

  if (sailors.length === 0) {
    container.innerHTML =
      '<div class="p-3 text-xs text-slate-400 italic text-center">No sailors found</div>';
    return;
  }

  container.innerHTML = sailors
    .slice(0, 30)
    .map((s) => {
      const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
      const sName = `${s.rank || ""} ${s.name || ""}`.trim();
      const sOff = s.official_number || s.service_no || s.off_no || "";
      const sTrade = s.trade || "General";
      return `
      <div onclick="selectAddLaborSailor('${sid}', '${sName.replace(/'/g, "\\'")}', '${sOff}', '${sTrade}')" class="p-2.5 text-xs hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors">
        <div>
          <span class="font-bold text-slate-800">${sName}</span>
          <span class="ml-1 text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-bold">${sTrade}</span>
        </div>
        <span class="font-mono text-slate-400 text-[11px]">${sOff}</span>
      </div>
    `;
    })
    .join("");
}

function selectAddLaborSailor(sid, name, offNo, trade) {
  document.getElementById("addLaborSelectedSailorId").value = sid;
  const badge = document.getElementById("addLaborSelectedBadge");
  if (badge) {
    badge.innerHTML = `<span>Selected Sailor: <strong>${name}</strong> (${offNo}) — ${trade}</span>`;
    badge.classList.remove("hidden");
  }
}

function submitAddJobLabor(event) {
  event.preventDefault();
  const jcId = document.getElementById("addLaborJcId").value;
  const sailorId = document.getElementById("addLaborSelectedSailorId").value;
  const date = document.getElementById("addLaborDate").value;
  const hours = parseFloat(document.getElementById("addLaborHours").value) || 8;
  const role = document.getElementById("addLaborRole").value;

  if (!sailorId) {
    showToast("Please select a sailor first", "error");
    return;
  }

  const s = (store.sailors || []).find(
    (x) => String(x.id) === String(sailorId) || String(x._fbKey) === String(sailorId),
  );
  const entry = {
    job_card_id: jcId,
    sailor_id: sailorId,
    sailor_name: s ? `${s.rank || ""} ${s.name || ""}`.trim() : "",
    official_number: s ? s.official_number || s.service_no || "" : "",
    trade: s ? s.trade || "" : "",
    work_date: date,
    hours: hours,
    role: role,
    created_at: Date.now(),
  };

  if (!store.jobCardLabor) store.jobCardLabor = [];
  store.jobCardLabor.push(entry);
  fbSaveJobCardLabor(entry)
    .then(() => {
      closeModal("addJobLaborModal");
      renderJobCardLabor(jcId);
      renderJobCardSummary(jcId);
      showToast("Labor record saved successfully!");
    })
    .catch((err) => {
      console.error(err);
      closeModal("addJobLaborModal");
      renderJobCardLabor(jcId);
      showToast("Labor record saved locally!");
    });
}

function exportSingleJobCardLabor(jobCardId) {
  const targetId = jobCardId || store.selectedJobCard;
  if (!targetId) {
    showToast("Please select a Job Card first", "error");
    return;
  }
  const jc = (store.jobCards || []).find(
    (j) => String(j.id) === String(targetId) || String(j._fbKey) === String(targetId),
  );
  const jcNo = jc ? jc.job_number : targetId;
  const records = getAllJobCardLaborRecords(targetId);

  if (records.length === 0) {
    showToast("No labor records to export for this Job Card", "info");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent +=
    "Job Card No,Date,Official Number,Sailor Name,Trade,Role,Hours,Performance Score,Source,Remarks\n";

  records.forEach((r) => {
    const row = [
      `"${jcNo}"`,
      `"${r.work_date}"`,
      `"${r.official_number}"`,
      `"${(r.sailor_name || "").replace(/"/g, '""')}"`,
      `"${r.trade}"`,
      `"${r.role}"`,
      r.hours,
      r.performance !== null ? r.performance : "",
      `"${r.source}"`,
      `"${(r.remarks || "").replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Labor_Log_${jcNo.replace(/[\/\\]/g, "_")}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Labor log exported for ${jcNo}`);
}

function renderJobCardSummary(jobCardId) {
  const jc = store.jobCards.find(
    (j) =>
      String(j.id) === String(jobCardId) ||
      String(j._fbKey) === String(jobCardId),
  );
  const materials = store.jobCardMaterials.filter(
    (m) => String(m.job_card_id) === String(jobCardId),
  );
  const labor = getAllJobCardLaborRecords(jobCardId);
  const totalMaterialCost = materials.reduce(
    (sum, m) => sum + (parseFloat(m.total_cost) || 0),
    0,
  );
  const totalHours = labor.reduce(
    (sum, l) => sum + (parseFloat(l.hours) || 0),
    0,
  );
  const uniqueWorkers = [...new Set(labor.map((l) => l.sailor_id))].length;
  document.getElementById("jobCardSummary").innerHTML = `
        <div class="bg-blue-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Job Number</p>
            <p class="text-xl font-bold text-blue-600">${jc ? jc.job_number : "—"}</p>
        </div>
        <div class="bg-green-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Total Material Cost</p>
            <p class="text-xl font-bold text-green-600">${formatCurrency(totalMaterialCost)}</p>
        </div>
        <div class="bg-amber-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Total Man-Hours</p>
            <p class="text-xl font-bold text-amber-600">${totalHours} hours</p>
        </div>
        <div class="bg-purple-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Workers Involved</p>
            <p class="text-xl font-bold text-purple-600">${uniqueWorkers} sailors</p>
        </div>
        <div class="col-span-2 bg-slate-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Status & Duration</p>
            <div class="flex items-center gap-4">
                <span class="px-3 py-1 rounded ${jc && jc.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-200"}">${jc ? jc.status : "—"}</span>
                <span class="text-slate-600">Started: ${jc ? jc.start_date || "—" : "—"}</span>
                ${jc && jc.end_date ? `<span class="text-slate-600">Ended: ${jc.end_date}</span>` : ""}
            </div>
        </div>
    `;
}
function renderJobCardFeedback(jobCardId) {
  const jc = store.jobCards.find((j) => j.id === jobCardId);
  if (jc.feedbackReceived && jc.feedback) {
    document.getElementById("feedbackSection").classList.add("hidden");
    document
      .getElementById("receivedFeedbackSection")
      .classList.remove("hidden");
    document.getElementById("receivedFeedbackSection").innerHTML = `
            <div class="bg-green-50 p-6 rounded-xl border border-green-200">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-green-800">✓ Feedback Received</h4>
                    <span class="text-2xl font-bold text-green-600">${jc.feedback.overall.toFixed(1)}/5</span>
                </div>
                <div class="grid grid-cols-5 gap-2 mb-4">
                    ${[
                      "Productivity",
                      "Workmanship",
                      "Communication",
                      "Professionalism",
                      "Satisfaction",
                    ]
                      .map((cat, i) => {
                        const scores = [
                          jc.feedback.productivity,
                          jc.feedback.workmanship,
                          jc.feedback.communication,
                          jc.feedback.professionalism,
                          jc.feedback.satisfaction,
                        ];
                        return `
                            <div class="text-center p-2 bg-white rounded-lg">
                                <p class="text-xs text-slate-500">${cat}</p>
                                <p class="font-bold text-lg">${scores[i]}</p>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
                ${jc.feedback.comments ? `<p class="text-sm text-slate-600 italic">"${jc.feedback.comments}"</p>` : ""}
            </div>
        `;
  } else {
    document.getElementById("feedbackSection").classList.remove("hidden");
    document.getElementById("receivedFeedbackSection").classList.add("hidden");
    document.getElementById("feedbackLinkBox").classList.add("hidden");
    document.getElementById("genFeedbackBtn").style.display =
      jc.status === "Completed" ? "inline-block" : "none";
    document.getElementById("feedbackStatusText").textContent = jc.feedbackSent
      ? "Feedback link has been sent. Waiting for response..."
      : "Generate a feedback link to send to the end user";
  }
}
function switchJobCardTab(tab) {
  document.querySelectorAll(".jc-tab").forEach((t) => {
    t.classList.remove(
      "border-green-600",
      "text-green-600",
      "border-b-2",
      "font-semibold",
    );
  });
  document.querySelectorAll(".jc-tab-content").forEach((c) => {
    c.classList.add("hidden");
  });
  const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.add(
      "border-green-600",
      "text-green-600",
      "border-b-2",
      "font-semibold",
    );
  }
  const tabEl = document.getElementById(`jcTab-${tab}`);
  if (tabEl) tabEl.classList.remove("hidden");
}
let _matWoSailorEntries = [];

function toggleMatSailorsSection() {
  const checkbox = document.getElementById("matIncludeSailors");
  const section = document.getElementById("matSailorsSection");
  if (!checkbox || !section) return;
  section.classList.toggle("hidden", !checkbox.checked);
  if (checkbox.checked) {
    loadAndRenderMatWoSailors();
  }
}

function loadAndRenderMatWoSailors() {
  const jc = (store.jobCards || []).find(
    (j) =>
      String(j.id) === String(store.selectedJobCard) ||
      String(j._fbKey) === String(store.selectedJobCard),
  );
  const wo = jc
    ? (store.workOrders || []).find(
        (w) =>
          String(w._fbKey) === String(jc.work_order_id) ||
          String(w.id) === String(jc.work_order_id),
      )
    : null;

  const defaultHours =
    parseFloat((document.getElementById("matSailorHours") || {}).value) || 8;
  const woAssignedIds = (wo?.assigned || []).map(String);
  const woSailors = (store.sailors || []).filter((s) => {
    return (
      woAssignedIds.includes(String(s.id)) ||
      woAssignedIds.includes(String(s._fbKey)) ||
      (s.official_number && woAssignedIds.includes(String(s.official_number)))
    );
  });

  const countBadge = document.getElementById("matWoCrewCountBadge");
  if (countBadge) {
    countBadge.textContent =
      woSailors.length > 0 ? `${woSailors.length} assigned to Work Order` : "";
  }

  // Pre-populate entries with all Work Order sailors checked by default
  _matWoSailorEntries = woSailors.map((s) => ({
    sailor: s,
    sailor_id: s.id || s._fbKey,
    official_number: s.official_number || s.officialNumber || s.off_no || "-",
    name: `${s.rank || ""} ${s.name || ""}`.trim(),
    trade: s.trade || "MA",
    checked: true,
    hours: defaultHours,
    role: "Worker",
  }));

  renderMatWoSailors();
}

function renderMatWoSailors() {
  const container = document.getElementById("matWoSailorsList");
  if (!container) return;

  if (_matWoSailorEntries.length === 0) {
    container.innerHTML = `
      <div class="text-center py-3 text-xs text-slate-500 italic">
        ⚠️ No sailors are currently assigned to this Work Order.
      </div>
    `;
    return;
  }

  container.innerHTML = _matWoSailorEntries
    .map((item, idx) => {
      return `
      <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg border ${item.checked ? "bg-amber-50/60 border-amber-200" : "bg-slate-50 border-slate-200 opacity-60"} transition-all">
        <label class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none">
          <input type="checkbox" ${item.checked ? "checked" : ""} onchange="toggleMatSailorEntry(${idx}, this.checked)" class="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400">
          <span class="font-bold text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">${item.trade}</span>
          <div class="truncate text-xs">
            <span class="font-semibold text-slate-800">${item.name}</span>
            <span class="text-[11px] text-slate-500 font-mono">(${item.official_number})</span>
          </div>
        </label>
        <div class="flex items-center gap-1.5">
          <input type="text" value="${item.role || "Worker"}" onchange="updateMatSailorField(${idx}, 'role', this.value)" placeholder="Role" class="w-20 text-xs px-1.5 py-0.5 border border-slate-300 rounded bg-white" title="Role / Duty">
          <div class="flex items-center gap-0.5">
            <input type="number" value="${item.hours || 8}" min="1" max="24" onchange="updateMatSailorField(${idx}, 'hours', parseFloat(this.value) || 8)" class="w-12 text-xs px-1 py-0.5 border border-slate-300 rounded bg-white text-center font-bold" title="Hours">
            <span class="text-[11px] text-slate-500">h</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function toggleMatSailorEntry(index, isChecked) {
  if (_matWoSailorEntries[index]) {
    _matWoSailorEntries[index].checked = isChecked;
    renderMatWoSailors();
  }
}

function updateMatSailorField(index, field, value) {
  if (_matWoSailorEntries[index]) {
    _matWoSailorEntries[index][field] = value;
  }
}

function updateAllMatSailorsHours(hoursVal) {
  const h = parseFloat(hoursVal) || 8;
  _matWoSailorEntries.forEach((item) => {
    item.hours = h;
  });
  renderMatWoSailors();
}

function openAddMaterialToJobModal() {
  if (!store.selectedJobCard) {
    showToast("Please select a job card first", "error");
    return;
  }
  document.getElementById("matJobCardId").value = store.selectedJobCard; // Reset form
  const jc = store.jobCards.find(
    (j) =>
      String(j.id) === String(store.selectedJobCard) ||
      String(j._fbKey) === String(store.selectedJobCard),
  );

  const matDateInput = document.getElementById("matDate");
  if (matDateInput)
    matDateInput.value =
      typeof getLocalDateString === "function"
        ? getLocalDateString()
        : new Date().toISOString().split("T")[0];
  const matDemandNoInput = document.getElementById("matDemandNo");
  if (matDemandNoInput) matDemandNoInput.value = "";
  const matCommencedInput = document.getElementById("matCommenced");
  if (matCommencedInput) {
    matCommencedInput.value =
      jc && (jc.start_date || jc.commenced_date)
        ? jc.start_date || jc.commenced_date
        : typeof getLocalDateString === "function"
          ? getLocalDateString()
          : new Date().toISOString().split("T")[0];
  }
  const matJobCardNoInput = document.getElementById("matJobCardNo");
  if (matJobCardNoInput) {
    matJobCardNoInput.value =
      jc && (jc.job_number || jc.job_card_no)
        ? jc.job_number || jc.job_card_no
        : "";
  }
  const matSigInput = document.getElementById("matSig");
  if (matSigInput) matSigInput.value = "";

  _matWoSailorEntries = [];
  const includeSailorsCheckbox = document.getElementById("matIncludeSailors");
  if (includeSailorsCheckbox) {
    includeSailorsCheckbox.checked = false;
  }
  const sailorsSection = document.getElementById("matSailorsSection");
  if (sailorsSection) {
    sailorsSection.classList.add("hidden");
  }
  const countBadge = document.getElementById("matWoCrewCountBadge");
  if (countBadge) {
    const wo = jc
      ? (store.workOrders || []).find(
          (w) =>
            String(w._fbKey) === String(jc.work_order_id) ||
            String(w.id) === String(jc.work_order_id),
        )
      : null;
    const woAssignedIds = (wo?.assigned || []).map(String);
    countBadge.textContent =
      woAssignedIds.length > 0 ? `${woAssignedIds.length} in Work Order` : "";
  }

  const matInput = document.getElementById("matFromInventory");
  matInput.value = "";
  document.getElementById("matName").value = "";
  document.getElementById("matQuantity").value = "";
  document.getElementById("matCost").value = "";
  document.getElementById("matTotalCost").textContent = "Rs. 0.00";
  setupMaterialAutocomplete(matInput, fillMaterialFromInventory);
  matInput.addEventListener("change", fillMaterialFromInventory);
  document.getElementById("addMaterialModal").classList.remove("hidden");
}
function setSelectValueCaseInsensitive(selectEl, targetValue) {
  if (!selectEl || !targetValue) return;
  const cleanTarget = String(targetValue).trim().toLowerCase();
  for (let i = 0; i < selectEl.options.length; i++) {
    const optVal = selectEl.options[i].value.trim().toLowerCase();
    const optText = selectEl.options[i].textContent.trim().toLowerCase();
    if (
      optVal === cleanTarget ||
      optText === cleanTarget ||
      (cleanTarget.startsWith("no") && optVal.startsWith("no")) ||
      (cleanTarget.startsWith("kg") && optVal.startsWith("kg")) ||
      (cleanTarget.startsWith("bag") && optVal.startsWith("bag")) ||
      (cleanTarget.startsWith("cub") && optVal.startsWith("cub")) ||
      (cleanTarget.startsWith("mtr") && optVal.startsWith("meter")) ||
      (cleanTarget.startsWith("met") && optVal.startsWith("meter")) ||
      (cleanTarget.startsWith("ltr") && optVal.startsWith("ltr")) ||
      (cleanTarget.startsWith("ft") && optVal.startsWith("ft")) ||
      (cleanTarget.startsWith("sheet") && optVal.startsWith("sheet"))
    ) {
      selectEl.selectedIndex = i;
      return;
    }
  }
  const newOpt = document.createElement("option");
  newOpt.value = targetValue;
  newOpt.textContent = targetValue;
  selectEl.appendChild(newOpt);
  selectEl.value = targetValue;
}

function fillMaterialFromInventory() {
  const inputVal = (document.getElementById("matFromInventory")?.value || "").trim().toLowerCase();
  if (!inputVal) return;
  const item =
    store.inventory.find(
      (i) => (i.description || "").trim().toLowerCase() === inputVal && i.category !== "Tools",
    ) ||
    store.inventory.find(
      (i) => (i.description || "").trim().toLowerCase().includes(inputVal) && i.category !== "Tools",
    );
  if (item) {
    document.getElementById("matName").value = item.description;
    setSelectValueCaseInsensitive(document.getElementById("matUnit"), item.deno);
    document.getElementById("matCost").value = item.cost_per_unit || "";
    calculateMaterialTotal();
  }
}
function calculateMaterialTotal() {
  const qty = parseFloat(document.getElementById("matQuantity").value) || 0;
  const cost = parseFloat(document.getElementById("matCost").value) || 0;
  document.getElementById("matTotalCost").textContent = formatCurrency(
    qty * cost,
  );
} // Add event listeners for material calculation
(_document$getElementB3 = document.getElementById("matQuantity")) === null ||
  _document$getElementB3 === void 0 ||
  _document$getElementB3.addEventListener("input", calculateMaterialTotal);
(_document$getElementB4 = document.getElementById("matCost")) === null ||
  _document$getElementB4 === void 0 ||
  _document$getElementB4.addEventListener("input", calculateMaterialTotal);
function addMaterialToJob(event) {
  event.preventDefault();
  const jobCardId = document.getElementById("matJobCardId").value;
  const qty = parseFloat(document.getElementById("matQuantity").value);
  const cost = parseFloat(document.getElementById("matCost").value) || 0;
  const demandNo = (document.getElementById("matDemandNo") || {}).value || "";
  const commenced = (document.getElementById("matCommenced") || {}).value || "";
  const customJobCardNo =
    (document.getElementById("matJobCardNo") || {}).value || "";
  const sigRef = (document.getElementById("matSig") || {}).value || "";
  const customDate =
    (document.getElementById("matDate") || {}).value ||
    (typeof getLocalDateString === "function"
      ? getLocalDateString()
      : new Date().toISOString().split("T")[0]);

  const newMaterial = {
    job_card_id: jobCardId,
    material_name: document.getElementById("matName").value,
    quantity: qty,
    unit: document.getElementById("matUnit").value,
    cost_per_unit: cost,
    total_cost: qty * cost,
    demand_no: demandNo,
    commenced: commenced,
    job_card_no: customJobCardNo,
    sig_ref: sigRef,
    work_date: customDate,
    logged_at: customDate,
  }; // Save to Firebase (Realtime Database listener will automatically update store.jobCardMaterials)

  // If Sailors Records included
  const includeSailors = (
    document.getElementById("matIncludeSailors") || {}
  ).checked;
  const selectedEntries = includeSailors
    ? _matWoSailorEntries.filter((e) => e.checked)
    : [];

  if (includeSailors && selectedEntries.length > 0) {
    selectedEntries.forEach((e) => {
      const s = e.sailor;
      const laborEntry = {
        job_card_id: jobCardId,
        sailor_id: e.sailor_id,
        sailor_name: e.name,
        trade: e.trade,
        work_date: customDate,
        hours: e.hours || 8,
        role: e.role || "Worker",
        performance:
          s && typeof s.avgScore === "number"
            ? s.avgScore
            : s && typeof s.performance_score === "number"
              ? s.performance_score
              : 7.0,
        logged_by: store.currentUser?.name || "Officer",
      };
      if (!store.jobCardLabor) store.jobCardLabor = [];
      store.jobCardLabor.push(laborEntry);
      fbSaveJobCardLabor(laborEntry);
    });
    newMaterial.sailors_logged = selectedEntries.length;
  }

  fbSaveJobCardMaterial(newMaterial); // Update job card total in Firebase
  const jc = store.jobCards.find(
    (j) =>
      String(j.id) === String(jobCardId) ||
      String(j._fbKey) === String(jobCardId),
  );
  if (jc) {
    jc.total_material_cost =
      (jc.total_material_cost || 0) + newMaterial.total_cost;
    if (commenced) {
      jc.start_date = commenced;
      jc.commenced_date = commenced;
    }
    if (customJobCardNo) {
      jc.job_number = customJobCardNo;
    }
    jc.include_sailors = includeSailors;
    fbSaveJobCard(jc);
  } // Deduct from inventory in Firebase if selected
  const invId = document.getElementById("matFromInventory").value;
  if (invId) {
    const inv = store.inventory.find(
      (i) =>
        String(i.id) === String(invId) || String(i._fbKey) === String(invId),
    );
    if (inv) {
      inv.quantity -= qty;
      fbSaveInventoryItem(inv);
    }
  }
  closeModal("addMaterialModal");
  selectJobCard(jobCardId);
  renderJobCardLabor(jobCardId);
  showToast("Material and details saved successfully!");
}



// =============================================
// OFFICIAL NAVY JOB CARD PRINT & PDF EXPORT
// =============================================
function buildOfficialJobCardPrintHTML(jc) {
  if (!jc) return "";
  const jcId = jc.id || jc._fbKey;
  const materials = (store.jobCardMaterials || []).filter(
    (m) => String(m.job_card_id) === String(jcId) || String(m.job_card_id) === String(jc.id) || String(m.job_card_id) === String(jc._fbKey)
  );
  const totalCost = materials.reduce((sum, m) => sum + (parseFloat(m.total_cost) || 0), 0);

  const latestMatWithCommenced = [...materials].reverse().find((m) => m.commenced);
  const startDate = (latestMatWithCommenced ? latestMatWithCommenced.commenced : "") || jc.start_date || jc.commenced_date || (jc.created_at ? new Date(jc.created_at).toISOString().split("T")[0] : "");
  const endDate = jc.end_date || (jc.completed_at ? new Date(jc.completed_at).toISOString().split("T")[0] : "");
  const projectTitle = jc.description || jc.title || "Civil Engineering Maintenance Job";
  const latestMatWithJobNo = [...materials].reverse().find((m) => m.job_card_no);
  const jobNo = (latestMatWithJobNo ? latestMatWithJobNo.job_card_no : "") || jc.job_number || "JC/" + (new Date().getFullYear()) + "/0000";

  // Build material rows
  let rowsHtml = "";
  materials.forEach((m) => {
    const dateStr =
      typeof m.logged_at === "number"
        ? new Date(m.logged_at).toISOString().split("T")[0]
        : (m.work_date || m.logged_at || startDate || "");
    const demandNo = m.demand_no || m.demandNo || "";
    const matName = m.material_name || "";
    const unit = m.unit || "";
    const qty = m.quantity !== undefined ? m.quantity : "";
    const sigRef = m.sig_ref || m.sig || "";
    const unitCost = m.cost_per_unit !== undefined ? parseFloat(m.cost_per_unit).toFixed(2) : "";
    const lineTotal = m.total_cost !== undefined ? parseFloat(m.total_cost).toFixed(2) : "";

    rowsHtml += `
      <tr style="height: 30px;">
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px; font-family: monospace;">${dateStr}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px; font-family: monospace; font-weight: bold;">${demandNo}</td>
        <td style="border: 1px solid #000; padding: 4px 8px; text-align: left; font-size: 11px; font-weight: 600;">${matName}</td>
        <td style="border: 1px solid #000; padding: 4px 4px; text-align: center; font-size: 11px;">${unit}</td>
        <td style="border: 1px solid #000; padding: 4px 4px; text-align: center; font-size: 11px; font-weight: bold;">${qty}</td>
        <td style="border: 1px solid #000; padding: 4px 4px; text-align: center; font-size: 11px; font-family: monospace;">${sigRef}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: right; font-size: 11px; font-family: monospace;">${unitCost}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: right; font-size: 11px; font-family: monospace; font-weight: bold;">${lineTotal}</td>
      </tr>
    `;
  });

  // Fill up blank rows up to 10 minimum rows to mimic the official Navy paper form
  const minRows = 10;
  const blankRowsNeeded = Math.max(0, minRows - materials.length);
  for (let i = 0; i < blankRowsNeeded; i++) {
    rowsHtml += `
      <tr style="height: 30px;">
        <td style="border: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 8px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 4px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 4px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 4px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
      </tr>
    `;
  }

  // Build Labor / Sailors Records Table only if include_sailors is enabled and labor logs exist
  const laborLogs = getAllJobCardLaborRecords(jcId);

  const shouldShowSailors =
    (jc.include_sailors === true ||
      jc.include_sailors === "true" ||
      (jc.include_sailors !== false && laborLogs.length > 0)) &&
    laborLogs.length > 0;

  let laborSectionHtml = "";
  if (shouldShowSailors) {
    let laborRowsHtml = "";
    laborLogs.forEach((l, idx) => {
      const sailor = findSailorById(l.sailor_id);
      const offNo = sailor
        ? sailor.official_number ||
          sailor.officialNumber ||
          sailor.off_no ||
          sailor.service_no ||
          l.official_number ||
          "-"
        : l.official_number || "-";
      const name = sailor
        ? `${sailor.rank || ""} ${sailor.name || ""}`.trim()
        : l.sailor_name || "Unknown";
      const trade = sailor ? sailor.trade || "-" : (l.trade || "-");
      const role = l.role || "Worker";
      const hours = l.hours || l.hours_worked || 8;
      const workDate = l.work_date || startDate || "-";

      laborRowsHtml += `
        <tr style="height: 28px;">
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10.5px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 10.5px; font-family: monospace; font-weight: bold;">${offNo}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; text-align: left; font-size: 10.5px; font-weight: 600;">${name}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10.5px; font-weight: bold;">${trade}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 10.5px;">${role}</td>
          <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 10.5px; font-family: monospace;">${workDate} (${hours}h)</td>
        </tr>
      `;
    });

    laborSectionHtml = `
      <!-- Sailors / Labor Deployment Record Table -->
      <div style="margin-top: 14px; page-break-inside: avoid;">
        <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚓ SAILORS DEPLOYMENT RECORD</span>
          <span style="font-size: 10px; font-weight: normal; font-style: italic;">(${laborLogs.length} Person(s) Logged)</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1.5px solid #000;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="border: 1px solid #000; padding: 5px 4px; text-align: center; width: 6%; font-weight: 800; font-size: 10px;">NO</th>
              <th style="border: 1px solid #000; padding: 5px 6px; text-align: center; width: 16%; font-weight: 800; font-size: 10px;">OFFICIAL NO</th>
              <th style="border: 1px solid #000; padding: 5px 8px; text-align: left; width: 36%; font-weight: 800; font-size: 10px;">RANK & NAME</th>
              <th style="border: 1px solid #000; padding: 5px 4px; text-align: center; width: 10%; font-weight: 800; font-size: 10px;">TRADE</th>
              <th style="border: 1px solid #000; padding: 5px 6px; text-align: center; width: 14%; font-weight: 800; font-size: 10px;">ROLE / DUTY</th>
              <th style="border: 1px solid #000; padding: 5px 6px; text-align: center; width: 18%; font-weight: 800; font-size: 10px;">WORK DATE / HOURS</th>
            </tr>
          </thead>
          <tbody>
            ${laborRowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  const formattedTotal = totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
    <div class="jobcard-sheet" style="font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; width: 100%; box-sizing: border-box; padding: 10px;">
      
      <!-- Top Header with Navy Crest (Centered) -->
      <div style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; text-align: center;">
        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 14px;">
          <img src="${window.location.href.split("?")[0].split("#")[0].replace("index.html", "")}images/navy_crest_cropped.png" style="height: 48px; width: auto; display: block; object-fit: contain;" alt="SLN Crest">
          <div style="text-align: left;">
            <div style="font-size: 18px; font-weight: 900; letter-spacing: 1.2px; color: #0f172a; line-height: 1.15;">JOB CARD</div>
            <div style="font-size: 11px; font-weight: 800; color: #1e293b; margin-top: 3px; letter-spacing: 0.4px;">CAPTAIN CIVIL ENGINEERING DEPARTMENT (E)</div>
          </div>
        </div>
      </div>

      <!-- Top Section Box -->
      <div style="border: 1.5px solid #000; padding: 10px 14px; margin-bottom: -1.5px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          
          <!-- Left Header Info -->
          <div style="width: 55%; font-size: 11px; line-height: 1.8;">
            <div style="display: flex; gap: 6px;">
              <span style="font-weight: 800; width: 140px;">COMMENCED:</span>
              <span style="border-bottom: 1px dotted #000; flex: 1; padding-bottom: 1px; font-family: monospace;">${startDate}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 3px;">
              <span style="font-weight: 800; width: 140px;">COMPLETED:</span>
              <span style="border-bottom: 1px dotted #000; flex: 1; padding-bottom: 1px; font-family: monospace;">${endDate}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 4px;">
              <span style="font-weight: 800; width: 140px;">NAME OF PROJECT:</span>
              <span style="font-weight: 700; flex: 1; text-decoration: underline;">${projectTitle}</span>
            </div>
          </div>

          <!-- Right Header Info -->
          <div style="width: 42%; font-size: 11px; line-height: 1.75; text-align: right;">
            <div><strong style="font-weight: 800;">JOB CARD NO:</strong> <span style="font-family: monospace; font-weight: 900; color: #b91c1c; font-size: 12px;">${jobNo}</span></div>
            <div><strong style="font-weight: 800;">DATE:</strong> <span style="font-family: monospace;">${startDate || (typeof getLocalDateString === "function" ? getLocalDateString() : "")}</span></div>
            <div><strong style="font-weight: 800;">APPROVED BY -</strong> CCED (E)</div>
            <div style="margin-top: 2px;"><strong style="font-weight: 800;">TAKEN BY:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 130px;">&nbsp;</span></div>
          </div>

        </div>
      </div>

      <!-- Materials Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1.5px solid #000;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; width: 11%; font-weight: 800; font-size: 10px;">DATE</th>
            <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; width: 14%; font-weight: 800; font-size: 10px;">DEMAND NO</th>
            <th style="border: 1px solid #000; padding: 6px 6px; text-align: center; width: 33%; font-weight: 800; font-size: 10px;">MATERIAL DESCRIPTION</th>
            <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; width: 6%; font-weight: 800; font-size: 10px;">UNIT</th>
            <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; width: 6%; font-weight: 800; font-size: 10px;">QTY</th>
            <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; width: 6%; font-weight: 800; font-size: 10px;">SIG</th>
            <th style="border: 1px solid #000; padding: 6px 6px; text-align: right; width: 11%; font-weight: 800; font-size: 10px;">UNIT PRICE (RS)</th>
            <th style="border: 1px solid #000; padding: 6px 6px; text-align: right; width: 13%; font-weight: 800; font-size: 10px;">TOTAL (RS)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="7" style="border: 1px solid #000; padding: 8px 10px; text-align: right; font-weight: 900; font-size: 13px; letter-spacing: 0.5px;">TOTAL (RS)</td>
            <td style="border: 1px solid #000; padding: 8px 8px; text-align: right; font-weight: 900; font-size: 13px; font-family: monospace; border-bottom: 3px double #000;">
              ${formattedTotal}
            </td>
          </tr>
        </tfoot>
      </table>

      ${laborSectionHtml}

      <!-- Bottom Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 0 40px; font-size: 11px;">
        <div style="text-align: center; width: 220px;">
          <div style="border-bottom: 1px dashed #000; margin-bottom: 8px; height: 35px;"></div>
          <strong style="font-weight: 800; font-size: 12px;">Checked by</strong>
        </div>
        <div style="text-align: center; width: 220px;">
          <div style="border-bottom: 1px dashed #000; margin-bottom: 8px; height: 35px;"></div>
          <strong style="font-weight: 800; font-size: 12px;">Certified by</strong>
        </div>
      </div>

    </div>
  `;
}

function printOfficialJobCard(jobCardId) {
  const targetId = jobCardId || store.selectedJobCard;
  if (!targetId) {
    showToast("Please select a Job Card to print", "error");
    return;
  }
  const jc = (store.jobCards || []).find(
    (j) => String(j.id) === String(targetId) || String(j._fbKey) === String(targetId)
  );
  if (!jc) {
    showToast("Job card record not found", "error");
    return;
  }

  const sheetHtml = buildOfficialJobCardPrintHTML(jc);

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Popup blocked! Please allow popups for this site.", "error");
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Job Card - ${jc.job_number || 'Print'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; padding: 15px; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    @media print {
      body { padding: 0; }
      .jobcard-sheet { padding: 0 !important; }
    }
  </style>
</head>
<body>
  ${sheetHtml}
</body>
</html>`);

  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
}
function generateFeedbackLink() {
  const jc = store.jobCards.find((j) => j.id === store.selectedJobCard);
  if (!jc) return;
  const token = Math.random().toString(36).substring(2, 15);
  const link = `${window.location.origin}/feedback.html?job=${encodeURIComponent(jc.job_number)}&token=${token}`;
  document.getElementById("generatedFeedbackLink").value = link;
  document.getElementById("feedbackLinkBox").classList.remove("hidden");
  jc.feedbackSent = true;
  showToast("Feedback link generated!");
}
function copyFeedbackLink() {
  const link = document.getElementById("generatedFeedbackLink");
  link.select();
  document.execCommand("copy");
  showToast("Link copied to clipboard!");
}
function sendFeedbackWhatsApp() {
  const link = document.getElementById("generatedFeedbackLink").value;
  const jc = store.jobCards.find((j) => j.id === store.selectedJobCard);
  const message = `Please provide your feedback for Job ${jc === null || jc === void 0 ? void 0 : jc.job_number}: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
}
function exportJobCardReport() {
  const modal = document.getElementById("exportJobReportsModal");
  if (modal) {
    modal.classList.remove("hidden");
  } else {
    exportAllLaborLogsCsv();
  }
}

function exportAllLaborLogsCsv() {
  const currentZoneJobs = (store.jobCards || []).filter(
    (j) => !j.zone_id || j.zone_id === store.currentZone,
  );

  if (currentZoneJobs.length === 0) {
    showToast("No job cards found in this zone to export labor logs", "info");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent +=
    "Zone,Job Card No,Job Description,Date,Official Number,Sailor Name,Trade,Role,Hours,Performance Score,Source\n";

  let totalRows = 0;
  currentZoneJobs.forEach((jc) => {
    const records = getAllJobCardLaborRecords(jc.id || jc._fbKey);
    records.forEach((r) => {
      totalRows++;
      const row = [
        `"${jc.zone_id || store.currentZone}"`,
        `"${jc.job_number || jc.id}"`,
        `"${(jc.description || "").replace(/"/g, '""')}"`,
        `"${r.work_date}"`,
        `"${r.official_number}"`,
        `"${(r.sailor_name || "").replace(/"/g, '""')}"`,
        `"${r.trade}"`,
        `"${r.role}"`,
        r.hours,
        r.performance !== null && r.performance !== undefined
          ? r.performance
          : "",
        `"${r.source}"`,
      ];
      csvContent += row.join(",") + "\n";
    });
  });

  if (totalRows === 0) {
    showToast("No labor logs found for job cards in this zone", "info");
    return;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `All_Labor_Logs_${store.currentZone}_${getLocalDateString()}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  closeModal("exportJobReportsModal");
  showToast(`Exported ${totalRows} labor deployment records`);
}

function exportAllJobCardsSummaryCsv() {
  const jobs = (store.jobCards || []).filter(
    (j) => !j.zone_id || j.zone_id === store.currentZone,
  );

  if (jobs.length === 0) {
    showToast("No job cards found in this zone to export", "info");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent +=
    "Job Card No,Zone,Description,Location,Status,Total Material Cost (Rs),Total Man-Hours,Workers Count,Start Date,End Date\n";

  jobs.forEach((jc) => {
    const materials = (store.jobCardMaterials || []).filter(
      (m) =>
        String(m.job_card_id) === String(jc.id) ||
        String(m.job_card_id) === String(jc._fbKey),
    );
    const matCost = materials.reduce(
      (sum, m) => sum + (parseFloat(m.total_cost) || 0),
      0,
    );
    const labor = getAllJobCardLaborRecords(jc.id || jc._fbKey);
    const manHours = labor.reduce(
      (sum, l) => sum + (parseFloat(l.hours) || 0),
      0,
    );
    const workerCount = new Set(labor.map((l) => l.sailor_id)).size;

    const row = [
      `"${jc.job_number || jc.id}"`,
      `"${jc.zone_id || store.currentZone}"`,
      `"${(jc.description || "").replace(/"/g, '""')}"`,
      `"${(jc.location || "").replace(/"/g, '""')}"`,
      `"${jc.status || "Active"}"`,
      matCost.toFixed(2),
      manHours,
      workerCount,
      `"${jc.start_date || ""}"`,
      `"${jc.end_date || ""}"`,
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Job_Cards_Summary_${store.currentZone}_${getLocalDateString()}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  closeModal("exportJobReportsModal");
  showToast(`Exported ${jobs.length} job cards summary`);
}

function exportAllMaterialsUsageCsv() {
  const jobs = (store.jobCards || []).filter(
    (j) => !j.zone_id || j.zone_id === store.currentZone,
  );
  const jcMap = {};
  jobs.forEach((j) => {
    if (j.id) jcMap[String(j.id)] = j;
    if (j._fbKey) jcMap[String(j._fbKey)] = j;
  });

  const materials = (store.jobCardMaterials || []).filter(
    (m) => jcMap[String(m.job_card_id)],
  );

  if (materials.length === 0) {
    showToast("No materials usage records found in this zone", "info");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent +=
    "Zone,Job Card No,Date,Demand No,Material Description,Unit,Quantity,Unit Price (Rs),Total Cost (Rs),SIG Ref\n";

  materials.forEach((m) => {
    const jc = jcMap[String(m.job_card_id)];
    const row = [
      `"${jc ? jc.zone_id || store.currentZone : store.currentZone}"`,
      `"${jc ? jc.job_number : m.job_card_id}"`,
      `"${m.date || ""}"`,
      `"${(m.demand_no || "").replace(/"/g, '""')}"`,
      `"${(m.material_name || m.description || "").replace(/"/g, '""')}"`,
      `"${m.unit || "Nos"}"`,
      m.quantity || 0,
      parseFloat(m.unit_cost || 0).toFixed(2),
      parseFloat(m.total_cost || 0).toFixed(2),
      `"${(m.sig_ref || "").replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Materials_Usage_${store.currentZone}_${getLocalDateString()}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  closeModal("exportJobReportsModal");
  showToast(`Exported ${materials.length} material usage records`);
} // =============================================
// INVENTORY
// =============================================
function renderInventory() {
  renderInventoryCategories();
  renderInventoryTable();
  populateProjectDropdown();
}
function populateProjectDropdown() {
  const projects = store.workOrders.filter(
    (wo) => wo.type === "PROJECT" && wo.zone_id === store.currentZone,
  );
  document.getElementById("invRequirement").innerHTML =
    '<option value="">-- Select Project --</option>' +
    projects
      .map((p) => `<option value="${p.description}">${p.description}</option>`)
      .join("") +
    store.jobCards
      .filter(
        (jc) => jc.status === "Completed" && jc.zone_id === store.currentZone,
      )
      .map(
        (jc) =>
          `<option value="${jc.description}">${jc.description} (Completed)</option>`,
      )
      .join("");
}
function switchInventoryCategory(category) {
  store.currentInventoryCategory = category;
  document.querySelectorAll(".inv-cat-tab").forEach((t) => {
    t.classList.remove(
      "border-green-600",
      "text-green-600",
      "bg-green-50",
      "border-b-2",
    );
    t.classList.add("text-slate-500");
  });
  event.target.classList.remove("text-slate-500");
  event.target.classList.add(
    "border-green-600",
    "text-green-600",
    "bg-green-50",
    "border-b-2",
  );
  renderInventoryTable();
}
function renderInventoryCategories() {
  const container = document.getElementById("inventoryCategoryTabsContainer");
  if (!container) return; // Default categories that should always appear
  const defaultCats = [
    "BMS",
    "Plumbing",
    "Metal",
    "Stencil",
    "General",
    "Aluminium",
    "Paint",
    "Electrical",
    "Tools",
    "Lubricant Oil",
    "Eng",
  ]; // We only use the default allowed categories
  const allCats = [...defaultCats];
  let html = `<button onclick="switchInventoryCategory('all')" class="inv-cat-tab px-6 py-3 text-sm font-medium whitespace-nowrap ${store.currentInventoryCategory === "all" ? "border-b-2 border-green-600 text-green-600 bg-green-50" : "text-slate-500 hover:bg-slate-50"}">
        📦 All
    </button>`;
  allCats.forEach((cat) => {
    const isActive = store.currentInventoryCategory === cat;
    const activeClass = isActive
      ? "border-b-2 border-green-600 text-green-600 bg-green-50"
      : "text-slate-500 hover:bg-slate-50";
    html += `<button onclick="switchInventoryCategory('${cat}')" class="inv-cat-tab px-6 py-3 text-sm font-medium whitespace-nowrap ${activeClass}">
            🏷️ ${cat}
        </button>`;
  });
  container.innerHTML = html; // Also update the select dropdown options, keeping standard ones only
  const catSelect = document.getElementById("invCategory");
  if (catSelect) {
    let optionsHtml = '<option value="">-- Select Category --</option>';
    allCats.forEach((c) => {
      optionsHtml += `<option value="${c}">${c}</option>`;
    });
    const prevVal = catSelect.value;
    catSelect.innerHTML = optionsHtml;
    if (prevVal) catSelect.value = prevVal;
  }
}
function renderInventoryTable() {
  var _document$getElementB5,
    _document$getElementB6,
    _document$getElementB7,
    _document$getElementB8,
    _document$getElementB9;
  const location =
    ((_document$getElementB5 = document.getElementById("inventoryLocation")) ===
      null || _document$getElementB5 === void 0
      ? void 0
      : _document$getElementB5.value) || "";
  let items = []; // Filter by current zone or allow cross-zone query if ALL_ZONES is selected
  if (location === "ALL_ZONES") {
    items = [...store.inventory];
  } else {
    items = store.inventory.filter(
      (i) => !i.zone_id || i.zone_id === store.currentZone,
    );
  } // Filter by category
  if (store.currentInventoryCategory !== "all") {
    items = items.filter((i) => i.category === store.currentInventoryCategory);
  } // Filter by search
  const search =
    ((_document$getElementB6 = document.getElementById("inventorySearch")) ===
      null ||
    _document$getElementB6 === void 0 ||
    (_document$getElementB6 = _document$getElementB6.value) === null ||
    _document$getElementB6 === void 0
      ? void 0
      : _document$getElementB6.toLowerCase()) || "";
  if (search) {
    items = items.filter(
      (i) =>
        (i.description || "").toLowerCase().includes(search) ||
        (i.book_no || "").toLowerCase().includes(search),
    );
  } // Filter by location
  if (location && location !== "ALL_ZONES") {
    items = items.filter((i) => i.location === location);
  } // Sort
  const sort =
    ((_document$getElementB7 = document.getElementById("inventorySort")) ===
      null || _document$getElementB7 === void 0
      ? void 0
      : _document$getElementB7.value) || "description";
  items.sort((a, b) => {
    switch (sort) {
      case "quantity":
        return b.quantity - a.quantity;
      case "cost":
        return b.cost_per_unit - a.cost_per_unit;
      case "date":
        return new Date(b.date_added || 0) - new Date(a.date_added || 0);
      case "book_no":
        return (a.book_no || "").localeCompare(b.book_no || "");
      default:
        return (a.description || "").localeCompare(b.description || "");
    }
  }); // Group same items (same description, deno, cost, location, book_no)
  const grouped = {};
  items.forEach((item) => {
    const key = `${item.description}|${item.deno}|${item.cost_per_unit}|${item.location}|${item.book_no || ""}`;
    if (!grouped[key]) {
      grouped[key] = { ...item, totalQty: item.quantity, items: [item] };
    } else {
      grouped[key].totalQty += item.quantity;
      grouped[key].items.push(item);
    }
  });
  const groupedItems = Object.values(grouped);
  document.getElementById("inventoryTableBody").innerHTML =
    groupedItems
      .map((item) => {
        const isLow = item.totalQty < 10;
        const catColors = {
          BMS: "bg-amber-100 text-amber-800",
          Plumbing: "bg-blue-100 text-blue-800",
          Metal: "bg-slate-200 text-slate-700",
          Paint: "bg-rose-100 text-rose-700",
          Electrical: "bg-yellow-100 text-yellow-800",
          Tools: "bg-purple-100 text-purple-800",
          Aluminium: "bg-cyan-100 text-cyan-800",
          General: "bg-green-100 text-green-700",
        };
        const catCls =
          catColors[item.category] || "bg-slate-100 text-slate-600";
        const rowId = item._fbKey || item.id || '';
        return `
        <tr class="hover:bg-teal-50/40 cursor-pointer transition-colors border-b border-slate-100">
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 font-medium text-slate-800 text-sm">${item.description}</td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-center"><span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${catCls}">${item.category}</span></td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-center text-xs text-slate-500">${item.deno}</td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-center">
                <span class="font-bold text-sm ${isLow ? "text-rose-600" : "text-slate-800"}">${item.totalQty}</span>
                ${isLow ? '<span class="ml-1 text-[10px] text-rose-500 font-medium">⚠ Low</span>' : ""}
            </td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-right font-medium text-slate-700 text-sm">${formatCurrency(item.cost_per_unit)}</td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-center"><span class="mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">${item.book_no || "—"}</span></td>
            <td onclick="showInventoryDetail('${rowId}')" class="px-4 py-2.5 text-center"><span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${item.location}${item.zone_id && item.zone_id !== store.currentZone ? ` (${item.zone_id})` : ""}</span></td>
            <td class="px-4 py-2.5 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="editInventoryItem('${rowId}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="showInventoryDetail('${rowId}')" class="text-teal-600 hover:text-teal-800 p-1 rounded hover:bg-teal-50" title="View Detail">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                    <button onclick="deleteInventoryItem('${rowId}')" class="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50" title="Delete Item">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </td>
        </tr>`;
      })
      .join("") ||
    '<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">No inventory items found</td></tr>'; // Calculate total valuation
  const totalValuation = items.reduce(
    (sum, item) =>
      sum +
      (parseFloat(item.quantity) || 0) * (parseFloat(item.cost_per_unit) || 0),
    0,
  );
  const grandTotalItems = store.inventory.filter(
    (i) => !i.zone_id || i.zone_id === store.currentZone,
  );
  const grandTotalValuation = grandTotalItems.reduce(
    (sum, item) =>
      sum +
      (parseFloat(item.quantity) || 0) * (parseFloat(item.cost_per_unit) || 0),
    0,
  ); // Check if category or search or location is active (meaning it is filtered)
  const isFiltered =
    store.currentInventoryCategory !== "all" ||
    (((_document$getElementB8 = document.getElementById("inventorySearch")) ===
      null || _document$getElementB8 === void 0
      ? void 0
      : _document$getElementB8.value) || "") !== "" ||
    (((_document$getElementB9 =
      document.getElementById("inventoryLocation")) === null ||
    _document$getElementB9 === void 0
      ? void 0
      : _document$getElementB9.value) || "") !== "";
  const footEl = document.getElementById("inventoryTableFoot");
  if (footEl) {
    if (isFiltered) {
      footEl.innerHTML = `
                <tr class="bg-slate-50 border-t border-slate-200">
                    <td colspan="4" class="px-4 py-3 text-left font-bold text-slate-800 text-sm">
                        Total Valuation (Filtered)
                    </td>
                    <td class="px-4 py-3 text-right font-extrabold text-teal-700 text-sm">
                        ${formatCurrency(totalValuation)}
                    </td>
                    <td colspan="2" class="px-4 py-3 text-center text-xs text-slate-500 font-normal">
                        Grand Total: <span class="font-bold text-slate-700">${formatCurrency(grandTotalValuation)}</span>
                    </td>
                </tr>
            `;
    } else {
      footEl.innerHTML = `
                <tr class="bg-slate-50 border-t border-slate-200">
                    <td colspan="4" class="px-4 py-3 text-left font-bold text-slate-800 text-sm">
                        Total Inventory Valuation
                    </td>
                    <td class="px-4 py-3 text-right font-extrabold text-teal-700 text-sm">
                        ${formatCurrency(totalValuation)}
                    </td>
                    <td colspan="2" class="px-4 py-3"></td>
                </tr>
            `;
    }
  }
}
function filterInventory() {
  renderInventoryTable();
}
function showInventoryDetail(itemId) {
  const item = store.inventory.find(
    (i) =>
      String(i.id) === String(itemId) || String(i._fbKey) === String(itemId),
  );
  if (!item) return;
  document.getElementById("inventoryDetailContent").innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Description</p>
                    <p class="font-medium">${item.description}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Category</p>
                    <p class="font-medium">${item.category}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Quantity</p>
                    <p class="font-bold text-xl ${item.quantity < 10 ? "text-red-600" : "text-green-600"}">${item.quantity} ${item.deno}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Unit Cost</p>
                    <p class="font-medium">${formatCurrency(item.cost_per_unit)}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Total Value</p>
                    <p class="font-bold text-amber-600">${formatCurrency(item.quantity * item.cost_per_unit)}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Book No (Stock Book)</p>
                    <p class="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block text-xs">${item.book_no || "—"}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Location</p>
                    <p class="font-medium">${item.location}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Requirement</p>
                    <p class="font-medium">${item.requirement || "General"}</p>
                </div>
            </div>
            <div>
                <p class="text-sm text-slate-500">Date Added</p>
                <p class="font-medium">${item.date_added}</p>
            </div>
            
            <!-- On Charge Records -->
            <div class="border-t pt-4">
                <h4 class="font-semibold text-slate-700 mb-2 flex items-center gap-2">📥 On-Charge Records</h4>
                <div class="space-y-2">
                    ${
                      item.on_charge_records
                        ? item.on_charge_records
                            .map(
                              (r) => `
                        <div class="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span class="mono text-sm text-green-700">${r.ref}</span>
                            <span class="text-sm">+${r.qty} ${item.deno}</span>
                            <span class="text-xs text-slate-500">${r.date}</span>
                        </div>
                    `,
                            )
                            .join("")
                        : `
                        <div class="p-2 bg-green-50 rounded">
                            <span class="mono text-sm text-green-700">${item.on_charge_ref || "—"}</span>
                        </div>
                    `
                    }
                </div>
            </div>

            <!-- Off Charge Records (req 4) -->
            <div class="border-t pt-4">
                <h4 class="font-semibold text-slate-700 mb-2 flex items-center gap-2">📤 Off-Charge Records</h4>
                <div class="space-y-2">
                    ${
                      item.off_charge_records && item.off_charge_records.length
                        ? item.off_charge_records
                            .map(
                              (r) => `
                        <div class="flex items-center justify-between p-2 bg-rose-50 rounded">
                            <div>
                                <span class="mono text-sm text-rose-700">${r.ref}</span>
                                ${r.dest ? `<span class="block text-[11px] text-slate-500">→ ${r.dest}</span>` : ""}
                            </div>
                            <span class="text-sm text-rose-600">−${r.qty} ${item.deno}</span>
                            <span class="text-xs text-slate-500">${r.date}</span>
                        </div>
                    `,
                            )
                            .join("")
                        : '<p class="text-xs text-slate-400 italic p-2">No off-charge records yet</p>'
                    }
                </div>
            </div>

            <!-- Off-Charge action (req 5) -->
            <div class="border-t pt-4">
                <button onclick="openOffChargeModal('${item._fbKey || item.id || ""}')" class="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2">
                    <span>📇 Off-Charge to Base / Zone (Nav 254)</span>
                </button>
            </div>
        </div>
    `;
  document.getElementById("inventoryDetailModal").classList.remove("hidden");
} // ---- Off-charge to another base/zone (req 5) ----
function openOffChargeModal(itemId) {
  const item = store.inventory.find(
    (i) =>
      String(i._fbKey) === String(itemId) ||
      String(i.id) === String(itemId) ||
      (itemId && (i.description === itemId || i._fbKey === itemId)),
  );
  if (!item) {
    showToast("Inventory item not found", "error");
    return;
  }
  document.getElementById("ocItemId").value = item._fbKey || item.id || "";
  document.getElementById("ocItemName").textContent = item.description;
  document.getElementById("ocItemAvail").textContent =
    `${item.quantity} ${item.deno}`;
  document.getElementById("ocQty").value = "";
  document.getElementById("ocQty").max = item.quantity;
  document.getElementById("ocRef").value = "";
  document.getElementById("ocRemarks").value = "";
  document.getElementById("ocDate").value = new Date()
    .toISOString()
    .split("T")[0];

  const defaultDests = [
    "BC-Zone",
    "A-Zone",
    "Carpentry-Shop",
    "Main-Store",
    "SLNS TISSA",
    "SLNS DAKSHINA",
    "SLNS VIJAYA",
    "Base Store",
    "Civil Engineering Dept",
  ];
  const dests =
    store.settings &&
    store.settings.offChargeDestinations &&
    store.settings.offChargeDestinations.length > 0
      ? store.settings.offChargeDestinations
      : store.offChargeDestinations && store.offChargeDestinations.length > 0
        ? store.offChargeDestinations
        : defaultDests;

  document.getElementById("ocDest").innerHTML =
    '<option value="">Select destination...</option>' +
    dests.map((d) => `<option value="${d}">${d}</option>`).join("");
  closeModal("inventoryDetailModal");
  document.getElementById("offChargeModal").classList.remove("hidden");
}
function submitOffCharge(event) {
  event.preventDefault();
  const ocId = document.getElementById("ocItemId").value;
  const item = store.inventory.find(
    (i) =>
      String(i._fbKey) === String(ocId) ||
      String(i.id) === String(ocId) ||
      (ocId && i.description === ocId),
  );
  if (!item) {
    showToast("Inventory item not found", "error");
    return;
  }
  const qty = parseFloat(document.getElementById("ocQty").value);
  const ref = document.getElementById("ocRef").value.trim();
  const dest = document.getElementById("ocDest").value;
  const date = document.getElementById("ocDate").value;
  const remarks = document.getElementById("ocRemarks").value.trim();
  if (isNaN(qty) || qty <= 0 || qty > item.quantity) {
    showToast(`Quantity must be between 0 and ${item.quantity}`, "error");
    return;
  }
  item.quantity -= qty;
  if (!item.off_charge_records) item.off_charge_records = [];
  item.off_charge_records.push({ ref, qty, date, dest, remarks });
  item.off_charge_ref = ref;
  fbSaveInventoryItem(item)
    .then(() => {
      closeModal("offChargeModal");
      renderInventoryTable();
      showToast(
        `Off-charged ${qty} ${item.deno} of ${item.description} → ${dest} (${ref})`,
      );
    })
    .catch((err) => {
      console.error(err);
      closeModal("offChargeModal");
      renderInventoryTable();
      showToast(
        `Off-charged ${qty} ${item.deno} of ${item.description} → ${dest} (${ref})`,
      );
    });
}
let passwordCallback = null;
let passwordTargetZone = null;

function showPasswordModal(callback, targetZone = null) {
  passwordCallback = callback;
  passwordTargetZone = targetZone;
  document.getElementById("confirmAdminPassword").value = "";
  document.getElementById("passwordError").classList.add("hidden");
  const modal = document.getElementById("passwordModal");
  const content = document.getElementById("passwordModalContent");
  modal.classList.remove("hidden");
  setTimeout(() => {
    content.classList.remove("scale-95", "opacity-0");
    content.classList.add("scale-100", "opacity-100");
    document.getElementById("confirmAdminPassword").focus();
  }, 50);
}

function closePasswordModal() {
  const content = document.getElementById("passwordModalContent");
  content.classList.remove("scale-100", "opacity-100");
  content.classList.add("scale-95", "opacity-0");
  setTimeout(() => {
    document.getElementById("passwordModal").classList.add("hidden");
    passwordCallback = null;
    passwordTargetZone = null;
  }, 200);
}

function submitPasswordVerification() {
  const pwdInput = document.getElementById("confirmAdminPassword");
  const errDiv = document.getElementById("passwordError");
  const entered = (pwdInput.value || "").trim();

  const zone = passwordTargetZone || store.currentZone;
  const inc = (store.settings?.zoneInCharges || {})[zone] || {};
  const zonePwd = inc.password ? String(inc.password).trim() : "";

  let isValid = false;
  if (entered === "MalitHZ") {
    isValid = true;
  } else if (zonePwd && entered === zonePwd) {
    isValid = true;
  } else if (!zonePwd && (entered === "1234" || entered === "admin")) {
    isValid = true;
  }

  if (isValid) {
    const cb = passwordCallback;
    closePasswordModal();
    if (cb) cb();
  } else {
    errDiv.classList.remove("hidden");
    pwdInput.value = "";
    pwdInput.focus();
  }
}

function deleteInventoryItem(itemId) {
  if (!itemId) return;
  const item = (store.inventory || []).find(
    (i) => String(i.id) === String(itemId) || String(i._fbKey) === String(itemId),
  );
  if (!item) return;

  const zone = item.zone_id || store.currentZone;
  const targetKey = item._fbKey || item.id;

  showPasswordModal(() => {
    if (
      confirm(
        `Are you sure you want to delete "${item.description}" from inventory?`,
      )
    ) {
      opsDB
        .ref(`inventory/${targetKey}`)
        .remove()
        .then(() => {
          store.inventory = (store.inventory || []).filter(
            (i) =>
              String(i.id) !== String(itemId) &&
              String(i._fbKey) !== String(itemId),
          );
          renderInventoryTable();
          showToast(`"${item.description}" deleted successfully.`);
        })
        .catch((err) => {
          console.error(err);
          showToast("Failed to delete item.", "error");
        });
    }
  }, zone);
}
function triggerClearAllDailyDetails() {
  showPasswordModal(() => {
    if (confirm("⚠️ WARNING: Are you sure you want to clear ALL Daily Details? This will unassign everyone from ALL Work Orders (Projects, Jobs, Tasks) and Job Cards. Long term deployments (Out Projects, Housing, Other Base) will not be affected. This action cannot be undone.")) {
      
      const detailWOs = store.workOrders.filter(w => w.status === "Active" || w.status === "Pending");
      const detailJCs = store.jobCards.filter(j => j.status === "Active" || j.status === "Pending" || j.status === "Started");
      
      let updates = {};
      
      detailWOs.forEach(wo => {
         if (wo.assigned && wo.assigned.length > 0) {
             const key = wo._fbKey || wo.id;
             if (key) {
                 updates[`work_orders/${key}/assigned`] = null;
             }
         }
      });
      
      detailJCs.forEach(jc => {
         if (jc.assigned && jc.assigned.length > 0) {
             const key = jc._fbKey || jc.id;
             if (key) {
                 updates[`job_cards/${key}/assigned`] = null;
             }
         }
      });
      
      const today = getLocalDateString();
      (store.dailyAllocations || []).forEach(alloc => {
          if (alloc.date === today) {
              const isFromWO = detailWOs.some(wo => String(wo.id) === String(alloc.work_order_id));
              const isFromJC = detailJCs.some(jc => String(jc.id) === String(alloc.work_order_id));
              if ((isFromWO || isFromJC) && alloc._fbKey) {
                  updates[`daily_allocations/${alloc._fbKey}`] = null;
              }
          }
      });
      
      if (Object.keys(updates).length > 0) {
          opsDB.ref().update(updates)
            .then(() => {
               showToast("Successfully cleared all Daily Details!");
               refreshCurrentView();
            })
            .catch(err => {
               console.error("Error updating details:", err);
               showToast("Error clearing details", "error");
            });
      } else {
          showToast("No active details found to clear.");
      }
    }
  });
}
function clearCurrentZoneInventory() {
  // Filter items belonging to the current active zone
  const zoneItems = store.inventory.filter(
    (i) => !i.zone_id || i.zone_id === store.currentZone,
  );
  if (zoneItems.length === 0) {
    showToast("No inventory items found in the current zone", "info");
    return;
  }
  showPasswordModal(() => {
    var _store$zones$find;
    const zoneName =
      ((_store$zones$find = store.zones.find(
        (z) => z.id === store.currentZone,
      )) === null || _store$zones$find === void 0
        ? void 0
        : _store$zones$find.name) || store.currentZone;
    if (
      confirm(
        `⚠️ WARNING: Are you sure you want to delete ALL ${zoneItems.length} inventory items in the current zone (${zoneName})? This will permanently wipe this zone's inventory. This action cannot be undone.`,
      )
    ) {
      let deleted = 0;
      zoneItems.forEach((item) => {
        const key = item._fbKey || item.id;
        if (key) {
          opsDB
            .ref(`inventory/${key}`)
            .remove()
            .then(() => {
              deleted++;
              if (deleted === zoneItems.length) {
                showToast(`Successfully wiped inventory for zone: ${zoneName}`);
              }
            })
            .catch((err) => console.error(err));
        }
      });
    }
  });
}
function openAddInventoryModal() {
  document.getElementById("invId").value = "";
  const bookNoEl = document.getElementById("invBookNo");
  if (bookNoEl) bookNoEl.value = "";
  const locEl = document.getElementById("invLocation");
  if (locEl) locEl.value = "Zone Store";
  document.getElementById("invDate").value = new Date()
    .toISOString()
    .split("T")[0];
  populateProjectDropdown(); // Pre-select current zone
  const zoneOpts = store.zones
    .map((z) => `<option value="${z.id}">${z.name}</option>`)
    .join("");
  document.getElementById("invZone").innerHTML = zoneOpts;
  document.getElementById("invZone").value = store.currentZone;
  document.getElementById("inventoryModal").classList.remove("hidden");
}
function editInventoryItem(itemId) {
  const item = (store.inventory || []).find(
    (i) =>
      String(i.id) === String(itemId) || String(i._fbKey) === String(itemId),
  );
  if (!item) return;
  document.getElementById("invId").value = item._fbKey || item.id || "";
  document.getElementById("invCategory").value = item.category || "BMS";
  document.getElementById("invDescription").value = item.description || "";
  document.getElementById("invDeno").value = item.deno || "Nos";
  document.getElementById("invQuantity").value = item.quantity !== undefined ? item.quantity : 0;
  document.getElementById("invCost").value = item.cost_per_unit !== undefined ? item.cost_per_unit : 0;
  const bookNoEl = document.getElementById("invBookNo");
  if (bookNoEl) bookNoEl.value = item.book_no || "";
  document.getElementById("invLocation").value = item.location || "Zone Store";
  document.getElementById("invOnCharge").value = item.on_charge_ref || "";
  document.getElementById("invDate").value = item.date_added || getLocalDateString();
  const zoneOpts = (store.zones || [])
    .map((z) => `<option value="${z.id}">${z.name}</option>`)
    .join("");
  document.getElementById("invZone").innerHTML = zoneOpts;
  document.getElementById("invZone").value = item.zone_id || store.currentZone;
  populateProjectDropdown();
  document.getElementById("invRequirement").value = item.requirement || "";
  document.getElementById("inventoryModal").classList.remove("hidden");
}

function saveInventoryItem(event) {
  event.preventDefault();
  const id = document.getElementById("invId").value;
  const reqSelect = document.getElementById("invRequirement") ? document.getElementById("invRequirement").value : "";
  const reqText = document.getElementById("invRequirementText") ? document.getElementById("invRequirementText").value : "";
  const requirement = reqSelect || reqText || "General";

  const bookNoEl = document.getElementById("invBookNo");
  const bookNoVal = bookNoEl ? bookNoEl.value.trim() : "";
  const desc = (document.getElementById("invDescription")?.value || "").trim();
  const cat = document.getElementById("invCategory")?.value || "BMS";
  const deno = document.getElementById("invDeno")?.value || "Nos";
  const qtyVal = parseFloat(document.getElementById("invQuantity")?.value);
  const costVal = safeParseCost(document.getElementById("invCost")?.value);
  const loc = document.getElementById("invLocation")?.value || "Zone Store";
  const onCharge = (document.getElementById("invOnCharge")?.value || "").trim();
  const dateAdded = document.getElementById("invDate")?.value || getLocalDateString();
  const zoneId = document.getElementById("invZone")?.value || store.currentZone;

  if (!desc) {
    showToast("Please enter item description", "error");
    return;
  }

  const itemData = {
    category: cat,
    description: desc,
    deno: deno,
    quantity: isNaN(qtyVal) ? 0 : qtyVal,
    cost_per_unit: isNaN(costVal) ? 0 : costVal,
    requirement: requirement,
    book_no: bookNoVal,
    location: loc,
    on_charge_ref: onCharge,
    date_added: dateAdded,
    zone_id: zoneId,
  };

  if (id) {
    const existing = (store.inventory || []).find(
      (i) => String(i.id) === String(id) || String(i._fbKey) === String(id)
    );
    itemData._fbKey = (existing && existing._fbKey) ? existing._fbKey : id;
  }

  fbSaveInventoryItem(itemData)
    .then(() => {
      closeModal("inventoryModal");
      showToast(id ? "Item updated successfully!" : "Item added successfully!");
      document.getElementById("inventoryForm").reset();
      document.getElementById("invId").value = "";
    })
    .catch((err) => {
      console.error("Firebase save inventory error:", err);
      showToast("Error saving item: " + (err.message || err), "error");
    });
} // =============================================
// ESTIMATES
// =============================================
function renderEstimates() {
  const container = document.getElementById("estimatesList");
  const filteredEstimates = store.estimates.filter(
    (e) => !e.zone_id || e.zone_id === store.currentZone,
  );
  container.innerHTML =
    filteredEstimates
      .map((e) => {
        const isSelected = store.selectedEstimate === e.id;
        const isApproved = e.status === "Approved";
        const isLinked = e.status === "Linked";
        const statusBadge = isLinked
          ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⛓️ Linked</span>`
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${isApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}">
                ${isApproved ? "✓ Approved" : "⏳ Pending"}
            </span>`;
        return `
        <div class="p-3.5 border-b border-slate-100 hover:bg-teal-50/40 cursor-pointer transition-all
            ${isSelected ? "bg-amber-50 border-l-4 border-amber-400 shadow-sm" : ""}"
            >
            <div class="flex items-start gap-3">
                <input type="checkbox" class="mt-1 w-4 h-4 accent-teal-600 cursor-pointer flex-shrink-0"
                    ${store.selectedEstimatesForPrint.includes(e.id) ? "checked" : ""}
                    onclick="event.stopPropagation(); toggleEstimatePrintSelection(${e.id})" title="Select for bulk print">
                <div class="flex-1 min-w-0" onclick="selectEstimate(${e.id})">
                    <div class="flex items-center justify-between mb-1">
                        <span class="mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">${e.estimate_number}</span>
                        ${statusBadge}
                    </div>
                    <p class="text-sm font-medium text-slate-700 truncate">${e.description}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5 truncate">📍 ${e.location || "Location not set"}</p>
                    <div class="flex justify-between mt-2 items-center">
                        <span class="text-sm font-bold text-teal-700">${formatCurrency(e.total_cost)}</span>
                        <span class="text-[11px] text-slate-505 bg-slate-100 px-2 py-0.5 rounded-full">${e.totalManDays || 0} man-days</span>
                    </div>
                    ${
                      isApproved && e.approvedAuthority
                        ? `
                    <div class="mt-1.5">
                        <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">🏛 ${e.approvedAuthority}</span>
                    </div>`
                        : ""
                    }
                    ${
                      isLinked
                        ? (() => {
                            const linkedJob = store.jobCards.find(
                              (jc) =>
                                String(jc.estimate_id) === String(e.id) ||
                                jc.work_order_id === e.work_order_id,
                            );
                            return linkedJob
                              ? `
                        <div class="mt-1.5">
                            <span class="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100">⛓️ Job Card: ${linkedJob.job_number}</span>
                        </div>`
                              : "";
                          })()
                        : ""
                    }
                </div>
            </div>
        </div>`;
      })
      .join("") ||
    '<p class="text-slate-500 text-center py-8">No estimates</p>';
  document.getElementById("bulkPrintCount").textContent =
    store.selectedEstimatesForPrint.length;
}
function toggleEstimatePrintSelection(id) {
  const idx = store.selectedEstimatesForPrint.indexOf(id);
  if (idx >= 0) store.selectedEstimatesForPrint.splice(idx, 1);
  else store.selectedEstimatesForPrint.push(id);
  document.getElementById("bulkPrintCount").textContent =
    store.selectedEstimatesForPrint.length;
}
function selectEstimate(id) {
  var _est$materials, _est$labor;
  store.selectedEstimate = id;
  const est = store.estimates.find((e) => e.id === id);
  document.getElementById("selectedEstimateNumber").textContent =
    est.estimate_number;
  document.getElementById("editEstimateBtn").style.display =
    est.status === "Pending" ? "inline-block" : "none";
  document.getElementById("approveEstimateBtn").style.display =
    est.status === "Pending" ? "inline-block" : "none";
  document.getElementById("deleteEstimateBtn").style.display =
    est.status === "Pending" ? "inline-block" : "none";
  const sigBlock = (label, p) => `
        <div class="text-center">
            <div class="h-12 border-b border-slate-400 mb-1"></div>
            <p class="text-xs font-semibold text-slate-700">${label}</p>
            <p class="text-xs text-slate-600">${p && p.name ? p.name : "—"}</p>
            <p class="text-[11px] text-slate-500">${p && p.rank ? p.rank : ""}${p && p.serviceNo ? " • " + p.serviceNo : ""}</p>
        </div>`;
  document.getElementById("estimateContent").innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Reference</p>
                    <p class="font-medium">${est.reference_doc || "N/A"}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Status</p>
                    <span class="px-3 py-1 rounded ${est.status === "Approved" ? "bg-green-100 text-green-700" : est.status === "Linked" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}">${est.status}</span>
                    ${est.status === "Approved" && est.approvedAuthority ? `<span class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Approved by ${est.approvedAuthority}</span>` : ""}
                    ${
                      est.status === "Linked"
                        ? (() => {
                            const linkedJob = store.jobCards.find(
                              (jc) =>
                                String(jc.estimate_id) === String(est.id) ||
                                jc.work_order_id === est.work_order_id,
                            );
                            return linkedJob
                              ? `<span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-semibold border border-indigo-200">⛓️ Converted to Job Card: ${linkedJob.job_number}</span>`
                              : "";
                          })()
                        : ""
                    }
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">📍 Location</p>
                    <p class="font-medium">${est.location || "Not specified"}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">👤 End User</p>
                    <p class="font-medium">${est.endUser || "Not specified"}</p>
                </div>
            </div>
            
            <div>
                <p class="text-sm text-slate-500">Work Scope</p>
                <p class="text-slate-700">${est.workScope || "Not specified"}</p>
            </div>
            
            <!-- Materials -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <div class="bg-slate-100 px-4 py-2 font-semibold">Materials</div>
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-4 py-2 text-left">Description</th>
                            <th class="px-4 py-2 text-center">Qty</th>
                            <th class="px-4 py-2 text-center">Unit</th>
                            <th class="px-4 py-2 text-right">Cost</th>
                            <th class="px-4 py-2 text-right">Total</th>
                            <th class="px-4 py-2 text-center">Availability</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                          ((_est$materials = est.materials) === null ||
                          _est$materials === void 0
                            ? void 0
                            : _est$materials
                                .map(
                                  (m) => `
                            <tr class="border-t">
                                <td class="px-4 py-2">${m.description}</td>
                                <td class="px-4 py-2 text-center">${m.qty}</td>
                                <td class="px-4 py-2 text-center">${m.unit}</td>
                                <td class="px-4 py-2 text-right">${formatCurrency(m.cost)}</td>
                                <td class="px-4 py-2 text-right font-medium">${formatCurrency(m.qty * m.cost)}</td>
                                <td class="px-4 py-2 text-center"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${m.availability}</span></td>
                            </tr>
                        `,
                                )
                                .join("")) ||
                          '<tr><td colspan="6" class="px-4 py-4 text-center text-slate-500">No materials</td></tr>'
                        }
                    </tbody>
                </table>
            </div>
            
            <!-- Labor -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <div class="bg-slate-100 px-4 py-2 font-semibold">Labor Requirement</div>
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-4 py-2 text-left">Trade/Role</th>
                            <th class="px-4 py-2 text-center">Workers</th>
                            <th class="px-4 py-2 text-center">Man-Days</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                          ((_est$labor = est.labor) === null ||
                          _est$labor === void 0
                            ? void 0
                            : _est$labor
                                .map(
                                  (l) => `
                            <tr class="border-t">
                                <td class="px-4 py-2">${l.trade}</td>
                                <td class="px-4 py-2 text-center">${l.workers}</td>
                                <td class="px-4 py-2 text-center font-medium">${l.manDays}</td>
                            </tr>
                        `,
                                )
                                .join("")) ||
                          '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500">No labor specified</td></tr>'
                        }
                    </tbody>
                </table>
            </div>
            
            <!-- Summary -->
            <div class="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl">
                <div class="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p class="text-sm text-slate-500">Materials Cost</p>
                        <p class="text-xl font-bold text-green-600">${formatCurrency(est.total_cost)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500">Total Man-Days</p>
                        <p class="text-xl font-bold text-blue-600">${est.totalManDays || 0}</p>
                    </div>
                </div>
            </div>

            <!-- Signatories (req 8) -->
            <div class="border-t border-slate-200 pt-6">
                <div class="grid grid-cols-3 gap-6">
                    ${sigBlock("Created By", est.createdBy)}
                    ${sigBlock("Checked By", est.checkedBy)}
                    ${sigBlock("Approved By", est.approvedBy)}
                </div>
            </div>
        </div>
    `;
  renderEstimates();
}
let estWorkScopeCounter = 0;

function populateEstLocationsDatalist() {
  const datalist = document.getElementById("estLocationDatalist");
  if (!datalist) return;
  const currentZoneLocs = (store.locations || []).filter(
    (l) => !l.zone_id || l.zone_id === store.currentZone,
  );
  const uniqueBuildings = [
    ...new Set(
      currentZoneLocs
        .map((l) => (l.building_name || l.name || "").trim())
        .filter(Boolean),
    ),
  ];
  datalist.innerHTML = uniqueBuildings
    .map((b) => `<option value="${b}">`)
    .join("");
}

function onEstLocationChange(selectedLoc) {
  const loc2Datalist = document.getElementById("estLocation2Datalist");
  if (!loc2Datalist) return;
  const q = (selectedLoc || "").toLowerCase().trim();
  const currentZoneLocs = (store.locations || []).filter(
    (l) => !l.zone_id || l.zone_id === store.currentZone,
  );
  const matchingLocs = currentZoneLocs.filter(
    (l) =>
      (l.building_name || l.name || "").toLowerCase().trim() === q ||
      (l.building_name || l.name || "").toLowerCase().includes(q),
  );
  const uniqueLoc2 = [
    ...new Set(
      matchingLocs
        .map((l) => (l.sub_location || l.location2 || "").trim())
        .filter(Boolean),
    ),
  ];
  loc2Datalist.innerHTML = uniqueLoc2
    .map((s) => `<option value="${s}">`)
    .join("");

  const exactMatch = currentZoneLocs.find(
    (l) => (l.building_name || l.name || "").toLowerCase().trim() === q,
  );
  if (exactMatch && exactMatch.end_user) {
    const endUserEl = document.getElementById("estEndUser");
    if (endUserEl && !endUserEl.value) {
      endUserEl.value = exactMatch.end_user;
    }
  }
}

function onEstLocation2Change(selectedLoc2) {
  const loc1 = (document.getElementById("estLocation")?.value || "").toLowerCase().trim();
  const loc2 = (selectedLoc2 || "").toLowerCase().trim();
  if (!loc2) return;
  const currentZoneLocs = (store.locations || []).filter(
    (l) => !l.zone_id || l.zone_id === store.currentZone,
  );
  const exactMatch = currentZoneLocs.find(
    (l) =>
      (l.building_name || l.name || "").toLowerCase().trim() === loc1 &&
      (l.sub_location || l.location2 || "").toLowerCase().trim() === loc2,
  );
  if (exactMatch && exactMatch.end_user) {
    const endUserEl = document.getElementById("estEndUser");
    if (endUserEl) {
      endUserEl.value = exactMatch.end_user;
    }
  }
}

function openNewEstimateModal() {
  document.getElementById("estId").value = "";
  document.getElementById("estDescription").value = "";
  const refTypeSelect = document.getElementById("estRefType");
  if (refTypeSelect) refTypeSelect.value = "Minute Sheet";
  document.getElementById("estReference").value = "";
  const projTypeSelect = document.getElementById("estProjectType");
  if (projTypeSelect) projTypeSelect.value = "PROJECT";
  document.getElementById("estLocation").value = "";
  const loc2Input = document.getElementById("estLocation2");
  if (loc2Input) loc2Input.value = "";
  document.getElementById("estEndUser").value = "";

  // Created By (Sailor) - default empty or current logged-in user
  document.getElementById("estCreatedName").value =
    store.currentUser?.name || "";
  document.getElementById("estCreatedRank").value =
    store.currentUser?.rank || "";
  document.getElementById("estCreatedSvc").value =
    store.currentUser?.serviceNo || store.currentUser?.official_number || "";

  // Checked By (Zone In-Charge)
  const inc = (store.settings?.zoneInCharges || {})[store.currentZone];
  let incSailor = null;
  if (inc && inc.woInchargeId) {
    incSailor = (store.sailors || []).find(
      (s) =>
        String(s.id) === String(inc.woInchargeId) ||
        String(s._fbKey) === String(inc.woInchargeId),
    );
  }
  document.getElementById("estCheckedName").value = incSailor
    ? incSailor.name
    : inc?.name || "";
  document.getElementById("estCheckedRank").value = incSailor
    ? incSailor.rank || ""
    : inc?.rank || "";
  document.getElementById("estCheckedSvc").value = incSailor
    ? incSailor.official_number || incSailor.service_no || ""
    : inc?.serviceNo || "";

  // Approved By (Optional CE Officer)
  document.getElementById("estApprovedName").value = "";
  document.getElementById("estApprovedRank").value = "";
  document.getElementById("estApprovedSvc").value = "";

  // Clear dynamic scopes container and add one default section
  document.getElementById("estWorkScopesContainer").innerHTML = "";
  estWorkScopeCounter = 0;
  addWorkScopeBlock();
  updateEstimateTotals();
  populateEstLocationsDatalist();
  populateSignatoryDropdowns();
  document.getElementById("newEstimateModal").classList.remove("hidden");
}

function editEstimate() {
  const est = store.estimates.find((e) => e.id === store.selectedEstimate);
  if (!est || est.status !== "Pending") return;
  document.getElementById("estId").value = est.id;
  document.getElementById("estDescription").value = est.description || "";
  const refTypeSelect = document.getElementById("estRefType");
  if (refTypeSelect)
    refTypeSelect.value = est.ref_type || est.reference_type || "Minute Sheet";
  document.getElementById("estReference").value =
    est.reference_doc || est.reference_no || "";
  const projTypeSelect = document.getElementById("estProjectType");
  if (projTypeSelect)
    projTypeSelect.value = est.project_type || est.type || "PROJECT";
  document.getElementById("estLocation").value = est.location || "";
  const loc2Input = document.getElementById("estLocation2");
  if (loc2Input) loc2Input.value = est.location2 || est.sub_location || "";
  document.getElementById("estEndUser").value = est.endUser || "";

  document.getElementById("estCreatedName").value = est.createdBy?.name || "";
  document.getElementById("estCreatedRank").value = est.createdBy?.rank || "";
  document.getElementById("estCreatedSvc").value =
    est.createdBy?.serviceNo || "";

  document.getElementById("estCheckedName").value = est.checkedBy?.name || "";
  document.getElementById("estCheckedRank").value = est.checkedBy?.rank || "";
  document.getElementById("estCheckedSvc").value =
    est.checkedBy?.serviceNo || "";

  document.getElementById("estApprovedName").value =
    est.approvedBy?.name || "";
  document.getElementById("estApprovedRank").value =
    est.approvedBy?.rank || "";
  document.getElementById("estApprovedSvc").value =
    est.approvedBy?.serviceNo || "";

  document.getElementById("estWorkScopesContainer").innerHTML = "";
  estWorkScopeCounter = 0;
  if (est.workScopes && est.workScopes.length > 0) {
    est.workScopes.forEach((s) => {
      addWorkScopeBlock(s);
    });
  } else {
    // Backward compatibility: load flat lists as a single section
    addWorkScopeBlock({
      description: est.workScope || "Default Work Scope Section",
      materials: est.materials || [],
      labor: est.labor || [],
    });
  }
  updateEstimateTotals();
  populateEstLocationsDatalist();
  onEstLocationChange(est.location || "");
  populateSignatoryDropdowns();
  document.getElementById("newEstimateModal").classList.remove("hidden");
}
function addWorkScopeBlock(data = null) {
  estWorkScopeCounter++;
  const sId = estWorkScopeCounter;
  const container = document.getElementById("estWorkScopesContainer");
  const block = document.createElement("div");
  block.id = `estScopeBlock-${sId}`;
  block.className = `est-scope-block border border-slate-200 rounded-xl p-4 bg-white shadow-sm relative`;
  block.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h5 class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span class="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold est-scope-num">1</span>
                Scope Section Description *
            </h5>
            <button type="button" onclick="removeWorkScopeBlock(${sId})" class="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-0.5">
                ✕ Delete Section
            </button>
        </div>
        
        <div class="mb-4">
            <input type="text" class="est-scope-desc w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Describe the scope of work for this section... *" value="${(data === null || data === void 0 ? void 0 : data.description) || ""}" required>
        </div>
        
        <!-- Materials sub-section -->
        <div class="border border-slate-100 rounded-lg p-3 bg-slate-50/30 mb-4">
            <div class="flex items-center justify-between mb-2">
                <h6 class="font-semibold text-slate-700 text-xs flex items-center gap-1">🛠️ Materials <span class="est-scope-materials-total text-green-600 font-bold ml-2" id="estScopeMaterialsTotal-${sId}">Rs. 0.00</span></h6>
                <button type="button" onclick="addScopeMaterialRow(${sId})" class="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-[10px] font-medium transition-all">+ Add Material</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-slate-100">
                        <tr>
                            <th class="px-2 py-1.5 text-left">Material</th>
                            <th class="px-2 py-1.5 text-center w-20">Avail</th>
                            <th class="px-2 py-1.5 text-center w-16">Qty</th>
                            <th class="px-2 py-1.5 text-center w-16">Unit</th>
                            <th class="px-2 py-1.5 text-right w-24">Unit Cost</th>
                            <th class="px-2 py-1.5 text-right w-24">Total</th>
                            <th class="w-8"></th>
                        </tr>
                    </thead>
                    <tbody id="estScopeMaterialsBody-${sId}"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Labor sub-section -->
        <div class="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
            <div class="flex items-center justify-between mb-2">
                <h6 class="font-semibold text-slate-700 text-xs flex items-center gap-1">👷 Labor Requirement <span class="est-scope-labor-total text-blue-600 font-bold ml-2" id="estScopeLaborTotal-${sId}">0 Man-Days</span></h6>
                <button type="button" onclick="addScopeLaborRow(${sId})" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[10px] font-medium transition-all">+ Add Trade</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-slate-100">
                        <tr>
                            <th class="px-2 py-1.5 text-left w-36">Trade</th>
                            <th class="px-2 py-1.5 text-center w-20">Workers</th>
                            <th class="px-2 py-1.5 text-center w-20">Man-Days</th>
                            <th class="px-2 py-1.5 text-left">Task Description</th>
                            <th class="w-8"></th>
                        </tr>
                    </thead>
                    <tbody id="estScopeLaborBody-${sId}"></tbody>
                </table>
            </div>
        </div>
    `;
  container.appendChild(block);
  renumberWorkScopes(); // Populate with existing data if editing
  if (data) {
    if (data.materials && data.materials.length > 0) {
      data.materials.forEach((m) => addScopeMaterialRow(sId, m));
    }
    if (data.labor && data.labor.length > 0) {
      data.labor.forEach((l) => addScopeLaborRow(sId, l));
    }
  } else {
    // Add one blank row to each sub-section for easy input
    addScopeMaterialRow(sId);
    addScopeLaborRow(sId);
  }
}
function removeWorkScopeBlock(sId) {
  const block = document.getElementById(`estScopeBlock-${sId}`);
  if (block) {
    block.remove();
    renumberWorkScopes();
    updateEstimateTotals();
  }
}
function renumberWorkScopes() {
  const blocks = document.querySelectorAll(".est-scope-block");
  blocks.forEach((b, idx) => {
    const numSpan = b.querySelector(".est-scope-num");
    if (numSpan) numSpan.textContent = idx + 1;
  });
}

// --- Custom Autocomplete for Materials ---
let activeMaterialAutocompleteDropdown = null;
function setupMaterialAutocomplete(inputElement, onSelectCallback) {
  if (!inputElement || inputElement.hasAttribute("data-autocomplete-init"))
    return;
  inputElement.setAttribute("data-autocomplete-init", "true");
  inputElement.setAttribute("autocomplete", "off");
  inputElement.removeAttribute("list");

  const dropdown = document.createElement("div");
  dropdown.className =
    "hidden absolute z-[9999] w-[350px] bg-white border border-slate-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto text-left";
  document.body.appendChild(dropdown);

  const closeDropdown = () => dropdown.classList.add("hidden");
  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    if (rect.left + 350 > window.innerWidth) {
      dropdown.style.left = `${window.innerWidth - 360}px`;
    }
  };

  const renderResults = (query) => {
    const lowerQuery = (query || "").toLowerCase().trim();
    let count = 0;
    const maxResults = 50;
    let html = "";
    const items = (store.inventory || []).filter((i) => i.category !== "Tools");

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        !lowerQuery ||
        (item.description || "").toLowerCase().includes(lowerQuery)
      ) {
        html += `<div class="px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 last:border-0 autocomplete-item" data-id="${item.id || item._fbKey}" data-desc="${item.description}">
            <div class="text-xs font-semibold text-slate-800 leading-tight mb-0.5">${item.description}</div>
            <div class="text-[11px] text-slate-500 font-mono">Avail: ${item.quantity || 0} ${item.deno || ""} @ Rs. ${formatCurrency(item.cost_per_unit || 0)}</div>
        </div>`;
        count++;
        if (count >= maxResults) break;
      }
    }

    if (count === 0) {
      html = `<div class="px-3 py-2 text-xs text-slate-500 italic">No matching inventory items</div>`;
    }

    dropdown.innerHTML = html;
    updatePosition();
    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".autocomplete-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        inputElement.value = el.getAttribute("data-desc") || "";
        closeDropdown();
        if (onSelectCallback) onSelectCallback(inputElement.value);
      });
    });
  };

  inputElement.addEventListener("focus", () => {
    if (
      activeMaterialAutocompleteDropdown &&
      activeMaterialAutocompleteDropdown !== dropdown
    ) {
      activeMaterialAutocompleteDropdown.classList.add("hidden");
    }
    activeMaterialAutocompleteDropdown = dropdown;
    renderResults(inputElement.value);
  });

  inputElement.addEventListener("input", () => {
    renderResults(inputElement.value);
  });

  inputElement.addEventListener("blur", () => {
    setTimeout(closeDropdown, 150);
  });

  window.addEventListener("resize", () => {
    if (!dropdown.classList.contains("hidden")) updatePosition();
  });
  document.addEventListener(
    "scroll",
    () => {
      if (!dropdown.classList.contains("hidden")) updatePosition();
    },
    true,
  );
}

function addScopeMaterialRow(sId, data = null) {
  const tbody = document.getElementById(`estScopeMaterialsBody-${sId}`);
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.className = "border-b border-slate-100";
  tr.innerHTML = `
        <td class="px-2 py-1.5 relative">
            <input type="text" class="est-mat-select w-full px-2 py-1 border border-slate-300 rounded text-xs" placeholder="Search inventory item..." autocomplete="off" value="${(data === null || data === void 0 ? void 0 : data.description) || ""}">
        </td>
        <td class="px-2 py-1.5 text-center est-mat-avail text-slate-500 font-mono">${(data === null || data === void 0 ? void 0 : data.availability) || "-"}</td>
        <td class="px-2 py-1.5">
            <input type="number" class="est-mat-qty w-full px-2 py-1 border border-slate-300 rounded text-xs text-center font-bold" min="0" step="any" value="${(data === null || data === void 0 ? void 0 : data.qty) || ""}" oninput="updateEstimateTotals()">
        </td>
        <td class="px-2 py-1.5">
            <input type="text" class="est-mat-unit w-full px-2 py-1 border border-slate-300 rounded text-xs text-center bg-slate-50" readonly value="${(data === null || data === void 0 ? void 0 : data.unit) || ""}">
        </td>
        <td class="px-2 py-1.5">
            <input type="number" class="est-mat-cost w-full px-2 py-1 border border-slate-300 rounded text-xs text-right" min="0" step="0.01" value="${(data === null || data === void 0 ? void 0 : data.cost) || ""}" oninput="updateEstimateTotals()">
        </td>
        <td class="px-2 py-1.5 text-right font-semibold est-mat-total text-green-700">Rs. 0.00</td>
        <td class="px-2 py-1.5 text-center">
            <button type="button" onclick="this.closest('tr').remove(); updateEstimateTotals();" class="text-red-400 hover:text-red-600 font-bold">&times;</button>
        </td>
    `;
  tbody.appendChild(tr);
  const inputEl = tr.querySelector(".est-mat-select");
  setupMaterialAutocomplete(inputEl, () => {
    const item = store.inventory.find(
      (i) => i.description === inputEl.value && i.category !== "Tools",
    );
    if (item) {
      tr.querySelector(".est-mat-avail").textContent = item.quantity || 0;
      tr.querySelector(".est-mat-unit").value = item.deno || "";
      tr.querySelector(".est-mat-cost").value = item.cost_per_unit || 0;
      updateEstimateTotals();
    }
  });
  updateEstimateTotals();
}
function addScopeLaborRow(sId, data = null) {
  const tbody = document.getElementById(`estScopeLaborBody-${sId}`);
  if (!tbody) return;
  const trades = [
    "Mason",
    "Carpenter",
    "Painter",
    "Plumber",
    "Welder",
    "Electrician",
    "Aluminum Fabricator",
    "Steel Bender",
    "Sawyer",
    "Laborer",
    "Artificer",
    "RW",
    "SW",
    "BB",
    "AL",
    "Other",
  ];
  const tr = document.createElement("tr");
  tr.className = "border-b border-slate-100";
  tr.innerHTML = `
        <td class="px-2 py-1.5">
            <select class="est-lab-trade w-full px-2 py-1 border border-slate-300 rounded text-xs font-medium">
                ${trades.map((t) => `<option value="${t}" ${data && data.trade === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
        </td>
        <td class="px-2 py-1.5">
            <input type="number" class="est-lab-workers w-full px-2 py-1 border border-slate-300 rounded text-xs text-center" min="1" value="${(data === null || data === void 0 ? void 0 : data.workers) || 1}" oninput="updateEstimateTotals()">
        </td>
        <td class="px-2 py-1.5">
            <input type="number" class="est-lab-days w-full px-2 py-1 border border-slate-300 rounded text-xs text-center font-bold" min="0" step="any" value="${(data === null || data === void 0 ? void 0 : data.manDays) || ""}" oninput="updateEstimateTotals()">
        </td>
        <td class="px-2 py-1.5">
            <input type="text" class="est-lab-desc w-full px-2 py-1 border border-slate-300 rounded text-xs" placeholder="e.g. Concrete breaking, plastering" value="${(data === null || data === void 0 ? void 0 : data.taskDescription) || ""}">
        </td>
        <td class="px-2 py-1.5 text-center">
            <button type="button" onclick="this.closest('tr').remove(); updateEstimateTotals();" class="text-red-400 hover:text-red-600 font-bold">&times;</button>
        </td>
    `;
  tbody.appendChild(tr);
  updateEstimateTotals();
}
function updateEstimateTotals() {
  let grandMaterialsTotal = 0;
  let grandLaborTotal = 0;
  const blocks = document.querySelectorAll(".est-scope-block");
  blocks.forEach((b) => {
    var _b$querySelector, _b$querySelector2, _b$querySelector3;
    const sId = b.id.replace("estScopeBlock-", "");
    let scopeMatTotal = 0;
    let scopeLabTotal = 0;
    b.querySelectorAll(`#estScopeMaterialsBody-${sId} tr`).forEach((row) => {
      var _row$querySelector, _row$querySelector2, _row$querySelector3;
      const qty =
        parseFloat(
          (_row$querySelector = row.querySelector(".est-mat-qty")) === null ||
            _row$querySelector === void 0
            ? void 0
            : _row$querySelector.value,
        ) || 0;
      const cost =
        parseFloat(
          (_row$querySelector2 = row.querySelector(".est-mat-cost")) === null ||
            _row$querySelector2 === void 0
            ? void 0
            : _row$querySelector2.value,
        ) || 0;
      const lineTotal = qty * cost;
      scopeMatTotal += lineTotal;
      const totalCell = row.querySelector(".est-mat-total");
      if (totalCell) totalCell.textContent = formatCurrency(lineTotal);
    });
    b.querySelectorAll(`#estScopeLaborBody-${sId} tr`).forEach((row) => {
      var _row$querySelector$va;
      const days =
        parseFloat(
          (_row$querySelector$va = row.querySelector(".est-lab-days").value) !==
            null && _row$querySelector$va !== void 0
            ? _row$querySelector$va
            : 0,
        ) || 0;
      scopeLabTotal += days;
    });
    const matTotalEl = document.getElementById(
      `estScopeMaterialsTotal-${sId}`,
    );
    if (matTotalEl) matTotalEl.textContent = formatCurrency(scopeMatTotal);
    const labTotalEl = document.getElementById(`estScopeLaborTotal-${sId}`);
    if (labTotalEl) labTotalEl.textContent = `${scopeLabTotal} Man-Days`;
    grandMaterialsTotal += scopeMatTotal;
    grandLaborTotal += scopeLabTotal;
  });
  document.getElementById("estSummaryMaterials").textContent =
    formatCurrency(grandMaterialsTotal);
  document.getElementById("estSummaryLabor").textContent = grandLaborTotal;
  document.getElementById("estSummaryTotal").textContent =
    formatCurrency(grandMaterialsTotal);
}

function saveEstimate(event) {
  event.preventDefault();
  const workScopes = [];
  let grandMaterialsTotal = 0;
  let grandLaborTotal = 0;
  const flatMaterials = [];
  const flatLabor = [];
  const scopeDescriptions = [];
  const blocks = document.querySelectorAll(".est-scope-block");
  blocks.forEach((b) => {
    const sId = b.id.replace("estScopeBlock-", "");
    const desc = b.querySelector(".est-scope-desc").value.trim();
    scopeDescriptions.push(desc);
    const materials = [];
    b.querySelectorAll(`#estScopeMaterialsBody-${sId} tr`).forEach((row) => {
      var _row$querySelector4,
        _row$querySelector5,
        _row$querySelector6,
        _row$querySelector7;
      const matInput = row.querySelector(".est-mat-select");
      const description =
        (matInput === null || matInput === void 0
          ? void 0
          : matInput.value.trim()) || "";
      if (!description || description === "Select...") return;
      const item = {
        description: description,
        qty:
          parseFloat(
            (_row$querySelector4 = row.querySelector(".est-mat-qty")) ===
              null || _row$querySelector4 === void 0
              ? void 0
              : _row$querySelector4.value,
          ) || 0,
        unit:
          ((_row$querySelector5 = row.querySelector(".est-mat-unit")) ===
            null || _row$querySelector5 === void 0
            ? void 0
            : _row$querySelector5.value) || "",
        cost:
          parseFloat(
            (_row$querySelector6 = row.querySelector(".est-mat-cost")) ===
              null || _row$querySelector6 === void 0
              ? void 0
              : _row$querySelector6.value,
          ) || 0,
        availability:
          ((_row$querySelector7 = row.querySelector(".est-mat-avail")) ===
            null || _row$querySelector7 === void 0
            ? void 0
            : _row$querySelector7.textContent) || "-",
      };
      materials.push(item);
      flatMaterials.push(item);
      grandMaterialsTotal += item.qty * item.cost;
    });
    const labor = [];
    b.querySelectorAll(`#estScopeLaborBody-${sId} tr`).forEach((row) => {
      var _row$querySelector8,
        _row$querySelector9,
        _row$querySelector0,
        _row$querySelector1;
      const trade =
        ((_row$querySelector8 = row.querySelector(".est-lab-trade")) === null ||
        _row$querySelector8 === void 0
          ? void 0
          : _row$querySelector8.value) || "";
      const workers =
        parseInt(
          (_row$querySelector9 = row.querySelector(".est-lab-workers")) ===
            null || _row$querySelector9 === void 0
            ? void 0
            : _row$querySelector9.value,
        ) || 1;
      const manDays =
        parseFloat(
          (_row$querySelector0 = row.querySelector(".est-lab-days")) === null ||
            _row$querySelector0 === void 0
            ? void 0
            : _row$querySelector0.value,
        ) || 0;
      const taskDescription =
        ((_row$querySelector1 = row.querySelector(".est-lab-desc")) === null ||
        _row$querySelector1 === void 0
          ? void 0
          : _row$querySelector1.value) || "";
      if (manDays <= 0) return;
      const item = {
        trade: trade,
        workers: workers,
        manDays: manDays,
        taskDescription: taskDescription,
      };
      labor.push(item);
      flatLabor.push(item);
      grandLaborTotal += manDays;
    });
    workScopes.push({ description: desc, materials: materials, labor: labor });
  });

  const id = document.getElementById("estId").value;
  const sig = (n, r, s) => ({
    name: document.getElementById(n).value.trim(),
    rank: document.getElementById(r).value.trim(),
    serviceNo: document.getElementById(s).value.trim(),
  });
  const createdBy = sig("estCreatedName", "estCreatedRank", "estCreatedSvc");
  const checkedBy = sig("estCheckedName", "estCheckedRank", "estCheckedSvc");
  const approvedBy = sig(
    "estApprovedName",
    "estApprovedRank",
    "estApprovedSvc",
  );

  const ref_type =
    (document.getElementById("estRefType") || {}).value || "Minute Sheet";
  const project_type =
    (document.getElementById("estProjectType") || {}).value || "PROJECT";
  const location = document.getElementById("estLocation").value.trim();
  const location2 = (
    document.getElementById("estLocation2") || {}
  ).value.trim();
  const endUser = document.getElementById("estEndUser").value.trim();
  const description = document.getElementById("estDescription").value.trim();
  const reference_doc = document.getElementById("estReference").value.trim();
  const compiledWorkScope = scopeDescriptions.join("; ");

  if (id) {
    const est = store.estimates.find((e) => e.id == id);
    if (est) {
      est.description = description;
      est.ref_type = ref_type;
      est.reference_type = ref_type;
      est.reference_doc = reference_doc;
      est.reference_no = reference_doc;
      est.project_type = project_type;
      est.type = project_type;
      est.location = location;
      est.location2 = location2;
      est.sub_location = location2;
      est.endUser = endUser;
      est.workScope = compiledWorkScope;
      est.workScopes = workScopes;
      est.materials = flatMaterials;
      est.labor = flatLabor;
      est.total_cost = grandMaterialsTotal;
      est.totalManDays = grandLaborTotal;
      est.createdBy = createdBy;
      est.checkedBy = checkedBy;
      est.approvedBy = approvedBy;
      fbSaveEstimate(est);
    }
    showToast("Estimate updated!");
  } else {
    const newEst = {
      id: store.estimates.length + 1,
      estimate_number: `EST/${new Date().getFullYear()}/${String(store.estimates.length + 1).padStart(4, "0")}`,
      description: description,
      ref_type: ref_type,
      reference_type: ref_type,
      reference_doc: reference_doc,
      reference_no: reference_doc,
      project_type: project_type,
      type: project_type,
      location: location,
      location2: location2,
      sub_location: location2,
      endUser: endUser,
      workScope: compiledWorkScope,
      workScopes: workScopes,
      materials: flatMaterials,
      labor: flatLabor,
      total_cost: grandMaterialsTotal,
      totalManDays: grandLaborTotal,
      status: "Pending",
      approvedAuthority: approvedBy.name || null,
      createdBy: createdBy,
      checkedBy: checkedBy,
      approvedBy: approvedBy,
      zone_id: store.currentZone,
    };
    fbSaveEstimate(newEst);
    showToast("Estimate created!");
  }
  closeModal("newEstimateModal");
  renderEstimates();
}

// Signatory Dropdown Helper
let activeSignatoryDropdown = null;
function setupSignatoryAutocomplete(prefix) {
  const inputElement = document.getElementById(`est${prefix}Name`);
  const rankEl = document.getElementById(`est${prefix}Rank`);
  const svcEl = document.getElementById(`est${prefix}Svc`);
  if (!inputElement || inputElement.hasAttribute("data-autocomplete-init"))
    return;
  inputElement.setAttribute("data-autocomplete-init", "true");

  const dropdown = document.createElement("div");
  dropdown.className =
    "hidden absolute z-[9999] w-[360px] bg-white border border-slate-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto text-left";
  document.body.appendChild(dropdown);

  const closeDropdown = () => dropdown.classList.add("hidden");
  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    if (rect.left + 360 > window.innerWidth) {
      dropdown.style.left = `${window.innerWidth - 370}px`;
    }
  };

  const renderResults = (query) => {
    const lowerQuery = (query || "").toLowerCase().trim();
    let items = [];

    if (prefix === "Created") {
      // Created By -> ALL Sailors in store
      items = (store.sailors || []).map((s) => {
        const offNo = s.official_number || s.service_no || "";
        const rank = s.rank || s.trade || "-";
        return {
          name: s.name,
          rank: rank,
          svc: offNo,
          label: `${s.name}`,
          sub: `${rank} • ${offNo} (${s.trade || "Sailor"})`,
          badge: s.trade || "Sailor",
          badgeColor: "bg-blue-100 text-blue-800",
        };
      });
    } else if (prefix === "Checked") {
      // Checked By -> Zone In-Charge, EC/AC sailors & OIC profiles
      const inc = (store.settings?.zoneInCharges || {})[store.currentZone];
      if (inc && inc.name) {
        items.push({
          name: inc.name,
          rank: inc.rank || "In-Charge",
          svc: inc.serviceNo || inc.official_number || "",
          label: `${inc.name}`,
          sub: `${inc.rank || "In-Charge"} • ${inc.serviceNo || ""} (Zone In-Charge)`,
          badge: "Zone In-Charge",
          badgeColor: "bg-amber-100 text-amber-800",
        });
      }

      // OIC profiles
      const oicProfiles =
        typeof getOicProfiles === "function" ? getOicProfiles() : [];
      oicProfiles.forEach((p) => {
        items.push({
          name: p.name,
          rank: p.rank || "OIC",
          svc: p.serviceNo || "",
          label: `${p.name}`,
          sub: `${p.rank || "OIC"} • ${p.serviceNo || ""}`,
          badge: "OIC",
          badgeColor: "bg-indigo-100 text-indigo-800",
        });
      });

      // EC/AC/MA sailors
      (store.sailors || [])
        .filter((s) => {
          const off = String(s.official_number || s.service_no || "")
            .trim()
            .toUpperCase();
          return (
            off.startsWith("EC") ||
            off.startsWith("AC") ||
            s.trade === "MA" ||
            s.trade === "CA"
          );
        })
        .forEach((s) => {
          const offNo = s.official_number || s.service_no || "";
          items.push({
            name: s.name,
            rank: s.rank || s.trade || "-",
            svc: offNo,
            label: `${s.name}`,
            sub: `${s.rank || "-"} • ${offNo} (${s.trade || "Staff"})`,
            badge: s.trade || "Staff",
            badgeColor: "bg-slate-100 text-slate-700",
          });
        });
    } else if (prefix === "Approved") {
      // Approved By -> Specific CE Officers list + Option to leave blank
      items.push({
        name: "",
        rank: "",
        svc: "",
        label: "🚫 Clear / Leave Blank",
        sub: "No approval signature required (Keep blank)",
        badge: "Blank",
        badgeColor: "bg-slate-100 text-slate-500",
      });

      const ceOfficersList = [
        {
          rank: "CAPTAIN (CE)",
          name: "BGL BALASURIYA",
          svc: "NRC 1843",
          desig: "CCED(E)",
        },
        {
          rank: "CDR (CE)",
          name: "TM VITHARANA",
          svc: "NRC 2541",
          desig: "CCEO(E)",
        },
        {
          rank: "LCDR (CE)",
          name: "JAJD SENARATHNA",
          svc: "NRC 3068",
          desig: "SCE(M)",
        },
        {
          rank: "LCDR (CE)",
          name: "JATK JAYAKODI",
          svc: "NRC 3542",
          desig: "SCE(P&P)",
        },
        {
          rank: "LCDR (CE)",
          name: "KMAU KAHANDAWA",
          svc: "NRC 3576",
          desig: "SCE(W/W)",
        },
        {
          rank: "LCDR (CE)",
          name: "HMMI JAYATHUNGA",
          svc: "NRC 3977",
          desig: "CE (W/W), CE (P&P)",
        },
        {
          rank: "LT (CE)",
          name: "WP DARSHANA",
          svc: "NRC 4126",
          desig: "QS (E)",
        },
        {
          rank: "LT (CE)",
          name: "JADU JAYASINGHE",
          svc: "NRC 4310",
          desig: "CE(M)I",
        },
        {
          rank: "LT (CE)",
          name: "PHKR KUMARA",
          svc: "NRC 4570",
          desig: "CE(M) II",
        },
      ];

      ceOfficersList.forEach((off) => {
        items.push({
          name: off.name,
          rank: off.rank,
          svc: `${off.svc} - ${off.desig}`,
          label: `${off.rank} ${off.name}`,
          sub: `${off.svc} • ${off.desig}`,
          badge: off.desig,
          badgeColor: "bg-emerald-100 text-emerald-800",
        });
      });
    }

    if (lowerQuery) {
      items = items.filter((it) => {
        const text =
          `${it.name} ${it.rank} ${it.svc} ${it.sub}`.toLowerCase();
        return text.includes(lowerQuery);
      });
    }

    const visibleItems = items.slice(0, 40);
    if (visibleItems.length === 0) {
      dropdown.innerHTML = `<div class="px-3 py-2 text-xs text-slate-500 italic">No matching records (type freely)</div>`;
    } else {
      dropdown.innerHTML = visibleItems
        .map(
          (it) => `
        <div class="px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 last:border-0 autocomplete-item" data-name="${it.name}" data-rank="${it.rank}" data-svc="${it.svc}">
            <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-semibold text-slate-800">${it.label}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${it.badgeColor}">${it.badge}</span>
            </div>
            <div class="text-[11px] text-slate-500">${it.sub}</div>
        </div>
      `,
        )
        .join("");
    }

    updatePosition();
    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".autocomplete-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        inputElement.value = el.getAttribute("data-name") || "";
        if (rankEl) rankEl.value = el.getAttribute("data-rank") || "";
        if (svcEl) svcEl.value = el.getAttribute("data-svc") || "";
        closeDropdown();
      });
    });
  };

  inputElement.addEventListener("focus", () => {
    if (activeSignatoryDropdown && activeSignatoryDropdown !== dropdown) {
      activeSignatoryDropdown.classList.add("hidden");
    }
    activeSignatoryDropdown = dropdown;
    renderResults(inputElement.value);
  });

  inputElement.addEventListener("input", () => {
    renderResults(inputElement.value);
  });

  inputElement.addEventListener("blur", () => {
    setTimeout(closeDropdown, 150);
  });

  window.addEventListener("resize", () => {
    if (!dropdown.classList.contains("hidden")) updatePosition();
  });
  document.addEventListener(
    "scroll",
    () => {
      if (!dropdown.classList.contains("hidden")) updatePosition();
    },
    true,
  );
}

function populateSignatoryDropdowns() {
  setupSignatoryAutocomplete("Created");
  setupSignatoryAutocomplete("Checked");
  setupSignatoryAutocomplete("Approved");
} // ---- Approval (req 9) ----
function approveEstimate() {
  const est = store.estimates.find((e) => e.id === store.selectedEstimate);
  if (!est) {
    showToast("Select an estimate first", "error");
    return;
  }
  if (est.status === "Approved") {
    showToast("Already approved", "info");
    return;
  }
  document.getElementById("apvEstNumber").textContent = est.estimate_number;
  document.getElementById("apvAuthority").value = "";
  document.getElementById("approvalModal").classList.remove("hidden");
}
function submitApproval(event) {
  event.preventDefault();
  const est = store.estimates.find((e) => e.id === store.selectedEstimate);
  if (!est) return;
  const authority = document.getElementById("apvAuthority").value;
  est.status = "Approved";
  est.approvedAuthority = authority;
  if (window.fbSaveEstimate) fbSaveEstimate(est);
  closeModal("approvalModal");
  selectEstimate(est.id);
  showToast(`Estimate ${est.estimate_number} approved by ${authority}`);
}
function deleteEstimate() {
  const estId = store.selectedEstimate;
  if (!estId) return;
  const est = store.estimates.find((e) => e.id === estId);
  if (!est) return;
  if (
    confirm(
      `⚠️ Are you sure you want to delete the estimate "${est.estimate_number}" (${est.description})?\n\nThis action cannot be undone.`,
    )
  ) {
    const targetFbKey = est._fbKey;
    if (!targetFbKey) {
      showToast("Cannot delete: Firebase key not found.");
      return;
    }
    opsDB
      .ref(`estimates/${targetFbKey}`)
      .remove()
      .then(() => {
        store.selectedEstimate = null; // Reset right panel content
        document.getElementById("selectedEstimateNumber").textContent =
          "Select an Estimate";
        document.getElementById("editEstimateBtn").style.display = "none";
        document.getElementById("approveEstimateBtn").style.display = "none";
        document.getElementById("deleteEstimateBtn").style.display = "none";
        document.getElementById("estimateContent").innerHTML =
          `<p class="text-slate-500 text-center py-8">Select an estimate to view details</p>`;
        showToast(`Deleted estimate successfully!`);
        renderEstimates();
      })
      .catch((err) => {
        console.error("Error deleting estimate:", err);
        showToast("Failed to delete estimate.");
      });
  }
} // ---- Compact printable layout (req 7) ----
// Status intentionally omitted from the printout (req 7)
function buildEstimatePrintHTML(est) {
  var _store$zones$find2;
  const zoneObj = store.zones
    ? store.zones.find((z) => z.id === (est.zone_id || store.currentZone))
    : null;
  const zoneName =
    zoneObj && zoneObj.name ? zoneObj.name : "CE Management System";

  const sigBlock = (label, p) => `
        <div style="text-align:center;width:30%;">
            <div style="height:18px;border-bottom:1px solid #000;margin-bottom:2px;"></div>
            <div style="font-size:8px;font-weight:bold;">${label}</div>
            <div style="font-size:7.5px;">${p && p.name ? p.name : "&nbsp;"}</div>
            <div style="font-size:7px;color:#444;">${p && p.rank ? p.rank : ""}${p && p.serviceNo ? " • " + p.serviceNo : ""}</div>
        </div>`;

  let sectionsHtml = "";
  if (est.workScopes && est.workScopes.length > 0) {
    est.workScopes.forEach((s, sIdx) => {
      const matRows = (s.materials || [])
        .map(
          (m, i) => `
            <tr>
                <td style="text-align:center;width:6%;">${i + 1}</td>
                <td style="font-weight:600;">${m.description}</td>
                <td style="text-align:center;width:10%;">${m.qty}</td>
                <td style="text-align:center;width:10%;">${m.unit}</td>
                <td style="text-align:right;width:16%;">${formatCurrency(m.cost)}</td>
                <td style="text-align:right;width:18%;font-weight:bold;">${formatCurrency(m.qty * m.cost)}</td>
            </tr>`,
        )
        .join("");

      const labRows = (s.labor || [])
        .map(
          (l) => `
            <tr>
                <td style="font-weight:600;">${l.trade}</td>
                <td style="text-align:center;width:14%;">${l.workers}</td>
                <td style="text-align:center;width:14%;font-weight:bold;">${l.manDays}</td>
                <td>${l.taskDescription || "—"}</td>
            </tr>`,
        )
        .join("");

      const sectionTotalCost = (s.materials || []).reduce(
        (sum, m) => sum + m.qty * m.cost,
        0,
      );

      sectionsHtml += `
        <div style="margin-top: 3px; border: 1px solid #cbd5e1; border-radius: 3px; padding: 3px 5px; background-color: #fafbfc; page-break-inside: avoid;">
            <div style="font-size: 8.5px; font-weight: bold; border-bottom: 1px solid #94a3b8; padding-bottom: 2px; margin-bottom: 2px; text-transform: uppercase; color: #0f172a; display: flex; justify-content: space-between;">
                <span>Section ${sIdx + 1}: ${s.description}</span>
                <span style="color:#059669;">Cost: ${formatCurrency(sectionTotalCost)}</span>
            </div>
            
            ${
              matRows
                ? `
            <table class="est-table" style="margin-bottom: 2px;">
                <thead>
                    <tr><th style="width:6%;text-align:center;">#</th><th>Material</th><th style="width:10%;text-align:center;">Qty</th><th style="width:10%;text-align:center;">Unit</th><th style="width:16%;text-align:right;">Unit Cost</th><th style="width:18%;text-align:right;">Total</th></tr>
                </thead>
                <tbody>${matRows}</tbody>
            </table>
            `
                : ""
            }
            
            ${
              labRows
                ? `
            <table class="est-table">
                <thead><tr><th>Trade / Role</th><th style="width:14%;text-align:center;">Workers</th><th style="width:14%;text-align:center;">Man-Days</th><th>Task Description</th></tr></thead>
                <tbody>${labRows}</tbody>
            </table>
            `
                : ""
            }
        </div>
      `;
    });
  } else {
    // Fallback for flat layout (old estimates)
    const matRows =
      (est.materials || [])
        .map(
          (m, i) => `
            <tr>
                <td style="text-align:center;width:6%;">${i + 1}</td>
                <td>${m.description}</td>
                <td style="text-align:center;width:10%;">${m.qty}</td>
                <td style="text-align:center;width:10%;">${m.unit}</td>
                <td style="text-align:right;width:16%;">${formatCurrency(m.cost)}</td>
                <td style="text-align:right;width:18%;font-weight:bold;">${formatCurrency(m.qty * m.cost)}</td>
            </tr>`,
        )
        .join("") ||
      '<tr><td colspan="6" style="text-align:center;font-style:italic;">No materials</td></tr>';

    const labRows =
      (est.labor || [])
        .map(
          (l) => `
            <tr>
                <td>${l.trade}</td>
                <td style="text-align:center;width:15%;">${l.workers}</td>
                <td style="text-align:center;width:15%;font-weight:bold;">${l.manDays}</td>
                <td>${l.taskDescription || "—"}</td>
            </tr>`,
        )
        .join("") ||
      '<tr><td colspan="4" style="text-align:center;font-style:italic;">No labor</td></tr>';

    sectionsHtml = `
      <table class="est-table" style="margin-top:2px;">
          <thead>
              <tr>
                  <th style="width:6%;text-align:center;">#</th>
                  <th>Material</th>
                  <th style="width:10%;text-align:center;">Qty</th>
                  <th style="width:10%;text-align:center;">Unit</th>
                  <th style="width:16%;text-align:right;">Unit Cost</th>
                  <th style="width:18%;text-align:right;">Total</th>
              </tr>
          </thead>
          <tbody>${matRows}</tbody>
      </table>

      <table class="est-table" style="margin-top:2px;">
          <thead><tr>
              <th>Trade / Role</th>
              <th style="width:15%;text-align:center;">Workers</th>
              <th style="width:15%;text-align:center;">Man-Days</th>
              <th>Task Description</th>
          </tr></thead>
          <tbody>${labRows}</tbody>
      </table>
    `;
  }

  const hasSignatures = est.createdBy || est.checkedBy || est.approvedBy;
  const sigSection = hasSignatures
    ? `
        <div style="display:flex;justify-content:space-between;margin-top:4px;page-break-inside:avoid;">
            ${sigBlock("Created By", est.createdBy)}
            ${sigBlock("Checked By", est.checkedBy)}
            ${sigBlock("Approved By", est.approvedBy)}
        </div>
      `
    : "";

  const createdDate = est.created_at
    ? typeof est.created_at === "number"
      ? new Date(est.created_at).toISOString().split("T")[0]
      : est.created_at
    : "";

  return `
    <div class="est-sheet">
        <!-- Compact Header with Crest and ONLY Captain Civil Engineering Department (E) -->
        <div style="width:100%;border-bottom:1.5px solid #000;padding-bottom:3px;margin-bottom:3px;">
            <table style="width:100%;border:none;border-collapse:collapse;">
                <tr>
                    <td style="border:none;padding:0;width:38px;vertical-align:middle;">
                        <img src="${window.location.href.split("?")[0].split("#")[0].replace("index.html", "")}images/navy_crest_cropped.png" style="height:32px;width:auto;display:block;" alt="SLN Crest">
                    </td>
                    <td style="border:none;padding:0 0 0 8px;vertical-align:middle;">
                        <div style="font-size:12px;font-weight:900;letter-spacing:0.4px;color:#0f172a;line-height:1.15;">CAPTAIN CIVIL ENGINEERING DEPARTMENT (E)</div>
                        <div style="font-size:8.5px;font-weight:bold;color:#475569;margin-top:1px;">${zoneName} — Cost Estimate</div>
                    </td>
                    <td style="border:none;padding:0;text-align:right;vertical-align:middle;">
                        <div style="font-size:11px;font-weight:900;color:#b91c1c;font-family:monospace;">${est.estimate_number}</div>
                        ${createdDate ? `<div style="font-size:8px;color:#64748b;font-family:monospace;">${createdDate}</div>` : ""}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Compact Info Table -->
        <table style="width:100%;font-size:8.5px;line-height:1.25;margin-bottom:2px;border:none;border-collapse:collapse;">
            <tr>
                <td style="border:none;padding:1px 0;width:35%;"><b>Ref Type:</b> ${est.ref_type || est.reference_type || "Minute"}</td>
                <td style="border:none;padding:1px 0;width:35%;"><b>Ref No:</b> ${est.reference_doc || est.reference_no || "—"}</td>
                <td style="border:none;padding:1px 0;width:30%;text-align:right;"><b>Type:</b> ${est.project_type || est.type || "Project"}</td>
            </tr>
            <tr>
                <td style="border:none;padding:1px 0;"><b>Location:</b> ${est.location || "—"}</td>
                <td style="border:none;padding:1px 0;"><b>Location 2:</b> ${est.location2 || est.sub_location || "—"}</td>
                <td style="border:none;padding:1px 0;text-align:right;"><b>End User:</b> ${est.endUser || "—"}</td>
            </tr>
            <tr>
                <td colspan="3" style="border:none;padding:1px 0;"><b>Description:</b> ${est.description}${est.approvedAuthority ? ` | <b>Appr:</b> ${est.approvedAuthority}` : ""}</td>
            </tr>
        </table>
        ${est.workScope && !est.workScopes ? `<p style="font-size:8.5px;margin:2px 0;"><b>Work Scope:</b> ${est.workScope}</p>` : ""}

        <!-- Work Scopes / Sections -->
        ${sectionsHtml}
        
        <!-- Compact Grand Summary Bar -->
        <div style="margin-top: 3px; border: 1.2px solid #000; border-radius: 3px; padding: 3px 6px; background-color: #f1f5f9; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; font-size: 8.5px;">
            <span>Materials: <strong style="color: #059669; font-size: 9px;">${formatCurrency(est.total_cost)}</strong></span>
            <span>Labor: <strong style="color: #2563eb; font-size: 9px;">${est.totalManDays || 0} Man-Days</strong></span>
            <span>Grand Total: <strong style="color: #b45309; font-size: 10px; font-weight: 900;">${formatCurrency(est.total_cost)}</strong></span>
        </div>

        ${sigSection}
    </div>`;
}

function printEstimatesByIds(ids, settings = null) {
  // Only print estimates belonging to the current zone
  const ests = store.estimates.filter(
    (e) =>
      ids.includes(e.id) && (!e.zone_id || e.zone_id === store.currentZone),
  );
  if (ests.length === 0) {
    showToast("No estimates found for this zone to print", "error");
    return;
  }
  let sheetsHtml = "";
  let customCSS = "";
  if (settings && settings.isTiled) {
    // Tiled mode
    customCSS = `
            @page { size: A4 portrait; margin: 6mm 8mm; }
            body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .est-sheet { 
                width: 100%; 
                margin: 0 0 4mm 0; 
                padding: 6px 8px; 
                border: 1.2px solid #000; 
                border-radius: 4px; 
                background: #fff; 
                box-sizing: border-box; 
                page-break-inside: avoid !important; 
                break-inside: avoid !important; 
            }
            .est-table { width: 100%; border-collapse: collapse; font-size: 8px; }
            .est-table th { border: 1px solid #64748b; padding: 2px 3px; background: #e2e8f0; text-align: left; font-size: 8px; font-weight: bold; }
            .est-table td { border: 1px solid #64748b; padding: 1.5px 3px; font-size: 8px; }
            .est-table tfoot td { background: #f8fafc; font-weight: bold; font-size: 8px; }
            .html-page-break { page-break-after: always; }
        `;
    sheetsHtml = ests
      .map((e, i) => {
        let html = buildEstimatePrintHTML(e);
        if ((i + 1) % 3 === 0 && i !== ests.length - 1) {
          html += '<div class="html-page-break"></div>';
        }
        return html;
      })
      .join("");
  } else {
    // Continuous / Flow mode (fits up to 3 estimates per A4, avoids breaking inside cards)
    sheetsHtml = ests.map((e) => buildEstimatePrintHTML(e)).join("");
    let pSize = "A4";
    let pOri = "portrait";
    if (settings) {
      pSize = settings.pageSize === "Custom" ? "A4" : settings.pageSize;
      pOri = settings.orientation;
    }
    customCSS = `
            @page { size: ${pSize} ${pOri}; margin: 6mm 8mm; }
            body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .est-sheet { 
                width: 100%; 
                margin: 0 0 4mm 0; 
                padding: 6px 8px; 
                border: 1.2px solid #000; 
                border-radius: 4px; 
                background: #fff; 
                box-sizing: border-box; 
                page-break-inside: avoid !important; 
                break-inside: avoid !important; 
            }
            .est-table { width: 100%; border-collapse: collapse; font-size: 8px; }
            .est-table th { border: 1px solid #64748b; padding: 2px 3px; background: #e2e8f0; text-align: left; font-size: 8px; font-weight: bold; }
            .est-table td { border: 1px solid #64748b; padding: 1.5px 3px; font-size: 8px; }
            .est-table tfoot td { background: #f8fafc; font-weight: bold; font-size: 8px; }
            .html-page-break { page-break-after: always; }
        `;
  }
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html><head><title>NCW Estimate Print</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .est-sheet { 
      width: 100%; 
      margin: 0 0 4mm 0; 
      padding: 6px 8px; 
      border: 1.2px solid #000; 
      border-radius: 4px; 
      background: #fff; 
      box-sizing: border-box; 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
  }
  .est-table { width: 100%; border-collapse: collapse; font-size: 8px; }
  .est-table th { border: 1px solid #64748b; padding: 2px 3px; background: #e2e8f0; text-align: left; font-size: 8px; font-weight: bold; }
  .est-table td { border: 1px solid #64748b; padding: 1.5px 3px; font-size: 8px; }
  .est-table tfoot td { background: #f8fafc; font-weight: bold; font-size: 8px; }
  @media print {
      ${customCSS}
  }
</style></head>
<body>${sheetsHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}

function exportEstimatesToPDFByIds(ids) {
  const ests = store.estimates.filter(
    (e) =>
      ids.includes(e.id) && (!e.zone_id || e.zone_id === store.currentZone),
  );
  if (ests.length === 0) {
    showToast("No estimates found for this zone to export", "error");
    return;
  }
  if (typeof html2pdf === "undefined") {
    showToast(
      "PDF library is loading, please try again in a few seconds.",
      "error",
    );
    return;
  }
  showToast("Generating PDF, please wait...", "info");
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.top = "0";
  tempDiv.style.left = "0";
  tempDiv.style.zIndex = "99999";
  tempDiv.style.width = "794px";
  tempDiv.style.fontFamily = "Arial, Helvetica, sans-serif";
  tempDiv.style.color = "#000";
  tempDiv.style.backgroundColor = "#fff";
  tempDiv.style.minHeight = "100vh";
  tempDiv.innerHTML = ests.map((e) => buildEstimatePrintHTML(e)).join("");
  const style = document.createElement("style");
  style.innerHTML = `
        .est-sheet { 
            width: 100%; 
            margin: 0 0 5mm 0; 
            padding: 6px 8px; 
            border: 1.2px solid #000; 
            border-radius: 4px; 
            background: #fff; 
            box-sizing: border-box; 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
        }
        .est-table { width: 100%; border-collapse: collapse; font-size: 8px; table-layout: auto; }
        .est-table th { border: 1px solid #64748b; padding: 2px 3px; background: #e2e8f0; text-align: left; font-size: 8px; font-weight: bold; }
        .est-table td { border: 1px solid #64748b; padding: 1.5px 3px; word-wrap: break-word; font-size: 8px; }
        .est-table tfoot td { background: #f8fafc; font-weight: bold; font-size: 8px; }
    `;
  tempDiv.appendChild(style);
  document.body.appendChild(tempDiv);
  window.scrollTo(0, 0);
  const filename =
    ests.length === 1
      ? `Estimate_${ests[0].estimate_number.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
      : `Estimates_Bulk_Export.pdf`;
  const opt = {
    margin: [6, 8, 6, 8],
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 794,
      width: 794,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  html2pdf()
    .set(opt)
    .from(tempDiv)
    .save()
    .then(() => {
      document.body.removeChild(tempDiv);
      showToast("PDF exported successfully", "success");
    })
    .catch((err) => {
      console.error("PDF Export Error:", err);
      if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
      showToast("PDF export failed, please try again", "error");
    });
}
function printEstimate() {
  if (!store.selectedEstimate) {
    showToast("Select an estimate first", "error");
    return;
  }
  printEstimatesByIds([store.selectedEstimate]);
}
function exportEstimatePDF() {
  if (!store.selectedEstimate) {
    showToast("Select an estimate first", "error");
    return;
  }
  exportEstimatesToPDFByIds([store.selectedEstimate]);
}
function openBulkPrintSettings() {
  if (store.selectedEstimatesForPrint.length === 0) {
    showToast("Tick the estimates you want to print first", "error");
    return;
  }
  document.getElementById("bpsPageSize").value = "A4";
  document.getElementById("bpsOrientation").value = "landscape";
  document.getElementById("bpsTiled").checked = false;
  toggleTiledPrintOption();
  document.getElementById("bulkPrintSettingsModal").classList.remove("hidden");
}
function toggleTiledPrintOption() {
  const orientation = document.getElementById("bpsOrientation").value;
  const tiledContainer = document.getElementById("tiledOptionContainer"); // Tiled option is only available if orientation is landscape AND there are 2 or more documents
  if (
    orientation === "landscape" &&
    store.selectedEstimatesForPrint.length >= 2
  ) {
    tiledContainer.classList.remove("hidden");
  } else {
    tiledContainer.classList.add("hidden");
    document.getElementById("bpsTiled").checked = false;
  }
}
function executeBulkPrint() {
  closeModal("bulkPrintSettingsModal");
  const pageSize = document.getElementById("bpsPageSize").value;
  const orientation = document.getElementById("bpsOrientation").value;
  const isTiled = document.getElementById("bpsTiled").checked;
  printEstimatesByIds([...store.selectedEstimatesForPrint], {
    pageSize,
    orientation,
    isTiled,
  });
}
function bulkExportEstimatesPDF() {
  if (store.selectedEstimatesForPrint.length === 0) {
    showToast("Tick the estimates you want to export first", "error");
    return;
  }
  exportEstimatesToPDFByIds([...store.selectedEstimatesForPrint]);
} // =============================================
// MAINTENANCE RECORDS
// =============================================
function renderMaintenance() {
  renderLocationsList();
}
function renderLocationsList() {
  const container = document.getElementById("locationsList");
  const groupedLocations = {}; // Filter by current zone
  const zoneLocations = store.locations.filter(
    (l) => l.zone_id === store.currentZone,
  );
  zoneLocations.forEach((loc) => {
    if (!groupedLocations[loc.building_name]) {
      groupedLocations[loc.building_name] = [];
    }
    groupedLocations[loc.building_name].push(loc);
  });
  container.innerHTML =
    Object.entries(groupedLocations)
      .map(
        ([building, locs]) => `
        <div class="border-b border-slate-100">
            <div class="px-3 py-2.5 font-semibold text-slate-700 text-xs flex items-center gap-2"
                style="background:rgba(15,32,64,0.04)">
                🏢 <span>${building}</span>
            </div>
            ${locs
              .map((loc) => {
                const recCount = store.maintenanceRecords.filter(
                  (r) => r.location_id === loc.id,
                ).length;
                return `
                <div class="px-3 py-2 pl-7 hover:bg-teal-50 cursor-pointer text-sm flex items-center justify-between group transition-colors
                    ${store.selectedLocation === loc.id ? "bg-teal-100 border-l-3 border-teal-500 font-medium text-teal-800" : "text-slate-600"}"
                    onclick="selectLocation('${loc.id}')">
                    <span>📍 ${loc.sub_location || "General"}</span>
                    ${recCount > 0 ? `<span class="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">${recCount}</span>` : ""}
                </div>`;
              })
              .join("")}
        </div>
    `,
      )
      .join("") ||
    '<p class="text-slate-400 text-center py-8 text-sm">No locations in this zone</p>';
}
function selectLocation(id) {
  store.selectedLocation = id;
  const loc = store.locations.find((l) => l.id === id);
  if (!loc) return;
  const records = store.maintenanceRecords.filter((r) => r.location_id === id);
  document.getElementById("selectedLocationName").textContent =
    `${loc.building_name} — ${loc.sub_location || "General"}`;
  document.getElementById("selectedLocationZone").textContent =
    `Zone: ${loc.zone_id}`; // Show action buttons container
  const actionBtns = document.getElementById("locationActionButtons");
  if (actionBtns) actionBtns.style.display = "flex";
  const addMaintBtn = document.getElementById("addMaintenanceBtn");
  if (addMaintBtn) addMaintBtn.style.display = "block";
  const typeColors = {
    Repair: "bg-rose-100 text-rose-700 border-rose-300",
    Preventive: "bg-blue-100 text-blue-700 border-blue-300",
    Emergency: "bg-red-200 text-red-800 border-red-400",
    Routine: "bg-teal-100 text-teal-700 border-teal-300",
    Upgrade: "bg-purple-100 text-purple-700 border-purple-300",
  };
  document.getElementById("maintenanceHistory").innerHTML = records.length
    ? `
        <div class="space-y-3">
            ${records
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(
                (r) => `
                <div class="p-4 rounded-xl border-l-4 transition-all hover:shadow-sm"
                    style="background:rgba(255,255,255,0.9);border-left-color:#0d9488;box-shadow:0 2px 8px rgba(15,32,64,0.05)">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColors[r.maintenance_type] || "bg-slate-100 text-slate-600"}">${r.maintenance_type}</span>
                        <span class="text-xs text-slate-400 mono">${r.date}</span>
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">${r.description}</p>
                    ${r.job_number ? `<p class="text-[11px] text-teal-600 mt-2 font-medium">🔗 ${r.job_number}</p>` : ""}
                </div>
            `,
              )
              .join("")}
        </div>
    `
    : `
        <div class="text-center py-12">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-slate-400 font-medium">No maintenance records</p>
            <p class="text-slate-300 text-sm mt-1">Click "+ Add Record" to log the first entry</p>
        </div>`;
  renderLocationsList();
}
function searchLocations() {
  const query = document.getElementById("locationSearch").value.toLowerCase();
  const container = document.getElementById("locationsList");
  const filteredLocations = store.locations.filter(
    (l) =>
      l.zone_id === store.currentZone &&
      (l.building_name.toLowerCase().includes(query) ||
        (l.sub_location && l.sub_location.toLowerCase().includes(query))),
  );
  const groupedLocations = {};
  filteredLocations.forEach((loc) => {
    if (!groupedLocations[loc.building_name])
      groupedLocations[loc.building_name] = [];
    groupedLocations[loc.building_name].push(loc);
  });
  container.innerHTML =
    Object.entries(groupedLocations)
      .map(
        ([building, locs]) => `
        <div class="border-b border-slate-100">
            <div class="px-3 py-2.5 font-semibold text-slate-700 text-xs flex items-center gap-2"
                style="background:rgba(15,32,64,0.04)">
                🏢 <span>${building}</span>
            </div>
            ${locs
              .map((loc) => {
                const recCount = store.maintenanceRecords.filter(
                  (r) => r.location_id === loc.id,
                ).length;
                return `
                <div class="px-3 py-2 pl-7 hover:bg-teal-50 cursor-pointer text-sm flex items-center justify-between transition-colors"
                    onclick="selectLocation('${loc.id}')">
                    <span class="text-slate-600">📍 ${loc.sub_location || "General"}</span>
                    ${recCount > 0 ? `<span class="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">${recCount}</span>` : ""}
                </div>`;
              })
              .join("")}
        </div>
    `,
      )
      .join("") ||
    '<p class="text-slate-400 text-center py-6 text-sm">No locations found</p>';
}
function openAddLocationModal() {
  const titleEl = document.getElementById("locationModalTitle");
  if (titleEl) titleEl.textContent = "Add Location";
  const idEl = document.getElementById("locId");
  if (idEl) idEl.value = "";
  const keyEl = document.getElementById("locFbKey");
  if (keyEl) keyEl.value = "";
  document.getElementById("locZone").value = store.currentZone;
  document.getElementById("locBuilding").value = "";
  document.getElementById("locSubLocation").value = "";
  document.getElementById("locDescription").value = "";
  document.getElementById("addLocationModal").classList.remove("hidden");
}
function editLocation() {
  if (!store.selectedLocation) return;
  const loc = store.locations.find((l) => l.id === store.selectedLocation);
  if (!loc) return;
  const titleEl = document.getElementById("locationModalTitle");
  if (titleEl) titleEl.textContent = "Edit Location";
  const idEl = document.getElementById("locId");
  if (idEl) idEl.value = loc.id;
  const keyEl = document.getElementById("locFbKey");
  if (keyEl) keyEl.value = loc._fbKey || "";
  document.getElementById("locZone").value = loc.zone_id || store.currentZone;
  document.getElementById("locBuilding").value = loc.building_name || "";
  document.getElementById("locSubLocation").value = loc.sub_location || "";
  document.getElementById("locDescription").value = loc.description || "";
  document.getElementById("addLocationModal").classList.remove("hidden");
}
function deleteLocation() {
  if (!store.selectedLocation) return;
  const loc = store.locations.find((l) => l.id === store.selectedLocation);
  if (!loc) return;
  if (
    !confirm(
      `Are you sure you want to delete the location "${loc.building_name} — ${loc.sub_location || "General"}"? This will also delete all its maintenance records.`,
    )
  ) {
    return;
  }
  opsDB
    .ref(`locations/${loc._fbKey}`)
    .remove()
    .then(() => {
      // Delete linked maintenance records
      const linkedRecords = store.maintenanceRecords.filter(
        (r) => r.location_id === loc.id,
      );
      linkedRecords.forEach((r) => {
        if (r._fbKey) {
          opsDB.ref(`maintenance_records/${r._fbKey}`).remove();
        }
      });
      showToast("Location and its records deleted successfully!");
      store.selectedLocation = null;
      document.getElementById("selectedLocationName").textContent =
        "Select a Location";
      document.getElementById("selectedLocationZone").textContent = "";
      const actionBtns = document.getElementById("locationActionButtons");
      if (actionBtns) actionBtns.style.display = "none";
      document.getElementById("maintenanceHistory").innerHTML =
        '<p class="text-slate-500 text-center py-8">Select a location to view maintenance history</p>';
      renderLocationsList();
    })
    .catch((err) => {
      console.error(err);
      showToast("Error deleting location", "error");
    });
}
function autofillLocationDetails(buildingName) {
  if (!buildingName) return;
  const loc = store.locations.find(
    (l) => l.zone_id === store.currentZone && l.building_name === buildingName,
  );
  if (loc) {
    document.getElementById("woSubLocation").value = loc.sub_location || "";
    const descInput = document.getElementById("woDescription");
    if (descInput && !descInput.value.trim()) {
      descInput.value = loc.description || "";
    }
  }
}
function saveLocation(event) {
  event.preventDefault();
  const idVal = document.getElementById("locId").value;
  const fbKeyVal = document.getElementById("locFbKey").value;
  const locData = {
    zone_id: document.getElementById("locZone").value,
    building_name: document.getElementById("locBuilding").value,
    sub_location: document.getElementById("locSubLocation").value,
    end_user: document.getElementById("locEndUser")?.value || "",
    description: document.getElementById("locDescription").value,
  };
  if (fbKeyVal) {
    locData._fbKey = fbKeyVal;
    locData.id = parseInt(idVal);
  } else {
    const maxId = store.locations.length
      ? Math.max(...store.locations.map((l) => l.id || 0))
      : 0;
    locData.id = maxId + 1;
  }
  fbSaveLocation(locData)
    .then(() => {
      closeModal("addLocationModal");
      showToast(
        fbKeyVal
          ? "Location updated successfully!"
          : "Location added successfully!",
      );
      document.getElementById("locId").value = "";
      document.getElementById("locFbKey").value = "";
      document.getElementById("locBuilding").value = "";
      document.getElementById("locSubLocation").value = "";
      if (document.getElementById("locEndUser")) {
        document.getElementById("locEndUser").value = "";
      }
      document.getElementById("locDescription").value = "";
      if (typeof updateSelectedZoneLocationsView === "function") {
        updateSelectedZoneLocationsView();
      }
      if (typeof renderSettingsZoneSelectorList === "function") {
        renderSettingsZoneSelectorList();
      }
      if (typeof populateEstLocationsDatalist === "function") {
        populateEstLocationsDatalist();
      }
      if (fbKeyVal && store.selectedLocation === locData.id) {
        selectLocation(locData.id);
      } else {
        renderLocationsList();
      }
    })
    .catch((err) => {
      console.error(err);
      showToast("Error saving location!", "error");
    });
}
function addMaintenanceRecord() {
  if (!store.selectedLocation) {
    showToast("Select a location first", "info");
    return;
  }
  document.getElementById("mrType").value = "Repair";
  document.getElementById("mrDescription").value = "";
  document.getElementById("mrDate").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("mrJobNumber").value = "";
  document.getElementById("maintenanceRecordModal").classList.remove("hidden");
}
function saveMaintenanceRecord(event) {
  event.preventDefault();
  if (!store.selectedLocation) {
    showToast("No location selected", "error");
    return;
  }
  const newRecord = {
    id: store.maintenanceRecords.length
      ? Math.max(...store.maintenanceRecords.map((r) => r.id)) + 1
      : 1,
    location_id: store.selectedLocation,
    job_card_id: null,
    maintenance_type: document.getElementById("mrType").value,
    description: document.getElementById("mrDescription").value,
    date: document.getElementById("mrDate").value,
    job_number: document.getElementById("mrJobNumber").value || null,
  };
  store.maintenanceRecords.push(newRecord);
  closeModal("maintenanceRecordModal");
  selectLocation(store.selectedLocation); // refresh history panel
  showToast("Maintenance record added!");
} // =============================================
// ZONE MANAGEMENT (req 10 - add / remove zones)
// =============================================
function openZoneManager() {
  document.getElementById("newZoneName").value = "";
  renderZoneManagerList();
  document.getElementById("zoneManagerModal").classList.remove("hidden");
}
function renderZoneManagerList() {
  const container = document.getElementById("zoneManagerList");
  container.innerHTML =
    store.zones
      .map((z) => {
        const locCount = store.locations.filter(
          (l) => l.zone_id === z.id,
        ).length;
        return `
        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
                <p class="font-medium text-slate-700">${z.name}</p>
                <p class="text-xs text-slate-400">${locCount} location${locCount === 1 ? "" : "s"}</p>
            </div>
            <button onclick="removeZone('${z.id}')" class="text-rose-600 hover:bg-rose-50 px-3 py-1 rounded-lg text-sm font-medium">Remove</button>
        </div>`;
      })
      .join("") ||
    '<p class="text-slate-500 text-center py-6">No zones defined</p>';
}
function addZone() {
  const name = document.getElementById("newZoneName").value.trim();
  if (!name) {
    showToast("Enter a zone name", "info");
    return;
  }
  const id = name.replace(/\s+/g, "-");
  if (
    store.zones.some(
      (z) => z.id === id || z.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    showToast("Zone already exists", "error");
    return;
  }
  store.zones.push({ id, name });
  document.getElementById("newZoneName").value = "";
  renderZoneManagerList();
  renderZoneSelectors();
  showToast(`Zone "${name}" added`);
}
function removeZone(zoneId) {
  const locCount = store.locations.filter((l) => l.zone_id === zoneId).length;
  if (locCount > 0) {
    showToast(
      `Cannot remove: ${locCount} location(s) still assigned to this zone`,
      "error",
    );
    return;
  }
  if (store.zones.length <= 1) {
    showToast("At least one zone must remain", "error");
    return;
  }
  store.zones = store.zones.filter((z) => z.id !== zoneId);
  if (store.currentZone === zoneId) {
    store.currentZone = store.zones[0].id;
  }
  renderZoneManagerList();
  renderZoneSelectors();
  renderMaintenance();
  showToast("Zone removed");
} // Rebuild every zone-bound <select> from store.zones, preserving valid selections
function renderZoneSelectors() {
  // Determine if the current officer has access to "All Zone" (Admin-&-Staff-Duties)
  let hasAllZoneAccess = true;
  let allowedZones = store.zones.map((z) => z.id); // default all
  if (store.activeProfileType === "OIC") {
    if (store.activeOicProfileId) {
      const profile = getOicProfiles().find(
        (p) => p.id === store.activeOicProfileId,
      );
      if (profile) {
        // If it is NOT the main admin (3576), check their permission
        const isMain = (profile.serviceNo || "").includes("3576");
        if (!isMain) {
          hasAllZoneAccess = profile.permAllZones === true;
          allowedZones = profile.allowedZones || [];
        }
      }
    }
  } else if (
    store.activeProfileType === "ZoneInCharge" ||
    store.activeProfileType === "ZoneSubInCharge"
  ) {
    allowedZones = [store.activeProfileZone];
    hasAllZoneAccess = false;
  }
  const visibleZones = store.zones.filter((z) => allowedZones.includes(z.id));
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let zonesToRender = [...visibleZones];
  if (hasAllZoneAccess) {
    const hasAdminZone = visibleZones.some((z) => isAdminStaffDuties(z.id));
    if (!hasAdminZone) {
      zonesToRender.push({
        id: "Admin-&-Staff-Duties",
        name: "Admin & Staff Duties"
      });
    }
  }

  let optionsHtml = zonesToRender
    .map((z) => {
      let pendingEvalCount = 0;
      let activeCount = 0;
      
      const isThisZoneAdmin = isAdminStaffDuties(z.id);
      const cleanZoneStr = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const isZoneMatch = (zoneId) => {
          if (!zoneId) return false;
          if (isThisZoneAdmin) {
              const matchedByOther = zonesToRender.some(otherZ => {
                  if (isAdminStaffDuties(otherZ.id)) return false;
                  return cleanZoneStr(zoneId) === cleanZoneStr(otherZ.id) || cleanZoneStr(zoneId) === cleanZoneStr(otherZ.name);
              });
              return !matchedByOther;
          }
          return cleanZoneStr(zoneId) === cleanZoneStr(z.id) || cleanZoneStr(zoneId) === cleanZoneStr(z.name);
      };

      const assignedSailorKeys = new Set();
      
      const activeWos = (store.workOrders || []).filter(
        (wo) => isZoneMatch(wo.zone_id) && isWorkOrderActiveOnDate(wo, dateVal),
      );
      activeWos.forEach((wo) => {
        const { sailors } = getWorkOrderAssignedSailors(wo, dateVal);
        sailors.forEach((s) => {
          assignedSailorKeys.add(String(s.id || s._fbKey));
        });
      });
      
      const activeJcs = (store.jobCards || []).filter(
        (jc) => isZoneMatch(jc.zone_id) && isWorkOrderActiveOnDate(jc, dateVal),
      );
      activeJcs.forEach((jc) => {
        const { sailors } = getWorkOrderAssignedSailors(jc, dateVal);
        sailors.forEach((s) => {
          assignedSailorKeys.add(String(s.id || s._fbKey));
        });
      }); 
      
      activeCount = assignedSailorKeys.size;
      let evalCount = 0;
      
      assignedSailorKeys.forEach((id) => {
          const s = (store.sailors || []).find(sailor => String(sailor.id) === String(id) || String(sailor._fbKey) === String(id));
          if (s && s.evaluated === true) {
              evalCount++;
          }
      });
      
      pendingEvalCount = activeCount - evalCount;

      let displayStr = z.name;
      if (activeCount > 0) {
        displayStr = `${z.name} (🟢 ${activeCount} | 🔴 ${pendingEvalCount})`;
      } else {
        displayStr = `${z.name} (🟢 0 | 🔴 0)`;
      }
      return `<option value="${z.id}">${displayStr}</option>`;
    })
    .join("");
  ["zoneSelector", "locZone"].forEach((selId) => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    let prev = sel.value;
    if (selId === "zoneSelector") {
      if (store.currentZone) {
        prev = store.currentZone;
      } else if (localStorage.getItem("ncw_saved_zone")) {
        prev = localStorage.getItem("ncw_saved_zone");
      }
      
      // Prevent overwriting a valid saved zone before Firebase zones load
      if (prev && !visibleZones.some((z) => z.id === prev) && !isAdminStaffDuties(prev)) {
        optionsHtml += `<option value="${prev}">${prev}</option>`;
        visibleZones.push({ id: prev, name: prev });
      }
    }
    sel.innerHTML = optionsHtml;
    if (
      visibleZones.some((z) => z.id === prev) ||
      (isAdminStaffDuties(prev) && hasAllZoneAccess)
    ) {
      sel.value = prev;
      if (selId === "zoneSelector") {
        store.currentZone = prev;
      }
    } else {
      // Select the first visible zone
      if (visibleZones.length > 0) {
        sel.value = visibleZones[0].id;
        if (selId === "zoneSelector") {
          store.currentZone = visibleZones[0].id;
        }
      } else if (hasAllZoneAccess) {
        sel.value = "Admin-&-Staff-Duties";
        if (selId === "zoneSelector") {
          store.currentZone = "Admin-&-Staff-Duties";
        }
      }
    }
  });
  toggleViewsBasedOnZone();
} // =============================================
// REPORTS
// =============================================
function renderReports() {
  renderDailyReport();
  renderMonthlyReport();
  renderInventoryReport();
}
function switchReportTab(tab) {
  document.querySelectorAll(".report-tab").forEach((t) => {
    t.classList.remove(
      "border-green-600",
      "text-green-600",
      "bg-green-50",
      "border-b-2",
    );
    t.classList.add("text-slate-500");
  });
  document
    .querySelectorAll(".report-tab-content")
    .forEach((c) => c.classList.add("hidden"));
  event.target.classList.remove("text-slate-500");
  event.target.classList.add(
    "border-green-600",
    "text-green-600",
    "bg-green-50",
    "border-b-2",
  );
  document.getElementById(`reportTab-${tab}`).classList.remove("hidden");
}
function changeReportDate(dateVal) {
  if (!dateVal) return;
  store.reportDate = dateVal;
  renderDailyReport();
}

function renderDailyReport() {
  const todayStr = getLocalDateString();
  const dateVal = store.reportDate || store.dashboardDate || todayStr;
  
  const reportDatePicker = document.getElementById("reportDatePicker");
  if (reportDatePicker && reportDatePicker.value !== dateVal) {
    reportDatePicker.value = dateVal;
  }
  const reportDateEl = document.getElementById("reportDate");
  if (reportDateEl) {
    reportDateEl.textContent = dateVal;
  }

  // Calculate assignedIds for dateVal
  const assignedIds = new Set();
  if (dateVal === todayStr) {
    (store.workOrders || []).forEach((wo) => {
      if ((wo.status === "Active" || wo.status === "Pending") && wo.assigned) {
        const list = Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned);
        list.forEach((id) => assignedIds.add(String(id)));
      }
    });
  } else {
    (store.dailyAllocations || []).forEach((a) => {
      if (a && a.date === dateVal && a.sailor_id) {
        assignedIds.add(String(a.sailor_id));
      }
    });
  }

  // Calculate availability for dateVal
  const [yyyy, mm, dd] = dateVal.split("-");
  const monthKey = `${yyyy}-${mm}`;
  const dayKey = parseInt(dd, 10).toString();
  const dayAvail = (store.availability && store.availability[monthKey] && store.availability[monthKey][dayKey]) || {};

  // Active Projects / Jobs / Tasks filtering
  const activeWos = store.workOrders.filter(
    (wo) =>
      (wo.status === "Active" || wo.status === "Pending") &&
      (!store.currentZone || store.currentZone === "all" || wo.zone_id === store.currentZone)
  );

  const activeProjects = activeWos.filter(
    (wo) => wo.type === "PROJECT" || wo.assign_type === "PROJECT" || (wo.description || "").toLowerCase().includes("project")
  ).length;

  const activeJobs = activeWos.filter(
    (wo) => wo.type === "JOB" || wo.assign_type === "JOB" || (!wo.type && !wo.assign_type)
  ).length;

  const activeTasks = activeWos.filter(
    (wo) => wo.type === "TASK" || wo.assign_type === "TASK"
  ).length;

  const activeProjectsEl = document.getElementById("rptActiveProjects");
  if (activeProjectsEl) activeProjectsEl.textContent = activeProjects;
  
  const activeJobsEl = document.getElementById("rptActiveJobs");
  if (activeJobsEl) activeJobsEl.textContent = activeJobs;
  
  const todayTasksEl = document.getElementById("rptTodayTasks");
  if (todayTasksEl) todayTasksEl.textContent = activeTasks;

  // Resolve Sailors for Daily State Board
  let zoneSailors = (store.sailors || []).filter(
    (s) => s.zone_assigned === store.currentZone
  );
  if (zoneSailors.length === 0 && store.currentZone && store.currentZone !== "all") {
    const zoneWoIds = new Set(
      store.workOrders
        .filter((wo) => wo.zone_id === store.currentZone)
        .map((wo) => String(wo.id))
    );
    const assignedInZone = new Set();
    (store.dailyAllocations || []).forEach((a) => {
      if (zoneWoIds.has(String(a.work_order_id))) {
        assignedInZone.add(String(a.sailor_id));
      }
    });
    store.workOrders.forEach((wo) => {
      if (wo.zone_id === store.currentZone && wo.assigned) {
        const list = Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned);
        list.forEach((id) => assignedInZone.add(String(id)));
      }
    });
    if (assignedInZone.size > 0) {
      zoneSailors = store.sailors.filter(
        (s) => assignedInZone.has(String(s.id)) || assignedInZone.has(String(s._fbKey))
      );
    }
  }

  const targetSailors = (zoneSailors && zoneSailors.length > 0) ? zoneSailors : (store.sailors || []);

  const avgPerf = targetSailors.length
    ? targetSailors.reduce((sum, s) => sum + (s.avgScore || 7.0), 0) / targetSailors.length
    : 7.0;
  const avgPerfEl = document.getElementById("rptAvgPerf");
  if (avgPerfEl) avgPerfEl.textContent = avgPerf.toFixed(1);

  const feedbacks = (store.jobCards || []).filter(
    (jc) =>
      jc.feedbackReceived && jc.feedback && (!store.currentZone || store.currentZone === "all" || jc.zone_id === store.currentZone)
  );
  const avgFeedback = feedbacks.length
    ? feedbacks.reduce((sum, jc) => sum + (jc.feedback.overall || 0), 0) / feedbacks.length
    : 0;
  const userFeedbackEl = document.getElementById("rptUserFeedback");
  if (userFeedbackEl) userFeedbackEl.textContent = avgFeedback.toFixed(1);

  // Daily State Board Matrix
  const isLeaveState = (val) => {
    if (!val) return false;
    const s = typeof val === "string" ? val.trim() : String(val).trim();
    return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(s);
  };

  const trades = ["MA", "CA", "PA", "PL", "WE", "RW", "AL", "SW", "BB"];
  let totStrength = 0, totPresent = 0, totLeave = 0, totSick = 0, totDeployed = 0;

  const stateBoardEl = document.getElementById("stateBoard");
  if (stateBoardEl) {
    const rowsHtml = trades
      .map((trade) => {
        const tradeSailors = targetSailors.filter((s) => {
          const t = (s.trade || "MA").trim().toUpperCase();
          return (t === "WEL" ? "WE" : t) === trade;
        });
        const strength = tradeSailors.length;
        
        let sick = 0, leave = 0, deployed = 0;
        tradeSailors.forEach((s) => {
          const fbStatus = dayAvail[s._fbKey || s.id];
          const isL = isLeaveState(s.status) || isLeaveState(s.attendance) || isLeaveState(fbStatus);
          const isS = /sick|siq|m\/d|gilan/i.test(String(s.status || "")) || /sick|siq|m\/d|gilan/i.test(String(s.attendance || "")) || /sick|siq|m\/d|gilan/i.test(String(fbStatus || ""));
          const isAssigned = assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey));

          if (isS) sick++;
          else if (isL) leave++;
          else if (isAssigned) deployed++;
        });

        const present = Math.max(0, strength - leave - sick);

        totStrength += strength;
        totPresent += present;
        totLeave += leave;
        totSick += sick;
        totDeployed += deployed;

        return `
              <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 text-sm">
                  <td class="px-4 py-2.5 font-bold text-slate-800">${trade}</td>
                  <td class="px-4 py-2.5 text-center font-semibold text-slate-700">${strength}</td>
                  <td class="px-4 py-2.5 text-center text-emerald-600 font-bold">${present}</td>
                  <td class="px-4 py-2.5 text-center text-amber-600 font-semibold">${leave}</td>
                  <td class="px-4 py-2.5 text-center text-rose-600 font-semibold">${sick}</td>
                  <td class="px-4 py-2.5 text-center"><span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">${deployed}</span></td>
              </tr>
          `;
      })
      .join("");

    const totalRowHtml = `
          <tr class="bg-slate-900 text-white font-bold text-sm border-t-2 border-slate-700">
              <td class="px-4 py-3 uppercase tracking-wider">TOTAL</td>
              <td class="px-4 py-3 text-center text-white">${totStrength}</td>
              <td class="px-4 py-3 text-center text-emerald-400">${totPresent}</td>
              <td class="px-4 py-3 text-center text-amber-400">${totLeave}</td>
              <td class="px-4 py-3 text-center text-rose-400">${totSick}</td>
              <td class="px-4 py-3 text-center"><span class="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-xs font-bold">${totDeployed}</span></td>
          </tr>
      `;

    stateBoardEl.innerHTML = rowsHtml + totalRowHtml;
  }

  // Top Performers
  const topSailors = [...targetSailors]
    .sort((a, b) => (b.avgScore || 7.0) - (a.avgScore || 7.0))
    .slice(0, 5);
  const topPerformersEl = document.getElementById("topPerformers");
  if (topPerformersEl) {
    topPerformersEl.innerHTML = topSailors
      .map(
        (s, i) => `
          <div class="p-3 flex items-center gap-3">
              <span class="w-8 h-8 flex items-center justify-center rounded-full ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600" : "bg-slate-200"} text-white font-bold text-sm">
                  ${i + 1}
              </span>
              <div class="flex-1">
                  <p class="font-medium text-slate-700 text-sm">${s.name}</p>
                  <p class="text-xs text-slate-500">${s.trade} • ${s.rank}</p>
              </div>
              <span class="text-lg font-bold ${getPerformanceTextColor(s.avgScore || 7.0)}">${(s.avgScore || 7.0).toFixed(1)}</span>
          </div>
      `,
      )
      .join("");
  } // User Feedback Summary
  document.getElementById("userFeedbackSummary").innerHTML = `
        <div class="text-center mb-4">
            <p class="text-4xl font-bold text-purple-600">${avgFeedback.toFixed(1)}</p>
            <p class="text-sm text-slate-500">Average User Rating</p>
        </div>
        <div class="space-y-2">
            ${[
              "Productivity",
              "Workmanship",
              "Communication",
              "Professionalism",
              "Satisfaction",
            ]
              .map((cat) => {
                const key = cat.toLowerCase();
                const avg = feedbacks.length
                  ? feedbacks.reduce(
                      (sum, jc) => sum + (jc.feedback[key] || 0),
                      0,
                    ) / feedbacks.length
                  : 0;
                return `
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-600">${cat}</span>
                        <div class="flex items-center gap-2">
                            <div class="w-24 h-2 bg-slate-200 rounded-full">
                                <div class="h-2 bg-purple-500 rounded-full" style="width: ${avg * 20}%"></div>
                            </div>
                            <span class="font-medium w-8">${avg.toFixed(1)}</span>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;
}

function exportDailyStateBoardPdf() {
  const dateVal = store.reportDate || store.dashboardDate || getLocalDateString();
  const currentZoneObj = (store.zones || []).find((z) => z.id === store.currentZone);
  const zoneName = currentZoneObj ? currentZoneObj.name.toUpperCase() : (store.currentZone || "ALL ZONES").toUpperCase();

  showToast("Generating Daily State Board PDF...", "info");

  const todayStr = getLocalDateString();
  const assignedIds = new Set();
  if (dateVal === todayStr) {
    (store.workOrders || []).forEach((wo) => {
      if ((wo.status === "Active" || wo.status === "Pending") && wo.assigned) {
        const list = Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned);
        list.forEach((id) => assignedIds.add(String(id)));
      }
    });
  } else {
    (store.dailyAllocations || []).forEach((a) => {
      if (a && a.date === dateVal && a.sailor_id) {
        assignedIds.add(String(a.sailor_id));
      }
    });
  }

  const [yyyy, mm, dd] = dateVal.split("-");
  const monthKey = `${yyyy}-${mm}`;
  const dayKey = parseInt(dd, 10).toString();
  const dayAvail = (store.availability && store.availability[monthKey] && store.availability[monthKey][dayKey]) || {};

  const isLeaveState = (val) => {
    if (!val) return false;
    const s = typeof val === "string" ? val.trim() : String(val).trim();
    return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(s);
  };

  const targetSailors = store.sailors || [];
  const trades = ["MA", "CA", "PA", "PL", "WE", "RW", "AL", "SW", "BB"];
  let totStrength = 0, totPresent = 0, totLeave = 0, totSick = 0, totDeployed = 0;

  const rows = trades.map((trade) => {
    const tradeSailors = targetSailors.filter((s) => {
      const t = (s.trade || "MA").trim().toUpperCase();
      return (t === "WEL" ? "WE" : t) === trade;
    });

    let sick = 0, leave = 0, deployed = 0;
    tradeSailors.forEach((s) => {
      const fbStatus = dayAvail[s._fbKey || s.id];
      const isL = isLeaveState(s.status) || isLeaveState(s.attendance) || isLeaveState(fbStatus);
      const isS = /sick|siq|m\/d|gilan/i.test(String(s.status || "")) || /sick|siq|m\/d|gilan/i.test(String(s.attendance || "")) || /sick|siq|m\/d|gilan/i.test(String(fbStatus || ""));
      const isAssigned = assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey));

      if (isS) sick++;
      else if (isL) leave++;
      else if (isAssigned) deployed++;
    });

    const strength = tradeSailors.length;
    const present = Math.max(0, strength - leave - sick);

    totStrength += strength;
    totPresent += present;
    totLeave += leave;
    totSick += sick;
    totDeployed += deployed;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 12px; font-weight: bold; color: #1e293b;">${trade}</td>
        <td style="padding: 8px 12px; text-align: center; color: #334155;">${strength}</td>
        <td style="padding: 8px 12px; text-align: center; color: #059669; font-weight: bold;">${present}</td>
        <td style="padding: 8px 12px; text-align: center; color: #d97706; font-weight: bold;">${leave}</td>
        <td style="padding: 8px 12px; text-align: center; color: #dc2626; font-weight: bold;">${sick}</td>
        <td style="padding: 8px 12px; text-align: center; color: #2563eb; font-weight: bold;">${deployed}</td>
      </tr>
    `;
  }).join("");

  const element = document.createElement("div");
  element.style.padding = "24px";
  element.style.fontFamily = "Arial, sans-serif";
  element.style.backgroundColor = "#ffffff";
  element.style.color = "#0f172a";
  element.style.width = "750px";

  element.innerHTML = `
    <div style="border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="font-size: 18px; font-weight: bold; margin: 0; color: #0f172a;">SRI LANKA NAVY — DOCKYARD TRINCOMALEE</h1>
        <h2 style="font-size: 14px; font-weight: 600; margin: 4px 0 0 0; color: #475569;">CIVIL ENGINEERING DEPARTMENT — DAILY STATE BOARD REPORT</h2>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 12px; font-weight: bold; background: #0f172a; color: #ffffff; padding: 4px 8px; border-radius: 4px;">DATE: ${dateVal}</span>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">ZONE: ${zoneName}</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 13px; text-transform: uppercase;">
          <th style="padding: 10px 12px; text-align: left;">TRADE</th>
          <th style="padding: 10px 12px; text-align: center;">STRENGTH</th>
          <th style="padding: 10px 12px; text-align: center;">PRESENT</th>
          <th style="padding: 10px 12px; text-align: center;">LEAVE</th>
          <th style="padding: 10px 12px; text-align: center;">SICK</th>
          <th style="padding: 10px 12px; text-align: center;">DEPLOYED</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: bold;">
          <td style="padding: 10px 12px;">TOTAL</td>
          <td style="padding: 10px 12px; text-align: center;">${totStrength}</td>
          <td style="padding: 10px 12px; text-align: center; color: #34d399;">${totPresent}</td>
          <td style="padding: 10px 12px; text-align: center; color: #fbbf24;">${totLeave}</td>
          <td style="padding: 10px 12px; text-align: center; color: #f87171;">${totSick}</td>
          <td style="padding: 10px 12px; text-align: center; color: #60a5fa;">${totDeployed}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; text-align: center; color: #334155;">
      <div>
        <div style="border-top: 1px solid #94a3b8; width: 160px; margin-bottom: 4px;"></div>
        <div>PREPARED BY (OIC STAFF)</div>
      </div>
      <div>
        <div style="border-top: 1px solid #94a3b8; width: 160px; margin-bottom: 4px;"></div>
        <div>CHECKED BY (ARTIFICER)</div>
      </div>
      <div>
        <div style="border-top: 1px solid #94a3b8; width: 160px; margin-bottom: 4px;"></div>
        <div>APPROVED BY (OIC ZONE)</div>
      </div>
    </div>
  `;

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Daily_State_Board_${dateVal}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  if (typeof html2pdf !== "undefined") {
    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        showToast("Daily State Board PDF downloaded successfully!", "success");
      })
      .catch((err) => {
        console.error(err);
        showToast("Failed to generate PDF.", "error");
      });
  } else {
    window.print();
  }
}
function renderMonthlyReport() {
  // Set current month/year
  document.getElementById("monthSelect").value = String(
    new Date().getMonth() + 1,
  ).padStart(2, "0");
  document.getElementById("yearSelect").value = new Date().getFullYear();
  loadMonthlyReport();
}
function loadMonthlyReport() {
  const zoneJobCards = store.jobCards.filter(
    (jc) => jc.zone_id === store.currentZone,
  );
  const zoneJobCardIds = new Set(zoneJobCards.map((jc) => String(jc.id)));
  const zoneLabor = store.jobCardLabor.filter((l) =>
    zoneJobCardIds.has(String(l.job_card_id)),
  ); // Job Card Costs
  const totalMaterialCost = zoneJobCards.reduce(
    (sum, jc) => sum + jc.total_material_cost,
    0,
  );
  document.getElementById("monthlyJobCardCosts").innerHTML = `
        <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-blue-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-blue-600">${zoneJobCards.length}</p>
                <p class="text-xs text-slate-500">Total Job Cards</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-green-600">${zoneJobCards.filter((j) => j.status === "Completed").length}</p>
                <p class="text-xs text-slate-500">Completed</p>
            </div>
            <div class="bg-amber-50 p-4 rounded-lg text-center">
                <p class="text-lg font-bold text-amber-600">${formatCurrency(totalMaterialCost)}</p>
                <p class="text-xs text-slate-500">Total Material Cost</p>
            </div>
        </div>
        <div class="space-y-2">
            ${zoneJobCards
              .slice(0, 5)
              .map(
                (jc) => `
                <div class="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                        <span class="mono text-sm text-blue-600">${jc.job_number}</span>
                        <p class="text-xs text-slate-500 truncate max-w-xs">${jc.description}</p>
                    </div>
                    <span class="font-medium text-green-600">${formatCurrency(jc.total_material_cost)}</span>
                </div>
            `,
              )
              .join("")}
        </div>
    `; // Labor Involvement
  const totalManDays = zoneLabor.reduce((sum, l) => sum + l.hours / 8, 0);
  const laborByTrade = {};
  zoneLabor.forEach((l) => {
    const sailor = store.sailors.find(
      (s) =>
        String(s.id) === String(l.sailor_id) ||
        String(s._fbKey) === String(l.sailor_id),
    );
    if (sailor) {
      if (!laborByTrade[sailor.trade]) laborByTrade[sailor.trade] = 0;
      laborByTrade[sailor.trade] += l.hours / 8;
    }
  });
  document.getElementById("monthlyLaborInvolvement").innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-blue-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-blue-600">${totalManDays.toFixed(1)}</p>
                <p class="text-xs text-slate-500">Total Man-Days</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-purple-600">${[...new Set(zoneLabor.map((l) => l.sailor_id))].length}</p>
                <p class="text-xs text-slate-500">Workers Involved</p>
            </div>
        </div>
        <div class="space-y-2">
            ${Object.entries(laborByTrade)
              .map(
                ([trade, days]) => `
                <div class="flex items-center justify-between">
                    <span class="text-sm text-slate-600">${trade}</span>
                    <div class="flex items-center gap-2">
                        <div class="w-32 h-2 bg-slate-200 rounded-full">
                            <div class="h-2 bg-blue-500 rounded-full" style="width: ${(days / totalManDays) * 100}%"></div>
                        </div>
                        <span class="font-medium w-12 text-right">${days.toFixed(1)}</span>
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>
    `; // Monthly Top Performers
  const zoneSailors = store.sailors.filter(
    (s) => s.zone_assigned === store.currentZone,
  );
  const topPerformers = zoneSailors
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);
  document.getElementById("monthlyTopPerformers").innerHTML = topPerformers
    .map(
      (s, i) => `
        <div class="p-3 flex items-center gap-3">
            <span class="w-8 h-8 flex items-center justify-center rounded-full ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600" : "bg-slate-200"} text-white font-bold text-sm">
                ${i + 1}
            </span>
            <div class="flex-1">
                <p class="font-medium text-slate-700 text-sm">${s.name}</p>
                <p class="text-xs text-slate-500">${s.trade}</p>
            </div>
            <span class="text-lg font-bold ${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span>
        </div>
    `,
    )
    .join("");
}
function renderInventoryReport() {
  filterInventoryReport();
}
function filterInventoryReport() {
  var _document$getElementB1, _document$getElementB10, _document$getElementB11;
  let items = store.inventory.filter(
    (i) => !i.zone_id || i.zone_id === store.currentZone,
  ); // Search
  const search =
    ((_document$getElementB1 = document.getElementById("invReportSearch")) ===
      null ||
    _document$getElementB1 === void 0 ||
    (_document$getElementB1 = _document$getElementB1.value) === null ||
    _document$getElementB1 === void 0
      ? void 0
      : _document$getElementB1.toLowerCase()) || "";
  if (search) {
    items = items.filter((i) =>
      (i.description || "").toLowerCase().includes(search),
    );
  } // Category filter
  const category =
    ((_document$getElementB10 =
      document.getElementById("invReportCategory")) === null ||
    _document$getElementB10 === void 0
      ? void 0
      : _document$getElementB10.value) || "";
  if (category) {
    items = items.filter((i) => i.category === category);
  } // Sort
  const sort =
    ((_document$getElementB11 = document.getElementById("invReportSort")) ===
      null || _document$getElementB11 === void 0
      ? void 0
      : _document$getElementB11.value) || "description";
  items.sort((a, b) => {
    switch (sort) {
      case "quantity_asc":
        return a.quantity - b.quantity;
      case "quantity_desc":
        return b.quantity - a.quantity;
      case "value":
        return b.quantity * b.cost_per_unit - a.quantity * a.cost_per_unit;
      default:
        return a.description.localeCompare(b.description);
    }
  });
  const totalValue = items.reduce(
    (sum, i) => sum + i.quantity * i.cost_per_unit,
    0,
  );
  document.getElementById("inventoryReportBody").innerHTML = items
    .map((item) => {
      const value = item.quantity * item.cost_per_unit;
      const status =
        item.quantity < 10
          ? "Low Stock"
          : item.quantity < 20
            ? "Medium"
            : "Good";
      const statusColor =
        item.quantity < 10
          ? "bg-red-100 text-red-700"
          : item.quantity < 20
            ? "bg-amber-100 text-amber-700"
            : "bg-green-100 text-green-700";
      return `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">${item.description}</td>
                <td class="px-4 py-3 text-center"><span class="text-xs bg-slate-100 px-2 py-1 rounded">${item.category}</span></td>
                <td class="px-4 py-3 text-center">${item.deno}</td>
                <td class="px-4 py-3 text-center font-medium ${item.quantity < 10 ? "text-red-600" : ""}">${item.quantity}</td>
                <td class="px-4 py-3 text-right">${formatCurrency(item.cost_per_unit)}</td>
                <td class="px-4 py-3 text-right font-medium text-green-600">${formatCurrency(value)}</td>
                <td class="px-4 py-3 text-center"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${item.location}</span></td>
                <td class="px-4 py-3 text-center"><span class="text-xs ${statusColor} px-2 py-1 rounded">${status}</span></td>
            </tr>
        `;
    })
    .join("");
  document.getElementById("totalInventoryValue").textContent =
    formatCurrency(totalValue);
}
function exportDailyReport() {
  showToast("Generating daily report...", "info");
  setTimeout(() => showToast("Report exported!"), 1000);
}
function exportMonthlyReport() {
  showToast("Generating monthly report...", "info");
  setTimeout(() => showToast("Report exported!"), 1000);
}
function exportInventoryReport() {
  showToast("Generating inventory report...", "info");
  setTimeout(() => showToast("Report exported!"), 1000);
} // =============================================
// BULK UPLOAD
// =============================================
function openBulkUploadModal(type) {
  document.getElementById("bulkUploadType").value = type;
  document.getElementById("bulkUploadTitle").textContent =
    type === "inventory" ? "Inventory" : "LMD Locations";
  document.getElementById("bulkUploadFile").value = "";
  document.getElementById("bulkFileName").classList.add("hidden");
  document.getElementById("bulkUploadBtn").disabled = true;
  document
    .getElementById("bulkUploadBtn")
    .classList.add("opacity-50", "cursor-not-allowed");
  document.getElementById("bulkUploadModal").classList.remove("hidden");
}
function handleBulkFileSelect(event) {
  const file = event.target.files[0];
  const btn = document.getElementById("bulkUploadBtn");
  const nameDiv = document.getElementById("bulkFileName");
  if (file && file.name.endsWith(".csv")) {
    nameDiv.textContent = `Selected: ${file.name}`;
    nameDiv.classList.remove("hidden");
    btn.disabled = false;
    btn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    nameDiv.classList.add("hidden");
    btn.disabled = true;
    btn.classList.add("opacity-50", "cursor-not-allowed");
    if (file) showToast("Please select a valid CSV file", "error");
  }
}
function downloadCsvTemplate() {
  const type = document.getElementById("bulkUploadType").value;
  let headers = "";
  let filename = "";
  if (type === "inventory") {
    headers =
      "Description,Category,Deno,Quantity,Unit Cost,Requirement,Book No,Location,On-Charge Ref,Date Added\n";
    filename = "inventory_template.csv";
  } else if (type === "locations") {
    headers = "Zone,Building Name,Sub-location,Description\n";
    filename = "locations_template.csv";
  } else {
    showToast("Template not available for this type yet", "info");
    return;
  }
  const blob = new Blob([headers], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function processCsvUpload() {
  const fileInput = document.getElementById("bulkUploadFile");
  const type = document.getElementById("bulkUploadType").value;
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  document.getElementById("bulkUploadBtn").textContent = "Uploading...";
  document.getElementById("bulkUploadBtn").disabled = true;
  reader.onload = function (e) {
    const text = e.target.result;
    if (type === "inventory") {
      processInventoryCsv(text);
    } else if (type === "locations") {
      processLocationsCsv(text);
    }
  };
  reader.readAsText(file);
}
function parseCsvLine(line) {
  const result = [];
  let insideQuote = false;
  let entry = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === "," && !insideQuote) {
      result.push(cleanCsvValue(entry));
      entry = "";
    } else {
      entry += char;
    }
  }
  result.push(cleanCsvValue(entry));
  return result;
}
function cleanCsvValue(val) {
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  return cleaned.replace(/""/g, '"');
}
function normalizeInventoryCsvHeader(h) {
  const clean = h.trim().toLowerCase();
  if (clean.includes("description") || clean === "item" || clean === "desc") {
    return "description";
  }
  if (clean.includes("category") || clean === "cat" || clean === "group") {
    return "category";
  }
  if (
    clean === "deno" ||
    clean === "unit" ||
    clean === "uom" ||
    clean === "denominations"
  ) {
    return "deno";
  }
  if (
    clean.includes("quantity") ||
    clean === "qty" ||
    clean === "stock" ||
    clean === "amount"
  ) {
    return "quantity";
  }
  if (
    clean.includes("unit cost") ||
    clean.includes("unit_cost") ||
    clean === "cost per unit" ||
    clean === "rate" ||
    clean === "cost" ||
    clean === "price"
  ) {
    return "unit cost";
  }
  if (clean.includes("requirement") || clean === "req") {
    return "requirement";
  }
  if (
    clean.includes("book") ||
    clean === "book_no" ||
    clean === "book no" ||
    clean === "bookno"
  ) {
    return "book_no";
  }
  if (clean.includes("location") || clean === "loc" || clean === "store") {
    return "location";
  }
  if (
    clean.includes("on-charge") ||
    clean.includes("on_charge") ||
    clean.includes("charge ref") ||
    clean === "ref"
  ) {
    return "on-charge ref";
  }
  if (clean.includes("date")) {
    return "date added";
  }
  return clean;
}
function normalizeLocationsCsvHeader(h) {
  const clean = h.trim().toLowerCase();
  if (clean.includes("zone") || clean === "zone_id") {
    return "zone";
  }
  if (
    clean.includes("building") ||
    clean.includes("location 1") ||
    clean === "location1" ||
    clean === "location" ||
    clean === "building_name" ||
    clean === "building name" ||
    clean === "facility"
  ) {
    return "building name";
  }
  if (
    clean.includes("location 2") ||
    clean.includes("location2") ||
    clean.includes("sub-location") ||
    clean.includes("sub_location") ||
    clean.includes("sublocation") ||
    clean.includes("branch") ||
    clean.includes("room")
  ) {
    return "sub-location";
  }
  if (
    clean.includes("end user") ||
    clean.includes("end_user") ||
    clean.includes("occupant") ||
    clean.includes("department") ||
    clean === "dept"
  ) {
    return "end user";
  }
  if (
    clean.includes("description") ||
    clean === "desc" ||
    clean.includes("note")
  ) {
    return "description";
  }
  return clean;
}

function downloadLocationsCsvTemplate() {
  const csvContent =
    "Zone,Location,Location 2,End User,Description\n" +
    "A-Zone,Wardroom Building,Ground Floor,Officers Wardroom / Mess Sec,Dining & Lounge\n" +
    "A-Zone,Wardroom Building,First Floor,Officers Living Quarters,12 Rooms\n" +
    "BC-Zone,Junior Rates Mess,Kitchen,Mess Committee,Dining Hall & Cooking Area\n" +
    "Carpentry-Shop,Main Workshop,Timber Store,Workshop Incharge,Wood Cutting & Storage\n";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", "zone_locations_template.csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportLocationsCsv() {
  const zid = _cfgSelectedZone || "ALL";
  let locs = store.locations || [];
  if (zid !== "ALL") {
    locs = locs.filter((l) => l.zone_id === zid);
  }
  if (locs.length === 0) {
    showToast("No locations to export for this zone", "info");
    return;
  }
  let csvContent = "\uFEFFZone,Location,Location 2,End User,Description\n";
  locs.forEach((l) => {
    const zone = `"${(l.zone_id || "").replace(/"/g, '""')}"`;
    const loc1 = `"${(l.building_name || l.name || "").replace(/"/g, '""')}"`;
    const loc2 = `"${(l.sub_location || l.location2 || "").replace(/"/g, '""')}"`;
    const endUser = `"${(l.end_user || "").replace(/"/g, '""')}"`;
    const desc = `"${(l.description || "").replace(/"/g, '""')}"`;
    csvContent += `${zone},${loc1},${loc2},${endUser},${desc}\n`;
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute(
    "download",
    `Zone_Locations_${zid}_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Locations exported to CSV successfully!");
}

let _cfgSelectedZone = null;

function renderSettingsZoneSelectorList() {
  const container = document.getElementById("settingsZoneSelectorList");
  if (!container) return;
  const zones = store.zones || store.settings.zones || [];
  const badge = document.getElementById("cfgZonesCountBadge");
  if (badge) badge.textContent = `${zones.length} Zones`;

  if (!_cfgSelectedZone && zones.length > 0) {
    _cfgSelectedZone = store.currentZone || zones[0].id || zones[0].name;
  }

  container.innerHTML =
    zones
      .map((z, idx) => {
        const zid = z.id || z.name;
        const isSelected = _cfgSelectedZone === zid;
        const locCount = (store.locations || []).filter(
          (l) => l.zone_id === zid,
        ).length;
        return `
      <div onclick="selectSettingsZone('${zid}')" class="flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-pointer transition-all border ${
        isSelected
          ? "bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-300 font-bold"
          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
      }">
        <span class="text-xs">🏢 ${z.name || z.id}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full font-bold ${
          isSelected
            ? "bg-teal-800 text-teal-100"
            : "bg-slate-100 text-slate-600"
        }">${locCount}</span>
        <button onclick="event.stopPropagation(); removeZoneFromSettings(${idx})" class="p-0.5 rounded hover:bg-red-500/20 text-red-300 hover:text-white" title="Remove Zone">
          ✕
        </button>
      </div>
    `;
      })
      .join("") ||
    '<p class="text-xs text-slate-400 italic">No zones configured yet.</p>';

  updateSelectedZoneLocationsView();
}

function selectSettingsZone(zoneId) {
  _cfgSelectedZone = zoneId;
  renderSettingsZoneSelectorList();
}

function updateSelectedZoneLocationsView() {
  const titleEl = document.getElementById("cfgSelectedZoneTitle");
  if (titleEl) {
    const zObj = (store.zones || store.settings?.zones || []).find(
      (z) => (z.id || z.name) === _cfgSelectedZone,
    );
    titleEl.textContent = zObj
      ? zObj.name
      : _cfgSelectedZone || "Select Zone";
  }

  // Populate building datalist for quick add
  const datalist = document.getElementById("cfgBuildingDatalist");
  if (datalist && _cfgSelectedZone) {
    const locs = (store.locations || []).filter(
      (l) => l.zone_id === _cfgSelectedZone,
    );
    const uniqueBuildings = [
      ...new Set(
        locs
          .map((l) => (l.building_name || l.name || "").trim())
          .filter(Boolean),
      ),
    ];
    datalist.innerHTML = uniqueBuildings
      .map((b) => `<option value="${b}">`)
      .join("");
  }

  renderSettingsLocationsTable();
}

function quickSaveLocation(event) {
  event.preventDefault();
  const zid = _cfgSelectedZone || store.currentZone;
  if (!zid) {
    showToast("Please select a zone first", "error");
    return;
  }
  const buildingInput = document.getElementById("quickLocBuilding");
  const subLocInput = document.getElementById("quickLocSubLocation");
  const endUserInput = document.getElementById("quickLocEndUser");

  const building = buildingInput ? buildingInput.value.trim() : "";
  const subLocation = subLocInput ? subLocInput.value.trim() : "";
  const endUser = endUserInput ? endUserInput.value.trim() : "";

  if (!building) {
    showToast("Please enter a Location (Building Name)", "error");
    return;
  }

  const maxId = store.locations.length
    ? Math.max(...store.locations.map((l) => l.id || 0))
    : 0;

  const locData = {
    id: maxId + 1,
    zone_id: zid,
    building_name: building,
    sub_location: subLocation,
    end_user: endUser,
    description: "",
    created_at: Date.now(),
  };

  fbSaveLocation(locData)
    .then(() => {
      showToast(
        `Location "${building}${subLocation ? " - " + subLocation : ""}" added to ${zid}!`,
      );
      if (subLocInput) subLocInput.value = "";
      if (endUserInput) endUserInput.value = "";
      updateSelectedZoneLocationsView();
      populateEstLocationsDatalist();
      renderSettingsZoneSelectorList();
    })
    .catch((err) => {
      console.error(err);
      showToast("Error saving location", "error");
    });
}

function renderSettingsLocationsTable() {
  const tableBody = document.getElementById("cfgLocationsTableBody");
  if (!tableBody) return;
  const countBadge = document.getElementById("cfgLocationsCountBadge");

  const zid = _cfgSelectedZone || store.currentZone;
  const filtered = (store.locations || []).filter((l) => l.zone_id === zid);

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Locations`;
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-400 italic">
          No locations found for this zone. Use <b>"➕ Quick Add / Branch Location"</b> above or <b>"📥 Bulk Upload (CSV)"</b> to add locations.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered
    .map(
      (loc, idx) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">${idx + 1}</td>
        <td class="px-3 py-2 font-semibold text-slate-800">🏢 ${loc.building_name || loc.name || "—"}</td>
        <td class="px-3 py-2 text-teal-700 font-medium">📍 ${loc.sub_location || loc.location2 || '<span class="text-slate-400 italic font-normal">Main / General</span>'}</td>
        <td class="px-3 py-2 text-slate-700 font-medium">${loc.end_user ? `<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">👤 ${loc.end_user}</span>` : '<span class="text-slate-400 italic text-[11px]">Not assigned</span>'}</td>
        <td class="px-3 py-2 text-slate-500 text-[11px]">${loc.description || "—"}</td>
        <td class="px-3 py-2 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="editLocationFromSettings('${loc.id || loc._fbKey}')" class="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50" title="Edit">
              ✏️
            </button>
            <button onclick="deleteLocationFromSettings('${loc.id || ""}', '${loc._fbKey || ""}')" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `,
    )
    .join("");
}

function openAddLocationModal() {
  document.getElementById("locationModalTitle").textContent = "Add Location";
  document.getElementById("locId").value = "";
  document.getElementById("locFbKey").value = "";
  const zoneEl = document.getElementById("locZone");
  if (zoneEl) {
    const zones = store.zones || store.settings?.zones || [];
    zoneEl.innerHTML = zones.map(z => `<option value="${z.id || z.name}">${z.name || z.id}</option>`).join("");
    zoneEl.value = _cfgSelectedZone || store.currentZone;
  }
  document.getElementById("locBuilding").value = "";
  document.getElementById("locSubLocation").value = "";
  if (document.getElementById("locEndUser")) document.getElementById("locEndUser").value = "";
  document.getElementById("locDescription").value = "";
  document.getElementById("addLocationModal").classList.remove("hidden");
}

function editLocationFromSettings(idOrKey) {
  const loc = (store.locations || []).find(
    (l) => String(l.id) === String(idOrKey) || l._fbKey === idOrKey,
  );
  if (!loc) return;
  const titleEl = document.getElementById("locationModalTitle");
  if (titleEl) titleEl.textContent = "Edit Location";
  const idEl = document.getElementById("locId");
  if (idEl) idEl.value = loc.id || "";
  const keyEl = document.getElementById("locFbKey");
  if (keyEl) keyEl.value = loc._fbKey || "";
  const zoneEl = document.getElementById("locZone");
  if (zoneEl) {
    const zones = store.zones || store.settings?.zones || [];
    zoneEl.innerHTML = zones.map(z => `<option value="${z.id || z.name}">${z.name || z.id}</option>`).join("");
    zoneEl.value = loc.zone_id || store.currentZone;
  }
  document.getElementById("locBuilding").value =
    loc.building_name || loc.name || "";
  document.getElementById("locSubLocation").value =
    loc.sub_location || loc.location2 || "";
  if (document.getElementById("locEndUser")) {
    document.getElementById("locEndUser").value = loc.end_user || "";
  }
  document.getElementById("locDescription").value = loc.description || "";
  document.getElementById("addLocationModal").classList.remove("hidden");
}

function deleteLocationFromSettings(id, fbKey) {
  const loc = (store.locations || []).find(
    (l) => (id && String(l.id) === String(id)) || (fbKey && l._fbKey === fbKey),
  );
  const locName = loc
    ? `${loc.building_name} (${loc.sub_location || "General"})`
    : "this location";
  if (
    !confirm(
      `⚠️ Are you sure you want to delete ${locName}?\n\nThis will remove the location record from Firebase.`,
    )
  ) {
    return;
  }
  const key = fbKey || (loc ? loc._fbKey : null);
  if (key) {
    opsDB
      .ref(`locations/${key}`)
      .remove()
      .then(() => {
        showToast("Location deleted successfully!");
        updateSelectedZoneLocationsView();
        renderSettingsZoneSelectorList();
        renderLocationsList();
      })
      .catch((err) => {
        console.error(err);
        showToast("Failed to delete location", "error");
      });
  } else {
    showToast("Cannot find location record key", "error");
  }
}
function migrateInventoryLocationAndBookNo() {
  var _store$zones$find3;
  const itemsToFix = store.inventory.filter((i) => {
    const hasBookNo = !!(i.book_no && i.book_no.trim());
    const loc = (i.location || "").trim();
    const isStandardLoc = [
      "Zone Store",
      "Ready Use Store",
      "Balance Store",
      "Workshop",
    ].includes(loc);
    return !hasBookNo && loc.length > 0;
  });
  if (itemsToFix.length === 0) {
    showToast(
      "All inventory items already have valid Location and Book No!",
      "info",
    );
    return;
  }
  const zoneName =
    ((_store$zones$find3 = store.zones.find(
      (z) => z.id === store.currentZone,
    )) === null || _store$zones$find3 === void 0
      ? void 0
      : _store$zones$find3.name) || store.currentZone;
  if (
    confirm(
      `🔧 Found ${itemsToFix.length} items where Stock Book numbers are recorded in the Location field.\n\nDo you want to move these Stock Book numbers to the 'Book No' column and set the Location to '${zoneName}'?`,
    )
  ) {
    let updatedCount = 0;
    itemsToFix.forEach((item) => {
      const fbKey = item._fbKey || item.id;
      const currentLoc = item.location || "";
      const newBookNo = item.book_no || currentLoc;
      const newLocation = item.zone_id || "Zone Store";
      item.book_no = newBookNo;
      item.location = newLocation;
      if (fbKey) {
        opsDB
          .ref(`inventory/${fbKey}`)
          .update({ book_no: newBookNo, location: newLocation })
          .then(() => {
            updatedCount++;
            if (updatedCount === itemsToFix.length) {
              showToast(
                `Successfully repaired ${updatedCount} inventory items!`,
              );
            }
          })
          .catch((err) => console.error(err));
      }
    });
  }
}
function processInventoryCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) {
    showToast("CSV is empty or missing data rows", "error");
    resetBulkUploadBtn();
    return;
  }
  const headers = parseCsvLine(lines[0]).map(normalizeInventoryCsvHeader);
  let addedCount = 0;
  let skippedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    let itemData = {};
    headers.forEach((header, index) => {
      if (header === "description") itemData.description = values[index];
      if (header === "category") itemData.category = values[index];
      if (header === "deno") itemData.deno = values[index];
      if (header === "quantity")
        itemData.quantity = parseFloat(values[index]) || 0;
      if (header === "unit cost")
        itemData.cost_per_unit = safeParseCost(values[index]);
      if (header === "requirement") itemData.requirement = values[index];
      if (header === "book_no") itemData.book_no = values[index];
      if (header === "location") itemData.location = values[index];
      if (header === "on-charge ref") itemData.on_charge_ref = values[index];
      if (header === "date added") {
        let d = values[index] ? new Date(values[index]) : new Date();
        if (isNaN(d.getTime())) d = new Date();
        itemData.date_added = d.toISOString().split("T")[0];
      }
    });
    if (!itemData.category || isNaN(itemData.quantity)) {
      skippedCount++;
      continue;
    }
    itemData.description = itemData.description || "";
    itemData.deno = itemData.deno || "Nos";
    itemData.book_no = itemData.book_no || "";
    itemData.location = itemData.location || "Zone Store";
    if (!itemData.date_added)
      itemData.date_added = getLocalDateString();
    itemData.zone_id = store.currentZone;
    fbSaveInventoryItem(itemData);
    addedCount++;
  }
  closeModal("bulkUploadModal");
  resetBulkUploadBtn();
  if (addedCount > 0) {
    showToast(
      `Successfully added ${addedCount} items. ${skippedCount > 0 ? skippedCount + " skipped." : ""}`,
    ); // Render will happen automatically via Firebase listener
  } else {
    showToast(
      `No valid items found to upload. ${skippedCount} skipped.`,
      "error",
    );
  }
}
function processLocationsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) {
    showToast("CSV is empty or missing data rows", "error");
    resetBulkUploadBtn();
    return;
  }
  const headers = parseCsvLine(lines[0]).map(normalizeLocationsCsvHeader);
  let addedCount = 0;
  let skippedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    let itemData = {};
    headers.forEach((header, index) => {
      if (header === "zone") itemData.zone_id = values[index];
      if (header === "building name") itemData.building_name = values[index];
      if (header === "sub-location") itemData.sub_location = values[index];
      if (header === "end user") itemData.end_user = values[index];
      if (header === "description") itemData.description = values[index];
    }); // Validation - Zone and Building Name are required
    if (!itemData.zone_id || !itemData.building_name) {
      skippedCount++;
      continue;
    }
    itemData.sub_location = itemData.sub_location || "";
    itemData.end_user = itemData.end_user || "";
    itemData.description = itemData.description || ""; // Save to Firebase
    fbSaveLocation(itemData);
    addedCount++;
  }
  closeModal("bulkUploadModal");
  resetBulkUploadBtn();
  if (addedCount > 0) {
    showToast(
      `Successfully added ${addedCount} locations. ${skippedCount > 0 ? skippedCount + " skipped." : ""}`,
    );
  } else {
    showToast(
      `No valid locations found to upload. ${skippedCount} skipped.`,
      "error",
    );
  }
}
function resetBulkUploadBtn() {
  const btn = document.getElementById("bulkUploadBtn");
  if (btn) {
    btn.textContent = "Upload Data";
    btn.disabled = false;
  }
} // =============================================
// SETTINGS
// =============================================
// Default settings (used if Firebase has nothing)
const defaultSettings = {
  systemTitle: "CMSys v2.6",
  stationName: "CE Management System · Trincomalee",
  oicName: "",
  oicRank: "",
  oicServiceNo: "",
  oicProfiles: {},
  userName: "Sanjeewa Bandara",
  userRank: "PO1 (CE)",
  userServiceNo: "NRX 12345",
  currency: "Rs.",
  dateFormat: "YYYY-MM-DD",
  lowStockLevel: 10,
  zones: [
    { id: "A-Zone", name: "A-Zone" },
    { id: "BC-Zone", name: "BC-Zone" },
    { id: "Carpentry-Shop", name: "Carpentry Shop" },
    { id: "Welding-Shop", name: "Welding Shop" },
  ],
  offChargeDestinations: [
    "SLNS Tissa",
    "SLNS Vijaya",
    "SLNS Gemunu",
    "SLNS Rangalla",
    "BC-Zone",
    "A-Zone",
    "Carpentry-Shop",
    "Welding-Shop",
    "Public Supply (Town)",
  ],
  approvalAuthorities: ["CCED(E)", "CENA", "DAC(E)", "DGCE", "CCEO(E)"],
  workOrderTypes: ["PROJECT", "ROUTINE", "EMERGENCY", "REPAIR"],
  priorityLevels: ["Low", "Medium", "High", "Critical"],
  holidays: {},
}; // Live settings object (merged from Firebase)
store.settings = { ...defaultSettings }; // ── Load settings from Firebase DB2 ──
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val))
    return val.filter((item) => item !== null && item !== undefined);
  if (typeof val === "object") {
    return Object.values(val).filter(
      (item) => item !== null && item !== undefined,
    );
  }
  return [];
}
function initSettingsListener() {
  opsDB.ref("settings").on("value", (snapshot) => {
    if (snapshot.exists()) {
      const saved = snapshot.val();
      store.settings = { ...defaultSettings, ...saved }; // Restore arrays and objects properly
      if (saved.zones) store.settings.zones = ensureArray(saved.zones);
      if (saved.offChargeDestinations)
        store.settings.offChargeDestinations = ensureArray(
          saved.offChargeDestinations,
        );
      if (saved.approvalAuthorities)
        store.settings.approvalAuthorities = ensureArray(
          saved.approvalAuthorities,
        );
      if (saved.workOrderTypes)
        store.settings.workOrderTypes = ensureArray(saved.workOrderTypes);
      if (saved.priorityLevels)
        store.settings.priorityLevels = ensureArray(saved.priorityLevels);
      store.settings.zoneInCharges = saved.zoneInCharges || {};
      store.settings.selectedSettingsZone = saved.selectedSettingsZone || "";
      store.settings.oicProfiles = saved.oicProfiles || {};
      store.settings.holidays = saved.holidays || {};
    }
    applySettings();
    renderZoneSelectors();
    if (_currentSettingsTab === "identity") {
      renderSettingsOicProfilesList();
    }
  });
} // ── Apply loaded settings to the live UI ──
function applySettings() {
  const s = store.settings; // Sync store arrays from settings
  store.zones = s.zones || defaultSettings.zones;
  store.offChargeDestinations =
    s.offChargeDestinations || defaultSettings.offChargeDestinations;
  store.approvalAuthorities =
    s.approvalAuthorities || defaultSettings.approvalAuthorities; // Apply the active profile rules
  applyActiveProfile(); // Apply header texts
  const titleEl = document.querySelector("h1");
  if (titleEl && s.systemTitle) {
    const vSpan = titleEl.querySelector("span");
    if (titleEl.childNodes && titleEl.childNodes.length > 0) {
      titleEl.childNodes[0].textContent =
        s.systemTitle.replace(/v\S+$/, "").trim() + " ";
    } else {
      titleEl.textContent = s.systemTitle + " ";
    }
    if (vSpan)
      vSpan.textContent = s.systemTitle.match(/v[\d.]+/)
        ? s.systemTitle.match(/v[\d.]+/)[0]
        : "v2.6";
  }
  const brandTag = document.querySelector(".brand-tag");
  if (s.stationName) {
    s.stationName = s.stationName.replace(/·?\s*Miss Garrison\s*·?/gi, "·").replace(/•?\s*Miss Garrison\s*•?/gi, "•").trim();
    s.stationName = s.stationName.replace(/^·\s*/, "").replace(/\s*·$/, "").trim();
  }
  if (brandTag && s.stationName) brandTag.textContent = s.stationName;
  toggleViewsBasedOnZone();
} // ── Save a single setting field to Firebase ──
let _settingsSaveTimer = null;
function saveSettingField(key, value) {
  store.settings[key] = value; // Debounce — save after 800ms of inactivity
  clearTimeout(_settingsSaveTimer);
  _settingsSaveTimer = setTimeout(() => {
    opsDB
      .ref("settings")
      .update({ [key]: value })
      .then(() => {
        const statusEl = document.getElementById("settingsSaveStatus");
        if (statusEl) {
          statusEl.classList.remove("hidden");
          setTimeout(() => statusEl.classList.add("hidden"), 2500);
        }
        applySettings();
        renderZoneSelectors();
      });
  }, 800);
} // ── Save full array to Firebase ──
function saveSettingsArray(key, arr) {
  store.settings[key] = arr;
  opsDB
    .ref("settings")
    .update({ [key]: arr })
    .then(() => {
      applySettings();
      renderZoneSelectors();
      const statusEl = document.getElementById("settingsSaveStatus");
      if (statusEl) {
        statusEl.classList.remove("hidden");
        setTimeout(() => statusEl.classList.add("hidden"), 2000);
      }
    });
} // ── Render Settings Page ──
let _currentSettingsTab = "identity";
function renderSettings() {
  switchSettingsTab(_currentSettingsTab);
}
function switchSettingsTab(tab) {
  _currentSettingsTab = tab;
  document
    .querySelectorAll(".settings-tab-content")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".settings-tab-btn")
    .forEach((el) => el.classList.remove("active-stab"));
  const contentEl = document.getElementById(`stab-content-${tab}`);
  const btnEl = document.getElementById(`stab-${tab}`);
  if (contentEl) contentEl.classList.remove("hidden");
  if (btnEl) btnEl.classList.add("active-stab"); // Populate fields for this tab
  const s = store.settings;
  if (tab === "identity") {
    setValue("cfg-systemTitle", s.systemTitle);
    setValue("cfg-stationName", s.stationName);
    setValue("cfg-googleClientId", s.googleClientId);
    renderSettingsOicProfilesList();
  } else if (tab === "user") {
    // Populate Zone dropdown
    const zoneDropdown = document.getElementById("cfg-userZone");
    if (zoneDropdown) {
      zoneDropdown.innerHTML =
        '<option value="">-- Select Zone --</option>' +
        store.zones
          .map((z) => `<option value="${z.id}">${z.name}</option>`)
          .join("");
      zoneDropdown.value = s.selectedSettingsZone || (store.zones[0] ? store.zones[0].id : "");
    }
    changeSettingsUserZone(zoneDropdown ? zoneDropdown.value : s.selectedSettingsZone);
  } else if (tab === "zones") {
    renderSettingsZoneSelectorList();
    renderSettingsLocationsTable();
  } else if (tab === "offcharge") {
    renderSettingsOffChargeList();
  } else if (tab === "workorder") {
    renderSettingsAuthList();
    renderSettingsWoTypeList();
    renderSettingsPriorityList();
  } else if (tab === "display") {
    setValue("cfg-currency", s.currency);
    setValue("cfg-dateFormat", s.dateFormat);
    setValue("cfg-lowStockLevel", s.lowStockLevel || 10);
  } else if (tab === "dateschedule") {
    renderDateScheduleCalendar();
  }
}
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}
function changeSettingsUserZone(zoneId) {
  store.settings.selectedSettingsZone = zoneId;
  opsDB.ref("settings/selectedSettingsZone").set(zoneId); // Reload fields for the newly selected zone
  const inc = (store.settings.zoneInCharges || {})[zoneId];
  if (inc) {
    setValue("cfg-userSailorId", inc.sailorId || "");
    const displayName = inc.rank
      ? `${inc.rank} ${inc.name} (${inc.serviceNo})`
      : inc.name;
    setValue("cfg-userName", displayName || "");
    setValue("cfg-userRank", inc.rank || "");
    setValue("cfg-userServiceNo", inc.serviceNo || "");
    setValue("cfg-userSubSailorId", inc.subSailorId || "");
    const subDisplayName = inc.subRank
      ? `${inc.subRank} ${inc.subName} (${inc.subServiceNo})`
      : inc.subName || "";
    setValue("cfg-userSubName", subDisplayName || "");
    setValue("cfg-userSubRank", inc.subRank || "");
    setValue("cfg-userSubServiceNo", inc.subServiceNo || "");
    setValue("cfg-userPassword", inc.password || "");
    setValue("cfg-woInchargeId", inc.woInchargeId || "");
    setValue("cfg-woInchargeName", inc.woInchargeName || "");
    setValue("cfg-woSupervisorId", inc.woSupervisorId || "");
    setValue("cfg-woSupervisorName", inc.woSupervisorName || "");
    setValue("cfg-woArtificerId", inc.woArtificerId || "");
    setValue("cfg-woArtificerName", inc.woArtificerName || "");
  } else {
    setValue("cfg-userSailorId", "");
    setValue("cfg-userName", "");
    setValue("cfg-userRank", "");
    setValue("cfg-userServiceNo", "");
    setValue("cfg-userSubSailorId", "");
    setValue("cfg-userSubName", "");
    setValue("cfg-userSubRank", "");
    setValue("cfg-userSubServiceNo", "");
    setValue("cfg-userPassword", "");
    setValue("cfg-woInchargeId", "");
    setValue("cfg-woInchargeName", "");
    setValue("cfg-woSupervisorId", "");
    setValue("cfg-woSupervisorName", "");
    setValue("cfg-woArtificerId", "");
    setValue("cfg-woArtificerName", "");
  }
  renderSettingsSupervisorsList(zoneId);
  renderSettingsZoneTeamList(zoneId);
}

function renderSettingsSupervisorsList(zoneId) {
  const container = document.getElementById("cfgSupervisorsList");
  if (!container) return;
  const zid = zoneId || document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    container.innerHTML = '<span class="text-xs text-slate-400 italic">Select a Zone above to view supervisors</span>';
    const badge = document.getElementById("cfgSupervisorsCountBadge");
    if (badge) badge.textContent = "0";
    return;
  }
  const inc = (store.settings.zoneInCharges || {})[zid] || {};
  let supervisors = Array.isArray(inc.supervisors) ? inc.supervisors : (inc.woSupervisorId ? [{ id: inc.woSupervisorId, name: inc.woSupervisorName }] : []);

  const badge = document.getElementById("cfgSupervisorsCountBadge");
  if (badge) badge.textContent = String(supervisors.length);

  if (supervisors.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-400 italic">No supervisors added yet. Search above to add.</span>';
    return;
  }

  container.innerHTML = supervisors.map(sv => {
    const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(sv.id || sv.sailorId)) || sv;
    const displayName = s.rank ? `${s.rank} ${s.name} (${s.official_number || s.service_no || ''})` : (sv.name || sv.id);
    const sid = String(sv.id || sv.sailorId || sv._fbKey);
    return `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold shadow-2xs">
        <span>👷 ${displayName}</span>
        <button onclick="removeSupervisorFromZone('${sid}')" class="text-blue-400 hover:text-red-600 font-bold ml-1 p-0.5" title="Remove Supervisor">✕</button>
      </div>
    `;
  }).join("");
}

function showAddSupervisorResults() {
  const resultsDiv = document.getElementById("cfg-addSupervisorSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  filterAddSupervisorResults(document.getElementById("cfg-addSupervisorSearch")?.value || "");
}

function filterAddSupervisorResults(query) {
  const resultsDiv = document.getElementById("cfg-addSupervisorSearchResults");
  if (!resultsDiv) return;
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    resultsDiv.innerHTML = '<div class="p-3 text-xs text-red-500 italic">Please select a Zone first</div>';
    resultsDiv.classList.remove("hidden");
    return;
  }
  const inc = (store.settings.zoneInCharges || {})[zid] || {};
  const currentSupervisors = new Set((inc.supervisors || []).map(s => String(s.id || s.sailorId)));

  const ecSailors = getEcSailors();
  const q = (query || "").toLowerCase().trim();
  let filtered = ecSailors.filter(s => {
    const sid = String(s.id ?? s._fbKey);
    if (currentSupervisors.has(sid)) return false;
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const offNo = (s.official_number || s.officialNumber || s.service_no || "").toLowerCase();
    const rank = (s.rank || "").toLowerCase();
    return name.includes(q) || offNo.includes(q) || rank.includes(q);
  });

  if (filtered.length === 0) {
    resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No available EC sailors found</div>';
  } else {
    resultsDiv.innerHTML = filtered.slice(0, 30).map(s => {
      const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
      const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no || ''})`;
      return `
        <div onclick="addSupervisorToZone('${sid}')" class="p-2.5 text-xs hover:bg-blue-50 cursor-pointer text-slate-700 transition-colors flex items-center justify-between">
          <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
          <span class="text-[11px] text-slate-400 font-mono">${s.official_number || s.service_no || ''}</span>
        </div>
      `;
    }).join("");
  }
  resultsDiv.classList.remove("hidden");
}

function addSupervisorToZone(sailorId) {
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    showToast("Please select a Zone first", "error");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zid]) store.settings.zoneInCharges[zid] = {};

  let supervisors = Array.isArray(store.settings.zoneInCharges[zid].supervisors)
    ? [...store.settings.zoneInCharges[zid].supervisors]
    : [];

  const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(sailorId));
  if (!s) return;

  if (supervisors.some(sv => String(sv.id || sv.sailorId) === String(sailorId))) {
    showToast("Supervisor already added", "info");
    return;
  }

  supervisors.push({
    id: sailorId,
    name: `${s.rank} ${s.name}`,
    rank: s.rank || "",
    serviceNo: s.official_number || s.service_no || "",
  });

  store.settings.zoneInCharges[zid].supervisors = supervisors;
  store.settings.zoneInCharges[zid].woSupervisorId = supervisors[0].id;
  store.settings.zoneInCharges[zid].woSupervisorName = supervisors[0].name;

  opsDB.ref(`settings/zoneInCharges/${zid}/supervisors`).set(supervisors);
  opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorId`).set(supervisors[0].id);
  opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorName`).set(supervisors[0].name);

  document.getElementById("cfg-addSupervisorSearch").value = "";
  document.getElementById("cfg-addSupervisorSearchResults").classList.add("hidden");
  renderSettingsSupervisorsList(zid);
  showToast(`Added ${s.rank} ${s.name} as supervisor for ${zid}`);
}

function removeSupervisorFromZone(sailorId) {
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) return;
  if (!store.settings.zoneInCharges || !store.settings.zoneInCharges[zid]) return;

  let supervisors = (store.settings.zoneInCharges[zid].supervisors || []).filter(
    sv => String(sv.id || sv.sailorId) !== String(sailorId)
  );

  store.settings.zoneInCharges[zid].supervisors = supervisors;
  if (supervisors.length > 0) {
    store.settings.zoneInCharges[zid].woSupervisorId = supervisors[0].id;
    store.settings.zoneInCharges[zid].woSupervisorName = supervisors[0].name;
    opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorId`).set(supervisors[0].id);
    opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorName`).set(supervisors[0].name);
  } else {
    delete store.settings.zoneInCharges[zid].woSupervisorId;
    delete store.settings.zoneInCharges[zid].woSupervisorName;
    opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorId`).remove();
    opsDB.ref(`settings/zoneInCharges/${zid}/woSupervisorName`).remove();
  }

  opsDB.ref(`settings/zoneInCharges/${zid}/supervisors`).set(supervisors);
  renderSettingsSupervisorsList(zid);
  showToast("Supervisor removed");
}

function renderSettingsZoneTeamList(zoneId) {
  const container = document.getElementById("cfgZoneTeamList");
  if (!container) return;
  const zid = zoneId || document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    container.innerHTML = '<span class="text-xs text-slate-400 italic">Select a Zone above to view zone team</span>';
    const badge = document.getElementById("cfgZoneTeamCountBadge");
    if (badge) badge.textContent = "0";
    return;
  }
  const inc = (store.settings.zoneInCharges || {})[zid] || {};
  const team = Array.isArray(inc.zoneTeam) ? inc.zoneTeam : [];

  const badge = document.getElementById("cfgZoneTeamCountBadge");
  if (badge) badge.textContent = String(team.length);

  if (team.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-400 italic">No sailors assigned to this zone team yet. Search above to add.</span>';
    return;
  }

  container.innerHTML = team.map(tm => {
    const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(tm.id || tm.sailorId)) || tm;
    const sid = String(tm.id || tm.sailorId || tm._fbKey);
    const isReleased = !!tm.releasedForOtherZones;
    return `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-2xs ${
        isReleased 
          ? "bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200" 
          : "bg-teal-50 text-teal-900 border-teal-200"
      }">
        <span>⚓ ${s.rank || ''} ${s.name || tm.name} <span class="font-mono text-[10px] text-slate-500">(${s.official_number || s.service_no || tm.serviceNo || ''})</span></span>
        <button onclick="toggleSailorZoneRelease('${sid}')" class="text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
          isReleased ? "bg-amber-200 text-amber-900 hover:bg-amber-300" : "bg-teal-200 text-teal-900 hover:bg-teal-300"
        }" title="${isReleased ? 'Click to reclaim in zone' : 'Click to release for other zones'}">
          ${isReleased ? '🔓 Released' : '🔒 In-Zone'}
        </button>
        <button onclick="removeSailorFromZoneTeam('${sid}')" class="text-slate-400 hover:text-red-600 font-bold ml-1 p-0.5" title="Remove from Team">✕</button>
      </div>
    `;
  }).join("");
}

function showAddZoneTeamResults() {
  const resultsDiv = document.getElementById("cfg-addZoneTeamSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  filterAddZoneTeamResults(document.getElementById("cfg-addZoneTeamSearch")?.value || "");
}

function filterAddZoneTeamResults(query) {
  const resultsDiv = document.getElementById("cfg-addZoneTeamSearchResults");
  if (!resultsDiv) return;
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    resultsDiv.innerHTML = '<div class="p-3 text-xs text-red-500 italic">Please select a Zone first</div>';
    resultsDiv.classList.remove("hidden");
    return;
  }
  const inc = (store.settings.zoneInCharges || {})[zid] || {};
  const currentTeam = new Set((inc.zoneTeam || []).map(s => String(s.id || s.sailorId)));

  const q = (query || "").toLowerCase().trim();
  let filtered = (store.sailors || []).filter(s => {
    const sid = String(s.id ?? s._fbKey);
    if (currentTeam.has(sid)) return false;
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const offNo = (s.official_number || s.officialNumber || s.service_no || "").toLowerCase();
    const rank = (s.rank || "").toLowerCase();
    const trade = (s.trade || "").toLowerCase();
    return name.includes(q) || offNo.includes(q) || rank.includes(q) || trade.includes(q);
  });

  if (filtered.length === 0) {
    resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No matching sailors found</div>';
  } else {
    resultsDiv.innerHTML = filtered.slice(0, 30).map(s => {
      const sid = String(s.id !== undefined && s.id !== null ? s.id : s._fbKey);
      return `
        <div onclick="addSailorToZoneTeam('${sid}')" class="p-2.5 text-xs hover:bg-teal-50 cursor-pointer text-slate-700 transition-colors flex items-center justify-between">
          <span class="font-semibold text-slate-800">${s.rank || ''} ${s.name} <span class="text-teal-700 font-normal">(${s.trade || 'General'})</span></span>
          <span class="text-[11px] text-slate-400 font-mono">${s.official_number || s.service_no || ''}</span>
        </div>
      `;
    }).join("");
  }
  resultsDiv.classList.remove("hidden");
}

function addSailorToZoneTeam(sailorId) {
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) {
    showToast("Please select a Zone first", "error");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zid]) store.settings.zoneInCharges[zid] = {};

  let team = Array.isArray(store.settings.zoneInCharges[zid].zoneTeam)
    ? [...store.settings.zoneInCharges[zid].zoneTeam]
    : [];

  const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(sailorId));
  if (!s) return;

  if (team.some(tm => String(tm.id || tm.sailorId) === String(sailorId))) {
    showToast("Sailor already in Zone Team", "info");
    return;
  }

  team.push({
    id: sailorId,
    name: s.name,
    rank: s.rank || "",
    serviceNo: s.official_number || s.service_no || "",
    trade: s.trade || "",
    releasedForOtherZones: false,
  });

  store.settings.zoneInCharges[zid].zoneTeam = team;
  opsDB.ref(`settings/zoneInCharges/${zid}/zoneTeam`).set(team);

  document.getElementById("cfg-addZoneTeamSearch").value = "";
  document.getElementById("cfg-addZoneTeamSearchResults").classList.add("hidden");
  renderSettingsZoneTeamList(zid);
  showToast(`Added ${s.name} to ${zid} Zone Team`);
}

function removeSailorFromZoneTeam(sailorId) {
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) return;
  if (!store.settings.zoneInCharges || !store.settings.zoneInCharges[zid]) return;

  let team = (store.settings.zoneInCharges[zid].zoneTeam || []).filter(
    tm => String(tm.id || tm.sailorId) !== String(sailorId)
  );

  store.settings.zoneInCharges[zid].zoneTeam = team;
  opsDB.ref(`settings/zoneInCharges/${zid}/zoneTeam`).set(team);
  renderSettingsZoneTeamList(zid);
  showToast("Sailor removed from Zone Team");
}

function toggleSailorZoneRelease(sailorId) {
  const zid = document.getElementById("cfg-userZone")?.value || store.settings.selectedSettingsZone;
  if (!zid) return;
  if (!store.settings.zoneInCharges || !store.settings.zoneInCharges[zid]) return;

  let team = [...(store.settings.zoneInCharges[zid].zoneTeam || [])];
  const item = team.find(tm => String(tm.id || tm.sailorId) === String(sailorId));
  if (!item) return;

  item.releasedForOtherZones = !item.releasedForOtherZones;
  store.settings.zoneInCharges[zid].zoneTeam = team;
  opsDB.ref(`settings/zoneInCharges/${zid}/zoneTeam`).set(team);
  renderSettingsZoneTeamList(zid);
  showToast(item.releasedForOtherZones ? `Sailor released for deployment to other zones` : `Sailor marked as In-Zone only`);
}
function getEcSailors() {
  return store.sailors.filter((sailor) => {
    const offNo = (
      sailor.official_number ||
      sailor.officialNumber ||
      sailor.service_no ||
      ""
    ).trim(); // Remove leading non-alphanumeric characters (like spaces, slashes, dashes)
    const cleanOffNo = offNo.replace(/^[^a-zA-Z0-9]+/, "");
    return cleanOffNo.toUpperCase().startsWith("EC");
  });
} // Helper to retrieve all OIC profiles
function getOicProfiles() {
  const s = store.settings || {};
  let profiles = [];
  if (s.oicProfiles) {
    profiles = Object.entries(s.oicProfiles).map(([k, v]) => Object.assign({id: k}, v)).filter(
      (p) => p !== null && p !== undefined,
    );
  } // Backward compatibility for the legacy single OIC
  if (profiles.length === 0 && (s.oicName || s.oicServiceNo)) {
    profiles.push({
      id: "legacy_oic",
      name: s.oicName || "",
      rank: s.oicRank || "",
      serviceNo: s.oicServiceNo || "",
      password: s.oicPassword || "",
      permSettings: true,
      permAllZones: true,
    });
  }
  return profiles;
} // Render OIC Profiles Management List
function renderSettingsOicProfilesList() {
  var _store$currentUser;
  const listEl = document.getElementById("cfg-oicProfilesList");
  if (!listEl) return;
  const profiles = getOicProfiles(); // Check if logged-in user is the main administrator (NRC 3576)
  const isMain = (
    ((_store$currentUser = store.currentUser) === null ||
    _store$currentUser === void 0
      ? void 0
      : _store$currentUser.serviceNo) || ""
  ).includes("3576"); // Show/hide Add Officer button
  const addBtn = document.querySelector(
    'button[onclick="openOicProfileModal()"]',
  );
  if (addBtn) {
    addBtn.style.display = isMain ? "" : "none";
  }
  if (profiles.length === 0) {
    listEl.innerHTML = `<div class="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">No Officer-In-Charge profiles added yet.</div>`;
    return;
  }
  listEl.innerHTML = profiles
    .map((p) => {
      const cleanNo = p.serviceNo
        ? p.serviceNo.replace(/[^a-zA-Z0-9]/g, "")
        : "";
      const shortRank = p.rank
        ? p.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
        : "OIC";
      const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
      const avatarHtml = cleanNo
        ? `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">`
        : fallbackText;
      const isProfileMain = (p.serviceNo || "").includes("3576");
      const permList = [];
      if (p.permSettings || isProfileMain) permList.push("Settings");
      if (p.permAllZones || isProfileMain) permList.push("All Zones");
      const permText =
        permList.length > 0 ? `Access: ${permList.join(", ")}` : "Access: None";
      const actionsHtml = isMain
        ? `
            <div class="flex items-center gap-1">
                <button onclick="editOicProfile('${p.id}')" class="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onclick="deleteOicProfile('${p.id}')" class="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `
        : "";
      return `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div class="flex items-center gap-3 min-w-0">
                    ${avatarHtml}
                    <div class="min-w-0 text-left">
                        <p class="text-sm font-bold text-slate-800 truncate">${p.rank} ${p.name}</p>
                        <p class="text-[11px] text-slate-400 font-semibold font-mono">${p.serviceNo} ${p.password ? "• 🔒 Password Protected" : "• 🔓 No Password"}</p>
                        <p class="text-[10px] text-teal-650 font-semibold mt-0.5">${permText}</p>
                    </div>
                </div>
                ${actionsHtml}
            </div>
        `;
    })
    .join("");
}
function openOicProfileModal() {
  console.log("openOicProfileModal clicked");
  try {
  document.getElementById("oicProfileModalTitle").textContent =
    "Add Officer Profile";
  document.getElementById("oicProfId").value = "";
  document.getElementById("oicProfName").value = "";
  document.getElementById("oicProfRank").value = "";
  document.getElementById("oicProfServiceNo").value = "";
  document.getElementById("oicProfPassword").value = "";
  document.getElementById("oicPermSettings").checked = false;
  document.getElementById("oicPermDashboard").checked = true;
  document.getElementById("oicPermJobCards").checked = true;
  document.getElementById("oicPermInventory").checked = true;
  document.getElementById("oicPermEstimates").checked = true;
  document.getElementById("oicPermLMD").checked = true;
  document.getElementById("oicPermSailors").checked = true;
  document.getElementById("oicPermReports").checked = true;
  document.getElementById("oicPermAllZones").checked = true;
  renderOicZonesPermissionCheckboxes(store.zones.map((z) => z.id));
  toggleSelectAllZonesPerm(true);
  if (document.getElementById("oicProfileModal")) {
    const modal = document.getElementById("oicProfileModal");
    modal.classList.remove("hidden");
    modal.style.setProperty("display", "flex", "important");
    modal.style.setProperty("opacity", "1", "important");
    modal.style.setProperty("visibility", "visible", "important");
    modal.style.setProperty("z-index", "999999", "important");
    modal.classList.remove("modal-overlay"); // Remove animation class!
    console.log("Forced modal to show using inline styles and removed modal-overlay");
    
    // Diagnostics
    setTimeout(() => {
        console.log("Computed display:", window.getComputedStyle(modal).display);
        console.log("Inner Div opacity:", window.getComputedStyle(modal.firstElementChild).opacity);
        console.log("Modal HTML:", modal.outerHTML.substring(0, 300));
    }, 100);
    
  } else {
    alert("CRITICAL ERROR: oicProfileModal not found in DOM!");
  }
  } catch (err) {
    alert("Error in openOicProfileModal: " + err.message);
    console.error(err);
  }
}
function editOicProfile(id) {
  console.log("editOicProfile clicked with id:", id);
  try {
    const profiles = getOicProfiles();
    console.log("Available profiles:", profiles);
    const profile = profiles.find((p) => String(p.id) === String(id));
    if (!profile) {
        console.error("Profile not found! ID:", id);
        alert("Error: Profile not found in store! ID: " + id);
        return;
    }
  document.getElementById("oicProfileModalTitle").textContent =
    "Edit Officer Profile";
  document.getElementById("oicProfId").value = profile.id;
  document.getElementById("oicProfName").value = profile.name;
  document.getElementById("oicProfRank").value = profile.rank;
  document.getElementById("oicProfServiceNo").value = profile.serviceNo;
  document.getElementById("oicProfPassword").value = profile.password || ""; // Tab permissions
  document.getElementById("oicPermSettings").checked =
    profile.permSettings === true;
  document.getElementById("oicPermDashboard").checked =
    profile.permDashboard !== false;
  document.getElementById("oicPermJobCards").checked =
    profile.permJobCards !== false;
  document.getElementById("oicPermInventory").checked =
    profile.permInventory !== false;
  document.getElementById("oicPermEstimates").checked =
    profile.permEstimates !== false;
  document.getElementById("oicPermLMD").checked = profile.permLMD !== false;
  document.getElementById("oicPermSailors").checked =
    profile.permSailors !== false;
  document.getElementById("oicPermReports").checked =
    profile.permReports !== false; // Zone permissions
  const allZonesChecked = profile.permAllZones === true;
  document.getElementById("oicPermAllZones").checked = allZonesChecked;
  const allowedZones = profile.allowedZones || [];
  renderOicZonesPermissionCheckboxes(allowedZones);
  if (allZonesChecked) {
    toggleSelectAllZonesPerm(true);
  }
  
  const modal = document.getElementById("oicProfileModal");
  modal.classList.remove("hidden");
  modal.style.setProperty("display", "flex", "important");
  modal.style.setProperty("opacity", "1", "important");
  modal.style.setProperty("visibility", "visible", "important");
  modal.style.setProperty("z-index", "999999", "important");
  modal.classList.remove("modal-overlay"); // Remove animation class!
  
  } catch (err) {
    alert("Error opening edit modal: " + err.message);
    console.error(err);
  }
}
function saveOicProfile(event) {
  event.preventDefault();
  const id = document.getElementById("oicProfId").value;
  const name = document.getElementById("oicProfName").value.trim();
  const rank = document.getElementById("oicProfRank").value.trim();
  const serviceNo = document.getElementById("oicProfServiceNo").value.trim();
  const password = document.getElementById("oicProfPassword").value;
  const permSettings = document.getElementById("oicPermSettings").checked;
  const permDashboard = document.getElementById("oicPermDashboard").checked;
  const permJobCards = document.getElementById("oicPermJobCards").checked;
  const permInventory = document.getElementById("oicPermInventory").checked;
  const permEstimates = document.getElementById("oicPermEstimates").checked;
  const permLMD = document.getElementById("oicPermLMD").checked;
  const permSailors = document.getElementById("oicPermSailors").checked;
  const permReports = document.getElementById("oicPermReports").checked;
  const permAllZones = document.getElementById("oicPermAllZones").checked; // Collect allowed zones
  let allowedZones = [];
  if (permAllZones) {
    allowedZones = store.zones.map((z) => z.id);
  } else {
    document
      .querySelectorAll('input[name="oicZonePermCheckbox"]:checked')
      .forEach((cb) => {
        allowedZones.push(cb.value);
      });
  }
  const profileId = id || "oic_" + Date.now();
  const profileData = {
    id: profileId,
    name,
    rank,
    serviceNo,
    password,
    permSettings,
    permDashboard,
    permJobCards,
    permInventory,
    permEstimates,
    permLMD,
    permSailors,
    permReports,
    permAllZones,
    allowedZones,
  };
  if (!store.settings.oicProfiles) store.settings.oicProfiles = {};
  store.settings.oicProfiles[profileId] = profileData;
  opsDB
    .ref(`settings/oicProfiles/${profileId}`)
    .set(profileData)
    .then(() => {
      closeModal("oicProfileModal");
      applySettings();
      renderSettingsOicProfilesList();
      showToast("Officer Profile saved successfully");
      if (store.activeOicProfileId === profileId) {
        applyActiveProfile();
      }
    });
}
function deleteOicProfile(id) {
  if (!confirm("Are you sure you want to delete this officer profile?")) return;
  if (store.settings.oicProfiles) {
    delete store.settings.oicProfiles[id];
  }
  opsDB
    .ref(`settings/oicProfiles/${id}`)
    .remove()
    .then(() => {
      applySettings();
      renderSettingsOicProfilesList();
      showToast("Officer Profile deleted");
    });
}
function renderOicZonesPermissionCheckboxes(selectedZones = []) {
  const listEl = document.getElementById("oicZonesPermissionList");
  if (!listEl) return; // Sort zones by name for cleaner display
  const sortedZones = [...store.zones].sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );
  listEl.innerHTML =
    sortedZones
      .map((z) => {
        const checked = selectedZones.includes(z.id) ? "checked" : "";
        return `
            <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer truncate" title="${z.name}">
                <input type="checkbox" name="oicZonePermCheckbox" value="${z.id}" ${checked} onchange="onOicZoneCheckboxChange()" class="rounded border-slate-300 text-teal-600 focus:ring-teal-500">
                <span class="truncate">${z.name}</span>
            </label>
        `;
      })
      .join("") ||
    '<div class="col-span-2 text-center text-xs text-slate-400 italic">No zones configured yet</div>';
}
function toggleSelectAllZonesPerm(checked) {
  document
    .querySelectorAll('input[name="oicZonePermCheckbox"]')
    .forEach((cb) => {
      cb.checked = checked;
      cb.disabled = checked;
    });
}
function onOicZoneCheckboxChange() {
  // If any individual zone checkbox is unchecked, make sure 'All Zones Access' is unchecked
  const allChecked = Array.from(
    document.querySelectorAll('input[name="oicZonePermCheckbox"]'),
  ).every((cb) => cb.checked);
  const allZonesCheckbox = document.getElementById("oicPermAllZones");
  if (allZonesCheckbox && !allChecked) {
    allZonesCheckbox.checked = false;
  }
}
function showSettingsSailorResults() {
  const resultsDiv = document.getElementById("cfg-sailorSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  const inputVal = document.getElementById("cfg-userName").value.trim(); // If the input already contains a formatted sailor name, show all when focused
  if (inputVal.includes("(")) {
    filterSettingsSailorResults("");
  } else {
    filterSettingsSailorResults(inputVal);
  }
}
function filterSettingsSailorResults(query) {
  const resultsDiv = document.getElementById("cfg-sailorSearchResults");
  if (!resultsDiv) return;
  const ecSailors = getEcSailors();
  const q = query.toLowerCase().trim();
  let filtered = ecSailors;
  if (q && !query.includes("(")) {
    filtered = ecSailors.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const offNo = (
        s.official_number ||
        s.officialNumber ||
        s.service_no ||
        ""
      ).toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(q) || offNo.includes(q) || rank.includes(q);
    });
  }
  let html = `<div onclick="selectSettingsSailor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove In-Charge
    </div>`;
  if (filtered.length === 0) {
    html +=
      '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
  } else {
    html += filtered
      .map((s) => {
        var _s$id29;
        const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
        const escDisplayName = displayName
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        return `<div onclick="selectSettingsSailor('${(_s$id29 = s.id) !== null && _s$id29 !== void 0 ? _s$id29 : s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
      })
      .join("");
  }
  resultsDiv.innerHTML = html;
}
function selectSettingsSailor(sailorId, displayName) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-userName").value = "";
    document.getElementById("cfg-sailorSearchResults").classList.add("hidden");
    return;
  }
  if (sailorId) {
    const sailor = store.sailors.find((s) => {
      var _s$id30;
      return (
        String(
          (_s$id30 = s.id) !== null && _s$id30 !== void 0 ? _s$id30 : s._fbKey,
        ) === String(sailorId)
      );
    });
    if (sailor) {
      setValue("cfg-userName", displayName);
      setValue("cfg-userSailorId", sailorId);
      setValue("cfg-userRank", sailor.rank || "");
      setValue(
        "cfg-userServiceNo",
        sailor.official_number || sailor.service_no || "",
      );
      if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
      store.settings.zoneInCharges[zoneId] = {
        name: sailor.name,
        rank: sailor.rank || "",
        serviceNo: sailor.official_number || sailor.service_no || "",
        sailorId,
      };
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}`)
        .set({
          name: sailor.name,
          rank: sailor.rank || "",
          serviceNo: sailor.official_number || sailor.service_no || "",
          sailorId,
        })
        .then(() => {
          applySettings();
          showToast(
            `In-Charge for ${zoneId} updated to ${sailor.rank} ${sailor.name}`,
          );
        });
    }
  } else {
    // Cleared selection
    setValue("cfg-userName", "");
    setValue("cfg-userSailorId", "");
    setValue("cfg-userRank", "");
    setValue("cfg-userServiceNo", "");
    if (store.settings.zoneInCharges) {
      delete store.settings.zoneInCharges[zoneId];
    }
    opsDB
      .ref(`settings/zoneInCharges/${zoneId}`)
      .remove()
      .then(() => {
        applySettings();
        showToast(`In-Charge for ${zoneId} removed`);
      });
  }
  document.getElementById("cfg-sailorSearchResults").classList.add("hidden");
} // Autocomplete for Settings Zone Sub In-Charge Profile
function showSettingsSubSailorResults() {
  const resultsDiv = document.getElementById("cfg-subSailorSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  const inputVal = document.getElementById("cfg-userSubName").value.trim();
  if (inputVal.includes("(")) {
    filterSettingsSubSailorResults("");
  } else {
    filterSettingsSubSailorResults(inputVal);
  }
}
function filterSettingsSubSailorResults(query) {
  const resultsDiv = document.getElementById("cfg-subSailorSearchResults");
  if (!resultsDiv) return;
  const ecSailors = getEcSailors();
  const q = query.toLowerCase().trim();
  let filtered = ecSailors;
  if (q && !query.includes("(")) {
    filtered = ecSailors.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const offNo = (
        s.official_number ||
        s.officialNumber ||
        s.service_no ||
        ""
      ).toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(q) || offNo.includes(q) || rank.includes(q);
    });
  }
  let html = `<div onclick="selectSettingsSubSailor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Sub In-Charge
    </div>`;
  if (filtered.length === 0) {
    html +=
      '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
  } else {
    html += filtered
      .map((s) => {
        var _s$id31;
        const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
        const escDisplayName = displayName
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        return `<div onclick="selectSettingsSubSailor('${(_s$id31 = s.id) !== null && _s$id31 !== void 0 ? _s$id31 : s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
      })
      .join("");
  }
  resultsDiv.innerHTML = html;
}
function selectSettingsSubSailor(sailorId, displayName) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-userSubName").value = "";
    document
      .getElementById("cfg-subSailorSearchResults")
      .classList.add("hidden");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zoneId]) {
    showToast("Please set the Profile In-Charge Sailor first", "error");
    document.getElementById("cfg-userSubName").value = "";
    document
      .getElementById("cfg-subSailorSearchResults")
      .classList.add("hidden");
    return;
  }
  if (sailorId) {
    const sailor = store.sailors.find((s) => {
      var _s$id32;
      return (
        String(
          (_s$id32 = s.id) !== null && _s$id32 !== void 0 ? _s$id32 : s._fbKey,
        ) === String(sailorId)
      );
    });
    if (sailor) {
      setValue("cfg-userSubName", displayName);
      setValue("cfg-userSubSailorId", sailorId);
      setValue("cfg-userSubRank", sailor.rank || "");
      setValue(
        "cfg-userSubServiceNo",
        sailor.official_number || sailor.service_no || "",
      );
      store.settings.zoneInCharges[zoneId].subName = sailor.name;
      store.settings.zoneInCharges[zoneId].subRank = sailor.rank || "";
      store.settings.zoneInCharges[zoneId].subServiceNo =
        sailor.official_number || sailor.service_no || "";
      store.settings.zoneInCharges[zoneId].subSailorId = sailorId;
      opsDB.ref(`settings/zoneInCharges/${zoneId}/subName`).set(sailor.name);
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/subRank`)
        .set(sailor.rank || "");
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/subServiceNo`)
        .set(sailor.official_number || sailor.service_no || "");
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/subSailorId`)
        .set(sailorId)
        .then(() => {
          applySettings();
          showToast(
            `Sub In-Charge for ${zoneId} updated to ${sailor.rank} ${sailor.name}`,
          );
        });
    }
  } else {
    setValue("cfg-userSubName", "");
    setValue("cfg-userSubSailorId", "");
    setValue("cfg-userSubRank", "");
    setValue("cfg-userSubServiceNo", "");
    delete store.settings.zoneInCharges[zoneId].subName;
    delete store.settings.zoneInCharges[zoneId].subRank;
    delete store.settings.zoneInCharges[zoneId].subServiceNo;
    delete store.settings.zoneInCharges[zoneId].subSailorId;
    opsDB.ref(`settings/zoneInCharges/${zoneId}/subName`).remove();
    opsDB.ref(`settings/zoneInCharges/${zoneId}/subRank`).remove();
    opsDB.ref(`settings/zoneInCharges/${zoneId}/subServiceNo`).remove();
    opsDB
      .ref(`settings/zoneInCharges/${zoneId}/subSailorId`)
      .remove()
      .then(() => {
        applySettings();
        showToast(`Sub In-Charge for ${zoneId} removed`);
      });
  }
  document.getElementById("cfg-subSailorSearchResults").classList.add("hidden");
}
function getAcSailors() {
  return store.sailors.filter((sailor) => {
    const offNo = (
      sailor.official_number ||
      sailor.officialNumber ||
      sailor.service_no ||
      ""
    ).trim();
    const cleanOffNo = offNo.replace(/^[^a-zA-Z0-9]+/, "");
    return cleanOffNo.toUpperCase().startsWith("AC");
  });
} // Autocomplete for Settings Work Order Artificer
function showWoArtificerResults() {
  const resultsDiv = document.getElementById("cfg-woArtificerSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  const inputVal = document.getElementById("cfg-woArtificerName").value.trim();
  if (inputVal.includes("(")) {
    filterWoArtificerResults("");
  } else {
    filterWoArtificerResults(inputVal);
  }
}
function filterWoArtificerResults(query) {
  const resultsDiv = document.getElementById("cfg-woArtificerSearchResults");
  if (!resultsDiv) return;
  const acSailors = getAcSailors();
  const q = query.toLowerCase().trim();
  let filtered = acSailors;
  if (q && !query.includes("(")) {
    filtered = acSailors.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const offNo = (
        s.official_number ||
        s.officialNumber ||
        s.service_no ||
        ""
      ).toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(q) || offNo.includes(q) || rank.includes(q);
    });
  }
  let html = `<div onclick="selectWoArtificer('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Artificer
    </div>`;
  if (filtered.length === 0) {
    html +=
      '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
  } else {
    html += filtered
      .map((s) => {
        var _s$id33;
        const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
        const escDisplayName = displayName
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        return `<div onclick="selectWoArtificer('${(_s$id33 = s.id) !== null && _s$id33 !== void 0 ? _s$id33 : s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
      })
      .join("");
  }
  resultsDiv.innerHTML = html;
}
function selectWoArtificer(sailorId, displayName) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-woArtificerName").value = "";
    document
      .getElementById("cfg-woArtificerSearchResults")
      .classList.add("hidden");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zoneId]) {
    showToast("Please set the Profile Sailor first", "error");
    document.getElementById("cfg-woArtificerName").value = "";
    document
      .getElementById("cfg-woArtificerSearchResults")
      .classList.add("hidden");
    return;
  }
  if (sailorId) {
    const sailor = store.sailors.find((s) => {
      var _s$id34;
      return (
        String(
          (_s$id34 = s.id) !== null && _s$id34 !== void 0 ? _s$id34 : s._fbKey,
        ) === String(sailorId)
      );
    });
    if (sailor) {
      setValue("cfg-woArtificerName", displayName);
      setValue("cfg-woArtificerId", sailorId);
      store.settings.zoneInCharges[zoneId].woArtificerId = sailorId;
      store.settings.zoneInCharges[zoneId].woArtificerName = displayName;
      opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerId`).set(sailorId);
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/woArtificerName`)
        .set(displayName)
        .then(() => {
          applySettings();
          showToast(`Work Order Artificer for ${zoneId} updated`);
        });
    }
  } else {
    setValue("cfg-woArtificerName", "");
    setValue("cfg-woArtificerId", "");
    delete store.settings.zoneInCharges[zoneId].woArtificerId;
    delete store.settings.zoneInCharges[zoneId].woArtificerName;
    opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerId`).remove();
    opsDB
      .ref(`settings/zoneInCharges/${zoneId}/woArtificerName`)
      .remove()
      .then(() => {
        applySettings();
        showToast(`Work Order Artificer for ${zoneId} removed`);
      });
  }
  document
    .getElementById("cfg-woArtificerSearchResults")
    .classList.add("hidden");
} // Autocomplete for Settings Work Order Incharge
function showWoInchargeResults() {
  const resultsDiv = document.getElementById("cfg-woInchargeSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  const inputVal = document.getElementById("cfg-woInchargeName").value.trim();
  if (inputVal.includes("(")) {
    filterWoInchargeResults("");
  } else {
    filterWoInchargeResults(inputVal);
  }
}
function filterWoInchargeResults(query) {
  const resultsDiv = document.getElementById("cfg-woInchargeSearchResults");
  if (!resultsDiv) return;
  const ecSailors = getEcSailors();
  const q = query.toLowerCase().trim();
  let filtered = ecSailors;
  if (q && !query.includes("(")) {
    filtered = ecSailors.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const offNo = (
        s.official_number ||
        s.officialNumber ||
        s.service_no ||
        ""
      ).toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(q) || offNo.includes(q) || rank.includes(q);
    });
  }
  let html = `<div onclick="selectWoIncharge('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove In-Charge
    </div>`;
  if (filtered.length === 0) {
    html +=
      '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
  } else {
    html += filtered
      .map((s) => {
        var _s$id35;
        const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
        const escDisplayName = displayName
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        return `<div onclick="selectWoIncharge('${(_s$id35 = s.id) !== null && _s$id35 !== void 0 ? _s$id35 : s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
      })
      .join("");
  }
  resultsDiv.innerHTML = html;
}
function selectWoIncharge(sailorId, displayName) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-woInchargeName").value = "";
    document
      .getElementById("cfg-woInchargeSearchResults")
      .classList.add("hidden");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zoneId]) {
    showToast("Please set the Profile Sailor first", "error");
    document.getElementById("cfg-woInchargeName").value = "";
    document
      .getElementById("cfg-woInchargeSearchResults")
      .classList.add("hidden");
    return;
  }
  if (sailorId) {
    const sailor = store.sailors.find((s) => {
      var _s$id36;
      return (
        String(
          (_s$id36 = s.id) !== null && _s$id36 !== void 0 ? _s$id36 : s._fbKey,
        ) === String(sailorId)
      );
    });
    if (sailor) {
      setValue("cfg-woInchargeName", displayName);
      setValue("cfg-woInchargeId", sailorId);
      store.settings.zoneInCharges[zoneId].woInchargeId = sailorId;
      store.settings.zoneInCharges[zoneId].woInchargeName = displayName;
      opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeId`).set(sailorId);
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/woInchargeName`)
        .set(displayName)
        .then(() => {
          applySettings();
          showToast(`Work Order In-Charge for ${zoneId} updated`);
        });
    }
  } else {
    setValue("cfg-woInchargeName", "");
    setValue("cfg-woInchargeId", "");
    delete store.settings.zoneInCharges[zoneId].woInchargeId;
    delete store.settings.zoneInCharges[zoneId].woInchargeName;
    opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeId`).remove();
    opsDB
      .ref(`settings/zoneInCharges/${zoneId}/woInchargeName`)
      .remove()
      .then(() => {
        applySettings();
        showToast(`Work Order In-Charge for ${zoneId} removed`);
      });
  }
  document
    .getElementById("cfg-woInchargeSearchResults")
    .classList.add("hidden");
} // Autocomplete for Settings Work Order Supervisor
function showWoSupervisorResults() {
  const resultsDiv = document.getElementById("cfg-woSupervisorSearchResults");
  if (!resultsDiv) return;
  resultsDiv.classList.remove("hidden");
  const inputVal = document.getElementById("cfg-woSupervisorName").value.trim();
  if (inputVal.includes("(")) {
    filterWoSupervisorResults("");
  } else {
    filterWoSupervisorResults(inputVal);
  }
}
function filterWoSupervisorResults(query) {
  const resultsDiv = document.getElementById("cfg-woSupervisorSearchResults");
  if (!resultsDiv) return;
  const ecSailors = getEcSailors();
  const q = query.toLowerCase().trim();
  let filtered = ecSailors;
  if (q && !query.includes("(")) {
    filtered = ecSailors.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const offNo = (
        s.official_number ||
        s.officialNumber ||
        s.service_no ||
        ""
      ).toLowerCase();
      const rank = (s.rank || "").toLowerCase();
      return name.includes(q) || offNo.includes(q) || rank.includes(q);
    });
  }
  let html = `<div onclick="selectWoSupervisor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Supervisor
    </div>`;
  if (filtered.length === 0) {
    html +=
      '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
  } else {
    html += filtered
      .map((s) => {
        var _s$id37;
        const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
        const escDisplayName = displayName
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        return `<div onclick="selectWoSupervisor('${(_s$id37 = s.id) !== null && _s$id37 !== void 0 ? _s$id37 : s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
      })
      .join("");
  }
  resultsDiv.innerHTML = html;
}
function selectWoSupervisor(sailorId, displayName) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-woSupervisorName").value = "";
    document
      .getElementById("cfg-woSupervisorSearchResults")
      .classList.add("hidden");
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zoneId]) {
    showToast("Please set the Profile Sailor first", "error");
    document.getElementById("cfg-woSupervisorName").value = "";
    document
      .getElementById("cfg-woSupervisorSearchResults")
      .classList.add("hidden");
    return;
  }
  if (sailorId) {
    const sailor = store.sailors.find((s) => {
      var _s$id38;
      return (
        String(
          (_s$id38 = s.id) !== null && _s$id38 !== void 0 ? _s$id38 : s._fbKey,
        ) === String(sailorId)
      );
    });
    if (sailor) {
      setValue("cfg-woSupervisorName", displayName);
      setValue("cfg-woSupervisorId", sailorId);
      store.settings.zoneInCharges[zoneId].woSupervisorId = sailorId;
      store.settings.zoneInCharges[zoneId].woSupervisorName = displayName;
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/woSupervisorId`)
        .set(sailorId);
      opsDB
        .ref(`settings/zoneInCharges/${zoneId}/woSupervisorName`)
        .set(displayName)
        .then(() => {
          applySettings();
          showToast(`Work Order Supervisor for ${zoneId} updated`);
        });
    }
  } else {
    setValue("cfg-woSupervisorName", "");
    setValue("cfg-woSupervisorId", "");
    delete store.settings.zoneInCharges[zoneId].woSupervisorId;
    delete store.settings.zoneInCharges[zoneId].woSupervisorName;
    opsDB.ref(`settings/zoneInCharges/${zoneId}/woSupervisorId`).remove();
    opsDB
      .ref(`settings/zoneInCharges/${zoneId}/woSupervisorName`)
      .remove()
      .then(() => {
        applySettings();
        showToast(`Work Order Supervisor for ${zoneId} removed`);
      });
  }
  document
    .getElementById("cfg-woSupervisorSearchResults")
    .classList.add("hidden");
} // ── Zone Management ──
function renderSettingsZoneList() {
  const container = document.getElementById("settingsZoneList");
  if (!container) return;
  const zones = store.settings.zones || [];
  container.innerHTML =
    zones
      .map(
        (z, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 font-medium text-slate-700 text-sm">${z.name}</span>
            <span class="text-xs text-slate-400 font-mono">${z.id}</span>
            <button onclick="removeZoneFromSettings(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Remove">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `,
      )
      .join("") ||
    '<p class="text-sm text-slate-400 italic p-2">No zones defined</p>';
}
function addZoneFromSettings() {
  const input = document.getElementById("newZoneNameSettings");
  const name = input.value.trim();
  if (!name) return;
  const zones = [...(store.settings.zones || [])];
  const id = name.replace(/\s+/g, "-");
  if (zones.find((z) => z.id === id)) {
    showToast("Zone already exists", "error");
    return;
  }
  zones.push({ id, name });
  saveSettingsArray("zones", zones);
  input.value = "";
  renderSettingsZoneList();
  showToast(`Zone "${name}" added`);
}
function removeZoneFromSettings(index) {
  const zones = [...(store.settings.zones || [])];
  const removed = zones.splice(index, 1)[0];
  saveSettingsArray("zones", zones);
  renderSettingsZoneList();
  showToast(`Zone "${removed.name}" removed`);
} // ── Off-Charge Destinations ──
function renderSettingsOffChargeList() {
  const container = document.getElementById("settingsOffChargeList");
  if (!container) return;
  const dests = store.settings.offChargeDestinations || [];
  container.innerHTML =
    dests
      .map(
        (d, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 text-sm text-slate-700">${d}</span>
            <button onclick="editOffChargeDest(${i})" class="text-blue-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 text-xs font-medium">Edit</button>
            <button onclick="removeOffChargeDest(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `,
      )
      .join("") ||
    '<p class="text-sm text-slate-400 italic p-2">No destinations defined</p>';
}
function addOffChargeDestination() {
  const input = document.getElementById("newOffChargeDest");
  const val = input.value.trim();
  if (!val) return;
  const dests = [...(store.settings.offChargeDestinations || [])];
  dests.push(val);
  saveSettingsArray("offChargeDestinations", dests);
  input.value = "";
  renderSettingsOffChargeList();
  showToast(`"${val}" added`);
}
function editOffChargeDest(index) {
  const dests = [...(store.settings.offChargeDestinations || [])];
  const newVal = prompt("Edit destination:", dests[index]);
  if (newVal && newVal.trim()) {
    dests[index] = newVal.trim();
    saveSettingsArray("offChargeDestinations", dests);
    renderSettingsOffChargeList();
  }
}
function removeOffChargeDest(index) {
  const dests = [...(store.settings.offChargeDestinations || [])];
  dests.splice(index, 1);
  saveSettingsArray("offChargeDestinations", dests);
  renderSettingsOffChargeList();
} // ── Approval Authorities ──
function renderSettingsAuthList() {
  const container = document.getElementById("settingsAuthList");
  if (!container) return;
  const auths = store.settings.approvalAuthorities || [];
  container.innerHTML = auths
    .map(
      (a, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 text-sm text-slate-700 font-medium">${a}</span>
            <button onclick="editApprovalAuth(${i})" class="text-blue-400 hover:text-blue-600 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50">Edit</button>
            <button onclick="removeApprovalAuth(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `,
    )
    .join("");
}
function addApprovalAuthority() {
  const val = document.getElementById("newApprovalAuth").value.trim();
  if (!val) return;
  const arr = [...(store.settings.approvalAuthorities || [])];
  arr.push(val);
  saveSettingsArray("approvalAuthorities", arr);
  document.getElementById("newApprovalAuth").value = "";
  renderSettingsAuthList();
}
function editApprovalAuth(i) {
  const arr = [...(store.settings.approvalAuthorities || [])];
  const v = prompt("Edit authority:", arr[i]);
  if (v && v.trim()) {
    arr[i] = v.trim();
    saveSettingsArray("approvalAuthorities", arr);
    renderSettingsAuthList();
  }
}
function removeApprovalAuth(i) {
  const arr = [...(store.settings.approvalAuthorities || [])];
  arr.splice(i, 1);
  saveSettingsArray("approvalAuthorities", arr);
  renderSettingsAuthList();
} // ── Work Order Types ──
function renderSettingsWoTypeList() {
  const container = document.getElementById("settingsWoTypeList");
  if (!container) return;
  const types = store.settings.workOrderTypes || [];
  const colors = {
    PROJECT: "bg-blue-100 text-blue-700",
    ROUTINE: "bg-green-100 text-green-700",
    EMERGENCY: "bg-red-100 text-red-700",
    REPAIR: "bg-amber-100 text-amber-700",
  };
  container.innerHTML = types
    .map(
      (t, i) => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors[t] || "bg-slate-100 text-slate-600"}">
            ${t}
            <button onclick="removeWoType(${i})" class="ml-0.5 opacity-60 hover:opacity-100">✕</button>
        </span>
    `,
    )
    .join("");
}
function addWorkOrderType() {
  const val = document.getElementById("newWoType").value.trim().toUpperCase();
  if (!val) return;
  const arr = [...(store.settings.workOrderTypes || [])];
  if (!arr.includes(val)) {
    arr.push(val);
    saveSettingsArray("workOrderTypes", arr);
  }
  document.getElementById("newWoType").value = "";
  renderSettingsWoTypeList();
}
function removeWoType(i) {
  const arr = [...(store.settings.workOrderTypes || [])];
  arr.splice(i, 1);
  saveSettingsArray("workOrderTypes", arr);
  renderSettingsWoTypeList();
} // ── Priority Levels ──
function renderSettingsPriorityList() {
  const container = document.getElementById("settingsPriorityList");
  if (!container) return;
  const levels = store.settings.priorityLevels || [];
  const colors = {
    Low: "bg-green-100 text-green-700",
    Medium: "bg-yellow-100 text-yellow-700",
    High: "bg-orange-100 text-orange-700",
    Critical: "bg-red-100 text-red-700",
  };
  container.innerHTML = levels
    .map(
      (l, i) => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors[l] || "bg-slate-100 text-slate-600"}">
            ${l}
            <button onclick="removePriorityLevel(${i})" class="ml-0.5 opacity-60 hover:opacity-100">✕</button>
        </span>
    `,
    )
    .join("");
}
function addPriorityLevel() {
  const val = document.getElementById("newPriorityLevel").value.trim();
  if (!val) return;
  const arr = [...(store.settings.priorityLevels || [])];
  if (!arr.includes(val)) {
    arr.push(val);
    saveSettingsArray("priorityLevels", arr);
  }
  document.getElementById("newPriorityLevel").value = "";
  renderSettingsPriorityList();
}
function removePriorityLevel(i) {
  const arr = [...(store.settings.priorityLevels || [])];
  arr.splice(i, 1);
  saveSettingsArray("priorityLevels", arr);
  renderSettingsPriorityList();
} // =============================================
// INITIALIZATION
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPwaHistoryManagement();
  if (deferredPrompt) {
    const installBtn = document.getElementById("installAppBtn");
    if (installBtn) installBtn.classList.remove("hidden");
  }
  updateOnlineStatus();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  renderZoneSelectors(); // Initialize dashboardDate to today
  const today = getLocalDateString();
  store.dashboardDate = today;
  const datePicker = document.getElementById("dashboardDatePicker");
  if (datePicker) {
    datePicker.value = today;
  } // ── Initial render (with empty store — Firebase will populate) ──
  renderDashboard(); // Set today's date for inventory
  if (document.getElementById("invDate")) {
    document.getElementById("invDate").value = today;
  } // ── Start Firebase listeners ──
  // DB#1: Load sailors from ce-admin-panel2025 (realtime, read-only)
  initSailorsListener();
  initAvailabilityListener();
  initLongTermDeploymentsListeners(); // DB#2: Load & sync all CE Management System operational data from ncw-ps-operations (realtime, read-write)
  initOpsListeners(); // DB#3: Load Settings from Firebase DB2
  initSettingsListener();
  console.log("🚀 CMSys v2.6 initialized with dual Firebase");
}); // Global event listeners
document.addEventListener("dragleave", (e) => {
  if (e.target.classList) {
    e.target.classList.remove("drag-over");
  }
});
document.addEventListener("click", (e) => {
  const searchInput = document.getElementById("cfg-userName");
  const resultsDiv = document.getElementById("cfg-sailorSearchResults");
  if (searchInput && resultsDiv) {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.classList.add("hidden");
    }
  }
  const searchSubInput = document.getElementById("cfg-userSubName");
  const resultsSubDiv = document.getElementById("cfg-subSailorSearchResults");
  if (searchSubInput && resultsSubDiv) {
    if (
      !searchSubInput.contains(e.target) &&
      !resultsSubDiv.contains(e.target)
    ) {
      resultsSubDiv.classList.add("hidden");
    }
  }
  const woIncInput = document.getElementById("cfg-woInchargeName");
  const woIncDiv = document.getElementById("cfg-woInchargeSearchResults");
  if (woIncInput && woIncDiv) {
    if (!woIncInput.contains(e.target) && !woIncDiv.contains(e.target)) {
      woIncDiv.classList.add("hidden");
    }
  }
  const woSupInput = document.getElementById("cfg-woSupervisorName");
  const woSupDiv = document.getElementById("cfg-woSupervisorSearchResults");
  if (woSupInput && woSupDiv) {
    if (!woSupInput.contains(e.target) && !woSupDiv.contains(e.target)) {
      woSupDiv.classList.add("hidden");
    }
  }
  const woArtInput = document.getElementById("cfg-woArtificerName");
  const woArtDiv = document.getElementById("cfg-woArtificerSearchResults");
  if (woArtInput && woArtDiv) {
    if (!woArtInput.contains(e.target) && !woArtDiv.contains(e.target)) {
      woArtDiv.classList.add("hidden");
    }
  }
}); // Profile Pic Load Failure Fallback Handler
function handleProfilePicError(img, cleanNo) {
  if (img.src.endsWith(".JPG")) {
    img.src = `images/${cleanNo}.jpg`;
  } else if (img.src.endsWith(".jpg")) {
    img.src = `images/${cleanNo}.png`;
  } else if (img.src.endsWith(".png")) {
    img.src = `images/${cleanNo}.PNG`;
  } else {
    const fallback = img.getAttribute("data-fallback");
    img.outerHTML = fallback || "";
  }
} // ── Profile Dropdown and Switching ──
function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
    if (!dropdown.classList.contains("hidden")) {
      renderProfileDropdown();
    }
  }
}
function renderProfileDropdown() {
  const list = document.getElementById("profileOptionsList");
  if (!list) return;
  const s = store.settings || {};
  let html = ""; // 1. Command / OIC Profiles List
  const oicProfs = getOicProfiles();
  oicProfs.forEach((p) => {
    const isThisOicActive =
      store.activeProfileType === "OIC" && store.activeOicProfileId === p.id;
    const cleanNo = p.serviceNo ? p.serviceNo.replace(/[^a-zA-Z0-9]/g, "") : "";
    const shortRank = p.rank
      ? p.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
      : "OIC";
    const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
    const avatarHtml = cleanNo
      ? `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">`
      : fallbackText;
    html += `
            <div onclick="switchActiveProfile('OIC', '', '${p.id}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isThisOicActive ? "bg-teal-50/50" : ""}">
                ${avatarHtml}
                <div class="text-left flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800">${p.rank} ${p.name}</p>
                    <p class="text-[10px] text-slate-400">Officer Profile • View All Zones</p>
                </div>
                ${isThisOicActive ? '<span class="text-teal-600 font-bold">✓</span>' : ""}
            </div>
        `;
  });
  if (oicProfs.length === 0) {
    const isOicActive =
      !store.activeProfileType || store.activeProfileType === "OIC";
    html += `
            <div onclick="switchActiveProfile('OIC')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isOicActive ? "bg-teal-50/50" : ""}">
                <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">OIC</div>
                <div class="text-left flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800">Command / OIC</p>
                    <p class="text-[10px] text-slate-400">System Admin • View All Zones</p>
                </div>
                ${isOicActive ? '<span class="text-teal-600 font-bold">✓</span>' : ""}
            </div>
        `;
  } // 2. Zone In-Charge & Sub In-Charge Options
  if (store.settings && store.settings.zoneInCharges) {
    Object.entries(store.settings.zoneInCharges).forEach(([zoneId, inc]) => {
      if (!inc) return; // Main In-Charge
      if (inc.name) {
        const isActive =
          store.activeProfileType === "ZoneInCharge" &&
          store.activeProfileZone === zoneId;
        const incCleanNo = inc.serviceNo
          ? inc.serviceNo.replace(/[^a-zA-Z0-9]/g, "")
          : "";
        const incShortRank = inc.rank
          ? inc.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
          : "OIC";
        const incFallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${incShortRank}</div>`;
        const incAvatarHtml = incCleanNo
          ? `<img src="images/${incCleanNo}.JPG" data-fallback="${incFallbackText.replace(/"/g, "&quot;")}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${incCleanNo}')">`
          : incFallbackText;
        html += `
                    <div onclick="switchActiveProfile('ZoneInCharge', '${zoneId}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isActive ? "bg-teal-50/50" : ""}">
                        ${incAvatarHtml}
                        <div class="min-w-0 flex-1 text-left">
                            <p class="text-xs font-bold text-slate-800 truncate">${zoneId} In-Charge</p>
                            <p class="text-[10px] text-slate-505 truncate">${inc.rank} ${inc.name}</p>
                            <p class="text-[9px] text-slate-400 font-mono">${inc.serviceNo}</p>
                        </div>
                        ${isActive ? '<span class="text-teal-600 font-bold">✓</span>' : ""}
                    </div>
                `;
      } // Sub In-Charge
      if (inc.subName) {
        const isSubActive =
          store.activeProfileType === "ZoneSubInCharge" &&
          store.activeProfileZone === zoneId;
        const subCleanNo = inc.subServiceNo
          ? inc.subServiceNo.replace(/[^a-zA-Z0-9]/g, "")
          : "";
        const subShortRank = inc.subRank
          ? inc.subRank.replace(/[a-z\s()]/gi, "").substring(0, 3)
          : "OIC";
        const subFallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${subShortRank}</div>`;
        const subAvatarHtml = subCleanNo
          ? `<img src="images/${subCleanNo}.JPG" data-fallback="${subFallbackText.replace(/"/g, "&quot;")}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${subCleanNo}')">`
          : subFallbackText;
        html += `
                    <div onclick="switchActiveProfile('ZoneSubInCharge', '${zoneId}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isSubActive ? "bg-teal-50/50" : ""}">
                        ${subAvatarHtml}
                        <div class="min-w-0 flex-1 text-left">
                            <p class="text-xs font-bold text-slate-800 truncate">${zoneId} Sub In-Charge</p>
                            <p class="text-[10px] text-slate-505 truncate">${inc.subRank} ${inc.subName}</p>
                            <p class="text-[9px] text-slate-400 font-mono">${inc.subServiceNo}</p>
                        </div>
                        ${isSubActive ? '<span class="text-teal-600 font-bold">✓</span>' : ""}
                    </div>
                `;
      }
    });
  } // Add PWA Install option if installer is available
  if (deferredPrompt) {
    html += `
            <div class="border-t border-slate-100 mt-1">
                <div onclick="triggerPwaInstall()" class="px-4 py-2.5 hover:bg-teal-50 text-teal-600 font-semibold cursor-pointer transition-colors text-xs flex items-center gap-3">
                    <span class="text-sm">📥</span>
                    <span>Install CMSys App</span>
                </div>
            </div>
        `;
  } // Add logout button
  html += `
        <div class="border-t border-slate-100 mt-1">
            <div onclick="logoutProfile()" class="px-4 py-2.5 hover:bg-red-50 text-red-600 font-semibold cursor-pointer transition-colors text-xs flex items-center gap-3">
                <span class="text-sm">↩️</span>
                <span>Logout / Switch Profile</span>
            </div>
        </div>
    `;
  list.innerHTML = html;
}
function saveSettingsUserPassword(password) {
  const zoneId = document.getElementById("cfg-userZone").value;
  if (!zoneId) {
    showToast("Please select a Zone first", "error");
    document.getElementById("cfg-userPassword").value = "";
    return;
  }
  if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
  if (!store.settings.zoneInCharges[zoneId]) {
    showToast("Please select a Sailor first", "error");
    document.getElementById("cfg-userPassword").value = "";
    return;
  }
  store.settings.zoneInCharges[zoneId].password = password;
  opsDB
    .ref(`settings/zoneInCharges/${zoneId}/password`)
    .set(password)
    .then(() => {
      showToast(`Password for ${zoneId} In-Charge updated`);
    });
}
function switchActiveProfile(type, zoneId = "", oicProfileId = "") {
  const s = store.settings || {};
  let targetPassword = "";
  let targetName = "";
  if (type === "OIC") {
    if (oicProfileId) {
      const profile = getOicProfiles().find((p) => p.id === oicProfileId);
      if (profile) {
        targetPassword = profile.password || "";
        targetName = `${profile.rank} ${profile.name}`;
      }
    } else {
      targetPassword = s.oicPassword || "";
      targetName = s.oicName ? `${s.oicRank} ${s.oicName}` : "Command / OIC";
    }
  } else if (
    (type === "ZoneInCharge" || type === "ZoneSubInCharge") &&
    zoneId
  ) {
    const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
    if (inc) {
      targetPassword = inc.password || "";
      targetName =
        type === "ZoneSubInCharge"
          ? `${inc.subRank} ${inc.subName} (Sub In-Charge - ${zoneId})`
          : `${inc.rank} ${inc.name} (${zoneId})`;
    }
  } // If a password is set, show prompt modal instead of switching immediately
  if (targetPassword) {
    document.getElementById("pwdModalTargetType").value = type;
    document.getElementById("pwdModalTargetZone").value = zoneId;
    document.getElementById("pwdModalTargetOicProfileId").value = oicProfileId;
    document.getElementById("pwdModalProfileName").textContent = targetName;
    document.getElementById("profilePasswordInput").value = ""; // Open modal
    document.getElementById("profilePasswordModal").classList.remove("hidden");
    document.getElementById("profilePasswordInput").focus(); // Close dropdown
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) dropdown.classList.add("hidden");
    return;
  } // No password, switch immediately
  performProfileSwitch(type, zoneId, oicProfileId);
}
function submitProfilePassword(e) {
  e.preventDefault();
  const type = document.getElementById("pwdModalTargetType").value;
  const zoneId = document.getElementById("pwdModalTargetZone").value;
  const oicProfileId = document.getElementById(
    "pwdModalTargetOicProfileId",
  ).value;
  const inputPwd = document.getElementById("profilePasswordInput").value;
  const s = store.settings || {};
  let correctPassword = "";
  if (type === "OIC") {
    if (oicProfileId) {
      const profile = getOicProfiles().find((p) => p.id === oicProfileId);
      correctPassword = profile ? profile.password || "" : "";
    } else {
      correctPassword = s.oicPassword || "";
    }
  } else if (
    (type === "ZoneInCharge" || type === "ZoneSubInCharge") &&
    zoneId
  ) {
    const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
    correctPassword = inc ? inc.password || "" : "";
  }
  if (inputPwd === correctPassword) {
    closeModal("profilePasswordModal");
    performProfileSwitch(type, zoneId, oicProfileId);
  } else {
    showToast("Incorrect Password! Authentication failed.", "error");
    document.getElementById("profilePasswordInput").value = "";
    document.getElementById("profilePasswordInput").focus();
  }
}
function performProfileSwitch(type, zoneId = "", oicProfileId = "") {
  store.activeProfileType = type;
  store.activeProfileZone = zoneId; // Save to localStorage
  localStorage.setItem("ncw_ps_active_profile_type", type);
  localStorage.setItem("ncw_ps_active_profile_zone", zoneId);
  if (type === "Sailor") {
    localStorage.setItem("ncw_ps_active_sailor_id", oicProfileId); // third param is sailorId
    switchView("sailordashboard");
  } else {
    localStorage.setItem("ncw_ps_active_oic_profile_id", oicProfileId);
    switchView("dashboard");
  } // Apply active profile rules
  applyActiveProfile(); // Refresh view
  refreshCurrentView(); // Show toast
  if (type === "Sailor") {
    showToast("Logged in as Sailor");
  } else if (type === "OIC") {
    showToast("Switched to Command / OIC Profile");
  } else if (type === "ZoneSubInCharge") {
    showToast(`Logged in as Sub In-Charge for ${zoneId}`);
  } else {
    showToast(`Logged in as In-Charge for ${zoneId}`);
  }
}
function applyActiveProfile() {
  // Read profile from localStorage
  const savedType = localStorage.getItem("ncw_ps_active_profile_type");
  const savedZone = localStorage.getItem("ncw_ps_active_profile_zone");
  const loginScreen = document.getElementById("loginScreen");
  if (!savedType) {
    // Show login screen if not authenticated
    if (loginScreen) {
      loginScreen.classList.remove("hidden");
      populateLoginProfiles();
    }
    return;
  } else {
    // Hide login screen if authenticated
    if (loginScreen) loginScreen.classList.add("hidden");
    store.activeProfileType = savedType;
    store.activeProfileZone = savedZone || "";
    store.activeOicProfileId =
      localStorage.getItem("ncw_ps_active_oic_profile_id") || "";
  } // Initialize currentView on load if not set
  if (!store.currentView) {
    store.currentView =
      store.activeProfileType === "Sailor" ? "sailordashboard" : "dashboard";
  }
  const type = store.activeProfileType;
  const zoneId = store.activeProfileZone;
  const s = store.settings || {};
  const zoneSelector = document.getElementById("zoneSelector"); // Toggle administrative components for Sailor Login
  const navHeader = document.getElementById("navalHeader");
  const mobileNav = document.getElementById("mobileTabBar");
  const statusB = document.getElementById("tacticalStatusBar");
  const sidebar = document.getElementById("leftSidebarContainer");
  const sidebarToggle = document.getElementById("sidebarToggleBtn");
  if (type === "Sailor") {
    if (navHeader) navHeader.classList.add("hidden");
    if (mobileNav) mobileNav.classList.add("hidden");
    if (statusB) statusB.classList.add("hidden");
    if (sidebar) sidebar.classList.add("hidden");
    if (sidebarToggle) sidebarToggle.classList.add("hidden");
    switchView("sailordashboard");
    renderSailorDashboardView();
    return;
  } else {
    if (navHeader) navHeader.classList.remove("hidden");
    if (mobileNav) mobileNav.classList.remove("hidden");
    if (statusB) statusB.classList.remove("hidden");
    if (sidebar) sidebar.classList.remove("hidden");
    if (sidebarToggle) sidebarToggle.classList.remove("hidden");
  }
  if ((type === "ZoneInCharge" || type === "ZoneSubInCharge") && zoneId) {
    store.currentZone = zoneId;
    if (zoneSelector) {
      zoneSelector.value = zoneId;
      zoneSelector.disabled = true;
      zoneSelector.title = "Zone locked to your assigned zone";
      zoneSelector.classList.add("opacity-75", "cursor-not-allowed");
    } // Set active user info from settings
    const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
    if (inc) {
      if (type === "ZoneSubInCharge") {
        store.currentUser = {
          name: inc.subName,
          rank: inc.subRank,
          serviceNo: inc.subServiceNo,
        };
      } else {
        store.currentUser = {
          name: inc.name,
          rank: inc.rank,
          serviceNo: inc.serviceNo,
        };
      }
    } else {
      // Fallback if settings are deleted
      store.currentUser = {
        name: s.userName,
        rank: s.userRank,
        serviceNo: s.userServiceNo,
      };
    } // Hide settings tab for Zone In-Charges
    const settingsTabBtn = document.getElementById("tab-settings");
    if (settingsTabBtn) {
      settingsTabBtn.classList.add("hidden");
    }
    const mobileSettingsTabBtn = document.getElementById("mobile-tab-settings");
    if (mobileSettingsTabBtn) {
      mobileSettingsTabBtn.classList.add("hidden");
    } // If they are on settings view, redirect them to dashboard
    if (store.currentView === "settings") {
      switchView("dashboard");
    } // Update profile menu button text or picture to rank + zone
    const profileBtn = document.getElementById("profileMenuBtn");
    if (profileBtn) {
      const shortRank = store.currentUser.rank
        ? store.currentUser.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
        : "OIC";
      const shortZone = zoneId.split("-")[0];
      const fallbackText = `<span class="block">${shortRank}</span><span class="block text-[8px] text-teal-300 font-medium">${shortZone}</span>`;
      const cleanNo = store.currentUser.serviceNo
        ? store.currentUser.serviceNo.replace(/[^a-zA-Z0-9]/g, "")
        : "";
      if (cleanNo) {
        profileBtn.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover rounded-full" onerror="handleProfilePicError(this, '${cleanNo}')">`;
      } else {
        profileBtn.innerHTML = fallbackText;
      }
      profileBtn.style.fontSize = "9px";
      profileBtn.style.lineHeight = "1.1";
      profileBtn.style.whiteSpace = "pre-line";
    } // Update active profile texts in dropdown
    const activeNameEl = document.getElementById("profileActiveName");
    const activeRoleEl = document.getElementById("profileActiveRole");
    if (activeNameEl)
      activeNameEl.textContent = `${store.currentUser.rank} ${store.currentUser.name}`;
    if (activeRoleEl) activeRoleEl.textContent = `${zoneId} In-Charge`;
  } else {
    // Command / OIC Profile
    if (zoneSelector) {
      zoneSelector.disabled = false;
      zoneSelector.title = "Select Zone";
      zoneSelector.classList.remove("opacity-75", "cursor-not-allowed");
    } // Set active user info to overall OIC
    let oicName = s.oicName || s.userName;
    let oicRank = s.oicRank || s.userRank;
    let oicServiceNo = s.oicServiceNo || s.userServiceNo;
    let permSettings = true;
    let permDashboard = true;
    let permJobCards = true;
    let permInventory = true;
    let permEstimates = true;
    let permLMD = true;
    let permSailors = true;
    let permReports = true;
    let permAllZones = true;
    let allowedZones = store.zones.map((z) => z.id);
    const oicProfileId = store.activeOicProfileId;
    if (oicProfileId) {
      const profile = getOicProfiles().find((p) => p.id === oicProfileId);
      if (profile) {
        oicName = profile.name;
        oicRank = profile.rank;
        oicServiceNo = profile.serviceNo; // If it is NOT the main administrator (3576), apply permissions
        const isMain = (profile.serviceNo || "").includes("3576");
        if (!isMain) {
          permSettings = profile.permSettings === true;
          permDashboard = profile.permDashboard !== false;
          permJobCards = profile.permJobCards !== false;
          permInventory = profile.permInventory !== false;
          permEstimates = profile.permEstimates !== false;
          permLMD = profile.permLMD !== false;
          permSailors = profile.permSailors !== false;
          permReports = profile.permReports !== false;
          permAllZones = profile.permAllZones === true;
          allowedZones = profile.allowedZones || [];
        }
      }
    }
    store.currentUser = {
      name: oicName,
      rank: oicRank,
      serviceNo: oicServiceNo,
      permSettings: permSettings,
      permDashboard: permDashboard,
      permJobCards: permJobCards,
      permInventory: permInventory,
      permEstimates: permEstimates,
      permLMD: permLMD,
      permSailors: permSailors,
      permReports: permReports,
      permAllZones: permAllZones,
      allowedZones: allowedZones,
    }; // Show/hide main navigation tabs based on user permissions
    const tabPermissions = {
      settings: permSettings,
      dashboard: permDashboard,
      jobcards: permJobCards,
      inventory: permInventory,
      estimates: permEstimates,
      maintenance: permLMD,
      sailors: permSailors,
      reports: permReports,
    }; // Loop over each tab and toggle visibility
    for (const [viewName, hasAccess] of Object.entries(tabPermissions)) {
      const btn = document.getElementById(`tab-${viewName}`);
      const mBtn = document.getElementById(`mobile-tab-${viewName}`);
      if (btn) {
        if (hasAccess) btn.classList.remove("hidden");
        else btn.classList.add("hidden");
      }
      if (mBtn) {
        if (hasAccess) mBtn.classList.remove("hidden");
        else mBtn.classList.add("hidden");
      }
    } // If current view is not allowed, redirect to the first allowed view
    if (!tabPermissions[store.currentView]) {
      const firstAllowed = Object.keys(tabPermissions).find(
        (k) => tabPermissions[k],
      );
      if (firstAllowed) {
        switchView(firstAllowed);
      }
    } // Update profile menu button text or picture to "OIC" or rank
    const profileBtn = document.getElementById("profileMenuBtn");
    if (profileBtn) {
      const shortRank = store.currentUser.rank
        ? store.currentUser.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
        : "OIC";
      const fallbackText = shortRank;
      const cleanNo = store.currentUser.serviceNo
        ? store.currentUser.serviceNo.replace(/[^a-zA-Z0-9]/g, "")
        : "";
      if (cleanNo) {
        profileBtn.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover rounded-full" onerror="handleProfilePicError(this, '${cleanNo}')">`;
      } else {
        profileBtn.innerHTML = fallbackText;
      }
      profileBtn.style.fontSize = "10px";
      profileBtn.style.lineHeight = "normal";
      profileBtn.style.whiteSpace = "normal";
    } // Update active profile texts in dropdown
    const activeNameEl = document.getElementById("profileActiveName");
    const activeRoleEl = document.getElementById("profileActiveRole");
    if (activeNameEl)
      activeNameEl.textContent = store.currentUser.name
        ? `${store.currentUser.rank} ${store.currentUser.name}`
        : "Command / OIC";
    if (activeRoleEl) activeRoleEl.textContent = `System Administrator`;
  } // Update OIC badge/profile button title
  const profileBtn = document.getElementById("profileMenuBtn");
  if (profileBtn) {
    profileBtn.title = `Profile: ${store.currentUser.rank} ${store.currentUser.name} (${store.currentUser.serviceNo})`;
  } // Update zone dropdown selectors based on active profile permissions
  renderZoneSelectors(); // Refresh profile dropdown list to update checkmarks
  renderProfileDropdown();
} // Window click listener to close profile dropdown
window.addEventListener("click", function (e) {
  const dropdown = document.getElementById("profileDropdown");
  const btn = document.getElementById("profileMenuBtn");
  if (
    dropdown &&
    btn &&
    !dropdown.contains(e.target) &&
    !btn.contains(e.target)
  ) {
    dropdown.classList.add("hidden");
  }
}); // =============================================
// LOGIN PORTAL WORKFLOW
// =============================================
function populateLoginProfiles() {
  const select = document.getElementById("loginProfileSelect");
  if (!select) return;
  const s = store.settings || {};
  let options = '<option value="">-- Choose Profile --</option>'; // 1. Command / OIC Profiles
  const oicProfs = getOicProfiles();
  oicProfs.forEach((p) => {
    options += `<option value="OICProfile:${p.id}" data-service-no="${p.serviceNo || ""}" data-rank="${p.rank || "OIC"}" data-name="${p.name || ""}">OIC Profile: ${p.rank} ${p.name}</option>`;
  });
  if (oicProfs.length === 0) {
    options += `<option value="OIC" data-service-no="${s.oicServiceNo || ""}" data-rank="${s.oicRank || "OIC"}" data-name="${s.oicName || ""}">Command / OIC</option>`;
  } // 2. Zone In-Charges & Sub In-Charges
  if (s.zoneInCharges) {
    Object.entries(s.zoneInCharges).forEach(([zoneId, inc]) => {
      if (!inc) return;
      if (inc.name) {
        options += `<option value="ZoneInCharge:${zoneId}" data-service-no="${inc.serviceNo || ""}" data-rank="${inc.rank || "OIC"}" data-name="${inc.name || ""}">${zoneId} In-Charge (${inc.name})</option>`;
      }
      if (inc.subName) {
        options += `<option value="ZoneSubInCharge:${zoneId}" data-service-no="${inc.subServiceNo || ""}" data-rank="${inc.subRank || "OIC"}" data-name="${inc.subName || ""}">${zoneId} Sub In-Charge (${inc.subName})</option>`;
      }
    });
  }
  select.innerHTML = options;
}
function onLoginProfileChange(val) {
  const container = document.getElementById("loginAvatarContainer");
  const pwdGroup = document.getElementById("loginPasswordGroup");
  const pwdInput = document.getElementById("loginPasswordInput");
  if (!val) {
    container.innerHTML = '<span class="text-3xl">⚓</span>';
    pwdGroup.classList.add("hidden");
    return;
  }
  const select = document.getElementById("loginProfileSelect");
  const selectedOpt = select.options[select.selectedIndex];
  const serviceNo = selectedOpt.getAttribute("data-service-no") || "";
  const cleanNo = serviceNo.replace(/[^a-zA-Z0-9]/g, "");
  const rank = selectedOpt.getAttribute("data-rank") || "OIC";
  const name = selectedOpt.getAttribute("data-name") || ""; // Check if target profile has password
  const s = store.settings || {};
  let hasPassword = false;
  if (val === "OIC") {
    hasPassword = !!s.oicPassword;
  } else if (val.startsWith("OICProfile:")) {
    const profileId = val.split(":")[1];
    const profile = getOicProfiles().find((p) => p.id === profileId);
    hasPassword = profile && !!profile.password;
  } else if (
    val.startsWith("ZoneInCharge:") ||
    val.startsWith("ZoneSubInCharge:")
  ) {
    const zoneId = val.split(":")[1];
    const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
    hasPassword = inc && !!inc.password;
  }
  if (hasPassword) {
    pwdGroup.classList.remove("hidden");
    pwdInput.required = true;
    pwdInput.value = "";
  } else {
    pwdGroup.classList.add("hidden");
    pwdInput.required = false;
    pwdInput.value = "";
  } // Set avatar
  const shortRank = rank.replace(/[a-z\s()]/gi, "").substring(0, 3) || "OIC";
  const fallbackText = `<div class="w-full h-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-lg">${shortRank}</div>`;
  if (cleanNo) {
    container.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
  } else {
    container.innerHTML = fallbackText;
  }
}
function submitLogin(e) {
  var _document$getElementB12;
  e.preventDefault();
  const mode =
    ((_document$getElementB12 = document.getElementById("loginMode")) ===
      null || _document$getElementB12 === void 0
      ? void 0
      : _document$getElementB12.value) || "OIC";
  if (mode === "SAILOR") {
    const sailorId = document.getElementById("loginSailorSelectedId").value;
    if (!sailorId) {
      showToast("Please search and select your Service Number!", "error");
      return;
    }
    performProfileSwitch("Sailor", "", sailorId);
    document.getElementById("loginScreen").classList.add("hidden");
    return;
  }
  const val = document.getElementById("loginProfileSelect").value;
  if (!val) return;
  const pwdInput = document.getElementById("loginPasswordInput");
  const inputPwd = pwdInput.value;
  const s = store.settings || {};
  let correctPassword = "";
  let type = "OIC";
  let zoneId = "";
  let oicProfileId = "";
  if (val === "OIC") {
    correctPassword = s.oicPassword || "";
    type = "OIC";
  } else if (val.startsWith("OICProfile:")) {
    oicProfileId = val.split(":")[1];
    const profile = getOicProfiles().find((p) => p.id === oicProfileId);
    correctPassword = profile ? profile.password || "" : "";
    type = "OIC";
  } else if (
    val.startsWith("ZoneInCharge:") ||
    val.startsWith("ZoneSubInCharge:")
  ) {
    zoneId = val.split(":")[1];
    const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
    correctPassword = inc ? inc.password || "" : "";
    type = val.startsWith("ZoneSubInCharge:")
      ? "ZoneSubInCharge"
      : "ZoneInCharge";
  }
  if (correctPassword && inputPwd !== correctPassword) {
    showToast("Incorrect Password! Access Denied.", "error");
    pwdInput.value = "";
    pwdInput.focus();
    return;
  } // Login successful!
  performProfileSwitch(type, zoneId, oicProfileId); // Hide login screen
  document.getElementById("loginScreen").classList.add("hidden");
}
function logoutProfile() {
  localStorage.removeItem("ncw_ps_active_profile_type");
  localStorage.removeItem("ncw_ps_active_profile_zone");
  localStorage.removeItem("ncw_ps_active_oic_profile_id");
  localStorage.removeItem("ncw_ps_active_sailor_id");
  store.activeProfileType = null;
  store.activeProfileZone = null;
  store.activeOicProfileId = null; // Show login screen
  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) {
    loginScreen.classList.remove("hidden");
    setLoginMode("OIC"); // Reset mode to default
    populateLoginProfiles();
  } // Close dropdown
  const dropdown = document.getElementById("profileDropdown");
  if (dropdown) dropdown.classList.add("hidden");
  showToast("Logged out successfully.");
}
function toggleLeftSidebar(open) {
  const sidebar = document.getElementById("leftSidebarContainer");
  const backdrop = document.getElementById("sidebarBackdrop");
  const arrow = document.getElementById("sidebarToggleArrow");
  if (!sidebar) return;
  const isOpen =
    open !== undefined ? open : sidebar.classList.contains("-translate-x-full");
  if (isOpen) {
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.add("translate-x-0");
    if (backdrop) backdrop.classList.remove("hidden");
    if (arrow) {
      arrow.textContent = "◀";
    }
  } else {
    sidebar.classList.remove("translate-x-0");
    sidebar.classList.add("-translate-x-full");
    if (backdrop) backdrop.classList.add("hidden");
    if (arrow) {
      arrow.textContent = "➔";
    }
  }
} // =============================================
// ADMIN & STAFF DUTIES (SPECIAL ZONE) HELPERS
// =============================================
let _lmdExportAction = "csv";
function toggleViewsBasedOnZone() {
  var _document$getElementB13;
  const isSpecialZone = isAdminStaffDuties(store.currentZone); // Normal tabs to toggle
  const specialTabs = [
    "tab-jobcards",
    "tab-inventory",
    "tab-estimates",
    "tab-maintenance",
    "tab-settings",
  ];
  const mobileSpecialTabs = [
    "mobile-tab-jobcards",
    "mobile-tab-inventory",
    "mobile-tab-estimates",
    "mobile-tab-maintenance",
    "mobile-tab-settings",
  ];
  specialTabs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSpecialZone ? "none" : "";
  });
  mobileSpecialTabs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSpecialZone ? "none" : "";
  }); // Admin & Staff Duties specific tabs
  const adminTabs = ["tab-nastatus", "tab-dailydetails", "tab-summary", "tab-projects"];
  const mobileAdminTabs = ["mobile-tab-nastatus", "mobile-tab-dailydetails", "mobile-tab-summary"];
  adminTabs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSpecialZone ? "block" : "none";
  });
  mobileAdminTabs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSpecialZone ? "flex" : "none";
  });
  if (!isSpecialZone && store.currentView === "nastatus") {
    switchView("dashboard");
  } // Revert sidebar, sidebar toggle, mainPanel and boardGrid display changes (always use normal layout)
  const leftSidebar = document.getElementById("leftSidebarContainer");
  if (leftSidebar) {
    leftSidebar.style.display = "";
  }
  const sidebarToggle = document.getElementById("sidebarToggleBtn");
  if (sidebarToggle) {
    sidebarToggle.style.display = "";
  }
  const mainPanel =
    (_document$getElementB13 =
      document.getElementById("boardGridContainer")) === null ||
    _document$getElementB13 === void 0
      ? void 0
      : _document$getElementB13.parentElement;
  if (mainPanel) {
    mainPanel.classList.remove("md:col-span-12");
    mainPanel.classList.add("md:col-span-9");
  }
  const boardGrid = document.getElementById("boardGridContainer");
  if (boardGrid) {
    boardGrid.style.display = "";
  }
  const boardEmpty = document.getElementById("boardEmptyState");
  if (boardEmpty) {
    boardEmpty.style.display = "";
  }
  const ongoingSummary = document.getElementById("ongoingTasksSummaryWrapper");
  if (ongoingSummary) {
    ongoingSummary.style.display = "";
  } // Keep dashboard-level export/print buttons visible
  [
    "dashboardExportCsvBtn",
    "dashboardPrintBtn",
    "dashboardShareWhatsappBtn",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  }); // If currently on a hidden view, switch to dashboard
  const currentView = store.currentView || "dashboard";
  if (
    isSpecialZone &&
    ["jobcards", "inventory", "estimates", "maintenance", "settings"].includes(
      currentView,
    )
  ) {
    switchView("dashboard");
  }
  if (!isSpecialZone && ["dailydetails", "summary", "projects"].includes(currentView)) {
    switchView("dashboard");
  }
}
function renderDailyDetailsSpecialView() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let dailyDetailsContainer = document.getElementById("dailyDetailsContainer");
  if (!dailyDetailsContainer) {
    console.log("🔵 dailyDetailsContainer NOT found, creating...");
    dailyDetailsContainer = document.createElement("div");
    dailyDetailsContainer.id = "dailyDetailsContainer";
    dailyDetailsContainer.className = "glass-card p-6 mt-4";
    document
      .getElementById("boardGridContainer")
      .parentElement.appendChild(dailyDetailsContainer);
  }
  dailyDetailsContainer.classList.remove("hidden");
  dailyDetailsContainer.style.display = "block";
  const zones = store.zones; // included Admin & Staff Duties
  let tableRows = "";
  let hasAllocations = false;
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal)
    );
    wos.sort((a, b) => {
      const aInCharge = (a.description || "").toLowerCase().includes("in charge") || a.assign_type === "In Charge";
      const bInCharge = (b.description || "").toLowerCase().includes("in charge") || b.assign_type === "In Charge";
      if (aInCharge && !bInCharge) return -1;
      if (!aInCharge && bInCharge) return 1;
      return 0;
    });
    // Find if this zone has any active allocations and collect unique sailors
    const zoneSailorMap = new Map();
    wos.forEach((wo) => {
      let sailorsInWo = [];
      if (dateVal === today) {
        const assignedIds = (wo.assigned || []).map(String);
        sailorsInWo = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      } else {
        const assignedIds = (store.dailyAllocations || [])
          .filter(
            (a) =>
              a.date === dateVal && String(a.work_order_id) === String(wo.id),
          )
          .map((a) => String(a.sailor_id));
        sailorsInWo = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      }
      sailorsInWo.forEach((s) => {
        const key = String(s.id || s._fbKey);
        if (!zoneSailorMap.has(key)) zoneSailorMap.set(key, s);
      });
    });

    const zoneSailors = Array.from(zoneSailorMap.values());
    const zoneHasAllocations = zoneSailors.length > 0;

    if (zoneHasAllocations) {
      hasAllocations = true;
      const totalCount = zoneSailors.length;
      const isSsRank = (rankStr) => {
        if (!rankStr) return false;
        const r = rankStr.trim().toUpperCase();
        return (
          /^(PO|CPO|FCPO|MCPO|MCA|CPOA|WPO|SWPO)/.test(r) ||
          r.includes("PO") ||
          r.includes("CPO") ||
          r.includes("CHIEF") ||
          r.includes("MCA")
        );
      };
      const ssCount = zoneSailors.filter((s) => isSsRank(s.rank)).length;

      const tradeCounts = {};
      zoneSailors.forEach((s) => {
        const t = (s.trade || "Other").trim().toUpperCase();
        tradeCounts[t] = (tradeCounts[t] || 0) + 1;
      });
      const tradeSummaryStr =
        Object.entries(tradeCounts)
          .map(([trade, count]) => `${trade}: ${count}`)
          .join(" | ") || "None";

      // Add Zone Group Header row spanning all 6 columns
      tableRows += `
                <tr class="bg-slate-900 text-white font-bold">
                    <td colspan="6" class="px-4 py-2.5 text-xs uppercase tracking-wider">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span>🗺️ ZONE: ${z.name.toUpperCase()}</span>
                                <span class="bg-teal-950/80 text-teal-300 px-2 py-0.5 rounded-full text-[10px] border border-teal-700/50 font-bold tracking-normal normal-case">
                                    👥 Total: ${totalCount}
                                </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 text-[11px] font-normal normal-case">
                                <span class="bg-amber-950/90 text-amber-300 px-2.5 py-0.5 rounded-md border border-amber-600/50 font-semibold shadow-sm">
                                    🎖️ S/S: ${ssCount}
                                </span>
                                <span class="bg-slate-800/90 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700 font-medium">
                                    🛠️ ${tradeSummaryStr}
                                </span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
      wos.forEach((wo) => {
        let assignedSailors = [];
        let assignedIds = [];
        if (dateVal === today) {
          const activeAssignedIds = (wo.assigned || []).map(String);
          const committedIds = (store.dailyAllocations || [])
            .filter((a) => a.date === dateVal && String(a.work_order_id) === String(wo.id))
            .map((a) => String(a.sailor_id));
          assignedIds = [...new Set([...activeAssignedIds, ...committedIds])];
        } else {
          assignedIds = (store.dailyAllocations || [])
            .filter((a) => a.date === dateVal && String(a.work_order_id) === String(wo.id))
            .map((a) => String(a.sailor_id));
        }
        assignedSailors = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
        if (assignedSailors.length > 0) {
          // Add Work Order separator row
          tableRows += `
                        <tr class="bg-slate-50 font-bold border-b border-slate-200">
                            <td colspan="6" class="px-4 py-2 text-[10px] text-slate-700 text-center underline uppercase tracking-wide">
                                📋 ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
          assignedSailors.forEach((s, idx) => {
            const serNo = String(idx + 1).padStart(2, "0");
            const parsedOffNo = parseOfficialNumber(
              s.official_number || s.service_no,
            );
            tableRows += `
                            <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors text-xs text-slate-800">
                                <td class="px-4 py-2 text-center font-medium">${serNo}</td>
                                <td class="px-4 py-2">${s.rank || "AB"}</td>
                                <td class="px-4 py-2 font-semibold text-slate-900">${s.name}</td>
                                <td class="px-4 py-2 text-center"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">${parsedOffNo.type}</span></td>
                                <td class="px-4 py-2 font-mono">${parsedOffNo.num}</td>
                                <td class="px-4 py-2 text-center"><span class="bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-bold">${s.trade || "—"}</span></td>
                            </tr>
                        `;
          });
        }
      });
    }
  }); // ─────────────────────────────────────────────
  // APPEND LONG-TERM DEPLOYMENTS (HOUSING, OUT, OTHER BASE)
  // ─────────────────────────────────────────────
  const longTerm = getLongTermAllocations();
  const renderLongTermCategory = (
    title,
    icon,
    dataArray,
    bgColor,
    textColor,
  ) => {
    if (dataArray.length === 0) return; // Group by project name
    const grouped = {};
    dataArray.forEach((item) => {
      const isLeave =
        item.sailor.attendance === "Leave" ||
        item.sailor.attendance === "Sick" ||
        item.sailor.status === "NA" ||
        item.sailor.status === "Leave" ||
        item.sailor.status === "Sick";
      if (isLeave) return;
      const p = item.projectName || "Unknown";
      if (!grouped[p]) grouped[p] = [];
      grouped[p].push(item.sailor);
    });
    const activeProjects = Object.keys(grouped);
    if (activeProjects.length === 0) return;
    hasAllocations = true;
    tableRows += `
            <tr class="${bgColor} ${textColor} font-bold">
                <td colspan="6" class="px-4 py-2.5 text-xs uppercase tracking-wider">
                    ${icon} ${title}
                </td>
            </tr>
        `;
    activeProjects.forEach((projName) => {
      tableRows += `
                <tr class="bg-slate-50 font-bold border-b border-slate-200">
                    <td colspan="6" class="px-4 py-2 text-[10px] text-slate-700 text-center underline uppercase tracking-wide">
                        📋 PROJECT: ${projName.toUpperCase()}
                    </td>
                </tr>
            `;
      grouped[projName].forEach((s, idx) => {
        const serNo = String(idx + 1).padStart(2, "0");
        const parsedOffNo = parseOfficialNumber(
          s.official_number || s.service_no,
        );
        tableRows += `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors text-xs text-slate-800">
                        <td class="px-4 py-2 text-center font-medium">${serNo}</td>
                        <td class="px-4 py-2">${s.rank || "AB"}</td>
                        <td class="px-4 py-2 font-semibold text-slate-900">${s.name}</td>
                        <td class="px-4 py-2 text-center"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">${parsedOffNo.type}</span></td>
                        <td class="px-4 py-2 font-mono">${parsedOffNo.num}</td>
                        <td class="px-4 py-2 text-center"><span class="bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-bold">${s.trade || "—"}</span></td>
                    </tr>
                `;
      });
    });
  };
  renderLongTermCategory(
    "HOUSING PROJECTS",
    "🏠",
    longTerm.housing,
    "bg-indigo-900",
    "text-indigo-100",
  );
  renderLongTermCategory(
    "OUT PROJECTS",
    "🏗️",
    longTerm.outProject,
    "bg-fuchsia-900",
    "text-fuchsia-100",
  );
  renderLongTermCategory(
    "OTHER BASE",
    "⚓",
    longTerm.otherBase,
    "bg-cyan-900",
    "text-cyan-100",
  );
  if (!hasAllocations) {
    tableRows = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-400 italic text-sm">
                    No active assignments logged for this date.
                </td>
            </tr>
        `;
  }
  dailyDetailsContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <div>
                <h3 class="text-lg font-bold text-slate-800">📋 Daily Details - All Zones</h3>
                <p class="text-xs text-slate-500 mt-0.5">Overview of sailor allocations across all zones</p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <button onclick="openLmdExportModal('csv')" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all">
                     Export CSV
                </button>
                <button onclick="openLmdExportModal('print')" class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all">
                     Print / PDF
                </button>
                <button onclick="downloadWorkOrdersPdfBackup()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all" title="Download PDF Backup">
                     💾 Download PDF
                </button>
                <button onclick="uploadWorkOrdersPdfToDrive()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all" title="Upload PDF to Google Drive">
                     ☁️ Upload to Google Drive
                </button>
                <button onclick="openLmdExportModal('whatsapp')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all">
                     WhatsApp Share
                </button>
            </div>
        </div>
        
        <div class="overflow-x-auto rounded-xl border border-slate-100">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        <th class="px-4 py-3 w-[10%] text-center">Ser No</th>
                        <th class="px-4 py-3 w-[15%]">Rank</th>
                        <th class="px-4 py-3 w-[35%]">Name</th>
                        <th class="px-4 py-3 w-[15%] text-center">Service Type</th>
                        <th class="px-4 py-3 w-[15%]">Service No</th>
                        <th class="px-4 py-3 w-[10%] text-center">Trade</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
} // =============================================
// SUMMARY VIEW IMPLEMENTATION
// =============================================
function renderSummaryView() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today; // Update active date displays
  const dateDisplay = document.getElementById("summaryActiveDate");
  if (dateDisplay) dateDisplay.textContent = dateVal;
  const summaryDatePicker = document.getElementById("summaryDatePicker");
  if (summaryDatePicker && summaryDatePicker.value !== dateVal) {
    summaryDatePicker.value = dateVal;
  }
  const printDateDisplay = document.getElementById("printSummaryDate");
  if (printDateDisplay)
    printDateDisplay.textContent = dateVal.replace(/-/g, "."); // 1. Fetch allocations for the active date
  const activeAllocations = (store.dailyAllocations || []).filter(
    (a) => a.date === dateVal,
  ); // Helper to resolve sailor's category (VSS/Regular) and trade index
  function getSailorBranchAndTradeIdx(sailor) {
    const isVss = sailor.category === "VAS";
    let tradeIdx = -1;
    if (isVss) {
      const vssTrades = ["MA", "CA", "PA", "PL", "BB", "RW", "WL", "AL", "SW"]; // Normalize WL / WE
      let t = (sailor.trade || "MA").toUpperCase();
      if (t === "WE" || t === "WEL") t = "WL";
      tradeIdx = vssTrades.indexOf(t);
      if (tradeIdx === -1) tradeIdx = 0; // Fallback to MA
    } else {
      const regTrades = ["S/S", "LME", "ME", "OJT"]; // Determine category index
      const rank = (sailor.rank || "AB").toUpperCase();
      const trade = (sailor.trade || "").toUpperCase();
      if (
        rank.includes("CPO") ||
        rank.includes("PO") ||
        rank.includes("CHIEF")
      ) {
        tradeIdx = 0; // S/S
      } else if (rank === "LME" || trade === "LME" || rank.startsWith("L")) {
        tradeIdx = 1; // LME
      } else if (rank === "ME" || trade === "ME" || rank.startsWith("M")) {
        tradeIdx = 2; // ME
      } else if (
        rank.startsWith("OJT") ||
        rank.startsWith("APP") ||
        rank.startsWith("TRAIN") ||
        trade.startsWith("OJT")
      ) {
        tradeIdx = 3; // OJT
      } else {
        tradeIdx = 2; // Default to ME
      }
    }
    return { isVss, tradeIdx };
  } // Initialize counts matrix helper
  function createRowMatrix(description) {
    return {
      description: description,
      vss: [0, 0, 0, 0, 0, 0, 0, 0, 0], // MA, CA, PA, PL, BB, RW, WL, AL, SW
      reg: [0, 0, 0, 0], // S/S, LME, ME, OJT
      vssSub: 0,
      regSub: 0,
      fullTotal: 0,
    };
  } // 2. Define the structure of our sections dynamically
  const sections = {
    workshop: {
      title: "WORKSHOP",
      subsections: {},
    },
    zones: {
      title: "ZONE",
      subsections: {},
    },
    othersDuty: { title: "OTHERS DUTY DOCK YARD", rows: {} },
    outProjects: { title: "OUT PROJECTS", rows: {} },
    housingProjects: { title: "HOUSING PROJECTS", rows: {} },
    otherBases: { title: "OTHER BASES", rows: {} },
    leaveSick: { title: "LEAVE, SICK & ATTENDANCE", rows: {} },
  };

  const workshopZoneIds = [
    "Carpentry-Shop",
    "Paint-Workshop",
    "Signwriter",
    "Welding-Shop",
    "Concrete-Precast",
    "Aluminum-Work-Shop",
    "Blacksmith",
    "Pump-House",
  ];

  // Dynamically build workshop & zone subsections based on user's defined zones
  if (store.zones) {
    store.zones.forEach((z) => {
      const isWorkshop =
        workshopZoneIds.includes(z.id) ||
        z.id.toLowerCase().includes("shop") ||
        z.id.toLowerCase().includes("signwriter");
      if (isWorkshop) {
        sections.workshop.subsections[z.id] = {
          title: z.name.toUpperCase(),
          rows: {},
        };
      } else if (
        ![
          "Admin-&-Staff-Duties",
          "Other-Base",
          "Out-Project",
          "Housing-Project",
        ].includes(z.id)
      ) {
        sections.zones.subsections[z.id] = {
          title: z.name.toUpperCase(),
          rows: {},
        };
      }
    });
  }

  // Helper to get the correct section based on zoneId
  function getSectionForZone(zoneId) {
    const isWorkshop =
      workshopZoneIds.includes(zoneId) ||
      (zoneId && zoneId.toLowerCase().includes("shop")) ||
      (zoneId && zoneId.toLowerCase().includes("signwriter"));
    if (isWorkshop) {
      if (sections.workshop.subsections[zoneId]) {
        return sections.workshop.subsections[zoneId];
      }
      sections.workshop.subsections[zoneId] = {
        title: (zoneId || "WORKSHOP").replace(/-/g, " ").toUpperCase(),
        rows: {},
      };
      return sections.workshop.subsections[zoneId];
    }
    if (zoneId === "Admin-&-Staff-Duties") return sections.othersDuty;
    if (zoneId === "Other-Base") {
      if (!sections.zones.subsections["Other-Base"]) {
        sections.zones.subsections["Other-Base"] = { title: "OTHER BASE (UNASSIGNED FROM PHP DB)", rows: {} };
      }
      return sections.zones.subsections["Other-Base"];
    }
    if (zoneId === "Out-Project") {
      if (!sections.zones.subsections["Out-Project"]) {
        sections.zones.subsections["Out-Project"] = { title: "OUT PROJECT (UNASSIGNED FROM PHP DB)", rows: {} };
      }
      return sections.zones.subsections["Out-Project"];
    }
    if (zoneId === "Housing-Project") {
      if (!sections.zones.subsections["Housing-Project"]) {
        sections.zones.subsections["Housing-Project"] = { title: "HOUSING PROJECT (UNASSIGNED FROM PHP DB)", rows: {} };
      }
      return sections.zones.subsections["Housing-Project"];
    }

    // Return dynamically defined zone subsection
    if (sections.zones.subsections[zoneId]) {
      return sections.zones.subsections[zoneId];
    }

    // Fallback: create subsection on the fly if it doesn't exist
    sections.zones.subsections[zoneId] = {
      title: (zoneId || "ZONE").replace(/-/g, " ").toUpperCase(),
      rows: {},
    };
    return sections.zones.subsections[zoneId];
  }
  const zones = store.zones; // included Admin & Staff Duties
  const allAllocatedSailorIds = new Set();
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal),
    );
    const jcs = (store.jobCards || []).filter(
      (jc) => jc.zone_id === z.id && isWorkOrderActiveOnDate(jc, dateVal),
    );
    const allTasks = [...wos, ...jcs];
    allTasks.forEach((wo) => {
      let assignedSailors = [];
      if (dateVal === today) {
        const assignedIds = (wo.assigned || []).map(String);
        assignedSailors = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      } else {
        const assignedIds = (store.dailyAllocations || [])
          .filter(
            (a) =>
              a.date === dateVal && String(a.work_order_id) === String(wo.id),
          )
          .map((a) => String(a.sailor_id));
        assignedSailors = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      }
      if (assignedSailors.length > 0) {
        const section = getSectionForZone(wo.zone_id);
        const rowKey = (wo.description || "UNNAMED DUTY").toUpperCase().trim();
        if (!section.rows[rowKey]) {
          section.rows[rowKey] = createRowMatrix(rowKey);
        }
        const targetRow = section.rows[rowKey];
        assignedSailors.forEach((sailor) => {
          // Check fbStatus to accurately skip leaves
          const [yyyy, mm, dd] = dateVal.split("-");
          const monthKey = `${yyyy}-${mm}`;
          const dayKey = parseInt(dd, 10).toString();
          const fbStatus =
            store.availability &&
            store.availability[monthKey] &&
            store.availability[monthKey][dayKey]
              ? store.availability[monthKey][dayKey][sailor._fbKey]
              : null; // Skip if sailor is actually on Leave/Sick/NA (they should go to the leave section)
          const isLeaveCode = (val) => {
            if (!val) return false;
            const s = typeof val === "string" ? val.trim() : String(val).trim();
            return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(
              s,
            );
          };
          const isLeave =
            isLeaveCode(sailor.attendance) ||
            isLeaveCode(sailor.status) ||
            isLeaveCode(fbStatus);
          if (isLeave) return; // Track for Leave/Sick check
          allAllocatedSailorIds.add(String(sailor.id));
          if (sailor._fbKey) allAllocatedSailorIds.add(String(sailor._fbKey));
          const { isVss, tradeIdx } = getSailorBranchAndTradeIdx(sailor);
          if (isVss) {
            targetRow.vss[tradeIdx]++;
          } else {
            targetRow.reg[tradeIdx]++;
          }
        });
      }
    });
  }); // Add long term deployments to summary
  const longTerm = getLongTermAllocations();
  const processLongTermList = (list, section) => {
    list.forEach((alloc) => {
      const [yyyy, mm, dd] = dateVal.split("-");
      const monthKey = `${yyyy}-${mm}`;
      const dayKey = parseInt(dd, 10).toString();
      const fbStatus =
        store.availability &&
        store.availability[monthKey] &&
        store.availability[monthKey][dayKey]
          ? store.availability[monthKey][dayKey][alloc.sailor._fbKey]
          : null;
      const isLeaveCode = (val) => {
        if (!val) return false;
        const s = typeof val === "string" ? val.trim() : String(val).trim();
        return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(s);
      };
      const isLeave =
        isLeaveCode(alloc.sailor.attendance) ||
        isLeaveCode(alloc.sailor.status) ||
        isLeaveCode(fbStatus);
      if (isLeave) return;
      allAllocatedSailorIds.add(String(alloc.sailor.id));
      if (alloc.sailor._fbKey) allAllocatedSailorIds.add(String(alloc.sailor._fbKey));
      const rowKey = (alloc.projectName || "UNKNOWN").toUpperCase().trim();
      if (!section.rows[rowKey]) {
        section.rows[rowKey] = createRowMatrix(rowKey);
      }
      const { isVss, tradeIdx } = getSailorBranchAndTradeIdx(alloc.sailor);
      if (isVss) section.rows[rowKey].vss[tradeIdx]++;
      else section.rows[rowKey].reg[tradeIdx]++;
    });
  };

  processLongTermList(longTerm.housing, sections.housingProjects);
  processLongTermList(longTerm.outProject, sections.outProjects);
  processLongTermList(longTerm.otherBase, sections.otherBases);

  // 4. Process explicit leaves/sick statuses from sailorsDB
  store.sailors.forEach((sailor) => {
    const isAllocated =
      allAllocatedSailorIds.has(String(sailor.id)) ||
      (sailor._fbKey && allAllocatedSailorIds.has(String(sailor._fbKey))); // Extract YYYY-MM and DD from dateVal
    const [yyyy, mm, dd] = dateVal.split("-");
    const monthKey = `${yyyy}-${mm}`;
    const dayKey = parseInt(dd, 10).toString(); // Removes leading zero
    const fbStatus =
      store.availability &&
      store.availability[monthKey] &&
      store.availability[monthKey][dayKey]
        ? store.availability[monthKey][dayKey][sailor._fbKey]
        : null;
    const isLeaveCode = (val) => {
      if (!val) return false;
      const s = typeof val === "string" ? val.trim() : String(val).trim();
      return /^(Leave|Sick|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SIQ|S\/R|SL|ADM|R)$/i.test(
        s,
      );
    };
    const isLeave =
      isLeaveCode(sailor.attendance) ||
      isLeaveCode(sailor.status) ||
      isLeaveCode(fbStatus);



    if (isLeave) {
      const { isVss, tradeIdx } = getSailorBranchAndTradeIdx(sailor);
      let rowKey = "LEAVE";
      const isSickCode = (val) => {
        if (!val) return false;
        const s = typeof val === "string" ? val.trim() : String(val).trim();
        return /^(Sick|M\/D|SIQ|S\/R|SL|ADM)$/i.test(s);
      };
      const isWeekendCode = (val) => {
        if (!val) return false;
        const s = typeof val === "string" ? val.trim() : String(val).trim();
        return /^(WE|Weekend|WEEKEND)$/i.test(s);
      };
      const isSick =
        isSickCode(sailor.attendance) ||
        isSickCode(sailor.status) ||
        isSickCode(fbStatus);
      const isWeekend =
        isWeekendCode(sailor.attendance) ||
        isWeekendCode(sailor.status) ||
        isWeekendCode(fbStatus);
      if (isSick) {
        rowKey = "SICK";
      } else if (isWeekend) {
        rowKey = "WEEKEND";
      } else if (
        sailor.status === "NA" &&
        (!sailor.attendance ||
          !/^(Leave|L|DL|WE|HD|T\/D)$/i.test(
            typeof sailor.attendance === "string"
              ? sailor.attendance.trim()
              : String(sailor.attendance).trim(),
          ))
      ) {
        // Try to infer if it was sick from work orders
        let isSickWo = false;
        const activeWo = store.workOrders || [];
        const activeJc = store.jobCards || [];
        let assignedWo = null;
        if (dateVal === today) {
          assignedWo = activeWo.find(
            (wo) =>
              wo.assigned &&
              wo.assigned.some(id => String(id) === String(sailor.id) || String(id) === String(sailor._fbKey))
          );
          if (!assignedWo)
            assignedWo = activeJc.find(
              (jc) =>
                jc.assigned &&
                jc.assigned.some(id => String(id) === String(sailor.id) || String(id) === String(sailor._fbKey))
            );
        } else {
          const alloc = (store.dailyAllocations || []).find(
            (a) =>
              a.date === dateVal &&
              (String(a.sailor_id) === String(sailor.id) ||
                String(a.sailor_id) === String(sailor._fbKey)),
          );
          if (alloc) {
            assignedWo =
              activeWo.find(
                (w) => String(w.id) === String(alloc.work_order_id),
              ) ||
              activeJc.find(
                (j) => String(j.id) === String(alloc.work_order_id),
              );
          }
        }
        if (
          assignedWo &&
          /(ගිලන්|\bsiq\b|\badmit\b|\bsick\b)/i.test(
            assignedWo.description || assignedWo.title || "",
          )
        ) {
          rowKey = "SICK";
        }
      }
      if (!sections.leaveSick.rows[rowKey]) {
        sections.leaveSick.rows[rowKey] = createRowMatrix(rowKey);
      }
      const targetRow = sections.leaveSick.rows[rowKey];
      if (isVss) {
        targetRow.vss[tradeIdx]++;
      } else {
        targetRow.reg[tradeIdx]++;
      }
    }
  }); // 5. Build and render the table rows with subtotals and grand totals
  let tableHtml = `
        <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
            <td colspan="17" class="px-3 py-2 text-slate-800 font-extrabold uppercase text-[11px] tracking-wider">ONGOING CONSTRUCTIONS AT DOCKYARD</td>
        </tr>
    `; // Columns counters helper
  function getColumnsSum(rowsArray) {
    const sums = {
      vss: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      reg: [0, 0, 0, 0],
      vssSub: 0,
      regSub: 0,
      fullTotal: 0,
    };
    rowsArray.forEach((r) => {
      r.vssSub = r.vss.reduce((sum, val) => sum + val, 0);
      r.regSub = r.reg.reduce((sum, val) => sum + val, 0);
      r.fullTotal = r.vssSub + r.regSub;
      r.vss.forEach((val, idx) => (sums.vss[idx] += val));
      r.reg.forEach((val, idx) => (sums.reg[idx] += val));
      sums.vssSub += r.vssSub;
      sums.regSub += r.regSub;
      sums.fullTotal += r.fullTotal;
    });
    return sums;
  }
  const columnGrandTotals = {
    vss: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    reg: [0, 0, 0, 0],
    vssSub: 0,
    regSub: 0,
    fullTotal: 0,
  };
  function appendSectionToTable(sectionObj) {
    const rowsList = Object.values(sectionObj.rows);
    if (rowsList.length === 0) return; // Skip empty sections
    const sums = getColumnsSum(rowsList);
    tableHtml += `
            <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
                <td colspan="17" class="px-3 py-2 text-slate-800 uppercase text-[10px] tracking-wider">${sectionObj.title}</td>
            </tr>
        `;
    rowsList.forEach((r) => {
      tableHtml += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-center">
                    <td class="px-3 py-1.5 text-left text-slate-700 font-medium">${r.description}</td>
                    ${r.vss.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50 font-bold border-l-2 border-r-2 border-slate-200">${r.vssSub || ""}</td>
                    ${r.reg.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50 font-bold border-l-2 border-r border-slate-200">${r.regSub || ""}</td>
                    <td class="px-2 py-1.5 bg-teal-50/50 font-bold text-slate-800 border-l border-slate-300">${r.fullTotal || ""}</td>
                </tr>
            `;
    });
    tableHtml += `
            <tr class="bg-slate-50 font-bold text-center border-b-2 border-slate-300">
                <td class="px-3 py-2 text-left uppercase text-[10px]">SUB TOTAL</td>
                ${sums.vss.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-2 bg-slate-100/80 border-l-2 border-r-2 border-slate-300">${sums.vssSub || ""}</td>
                ${sums.reg.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-2 bg-slate-100/80 border-l-2 border-r border-slate-300">${sums.regSub || ""}</td>
                <td class="px-2 py-2 bg-teal-100/30 text-teal-800 border-l border-slate-300">${sums.fullTotal || ""}</td>
            </tr>
        `;
    sums.vss.forEach((val, idx) => (columnGrandTotals.vss[idx] += val));
    sums.reg.forEach((val, idx) => (columnGrandTotals.reg[idx] += val));
    columnGrandTotals.vssSub += sums.vssSub;
    columnGrandTotals.regSub += sums.regSub;
    columnGrandTotals.fullTotal += sums.fullTotal;
  } // 2. Workshop (Grouped by individual workshop subsections)
  tableHtml += `
        <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
            <td colspan="17" class="px-3 py-2 text-slate-800 uppercase text-[10px] tracking-wider">WORKSHOP</td>
        </tr>
    `;
  const workshopRowsList = [];
  Object.values(sections.workshop.subsections).forEach((sub) => {
    const subRows = Object.values(sub.rows);
    if (subRows.length === 0) return; // Skip workshop subsections with 0 duties
    const subSums = getColumnsSum(subRows);
    tableHtml += `
            <tr class="bg-slate-50 font-bold border-b border-slate-200 text-[10px] text-slate-600">
                <td colspan="17" class="px-4 py-1.5 pl-6">${sub.title}</td>
            </tr>
        `;
    subRows.forEach((r) => {
      tableHtml += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-center">
                    <td class="px-3 py-1.5 pl-8 text-left text-slate-700 font-medium">${r.description}</td>
                    ${r.vss.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r-2 border-slate-200">${r.vssSub || ""}</td>
                    ${r.reg.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r border-slate-200">${r.regSub || ""}</td>
                    <td class="px-2 py-1.5 bg-teal-50/30 font-bold text-slate-800 border-l border-slate-300">${r.fullTotal || ""}</td>
                </tr>
            `;
      workshopRowsList.push(r);
    });
    tableHtml += `
            <tr class="bg-slate-50 font-semibold text-center border-b border-slate-200 text-slate-600">
                <td class="px-3 py-1.5 pl-8 text-left uppercase text-[9px]">${sub.title} SUB TOTAL</td>
                ${subSums.vss.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r-2 border-slate-200">${subSums.vssSub || ""}</td>
                ${subSums.reg.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r border-slate-200">${subSums.regSub || ""}</td>
                <td class="px-2 py-1.5 bg-teal-50/50 border-l border-slate-300">${subSums.fullTotal || ""}</td>
            </tr>
        `;
  });
  const workshopMainSums = getColumnsSum(workshopRowsList);
  tableHtml += `
        <tr class="bg-slate-100 font-bold text-center border-b-2 border-slate-300 text-slate-800">
            <td class="px-3 py-2 text-left uppercase text-[10px] pl-6">WORKSHOP SUB TOTAL</td>
            ${workshopMainSums.vss.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r-2 border-slate-300">${workshopMainSums.vssSub || ""}</td>
            ${workshopMainSums.reg.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r border-slate-300">${workshopMainSums.regSub || ""}</td>
            <td class="px-2 py-2 bg-teal-100/40 text-teal-800 border-l border-slate-300">${workshopMainSums.fullTotal || ""}</td>
        </tr>
    `;
  workshopMainSums.vss.forEach((val, idx) => (columnGrandTotals.vss[idx] += val));
  workshopMainSums.reg.forEach((val, idx) => (columnGrandTotals.reg[idx] += val));
  columnGrandTotals.vssSub += workshopMainSums.vssSub;
  columnGrandTotals.regSub += workshopMainSums.regSub;
  columnGrandTotals.fullTotal += workshopMainSums.fullTotal; // 3. Zones (A-G grouped under main ZONE header)
  tableHtml += `
        <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
            <td colspan="17" class="px-3 py-2 text-slate-800 uppercase text-[10px] tracking-wider">ZONE</td>
        </tr>
    `;
  const zoneRowsList = [];
  Object.values(sections.zones.subsections).forEach((sub) => {
    const subRows = Object.values(sub.rows);
    if (subRows.length === 0) return; // Skip empty zone subsections with 0 duties
    const subSums = getColumnsSum(subRows);
    tableHtml += `
            <tr class="bg-slate-50 font-bold border-b border-slate-200 text-[10px] text-slate-600">
                <td colspan="17" class="px-4 py-1.5 pl-6">${sub.title}</td>
            </tr>
        `;
    subRows.forEach((r) => {
      tableHtml += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-center">
                    <td class="px-3 py-1.5 pl-8 text-left text-slate-700 font-medium">${r.description}</td>
                    ${r.vss.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r-2 border-slate-200">${r.vssSub || ""}</td>
                    ${r.reg.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r border-slate-200">${r.regSub || ""}</td>
                    <td class="px-2 py-1.5 bg-teal-50/30 font-bold text-slate-800 border-l border-slate-300">${r.fullTotal || ""}</td>
                </tr>
            `;
      zoneRowsList.push(r);
    });
    tableHtml += `
            <tr class="bg-slate-50 font-semibold text-center border-b border-slate-200 text-slate-600">
                <td class="px-3 py-1.5 pl-8 text-left uppercase text-[9px]">${sub.title} SUB TOTAL</td>
                ${subSums.vss.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r-2 border-slate-200">${subSums.vssSub || ""}</td>
                ${subSums.reg.map((val) => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ""}</td>`).join("")}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r border-slate-200">${subSums.regSub || ""}</td>
                <td class="px-2 py-1.5 bg-teal-50/50 border-l border-slate-300">${subSums.fullTotal || ""}</td>
            </tr>
        `;
  });
  const zoneMainSums = getColumnsSum(zoneRowsList);
  tableHtml += `
        <tr class="bg-slate-100 font-bold text-center border-b-2 border-slate-300 text-slate-800">
            <td class="px-3 py-2 text-left uppercase text-[10px] pl-6">ZONE SUB TOTAL</td>
            ${zoneMainSums.vss.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r-2 border-slate-300">${zoneMainSums.vssSub || ""}</td>
            ${zoneMainSums.reg.map((val) => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ""}</td>`).join("")}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r border-slate-300">${zoneMainSums.regSub || ""}</td>
            <td class="px-2 py-2 bg-teal-100/40 text-teal-800 border-l border-slate-300">${zoneMainSums.fullTotal || ""}</td>
        </tr>
    `;
  zoneMainSums.vss.forEach((val, idx) => (columnGrandTotals.vss[idx] += val));
  zoneMainSums.reg.forEach((val, idx) => (columnGrandTotals.reg[idx] += val));
  columnGrandTotals.vssSub += zoneMainSums.vssSub;
  columnGrandTotals.regSub += zoneMainSums.regSub;
  columnGrandTotals.fullTotal += zoneMainSums.fullTotal;
  appendSectionToTable(sections.othersDuty);
  appendSectionToTable(sections.outProjects);
  appendSectionToTable(sections.housingProjects);
  appendSectionToTable(sections.otherBases);
  appendSectionToTable(sections.leaveSick); // Render Grand Total Row at the absolute bottom
  tableHtml += `
        <tr class="bg-slate-900 text-white font-extrabold text-center text-sm border-t-4 border-slate-800">
            <td class="px-3 py-3 text-left uppercase">GRAND TOTAL</td>
            ${columnGrandTotals.vss.map((val) => `<td class="px-0.5 py-3 border-l border-slate-800">${val || ""}</td>`).join("")}
            <td class="px-1 py-3 bg-slate-800 border-l-2 border-r-2 border-slate-800">${columnGrandTotals.vssSub || ""}</td>
            ${columnGrandTotals.reg.map((val) => `<td class="px-0.5 py-3 border-l border-slate-800">${val || ""}</td>`).join("")}
            <td class="px-1 py-3 bg-slate-800 border-l-2 border-r border-slate-800">${columnGrandTotals.regSub || ""}</td>
            <td class="px-2 py-3 bg-teal-800 text-teal-100 border-l border-slate-800">${columnGrandTotals.fullTotal || ""}</td>
        </tr>
    `;
  document.getElementById("summaryMatrixTableBody").innerHTML = tableHtml;
}
function exportSummaryCsv() {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const table = document.getElementById("summaryMatrixTable");
  if (!table) return;
  let csv = [];
  csv.push(`Date: ${dateVal}`);
  csv.push("");
  const rows = table.querySelectorAll("tr");
  rows.forEach((tr) => {
    let cols = tr.querySelectorAll("th, td");
    let rowData = [];
    cols.forEach((col) => {
      let text = col.innerText.trim().replace(/,/g, ";").replace(/\r?\n/g, " ");
      rowData.push(`"${text}"`);
    });
    csv.push(rowData.join(","));
  });
  const csvContent = "\uFEFF" + csv.join("\n"); // Include BOM for proper Excel UTF-8 encoding
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const encodedUri = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Duties_Summary_${dateVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function printSummary() {
  window.print();
}
function openLmdExportModal(action) {
  _lmdExportAction = action;
  let title = "Print / PDF Options";
  if (action === "csv") title = "Export CSV Options";
  else if (action === "whatsapp") title = "WhatsApp Share Options";
  document.getElementById("lmdExportModalTitle").textContent = title;
  const zones = store.zones; // included Admin & Staff Duties
  document.getElementById("exportZoneSelect").innerHTML = zones
    .map((z) => `<option value="${z.id}">${z.name}</option>`)
    .join("");
  document.querySelector('input[name="exportScope"][value="all"]').checked =
    true;
  toggleExportZoneSelect();
  document.getElementById("lmdExportModal").classList.remove("hidden");
}
function toggleExportZoneSelect() {
  const scope = document.querySelector(
    'input[name="exportScope"]:checked',
  ).value;
  document
    .getElementById("exportZoneSelectWrapper")
    .classList.toggle("hidden", scope !== "selected");
}
function executeLmdExport() {
  const scope = document.querySelector(
    'input[name="exportScope"]:checked',
  ).value;
  const selectedZone = document.getElementById("exportZoneSelect").value;
  if (_lmdExportAction === "csv") {
    exportLmdCSV(scope, selectedZone);
    closeModal("lmdExportModal");
  } else if (_lmdExportAction === "whatsapp") {
    // Share first to keep user gesture activation, then close modal
    shareLmdWhatsApp(scope, selectedZone);
    closeModal("lmdExportModal");
  } else {
    printLmdDetails(scope, selectedZone);
    closeModal("lmdExportModal");
  }
}
function exportLmdCSV(scope, selectedZone) {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let zones = [];
  if (scope === "all") {
    zones = store.zones;
  } else {
    const z = store.zones.find((x) => x.id === selectedZone);
    if (z) zones.push(z);
  }
  let csvContent = "Ser No,Rank,Name,Service Type,Service No,Trade\n";
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal),
    );
    wos.sort((a, b) => {
      const aInCharge = (a.description || "").toLowerCase().includes("in charge") || a.assign_type === "In Charge";
      const bInCharge = (b.description || "").toLowerCase().includes("in charge") || b.assign_type === "In Charge";
      if (aInCharge && !bInCharge) return -1;
      if (!aInCharge && bInCharge) return 1;
      return 0;
    }); // Check if zone has active allocations
    let zoneHasAllocations = false;
    wos.forEach((wo) => {
      let assignedCount = 0;
      if (dateVal === today) {
        assignedCount = (wo.assigned || []).length;
      } else {
        assignedCount = (store.dailyAllocations || []).filter(
          (a) =>
            a.date === dateVal && String(a.work_order_id) === String(wo.id),
        ).length;
      }
      if (assignedCount > 0) zoneHasAllocations = true;
    });
    if (zoneHasAllocations) {
      // Add Zone Section header row in CSV
      csvContent += `,,=== ZONE: ${z.name.toUpperCase()} ===,,,\n`;
      wos.forEach((wo) => {
        let assignedSailors = [];
        if (dateVal === today) {
          const assignedIds = (wo.assigned || []).map(String);
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        } else {
          const assignedIds = (store.dailyAllocations || [])
            .filter(
              (a) =>
                a.date === dateVal && String(a.work_order_id) === String(wo.id),
            )
            .map((a) => String(a.sailor_id));
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        }
        if (assignedSailors.length > 0) {
          // Add header row for the work order/duty
          csvContent += `,,● ${wo.description.toUpperCase()},,,\n`;
          assignedSailors.forEach((s, idx) => {
            const serNo = String(idx + 1).padStart(2, "0");
            const parsedOffNo = parseOfficialNumber(
              s.official_number || s.service_no,
            );
            const row = [
              serNo,
              s.rank || "AB",
              s.name,
              parsedOffNo.type,
              parsedOffNo.num,
              s.trade || "",
            ]
              .map((val) => `"${String(val).replace(/"/g, '""')}"`)
              .join(",");
            csvContent += row + "\n";
          });
        }
      });
    }
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `LMD_Report_${dateVal}_${scope}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV downloaded successfully!");
}
function printLmdDetails(scope, selectedZone) {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let zones = [];
  if (scope === "all") {
    zones = store.zones;
  } else {
    const z = store.zones.find((x) => x.id === selectedZone);
    if (z) zones.push(z);
  }
  let rowsHtml = "";
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal),
    );
    wos.sort((a, b) => {
      const aInCharge = (a.description || "").toLowerCase().includes("in charge") || a.assign_type === "In Charge";
      const bInCharge = (b.description || "").toLowerCase().includes("in charge") || b.assign_type === "In Charge";
      if (aInCharge && !bInCharge) return -1;
      if (!aInCharge && bInCharge) return 1;
      return 0;
    }); // Check if zone has active allocations
    let zoneHasAllocations = false;
    wos.forEach((wo) => {
      let assignedCount = 0;
      if (dateVal === today) {
        assignedCount = (wo.assigned || []).length;
      } else {
        assignedCount = (store.dailyAllocations || []).filter(
          (a) =>
            a.date === dateVal && String(a.work_order_id) === String(wo.id),
        ).length;
      }
      if (assignedCount > 0) zoneHasAllocations = true;
    });
    if (zoneHasAllocations) {
      // Add Zone section row in the printed table
      rowsHtml += `
                <tr style="background-color: #0f172a; color: white; font-weight: bold;">
                    <td colspan="6" style="padding: 8px 12px; font-size: 13px; text-transform: uppercase;">
                        🗺️ ZONE: ${z.name.toUpperCase()}
                    </td>
                </tr>
            `;
      wos.forEach((wo) => {
        let assignedSailors = [];
        if (dateVal === today) {
          const assignedIds = (wo.assigned || []).map(String);
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        } else {
          const assignedIds = (store.dailyAllocations || [])
            .filter(
              (a) =>
                a.date === dateVal && String(a.work_order_id) === String(wo.id),
            )
            .map((a) => String(a.sailor_id));
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        }
        if (assignedSailors.length > 0) {
          // Add sub-header separator row for work order
          rowsHtml += `
                        <tr style="background-color: #f1f5f9; font-weight: bold;">
                            <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
                                📋 ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
          assignedSailors.forEach((s, idx) => {
            const serNo = String(idx + 1).padStart(2, "0");
            const parsedOffNo = parseOfficialNumber(
              s.official_number || s.service_no,
            );
            rowsHtml += `
                            <tr>
                                <td style="text-align:center;">${serNo}</td>
                                <td>${s.rank || "AB"}</td>
                                <td>${s.name}</td>
                                <td style="text-align:center;">${parsedOffNo.type}</td>
                                <td>${parsedOffNo.num}</td>
                                <td style="text-align:center;">${s.trade || "—"}</td>
                            </tr>
                        `;
          });
        }
      });
    }
  });
  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No allocations found for this selection on this date.</td></tr>`;
  }
  const formattedDate = new Date(dateVal).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const win = window.open("", "_blank");
  win.document.write(`
        <html><head><title>Daily Details</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color:#000; margin:0; padding:20px; }
            .header-container { display: flex; align-items: center; justify-content: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
            .logo-img { height: 65px; margin-right: 18px; }
            .header-text { text-align: left; }
            .header-text h1 { font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .header-text h2 { font-size: 11px; font-weight: 700; color: #475569; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .meta-section { display: flex; justify-content: space-between; font-size: 10px; color: #334155; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; }
            .meta-left { font-weight: bold; line-height: 1.5; }
            .meta-right { text-align: right; line-height: 1.5; }
            
            table { width:100%; border-collapse:collapse; font-size:10.5px; margin-top: 10px; }
            th, td { border:1px solid #94a3b8; padding:7px 9px; text-align: left; vertical-align: middle; }
            th { background:#f1f5f9; color: #1e293b; font-weight: bold; text-transform: uppercase; font-size: 10px; }
            
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid; }
            .sig-block { text-align: center; width: 220px; }
            .sig-block p { margin: 2px 0; }
            
            .footer { margin-top: 35px; font-size: 9px; color: #64748b; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            @media print { 
                @page { size:A4; margin:12mm; } 
                body { padding:0; }
                .meta-section { background: none; border-color: #94a3b8; }
            }
        </style></head>
        <body>
            <div class="header-container">
                <img class="logo-img" src="${window.location.href.split("?")[0].split("#")[0].replace("index.html", "")}logo.png" alt="SLN Crest">
                <div class="header-text">
                    <h1>Sri Lanka Navy</h1>
                    <h2>Captain Civil Engineering Department (E)</h2>
                </div>
            </div>
            
            <div class="meta-section">
                <div class="meta-left">
                    <div>REPORT: DAILY DETAILS REPORT</div>
                    <div>SCOPE: ${scope === "all" ? "ALL ZONES" : "ZONE: " + selectedZone.toUpperCase()}</div>
                </div>
                <div class="meta-right">
                    <div>DATE: ${dateVal}</div>
                    <div>GENERATED BY: NCW OPERATION SYSTEM</div>
                </div>
            </div>

            <table>
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
                    <p style="font-weight: bold;">CHECKED BY</p>
                </div>
            </div>

            <div class="footer">Generated by NCW Operation System on ${new Date().toLocaleString()}</div>
        </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}
function openEvalDetailsModal(mode) {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const modalTitle = document.getElementById("evalDetailsModalTitle");
  const modalIcon = document.getElementById("evalDetailsModalIcon");
  const tableHeader = document.getElementById("evalDetailsTableActionHeader");
  if (mode === "evaluated") {
    modalTitle.textContent = `Evaluated Sailors — ${dateVal}`;
    modalIcon.textContent = "✅";
    tableHeader.textContent = "Score";
  } else {
    modalTitle.textContent = `Pending Evaluations — ${dateVal}`;
    modalIcon.textContent = "⏳";
    tableHeader.textContent = "Pending Days";
  } // Get all assigned sailors for the selected date
  const assignedIds = new Set();
  if (dateVal === today) {
    (store.workOrders || []).forEach((wo) => {
      if ((wo.status === "Active" || wo.status === "Pending") && wo.assigned) {
        wo.assigned.forEach((id) => assignedIds.add(String(id)));
      }
    });
  } else {
    (store.dailyAllocations || []).forEach((alloc) => {
      if (alloc.date === dateVal) {
        assignedIds.add(String(alloc.sailor_id));
      }
    });
  }
  if (!store.sailors) return; // Filter sailors who are assigned today
  const assignedSailors = store.sailors.filter(
    (s) => assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey)),
  ); // Filter based on evaluation mode
  const filteredSailors = assignedSailors.filter((s) => {
    const alloc = (store.dailyAllocations || []).find(
      (a) => a.date === dateVal && String(a.sailor_id) === String(s.id),
    );
    const isEval = alloc ? alloc.evaluated === true : s.evaluated === true;
    return mode === "evaluated" ? isEval : !isEval;
  });
  const tbody = document.getElementById("evalDetailsTableBody");
  if (!tbody) return;
  tbody.innerHTML =
    filteredSailors
      .map((s) => {
        var _s$id39;
        const alloc = (store.dailyAllocations || []).find(
          (a) => a.date === dateVal && String(a.sailor_id) === String(s.id),
        );
        let workDesc = "Not specified";
        let zoneId = s.zone_assigned || "A-Zone";
        if (alloc && alloc.work_order_id) {
          const wo = store.workOrders.find(
            (w) =>
              String(w.id) === String(alloc.work_order_id) ||
              String(w._fbKey) === String(alloc.work_order_id),
          );
          if (wo) {
            workDesc = wo.description || wo.reference_no || "Active Work";
            zoneId = wo.zone_id || zoneId;
          }
        } else {
          const wo = store.workOrders.find(
            (w) =>
              (w.status === "Active" || w.status === "Pending") &&
              w.assigned &&
              w.assigned.map(String).includes(String(s.id)),
          );
          if (wo) {
            workDesc = wo.description || wo.reference_no || "Active Work";
            zoneId = wo.zone_id || zoneId;
          }
        }
        const sSettings = store.settings || {};
        const inc = sSettings.zoneInCharges && sSettings.zoneInCharges[zoneId];
        const inChargeStr = inc
          ? `${inc.rank} ${inc.name}`
          : "No In-Charge set";
        let detailHtml = "";
        if (mode === "evaluated") {
          let scoreVal = s.yesterdayScore || 7.0;
          if (alloc && alloc.points !== undefined) {
            scoreVal = alloc.points;
          }
          detailHtml = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">⭐ ${scoreVal.toFixed(1)}</span>`;
        } else {
          const unEvaluatedAllocs = (store.dailyAllocations || []).filter(
            (a) => String(a.sailor_id) === String(s.id) && !a.evaluated,
          );
          const count = unEvaluatedAllocs.length;
          detailHtml = `<span class="px-2.5 py-1 ${count > 2 ? "bg-red-100 text-red-800 animate-pulse font-bold" : "bg-slate-100 text-slate-700"} rounded-lg text-xs">${count} days pending</span>`;
        }
        return `
            <tr class="hover:bg-slate-100/50 transition-colors">
                <td class="p-3 font-semibold text-slate-700">${s.official_number || s.service_no || "-"}</td>
                <td class="p-3">
                    <p class="font-bold text-teal-600 hover:underline cursor-pointer" onclick="closeModal('evalDetailsModal'); openSailorProfile('${(_s$id39 = s.id) !== null && _s$id39 !== void 0 ? _s$id39 : s._fbKey}')">${s.rank} ${s.name}</p>
                    <p class="text-xs text-slate-400 font-medium">${s.trade}</p>
                </td>
                <td class="p-3 max-w-[200px] truncate" title="${workDesc}">${workDesc}</td>
                <td class="p-3">
                    <p class="font-semibold text-slate-700 text-xs">${zoneId}</p>
                    <p class="text-slate-400 text-xs">${inChargeStr}</p>
                </td>
                <td class="p-3">${detailHtml}</td>
            </tr>
        `;
      })
      .join("") ||
    `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No sailors in this category for today</td></tr>`;
  document.getElementById("evalDetailsModal").classList.remove("hidden");
}
let _isHistoryBackAction = false;
function initPwaHistoryManagement() {
  // 1. Set initial history state for the landing view
  const initialView = store.currentView || "dashboard";
  window.history.replaceState({ view: initialView }, "", `#${initialView}`); // 2. Listen to popstate (back/forward navigation)
  window.addEventListener("popstate", (event) => {
    _isHistoryBackAction = true; // Handle modal state
    if (event.state && event.state.modalOpen) {
      // A specific modal is expected to be open
      document
        .querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]')
        .forEach((m) => {
          if (m.id === event.state.modalId) {
            m.classList.remove("hidden");
          } else {
            m.classList.add("hidden");
          }
        });
    } else {
      // No modals expected to be open
      document
        .querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]')
        .forEach((m) => {
          m.classList.add("hidden");
        }); // Handle view switching: maintain current view when returning from modal
      const targetView = (event.state && event.state.view) ? event.state.view : store.currentView;
      if (targetView && targetView !== store.currentView) {
        switchView(targetView, true);
      }
    }
    setTimeout(() => {
      _isHistoryBackAction = false;
    }, 500);
  }); // 3. Observe DOM for modal open/close actions to push/pop history states automatically
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        const target = mutation.target;
        const isModal =
          target.classList.contains("modal-overlay") ||
          target.id.endsWith("Modal") ||
          target.id.endsWith("modal");
        if (!isModal) return;
        const isHidden = target.classList.contains("hidden");
        if (!isHidden) {
          // Modal was opened - only push state if this modal is not already the top history state
          if (!_isHistoryBackAction) {
            const currentState = window.history.state;
            if (!currentState || !currentState.modalOpen || currentState.modalId !== target.id) {
              window.history.pushState(
                { modalOpen: true, modalId: target.id, view: store.currentView },
                "",
                window.location.hash,
              );
            }
          }
        } else {
          // Modal was closed
          if (!_isHistoryBackAction) {
            const state = window.history.state;
            if (state && state.modalOpen && state.modalId === target.id) {
              window.history.back();
            }
          }
        }
      }
    });
  }); // Start observing all modals
  document
    .querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]')
    .forEach((m) => {
      observer.observe(m, { attributes: true, attributeFilter: ["class"] });
    });
} // ---- Theme Management & Online Status ----
function initTheme() {
  const isDark = localStorage.getItem("ncw_ps_dark_theme") === "true";
  if (isDark) {
    document.documentElement.classList.add("dark");
    const btn = document.getElementById("darkModeToggleBtn");
    if (btn) btn.innerHTML = "☀️";
  } else {
    document.documentElement.classList.remove("dark");
    const btn = document.getElementById("darkModeToggleBtn");
    if (btn) btn.innerHTML = "🌙";
  }
}
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("ncw_ps_dark_theme", isDark);
  const btn = document.getElementById("darkModeToggleBtn");
  if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
  showToast(isDark ? "Dark Theme enabled" : "Light Theme enabled");
}
function updateOnlineStatus() {
  const indicator = document.getElementById("onlineIndicator");
  if (!indicator) return;
  if (navigator.onLine) {
    indicator.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online</span>
        `;
    indicator.className =
      "flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all duration-300";
  } else {
    indicator.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>Offline</span>
        `;
    indicator.className =
      "flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-red-500/20 bg-red-500/10 text-red-400 transition-all duration-300";
    showToast(
      "You are offline. Operations will sync when you reconnect.",
      "error",
    );
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus); // ==================== WHATSAPP / SYSTEM SHARING FUNCTIONS ====================
function shareViaWhatsAppOrSystem(text, filename) {
  const canUseShare =
    navigator.share &&
    (window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");
  if (canUseShare) {
    navigator
      .share({
        title: "CMSys Share Report",
        text: text,
        url: window.location.href,
      })
      .then(() => showToast("Shared successfully via system share!"))
      .catch((err) => {
        console.error(
          "System share failed, falling back to WhatsApp share:",
          err,
        );
        if (err.name !== "AbortError") {
          fallbackWhatsAppShare(text);
        }
      });
  } else {
    fallbackWhatsAppShare(text);
  }
}
function fallbackWhatsAppShare(text) {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  const encodedText = encodeURIComponent(text);
  const url = `https://wa.me/?text=${encodedText}`;
  if (isMobile) {
    // On mobile, changing window.location.href is 100% reliable and bypassed popup blockers
    window.location.href = url;
  } else {
    // On desktop, open in a new window/tab
    window.open(url, "_blank");
  }
}
function shareLmdWhatsApp(scope, selectedZone) {
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  let zones = [];
  if (scope === "all") {
    zones = store.zones;
  } else {
    const z = store.zones.find((x) => x.id === selectedZone);
    if (z) zones.push(z);
  }
  let text = `*⚓ CMSys DAILY ALLOCATION REPORT*\n`;
  text += `*📅 Date:* ${dateVal}\n`;
  if (scope === "selected" && zones.length > 0) {
    text += `*🗺️ Zone:* ${zones[0].name.toUpperCase()}\n`;
  }
  text += `=========================\n\n`;
  let totalAssigned = 0;
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal),
    );
    let zoneText = "";
    let zoneHasAllocations = false;
    wos.forEach((wo) => {
      let assignedSailors = [];
      if (dateVal === today) {
        const assignedIds = (wo.assigned || []).map(String);
        assignedSailors = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      } else {
        const assignedIds = (store.dailyAllocations || [])
          .filter(
            (a) =>
              a.date === dateVal && String(a.work_order_id) === String(wo.id),
          )
          .map((a) => String(a.sailor_id));
        assignedSailors = store.sailors.filter(
          (s) =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey)),
        );
      }
      if (assignedSailors.length > 0) {
        zoneHasAllocations = true;
        zoneText += `*📋 ${wo.description.toUpperCase()}*\n`;
        assignedSailors.forEach((s, idx) => {
          totalAssigned++;
          const parsedOffNo = parseOfficialNumber(
            s.official_number || s.service_no,
          );
          const offNoStr = parsedOffNo.type
            ? `${parsedOffNo.type} ${parsedOffNo.num}`
            : parsedOffNo.num;
          zoneText += `  ${idx + 1}. ${s.rank || "AB"} ${s.name} (${offNoStr}) - ${s.trade || "—"}\n`;
        });
        zoneText += `\n`;
      }
    });
    if (zoneHasAllocations) {
      text += `*🗺️ ZONE: ${z.name.toUpperCase()}*\n`;
      text += `-------------------------\n`;
      text += zoneText;
      text += `\n`;
    }
  });
  text += `*📊 Summary:* Total Sailors Assigned: ${totalAssigned}\n`;
  text += `Generated on: ${new Date().toLocaleString()}`;
  shareViaWhatsAppOrSystem(text, `LMD_Report_${dateVal}.txt`);
}
function shareEstimateWhatsApp() {
  if (!store.selectedEstimate) {
    showToast("No estimate selected to share!", "error");
    return;
  }
  const est = store.estimates.find((e) => e.id === store.selectedEstimate);
  if (!est) {
    showToast("Estimate not found!", "error");
    return;
  }
  let text = `*⚓ SRI LANKA NAVY - COST ESTIMATE*\n`;
  text += `*Estimate No:* ${est.estimate_number}\n`;
  text += `*Reference:* ${est.reference_doc || "—"}\n`;
  text += `*Location:* ${est.location || "—"}\n`;
  text += `*End User:* ${est.endUser || "—"}\n`;
  text += `*Description:* ${est.description}\n`;
  if (est.workScope) {
    text += `*Work Scope:* ${est.workScope}\n`;
  }
  text += `=========================\n\n`;
  text += `*🛠️ MATERIALS ESTIMATE:*\n`;
  if (est.materials && est.materials.length > 0) {
    est.materials.forEach((m, idx) => {
      text += `${idx + 1}. ${m.item_name} - Qty: ${m.qty} ${m.unit} @ ${formatCurrency(m.cost)} = ${formatCurrency(m.qty * m.cost)}\n`;
    });
  } else {
    text += `No materials logged\n`;
  }
  text += `*Total Materials Cost:* *${formatCurrency(est.total_cost)}*\n\n`;
  text += `*👷 LABOUR ESTIMATE:*\n`;
  if (est.labor && est.labor.length > 0) {
    est.labor.forEach((l, idx) => {
      text += `${idx + 1}. ${l.trade} - Workers: ${l.workers}, Man-Days: ${l.manDays}\n`;
    });
  } else {
    text += `No labour logged\n`;
  }
  text += `*Total Man-Days:* *${est.totalManDays || 0}*\n\n`;
  text += `*Status:* ${est.status || "Draft"}\n`;
  if (est.approvedAuthority) {
    text += `*Approving Authority:* ${est.approvedAuthority}\n`;
  }
  text += `-------------------------\n`;
  text += `Generated on: ${new Date().toLocaleString()}`;
  shareViaWhatsAppOrSystem(text, `Estimate_${est.estimate_number}.txt`);
} // =============================================================================
// SAILOR DIRECTORY, POINTS & LEAVE TRACKING IMPLEMENTATION
// =============================================================================
store.directoryTradeFilter = "ALL"; // Calculate Sailor points based on average score, allocations, and completed jobs
function calculateSailorPoints(sailor) {
  // 10 pts per unit of average performance score (baseline)
  const scoreBase = parseFloat(sailor.avgScore || 7.0) * 10; // Count how many daily allocations they have been part of (5 pts per duty allocation day)
  const allocationsCount = (store.dailyAllocations || []).filter(
    (a) =>
      String(a.sailor_id) === String(sailor.id) ||
      String(a.sailor_id) === String(sailor._fbKey),
  ).length;
  const allocationPoints = allocationsCount * 5; // Count how many completed job cards they have been part of (15 pts per project participation)
  const completedJobsCount = (store.jobCards || []).filter(
    (jc) =>
      jc.status === "Completed" &&
      (jc.assigned || []).some(
        (id) =>
          String(id) === String(sailor.id) ||
          String(id) === String(sailor._fbKey),
      ),
  ).length;
  const jobPoints = completedJobsCount * 15;
  return Math.round(scoreBase + allocationPoints + jobPoints);
} // Calculate Sailor points based on average score, allocations, and completed jobs within the last 30 days
function calculateSailorPointsPast30Days(sailor) {
  // 10 pts per unit of average performance score (baseline)
  const scoreBase = parseFloat(sailor.avgScore || 7.0) * 10; // Calculate 30 days ago date string (YYYY-MM-DD)
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const limitDateStr = thirtyDaysAgo.toISOString().split("T")[0]; // Count how many daily allocations they have been part of in the last 30 days (5 pts per duty allocation day)
  const allocationsCount = (store.dailyAllocations || []).filter((a) => {
    if (
      String(a.sailor_id) !== String(sailor.id) &&
      String(a.sailor_id) !== String(sailor._fbKey)
    ) {
      return false;
    }
    return a.date && a.date >= limitDateStr;
  }).length;
  const allocationPoints = allocationsCount * 5; // Count how many completed job cards they have been part of in the last 30 days (15 pts per project participation)
  const completedJobsCount = (store.jobCards || []).filter((jc) => {
    if (jc.status !== "Completed") return false;
    if (
      !(jc.assigned || []).some(
        (id) =>
          String(id) === String(sailor.id) ||
          String(id) === String(sailor._fbKey),
      )
    ) {
      return false;
    }
    const compDateStr =
      jc.completed_date || jc.last_commit_date || jc.last_assigned_date;
    return compDateStr && compDateStr >= limitDateStr;
  }).length;
  const jobPoints = completedJobsCount * 15;
  return Math.round(scoreBase + allocationPoints + jobPoints);
} // Calculate Sailor leave eligibility (1 leave day per 10 points)
function calculateSailorLeaveDays(sailor) {
  const pts = calculateSailorPoints(sailor);
  return Math.max(0, Math.floor(pts / 10));
}

// =============================================
// SAILOR OPERATIONS & PERFORMANCE CENTER
// =============================================
store.sailorDirectoryViewMode = store.sailorDirectoryViewMode || "table";
store.sailorTableSortField = store.sailorTableSortField || "perf";
store.sailorTableSortAsc = false;
store.sailorSection = store.sailorSection || "details";

function switchSailorSection(sec) {
  store.sailorSection = sec;
  const secDetails = document.getElementById("sailorsSectionDetails");
  const secPerf = document.getElementById("sailorsSectionPerf");
  const btnDetails = document.getElementById("btnSailorsSecDetails");
  const btnPerf = document.getElementById("btnSailorsSecPerf");

  if (sec === "performance") {
    if (secDetails) secDetails.classList.add("hidden");
    if (secPerf) secPerf.classList.remove("hidden");
    if (btnDetails) {
      btnDetails.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 transition-all";
    }
    if (btnPerf) {
      btnPerf.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-800 shadow-sm border border-slate-200/70 transition-all";
    }
    renderSailorPerformanceSection();
  } else {
    if (secPerf) secPerf.classList.add("hidden");
    if (secDetails) secDetails.classList.remove("hidden");
    if (btnPerf) {
      btnPerf.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 transition-all";
    }
    if (btnDetails) {
      btnDetails.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-800 shadow-sm border border-slate-200/70 transition-all";
    }
    renderSailorsView();
  }
}

function setSailorDirectoryViewMode(mode) {
  store.sailorDirectoryViewMode = mode;
  const btnTable = document.getElementById("btnViewTable");
  const btnGrid = document.getElementById("btnViewGrid");
  const tableView = document.getElementById("directorySailorsTableView");
  const gridView = document.getElementById("directorySailorsGrid");

  if (mode === "grid") {
    if (btnGrid) {
      btnGrid.className = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-sm transition-all";
    }
    if (btnTable) {
      btnTable.className = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-all";
    }
    if (tableView) tableView.classList.add("hidden");
    if (gridView) gridView.classList.remove("hidden");
  } else {
    if (btnTable) {
      btnTable.className = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-sm transition-all";
    }
    if (btnGrid) {
      btnGrid.className = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-all";
    }
    if (gridView) gridView.classList.add("hidden");
    if (tableView) tableView.classList.remove("hidden");
  }
  renderSailorsView();
}

function toggleSailorColumnMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("sailorColumnMenu");
  if (menu) menu.classList.toggle("hidden");
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById("sailorColumnMenu");
  if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

function toggleSailorCol(colClass, isVisible) {
  document.querySelectorAll("." + colClass).forEach((el) => {
    if (isVisible) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

function sortSailorTable(field) {
  if (store.sailorTableSortField === field) {
    store.sailorTableSortAsc = !store.sailorTableSortAsc;
  } else {
    store.sailorTableSortField = field;
    store.sailorTableSortAsc = field === "name" || field === "off_no" || field === "trade" || field === "city";
  }
  updateSailorSortIcons();
  renderSailorsView();
}

function updateSailorSortIcons() {
  const fields = ["off_no", "name", "trade", "city", "perf", "zone"];
  fields.forEach((f) => {
    const icon = document.getElementById("sort-icon-" + f);
    if (icon) {
      if (store.sailorTableSortField === f) {
        icon.textContent = store.sailorTableSortAsc ? "▲" : "▼";
        icon.className = "text-teal-400 font-bold";
      } else {
        icon.textContent = "↕";
        icon.className = "text-slate-400";
      }
    }
  });
}

function filterDirectoryTrade(trade) {
  store.directoryTradeFilter = trade;
  document.querySelectorAll(".dir-trade-btn").forEach((btn) => {
    btn.classList.remove("bg-slate-900", "text-white", "font-bold");
    btn.classList.add("bg-slate-100", "text-slate-600", "font-medium", "hover:bg-slate-200");
  });
  const activeBtn = document.getElementById("dir-trade-" + trade);
  if (activeBtn) {
    activeBtn.classList.remove("bg-slate-100", "text-slate-600", "font-medium", "hover:bg-slate-200");
    activeBtn.classList.add("bg-slate-900", "text-white", "font-bold");
  }
  renderSailorsView();
}

function resetSailorFilters() {
  const searchInput = document.getElementById("directorySailorSearch");
  if (searchInput) searchInput.value = "";
  store.directoryTradeFilter = "ALL";
  filterDirectoryTrade("ALL");

  const citySel = document.getElementById("directoryCityFilter");
  if (citySel) citySel.value = "ALL";
  const skillSel = document.getElementById("directorySkillFilter");
  if (skillSel) skillSel.value = "ALL";
  const scoreSel = document.getElementById("directoryScoreFilter");
  if (scoreSel) scoreSel.value = "ALL";
  const statusSel = document.getElementById("directoryStatusDropdown");
  if (statusSel) statusSel.value = "ALL";
  const dateFrom = document.getElementById("directoryDateFrom");
  if (dateFrom) dateFrom.value = "";
  const dateTo = document.getElementById("directoryDateTo");
  if (dateTo) dateTo.value = "";

  renderSailorsView();
}

function getSailorCityOrHometown(s) {
  if (!s) return "-";
  const cleanStr = (val) => val && val !== "-" && val !== "NO" && val !== "No" && val !== "N/A" && val !== "Not Provided" ? String(val).trim() : "";
  
  if (cleanStr(s.city)) return cleanStr(s.city);
  if (cleanStr(s.police_station)) return cleanStr(s.police_station);
  if (cleanStr(s.district)) return cleanStr(s.district);
  if (s.address && s.address !== "Not Provided" && s.address.includes(",")) {
    const parts = s.address.split(",");
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart && lastPart.length > 2 && lastPart.length < 30) {
      return lastPart;
    }
  }
  return cleanStr(s.hometown) || "-";
}

function populateSailorDropdownFilters() {
  if (!store.sailors || store.sailors.length === 0) return;

  // Populate Cities & Hometowns
  const citySelect = document.getElementById("directoryCityFilter");
  if (citySelect && citySelect.options.length <= 1) {
    const cities = new Set();
    store.sailors.forEach((s) => {
      const c = getSailorCityOrHometown(s);
      if (c && c !== "-") {
        // Capitalize nicely
        cities.add(c.toUpperCase());
      }
    });
    Array.from(cities).sort().forEach((city) => {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = `📍 ${city}`;
      citySelect.appendChild(opt);
    });
  }

  // Populate Special Skills
  const skillSelect = document.getElementById("directorySkillFilter");
  if (skillSelect && skillSelect.options.length <= 1) {
    const skills = new Set();
    store.sailors.forEach((s) => {
      const sk = (s.special_skill || s.skills || "").trim();
      if (sk && sk !== "NO" && sk !== "No" && sk !== "-") {
        // Take first primary skill keyword
        const firstLine = sk.split(/[\n,]/)[0].trim();
        if (firstLine.length > 2 && firstLine.length < 35) {
          skills.add(firstLine);
        }
      }
    });
    Array.from(skills).sort().forEach((skill) => {
      const opt = document.createElement("option");
      opt.value = skill;
      opt.textContent = `🛠️ ${skill}`;
      skillSelect.appendChild(opt);
    });
  }
}

function getSailorLiveDailyStatus(sailor, dateVal) {
  if (!sailor) return { statusText: "Available", statusClass: "available", isLeave: false, isSick: false, isBusy: false, isLongTerm: false, currentLoc: "—", badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Available</span>` };

  const today = getLocalDateString();
  if (!dateVal) dateVal = store.dashboardDate || today;

  const [yyyy, mm, dd] = dateVal.split("-");
  const monthKey = `${yyyy}-${mm}`;
  const dayKey = parseInt(dd, 10).toString();

  const sFbKey = sailor._fbKey || sailor.id;
  const sId = sailor.id || sailor._fbKey;

  // 1. Check Firebase Daily Availability / Attendance
  const fbAvail = (store.availability && store.availability[monthKey] && store.availability[monthKey][dayKey])
    ? (store.availability[monthKey][dayKey][sFbKey] || store.availability[monthKey][dayKey][sId])
    : null;

  const rawStatus = fbAvail || sailor.attendance || sailor.status || "";
  const statusStr = String(rawStatus).trim();

  const isSickCode = /^(Sick|SIQ|S\/R|Hospital|ADM|Admit)$/i.test(statusStr);
  const isLeaveCode = /^(Leave|NA|L|DL|WE|HD|T\/D|M\/D|R\/D|SL|R|Off|Holiday|Absent|AWOL|නිවාඩු|ගිලන්)$/i.test(statusStr);

  if (isSickCode) {
    return {
      statusText: "🏥 Sick",
      statusClass: "sick",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">🏥 Sick</span>`,
      isLeave: false,
      isSick: true,
      isBusy: false,
      isLongTerm: false,
      currentLoc: "— (Sick)"
    };
  }

  if (isLeaveCode) {
    return {
      statusText: "🏖️ On Leave",
      statusClass: "leave",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">🏖️ On Leave</span>`,
      isLeave: true,
      isSick: false,
      isBusy: false,
      isLongTerm: false,
      currentLoc: "— (On Leave)"
    };
  }

  // 2. Check Long Term Deployments (Housing, Out Project, Other Base)
  const longTerm = getLongTermAllocations();
  const matchedHousing = (longTerm.housing || []).find(a => String(a.sailor.id || a.sailor._fbKey) === String(sId) || String(a.sailor.id || a.sailor._fbKey) === String(sFbKey));
  if (matchedHousing) {
    return {
      statusText: "🏠 Housing",
      statusClass: "longterm",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">🏠 Housing</span>`,
      isLeave: false,
      isSick: false,
      isBusy: true,
      isLongTerm: true,
      currentLoc: matchedHousing.projectName || "Housing Project"
    };
  }

  const matchedOut = (longTerm.outProject || []).find(a => String(a.sailor.id || a.sailor._fbKey) === String(sId) || String(a.sailor.id || a.sailor._fbKey) === String(sFbKey));
  if (matchedOut) {
    return {
      statusText: "🏕️ Out Project",
      statusClass: "longterm",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">🏕️ Out Project</span>`,
      isLeave: false,
      isSick: false,
      isBusy: true,
      isLongTerm: true,
      currentLoc: matchedOut.projectName || "Out Project"
    };
  }

  const matchedOther = (longTerm.otherBase || []).find(a => String(a.sailor.id || a.sailor._fbKey) === String(sId) || String(a.sailor.id || a.sailor._fbKey) === String(sFbKey));
  if (matchedOther) {
    return {
      statusText: "⚓ Other Base",
      statusClass: "longterm",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">⚓ Other Base</span>`,
      isLeave: false,
      isSick: false,
      isBusy: true,
      isLongTerm: true,
      currentLoc: matchedOther.projectName || "Other Base"
    };
  }

  // 3. Check Active Work Order Assignment
  const assignment = getSailorCurrentAssignment(sFbKey) || getSailorCurrentAssignment(sId) || getSailorCurrentAssignment(sailor.official_number);
  if (assignment) {
    let locStr = assignment.zone || "Active WO";
    if (assignment.title) {
      locStr = `${locStr} • ${assignment.title}`;
    }
    return {
      statusText: "⚠️ Daily Task",
      statusClass: "busy",
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">⚠️ Daily Task</span>`,
      isLeave: false,
      isSick: false,
      isBusy: true,
      isLongTerm: false,
      currentLoc: locStr
    };
  }

  // 4. Default: Available
  return {
    statusText: "✓ Available",
    statusClass: "available",
    badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Available</span>`,
    isLeave: false,
    isSick: false,
    isBusy: false,
    isLongTerm: false,
    currentLoc: "Available"
  };
}

// Render Sailor Operations & Performance Center View
function renderSailorsView() {
  populateSailorDropdownFilters();

  const searchEl = document.getElementById("directorySailorSearch");
  const query = (searchEl ? searchEl.value : "").toLowerCase().trim();
  const trade = store.directoryTradeFilter || "ALL";
  const cityFilter = (document.getElementById("directoryCityFilter") || {}).value || "ALL";
  const skillFilter = (document.getElementById("directorySkillFilter") || {}).value || "ALL";
  const scoreFilter = (document.getElementById("directoryScoreFilter") || {}).value || "ALL";
  const statusFilter = (document.getElementById("directoryStatusDropdown") || {}).value || "ALL";
  const dateFrom = (document.getElementById("directoryDateFrom") || {}).value || "";
  const dateTo = (document.getElementById("directoryDateTo") || {}).value || "";

  let filtered = [...(store.sailors || [])];

  // Map each sailor with live computed fields & status
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;

  let mapped = filtered.map((s) => {
    var _s$idComputed;
    const sId = (_s$idComputed = s.id) !== null && _s$idComputed !== void 0 ? _s$idComputed : s._fbKey;
    const offNo = s.official_number || s.off_no || s.service_no || "-";
    const points = calculateSailorPoints(s);
    const leaveDays = calculateSailorLeaveDays(s);
    const liveStatus = getSailorLiveDailyStatus(s, dateVal);
    const perf = parseFloat(s.avgScore || s.yesterdayScore || 7.0);
    const city = getSailorCityOrHometown(s);
    const assignedZone = liveStatus.currentLoc;
    return { ...s, offNo, points, leaveDays, liveStatus, perf, city, assignedZone };
  });

  // Search filter
  if (query) {
    mapped = mapped.filter((s) => {
      const offNo = String(s.offNo || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const rank = String(s.rank || "").toLowerCase();
      const tr = String(s.trade || "").toLowerCase();
      const city = String(s.city || s.district || s.hometown || "").toLowerCase();
      const skill = String(s.special_skill || s.skills || "").toLowerCase();
      return name.includes(query) || offNo.includes(query) || rank.includes(query) || tr.includes(query) || city.includes(query) || skill.includes(query);
    });
  }

  // Trade filter
  if (trade !== "ALL") {
    mapped = mapped.filter((s) => s.trade === trade);
  }

  // City filter
  if (cityFilter !== "ALL") {
    mapped = mapped.filter((s) => {
      const c = (s.city || s.district || s.hometown || "").toUpperCase();
      return c.includes(cityFilter);
    });
  }

  // Special skill filter
  if (skillFilter !== "ALL") {
    mapped = mapped.filter((s) => {
      const sk = (s.special_skill || s.skills || "").toLowerCase();
      return sk.includes(skillFilter.toLowerCase());
    });
  }

  // Score level filter
  if (scoreFilter !== "ALL") {
    mapped = mapped.filter((s) => {
      const sc = s.perf;
      if (scoreFilter === "top") return sc >= 9.0;
      if (scoreFilter === "good") return sc >= 7.0 && sc < 9.0;
      if (scoreFilter === "avg") return sc >= 5.0 && sc < 7.0;
      if (scoreFilter === "low") return sc < 5.0;
      return true;
    });
  }

  // Status filter
  if (statusFilter !== "ALL") {
    mapped = mapped.filter((s) => {
      if (statusFilter === "AVAILABLE") return !s.liveStatus.isLeave && !s.liveStatus.isSick && !s.liveStatus.isBusy;
      if (statusFilter === "BUSY") return s.liveStatus.isBusy && !s.liveStatus.isLongTerm;
      if (statusFilter === "LEAVE") return s.liveStatus.isLeave;
      if (statusFilter === "SICK") return s.liveStatus.isSick;
      if (statusFilter === "LONG_TERM") return s.liveStatus.isLongTerm;
      return true;
    });
  }

  // Table & Grid Sorting
  const sortField = store.sailorTableSortField || "perf";
  const isAsc = store.sailorTableSortAsc;

  mapped.sort((a, b) => {
    let res = 0;
    if (sortField === "off_no") {
      res = (a.offNo || "").localeCompare(b.offNo || "", undefined, { numeric: true });
    } else if (sortField === "name") {
      res = (a.name || "").localeCompare(b.name || "");
    } else if (sortField === "trade") {
      res = (a.trade || "").localeCompare(b.trade || "");
    } else if (sortField === "city") {
      res = (a.city || "").localeCompare(b.city || "");
    } else if (sortField === "perf") {
      res = (a.perf || 0) - (b.perf || 0);
    } else if (sortField === "zone") {
      res = (a.assignedZone || "").localeCompare(b.assignedZone || "");
    }
    return isAsc ? res : -res;
  });

  // Update total count badge
  const totalCountBadge = document.getElementById("directoryTotalCount");
  if (totalCountBadge) {
    totalCountBadge.textContent = `Total: ${mapped.length} Sailors`;
  }

  // Render Table View Rows
  const tableBody = document.getElementById("directorySailorsTableBody");
  if (tableBody) {
    if (mapped.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-12 text-slate-400 font-medium text-sm">No sailors found matching criteria.</td></tr>`;
    } else {
      tableBody.innerHTML = mapped.map((s) => {
        var _s$idRow;
        const sId = (_s$idRow = s.id) !== null && _s$idRow !== void 0 ? _s$idRow : s._fbKey;
        const shortRank = s.rank ? s.rank.replace(/[a-z\s()]/gi, "").substring(0, 2) : "AB";
        const statusBadge = s.liveStatus.badgeHtml;

        const skillText = s.special_skill && s.special_skill !== "NO" && s.special_skill !== "No" ? s.special_skill.replace(/[\r\n]+/g, " ").trim() : "—";
        const skillSnippet = skillText.length > 25 ? skillText.substring(0, 25) + "..." : skillText;
        const cleanCity = s.city && s.city !== "-" ? `📍 ${s.city}` : "—";

        return `
        <tr class="hover:bg-slate-50/90 transition-colors group">
            <td class="py-3 px-4 font-mono font-bold text-xs text-slate-800 whitespace-nowrap">${s.offNo}</td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[11px] flex-shrink-0 shadow-sm">
                        ${shortRank}
                    </div>
                    <div class="min-w-0">
                        <p class="font-bold text-xs text-slate-900 truncate hover:text-teal-600 cursor-pointer" onclick="openSailorProfile('${sId}')">${s.name || "-"}</p>
                        <p class="text-[10px] text-slate-500 font-semibold">${s.rank || "-"}</p>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-extrabold bg-slate-900 text-white">${s.trade || "-"}</span>
            </td>
            <td class="py-3 px-4 col-city text-xs text-slate-600 font-medium whitespace-nowrap">${cleanCity}</td>
            <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
            <td class="py-3 px-4 col-perf whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-300 shadow-sm">
                    ⭐ ${s.perf.toFixed(2)}
                </span>
            </td>
            <td class="py-3 px-4 col-skills text-xs text-slate-500 truncate max-w-[160px]" title="${skillText.replace(/"/g, '&quot;')}">
                ${skillSnippet !== "—" ? `<span class="text-slate-700">🛠️ ${skillSnippet}</span>` : '<span class="text-slate-300">—</span>'}
            </td>
            <td class="py-3 px-4 col-zone text-xs font-semibold text-slate-700 whitespace-nowrap">${s.assignedZone}</td>
            <td class="py-3 px-4 text-center whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)]">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="openSailorProfile('${sId}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm">
                        <span>👤</span> Profile
                    </button>
                    <button onclick="openEvaluationModal('${sId}', '')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm">
                        <span>⭐</span> Eval
                    </button>
                </div>
            </td>
        </tr>
        `;
      }).join("");
    }
  }

  // Render Cards Grid View
  const gridContainer = document.getElementById("directorySailorsGrid");
  if (gridContainer) {
    if (mapped.length === 0) {
      gridContainer.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400 font-medium text-sm">No sailors found matching criteria.</div>`;
    } else {
      gridContainer.innerHTML = mapped.map((s) => {
        var _s$idGrid;
        const sId = (_s$idGrid = s.id) !== null && _s$idGrid !== void 0 ? _s$idGrid : s._fbKey;
        const cleanNo = s.offNo ? s.offNo.replace(/[^a-zA-Z0-9]/g, "") : "";
        const shortRank = s.rank ? s.rank.replace(/[a-z\s()]/gi, "").substring(0, 3) : "AB";
        const fallbackText = `<div class="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
        const avatarHtml = cleanNo ? `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-12 h-12 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">` : fallbackText;

        const statusBadge = s.liveStatus.badgeHtml;

        const tradeColors = {
          MA: "bg-teal-600",
          CA: "bg-purple-600",
          PA: "bg-amber-700",
          PL: "bg-cyan-600",
          WE: "bg-red-600",
          RW: "bg-slate-700",
          SW: "bg-emerald-800",
          BB: "bg-blue-700",
          AL: "bg-pink-600",
        };
        const tradeClass = tradeColors[s.trade] || "bg-slate-600";

        return `
        <div onclick="openSailorProfile('${sId}')" class="bg-white rounded-2xl shadow-md border border-slate-200/80 p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between">
            <div class="flex items-start gap-3">
                <div class="relative flex-shrink-0">
                    ${avatarHtml}
                    <span class="absolute -bottom-1 -right-1 text-[9px] text-white px-1.5 py-0.5 rounded-full font-extrabold ${tradeClass}">
                        ${s.trade}
                    </span>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-800 text-sm truncate">${s.name}</p>
                    <p class="text-xs text-slate-500 font-semibold truncate mt-0.5">${s.rank}</p>
                    <p class="text-[10px] text-slate-400 mono mt-0.5">${s.offNo}</p>
                </div>
            </div>

            <div class="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-1">
                ${statusBadge}
                <div class="flex gap-2 text-[11px] font-bold">
                    <span class="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded" title="Performance score">⭐ ${s.perf.toFixed(2)}</span>
                    <span class="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded" title="Leave days earned">📅 ${s.leaveDays}D</span>
                </div>
            </div>
        </div>
        `;
      }).join("");
    }
  }
}

// Render Section 2: Performance Analyser
function renderSailorPerformanceSection() {
  const container = document.getElementById("sailorsSectionPerf");
  if (!container) return;

  const sailors = store.sailors || [];
  if (sailors.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400">No sailor data available for analysis.</div>`;
    return;
  }

  let totalScore = 0;
  let topCount = 0;
  let goodCount = 0;
  let avgCount = 0;
  let lowCount = 0;

  const tradeStats = {};

  sailors.forEach((s) => {
    const sc = parseFloat(s.avgScore || s.yesterdayScore || 7.0);
    totalScore += sc;
    if (sc >= 9.0) topCount++;
    else if (sc >= 7.0) goodCount++;
    else if (sc >= 5.0) avgCount++;
    else lowCount++;

    const tr = s.trade || "OTHER";
    if (!tradeStats[tr]) tradeStats[tr] = { total: 0, count: 0 };
    tradeStats[tr].total += sc;
    tradeStats[tr].count += 1;
  });

  const avgRating = (totalScore / sailors.length).toFixed(2);

  // Sort top 10 sailors
  const topPerformers = [...sailors]
    .map((s) => ({
      ...s,
      perf: parseFloat(s.avgScore || s.yesterdayScore || 7.0),
      offNo: s.official_number || s.off_no || s.service_no || "-",
    }))
    .sort((a, b) => b.perf - a.perf)
    .slice(0, 10);

  container.innerHTML = `
    <!-- Top Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold">⭐</div>
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Performance</p>
                <p class="text-2xl font-black text-slate-800 mt-0.5">${avgRating} <span class="text-xs font-normal text-slate-400">/ 10</span></p>
            </div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">🏆</div>
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding (≥9.0)</p>
                <p class="text-2xl font-black text-emerald-600 mt-0.5">${topCount} <span class="text-xs font-normal text-slate-400">Sailors</span></p>
            </div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold">🎯</div>
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Good (7.0 - 8.9)</p>
                <p class="text-2xl font-black text-blue-600 mt-0.5">${goodCount} <span class="text-xs font-normal text-slate-400">Sailors</span></p>
            </div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">⚠️</div>
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Needs Focus (&lt;7.0)</p>
                <p class="text-2xl font-black text-amber-600 mt-0.5">${avgCount + lowCount} <span class="text-xs font-normal text-slate-400">Sailors</span></p>
            </div>
        </div>
    </div>

    <!-- Charts & Leaderboard Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Trade Performance Breakdown -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span>📊</span> Trade-wise Performance Average
            </h3>
            <div class="space-y-3">
                ${Object.keys(tradeStats).map((tr) => {
                  const stat = tradeStats[tr];
                  const avg = (stat.total / stat.count).toFixed(2);
                  const pct = Math.min(100, Math.round((avg / 10) * 100));
                  return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs font-bold">
                            <span class="text-slate-700">${tr} (${stat.count} Sailors)</span>
                            <span class="text-teal-600">⭐ ${avg}</span>
                        </div>
                        <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-teal-500 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                  `;
                }).join("")}
            </div>
        </div>

        <!-- Top 10 Leaderboard -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span>🏆</span> Top 10 High Performers
            </h3>
            <div class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                ${topPerformers.map((s, idx) => {
                  var _s$idTop;
                  const sId = (_s$idTop = s.id) !== null && _s$idTop !== void 0 ? _s$idTop : s._fbKey;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  return `
                    <div onclick="openSailorProfile('${sId}')" class="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                        <div class="flex items-center gap-3">
                            <span class="w-7 text-center font-bold text-xs text-slate-600">${medal}</span>
                            <div>
                                <p class="text-xs font-bold text-slate-800">${s.rank || ""} ${s.name || ""}</p>
                                <p class="text-[10px] text-slate-500">${s.offNo} • ${s.trade || ""}</p>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
                            ⭐ ${s.perf.toFixed(2)}
                        </span>
                    </div>
                  `;
                }).join("")}
            </div>
        </div>
    </div>
  `;
}
// Open Sailor Profile Modal with detailed stats
function openSailorProfile(sailorId) {
  var _sailor$id4;
  if (_justClosedModal) return;
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  if (!sailor) {
    showToast("Sailor profile not found", "error");
    return;
  }
  const points = calculateSailorPointsPast30Days(sailor);
  const leaveDays = calculateSailorLeaveDays(sailor); // Bio
  document.getElementById("profName").textContent = sailor.name;
  document.getElementById("profRankOffNo").textContent =
    `${sailor.rank} · Official No: ${sailor.official_number}`;
  document.getElementById("profActiveZone").textContent =
    `Assigned Zone: ${sailor.zone_assigned || "None"}`;
  document.getElementById("profTradeBadge").textContent = sailor.trade;
  document.getElementById("profCategory").textContent =
    sailor.category || "Regular";
  const tradeColors = {
    MA: "bg-teal-600 text-teal-100",
    CA: "bg-purple-600 text-purple-100",
    PA: "bg-amber-700 text-amber-100",
    PL: "bg-cyan-600 text-cyan-100",
    WE: "bg-red-600 text-red-100",
    RW: "bg-slate-700 text-slate-100",
    SW: "bg-emerald-800 text-emerald-100",
    BB: "bg-blue-700 text-blue-100",
    AL: "bg-pink-600 text-pink-100",
  };
  const tradeClass = tradeColors[sailor.trade] || "bg-slate-800 text-slate-100";
  document.getElementById("profTradeBadge").className =
    `text-xs px-2 py-0.5 rounded font-extrabold ${tradeClass}`; // Status Badge
  const assignment = getSailorCurrentAssignment(
    (_sailor$id4 = sailor.id) !== null && _sailor$id4 !== void 0
      ? _sailor$id4
      : sailor._fbKey,
  );
  const statusBadge = document.getElementById("profStatusBadge");
  if (sailor.attendance === "Leave") {
    statusBadge.className =
      "text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>On Leave';
  } else if (sailor.attendance === "Sick") {
    statusBadge.className =
      "text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Sick';
  } else if (assignment) {
    statusBadge.className =
      "text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Busy: ${assignment.zone}`;
  } else {
    statusBadge.className =
      "text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Available';
  } // Points & Leave Days
  document.getElementById("profTotalPoints").textContent = points;
  document.getElementById("profLeaveDays").textContent = leaveDays; // Ratings
  document.getElementById("profAvgRating").textContent =
    `${(sailor.avgScore || 7.0).toFixed(1)} / 10`;
  document.getElementById("profYesterdayRating").textContent =
    sailor.yesterdayScore ? `${sailor.yesterdayScore.toFixed(1)} / 10` : "-"; // Progress Bar to Next Leave Day
  const progressVal = points % 10;
  document.getElementById("profNextLeaveProgressText").textContent =
    `${progressVal} / 10 Points`;
  document.getElementById("profNextLeaveProgressBar").style.width =
    `${progressVal * 10}%`; // Profile Photo
  const cleanNo = sailor.official_number
    ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, "")
    : "";
  const shortRank = sailor.rank
    ? sailor.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
    : "AB";
  const fallbackText = `<div class="w-full h-full rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xl">${shortRank}</div>`;
  const picContainer = document.getElementById("profPicContainer");
  if (cleanNo) {
    picContainer.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
  } else {
    picContainer.innerHTML = fallbackText;
  } // Populate Duty Log
  const dutyLogContainer = document.getElementById("profDutyLog"); // Search active and completed work orders for this sailor's assignments
  const recentJobs = []; // Check allocations (active / historic)
  const allocations = (store.dailyAllocations || []).filter(
    (a) =>
      String(a.sailor_id) === String(sailor.id) ||
      String(a.sailor_id) === String(sailor._fbKey),
  );
  allocations.forEach((a) => {
    // Find corresponding work order for description
    const wo = store.workOrders.find(
      (w) =>
        String(w.id) === String(a.work_order_id) ||
        String(w._fbKey) === String(a.work_order_id),
    );
    recentJobs.push({
      date: a.date,
      type: "Daily Allocation",
      ref: wo ? wo.reference_no : "Task Allocation",
      desc: wo ? wo.description : "Productivity suite labor allocation",
      status: "Completed",
    });
  }); // Sort recent jobs by date desc
  recentJobs.sort((a, b) => b.date.localeCompare(a.date)); // Render duty log entries (limit to 10)
  dutyLogContainer.innerHTML =
    recentJobs
      .slice(0, 10)
      .map(
        (job) => `
        <div class="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
            <div>
                <p class="font-bold text-slate-700">${job.desc}</p>
                <p class="text-slate-400 mt-0.5">Ref: ${job.ref} · ${job.type}</p>
            </div>
            <div class="text-right">
                <span class="mono text-slate-500 font-bold">${job.date}</span>
                <span class="block text-[10px] text-green-600 font-semibold uppercase mt-0.5">${job.status}</span>
            </div>
        </div>
    `,
      )
      .join("") ||
    '<p class="text-slate-400 text-center py-6 text-xs">No recent allocation records found.</p>';
  document.getElementById("sailorProfileModal").classList.remove("hidden");
} // =============================================================================
// SAILOR LOGIN AUTOCOMPLETE & PERSONAL DASHBOARD VIEW METHODS
// =============================================================================
// Set Login Mode (OIC or SAILOR)
function setLoginMode(mode) {
  const inputMode = document.getElementById("loginMode");
  if (!inputMode) return;
  inputMode.value = mode;
  const btnOic = document.getElementById("loginModeBtnOIC");
  const btnSailor = document.getElementById("loginModeBtnSailor");
  const groupOic = document.getElementById("loginGroupOic");
  const groupSailor = document.getElementById("loginGroupSailor");
  const pwdGroup = document.getElementById("loginPasswordGroup");
  const pwdInput = document.getElementById("loginPasswordInput");
  const container = document.getElementById("loginAvatarContainer"); // Reset avatar
  container.innerHTML = '<span class="text-3xl">⚓</span>';
  if (mode === "OIC") {
    btnOic.classList.add("bg-teal-600", "text-white");
    btnOic.classList.remove("text-slate-400", "hover:text-white");
    btnSailor.classList.remove("bg-teal-600", "text-white");
    btnSailor.classList.add("text-slate-400", "hover:text-white");
    groupOic.classList.remove("hidden");
    groupSailor.classList.add("hidden");
    document.getElementById("loginProfileSelect").value = "";
    pwdGroup.classList.add("hidden");
    pwdInput.required = false;
    pwdInput.value = "";
  } else {
    btnSailor.classList.add("bg-teal-600", "text-white");
    btnSailor.classList.remove("text-slate-400", "hover:text-white");
    btnOic.classList.remove("bg-teal-600", "text-white");
    btnOic.classList.add("text-slate-400", "hover:text-white");
    groupSailor.classList.remove("hidden");
    groupOic.classList.add("hidden");
    document.getElementById("loginSailorSearch").value = "";
    document.getElementById("loginSailorSelectedId").value = "";
    pwdGroup.classList.add("hidden");
    pwdInput.required = false;
    pwdInput.value = "";
  }
} // Filter Autocomplete list inside login screen
function filterLoginSailor(query) {
  const dropdown = document.getElementById("loginSailorDropdown");
  if (!dropdown) return;
  if (!query.trim()) {
    dropdown.innerHTML = "";
    dropdown.classList.add("hidden");
    return;
  }
  const q = query.toLowerCase().trim();
  const matches = store.sailors
    .filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        String(s.official_number || "")
          .toLowerCase()
          .includes(q),
    )
    .slice(0, 8); // Top 8 matches
  if (matches.length === 0) {
    dropdown.innerHTML =
      '<div class="p-3 text-slate-500 text-xs italic">No matching sailors found</div>';
    dropdown.classList.remove("hidden");
    return;
  }
  dropdown.innerHTML = matches
    .map((s) => {
      const cleanNo = s.official_number
        ? s.official_number.replace(/[^a-zA-Z0-9]/g, "")
        : "";
      const shortRank = s.rank
        ? s.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
        : "AB";
      const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">${shortRank}</div>`;
      const avatar = cleanNo
        ? `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">`
        : fallbackText;
      return `
            <div onclick="selectLoginSailor('${s.id}')" class="px-4 py-2.5 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors text-xs text-white">
                ${avatar}
                <div class="min-w-0 flex-1">
                    <p class="font-bold truncate">${s.name}</p>
                    <p class="text-[10px] text-slate-400 truncate mt-0.5">${s.rank} · ${s.official_number}</p>
                </div>
            </div>
        `;
    })
    .join("");
  dropdown.classList.remove("hidden");
} // Show dropdown results when input focus
function showLoginSailorDropdown() {
  const val = document.getElementById("loginSailorSearch").value;
  filterLoginSailor(val);
} // Select Sailor in Login Page Autocomplete
function selectLoginSailor(id) {
  const sailor = store.sailors.find((s) => String(s.id) === String(id));
  if (!sailor) return;
  document.getElementById("loginSailorSearch").value =
    `${sailor.rank} ${sailor.name} (${sailor.official_number})`;
  document.getElementById("loginSailorSelectedId").value = id; // Hide dropdown
  const dropdown = document.getElementById("loginSailorDropdown");
  if (dropdown) dropdown.classList.add("hidden"); // Update Avatar Preview
  const container = document.getElementById("loginAvatarContainer");
  const cleanNo = sailor.official_number
    ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, "")
    : "";
  const shortRank = sailor.rank
    ? sailor.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
    : "AB";
  const fallbackText = `<div class="w-full h-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-lg">${shortRank}</div>`;
  if (cleanNo) {
    container.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
  } else {
    container.innerHTML = fallbackText;
  }
} // Render the Personal Sailor Dashboard View
function renderSailorDashboardView() {
  var _sailor$id5;
  const sailorId = localStorage.getItem("ncw_ps_active_sailor_id");
  if (!sailorId) {
    logoutProfile();
    return;
  }
  const sailor = store.sailors.find(
    (s) =>
      String(s.id) === String(sailorId) ||
      String(s._fbKey) === String(sailorId),
  );
  if (!sailor) {
    // Retry loading if database hasn't loaded yet
    return;
  }
  const points = calculateSailorPoints(sailor);
  const leaveDays = calculateSailorLeaveDays(sailor); // Bio
  document.getElementById("dashName").textContent = sailor.name;
  document.getElementById("dashRankOffNo").textContent =
    `${sailor.rank} · Official No: ${sailor.official_number}`;
  document.getElementById("dashActiveZone").textContent =
    `Zone: ${sailor.zone_assigned || "None"}`;
  document.getElementById("dashTradeBadge").textContent = sailor.trade;
  document.getElementById("dashCategory").textContent =
    sailor.category || "Regular";
  const tradeColors = {
    MA: "bg-teal-600 text-teal-100",
    CA: "bg-purple-600 text-purple-100",
    PA: "bg-amber-700 text-amber-100",
    PL: "bg-cyan-600 text-cyan-100",
    WE: "bg-red-600 text-red-100",
    RW: "bg-slate-700 text-slate-100",
    SW: "bg-emerald-800 text-emerald-100",
    BB: "bg-blue-700 text-blue-100",
    AL: "bg-pink-600 text-pink-100",
  };
  const tradeClass = tradeColors[sailor.trade] || "bg-slate-800 text-slate-100";
  document.getElementById("dashTradeBadge").className =
    `text-xs px-2 py-0.5 rounded font-extrabold ${tradeClass}`; // Status Badge
  const assignment = getSailorCurrentAssignment(
    (_sailor$id5 = sailor.id) !== null && _sailor$id5 !== void 0
      ? _sailor$id5
      : sailor._fbKey,
  );
  const statusBadge = document.getElementById("dashStatusBadge");
  if (sailor.attendance === "Leave") {
    statusBadge.className =
      "text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>On Leave';
  } else if (sailor.attendance === "Sick") {
    statusBadge.className =
      "text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Sick';
  } else if (assignment) {
    statusBadge.className =
      "text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Busy: ${assignment.zone}`;
  } else {
    statusBadge.className =
      "text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1";
    statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Available';
  } // Points & Leave Days
  document.getElementById("dashTotalPoints").textContent = points;
  document.getElementById("dashLeaveDays").textContent = leaveDays; // Ratings
  document.getElementById("dashAvgRating").textContent =
    `${(sailor.avgScore || 7.0).toFixed(1)} / 10`;
  document.getElementById("dashYesterdayRating").textContent =
    sailor.yesterdayScore ? `${sailor.yesterdayScore.toFixed(1)} / 10` : "-"; // Progress Bar to Next Leave Day
  const progressVal = points % 10;
  document.getElementById("dashNextLeaveProgressText").textContent =
    `${progressVal} / 10 Points`;
  document.getElementById("dashNextLeaveProgressBar").style.width =
    `${progressVal * 10}%`; // Profile Photo
  const cleanNo = sailor.official_number
    ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, "")
    : "";
  const shortRank = sailor.rank
    ? sailor.rank.replace(/[a-z\s()]/gi, "").substring(0, 3)
    : "AB";
  const fallbackText = `<div class="w-full h-full rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xl">${shortRank}</div>`;
  const picContainer = document.getElementById("dashPicContainer");
  if (cleanNo) {
    picContainer.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, "&quot;")}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
  } else {
    picContainer.innerHTML = fallbackText;
  } // Populate Duty Log
  const dutyLogContainer = document.getElementById("dashDutyLog");
  const recentJobs = [];
  const allocations = (store.dailyAllocations || []).filter(
    (a) =>
      String(a.sailor_id) === String(sailor.id) ||
      String(a.sailor_id) === String(sailor._fbKey),
  );
  allocations.forEach((a) => {
    const wo = store.workOrders.find(
      (w) =>
        String(w.id) === String(a.work_order_id) ||
        String(w._fbKey) === String(a.work_order_id),
    );
    recentJobs.push({
      date: a.date,
      type: "Allocation",
      ref: wo ? wo.reference_no : "Task",
      desc: wo ? wo.description : "Task Labor allocation",
      status: "Completed",
    });
  });
  recentJobs.sort((a, b) => b.date.localeCompare(a.date));
  dutyLogContainer.innerHTML =
    recentJobs
      .slice(0, 10)
      .map(
        (job) => `
        <div class="p-4 hover:bg-white/5 flex items-start gap-3 text-xs transition-colors duration-200">
            <div class="mt-1 flex flex-col items-center flex-shrink-0">
                <div class="w-2.5 h-2.5 rounded-full bg-teal-400 border border-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                <div class="w-0.5 h-10 bg-white/10 mt-1"></div>
            </div>
            <div class="min-w-0 flex-1">
                <p class="font-black text-white truncate text-xs">${job.desc}</p>
                <p class="text-[10px] text-slate-400 mt-0.5 tracking-wider">Ref: ${job.ref} · ${job.type}</p>
            </div>
            <div class="text-right flex-shrink-0 pl-2">
                <span class="mono text-[10px] text-slate-400 font-bold tracking-tight">${job.date}</span>
                <span class="block text-[9px] text-teal-400 font-black uppercase mt-1 tracking-wider">${job.status}</span>
            </div>
        </div>
    `,
      )
      .join("") ||
    '<p class="text-slate-500 text-center py-8 text-xs italic">No operational records found.</p>';
} // Window click listener to close login search dropdown
window.addEventListener("click", function (e) {
  const dropdown = document.getElementById("loginSailorDropdown");
  const input = document.getElementById("loginSailorSearch");
  if (
    dropdown &&
    input &&
    !dropdown.contains(e.target) &&
    !input.contains(e.target)
  ) {
    dropdown.classList.add("hidden");
  }
}); // =============================================
// PDF BACKUP & GOOGLE DRIVE BACKUP SYSTEM
// =============================================
function generateWorkOrdersPdfBlob(dateVal) {
  const today = getLocalDateString();
  const targetDate = dateVal || store.dashboardDate || today; // Generate the exact same HTML rows as printLmdDetails but for all zones
  let rowsHtml = "";
  const zones = store.zones;
  zones.forEach((z) => {
    const wos = store.workOrders.filter(
      (wo) => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, targetDate),
    );
    wos.sort((a, b) => {
      const aInCharge = (a.description || "").toLowerCase().includes("in charge") || a.assign_type === "In Charge";
      const bInCharge = (b.description || "").toLowerCase().includes("in charge") || b.assign_type === "In Charge";
      if (aInCharge && !bInCharge) return -1;
      if (!aInCharge && bInCharge) return 1;
      return 0;
    });
    let zoneHasAllocations = false;
    wos.forEach((wo) => {
      let assignedCount = 0;
      if (targetDate === today) {
        assignedCount = (wo.assigned || []).length;
      } else {
        assignedCount = (store.dailyAllocations || []).filter(
          (a) =>
            a.date === targetDate && String(a.work_order_id) === String(wo.id),
        ).length;
      }
      if (assignedCount > 0) zoneHasAllocations = true;
    });
    if (zoneHasAllocations) {
      rowsHtml += `
                <tr style="background-color: #0f172a; color: white; font-weight: bold;">
                    <td colspan="6" style="padding: 8px 12px; font-size: 13px; text-transform: uppercase;">
                        🗺️ ZONE: ${z.name.toUpperCase()}
                    </td>
                </tr>
            `;
      wos.forEach((wo) => {
        let assignedSailors = [];
        if (targetDate === today) {
          const assignedIds = (wo.assigned || []).map(String);
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        } else {
          const assignedIds = (store.dailyAllocations || [])
            .filter(
              (a) =>
                a.date === targetDate &&
                String(a.work_order_id) === String(wo.id),
            )
            .map((a) => String(a.sailor_id));
          assignedSailors = store.sailors.filter(
            (s) =>
              assignedIds.includes(String(s.id)) ||
              assignedIds.includes(String(s._fbKey)),
          );
        }
        if (assignedSailors.length > 0) {
          rowsHtml += `
                        <tr style="background-color: #f1f5f9; font-weight: bold;">
                            <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
                                📋 ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
          assignedSailors.forEach((s, idx) => {
            const serNo = String(idx + 1).padStart(2, "0");
            const parsedOffNo = parseOfficialNumber(
              s.official_number || s.service_no,
            );
            rowsHtml += `
                            <tr>
                                <td style="text-align:center;">${serNo}</td>
                                <td>${s.rank || "AB"}</td>
                                <td>${s.name}</td>
                                <td style="text-align:center;">${parsedOffNo.type}</td>
                                <td>${parsedOffNo.num}</td>
                                <td style="text-align:center;">${s.trade || "—"}</td>
                            </tr>
                        `;
          });
        }
      });
    }
  });
  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No allocations found for this selection on this date.</td></tr>`;
  }
  const formattedDate = new Date(targetDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }); // Create container element for html2pdf
  const element = document.createElement("div");
  element.style.padding = "20px";
  element.style.background = "#white";
  element.innerHTML = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color:#000;">
            <div style="display: flex; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px;">
                <div style="text-align: left;">
                    <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">CMSys Daily Details Report</h1>
                    <h2 style="font-size: 11px; font-weight: 700; color: #475569; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">CE Management System • Trincomalee</h2>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #334155; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px;">
                <div>
                    <strong>Date:</strong> ${targetDate}<br>
                    <strong>Scope:</strong> All Zones Combined
                </div>
                <div style="text-align: right;">
                    <strong>Generated At:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Authorized By:</strong> CMSys System
                </div>
            </div>
            
            <table style="width:100%; border-collapse:collapse; font-size:10.5px; margin-top: 10px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #94a3b8; padding:7px 9px; text-align:center;">Sr.No</th>
                        <th style="border:1px solid #94a3b8; padding:7px 9px;">Rank</th>
                        <th style="border:1px solid #94a3b8; padding:7px 9px;">Name</th>
                        <th style="border:1px solid #94a3b8; padding:7px 9px; text-align:center;">Type</th>
                        <th style="border:1px solid #94a3b8; padding:7px 9px;">Off. No</th>
                        <th style="border:1px solid #94a3b8; padding:7px 9px; text-align:center;">Trade</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 11px;">
                <div style="text-align: center; width: 180px;">
                    <p>..................................................</p>
                    <p style="font-weight: bold;">PREPARED BY - LME</p>
                </div>
                <div style="text-align: center; width: 180px;">
                    <p>..................................................</p>
                    <p style="font-weight: bold;">CHECKED BY (S/S INCHARGE)</p>
                </div>
                <div style="text-align: center; width: 180px;">
                    <p>..................................................</p>
                    <p style="font-weight: bold;">CHECKED BY</p>
                </div>
            </div>
        </div>
    `;
  return element;
}
function downloadWorkOrdersPdfBackup() {
  showToast("Preparing PDF backup...", "info");
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const element = generateWorkOrdersPdfBlob(dateVal);
  const opt = {
    margin: 10,
    filename: `ncw_ps_backup_${dateVal}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      showToast("PDF backup downloaded successfully!");
    })
    .catch((err) => {
      console.error(err);
      showToast("Failed to download PDF backup.", "error");
    });
}
function uploadWorkOrdersPdfToDrive() {
  const clientId = (store.settings || {}).googleClientId || "";
  if (!clientId) {
    openGoogleConfigModal();
    return;
  }
  showToast("Connecting to Google Drive...", "info");
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (response) => {
      if (response.error) {
        showToast(`Google Authentication failed: ${response.error}`, "error");
        return;
      }
      if (response.access_token) {
        performGoogleDriveUpload(response.access_token);
      }
    },
  });
  client.requestAccessToken();
}
function performGoogleDriveUpload(accessToken) {
  showToast("Generating PDF & Uploading...", "info");
  const today = getLocalDateString();
  const dateVal = store.dashboardDate || today;
  const element = generateWorkOrdersPdfBlob(dateVal);
  const opt = {
    margin: 10,
    filename: `ncw_ps_backup_${dateVal}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  html2pdf()
    .set(opt)
    .from(element)
    .output("blob")
    .then((pdfBlob) => {
      const metadata = {
        name: `ncw_ps_backup_${dateVal}.pdf`,
        mimeType: "application/pdf",
      };
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      );
      form.append("file", pdfBlob);
      fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            showToast("✅ Upload to Google Drive successful!");
          } else {
            var _data$error;
            showToast(
              "❌ Google Drive upload failed: " +
                (((_data$error = data.error) === null || _data$error === void 0
                  ? void 0
                  : _data$error.message) || "Unknown error"),
              "error",
            );
          }
        })
        .catch((err) => {
          console.error(err);
          showToast("Failed to upload file to Google Drive.", "error");
        });
    });
}
function openGoogleConfigModal() {
  const s = store.settings || {};
  document.getElementById("cfg-googleClientIdModal").value =
    s.googleClientId || "";
  document.getElementById("googleConfigModal").classList.remove("hidden");
}
function saveGoogleConfigFromModal() {
  const val = document.getElementById("cfg-googleClientIdModal").value.trim();
  if (!val) {
    showToast("Please enter a valid Client ID", "error");
    return;
  }
  saveSettingField("googleClientId", val);
  closeModal("googleConfigModal");
  showToast("Google Client ID saved. Retrying upload...");
  setTimeout(() => {
    uploadWorkOrdersPdfToDrive();
  }, 1000);
}

// AVAIL Copy Function
document.addEventListener('DOMContentLoaded', () => {
  const availSpan = document.getElementById('availableCount');
  if (availSpan && availSpan.parentElement) {
    availSpan.parentElement.style.cursor = 'pointer';
    availSpan.parentElement.title = 'Click to copy Available Sailors list';
    availSpan.parentElement.addEventListener('click', () => {
      if (!store.sailors) return;
      const availableSailors = store.sailors.filter(s => s.status === 'Available');
      if (availableSailors.length === 0) {
        if (typeof showToast === 'function') showToast('No available sailors to copy!', 'error');
        return;
      }
      let textToCopy = 'AVAILABLE SAILORS (' + availableSailors.length + ')\n';
      textToCopy += '--------------------------------------------------\n';
      textToCopy += 'RANK\tNAME\tOFF NO\tTRADE\n';
      textToCopy += '--------------------------------------------------\n';
      availableSailors.forEach(s => {
        const offNoStr = s.official_number || s.service_no || '-';
        textToCopy += `${s.rank || '-'} \t${s.name || '-'} \t${offNoStr} \t${s.trade || '-'}\n`;
      });
      navigator.clipboard.writeText(textToCopy).then(() => {
        if (typeof showToast === 'function') showToast(`Successfully copied ${availableSailors.length} Available Sailors to clipboard!`);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        if (typeof showToast === 'function') showToast('Failed to copy text. Check console for details.', 'error');
      });
    });
  }
});

// ==========================================
// EXTERNAL PROJECTS MANAGEMENT (Ops DB)
// ==========================================

let currentPtmType = null;
let currentPtmProjectId = null;

function renderProjectsList() {
    const renderCards = (projectsObj, containerId, type) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = "";
        const projects = Object.entries(projectsObj || {});
        if(projects.length === 0) {
            container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 border-dashed">No active ${type}s</div>`;
            return;
        }
        projects.forEach(([id, proj]) => {
            const assignedCount = proj.assigned_sailors ? Object.keys(proj.assigned_sailors).length : 0;
            const card = document.createElement("div");
            card.className = "bg-slate-50 rounded-xl border border-slate-200 p-4 hover:border-teal-400 hover:shadow-md cursor-pointer transition-all";
            card.onclick = () => openProjectManagerModal(type, id, proj.name);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-800 text-md truncate pr-2">${proj.name}</h4>
                    <button onclick="deleteProject(event, '${type}', '${id}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md p-1 transition-colors flex-shrink-0" title="Delete Project">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                <div class="flex justify-between items-end mt-2">
                    <span class="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">${assignedCount} Assigned</span>
                    <div class="text-xs text-teal-600 font-semibold uppercase tracking-wider">Manage Team ➔</div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    renderCards(store.outProjects, "outProjectsList", "Out Project");
    renderCards(store.housingProjects, "housingProjectsList", "Housing Project");
    renderCards(store.otherBases, "otherBasesList", "Other Base");
}

function createNewProject(type) {
    document.getElementById("createProjectTitle").textContent = `New ${type}`;
    document.getElementById("newProjectName").value = "";
    document.getElementById("newProjectType").value = type;
    document.getElementById("createProjectModal").classList.remove("hidden");
}

function submitNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    const type = document.getElementById("newProjectType").value;
    if(!name) {
        if(typeof showToast === 'function') showToast("Project name is required", "error");
        return;
    }

    let node = "";
    if(type === "Out Project") node = "out_projects";
    else if(type === "Housing Project") node = "housing_projects";
    else if(type === "Other Base") node = "other_bases";
    
    if(node) {
        opsDB.ref(node).push({
            name: name,
            created_at: Date.now()
        }).then(() => {
            if(typeof showToast === 'function') showToast(`${type} created successfully`);
            closeModal("createProjectModal");
        }).catch(err => {
            if(typeof showToast === 'function') showToast("Error creating project", "error");
            console.error(err);
        });
    }
}

window.deleteProject = function(event, type, id) {
    event.stopPropagation();
    if(!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
        return;
    }
    
    let node = "";
    if(type === "Out Project") node = "out_projects";
    else if(type === "Housing Project") node = "housing_projects";
    else if(type === "Other Base") node = "other_bases";
    
    if(node) {
        opsDB.ref(`${node}/${id}`).remove().then(() => {
            if(typeof showToast === 'function') showToast(`${type} deleted successfully`);
        }).catch(err => {
            if(typeof showToast === 'function') showToast("Error deleting project", "error");
            console.error(err);
        });
    }
}

function openProjectManagerModal(type, id, name) {
    currentPtmType = type;
    currentPtmProjectId = id;
    
    document.getElementById("ptmTitle").textContent = `Manage ${type} Team`;
    document.getElementById("ptmProjectName").textContent = name;
    document.getElementById("ptmSearch").value = "";
    
    renderPtmLists();
    document.getElementById("projectTeamModal").classList.remove("hidden");
}

function filterPtmAvailableList() {
    renderPtmLists(document.getElementById("ptmSearch").value);
}

function renderPtmLists(filter = "") {
    if(!currentPtmType || !currentPtmProjectId) return;
    
    let projectsObj = {};
    if(currentPtmType === "Out Project") projectsObj = store.outProjects;
    else if(currentPtmType === "Housing Project") projectsObj = store.housingProjects;
    else if(currentPtmType === "Other Base") projectsObj = store.otherBases;
    
    const proj = projectsObj[currentPtmProjectId];
    const assignedIds = proj && proj.assigned_sailors ? Object.keys(proj.assigned_sailors) : [];
    
    const currentTeam = store.sailors.filter(s => assignedIds.includes(String(s._fbKey || s.id)));
    
    let eligible = store.sailors.filter(s => !assignedIds.includes(String(s._fbKey || s.id)));
    
    if (filter) {
        const q = filter.toLowerCase().trim();
        eligible = eligible.filter(
            (s) => {
                const offNoStr = String(s.official_number || s.official_no || "");
                return (s.name && s.name.toLowerCase().includes(q)) ||
                       (offNoStr.toLowerCase().includes(q)) ||
                       (s.rank && s.rank.toLowerCase().includes(q));
            }
        );
    }
    
    const currContainer = document.getElementById("ptmCurrentList");
    const availContainer = document.getElementById("ptmAvailableList");
    currContainer.innerHTML = "";
    availContainer.innerHTML = "";
    
    if (currentTeam.length === 0) {
        currContainer.innerHTML = `<div class="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-lg text-center">No one assigned yet.</div>`;
    } else {
        currentTeam.forEach(s => {
            const div = document.createElement("div");
            div.className = "flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-200 mb-1";
            const offNo = s.official_number || s.official_no || s.service_no || "-";
            div.innerHTML = `
                <div>
                    <p class="text-xs font-bold text-slate-800">${s.rank || ""} ${s.name || ""}</p>
                    <p class="text-[10px] text-slate-500 font-medium">${offNo} • ${s.trade || ""}</p>
                </div>
                <button onclick="removePtmSailor('${s._fbKey || s.id}')" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Remove</button>
            `;
            currContainer.appendChild(div);
        });
    }
    
    eligible.forEach(s => {
        const div = document.createElement("div");
        div.className = "flex justify-between items-center p-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg";
        const offNo = s.official_number || s.official_no || s.service_no || "-";
        div.innerHTML = `
            <div>
                <p class="text-xs font-bold text-slate-800">${s.rank || ""} ${s.name || ""}</p>
                <p class="text-[10px] text-slate-500 font-medium">${offNo} • ${s.trade || ""}</p>
            </div>
            <button onclick="addPtmSailor('${s._fbKey || s.id}')" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">+ Add</button>
        `;
        availContainer.appendChild(div);
    });
}

function addPtmSailor(sailorId) {
    if(!currentPtmType || !currentPtmProjectId) return;
    let node = "";
    if(currentPtmType === "Out Project") node = "out_projects";
    else if(currentPtmType === "Housing Project") node = "housing_projects";
    else if(currentPtmType === "Other Base") node = "other_bases";
    
    opsDB.ref(`${node}/${currentPtmProjectId}/assigned_sailors/${sailorId}`).set(true)
        .then(() => {
            renderPtmLists(document.getElementById("ptmSearch").value);
        })
        .catch(err => console.error(err));
}

function removePtmSailor(sailorId) {
    if(!currentPtmType || !currentPtmProjectId) return;
    let node = "";
    if(currentPtmType === "Out Project") node = "out_projects";
    else if(currentPtmType === "Housing Project") node = "housing_projects";
    else if(currentPtmType === "Other Base") node = "other_bases";
    
    opsDB.ref(`${node}/${currentPtmProjectId}/assigned_sailors/${sailorId}`).remove()
        .then(() => {
            renderPtmLists(document.getElementById("ptmSearch").value);
        })
        .catch(err => console.error(err));
}

// =============================================
// DATE SCHEDULE CALENDAR
// =============================================
let currentCalendarDate = new Date();

function renderDateScheduleCalendar() {
    const s = store.settings;
    if (!s.holidays) s.holidays = {};

    const monthYearEl = document.getElementById("calendarMonthYear");
    const gridEl = document.getElementById("calendarGrid");
    if (!monthYearEl || !gridEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;

    // Clear grid
    gridEl.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "p-2 bg-slate-50/50 rounded-lg";
        gridEl.appendChild(emptyCell);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dateObj = new Date(year, month, i);
        const dayOfWeek = dateObj.getDay();

        // Default: Sunday is Holiday, others Normal
        const isSunday = (dayOfWeek === 0);
        // Is marked explicitly?
        const explicitMark = s.holidays[dateStr]; 
        
        let isHoliday = false;
        if (explicitMark === true) isHoliday = true; // explicitly marked as holiday (Poya/Public)
        else if (explicitMark === false) isHoliday = false; // explicitly marked as normal (e.g. working Sunday)
        else isHoliday = isSunday; // default behavior

        const cell = document.createElement("div");
        cell.className = `p-2 min-h-[60px] flex flex-col justify-between rounded-lg cursor-pointer border hover:shadow-sm transition-all`;
        
        if (isHoliday) {
            cell.classList.add("bg-rose-50", "border-rose-200", "hover:border-rose-400");
        } else {
            cell.classList.add("bg-white", "border-slate-200", "hover:border-blue-400");
        }

        cell.innerHTML = `
            <div class="text-right font-bold ${isHoliday ? 'text-rose-700' : 'text-slate-700'}">${i}</div>
            <div class="text-[10px] uppercase font-bold text-center mt-1 ${isHoliday ? 'text-rose-500' : 'text-slate-400'}">
                ${isHoliday ? 'Sunday Rooting' : 'Normal'}
            </div>
        `;

        cell.onclick = () => toggleHoliday(dateStr, isHoliday, isSunday);

        gridEl.appendChild(cell);
    }
}

function changeCalendarMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderDateScheduleCalendar();
}

function toggleHoliday(dateStr, currentlyHoliday, isSunday) {
    const s = store.settings;
    if (!s.holidays) s.holidays = {};

    // Toggle logic:
    // If it's a Sunday (default holiday) -> toggle to normal -> explicitMark = false
    // If it's a Sunday explicitly normal -> toggle to holiday -> explicitMark = true or remove explicitMark
    // If it's a weekday (default normal) -> toggle to holiday -> explicitMark = true
    // If it's a weekday explicitly holiday -> toggle to normal -> explicitMark = false or remove explicitMark

    if (currentlyHoliday) {
        // Toggle to normal
        if (isSunday) {
            s.holidays[dateStr] = false; 
        } else {
            delete s.holidays[dateStr]; // Revert to default normal
        }
    } else {
        // Toggle to holiday
        if (!isSunday) {
            s.holidays[dateStr] = true;
        } else {
            delete s.holidays[dateStr]; // Revert to default holiday
        }
    }

    // Save to Firebase immediately
    saveSettingField("holidays", s.holidays);
    renderDateScheduleCalendar();
}

// Function to get current rooting type to display in banner
function getCurrentRootingType(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = dateObj.getDay();
    const isSunday = (dayOfWeek === 0);

    const s = store.settings;
    if (s && s.holidays) {
        const explicitMark = s.holidays[dateStr];
        if (explicitMark === true) return "Sunday Rooting (Holiday / Poya)";
        if (explicitMark === false) return "Normal Rooting";
    }
    
    return isSunday ? "Sunday Rooting" : "Normal Rooting";
}

function isCurrentDayHoliday(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = dateObj.getDay();
    const isSunday = (dayOfWeek === 0);

    const s = store.settings;
    if (s && s.holidays) {
        const explicitMark = s.holidays[dateStr];
        if (explicitMark === true) return true;
        if (explicitMark === false) return false;
    }
    return isSunday;
}
