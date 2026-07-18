// =============================================
// PWA SERVICE WORKER REGISTRATION
// =============================================
// Force unregister all service workers and clear cache to resolve browser caching bugs
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister().then(() => {
                console.log('⚓ Active Service Worker unregistered!');
            });
        }
    });
}
if ('caches' in window) {
    caches.keys().then(names => {
        for (let name of names) {
            caches.delete(name);
        }
        console.log('⚓ All caches cleared!');
    });
}

// Custom PWA Installer trigger variables and listeners
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('⚓ PWA Installable prompt intercepted!');
    // Show our custom header install button
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
    // Refresh the profile dropdown to show the install button if open
    renderProfileDropdown();
});

window.addEventListener('appinstalled', (evt) => {
    console.log('⚓ NCW-PS PWA was installed successfully!');
    deferredPrompt = null;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.classList.add('hidden');
    }
    renderProfileDropdown();
});

function triggerPwaInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('⚓ User accepted PWA installation');
        } else {
            console.log('⚓ User dismissed PWA installation');
        }
        deferredPrompt = null;
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) {
            installBtn.classList.add('hidden');
        }
        renderProfileDropdown();
    });
}

// Global Runtime Error Alert for Remote Debugging
window.addEventListener('error', function(e) {
    const errDiv = document.createElement('div');
    errDiv.style.position = 'fixed';
    errDiv.style.top = '0';
    errDiv.style.left = '0';
    errDiv.style.right = '0';
    errDiv.style.background = '#ef4444';
    errDiv.style.color = '#ffffff';
    errDiv.style.padding = '8px';
    errDiv.style.fontSize = '12px';
    errDiv.style.zIndex = '9999';
    errDiv.style.textAlign = 'center';
    errDiv.textContent = 'System Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno;
    document.body.appendChild(errDiv);
});

// =============================================
// NCW-PS v2.2 - Naval Civil Works Productivity Suite
// Main Application JavaScript
// =============================================

// =============================================
// ADMIN & STAFF DUTIES ZONE HELPER
// The zone ID may be stored as 'Admin-&-Staff-Duties', 'Admin & Staff Duties',
// 'Admin-Staff-Duties' etc. This helper normalizes the check.
// =============================================
function isAdminStaffDuties(zoneIdOrName) {
    if (!zoneIdOrName) return false;
    const normalized = zoneIdOrName.toLowerCase().replace(/[-&\s]+/g, '');
    return normalized === 'adminstaffduties';
}

function parseOfficialNumber(offNo) {
    if (!offNo) return { type: '•', num: '-' };
    const clean = offNo.trim();
    const match = clean.match(/^([A-Za-z\/&]+)\s*(\d+[A-Za-z]*)$/);
    if (match) {
        return { type: match[1], num: match[2] };
    }
    const parts = clean.split(/[\s]+/);
    if (parts.length > 1) {
        return { type: parts[0], num: parts.slice(1).join(' ') };
    }
    if (/^\d+$/.test(clean)) {
        return { type: '•', num: clean };
    }
    return { type: '•', num: clean };
}

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
    availableSailorsLimit: 40,
    dailyAllocationsMap: {},

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

