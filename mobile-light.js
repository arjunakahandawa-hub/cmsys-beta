// ---------------------------------------------
// TAB 2: ESTIMATES MANAGEMENT (PIC - 03 & 04)
// ---------------------------------------------
function formatCurrency(val) {
  const num = Number(val || 0);
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populateLocationDatalistMobile() {
  const dl = document.getElementById("mlLocDatalist");
  if (!dl) return;
  const names = new Set();
  (mlStore.locations || []).forEach(l => {
    const name = l.building_name || l.name || "";
    if (name) names.add(name);
  });
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
      <div onclick="openEstimateDetailMobile('${key}')" class="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-400 cursor-pointer transition-all active-scale space-y-2">
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
  const statusEl = document.getElementById("mlEstDetailStatus");
  const locEl = document.getElementById("mlEstDetailLocation");
  const endUserEl = document.getElementById("mlEstDetailEndUser");
  const scopeEl = document.getElementById("mlEstDetailScope");
  const matTotalEl = document.getElementById("mlEstDetailMatTotal");
  const labTotalEl = document.getElementById("mlEstDetailLabTotal");
  const matBody = document.getElementById("mlEstDetailMatTableBody");
  const labBody = document.getElementById("mlEstDetailLabTableBody");
  const sigEl = document.getElementById("mlEstDetailSignatories");
  const approveBtn = document.getElementById("mlEstDetailApproveBtn");

  if (numEl) numEl.textContent = est.estimate_number || "EST/--";
  if (refEl) refEl.textContent = est.reference_no || est.reference_doc || "—";
  
  const isApproved = est.status === "Approved";
  if (statusEl) {
    statusEl.textContent = isApproved ? "✓ Approved" : (est.status || "Pending");
    statusEl.className = "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold " + 
      (isApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800");
  }

  if (approveBtn) {
    approveBtn.style.display = isApproved ? "none" : "";
  }

  if (locEl) locEl.textContent = "📍 " + (est.location || "Not set") + (est.location2 ? " • " + est.location2 : "");
  if (endUserEl) endUserEl.textContent = "👤 " + (est.endUser || est.end_user || "Not set");
  if (scopeEl) scopeEl.textContent = est.workScope || est.description || "—";

  // Materials Table
  const mats = Array.isArray(est.materials) ? est.materials : [];
  let matTotal = 0;
  if (matBody) {
    if (mats.length === 0) {
      matBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">No materials specified</td></tr>';
    } else {
      matBody.innerHTML = mats.map(m => {
        const qty = parseFloat(m.qty || 0);
        const cost = parseFloat(m.cost || m.rate || 0);
        const total = parseFloat(m.total || (qty * cost));
        matTotal += total;
        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 font-bold">${escapeHtml(m.description || "Item")}</td>
            <td class="p-2 text-center">${qty}</td>
            <td class="p-2 text-center text-slate-500">${escapeHtml(m.unit || "Nos")}</td>
            <td class="p-2 text-right font-mono">Rs. ${formatCurrency(cost)}</td>
            <td class="p-2 text-right font-mono font-bold text-teal-700">Rs. ${formatCurrency(total)}</td>
          </tr>`;
      }).join("");
    }
  }
  if (matTotalEl) matTotalEl.textContent = "Rs. " + formatCurrency(est.total_cost || matTotal);

  // Labor Requirement Table
  const labs = Array.isArray(est.labor) ? est.labor : [];
  let labTotalDays = 0;
  if (labBody) {
    if (labs.length === 0) {
      labBody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">No labor specified</td></tr>';
    } else {
      labBody.innerHTML = labs.map(l => {
        const workers = parseInt(l.workers || 1, 10);
        const days = parseFloat(l.manDays || l.man_days || 0);
        labTotalDays += days;
        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 font-bold">${escapeHtml(l.trade || "Tradesman")}</td>
            <td class="p-2 text-center">${workers}</td>
            <td class="p-2 text-right font-mono font-bold text-blue-700">${days}</td>
          </tr>`;
      }).join("");
    }
  }
  if (labTotalEl) labTotalEl.textContent = (est.totalManDays || labTotalDays) + " man-days";

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

      // Populate Materials
      if (matContainer) {
        matContainer.innerHTML = "";
        (est.materials || []).forEach(m => addMaterialRowMobile(m));
      }

      // Populate Labor
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

    // Default Signatories from In-Charge if available
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
  row.className = "p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs est-mat-row";
  row.innerHTML = `
    <div class="flex items-center gap-1.5">
      <input type="text" placeholder="Material Description..." value="${escapeHtml(d.description)}" class="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold est-mat-desc">
      <button type="button" onclick="removeMaterialRowMobile(this)" class="w-6 h-6 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold shrink-0">✕</button>
    </div>
    <div class="grid grid-cols-3 gap-1.5">
      <div>
        <label class="text-[9px] font-bold text-slate-500 block">Qty</label>
        <input type="number" step="any" min="0" value="${d.qty || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono est-mat-qty">
      </div>
      <div>
        <label class="text-[9px] font-bold text-slate-500 block">Unit</label>
        <select class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs est-mat-unit">
          ${["Nos", "Kg", "Ltr", "Bags", "Cubes", "Ft", "lft", "Meters", "Sqft", "Sheets", "Pkts", "Tins"].map(u => 
            `<option value="${u}" ${u === (d.unit || "Nos") ? "selected" : ""}>${u}</option>`
          ).join("")}
        </select>
      </div>
      <div>
        <label class="text-[9px] font-bold text-slate-500 block">Rate (Rs)</label>
        <input type="number" step="any" min="0" value="${d.cost || 0}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono est-mat-cost">
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

  const trades = ["Carpenter", "Painter", "Mason", "Plumber", "Welder", "Electrician", "Blacksmith", "Labourer"];

  const row = document.createElement("div");
  row.className = "p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs est-lab-row";
  row.innerHTML = `
    <div class="grid grid-cols-12 gap-1.5 items-center">
      <div class="col-span-5">
        <label class="text-[9px] font-bold text-slate-500 block">Trade</label>
        <select class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-bold est-lab-trade">
          ${trades.map(t => `<option value="${t}" ${t === (d.trade || "Carpenter") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="col-span-3">
        <label class="text-[9px] font-bold text-slate-500 block">Workers</label>
        <input type="number" min="1" value="${d.workers || 1}" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono est-lab-workers">
      </div>
      <div class="col-span-3">
        <label class="text-[9px] font-bold text-slate-500 block">Man-Days</label>
        <input type="number" step="any" min="0" value="${d.manDays || 1}" oninput="calcNewEstTotalsMobile()" class="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-mono font-bold est-lab-days">
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
    matTotal += (qty * cost);
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

  picker.innerHTML = mlStore.sailors.slice(0, 60).map(s => {
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
  if (modal) modal.classList.remove("hidden");
}

function closeNewTaskModal() {
  const modal = document.getElementById("mlNewTaskModal");
  if (modal) modal.classList.add("hidden");
}

function submitNewTask() {
  const desc = (document.getElementById("mlNewDesc")?.value || "").trim();
  const prio = document.getElementById("mlNewPriority")?.value || "Medium";
  const dur = parseInt(document.getElementById("mlNewDuration")?.value, 10) || 1;

  if (!desc) {
    showLightToast("Please enter task description", "⚠️");
    return;
  }

  const zone = mlStore.currentZone;
  const newRef = opsDB.ref("work_orders").push();
  const newWo = {
    id: newRef.key,
    description: desc,
    zone_id: zone,
    status: "Active",
    priority: prio,
    progress: 0,
    duration: dur,
    created_at: Date.now()
  };

  newRef.set(newWo).then(() => {
    mlStore.workOrders.unshift(newWo);
    closeNewTaskModal();
    document.getElementById("mlNewDesc").value = "";
    showLightToast("Work Order created!", "✅");
    renderLightTasks();
  });
}

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

window.addEventListener("DOMContentLoaded", initLightApp);
