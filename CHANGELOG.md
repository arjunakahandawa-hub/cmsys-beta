# Changelog

All notable changes to the **Civil Engineering Management System (CMSys)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Desktop v5.25.20] - 2026-09-17

### Fixed
- **Work Order Proceed Synchronization ("Assign at least one sailor" error)**:
  - Fixed a critical validation and synchronization flaw where proceeding a Work Order detail with assigned sailors failed with *"Assign at least one sailor before proceeding"*.
  - Added comprehensive multi-source crew resolution in `proceedWorkOrder()` that gathers sailors from `wo.assigned`, `getWorkOrderAssignedSailors()`, `store.dailyAllocations`, linked Job Cards, and In-Charge/Supervisor selections.
  - Eliminated the critical bug in `saveWorkOrderChanges()` and `updateWorkOrderStatus()` where a status of `"Pending"` wiped today's daily allocations immediately before proceeding.
  - Made `proceedWorkOrder()` resilient and non-blocking: if 0 sailors are assigned, the Work Order proceeds cleanly to `"Active"` status without throwing a blocking error.
  - Added dynamic Proceed button labels in `openWorkOrderDetail()`: shows `🚀 Proceed - Commit Daily Labour (N)` when sailors are assigned and `🚀 Proceed - Mark Active` when 0 sailors are assigned.

### Added
- **1-Click "Create & Proceed"**: Added a secondary `🚀 Create & Proceed` button to `workOrderModal` so users can create and activate a Work Order with daily labour commitments in a single step.

## [Mobile v2.4.1] - 2026-09-17

### Fixed
- **Mobile PDF Export & Modal Trapping Fix**: Resolved issue where Daily Details Report preview got stuck with navigation and action buttons pushed off-screen.
- **Viewport-Bounded Modal Card**: Constrained `#mlPrintPreviewModal` with rigid `height: 92vh; max-height: 92vh; display: flex; flex-direction: column;` and pinned Header/Footer with `flex-shrink: 0; z-index: 30`, ensuring "⬅️ Dashboard" and "✕ Close" buttons remain persistently accessible.
- **Bi-Directional Report Touch-Scrolling**: Enabled smooth internal scrolling (`overflow-y: auto; overflow-x: auto; min-height: 0; flex: 1 1 0%`) for wide and tall daily report tables without breaking dialog bounds.
- **Off-Screen Safe PDF Rendering**: Positioned temporary export elements offscreen (`position: fixed; left: -9999px`) so temporary rendering nodes never overlay or block user interactions.
- **Local PDF Engine & Watchdog**: Bundled `html2pdf.bundle.min.js` locally for 100% offline support with instant 0ms load and added 15-second watchdog watchdog timer with fallback to native print dialog.

---

## [Mobile v2.4.0] - 2026-09-17

### Added
- **Zero-Lag Zone Inventory Tab**: Replaced legacy Sailors Directory tab with real-time Zone Inventory.
- **Store Isolation**: Inventory is automatically filtered strictly to the logged-in Zone or Workshop (e.g. A-Zone Store: 361 items, B-Zone Store: 75 items, Carpenter & Paint Workshop: 31 items).
- **Instant Search & Category Pills**: Supported real-time search (< 2ms) and category pills (BMS, Paint, Plumbing/PVC, Metal, Timber, Aluminium, Electrical/Eng, General).
- **Stock Status Badges**: Added visual indicators (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock) with units and locations.
- **Smart Chunk Pagination**: 25 items per page with "Load More" button to prevent mobile browser memory spikes and guarantee silky smooth 60 FPS performance.

---

## [Desktop v5.25.19] - 2026-09-16

### Added
- **Dynamic Sailor Strength Summary Table**: Included directly above signature blocks in Daily Details PDF reports.
- **Strict Leave Code Regex Engine**: Hardened `isLeaveCodeDetailed` with strict string boundaries (`^(...)$`) to prevent active designation strings (such as `LongTermDeployed`, `LME`, `Regular`) from false-matching as leave codes.
- **Zero-Loss Headcount Balancing**: Enforced the Naval Complement Conservation Law ensuring Active Duties + Standby + Out Projects + Leaves strictly equals the master base complement (577 VSS + 90 Regular = 667 Total).