// Helper to safely parse cost, handling commas and string prefixes like "Rs."
function safeParseCost(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    let str = String(val).toLowerCase();
    // Remove rs, rs., commas, and spaces
    str = str.replace(/rs\.?/g, '').replace(/,/g, '').replace(/\s/g, '');
    
    // Strip any remaining characters that are not digits or decimal point
    str = str.replace(/[^0-9.]/g, '');
    
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

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
                trade:           (() => {
                    const t = (s.trade ?? s.tradeName ?? s.trade_name ?? 'MA').trim().toUpperCase();
                    return t === 'WEL' ? 'WE' : t;
                })(),
                category:        (() => {
                    const o = (offNo ?? '').trim().toUpperCase();
                    if (o.startsWith('EC')) return 'Regular';
                    if (o.startsWith('AC')) return 'Artificer';
                    if (o.startsWith('VAS')) return 'VAS';
                    return s.category ?? s.cat ?? 'Regular';
                })(),
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

        // Re-render personal sailor dashboard if active profile is Sailor
        if (store.activeProfileType === 'Sailor') {
            renderSailorDashboardView();
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

function standardizeInventoryDescription(desc) {
    if (!desc) return '';
    let clean = desc.trim();
    
    // Remove wrapping quotes if present
    if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.substring(1, clean.length - 1).trim();
    }
    
    // Replace double double-quotes "" with a single double-quote "
    clean = clean.replace(/""/g, '"');
    
    // Also remove leading/trailing quotes that might have been left over if they were unbalanced
    if (clean.startsWith('"')) clean = clean.substring(1).trim();
    if (clean.endsWith('"')) clean = clean.substring(0, clean.length - 1).trim();
    
    // Replace multiple spaces with a single space
    clean = clean.replace(/\s+/g, ' ');
    
    // Perform case-insensitive spelling auto-corrections
    clean = clean.replace(/\bball\s+cocks?\b/gi, 'Ballcock Valve');
    clean = clean.replace(/\bceiling\s+paints?\s+whites?\b/gi, 'Ceiling White');
    clean = clean.replace(/\bmac\s+foils?\b/gi, 'Mackfoil');
    clean = clean.replace(/\bbriliyant\s+whites?\b/gi, 'Briliant White');
    clean = clean.replace(/\broopings?\b/gi, 'Roofing');
    clean = clean.replace(/\blbows?\b/gi, 'Elbow');
    clean = clean.replace(/\bl\/\s*bows?\b/gi, 'Elbow');
    clean = clean.replace(/\bfexibal\b/gi, 'Flexible');
    clean = clean.replace(/\bpenal\s+pins?\b/gi, 'Panel Pin');
    clean = clean.replace(/\bgrinder\s+dise\b/gi, 'Grinder Disc');
    clean = clean.replace(/\brollel\s+brash\b/gi, 'Roler Brush');
    clean = clean.replace(/\bms\s+plte\b/gi, 'MS Plate');
    clean = clean.replace(/\bms\s+plete\b/gi, 'MS Plate');
    clean = clean.replace(/\bgipso\s+board\b/gi, 'Gypson Board');
    clean = clean.replace(/\balaminium\s+sealer\b/gi, 'Aluminium Sealer');
    clean = clean.replace(/\banticoresive\b/gi, 'Anticorrosive');

    return toTitleCase(clean);
}

function toTitleCase(str) {
    if (!str) return '';
    const acronyms = ['PVC', 'BMS', 'GI', 'MS', 'SLN', 'UOM', 'VAT', 'ALU'];
    return str.split(' ').map(word => {
        if (!word) return '';
        const upper = word.toUpperCase();
        const cleanWord = upper.replace(/[^A-Z0-9]/g, '');
        if (acronyms.includes(cleanWord)) {
            return upper; // Keep acronyms fully capitalized
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function standardizeInventoryCategory(cat) {
    if (!cat) return 'General';
    const cleaned = cat.trim().toUpperCase();

    const mapping = {
        'METAL': 'Metal',
        'YAKADA': 'Metal',
        'YAD': 'Metal',
        'STANSILE': 'Stencil',
        'STENCIL': 'Stencil',
        'PAINT': 'Paint',
        'PAI': 'Paint',
        'GENERAL': 'General',
        'BMS': 'BMS',
        'TIMBER': 'BMS',
        'PLUMBING': 'Plumbing',
        'PVC': 'Plumbing',
        'ALUMINIUM': 'Aluminium',
        'ALUMINUM': 'Aluminium',
        'ALU': 'Aluminium',
        'ELECTRICAL': 'Electrical',
        'TOOLS': 'Tools',
        'TOOL': 'Tools',
        'LUBRICANT OIL': 'Lubricant Oil',
        'LUBRICANT': 'Lubricant Oil',
        'OIL': 'Lubricant Oil',
        'ENG': 'Eng',
    };

    if (mapping[cleaned]) return mapping[cleaned];

    const standardCats = ['BMS', 'Plumbing', 'Metal', 'Stencil', 'General', 'Aluminium', 'Paint', 'Electrical', 'Tools', 'Lubricant Oil', 'Eng'];
    const matched = standardCats.find(sc => sc.toUpperCase() === cleaned);
    if (matched) return matched;

    return cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1).toLowerCase();
}

function initOpsListeners() {

    // ── Work Orders ──
    opsDB.ref('work_orders').on('value', snapshot => {
        const raw = snapshotToArray(snapshot);
        const today = new Date().toISOString().split('T')[0];
        
        store.workOrders = raw.map(wo => {
            const mappedWo = {
                ...wo,
                id:            wo.id            ?? wo._fbKey,
                assigned:      Array.isArray(wo.assigned) ? wo.assigned : Object.values(wo.assigned ?? {}),
                last_assigned: Array.isArray(wo.last_assigned) ? wo.last_assigned : Object.values(wo.last_assigned ?? {}),
            };

            // Initialise last_assigned_date on first load if it doesn't exist yet
            if (mappedWo.assigned && mappedWo.assigned.length > 0 && !mappedWo.last_assigned_date) {
                mappedWo.last_assigned_date = today;
                if (window.fbSaveWorkOrder) fbSaveWorkOrder(mappedWo);
            }

            // Midnight Auto-Reset: if last_assigned_date is in the past, auto-clear assignments
            if ((mappedWo.status === 'Active' || mappedWo.status === 'Pending') && 
                mappedWo.last_assigned_date && mappedWo.last_assigned_date !== today && 
                mappedWo.assigned && mappedWo.assigned.length > 0) {
                
                console.log(`⏰ Auto-clearing assignments for WO ${mappedWo.id} (new day started)`);
                mappedWo.last_assigned = mappedWo.assigned;
                mappedWo.assigned = [];
                mappedWo.last_assigned_date = today;
                
                if (window.fbSaveWorkOrder) {
                    fbSaveWorkOrder(mappedWo);
                }
            }
            
            return mappedWo;
        });

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

    // Helper to safely parse cost, handling commas and string prefixes like "Rs."
    const safeParseCost = (val) => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        
        let str = String(val).toLowerCase();
        // Remove rs, rs., commas, and spaces
        str = str.replace(/rs\.?/g, '').replace(/,/g, '').replace(/\\s/g, '');
        
        // Strip any remaining characters that are not digits or decimal point
        str = str.replace(/[^0-9.]/g, '');
        
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    const extractCost = (item) => {
        // Known keys
        const knownCost = item.cost_per_unit ?? item.unit_cost ?? item.cost ?? item.price ?? item.Cost ?? item.Price;
        if (knownCost !== undefined && knownCost !== null && knownCost !== '') {
            return safeParseCost(knownCost);
        }
        
        // Dynamic search for any key containing 'cost' or 'price'
        for (let k of Object.keys(item)) {
            let lk = k.toLowerCase();
            if (lk.includes('cost') || lk.includes('price') || lk.includes('rate') || lk.includes('amount')) {
                const parsed = safeParseCost(item[k]);
                if (parsed > 0) return parsed;
            }
        }
        return 0;
    };

    // ── Inventory ──
    opsDB.ref('inventory').on('value', snapshot => {
        store.inventory = snapshotToArray(snapshot).map(item => ({
            ...item, id: item.id ?? item._fbKey,
            category: standardizeInventoryCategory(item.category),
            description: standardizeInventoryDescription(item.description),
            cost_per_unit: extractCost(item),
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
        const arr = snapshotToArray(snapshot);
        store.dailyAllocations = arr;
        const map = {};
        arr.forEach(a => {
            map[`${a.date}_${sanitizeFbKey(a.sailor_id)}`] = a;
        });
        store.dailyAllocationsMap = map;
        refreshCurrentView();
    });

    console.log('🔥 DB#2: All ops listeners attached');
}

// ─────────────────────────────────────────────
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
    return opsDB.ref('work_orders').push({ ...clean, created_at: Date.now() });
}

// Save / update a job card
function fbSaveJobCard(data) {
    const { _fbKey, ...clean } = data;
    if (clean.assigned && clean.assigned.length === 0) {
        clean.assigned = null;
    }
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
    if (clean.category) {
        clean.category = standardizeInventoryCategory(clean.category);
    }
    if (clean.description) {
        clean.description = standardizeInventoryDescription(clean.description);
    }
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
// Sanitize keys for Firebase paths (replaces /, ., #, $, [, ] with -)
function sanitizeFbKey(id) {
    return String(id).replace(/[\/.#$\[\]]/g, '-');
}

function fbSaveDailyAllocation(data) {
    const key = `${data.date}_${sanitizeFbKey(data.sailor_id)}`;
    return opsDB.ref(`daily_allocations/${key}`).set({ ...data, assigned_at: Date.now() });
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
function computeYesterdayJobs() {
    if (!store.dailyAllocations || !store.sailors) return;
    
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    // Find the most recent date in dailyAllocations that is strictly before dateVal
    const pastDates = [...new Set(store.dailyAllocations.map(a => a.date))]
        .filter(d => d < dateVal)
        .sort((a, b) => b.localeCompare(a));
        
    const lastActiveDate = pastDates[0];
    
    store.sailors.forEach(s => {
        s.yesterdayJob = null;
        if (lastActiveDate && store.dailyAllocationsMap) {
            const alloc = store.dailyAllocationsMap[`${lastActiveDate}_${s.id}`];
            if (alloc) {
                s.yesterdayJob = alloc.work_order_id;
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
    const views = ['dashboard','jobcards','inventory','estimates','maintenance','reports','dailydetails','summary','sailors','sailordashboard'];
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
                case 'dailydetails': renderDailyDetailsSpecialView(); break;
                case 'summary':     renderSummaryView();    break;
                case 'sailors':     renderSailorsView();    break;
                case 'sailordashboard': renderSailorDashboardView(); break;
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

let _justClosedModal = false;

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    _justClosedModal = true;
    setTimeout(() => {
        _justClosedModal = false;
    }, 1000);
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
function switchView(view, preventPushState = false) {
    store.currentView = view;
    if (!preventPushState) {
        window.history.pushState({ view: view }, '', `#${view}`);
    }
    if (typeof toggleLeftSidebar === 'function') {
        toggleLeftSidebar(false);
    }
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
        case 'dailydetails': renderDailyDetailsSpecialView(); break;
        case 'summary': renderSummaryView(); break;
        case 'sailors': renderSailorsView(); break;
        case 'sailordashboard': renderSailorDashboardView(); break;
    }
}

function changeZone() {
    store.currentZone = document.getElementById('zoneSelector').value;
    store.selectedEstimate = null;
    store.selectedEstimatesForPrint = [];
    applySettings();
    toggleViewsBasedOnZone();
    refreshCurrentView();
    showToast(`Switched to ${store.currentZone}`);
}

// =============================================
// DASHBOARD
// =============================================
function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const isToday = dateVal === today;

    // Show/hide views and sidebar
    toggleViewsBasedOnZone();

    const summaryTitle = document.getElementById('summaryTitle');
    if (summaryTitle) {
        if (isToday) {
            summaryTitle.textContent = "Today's Operational Summary";
        } else {
            const formatted = new Date(dateVal).toLocaleDateString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
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
    updateBoardEmptyState();
    updateDashboardButtons();
}

function updateDashboardButtons() {
    const currentZoneObj = store.zones.find(z => z.id === store.currentZone);
    const zoneName = currentZoneObj ? currentZoneObj.name : '';
    const zoneId = store.currentZone;

    const isAdminStaff = isAdminStaffDuties(zoneId) || isAdminStaffDuties(zoneName);

    const newAssignBtn = document.getElementById('newAssignBtn');
    const newWorkOrderBtn = document.getElementById('newWorkOrderBtn');
    const btnContinueYesterday = document.getElementById('btnContinueYesterday');

    const today = new Date().toISOString().split('T')[0];
    const isToday = !store.dashboardDate || store.dashboardDate === today;

    if (newAssignBtn) {
        newAssignBtn.classList.toggle('hidden', !isAdminStaff || !isToday);
    }
    if (newWorkOrderBtn) {
        newWorkOrderBtn.classList.toggle('hidden', !isToday);
    }
    if (btnContinueYesterday) {
        btnContinueYesterday.classList.toggle('hidden', !isToday);
    }
}

function changeDashboardDate(val) {
    if (!val) return;
    store.dashboardDate = val;
    renderDashboard();
    
    const today = new Date().toISOString().split('T')[0];
    if (val !== today) {
        showToast(`Viewing historical data for ${val} (Read Only)`, 'info');
    }
}

function isWorkOrderActiveOnDate(wo, dateStr) {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
        return wo.status !== 'Completed' && wo.status !== 'Hold';
    }
    
    // Check if there are daily allocations for this work order on this date
    const hasAllocations = (store.dailyAllocations || []).some(a => 
        a.date === dateStr && String(a.work_order_id) === String(wo.id)
    );
    if (hasAllocations) return true;
    
    // Check if it was created before or on this date and is not completed/held
    if (wo.created_at) {
        const createdDate = new Date(wo.created_at).toISOString().split('T')[0];
        if (createdDate <= dateStr) {
            if (wo.status === 'Completed' || wo.status === 'Hold') {
                const compDate = wo.completed_date || wo.last_commit_date || wo.last_assigned_date || today;
                if (compDate < dateStr) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}

function getSailorAssignmentOnDate(sailorId, dateVal) {
    if (!store.dailyAllocationsMap) return null;
    const alloc = store.dailyAllocationsMap[`${dateVal}_${sanitizeFbKey(sailorId)}`];
    if (alloc) {
        const wo = store.workOrders.find(w => 
            String(w.id) === String(alloc.work_order_id) || 
            String(w._fbKey) === String(alloc.work_order_id)
        );
        if (wo) {
            return {
                ref: wo.reference_no || 'Active WO',
                title: wo.description || '',
                zone: wo.zone_id || ''
            };
        }
    }
    return null;
}

function getSailorCurrentAssignment(sailorId) {
    if (!store.workOrders) return null;
    const activeWo = store.workOrders.find(wo => {
        if (wo.status !== 'Active' && wo.status !== 'Pending') return false;
        const assignedIds = (wo.assigned || []).map(String);
        return assignedIds.includes(String(sailorId));
    });
    if (activeWo) {
        return {
            ref: activeWo.reference_no || 'Active WO',
            title: activeWo.description || '',
            zone: activeWo.zone_id || ''
        };
    }
    return null;
}

function renderAvailableSailors() {
    const container = document.getElementById('availableSailors');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const isToday = dateVal === today;

    // Recalculate status for the selected date
    const assignedIds = new Set();
    if (isToday) {
        (store.workOrders || []).forEach(wo => {
            if ((wo.status === 'Active' || wo.status === 'Pending') && wo.assigned) {
                wo.assigned.forEach(id => assignedIds.add(String(id)));
            }
        });
    } else {
        (store.dailyAllocations || []).forEach(alloc => {
            if (alloc.date === dateVal) {
                assignedIds.add(String(alloc.sailor_id));
            }
        });
    }

    // Support search query
    const searchInput = document.getElementById('sailorSearch');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Reset pagination limit when search query changes
    const lastQuery = container.getAttribute('data-last-query') || '';
    if (query !== lastQuery) {
        store.availableSailorsLimit = 40;
        container.setAttribute('data-last-query', query);
    }

    // When searching, show ALL sailors (651) regardless of attendance/zone/team filters
    // When NOT searching, apply normal filters for a clean default view
    let sailors;
    if (query) {
        sailors = store.sailors.filter(s =>
            (s._searchIndex || '').includes(query) ||
            s.name.toLowerCase().includes(query) ||
            (s.official_number || '').toLowerCase().includes(query) ||
            (s.rank || '').toLowerCase().includes(query) ||
            (s.trade || '').toLowerCase().includes(query)
        );
        // Still apply trade filter if set
        if (store.currentTrade !== 'ALL') {
            sailors = sailors.filter(s => s.trade === store.currentTrade);
        }
    } else {
        sailors = store.sailors.filter(s => (s.attendance || 'Present') === 'Present');
        if (store.currentFilter === 'zone-team') {
            sailors = sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone);
        } else if (store.currentFilter === 'continuation') {
            sailors = sailors.filter(s => s.yesterdayJob !== null);
        }
        if (store.currentTrade !== 'ALL') {
            sailors = sailors.filter(s => s.trade === store.currentTrade);
        }
    }
    
    // Sort unassigned first, then by score
    sailors.sort((a, b) => {
        const aAssigned = assignedIds.has(String(a.id)) || assignedIds.has(String(a._fbKey));
        const bAssigned = assignedIds.has(String(b.id)) || assignedIds.has(String(b._fbKey));
        if (aAssigned !== bAssigned) {
            return aAssigned ? 1 : -1;
        }
        return b.avgScore - a.avgScore;
    });

    // Slice sailors to limit rendering for performance
    const visibleSailors = sailors.slice(0, store.availableSailorsLimit);
    
    let html = visibleSailors.map(sailor => {
        const scoreColor = sailor.avgScore >= 8 ? '#059669' : sailor.avgScore >= 6 ? '#d97706' : '#dc2626';
        const tradeBg = {
            'MA': '#0d9488', 'CA': '#7c3aed', 'PA': '#b45309',
            'PL': '#0891b2', 'WE': '#dc2626', 'RW': '#374151',
            'SW': '#065f46', 'BB': '#1d4ed8', 'AL': '#ec4899'
        }[sailor.trade] || '#475569';

        const assignment = isToday 
            ? getSailorCurrentAssignment(sailor.id ?? sailor._fbKey)
            : getSailorAssignmentOnDate(sailor.id ?? sailor._fbKey, dateVal);

        if (assignment) {
            return `
            <div class="sailor-card rounded-xl p-2.5 border bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed select-none relative group"
                title="Already assigned to ${assignment.ref} in ${assignment.zone}: ${assignment.title}">
                <div class="flex items-center gap-2.5">
                    <div class="relative flex-shrink-0">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm bg-slate-400">${sailor.trade}</div>
                        ${sailor.isZoneTeam ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[8px] shadow">★</span>' : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-slate-500 text-xs truncate leading-tight">${sailor.name}</p>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">⚠️ Busy: ${assignment.zone}</span>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="text-sm font-extrabold text-slate-400">${sailor.avgScore.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400 mt-0.5">${sailor.category}</div>
                    </div>
                </div>
            </div>
            `;
        }

        return `
        <div class="sailor-card rounded-xl p-2.5 hover:shadow-md transition-all border"
            style="background:rgba(255,255,255,0.88);border-color:rgba(255,255,255,0.7);backdrop-filter:blur(6px)"
            draggable="${isToday ? 'true' : 'false'}"
            ondragstart="handleDragStart(event, ${sailor.id})"
            ondragend="handleDragEnd(event)">
            <div class="flex items-center gap-2.5">
                <div class="relative flex-shrink-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style="background:${tradeBg}">${sailor.trade}</div>
                    ${sailor.isZoneTeam ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[8px] shadow">★</span>' : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-xs truncate leading-tight flex items-center justify-between gap-1">
                        <span>${sailor.name}</span>
                        <button onclick="event.stopPropagation(); openSailorProfile('${sailor.id ?? sailor._fbKey}')" class="text-teal-600 hover:text-teal-800 text-[11px] p-0.5 cursor-pointer font-bold transition-transform hover:scale-115" title="View Profile">
                            👤
                        </button>
                    </p>
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
    }).join('');

    if (sailors.length > store.availableSailorsLimit) {
        html += `
        <div class="flex justify-center py-2">
            <button onclick="loadMoreAvailableSailors()" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 active:scale-95">
                Load More Sailors (+40)
            </button>
        </div>
        `;
    }

    container.innerHTML = html || '<div class="text-center py-6"><p class="text-slate-400 text-sm">No sailors available</p></div>';

    const freeCount = sailors.filter(s => {
        const assignment = isToday 
            ? getSailorCurrentAssignment(s.id ?? s._fbKey)
            : getSailorAssignmentOnDate(s.id ?? s._fbKey, dateVal);
        return !assignment;
    }).length;
    document.getElementById('availableBadge').textContent = freeCount;
}

function loadMoreAvailableSailors() {
    store.availableSailorsLimit += 40;
    renderAvailableSailors();
}

function renderWorkOrders() {
    const columns = {
        'PROJECT': document.getElementById('projectsColumn'),
        'JOB': document.getElementById('jobsColumn'),
        'TASK': document.getElementById('tasksColumn')
    };

    let projectCount = 0, jobCount = 0, taskCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    let projectTradesStr = '', jobTradesStr = '', taskTradesStr = '';

    Object.keys(columns).forEach(type => {
        const orders = store.workOrders.filter(wo => 
            wo.type === type && 
            !wo.assign_type && 
            wo.zone_id === store.currentZone && 
            isWorkOrderActiveOnDate(wo, dateVal)
        );
        columns[type].innerHTML = orders.map(wo => renderWorkOrderCard(wo)).join('');
        
        const wrapperId = type === 'PROJECT' ? 'projectColumnWrapper' : type === 'JOB' ? 'jobColumnWrapper' : 'taskColumnWrapper';
        const wrapper = document.getElementById(wrapperId);
        if (wrapper) {
            wrapper.classList.toggle('hidden', orders.length === 0);
        }
        
        // Count active ones on this date
        const activeOrders = orders.filter(o => {
            if (dateVal === today) return o.status === 'Active';
            return true; // We assume shown historical work orders are active or had allocations
        });
        if (type === 'PROJECT') projectCount = activeOrders.length;
        if (type === 'JOB') jobCount = activeOrders.length;
        if (type === 'TASK') taskCount = activeOrders.length;

        // Calculate trade breakdown of assigned sailors
        const typeSailors = [];
        orders.forEach(wo => {
            const assignedIds = (wo.assigned || []).map(String);
            const sailors = store.sailors.filter(s =>
                assignedIds.includes(String(s.id)) ||
                assignedIds.includes(String(s._fbKey))
            );
            typeSailors.push(...sailors);
        });

        const tradeCounts = {};
        typeSailors.forEach(s => {
            const t = s.trade || 'MA';
            tradeCounts[t] = (tradeCounts[t] || 0) + 1;
        });

        const tradeStr = Object.entries(tradeCounts)
            .map(([trade, count]) => `${count} ${trade}`)
            .join(', ');

        if (type === 'PROJECT') projectTradesStr = tradeStr;
        if (type === 'JOB') jobTradesStr = tradeStr;
        if (type === 'TASK') taskTradesStr = tradeStr;
    });

    document.getElementById('ongoingProjects').textContent = projectCount;
    document.getElementById('ongoingJobs').textContent = jobCount;
    document.getElementById('ongoingTasks').textContent = taskCount;

    const projTradesEl = document.getElementById('ongoingProjectsTrades');
    if (projTradesEl) projTradesEl.textContent = projectTradesStr ? `(${projectTradesStr})` : '';

    const jobTradesEl = document.getElementById('ongoingJobsTrades');
    if (jobTradesEl) jobTradesEl.textContent = jobTradesStr ? `(${jobTradesStr})` : '';

    const taskTradesEl = document.getElementById('ongoingTasksTrades');
    if (taskTradesEl) taskTradesEl.textContent = taskTradesStr ? `(${taskTradesStr})` : '';
}

function renderQuickAssignments() {
    const container = document.getElementById('quickAssignmentsList');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;

    // Filter work orders that have an assign_type and belong to active zone
    const quickOrders = store.workOrders.filter(wo => 
        wo.assign_type && 
        wo.zone_id === store.currentZone && 
        isWorkOrderActiveOnDate(wo, dateVal)
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
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;

    const projects = store.workOrders.filter(wo => wo.type === 'PROJECT' && !wo.assign_type && wo.zone_id === store.currentZone && isWorkOrderActiveOnDate(wo, dateVal)).length;
    const jobs = store.workOrders.filter(wo => wo.type === 'JOB' && !wo.assign_type && wo.zone_id === store.currentZone && isWorkOrderActiveOnDate(wo, dateVal)).length;
    const tasks = store.workOrders.filter(wo => wo.type === 'TASK' && !wo.assign_type && wo.zone_id === store.currentZone && isWorkOrderActiveOnDate(wo, dateVal)).length;
    const assigns = store.workOrders.filter(wo => wo.assign_type && wo.zone_id === store.currentZone && isWorkOrderActiveOnDate(wo, dateVal)).length;

    // Explicitly toggle hidden class on wrappers to ensure they are hidden on mobile
    const projWrapper = document.getElementById('projectColumnWrapper');
    if (projWrapper) projWrapper.classList.toggle('hidden', projects === 0);
    const jobWrapper = document.getElementById('jobColumnWrapper');
    if (jobWrapper) jobWrapper.classList.toggle('hidden', jobs === 0);
    const taskWrapper = document.getElementById('taskColumnWrapper');
    if (taskWrapper) taskWrapper.classList.toggle('hidden', tasks === 0);
    const assignWrapper = document.getElementById('assignmentColumnWrapper');
    if (assignWrapper) assignWrapper.classList.toggle('hidden', assigns === 0);

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

function handleCardClick(event, workOrderId) {
    if (event.type === 'touchend') {
        event.preventDefault();
    }
    openWorkOrderDetail(workOrderId);
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

    const tradeCounts = {};
    assignedSailors.forEach(s => {
        const t = s.trade || 'MA';
        tradeCounts[t] = (tradeCounts[t] || 0) + 1;
    });
    const tradeStr = Object.entries(tradeCounts)
        .map(([trade, count]) => `${count} ${trade}`)
        .join(', ');
    const tradeBadge = tradeStr ? `<span class="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded ml-1 border border-slate-200">${tradeStr}</span>` : '';

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
                    <span class="text-[11px] text-slate-500 flex items-center flex-wrap gap-1">👷 ${assignedSailors.length} assigned ${tradeBadge}</span>
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
                    <span class="block text-xs font-semibold text-slate-700 truncate hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${s.id ?? s._fbKey}')">${s.name.split(' ').slice(1,3).join(' ')}</span>
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
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId));
    if (sailor) {
        sailor.isZoneTeam = false;
        sailor.zone_assigned = 'A-Zone';

        const fbKey = sailor._fbKey || sailor.id;
        if (fbKey) {
            sailorsDB.ref(`sailors/${fbKey}`).update({
                isZoneTeam: false,
                zone_assigned: 'A-Zone'
            }).catch(err => console.error("Error removing from zone team:", err));
        }

        renderZoneTeam();
        renderAvailableSailors();
        showToast(`${sailor.name} removed from Zone Team`, 'info');
    }
}

function openZoneTeamManager() {
    const searchInput = document.getElementById('ztmSearch');
    if (searchInput) searchInput.value = '';
    renderZtmLists();
    document.getElementById('zoneTeamModal').classList.remove('hidden');
}

function filterZtmAvailableList() {
    renderZtmLists(document.getElementById('ztmSearch').value);
}

function renderZtmLists(filter = '') {
    const currentZoneObj = store.zones.find(z => z.id === store.currentZone);
    document.getElementById('ztmZoneName').textContent = currentZoneObj ? currentZoneObj.name : store.currentZone;

    const current = store.sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone);
    let eligible = store.sailors.filter(s => !s.isZoneTeam);

    if (filter) {
        const q = filter.toLowerCase().trim();
        eligible = eligible.filter(s =>
            (s._searchIndex || '').includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q)
        );
    }

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
            <button onclick="toggleZoneTeam('${s.id ?? s._fbKey}', false)" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Remove</button>
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
            <button onclick="toggleZoneTeam('${s.id ?? s._fbKey}', true)" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Add</button>
        </div>
    `).join('') || '<p class="text-center text-xs text-slate-400 py-4">No eligible sailors found</p>';
}

function toggleZoneTeam(sailorId, addToTeam) {
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    if (!sailor) return;
    if (addToTeam) {
        const teamSize = store.sailors.filter(s => s.isZoneTeam && s.zone_assigned === store.currentZone).length;
        if (teamSize >= 15) { showToast('Zone Team is full (15 max)', 'error'); return; }
        
        sailor.isZoneTeam = true;
        sailor.zone_assigned = store.currentZone;
    } else {
        sailor.isZoneTeam = false;
        sailor.zone_assigned = 'A-Zone';
    }

    const fbKey = sailor._fbKey || sailor.id;
    if (fbKey) {
        sailorsDB.ref(`sailors/${fbKey}`).update({
            isZoneTeam: sailor.isZoneTeam,
            zone_assigned: sailor.zone_assigned
        }).then(() => {
            showToast(`${sailor.name} ${addToTeam ? 'added to' : 'removed from'} Zone Team`);
        }).catch(err => {
            console.error("Error updating sailor zone team status:", err);
            showToast("Saved locally (offline mode)", "info");
        });
    }

    // Refresh lists
    renderZtmLists(document.getElementById('ztmSearch')?.value || '');
    renderZoneTeam();
    renderAvailableSailors();
}

function updateCounters() {
    const activeWo = store.workOrders || [];
    const activeJc = store.jobCards || [];
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const isToday = dateVal === today;

    const assignedIds = new Set();
    const naIds = new Set();
    
    // Helper to check if text contains NA keywords
    const isNA = (text) => {
        if (!text) return false;
        return /(නිවාඩු|ගිලන්|\bsiq\b|\bngh\b|\badmit\b)/i.test(text);
    };

    if (isToday) {
        activeWo.forEach(wo => {
            if ((wo.status === 'Active' || wo.status === 'Pending') && wo.assigned) {
                if (isNA(wo.description) || isNA(wo.reference_no)) {
                    wo.assigned.forEach(id => naIds.add(String(id)));
                } else {
                    wo.assigned.forEach(id => assignedIds.add(String(id)));
                }
            }
        });
        activeJc.forEach(jc => {
            if ((jc.status === 'Active' || jc.status === 'Pending') && jc.assigned) {
                if (isNA(jc.description) || isNA(jc.title)) {
                    jc.assigned.forEach(id => naIds.add(String(id)));
                } else {
                    jc.assigned.forEach(id => assignedIds.add(String(id)));
                }
            }
        });
    } else {
        (store.dailyAllocations || []).forEach(alloc => {
            if (alloc.date === dateVal) {
                const wo = activeWo.find(w => String(w.id) === String(alloc.work_order_id));
                const jc = activeJc.find(j => String(j.id) === String(alloc.work_order_id));
                
                if ((wo && (isNA(wo.description) || isNA(wo.reference_no))) || 
                    (jc && (isNA(jc.description) || isNA(jc.title)))) {
                    naIds.add(String(alloc.sailor_id));
                } else {
                    assignedIds.add(String(alloc.sailor_id));
                }
            }
        });
    }

    if (store.sailors) {
        store.sailors.forEach(s => {
            if (s.status !== 'Leave' && s.status !== 'Sick') {
                if (naIds.has(String(s.id)) || naIds.has(String(s._fbKey))) {
                    s.status = 'NA';
                } else if (assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey))) {
                    s.status = 'Assigned';
                } else {
                    s.status = 'Available';
                }
            }

            // Resolve daily evaluation state from dailyAllocationsMap for active date
            const allocKey = `${dateVal}_${sanitizeFbKey(s.id)}`;
            const allocKeyFb = `${dateVal}_${sanitizeFbKey(s._fbKey)}`;
            const alloc = store.dailyAllocationsMap ? (store.dailyAllocationsMap[allocKey] || store.dailyAllocationsMap[allocKeyFb]) : null;
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

    const available = store.sailors ? store.sailors.filter(s => s.status === 'Available').length : 0;
    const assigned = store.sailors ? store.sailors.filter(s => s.status === 'Assigned').length : 0;
    const naCount = store.sailors ? store.sailors.filter(s => s.status === 'NA').length : 0;
    
    document.getElementById('netForce').textContent = available + assigned + naCount;
    document.getElementById('assignedCount').textContent = assigned;
    document.getElementById('availableCount').textContent = available;
    const todayNaEl = document.getElementById('todayNaCount');
    if (todayNaEl) todayNaEl.textContent = naCount;
}

function updatePendingEvals() {
    const evaluated = store.sailors.filter(s => s.status === 'Assigned' && s.evaluated).length;
    const pending = store.sailors.filter(s => s.status === 'Assigned' && !s.evaluated).length;
    
    const evalEl = document.getElementById('evaluatedToday');
    if (evalEl) evalEl.textContent = evaluated;
    
    const pendingEl = document.getElementById('pendingEvals');
    if (pendingEl) pendingEl.textContent = pending;
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

    const assignment = getSailorCurrentAssignment(draggedSailorId);
    const sailor = store.sailors.find(s => s.id === draggedSailorId);
    const workOrder = store.workOrders.find(wo => wo.id === workOrderId);

    if (!sailor || !workOrder) {
        draggedSailorId = null;
        return;
    }

    if (assignment) {
        // Automatically remove from previous assignment
        const prevWo = store.workOrders.find(w => {
            if (w.status !== 'Active' && w.status !== 'Pending') return false;
            const assignedIds = (w.assigned || []).map(String);
            return assignedIds.includes(String(draggedSailorId));
        });
        
        if (prevWo) {
            prevWo.assigned = (prevWo.assigned || []).filter(id => String(id) !== String(draggedSailorId));
            const today = new Date().toISOString().split('T')[0];
            prevWo.last_assigned_date = today;
            if (window.fbSaveWorkOrder) {
                fbSaveWorkOrder(prevWo);
            }
            opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(draggedSailorId)}`).remove();
        }
    }

    if (!workOrder.assigned) workOrder.assigned = [];

    if (!workOrder.assigned.includes(draggedSailorId)) {
        workOrder.assigned.push(draggedSailorId);
        sailor.status = 'Assigned';
        sailor.evaluated = false;
        
        const today = new Date().toISOString().split('T')[0];
        workOrder.last_assigned_date = today;
        
        if (window.fbSaveWorkOrder) {
            fbSaveWorkOrder(workOrder);
        }
        
        renderDashboard();
        showToast(assignment 
            ? `Reassigned ${sailor.name} from ${assignment.zone}!` 
            : `${sailor.name} assigned to ${workOrder.description.substring(0, 30)}...`
        );
    }

    draggedSailorId = null;
}

function removeSailorFromOrder(sailorId, workOrderId) {
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId));
    const workOrder = store.workOrders.find(wo => String(wo.id) === String(workOrderId) || String(wo._fbKey) === String(workOrderId));

    const today = new Date().toISOString().split('T')[0];
    const isToday = !store.dashboardDate || store.dashboardDate === today;
    if (!isToday) {
        showToast("Historical data is read-only!", "error");
        return;
    }

    if (sailor && workOrder) {
        workOrder.assigned = (workOrder.assigned || []).filter(id => String(id) !== String(sailorId));
        sailor.status = 'Available';
        
        const today = new Date().toISOString().split('T')[0];
        workOrder.last_assigned_date = today;
        
        opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).remove();

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
    store.availableSailorsLimit = 40;
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
    store.availableSailorsLimit = 40;
    document.querySelectorAll('.trade-filter').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('bg-slate-200');
    });
    event.target.classList.remove('bg-slate-200');
    event.target.classList.add('bg-slate-700', 'text-white');
    renderAvailableSailors();
}

function searchSailors() {
    renderAvailableSailors();
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

    // Populate In-Charge / Supervisor dropdowns (filtered to Settings assignments, with fallback to all EC sailors)
    const ecSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('EC');
    });

    const inc = (store.settings.zoneInCharges || {})[store.currentZone];
    
    // Incharge option
    let inchargeOptions = '<option value="">Select...</option>';
    if (inc && inc.woInchargeId) {
        const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(inc.woInchargeId));
        if (s) {
            inchargeOptions += `<option value="${s.id}">${s.rank} ${s.name}</option>`;
        }
    } else {
        inchargeOptions += ecSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    }

    // Supervisor option
    let supervisorOptions = '<option value="">Select...</option>';
    if (inc && inc.woSupervisorId) {
        const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(inc.woSupervisorId));
        if (s) {
            supervisorOptions += `<option value="${s.id}">${s.rank} ${s.name}</option>`;
        }
    } else {
        supervisorOptions += ecSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    }

    document.getElementById('woSupervisor').innerHTML = supervisorOptions;
    document.getElementById('woIncharge').innerHTML   = inchargeOptions;

    // Populate Project Artificer dropdown (filtered to Settings assignments, with fallback to all AC sailors)
    const acSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('AC');
    });

    let artificerOptions = '<option value="">Select...</option>';
    if (inc && inc.woArtificerId) {
        const s = store.sailors.find(x => String(x.id ?? x._fbKey) === String(inc.woArtificerId));
        if (s) {
            artificerOptions += `<option value="${s.id}">${s.rank} ${s.name}</option>`;
        }
    } else {
        artificerOptions += acSailors.map(s => `<option value="${s.id}">${s.rank} ${s.name}</option>`).join('');
    }

    document.getElementById('woArtificer').innerHTML = artificerOptions;

    // Render sailor chips
    renderWoSailorChips();

    // Clear search
    document.getElementById('woSailorSearch').value = '';

    // Reset trade filter UI
    document.querySelectorAll('.wo-trade-btn').forEach(b => {
        b.className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-200 text-slate-600';
    });
    document.querySelector('.wo-trade-btn').className = 'wo-trade-btn text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-700 text-white';

    const isAdminStaff = isAdminStaffDuties(store.currentZone);
    
    // Elements to hide
    const typePriorityWrapper = document.getElementById('woTypePriorityWrapper');
    const referenceWrapper = document.getElementById('woReferenceWrapper');
    const estimateWrapper = document.getElementById('woEstimateWrapper');
    const costDurationWrapper = document.getElementById('woCostDurationWrapper');
    const supervisorWrapper = document.getElementById('woSupervisorWrapper');
    const artificerWrapper = document.getElementById('woArtificerWrapper');
    const staffWrapper = document.getElementById('woStaffWrapper');

    if (typePriorityWrapper) typePriorityWrapper.classList.toggle('hidden', isAdminStaff);
    if (referenceWrapper) referenceWrapper.classList.toggle('hidden', isAdminStaff);
    if (estimateWrapper) estimateWrapper.classList.toggle('hidden', isAdminStaff);
    if (costDurationWrapper) costDurationWrapper.classList.toggle('hidden', isAdminStaff);
    if (supervisorWrapper) supervisorWrapper.classList.toggle('hidden', isAdminStaff);
    if (artificerWrapper) artificerWrapper.classList.toggle('hidden', isAdminStaff);

    if (staffWrapper) {
        if (isAdminStaff) {
            staffWrapper.classList.remove('grid-cols-3');
            staffWrapper.classList.add('grid-cols-1');
        } else {
            staffWrapper.classList.remove('grid-cols-1');
            staffWrapper.classList.add('grid-cols-3');
        }
    }

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

    // When searching, show ALL sailors (651) so any sailor can be found and assigned
    let sailors;
    if (filter) {
        const q = filter.toLowerCase().trim();
        sailors = store.sailors.filter(s =>
            (s._searchIndex || '').includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q)
        );
        if (_woCurrentTrade !== 'ALL') {
            sailors = sailors.filter(s => s.trade === _woCurrentTrade);
        }
    } else {
        sailors = store.sailors.filter(s =>
            (s.attendance === 'Present' || !s.attendance) &&
            (_woCurrentTrade === 'ALL' || s.trade === _woCurrentTrade)
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

        const assignment = getSailorCurrentAssignment(s.id ?? s._fbKey);
        if (assignment) {
            return `
            <button type="button"
                onclick="toggleWoSailor('${s.id ?? s._fbKey}')"
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
        const assignment = getSailorCurrentAssignment(sailorId);
        if (assignment) {
            // Automatically remove from previous assignment
            const prevWo = store.workOrders.find(w => {
                if (w.status !== 'Active' && w.status !== 'Pending') return false;
                const assignedIds = (w.assigned || []).map(String);
                return assignedIds.includes(key);
            });
            
            if (prevWo) {
                prevWo.assigned = (prevWo.assigned || []).filter(id => String(id) !== key);
                const today = new Date().toISOString().split('T')[0];
                prevWo.last_assigned_date = today;
                if (window.fbSaveWorkOrder) {
                    fbSaveWorkOrder(prevWo);
                }
                opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(key)}`).remove();
            }
            showToast(`Reassigned ${store.sailors.find(s => String(s.id ?? s._fbKey) === key)?.name || 'Sailor'} from ${assignment.zone}!`);
        }
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

        const assignment = getSailorCurrentAssignment(s.id ?? s._fbKey);
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
        const assignment = getSailorCurrentAssignment(sailorId);
        if (assignment) {
            showToast(`${store.sailors.find(s => String(s.id ?? s._fbKey) === key)?.name || 'Sailor'} is already busy in ${assignment.zone}!`, 'error');
            return;
        }
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
    if (_justClosedModal) return;
    store.selectedWorkOrder = workOrderId;
    // Find by _fbKey (string) OR numeric id
    const wo = store.workOrders.find(w =>
        String(w._fbKey) === String(workOrderId) ||
        String(w.id)     === String(workOrderId)
    );
    if (!wo) { console.warn('Work order not found:', workOrderId); return; }

    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const isToday = dateVal === today;

    // Reset to details tab each open
    switchWoTab('details');

    // Toggle Evaluation tab button
    const evalTabBtn = document.getElementById('woTab-evaluation-btn');
    if (evalTabBtn) {
        evalTabBtn.classList.toggle('hidden', !isToday);
    }

    // Toggle Assign New Labour block
    const assignLaborBlock = document.getElementById('detailSailorChips')?.parentElement;
    if (assignLaborBlock) {
        assignLaborBlock.classList.toggle('hidden', !isToday);
    }

    // Toggle sticky footer buttons
    const btnSaveWoChanges = document.getElementById('btnSaveWoChanges');
    const btnProceedWo = document.getElementById('btnProceedWo');
    const btnForwardComplete = document.getElementById('btnForwardComplete');
    const btnDeleteWo = document.getElementById('btnDeleteWo');
    if (btnSaveWoChanges) btnSaveWoChanges.classList.toggle('hidden', !isToday);
    if (btnProceedWo) btnProceedWo.classList.toggle('hidden', !isToday);
    if (btnForwardComplete) btnForwardComplete.classList.toggle('hidden', !isToday);
    if (btnDeleteWo) btnDeleteWo.classList.toggle('hidden', !isToday);

    // Disable/enable fields
    const inputs = [
        'woDetailStatus', 'woDetailPriority', 'woDetailDescription',
        'woDetailAuthority', 'woDetailBudget', 'woDetailDuration',
        'woDetailProgress', 'woDetailIncharge', 'woDetailSupervisor', 'woDetailArtificer'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isToday;
    });

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
    if (isToday && typeof renderDetailSailorChips === 'function') {
        renderDetailSailorChips();
    }
    
    // Supervisor and Incharge dropdowns (filtered to Settings assignments, with fallback to all EC sailors)
    const ecSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('EC');
    });

    const inc = (store.settings.zoneInCharges || {})[store.currentZone];
    
    // Incharge dropdown
    let inchargeOptions = '<option value="">Select...</option>';
    const assignedInchargeId = wo.incharge;
    const eligibleInchargeIds = new Set();
    if (inc && inc.woInchargeId) eligibleInchargeIds.add(String(inc.woInchargeId));
    if (assignedInchargeId) eligibleInchargeIds.add(String(assignedInchargeId));
    
    if (eligibleInchargeIds.size > 0) {
        const selectedSailors = store.sailors.filter(s => eligibleInchargeIds.has(String(s.id ?? s._fbKey)));
        inchargeOptions += selectedSailors.map(s => `<option value="${s.id}" ${wo.incharge == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    } else {
        inchargeOptions += ecSailors.map(s => `<option value="${s.id}" ${wo.incharge == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    }
    
    // Supervisor dropdown
    let supervisorOptions = '<option value="">Select...</option>';
    const assignedSupervisorId = wo.supervisor;
    const eligibleSupervisorIds = new Set();
    if (inc && inc.woSupervisorId) eligibleSupervisorIds.add(String(inc.woSupervisorId));
    if (assignedSupervisorId) eligibleSupervisorIds.add(String(assignedSupervisorId));
    
    if (eligibleSupervisorIds.size > 0) {
        const selectedSailors = store.sailors.filter(s => eligibleSupervisorIds.has(String(s.id ?? s._fbKey)));
        supervisorOptions += selectedSailors.map(s => `<option value="${s.id}" ${wo.supervisor == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    } else {
        supervisorOptions += ecSailors.map(s => `<option value="${s.id}" ${wo.supervisor == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    }
    
    document.getElementById('woDetailIncharge').innerHTML = inchargeOptions;
    document.getElementById('woDetailSupervisor').innerHTML = supervisorOptions;

    // Artificer dropdown
    let artificerOptions = '<option value="">Select...</option>';
    const assignedArtificerId = wo.project_artificer;
    const eligibleArtificerIds = new Set();
    if (inc && inc.woArtificerId) eligibleArtificerIds.add(String(inc.woArtificerId));
    if (assignedArtificerId) eligibleArtificerIds.add(String(assignedArtificerId));
    
    const acSailors = store.sailors.filter(s => {
        const off = String(s.official_number || '').trim().toUpperCase();
        return off.startsWith('AC');
    });
    
    if (eligibleArtificerIds.size > 0) {
        const selectedSailors = store.sailors.filter(s => eligibleArtificerIds.has(String(s.id ?? s._fbKey)));
        artificerOptions += selectedSailors.map(s => `<option value="${s.id}" ${wo.project_artificer == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    } else {
        artificerOptions += acSailors.map(s => `<option value="${s.id}" ${wo.project_artificer == s.id ? 'selected' : ''}>${s.rank} ${s.name}</option>`).join('');
    }
    
    document.getElementById('woDetailArtificer').innerHTML = artificerOptions;

    // Normalised assigned list based on date
    let assignedSailors = [];
    if (isToday) {
        const assignedIds = (wo.assigned || []).map(String);
        assignedSailors = store.sailors.filter(s =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey))
        );
    } else {
        const assignedIds = (store.dailyAllocations || [])
            .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
            .map(a => String(a.sailor_id));
        assignedSailors = store.sailors.filter(s =>
            assignedIds.includes(String(s.id)) ||
            assignedIds.includes(String(s._fbKey))
        );
    }

    const tradeCounts = {};
    assignedSailors.forEach(s => {
        tradeCounts[s.trade] = (tradeCounts[s.trade] || 0) + 1;
    });
    const countStr = Object.entries(tradeCounts)
        .map(([trade, count]) => `${count} ${trade}`)
        .join(', ');
    document.getElementById('assignedLaborCount').textContent = countStr || '0 assigned';

    document.getElementById('woDetailAssigned').innerHTML = assignedSailors.map(s => `
        <div class="flex items-center justify-between p-2 bg-white rounded-lg border">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${s.trade}</span>
                <div>
                    <p class="font-medium text-sm hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${s.id ?? s._fbKey}')">${s.rank || 'AB'} ${s.name}</p>
                    <div class="flex gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Official No: ${s.official_number || s.service_no || '-'}</span>
                        <span>•</span>
                        <span>Trade: ${s.trade}</span>
                        <span>•</span>
                        <span>Avg: <span class="${getPerformanceTextColor(s.avgScore)}">${s.avgScore.toFixed(1)}</span></span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${s.evaluated ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Evaluated</span>' : '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending</span>'}
                ${isToday ? `<button onclick="removeSailorFromOrder('${s.id}', '${wo._fbKey || wo.id}'); openWorkOrderDetail('${wo._fbKey || wo.id}');" class="text-red-500 hover:text-red-700 text-lg">×</button>` : ''}
            </div>
        </div>
    `).join('') || '<p class="text-slate-500 text-center py-4">No labour assigned</p>';

    // Evaluation tab list (always available on today - req 1)
    const pendingEvals = assignedSailors.filter(s => !s.evaluated).length;
    const evalBadge = document.getElementById('woEvalPendingBadge');
    if (isToday && pendingEvals > 0) { 
        evalBadge.textContent = pendingEvals + ' pending'; 
        evalBadge.classList.remove('hidden'); 
    } else { 
        evalBadge.classList.add('hidden'); 
    }

    document.getElementById('laborEvalList').innerHTML = assignedSailors.length ? assignedSailors.map(s => `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg border ${s.evaluated ? 'border-green-300' : 'border-amber-300'}">
            <div class="flex items-center gap-3">
                <span class="w-10 h-10 bg-slate-600 text-white rounded-full flex items-center justify-center font-bold">${s.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>
                <div>
                    <p class="font-medium hover:underline cursor-pointer text-teal-600" onclick="openSailorProfile('${s.id ?? s._fbKey}')">${s.name}</p>
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
    `).join('') : '<p class="text-slate-500 text-center py-6">No labour assigned to evaluate.</p>';

    // Toggle Restore Last Crew button visibility
    const btnRestorePrevCrew = document.getElementById('btnRestorePrevCrew');
    if (btnRestorePrevCrew) {
        const hasLastCrew = wo.last_assigned && wo.last_assigned.length > 0;
        const currentCrewEmpty = !wo.assigned || wo.assigned.length === 0;
        btnRestorePrevCrew.classList.toggle('hidden', !(hasLastCrew && currentCrewEmpty && isToday));
    }

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

    // When searching, show ALL sailors (651) so any sailor can be found and assigned
    let sailors;
    if (filter) {
        const q = filter.toLowerCase().trim();
        sailors = store.sailors.filter(s =>
            !assignedIds.includes(String(s.id)) && !assignedIds.includes(String(s._fbKey)) &&
            ((s._searchIndex || '').includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.official_number || '').toLowerCase().includes(q) ||
            (s.rank || '').toLowerCase().includes(q) ||
            (s.trade || '').toLowerCase().includes(q))
        );
        if (_detailCurrentTrade !== 'ALL') {
            sailors = sailors.filter(s => s.trade === _detailCurrentTrade);
        }
    } else {
        sailors = store.sailors.filter(s => 
            !assignedIds.includes(String(s.id)) && !assignedIds.includes(String(s._fbKey)) &&
            s.status !== 'Sick' && s.status !== 'Leave' &&
            (_detailCurrentTrade === 'ALL' || s.trade === _detailCurrentTrade)
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

        const assignment = getSailorCurrentAssignment(s.id ?? s._fbKey);
        if (assignment) {
            return `
            <button type="button"
                onclick="assignSingleLabor('${s.id ?? s._fbKey}')"
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
                <div style="background:#d97706; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10.5px; font-weight:800; letter-spacing:0.5px; flex-shrink:0;">
                    ${s.trade}
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div style="font-size:11px; font-weight:700; color:#b45309; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">
                        ${rank} ${fullName}
                    </div>
                    <div style="font-size:8px; color:#d97706; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🔁 Reassign from ${assignment.zone}</div>
                </div>
            </button>
            `;
        }

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
    const assignment = getSailorCurrentAssignment(sailorId);
    const wo = store.workOrders.find(w => String(w.id) === String(store.selectedWorkOrder) || String(w._fbKey) === String(store.selectedWorkOrder));
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    
    if (!wo || !sailor) return;

    if (assignment) {
        // Automatically remove from previous assignment
        const prevWo = store.workOrders.find(w => {
            if (w.status !== 'Active' && w.status !== 'Pending') return false;
            const assignedIds = (w.assigned || []).map(String);
            return assignedIds.includes(String(sailorId));
        });
        
        if (prevWo) {
            prevWo.assigned = (prevWo.assigned || []).filter(id => String(id) !== String(sailorId));
            const today = new Date().toISOString().split('T')[0];
            prevWo.last_assigned_date = today;
            if (window.fbSaveWorkOrder) {
                fbSaveWorkOrder(prevWo);
            }
            opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sailorId)}`).remove();
        }
    }

    if (!wo.assigned) wo.assigned = [];
    
    const alreadyAssigned = wo.assigned.some(id => String(id) === String(sailorId));
    if (!alreadyAssigned) {
        wo.assigned.push(sailorId);
        sailor.status = 'Assigned';
        sailor.evaluated = false;
        
        const today = new Date().toISOString().split('T')[0];
        wo.last_assigned_date = today;
        
        if (typeof fbSaveWorkOrder === 'function') {
            fbSaveWorkOrder(wo);
        }
        
        showToast(assignment 
            ? `Reassigned ${sailor.name} from ${assignment.zone}!` 
            : `${sailor.name} assigned successfully`
        );
        openWorkOrderDetail(wo._fbKey || wo.id);
    }
}

function updateWorkOrderStatus() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo) {
        const newStatus = document.getElementById('woDetailStatus').value;
        wo.status = newStatus;
        
        // Sync status to the linked Job Card
        const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
        if (jc) {
            jc.status = wo.status;
            if (window.fbSaveJobCard) fbSaveJobCard(jc);
        }

        // Clear today's daily allocations if putting on hold/completed/pending
        if (newStatus === 'Hold' || newStatus === 'Completed' || newStatus === 'Pending') {
            const today = new Date().toISOString().split('T')[0];
            const allocationsToDelete = (store.dailyAllocations || []).filter(a => a.date === today && String(a.work_order_id) === String(wo.id));
            allocationsToDelete.forEach(a => {
                opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`).remove().catch(e => console.warn(e));
            });
        }

        if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);

        renderDashboard();
    }
}

function saveWorkOrderChanges() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo) {
        const newStatus = document.getElementById('woDetailStatus').value;
        wo.status = newStatus;
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

        // Clear today's daily allocations if putting on hold/completed/pending
        if (newStatus === 'Hold' || newStatus === 'Completed' || newStatus === 'Pending') {
            const today = new Date().toISOString().split('T')[0];
            const allocationsToDelete = (store.dailyAllocations || []).filter(a => a.date === today && String(a.work_order_id) === String(wo.id));
            allocationsToDelete.forEach(a => {
                opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(a.sailor_id)}`).remove().catch(e => console.warn(e));
            });
        }

        if (window.fbSaveWorkOrder) fbSaveWorkOrder(wo);

        renderDashboard();
        showToast('Work order updated successfully!');
        
        // Auto-close modal if no longer showing on the planning board
        if (newStatus === 'Hold' || newStatus === 'Completed') {
            closeModal('workOrderDetailModal');
        }
    }
}

function deleteWorkOrder() {
    const woKey = store.selectedWorkOrder;
    if (!woKey) return;
    
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (!wo) return;
    
    if (confirm(`⚠️ Are you sure you want to delete the work order "${wo.description}"?\n\nThis will permanently remove the work order and its daily labor allocations.`)) {
        const targetFbKey = wo._fbKey;
        if (!targetFbKey) {
            showToast('Cannot delete: Firebase key not found.');
            return;
        }

        // 1. Remove the work order from Firebase
        opsDB.ref(`work_orders/${targetFbKey}`).remove()
            .then(() => {
                // 2. Remove all daily allocations associated with this work order id / reference
                const woIdStr = String(wo.id);
                const allocsToDelete = (store.dailyAllocations || []).filter(a => String(a.work_order_id) === woIdStr);
                
                const deletePromises = allocsToDelete.map(a => {
                    if (a._fbKey) {
                        return opsDB.ref(`daily_allocations/${a._fbKey}`).remove();
                    }
                    return Promise.resolve();
                });
                
                return Promise.all(deletePromises);
            })
            .then(() => {
                closeModal('workOrderDetailModal');
                showToast(`Deleted work order successfully!`);
                renderDashboard();
            })
            .catch(err => {
                console.error('Error deleting work order:', err);
                showToast('Failed to delete work order.');
            });
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
        const today = new Date().toISOString().split('T')[0];
        
        // Collect currently assigned sailors to free them up locally
        const assignedIds = (wo.assigned || []).map(String);
        
        // Auto-commit crew to daily allocations for today before clearing them
        if (assignedIds.length > 0) {
            assignedIds.forEach(sid => {
                const sailor = store.sailors.find(s => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
                const alreadyAllocated = (store.dailyAllocations || []).some(a => a.date === today && String(a.sailor_id) === String(sid) && String(a.work_order_id) === String(wo.id));
                if (!alreadyAllocated) {
                    store.dailyAllocations = (store.dailyAllocations || []).filter(a => !(a.date === today && a.sailor_id === sid));
                    const alloc = {
                        id: (store.dailyAllocations || []).length + 1,
                        date: today,
                        sailor_id: sid,
                        work_order_id: wo.id,
                        role_today: (sailor && sailor.id == wo.supervisor) ? 'Supervisor' : (sailor && sailor.id == wo.incharge) ? 'In-Charge' : 'Worker',
                        assigned_by: (store.currentUser && store.currentUser.name) ? store.currentUser.name : 'Officer',
                        status: 'Active'
                    };
                    if (!store.dailyAllocations) store.dailyAllocations = [];
                    store.dailyAllocations.push(alloc);
                    opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`).set(alloc);
                }
            });
        }
        
        wo.completed_date = today;
        wo.status = 'Completed';
        wo.progress = 100;
        wo.assigned = []; // Remove sailors from work order
        
        // Reset status for these sailors in the local store
        if (store.sailors) {
            store.sailors.forEach(s => {
                if (assignedIds.includes(String(s.id)) || assignedIds.includes(String(s._fbKey))) {
                    if (s.status === 'Assigned') {
                        s.status = 'Available';
                    }
                }
            });
        }
        
        // Sync to Job Card
        const jc = getJobCardForWorkOrder(wo._fbKey || wo.id);
        if (jc) {
            jc.status = 'Completed';
            jc.assigned = []; // Remove sailors from job card
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

    const today = new Date().toISOString().split('T')[0];

    // Auto-restore previous crew if current assigned is empty
    if ((!wo.assigned || wo.assigned.length === 0) && wo.last_assigned && wo.last_assigned.length > 0) {
        wo.assigned = [...wo.last_assigned];
        if (store.sailors) {
            wo.assigned.forEach(sid => {
                const s = store.sailors.find(x => String(x.id) === String(sid) || String(x._fbKey) === String(sid));
                if (s) {
                    s.status = 'Assigned';
                    s.evaluated = false;
                }
            });
        }
        showToast(`Auto-restored last active crew (${wo.assigned.length} sailors)`);
    }

    if (!wo.assigned || wo.assigned.length === 0) {
        showToast('Assign at least one sailor before proceeding', 'error');
        return;
    }

    // Activate the work order and write today's allocations
    wo.status = 'Active';
    wo.last_commit_date = today;
    wo.last_assigned = [...wo.assigned];
    wo.last_assigned_date = today;

    if (window.fbSaveWorkOrder) {
        fbSaveWorkOrder(wo);
    }

    wo.assigned.forEach(sid => {
        const sailor = store.sailors.find(s => String(s.id) === String(sid) || String(s._fbKey) === String(sid));
        // remove existing same-day allocation for this sailor (one job per day)
        store.dailyAllocations = store.dailyAllocations.filter(a => !(a.date === today && a.sailor_id === sid));
        const alloc = {
            id: store.dailyAllocations.length + 1,
            date: today,
            sailor_id: sid,
            work_order_id: wo.id,
            role_today: (sailor && sailor.id == wo.supervisor) ? 'Supervisor' : (sailor && sailor.id == wo.incharge) ? 'In-Charge' : 'Worker',
            assigned_by: (store.currentUser && store.currentUser.name) ? store.currentUser.name : 'Officer',
            status: 'Active'
        };
        store.dailyAllocations.push(alloc);
        if (sailor) { sailor.status = 'Assigned'; sailor.evaluated = false; }
        opsDB.ref(`daily_allocations/${today}_${sanitizeFbKey(sid)}`).set(alloc);
    });

    closeModal('workOrderDetailModal');
    renderDashboard();
    showToast(`✅ ${wo.assigned.length} sailor(s) committed to "${wo.description.substring(0,28)}…" for ${today}`);
}

function restorePreviousCrew() {
    const woKey = store.selectedWorkOrder;
    const wo = store.workOrders.find(w => String(w._fbKey) === String(woKey) || String(w.id) === String(woKey));
    if (wo && wo.last_assigned && wo.last_assigned.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        wo.assigned = [...wo.last_assigned];
        wo.last_assigned_date = today;
        
        // Mark sailors as Assigned locally
        if (store.sailors) {
            wo.assigned.forEach(sid => {
                const s = store.sailors.find(x => String(x.id) === String(sid) || String(x._fbKey) === String(sid));
                if (s) {
                    s.status = 'Assigned';
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
        
        // Save evaluation to local daily_allocations in Operations DB (failsafe + support history dates)
        const today = new Date().toISOString().split('T')[0];
        const dateVal = store.dashboardDate || today;
        const allocKey = `${dateVal}_${sanitizeFbKey(sailor.id)}`;
        const allocKeyFb = `${dateVal}_${sanitizeFbKey(sailor._fbKey)}`;
        let actualKey = allocKey;
        
        if (store.dailyAllocationsMap) {
            if (store.dailyAllocationsMap[allocKeyFb]) {
                actualKey = allocKeyFb;
            }
        }
        
        opsDB.ref(`daily_allocations/${actualKey}`).update({
            date: dateVal,
            sailor_id: sailor.id,
            work_order_id: store.selectedWorkOrder || '',
            evaluated: true,
            score: avgScore
        }).catch(e => console.warn('Could not save evaluation to Operations DB:', e));

        // Persist to sailorsDB as secondary best-effort
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
            jobCards = store.jobCards.filter(jc => (jc.status === 'Active' || jc.status === 'Hold') && jc.zone_id === store.currentZone);
            title = 'Active & Held Job Cards';
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
    document.getElementById('deleteJobCardBtn').style.display = jc.status === 'Active' ? 'block' : 'none';
    
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

function deleteJobCard() {
    const jcId = store.selectedJobCard;
    if (!jcId) return;
    
    const jc = store.jobCards.find(j => String(j.id) === String(jcId) || String(j._fbKey) === String(jcId));
    if (!jc) return;
    
    if (confirm(`⚠️ Are you sure you want to delete Job Card "${jc.job_number}" (${jc.description})?\n\nThis will also delete all logged materials and labor logs for this job card. This action cannot be undone.`)) {
        const targetFbKey = jc._fbKey;
        if (!targetFbKey) {
            showToast('Cannot delete: Firebase key not found.');
            return;
        }
        
        // 1. Delete Job Card from Firebase
        opsDB.ref(`job_cards/${targetFbKey}`).remove()
            .then(() => {
                // 2. Delete linked materials logs
                const linkedMaterials = store.jobCardMaterials.filter(m => String(m.job_card_id) === String(jcId));
                linkedMaterials.forEach(m => {
                    if (m._fbKey) {
                        opsDB.ref(`job_card_materials/${m._fbKey}`).remove();
                    }
                });

                // 3. Delete linked labor logs
                const linkedLabor = store.jobCardLabor.filter(l => String(l.job_card_id) === String(jcId));
                linkedLabor.forEach(l => {
                    if (l._fbKey) {
                        opsDB.ref(`job_card_labor/${l._fbKey}`).remove();
                    }
                });

                store.selectedJobCard = null;
                
                // Reset right panel content
                document.getElementById('selectedJobNumber').textContent = 'Select a Job Card';
                document.getElementById('selectedJobDesc').textContent = '';
                document.getElementById('totalMaterialCost').textContent = 'Rs. 0.00';
                document.getElementById('addMaterialBtn').style.display = 'none';
                document.getElementById('deleteJobCardBtn').style.display = 'none';
                
                // Clear tab lists in UI
                document.getElementById('jobCardMaterials').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">Select a Job Card to view materials</td></tr>';
                document.getElementById('jobCardLabor').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Select a Job Card to view labor</td></tr>';
                
                showToast(`Deleted Job Card successfully!`);
                renderJobCardsList();
            })
            .catch(err => {
                console.error('Error deleting Job Card:', err);
                showToast('Failed to delete Job Card.');
            });
    }
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
            const sailor = store.sailors.find(s => String(s.id) === String(l.sailor_id) || String(s._fbKey) === String(l.sailor_id));
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
    
    // Reset form
    const matInput = document.getElementById('matFromInventory');
    matInput.value = '';
    document.getElementById('matName').value = '';
    document.getElementById('matQuantity').value = '';
    document.getElementById('matCost').value = '';
    document.getElementById('matTotalCost').textContent = 'Rs. 0.00';
    
    setupMaterialAutocomplete(matInput, fillMaterialFromInventory);
    matInput.addEventListener('change', fillMaterialFromInventory);
    
    document.getElementById('addMaterialModal').classList.remove('hidden');
}

function fillMaterialFromInventory() {
    const inputVal = document.getElementById('matFromInventory').value;
    const item = store.inventory.find(i => i.description === inputVal && i.category !== 'Tools');
    
    if (item) {
        document.getElementById('matName').value = item.description;
        document.getElementById('matUnit').value = item.deno;
        document.getElementById('matCost').value = item.cost_per_unit || '';
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
    const defaultCats = ['BMS', 'Plumbing', 'Metal', 'Stencil', 'General', 'Aluminium', 'Paint', 'Electrical', 'Tools', 'Lubricant Oil', 'Eng'];
    
    // We only use the default allowed categories
    const allCats = [...defaultCats];

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

    // Also update the select dropdown options, keeping standard ones only
    const catSelect = document.getElementById('invCategory');
    if (catSelect) {
        let optionsHtml = '<option value="">-- Select Category --</option>';
        allCats.forEach(c => {
            optionsHtml += `<option value="${c}">${c}</option>`;
        });
        
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
    fbSaveInventoryItem(item);

    closeModal('offChargeModal');
    renderInventoryTable();
    showToast(`Off-charged ${qty} ${item.deno} of ${item.description} → ${dest} (${ref})`);
}

let passwordCallback = null;

function showPasswordModal(callback) {
    passwordCallback = callback;
    document.getElementById('confirmAdminPassword').value = '';
    document.getElementById('passwordError').classList.add('hidden');
    
    const modal = document.getElementById('passwordModal');
    const content = document.getElementById('passwordModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        document.getElementById('confirmAdminPassword').focus();
    }, 50);
}

function closePasswordModal() {
    const content = document.getElementById('passwordModalContent');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        document.getElementById('passwordModal').classList.add('hidden');
        passwordCallback = null;
    }, 200);
}

function submitPasswordVerification() {
    const pwdInput = document.getElementById('confirmAdminPassword');
    const errDiv = document.getElementById('passwordError');
    if (pwdInput.value === 'MalitHZ') {
        closePasswordModal();
        if (passwordCallback) passwordCallback();
    } else {
        errDiv.classList.remove('hidden');
        pwdInput.value = '';
        pwdInput.focus();
    }
}

function clearCurrentZoneInventory() {
    // Filter items belonging to the current active zone
    const zoneItems = store.inventory.filter(i => !i.zone_id || i.zone_id === store.currentZone);
    if (zoneItems.length === 0) {
        showToast('No inventory items found in the current zone', 'info');
        return;
    }
    
    showPasswordModal(() => {
        const zoneName = store.zones.find(z => z.id === store.currentZone)?.name || store.currentZone;
        if (confirm(`⚠️ WARNING: Are you sure you want to delete ALL ${zoneItems.length} inventory items in the current zone (${zoneName})? This will permanently wipe this zone's inventory. This action cannot be undone.`)) {
            let deleted = 0;
            zoneItems.forEach(item => {
                const key = item._fbKey || item.id;
                if (key) {
                    opsDB.ref(`inventory/${key}`).remove()
                        .then(() => {
                            deleted++;
                            if (deleted === zoneItems.length) {
                                showToast(`Successfully wiped inventory for zone: ${zoneName}`);
                            }
                        })
                        .catch(err => console.error(err));
                }
            });
        }
    });
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
        cost_per_unit: safeParseCost(document.getElementById('invCost').value),
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
    document.getElementById('deleteEstimateBtn').style.display = est.status === 'Pending' ? 'inline-block' : 'none';

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

let estWorkScopeCounter = 0;

function openNewEstimateModal() {
    document.getElementById('estId').value = '';
    document.getElementById('estDescription').value = '';
    document.getElementById('estReference').value = '';
    document.getElementById('estLocation').value = '';
    document.getElementById('estEndUser').value = '';
    
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

    // Clear dynamic scopes container and add one default section
    document.getElementById('estWorkScopesContainer').innerHTML = '';
    estWorkScopeCounter = 0;
    addWorkScopeBlock();
    
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
    document.getElementById('estCreatedName').value = est.createdBy?.name || '';
    document.getElementById('estCreatedRank').value = est.createdBy?.rank || '';
    document.getElementById('estCreatedSvc').value = est.createdBy?.serviceNo || '';
    document.getElementById('estCheckedName').value = est.checkedBy?.name || '';
    document.getElementById('estCheckedRank').value = est.checkedBy?.rank || '';
    document.getElementById('estCheckedSvc').value = est.checkedBy?.serviceNo || '';
    document.getElementById('estApprovedName').value = est.approvedBy?.name || '';
    document.getElementById('estApprovedRank').value = est.approvedBy?.rank || '';
    document.getElementById('estApprovedSvc').value = est.approvedBy?.serviceNo || '';
    
    document.getElementById('estWorkScopesContainer').innerHTML = '';
    estWorkScopeCounter = 0;
    
    if (est.workScopes && est.workScopes.length > 0) {
        est.workScopes.forEach(s => {
            addWorkScopeBlock(s);
        });
    } else {
        // Backward compatibility: load flat lists as a single section
        addWorkScopeBlock({
            description: est.workScope || 'Default Work Scope Section',
            materials: est.materials || [],
            labor: est.labor || []
        });
    }
    
    updateEstimateTotals();
    document.getElementById('newEstimateModal').classList.remove('hidden');
}

function addWorkScopeBlock(data = null) {
    estWorkScopeCounter++;
    const sId = estWorkScopeCounter;
    
    const container = document.getElementById('estWorkScopesContainer');
    const block = document.createElement('div');
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
            <input type="text" class="est-scope-desc w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Describe the scope of work for this section... *" value="${data?.description || ''}" required>
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
                            <th class="px-2 py-1.5 text-center" style="width: 80px;">Qty</th>
                            <th class="px-2 py-1.5 text-center" style="width: 70px;">Unit</th>
                            <th class="px-2 py-1.5 text-right" style="width: 100px;">Unit Cost</th>
                            <th class="px-2 py-1.5 text-right" style="width: 100px;">Total</th>
                            <th class="px-2 py-1.5 text-center" style="width: 100px;">Availability</th>
                            <th class="px-2 py-1.5" style="width: 30px;"></th>
                        </tr>
                    </thead>
                    <tbody id="estScopeMaterialsBody-${sId}">
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Labor sub-section -->
        <div class="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
            <div class="flex items-center justify-between mb-2">
                <h6 class="font-semibold text-slate-700 text-xs flex items-center gap-1">👷 Labor Requirement <span class="est-scope-labor-total text-blue-600 font-bold ml-2" id="estScopeLaborTotal-${sId}">0 Man-Days</span></h6>
                <button type="button" onclick="addScopeLaborRow(${sId})" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[10px] font-medium transition-all">+ Add Labor</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-slate-100">
                        <tr>
                            <th class="px-2 py-1.5 text-left">Trade/Role</th>
                            <th class="px-2 py-1.5 text-center" style="width: 80px;">Workers</th>
                            <th class="px-2 py-1.5 text-center" style="width: 80px;">Man-Days</th>
                            <th class="px-2 py-1.5 text-left">Task Description</th>
                            <th class="px-2 py-1.5" style="width: 30px;"></th>
                        </tr>
                    </thead>
                    <tbody id="estScopeLaborBody-${sId}">
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.appendChild(block);
    
    // Populate data if provided
    if (data) {
        (data.materials || []).forEach(m => addScopeMaterialRow(sId, m));
        (data.labor || []).forEach(l => addScopeLaborRow(sId, l));
    } else {
        // Add a default blank row to keep it friendly
        addScopeMaterialRow(sId);
        addScopeLaborRow(sId);
    }
    
    renumberScopeBlocks();
    updateEstimateTotals();
}

function removeWorkScopeBlock(sId) {
    const blocks = document.querySelectorAll('.est-scope-block');
    if (blocks.length <= 1) {
        showToast('At least one Work Scope Section is required.');
        return;
    }
    const block = document.getElementById(`estScopeBlock-${sId}`);
    if (block) {
        block.remove();
        renumberScopeBlocks();
        updateEstimateTotals();
    }
}

function renumberScopeBlocks() {
    const blocks = document.querySelectorAll('.est-scope-block');
    blocks.forEach((b, idx) => {
        const numSpan = b.querySelector('.est-scope-num');
        if (numSpan) numSpan.textContent = idx + 1;
    });
}
// --- Custom Autocomplete for Materials ---
let activeAutocompleteDropdown = null;

function setupMaterialAutocomplete(inputElement, onSelectCallback) {
    if (inputElement.hasAttribute('data-autocomplete-init')) return;
    inputElement.setAttribute('data-autocomplete-init', 'true');
    inputElement.setAttribute('autocomplete', 'off');
    inputElement.removeAttribute('list');

    // Create a global dropdown if it doesn't exist for this input
    const dropdown = document.createElement('div');
    dropdown.className = 'hidden absolute z-[9999] w-[350px] bg-white border border-slate-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto text-left';
    document.body.appendChild(dropdown);

    const closeDropdown = () => dropdown.classList.add('hidden');

    const updatePosition = () => {
        const rect = inputElement.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        // Ensure it doesn't overflow screen width
        if (rect.left + 350 > window.innerWidth) {
            dropdown.style.left = `${window.innerWidth - 360}px`;
        }
    };

    const renderResults = (query) => {
        const lowerQuery = query.toLowerCase();
        let count = 0;
        const maxResults = 50;
        let html = '';
        
        for (let i = 0; i < store.inventory.length; i++) {
            const item = store.inventory[i];
            if (item.category === 'Tools') continue;
            
            if (!query || item.description.toLowerCase().includes(lowerQuery)) {
                html += `<div class="px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 last:border-0 autocomplete-item" data-id="${item.id}" data-desc="${item.description}">
                    <div class="text-sm font-medium text-slate-800 leading-tight mb-1">${item.description}</div>
                    <div class="text-xs text-slate-500">${item.quantity || 0} ${item.deno || ''} @ Rs. ${formatCurrency(item.cost_per_unit)}</div>
                </div>`;
                count++;
                if (count >= maxResults) break;
            }
        }
        
        if (count === 0) {
            html = `<div class="px-3 py-2 text-sm text-slate-500 italic">No items found</div>`;
        }
        
        dropdown.innerHTML = html;
        updatePosition();
        dropdown.classList.remove('hidden');
        
        dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); 
                inputElement.value = el.getAttribute('data-desc');
                closeDropdown();
                if (onSelectCallback) onSelectCallback(inputElement.value);
            });
        });
    };

    inputElement.addEventListener('focus', () => {
        if (activeAutocompleteDropdown && activeAutocompleteDropdown !== dropdown) {
            activeAutocompleteDropdown.classList.add('hidden');
        }
        activeAutocompleteDropdown = dropdown;
        renderResults(inputElement.value);
    });

    inputElement.addEventListener('input', () => {
        renderResults(inputElement.value);
    });

    inputElement.addEventListener('blur', () => {
        setTimeout(closeDropdown, 150);
    });
    
    // Update position on window resize or scroll
    window.addEventListener('resize', () => {
        if (!dropdown.classList.contains('hidden')) updatePosition();
    });
    document.addEventListener('scroll', () => {
        if (!dropdown.classList.contains('hidden')) updatePosition();
    }, true);
}

let scopeMatRowIdCounter = 0;
function addScopeMaterialRow(scopeId, data = null) {
    scopeMatRowIdCounter++;
    const rowId = scopeMatRowIdCounter;
    
    const tbody = document.getElementById(`estScopeMaterialsBody-${scopeId}`);
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.id = `scopeMatRow-${scopeId}-${rowId}`;
    row.className = `scope-mat-row`;
    row.innerHTML = `
        <td class="px-2 py-1.5">
            <input type="text" class="est-mat-select w-full px-2 py-1 border rounded text-xs" 
                   value="${data?.description || ''}" 
                   placeholder="Search material...">
            <input type="hidden" class="est-mat-id" value="${data?.id || ''}">
        </td>
        <td class="px-2 py-1.5"><input type="number" step="any" class="est-mat-qty w-full px-2 py-1 border rounded text-xs text-center" value="${data?.qty || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-1.5"><input type="text" class="est-mat-unit w-full px-2 py-1 border rounded text-xs text-center bg-slate-50" value="${data?.unit || ''}" readonly></td>
        <td class="px-2 py-1.5"><input type="number" step="any" class="est-mat-cost w-full px-2 py-1 border rounded text-xs text-right" value="${data?.cost || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-1.5 text-right font-medium est-mat-total">${formatCurrency((data?.qty || 0) * (data?.cost || 0))}</td>
        <td class="px-2 py-1.5 text-center"><span class="est-mat-avail text-xxs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">${data?.availability || '-'}</span></td>
        <td class="px-2 py-1.5 text-center"><button type="button" onclick="removeScopeRow('scopeMatRow-${scopeId}-${rowId}')" class="text-red-500 hover:text-red-700 font-bold text-sm">×</button></td>
    `;
    tbody.appendChild(row);

    const inputEl = row.querySelector('.est-mat-select');
    setupMaterialAutocomplete(inputEl, (val) => fillScopeMaterialFromInventory(scopeId, rowId, val));
    
    // If there's an initial value (editing), handle changes as well
    inputEl.addEventListener('change', () => fillScopeMaterialFromInventory(scopeId, rowId, inputEl.value));
}

function fillScopeMaterialFromInventory(scopeId, rowId, desc) {
    const row = document.getElementById(`scopeMatRow-${scopeId}-${rowId}`);
    if (!row) return;
    
    const item = store.inventory.find(i => i.description === desc && i.category !== 'Tools');
    
    if (item) {
        row.querySelector('.est-mat-id').value = item.id || item._fbKey || '';
        row.querySelector('.est-mat-unit').value = item.deno || '';
        row.querySelector('.est-mat-cost').value = item.cost_per_unit || '';
        row.querySelector('.est-mat-avail').textContent = item.location || '-';
        updateEstimateTotals();
    } else {
        row.querySelector('.est-mat-id').value = '';
        row.querySelector('.est-mat-unit').value = '';
        row.querySelector('.est-mat-cost').value = '';
        row.querySelector('.est-mat-avail').textContent = '-';
        updateEstimateTotals();
    }
}

let scopeLabRowIdCounter = 0;
function addScopeLaborRow(scopeId, data = null) {
    scopeLabRowIdCounter++;
    const rowId = scopeLabRowIdCounter;
    
    const tbody = document.getElementById(`estScopeLaborBody-${scopeId}`);
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.id = `scopeLabRow-${scopeId}-${rowId}`;
    row.className = `scope-lab-row`;
    row.innerHTML = `
        <td class="px-2 py-1.5">
            <select class="est-lab-trade w-full px-2 py-1 border rounded text-xs">
                <option value="MA" ${data?.trade === 'MA' ? 'selected' : ''}>MA</option>
                <option value="CA" ${data?.trade === 'CA' ? 'selected' : ''}>CA</option>
                <option value="PA" ${data?.trade === 'PA' ? 'selected' : ''}>PA</option>
                <option value="PL" ${data?.trade === 'PL' ? 'selected' : ''}>PL</option>
                <option value="WE" ${data?.trade === 'WE' ? 'selected' : ''}>WE</option>
                <option value="BB" ${data?.trade === 'BB' ? 'selected' : ''}>BB</option>
                <option value="SW" ${data?.trade === 'SW' ? 'selected' : ''}>SW</option>
                <option value="AL" ${data?.trade === 'AL' ? 'selected' : ''}>AL</option>
                <option value="RW" ${data?.trade === 'RW' ? 'selected' : ''}>RW</option>
            </select>
        </td>
        <td class="px-2 py-1.5"><input type="number" step="any" class="est-lab-workers w-full px-2 py-1 border rounded text-xs text-center" value="${data?.workers || 1}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-1.5"><input type="number" step="any" class="est-lab-days w-full px-2 py-1 border rounded text-xs text-center" value="${data?.manDays || ''}" onchange="updateEstimateTotals()"></td>
        <td class="px-2 py-1.5"><input type="text" class="est-lab-desc w-full px-2 py-1 border rounded text-xs" placeholder="Task description" value="${data?.taskDescription || data?.desc || ''}"></td>
        <td class="px-2 py-1.5 text-center"><button type="button" onclick="removeScopeRow('scopeLabRow-${scopeId}-${rowId}')" class="text-red-500 hover:text-red-700 font-bold text-sm">×</button></td>
    `;
    tbody.appendChild(row);
}

function removeScopeRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) {
        el.remove();
        updateEstimateTotals();
    }
}

function updateEstimateTotals() {
    let grandMaterialsTotal = 0;
    let grandLaborTotal = 0;
    
    const blocks = document.querySelectorAll('.est-scope-block');
    blocks.forEach(b => {
        const sId = b.id.replace('estScopeBlock-', '');
        
        // Scope Materials total
        let scopeMatTotal = 0;
        b.querySelectorAll(`#estScopeMaterialsBody-${sId} tr`).forEach(row => {
            const qty = parseFloat(row.querySelector('.est-mat-qty')?.value) || 0;
            const cost = parseFloat(row.querySelector('.est-mat-cost')?.value) || 0;
            const total = qty * cost;
            scopeMatTotal += total;
            
            const totalCell = row.querySelector('.est-mat-total');
            if (totalCell) totalCell.textContent = formatCurrency(total);
        });
        
        const scopeMatTotalLabel = document.getElementById(`estScopeMaterialsTotal-${sId}`);
        if (scopeMatTotalLabel) scopeMatTotalLabel.textContent = formatCurrency(scopeMatTotal);
        grandMaterialsTotal += scopeMatTotal;
        
        // Scope Labor total
        let scopeLabTotal = 0;
        b.querySelectorAll(`#estScopeLaborBody-${sId} tr`).forEach(row => {
            const days = parseFloat(row.querySelector('.est-lab-days')?.value) || 0;
            scopeLabTotal += days;
        });
        
        const scopeLabTotalLabel = document.getElementById(`estScopeLaborTotal-${sId}`);
        if (scopeLabTotalLabel) scopeLabTotalLabel.textContent = `${scopeLabTotal} Man-Days`;
        grandLaborTotal += scopeLabTotal;
    });
    
    document.getElementById('estSummaryMaterials').textContent = formatCurrency(grandMaterialsTotal);
    document.getElementById('estSummaryLabor').textContent = grandLaborTotal;
    document.getElementById('estSummaryTotal').textContent = formatCurrency(grandMaterialsTotal);
}

function saveEstimate(event) {
    event.preventDefault();
    
    const workScopes = [];
    let grandMaterialsTotal = 0;
    let grandLaborTotal = 0;
    
    const flatMaterials = [];
    const flatLabor = [];
    const scopeDescriptions = [];
    
    const blocks = document.querySelectorAll('.est-scope-block');
    blocks.forEach(b => {
        const sId = b.id.replace('estScopeBlock-', '');
        const desc = b.querySelector('.est-scope-desc').value.trim();
        scopeDescriptions.push(desc);
        
        const materials = [];
        b.querySelectorAll(`#estScopeMaterialsBody-${sId} tr`).forEach(row => {
            const matInput = row.querySelector('.est-mat-select');
            const description = matInput?.value.trim() || '';
            if (!description || description === 'Select...') return;
            
            const item = {
                description: description,
                qty: parseFloat(row.querySelector('.est-mat-qty')?.value) || 0,
                unit: row.querySelector('.est-mat-unit')?.value || '',
                cost: parseFloat(row.querySelector('.est-mat-cost')?.value) || 0,
                availability: row.querySelector('.est-mat-avail')?.textContent || '-'
            };
            materials.push(item);
            flatMaterials.push(item);
            grandMaterialsTotal += (item.qty * item.cost);
        });
        
        const labor = [];
        b.querySelectorAll(`#estScopeLaborBody-${sId} tr`).forEach(row => {
            const trade = row.querySelector('.est-lab-trade')?.value || '';
            const workers = parseInt(row.querySelector('.est-lab-workers')?.value) || 1;
            const manDays = parseFloat(row.querySelector('.est-lab-days')?.value) || 0;
            const taskDescription = row.querySelector('.est-lab-desc')?.value || '';
            
            if (manDays <= 0) return;
            
            const item = {
                trade: trade,
                workers: workers,
                manDays: manDays,
                taskDescription: taskDescription
            };
            labor.push(item);
            flatLabor.push(item);
            grandLaborTotal += manDays;
        });
        
        workScopes.push({
            description: desc,
            materials: materials,
            labor: labor
        });
    });
    
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
    const description = document.getElementById('estDescription').value;
    const reference_doc = document.getElementById('estReference').value;
    
    const compiledWorkScope = scopeDescriptions.join('; ');
    
    if (id) {
        const est = store.estimates.find(e => e.id == id);
        if (est) {
            est.description = description;
            est.reference_doc = reference_doc;
            est.location = location;
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
        showToast('Estimate updated!');
    } else {
        const newEst = {
            id: store.estimates.length + 1,
            estimate_number: `EST/${new Date().getFullYear()}/${String(store.estimates.length + 1).padStart(4, '0')}`,
            description: description,
            reference_doc: reference_doc,
            location: location,
            endUser: endUser,
            workScope: compiledWorkScope,
            workScopes: workScopes,
            materials: flatMaterials,
            labor: flatLabor,
            total_cost: grandMaterialsTotal,
            totalManDays: grandLaborTotal,
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
let activeSignatoryDropdown = null;

function setupSignatoryAutocomplete(prefix) {
    const inputElement = document.getElementById(`est${prefix}Name`);
    const rankEl = document.getElementById(`est${prefix}Rank`);
    const svcEl = document.getElementById(`est${prefix}Svc`);
    
    if (!inputElement || inputElement.hasAttribute('data-autocomplete-init')) return;
    inputElement.setAttribute('data-autocomplete-init', 'true');

    // Create a global dropdown if it doesn't exist for this input
    const dropdown = document.createElement('div');
    dropdown.className = 'hidden absolute z-[9999] w-[350px] bg-white border border-slate-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto text-left';
    document.body.appendChild(dropdown);

    const closeDropdown = () => dropdown.classList.add('hidden');

    const updatePosition = () => {
        const rect = inputElement.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        if (rect.left + 350 > window.innerWidth) {
            dropdown.style.left = `${window.innerWidth - 360}px`;
        }
    };

    const renderResults = (query) => {
        const lowerQuery = query.toLowerCase();
        let count = 0;
        const maxResults = 50;
        let html = '';
        
        // Filter sailors whose off_no starts with 'EC' or 'AC'
        const eligibleSailors = store.sailors.filter(s => {
            const off = String(s.official_number || s.service_no || '').trim().toUpperCase();
            return off.startsWith('EC') || off.startsWith('AC');
        });
        
        for (let i = 0; i < eligibleSailors.length; i++) {
            const s = eligibleSailors[i];
            const offNo = s.official_number || s.service_no || '';
            const searchStr = `${s.name} ${offNo} ${s.rank || ''}`.toLowerCase();
            
            if (!query || searchStr.includes(lowerQuery)) {
                html += `<div class="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 autocomplete-item" data-name="${s.name}" data-rank="${s.rank || ''}" data-svc="${offNo}">
                    <div class="text-sm font-medium text-slate-800">${s.name}</div>
                    <div class="text-xs text-slate-500">${s.rank || '-'} • ${offNo}</div>
                </div>`;
                count++;
                if (count >= maxResults) break;
            }
        }
        
        if (count === 0) {
            html = `<div class="px-3 py-2 text-sm text-slate-500 italic">No names found</div>`;
        }
        
        dropdown.innerHTML = html;
        updatePosition();
        dropdown.classList.remove('hidden');
        
        dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); 
                inputElement.value = el.getAttribute('data-name');
                if (rankEl) rankEl.value = el.getAttribute('data-rank');
                if (svcEl) svcEl.value = el.getAttribute('data-svc');
                closeDropdown();
            });
        });
    };

    inputElement.addEventListener('focus', () => {
        if (activeSignatoryDropdown && activeSignatoryDropdown !== dropdown) {
            activeSignatoryDropdown.classList.add('hidden');
        }
        activeSignatoryDropdown = dropdown;
        renderResults(inputElement.value);
    });

    inputElement.addEventListener('input', () => {
        renderResults(inputElement.value);
        // Clear rank and svc if they modify the name manually
        if (rankEl) rankEl.value = '';
        if (svcEl) svcEl.value = '';
    });

    inputElement.addEventListener('blur', () => {
        setTimeout(closeDropdown, 150);
    });
    
    window.addEventListener('resize', () => {
        if (!dropdown.classList.contains('hidden')) updatePosition();
    });
    document.addEventListener('scroll', () => {
        if (!dropdown.classList.contains('hidden')) updatePosition();
    }, true);
}

function populateSignatoryDropdowns() {
    setupSignatoryAutocomplete('Created');
    setupSignatoryAutocomplete('Checked');
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
    if (window.fbSaveEstimate) fbSaveEstimate(est);
    closeModal('approvalModal');
    selectEstimate(est.id);
    showToast(`Estimate ${est.estimate_number} approved by ${authority}`);
}

function deleteEstimate() {
    const estId = store.selectedEstimate;
    if (!estId) return;
    
    const est = store.estimates.find(e => e.id === estId);
    if (!est) return;
    
    if (confirm(`⚠️ Are you sure you want to delete the estimate "${est.estimate_number}" (${est.description})?\n\nThis action cannot be undone.`)) {
        const targetFbKey = est._fbKey;
        if (!targetFbKey) {
            showToast('Cannot delete: Firebase key not found.');
            return;
        }
        
        opsDB.ref(`estimates/${targetFbKey}`).remove()
            .then(() => {
                store.selectedEstimate = null;
                // Reset right panel content
                document.getElementById('selectedEstimateNumber').textContent = 'Select an Estimate';
                document.getElementById('editEstimateBtn').style.display = 'none';
                document.getElementById('approveEstimateBtn').style.display = 'none';
                document.getElementById('deleteEstimateBtn').style.display = 'none';
                document.getElementById('estimateContent').innerHTML = `<p class="text-slate-500 text-center py-8">Select an estimate to view details</p>`;
                
                showToast(`Deleted estimate successfully!`);
                renderEstimates();
            })
            .catch(err => {
                console.error('Error deleting estimate:', err);
                showToast('Failed to delete estimate.');
            });
    }
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

    let sectionsHtml = '';
    
    if (est.workScopes && est.workScopes.length > 0) {
        est.workScopes.forEach((s, sIdx) => {
            const matRows = (s.materials || []).map((m, i) => `
                <tr>
                    <td style="text-align:center;width:8%;">${i + 1}</td>
                    <td>${m.description}</td>
                    <td style="text-align:center;width:10%;">${m.qty}</td>
                    <td style="text-align:center;width:10%;">${m.unit}</td>
                    <td style="text-align:right;width:15%;">${formatCurrency(m.cost)}</td>
                    <td style="text-align:right;width:15%;">${formatCurrency(m.qty * m.cost)}</td>
                </tr>`).join('');
                
            const labRows = (s.labor || []).map(l => `
                <tr>
                    <td>${l.trade}</td>
                    <td style="text-align:center;width:15%;">${l.workers}</td>
                    <td style="text-align:center;width:15%;">${l.manDays}</td>
                    <td>${l.taskDescription || ''}</td>
                </tr>`).join('');
                
            const sectionTotalCost = (s.materials || []).reduce((sum, m) => sum + (m.qty * m.cost), 0);
            const sectionTotalDays = (s.labor || []).reduce((sum, l) => sum + l.manDays, 0);

            sectionsHtml += `
                <div style="margin-top: 14px; border: 1px solid #94a3b8; border-radius: 6px; padding: 10px; background-color: #fafafa; page-break-inside: avoid;">
                    <div style="font-size: 11px; font-weight: bold; border-bottom: 1.5px solid #475569; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; color: #1e293b;">
                        Section ${sIdx + 1}: ${s.description}
                    </div>
                    
                    ${matRows ? `
                    <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px; color: #059669;">🛠️ Materials</div>
                    <table class="est-table" style="margin-bottom: 10px;">
                        <thead>
                            <tr><th>#</th><th>Material</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total</th></tr>
                        </thead>
                        <tbody>${matRows}</tbody>
                        <tfoot>
                            <tr><td colspan="5" style="text-align:right;"><b>Section Materials Cost</b></td><td style="text-align:right;"><b>${formatCurrency(sectionTotalCost)}</b></td></tr>
                        </tfoot>
                    </table>
                    ` : ''}
                    
                    ${labRows ? `
                    <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px; color: #2563eb;">👷 Labor Requirement</div>
                    <table class="est-table">
                        <thead><tr><th>Trade / Role</th><th>Workers</th><th>Man-Days</th><th>Task Description</th></tr></thead>
                        <tbody>${labRows}</tbody>
                        <tfoot><tr><td colspan="2" style="text-align:right;"><b>Section Total Man-Days</b></td><td colspan="2" style="text-align:left; padding-left: 10px;"><b>${sectionTotalDays}</b></td></tr></tfoot>
                    </table>
                    ` : ''}
                </div>
            `;
        });
    } else {
        // Fallback for flat layout (old estimates)
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
                <td>${l.taskDescription || ''}</td>
            </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">No labour</td></tr>';


        sectionsHtml = `
            <table class="est-table" style="margin-top:10px;">
                <thead>
                    <tr>
                        <th style="width:4%;text-align:center;">#</th>
                        <th>Material</th>
                        <th style="width:8%;text-align:center;">Qty</th>
                        <th style="width:8%;text-align:center;">Unit</th>
                        <th style="width:16%;text-align:right;">Unit Cost</th>
                        <th style="width:18%;text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>${matRows}</tbody>
                <tfoot>
                    <tr><td colspan="5" style="text-align:right;"><b>Materials Total</b></td><td style="text-align:right;"><b>${formatCurrency(est.total_cost)}</b></td></tr>
                </tfoot>
            </table>

            <table class="est-table" style="margin-top:10px;">
                <thead><tr>
                    <th style="width:25%;">Trade / Role</th>
                    <th style="width:15%;text-align:center;">Workers</th>
                    <th style="width:15%;text-align:center;">Man-Days</th>
                    <th>Task Description</th>
                </tr></thead>
                <tbody>${labRows}</tbody>
                <tfoot><tr><td colspan="2" style="text-align:right;"><b>Total Man-Days</b></td><td colspan="2" style="padding-left:10px;"><b>${est.totalManDays || 0}</b></td></tr></tfoot>
            </table>
        `;
    }

    return `
    <div class="est-sheet">
        <div style="width:100%;border-bottom:2.5px solid #000;padding-bottom:10px;margin-bottom:12px;">
            <table style="width:100%;border:none;border-collapse:collapse;">
                <tr>
                    <td style="border:none;padding:0;width:70px;vertical-align:middle;">
                        <img src="${window.location.href.split('?')[0].split('#')[0].replace('index.html', '')}navy_crest.jpg" style="height:60px;display:block;" alt="SLN Crest">
                    </td>
                    <td style="border:none;padding:0 0 0 12px;vertical-align:middle;">
                        <div style="font-size:15px;font-weight:800;letter-spacing:0.5px;color:#0f172a;line-height:1.25;">SRI LANKA NAVY<br>CAPTAIN CIVIL ENGINEERING DEPARTMENT (E)</div>
                        <div style="font-size:11px;font-weight:bold;color:#475569;margin-top:4px;">${store.zones.find(z => z.id === (est.zone_id || store.currentZone))?.name || 'Naval Civil Works'} — Cost Estimate</div>
                    </td>
                </tr>
            </table>
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
        ${est.workScope && !est.workScopes ? `<p style="font-size:11px;margin:4px 0;"><b>Work Scope:</b> ${est.workScope}</p>` : ''}

        ${sectionsHtml}
        
        <!-- Summary Section (Always printed at the bottom of sheets) -->
        <div style="margin-top: 14px; border: 1.5px solid #000; border-radius: 6px; padding: 12px; background-color: #f8fafc; page-break-inside: avoid;">
            <div style="font-size: 11px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase;">
                📊 Grand Summary
            </div>
            <table style="width: 100%; font-size: 11px; border: none;">
                <tr style="border: none;">
                    <td style="border: none; padding: 4px 0; width: 33%;"><b>Total Materials Cost:</b></td>
                    <td style="border: none; padding: 4px 0; color: #059669; font-size: 12px;"><b>${formatCurrency(est.total_cost)}</b></td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; padding: 4px 0;"><b>Total Labor (Man-Days):</b></td>
                    <td style="border: none; padding: 4px 0; color: #2563eb; font-size: 12px;"><b>${est.totalManDays || 0}</b></td>
                </tr>
                <tr style="border: none; border-top: 1px solid #cbd5e1;">
                    <td style="border: none; padding: 6px 0; font-size: 13px;"><b>Grand Total Estimate:</b></td>
                    <td style="border: none; padding: 6px 0; color: #d97706; font-size: 14px;"><b>${formatCurrency(est.total_cost)}</b></td>
                </tr>
            </table>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:26px;page-break-inside:avoid;">
            ${sigBlock('Created By', est.createdBy)}
            ${sigBlock('Checked By', est.checkedBy)}
            ${sigBlock('Approved By', est.approvedBy)}
        </div>
    </div>`;
}

function printEstimatesByIds(ids) {
    // Only print estimates belonging to the current zone
    const ests = store.estimates.filter(e => ids.includes(e.id) && (!e.zone_id || e.zone_id === store.currentZone));
    if (ests.length === 0) { showToast('No estimates found for this zone to print', 'error'); return; }

    const sheets = ests.map(e => buildEstimatePrintHTML(e)).join('<div style="page-break-after:always;"></div>');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html><head><title>NCW Estimate Print</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .est-sheet { width: 185mm; margin: 0 auto; padding: 10mm 0; }
  .est-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .est-table th { border: 1px solid #555; padding: 4px 5px; background: #e2e8f0; text-align: left; font-size: 10px; }
  .est-table td { border: 1px solid #555; padding: 3px 5px; font-size: 10px; }
  .est-table tfoot td { background: #f1f5f9; font-weight: bold; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { margin: 0; }
    .est-sheet { width: 100%; margin: 0; padding: 0; }
  }
</style></head>
<body>${sheets}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
}

function exportEstimatesToPDFByIds(ids) {
    const ests = store.estimates.filter(e => ids.includes(e.id) && (!e.zone_id || e.zone_id === store.currentZone));
    if (ests.length === 0) { showToast('No estimates found for this zone to export', 'error'); return; }
    
    if (typeof html2pdf === 'undefined') {
        showToast('PDF library is loading, please try again in a few seconds.', 'error');
        return;
    }

    showToast('Generating PDF, please wait...', 'info');

    // Create a container (not attached to the body)
    const tempDiv = document.createElement('div');
    tempDiv.style.width = '750px';
    tempDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
    tempDiv.style.color = '#000';
    tempDiv.style.backgroundColor = '#fff';
    
    // buildEstimatePrintHTML(e) already returns <div class="est-sheet">...</div>
    tempDiv.innerHTML = ests.map(e => buildEstimatePrintHTML(e)).join('<div class="html2pdf__page-break"></div>');
    
    // Inject the necessary table styles for PDF
    const style = document.createElement('style');
    style.innerHTML = `
        .est-sheet { padding: 10px; width: 100%; box-sizing: border-box; }
        .est-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; word-wrap: break-word; }
        .est-table th { border: 1px solid #555; padding: 4px 5px; background: #e2e8f0; text-align: left; }
        .est-table td { border: 1px solid #555; padding: 3px 5px; word-wrap: break-word; }
        .est-table tfoot td { background: #f1f5f9; font-weight: bold; }
        .html2pdf__page-break { page-break-after: always; }
    `;
    tempDiv.appendChild(style);

    const filename = ests.length === 1 
        ? `Estimate_${ests[0].estimate_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : `Estimates_Bulk_Export.pdf`;

    const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(tempDiv).save().then(() => {
        showToast('PDF exported successfully', 'success');
    }).catch((err) => {
        console.error("PDF Export Error:", err);
        showToast('PDF export failed, please try again', 'error');
    });
}

function printEstimate() {
    if (!store.selectedEstimate) { showToast('Select an estimate first', 'error'); return; }
    printEstimatesByIds([store.selectedEstimate]);
}

function exportEstimatePDF() {
    if (!store.selectedEstimate) { showToast('Select an estimate first', 'error'); return; }
    exportEstimatesToPDFByIds([store.selectedEstimate]);
}

function bulkPrintEstimates() {
    if (store.selectedEstimatesForPrint.length === 0) {
        showToast('Tick the estimates you want to print first', 'error');
        return;
    }
    printEstimatesByIds([...store.selectedEstimatesForPrint]);
}

function bulkExportEstimatesPDF() {
    if (store.selectedEstimatesForPrint.length === 0) {
        showToast('Tick the estimates you want to export first', 'error');
        return;
    }
    exportEstimatesToPDFByIds([...store.selectedEstimatesForPrint]);
}

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
                    onclick="selectLocation('${loc.id}')">
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
    if (!loc) return;
    const records = store.maintenanceRecords.filter(r => r.location_id === id);

    document.getElementById('selectedLocationName').textContent = `${loc.building_name} — ${loc.sub_location || 'General'}`;
    document.getElementById('selectedLocationZone').textContent = `Zone: ${loc.zone_id}`;
    
    // Show action buttons container
    const actionBtns = document.getElementById('locationActionButtons');
    if (actionBtns) actionBtns.style.display = 'flex';
    
    const addMaintBtn = document.getElementById('addMaintenanceBtn');
    if (addMaintBtn) addMaintBtn.style.display = 'block';

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
                    onclick="selectLocation('${loc.id}')">
                    <span class="text-slate-600">📍 ${loc.sub_location || 'General'}</span>
                    ${recCount > 0 ? `<span class="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">${recCount}</span>` : ''}
                </div>`;
            }).join('')}
        </div>
    `).join('') || '<p class="text-slate-400 text-center py-6 text-sm">No locations found</p>';
}

function openAddLocationModal() {
    const titleEl = document.getElementById('locationModalTitle');
    if (titleEl) titleEl.textContent = 'Add Location';
    
    const idEl = document.getElementById('locId');
    if (idEl) idEl.value = '';
    const keyEl = document.getElementById('locFbKey');
    if (keyEl) keyEl.value = '';
    
    document.getElementById('locZone').value = store.currentZone;
    document.getElementById('locBuilding').value = '';
    document.getElementById('locSubLocation').value = '';
    document.getElementById('locDescription').value = '';
    document.getElementById('addLocationModal').classList.remove('hidden');
}

function editLocation() {
    if (!store.selectedLocation) return;
    const loc = store.locations.find(l => l.id === store.selectedLocation);
    if (!loc) return;

    const titleEl = document.getElementById('locationModalTitle');
    if (titleEl) titleEl.textContent = 'Edit Location';

    const idEl = document.getElementById('locId');
    if (idEl) idEl.value = loc.id;
    const keyEl = document.getElementById('locFbKey');
    if (keyEl) keyEl.value = loc._fbKey || '';

    document.getElementById('locZone').value = loc.zone_id || store.currentZone;
    document.getElementById('locBuilding').value = loc.building_name || '';
    document.getElementById('locSubLocation').value = loc.sub_location || '';
    document.getElementById('locDescription').value = loc.description || '';
    document.getElementById('addLocationModal').classList.remove('hidden');
}

function deleteLocation() {
    if (!store.selectedLocation) return;
    const loc = store.locations.find(l => l.id === store.selectedLocation);
    if (!loc) return;

    if (!confirm(`Are you sure you want to delete the location "${loc.building_name} — ${loc.sub_location || 'General'}"? This will also delete all its maintenance records.`)) {
        return;
    }

    opsDB.ref(`locations/${loc._fbKey}`).remove().then(() => {
        // Delete linked maintenance records
        const linkedRecords = store.maintenanceRecords.filter(r => r.location_id === loc.id);
        linkedRecords.forEach(r => {
            if (r._fbKey) {
                opsDB.ref(`maintenance_records/${r._fbKey}`).remove();
            }
        });

        showToast('Location and its records deleted successfully!');
        store.selectedLocation = null;
        document.getElementById('selectedLocationName').textContent = 'Select a Location';
        document.getElementById('selectedLocationZone').textContent = '';
        
        const actionBtns = document.getElementById('locationActionButtons');
        if (actionBtns) actionBtns.style.display = 'none';
        
        document.getElementById('maintenanceHistory').innerHTML = '<p class="text-slate-500 text-center py-8">Select a location to view maintenance history</p>';
        renderLocationsList();
    }).catch(err => {
        console.error(err);
        showToast('Error deleting location', 'error');
    });
}

function autofillLocationDetails(buildingName) {
    if (!buildingName) return;
    const loc = store.locations.find(l => l.zone_id === store.currentZone && l.building_name === buildingName);
    if (loc) {
        document.getElementById('woSubLocation').value = loc.sub_location || '';
        const descInput = document.getElementById('woDescription');
        if (descInput && !descInput.value.trim()) {
            descInput.value = loc.description || '';
        }
    }
}

function saveLocation(event) {
    event.preventDefault();
    
    const idVal = document.getElementById('locId').value;
    const fbKeyVal = document.getElementById('locFbKey').value;
    
    const locData = {
        zone_id: document.getElementById('locZone').value,
        building_name: document.getElementById('locBuilding').value,
        sub_location: document.getElementById('locSubLocation').value,
        description: document.getElementById('locDescription').value
    };
    
    if (fbKeyVal) {
        locData._fbKey = fbKeyVal;
        locData.id = parseInt(idVal);
    } else {
        const maxId = store.locations.length ? Math.max(...store.locations.map(l => l.id || 0)) : 0;
        locData.id = maxId + 1;
    }
    
    fbSaveLocation(locData).then(() => {
        closeModal('addLocationModal');
        showToast(fbKeyVal ? 'Location updated successfully!' : 'Location added successfully!');
        
        document.getElementById('locId').value = '';
        document.getElementById('locFbKey').value = '';
        document.getElementById('locBuilding').value = '';
        document.getElementById('locSubLocation').value = '';
        document.getElementById('locDescription').value = '';
        
        // If we edited the currently selected location, update the details view
        if (fbKeyVal && store.selectedLocation === locData.id) {
            selectLocation(locData.id);
        } else {
            renderLocationsList();
        }
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
    // Determine if the current officer has access to "All Zone" (Admin-&-Staff-Duties)
    let hasAllZoneAccess = true;
    let allowedZones = store.zones.map(z => z.id); // default all

    if (store.activeProfileType === 'OIC') {
        if (store.activeOicProfileId) {
            const profile = getOicProfiles().find(p => p.id === store.activeOicProfileId);
            if (profile) {
                // If it is NOT the main admin (3576), check their permission
                const isMain = (profile.serviceNo || '').includes('3576');
                if (!isMain) {
                    hasAllZoneAccess = profile.permAllZones === true;
                    allowedZones = profile.allowedZones || [];
                }
            }
        }
    } else if (store.activeProfileType === 'ZoneInCharge' || store.activeProfileType === 'ZoneSubInCharge') {
        allowedZones = [store.activeProfileZone];
        hasAllZoneAccess = false;
    }

    const visibleZones = store.zones.filter(z => allowedZones.includes(z.id));
    let optionsHtml = visibleZones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
    
    // Add Admin & Staff Duties special option
    if (hasAllZoneAccess) {
        const hasAdminZone = visibleZones.some(z => isAdminStaffDuties(z.id));
        if (!hasAdminZone) {
            optionsHtml += `<option value="Admin-&-Staff-Duties">Admin & Staff Duties</option>`;
        }
    }

    ['zoneSelector', 'locZone'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = optionsHtml;

        if (visibleZones.some(z => z.id === prev) || (isAdminStaffDuties(prev) && hasAllZoneAccess)) {
            sel.value = prev;
        } else {
            // Select the first visible zone
            if (visibleZones.length > 0) {
                sel.value = visibleZones[0].id;
                if (selId === 'zoneSelector') {
                    store.currentZone = visibleZones[0].id;
                }
            } else if (hasAllZoneAccess) {
                sel.value = 'Admin-&-Staff-Duties';
                if (selId === 'zoneSelector') {
                    store.currentZone = 'Admin-&-Staff-Duties';
                }
            }
        }
    });

    toggleViewsBasedOnZone();
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
        const sailor = store.sailors.find(s => String(s.id) === String(l.sailor_id) || String(s._fbKey) === String(l.sailor_id));
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
    document.getElementById('bulkUploadTitle').textContent = type === 'inventory' ? 'Inventory' : 'LMD Locations';
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

function parseCsvLine(line) {
    const result = [];
    let insideQuote = false;
    let entry = '';
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
            result.push(cleanCsvValue(entry));
            entry = '';
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
    if (clean.includes('description') || clean === 'item' || clean === 'desc') {
        return 'description';
    }
    if (clean.includes('category') || clean === 'cat' || clean === 'group') {
        return 'category';
    }
    if (clean === 'deno' || clean === 'unit' || clean === 'uom' || clean === 'denominations') {
        return 'deno';
    }
    if (clean.includes('quantity') || clean === 'qty' || clean === 'stock' || clean === 'amount') {
        return 'quantity';
    }
    if (clean.includes('unit cost') || clean.includes('unit_cost') || clean === 'cost per unit' || clean === 'rate' || clean === 'cost' || clean === 'price') {
        return 'unit cost';
    }
    if (clean.includes('requirement') || clean === 'req') {
        return 'requirement';
    }
    if (clean.includes('location') || clean === 'loc' || clean === 'store') {
        return 'location';
    }
    if (clean.includes('on-charge') || clean.includes('on_charge') || clean.includes('charge ref') || clean === 'ref') {
        return 'on-charge ref';
    }
    if (clean.includes('date')) {
        return 'date added';
    }
    return clean;
}

function normalizeLocationsCsvHeader(h) {
    const clean = h.trim().toLowerCase();
    if (clean.includes('zone') || clean === 'zone_id') {
        return 'zone';
    }
    if (clean.includes('building') || clean === 'building_name') {
        return 'building name';
    }
    if (clean.includes('sub-location') || clean.includes('sub_location') || clean === 'sublocation') {
        return 'sub-location';
    }
    if (clean.includes('description') || clean === 'desc') {
        return 'description';
    }
    return clean;
}

function processInventoryCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
        showToast('CSV is empty or missing data rows', 'error');
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
            if (header === 'description') itemData.description = values[index];
            if (header === 'category') itemData.category = values[index];
            if (header === 'deno') itemData.deno = values[index];
            if (header === 'quantity') itemData.quantity = parseFloat(values[index]) || 0;
            if (header === 'unit cost') itemData.cost_per_unit = safeParseCost(values[index]);
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
    
    const headers = parseCsvLine(lines[0]).map(normalizeLocationsCsvHeader);
    let addedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
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
    stationName: 'Naval Civil Works · Miss Garrison · Trincomalee',
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
function ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(item => item !== null && item !== undefined);
    if (typeof val === 'object') {
        return Object.values(val).filter(item => item !== null && item !== undefined);
    }
    return [];
}

function initSettingsListener() {
    opsDB.ref('settings').on('value', snapshot => {
        if (snapshot.exists()) {
            const saved = snapshot.val();
            store.settings = { ...defaultSettings, ...saved };
            // Restore arrays and objects properly
            if (saved.zones) store.settings.zones = ensureArray(saved.zones);
            if (saved.offChargeDestinations) store.settings.offChargeDestinations = ensureArray(saved.offChargeDestinations);
            if (saved.approvalAuthorities) store.settings.approvalAuthorities = ensureArray(saved.approvalAuthorities);
            if (saved.workOrderTypes) store.settings.workOrderTypes = ensureArray(saved.workOrderTypes);
            if (saved.priorityLevels) store.settings.priorityLevels = ensureArray(saved.priorityLevels);
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
        if (titleEl.childNodes && titleEl.childNodes.length > 0) {
            titleEl.childNodes[0].textContent = s.systemTitle.replace(/v\S+$/, '').trim() + ' ';
        } else {
            titleEl.textContent = s.systemTitle + ' ';
        }
        if (vSpan) vSpan.textContent = s.systemTitle.match(/v[\d.]+/) ? s.systemTitle.match(/v[\d.]+/)[0] : 'v2.2';
    }
    const brandTag = document.querySelector('.brand-tag');
    if (brandTag && s.stationName) brandTag.textContent = s.stationName;

    toggleViewsBasedOnZone();
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
        setValue('cfg-googleClientId', s.googleClientId);
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
        
        setValue('cfg-userSubSailorId', inc.subSailorId || '');
        const subDisplayName = inc.subRank ? `${inc.subRank} ${inc.subName} (${inc.subServiceNo})` : (inc.subName || '');
        setValue('cfg-userSubName', subDisplayName || '');
        setValue('cfg-userSubRank', inc.subRank || '');
        setValue('cfg-userSubServiceNo', inc.subServiceNo || '');

        setValue('cfg-userPassword', inc.password || '');
        
        setValue('cfg-woInchargeId', inc.woInchargeId || '');
        setValue('cfg-woInchargeName', inc.woInchargeName || '');
        setValue('cfg-woSupervisorId', inc.woSupervisorId || '');
        setValue('cfg-woSupervisorName', inc.woSupervisorName || '');
        
        setValue('cfg-woArtificerId', inc.woArtificerId || '');
        setValue('cfg-woArtificerName', inc.woArtificerName || '');
    } else {
        setValue('cfg-userSailorId', '');
        setValue('cfg-userName', '');
        setValue('cfg-userRank', '');
        setValue('cfg-userServiceNo', '');
        
        setValue('cfg-userSubSailorId', '');
        setValue('cfg-userSubName', '');
        setValue('cfg-userSubRank', '');
        setValue('cfg-userSubServiceNo', '');

        setValue('cfg-userPassword', '');
        
        setValue('cfg-woInchargeId', '');
        setValue('cfg-woInchargeName', '');
        setValue('cfg-woSupervisorId', '');
        setValue('cfg-woSupervisorName', '');
        
        setValue('cfg-woArtificerId', '');
        setValue('cfg-woArtificerName', '');
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
        profiles = Object.values(s.oicProfiles).filter(p => p !== null && p !== undefined);
    }
    // Backward compatibility for the legacy single OIC
    if (profiles.length === 0 && (s.oicName || s.oicServiceNo)) {
        profiles.push({
            id: 'legacy_oic',
            name: s.oicName || '',
            rank: s.oicRank || '',
            serviceNo: s.oicServiceNo || '',
            password: s.oicPassword || '',
            permSettings: true,
            permAllZones: true
        });
    }
    return profiles;
}

// Render OIC Profiles Management List
function renderSettingsOicProfilesList() {
    const listEl = document.getElementById('cfg-oicProfilesList');
    if (!listEl) return;

    const profiles = getOicProfiles();
    
    // Check if logged-in user is the main administrator (NRC 3576)
    const isMain = (store.currentUser?.serviceNo || '').includes('3576');

    // Show/hide Add Officer button
    const addBtn = document.querySelector('button[onclick="openOicProfileModal()"]');
    if (addBtn) {
        addBtn.style.display = isMain ? '' : 'none';
    }

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

        const isProfileMain = (p.serviceNo || '').includes('3576');
        const permList = [];
        if (p.permSettings || isProfileMain) permList.push('Settings');
        if (p.permAllZones || isProfileMain) permList.push('All Zones');
        const permText = permList.length > 0 ? `Access: ${permList.join(', ')}` : 'Access: None';

        const actionsHtml = isMain ? `
            <div class="flex items-center gap-1">
                <button onclick="editOicProfile('${p.id}')" class="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onclick="deleteOicProfile('${p.id}')" class="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        ` : '';

        return `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div class="flex items-center gap-3 min-w-0">
                    ${avatarHtml}
                    <div class="min-w-0 text-left">
                        <p class="text-sm font-bold text-slate-800 truncate">${p.rank} ${p.name}</p>
                        <p class="text-[11px] text-slate-400 font-semibold font-mono">${p.serviceNo} ${p.password ? '• 🔒 Password Protected' : '• 🔓 No Password'}</p>
                        <p class="text-[10px] text-teal-650 font-semibold mt-0.5">${permText}</p>
                    </div>
                </div>
                ${actionsHtml}
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
    
    document.getElementById('oicPermSettings').checked = false;
    document.getElementById('oicPermDashboard').checked = true;
    document.getElementById('oicPermJobCards').checked = true;
    document.getElementById('oicPermInventory').checked = true;
    document.getElementById('oicPermEstimates').checked = true;
    document.getElementById('oicPermLMD').checked = true;
    document.getElementById('oicPermSailors').checked = true;
    document.getElementById('oicPermReports').checked = true;
    
    document.getElementById('oicPermAllZones').checked = true;
    renderOicZonesPermissionCheckboxes(store.zones.map(z => z.id));
    toggleSelectAllZonesPerm(true);
    
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
    
    // Tab permissions
    document.getElementById('oicPermSettings').checked = profile.permSettings === true;
    document.getElementById('oicPermDashboard').checked = profile.permDashboard !== false;
    document.getElementById('oicPermJobCards').checked = profile.permJobCards !== false;
    document.getElementById('oicPermInventory').checked = profile.permInventory !== false;
    document.getElementById('oicPermEstimates').checked = profile.permEstimates !== false;
    document.getElementById('oicPermLMD').checked = profile.permLMD !== false;
    document.getElementById('oicPermSailors').checked = profile.permSailors !== false;
    document.getElementById('oicPermReports').checked = profile.permReports !== false;

    // Zone permissions
    const allZonesChecked = profile.permAllZones === true;
    document.getElementById('oicPermAllZones').checked = allZonesChecked;
    
    const allowedZones = profile.allowedZones || [];
    renderOicZonesPermissionCheckboxes(allowedZones);
    
    if (allZonesChecked) {
        toggleSelectAllZonesPerm(true);
    }
    
    document.getElementById('oicProfileModal').classList.remove('hidden');
}

function saveOicProfile(event) {
    event.preventDefault();
    const id = document.getElementById('oicProfId').value;
    const name = document.getElementById('oicProfName').value.trim();
    const rank = document.getElementById('oicProfRank').value.trim();
    const serviceNo = document.getElementById('oicProfServiceNo').value.trim();
    const password = document.getElementById('oicProfPassword').value;
    
    const permSettings = document.getElementById('oicPermSettings').checked;
    const permDashboard = document.getElementById('oicPermDashboard').checked;
    const permJobCards = document.getElementById('oicPermJobCards').checked;
    const permInventory = document.getElementById('oicPermInventory').checked;
    const permEstimates = document.getElementById('oicPermEstimates').checked;
    const permLMD = document.getElementById('oicPermLMD').checked;
    const permSailors = document.getElementById('oicPermSailors').checked;
    const permReports = document.getElementById('oicPermReports').checked;
    
    const permAllZones = document.getElementById('oicPermAllZones').checked;
    
    // Collect allowed zones
    let allowedZones = [];
    if (permAllZones) {
        allowedZones = store.zones.map(z => z.id);
    } else {
        document.querySelectorAll('input[name="oicZonePermCheckbox"]:checked').forEach(cb => {
            allowedZones.push(cb.value);
        });
    }

    const profileId = id || 'oic_' + Date.now();

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
        allowedZones
    };

    if (!store.settings.oicProfiles) store.settings.oicProfiles = {};
    store.settings.oicProfiles[profileId] = profileData;

    opsDB.ref(`settings/oicProfiles/${profileId}`).set(profileData).then(() => {
        closeModal('oicProfileModal');
        applySettings();
        renderSettingsOicProfilesList();
        showToast('Officer Profile saved successfully');
        if (store.activeOicProfileId === profileId) {
            applyActiveProfile();
        }
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

function renderOicZonesPermissionCheckboxes(selectedZones = []) {
    const listEl = document.getElementById('oicZonesPermissionList');
    if (!listEl) return;
    
    // Sort zones by name for cleaner display
    const sortedZones = [...store.zones].sort((a, b) => a.name.localeCompare(b.name));
    
    listEl.innerHTML = sortedZones.map(z => {
        const checked = selectedZones.includes(z.id) ? 'checked' : '';
        return `
            <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer truncate" title="${z.name}">
                <input type="checkbox" name="oicZonePermCheckbox" value="${z.id}" ${checked} onchange="onOicZoneCheckboxChange()" class="rounded border-slate-300 text-teal-600 focus:ring-teal-500">
                <span class="truncate">${z.name}</span>
            </label>
        `;
    }).join('') || '<div class="col-span-2 text-center text-xs text-slate-400 italic">No zones configured yet</div>';
}

function toggleSelectAllZonesPerm(checked) {
    document.querySelectorAll('input[name="oicZonePermCheckbox"]').forEach(cb => {
        cb.checked = checked;
        cb.disabled = checked;
    });
}

function onOicZoneCheckboxChange() {
    // If any individual zone checkbox is unchecked, make sure 'All Zones Access' is unchecked
    const allChecked = Array.from(document.querySelectorAll('input[name="oicZonePermCheckbox"]')).every(cb => cb.checked);
    const allZonesCheckbox = document.getElementById('oicPermAllZones');
    if (allZonesCheckbox && !allChecked) {
        allZonesCheckbox.checked = false;
    }
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

// Autocomplete for Settings Zone Sub In-Charge Profile
function showSettingsSubSailorResults() {
    const resultsDiv = document.getElementById('cfg-subSailorSearchResults');
    if (!resultsDiv) return;
    resultsDiv.classList.remove('hidden');
    
    const inputVal = document.getElementById('cfg-userSubName').value.trim();
    if (inputVal.includes('(')) {
        filterSettingsSubSailorResults('');
    } else {
        filterSettingsSubSailorResults(inputVal);
    }
}

function filterSettingsSubSailorResults(query) {
    const resultsDiv = document.getElementById('cfg-subSailorSearchResults');
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
    
    let html = `<div onclick="selectSettingsSubSailor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Sub In-Charge
    </div>`;
    
    if (filtered.length === 0) {
        html += '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
    } else {
        html += filtered.map(s => {
            const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
            const escDisplayName = displayName.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `<div onclick="selectSettingsSubSailor('${s.id ?? s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
        }).join('');
    }
    
    resultsDiv.innerHTML = html;
}

function selectSettingsSubSailor(sailorId, displayName) {
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-userSubName').value = '';
        document.getElementById('cfg-subSailorSearchResults').classList.add('hidden');
        return;
    }
    
    if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
    if (!store.settings.zoneInCharges[zoneId]) {
        showToast('Please set the Profile In-Charge Sailor first', 'error');
        document.getElementById('cfg-userSubName').value = '';
        document.getElementById('cfg-subSailorSearchResults').classList.add('hidden');
        return;
    }
    
    if (sailorId) {
        const sailor = store.sailors.find(s => String(s.id ?? s._fbKey) === String(sailorId));
        if (sailor) {
            setValue('cfg-userSubName', displayName);
            setValue('cfg-userSubSailorId', sailorId);
            setValue('cfg-userSubRank', sailor.rank || '');
            setValue('cfg-userSubServiceNo', sailor.official_number || sailor.service_no || '');
            
            store.settings.zoneInCharges[zoneId].subName = sailor.name;
            store.settings.zoneInCharges[zoneId].subRank = sailor.rank || '';
            store.settings.zoneInCharges[zoneId].subServiceNo = sailor.official_number || sailor.service_no || '';
            store.settings.zoneInCharges[zoneId].subSailorId = sailorId;
            
            opsDB.ref(`settings/zoneInCharges/${zoneId}/subName`).set(sailor.name);
            opsDB.ref(`settings/zoneInCharges/${zoneId}/subRank`).set(sailor.rank || '');
            opsDB.ref(`settings/zoneInCharges/${zoneId}/subServiceNo`).set(sailor.official_number || sailor.service_no || '');
            opsDB.ref(`settings/zoneInCharges/${zoneId}/subSailorId`).set(sailorId).then(() => {
                applySettings();
                showToast(`Sub In-Charge for ${zoneId} updated to ${sailor.rank} ${sailor.name}`);
            });
        }
    } else {
        setValue('cfg-userSubName', '');
        setValue('cfg-userSubSailorId', '');
        setValue('cfg-userSubRank', '');
        setValue('cfg-userSubServiceNo', '');
        
        delete store.settings.zoneInCharges[zoneId].subName;
        delete store.settings.zoneInCharges[zoneId].subRank;
        delete store.settings.zoneInCharges[zoneId].subServiceNo;
        delete store.settings.zoneInCharges[zoneId].subSailorId;
        
        opsDB.ref(`settings/zoneInCharges/${zoneId}/subName`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/subRank`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/subServiceNo`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/subSailorId`).remove().then(() => {
            applySettings();
            showToast(`Sub In-Charge for ${zoneId} removed`);
        });
    }
    
    document.getElementById('cfg-subSailorSearchResults').classList.add('hidden');
}

function getAcSailors() {
    return store.sailors.filter(sailor => {
        const offNo = (sailor.official_number || sailor.officialNumber || sailor.service_no || '').trim();
        const cleanOffNo = offNo.replace(/^[^a-zA-Z0-9]+/, '');
        return cleanOffNo.toUpperCase().startsWith('AC');
    });
}

// Autocomplete for Settings Work Order Artificer
function showWoArtificerResults() {
    const resultsDiv = document.getElementById('cfg-woArtificerSearchResults');
    if (!resultsDiv) return;
    resultsDiv.classList.remove('hidden');
    
    const inputVal = document.getElementById('cfg-woArtificerName').value.trim();
    if (inputVal.includes('(')) {
        filterWoArtificerResults('');
    } else {
        filterWoArtificerResults(inputVal);
    }
}

function filterWoArtificerResults(query) {
    const resultsDiv = document.getElementById('cfg-woArtificerSearchResults');
    if (!resultsDiv) return;
    
    const acSailors = getAcSailors();
    const q = query.toLowerCase().trim();
    
    let filtered = acSailors;
    if (q && !query.includes('(')) {
        filtered = acSailors.filter(s => {
            const name = (s.name || '').toLowerCase();
            const offNo = (s.official_number || s.officialNumber || s.service_no || '').toLowerCase();
            const rank = (s.rank || '').toLowerCase();
            return name.includes(q) || offNo.includes(q) || rank.includes(q);
        });
    }
    
    let html = `<div onclick="selectWoArtificer('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Artificer
    </div>`;
    
    if (filtered.length === 0) {
        html += '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
    } else {
        html += filtered.map(s => {
            const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
            const escDisplayName = displayName.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `<div onclick="selectWoArtificer('${s.id ?? s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
        }).join('');
    }
    
    resultsDiv.innerHTML = html;
}

function selectWoArtificer(sailorId, displayName) {
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-woArtificerName').value = '';
        document.getElementById('cfg-woArtificerSearchResults').classList.add('hidden');
        return;
    }
    
    if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
    if (!store.settings.zoneInCharges[zoneId]) {
        showToast('Please set the Profile Sailor first', 'error');
        document.getElementById('cfg-woArtificerName').value = '';
        document.getElementById('cfg-woArtificerSearchResults').classList.add('hidden');
        return;
    }
    
    if (sailorId) {
        const sailor = store.sailors.find(s => String(s.id ?? s._fbKey) === String(sailorId));
        if (sailor) {
            setValue('cfg-woArtificerName', displayName);
            setValue('cfg-woArtificerId', sailorId);
            
            store.settings.zoneInCharges[zoneId].woArtificerId = sailorId;
            store.settings.zoneInCharges[zoneId].woArtificerName = displayName;
            
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerId`).set(sailorId);
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerName`).set(displayName).then(() => {
                applySettings();
                showToast(`Work Order Artificer for ${zoneId} updated`);
            });
        }
    } else {
        setValue('cfg-woArtificerName', '');
        setValue('cfg-woArtificerId', '');
        delete store.settings.zoneInCharges[zoneId].woArtificerId;
        delete store.settings.zoneInCharges[zoneId].woArtificerName;
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerId`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woArtificerName`).remove().then(() => {
            applySettings();
            showToast(`Work Order Artificer for ${zoneId} removed`);
        });
    }
    
    document.getElementById('cfg-woArtificerSearchResults').classList.add('hidden');
}

// Autocomplete for Settings Work Order Incharge
function showWoInchargeResults() {
    const resultsDiv = document.getElementById('cfg-woInchargeSearchResults');
    if (!resultsDiv) return;
    resultsDiv.classList.remove('hidden');
    
    const inputVal = document.getElementById('cfg-woInchargeName').value.trim();
    if (inputVal.includes('(')) {
        filterWoInchargeResults('');
    } else {
        filterWoInchargeResults(inputVal);
    }
}

function filterWoInchargeResults(query) {
    const resultsDiv = document.getElementById('cfg-woInchargeSearchResults');
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
    
    let html = `<div onclick="selectWoIncharge('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove In-Charge
    </div>`;
    
    if (filtered.length === 0) {
        html += '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
    } else {
        html += filtered.map(s => {
            const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
            const escDisplayName = displayName.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `<div onclick="selectWoIncharge('${s.id ?? s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
        }).join('');
    }
    
    resultsDiv.innerHTML = html;
}

function selectWoIncharge(sailorId, displayName) {
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-woInchargeName').value = '';
        document.getElementById('cfg-woInchargeSearchResults').classList.add('hidden');
        return;
    }
    
    if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
    if (!store.settings.zoneInCharges[zoneId]) {
        showToast('Please set the Profile Sailor first', 'error');
        document.getElementById('cfg-woInchargeName').value = '';
        document.getElementById('cfg-woInchargeSearchResults').classList.add('hidden');
        return;
    }
    
    if (sailorId) {
        const sailor = store.sailors.find(s => String(s.id ?? s._fbKey) === String(sailorId));
        if (sailor) {
            setValue('cfg-woInchargeName', displayName);
            setValue('cfg-woInchargeId', sailorId);
            
            store.settings.zoneInCharges[zoneId].woInchargeId = sailorId;
            store.settings.zoneInCharges[zoneId].woInchargeName = displayName;
            
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeId`).set(sailorId);
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeName`).set(displayName).then(() => {
                applySettings();
                showToast(`Work Order In-Charge for ${zoneId} updated`);
            });
        }
    } else {
        setValue('cfg-woInchargeName', '');
        setValue('cfg-woInchargeId', '');
        delete store.settings.zoneInCharges[zoneId].woInchargeId;
        delete store.settings.zoneInCharges[zoneId].woInchargeName;
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeId`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woInchargeName`).remove().then(() => {
            applySettings();
            showToast(`Work Order In-Charge for ${zoneId} removed`);
        });
    }
    
    document.getElementById('cfg-woInchargeSearchResults').classList.add('hidden');
}


// Autocomplete for Settings Work Order Supervisor
function showWoSupervisorResults() {
    const resultsDiv = document.getElementById('cfg-woSupervisorSearchResults');
    if (!resultsDiv) return;
    resultsDiv.classList.remove('hidden');
    
    const inputVal = document.getElementById('cfg-woSupervisorName').value.trim();
    if (inputVal.includes('(')) {
        filterWoSupervisorResults('');
    } else {
        filterWoSupervisorResults(inputVal);
    }
}

function filterWoSupervisorResults(query) {
    const resultsDiv = document.getElementById('cfg-woSupervisorSearchResults');
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
    
    let html = `<div onclick="selectWoSupervisor('', '')" class="p-2.5 text-xs hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-b border-slate-100 transition-colors flex items-center gap-1">
        ✕ Clear / Remove Supervisor
    </div>`;
    
    if (filtered.length === 0) {
        html += '<div class="p-3 text-sm text-slate-400 italic">No sailors found</div>';
    } else {
        html += filtered.map(s => {
            const displayName = `${s.rank} ${s.name} (${s.official_number || s.service_no})`;
            const escDisplayName = displayName.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `<div onclick="selectWoSupervisor('${s.id ?? s._fbKey}', '${escDisplayName}')" class="p-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                <span class="font-semibold text-slate-800">${s.rank} ${s.name}</span>
                <span class="text-xs text-slate-400 font-mono ml-2">${s.official_number || s.service_no}</span>
            </div>`;
        }).join('');
    }
    
    resultsDiv.innerHTML = html;
}

function selectWoSupervisor(sailorId, displayName) {
    const zoneId = document.getElementById('cfg-userZone').value;
    if (!zoneId) {
        showToast('Please select a Zone first', 'error');
        document.getElementById('cfg-woSupervisorName').value = '';
        document.getElementById('cfg-woSupervisorSearchResults').classList.add('hidden');
        return;
    }
    
    if (!store.settings.zoneInCharges) store.settings.zoneInCharges = {};
    if (!store.settings.zoneInCharges[zoneId]) {
        showToast('Please set the Profile Sailor first', 'error');
        document.getElementById('cfg-woSupervisorName').value = '';
        document.getElementById('cfg-woSupervisorSearchResults').classList.add('hidden');
        return;
    }
    
    if (sailorId) {
        const sailor = store.sailors.find(s => String(s.id ?? s._fbKey) === String(sailorId));
        if (sailor) {
            setValue('cfg-woSupervisorName', displayName);
            setValue('cfg-woSupervisorId', sailorId);
            
            store.settings.zoneInCharges[zoneId].woSupervisorId = sailorId;
            store.settings.zoneInCharges[zoneId].woSupervisorName = displayName;
            
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woSupervisorId`).set(sailorId);
            opsDB.ref(`settings/zoneInCharges/${zoneId}/woSupervisorName`).set(displayName).then(() => {
                applySettings();
                showToast(`Work Order Supervisor for ${zoneId} updated`);
            });
        }
    } else {
        setValue('cfg-woSupervisorName', '');
        setValue('cfg-woSupervisorId', '');
        delete store.settings.zoneInCharges[zoneId].woSupervisorId;
        delete store.settings.zoneInCharges[zoneId].woSupervisorName;
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woSupervisorId`).remove();
        opsDB.ref(`settings/zoneInCharges/${zoneId}/woSupervisorName`).remove().then(() => {
            applySettings();
            showToast(`Work Order Supervisor for ${zoneId} removed`);
        });
    }
    
    document.getElementById('cfg-woSupervisorSearchResults').classList.add('hidden');
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

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initPwaHistoryManagement();
    if (deferredPrompt) {
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.classList.remove('hidden');
    }
    updateOnlineStatus();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    renderZoneSelectors();

    // Initialize dashboardDate to today
    const today = new Date().toISOString().split('T')[0];
    store.dashboardDate = today;
    const datePicker = document.getElementById('dashboardDatePicker');
    if (datePicker) {
        datePicker.value = today;
    }

    // ── Initial render (with empty store — Firebase will populate) ──
    renderDashboard();

    // Set today's date for inventory
    if (document.getElementById('invDate')) {
        document.getElementById('invDate').value = today;
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

    const searchSubInput = document.getElementById('cfg-userSubName');
    const resultsSubDiv = document.getElementById('cfg-subSailorSearchResults');
    if (searchSubInput && resultsSubDiv) {
        if (!searchSubInput.contains(e.target) && !resultsSubDiv.contains(e.target)) {
            resultsSubDiv.classList.add('hidden');
        }
    }

    const woIncInput = document.getElementById('cfg-woInchargeName');
    const woIncDiv = document.getElementById('cfg-woInchargeSearchResults');
    if (woIncInput && woIncDiv) {
        if (!woIncInput.contains(e.target) && !woIncDiv.contains(e.target)) {
            woIncDiv.classList.add('hidden');
        }
    }

    const woSupInput = document.getElementById('cfg-woSupervisorName');
    const woSupDiv = document.getElementById('cfg-woSupervisorSearchResults');
    if (woSupInput && woSupDiv) {
        if (!woSupInput.contains(e.target) && !woSupDiv.contains(e.target)) {
            woSupDiv.classList.add('hidden');
        }
    }

    const woArtInput = document.getElementById('cfg-woArtificerName');
    const woArtDiv = document.getElementById('cfg-woArtificerSearchResults');
    if (woArtInput && woArtDiv) {
        if (!woArtInput.contains(e.target) && !woArtDiv.contains(e.target)) {
            woArtDiv.classList.add('hidden');
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
        img.outerHTML = fallback || '';
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

    // 1. Command / OIC Profiles List
    const oicProfs = getOicProfiles();
    oicProfs.forEach(p => {
        const isThisOicActive = store.activeProfileType === 'OIC' && store.activeOicProfileId === p.id;
        const cleanNo = p.serviceNo ? p.serviceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
        const shortRank = p.rank ? p.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
        const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
        const avatarHtml = cleanNo ? 
            `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">` :
            fallbackText;

        html += `
            <div onclick="switchActiveProfile('OIC', '', '${p.id}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isThisOicActive ? 'bg-teal-50/50' : ''}">
                ${avatarHtml}
                <div class="text-left flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800">${p.rank} ${p.name}</p>
                    <p class="text-[10px] text-slate-400">Officer Profile • View All Zones</p>
                </div>
                ${isThisOicActive ? '<span class="text-teal-600 font-bold">✓</span>' : ''}
            </div>
        `;
    });

    if (oicProfs.length === 0) {
        const isOicActive = !store.activeProfileType || store.activeProfileType === 'OIC';
        html += `
            <div onclick="switchActiveProfile('OIC')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isOicActive ? 'bg-teal-50/50' : ''}">
                <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">OIC</div>
                <div class="text-left flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800">Command / OIC</p>
                    <p class="text-[10px] text-slate-400">System Admin • View All Zones</p>
                </div>
                ${isOicActive ? '<span class="text-teal-600 font-bold">✓</span>' : ''}
            </div>
        `;
    }

    // 2. Zone In-Charge & Sub In-Charge Options
    if (store.settings && store.settings.zoneInCharges) {
        Object.entries(store.settings.zoneInCharges).forEach(([zoneId, inc]) => {
            if (!inc) return;
            
            // Main In-Charge
            if (inc.name) {
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
            }

            // Sub In-Charge
            if (inc.subName) {
                const isSubActive = store.activeProfileType === 'ZoneSubInCharge' && store.activeProfileZone === zoneId;
                const subCleanNo = inc.subServiceNo ? inc.subServiceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
                const subShortRank = inc.subRank ? inc.subRank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'OIC';
                const subFallbackText = `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${subShortRank}</div>`;
                const subAvatarHtml = subCleanNo ? 
                    `<img src="images/${subCleanNo}.JPG" data-fallback="${subFallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${subCleanNo}')">` :
                    subFallbackText;

                html += `
                    <div onclick="switchActiveProfile('ZoneSubInCharge', '${zoneId}')" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 ${isSubActive ? 'bg-teal-50/50' : ''}">
                        ${subAvatarHtml}
                        <div class="min-w-0 flex-1 text-left">
                            <p class="text-xs font-bold text-slate-800 truncate">${zoneId} Sub In-Charge</p>
                            <p class="text-[10px] text-slate-505 truncate">${inc.subRank} ${inc.subName}</p>
                            <p class="text-[9px] text-slate-400 font-mono">${inc.subServiceNo}</p>
                        </div>
                        ${isSubActive ? '<span class="text-teal-600 font-bold">✓</span>' : ''}
                    </div>
                `;
            }
        });
    }

    // Add PWA Install option if installer is available
    if (deferredPrompt) {
        html += `
            <div class="border-t border-slate-100 mt-1">
                <div onclick="triggerPwaInstall()" class="px-4 py-2.5 hover:bg-teal-50 text-teal-600 font-semibold cursor-pointer transition-colors text-xs flex items-center gap-3">
                    <span class="text-sm">📥</span>
                    <span>Install NCW-PS App</span>
                </div>
            </div>
        `;
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

function switchActiveProfile(type, zoneId = '', oicProfileId = '') {
    const s = store.settings || {};
    let targetPassword = '';
    let targetName = '';
    
    if (type === 'OIC') {
        if (oicProfileId) {
            const profile = getOicProfiles().find(p => p.id === oicProfileId);
            if (profile) {
                targetPassword = profile.password || '';
                targetName = `${profile.rank} ${profile.name}`;
            }
        } else {
            targetPassword = s.oicPassword || '';
            targetName = s.oicName ? `${s.oicRank} ${s.oicName}` : 'Command / OIC';
        }
    } else if ((type === 'ZoneInCharge' || type === 'ZoneSubInCharge') && zoneId) {
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        if (inc) {
            targetPassword = inc.password || '';
            targetName = type === 'ZoneSubInCharge'
                ? `${inc.subRank} ${inc.subName} (Sub In-Charge - ${zoneId})`
                : `${inc.rank} ${inc.name} (${zoneId})`;
        }
    }
    
    // If a password is set, show prompt modal instead of switching immediately
    if (targetPassword) {
        document.getElementById('pwdModalTargetType').value = type;
        document.getElementById('pwdModalTargetZone').value = zoneId;
        document.getElementById('pwdModalTargetOicProfileId').value = oicProfileId;
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
    performProfileSwitch(type, zoneId, oicProfileId);
}

function submitProfilePassword(e) {
    e.preventDefault();
    const type = document.getElementById('pwdModalTargetType').value;
    const zoneId = document.getElementById('pwdModalTargetZone').value;
    const oicProfileId = document.getElementById('pwdModalTargetOicProfileId').value;
    const inputPwd = document.getElementById('profilePasswordInput').value;
    
    const s = store.settings || {};
    let correctPassword = '';
    
    if (type === 'OIC') {
        if (oicProfileId) {
            const profile = getOicProfiles().find(p => p.id === oicProfileId);
            correctPassword = profile ? (profile.password || '') : '';
        } else {
            correctPassword = s.oicPassword || '';
        }
    } else if ((type === 'ZoneInCharge' || type === 'ZoneSubInCharge') && zoneId) {
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        correctPassword = inc ? (inc.password || '') : '';
    }
    
    if (inputPwd === correctPassword) {
        closeModal('profilePasswordModal');
        performProfileSwitch(type, zoneId, oicProfileId);
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
    
    if (type === 'Sailor') {
        localStorage.setItem('ncw_ps_active_sailor_id', oicProfileId); // third param is sailorId
        switchView('sailordashboard');
    } else {
        localStorage.setItem('ncw_ps_active_oic_profile_id', oicProfileId);
        switchView('dashboard');
    }

    // Apply active profile rules
    applyActiveProfile();

    // Refresh view
    refreshCurrentView();

    // Show toast
    if (type === 'Sailor') {
        showToast('Logged in as Sailor');
    } else if (type === 'OIC') {
        showToast('Switched to Command / OIC Profile');
    } else if (type === 'ZoneSubInCharge') {
        showToast(`Logged in as Sub In-Charge for ${zoneId}`);
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

    // Initialize currentView on load if not set
    if (!store.currentView) {
        store.currentView = (store.activeProfileType === 'Sailor') ? 'sailordashboard' : 'dashboard';
    }

    const type = store.activeProfileType;
    const zoneId = store.activeProfileZone;
    const s = store.settings || {};
    const zoneSelector = document.getElementById('zoneSelector');

    // Toggle administrative components for Sailor Login
    const navHeader = document.getElementById('navalHeader');
    const mobileNav = document.getElementById('mobileTabBar');
    const statusB = document.getElementById('tacticalStatusBar');
    const sidebar = document.getElementById('leftSidebarContainer');
    const sidebarToggle = document.getElementById('sidebarToggleBtn');

    if (type === 'Sailor') {
        if (navHeader) navHeader.classList.add('hidden');
        if (mobileNav) mobileNav.classList.add('hidden');
        if (statusB) statusB.classList.add('hidden');
        if (sidebar) sidebar.classList.add('hidden');
        if (sidebarToggle) sidebarToggle.classList.add('hidden');
        
        switchView('sailordashboard');
        renderSailorDashboardView();
        return;
    } else {
        if (navHeader) navHeader.classList.remove('hidden');
        if (mobileNav) mobileNav.classList.remove('hidden');
        if (statusB) statusB.classList.remove('hidden');
        if (sidebar) sidebar.classList.remove('hidden');
        if (sidebarToggle) sidebarToggle.classList.remove('hidden');
    }

    if ((type === 'ZoneInCharge' || type === 'ZoneSubInCharge') && zoneId) {
        store.currentZone = zoneId;
        if (zoneSelector) {
            zoneSelector.value = zoneId;
            zoneSelector.disabled = true;
            zoneSelector.title = "Zone locked to your assigned zone";
            zoneSelector.classList.add('opacity-75', 'cursor-not-allowed');
        }

        // Set active user info from settings
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        if (inc) {
            if (type === 'ZoneSubInCharge') {
                store.currentUser = {
                    name: inc.subName,
                    rank: inc.subRank,
                    serviceNo: inc.subServiceNo
                };
            } else {
                store.currentUser = {
                    name: inc.name,
                    rank: inc.rank,
                    serviceNo: inc.serviceNo
                };
            }
        } else {
            // Fallback if settings are deleted
            store.currentUser = { name: s.userName, rank: s.userRank, serviceNo: s.userServiceNo };
        }

        // Hide settings tab for Zone In-Charges
        const settingsTabBtn = document.getElementById('tab-settings');
        if (settingsTabBtn) {
            settingsTabBtn.classList.add('hidden');
        }
        const mobileSettingsTabBtn = document.getElementById('mobile-tab-settings');
        if (mobileSettingsTabBtn) {
            mobileSettingsTabBtn.classList.add('hidden');
        }

        // If they are on settings view, redirect them to dashboard
        if (store.currentView === 'settings') {
            switchView('dashboard');
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
        let permSettings = true;
        let permDashboard = true;
        let permJobCards = true;
        let permInventory = true;
        let permEstimates = true;
        let permLMD = true;
        let permSailors = true;
        let permReports = true;
        let permAllZones = true;
        let allowedZones = store.zones.map(z => z.id);

        const oicProfileId = store.activeOicProfileId;
        if (oicProfileId) {
            const profile = getOicProfiles().find(p => p.id === oicProfileId);
            if (profile) {
                oicName = profile.name;
                oicRank = profile.rank;
                oicServiceNo = profile.serviceNo;
                
                // If it is NOT the main administrator (3576), apply permissions
                const isMain = (profile.serviceNo || '').includes('3576');
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
            allowedZones: allowedZones
        };

        // Show/hide main navigation tabs based on user permissions
        const tabPermissions = {
            'settings': permSettings,
            'dashboard': permDashboard,
            'jobcards': permJobCards,
            'inventory': permInventory,
            'estimates': permEstimates,
            'maintenance': permLMD,
            'sailors': permSailors,
            'reports': permReports
        };

        // Loop over each tab and toggle visibility
        for (const [viewName, hasAccess] of Object.entries(tabPermissions)) {
            const btn = document.getElementById(`tab-${viewName}`);
            const mBtn = document.getElementById(`mobile-tab-${viewName}`);
            if (btn) {
                if (hasAccess) btn.classList.remove('hidden');
                else btn.classList.add('hidden');
            }
            if (mBtn) {
                if (hasAccess) mBtn.classList.remove('hidden');
                else mBtn.classList.add('hidden');
            }
        }
        
        // If current view is not allowed, redirect to the first allowed view
        if (!tabPermissions[store.currentView]) {
            const firstAllowed = Object.keys(tabPermissions).find(k => tabPermissions[k]);
            if (firstAllowed) {
                switchView(firstAllowed);
            }
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

    // Update zone dropdown selectors based on active profile permissions
    renderZoneSelectors();

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

    // 2. Zone In-Charges & Sub In-Charges
    if (s.zoneInCharges) {
        Object.entries(s.zoneInCharges).forEach(([zoneId, inc]) => {
            if (!inc) return;
            if (inc.name) {
                options += `<option value="ZoneInCharge:${zoneId}" data-service-no="${inc.serviceNo || ''}" data-rank="${inc.rank || 'OIC'}" data-name="${inc.name || ''}">${zoneId} In-Charge (${inc.name})</option>`;
            }
            if (inc.subName) {
                options += `<option value="ZoneSubInCharge:${zoneId}" data-service-no="${inc.subServiceNo || ''}" data-rank="${inc.subRank || 'OIC'}" data-name="${inc.subName || ''}">${zoneId} Sub In-Charge (${inc.subName})</option>`;
            }
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
    } else if (val.startsWith('ZoneInCharge:') || val.startsWith('ZoneSubInCharge:')) {
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
    const mode = document.getElementById('loginMode')?.value || 'OIC';
    
    if (mode === 'SAILOR') {
        const sailorId = document.getElementById('loginSailorSelectedId').value;
        if (!sailorId) {
            showToast('Please search and select your Service Number!', 'error');
            return;
        }
        performProfileSwitch('Sailor', '', sailorId);
        document.getElementById('loginScreen').classList.add('hidden');
        return;
    }

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
    } else if (val.startsWith('ZoneInCharge:') || val.startsWith('ZoneSubInCharge:')) {
        zoneId = val.split(':')[1];
        const inc = s.zoneInCharges && s.zoneInCharges[zoneId];
        correctPassword = inc ? (inc.password || '') : '';
        type = val.startsWith('ZoneSubInCharge:') ? 'ZoneSubInCharge' : 'ZoneInCharge';
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
    localStorage.removeItem('ncw_ps_active_sailor_id');
    store.activeProfileType = null;
    store.activeProfileZone = null;
    store.activeOicProfileId = null;
    
    // Show login screen
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
        setLoginMode('OIC'); // Reset mode to default
        populateLoginProfiles();
    }
    
    // Close dropdown
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    
    showToast('Logged out successfully.');
}

function toggleLeftSidebar(open) {
    const sidebar = document.getElementById('leftSidebarContainer');
    const backdrop = document.getElementById('sidebarBackdrop');
    const arrow = document.getElementById('sidebarToggleArrow');
    if (!sidebar) return;

    const isOpen = open !== undefined ? open : sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        if (backdrop) backdrop.classList.remove('hidden');
        if (arrow) {
            arrow.textContent = '◀';
        }
    } else {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
        if (arrow) {
            arrow.textContent = '➔';
        }
    }
}

// =============================================
// ADMIN & STAFF DUTIES (SPECIAL ZONE) HELPERS
// =============================================
let _lmdExportAction = 'csv';

function toggleViewsBasedOnZone() {
    const isSpecialZone = isAdminStaffDuties(store.currentZone);
    
    // Normal tabs to toggle
    const specialTabs = ['tab-jobcards', 'tab-inventory', 'tab-estimates', 'tab-maintenance', 'tab-settings'];
    const mobileSpecialTabs = ['mobile-tab-jobcards', 'mobile-tab-inventory', 'mobile-tab-estimates', 'mobile-tab-maintenance', 'mobile-tab-settings'];

    specialTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isSpecialZone ? 'none' : '';
    });

    mobileSpecialTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isSpecialZone ? 'none' : '';
    });

    // Admin & Staff Duties specific tabs
    const adminTabs = ['tab-dailydetails', 'tab-summary'];
    const mobileAdminTabs = ['mobile-tab-dailydetails', 'mobile-tab-summary'];

    adminTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isSpecialZone ? 'block' : 'none';
    });

    mobileAdminTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isSpecialZone ? 'flex' : 'none';
    });

    // Revert sidebar, sidebar toggle, mainPanel and boardGrid display changes (always use normal layout)
    const leftSidebar = document.getElementById('leftSidebarContainer');
    if (leftSidebar) {
        leftSidebar.style.display = '';
    }
    const sidebarToggle = document.getElementById('sidebarToggleBtn');
    if (sidebarToggle) {
        sidebarToggle.style.display = '';
    }

    const mainPanel = document.getElementById('boardGridContainer')?.parentElement;
    if (mainPanel) {
        mainPanel.classList.remove('md:col-span-12');
        mainPanel.classList.add('md:col-span-9');
    }

    const boardGrid = document.getElementById('boardGridContainer');
    if (boardGrid) {
        boardGrid.style.display = '';
    }

    const boardEmpty = document.getElementById('boardEmptyState');
    if (boardEmpty) {
        boardEmpty.style.display = '';
    }
    const ongoingSummary = document.getElementById('ongoingTasksSummaryWrapper');
    if (ongoingSummary) {
        ongoingSummary.style.display = '';
    }

    // Keep dashboard-level export/print buttons visible
    ['dashboardExportCsvBtn', 'dashboardPrintBtn', 'dashboardShareWhatsappBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });

    // If currently on a hidden view, switch to dashboard
    const currentView = store.currentView || 'dashboard';
    if (isSpecialZone && ['jobcards', 'inventory', 'estimates', 'maintenance', 'settings'].includes(currentView)) {
        switchView('dashboard');
    }
    if (!isSpecialZone && ['dailydetails', 'summary'].includes(currentView)) {
        switchView('dashboard');
    }
}

function renderDailyDetailsSpecialView() {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    let dailyDetailsContainer = document.getElementById('dailyDetailsContainer');
    if (!dailyDetailsContainer) {
        console.log('🔵 dailyDetailsContainer NOT found, creating...');
        dailyDetailsContainer = document.createElement('div');
        dailyDetailsContainer.id = 'dailyDetailsContainer';
        dailyDetailsContainer.className = 'glass-card p-6 mt-4';
        document.getElementById('boardGridContainer').parentElement.appendChild(dailyDetailsContainer);
    }
    dailyDetailsContainer.classList.remove('hidden');
    dailyDetailsContainer.style.display = 'block';

    const zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    
    let tableRows = '';
    let hasAllocations = false;

    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal));
        
        // Find if this zone has any active allocations
        let zoneHasAllocations = false;
        wos.forEach(wo => {
            let assignedCount = 0;
            if (dateVal === today) {
                assignedCount = (wo.assigned || []).length;
            } else {
                assignedCount = (store.dailyAllocations || []).filter(a => 
                    a.date === dateVal && String(a.work_order_id) === String(wo.id)
                ).length;
            }
            if (assignedCount > 0) zoneHasAllocations = true;
        });

        if (zoneHasAllocations) {
            hasAllocations = true;
            // Add Zone Group Header row spanning all 6 columns
            tableRows += `
                <tr class="bg-slate-900 text-white font-bold">
                    <td colspan="6" class="px-4 py-2.5 text-xs uppercase tracking-wider">
                        🗺️ ZONE: ${z.name.toUpperCase()}
                    </td>
                </tr>
            `;
            
            wos.forEach(wo => {
                let assignedSailors = [];
                if (dateVal === today) {
                    const assignedIds = (wo.assigned || []).map(String);
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                } else {
                    const assignedIds = (store.dailyAllocations || [])
                        .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
                        .map(a => String(a.sailor_id));
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                }
                
                if (assignedSailors.length > 0) {
                    // Add Work Order separator row
                    tableRows += `
                        <tr class="bg-slate-50 font-bold border-b border-slate-200">
                            <td colspan="6" class="px-4 py-2 text-[10px] text-slate-700 text-center underline uppercase tracking-wide">
                                📋 DUTY: ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
                    
                    assignedSailors.forEach((s, idx) => {
                        const serNo = String(idx + 1).padStart(2, '0');
                        const parsedOffNo = parseOfficialNumber(s.official_number || s.service_no);
                        tableRows += `
                            <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors text-xs text-slate-800">
                                <td class="px-4 py-2 text-center font-medium">${serNo}</td>
                                <td class="px-4 py-2">${s.rank || 'AB'}</td>
                                <td class="px-4 py-2 font-semibold text-slate-900">${s.name}</td>
                                <td class="px-4 py-2 text-center"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">${parsedOffNo.type}</span></td>
                                <td class="px-4 py-2 font-mono">${parsedOffNo.num}</td>
                                <td class="px-4 py-2 text-center"><span class="bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-bold">${s.trade || '—'}</span></td>
                            </tr>
                        `;
                    });
                }
            });
        }
    });

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
}

// =============================================
// SUMMARY VIEW IMPLEMENTATION
// =============================================
function renderSummaryView() {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    // Update active date displays
    const dateDisplay = document.getElementById('summaryActiveDate');
    if (dateDisplay) dateDisplay.textContent = dateVal;
    const printDateDisplay = document.getElementById('printSummaryDate');
    if (printDateDisplay) printDateDisplay.textContent = dateVal.replace(/-/g, '.');

    // 1. Fetch allocations for the active date
    const activeAllocations = (store.dailyAllocations || []).filter(a => a.date === dateVal);
    
    // Helper to resolve sailor's category (VSS/Regular) and trade index
    function getSailorBranchAndTradeIdx(sailor) {
        const isVss = sailor.category === 'VAS';
        
        let tradeIdx = -1;
        if (isVss) {
            const vssTrades = ['MA', 'CA', 'PA', 'PL', 'BB', 'RW', 'WL', 'AL', 'SW'];
            // Normalize WL / WE
            let t = (sailor.trade || 'MA').toUpperCase();
            if (t === 'WE' || t === 'WEL') t = 'WL';
            tradeIdx = vssTrades.indexOf(t);
            if (tradeIdx === -1) tradeIdx = 0; // Fallback to MA
        } else {
            const regTrades = ['S/S', 'LME', 'ME', 'OJT'];
            // Determine category index
            const rank = (sailor.rank || 'AB').toUpperCase();
            const trade = (sailor.trade || '').toUpperCase();
            
            if (rank.includes('CPO') || rank.includes('PO') || rank.includes('CHIEF')) {
                tradeIdx = 0; // S/S
            } else if (rank === 'LME' || trade === 'LME' || rank.startsWith('L')) {
                tradeIdx = 1; // LME
            } else if (rank === 'ME' || trade === 'ME' || rank.startsWith('M')) {
                tradeIdx = 2; // ME
            } else if (rank.startsWith('OJT') || rank.startsWith('APP') || rank.startsWith('TRAIN') || trade.startsWith('OJT')) {
                tradeIdx = 3; // OJT
            } else {
                tradeIdx = 2; // Default to ME
            }
        }
        
        return { isVss, tradeIdx };
    }

    // Initialize counts matrix helper
    function createRowMatrix(description) {
        return {
            description: description,
            vss: [0, 0, 0, 0, 0, 0, 0, 0, 0], // MA, CA, PA, PL, BB, RW, WL, AL, SW
            reg: [0, 0, 0, 0], // S/S, LME, ME, OJT
            vssSub: 0,
            regSub: 0,
            fullTotal: 0
        };
    }

    // 2. Define the structure of our sections dynamically
    const sections = {
        workshop: { title: "WORKSHOP", rows: {} },
        zones: {
            title: "ZONE",
            subsections: {
                "A": { title: "A - ZONE", rows: {} },
                "B": { title: "B - ZONE", rows: {} },
                "C": { title: "C - ZONE", rows: {} },
                "D": { title: "D - ZONE", rows: {} },
                "E": { title: "E - ZONE", rows: {} },
                "FH": { title: "FH - ZONE", rows: {} },
                "G": { title: "G - ZONE", rows: {} },
                "OTW": { title: "OTW", rows: {} },
                "Supply-School": { title: "SUPPLY SCHOOL", rows: {} }
            }
        },
        othersDuty: { title: "OTHERS DUTY DOCK YARD", rows: {} },
        otherBases: { title: "OTHER BASES ENA", rows: {} },
        socialResponsible: { title: "SOCIAL RESPONSIBLE WORKS AT ENA", rows: {} },
        temporaryDraft: { title: "TEMPORAY DRAFT TO OTHER NAVAL AREA", rows: {} },
        leaveSick: { title: "LEAVE, SICK & ATTENDANCE", rows: {} }
    };

    // Helper to get the correct section based on zoneId
    function getSectionForZone(zoneId) {
        if (zoneId === 'OTW') return sections.zones.subsections["OTW"];
        if (zoneId === 'Supply-School') return sections.zones.subsections["Supply-School"];
        
        if (['Carpentry-Shop', 'Paint-Workshop', 'Signwriter', 'Welding-Shop', 'Concrete-Precast', 'Aluminum-Work-Shop', 'Blacksmith'].includes(zoneId)) {
            return sections.workshop;
        }
        if (zoneId === 'A-Zone') return sections.zones.subsections["A"];
        if (zoneId === 'B-Zone') return sections.zones.subsections["B"];
        if (zoneId === 'C-Zone') return sections.zones.subsections["C"];
        if (zoneId === 'D-Zone') return sections.zones.subsections["D"];
        if (zoneId === 'E-Zone') return sections.zones.subsections["E"];
        if (zoneId === 'FH-Zone') return sections.zones.subsections["FH"];
        if (zoneId === 'Genaral-Zone') return sections.zones.subsections["G"];
        if (zoneId === 'Admin-&-Staff-Duties') return sections.othersDuty;
        if (zoneId === 'Other-Base') return sections.otherBases;
        if (zoneId === 'Out-Project' || zoneId === 'Housing-Project') return sections.socialResponsible;
        
        // Default fallback
        return sections.zones.subsections["A"];
    }

    // 3. Process allocations and categorize sailors based on Daily Details logic
    const zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    const allAllocatedSailorIds = new Set();
    
    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal));
        
        wos.forEach(wo => {
            let assignedSailors = [];
            if (dateVal === today) {
                const assignedIds = (wo.assigned || []).map(String);
                assignedSailors = store.sailors.filter(s =>
                    assignedIds.includes(String(s.id)) ||
                    assignedIds.includes(String(s._fbKey))
                );
            } else {
                const assignedIds = (store.dailyAllocations || [])
                    .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
                    .map(a => String(a.sailor_id));
                assignedSailors = store.sailors.filter(s =>
                    assignedIds.includes(String(s.id)) ||
                    assignedIds.includes(String(s._fbKey))
                );
            }
            
            if (assignedSailors.length > 0) {
                const section = getSectionForZone(wo.zone_id);
                const rowKey = (wo.description || 'UNNAMED DUTY').toUpperCase().trim();
                
                if (!section.rows[rowKey]) {
                    section.rows[rowKey] = createRowMatrix(rowKey);
                }
                const targetRow = section.rows[rowKey];
                
                assignedSailors.forEach(sailor => {
                    // Track for Leave/Sick check
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
    });

    // 4. Process explicit leaves/sick statuses from sailorsDB
    store.sailors.forEach(sailor => {
        const isAllocated = allAllocatedSailorIds.has(String(sailor.id)) || (sailor._fbKey && allAllocatedSailorIds.has(String(sailor._fbKey)));
        
        if (!isAllocated && (sailor.attendance === 'Leave' || sailor.attendance === 'Sick')) {
            const { isVss, tradeIdx } = getSailorBranchAndTradeIdx(sailor);
            let rowKey = "LEAVE & WEEKEND DOKYARD";
            if (sailor.attendance === 'Sick') {
                rowKey = "SICK REPORT";
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
    });

    // 5. Build and render the table rows with subtotals and grand totals
    let tableHtml = `
        <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
            <td colspan="17" class="px-3 py-2 text-slate-800 font-extrabold uppercase text-[11px] tracking-wider">ONGOING CONSTRUCTIONS AT DOCKYARD</td>
        </tr>
    `;

    // Columns counters helper
    function getColumnsSum(rowsArray) {
        const sums = {
            vss: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            reg: [0, 0, 0, 0],
            vssSub: 0,
            regSub: 0,
            fullTotal: 0
        };
        rowsArray.forEach(r => {
            r.vssSub = r.vss.reduce((sum, val) => sum + val, 0);
            r.regSub = r.reg.reduce((sum, val) => sum + val, 0);
            r.fullTotal = r.vssSub + r.regSub;
            
            r.vss.forEach((val, idx) => sums.vss[idx] += val);
            r.reg.forEach((val, idx) => sums.reg[idx] += val);
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
        fullTotal: 0
    };

    function appendSectionToTable(sectionObj) {
        const rowsList = Object.values(sectionObj.rows);
        const sums = getColumnsSum(rowsList);
        
        tableHtml += `
            <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
                <td colspan="17" class="px-3 py-2 text-slate-800 uppercase text-[10px] tracking-wider">${sectionObj.title}</td>
            </tr>
        `;
        
        rowsList.forEach(r => {
            tableHtml += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-center">
                    <td class="px-3 py-1.5 text-left text-slate-700 font-medium">${r.description}</td>
                    ${r.vss.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                    <td class="px-1 py-1.5 bg-slate-50 font-bold border-l-2 border-r-2 border-slate-200">${r.vssSub || ''}</td>
                    ${r.reg.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                    <td class="px-1 py-1.5 bg-slate-50 font-bold border-l-2 border-r border-slate-200">${r.regSub || ''}</td>
                    <td class="px-2 py-1.5 bg-teal-50/50 font-bold text-slate-800 border-l border-slate-300">${r.fullTotal || ''}</td>
                </tr>
            `;
        });
        
        tableHtml += `
            <tr class="bg-slate-50 font-bold text-center border-b-2 border-slate-300">
                <td class="px-3 py-2 text-left uppercase text-[10px]">SUB TOTAL</td>
                ${sums.vss.map(val => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ''}</td>`).join('')}
                <td class="px-1 py-2 bg-slate-100/80 border-l-2 border-r-2 border-slate-300">${sums.vssSub || ''}</td>
                ${sums.reg.map(val => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ''}</td>`).join('')}
                <td class="px-1 py-2 bg-slate-100/80 border-l-2 border-r border-slate-300">${sums.regSub || ''}</td>
                <td class="px-2 py-2 bg-teal-100/30 text-teal-800 border-l border-slate-300">${sums.fullTotal || ''}</td>
            </tr>
        `;
        
        sums.vss.forEach((val, idx) => columnGrandTotals.vss[idx] += val);
        sums.reg.forEach((val, idx) => columnGrandTotals.reg[idx] += val);
        columnGrandTotals.vssSub += sums.vssSub;
        columnGrandTotals.regSub += sums.regSub;
        columnGrandTotals.fullTotal += sums.fullTotal;
    }

    // 2. Workshop
    appendSectionToTable(sections.workshop);
    
    // 3. Zones (A-G grouped under main ZONE header)
    tableHtml += `
        <tr class="bg-slate-100 font-bold border-t-2 border-b border-slate-300">
            <td colspan="17" class="px-3 py-2 text-slate-800 uppercase text-[10px] tracking-wider">ZONE</td>
        </tr>
    `;
    
    const zoneRowsList = [];
    Object.values(sections.zones.subsections).forEach(sub => {
        const subRows = Object.values(sub.rows);
        const subSums = getColumnsSum(subRows);
        
        tableHtml += `
            <tr class="bg-slate-50 font-bold border-b border-slate-200 text-[10px] text-slate-600">
                <td colspan="17" class="px-4 py-1.5 pl-6">${sub.title}</td>
            </tr>
        `;
        
        subRows.forEach(r => {
            tableHtml += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-center">
                    <td class="px-3 py-1.5 pl-8 text-left text-slate-700 font-medium">${r.description}</td>
                    ${r.vss.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r-2 border-slate-200">${r.vssSub || ''}</td>
                    ${r.reg.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                    <td class="px-1 py-1.5 bg-slate-50/50 font-bold border-l-2 border-r border-slate-200">${r.regSub || ''}</td>
                    <td class="px-2 py-1.5 bg-teal-50/30 font-bold text-slate-800 border-l border-slate-300">${r.fullTotal || ''}</td>
                </tr>
            `;
            zoneRowsList.push(r);
        });
        
        tableHtml += `
            <tr class="bg-slate-50 font-semibold text-center border-b border-slate-200 text-slate-600">
                <td class="px-3 py-1.5 pl-8 text-left uppercase text-[9px]">${sub.title} FULL TOTAL</td>
                ${subSums.vss.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r-2 border-slate-200">${subSums.vssSub || ''}</td>
                ${subSums.reg.map(val => `<td class="px-0.5 py-1.5 border-l border-slate-200">${val || ''}</td>`).join('')}
                <td class="px-1 py-1.5 bg-slate-100/50 border-l-2 border-r border-slate-200">${subSums.regSub || ''}</td>
                <td class="px-2 py-1.5 bg-teal-50/50 border-l border-slate-300">${subSums.fullTotal || ''}</td>
            </tr>
        `;
    });
    
    const zoneMainSums = getColumnsSum(zoneRowsList);
    tableHtml += `
        <tr class="bg-slate-100 font-bold text-center border-b-2 border-slate-300 text-slate-800">
            <td class="px-3 py-2 text-left uppercase text-[10px] pl-6">ZONE TOTAL SUB TOTAL</td>
            ${zoneMainSums.vss.map(val => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ''}</td>`).join('')}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r-2 border-slate-300">${zoneMainSums.vssSub || ''}</td>
            ${zoneMainSums.reg.map(val => `<td class="px-0.5 py-2 border-l border-slate-200">${val || ''}</td>`).join('')}
            <td class="px-1 py-2 bg-slate-200/50 border-l-2 border-r border-slate-300">${zoneMainSums.regSub || ''}</td>
            <td class="px-2 py-2 bg-teal-100/40 text-teal-800 border-l border-slate-300">${zoneMainSums.fullTotal || ''}</td>
        </tr>
    `;
    
    zoneMainSums.vss.forEach((val, idx) => columnGrandTotals.vss[idx] += val);
    zoneMainSums.reg.forEach((val, idx) => columnGrandTotals.reg[idx] += val);
    columnGrandTotals.vssSub += zoneMainSums.vssSub;
    columnGrandTotals.regSub += zoneMainSums.regSub;
    columnGrandTotals.fullTotal += zoneMainSums.fullTotal;

    // 4. Others Duty
    appendSectionToTable(sections.othersDuty);
    
    // 5. Other Bases
    appendSectionToTable(sections.otherBases);
    
    // 6. Social Responsible Works
    appendSectionToTable(sections.socialResponsible);
    
    // 7. Temporary Draft
    appendSectionToTable(sections.temporaryDraft);
    
    // 8. Leave & Attendance
    appendSectionToTable(sections.leaveSick);

    // Render Grand Total Row at the absolute bottom
    tableHtml += `
        <tr class="bg-slate-900 text-white font-extrabold text-center text-sm border-t-4 border-slate-800">
            <td class="px-3 py-3 text-left uppercase">GRAND TOTAL</td>
            ${columnGrandTotals.vss.map(val => `<td class="px-0.5 py-3 border-l border-slate-800">${val || ''}</td>`).join('')}
            <td class="px-1 py-3 bg-slate-800 border-l-2 border-r-2 border-slate-800">${columnGrandTotals.vssSub || ''}</td>
            ${columnGrandTotals.reg.map(val => `<td class="px-0.5 py-3 border-l border-slate-800">${val || ''}</td>`).join('')}
            <td class="px-1 py-3 bg-slate-800 border-l-2 border-r border-slate-800">${columnGrandTotals.regSub || ''}</td>
            <td class="px-2 py-3 bg-teal-800 text-teal-100 border-l border-slate-800">${columnGrandTotals.fullTotal || ''}</td>
        </tr>
    `;

    document.getElementById('summaryMatrixTableBody').innerHTML = tableHtml;
}

function exportSummaryCsv() {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    const table = document.getElementById('summaryMatrixTable');
    if (!table) return;
    
    let csv = [];
    csv.push(`Date: ${dateVal}`);
    csv.push('');
    
    const rows = table.querySelectorAll('tr');
    rows.forEach(tr => {
        let cols = tr.querySelectorAll('th, td');
        let rowData = [];
        cols.forEach(col => {
            let text = col.innerText.trim().replace(/,/g, ';').replace(/\r?\n/g, ' ');
            rowData.push(`"${text}"`);
        });
        csv.push(rowData.join(','));
    });
    
    const csvContent = "\uFEFF" + csv.join("\n"); // Include BOM for proper Excel UTF-8 encoding
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    let title = 'Print / PDF Options';
    if (action === 'csv') title = 'Export CSV Options';
    else if (action === 'whatsapp') title = 'WhatsApp Share Options';
    document.getElementById('lmdExportModalTitle').textContent = title;
    
    const zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    document.getElementById('exportZoneSelect').innerHTML = zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
    
    document.querySelector('input[name="exportScope"][value="all"]').checked = true;
    toggleExportZoneSelect();
    
    document.getElementById('lmdExportModal').classList.remove('hidden');
}

function toggleExportZoneSelect() {
    const scope = document.querySelector('input[name="exportScope"]:checked').value;
    document.getElementById('exportZoneSelectWrapper').classList.toggle('hidden', scope !== 'selected');
}

function executeLmdExport() {
    const scope = document.querySelector('input[name="exportScope"]:checked').value;
    const selectedZone = document.getElementById('exportZoneSelect').value;
    
    if (_lmdExportAction === 'csv') {
        exportLmdCSV(scope, selectedZone);
        closeModal('lmdExportModal');
    } else if (_lmdExportAction === 'whatsapp') {
        // Share first to keep user gesture activation, then close modal
        shareLmdWhatsApp(scope, selectedZone);
        closeModal('lmdExportModal');
    } else {
        printLmdDetails(scope, selectedZone);
        closeModal('lmdExportModal');
    }
}

function exportLmdCSV(scope, selectedZone) {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    let zones = [];
    if (scope === 'all') {
        zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    } else {
        const z = store.zones.find(x => x.id === selectedZone);
        if (z) zones.push(z);
    }
    
    let csvContent = "Ser No,Rank,Name,Service Type,Service No,Trade\n";
    
    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal));
        
        // Check if zone has active allocations
        let zoneHasAllocations = false;
        wos.forEach(wo => {
            let assignedCount = 0;
            if (dateVal === today) {
                assignedCount = (wo.assigned || []).length;
            } else {
                assignedCount = (store.dailyAllocations || []).filter(a => 
                    a.date === dateVal && String(a.work_order_id) === String(wo.id)
                ).length;
            }
            if (assignedCount > 0) zoneHasAllocations = true;
        });

        if (zoneHasAllocations) {
            // Add Zone Section header row in CSV
            csvContent += `,,=== ZONE: ${z.name.toUpperCase()} ===,,,\n`;
            
            wos.forEach(wo => {
                let assignedSailors = [];
                if (dateVal === today) {
                    const assignedIds = (wo.assigned || []).map(String);
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                } else {
                    const assignedIds = (store.dailyAllocations || [])
                        .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
                        .map(a => String(a.sailor_id));
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                }
                
                if (assignedSailors.length > 0) {
                    // Add header row for the work order/duty
                    csvContent += `,,● DUTY: ${wo.description.toUpperCase()},,,\n`;
                    
                    assignedSailors.forEach((s, idx) => {
                        const serNo = String(idx + 1).padStart(2, '0');
                        const parsedOffNo = parseOfficialNumber(s.official_number || s.service_no);
                        const row = [
                            serNo,
                            s.rank || 'AB',
                            s.name,
                            parsedOffNo.type,
                            parsedOffNo.num,
                            s.trade || ''
                        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
                        csvContent += row + "\n";
                    });
                }
            });
        }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LMD_Report_${dateVal}_${scope}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully!');
}

function printLmdDetails(scope, selectedZone) {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    let zones = [];
    if (scope === 'all') {
        zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    } else {
        const z = store.zones.find(x => x.id === selectedZone);
        if (z) zones.push(z);
    }
    
    let rowsHtml = '';
    
    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal));
        
        // Check if zone has active allocations
        let zoneHasAllocations = false;
        wos.forEach(wo => {
            let assignedCount = 0;
            if (dateVal === today) {
                assignedCount = (wo.assigned || []).length;
            } else {
                assignedCount = (store.dailyAllocations || []).filter(a => 
                    a.date === dateVal && String(a.work_order_id) === String(wo.id)
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
            
            wos.forEach(wo => {
                let assignedSailors = [];
                if (dateVal === today) {
                    const assignedIds = (wo.assigned || []).map(String);
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                } else {
                    const assignedIds = (store.dailyAllocations || [])
                        .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
                        .map(a => String(a.sailor_id));
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                }
                
                if (assignedSailors.length > 0) {
                    // Add sub-header separator row for work order
                    rowsHtml += `
                        <tr style="background-color: #f1f5f9; font-weight: bold;">
                            <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
                                📋 DUTY: ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
                    
                    assignedSailors.forEach((s, idx) => {
                        const serNo = String(idx + 1).padStart(2, '0');
                        const parsedOffNo = parseOfficialNumber(s.official_number || s.service_no);
                        rowsHtml += `
                            <tr>
                                <td style="text-align:center;">${serNo}</td>
                                <td>${s.rank || 'AB'}</td>
                                <td>${s.name}</td>
                                <td style="text-align:center;">${parsedOffNo.type}</td>
                                <td>${parsedOffNo.num}</td>
                                <td style="text-align:center;">${s.trade || '—'}</td>
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
    
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const win = window.open('', '_blank');
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
                <img class="logo-img" src="${window.location.href.split('?')[0].split('#')[0].replace('index.html', '')}logo.png" alt="SLN Crest">
                <div class="header-text">
                    <h1>Sri Lanka Navy</h1>
                    <h2>Captain Civil Engineering Department (E)</h2>
                </div>
            </div>
            
            <div class="meta-section">
                <div class="meta-left">
                    <div>REPORT: DAILY DETAILS REPORT</div>
                    <div>SCOPE: ${scope === 'all' ? 'ALL ZONES' : 'ZONE: ' + selectedZone.toUpperCase()}</div>
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
    setTimeout(() => { win.print(); }, 300);
}

function openEvalDetailsModal(mode) {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    const modalTitle = document.getElementById('evalDetailsModalTitle');
    const modalIcon = document.getElementById('evalDetailsModalIcon');
    const tableHeader = document.getElementById('evalDetailsTableActionHeader');
    
    if (mode === 'evaluated') {
        modalTitle.textContent = `Evaluated Sailors — ${dateVal}`;
        modalIcon.textContent = '✅';
        tableHeader.textContent = 'Score';
    } else {
        modalTitle.textContent = `Pending Evaluations — ${dateVal}`;
        modalIcon.textContent = '⏳';
        tableHeader.textContent = 'Pending Days';
    }
    
    // Get all assigned sailors for the selected date
    const assignedIds = new Set();
    if (dateVal === today) {
        (store.workOrders || []).forEach(wo => {
            if ((wo.status === 'Active' || wo.status === 'Pending') && wo.assigned) {
                wo.assigned.forEach(id => assignedIds.add(String(id)));
            }
        });
    } else {
        (store.dailyAllocations || []).forEach(alloc => {
            if (alloc.date === dateVal) {
                assignedIds.add(String(alloc.sailor_id));
            }
        });
    }
    
    if (!store.sailors) return;
    
    // Filter sailors who are assigned today
    const assignedSailors = store.sailors.filter(s => assignedIds.has(String(s.id)) || assignedIds.has(String(s._fbKey)));
    
    // Filter based on evaluation mode
    const filteredSailors = assignedSailors.filter(s => {
        const alloc = (store.dailyAllocations || []).find(a => a.date === dateVal && String(a.sailor_id) === String(s.id));
        const isEval = alloc ? alloc.evaluated === true : s.evaluated === true;
        return mode === 'evaluated' ? isEval : !isEval;
    });
    
    const tbody = document.getElementById('evalDetailsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = filteredSailors.map(s => {
        const alloc = (store.dailyAllocations || []).find(a => a.date === dateVal && String(a.sailor_id) === String(s.id));
        let workDesc = 'Not specified';
        let zoneId = s.zone_assigned || 'A-Zone';
        
        if (alloc && alloc.work_order_id) {
            const wo = store.workOrders.find(w => String(w.id) === String(alloc.work_order_id) || String(w._fbKey) === String(alloc.work_order_id));
            if (wo) {
                workDesc = wo.description || wo.reference_no || 'Active Work';
                zoneId = wo.zone_id || zoneId;
            }
        } else {
            const wo = store.workOrders.find(w => (w.status === 'Active' || w.status === 'Pending') && w.assigned && w.assigned.map(String).includes(String(s.id)));
            if (wo) {
                workDesc = wo.description || wo.reference_no || 'Active Work';
                zoneId = wo.zone_id || zoneId;
            }
        }
        
        const sSettings = store.settings || {};
        const inc = sSettings.zoneInCharges && sSettings.zoneInCharges[zoneId];
        const inChargeStr = inc ? `${inc.rank} ${inc.name}` : 'No In-Charge set';
        
        let detailHtml = '';
        if (mode === 'evaluated') {
            let scoreVal = s.yesterdayScore || 7.0;
            if (alloc && alloc.points !== undefined) {
                scoreVal = alloc.points;
            }
            detailHtml = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">⭐ ${scoreVal.toFixed(1)}</span>`;
        } else {
            const unEvaluatedAllocs = (store.dailyAllocations || []).filter(a => String(a.sailor_id) === String(s.id) && !a.evaluated);
            const count = unEvaluatedAllocs.length;
            detailHtml = `<span class="px-2.5 py-1 ${count > 2 ? 'bg-red-100 text-red-800 animate-pulse font-bold' : 'bg-slate-100 text-slate-700'} rounded-lg text-xs">${count} days pending</span>`;
        }
        
        return `
            <tr class="hover:bg-slate-100/50 transition-colors">
                <td class="p-3 font-semibold text-slate-700">${s.official_number || s.service_no || '-'}</td>
                <td class="p-3">
                    <p class="font-bold text-teal-600 hover:underline cursor-pointer" onclick="closeModal('evalDetailsModal'); openSailorProfile('${s.id ?? s._fbKey}')">${s.rank} ${s.name}</p>
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
    }).join('') || `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No sailors in this category for today</td></tr>`;
    
    document.getElementById('evalDetailsModal').classList.remove('hidden');
}

let _isHistoryBackAction = false;

function initPwaHistoryManagement() {
    // 1. Set initial history state for the landing view
    const initialView = store.currentView || 'dashboard';
    window.history.replaceState({ view: initialView }, '', `#${initialView}`);

    // 2. Listen to popstate (back/forward navigation)
    window.addEventListener('popstate', (event) => {
        _isHistoryBackAction = true;
        
        // Handle modal state
        if (event.state && event.state.modalOpen) {
            // A specific modal is expected to be open
            document.querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]').forEach(m => {
                if (m.id === event.state.modalId) {
                    m.classList.remove('hidden');
                } else {
                    m.classList.add('hidden');
                }
            });
        } else {
            // No modals expected to be open
            document.querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]').forEach(m => {
                m.classList.add('hidden');
            });
            
            // Handle view switching
            if (event.state && event.state.view) {
                switchView(event.state.view, true);
            }
        }
        
        setTimeout(() => {
            _isHistoryBackAction = false;
        }, 500);
    });

    // 3. Observe DOM for modal open/close actions to push/pop history states automatically
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const isModal = target.classList.contains('modal-overlay') || target.id.endsWith('Modal') || target.id.endsWith('modal');
                if (!isModal) return;

                const isHidden = target.classList.contains('hidden');
                
                if (!isHidden) {
                    // Modal was opened
                    if (!_isHistoryBackAction) {
                        window.history.pushState({ modalOpen: true, modalId: target.id, view: store.currentView }, '', window.location.hash);
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
    });

    // Start observing all modals
    document.querySelectorAll('.modal-overlay, [id$="Modal"], [id$="modal"]').forEach(m => {
        observer.observe(m, { attributes: true, attributeFilter: ['class'] });
    });
}

// ---- Theme Management & Online Status ----
function initTheme() {
    const isDark = localStorage.getItem('ncw_ps_dark_theme') === 'true';
    if (isDark) {
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('darkModeToggleBtn');
        if (btn) btn.innerHTML = '☀️';
    } else {
        document.documentElement.classList.remove('dark');
        const btn = document.getElementById('darkModeToggleBtn');
        if (btn) btn.innerHTML = '🌙';
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('ncw_ps_dark_theme', isDark);
    const btn = document.getElementById('darkModeToggleBtn');
    if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';
    showToast(isDark ? 'Dark Theme enabled' : 'Light Theme enabled');
}

function updateOnlineStatus() {
    const indicator = document.getElementById('onlineIndicator');
    if (!indicator) return;

    if (navigator.onLine) {
        indicator.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online</span>
        `;
        indicator.className = 'flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all duration-300';
    } else {
        indicator.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>Offline</span>
        `;
        indicator.className = 'flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-red-500/20 bg-red-500/10 text-red-400 transition-all duration-300';
        showToast('You are offline. Operations will sync when you reconnect.', 'error');
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ==================== WHATSAPP / SYSTEM SHARING FUNCTIONS ====================

function shareViaWhatsAppOrSystem(text, filename) {
    const canUseShare = navigator.share && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (canUseShare) {
        navigator.share({
            title: 'NCW-PS Share Report',
            text: text,
            url: window.location.href
        })
        .then(() => showToast('Shared successfully via system share!'))
        .catch(err => {
            console.error('System share failed, falling back to WhatsApp share:', err);
            if (err.name !== 'AbortError') {
                fallbackWhatsAppShare(text);
            }
        });
    } else {
        fallbackWhatsAppShare(text);
    }
}

function fallbackWhatsAppShare(text) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/?text=${encodedText}`;
    
    if (isMobile) {
        // On mobile, changing window.location.href is 100% reliable and bypassed popup blockers
        window.location.href = url;
    } else {
        // On desktop, open in a new window/tab
        window.open(url, '_blank');
    }
}

function shareLmdWhatsApp(scope, selectedZone) {
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    
    let zones = [];
    if (scope === 'all') {
        zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    } else {
        const z = store.zones.find(x => x.id === selectedZone);
        if (z) zones.push(z);
    }
    
    let text = `*⚓ NCW-PS DAILY ALLOCATION REPORT*\n`;
    text += `*📅 Date:* ${dateVal}\n`;
    if (scope === 'selected' && zones.length > 0) {
        text += `*🗺️ Zone:* ${zones[0].name.toUpperCase()}\n`;
    }
    text += `=========================\n\n`;
    
    let totalAssigned = 0;
    
    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, dateVal));
        
        let zoneText = '';
        let zoneHasAllocations = false;
        
        wos.forEach(wo => {
            let assignedSailors = [];
            if (dateVal === today) {
                const assignedIds = (wo.assigned || []).map(String);
                assignedSailors = store.sailors.filter(s =>
                    assignedIds.includes(String(s.id)) ||
                    assignedIds.includes(String(s._fbKey))
                );
            } else {
                const assignedIds = (store.dailyAllocations || [])
                    .filter(a => a.date === dateVal && String(a.work_order_id) === String(wo.id))
                    .map(a => String(a.sailor_id));
                assignedSailors = store.sailors.filter(s =>
                    assignedIds.includes(String(s.id)) ||
                    assignedIds.includes(String(s._fbKey))
                );
            }
            
            if (assignedSailors.length > 0) {
                zoneHasAllocations = true;
                zoneText += `*📋 Duty:* _${wo.description.toUpperCase()}_\n`;
                
                assignedSailors.forEach((s, idx) => {
                    totalAssigned++;
                    const parsedOffNo = parseOfficialNumber(s.official_number || s.service_no);
                    const offNoStr = parsedOffNo.type ? `${parsedOffNo.type} ${parsedOffNo.num}` : parsedOffNo.num;
                    zoneText += `  ${idx + 1}. ${s.rank || 'AB'} ${s.name} (${offNoStr}) - ${s.trade || '—'}\n`;
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
        showToast('No estimate selected to share!', 'error');
        return;
    }
    const est = store.estimates.find(e => e.id === store.selectedEstimate);
    if (!est) {
        showToast('Estimate not found!', 'error');
        return;
    }
    
    let text = `*⚓ SRI LANKA NAVY - COST ESTIMATE*\n`;
    text += `*Estimate No:* ${est.estimate_number}\n`;
    text += `*Reference:* ${est.reference_doc || '—'}\n`;
    text += `*Location:* ${est.location || '—'}\n`;
    text += `*End User:* ${est.endUser || '—'}\n`;
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
    
    text += `*Status:* ${est.status || 'Draft'}\n`;
    if (est.approvedAuthority) {
        text += `*Approving Authority:* ${est.approvedAuthority}\n`;
    }
    text += `-------------------------\n`;
    text += `Generated on: ${new Date().toLocaleString()}`;
    
    shareViaWhatsAppOrSystem(text, `Estimate_${est.estimate_number}.txt`);
}









// =============================================================================
// SAILOR DIRECTORY, POINTS & LEAVE TRACKING IMPLEMENTATION
// =============================================================================

store.directoryTradeFilter = 'ALL';

// Calculate Sailor points based on average score, allocations, and completed jobs
function calculateSailorPoints(sailor) {
    // 10 pts per unit of average performance score (baseline)
    const scoreBase = parseFloat(sailor.avgScore || 7.0) * 10;

    // Count how many daily allocations they have been part of (5 pts per duty allocation day)
    const allocationsCount = (store.dailyAllocations || []).filter(a => 
        String(a.sailor_id) === String(sailor.id) || 
        String(a.sailor_id) === String(sailor._fbKey)
    ).length;
    const allocationPoints = allocationsCount * 5;

    // Count how many completed job cards they have been part of (15 pts per project participation)
    const completedJobsCount = (store.jobCards || []).filter(jc => 
        jc.status === 'Completed' && 
        (jc.assigned || []).some(id => String(id) === String(sailor.id) || String(id) === String(sailor._fbKey))
    ).length;
    const jobPoints = completedJobsCount * 15;

    return Math.round(scoreBase + allocationPoints + jobPoints);
}

// Calculate Sailor points based on average score, allocations, and completed jobs within the last 30 days
function calculateSailorPointsPast30Days(sailor) {
    // 10 pts per unit of average performance score (baseline)
    const scoreBase = parseFloat(sailor.avgScore || 7.0) * 10;

    // Calculate 30 days ago date string (YYYY-MM-DD)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const limitDateStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Count how many daily allocations they have been part of in the last 30 days (5 pts per duty allocation day)
    const allocationsCount = (store.dailyAllocations || []).filter(a => {
        if (String(a.sailor_id) !== String(sailor.id) && String(a.sailor_id) !== String(sailor._fbKey)) {
            return false;
        }
        return a.date && a.date >= limitDateStr;
    }).length;
    const allocationPoints = allocationsCount * 5;

    // Count how many completed job cards they have been part of in the last 30 days (15 pts per project participation)
    const completedJobsCount = (store.jobCards || []).filter(jc => {
        if (jc.status !== 'Completed') return false;
        if (!(jc.assigned || []).some(id => String(id) === String(sailor.id) || String(id) === String(sailor._fbKey))) {
            return false;
        }
        const compDateStr = jc.completed_date || jc.last_commit_date || jc.last_assigned_date;
        return compDateStr && compDateStr >= limitDateStr;
    }).length;
    const jobPoints = completedJobsCount * 15;

    return Math.round(scoreBase + allocationPoints + jobPoints);
}

// Calculate Sailor leave eligibility (1 leave day per 10 points)
function calculateSailorLeaveDays(sailor) {
    const pts = calculateSailorPoints(sailor);
    return Math.max(0, Math.floor(pts / 10));
}

// Filter Directory by Trade
function filterDirectoryTrade(trade) {
    store.directoryTradeFilter = trade;
    document.querySelectorAll('.dir-trade-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
    });
    const activeBtn = document.getElementById('dir-trade-' + trade);
    if (activeBtn) {
        activeBtn.classList.remove('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
        activeBtn.classList.add('bg-slate-800', 'text-white');
    }
    renderSailorsView();
}

// Render Directory Sailors Grid list
function renderSailorsView() {
    const container = document.getElementById('directorySailorsGrid');
    if (!container) return;

    const query = (document.getElementById('directorySailorSearch')?.value || '').toLowerCase().trim();
    const trade = store.directoryTradeFilter || 'ALL';
    const sortBy = document.getElementById('directorySailorSort')?.value || 'points-desc';

    let filtered = [...store.sailors];

    // Search filter
    if (query) {
        filtered = filtered.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            (s.official_number || '').toLowerCase().includes(query) ||
            (s.rank || '').toLowerCase().includes(query) ||
            (s.trade || '').toLowerCase().includes(query)
        );
    }

    // Trade filter
    if (trade !== 'ALL') {
        filtered = filtered.filter(s => s.trade === trade);
    }

    // Map each sailor with points and leave for sorting
    const mapped = filtered.map(s => {
        const points = calculateSailorPoints(s);
        const leaveDays = calculateSailorLeaveDays(s);
        return { ...s, points, leaveDays };
    });

    // Sorting
    mapped.sort((a, b) => {
        if (sortBy === 'points-desc') return b.points - a.points;
        if (sortBy === 'points-asc') return a.points - b.points;
        if (sortBy === 'score-desc') return b.avgScore - a.avgScore;
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
    });

    // Update total count
    const totalCountBadge = document.getElementById('directoryTotalCount');
    if (totalCountBadge) {
        totalCountBadge.textContent = `Total: ${mapped.length} Sailors`;
    }

    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = mapped.map(s => {
        const cleanNo = s.official_number ? s.official_number.replace(/[^a-zA-Z0-9]/g, '') : '';
        const shortRank = s.rank ? s.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'AB';
        const fallbackText = `<div class="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">${shortRank}</div>`;
        
        const avatarHtml = cleanNo ? 
            `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-12 h-12 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">` :
            fallbackText;

        // Check if currently busy on a work order today
        const assignment = getSailorCurrentAssignment(s.id ?? s._fbKey);
        
        let statusBadge = '';
        if (s.attendance === 'Leave') {
            statusBadge = `<span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">On Leave</span>`;
        } else if (s.attendance === 'Sick') {
            statusBadge = `<span class="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">Sick</span>`;
        } else if (assignment) {
            statusBadge = `<span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold truncate max-w-[120px]" title="Busy: ${assignment.zone}">⚠️ ${assignment.zone}</span>`;
        } else {
            statusBadge = `<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">✓ Available</span>`;
        }

        const tradeColors = {
            'MA': 'bg-teal-600', 'CA': 'bg-purple-600', 'PA': 'bg-amber-700',
            'PL': 'bg-cyan-600', 'WE': 'bg-red-600', 'RW': 'bg-slate-700',
            'SW': 'bg-emerald-800', 'BB': 'bg-blue-700', 'AL': 'bg-pink-600'
        };
        const tradeClass = tradeColors[s.trade] || 'bg-slate-600';

        return `
        <div onclick="openSailorProfile('${s.id ?? s._fbKey}')" class="bg-white rounded-2xl shadow-md border border-slate-200/80 p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between">
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
                    <p class="text-[10px] text-slate-400 mono mt-0.5">${s.official_number}</p>
                </div>
            </div>

            <!-- Badges and stats section -->
            <div class="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-1">
                ${statusBadge}
                <div class="flex gap-2 text-[11px] font-bold">
                    <span class="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded" title="Total accumulated points">⭐ ${s.points}</span>
                    <span class="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded" title="Leave days earned">📅 ${s.leaveDays}D</span>
                </div>
            </div>
        </div>
        `;
    }).join('') || '<div class="col-span-full text-center py-12"><p class="text-slate-400 text-sm">No sailors found matching criteria.</p></div>';
}

// Open Sailor Profile Modal with detailed stats
function openSailorProfile(sailorId) {
    if (_justClosedModal) return;
    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    if (!sailor) {
        showToast('Sailor profile not found', 'error');
        return;
    }

    const points = calculateSailorPointsPast30Days(sailor);
    const leaveDays = calculateSailorLeaveDays(sailor);
    
    // Bio
    document.getElementById('profName').textContent = sailor.name;
    document.getElementById('profRankOffNo').textContent = `${sailor.rank} · Official No: ${sailor.official_number}`;
    document.getElementById('profActiveZone').textContent = `Assigned Zone: ${sailor.zone_assigned || 'None'}`;
    document.getElementById('profTradeBadge').textContent = sailor.trade;
    document.getElementById('profCategory').textContent = sailor.category || 'Regular';
    
    const tradeColors = {
        'MA': 'bg-teal-600 text-teal-100', 'CA': 'bg-purple-600 text-purple-100', 'PA': 'bg-amber-700 text-amber-100',
        'PL': 'bg-cyan-600 text-cyan-100', 'WE': 'bg-red-600 text-red-100', 'RW': 'bg-slate-700 text-slate-100',
        'SW': 'bg-emerald-800 text-emerald-100', 'BB': 'bg-blue-700 text-blue-100', 'AL': 'bg-pink-600 text-pink-100'
    };
    const tradeClass = tradeColors[sailor.trade] || 'bg-slate-800 text-slate-100';
    document.getElementById('profTradeBadge').className = `text-xs px-2 py-0.5 rounded font-extrabold ${tradeClass}`;

    // Status Badge
    const assignment = getSailorCurrentAssignment(sailor.id ?? sailor._fbKey);
    const statusBadge = document.getElementById('profStatusBadge');
    
    if (sailor.attendance === 'Leave') {
        statusBadge.className = 'text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>On Leave';
    } else if (sailor.attendance === 'Sick') {
        statusBadge.className = 'text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Sick';
    } else if (assignment) {
        statusBadge.className = 'text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Busy: ${assignment.zone}`;
    } else {
        statusBadge.className = 'text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Available';
    }

    // Points & Leave Days
    document.getElementById('profTotalPoints').textContent = points;
    document.getElementById('profLeaveDays').textContent = leaveDays;
    
    // Ratings
    document.getElementById('profAvgRating').textContent = `${(sailor.avgScore || 7.0).toFixed(1)} / 10`;
    document.getElementById('profYesterdayRating').textContent = sailor.yesterdayScore ? `${sailor.yesterdayScore.toFixed(1)} / 10` : '-';

    // Progress Bar to Next Leave Day
    const progressVal = points % 10;
    document.getElementById('profNextLeaveProgressText').textContent = `${progressVal} / 10 Points`;
    document.getElementById('profNextLeaveProgressBar').style.width = `${progressVal * 10}%`;

    // Profile Photo
    const cleanNo = sailor.official_number ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, '') : '';
    const shortRank = sailor.rank ? sailor.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'AB';
    const fallbackText = `<div class="w-full h-full rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xl">${shortRank}</div>`;
    const picContainer = document.getElementById('profPicContainer');
    
    if (cleanNo) {
        picContainer.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
    } else {
        picContainer.innerHTML = fallbackText;
    }

    // Populate Duty Log
    const dutyLogContainer = document.getElementById('profDutyLog');
    
    // Search active and completed work orders for this sailor's assignments
    const recentJobs = [];
    
    // Check allocations (active / historic)
    const allocations = (store.dailyAllocations || []).filter(a => 
        String(a.sailor_id) === String(sailor.id) || 
        String(a.sailor_id) === String(sailor._fbKey)
    );
    
    allocations.forEach(a => {
        // Find corresponding work order for description
        const wo = store.workOrders.find(w => String(w.id) === String(a.work_order_id) || String(w._fbKey) === String(a.work_order_id));
        recentJobs.push({
            date: a.date,
            type: 'Daily Allocation',
            ref: wo ? wo.reference_no : 'Task Allocation',
            desc: wo ? wo.description : 'Productivity suite labor allocation',
            status: 'Completed'
        });
    });

    // Sort recent jobs by date desc
    recentJobs.sort((a, b) => b.date.localeCompare(a.date));

    // Render duty log entries (limit to 10)
    dutyLogContainer.innerHTML = recentJobs.slice(0, 10).map(job => `
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
    `).join('') || '<p class="text-slate-400 text-center py-6 text-xs">No recent allocation records found.</p>';

    document.getElementById('sailorProfileModal').classList.remove('hidden');
}

// =============================================================================
// SAILOR LOGIN AUTOCOMPLETE & PERSONAL DASHBOARD VIEW METHODS
// =============================================================================

// Set Login Mode (OIC or SAILOR)
function setLoginMode(mode) {
    const inputMode = document.getElementById('loginMode');
    if (!inputMode) return;
    inputMode.value = mode;

    const btnOic = document.getElementById('loginModeBtnOIC');
    const btnSailor = document.getElementById('loginModeBtnSailor');
    const groupOic = document.getElementById('loginGroupOic');
    const groupSailor = document.getElementById('loginGroupSailor');
    const pwdGroup = document.getElementById('loginPasswordGroup');
    const pwdInput = document.getElementById('loginPasswordInput');
    const container = document.getElementById('loginAvatarContainer');

    // Reset avatar
    container.innerHTML = '<span class="text-3xl">⚓</span>';

    if (mode === 'OIC') {
        btnOic.classList.add('bg-teal-600', 'text-white');
        btnOic.classList.remove('text-slate-400', 'hover:text-white');
        btnSailor.classList.remove('bg-teal-600', 'text-white');
        btnSailor.classList.add('text-slate-400', 'hover:text-white');
        
        groupOic.classList.remove('hidden');
        groupSailor.classList.add('hidden');
        
        document.getElementById('loginProfileSelect').value = '';
        pwdGroup.classList.add('hidden');
        pwdInput.required = false;
        pwdInput.value = '';
    } else {
        btnSailor.classList.add('bg-teal-600', 'text-white');
        btnSailor.classList.remove('text-slate-400', 'hover:text-white');
        btnOic.classList.remove('bg-teal-600', 'text-white');
        btnOic.classList.add('text-slate-400', 'hover:text-white');
        
        groupSailor.classList.remove('hidden');
        groupOic.classList.add('hidden');
        
        document.getElementById('loginSailorSearch').value = '';
        document.getElementById('loginSailorSelectedId').value = '';
        pwdGroup.classList.add('hidden');
        pwdInput.required = false;
        pwdInput.value = '';
    }
}

// Filter Autocomplete list inside login screen
function filterLoginSailor(query) {
    const dropdown = document.getElementById('loginSailorDropdown');
    if (!dropdown) return;

    if (!query.trim()) {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
        return;
    }

    const q = query.toLowerCase().trim();
    const matches = store.sailors.filter(s => 
        (s.name || '').toLowerCase().includes(q) || 
        String(s.official_number || '').toLowerCase().includes(q)
    ).slice(0, 8); // Top 8 matches

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="p-3 text-slate-500 text-xs italic">No matching sailors found</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = matches.map(s => {
        const cleanNo = s.official_number ? s.official_number.replace(/[^a-zA-Z0-9]/g, '') : '';
        const shortRank = s.rank ? s.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'AB';
        const fallbackText = `<div class="w-8 h-8 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">${shortRank}</div>`;
        const avatar = cleanNo ? 
            `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="handleProfilePicError(this, '${cleanNo}')">` :
            fallbackText;

        return `
            <div onclick="selectLoginSailor('${s.id}')" class="px-4 py-2.5 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors text-xs text-white">
                ${avatar}
                <div class="min-w-0 flex-1">
                    <p class="font-bold truncate">${s.name}</p>
                    <p class="text-[10px] text-slate-400 truncate mt-0.5">${s.rank} · ${s.official_number}</p>
                </div>
            </div>
        `;
    }).join('');

    dropdown.classList.remove('hidden');
}

// Show dropdown results when input focus
function showLoginSailorDropdown() {
    const val = document.getElementById('loginSailorSearch').value;
    filterLoginSailor(val);
}

// Select Sailor in Login Page Autocomplete
function selectLoginSailor(id) {
    const sailor = store.sailors.find(s => String(s.id) === String(id));
    if (!sailor) return;

    document.getElementById('loginSailorSearch').value = `${sailor.rank} ${sailor.name} (${sailor.official_number})`;
    document.getElementById('loginSailorSelectedId').value = id;
    
    // Hide dropdown
    const dropdown = document.getElementById('loginSailorDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    // Update Avatar Preview
    const container = document.getElementById('loginAvatarContainer');
    const cleanNo = sailor.official_number ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, '') : '';
    const shortRank = sailor.rank ? sailor.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'AB';
    const fallbackText = `<div class="w-full h-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-lg">${shortRank}</div>`;
    
    if (cleanNo) {
        container.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
    } else {
        container.innerHTML = fallbackText;
    }
}

// Render the Personal Sailor Dashboard View
function renderSailorDashboardView() {
    const sailorId = localStorage.getItem('ncw_ps_active_sailor_id');
    if (!sailorId) {
        logoutProfile();
        return;
    }

    const sailor = store.sailors.find(s => String(s.id) === String(sailorId) || String(s._fbKey) === String(sailorId));
    if (!sailor) {
        // Retry loading if database hasn't loaded yet
        return;
    }

    const points = calculateSailorPoints(sailor);
    const leaveDays = calculateSailorLeaveDays(sailor);

    // Bio
    document.getElementById('dashName').textContent = sailor.name;
    document.getElementById('dashRankOffNo').textContent = `${sailor.rank} · Official No: ${sailor.official_number}`;
    document.getElementById('dashActiveZone').textContent = `Zone: ${sailor.zone_assigned || 'None'}`;
    document.getElementById('dashTradeBadge').textContent = sailor.trade;
    document.getElementById('dashCategory').textContent = sailor.category || 'Regular';

    const tradeColors = {
        'MA': 'bg-teal-600 text-teal-100', 'CA': 'bg-purple-600 text-purple-100', 'PA': 'bg-amber-700 text-amber-100',
        'PL': 'bg-cyan-600 text-cyan-100', 'WE': 'bg-red-600 text-red-100', 'RW': 'bg-slate-700 text-slate-100',
        'SW': 'bg-emerald-800 text-emerald-100', 'BB': 'bg-blue-700 text-blue-100', 'AL': 'bg-pink-600 text-pink-100'
    };
    const tradeClass = tradeColors[sailor.trade] || 'bg-slate-800 text-slate-100';
    document.getElementById('dashTradeBadge').className = `text-xs px-2 py-0.5 rounded font-extrabold ${tradeClass}`;

    // Status Badge
    const assignment = getSailorCurrentAssignment(sailor.id ?? sailor._fbKey);
    const statusBadge = document.getElementById('dashStatusBadge');
    
    if (sailor.attendance === 'Leave') {
        statusBadge.className = 'text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>On Leave';
    } else if (sailor.attendance === 'Sick') {
        statusBadge.className = 'text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Sick';
    } else if (assignment) {
        statusBadge.className = 'text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Busy: ${assignment.zone}`;
    } else {
        statusBadge.className = 'text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Available';
    }

    // Points & Leave Days
    document.getElementById('dashTotalPoints').textContent = points;
    document.getElementById('dashLeaveDays').textContent = leaveDays;
    
    // Ratings
    document.getElementById('dashAvgRating').textContent = `${(sailor.avgScore || 7.0).toFixed(1)} / 10`;
    document.getElementById('dashYesterdayRating').textContent = sailor.yesterdayScore ? `${sailor.yesterdayScore.toFixed(1)} / 10` : '-';

    // Progress Bar to Next Leave Day
    const progressVal = points % 10;
    document.getElementById('dashNextLeaveProgressText').textContent = `${progressVal} / 10 Points`;
    document.getElementById('dashNextLeaveProgressBar').style.width = `${progressVal * 10}%`;

    // Profile Photo
    const cleanNo = sailor.official_number ? sailor.official_number.replace(/[^a-zA-Z0-9]/g, '') : '';
    const shortRank = sailor.rank ? sailor.rank.replace(/[a-z\s()]/gi, '').substring(0,3) : 'AB';
    const fallbackText = `<div class="w-full h-full rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xl">${shortRank}</div>`;
    const picContainer = document.getElementById('dashPicContainer');
    
    if (cleanNo) {
        picContainer.innerHTML = `<img src="images/${cleanNo}.JPG" data-fallback="${fallbackText.replace(/"/g, '&quot;')}" class="w-full h-full object-cover" onerror="handleProfilePicError(this, '${cleanNo}')">`;
    } else {
        picContainer.innerHTML = fallbackText;
    }

    // Populate Duty Log
    const dutyLogContainer = document.getElementById('dashDutyLog');
    const recentJobs = [];
    
    const allocations = (store.dailyAllocations || []).filter(a => 
        String(a.sailor_id) === String(sailor.id) || 
        String(a.sailor_id) === String(sailor._fbKey)
    );
    
    allocations.forEach(a => {
        const wo = store.workOrders.find(w => String(w.id) === String(a.work_order_id) || String(w._fbKey) === String(a.work_order_id));
        recentJobs.push({
            date: a.date,
            type: 'Allocation',
            ref: wo ? wo.reference_no : 'Task',
            desc: wo ? wo.description : 'Task Labor allocation',
            status: 'Completed'
        });
    });

    recentJobs.sort((a, b) => b.date.localeCompare(a.date));

    dutyLogContainer.innerHTML = recentJobs.slice(0, 10).map(job => `
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
    `).join('') || '<p class="text-slate-500 text-center py-8 text-xs italic">No operational records found.</p>';
}

// Window click listener to close login search dropdown
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('loginSailorDropdown');
    const input = document.getElementById('loginSailorSearch');
    if (dropdown && input && !dropdown.contains(e.target) && !input.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// =============================================
// PDF BACKUP & GOOGLE DRIVE BACKUP SYSTEM
// =============================================
function generateWorkOrdersPdfBlob(dateVal) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateVal || store.dashboardDate || today;
    
    // Generate the exact same HTML rows as printLmdDetails but for all zones
    let rowsHtml = '';
    const zones = store.zones.filter(z => !isAdminStaffDuties(z.id));
    
    zones.forEach(z => {
        const wos = store.workOrders.filter(wo => wo.zone_id === z.id && isWorkOrderActiveOnDate(wo, targetDate));
        
        let zoneHasAllocations = false;
        wos.forEach(wo => {
            let assignedCount = 0;
            if (targetDate === today) {
                assignedCount = (wo.assigned || []).length;
            } else {
                assignedCount = (store.dailyAllocations || []).filter(a => 
                    a.date === targetDate && String(a.work_order_id) === String(wo.id)
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
            
            wos.forEach(wo => {
                let assignedSailors = [];
                if (targetDate === today) {
                    const assignedIds = (wo.assigned || []).map(String);
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                } else {
                    const assignedIds = (store.dailyAllocations || [])
                        .filter(a => a.date === targetDate && String(a.work_order_id) === String(wo.id))
                        .map(a => String(a.sailor_id));
                    assignedSailors = store.sailors.filter(s =>
                        assignedIds.includes(String(s.id)) ||
                        assignedIds.includes(String(s._fbKey))
                    );
                }
                
                if (assignedSailors.length > 0) {
                    rowsHtml += `
                        <tr style="background-color: #f1f5f9; font-weight: bold;">
                            <td colspan="6" style="text-align: center; text-decoration: underline; text-transform: uppercase; font-size: 11px; padding: 6px; letter-spacing: 0.5px; color: #334155;">
                                📋 DUTY: ${wo.description.toUpperCase()}
                            </td>
                        </tr>
                    `;
                    
                    assignedSailors.forEach((s, idx) => {
                        const serNo = String(idx + 1).padStart(2, '0');
                        const parsedOffNo = parseOfficialNumber(s.official_number || s.service_no);
                        rowsHtml += `
                            <tr>
                                <td style="text-align:center;">${serNo}</td>
                                <td>${s.rank || 'AB'}</td>
                                <td>${s.name}</td>
                                <td style="text-align:center;">${parsedOffNo.type}</td>
                                <td>${parsedOffNo.num}</td>
                                <td style="text-align:center;">${s.trade || '—'}</td>
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
    
    const formattedDate = new Date(targetDate).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Create container element for html2pdf
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.background = '#white';
    element.innerHTML = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color:#000;">
            <div style="display: flex; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px;">
                <div style="text-align: left;">
                    <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">NCW-PS Daily Details Report</h1>
                    <h2 style="font-size: 11px; font-weight: 700; color: #475569; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Naval Civil Works • Miss Garrison</h2>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #334155; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px;">
                <div>
                    <strong>Date:</strong> ${targetDate}<br>
                    <strong>Scope:</strong> All Zones Combined
                </div>
                <div style="text-align: right;">
                    <strong>Generated At:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Authorized By:</strong> NCW-PS System
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
    showToast('Preparing PDF backup...', 'info');
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const element = generateWorkOrdersPdfBlob(dateVal);
    
    const opt = {
        margin:       10,
        filename:     `ncw_ps_backup_${dateVal}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        showToast('PDF backup downloaded successfully!');
    }).catch(err => {
        console.error(err);
        showToast('Failed to download PDF backup.', 'error');
    });
}

function uploadWorkOrdersPdfToDrive() {
    const clientId = (store.settings || {}).googleClientId || '';
    if (!clientId) {
        openGoogleConfigModal();
        return;
    }
    
    showToast('Connecting to Google Drive...', 'info');
    
    const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
            if (response.error) {
                showToast(`Google Authentication failed: ${response.error}`, 'error');
                return;
            }
            if (response.access_token) {
                performGoogleDriveUpload(response.access_token);
            }
        }
    });
    
    client.requestAccessToken();
}

function performGoogleDriveUpload(accessToken) {
    showToast('Generating PDF & Uploading...', 'info');
    const today = new Date().toISOString().split('T')[0];
    const dateVal = store.dashboardDate || today;
    const element = generateWorkOrdersPdfBlob(dateVal);
    
    const opt = {
        margin:       10,
        filename:     `ncw_ps_backup_${dateVal}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).output('blob').then(pdfBlob => {
        const metadata = {
            name: `ncw_ps_backup_${dateVal}.pdf`,
            mimeType: 'application/pdf'
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', pdfBlob);
        
        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: form
        })
        .then(res => res.json())
        .then(data => {
            if (data.id) {
                showToast('✅ Upload to Google Drive successful!');
            } else {
                showToast('❌ Google Drive upload failed: ' + (data.error?.message || 'Unknown error'), 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('Failed to upload file to Google Drive.', 'error');
        });
    });
}

function openGoogleConfigModal() {
    const s = store.settings || {};
    document.getElementById('cfg-googleClientIdModal').value = s.googleClientId || '';
    document.getElementById('googleConfigModal').classList.remove('hidden');
}

function saveGoogleConfigFromModal() {
    const val = document.getElementById('cfg-googleClientIdModal').value.trim();
    if (!val) {
        showToast('Please enter a valid Client ID', 'error');
        return;
    }
    saveSettingField('googleClientId', val);
    closeModal('googleConfigModal');
    showToast('Google Client ID saved. Retrying upload...');
    setTimeout(() => {
        uploadWorkOrdersPdfToDrive();
    }, 1000);
}

