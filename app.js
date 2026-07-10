// =============================================
// PWA SERVICE WORKER REGISTRATION
// =============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('⚓ NCW-PS PWA Service Worker: REGISTERED (', reg.scope, ')'))
            .catch(err => console.error('⚠️ NCW-PS PWA Service Worker: REGISTRATION FAILED:', err));
    });
}

// =============================================
// NCW-PS v2.2 - Naval Civil Works Productivity Suite
// Main Application JavaScript
// =============================================

// =============================================
// DATA STORE
// NOTE: Arrays start empty — Firebase listeners populate them
// Hardcoded fallback data retained as safety defaults
// =============================================
const store = {
    currentZone: 'A-Zone',
    activeProfileType: null,
    activeProfileZone: null,
    currentFilter: 'all',
    currentTrade: 'ALL',
    selectedJobCard: null,
    selectedEstimate: null,
    selectedLocation: null,
    selectedWorkOrder: null,
    isEveningMode: false,
    currentJobCardsTab: 'active',
    currentInventoryCategory: 'all',
    selectedEstimatesForPrint: [],
    // Logged-in user (defaults the "Created By" signature block on estimates)
    currentUser: { name: 'Sanjeewa Bandara', rank: 'PO1 (CE)', serviceNo: 'NRX 12345' },

    // ── Loaded from Firebase DB #1 (ce-admin-panel2025) ──
    sailors: [],

    // ── Loaded from Firebase DB #2 (ncw-ps-operations) ──
    workOrders:          [],
    jobCards:            [],
    jobCardMaterials:    [],
    jobCardLabor:        [],
    inventory:           [],
    locations:           [],
    maintenanceRecords:  [],
    estimates:           [],
    approvedPendingJobs: [],
    dailyAllocations:    [],

    // Static config (not stored in Firebase)
    approvalAuthorities: ['CCED(E)', 'CENA', 'DAC(E)', 'DGCE', 'CCEO(E)'],
    zones: [
        { id: 'A-Zone',        name: 'A-Zone' },
        { id: 'BC-Zone',       name: 'BC-Zone' },
        { id: 'Carpentry-Shop',name: 'Carpentry Shop' },
        { id: 'Welding-Shop',  name: 'Welding Shop' },
    ],
    offChargeDestinations: ['SLNS Tissa', 'SLNS Vijaya', 'SLNS Gemunu', 'SLNS Rangalla',
                            'BC-Zone', 'A-Zone', 'Carpentry-Shop', 'Welding-Shop', 'Public Supply (Town)'],
    tradeStats: {
        'MA': { strength: 8, present: 7, leave: 1, sick: 0 },
        'CA': { strength: 6, present: 5, leave: 0, sick: 1 },
        'PA': { strength: 5, present: 4, leave: 1, sick: 0 },
        'PL': { strength: 4, present: 4, leave: 0, sick: 0 },
        'WE': { strength: 3, present: 3, leave: 0, sick: 0 },
        'RW': { strength: 2, present: 2, leave: 0, sick: 0 },
    }
};

// =============================================
// FIREBASE INTEGRATION LAYER
// DB#1 = sailorsDB  (ce-admin-panel2025)   → READ ONLY
// DB#2 = opsDB      (ncw-ps-operations)    → READ + WRITE
// =============================================

// ── Helper: convert Firebase snapshot object → array with _fbKey ──
function snapshotToArray(snapshot) {
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    if (Array.isArray(val)) {
        return val.map((item, idx) => {
            if (!item) return null;
            return {
                ...item,
                _fbKey: String(idx)
            };
        }).filter(Boolean);
    }
    return Object.entries(val).map(([key, item]) => ({
        ...item,
        _fbKey: key
    }));
}

// ── Helper: generate NCW-PS numeric id from Firebase key ──
let _idCounter = Date.now();
function nextId() { return ++_idCounter; }

// ─────────────────────────────────────────────
// DB #1 LISTENERS — Sailors (READ ONLY)
// Reads from the "sailors" node in ce-admin-panel2025
// Maps Firebase fields → NCW-PS store.sailors format
// ─────────────────────────────────────────────
function initSailorsListener() {
    sailorsDB.ref('sailors').on('value', snapshot => {
        const raw = snapshotToArray(snapshot);
        if (raw.length === 0) {
            console.warn('⚠️ DB#1: sailors node empty or not found — check Firebase structure');
            return;
        }

        // ── Debug: log first sailor's raw keys so we know exact field names ──
        if (raw[0]) {
            console.log('🔍 DB#1 Sailor raw fields:', Object.keys(raw[0]));
            console.log('🔍 DB#1 First sailor sample:', raw[0]);
        }

        store.sailors = raw.map((s, idx) => {
            // ── Resolve Official / Off Number — try every known field name variant ──
            const offNo =
                s.official_number  ??   // official_number
                s.officialNumber   ??   // officialNumber
                s.off_no           ??   // off_no
                s.offNo            ??   // offNo
                s.service_no       ??   // service_no
                s.serviceNo        ??   // serviceNo
                s.reg_no           ??   // reg_no
                s.regNo            ??   // regNo
                s.personal_no      ??   // personal_no
                s.personalNo       ??   // personalNo
                s.army_no          ??   // army_no
                s.navy_no          ??   // navy_no
                s.registration_no  ??   // registration_no
                s.sno              ??   // sno
                s.id_no            ??   // id_no
                null;

            // ── Resolve Name — try variants ──
            const fullName = (
                s.name       ??
                s.fullName   ??
                s.full_name  ??
                ((s.firstName ?? s.first_name ?? '') + ' ' + (s.lastName ?? s.last_name ?? '')).trim()
            ) || 'Unknown';

            // ── Resolve Rank ──
            const rank =
                s.rank      ??
                s.rankName  ??
                s.rank_name ??
                'AB';

            // ── Build search index — concatenate ALL string values from raw object ──
            // This means search works regardless of field name in Firebase
            const _searchIndex = Object.values(s)
                .filter(v => typeof v === 'string' || typeof v === 'number')
                .map(v => String(v).toLowerCase())
                .join(' ');

            return {
                id:              s.id              ?? idx + 1,
                official_number: offNo             ?? `ID/${idx}`,
                name:            fullName,
                rank:            rank,
                trade:           s.trade           ?? s.tradeName  ?? s.trade_name ?? 'MA',
                category:        s.category        ?? s.cat        ?? 'Regular',
                status:          s.status          ?? 'Available',
                attendance:      s.attendance      ?? s.att        ?? 'Present',
                zone_assigned:   s.zone_assigned   ?? s.zone       ?? s.zoneId ?? 'A-Zone',
                avgScore:        parseFloat(s.avgScore ?? s.performance_score ?? s.avg_score ?? 7.0),
                yesterdayScore:  parseFloat(s.yesterdayScore ?? s.avgScore ?? 7.0),
                isZoneTeam:      s.isZoneTeam      ?? s.is_zone_team ?? false,
                yesterdayJob:    s.yesterdayJob    ?? null,
                evaluated:       s.evaluated       ?? false,
                _fbKey:          s._fbKey,
                _searchIndex,     // ← used for search — covers ALL Firebase fields
            };
        });

        console.log(`✅ DB#1: Loaded ${store.sailors.length} sailors`);
        console.log(`   Sample Off No: "${store.sailors[0]?.official_number}"`);

        // Re-render dashboard if visible
        if (!document.getElementById('view-dashboard').classList.contains('hidden')) {
            renderDashboard();
        }

        // Re-render user settings profile if settings page is open
        if (!document.getElementById('view-settings').classList.contains('hidden') && _currentSettingsTab === 'user') {
            switchSettingsTab('user');
        }

        if (typeof populateSignatoryDropdowns === 'function') populateSignatoryDropdowns();
        
    }, error => {
        console.error('❌ DB#1 Sailors listener error:', error);
    });
}

// ─────────────────────────────────────────────
// DB #2 LISTENERS — NCW-PS Operations (READ + WRITE)
// ─────────────────────────────────────────────

function initOpsListeners() {

    // ── Work Orders ──
    opsDB.ref('work_orders').on('value', snapshot => {
        const raw = snapshotToArray(snapshot);
        store.workOrders = raw.map(wo => ({
            ...wo,
            id:       wo.id       ?? wo._fbKey,
            assigned: Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned ?? {}),
        }));
        refreshCurrentView();
        console.log(`📋 DB#2: ${store.workOrders.length} work orders loaded`);
    });

    // ── Job Cards ──
    opsDB.ref('job_cards').on('value', snapshot => {
        store.jobCards = snapshotToArray(snapshot).map(jc => ({
            ...jc, id: jc.id ?? jc._fbKey,
        }));
        refreshCurrentView();
    });

    // ── Job Card Materials ──
    opsDB.ref('job_card_materials').on('value', snapshot => {
        store.jobCardMaterials = snapshotToArray(snapshot).map(m => ({
            ...m, id: m.id ?? m._fbKey,
        }));
        refreshCurrentView();
    });

    // ── Job Card Labor ──
    opsDB.ref('job_card_labor').on('value', snapshot => {
        store.jobCardLabor = snapshotToArray(snapshot).map(l => ({
            ...l, id: l.id ?? l._fbKey,
        }));
        refreshCurrentView();
    });

    // ── Inventory ──
    opsDB.ref('inventory').on('value', snapshot => {
        store.inventory = snapshotToArray(snapshot).map(item => ({
            ...item, id: item.id ?? item._fbKey,
            on_charge_records:  item.on_charge_records  ? Object.values(item.on_charge_records)  : [],
            off_charge_records: item.off_charge_records ? Object.values(item.off_charge_records) : [],
        }));
        refreshCurrentView();
        console.log(`📦 DB#2: ${store.inventory.length} inventory items loaded`);
    });

    // ── Locations ──
    opsDB.ref('locations').on('value', snapshot => {
        store.locations = snapshotToArray(snapshot).map(l => ({
            ...l, id: l.id ?? l._fbKey,
        }));
    });

    // ── Maintenance Records ──
    opsDB.ref('maintenance_records').on('value', snapshot => {
        store.maintenanceRecords = snapshotToArray(snapshot).map(r => ({
            ...r, id: r.id ?? r._fbKey,
        }));
        refreshCurrentView();
    });

    // ── Estimates ──
    opsDB.ref('estimates').on('value', snapshot => {
        store.estimates = snapshotToArray(snapshot).map(e => ({
            ...e,
            id:        e.id ?? e._fbKey,
            materials: e.materials ? Object.values(e.materials) : [],
            labor:     e.labor     ? Object.values(e.labor)     : [],
        }));
        refreshCurrentView();
        console.log(`📐 DB#2: ${store.estimates.length} estimates loaded`);
    });

    // ── Approved Pending Jobs ──
    opsDB.ref('approved_pending_jobs').on('value', snapshot => {
        store.approvedPendingJobs = snapshotToArray(snapshot).map(j => ({
            ...j, id: j.id ?? j._fbKey,
        }));
    });

    // ── Daily Allocations ──
    opsDB.ref('daily_allocations').on('value', snapshot => {
        store.dailyAllocations = snapshotToArray(snapshot);
    });

    console.log('🔥 DB#2: All ops listeners attached');
}

// ─────────────────────────────────────────────
// DB #2 SAVE HELPERS — Write to Firebase DB #2
// ─────────────────────────────────────────────

// Save / update a work order (returns Promise)
function fbSaveWorkOrder(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`work_orders/${_fbKey}`).update(clean);
    }
    return opsDB.ref('work_orders').push({ ...clean, created_at: Date.now() });
}

// Save / update a job card
function fbSaveJobCard(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`job_cards/${_fbKey}`).update(clean);
    }
    return opsDB.ref('job_cards').push({ ...clean, created_at: Date.now() });
}

// Log a material to a job card
function fbSaveJobCardMaterial(data) {
    return opsDB.ref('job_card_materials').push({ ...data, logged_at: Date.now() });
}

// Log labor to a job card
function fbSaveJobCardLabor(data) {
    return opsDB.ref('job_card_labor').push({ ...data, logged_at: Date.now() });
}

// Save / update inventory item
function fbSaveInventoryItem(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`inventory/${_fbKey}`).update(clean);
    }
    return opsDB.ref('inventory').push({ ...clean, date_added: new Date().toISOString().split('T')[0] });
}

// Save / update estimate
function fbSaveEstimate(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`estimates/${_fbKey}`).update(clean);
    }
    return opsDB.ref('estimates').push({ ...clean, created_at: Date.now() });
}

// Save maintenance record
function fbSaveMaintenanceRecord(data) {
    return opsDB.ref('maintenance_records').push({ ...data, created_at: Date.now() });
}

// Save location
function fbSaveLocation(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`locations/${_fbKey}`).update(clean);
    }
    return opsDB.ref('locations').push({ ...clean });
}

// Save daily allocation
function fbSaveDailyAllocation(data) {
    return opsDB.ref('daily_allocations').push({ ...data, assigned_at: Date.now() });
}

// Save approved pending job
function fbSaveApprovedPendingJob(data) {
    const { _fbKey, ...clean } = data;
    if (_fbKey) {
        return opsDB.ref(`approved_pending_jobs/${_fbKey}`).update(clean);
    }
    return opsDB.ref('approved_pending_jobs').push({ ...clean });
}

// Update sailor zone-team status back to DB #1 (if permitted by Firebase rules)
// NOTE: This writes to ce-admin-panel2025 — ensure rules allow it
function fbUpdateSailorZoneTeam(fbKey, isZoneTeam) {
    if (!fbKey) return Promise.resolve();
    return sailorsDB.ref(`sailors/${fbKey}/isZoneTeam`).set(isZoneTeam);
}

// ─────────────────────────────────────────────
// Refresh whichever view tab is currently visible
// ─────────────────────────────────────────────
function refreshCurrentView() {
    const views = ['dashboard','jobcards','inventory','estimates','maintenance','reports'];
    for (const v of views) {
        const el = document.getElementById(`view-${v}`);
        if (el && !el.classList.contains('hidden')) {
            switch(v) {
                case 'dashboard':   renderDashboard();      break;
                case 'jobcards':    renderJobCardsView();   break;
                case 'inventory':   renderInventory();      break;
                case 'estimates':   renderEstimates();      break;
                case 'maintenance': renderMaintenance();    break;
                case 'reports':     renderReports();        break;
            }
            break;
        }
    }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-GB', { 
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
    });
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    
    if (document.getElementById('reportDate')) {
        document.getElementById('reportDate').textContent = now.toLocaleDateString('en-GB');
    }
    
    // Check time for evening mode (18:00 - 20:00)
    const hour = now.getHours();
    const evalBtn = document.getElementById('evalModeBtn');
    
    if (hour >= 18 && hour < 20) {
        if (evalBtn) evalBtn.classList.remove('hidden');
        store.isEveningMode = true;
    } else {
        if (evalBtn) evalBtn.classList.add('hidden');
        store.isEveningMode = false;
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.className = `fixed bottom-4 right-4 ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all z-50`;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function formatCurrency(amount) {
    return 'Rs. ' + parseFloat(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPerformanceColor(score) {
    if (score >= 8) return 'bg-green-500 text-white';
    if (score >= 6) return 'bg-amber-500 text-white';
    if (score >= 4) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
}

function getPerformanceTextColor(score) {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-amber-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
}

// =============================================
// VIEW MANAGEMENT
// =============================================
function switchView(view) {
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    document.querySelectorAll('[id^="tab-"]').forEach(t => {
        t.classList.remove('tab-active');
    });
    const activeTab = document.getElementById(`tab-${view}`);
    if (activeTab) activeTab.classList.add('tab-active');

    // Update bottom nav tabs active styles
    document.querySelectorAll('[id^="mobile-tab-"]').forEach(btn => {
        btn.classList.remove('text-teal-400');
        btn.classList.add('text-slate-400');
    });
    const activeMobileTab = document.getElementById(`mobile-tab-${view}`);
    if (activeMobileTab) {
        activeMobileTab.classList.remove('text-slate-400');
        activeMobileTab.classList.add('text-teal-400');
    }

    switch(view) {
        case 'dashboard': renderDashboard(); break;
        case 'jobcards': renderJobCardsView(); break;
        case 'inventory': renderInventory(); break;
        case 'estimates': renderEstimates(); break;
        case 'maintenance': renderMaintenance(); break;
        case 'reports': renderReports(); break;
        case 'settings': renderSettings(); break;
    }
}

function changeZone() {
    store.currentZone = document.getElementById('zoneSelector').value;
    applySettings();
    // Re-render whichever view is currently visible
    refreshCurrentView();
    showToast(`Switched to ${store.currentZone}`);
}

// =============================================
// DASHBOARD
// =============================================
function renderDashboard() {
    renderAvailableSailors();
    renderWorkOrders();
    renderQuickAssignments();
    renderZoneTeam();
    updateCounters();
    updatePendingEvals();
    updateBoardEmptyState();
    updateDashboardButtons();
}

function updateDashboardButtons() {
    const currentZoneObj = store.zones.find(z => z.id === store.currentZone);
    const zoneName = currentZoneObj ? currentZoneObj.name : '';
    const zoneId = store.currentZone;

    const isAdminStaff = (
        zoneName === 'Admin & Staff Duties' ||
        zoneId === 'Admin & Staff Duties' ||
        zoneId === 'Admin-Staff-Duties' ||
        (zoneName.includes('Admin') && zoneName.includes('Staff'))
    );

    const newAssignBtn = document.getElementById('newAssignBtn');
    const newWorkOrderBtn = document.getElementById('newWorkOrderBtn');

    if (newAssignBtn) {
        newAssignBtn.classList.toggle('hidden', !isAdminStaff);
    }
    if (newWorkOrderBtn) {
        newWorkOrderBtn.classList.toggle('hidden', isAdminStaff);
    }
}

function renderAvailableSailors() {
    const container = document.getElementById('availableSailors');
    // Only Present sailors are assignable; those on Leave/Sick are excluded from the pool
    let sailors = store.sailors.filter(s => s.status === 'Available' && (s.attendance || 'Present') === 'Present');
    
    if (store.currentFilter === 'zone-team') {
        sailors = sailors.filter(s => s.isZoneTeam);
    } else if (store.currentFilter === 'continuation') {
        sailors = sailors.filter(s => s.yesterdayJob !== null);
    }
    
    if (store.currentTrade !== 'ALL') {
        sailors = sailors.filter(s => s.trade === store.currentTrade);
    }
    
    sailors.sort((a, b) => b.avgScore - a.avgScore);
    
    container.innerHTML = sailors.map(sailor => {
        const scoreColor = sailor.avgScore >= 8 ? '#059669' : sailor.avgScore >= 6 ? '#d97706' : '#dc2626';
        const tradeBg = {
            'MA': '#0d9488', 'CA': '#7c3aed', 'PA': '#b45309',
            'PL': '#0891b2', 'WE': '#dc2626', 'RW': '#374151',
            'SW': '#065f46', 'BB': '#1d4ed8', 'AL': '#ec4899'
        }[sailor.trade] || '#475569';
        return `
        <div class="sailor-card rounded-xl p-2.5 hover:shadow-md transition-all border"
            style="background:rgba(255,255,255,0.88);border-color:rgba(255,255,255,0.7);backdrop-filter:blur(6px)"
            draggable="true"
            ondragstart="handleDragStart(event, ${sailor.id})"
            ondragend="handleDragEnd(event)">
            <div class="flex items-center gap-2.5">
                <div class="relative flex-shrink-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style="background:${tradeBg}">${sailor.trade}</div>
                    ${sailor.isZoneTeam ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[8px] shadow">★</span>' : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-xs truncate leading-tight">${sailor.name}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[10px] text-slate-400 mono">${sailor.official_number}</span>
                        <span class="text-[10px] text-slate-400">${sailor.rank}</span>
                        ${sailor.yesterdayJob ? '<span class="text-[9px] bg-purple-100 text-purple-600 px-1 rounded font-medium">↻ Cont</span>' : ''}
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-sm font-extrabold" style="color:${scoreColor}">${sailor.avgScore.toFixed(1)}</div>
                    <div class="text-[9px] text-slate-400 mt-0.5">${sailor.category}</div>
                </div>
            </div>
        </div>
        `;
    }).join('') || '<div class="text-center py-6"><p class="text-slate-400 text-sm">No sailors available</p><p class="text-slate-300 text-xs mt-1">Check attendance status</p></div>';

    document.getElementById('availableBadge').textContent = sailors.length;
}

function renderWorkOrders() {
    const columns = {
        'PROJECT': document.getElementById('projectsColumn'),
        'JOB': document.getElementById('jobsColumn'),
        'TASK': document.getElementById('tasksColumn')
    };

    let projectCount = 0, jobCount = 0, taskCount = 0;

    Object.keys(columns).forEach(type => {
        const orders = store.workOrders.filter(wo => wo.type === type && !wo.assign_type && wo.zone_id === store.currentZone && wo.status !== 'Completed');
        columns[type].innerHTML = orders.map(wo => renderWorkOrderCard(wo)).join('');
        
        const wrapperId = type === 'PROJECT' ? 'projectColumnWrapper' : type === 'JOB' ? 'jobColumnWrapper' : 'taskColumnWrapper';
        const wrapper = document.getElementById(wrapperId);
        if (wrapper) {
            wrapper.classList.toggle('hidden', orders.length === 0);
        }
        
        const activeOrders = orders.filter(o => o.status === 'Active');
        if (type === 'PROJECT') projectCount = activeOrders.length;
        if (type === 'JOB') jobCount = activeOrders.length;
        if (type === 'TASK') taskCount = activeOrders.length;
    });

    document.getElementById('ongoingProjects').textContent = projectCount;
    document.getElementById('ongoingJobs').textContent = jobCount;
    document.getElementById('ongoingTasks').textContent = taskCount;
}

function renderQuickAssignments() {
    const container = document.getElementById('quickAssignmentsList');
    if (!container) return;

    // Filter work orders that have an assign_type and belong to active zone
    const quickOrders = store.workOrders.filter(wo => 
        wo.assign_type && 
        wo.zone_id === store.currentZone && 
        wo.status !== 'Completed'
    );

    const badge = document.getElementById('quickAssignCountBadge');
    if (badge) badge.textContent = `${quickOrders.length} Active`;

    const wrapper = document.getElementById('assignmentColumnWrapper');
    if (wrapper) {
        wrapper.classList.toggle('hidden', quickOrders.length === 0);
    }

    container.innerHTML = quickOrders.map(wo => renderWorkOrderCard(wo)).join('');
}

function updateBoardEmptyState() {
    const projects = store.workOrders.filter(wo => wo.type === 'PROJECT' && !wo.assign_type && wo.zone_id === store.currentZone && wo.status !== 'Completed').length;
    const jobs = store.workOrders.filter(wo => wo.type === 'JOB' && !wo.assign_type && wo.zone_id === store.currentZone && wo.status !== 'Completed').length;
    const tasks = store.workOrders.filter(wo => wo.type === 'TASK' && !wo.assign_type && wo.zone_id === store.currentZone && wo.status !== 'Completed').length;
    const assigns = store.workOrders.filter(wo => wo.assign_type && wo.zone_id === store.currentZone && wo.status !== 'Completed').length;

    const visibleColumns = [];
    if (projects > 0) visibleColumns.push('project');
    if (jobs > 0) visibleColumns.push('job');
    if (tasks > 0) visibleColumns.push('task');
    if (assigns > 0) visibleColumns.push('assignment');

    const visibleCount = visibleColumns.length;
    const emptyState = document.getElementById('boardEmptyState');
    const boardGrid = document.getElementById('boardGridContainer');

    if (emptyState && boardGrid) {
        if (visibleCount === 0) {
            emptyState.classList.remove('hidden');
            boardGrid.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            boardGrid.classList.remove('hidden');

            // Reset classes first
            boardGrid.className = 'grid gap-4';

            // Set grid columns dynamically based on number of active columns
            if (visibleCount === 1) {
                boardGrid.classList.add('grid-cols-1', 'max-w-xl', 'mx-auto');
            } else if (visibleCount === 2) {
                boardGrid.classList.add('grid-cols-1', 'md:grid-cols-2', 'max-w-5xl', 'mx-auto');
            } else if (visibleCount === 3) {
                boardGrid.classList.add('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'max-w-7xl', 'mx-auto');
            } else {
                boardGrid.classList.add('grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-4');
            }
        }
    }
}

function renderWorkOrderCard(wo) {
    const priorityMap = {
        'High':   { bar: '#dc2626', chip: 'priority-high',   icon: '🔴' },
        'Medium': { bar: '#d97706', chip: 'priority-medium', icon: '🟡' },
        'Low':    { bar: '#059669', chip: 'priority-low',    icon: '🟢' },
    };
    const statusMap = {
        'Active':    { stripe: 'work-card-active',                       chip: 'chip-active' },
        'Pending':   { stripe: 'work-card-pending',                      chip: 'chip-pending' },
        'Hold':      { stripe: 'border-l-4 border-slate-400',            chip: 'chip-hold' },
        'Completed': { stripe: 'border-l-4 border-teal-500',             chip: 'chip-completed' },
    };
    // Firebase assigned[] may contain string keys OR numeric IDs — normalise both
    const assignedIds = (wo.assigned || []).map(String);
    const assignedSailors = store.sailors.filter(s =>
        assignedIds.includes(String(s.id)) ||
        assignedIds.includes(String(s._fbKey))
    );
    const progress = wo.progress || 0;
    const pendingEvals = assignedSailors.filter(s => !s.evaluated).length;
    const pm = priorityMap[wo.priority] || priorityMap['Medium'];
    const sm = statusMap[wo.status] || statusMap['Pending'];
    const progressColor = progress >= 75 ? '#059669' : progress >= 40 ? '#0d9488' : '#2563eb';
    const assignTypeBadge = wo.assign_type 
        ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">💼 ${wo.assign_type}</span>`
        : '';
    // Use _fbKey for the click handler (Firebase primary key)
    const woKey = wo._fbKey || wo.id;

    return `
        <div class="work-order-card ${sm.stripe} rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group"
            style="background:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.8);backdrop-filter:blur(6px)"
            onclick="openWorkOrderDetail('${woKey}')"
            ondragover="handleDragOver(event)" ondrop="handleDropOnCard(event, '${woKey}')">

            <!-- Header row -->
            <div class="px-3 pt-3 pb-2 flex items-start justify-between">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${pm.chip}">${pm.icon} ${wo.priority}</span>
                    <span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${sm.chip}">${wo.status}</span>
                    ${assignTypeBadge}
                </div>
                <span class="text-[10px] text-slate-400 mono font-medium flex-shrink-0">${wo.reference_no || '—'}</span>
            </div>

            <div class="px-3 pb-2">
                <h4 class="font-semibold text-slate-800 text-sm leading-snug mb-0.5 group-hover:text-teal-700 transition-colors">${wo.description}</h4>
                <p class="text-[11px] text-slate-500">📍 ${wo.location || 'Location not set'}${wo.sub_location ? ' — ' + wo.sub_location : ''}</p>
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
                ${wo.budget_allocation ? `<span class="font-medium text-slate-600">💰 ${formatCurrency(wo.budget_allocation)}</span>` : ''}
            </div>

            <!-- Assigned sailors -->
            <div class="px-3 pb-3 border-t border-slate-100 pt-2">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[11px] text-slate-500">👷 ${assignedSailors.length} assigned</span>
                    ${store.isEveningMode && pendingEvals > 0
                        ? `<span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold animate-pulse">📝 ${pendingEvals} eval due</span>`
                        : ''}
                </div>
                <div class="flex flex-wrap gap-1" id="assigned-${wo.id}">
                    ${assignedSailors.length > 0
                        ? assignedSailors.slice(0, 4).map(s => `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium
                                ${s.evaluated ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}">
                                ${s.name.split(' ').slice(1,2).join('')}
                                <span class="${getPerformanceColor(s.avgScore)} px-1 rounded-full text-[9px]">${s.avgScore.toFixed(1)}</span>
                            </span>`).join('')
                            + (assignedSailors.length > 4 ? `<span class="text-[10px] text-slate-400 italic">+${assignedSailors.length - 4} more</span>` : '')
                        : '<span class="text-slate-300 text-[11px] italic">Drop sailors here or assign in detail view</span>'}
                </div>
            </div>
        </div>
    `;
}

function renderZoneTeam() {
    const zoneTeamMembers = store.sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone);
    const container = document.getElementById('zoneTeamList');

    const attendanceCfg = {
        'Present': { dot: 'bg-teal-500', text: 'Available',  textColor: 'text-teal-700',  bg: 'rgba(13,148,136,0.07)',  border: 'rgba(13,148,136,0.2)' },
        'Leave':   { dot: 'bg-amber-500', text: 'On Leave',  textColor: 'text-amber-700', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
        'Sick':    { dot: 'bg-rose-500',  text: 'Sick',      textColor: 'text-rose-700',  bg: 'rgba(244,63,94,0.07)',  border: 'rgba(244,63,94,0.2)' },
        'Duty':    { dot: 'bg-blue-500',  text: 'On Duty',   textColor: 'text-blue-700',  bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)' },
    };
    const tradeBg = { 'MA':'#0d9488','CA':'#7c3aed','PA':'#b45309','PL':'#0891b2','WE':'#dc2626','RW':'#374151','SW':'#065f46','BB':'#1d4ed8','AL':'#ec4899' };

    container.innerHTML = zoneTeamMembers.map(s => {
        const att = s.attendance || 'Present';
        const cfg = attendanceCfg[att] || attendanceCfg['Present'];
        const tb = tradeBg[s.trade] || '#475569';
        return `
        <div class="flex items-center justify-between p-2 rounded-xl group transition-all hover:shadow-sm"
            style="background:${cfg.bg};border:1px solid ${cfg.border}">
            <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                    style="background:${tb}">${s.trade}</div>
                <div class="min-w-0">
                    <span class="block text-xs font-semibold text-slate-700 truncate">${s.name.split(' ').slice(1,3).join(' ')}</span>
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
    }).join('') || '<p class="text-center text-xs text-slate-400 py-4">No team members in this zone</p>';

    document.getElementById('zoneTeamBadge').textContent = `${zoneTeamMembers.length}/15`;
    document.getElementById('zoneTeamCount').textContent = zoneTeamMembers.length;
}

// ---- Zone Team add / remove (req 3) ----
function removeFromZoneTeam(sailorId) {
    const sailor = store.sailors.find(s => s.id === sailorId);
    if (sailor) {
        sailor.isZoneTeam = false;
        renderZoneTeam();
        renderAvailableSailors();
        showToast(`${sailor.name} removed from Zone Team`, 'info');
        // syncToFirebase('zone_teams', sailorId, { isZoneTeam: false });
    }
}

function openZoneTeamManager() {
    const eligible = store.sailors.filter(s => !s.isZoneTeam && s.zone_assigned === store.currentZone);
    const current = store.sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone);

    const attLabel = { 'Present':'Available', 'Leave':'On Leave', 'Sick':'Sick', 'Duty':'Duty' };
    const attCls = { 'Present':'text-green-600', 'Leave':'text-amber-600', 'Sick':'text-red-600', 'Duty':'text-blue-600' };

    document.getElementById('ztmCurrentList').innerHTML = current.map(s => `
        <div class="flex items-center justify-between p-2 bg-green-50 rounded-lg">
            <div class="flex items-center gap-2">
                <span class="w-7 h-7 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-bold">${s.trade}</span>
                <div>
                    <p class="text-sm font-medium">${s.name}</p>
                    <p class="text-[11px] ${attCls[s.attendance||'Present']}">${attLabel[s.attendance||'Present']} • ${s.official_number}</p>
                </div>
            </div>
            <button onclick="toggleZoneTeam(${s.id}, false)" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Remove</button>
        </div>
    `).join('') || '<p class="text-center text-xs text-slate-400 py-4">No team members yet</p>';

    document.getElementById('ztmAvailableList').innerHTML = eligible.map(s => `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <div class="flex items-center gap-2">
                <span class="w-7 h-7 bg-slate-500 text-white rounded-full text-xs flex items-center justify-center font-bold">${s.trade}</span>
                <div>
                    <p class="text-sm font-medium">${s.name}</p>
                    <p class="text-[11px] ${attCls[s.attendance||'Present']}">${attLabel[s.attendance||'Present']} • ${s.official_number}</p>
                </div>
            </div>
            <button onclick="toggleZoneTeam(${s.id}, true)" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Add</button>
        </div>
    `).join('') || '<p class="text-center text-xs text-slate-400 py-4">No eligible sailors in this zone</p>';

    document.getElementById('ztmZoneName').textContent = store.currentZone;
    document.getElementById('zoneTeamModal').classList.remove('hidden');
}

