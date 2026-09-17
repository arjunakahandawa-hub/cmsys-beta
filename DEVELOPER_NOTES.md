# CMSys Developer & Technical Architecture Notes

**Sri Lanka Navy — Civil Engineering Department (Eastern Naval Area)**  
**System:** Civil Engineering Management System (CMSys)  
**Maintained by:** Naval Engineering Technical Development Team  

---

## 1. System Topology & Dual-Database Architecture

CMSys coordinates human resources, daily muster, and tactical civil engineering works through **two distinct Firebase Realtime Databases**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CMSys Client Application Layer                     │
├────────────────────────────────────┬────────────────────────────────────┤
│   Desktop Portal (app.js)          │   Mobile Portal (mobile.js)        │
│   c:\...\zone                      │   c:\...\zone-mobile              │
└─────────────────┬──────────────────┴──────────────────┬─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌─────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ DATABASE #1: ce-admin-panel2025     │ │ DATABASE #2: ncw-ps-operations      │
│ (HR, Personnel & Leave Registry)    │ │ (Tactical Operations & Job Cards)   │
├─────────────────────────────────────┤ ├─────────────────────────────────────┤
│ 1. /sailors                         │ │ 1. /work_orders                     │
│    - Master Directory (667 Sailors) │ │    - Dockyard & Workshop Projects   │
│    - Branch: VAS (577) vs REG (90)  │ │ 2. /job_cards                       │
│    - Trades: MA, CA, PA, PL, etc.   │ │    - Daily maintenance work         │
│ 2. /availability/{YYYY-MM}/{DD}     │ │ 3. /daily_allocations               │
│    - Daily Leave & Medical ledger   │ │    - Dynamic duty assignments       │
│    - Keyed by sailor._fbKey         │ │ 4. /out_projects, /housing_projects │
│    - Strict codes: L, TD, RD, ADM.. │ │    - Detached long-term deployments │
└─────────────────────────────────────┘ └─────────────────────────────────────┘
```

---

## 2. Headcount Conservation Law & Standby Calculation

In Naval Civil Engineering administration, every single registered sailor must be accounted for on any given operational date:

$$\text{Total Master Complement (667)} = \text{Active Duties} + \text{Detached Out Projects} + \text{Sanctioned Leaves} + \text{Camp / Yard Standby}$$

### Mathematical Allocation Flow:
1. **Deduplication Set**: An in-memory set `allAllocatedSailorIds = new Set()` is initialized for the date. Once placed, a sailor cannot be added to any subsequent category.
2. **Duty Deduplication**: Sailors on active Work Orders, Job Cards, or Daily Allocations are mapped to their trade column. **Sailors with an active leave status on that date are strictly excluded from duties**.
3. **Long-Term Deployments**: Sailors assigned to detached Out Projects (Nelugala, Kuttiyarama, Ranmaduwa, etc.) are gathered under Out Projects.
4. **Leave & Medical Register**: Remaining sailors are scanned against `availability[YYYY-MM][DD]`. Codes are categorized into `LEAVE`, `HOSPITAL ADMIT (ADM)`, `SICK REPORT (S/R)`, `SIQ`, `NGH`, or `AWOL`.
5. **Standby Sailors (Zero-Loss Rule)**: Any sailor remaining in the master database who is neither assigned to a duty nor on leave is allocated to:
   `AVAILABLE / STANDBY SAILORS (CAMP / YARD)`
   This guarantees that the table sum across all rows equals exactly **577 VSS + 90 Regular = 667 sailors**.

---

## 3. Trade & Branch Matrix Specification

Each sailor is mapped to one of 13 column indices:

| Branch | Col | Trade Code | Description |
| :--- | :---: | :---: | :--- |
| **VSS (Volunteer)**<br>*(Category = "VAS")* | 0 | **MA** | Mason |
| | 1 | **CA** | Carpenter |
| | 2 | **PA** | Painter |
| | 3 | **PL** | Plumber |
| | 4 | **BB** | Bar Bender |
| | 5 | **RW** | Road Worker |
| | 6 | **WL** | Welder (normalized from WL / WE / WEL) |
| | 7 | **AL** | Aluminum Fabricator |
| | 8 | **SW** | Signwriter |
| | — | **SUB** | VSS Trade Subtotal |
| **REGULAR**<br>*(Category != "VAS")* | 0 | **S/S** | Senior Sailors (CPO, PO, Chief) |
| | 1 | **LME** | Leading Marine Mechanic / Engineering |
| | 2 | **ME** | Marine Mechanic / Able Rating |
| | 3 | **OJT** | On-the-Job Trainee / Apprentice |
| | — | **SUB** | Regular Subtotal |
| **FULL TOTAL** | — | **TOTAL** | VSS Subtotal + Regular Subtotal |

---

## 4. Workspace & Deployment Pipeline (3-Tier Standard)

To protect operational naval personnel from service disruptions:

```
[Tier 1: Local Development]
├── Desktop: c:\xampp\htdocs\civilpanel\New_Admin_Project\zone
└── Mobile:  c:\xampp\htdocs\civilpanel\New_Admin_Project\zone-mobile
       │
       ▼ (Git Push after local verification)
