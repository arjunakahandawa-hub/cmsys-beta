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

// Global In-Memory Store
const mStore = {
  currentZone: localStorage.getItem("ncw_saved_zone") || "A-Zone",
  zones: [...STANDARD_ZONES],
  workOrders: [],
  sailors: [],
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
  populateZoneSelector();

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
      if (mStore.selectedWo) renderSailorQuickPicker();
    });

    // Listen to Attendance / Leave availability
    sailorsDB.ref("availability").on("value", (snap) => {
      mStore.availability = snap.val() || {};
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
      populateZoneSelector();
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

// Populate the Zone / Workshop dropdown dynamically
function populateZoneSelector() {
  const sel = document.getElementById("mZoneSelect");
  if (!sel) return;

  const current = mStore.currentZone || localStorage.getItem("ncw_saved_zone") || "A-Zone";

  const options = mStore.zones.map((z) => {
    const isWorkshop = (z.id || "").includes("Shop") || (z.id || "").includes("Workshop") || (z.id || "") === "Main-Store";
    const icon = isWorkshop ? "🔨" : "📍";
    return `<option value="${z.id}">${icon} ${z.name}</option>`;
  });

  sel.innerHTML = options.join("");
  
  if (mStore.zones.some((z) => isZoneMatch(z.id, current))) {
    const found = mStore.zones.find((z) => isZoneMatch(z.id, current));
    sel.value = found.id;
    mStore.currentZone = found.id;
  } else if (mStore.zones.length > 0) {
    sel.value = mStore.zones[0].id;
    mStore.currentZone = mStore.zones[0].id;
  }
}

// Switch Zone
function onZoneChange(newZone) {
  mStore.currentZone = newZone;
  localStorage.setItem("ncw_saved_zone", newZone);
  renderWorkOrders();
  showToast(`Switched to ${newZone}`, "info");
}

function refreshData(userInitiated = false) {
  renderWorkOrders();
  if (userInitiated) showToast("Data refreshed!");
}

// Check if work order belongs to active date
function isWorkOrderActiveToday(wo) {
  if (!wo) return false;
  const today = getLocalDateString();
  if (wo.status === "Completed") {
    // Only show completed if it was committed or completed today
    return wo.last_commit_date === today || wo.completed_date === today;
  }
  return true;
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
  const today = getLocalDateString();

  // Filter by Zone Match (handling zone_id, zone, or workshop names)
  const filtered = mStore.workOrders.filter((w) => {
    const wZone = w.zone_id || w.zone || w.zoneId || w.location_zone || "";
    const matchZone = isZoneMatch(wZone, currentZone);
    if (!matchZone) return false;
    if (!isWorkOrderActiveToday(w)) return false;

    if (!q) return true;
    const desc = (w.description || "").toLowerCase();
    const ref = (w.reference_no || "").toLowerCase();
    const status = (w.status || "").toLowerCase();
    const type = (w.type || w.assign_type || "").toLowerCase();
    return desc.includes(q) || ref.includes(q) || status.includes(q) || type.includes(q);
  });

  const zoneObj = mStore.zones.find((z) => isZoneMatch(z.id, currentZone));
  const zoneName = zoneObj ? zoneObj.name : currentZone;

  if (titleEl) titleEl.textContent = `${zoneName} Tasks`;
  if (countBadge) countBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">
        <div class="text-3xl mb-1">📋</div>
        <p class="text-xs font-bold text-slate-400">No active work orders in ${zoneName}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">Select another zone/workshop from the top menu or search</p>
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
    const progress = Math.min(100, Math.max(0, parseInt(w.progress) || 0));
    const crewCount = (w.assigned || []).length;
    const isCommittedToday = w.last_commit_date === today;
    const itemType = w.assign_type ? `💼 ${w.assign_type}` : w.type ? `📋 ${w.type}` : "TASK";

    // Status pill colors
    let statusClass = "bg-slate-700/60 text-slate-300 border-slate-600";
    if (w.status === "Active") statusClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    if (w.status === "Pending") statusClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
    if (w.status === "Hold") statusClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    if (w.status === "Completed") statusClass = "bg-blue-500/20 text-blue-300 border-blue-500/40";

    return `
      <div onclick="openWoSheet('${w._fbKey || w.id}')" class="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 active-scale shadow-sm transition-all cursor-pointer space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1 flex-wrap">
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusClass}">${w.status || "Active"}</span>
              <span class="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">${itemType}</span>
              ${w.priority === "Urgent" || w.priority === "High" || w.priority === "Emergency" ? `<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">${w.priority}</span>` : ""}
              ${isCommittedToday ? `<span class="text-[9px] font-bold text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/30">✓ Committed Today</span>` : ""}
            </div>
            <h3 class="text-xs font-bold text-white line-clamp-2 leading-snug">${w.description || "Untitled Work Order"}</h3>
            ${w.reference_no ? `<p class="text-[10px] text-teal-400/80 font-mono mt-0.5">Ref: ${w.reference_no}</p>` : ""}
          </div>
          <span class="text-base text-slate-400 font-bold shrink-0">›</span>
        </div>

        <!-- Progress Bar & Crew Info -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Progress</span>
            <span class="font-black text-teal-300">${progress}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-slate-700/50 text-[10px] text-slate-400">
          <span class="flex items-center gap-1">👥 <strong class="text-slate-200">${crewCount}</strong> sailor(s) assigned</span>
          <span class="text-teal-400 font-bold">Tap to edit details ➔</span>
        </div>
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
function getSailorStatusToday(sailor, currentWo) {
  if (!sailor) {
    return {
      isLocked: false,
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      badgeText: "✓ Available",
      reasonText: "Ready for assignment",
      icon: "✓"
    };
  }

  const today = getLocalDateString();
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
function populateLeaderDropdowns() {
  const inchargeSel = document.getElementById("mWoIncharge");
  const supSel = document.getElementById("mWoSupervisor");
  const artificerSel = document.getElementById("mWoArtificer");
  if (!inchargeSel || !supSel) return;

  const currentInc = inchargeSel.value;
  const currentSup = supSel.value;
  const currentArt = artificerSel ? artificerSel.value : "";

  const options = ['<option value="">-- None --</option>'];
  mStore.sailors.forEach((s) => {
    const status = getSailorStatusToday(s, mStore.selectedWo);
    const lockTag = status.isLocked ? ` [${status.badgeText.replace(/^[^\s]+\s*/, "")}]` : "";
    const off = s.off_no || s.official_number || "";
    const branch = s.trade || s.branch || "";
    const sub = [branch, off].filter(Boolean).join(" • ");
    const subStr = sub ? ` (${sub})` : "";
    const label = `${s.rank || ""} ${s.name || s.id}${subStr}${lockTag}`.trim();
    options.push(`<option value="${s.id}">${label}</option>`);
  });

  inchargeSel.innerHTML = options.join("");
  supSel.innerHTML = options.join("");
  if (artificerSel) artificerSel.innerHTML = options.join("");

  if (currentInc) inchargeSel.value = currentInc;
  if (currentSup) supSel.value = currentSup;
  if (artificerSel && currentArt) artificerSel.value = currentArt;
}

function openWoSheet(woId) {
  const wo = mStore.workOrders.find((w) => String(w._fbKey) === String(woId) || String(w.id) === String(woId));
  if (!wo) return;

  mStore.selectedWo = wo;
  mStore.assignedTemp = Array.isArray(wo.assigned) ? [...wo.assigned] : [];

  document.getElementById("mSheetTitle").textContent = wo.description || "Work Order";
  document.getElementById("mWoDesc").value = wo.description || "";

  const prog = Math.min(100, Math.max(0, parseInt(wo.progress) || 0));
  document.getElementById("mProgressInput").value = prog;
  document.getElementById("mProgressVal").textContent = `${prog}%`;

  document.getElementById("mWoStatus").value = wo.status || "Active";
  document.getElementById("mWoPriority").value = wo.priority || "Routine";

  // Zone selector inside sheet
  const sheetZoneSel = document.getElementById("mWoSheetZone");
  if (sheetZoneSel) {
    sheetZoneSel.innerHTML = mStore.zones.map((z) => `<option value="${z.id}">${z.name}</option>`).join("");
    const curZ = wo.zone_id || wo.zone || mStore.currentZone;
    const matchZ = mStore.zones.find((z) => isZoneMatch(z.id, curZ));
    sheetZoneSel.value = matchZ ? matchZ.id : curZ;
  }

  // Budget and Authority
  if (document.getElementById("mWoAuthority")) document.getElementById("mWoAuthority").value = wo.authority_approval || wo.authority || "";
  if (document.getElementById("mWoBudget")) document.getElementById("mWoBudget").value = wo.budget_allocation || "";
  if (document.getElementById("mWoDuration")) document.getElementById("mWoDuration").value = wo.estimated_duration || "";

  populateLeaderDropdowns();
  if (document.getElementById("mWoIncharge")) document.getElementById("mWoIncharge").value = wo.incharge || "";
  if (document.getElementById("mWoSupervisor")) document.getElementById("mWoSupervisor").value = wo.supervisor || "";
  if (document.getElementById("mWoArtificer")) document.getElementById("mWoArtificer").value = wo.project_artificer || "";

  renderAssignedTags();
  renderSailorQuickPicker();

  const sheet = document.getElementById("mWoSheet");
  if (sheet) sheet.classList.remove("hidden");
}

function closeWoSheet() {
  const sheet = document.getElementById("mWoSheet");
  if (sheet) sheet.classList.add("hidden");
  mStore.selectedWo = null;
}

function onProgressChange(val) {
  const p = parseInt(val) || 0;
  document.getElementById("mProgressInput").value = p;
  document.getElementById("mProgressVal").textContent = `${p}%`;
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
      <span class="inline-flex items-center gap-1 bg-teal-500/20 text-teal-200 border border-teal-500/40 text-xs font-semibold px-2 py-1 rounded-xl">
        <span>${name}</span>
        <button onclick="removeSailorFromSheet('${sid}')" class="text-teal-400 hover:text-rose-400 font-bold px-1 active-scale">✕</button>
      </span>`;
  }).join("");
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

  // 2. Attach live status for today
  let availableCount = 0;
  let lockedCount = 0;

  const evaluated = candidates.map((s) => {
    const status = getSailorStatusToday(s, mStore.selectedWo);
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

  // 5. Render list items
  container.innerHTML = filtered.slice(0, 50).map(({ sailor: s, status }) => {
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

function filterSailorsForAssignment() {
  renderSailorQuickPicker();
}

function addSailorToSheet(sid) {
  const sailor = mStore.sailors.find((s) => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
  if (sailor) {
    const status = getSailorStatusToday(sailor, mStore.selectedWo);
    if (status.isLocked) {
      showLockedSailorAlert(sailor.name || sid, status.badgeText, status.reasonText);
      return;
    }
  }

  const idStr = String(sid);
  if (!mStore.assignedTemp.includes(idStr)) {
    mStore.assignedTemp.push(idStr);
    renderAssignedTags();
    renderSailorQuickPicker();
  }
}

function removeSailorFromSheet(sid) {
  const idStr = String(sid);
  mStore.assignedTemp = mStore.assignedTemp.filter((x) => x !== idStr);
  renderAssignedTags();
  renderSailorQuickPicker();
}

function restoreCrewInSheet() {
  const wo = mStore.selectedWo;
  if (!wo) return;
  if (wo.last_assigned && Array.isArray(wo.last_assigned) && wo.last_assigned.length > 0) {
    mStore.assignedTemp = [...wo.last_assigned];
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

  const desc = document.getElementById("mWoDesc").value.trim() || wo.description;
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

  const targetFbKey = wo._fbKey || wo.id;
  opsDB.ref(`work_orders/${targetFbKey}`).update({
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
  }).then(() => {
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
  const desc = document.getElementById("mWoDesc").value.trim() || wo.description;
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

  const targetFbKey = wo._fbKey || wo.id;

  // Single Consolidated Work Order Update
  opsDB.ref(`work_orders/${targetFbKey}`).update({
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

  // Fast optimistic close & toast
  setTimeout(() => {
    closeWoSheet();
    renderWorkOrders();
    showToast(`✅ ${wo.assigned.length} sailor(s) committed to "${wo.description.substring(0, 20)}…"`, "success");
  }, 40);

  if (btn) {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = `<span>🚀</span> Commit Daily Labour`;
    }, 400);
  }
}

// Start listeners on window load
window.addEventListener("DOMContentLoaded", () => {
  initListeners();
});