function toggleZoneTeam(sailorId, addToTeam) {
    const sailor = store.sailors.find(s => s.id === sailorId);
    if (!sailor) return;
    if (addToTeam) {
        const teamSize = store.sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone).length;
        if (teamSize >= 15) { showToast('Zone Team is full (15 max)', 'error'); return; }
    }
    sailor.isZoneTeam = addToTeam;
    openZoneTeamManager(); // refresh manager lists
    renderZoneTeam();
    renderAvailableSailors();
    showToast(`${sailor.name} ${addToTeam ? 'added to' : 'removed from'} Zone Team`);
}

function updateCounters() {
    const available = store.sailors.filter(s => s.status === 'Available').length;
    const assigned = store.sailors.filter(s => s.status === 'Assigned').length;
    document.getElementById('netForce').textContent = available + assigned;
    document.getElementById('assignedCount').textContent = assigned;
    document.getElementById('availableCount').textContent = available;
}

function updatePendingEvals() {
    const pending = store.sailors.filter(s => s.status === 'Assigned' && !s.evaluated).length;
    document.getElementById('pendingEvals').textContent = pending;
}

// =============================================
// DRAG AND DROP
// =============================================
let draggedSailorId = null;

function handleDragStart(event, sailorId) {
    draggedSailorId = sailorId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDrop(event, type) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
}

function handleDropOnCard(event, workOrderId) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!draggedSailorId) return;

    const sailor = store.sailors.find(s => s.id === draggedSailorId);
    const workOrder = store.workOrders.find(wo => wo.id === workOrderId);

    if (sailor && workOrder && !workOrder.assigned.includes(draggedSailorId)) {
        workOrder.assigned.push(draggedSailorId);
        sailor.status = 'Assigned';
        sailor.evaluated = false;
        renderDashboard();
        showToast(`${sailor.name} assigned to ${workOrder.description.substring(0, 30)}...`);
    }

    draggedSailorId = null;
}

function removeSailorFromOrder(sailorId, workOrderId) {
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId));
    const workOrder = store.workOrders.find(wo => String(wo.id) === String(workOrderId) || String(wo._fbKey) === String(workOrderId));

    if (sailor && workOrder) {
        workOrder.assigned = (workOrder.assigned || []).filter(id => String(id) !== String(sailorId));
        sailor.status = 'Available';
        
        if (window.fbSaveWorkOrder) {
            fbSaveWorkOrder(workOrder).then(() => {
                renderDashboard();
                showToast(`${sailor.name} removed from assignment`);
            });
        } else {
            renderDashboard();
            showToast(`${sailor.name} removed from assignment`);
        }
    }
}

// =============================================
// FILTERS
// =============================================
function filterSailors(filter) {
    store.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('bg-slate-200');
    });
    event.target.classList.remove('bg-slate-200');
    event.target.classList.add('bg-slate-700', 'text-white');
    renderAvailableSailors();
}

function filterTrade(trade) {
    store.currentTrade = trade;
    document.querySelectorAll('.trade-filter').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('bg-slate-200');
    });
    event.target.classList.remove('bg-slate-200');
    event.target.classList.add('bg-slate-700', 'text-white');
    renderAvailableSailors();
}

function searchSailors() {
    const query = document.getElementById('sailorSearch').value.toLowerCase();
    const container = document.getElementById('availableSailors');
    let sailors = store.sailors.filter(s => 
        s.status === 'Available' && 
        (s.name.toLowerCase().includes(query) || s.official_number.toLowerCase().includes(query))
    );
    
    sailors.sort((a, b) => b.avgScore - a.avgScore);
    
    container.innerHTML = sailors.map(sailor => `
        <div class="sailor-card bg-slate-50 border border-slate-200 rounded-lg p-3 hover:shadow-lg transition-all"
            draggable="true" ondragstart="handleDragStart(event, ${sailor.id})" ondragend="handleDragEnd(event)">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center text-xs font-bold">${sailor.trade}</div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-slate-800 text-sm truncate">${sailor.name}</p>
                    <span class="text-xs text-slate-500 mono">${sailor.official_number}</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="performance-badge ${getPerformanceColor(sailor.avgScore)}">${sailor.avgScore.toFixed(1)}</span>
                    <span class="performance-badge bg-slate-200 text-slate-600">${sailor.yesterdayScore?.toFixed(1) || '-'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function continueYesterdayJobs() {
    const continuations = store.sailors.filter(s => s.yesterdayJob !== null && s.status === 'Available');
    continuations.forEach(sailor => {
        const wo = store.workOrders.find(w => w.id === sailor.yesterdayJob);
        if (wo && !wo.assigned.includes(sailor.id)) {
            wo.assigned.push(sailor.id);
            sailor.status = 'Assigned';
            sailor.evaluated = false;
        }
    });
    renderDashboard();
    showToast(`${continuations.length} sailors continued from yesterday's jobs`);
}

// =============================================
// WORK ORDER MANAGEMENT
// =============================================

// Tracks which sailor IDs are selected in the modal
let _woSelectedSailors = new Set();
let _woCurrentTrade = 'ALL';

function openNewWorkOrderModal() {
    // Reset sailor selection
    _woSelectedSailors = new Set();
    _woCurrentTrade = 'ALL';

    // Populate Approved Ref dropdown
    document.getElementById('woApprovedRef').innerHTML = '<option value="">📋 Approved</option>' +
        store.approvedPendingJobs.map(j => `<option value="${j.id}">${j.reference_no}</option>`).join('');

    // Populate Approved Estimates dropdown
    const approvedEstimates = store.estimates.filter(e => e.status === 'Approved' && (!e.zone_id || e.zone_id === store.currentZone));
    document.getElementById('woEstimateSelect').innerHTML = '<option value="">-- Select Approved Estimate (Optional) --</option>' +
        approvedEstimates.map(e => `<option value="${e.id}">${e.estimate_number} - ${e.description} (${formatCurrency(e.total_cost)})</option>`).join('');
    document.getElementById('woEstimateSelect').value = '';

    // Populate Location dropdown
    const uniqueBuildings = [...new Set(store.locations.filter(l => l.zone_id === store.currentZone).map(l => l.building_name))];
    document.getElementById('woLocationSelect').innerHTML = '<option value="">Select Location...</option>' +
        uniqueBuildings.map(name => `<option value="${name}">${name}</option>`).join('');
    document.getElementById('woSubLocation').value = '';

    // Populate In-Charge / Supervisor dropdowns (Off No starts with 'EC')
    const ecSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('EC');
    });
    const ecOptions = '<option value="">Select...</option>' +
        ecSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    document.getElementById('woSupervisor').innerHTML = ecOptions;
    document.getElementById('woIncharge').innerHTML   = ecOptions;

    // Populate Project Artificer dropdown (Off No starts with 'AC')
    const acSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('AC');
    });
    const acOptions = '<option value="">Select...</option>' +
        acSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    document.getElementById('woArtificer').innerHTML = acOptions;

    // Render sailor chips
    renderWoSailorChips();

    // Clear search
    document.getElementById('woSailorSearch').value = '';

    // Reset trade filter UI
    document.querySelectorAll('.wo-trade-btn').forEach(b => {
        b.className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600';
    });
    document.querySelector('.wo-trade-btn').className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white';

    document.getElementById('workOrderModal').classList.remove('hidden');
}

function autofillFromEstimate(estimateId) {
    if (!estimateId) {
        document.getElementById('woBudget').value = '';
        return;
    }
    const est = store.estimates.find(e => String(e.id) === String(estimateId));
    if (est) {
        document.getElementById('woBudget').value = est.total_cost || 0;
        const descInput = document.getElementById('woDescription');
        if (descInput && !descInput.value.trim()) {
            descInput.value = est.description || '';
        }
        const locInput = document.getElementById('woLocationSelect');
        if (locInput && !locInput.value) {
            const matchedLoc = store.locations.find(l => 
                String(l.id) === String(est.location) || 
                (l.building_name + (l.sub_location ? ' - ' + l.sub_location : '')) === est.location
            );
            if (matchedLoc) {
                locInput.value = matchedLoc.building_name;
                document.getElementById('woSubLocation').value = matchedLoc.sub_location || '';
            } else {
                const matchedBuild = store.locations.find(l => l.building_name === est.location);
                if (matchedBuild) {
                    locInput.value = matchedBuild.building_name;
                    document.getElementById('woSubLocation').value = matchedBuild.sub_location || '';
                } else {
                    locInput.value = est.location || '';
                }
            }
        }
    }
}