[Tier 2: Staging / Beta Deployment]
├── Desktop Beta: cmsys-beta.vercel.app (Desktop view)
└── Mobile Beta:  Tested on physical Android / iOS mobile devices & tablets
       │
       ▼ (User & Officer Approval)
[Tier 3: Production / Live Deployment]
└── Live Production: cmsys-live.vercel.app (Official Base Operations)
```

---

## 5. Critical Engineering Rules for Developers

1. **Strict Regex for Leave Codes**:
   Always use string anchors:
   ```javascript
   /^(Leave|L|TD|RD|ADM|SR|SIQ|NGH|SL|AWOL|...)$/i
   ```
   *Never* use loose prefixes like `/^L/i` or substring checks, as they will accidentally classify non-leave ratings (e.g. `LME`, `LongTermDeployed`, `Regular`) as on leave.

2. **Availability Date Ledger**:
   Always query availability by year-month and 1-based day index:
   ```javascript
   const [yyyy, mm, dd] = dateVal.split("-");
   const monthKey = `${yyyy}-${mm}`;
   const dayKey = parseInt(dd, 10).toString();
   store.availability[monthKey][dayKey][sailor._fbKey]
   ```

3. **Client-Side PDF Performance**:
   Always lazy-load heavy PDF libraries (`html2pdf.js`) only upon user click, preventing startup lag and keeping mobile interactions instantaneous.

---

## 6. Work Order Lifecycle & Labour Proceed Architecture (v5.25.20)

1. **Multi-Source Labour Synchronization**:
   In `proceedWorkOrder()`, never rely exclusively on a raw `wo.assigned` property. The runtime resolves personnel from 5 distinct layers:
   - `wo.assigned` array / object in memory
   - `getWorkOrderAssignedSailors(wo, today)` (authoritative daily presence resolver)
   - `store.dailyAllocations` (same-day tactical records in DB #2)
   - Linked Job Card crew allocations (`jc.assigned`)
   - Auto-restoration from `wo.last_assigned`

2. **Non-Blocking Proceed Flow**:
   - If sailors are resolved, they are committed to `daily_allocations` in Firebase and the Work Order is marked `Active`.
   - If 0 sailors are resolved (e.g., preliminary planning or purely supervisory detail), the Work Order cleanly transitions to `Active` without throwing blocking error toasts.

3. **Safe Status Transitions in `saveWorkOrderChanges()`**:
   - `daily_allocations` are only cleared when a Work Order status is explicitly transitioned to `"Hold"`, `"Completed"`, or `"Cancelled"`.
   - The `"Pending"` status must **never** wipe existing daily allocations, ensuring crew commitments are preserved while drafts are being reviewed or proceeded.