### Changed
- **Availability Lookup**: Refactored `getSailorLeaveStatus` to query solely the active calendar date's node `availability[YYYY-MM][DD]` in DB #1, eliminating legacy fallbacks to static sailor records.
- **Routing Rules**: Restricted mobile redirection in `vercel.json` and `index.html` strictly to mobile production hosts so desktop deployments on localhost and desktop domains stay on the desktop interface.

---

## [Mobile v2.3.0] - 2026-09-16

### Added
- **Isolated Localhost Workspace (`zone-mobile`)**: Decoupled mobile codebase from the desktop folder, providing a standalone local environment at `http://localhost/civilpanel/New_Admin_Project/zone-mobile/`.
- **Native Entry Point**: Mapped `mobile.html` to `index.html` in `zone-mobile`, removing URL redirection hacks.
- **Dedicated Service Worker & Manifest**: Scoped PWA cache specifically to `cmsys-mobile-cache-v2.3.0`.

### Fixed
- **Mobile Print & PDF Viewport Overflow**: Resolved horizontal clipping in Report view on small touch screens.
- **Close Button Visibility**: Ensured Close (`✕`) button remains persistently visible across all viewport dimensions.

---

## [Mobile v2.2.9] - 2026-09-15

### Fixed
- **Print Media State**: Isolated print preview execution to prevent the browser from remaining stuck in `@media print` mode.
- **In-Report Navigation**: Added prominent "Dashboard වෙත ආපසු" (Back to Dashboard) navigation buttons in the preview modal.

---

## [Mobile v2.2.8] - 2026-09-15

### Added
- **Direct PDF Export**: Integrated client-side `html2pdf.js` export with standard Naval document naming format: `{Zone} | Daily Details | {Date}`.
- **Synchronized Document Title**: Automatically synchronizes browser document title during export for clean PDF file naming.

---

## [Mobile v2.2.7] - 2026-09-15

### Added
- **Session & Zone Persistence**: Implemented `localStorage` caching for the active zone selection and supervisor PIN unlock state across browser reloads and app restarts.

---

## [Mobile v2.2.5] - 2026-09-14

### Added
- **Sailor Strength Summary Matrix**: Rendered real-time trade breakdown table above supervisor and officer signature lines.
- **Official SLN Branding**: Integrated Sri Lanka Navy Crest (`navy_crest_cropped.png`) in mobile print and report headers.

---

## [Mobile v2.2.0] - 2026-09-14

### Added
- **Active Complement Synchronization**: Synchronized mobile zone header badge (`⚓ 20 Sailors` for A-Zone) with Desktop calculations by aggregating active work orders, job cards, and daily allocations minus leaves.
- **Quick Home PDF Button**: Added quick export button on Home view for today's zone work orders.
- **Estimate Details PDF Export**: Added on-demand, zero-lag PDF download for estimate inspection sheets.

---

## [Mobile v2.1.0] - 2026-09-13

### Added
- **Embedded Sailor Assignment Modal**: Enabled direct allocation and removal of sailors to tasks within the mobile interface.
- **Category Filtering**: Supported quick tabs for Projects, Jobs, Tasks, and Quick Assignments.
- **Visual Progress Bars**: Animated progress trackers for ongoing jobs and projects.

---

## [Mobile v2.0.0] - 2026-09-12

### Changed
- **Unified Light Naval Theme**: Overhauled mobile UI to a crisp, high-contrast light theme with gradient accents tailored for outdoor field visibility.
- **Two-Tier Architecture**: Established `mobile.html` (Full Supervisor Edition) and `mobile-light.html` (Ultra-low latency field edition).

---

## [Desktop v5.25.10] - 2026-09-08

### Added
- Multi-date retrospective dashboard filtering.
- Grouping of Dockyard Workshop sections and Zone sections.
- LMD (Last Maintained Date) tracker with automated print layout.