function renderWoSailorChips(filter = '') {
    const tradeBgMap = {
        'MA':'#0d9488','CA':'#7c3aed','PA':'#b45309','PL':'#0891b2',
        'WE':'#dc2626','RW':'#374151','SW':'#065f46','BB':'#1d4ed8',
        'AL':'#ec4899'
    };

    let sailors = store.sailors.filter(s =>
        (s.attendance === 'Present' || !s.attendance) &&
        (_woCurrentTrade === 'ALL' || s.trade === _woCurrentTrade)
    );

    if (filter) {
        const q = filter.toLowerCase().trim();
        sailors = sailors.filter(s =>
            // _searchIndex covers ALL Firebase string fields — Off No, name, rank, trade, etc.
            (s._searchIndex || '').includes(q) ||
            // Fallbacks for mapped fields
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q)
        );
    }

    const container = document.getElementById('woSailorChips');
    if (sailors.length === 0) {
        container.innerHTML = `
            <div class="w-full py-4 text-center">
                <div style="font-size:28px">🔍</div>
                <p class="text-slate-400 text-xs mt-1">No sailors found for <strong>${filter || _woCurrentTrade}</strong></p>
            </div>`;
        return;
    }

    container.innerHTML = sailors.map(s => {
        const isSelected = _woSelectedSailors.has(String(s.id ?? s._fbKey));
        const tradeBg    = tradeBgMap[s.trade] || '#475569';
        const offNo      = s.official_number || s.officialNumber || s.service_no || '—';
        const fullName   = s.name || 'Unknown';
        const rank       = s.rank || '';

        return `
        <button type="button"
            onclick="toggleWoSailor('${s.id ?? s._fbKey}')"
            title="${rank} ${fullName} | ${offNo}"
            class="sailor-chip-card ${isSelected ? 'selected' : ''}"
            style="
                display:flex; align-items:center; gap:8px;
                padding:7px 10px; border-radius:10px; cursor:pointer;
                border:2px solid ${isSelected ? 'rgba(13,148,136,0.6)' : '#e2e8f0'};
                background:${isSelected ? 'linear-gradient(135deg,rgba(13,148,136,0.12),rgba(8,145,178,0.12))' : '#fff'};
                box-shadow: ${isSelected ? '0 0 0 2px rgba(13,148,136,0.25)' : '0 1px 3px rgba(0,0,0,0.06)'};
                transition:all 0.15s ease; min-width:140px; position:relative;
                text-align:left;
            ">

            <!-- Trade badge -->
            <span style="
                width:32px; height:32px; border-radius:8px;
                background:${isSelected ? '#0d9488' : tradeBg};
                color:white; display:flex; align-items:center; justify-content:center;
                font-size:9px; font-weight:800; flex-shrink:0;
                box-shadow:0 2px 4px ${tradeBg}66;
            ">${s.trade}</span>

            <!-- Name + Off No -->
            <div style="min-width:0; flex:1">
                <div style="
                    font-size:11px; font-weight:700; line-height:1.2;
                    color:${isSelected ? '#0d9488' : '#1e293b'};
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                    max-width:130px;
                ">${rank} ${fullName}</div>
                <div style="font-size:9.5px; color:#94a3b8; font-weight:500; letter-spacing:0.3px">${offNo}</div>
            </div>

            <!-- Checkmark -->
            ${isSelected ? `
            <span style="
                width:18px; height:18px; border-radius:50%;
                background:#0d9488; color:white;
                display:flex; align-items:center; justify-content:center;
                font-size:11px; font-weight:900; flex-shrink:0;
            ">✓</span>` : ''}
        </button>`;
    }).join('');

    // Update counter
    const count = _woSelectedSailors.size;
    document.getElementById('woAssignedCount').textContent = `${count} selected`;

    // Update summary strip — show rank + name + off no
    const summary = document.getElementById('woSelectedSummary');
    if (count > 0) {
        const details = [..._woSelectedSailors].map(id => {
            const s = store.sailors.find(s => String(s.id ?? s._fbKey) === String(id));
            if (!s) return id;
            const offNo = s.official_number || s.service_no || '?';
            return `${s.rank || ''} ${s.name} (${offNo})`;
        }).join(' • ');
        document.getElementById('woSelectedNames').textContent = details;
        summary.classList.remove('hidden');
    } else {
        summary.classList.add('hidden');
    }
}

function toggleWoSailor(sailorId, name) {
    const key = String(sailorId);
    if (_woSelectedSailors.has(key)) {
        _woSelectedSailors.delete(key);
    } else {
        _woSelectedSailors.add(key);
    }
    renderWoSailorChips(document.getElementById('woSailorSearch').value);
}

function filterWoSailors() {
    renderWoSailorChips(document.getElementById('woSailorSearch').value);
}

function filterWoTrade(trade) {
    _woCurrentTrade = trade;
    document.querySelectorAll('.wo-trade-btn').forEach(b => {
        b.className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600';
    });
    event.target.className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white';
    renderWoSailorChips(document.getElementById('woSailorSearch').value);
}

function selectApprovedJob() {
    const selectedId = document.getElementById('woApprovedRef').value;
    if (selectedId) {
        const job = store.approvedPendingJobs.find(j => j.id == selectedId);
        if (job) {
            document.getElementById('woReference').value = job.reference_no;
            document.getElementById('woDescription').value = job.description;
            document.getElementById('woAuthority').value = job.authority || '';
            document.getElementById('woBudget').value = job.estimated_cost || '';
        }
    }
}

function createWorkOrder(event) {
    event.preventDefault();

    const estimateId = document.getElementById('woEstimateSelect').value || null;

    const newOrder = {
        type:               document.getElementById('woType').value,
        reference_no:       document.getElementById('woReference').value || null,
        description:        document.getElementById('woDescription').value,
        status:             'Pending',
        priority:           document.getElementById('woPriority').value,
        zone_id:            store.currentZone,
        estimated_duration: parseInt(document.getElementById('woDuration').value) || 1,
        budget_allocation:  parseFloat(document.getElementById('woBudget').value) || 0,
        progress:           0,
        assigned:           [..._woSelectedSailors],   // ← selected sailors from chip picker
        location:           document.getElementById('woLocationSelect').value || '',
        sub_location:       document.getElementById('woSubLocation').value || '',
        incharge:           document.getElementById('woIncharge').value || null,
        supervisor:         document.getElementById('woSupervisor').value || null,
        project_artificer:  document.getElementById('woArtificer').value || null,
        estimate_id:        estimateId,
    };

    // Mark selected sailors as Assigned in store (optimistic update)
    _woSelectedSailors.forEach(id => {
        const s = store.sailors.find(s => String(s.id ?? s._fbKey) === String(id));
        if (s) { s.status = 'Assigned'; s.evaluated = false; }
    });
    _woSelectedSailors = new Set(); // reset

    // Save Work Order to Firebase DB#2 (realtime listener updates store automatically)
    fbSaveWorkOrder(newOrder).then(ref => {
        const fbKey = ref ? ref.key : null;

        // Also create a Job Card automatically
        const jobNumber = `JC/${new Date().getFullYear()}/${String(Date.now()).slice(-4).padStart(4,'0')}`;
        const newJobCard = {
            job_number:       jobNumber,
            work_order_id:    fbKey,  // link to the Firebase key
            description:      newOrder.description,
            location:         newOrder.location,
            zone_id:          store.currentZone,
            status:           'Active',
            start_date:       new Date().toISOString().split('T')[0],
            total_material_cost: 0,
            feedbackSent:     false,
            feedbackReceived: false,
            estimate_id:      estimateId,
        };
        fbSaveJobCard(newJobCard);

        if (estimateId) {
            const est = store.estimates.find(e => String(e.id) === String(estimateId));
            if (est && est._fbKey) {
                opsDB.ref(`estimates/${est._fbKey}`).update({
                    status: 'Linked',
                    work_order_id: fbKey
                });
            }
        }

        closeModal('workOrderModal');
        showToast(`Work order and Job Card ${jobNumber} created! 🔥`);
        event.target.reset();
    }).catch(err => {
        console.error('❌ Work order save failed:', err);
        showToast('Save failed — check Firebase connection', 'error');
    });
}

// =============================================
// NEW SIMPLIFIED ASSIGNMENT WORKFLOW
// =============================================
let _asSelectedSailors = new Set();
let _asCurrentTrade = 'ALL';

function openNewAssignModal() {
    _asSelectedSailors = new Set();
    _asCurrentTrade = 'ALL';

    // Reset form elements
    document.getElementById('asType').value = 'Admin Staff';
    document.getElementById('asDescription').value = '';

    // Populate In-Charge dropdown (Off No starts with 'EC')
    const ecSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('EC');
    });
    const supOptions = '<option value="">Select...</option>' +
        ecSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    document.getElementById('asIncharge').innerHTML = supOptions;
    document.getElementById('asIncharge').value = '';

    // Render sailor chips
    renderAsSailorChips();

    // Clear search
    document.getElementById('asSailorSearch').value = '';

    // Reset trade filter UI
    document.querySelectorAll('.as-trade-btn').forEach(b => {
        b.className = 'as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600';
    });
    const firstTradeBtn = document.querySelector('.as-trade-btn');
    if (firstTradeBtn) {
        firstTradeBtn.className = 'as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white';
    }

    updateAsPreview();

    document.getElementById('assignModal').classList.remove('hidden');
}

function renderAsSailorChips(filter = '') {
    const tradeBgMap = {
        'MA':'#0d9488','CA':'#7c3aed','PA':'#b45309','PL':'#0891b2',
        'WE':'#dc2626','RW':'#374151','SW':'#065f46','BB':'#1d4ed8',
        'AL':'#ec4899'
    };

    let sailors = store.sailors.filter(s =>
        (s.attendance === 'Present' || !s.attendance) &&
        (_asCurrentTrade === 'ALL' || s.trade === _asCurrentTrade)
    );

    if (filter) {
        const q = filter.toLowerCase().trim();
        sailors = sailors.filter(s =>
            (s._searchIndex || '').includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q)
        );
    }

    const container = document.getElementById('asSailorChips');
    if (sailors.length === 0) {
        container.innerHTML = `
            <div class="w-full py-4 text-center">
                <div style="font-size:28px">🔍</div>
                <p class="text-slate-400 text-xs mt-1">No sailors found for <strong>${filter || _asCurrentTrade}</strong></p>
            </div>`;
        return;
    }

    container.innerHTML = sailors.map(s => {
        const isSelected = _asSelectedSailors.has(String(s.id ?? s._fbKey));
        const tradeBg    = tradeBgMap[s.trade] || '#475569';
        const offNo      = s.official_number || s.officialNumber || s.service_no || '—';
        const fullName   = s.name || 'Unknown';
        const rank       = s.rank || '';

        return `
        <button type="button"
            onclick="toggleAsSailor('${s.id ?? s._fbKey}')"
            title="${rank} ${fullName} | ${offNo}"
            class="sailor-chip-card ${isSelected ? 'selected' : ''}"
            style="
                display:flex; align-items:center; gap:8px;
                padding:7px 10px; border-radius:10px; cursor:pointer;
                border:2px solid ${isSelected ? 'rgba(13,148,136,0.6)' : '#e2e8f0'};
                background:${isSelected ? 'linear-gradient(135deg,rgba(13,148,136,0.12),rgba(8,145,178,0.12))' : '#fff'};
                box-shadow: ${isSelected ? '0 0 0 2px rgba(13,148,136,0.25)' : '0 1px 3px rgba(0,0,0,0.06)'};
                transition:all 0.15s ease; min-width:140px; position:relative;
                text-align:left;
            ">

            <!-- Trade badge -->
            <span style="
                width:32px; height:32px; border-radius:8px;
                background:${isSelected ? '#0d9488' : tradeBg};
                color:white; display:flex; align-items:center; justify-content:center;
                font-size:9px; font-weight:800; flex-shrink:0;
                box-shadow:0 2px 4px ${tradeBg}66;
            ">${s.trade}</span>

            <!-- Name + Off No -->
            <div style="min-width:0; flex:1">
                <div style="
                    font-size:11px; font-weight:700; line-height:1.2;
                    color:${isSelected ? '#0d9488' : '#1e293b'};
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                    max-width:130px;
                ">${rank} ${fullName}</div>
                <div style="font-size:9.5px; color:#94a3b8; font-weight:500; letter-spacing:0.3px">${offNo}</div>
            </div>

            <!-- Checkmark -->
            ${isSelected ? `
            <span style="
                width:18px; height:18px; border-radius:50%;
                background:#0d9488; color:white;
                display:flex; align-items:center; justify-content:center;
                font-size:11px; font-weight:900; flex-shrink:0;
            ">✓</span>` : ''}
        </button>`;
    }).join('');

    // Update counter
    const count = _asSelectedSailors.size;
    document.getElementById('asAssignedCount').textContent = `${count} selected`;

    // Update summary strip
    const summary = document.getElementById('asSelectedSummary');
    if (count > 0) {
        const details = [..._asSelectedSailors].map(id => {
            const s = store.sailors.find(s => String(s.id ?? s._fbKey) === String(id));
            if (!s) return id;
            const offNo = s.official_number || s.service_no || '?';
            return `${s.rank || ''} ${s.name} (${offNo})`;
        }).join(' • ');
        document.getElementById('asSelectedNames').textContent = details;
        summary.classList.remove('hidden');
    } else {
        summary.classList.add('hidden');
    }

    if (typeof updateAsPreview === 'function') {
        updateAsPreview();
    }
}

function updateAsPreview() {
    const type = document.getElementById('asType').value;
    const desc = document.getElementById('asDescription').value;
    const inchargeSelect = document.getElementById('asIncharge');
    const inchargeText = inchargeSelect.options[inchargeSelect.selectedIndex]?.text || 'None';

    const prevTypeElem = document.getElementById('asPrevType');
    if (prevTypeElem) prevTypeElem.textContent = type;

    const prevInchargeElem = document.getElementById('asPrevIncharge');
    if (prevInchargeElem) prevInchargeElem.textContent = inchargeText;

    const prevDescElem = document.getElementById('asPrevDesc');
    if (prevDescElem) prevDescElem.textContent = desc || 'No description entered yet.';

    const prevSailorsContainer = document.getElementById('asPrevSailors');
    if (prevSailorsContainer) {
        if (_asSelectedSailors && _asSelectedSailors.size > 0) {
            const listHtml = [..._asSelectedSailors].map(id => {
                const s = store.sailors.find(s => String(s.id ?? s._fbKey) === String(id));
                if (!s) return '';
                const offNo = s.official_number || s.officialNumber || s.service_no || '—';
                return `<span class="inline-block bg-teal-100 text-teal-800 text-[10px] px-2 py-0.5 rounded font-medium">${s.rank || ''} ${s.name} (${offNo})</span>`;
            }).join('');
            prevSailorsContainer.innerHTML = listHtml;
        } else {
            prevSailorsContainer.innerHTML = '<span class="text-slate-400 text-[10px]">None selected</span>';
        }
    }
}

function toggleAsSailor(sailorId) {
    const key = String(sailorId);
    if (_asSelectedSailors.has(key)) {
        _asSelectedSailors.delete(key);
    } else {
        _asSelectedSailors.add(key);
    }
    renderAsSailorChips(document.getElementById('asSailorSearch').value);
}

function filterAsSailors() {
    renderAsSailorChips(document.getElementById('asSailorSearch').value);
}

function filterAsTrade(trade) {
    _asCurrentTrade = trade;
    document.querySelectorAll('.as-trade-btn').forEach(b => {
        b.className = 'as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600';
    });
    event.target.className = 'as-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white';
    renderAsSailorChips(document.getElementById('asSailorSearch').value);
}

function createAssignment(event) {
    event.preventDefault();

    const assignType = document.getElementById('asType').value;

    const newOrder = {
        type:               'TASK', // Always save as TASK so it lists under Tasks board column
        assign_type:        assignType, // Store specific assignment category
        reference_no:       null,
        description:        document.getElementById('asDescription').value,
        status:             'Pending',
        priority:           'Medium',
        zone_id:            store.currentZone,
        estimated_duration: 1,
        budget_allocation:  0,
        progress:           0,
        assigned:           [..._asSelectedSailors],
        location:           '',
        incharge:           document.getElementById('asIncharge').value || null,
        supervisor:         null,
        estimate_id:        null,
    };

    // Mark selected sailors as Assigned in store (optimistic update)
    _asSelectedSailors.forEach(id => {
        const s = store.sailors.find(s => String(s.id ?? s._fbKey) === String(id));
        if (s) { s.status = 'Assigned'; s.evaluated = false; }
    });
    _asSelectedSailors = new Set(); // reset

    // Save Work Order to Firebase DB#2
    fbSaveWorkOrder(newOrder).then(ref => {
        const fbKey = ref ? ref.key : null;

        // Also create a Job Card automatically
        const jobNumber = `JC/${new Date().getFullYear()}/${String(Date.now()).slice(-4).padStart(4,'0')}`;
        const newJobCard = {
            job_number:       jobNumber,
            work_order_id:    fbKey,
            description:      newOrder.description,
            location:         '',
            zone_id:          store.currentZone,
            status:           'Active',
            start_date:       new Date().toISOString().split('T')[0],
            total_material_cost: 0,
            feedbackSent:     false,
            feedbackReceived: false,
            estimate_id:      null,
        };
        fbSaveJobCard(newJobCard);

        closeModal('assignModal');
        showToast(`Assignment and Job Card ${jobNumber} created! 🔥`);
        event.target.reset();
    }).catch(err => {
        console.error('❌ Assignment save failed:', err);
        showToast('Save failed — check Firebase connection', 'error');
    });
}

// Nominal labour rate (Rs per man-hour) used for Job Card cost roll-up
const LABOR_RATE_PER_HOUR = 150;

function getJobCardForWorkOrder(workOrderId) {
    return store.jobCards.find(jc => jc.work_order_id === workOrderId) || null;
}

function computeJobCardCost(jobCard) {
    if (!jobCard) return { material: 0, labor: 0, total: 0 };
    const material = store.jobCardMaterials
        .filter(m => m.job_card_id === jobCard.id)
        .reduce((s, m) => s + (m.total_cost || 0), 0) || jobCard.total_material_cost || 0;
    const laborHours = store.jobCardLabor
        .filter(l => l.job_card_id === jobCard.id)
        .reduce((s, l) => s + (l.hours || 0), 0);
    const labor = laborHours * LABOR_RATE_PER_HOUR;
    return { material, labor, total: material + labor };
}

function switchWoTab(tab) {
    document.querySelectorAll('.wo-tab-btn').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    const btn = document.getElementById(`woTab-${tab}-btn`);
    btn.classList.add('border-blue-600', 'text-blue-600');
    btn.classList.remove('border-transparent', 'text-slate-500');
    document.getElementById('woTab-details').classList.toggle('hidden', tab !== 'details');
    document.getElementById('woTab-evaluation').classList.toggle('hidden', tab !== 'evaluation');
}

function openWorkOrderDetail(workOrderId) {
    store.selectedWorkOrder = workOrderId;
    // Find by _fbKey (string) OR numeric id
    const wo = store.workOrders.find(w =>
        String(w._fbKey) === String(workOrderId) ||
        String(w.id)     === String(workOrderId)
    );
    if (!wo) { console.warn('Work order not found:', workOrderId); return; }

    // Normalise assigned[] to strings for consistent comparison
    const assignedIds = (wo.assigned || []).map(String);

    // Reset to details tab each open
    switchWoTab('details');

    document.getElementById('woDetailId').value = wo.id;
    document.getElementById('woDetailTitle').textContent = wo.description;
    document.getElementById('woDetailRef').textContent = ((wo.assign_type || wo.type) + ' • ' + (wo.reference_no || 'No reference'));
    document.getElementById('woDetailStatus').value = wo.status;
    document.getElementById('woDetailPriority').value = wo.priority || 'Medium';
    document.getElementById('woDetailDescription').value = wo.description || '';
    document.getElementById('woDetailAuthority').value = wo.authority_approval || wo.authority || '';
    document.getElementById('woDetailBudget').value = wo.budget_allocation || '';
    document.getElementById('woDetailDuration').value = wo.estimated_duration || '';
    document.getElementById('woDetailProgress').value = wo.progress || 0;
    document.getElementById('woDetailProgressText').textContent = (wo.progress || 0) + '%';
    
    if(typeof toggleCompleteButton === 'function') toggleCompleteButton(wo.progress || 0);

    // Live Job Card cost (req 2)
    const jc = getJobCardForWorkOrder(wo.id);
    const cost = computeJobCardCost(jc);
    document.getElementById('woJobCardNo').textContent = jc ? jc.job_number : 'No linked job card';
    document.getElementById('woJobCardCost').textContent = formatCurrency(cost.total);
    // Load assignable sailors (exclude already assigned)
    if (typeof renderDetailSailorChips === 'function') {
        renderDetailSailorChips();
    }
    
    // Supervisor and Incharge dropdowns (Off No starts with 'EC')
    const ecSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('EC');
    });
    document.getElementById('woDetailIncharge').innerHTML = '<option value="">Select...</option>' +
        ecSailors.map(s => `<option value="${s.id}" ${wo.incharge == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    document.getElementById('woDetailSupervisor').innerHTML = '<option value="">Select...</option>' +
        ecSailors.map(s => `<option value="${s.id}" ${wo.supervisor == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');

    // Project Artificer dropdown (Off No starts with 'AC')
    const acSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('AC');
    });
    document.getElementById('woDetailArtificer').innerHTML = '<option value="">Select...</option>' +
        acSailors.map(s => `<option value="${s.id}" ${wo.project_artificer == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');

    if (typeof renderDetailSailorChips === 'function') { renderDetailSailorChips(); }

    // Assigned labour list
    const assignedSailors = store.sailors.filter(s =>
        assignedIds.includes(String(s.id)) ||
        assignedIds.includes(String(s._fbKey))
    );
    document.getElementById('assignedLaborCount').textContent = `${assignedSailors.length} assigned`;
    document.getElementById('woDetailAssigned').innerHTML = assignedSailors.map(s => `
        <div class="flex items-center justify-between p-2 bg-white rounded-lg border">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${s.trade}</span>
                <div>
                    <p class="font-medium text-sm">${s.name}</p>
                    <div class="flex gap-2 text-xs">
                        <span class="text-slate-500">Avg: <span class="${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span></span>
                        <span class="text-slate-500">Yesterday: <span class="${getPerformanceTextColor(s.yesterdayScore)}">${s.yesterdayScore?.toFixed(1) || '-'}</span></span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${s.evaluated ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Evaluated</span>' : '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending</span>'}
                <button onclick="removeSailorFromOrder('${s.id}', '${wo._fbKey || wo.id}'); openWorkOrderDetail('${wo._fbKey || wo.id}');" class="text-red-500 hover:text-red-700 text-lg">×</button>
            </div>
        </div>
    `).join('') || '<p class="text-slate-500 text-center py-4">No labour assigned</p>';

    // Evaluation tab list (always available - req 1)
    const pendingEvals = assignedSailors.filter(s => !s.evaluated).length;
    const evalBadge = document.getElementById('woEvalPendingBadge');
    if (pendingEvals > 0) { evalBadge.textContent = pendingEvals + ' pending'; evalBadge.classList.remove('hidden'); }
    else { evalBadge.classList.add('hidden'); }

    document.getElementById('laborEvalList').innerHTML = assignedSailors.length ? assignedSailors.map(s => `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg border ${s.evaluated ? 'border-green-300' : 'border-amber-300'}">
            <div class="flex items-center gap-3">
                <span class="w-10 h-10 bg-slate-600 text-white rounded-full flex items-center justify-center font-bold">${s.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>
                <div>
                    <p class="font-medium">${s.name}</p>
                    <p class="text-xs text-slate-500">${s.trade} • ${s.rank} • Avg ${s.avgScore.toFixed(1)}</p>
                </div>
            </div>
            ${s.evaluated ?
                `<div class="flex items-center gap-2">
                    <span class="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm">✓ ${s.yesterdayScore?.toFixed(1) || ''}</span>
                    <button onclick="openEvaluationModal('${s.id ?? s._fbKey}', '${wo.id ?? wo._fbKey}')" class="text-xs text-blue-600 underline">Re-evaluate</button>
                </div>` :
                `<button onclick="openEvaluationModal('${s.id ?? s._fbKey}', '${wo.id ?? wo._fbKey}')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm">📝 Evaluate</button>`
            }
        </div>
    `).join('') : '<p class="text-slate-500 text-center py-6">No labour assigned to evaluate. Assign labour in the Details tab first.</p>';

    document.getElementById('workOrderDetailModal').classList.remove('hidden');
}

let _detailCurrentTrade = 'ALL';

function filterDetailTrade(trade) {
    _detailCurrentTrade = trade;
    document.querySelectorAll('.detail-trade-btn').forEach(b => {
        if (b.textContent === trade) {
            b.classList.remove('bg-slate-200', 'text-slate-600');
            b.classList.add('bg-slate-700', 'text-white');
        } else {
            b.classList.add('bg-slate-200', 'text-slate-600');
            b.classList.remove('bg-slate-700', 'text-white');
        }
    });
    renderDetailSailorChips(document.getElementById('detailSailorSearch').value);
}

function filterDetailSailors() {
    renderDetailSailorChips(document.getElementById('detailSailorSearch').value);
}

function renderDetailSailorChips(filter = '') {
    const tradeBgMap = {
        'MA':'#0d9488','CA':'#7c3aed','PA':'#b45309','PL':'#0891b2',
        'WE':'#dc2626','RW':'#374151','SW':'#065f46','BB':'#1d4ed8',
        'AL':'#ec4899'
    };

    const wo = store.workOrders.find(w => String(w.id) === String(store.selectedWorkOrder) || String(w._fbKey) === String(store.selectedWorkOrder));
    if (!wo) return;
    const assignedIds = (wo.assigned || []).map(String);

    let sailors = store.sailors.filter(s => 
        !assignedIds.includes(String(s.id)) && !assignedIds.includes(String(s._fbKey)) &&
        s.status !== 'Assigned' && 
        (_detailCurrentTrade === 'ALL' || s.trade === _detailCurrentTrade)
    );

    if (filter) {
        const q = filter.toLowerCase().trim();
        sailors = sailors.filter(s =>
            (s._searchIndex || '').includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q)
        );
    }

    const container = document.getElementById('detailSailorChips');
    if (sailors.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-xs w-full text-center py-2">No available sailors found</p>`;
        return;
    }

    container.innerHTML = sailors.map(s => {
        const tradeBg    = tradeBgMap[s.trade] || '#475569';
        const offNo      = s.official_number || s.officialNumber || s.service_no || '-';
        const fullName   = s.name || 'Unknown';
        const rank       = s.rank || '';

        return `
        <button type="button"
            onclick="assignSingleLabor('${s.id ?? s._fbKey}')"
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
    }).join('');
}

function assignSingleLabor(sailorId) {
    const wo = store.workOrders.find(w => String(w.id) === String(store.selectedWorkOrder) || String(w._fbKey) === String(store.selectedWorkOrder));
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    
    if (wo && sailor) {
        if (!wo.assigned) wo.assigned = [];
        
        const alreadyAssigned = wo.assigned.some(id => String(id) === String(sailorId));
        if (!alreadyAssigned) {
            wo.assigned.push(sailorId);
            sailor.status = 'Assigned';
            sailor.evaluated = false;
            
            if (typeof fbSaveWorkOrder === 'function') {
                fbSaveWorkOrder(wo);
            }
            
            showToast(`${sailor.name} assigned`);
            openWorkOrderDetail(wo._fbKey || wo.id);
        }
    }
}

function updateWorkOrderStatus() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo) {
        wo.status = document.getElementById('woDetailStatus').value;
        
        // Sync status to the linked Job Card
        const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
        if (jc) {
            jc.status = wo.status;
            if (window.fbSaveJobCard) fbSaveJobCard(jc);
        }

        if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);

        renderDashboard();
    }
}

function saveWorkOrderChanges() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo) {
        wo.status = document.getElementById('woDetailStatus').value;
        wo.priority = document.getElementById('woDetailPriority').value;
        wo.description = document.getElementById('woDetailDescription').value || wo.description;
        wo.authority_approval = document.getElementById('woDetailAuthority').value;
        wo.budget_allocation = parseFloat(document.getElementById('woDetailBudget').value) || wo.budget_allocation;
        wo.estimated_duration = parseInt(document.getElementById('woDetailDuration').value) || wo.estimated_duration;
        wo.progress = parseInt(document.getElementById('woDetailProgress').value);
        wo.incharge = document.getElementById('woDetailIncharge').value || null;
        wo.supervisor = document.getElementById('woDetailSupervisor').value || null;
        wo.project_artificer = document.getElementById('woDetailArtificer').value || null;

        // Sync status to the linked Job Card
        const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
        if (jc) {
            jc.status = wo.status;
            if (window.fbSaveJobCard) fbSaveJobCard(jc);
        }

        if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);

        renderDashboard();
        showToast('Work order updated successfully!');
        // syncToFirebase('work_orders', wo.id, wo);
    }
}

function toggleCompleteButton(progress) {
    const btn = document.getElementById('btnForwardComplete');
    const btnProceed = document.getElementById('btnProceedWo');
    if (btn && btnProceed) {
        if (parseInt(progress) === 100) {
            btn.classList.remove('hidden');
            btnProceed.classList.add('hidden');
        } else {
            btn.classList.add('hidden');
            btnProceed.classList.remove('hidden');
        }
    }
}

function forwardToComplete() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo) {
        wo.status = 'Completed';
        wo.progress = 100;
        
        // Sync to Job Card
        const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
        if (jc) {
            jc.status = 'Completed';
            if (window.fbSaveJobCard) fbSaveJobCard(jc);
        }
        
        if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);
        
        closeModal('workOrderDetailModal');
        showToast('Moved to Recently Completed!');
        
        // Update dashboard UI to hide it
        renderDashboard();

        // Switch to Job Cards view and Completed tab
        switchView('jobcards');
        switchJobCardsTab('completed');
    }
}

// Proceed button (req 2): commit daily labour allocation -> dashboard + DB
function proceedWorkOrder() {
    const wo = store.workOrders.find(w => w.id === store.selectedWorkOrder);
    if (!wo) return;

    // Save any pending field edits first
    saveWorkOrderChanges();

    if (wo.assigned.length === 0) {
        showToast('Assign at least one sailor before proceeding', 'error');
        return;
    }

    // Activate the work order and write today's allocations
    wo.status = 'Active';
    const today = new Date().toISOString().split('T')[0];

    wo.assigned.forEach(sid => {
        const sailor = store.sailors.find(s => s.id === sid);
        // remove existing same-day allocation for this sailor (one job per day)
        store.dailyAllocations = store.dailyAllocations.filter(a => !(a.date === today && a.sailor_id === sid));
        const alloc = {
            id: store.dailyAllocations.length + 1,
            date: today,
            sailor_id: sid,
            work_order_id: wo.id,
            role_today: (sailor && sailor.id == wo.supervisor) ? 'Supervisor' : (sailor && sailor.id == wo.incharge) ? 'In-Charge' : 'Worker',
            assigned_by: store.currentUser.name,
            status: 'Active'
        };
        store.dailyAllocations.push(alloc);
        if (sailor) { sailor.status = 'Assigned'; sailor.evaluated = false; }
        // syncToFirebase('daily_allocations', `${today}_${sid}`, alloc);
    });

    closeModal('workOrderDetailModal');
    renderDashboard();
    showToast(`✅ ${wo.assigned.length} sailor(s) committed to "${wo.description.substring(0,28)}…" for ${today}`);
}

function toggleEvaluationMode() {
    showToast('Open any work order and use the Daily Evaluation tab', 'info');
}

// =============================================
// EVALUATION
// =============================================
function openEvaluationModal(sailorId, workOrderId) {
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    const wo = store.workOrders.find(w => String(w.id) === String(workOrderId) || String(w._fbKey) === String(workOrderId));
    
    if (!sailor || !wo) return;
    
    document.getElementById('evalSailorId').value = sailorId;
    document.getElementById('evalWorkOrderId').value = workOrderId;
    document.getElementById('evalSailorName').textContent = sailor.name;
    document.getElementById('evalSailorInitial').textContent = sailor.name.split(' ').map(n => n[0]).slice(0,2).join('');
    document.getElementById('evalWorkOrder').textContent = wo.description;
    document.getElementById('evalAvgScore').textContent = sailor.avgScore.toFixed(1);
    document.getElementById('evalYestScore').textContent = sailor.yesterdayScore?.toFixed(1) || '-';
    
    // Reset sliders
    ['quality', 'efficiency', 'discipline', 'material', 'attitude', 'skill'].forEach(type => {
        document.getElementById(`${type}Score`).value = 5;
        document.getElementById(`${type}Value`).textContent = 5;
    });
    
    document.getElementById('evaluationModal').classList.remove('hidden');
}

function updateSlider(type) {
    const value = document.getElementById(`${type}Score`).value;
    const display = document.getElementById(`${type}Value`);
    display.textContent = value;
    
    if (value <= 3) display.className = 'text-lg font-bold text-red-600';
    else if (value <= 6) display.className = 'text-lg font-bold text-amber-600';
    else display.className = 'text-lg font-bold text-green-600';
    
    // Check for special scores
    const allScores = ['quality', 'efficiency', 'discipline', 'material', 'attitude', 'skill']
        .map(t => parseInt(document.getElementById(`${t}Score`).value));
    
    const has1 = allScores.includes(1);
    const has2 = allScores.includes(2);
    const has10 = allScores.includes(10);
    
    document.getElementById('specialScoreReasons').classList.toggle('hidden', !has1 && !has2 && !has10);
    document.getElementById('score1Box').classList.toggle('hidden', !has1);
    document.getElementById('score2Box').classList.toggle('hidden', !has2);
    document.getElementById('score10Box').classList.toggle('hidden', !has10);
}

function submitEvaluation(event) {
    event.preventDefault();
    
    const scores = ['quality', 'efficiency', 'discipline', 'material', 'attitude', 'skill']
        .map(t => parseInt(document.getElementById(`${t}Score`).value));
    
    // Validate required reasons
    if (scores.includes(1) && !document.getElementById('score1Reason').value) {
        showToast('Reason required for score 1', 'error');
        return;
    }
    if (scores.includes(2) && !document.getElementById('score2Reason').value) {
        showToast('Reason required for score 2', 'error');
        return;
    }
    if (scores.includes(10) && !document.getElementById('score10Reason').value) {
        showToast('Reason required for score 10', 'error');
        return;
    }
    
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length);
    const sailorId = document.getElementById('evalSailorId').value;
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    
    if (sailor) {
        sailor.yesterdayScore = avgScore;
        sailor.avgScore = ((sailor.avgScore * 10) + avgScore) / 11; // Rolling average
        sailor.evaluated = true;
        
        // Persist to sailorsDB
        if (typeof sailorsDB !== 'undefined') {
            sailorsDB.ref('sailors/' + (sailor._fbKey || sailor.id)).update({
                yesterdayScore: sailor.yesterdayScore,
                avgScore: sailor.avgScore,
                evaluated: sailor.evaluated
            }).catch(e => console.warn('Could not save sailor evaluation to DB:', e));
        }
    }
    
    closeModal('evaluationModal');
    openWorkOrderDetail(store.selectedWorkOrder);
    switchWoTab('evaluation');
    updatePendingEvals();
    showToast(`Evaluation submitted! Score: ${avgScore.toFixed(1)}/10`);
}

// =============================================
// JOB CARDS
// =============================================
function renderJobCardsView() {
    renderJobCardsList();
}

function switchJobCardsTab(tab) {
    store.currentJobCardsTab = tab;
    document.querySelectorAll('.jc-main-tab').forEach(t => {
        t.classList.remove('border-green-600', 'text-green-600', 'bg-green-50');
        t.classList.add('text-slate-500');
    });
    event.target.classList.remove('text-slate-500');
    event.target.classList.add('border-green-600', 'text-green-600', 'bg-green-50', 'border-b-2');
    
    renderJobCardsList();
}

function renderJobCardsList() {
    const container = document.getElementById('jobCardsList');
    let jobCards = [];
    let title = 'Active Job Cards';
    
    switch(store.currentJobCardsTab) {
        case 'active':
            jobCards = store.jobCards.filter(jc => jc.status === 'Active' && jc.zone_id === store.currentZone);
            title = 'Active Job Cards';
            break;
        case 'completed':
            jobCards = store.jobCards.filter(jc => jc.status === 'Completed' && !jc.feedbackReceived && jc.zone_id === store.currentZone);
            title = 'Recently Completed (Awaiting Feedback)';
            break;
        case 'records':
            jobCards = store.jobCards.filter(jc => jc.status === 'Completed' && jc.feedbackReceived && jc.zone_id === store.currentZone);
            title = 'Completed Records (With Feedback)';
            break;
    }
    
    document.getElementById('jobCardsListTitle').textContent = title;
    
    container.innerHTML = jobCards.map(jc => `
        <div class="p-4 hover:bg-slate-50 cursor-pointer ${String(store.selectedJobCard) === String(jc.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''}"
            onclick="selectJobCard('${jc._fbKey || jc.id}')">
            <div class="flex items-center justify-between mb-1">
                <span class="font-mono text-sm font-medium text-blue-600">${jc.job_number}</span>
                <span class="text-xs px-2 py-0.5 rounded ${jc.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}">${jc.status}</span>
            </div>
            <p class="text-sm text-slate-700 truncate">${jc.description}</p>
            <div class="flex justify-between mt-2 text-xs text-slate-500">
                <span>📍 ${jc.location}</span>
                <span class="font-medium text-amber-600">${formatCurrency(jc.total_material_cost)}</span>
            </div>
            ${jc.estimate_id ? (() => {
                const est = store.estimates.find(e => String(e.id) === String(jc.estimate_id));
                return est ? `
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-semibold">📄 Estimate: ${est.estimate_number}</span>
                    <span class="text-[10px] text-slate-500 font-semibold">Est: ${formatCurrency(est.total_cost)}</span>
                </div>` : '';
            })() : ''}
            ${jc.status === 'Completed' && !jc.feedbackReceived ? `
                <div class="mt-2 pt-2 border-t border-slate-100">
                    <span class="text-xs ${jc.feedbackSent ? 'text-amber-600' : 'text-slate-400'}">
                        ${jc.feedbackSent ? '📤 Feedback link sent' : '📋 Feedback pending'}
                    </span>
                </div>
            ` : ''}
            ${jc.feedbackReceived ? `
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                    <span class="text-xs text-green-600">✓ Feedback received</span>
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">${jc.feedback?.overall?.toFixed(1) || '-'}/5</span>
                </div>
            ` : ''}
        </div>
    `).join('') || '<p class="text-slate-500 text-center py-8">No job cards in this category</p>';
}

function selectJobCard(id) {
    store.selectedJobCard = id;
    const jc = store.jobCards.find(j => String(j.id) === String(id) || String(j._fbKey) === String(id));
    if (!jc) return;
    
    document.getElementById('selectedJobNumber').textContent = jc.job_number;
    document.getElementById('selectedJobDesc').textContent = jc.description;

    const estContainer = document.getElementById('selectedJobEstimateContainer');
    const estNoEl = document.getElementById('selectedJobEstimateNo');
    if (estContainer && estNoEl) {
        if (jc.estimate_id) {
            const est = store.estimates.find(e => String(e.id) === String(jc.estimate_id));
            if (est) {
                estNoEl.textContent = `${est.estimate_number} - ${est.description} (${formatCurrency(est.total_cost)})`;
                estContainer.classList.remove('hidden');
            } else {
                estContainer.classList.add('hidden');
            }
        } else {
            estContainer.classList.add('hidden');
        }
    }
    
    // Calculate total material cost
    const materials = store.jobCardMaterials.filter(m => String(m.job_card_id) === String(id));
    const totalCost = materials.reduce((sum, m) => sum + m.total_cost, 0);
    document.getElementById('totalMaterialCost').textContent = formatCurrency(totalCost);
    
    // Show/hide add material button based on status
    document.getElementById('addMaterialBtn').style.display = jc.status === 'Active' ? 'block' : 'none';
    
    // Show feedback tab for completed jobs
    document.getElementById('feedbackTabBtn').style.display = jc.status === 'Completed' ? 'block' : 'none';
    
    renderJobCardMaterials(id);
    renderJobCardLabor(id);
    renderJobCardSummary(id);
    renderJobCardFeedback(id);
    renderJobCardsList();
    
    // Switch to materials tab
    switchJobCardTab('materials');
}

function renderJobCardMaterials(jobCardId) {
    const materials = store.jobCardMaterials.filter(m => String(m.job_card_id) === String(jobCardId));
    const container = document.getElementById('jobCardMaterials');
    const total = materials.reduce((sum, m) => sum + m.total_cost, 0);
    
    container.innerHTML = materials.map(m => {
        const dateStr = typeof m.logged_at === 'number' ? new Date(m.logged_at).toISOString().split('T')[0] : (m.logged_at || '-');
        return `
        <tr>
            <td class="px-4 py-2 text-slate-600">${dateStr}</td>
            <td class="px-4 py-2 font-medium">${m.material_name}</td>
            <td class="px-4 py-2 text-center">${m.quantity}</td>
            <td class="px-4 py-2 text-center">${m.unit}</td>
            <td class="px-4 py-2 text-right">${formatCurrency(m.cost_per_unit)}</td>
            <td class="px-4 py-2 text-right font-medium text-green-600">${formatCurrency(m.total_cost)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No materials logged</td></tr>';
    
    document.getElementById('materialsTotalFooter').textContent = formatCurrency(total);
}

function renderJobCardLabor(jobCardId) {
    let laborHtml = '';
    const labor = store.jobCardLabor.filter(l => String(l.job_card_id) === String(jobCardId));
    
    if (labor.length > 0) {
        laborHtml = labor.map(l => {
            const sailor = store.sailors.find(s => s.id === l.sailor_id);
            return `
                <tr>
                    <td class="px-4 py-2 text-slate-600">${l.work_date}</td>
                    <td class="px-4 py-2 font-medium">${sailor?.name || 'Unknown'}</td>
                    <td class="px-4 py-2 text-center"><span class="bg-slate-100 px-2 py-0.5 rounded text-xs">${sailor?.trade || '-'}</span></td>
                    <td class="px-4 py-2 text-center">${l.role}</td>
                    <td class="px-4 py-2 text-center">${l.hours}h</td>
                    <td class="px-4 py-2 text-center"><span class="performance-badge ${getPerformanceColor(l.performance)}">${l.performance.toFixed(1)}</span></td>
                </tr>
            `;
        }).join('');
    } else {
        // Fallback: show assigned sailors from Work Order
        const jc = store.jobCards.find(j => String(j.id) === String(jobCardId) || String(j._fbKey) === String(jobCardId));
        const wo = jc ? store.workOrders.find(w => String(w._fbKey) === String(jc.work_order_id) || String(w.id) === String(jc.work_order_id)) : null;
        
        if (wo && wo.assigned && wo.assigned.length > 0) {
            laborHtml = wo.assigned.map(sid => {
                const sailor = store.sailors.find(s => String(s.id) === String(sid));
                return `
                    <tr class="bg-blue-50/30">
                        <td class="px-4 py-2 text-slate-400 italic">Assigned</td>
                        <td class="px-4 py-2 font-medium text-blue-800">${sailor?.name || 'Unknown'}</td>
                        <td class="px-4 py-2 text-center"><span class="bg-slate-100 px-2 py-0.5 rounded text-xs">${sailor?.trade || '-'}</span></td>
                        <td class="px-4 py-2 text-center text-slate-500">Pending</td>
                        <td class="px-4 py-2 text-center text-slate-500">-</td>
                        <td class="px-4 py-2 text-center text-slate-500">-</td>
                    </tr>
                `;
            }).join('');
        } else {
            laborHtml = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No labor logged or assigned</td></tr>';
        }
    }
    
    document.getElementById('jobCardLabor').innerHTML = laborHtml;
}

function renderJobCardSummary(jobCardId) {
    const jc = store.jobCards.find(j => String(j.id) === String(jobCardId) || String(j._fbKey) === String(jobCardId));
    const materials = store.jobCardMaterials.filter(m => String(m.job_card_id) === String(jobCardId));
    const labor = store.jobCardLabor.filter(l => String(l.job_card_id) === String(jobCardId));
    
    const totalMaterialCost = materials.reduce((sum, m) => sum + m.total_cost, 0);
    const totalHours = labor.reduce((sum, l) => sum + l.hours, 0);
    const uniqueWorkers = [...new Set(labor.map(l => l.sailor_id))].length;
    
    document.getElementById('jobCardSummary').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-xl">
            <p class="text-sm text-slate-500 mb-1">Job Number</p>
            <p class="text-xl font-bold text-blue-600">${jc.job_number}</p>
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
                <span class="px-3 py-1 rounded ${jc.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-200'}">${jc.status}</span>
                <span class="text-slate-600">Started: ${jc.start_date}</span>
                ${jc.end_date ? `<span class="text-slate-600">Ended: ${jc.end_date}</span>` : ''}
            </div>
        </div>
    `;
}

function renderJobCardFeedback(jobCardId) {
    const jc = store.jobCards.find(j => j.id === jobCardId);
    
    if (jc.feedbackReceived && jc.feedback) {
        document.getElementById('feedbackSection').classList.add('hidden');
        document.getElementById('receivedFeedbackSection').classList.remove('hidden');
        document.getElementById('receivedFeedbackSection').innerHTML = `
            <div class="bg-green-50 p-6 rounded-xl border border-green-200">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-green-800">✓ Feedback Received</h4>
                    <span class="text-2xl font-bold text-green-600">${jc.feedback.overall.toFixed(1)}/5</span>
                </div>
                <div class="grid grid-cols-5 gap-2 mb-4">
                    ${['Productivity', 'Workmanship', 'Communication', 'Professionalism', 'Satisfaction'].map((cat, i) => {
                        const scores = [jc.feedback.productivity, jc.feedback.workmanship, jc.feedback.communication, jc.feedback.professionalism, jc.feedback.satisfaction];
                        return `
                            <div class="text-center p-2 bg-white rounded-lg">
                                <p class="text-xs text-slate-500">${cat}</p>
                                <p class="font-bold text-lg">${scores[i]}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${jc.feedback.comments ? `<p class="text-sm text-slate-600 italic">"${jc.feedback.comments}"</p>` : ''}
            </div>
        `;
    } else {
        document.getElementById('feedbackSection').classList.remove('hidden');
        document.getElementById('receivedFeedbackSection').classList.add('hidden');
        document.getElementById('feedbackLinkBox').classList.add('hidden');
        document.getElementById('genFeedbackBtn').style.display = jc.status === 'Completed' ? 'inline-block' : 'none';
        document.getElementById('feedbackStatusText').textContent = jc.feedbackSent ? 
            'Feedback link has been sent. Waiting for response...' : 
            'Generate a feedback link to send to the end user';
    }
}

function switchJobCardTab(tab) {
    document.querySelectorAll('.jc-tab').forEach(t => {
        t.classList.remove('border-green-600', 'text-green-600', 'border-b-2');
        t.classList.add('text-slate-500');
    });
    document.querySelectorAll('.jc-tab-content').forEach(c => c.classList.add('hidden'));
    
    if (event && event.target) {
        event.target.classList.remove('text-slate-500');
        event.target.classList.add('border-green-600', 'text-green-600', 'border-b-2');
    }
    document.getElementById(`jcTab-${tab}`).classList.remove('hidden');
}

function openAddMaterialToJobModal() {
    if (!store.selectedJobCard) {
        showToast('Please select a job card first', 'error');
        return;
    }
    
    document.getElementById('matJobCardId').value = store.selectedJobCard;
    
    // Populate inventory dropdown
    document.getElementById('matFromInventory').innerHTML = '<option value="">-- Select from Inventory --</option>' +
        store.inventory.filter(i => i.category !== 'Tools').map(i => 
            `<option value="${i.id}" data-name="${i.description}" data-unit="${i.deno}" data-cost="${i.cost_per_unit}" data-qty="${i.quantity}">
                ${i.description} (${i.quantity} ${i.deno} @ ${formatCurrency(i.cost_per_unit)})
            </option>`
        ).join('');
    
    // Reset form
    document.getElementById('matName').value = '';
    document.getElementById('matQuantity').value = '';
    document.getElementById('matCost').value = '';
    document.getElementById('matTotalCost').textContent = 'Rs. 0.00';
    
    document.getElementById('addMaterialModal').classList.remove('hidden');
}

function fillMaterialFromInventory() {
    const select = document.getElementById('matFromInventory');
    const option = select.selectedOptions[0];
    
    if (option && option.value) {
        document.getElementById('matName').value = option.dataset.name;
        document.getElementById('matUnit').value = option.dataset.unit;
        document.getElementById('matCost').value = option.dataset.cost;
        calculateMaterialTotal();
    }
}

function calculateMaterialTotal() {
    const qty = parseFloat(document.getElementById('matQuantity').value) || 0;
    const cost = parseFloat(document.getElementById('matCost').value) || 0;
    document.getElementById('matTotalCost').textContent = formatCurrency(qty * cost);
}

// Add event listeners for material calculation
document.getElementById('matQuantity')?.addEventListener('input', calculateMaterialTotal);
document.getElementById('matCost')?.addEventListener('input', calculateMaterialTotal);

function addMaterialToJob(event) {
    event.preventDefault();
    
    const jobCardId = document.getElementById('matJobCardId').value;
    const qty = parseFloat(document.getElementById('matQuantity').value);
    const cost = parseFloat(document.getElementById('matCost').value) || 0;
    
    const newMaterial = {
        job_card_id: jobCardId,
        material_name: document.getElementById('matName').value,
        quantity: qty,
        unit: document.getElementById('matUnit').value,
        cost_per_unit: cost,
        total_cost: qty * cost,
    };
    
    // Save to Firebase (Realtime Database listener will automatically update store.jobCardMaterials)
    fbSaveJobCardMaterial(newMaterial);
    
    // Update job card total in Firebase
    const jc = store.jobCards.find(j => String(j.id) === String(jobCardId) || String(j._fbKey) === String(jobCardId));
    if (jc) {
        jc.total_material_cost = (jc.total_material_cost || 0) + newMaterial.total_cost;
        fbSaveJobCard(jc);
    }
    
    // Deduct from inventory in Firebase if selected
    const invId = document.getElementById('matFromInventory').value;
    if (invId) {
        const inv = store.inventory.find(i => String(i.id) === String(invId) || String(i._fbKey) === String(invId));
        if (inv) {
            inv.quantity -= qty;
            fbSaveInventoryItem(inv);
        }
    }
    
    closeModal('addMaterialModal');
    selectJobCard(jobCardId);
    showToast('Material added successfully!');
}

function generateFeedbackLink() {
    const jc = store.jobCards.find(j => j.id === store.selectedJobCard);
    if (!jc) return;
    
    const token = Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/feedback.html?job=${encodeURIComponent(jc.job_number)}&token=${token}`;
    
    document.getElementById('generatedFeedbackLink').value = link;
    document.getElementById('feedbackLinkBox').classList.remove('hidden');
    
    jc.feedbackSent = true;
    showToast('Feedback link generated!');
}

function copyFeedbackLink() {
    const link = document.getElementById('generatedFeedbackLink');
    link.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!');
}

function sendFeedbackWhatsApp() {
    const link = document.getElementById('generatedFeedbackLink').value;
    const jc = store.jobCards.find(j => j.id === store.selectedJobCard);
    const message = `Please provide your feedback for Job ${jc?.job_number}: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function exportJobCardReport() {
    showToast('Generating report...', 'info');
    // In production, this would generate a PDF
    setTimeout(() => showToast('Report exported successfully!'), 1000);
}

// =============================================
// INVENTORY
// =============================================
function renderInventory() {
    renderInventoryCategories();
    renderInventoryTable();
    populateProjectDropdown();
}

function populateProjectDropdown() {
    const projects = store.workOrders.filter(wo => wo.type === 'PROJECT' && wo.zone_id === store.currentZone);
    document.getElementById('invRequirement').innerHTML = '<option value="">-- Select Project --</option>' +
        projects.map(p => `<option value="${p.description}">${p.description}</option>`).join('') +
        store.jobCards.filter(jc => jc.status === 'Completed' && jc.zone_id === store.currentZone).map(jc => 
            `<option value="${jc.description}">${jc.description} (Completed)</option>`
        ).join('');
}

function switchInventoryCategory(category) {
    store.currentInventoryCategory = category;
    document.querySelectorAll('.inv-cat-tab').forEach(t => {
        t.classList.remove('border-green-600', 'text-green-600', 'bg-green-50', 'border-b-2');
        t.classList.add('text-slate-500');
    });
    event.target.classList.remove('text-slate-500');
    event.target.classList.add('border-green-600', 'text-green-600', 'bg-green-50', 'border-b-2');
    renderInventoryTable();
}

function renderInventoryCategories() {
    const container = document.getElementById('inventoryCategoryTabsContainer');
    if (!container) return;

    // Default categories that should always appear
    const defaultCats = ['BMS', 'Plumbing', 'Metal', 'General', 'Aluminium', 'Paint', 'Electrical', 'Tools'];
    
    // Extract unique categories from actual inventory items
    const actualCats = [...new Set(store.inventory.map(i => i.category))].filter(c => c && c.trim() !== '');

    // Combine and deduplicate, keeping defaults first
    const allCats = [...new Set([...defaultCats, ...actualCats])];

    let html = `<button onclick="switchInventoryCategory('all')" class="inv-cat-tab px-6 py-3 text-sm font-medium whitespace-nowrap ${store.currentInventoryCategory === 'all' ? 'border-b-2 border-green-600 text-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-50'}">
        📦 All
    </button>`;

    allCats.forEach(cat => {
        const isActive = store.currentInventoryCategory === cat;
        const activeClass = isActive ? 'border-b-2 border-green-600 text-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-50';
        html += `<button onclick="switchInventoryCategory('${cat}')" class="inv-cat-tab px-6 py-3 text-sm font-medium whitespace-nowrap ${activeClass}">
            🏷️ ${cat}
        </button>`;
    });

    container.innerHTML = html;

    // Also update the select dropdown options, keeping standard ones and dynamically adding any database custom ones
    const catSelect = document.getElementById('invCategory');
    if (catSelect) {
        const standardCats = ['BMS', 'Plumbing', 'Metal', 'General', 'Aluminium', 'Paint', 'Electrical', 'Tools', 'Lubricant Oil'];
        const customCats = allCats.filter(c => !standardCats.includes(c));
        
        let optionsHtml = '<option value="">-- Select Category --</option>';
        standardCats.forEach(c => {
            optionsHtml += `<option value="${c}">${c}</option>`;
        });
        if (customCats.length > 0) {
            optionsHtml += '<option disabled>──────────</option>';
            customCats.forEach(c => {
                optionsHtml += `<option value="${c}">${c}</option>`;
            });
        }
        
        const prevVal = catSelect.value;
        catSelect.innerHTML = optionsHtml;
        if (prevVal) catSelect.value = prevVal;
    }
}

function renderInventoryTable() {
    const location = document.getElementById('inventoryLocation')?.value || '';
    let items = [];
    
    // Filter by current zone or allow cross-zone query if ALL_ZONES is selected
    if (location === 'ALL_ZONES') {
        items = [...store.inventory];
    } else {
        items = store.inventory.filter(i => !i.zone_id || i.zone_id === store.currentZone);
    }
    
    // Filter by category
    if (store.currentInventoryCategory !== 'all') {
        items = items.filter(i => i.category === store.currentInventoryCategory);
    }
    
    // Filter by search
    const search = document.getElementById('inventorySearch')?.value?.toLowerCase() || '';
    if (search) {
        items = items.filter(i => (i.description || "").toLowerCase().includes(search));
    }
    
    // Filter by location
    if (location && location !== 'ALL_ZONES') {
        items = items.filter(i => i.location === location);
    }
    
    // Sort
    const sort = document.getElementById('inventorySort')?.value || 'description';
    items.sort((a, b) => {
        switch(sort) {
            case 'quantity': return b.quantity - a.quantity;
            case 'cost': return b.cost_per_unit - a.cost_per_unit;
            case 'date': return new Date(b.date_added || 0) - new Date(a.date_added || 0);
            default: return (a.description || '').localeCompare(b.description || '');
        }
    });
    
    // Group same items (same description, deno, cost, location)
    const grouped = {};
    items.forEach(item => {
        const key = `${item.description}|${item.deno}|${item.cost_per_unit}|${item.location}`;
        if (!grouped[key]) {
            grouped[key] = {...item, totalQty: item.quantity, items: [item]};
        } else {
            grouped[key].totalQty += item.quantity;
            grouped[key].items.push(item);
        }
    });
    
    const groupedItems = Object.values(grouped);
    
    document.getElementById('inventoryTableBody').innerHTML = groupedItems.map(item => {
        const isLow = item.totalQty < 10;
        const catColors = { 'BMS':'bg-amber-100 text-amber-800','Plumbing':'bg-blue-100 text-blue-800','Metal':'bg-slate-200 text-slate-700','Paint':'bg-rose-100 text-rose-700','Electrical':'bg-yellow-100 text-yellow-800','Tools':'bg-purple-100 text-purple-800','Aluminium':'bg-cyan-100 text-cyan-800','General':'bg-green-100 text-green-700' };
        const catCls = catColors[item.category] || 'bg-slate-100 text-slate-600';
        return `
        <tr class="hover:bg-teal-50/40 cursor-pointer transition-colors border-b border-slate-100">
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 font-medium text-slate-800 text-sm">${item.description}</td>
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 text-center"><span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${catCls}">${item.category}</span></td>
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 text-center text-xs text-slate-500">${item.deno}</td>
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 text-center">
                <span class="font-bold text-sm ${isLow ? 'text-rose-600' : 'text-slate-800'}">${item.totalQty}</span>
                ${isLow ? '<span class="ml-1 text-[10px] text-rose-500 font-medium">⚠ Low</span>' : ''}
            </td>
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 text-right font-medium text-slate-700 text-sm">${formatCurrency(item.cost_per_unit)}</td>
            <td onclick="showInventoryDetail('${item.id}')" class="px-4 py-2.5 text-center"><span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${item.location}${item.zone_id && item.zone_id !== store.currentZone ? ` (${item.zone_id})` : ''}</span></td>
            <td class="px-4 py-2.5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editInventoryItem('${item.id}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="showInventoryDetail('${item.id}')" class="text-teal-600 hover:text-teal-800 p-1 rounded hover:bg-teal-50" title="View Detail">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">No inventory items found</td></tr>';

    // Calculate total valuation
    const totalValuation = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.cost_per_unit || 0)), 0);
    const grandTotalItems = store.inventory.filter(i => !i.zone_id || i.zone_id === store.currentZone);
    const grandTotalValuation = grandTotalItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.cost_per_unit || 0)), 0);
    
    // Check if category or search or location is active (meaning it is filtered)
    const isFiltered = store.currentInventoryCategory !== 'all' || 
                       (document.getElementById('inventorySearch')?.value || '') !== '' ||
                       (document.getElementById('inventoryLocation')?.value || '') !== '';
    
    const footEl = document.getElementById('inventoryTableFoot');
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
    const item = store.inventory.find(i => String(i.id) === String(itemId) || String(i._fbKey) === String(itemId));
    if (!item) return;
    
    document.getElementById('inventoryDetailContent').innerHTML = `
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
                    <p class="font-bold text-xl ${item.quantity < 10 ? 'text-red-600' : 'text-green-600'}">${item.quantity} ${item.deno}</p>
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
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Location</p>
                    <p class="font-medium">${item.location}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Requirement</p>
                    <p class="font-medium">${item.requirement || 'General'}</p>
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
                    ${item.on_charge_records ? item.on_charge_records.map(r => `
                        <div class="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span class="mono text-sm text-green-700">${r.ref}</span>
                            <span class="text-sm">+${r.qty} ${item.deno}</span>
                            <span class="text-xs text-slate-500">${r.date}</span>
                        </div>
                    `).join('') : `
                        <div class="p-2 bg-green-50 rounded">
                            <span class="mono text-sm text-green-700">${item.on_charge_ref || '—'}</span>
                        </div>
                    `}
                </div>
            </div>

            <!-- Off Charge Records (req 4) -->
            <div class="border-t pt-4">
                <h4 class="font-semibold text-slate-700 mb-2 flex items-center gap-2">📤 Off-Charge Records</h4>
                <div class="space-y-2">
                    ${(item.off_charge_records && item.off_charge_records.length) ? item.off_charge_records.map(r => `
                        <div class="flex items-center justify-between p-2 bg-rose-50 rounded">
                            <div>
                                <span class="mono text-sm text-rose-700">${r.ref}</span>
                                ${r.dest ? `<span class="block text-[11px] text-slate-500">→ ${r.dest}</span>` : ''}
                            </div>
                            <span class="text-sm text-rose-600">−${r.qty} ${item.deno}</span>
                            <span class="text-xs text-slate-500">${r.date}</span>
                        </div>
                    `).join('') : '<p class="text-xs text-slate-400 italic p-2">No off-charge records yet</p>'}
                </div>
            </div>

            <!-- Off-Charge action (req 5) -->
            <div class="border-t pt-4">
                <button onclick="openOffChargeModal('${item.id}')" class="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm">
                    📇 Off-Charge to Base / Zone (Nav 254)
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('inventoryDetailModal').classList.remove('hidden');
}

// ---- Off-charge to another base/zone (req 5) ----
function openOffChargeModal(itemId) {
    const item = store.inventory.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('ocItemId').value = item.id;
    document.getElementById('ocItemName').textContent = item.description;
    document.getElementById('ocItemAvail').textContent = `${item.quantity} ${item.deno}`;
    document.getElementById('ocQty').value = '';
    document.getElementById('ocQty').max = item.quantity;
    document.getElementById('ocRef').value = '';
    document.getElementById('ocRemarks').value = '';
    document.getElementById('ocDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('ocDest').innerHTML = '<option value="">Select destination...</option>' +
        store.offChargeDestinations.map(d => `<option value="${d}">${d}</option>`).join('');
    closeModal('inventoryDetailModal');
    document.getElementById('offChargeModal').classList.remove('hidden');
}

function submitOffCharge(event) {
    event.preventDefault();
    const item = store.inventory.find(i => i.id == document.getElementById('ocItemId').value);
    if (!item) return;
    const qty = parseFloat(document.getElementById('ocQty').value);
    const ref = document.getElementById('ocRef').value.trim();
    const dest = document.getElementById('ocDest').value;
    const date = document.getElementById('ocDate').value;
    const remarks = document.getElementById('ocRemarks').value.trim();

    if (qty <= 0 || qty > item.quantity) {
        showToast(`Quantity must be between 0 and ${item.quantity}`, 'error');
        return;
    }

    item.quantity -= qty;
    if (!item.off_charge_records) item.off_charge_records = [];
    item.off_charge_records.push({ ref, qty, date, dest, remarks });
    item.off_charge_ref = ref;

    closeModal('offChargeModal');
    renderInventoryTable();
    showToast(`Off-charged ${qty} ${item.deno} of ${item.description} → ${dest} (${ref})`);
    // syncToFirebase('inventory', item.id, item);
}

function openAddInventoryModal() {
    document.getElementById('invId').value = '';
    document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
    populateProjectDropdown();
    // Pre-select current zone
    const zoneOpts = store.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
    document.getElementById('invZone').innerHTML = zoneOpts;
    document.getElementById('invZone').value = store.currentZone;
    document.getElementById('inventoryModal').classList.remove('hidden');
}

function editInventoryItem(itemId) {
    const item = store.inventory.find(i => String(i.id) === String(itemId) || String(i._fbKey) === String(itemId));
    if (!item) return;
    
    document.getElementById('invId').value = item.id;
    document.getElementById('invCategory').value = item.category;
    document.getElementById('invDescription').value = item.description;
    document.getElementById('invDeno').value = item.deno;
    document.getElementById('invQuantity').value = item.quantity;
    document.getElementById('invCost').value = item.cost_per_unit;
    document.getElementById('invLocation').value = item.location;
    document.getElementById('invOnCharge').value = item.on_charge_ref || '';
    document.getElementById('invDate').value = item.date_added;
    // Populate and set zone
    const zoneOpts = store.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
    document.getElementById('invZone').innerHTML = zoneOpts;
    document.getElementById('invZone').value = item.zone_id || store.currentZone;
    
    populateProjectDropdown();
    document.getElementById('invRequirement').value = item.requirement || '';
    
    document.getElementById('inventoryModal').classList.remove('hidden');
}

function saveInventoryItem(event) {
    event.preventDefault();
    
    const id = document.getElementById('invId').value;
    const requirement = document.getElementById('invRequirement').value || document.getElementById('invRequirementText').value;
    
    const itemData = {
        category: document.getElementById('invCategory').value,
        description: document.getElementById('invDescription').value,
        deno: document.getElementById('invDeno').value,
        quantity: parseFloat(document.getElementById('invQuantity').value),
        cost_per_unit: parseFloat(document.getElementById('invCost').value) || 0,
        requirement: requirement,
        location: document.getElementById('invLocation').value,
        on_charge_ref: document.getElementById('invOnCharge').value,
        date_added: document.getElementById('invDate').value,
        zone_id: document.getElementById('invZone').value || store.currentZone
    };
    
    if (id) {
        itemData._fbKey = id;
    }

    fbSaveInventoryItem(itemData).then(() => {
        closeModal('inventoryModal');
        showToast(id ? 'Item updated successfully!' : 'Item added successfully!');
        document.getElementById('inventoryForm').reset();
        document.getElementById('invId').value = '';
    }).catch(err => {
        console.error(err);
        showToast('Error saving item!', 'error');
    });
}

// =============================================
// ESTIMATES
// =============================================
function renderEstimates() {
    const container = document.getElementById('estimatesList');
    const filteredEstimates = store.estimates.filter(e => !e.zone_id || e.zone_id === store.currentZone);
    container.innerHTML = filteredEstimates.map(e => {
        const isSelected = store.selectedEstimate === e.id;
        const isApproved = e.status === 'Approved';
        const isLinked = e.status === 'Linked';
        const statusBadge = isLinked ? 
            `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⛓️ Linked</span>` :
            `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                ${isApproved ? '✓ Approved' : '⏳ Pending'}
            </span>`;
        return `
        <div class="p-3.5 border-b border-slate-100 hover:bg-teal-50/40 cursor-pointer transition-all
            ${isSelected ? 'bg-amber-50 border-l-4 border-amber-400 shadow-sm' : ''}"
            >
            <div class="flex items-start gap-3">
                <input type="checkbox" class="mt-1 w-4 h-4 accent-teal-600 cursor-pointer flex-shrink-0"
                    ${store.selectedEstimatesForPrint.includes(e.id) ? 'checked' : ''}
                    onclick="event.stopPropagation(); toggleEstimatePrintSelection(${e.id})" title="Select for bulk print">
                <div class="flex-1 min-w-0" onclick="selectEstimate(${e.id})">
                    <div class="flex items-center justify-between mb-1">
                        <span class="mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">${e.estimate_number}</span>
                        ${statusBadge}
                    </div>
                    <p class="text-sm font-medium text-slate-700 truncate">${e.description}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5 truncate">📍 ${e.location || 'Location not set'}</p>
                    <div class="flex justify-between mt-2 items-center">
                        <span class="text-sm font-bold text-teal-700">${formatCurrency(e.total_cost)}</span>
                        <span class="text-[11px] text-slate-505 bg-slate-100 px-2 py-0.5 rounded-full">${e.totalManDays || 0} man-days</span>
                    </div>
                    ${isApproved && e.approvedAuthority ? `
                    <div class="mt-1.5">
                        <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">🏛 ${e.approvedAuthority}</span>
                    </div>` : ''}
                    ${isLinked ? (() => {
                        const linkedJob = store.jobCards.find(jc => String(jc.estimate_id) === String(e.id) || jc.work_order_id === e.work_order_id);
                        return linkedJob ? `
                        <div class="mt-1.5">
                            <span class="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100">⛓️ Job Card: ${linkedJob.job_number}</span>
                        </div>` : '';
                    })() : ''}
                </div>
            </div>
        </div>`;
    }).join('') || '<p class="text-slate-500 text-center py-8">No estimates</p>';

    document.getElementById('bulkPrintCount').textContent = store.selectedEstimatesForPrint.length;
}

function toggleEstimatePrintSelection(id) {
    const idx = store.selectedEstimatesForPrint.indexOf(id);
    if (idx >= 0) store.selectedEstimatesForPrint.splice(idx, 1);
    else store.selectedEstimatesForPrint.push(id);
    document.getElementById('bulkPrintCount').textContent = store.selectedEstimatesForPrint.length;
}

function selectEstimate(id) {
    store.selectedEstimate = id;
    const est = store.estimates.find(e => e.id === id);
    
    document.getElementById('selectedEstimateNumber').textContent = est.estimate_number;
    document.getElementById('editEstimateBtn').style.display = est.status === 'Pending' ? 'inline-block' : 'none';
    document.getElementById('approveEstimateBtn').style.display = est.status === 'Pending' ? 'inline-block' : 'none';

    const sigBlock = (label, p) => `
        <div class="text-center">
            <div class="h-12 border-b border-slate-400 mb-1"></div>
            <p class="text-xs font-semibold text-slate-700">${label}</p>
            <p class="text-xs text-slate-600">${p && p.name ? p.name : '—'}</p>
            <p class="text-[11px] text-slate-500">${p && p.rank ? p.rank : ''}${p && p.serviceNo ? ' • ' + p.serviceNo : ''}</p>
        </div>`;

    document.getElementById('estimateContent').innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">Reference</p>
                    <p class="font-medium">${est.reference_doc || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Status</p>
                    <span class="px-3 py-1 rounded ${est.status === 'Approved' ? 'bg-green-100 text-green-700' : est.status === 'Linked' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${est.status}</span>
                    ${est.status === 'Approved' && est.approvedAuthority ? `<span class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Approved by ${est.approvedAuthority}</span>` : ''}
                    ${est.status === 'Linked' ? (() => {
                        const linkedJob = store.jobCards.find(jc => String(jc.estimate_id) === String(est.id) || jc.work_order_id === est.work_order_id);
                        return linkedJob ? `<span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-semibold border border-indigo-200">⛓️ Converted to Job Card: ${linkedJob.job_number}</span>` : '';
                    })() : ''}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">📍 Location</p>
                    <p class="font-medium">${est.location || 'Not specified'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">👤 End User</p>
                    <p class="font-medium">${est.endUser || 'Not specified'}</p>
                </div>
            </div>
            
            <div>
                <p class="text-sm text-slate-500">Work Scope</p>
                <p class="text-slate-700">${est.workScope || 'Not specified'}</p>
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
                        ${est.materials?.map(m => `
                            <tr class="border-t">
                                <td class="px-4 py-2">${m.description}</td>
                                <td class="px-4 py-2 text-center">${m.qty}</td>
                                <td class="px-4 py-2 text-center">${m.unit}</td>
                                <td class="px-4 py-2 text-right">${formatCurrency(m.cost)}</td>
                                <td class="px-4 py-2 text-right font-medium">${formatCurrency(m.qty * m.cost)}</td>
                                <td class="px-4 py-2 text-center"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${m.availability}</span></td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="px-4 py-4 text-center text-slate-500">No materials</td></tr>'}
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
                        ${est.labor?.map(l => `
                            <tr class="border-t">
                                <td class="px-4 py-2">${l.trade}</td>
                                <td class="px-4 py-2 text-center">${l.workers}</td>
                                <td class="px-4 py-2 text-center font-medium">${l.manDays}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500">No labor specified</td></tr>'}
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
                    ${sigBlock('Created By', est.createdBy)}
                    ${sigBlock('Checked By', est.checkedBy)}
                    ${sigBlock('Approved By', est.approvedBy)}
                </div>
            </div>
        </div>
    `;
    
    renderEstimates();
}

function openNewEstimateModal() {
    document.getElementById('estId').value = '';
    document.getElementById('estDescription').value = '';
    document.getElementById('estReference').value = '';
    document.getElementById('estLocation').value = '';
    document.getElementById('estEndUser').value = '';
    document.getElementById('estWorkScope').value = '';
    // Default "Created By" to the logged-in user
    document.getElementById('estCreatedName').value = store.currentUser.name || '';
    document.getElementById('estCreatedRank').value = store.currentUser.rank || '';
    document.getElementById('estCreatedSvc').value = store.currentUser.serviceNo || '';
    document.getElementById('estCheckedName').value = '';
    document.getElementById('estCheckedRank').value = '';
    document.getElementById('estCheckedSvc').value = '';
    document.getElementById('estApprovedName').value = '';
    document.getElementById('estApprovedRank').value = '';
    document.getElementById('estApprovedSvc').value = '';
    document.getElementById('estMaterialsBody').innerHTML = '';
    document.getElementById('estLaborBody').innerHTML = '';
    updateEstimateTotals();
    
    document.getElementById('newEstimateModal').classList.remove('hidden');
}

function editEstimate() {
    const est = store.estimates.find(e => e.id === store.selectedEstimate);
    if (!est || est.status !== 'Pending') return;
    
    document.getElementById('estId').value = est.id;
    document.getElementById('estDescription').value = est.description;
    document.getElementById('estReference').value = est.reference_doc || '';
    document.getElementById('estLocation').value = est.location || '';
    document.getElementById('estEndUser').value = est.endUser || '';
    document.getElementById('estWorkScope').value = est.workScope || '';
    document.getElementById('estCreatedName').value = est.createdBy?.name || '';
    document.getElementById('estCreatedRank').value = est.createdBy?.rank || '';
    document.getElementById('estCreatedSvc').value = est.createdBy?.serviceNo || '';
    document.getElementById('estCheckedName').value = est.checkedBy?.name || '';
    document.getElementById('estCheckedRank').value = est.checkedBy?.rank || '';
    document.getElementById('estCheckedSvc').value = est.checkedBy?.serviceNo || '';
    document.getElementById('estApprovedName').value = est.approvedBy?.name || '';
    document.getElementById('estApprovedRank').value = est.approvedBy?.rank || '';
    document.getElementById('estApprovedSvc').value = est.approvedBy?.serviceNo || '';
    
    // Populate materials
    document.getElementById('estMaterialsBody').innerHTML = '';
    est.materials?.forEach(m => {
        addEstimateMaterialRow(m);
    });
    
    // Populate labor
    document.getElementById('estLaborBody').innerHTML = '';
    est.labor?.forEach(l => {
        addEstimateLaborRow(l);
    });
    
    updateEstimateTotals();
    document.getElementById('newEstimateModal').classList.remove('hidden');
}

let estMaterialRowId = 0;
function addEstimateMaterialRow(data = null) {
    estMaterialRowId++;
    const id = estMaterialRowId;
    
    const row = document.createElement('tr');
    row.id = `estMatRow-${id}`;
    row.innerHTML = `
        <td class="px-2 py-2">
            <select class="est-mat-select w-full px-2 py-1 border rounded text-sm" onchange="fillEstMaterialFromInventory(${id})">
                <option value="">Select...</option>
                ${store.inventory.filter(i => i.category !== 'Tools').map(i => 
                    `<option value="${i.id}" data-desc="${i.description}" data-unit="${i.deno}" data-cost="${i.cost_per_unit}" data-loc="${i.location}" ${data?.description === i.description ? 'selected' : ''}>${i.description}</option>`
                ).join('')}
            </select>
        </td>
        <td class="px-2 py-2"><input type="number" class="est-mat-qty w-20 px-2 py-1 border rounded text-sm text-center" value="${data?.qty || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-2"><input type="text" class="est-mat-unit w-16 px-2 py-1 border rounded text-sm text-center" value="${data?.unit || ''}" readonly></td>
        <td class="px-2 py-2"><input type="number" class="est-mat-cost w-24 px-2 py-1 border rounded text-sm text-right" value="${data?.cost || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-2 text-right font-medium est-mat-total">${formatCurrency((data?.qty || 0) * (data?.cost || 0))}</td>
        <td class="px-2 py-2"><span class="est-mat-avail text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${data?.availability || '-'}</span></td>
        <td class="px-2 py-2"><button type="button" onclick="removeEstimateRow('estMatRow-${id}')" class="text-red-500 hover:text-red-700">×</button></td>
    `;
    
    document.getElementById('estMaterialsBody').appendChild(row);
}

function fillEstMaterialFromInventory(rowId) {
    const row = document.getElementById(`estMatRow-${rowId}`);
    const select = row.querySelector('.est-mat-select');
    const option = select.selectedOptions[0];
    
    if (option && option.value) {
        row.querySelector('.est-mat-unit').value = option.dataset.unit;
        row.querySelector('.est-mat-cost').value = option.dataset.cost;
        row.querySelector('.est-mat-avail').textContent = option.dataset.loc;
        updateEstimateTotals();
    }
}

let estLaborRowId = 0;
function addEstimateLaborRow(data = null) {
    estLaborRowId++;
    const id = estLaborRowId;
    
    const row = document.createElement('tr');
    row.id = `estLabRow-${id}`;
    row.innerHTML = `
        <td class="px-2 py-2">
            <select class="est-lab-trade w-full px-2 py-1 border rounded text-sm">
                <option value="Mason" ${data?.trade === 'Mason' ? 'selected' : ''}>Mason</option>
                <option value="Carpenter" ${data?.trade === 'Carpenter' ? 'selected' : ''}>Carpenter</option>
                <option value="Painter" ${data?.trade === 'Painter' ? 'selected' : ''}>Painter</option>
                <option value="Plumber" ${data?.trade === 'Plumber' ? 'selected' : ''}>Plumber</option>
                <option value="Electrician" ${data?.trade === 'Electrician' ? 'selected' : ''}>Electrician</option>
                <option value="Welder" ${data?.trade === 'Welder' ? 'selected' : ''}>Welder</option>
                <option value="Helper" ${data?.trade === 'Helper' ? 'selected' : ''}>Helper</option>
            </select>
        </td>
        <td class="px-2 py-2"><input type="number" class="est-lab-workers w-20 px-2 py-1 border rounded text-sm text-center" value="${data?.workers || 1}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-2"><input type="number" class="est-lab-days w-20 px-2 py-1 border rounded text-sm text-center" value="${data?.manDays || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-2"><input type="text" class="est-lab-desc w-full px-2 py-1 border rounded text-sm" placeholder="Task description"></td>
        <td class="px-2 py-2"><button type="button" onclick="removeEstimateRow('estLabRow-${id}')" class="text-red-500 hover:text-red-700">×</button></td>
    `;
    
    document.getElementById('estLaborBody').appendChild(row);
}

function removeEstimateRow(rowId) {
    document.getElementById(rowId)?.remove();
    updateEstimateTotals();
}

function updateEstimateTotals() {
    // Calculate materials total
    let materialsTotal = 0;
    document.querySelectorAll('#estMaterialsBody tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.est-mat-qty')?.value) || 0;
        const cost = parseFloat(row.querySelector('.est-mat-cost')?.value) || 0;
        const total = qty * cost;
        materialsTotal += total;
        const totalCell = row.querySelector('.est-mat-total');
        if (totalCell) totalCell.textContent = formatCurrency(total);
    });
    
    // Calculate labor total
    let laborTotal = 0;
    document.querySelectorAll('#estLaborBody tr').forEach(row => {
        const days = parseFloat(row.querySelector('.est-lab-days')?.value) || 0;
        laborTotal += days;
    });
    
    document.getElementById('estMaterialsTotal').textContent = formatCurrency(materialsTotal);
    document.getElementById('estLaborTotal').textContent = laborTotal;
    document.getElementById('estSummaryMaterials').textContent = formatCurrency(materialsTotal);
    document.getElementById('estSummaryLabor').textContent = laborTotal;
    document.getElementById('estSummaryTotal').textContent = formatCurrency(materialsTotal);
}

function saveEstimate(event) {
    event.preventDefault();
    
    // Collect materials
    const materials = [];
    document.querySelectorAll('#estMaterialsBody tr').forEach(row => {
        const select = row.querySelector('.est-mat-select');
        materials.push({
            description: select.selectedOptions[0]?.text || '',
            qty: parseFloat(row.querySelector('.est-mat-qty')?.value) || 0,
            unit: row.querySelector('.est-mat-unit')?.value || '',
            cost: parseFloat(row.querySelector('.est-mat-cost')?.value) || 0,
            availability: row.querySelector('.est-mat-avail')?.textContent || '-'
        });
    });
    
    // Collect labor
    const labor = [];
    document.querySelectorAll('#estLaborBody tr').forEach(row => {
        labor.push({
            trade: row.querySelector('.est-lab-trade')?.value || '',
            workers: parseInt(row.querySelector('.est-lab-workers')?.value) || 1,
            manDays: parseFloat(row.querySelector('.est-lab-days')?.value) || 0
        });
    });
    
    const totalCost = materials.reduce((sum, m) => sum + (m.qty * m.cost), 0);
    const totalManDays = labor.reduce((sum, l) => sum + l.manDays, 0);
    
    const id = document.getElementById('estId').value;

    const sig = (n, r, s) => ({
        name: document.getElementById(n).value.trim(),
        rank: document.getElementById(r).value.trim(),
        serviceNo: document.getElementById(s).value.trim()
    });
    const createdBy = sig('estCreatedName', 'estCreatedRank', 'estCreatedSvc');
    const checkedBy = sig('estCheckedName', 'estCheckedRank', 'estCheckedSvc');
    const approvedBy = sig('estApprovedName', 'estApprovedRank', 'estApprovedSvc');
    const location = document.getElementById('estLocation').value;
    const endUser = document.getElementById('estEndUser').value;
    
    if (id) {
        // Update existing
        const est = store.estimates.find(e => e.id == id);
        if (est) {
            est.description = document.getElementById('estDescription').value;
            est.reference_doc = document.getElementById('estReference').value;
            est.location = location;
            est.endUser = endUser;
            est.workScope = document.getElementById('estWorkScope').value;
            est.materials = materials;
            est.labor = labor;
            est.total_cost = totalCost;
            est.totalManDays = totalManDays;
            est.createdBy = createdBy;
            est.checkedBy = checkedBy;
            est.approvedBy = approvedBy;
            
            fbSaveEstimate(est);
        }
        showToast('Estimate updated!');
    } else {
        // Create new
        const newEst = {
            id: store.estimates.length + 1,
            estimate_number: `EST/${new Date().getFullYear()}/${String(store.estimates.length + 1).padStart(4, '0')}`,
            description: document.getElementById('estDescription').value,
            reference_doc: document.getElementById('estReference').value,
            location: location,
            endUser: endUser,
            workScope: document.getElementById('estWorkScope').value,
            materials: materials,
            labor: labor,
            total_cost: totalCost,
            totalManDays: totalManDays,
            status: 'Pending',
            approvedAuthority: null,
            createdBy: createdBy,
            checkedBy: checkedBy,
            approvedBy: approvedBy,
            zone_id: store.currentZone
        };
        fbSaveEstimate(newEst);
        showToast('Estimate created!');
    }
    
    closeModal('newEstimateModal');
    renderEstimates();
}

// Signatory Dropdown Helper
function populateSignatoryDropdowns() {
    // Filter sailors whose off_no starts with 'EC' or 'AC'
    const eligibleSailors = store.sailors.filter(s => {
        const off = String(s.official_number || s.service_no || '').trim().toUpperCase();
        return off.startsWith('EC') || off.startsWith('AC');
    });

    let optionsHtml = '<option value="">Select Name...</option>';
    eligibleSailors.forEach(s => {
        const offNo = s.official_number || s.service_no || '';
        optionsHtml += `<option value="${s.name}" data-rank="${s.rank || ''}" data-svc="${offNo}">${s.name} (${offNo})</option>`;
    });

    const createdEl = document.getElementById('estCreatedName');
    const checkedEl = document.getElementById('estCheckedName');
    
    // Store current values before overwriting HTML
    const curCreated = createdEl ? createdEl.value : '';
    const curChecked = checkedEl ? checkedEl.value : '';

    if (createdEl) createdEl.innerHTML = optionsHtml;
    if (checkedEl) checkedEl.innerHTML = optionsHtml;

    // Restore selected values if they exist in the new options
    if (createdEl && curCreated) createdEl.value = curCreated;
    if (checkedEl && curChecked) checkedEl.value = curChecked;
}

function autoFillSignatory(prefix) {
    const selectEl = document.getElementById(`est${prefix}Name`);
    const rankEl = document.getElementById(`est${prefix}Rank`);
    const svcEl = document.getElementById(`est${prefix}Svc`);
    
    if (selectEl && selectEl.selectedIndex > 0) {
        const option = selectEl.options[selectEl.selectedIndex];
        if (rankEl) rankEl.value = option.getAttribute('data-rank');
        if (svcEl) svcEl.value = option.getAttribute('data-svc');
    } else {
        if (rankEl) rankEl.value = '';
        if (svcEl) svcEl.value = '';
    }
}

// ---- Approval (req 9) ----
function approveEstimate() {
    const est = store.estimates.find(e => e.id === store.selectedEstimate);
    if (!est) { showToast('Select an estimate first', 'error'); return; }
    if (est.status === 'Approved') { showToast('Already approved', 'info'); return; }
    document.getElementById('apvEstNumber').textContent = est.estimate_number;
    document.getElementById('apvAuthority').value = '';
    document.getElementById('approvalModal').classList.remove('hidden');
}

function submitApproval(event) {
    event.preventDefault();
    const est = store.estimates.find(e => e.id === store.selectedEstimate);
    if (!est) return;
    const authority = document.getElementById('apvAuthority').value;
    est.status = 'Approved';
    est.approvedAuthority = authority;
    closeModal('approvalModal');
    selectEstimate(est.id);
    showToast(`Estimate ${est.estimate_number} approved by ${authority}`);
    // syncToFirebase('estimates', est.id, est);
}

// ---- Compact printable layout (req 7) ----
// Status intentionally omitted from the printout (req 7)
function buildEstimatePrintHTML(est) {
    const sigBlock = (label, p) => `
        <div style="text-align:center;width:30%;">
            <div style="height:38px;border-bottom:1px solid #000;margin-bottom:3px;"></div>
            <div style="font-size:10px;font-weight:bold;">${label}</div>
            <div style="font-size:10px;">${p && p.name ? p.name : '&nbsp;'}</div>
            <div style="font-size:9px;color:#444;">${p && p.rank ? p.rank : ''}${p && p.serviceNo ? ' • ' + p.serviceNo : ''}</div>
        </div>`;

    const matRows = (est.materials || []).map((m, i) => `
        <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${m.description}</td>
            <td style="text-align:center;">${m.qty}</td>
            <td style="text-align:center;">${m.unit}</td>
            <td style="text-align:right;">${formatCurrency(m.cost)}</td>
            <td style="text-align:right;">${formatCurrency(m.qty * m.cost)}</td>
        </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;">No materials</td></tr>';

    const labRows = (est.labor || []).map(l => `
        <tr>
            <td>${l.trade}</td>
            <td style="text-align:center;">${l.workers}</td>
            <td style="text-align:center;">${l.manDays}</td>
        </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;">No labour</td></tr>';

    return `
    <div class="est-sheet">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
            <div style="font-size:15px;font-weight:bold;">SRI LANKA NAVY — CIVIL ENGINEERING</div>
            <div style="font-size:12px;">Naval Civil Works — Cost Estimate</div>
        </div>
        <table style="width:100%;font-size:11px;margin-bottom:6px;">
            <tr>
                <td><b>Estimate No:</b> ${est.estimate_number}</td>
                <td><b>Reference:</b> ${est.reference_doc || '—'}</td>
            </tr>
            <tr>
                <td><b>Location:</b> ${est.location || '—'}</td>
                <td><b>End User:</b> ${est.endUser || '—'}</td>
            </tr>
            <tr>
                <td colspan="2"><b>Description:</b> ${est.description}</td>
            </tr>
            ${est.approvedAuthority ? `<tr><td colspan="2"><b>Approving Authority:</b> ${est.approvedAuthority}</td></tr>` : ''}
        </table>
        ${est.workScope ? `<p style="font-size:11px;margin:4px 0;"><b>Work Scope:</b> ${est.workScope}</p>` : ''}

        <table class="est-table">
            <thead>
                <tr><th>#</th><th>Material</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total</th></tr>
            </thead>
            <tbody>${matRows}</tbody>
            <tfoot>
                <tr><td colspan="5" style="text-align:right;"><b>Materials Total</b></td><td style="text-align:right;"><b>${formatCurrency(est.total_cost)}</b></td></tr>
            </tfoot>
        </table>

        <table class="est-table" style="margin-top:6px;">
            <thead><tr><th>Trade / Role</th><th>Workers</th><th>Man-Days</th></tr></thead>
            <tbody>${labRows}</tbody>
            <tfoot><tr><td colspan="2" style="text-align:right;"><b>Total Man-Days</b></td><td style="text-align:center;"><b>${est.totalManDays || 0}</b></td></tr></tfoot>
        </table>

        <div style="display:flex;justify-content:space-between;margin-top:26px;">
            ${sigBlock('Created By', est.createdBy)}
            ${sigBlock('Checked By', est.checkedBy)}
            ${sigBlock('Approved By', est.approvedBy)}
        </div>
    </div>`;
}

function printEstimatesByIds(ids) {
    const ests = store.estimates.filter(e => ids.includes(e.id));
    if (ests.length === 0) { showToast('Nothing selected to print', 'error'); return; }

    const sheets = ests.map(e => buildEstimatePrintHTML(e)).join('<div class="page-break"></div>');
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>NCW Estimate Print</title>
        <style>
            body { font-family: Arial, sans-serif; color:#000; margin:0; padding:14px; }
            .est-sheet { padding:6px 4px 14px; }
            .est-table { width:100%; border-collapse:collapse; font-size:11px; }
            .est-table th, .est-table td { border:1px solid #555; padding:3px 5px; }
            .est-table thead th { background:#e5e7eb; }
            .page-break { page-break-after: always; }
            @media print { @page { size:A4; margin:12mm; } }
        </style></head>
        <body>${sheets}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
}

function printEstimate() {
    if (!store.selectedEstimate) { showToast('Select an estimate first', 'error'); return; }
    printEstimatesByIds([store.selectedEstimate]);
}

function bulkPrintEstimates() {
    if (store.selectedEstimatesForPrint.length === 0) {
        showToast('Tick the estimates you want to print first', 'error');
        return;
    }
    printEstimatesByIds([...store.selectedEstimatesForPrint]);
}

// kept for backward compatibility (no longer wired to a button)
function exportEstimatePDF() { printEstimate(); }

// =============================================
// MAINTENANCE RECORDS
// =============================================
function renderMaintenance() {
    renderLocationsList();
}

function renderLocationsList() {
    const container = document.getElementById('locationsList');
    const groupedLocations = {};
    
    // Filter by current zone
    const zoneLocations = store.locations.filter(l => l.zone_id === store.currentZone);
    
    zoneLocations.forEach(loc => {
        if (!groupedLocations[loc.building_name]) {
            groupedLocations[loc.building_name] = [];
        }
        groupedLocations[loc.building_name].push(loc);
    });
    
    container.innerHTML = Object.entries(groupedLocations).map(([building, locs]) => `
        <div class="border-b border-slate-100">
            <div class="px-3 py-2.5 font-semibold text-slate-700 text-xs flex items-center gap-2"
                style="background:rgba(15,32,64,0.04)">
                🏢 <span>${building}</span>
            </div>
            ${locs.map(loc => {
                const recCount = store.maintenanceRecords.filter(r => r.location_id === loc.id).length;
                return `
                <div class="px-3 py-2 pl-7 hover:bg-teal-50 cursor-pointer text-sm flex items-center justify-between group transition-colors
                    ${store.selectedLocation === loc.id ? 'bg-teal-100 border-l-3 border-teal-500 font-medium text-teal-800' : 'text-slate-600'}"
                    onclick="selectLocation(${loc.id})">
                    <span>📍 ${loc.sub_location || 'General'}</span>
                    ${recCount > 0 ? `<span class="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">${recCount}</span>` : ''}
                </div>`;
            }).join('')}
        </div>
    `).join('') || '<p class="text-slate-400 text-center py-8 text-sm">No locations in this zone</p>';
}

function selectLocation(id) {
    store.selectedLocation = id;
    const loc = store.locations.find(l => l.id === id);
    const records = store.maintenanceRecords.filter(r => r.location_id === id);

    document.getElementById('selectedLocationName').textContent = `${loc.building_name} — ${loc.sub_location || 'General'}`;
    document.getElementById('selectedLocationZone').textContent = `Zone: ${loc.zone_id}`;
    document.getElementById('addMaintenanceBtn').style.display = 'block';

    const typeColors = {
        'Repair':     'bg-rose-100 text-rose-700 border-rose-300',
        'Preventive': 'bg-blue-100 text-blue-700 border-blue-300',
        'Emergency':  'bg-red-200 text-red-800 border-red-400',
        'Routine':    'bg-teal-100 text-teal-700 border-teal-300',
        'Upgrade':    'bg-purple-100 text-purple-700 border-purple-300',
    };

    document.getElementById('maintenanceHistory').innerHTML = records.length ? `
        <div class="space-y-3">
            ${records.sort((a,b) => new Date(b.date) - new Date(a.date)).map(r => `
                <div class="p-4 rounded-xl border-l-4 transition-all hover:shadow-sm"
                    style="background:rgba(255,255,255,0.9);border-left-color:#0d9488;box-shadow:0 2px 8px rgba(15,32,64,0.05)">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColors[r.maintenance_type] || 'bg-slate-100 text-slate-600'}">${r.maintenance_type}</span>
                        <span class="text-xs text-slate-400 mono">${r.date}</span>
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">${r.description}</p>
                    ${r.job_number ? `<p class="text-[11px] text-teal-600 mt-2 font-medium">🔗 ${r.job_number}</p>` : ''}
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="text-center py-12">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-slate-400 font-medium">No maintenance records</p>
            <p class="text-slate-300 text-sm mt-1">Click "+ Add Record" to log the first entry</p>
        </div>`;

    renderLocationsList();
}

function searchLocations() {
    const query = document.getElementById('locationSearch').value.toLowerCase();
    const container = document.getElementById('locationsList');

    const filteredLocations = store.locations.filter(l =>
        l.zone_id === store.currentZone &&
        (l.building_name.toLowerCase().includes(query) ||
         (l.sub_location && l.sub_location.toLowerCase().includes(query)))
    );

    const groupedLocations = {};
    filteredLocations.forEach(loc => {
        if (!groupedLocations[loc.building_name]) groupedLocations[loc.building_name] = [];
        groupedLocations[loc.building_name].push(loc);
    });

    container.innerHTML = Object.entries(groupedLocations).map(([building, locs]) => `
        <div class="border-b border-slate-100">
            <div class="px-3 py-2.5 font-semibold text-slate-700 text-xs flex items-center gap-2"
                style="background:rgba(15,32,64,0.04)">
                🏢 <span>${building}</span>
            </div>
            ${locs.map(loc => {
                const recCount = store.maintenanceRecords.filter(r => r.location_id === loc.id).length;
                return `
                <div class="px-3 py-2 pl-7 hover:bg-teal-50 cursor-pointer text-sm flex items-center justify-between transition-colors"
                    onclick="selectLocation(${loc.id})">
                    <span class="text-slate-600">📍 ${loc.sub_location || 'General'}</span>
                    ${recCount > 0 ? `<span class="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">${recCount}</span>` : ''}
                </div>`;
            }).join('')}
        </div>
    `).join('') || '<p class="text-slate-400 text-center py-6 text-sm">No locations found</p>';
}

function openAddLocationModal() {
    document.getElementById('locZone').value = store.currentZone;
    document.getElementById('locBuilding').value = '';
    document.getElementById('locSubLocation').value = '';
    document.getElementById('locDescription').value = '';
    document.getElementById('addLocationModal').classList.remove('hidden');
}

function saveLocation(event) {
    event.preventDefault();
    
    const newLocation = {
        zone_id: document.getElementById('locZone').value,
        building_name: document.getElementById('locBuilding').value,
        sub_location: document.getElementById('locSubLocation').value,
        description: document.getElementById('locDescription').value
    };
    
    fbSaveLocation(newLocation).then(() => {
        closeModal('addLocationModal');
        showToast('Location added successfully!');
        document.getElementById('addLocationForm').reset();
    }).catch(err => {
        console.error(err);
        showToast('Error saving location!', 'error');
    });
}

function addMaintenanceRecord() {
    if (!store.selectedLocation) {
        showToast('Select a location first', 'info');
        return;
    }
    document.getElementById('mrType').value = 'Repair';
    document.getElementById('mrDescription').value = '';
    document.getElementById('mrDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('mrJobNumber').value = '';
    document.getElementById('maintenanceRecordModal').classList.remove('hidden');
}

function saveMaintenanceRecord(event) {
    event.preventDefault();
    if (!store.selectedLocation) { showToast('No location selected', 'error'); return; }

    const newRecord = {
        id: store.maintenanceRecords.length
            ? Math.max(...store.maintenanceRecords.map(r => r.id)) + 1
            : 1,
        location_id: store.selectedLocation,
        job_card_id: null,
        maintenance_type: document.getElementById('mrType').value,
        description: document.getElementById('mrDescription').value,
        date: document.getElementById('mrDate').value,
        job_number: document.getElementById('mrJobNumber').value || null
    };

    store.maintenanceRecords.push(newRecord);
    closeModal('maintenanceRecordModal');
    selectLocation(store.selectedLocation);   // refresh history panel
    showToast('Maintenance record added!');
}

// =============================================
// ZONE MANAGEMENT (req 10 - add / remove zones)
// =============================================
function openZoneManager() {
    document.getElementById('newZoneName').value = '';
    renderZoneManagerList();
    document.getElementById('zoneManagerModal').classList.remove('hidden');
}

function renderZoneManagerList() {
    const container = document.getElementById('zoneManagerList');
    container.innerHTML = store.zones.map(z => {
        const locCount = store.locations.filter(l => l.zone_id === z.id).length;
        return `
        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
                <p class="font-medium text-slate-700">${z.name}</p>
                <p class="text-xs text-slate-400">${locCount} location${locCount === 1 ? '' : 's'}</p>
            </div>
            <button onclick="removeZone('${z.id}')" class="text-rose-600 hover:bg-rose-50 px-3 py-1 rounded-lg text-sm font-medium">Remove</button>
        </div>`;
    }).join('') || '<p class="text-slate-500 text-center py-6">No zones defined</p>';
}

function addZone() {
    const name = document.getElementById('newZoneName').value.trim();
    if (!name) { showToast('Enter a zone name', 'info'); return; }

    const id = name.replace(/\s+/g, '-');
    if (store.zones.some(z => z.id === id || z.name.toLowerCase() === name.toLowerCase())) {
        showToast('Zone already exists', 'error');
        return;
    }

    store.zones.push({ id, name });
    document.getElementById('newZoneName').value = '';
    renderZoneManagerList();
    renderZoneSelectors();
    showToast(`Zone "${name}" added`);
}

function removeZone(zoneId) {
    const locCount = store.locations.filter(l => l.zone_id === zoneId).length;
    if (locCount > 0) {
        showToast(`Cannot remove: ${locCount} location(s) still assigned to this zone`, 'error');
        return;
    }
    if (store.zones.length <= 1) {
        showToast('At least one zone must remain', 'error');
        return;
    }

    store.zones = store.zones.filter(z => z.id !== zoneId);
    if (store.currentZone === zoneId) {
        store.currentZone = store.zones[0].id;
    }
    renderZoneManagerList();
    renderZoneSelectors();
    renderMaintenance();
    showToast('Zone removed');
}

// Rebuild every zone-bound <select> from store.zones, preserving valid selections
function renderZoneSelectors() {
    const optionsHtml = store.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');

    ['zoneSelector', 'locZone'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = optionsHtml;
        if (store.zones.some(z => z.id === prev)) {
            sel.value = prev;
        } else if (selId === 'zoneSelector') {
            sel.value = store.currentZone;
        }
    });
}

// =============================================
// REPORTS
// =============================================
function renderReports() {
    renderDailyReport();
    renderMonthlyReport();
    renderInventoryReport();
}

function switchReportTab(tab) {
    document.querySelectorAll('.report-tab').forEach(t => {
        t.classList.remove('border-green-600', 'text-green-600', 'bg-green-50', 'border-b-2');
        t.classList.add('text-slate-500');
    });
    document.querySelectorAll('.report-tab-content').forEach(c => c.classList.add('hidden'));
    
    event.target.classList.remove('text-slate-500');
    event.target.classList.add('border-green-600', 'text-green-600', 'bg-green-50', 'border-b-2');
    document.getElementById(`reportTab-${tab}`).classList.remove('hidden');
}

function renderDailyReport() {
    // Stats
    document.getElementById('rptActiveProjects').textContent = store.workOrders.filter(wo => wo.type === 'PROJECT' && wo.status === 'Active' && wo.zone_id === store.currentZone).length;
    document.getElementById('rptActiveJobs').textContent = store.workOrders.filter(wo => wo.type === 'JOB' && wo.status === 'Active' && wo.zone_id === store.currentZone).length;
    document.getElementById('rptTodayTasks').textContent = store.workOrders.filter(wo => wo.type === 'TASK' && wo.status === 'Active' && wo.zone_id === store.currentZone).length;
    
    const zoneSailors = store.sailors.filter(s => s.zone_assigned === store.currentZone);
    const avgPerf = zoneSailors.length ? (zoneSailors.reduce((sum, s) => sum + s.avgScore, 0) / zoneSailors.length) : 0;
    document.getElementById('rptAvgPerf').textContent = avgPerf.toFixed(1);
    
    const feedbacks = store.jobCards.filter(jc => jc.feedbackReceived && jc.feedback && jc.zone_id === store.currentZone);
    const avgFeedback = feedbacks.length ? feedbacks.reduce((sum, jc) => sum + jc.feedback.overall, 0) / feedbacks.length : 0;
    document.getElementById('rptUserFeedback').textContent = avgFeedback.toFixed(1);
    
    // State Board - dynamically calculate from zoneSailors
    const trades = ['MA', 'CA', 'PA', 'PL', 'WE', 'RW', 'AL', 'SW', 'BB'];
    document.getElementById('stateBoard').innerHTML = trades.map(trade => {
        const tradeSailors = zoneSailors.filter(s => s.trade === trade);
        const strength = tradeSailors.length;
        const present = tradeSailors.filter(s => s.status === 'Active' || s.status === 'Available' || s.status === 'Assigned' || (s.attendance || 'Present') === 'Present').length;
        const leave = tradeSailors.filter(s => s.status === 'Leave' || (s.attendance || '') === 'Leave').length;
        const sick = tradeSailors.filter(s => s.status === 'Sick' || (s.attendance || '') === 'Sick').length;
        const deployed = tradeSailors.filter(s => s.status === 'Assigned').length;
        return `
            <tr>
                <td class="px-4 py-3 font-medium">${trade}</td>
                <td class="px-4 py-3 text-center">${strength}</td>
                <td class="px-4 py-3 text-center text-green-600 font-medium">${present}</td>
                <td class="px-4 py-3 text-center text-amber-600">${leave}</td>
                <td class="px-4 py-3 text-center text-red-600">${sick}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">${deployed}</span></td>
            </tr>
        `;
    }).join('');
    
    // Top Performers
    const topSailors = zoneSailors.sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
    document.getElementById('topPerformers').innerHTML = topSailors.map((s, i) => `
        <div class="p-3 flex items-center gap-3">
            <span class="w-8 h-8 flex items-center justify-center rounded-full ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-600' : 'bg-slate-200'} text-white font-bold text-sm">
                ${i + 1}
            </span>
            <div class="flex-1">
                <p class="font-medium text-slate-700 text-sm">${s.name}</p>
                <p class="text-xs text-slate-500">${s.trade} • ${s.rank}</p>
            </div>
            <span class="text-lg font-bold ${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span>
        </div>
    `).join('');
    
    // User Feedback Summary
    document.getElementById('userFeedbackSummary').innerHTML = `
        <div class="text-center mb-4">
            <p class="text-4xl font-bold text-purple-600">${avgFeedback.toFixed(1)}</p>
            <p class="text-sm text-slate-500">Average User Rating</p>
        </div>
        <div class="space-y-2">
            ${['Productivity', 'Workmanship', 'Communication', 'Professionalism', 'Satisfaction'].map(cat => {
                const key = cat.toLowerCase();
                const avg = feedbacks.length ? 
                    feedbacks.reduce((sum, jc) => sum + (jc.feedback[key] || 0), 0) / feedbacks.length : 0;
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
            }).join('')}
        </div>
    `;
}

function renderMonthlyReport() {
    // Set current month/year
    document.getElementById('monthSelect').value = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('yearSelect').value = new Date().getFullYear();
    
    loadMonthlyReport();
}

function loadMonthlyReport() {
    const zoneJobCards = store.jobCards.filter(jc => jc.zone_id === store.currentZone);
    const zoneJobCardIds = new Set(zoneJobCards.map(jc => String(jc.id)));
    const zoneLabor = store.jobCardLabor.filter(l => zoneJobCardIds.has(String(l.job_card_id)));
    
    // Job Card Costs
    const totalMaterialCost = zoneJobCards.reduce((sum, jc) => sum + jc.total_material_cost, 0);
    document.getElementById('monthlyJobCardCosts').innerHTML = `
        <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-blue-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-blue-600">${zoneJobCards.length}</p>
                <p class="text-xs text-slate-500">Total Job Cards</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-green-600">${zoneJobCards.filter(j => j.status === 'Completed').length}</p>
                <p class="text-xs text-slate-500">Completed</p>
            </div>
            <div class="bg-amber-50 p-4 rounded-lg text-center">
                <p class="text-lg font-bold text-amber-600">${formatCurrency(totalMaterialCost)}</p>
                <p class="text-xs text-slate-500">Total Material Cost</p>
            </div>
        </div>
        <div class="space-y-2">
            ${zoneJobCards.slice(0, 5).map(jc => `
                <div class="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                        <span class="mono text-sm text-blue-600">${jc.job_number}</span>
                        <p class="text-xs text-slate-500 truncate max-w-xs">${jc.description}</p>
                    </div>
                    <span class="font-medium text-green-600">${formatCurrency(jc.total_material_cost)}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    // Labor Involvement
    const totalManDays = zoneLabor.reduce((sum, l) => sum + (l.hours / 8), 0);
    const laborByTrade = {};
    zoneLabor.forEach(l => {
        const sailor = store.sailors.find(s => s.id === l.sailor_id);
        if (sailor) {
            if (!laborByTrade[sailor.trade]) laborByTrade[sailor.trade] = 0;
            laborByTrade[sailor.trade] += l.hours / 8;
        }
    });
    
    document.getElementById('monthlyLaborInvolvement').innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-blue-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-blue-600">${totalManDays.toFixed(1)}</p>
                <p class="text-xs text-slate-500">Total Man-Days</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
                <p class="text-2xl font-bold text-purple-600">${[...new Set(zoneLabor.map(l => l.sailor_id))].length}</p>
                <p class="text-xs text-slate-500">Workers Involved</p>
            </div>
        </div>
        <div class="space-y-2">
            ${Object.entries(laborByTrade).map(([trade, days]) => `
                <div class="flex items-center justify-between">
                    <span class="text-sm text-slate-600">${trade}</span>
                    <div class="flex items-center gap-2">
                        <div class="w-32 h-2 bg-slate-200 rounded-full">
                            <div class="h-2 bg-blue-500 rounded-full" style="width: ${(days / totalManDays) * 100}%"></div>
                        </div>
                        <span class="font-medium w-12 text-right">${days.toFixed(1)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Monthly Top Performers
    const zoneSailors = store.sailors.filter(s => s.zone_assigned === store.currentZone);
    const topPerformers = zoneSailors.sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
    document.getElementById('monthlyTopPerformers').innerHTML = topPerformers.map((s, i) => `
        <div class="p-3 flex items-center gap-3">
            <span class="w-8 h-8 flex items-center justify-center rounded-full ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-600' : 'bg-slate-200'} text-white font-bold text-sm">
                ${i + 1}
            </span>
            <div class="flex-1">
                <p class="font-medium text-slate-700 text-sm">${s.name}</p>
                <p class="text-xs text-slate-500">${s.trade}</p>
            </div>
            <span class="text-lg font-bold ${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span>
        </div>
    `).join('');
}

function renderInventoryReport() {
    filterInventoryReport();
}

function filterInventoryReport() {
    let items = store.inventory.filter(i => !i.zone_id || i.zone_id === store.currentZone);
    
    // Search
    const search = document.getElementById('invReportSearch')?.value?.toLowerCase() || '';
    if (search) {
        items = items.filter(i => (i.description || "").toLowerCase().includes(search));
    }
    
    // Category filter
    const category = document.getElementById('invReportCategory')?.value || '';
    if (category) {
        items = items.filter(i => i.category === category);
    }
    
    // Sort
    const sort = document.getElementById('invReportSort')?.value || 'description';
    items.sort((a, b) => {
        switch(sort) {
            case 'quantity_asc': return a.quantity - b.quantity;
            case 'quantity_desc': return b.quantity - a.quantity;
            case 'value': return (b.quantity * b.cost_per_unit) - (a.quantity * a.cost_per_unit);
            default: return a.description.localeCompare(b.description);
        }
    });
    
    const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.cost_per_unit), 0);
    
    document.getElementById('inventoryReportBody').innerHTML = items.map(item => {
        const value = item.quantity * item.cost_per_unit;
        const status = item.quantity < 10 ? 'Low Stock' : item.quantity < 20 ? 'Medium' : 'Good';
        const statusColor = item.quantity < 10 ? 'bg-red-100 text-red-700' : item.quantity < 20 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
        
        return `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">${item.description}</td>
                <td class="px-4 py-3 text-center"><span class="text-xs bg-slate-100 px-2 py-1 rounded">${item.category}</span></td>
                <td class="px-4 py-3 text-center">${item.deno}</td>
                <td class="px-4 py-3 text-center font-medium ${item.quantity < 10 ? 'text-red-600' : ''}">${item.quantity}</td>
                <td class="px-4 py-3 text-right">${formatCurrency(item.cost_per_unit)}</td>
                <td class="px-4 py-3 text-right font-medium text-green-600">${formatCurrency(value)}</td>
                <td class="px-4 py-3 text-center"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${item.location}</span></td>
                <td class="px-4 py-3 text-center"><span class="text-xs ${statusColor} px-2 py-1 rounded">${status}</span></td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('totalInventoryValue').textContent = formatCurrency(totalValue);
}

function exportDailyReport() {
    showToast('Generating daily report...', 'info');
    setTimeout(() => showToast('Report exported!'), 1000);
}

function exportMonthlyReport() {
    showToast('Generating monthly report...', 'info');
    setTimeout(() => showToast('Report exported!'), 1000);
}

function exportInventoryReport() {
    showToast('Generating inventory report...', 'info');
    setTimeout(() => showToast('Report exported!'), 1000);
}

// =============================================
// BULK UPLOAD
// =============================================
function openBulkUploadModal(type) {
    document.getElementById('bulkUploadType').value = type;
    document.getElementById('bulkUploadTitle').textContent = type === 'inventory' ? 'Inventory' : 'Locations';
    document.getElementById('bulkUploadFile').value = '';
    document.getElementById('bulkFileName').classList.add('hidden');
    document.getElementById('bulkUploadBtn').disabled = true;
    document.getElementById('bulkUploadBtn').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('bulkUploadModal').classList.remove('hidden');
}

function handleBulkFileSelect(event) {
    const file = event.target.files[0];
    const btn = document.getElementById('bulkUploadBtn');
    const nameDiv = document.getElementById('bulkFileName');
    
    if (file && file.name.endsWith('.csv')) {
        nameDiv.textContent = `Selected: ${file.name}`;
        nameDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        nameDiv.classList.add('hidden');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        if (file) showToast('Please select a valid CSV file', 'error');
    }
}

function downloadCsvTemplate() {
    const type = document.getElementById('bulkUploadType').value;
    let headers = '';
    let filename = '';
    
    if (type === 'inventory') {
        headers = 'Description,Category,Deno,Quantity,Unit Cost,Requirement,Location,On-Charge Ref,Date Added\n';
        filename = 'inventory_template.csv';
    } else if (type === 'locations') {
        headers = 'Zone,Building Name,Sub-location,Description\n';
        filename = 'locations_template.csv';
    } else {
        showToast('Template not available for this type yet', 'info');
        return;
    }
    
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function processCsvUpload() {
    const fileInput = document.getElementById('bulkUploadFile');
    const type = document.getElementById('bulkUploadType').value;
    
    if (!fileInput.files.length) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    document.getElementById('bulkUploadBtn').textContent = 'Uploading...';
    document.getElementById('bulkUploadBtn').disabled = true;
    
    reader.onload = function(e) {
        const text = e.target.result;
        if (type === 'inventory') {
            processInventoryCsv(text);
        } else if (type === 'locations') {
            processLocationsCsv(text);
        }
    };
    reader.readAsText(file);
}

function processInventoryCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
        showToast('CSV is empty or missing data rows', 'error');
        resetBulkUploadBtn();
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let addedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        // Handle basic CSV splitting, this simple split doesn't handle commas inside quotes well
        // Assuming simple data for now
        const values = lines[i].split(',').map(v => v.trim());
        
        let itemData = {};
        headers.forEach((header, index) => {
            if (header === 'description') itemData.description = values[index];
            if (header === 'category') itemData.category = values[index];
            if (header === 'deno') itemData.deno = values[index];
            if (header === 'quantity') itemData.quantity = parseFloat(values[index]) || 0;
            if (header === 'unit cost') itemData.cost_per_unit = parseFloat(values[index]) || 0;
            if (header === 'requirement') itemData.requirement = values[index];
            if (header === 'location') itemData.location = values[index];
            if (header === 'on-charge ref') itemData.on_charge_ref = values[index];
            if (header === 'date added') {
                // If provided date, try to parse it, else use today
                let d = values[index] ? new Date(values[index]) : new Date();
                if (isNaN(d.getTime())) d = new Date();
                itemData.date_added = d.toISOString().split('T')[0];
            }
        });
        
        // Validation - Category and Quantity are required minimums
        if (!itemData.category || isNaN(itemData.quantity)) {
            skippedCount++;
            continue;
        }
        
        // Fill missing strings with empty
        itemData.description = itemData.description || '';
        itemData.deno = itemData.deno || 'Nos';
        itemData.location = itemData.location || 'Zone Store';
        if (!itemData.date_added) itemData.date_added = new Date().toISOString().split('T')[0];
        // Tag with current zone
        itemData.zone_id = store.currentZone;
        
        // Save to Firebase
        fbSaveInventoryItem(itemData);
        addedCount++;
    }
    
    closeModal('bulkUploadModal');
    resetBulkUploadBtn();
    
    if (addedCount > 0) {
        showToast(`Successfully added ${addedCount} items. ${skippedCount > 0 ? skippedCount + ' skipped.' : ''}`);
        // Render will happen automatically via Firebase listener
    } else {
        showToast(`No valid items found to upload. ${skippedCount} skipped.`, 'error');
    }
}

function processLocationsCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
        showToast('CSV is empty or missing data rows', 'error');
        resetBulkUploadBtn();
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let addedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        let itemData = {};
        
        headers.forEach((header, index) => {
            if (header === 'zone') itemData.zone_id = values[index];
            if (header === 'building name') itemData.building_name = values[index];
            if (header === 'sub-location') itemData.sub_location = values[index];
            if (header === 'description') itemData.description = values[index];
        });
        
        // Validation - Zone and Building Name are required
        if (!itemData.zone_id || !itemData.building_name) {
            skippedCount++;
            continue;
        }
        
        itemData.sub_location = itemData.sub_location || '';
        itemData.description = itemData.description || '';
        
        // Save to Firebase
        fbSaveLocation(itemData);
        addedCount++;
    }
    
    closeModal('bulkUploadModal');
    resetBulkUploadBtn();
    
    if (addedCount > 0) {
        showToast(`Successfully added ${addedCount} locations. ${skippedCount > 0 ? skippedCount + ' skipped.' : ''}`);
    } else {
        showToast(`No valid locations found to upload. ${skippedCount} skipped.`, 'error');
    }
}
function resetBulkUploadBtn() {
    const btn = document.getElementById('bulkUploadBtn');
    if (btn) {
        btn.textContent = 'Upload Data';
        btn.disabled = false;
    }
}

// =============================================
// SETTINGS
// =============================================

// Default settings (used if Firebase has nothing)
const defaultSettings = {
    systemTitle: 'NCW-PS v2.2',
    stationName: 'Naval Civil Works \u00b7 Miss Garrison \u00b7 Trincomalee',
    oicName: '',
    oicRank: '',
    oicServiceNo: '',
    oicProfiles: {},
    userName: 'Sanjeewa Bandara',
    userRank: 'PO1 (CE)',
    userServiceNo: 'NRX 12345',
    currency: 'Rs.',
    dateFormat: 'YYYY-MM-DD',
    lowStockLevel: 10,
    zones: [
        { id: 'A-Zone', name: 'A-Zone' },
        { id: 'BC-Zone', name: 'BC-Zone' },
        { id: 'Carpentry-Shop', name: 'Carpentry Shop' },
        { id: 'Welding-Shop', name: 'Welding Shop' },
    ],
    offChargeDestinations: ['SLNS Tissa', 'SLNS Vijaya', 'SLNS Gemunu', 'SLNS Rangalla',
        'BC-Zone', 'A-Zone', 'Carpentry-Shop', 'Welding-Shop', 'Public Supply (Town)'],
    approvalAuthorities: ['CCED(E)', 'CENA', 'DAC(E)', 'DGCE', 'CCEO(E)'],
    workOrderTypes: ['PROJECT', 'ROUTINE', 'EMERGENCY', 'REPAIR'],
    priorityLevels: ['Low', 'Medium', 'High', 'Critical'],
};

// Live settings object (merged from Firebase)
store.settings = { ...defaultSettings };

// ── Load settings from Firebase DB2 ──
function initSettingsListener() {
    opsDB.ref('settings').on('value', snapshot => {
        if (snapshot.exists()) {
            const saved = snapshot.val();
            store.settings = { ...defaultSettings, ...saved };
            // Restore arrays and objects properly
            if (saved.zones) store.settings.zones = saved.zones;
            if (saved.offChargeDestinations) store.settings.offChargeDestinations = saved.offChargeDestinations;
            if (saved.approvalAuthorities) store.settings.approvalAuthorities = saved.approvalAuthorities;
            if (saved.workOrderTypes) store.settings.workOrderTypes = saved.workOrderTypes;
            if (saved.priorityLevels) store.settings.priorityLevels = saved.priorityLevels;
            store.settings.zoneInCharges = saved.zoneInCharges || {};
            store.settings.selectedSettingsZone = saved.selectedSettingsZone || '';
            store.settings.oicProfiles = saved.oicProfiles || {};
        }
        applySettings();
        renderZoneSelectors();
        if (_currentSettingsTab === 'identity') {
            renderSettingsOicProfilesList();
        }
    });
}

// ── Apply loaded settings to the live UI ──
function applySettings() {
    const s = store.settings;
    // Sync store arrays from settings
    store.zones = s.zones || defaultSettings.zones;
    store.offChargeDestinations = s.offChargeDestinations || defaultSettings.offChargeDestinations;
    store.approvalAuthorities = s.approvalAuthorities || defaultSettings.approvalAuthorities;

    // Apply the active profile rules
    applyActiveProfile();

    // Apply header texts
    const titleEl = document.querySelector('h1');
    if (titleEl && s.systemTitle) {
        const vSpan = titleEl.querySelector('span');
        titleEl.childNodes[0].textContent = s.systemTitle.replace(/v\S+$/, '').trim() + ' ';
        if (vSpan) vSpan.textContent = s.systemTitle.match(/v[\d.]+/) ? s.systemTitle.match(/v[\d.]+/)[0] : 'v2.2';
    }
    const brandTag = document.querySelector('.brand-tag');
    if (brandTag && s.stationName) brandTag.textContent = s.stationName;
}

// ── Save a single setting field to Firebase ──
let _settingsSaveTimer = null;
function saveSettingField(key, value) {
    store.settings[key] = value;
    // Debounce — save after 800ms of inactivity
    clearTimeout(_settingsSaveTimer);
    _settingsSaveTimer = setTimeout(() => {
        opsDB.ref('settings').update({ [key]: value }).then(() => {
            const statusEl = document.getElementById('settingsSaveStatus');
            if (statusEl) {
                statusEl.classList.remove('hidden');
                setTimeout(() => statusEl.classList.add('hidden'), 2500);
            }
            applySettings();
            renderZoneSelectors();
        });
    }, 800);
}

// ── Save full array to Firebase ──
function saveSettingsArray(key, arr) {
    store.settings[key] = arr;
    opsDB.ref('settings').update({ [key]: arr }).then(() => {
        applySettings();
        renderZoneSelectors();
        const statusEl = document.getElementById('settingsSaveStatus');
        if (statusEl) { statusEl.classList.remove('hidden'); setTimeout(() => statusEl.classList.add('hidden'), 2000); }
    });
}

// ── Render Settings Page ──
let _currentSettingsTab = 'identity';
function renderSettings() {
    switchSettingsTab(_currentSettingsTab);
}

function switchSettingsTab(tab) {
    _currentSettingsTab = tab;
    document.querySelectorAll('.settings-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.settings-tab-btn').forEach(el => el.classList.remove('active-stab'));
    const contentEl = document.getElementById(`stab-content-${tab}`);
    const btnEl = document.getElementById(`stab-${tab}`);
    if (contentEl) contentEl.classList.remove('hidden');
    if (btnEl) btnEl.classList.add('active-stab');

    // Populate fields for this tab
    const s = store.settings;
    if (tab === 'identity') {
        setValue('cfg-systemTitle', s.systemTitle);
        setValue('cfg-stationName', s.stationName);
        renderSettingsOicProfilesList();
    } else if (tab === 'user') {
        // Populate Zone dropdown
        const zoneDropdown = document.getElementById('cfg-userZone');
        if (zoneDropdown) {
            zoneDropdown.innerHTML = '<option value="">-- Select Zone --</option>' +
                store.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
            zoneDropdown.value = s.selectedSettingsZone || '';
        }

        // Populate values based on selected zone
        const selZone = s.selectedSettingsZone;
        if (selZone && s.zoneInCharges && s.zoneInCharges[selZone]) {
            const inc = s.zoneInCharges[selZone];
            setValue('cfg-userSailorId', inc.sailorId || '');
            const displayName = inc.rank ? `${inc.rank} ${inc.name} (${inc.serviceNo})` : inc.name;
            setValue('cfg-userName', displayName || '');
            setValue('cfg-userRank', inc.rank || '');
            setValue('cfg-userServiceNo', inc.serviceNo || '');
            setValue('cfg-userPassword', inc.password || '');
        } else {
            setValue('cfg-userSailorId', '');
            setValue('cfg-userName', '');
            setValue('cfg-userRank', '');
            setValue('cfg-userServiceNo', '');
            setValue('cfg-userPassword', '');
        }
    } else if (tab === 'zones') {
        renderSettingsZoneList();
    } else if (tab === 'offcharge') {
        renderSettingsOffChargeList();
    } else if (tab === 'workorder') {
        renderSettingsAuthList();
        renderSettingsWoTypeList();
        renderSettingsPriorityList();
    } else if (tab === 'display') {
        setValue('cfg-currency', s.currency);
        setValue('cfg-dateFormat', s.dateFormat);
        setValue('cfg-lowStockLevel', s.lowStockLevel || 10);
    } else if (tab === 'data') {
        checkFirebaseStatus();
    }
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
}

function changeSettingsUserZone(zoneId) {
    store.settings.selectedSettingsZone = zoneId;
    opsDB.ref('settings/selectedSettingsZone').set(zoneId);
    
    // Reload fields for the newly selected zone
    const inc = (store.settings.zoneInCharges || {})[zoneId];
    if (inc) {
        setValue('cfg-userSailorId', inc.sailorId || '');
        const displayName = inc.rank ? `${inc.rank} ${inc.name} (${inc.serviceNo})` : inc.name;
        setValue('cfg-userName', displayName || '');
        setValue('cfg-userRank', inc.rank || '');
        setValue('cfg-userServiceNo', inc.serviceNo || '');
        setValue('cfg-userPassword', inc.password || '');
    } else {
        setValue('cfg-userSailorId', '');
        setValue('cfg-userName', '');
        setValue('cfg-userRank', '');
        setValue('cfg-userServiceNo', '');
        setValue('cfg-userPassword', '');
    }
}

function getEcSailors() {
    return store.sailors.filter(sailor => {
        const offNo = (sailor.official_number || sailor.officialNumber || sailor.service_no || '').trim();
        // Remove leading non-alphanumeric characters (like spaces, slashes, dashes)
        const cleanOffNo = offNo.replace(/^[^a-zA-Z0-9]+/, '');
        return cleanOffNo.toUpperCase().startsWith('EC');
    });
}

// Helper to retrieve all OIC profiles
function getOicProfiles() {
    const s = store.settings || {};
    let profiles = [];
    if (s.oicProfiles) {
        profiles = Object.values(s.oicProfiles);
    }
    // Backward compatibility for the legacy single OIC
    if (profiles.length === 0 && (s.oicName || s.oicServiceNo)) {
        profiles.push({
            id: 'legacy_oic',
            name: s.oicName || '',
            rank: s.oicRank || '',
            serviceNo: s.oicServiceNo || '',
            password: s.oicPassword || ''
        });
    }
    return profiles;
}

// Render OIC Profiles Management List
function renderSettingsOicProfilesList() {
    const listEl = document.getElementById('cfg-oicProfilesList');
    if (!listEl) return;

    const profiles = getOicProfiles();
    if (profiles.length === 0) {
        listEl.innerHTML = `<div class="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">No Officer-In-Charge profiles added yet.</div>`;
        return;
    }

    listEl.innerHTML = profiles.map(p => {
        const cleanNo = p.serviceNo ? p.serviceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
        const shortRank = p.rank ? p.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
        const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
        const avatarHtml = cleanNo ? 
            `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">` :
            fallbackText;

        return `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div class="flex items-center gap-3 min-w-0">
                    ${avatarHtml}
                    <div class="min-w-0 text-left">
                        <p class="text-sm font-bold text-slate-800 truncate">${p.rank} ${p.name}</p>
                        <p class="text-[11px] text-slate-400 font-semibold font-mono">${p.serviceNo} ${p.password ? '• 🔒 Password Protected' : '• 🔓 No Password'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="editOicProfile('${p.id}')" class="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="deleteOicProfile('${p.id}')" class="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openOicProfileModal() {
    document.getElementById('oicProfileModalTitle').textContent = 'Add Officer Profile';
    document.getElementById('oicProfId').value = '';
    document.getElementById('oicProfName').value = '';
    document.getElementById('oicProfRank').value = '';
    document.getElementById('oicProfServiceNo').value = '';
    document.getElementById('oicProfPassword').value = '';
    document.getElementById('oicProfileModal').classList.remove('hidden');
}

function editOicProfile(id) {
    const profile = getOicProfiles().find(p => p.id === id);
    if (!profile) return;

    document.getElementById('oicProfileModalTitle').textContent = 'Edit Officer Profile';
    document.getElementById('oicProfId').value = profile.id;
    document.getElementById('oicProfName').value = profile.name;
    document.getElementById('oicProfRank').value = profile.rank;
    document.getElementById('oicProfServiceNo').value = profile.serviceNo;
    document.getElementById('oicProfPassword').value = profile.password || '';
    document.getElementById('oicProfileModal').classList.remove('hidden');
}

function saveOicProfile(event) {
    event.preventDefault();
    const id = document.getElementById('oicProfId').value;
    const name = document.getElementById('oicProfName').value.trim();
    const rank = document.getElementById('oicProfRank').value.trim();
    const serviceNo = document.getElementById('oicProfServiceNo').value.trim();
    const password = document.getElementById('oicProfPassword').value;

    const profileId = id || 'oic_' + Date.now();

    if (!store.settings.oicProfiles) store.settings.oicProfiles = {};
    store.settings.oicProfiles[profileId] = {
        id: profileId,
        name,
        rank,
        serviceNo,
        password
    };

    opsDB.ref(`settings/oicProfiles/${profileId}`).set({
        id: profileId,
        name,
        rank,
        serviceNo,
        password
    }).then(() => {
        closeModal('oicProfileModal');
        applySettings();
        renderSettingsOicProfilesList();
        showToast('Officer Profile saved successfully');
    });
}

function deleteOicProfile(id) {
    if (!confirm('Are you sure you want to delete this officer profile?')) return;

    if (store.settings.oicProfiles) {
        delete store.settings.oicProfiles[id];
    }

    opsDB.ref(`settings/oicProfiles/${id}`).remove().then(() => {
        applySettings();
        renderSettingsOicProfilesList();
        showToast('Officer Profile deleted');
    });
}

function showSettingsSailorResults() {
    const resultsDiv = document.getElementById('cfg-sailorSearchResults');
    if (!resultsDiv) return;
    resultsDiv.classList.remove('hidden');
    
    const inputVal = document.getElementById('cfg-userName').value.trim();
    // If the input already contains a formatted sailor name, show all when focused
    if (inputVal.includes('(')) {
        filterSettingsSailorResults('');
    } else {
        filterSettingsSailorResults(inputVal);
    }
}

function filterSettingsSailorResults(query) {
    const resultsDiv = document.getElementById('cfg-sailorSearchResults');
    if (!resultsDiv) return;
    
    const ecSailors = getEcSailors();
    const q = query.toLowerCase().trim();
    
    let filtered = ecSailors;
    if (q && !query.includes('(')) {
        filtered = ecSailors.filter(s => {
            const name = (s.name || '').toLowerCase();
            const offNo = (s.official_number || s.officialNumber || s.service_no || '').toLowerCase();
            const rank = (s.rank || '').toLowerCase();
            return name.includes(q) || offNo.includes(q) || rank.includes(q);
        });
    }
    
    let html = `<div onclick="selectSettingsSailor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove In-Charge
    </div>`;
    
    if (filtered.length === 0) {
        html += '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
    } else {
        html += filtered.map(s => {
            const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
            const escDisplayName = displayName.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `<div onclick="selectSettingsSailor('${s.id ?? s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
        }).join('');
    }
    
    resultsDiv.innerHTML = html;
}

function selectSettingsSailor(sailorId, displayName) {
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-userName').value = '';
        document.getElementById('cfg-sailorSearchResults').classList.add('hidden');
        return;
    }
    
    if (sailorId) {
        const sailor = store.sailors.find(s => String(s.id ?? s._fbKey) === String(sailorId));
        if (sailor) {
            setValue('cfg-userName', displayName);
            setValue('cfg-userSailorId', sailorId);
            setValue('cfg-userRank', sailor.rank || '');
            setValue('cfg-userServiceNo', sailor.official_number || sailor.service_no || '');
            
            if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
            store.settings.zoneInCharges[zoneId] = {
                name: sailor.name,
                rank: sailor.rank || '',
                serviceNo: sailor.official_number || sailor.service_no || '',
                sailorId
            };
            
            opsDB.ref(`settings/zoneInCharges/${zoneId}`).set({
                name: sailor.name,
                rank: sailor.rank || '',
                serviceNo: sailor.official_number || sailor.service_no || '',
                sailorId
            }).then(() => {
                applySettings();
                showToast(`In-Charge for ${zoneId} updated to ${sailor.rank} ${sailor.name}`);
            });
        }
    } else {
        // Cleared selection
        setValue('cfg-userName', '');
        setValue('cfg-userSailorId', '');
        setValue('cfg-userRank', '');
        setValue('cfg-userServiceNo', '');
        if (store.settings.zoneInCharges) {
            delete store.settings.zoneInCharges[zoneId];
        }
        opsDB.ref(`settings/zoneInCharges/${zoneId}`).remove().then(() => {
            applySettings();
            showToast(`In-Charge for ${zoneId} removed`);
        });
    }
    
    document.getElementById('cfg-sailorSearchResults').classList.add('hidden');
}

// ── Zone Management ──
function renderSettingsZoneList() {
    const container = document.getElementById('settingsZoneList');
    if (!container) return;
    const zones = store.settings.zones || [];
    container.innerHTML = zones.map((z, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 font-medium text-slate-700 text-sm">${z.name}</span>
            <span class="text-xs text-slate-400 font-mono">${z.id}</span>
            <button onclick="removeZoneFromSettings(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Remove">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('') || '<p class="text-sm text-slate-400 italic p-2">No zones defined</p>';
}

function addZoneFromSettings() {
    const input = document.getElementById('newZoneNameSettings');
    const name = input.value.trim();
    if (!name) return;
    const zones = [...(store.settings.zones || [])];
    const id = name.replace(/\s+/g, '-');
    if (zones.find(z => z.id === id)) { showToast('Zone already exists', 'error'); return; }
    zones.push({ id, name });
    saveSettingsArray('zones', zones);
    input.value = '';
    renderSettingsZoneList();
    showToast(`Zone "${name}" added`);
}

function removeZoneFromSettings(index) {
    const zones = [...(store.settings.zones || [])];
    const removed = zones.splice(index, 1)[0];
    saveSettingsArray('zones', zones);
    renderSettingsZoneList();
    showToast(`Zone "${removed.name}" removed`);
}

// ── Off-Charge Destinations ──
function renderSettingsOffChargeList() {
    const container = document.getElementById('settingsOffChargeList');
    if (!container) return;
    const dests = store.settings.offChargeDestinations || [];
    container.innerHTML = dests.map((d, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 text-sm text-slate-700">${d}</span>
            <button onclick="editOffChargeDest(${i})" class="text-blue-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 text-xs font-medium">Edit</button>
            <button onclick="removeOffChargeDest(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('') || '<p class="text-sm text-slate-400 italic p-2">No destinations defined</p>';
}

function addOffChargeDestination() {
    const input = document.getElementById('newOffChargeDest');
    const val = input.value.trim();
    if (!val) return;
    const dests = [...(store.settings.offChargeDestinations || [])];
    dests.push(val);
    saveSettingsArray('offChargeDestinations', dests);
    input.value = '';
    renderSettingsOffChargeList();
    showToast(`"${val}" added`);
}

function editOffChargeDest(index) {
    const dests = [...(store.settings.offChargeDestinations || [])];
    const newVal = prompt('Edit destination:', dests[index]);
    if (newVal && newVal.trim()) {
        dests[index] = newVal.trim();
        saveSettingsArray('offChargeDestinations', dests);
        renderSettingsOffChargeList();
    }
}

function removeOffChargeDest(index) {
    const dests = [...(store.settings.offChargeDestinations || [])];
    dests.splice(index, 1);
    saveSettingsArray('offChargeDestinations', dests);
    renderSettingsOffChargeList();
}

// ── Approval Authorities ──
function renderSettingsAuthList() {
    const container = document.getElementById('settingsAuthList');
    if (!container) return;
    const auths = store.settings.approvalAuthorities || [];
    container.innerHTML = auths.map((a, i) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="flex-1 text-sm text-slate-700 font-medium">${a}</span>
            <button onclick="editApprovalAuth(${i})" class="text-blue-400 hover:text-blue-600 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50">Edit</button>
            <button onclick="removeApprovalAuth(${i})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');
}

function addApprovalAuthority() {
    const val = document.getElementById('newApprovalAuth').value.trim();
    if (!val) return;
    const arr = [...(store.settings.approvalAuthorities || [])];
    arr.push(val);
    saveSettingsArray('approvalAuthorities', arr);
    document.getElementById('newApprovalAuth').value = '';
    renderSettingsAuthList();
}

function editApprovalAuth(i) {
    const arr = [...(store.settings.approvalAuthorities || [])];
    const v = prompt('Edit authority:', arr[i]);
    if (v && v.trim()) { arr[i] = v.trim(); saveSettingsArray('approvalAuthorities', arr); renderSettingsAuthList(); }
}

function removeApprovalAuth(i) {
    const arr = [...(store.settings.approvalAuthorities || [])];
    arr.splice(i, 1);
    saveSettingsArray('approvalAuthorities', arr);
    renderSettingsAuthList();
}

// ── Work Order Types ──
function renderSettingsWoTypeList() {
    const container = document.getElementById('settingsWoTypeList');
    if (!container) return;
    const types = store.settings.workOrderTypes || [];
    const colors = { PROJECT:'bg-blue-100 text-blue-700', ROUTINE:'bg-green-100 text-green-700', EMERGENCY:'bg-red-100 text-red-700', REPAIR:'bg-amber-100 text-amber-700' };
    container.innerHTML = types.map((t, i) => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors[t] || 'bg-slate-100 text-slate-600'}">
            ${t}
            <button onclick="removeWoType(${i})" class="ml-0.5 opacity-60 hover:opacity-100">✕</button>
        </span>
    `).join('');
}

function addWorkOrderType() {
    const val = document.getElementById('newWoType').value.trim().toUpperCase();
    if (!val) return;
    const arr = [...(store.settings.workOrderTypes || [])];
    if (!arr.includes(val)) { arr.push(val); saveSettingsArray('workOrderTypes', arr); }
    document.getElementById('newWoType').value = '';
    renderSettingsWoTypeList();
}

function removeWoType(i) {
    const arr = [...(store.settings.workOrderTypes || [])];
    arr.splice(i, 1);
    saveSettingsArray('workOrderTypes', arr);
    renderSettingsWoTypeList();
}

// ── Priority Levels ──
function renderSettingsPriorityList() {
    const container = document.getElementById('settingsPriorityList');
    if (!container) return;
    const levels = store.settings.priorityLevels || [];
    const colors = { Low:'bg-green-100 text-green-700', Medium:'bg-yellow-100 text-yellow-700', High:'bg-orange-100 text-orange-700', Critical:'bg-red-100 text-red-700' };
    container.innerHTML = levels.map((l, i) => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors[l] || 'bg-slate-100 text-slate-600'}">
            ${l}
            <button onclick="removePriorityLevel(${i})" class="ml-0.5 opacity-60 hover:opacity-100">✕</button>
        </span>
    `).join('');
}

function addPriorityLevel() {
    const val = document.getElementById('newPriorityLevel').value.trim();
    if (!val) return;
    const arr = [...(store.settings.priorityLevels || [])];
    if (!arr.includes(val)) { arr.push(val); saveSettingsArray('priorityLevels', arr); }
    document.getElementById('newPriorityLevel').value = '';
    renderSettingsPriorityList();
}

function removePriorityLevel(i) {
    const arr = [...(store.settings.priorityLevels || [])];
    arr.splice(i, 1);
    saveSettingsArray('priorityLevels', arr);
    renderSettingsPriorityList();
}

// ── Data Management ──
function checkFirebaseStatus() {
    const iconEl = document.getElementById('fbStatusIcon');
    const textEl = document.getElementById('fbStatusText');
    if (!iconEl || !textEl) return;
    try {
        opsDB.ref('.info/connected').once('value', snap => {
            const connected = snap.val() === true;
            iconEl.textContent = connected ? '✅' : '❌';
            iconEl.style.background = connected ? '#dcfce7' : '#fee2e2';
            textEl.textContent = connected ? 'Connected to ncw-ps-operations' : 'Disconnected — working offline';
        });
    } catch(e) { textEl.textContent = 'Unable to check status'; }
}

function exportAllDataJson() {
    const exportData = {
        exportDate: new Date().toISOString(),
        version: store.settings.systemTitle || 'NCW-PS v2.2',
        settings: store.settings,
        inventory: store.inventory,
        workOrders: store.workOrders,
        jobCards: store.jobCards,
        locations: store.locations,
        maintenanceRecords: store.maintenanceRecords,
        estimates: store.estimates,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ncwps-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('JSON backup downloaded!');
}

function confirmArchiveCompleted() {
    if (!confirm('Status "Completed" ලෙස ඇති Work Orders Firebase එකෙන් remove කරන්නද?\n\nකලින් Export කරන්න නිර්දේශිතයි!')) return;
    const completed = store.workOrders.filter(wo => wo.status === 'Completed');
    let count = 0;
    completed.forEach(wo => {
        const key = wo._fbKey || wo.id;
        if (key) { opsDB.ref(`work_orders/${key}`).remove(); count++; }
    });
    showToast(`${count} completed work orders archived`);
}

function confirmClearInventory() {
    if (!confirm('WARNING: Inventory data සම්පූර්ණයෙන්ම DELETE කරන්නද?\n\nඑකවරම undo කළ නොහැක!')) return;
    if (!confirm('ඔබ 100% ක් සහතිකද?')) return;
    opsDB.ref('inventory').remove().then(() => showToast('All inventory cleared', 'error'));
}

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    renderZoneSelectors();

    // ── Initial render (with empty store — Firebase will populate) ──
    renderDashboard();

    // Set today's date for inventory
    if (document.getElementById('invDate')) {
        document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
    }

    // ── Start Firebase listeners ──
    // DB#1: Load sailors from ce-admin-panel2025 (realtime, read-only)
    initSailorsListener();

    // DB#2: Load & sync all NCW-PS operational data from ncw-ps-operations (realtime, read-write)
    initOpsListeners();

    // DB#3: Load Settings from Firebase DB2
    initSettingsListener();

    console.log('🚀 NCW-PS v2.2 initialized with dual Firebase');
});

// Global event listeners
document.addEventListener('dragleave', (e) => {
    if (e.target.classList) {
        e.target.classList.remove('drag-over');
    }
});

document.addEventListener('click', (e) => {
    const searchInput = document.getElementById('cfg-userName');
    const resultsDiv = document.getElementById('cfg-sailorSearchResults');
    if (searchInput && resultsDiv) {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.classList.add('hidden');
        }
    }
});

// Profile Pic Load Failure Fallback Handler
function handleProfilePicError(img, cleanNo) {
    if (img.src.endsWith('.JPG')) {
        img.src = `images/${cleanNo}.jpg`;
    } else if (img.src.endsWith('.jpg')) {
        img.src = `images/${cleanNo}.png`;
    } else if (img.src.endsWith('.png')) {
        img.src = `images/${cleanNo}.PNG`;
    } else {
        const fallback = img.getAttribute('data-fallback');
        const parent = img.parentElement;
        if (parent) {
            parent.innerHTML = fallback || '';
        }
    }
}

// ── Profile Dropdown and Switching ──
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderProfileDropdown();
        }
    }
}

function renderProfileDropdown() {
    const list = document.getElementById('profileOptionsList');
    if (!list) return;

    const s = store.settings || {};
    let html = '';

    // 1. Command Option
    const isOicActive = !store.activeProfileType || store.activeProfileType === 'OIC';
    const oicSettingsCleanNo = s.oicServiceNo ? s.oicServiceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
    const oicShortRank = s.oicRank ? s.oicRank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
    const oicFallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${oicShortRank}</div>`;
    const oicAvatarHtml = oicSettingsCleanNo ? 
        `<img src="images/${oicSettingsCleanNo}.JPG" data-fallback="${oicFallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${oicSettingsCleanNo}')">` :
        oicFallbackText;

    html += `
        <div onclick="switchActiveProfile('OIC')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isOicActive ? 'bg-teal-50/50' : ''}">
            ${oicAvatarHtml}
            <div class="text-left flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-800">Command / OIC</p>
                <p class="text-[10px] text-slate-400">System Admin • View All Zones</p>
            </div>
            ${isOicActive ? '<span class="text-teal-600 font-bold">✓</span>' : ''}
        </div>
    `;

    // 2. Zone In-Charge Options
    if (store.settings && store.settings.zoneInCharges) {
        Object.entries(store.settings.zoneInCharges).forEach(([zoneId, inc]) => {
            if (!inc || !inc.name) return;
            const isActive = store.activeProfileType === 'ZoneInCharge' && store.activeProfileZone === zoneId;
            const incCleanNo = inc.serviceNo ? inc.serviceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
            const incShortRank = inc.rank ? inc.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
            const incFallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${incShortRank}</div>`;
            const incAvatarHtml = incCleanNo ? 
                `<img src="images/${incCleanNo}.JPG" data-fallback="${incFallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${incCleanNo}')">` :
                incFallbackText;

            html += `
                <div onclick="switchActiveProfile('ZoneInCharge', '${zoneId}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isActive ? 'bg-teal-50/50' : ''}">
                    ${incAvatarHtml}
                    <div class="min-w-0 flex-1 text-left">
                        <p class="text-xs font-bold text-slate-800 truncate">${zoneId} In-Charge</p>
                        <p class="text-[10px] text-slate-505 truncate">${inc.rank} ${inc.name}</p>
                        <p class="text-[9px] text-slate-400 font-mono">${inc.serviceNo}</p>
                    </div>
                    ${isActive ? '<span class="text-teal-600 font-bold">✓</span>' : ''}
                </div>
            `;
        });
    }

    // Add logout button
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
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-userPassword').value = '';
        return;
    }
    if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
    if (!store.settings.zoneInCharges[zoneId]) {
        showToast('Please select a Sailor first', 'error');
        document.getElementById('cfg-userPassword').value = '';
        return;
    }
    store.settings.zoneInCharges[zoneId].password = password;
    opsDB.ref(`settings/zoneInCharges/${zoneId}/password`).set(password).then(() => {
        showToast(`Password for ${zoneId} In-Charge updated`);
    });
}

function switchActiveProfile(type, zoneId = '') {
    const s = store.settings || {};
    let targetPassword = '';
    let targetName = '';
    
    if (type === 'OIC') {
        targetPassword = s.oicPassword || '';
        targetName = s.oicName ? `${s.oicRank} ${s.oicName}` : 'Command / OIC';
    } else if (type === 'ZoneInCharge' && zoneId) {
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        if (inc) {
            targetPassword = inc.password || '';
            targetName = `${inc.rank} ${inc.name} (${zoneId})`;
        }
    }
    
    // If a password is set, show prompt modal instead of switching immediately
    if (targetPassword) {
        document.getElementById('pwdModalTargetType').value = type;
        document.getElementById('pwdModalTargetZone').value = zoneId;
        document.getElementById('pwdModalProfileName').textContent = targetName;
        document.getElementById('profilePasswordInput').value = '';
        
        // Open modal
        document.getElementById('profilePasswordModal').classList.remove('hidden');
        document.getElementById('profilePasswordInput').focus();
        
        // Close dropdown
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }
    
    // No password, switch immediately
    performProfileSwitch(type, zoneId);
}

function submitProfilePassword(e) {
    e.preventDefault();
    const type = document.getElementById('pwdModalTargetType').value;
    const zoneId = document.getElementById('pwdModalTargetZone').value;
    const inputPwd = document.getElementById('profilePasswordInput').value;
    
    const s = store.settings || {};
    let correctPassword = '';
    
    if (type === 'OIC') {
        correctPassword = s.oicPassword || '';
    } else if (type === 'ZoneInCharge' && zoneId) {
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        correctPassword = inc ? (inc.password || '') : '';
    }
    
    if (inputPwd === correctPassword) {
        closeModal('profilePasswordModal');
        performProfileSwitch(type, zoneId);
    } else {
        showToast('Incorrect Password! Authentication failed.', 'error');
        document.getElementById('profilePasswordInput').value = '';
        document.getElementById('profilePasswordInput').focus();
    }
}

function performProfileSwitch(type, zoneId = '', oicProfileId = '') {
    store.activeProfileType = type;
    store.activeProfileZone = zoneId;

    // Save to localStorage
    localStorage.setItem('ncw_ps_active_profile_type', type);
    localStorage.setItem('ncw_ps_active_profile_zone', zoneId);
    localStorage.setItem('ncw_ps_active_oic_profile_id', oicProfileId);

    // Apply active profile rules
    applyActiveProfile();

    // Switch view to dashboard to avoid staying on locked pages
    switchView('dashboard');

    // Refresh view
    refreshCurrentView();

    // Show toast
    if (type === 'OIC') {
        showToast('Switched to Command / OIC Profile');
    } else {
        showToast(`Logged in as In-Charge for ${zoneId}`);
    }
}

function applyActiveProfile() {
    // Read profile from localStorage
    const savedType = localStorage.getItem('ncw_ps_active_profile_type');
    const savedZone = localStorage.getItem('ncw_ps_active_profile_zone');
    const loginScreen = document.getElementById('loginScreen');

    if (!savedType) {
        // Show login screen if not authenticated
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            populateLoginProfiles();
        }
        return;
    } else {
        // Hide login screen if authenticated
        if (loginScreen) loginScreen.classList.add('hidden');
        store.activeProfileType = savedType;
        store.activeProfileZone = savedZone || '';
        store.activeOicProfileId = localStorage.getItem('ncw_ps_active_oic_profile_id') || '';
    }

    const type = store.activeProfileType;
    const zoneId = store.activeProfileZone;
    const s = store.settings || {};
    const zoneSelector = document.getElementById('zoneSelector');

    if (type === 'ZoneInCharge' && zoneId) {
        // We no longer lock the zone dropdown or hide the settings tab for Zone In-Charges,
        // giving all authenticated officers full access (same as overall OIC).
        store.currentZone = zoneId;
        if (zoneSelector) {
            zoneSelector.value = zoneId;
            zoneSelector.disabled = false;
            zoneSelector.title = "Select Zone";
            zoneSelector.classList.remove('opacity-75', 'cursor-not-allowed');
        }

        // Set active user info from settings
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        if (inc) {
            store.currentUser = {
                name: inc.name,
                rank: inc.rank,
                serviceNo: inc.serviceNo
            };
        } else {
            // Fallback if settings are deleted
            store.currentUser = { name: s.userName, rank: s.userRank, serviceNo: s.userServiceNo };
        }

        // Settings tab remains visible for everyone (OIC-level access)
        const settingsTabBtn = document.getElementById('tab-settings');
        if (settingsTabBtn) {
            settingsTabBtn.classList.remove('hidden');
        }
        const mobileSettingsTabBtn = document.getElementById('mobile-tab-settings');
        if (mobileSettingsTabBtn) {
            mobileSettingsTabBtn.classList.remove('hidden');
        }

        // Update profile menu button text or picture to rank + zone
        const profileBtn = document.getElementById('profileMenuBtn');
        if (profileBtn) {
            const shortRank = store.currentUser.rank ? store.currentUser.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
            const shortZone = zoneId.split('-')[0];
            const fallbackText = `<span class="block">${shortRank}</span><span class="block text-[8px] text-teal-300 font-medium">${shortZone}</span>`;
            const cleanNo = store.currentUser.serviceNo ? store.currentUser.serviceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
            
            if (cleanNo) {
                profileBtn.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover rounded-full" onerror="handleProfilePicError(this, '${cleanNo}')">`;
            } else {
                profileBtn.innerHTML = fallbackText;
            }
            profileBtn.style.fontSize = '9px';
            profileBtn.style.lineHeight = '1.1';
            profileBtn.style.whiteSpace = 'pre-line';
        }

        // Update active profile texts in dropdown
        const activeNameEl = document.getElementById('profileActiveName');
        const activeRoleEl = document.getElementById('profileActiveRole');
        if (activeNameEl) activeNameEl.textContent = `${store.currentUser.rank} ${store.currentUser.name}`;
        if (activeRoleEl) activeRoleEl.textContent = `${zoneId} In-Charge`;

    } else {
        // Command / OIC Profile
        if (zoneSelector) {
            zoneSelector.disabled = false;
            zoneSelector.title = "Select Zone";
            zoneSelector.classList.remove('opacity-75', 'cursor-not-allowed');
        }

        // Set active user info to overall OIC
        let oicName = s.oicName || s.userName;
        let oicRank = s.oicRank || s.userRank;
        let oicServiceNo = s.oicServiceNo || s.userServiceNo;

        if (oicProfileId) {
            const profile = getOicProfiles().find(p => p.id === oicProfileId);
            if (profile) {
                oicName = profile.name;
                oicRank = profile.rank;
                oicServiceNo = profile.serviceNo;
            }
        }

        store.currentUser = {
            name: oicName,
            rank: oicRank,
            serviceNo: oicServiceNo
        };

        // Enable settings tab (Desktop & Mobile)
        const settingsTabBtn = document.getElementById('tab-settings');
        if (settingsTabBtn) {
            settingsTabBtn.classList.remove('hidden');
        }
        const mobileSettingsTabBtn = document.getElementById('mobile-tab-settings');
        if (mobileSettingsTabBtn) {
            mobileSettingsTabBtn.classList.remove('hidden');
        }

        // Update profile menu button text or picture to "OIC" or rank
        const profileBtn = document.getElementById('profileMenuBtn');
        if (profileBtn) {
            const shortRank = store.currentUser.rank ? store.currentUser.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
            const fallbackText = shortRank;
            const cleanNo = store.currentUser.serviceNo ? store.currentUser.serviceNo.replace(/[^a-zA-Z0-9]/g, '') : '';

            if (cleanNo) {
                profileBtn.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover rounded-full" onerror="handleProfilePicError(this, '${cleanNo}')">`;
            } else {
                profileBtn.innerHTML = fallbackText;
            }
            profileBtn.style.fontSize = '10px';
            profileBtn.style.lineHeight = 'normal';
            profileBtn.style.whiteSpace = 'normal';
        }

        // Update active profile texts in dropdown
        const activeNameEl = document.getElementById('profileActiveName');
        const activeRoleEl = document.getElementById('profileActiveRole');
        if (activeNameEl) activeNameEl.textContent = store.currentUser.name ? `${store.currentUser.rank} ${store.currentUser.name}` : 'Command / OIC';
        if (activeRoleEl) activeRoleEl.textContent = `System Administrator`;
    }

    // Update OIC badge/profile button title
    const profileBtn = document.getElementById('profileMenuBtn');
    if (profileBtn) {
        profileBtn.title = `Profile: ${store.currentUser.rank} ${store.currentUser.name} (${store.currentUser.serviceNo})`;
    }

    // Refresh profile dropdown list to update checkmarks
    renderProfileDropdown();
}

// Window click listener to close profile dropdown
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('profileDropdown');
    const btn = document.getElementById('profileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// =============================================
// LOGIN PORTAL WORKFLOW
// =============================================
function populateLoginProfiles() {
    const select = document.getElementById('loginProfileSelect');
    if (!select) return;

    const s = store.settings || {};
    let options = '<option value="">-- Choose Profile --</option>';

    // 1. Command / OIC Profiles
    const oicProfs = getOicProfiles();
    oicProfs.forEach(p => {
        options += `<option value="OICProfile:${p.id}" data-service-no="${p.serviceNo || ''}" data-rank="${p.rank || 'OIC'}" data-name="${p.name || ''}">OIC Profile: ${p.rank} ${p.name}</option>`;
    });
    
    if (oicProfs.length === 0) {
        options += `<option value="OIC" data-service-no="${s.oicServiceNo || ''}" data-rank="${s.oicRank || 'OIC'}" data-name="${s.oicName || ''}">Command / OIC</option>`;
    }

    // 2. Zone In-Charges
    if (s.zoneInCharges) {
        Object.entries(s.zoneInCharges).forEach(([zoneId, inc]) => {
            if (!inc || !inc.name) return;
            options += `<option value="ZoneInCharge:${zoneId}" data-service-no="${inc.serviceNo || ''}" data-rank="${inc.rank || 'OIC'}" data-name="${inc.name || ''}">${zoneId} In-Charge (${inc.name})</option>`;
        });
    }

    select.innerHTML = options;
}

function onLoginProfileChange(val) {
    const container = document.getElementById('loginAvatarContainer');
    const pwdGroup = document.getElementById('loginPasswordGroup');
    const pwdInput = document.getElementById('loginPasswordInput');
    
    if (!val) {
        container.innerHTML = '<span class="text-3xl">⚓</span>';
        pwdGroup.classList.add('hidden');
        return;
    }

    const select = document.getElementById('loginProfileSelect');
    const selectedOpt = select.options[select.selectedIndex];
    const serviceNo = selectedOpt.getAttribute('data-service-no') || '';
    const cleanNo = serviceNo.replace(/[^a-zA-Z0-9]/g, '');
    const rank = selectedOpt.getAttribute('data-rank') || 'OIC';
    const name = selectedOpt.getAttribute('data-name') || '';
    
    // Check if target profile has password
    const s = store.settings || {};
    let hasPassword = false;
    
    if (val === 'OIC') {
        hasPassword = !!s.oicPassword;
    } else if (val.startsWith('OICProfile:')) {
        const profileId = val.split(':')[1];
        const profile = getOicProfiles().find(p => p.id === profileId);
        hasPassword = profile && !!profile.password;
    } else if (val.startsWith('ZoneInCharge:')) {
        const zoneId = val.split(':')[1];
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        hasPassword = inc && !!inc.password;
    }
    
    if (hasPassword) {
        pwdGroup.classList.remove('hidden');
        pwdInput.required = true;
        pwdInput.value = '';
    } else {
        pwdGroup.classList.add('hidden');
        pwdInput.required = false;
        pwdInput.value = '';
    }

    // Set avatar
    const shortRank = rank.replace(/[a-z\s()]/gi, '').substring(0,3) || 'OIC';
    const fallbackText = `<div class="w-full h-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-lg">${shortRank}</div>`;
    
    if (cleanNo) {
        container.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
    } else {
        container.innerHTML = fallbackText;
    }
}

function submitLogin(e) {
    e.preventDefault();
    const val = document.getElementById('loginProfileSelect').value;
    if (!val) return;
    
    const pwdInput = document.getElementById('loginPasswordInput');
    const inputPwd = pwdInput.value;
    
    const s = store.settings || {};
    let correctPassword = '';
    let type = 'OIC';
    let zoneId = '';
    
    let oicProfileId = '';
    if (val === 'OIC') {
        correctPassword = s.oicPassword || '';
        type = 'OIC';
    } else if (val.startsWith('OICProfile:')) {
        oicProfileId = val.split(':')[1];
        const profile = getOicProfiles().find(p => p.id === oicProfileId);
        correctPassword = profile ? (profile.password || '') : '';
        type = 'OIC';
    } else if (val.startsWith('ZoneInCharge:')) {
        zoneId = val.split(':')[1];
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        correctPassword = inc ? (inc.password || '') : '';
        type = 'ZoneInCharge';
    }
    
    if (correctPassword && inputPwd !== correctPassword) {
        showToast('Incorrect Password! Access Denied.', 'error');
        pwdInput.value = '';
        pwdInput.focus();
        return;
    }
    
    // Login successful!
    performProfileSwitch(type, zoneId, oicProfileId);
    
    // Hide login screen
    document.getElementById('loginScreen').classList.add('hidden');
}

function logoutProfile() {
    localStorage.removeItem('ncw_ps_active_profile_type');
    localStorage.removeItem('ncw_ps_active_profile_zone');
    localStorage.removeItem('ncw_ps_active_oic_profile_id');
    store.activeProfileType = null;
    store.activeProfileZone = null;
    store.activeOicProfileId = null;
    
    // Show login screen
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
        populateLoginProfiles();
        document.getElementById('loginProfileSelect').value = '';
        onLoginProfileChange('');
    }
    
    // Close dropdown
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    
    showToast('Logged out successfully.');
}

























