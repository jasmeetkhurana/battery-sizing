(() => {
  const DRAFT_KEY = "solarBess.v7";

  const steps = [
    { id: "site", title: "Your Site", desc: "Tell us about the site where the power is consumed." },
    { id: "mix", title: "Today's Power Mix", desc: "Your 24-hour demand and the sources serving it right now." },
    { id: "design", title: "New Solution", desc: "Add solar, battery storage, and exchange power using real products." },
    { id: "results", title: "Savings & Dispatch", desc: "How the new mix serves your load, hour by hour, and what you save." },
    { id: "details", title: "Your Details", desc: "Who should receive the solution report?" }
  ];

  const referenceData = {
    premises: ["Industrial", "Commercial", "EV Charging", "Mining", "Data Center", "Hospital", "Cold Storage", "Airport/Port", "Other"],
    objectives: [
      "Reduce electricity cost",
      "Replace diesel",
      "Demand charge reduction",
      "Time shifting for solar",
      "Backup reliability",
      "Power trading",
      "Carbon reduction target",
      "Other"
    ],
    locations: {
      Maharashtra: ["Pune", "Mumbai", "Thane", "Nashik", "Nagpur"],
      Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Kutch"],
      Karnataka: ["Bengaluru Urban", "Mysuru", "Tumakuru", "Belagavi", "Ballari"],
      TamilNadu: ["Chennai", "Coimbatore", "Salem", "Madurai", "Tiruppur"],
      Rajasthan: ["Jaipur", "Jodhpur", "Kota", "Alwar", "Udaipur"],
      Haryana: ["Gurugram", "Faridabad", "Panipat", "Hisar", "Sonipat"],
      UttarPradesh: ["Noida", "Lucknow", "Kanpur Nagar", "Ghaziabad", "Agra"],
      Telangana: ["Hyderabad", "Rangareddy", "Medchal", "Warangal", "Nalgonda"]
    }
  };

  // Today's sources (stack order: bottom -> top)
  const SOURCES = {
    solar: { label: "Existing Solar", color: "#f59e0b", fill: "rgba(245,158,11,.30)", defCost: 4.0, removable: true },
    exchange: { label: "Exchange / Open Access", color: "#8b5cf6", fill: "rgba(139,92,246,.28)", defCost: 5.5, removable: true },
    dg: { label: "Diesel Genset", color: "#64748b", fill: "rgba(100,116,139,.32)", defCost: 28.0, removable: true },
    grid: { label: "Grid (DISCOM)", color: "#2563eb", fill: "rgba(37,99,235,.26)", defCost: 9.0, removable: false }
  };
  const SOURCE_ORDER = ["solar", "exchange", "dg", "grid"];
  // Sources the user paints manually; existing solar is auto-generated from capacity,
  // and grid always takes the remainder of total demand
  const ALLOC_ORDER = ["exchange", "dg"];
  const EXISTING_SOLAR_YIELD = 4.2; // kWh per kWp per day

  // After-solution dispatch series (stack order: bottom -> top)
  const AFTER_META = {
    existingSolar: { label: "Existing Solar", color: "#f59e0b", fill: "rgba(245,158,11,.30)" },
    newSolar: { label: "New Solar", color: "#22c55e", fill: "rgba(34,197,94,.28)" },
    bess: { label: "BESS Discharge", color: "#06b6d4", fill: "rgba(6,182,212,.28)" },
    exchange: { label: "Exchange Power", color: "#8b5cf6", fill: "rgba(139,92,246,.28)" },
    grid: { label: "Grid (DISCOM)", color: "#2563eb", fill: "rgba(37,99,235,.26)" },
    dg: { label: "Diesel Genset", color: "#64748b", fill: "rgba(100,116,139,.32)" }
  };
  const AFTER_ORDER = ["existingSolar", "newSolar", "bess", "exchange", "grid", "dg"];

  const BESS_ROUNDTRIP = 0.88;

  function zeros() {
    return Array(24).fill(0);
  }

  function blankState() {
    return {
      site: {
        siteName: "",
        premisesType: "",
        premisesOther: "",
        state: "",
        district: "",
        locationDetails: "",
        sanctionedKw: "",
        objectives: [],
        objectiveOther: ""
      },
      mix: {
        enabled: { grid: true, dg: false, solar: false, exchange: false },
        cost: { grid: "", dg: "", solar: "", exchange: "" },
        total: zeros(),
        solarKwp: "",
        hourly: { dg: zeros(), exchange: zeros() },
        activeSeries: "total",
        selectedHour: 12,
        monthlyBillInr: "",
        gensets: [],
        profileAuto: true,
        seeded: false
      },
      solution: {
        plan: "",
        // What the customer is open to — drives sizing and prefills
        appetite: { roofAvail: "yes", roofAreaSqm: "", openAccessOk: true, exchangeOk: true },
        prefs: { pv_module: "", pv_inverter: "", battery: "", pcs: "", mv_station: "" },
        pv: {
          enabled: true,
          mode: "rooftop",
          moduleId: "",
          moduleQty: "",
          inverterId: "",
          inverterQty: "",
          mvStationId: "",
          mvStationQty: "",
          specificYield: "4.2",
          lcoeInr: "3.8"
        },
        bess: { enabled: true, batteryId: "", batteryQty: "", pcsId: "", pcsQty: "" },
        exchange: { enabled: false, maxKw: "" }
      },
      contact: { companyName: "", personName: "", personRole: "", personPhone: "", personEmail: "" },
      consent: false
    };
  }

  let state = loadDraft() || blankState();
  let current = 0;
  let draggingHour = null;
  let advOpen = false;

  const catalog = { loaded: false, error: null, categories: [], products: [] };

  const el = {
    stepper: document.getElementById("stepper"),
    stepTitle: document.getElementById("stepTitle"),
    stepDescription: document.getElementById("stepDescription"),
    view: document.getElementById("view"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    submitBtn: document.getElementById("submitBtn"),
    saveDraftBtn: document.getElementById("saveDraftBtn"),
    exportBtn: document.getElementById("exportBtn"),
    actionNote: document.getElementById("actionNote"),
    toast: document.getElementById("toast")
  };

  // ---------------- Utilities ----------------
  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const base = blankState();
      const merged = {
        ...base,
        ...parsed,
        site: { ...base.site, ...(parsed.site || {}) },
        mix: { ...base.mix, ...(parsed.mix || {}) },
        solution: {
          plan: (parsed.solution || {}).plan || "",
          appetite: { ...base.solution.appetite, ...((parsed.solution || {}).appetite || {}) },
          prefs: { ...base.solution.prefs, ...((parsed.solution || {}).prefs || {}) },
          pv: { ...base.solution.pv, ...((parsed.solution || {}).pv || {}) },
          bess: { ...base.solution.bess, ...((parsed.solution || {}).bess || {}) },
          exchange: { ...base.solution.exchange, ...((parsed.solution || {}).exchange || {}) }
        },
        contact: { ...base.contact, ...(parsed.contact || {}) }
      };
      merged.mix.enabled = { ...base.mix.enabled, ...(merged.mix.enabled || {}) };
      merged.mix.cost = { ...base.mix.cost, ...(merged.mix.cost || {}) };
      merged.mix.hourly = { ...base.mix.hourly, ...(merged.mix.hourly || {}) };
      if (!Array.isArray(merged.mix.total) || merged.mix.total.length !== 24) merged.mix.total = zeros();
      ALLOC_ORDER.forEach((k) => {
        if (!Array.isArray(merged.mix.hourly[k]) || merged.mix.hourly[k].length !== 24) merged.mix.hourly[k] = zeros();
      });
      return merged;
    } catch (_) {
      return null;
    }
  }

  function persistDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    setTimeout(() => el.toast.classList.add("hidden"), 2400);
  }

  function escapeHtml(str) {
    return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function fmt(n, digits = 1) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { maximumFractionDigits: digits });
  }

  function fmtInr(n, digits = 0) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: digits });
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) && v !== "" && v !== null ? n : fallback;
  }

  function bindInput(id, cb) {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener("input", () => cb(node.value));
  }

  function bindCheck(id, cb) {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener("change", () => cb(node.checked));
  }

  // ---------------- Catalog ----------------
  async function loadCatalog() {
    try {
      const [cats, prods] = await Promise.all([
        fetch("/api/categories").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch("/api/products").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      ]);
      catalog.categories = cats;
      catalog.products = prods;
      catalog.loaded = true;
      catalog.error = null;
    } catch (e) {
      catalog.error = "Product catalog unavailable. Start the app with `npm start` and open http://localhost:3000.";
    }
    if (["design", "results"].includes(steps[current].id)) render();
  }

  function productsByRole(role) {
    return catalog.products.filter((p) => p.categoryRole === role);
  }

  function productById(id) {
    return catalog.products.find((p) => p.id === Number(id)) || null;
  }

  function productShortLabel(p) {
    const s = p.specs || {};
    let key = "";
    if (p.categoryRole === "pv_module") key = `${s.powerWp} Wp`;
    else if (p.categoryRole === "pv_inverter") key = `${s.acKw} kW`;
    else if (p.categoryRole === "mv_station") key = `${fmt(s.kva, 0)} kVA`;
    else if (p.categoryRole === "battery") key = `${fmt(s.energyKwh, 0)} kWh / ${fmt(s.powerKw, 0)} kW${s.coupling ? `, ${s.coupling}` : ""}`;
    else if (p.categoryRole === "pcs") key = `${fmt(s.powerKw, 0)} kW`;
    return `${p.manufacturer} ${p.model}${key ? ` — ${key}` : ""}`;
  }

  // ---------------- Load math ----------------
  function round10(v) {
    return Math.max(0, Math.round(num(v) / 10) * 10);
  }

  function totalHourly() {
    return state.mix.total.map((v) => num(v));
  }

  // Existing solar is auto-generated from installed capacity (kWp), clamped to total demand
  function existingSolarHourly() {
    if (!state.mix.enabled.solar) return zeros();
    const kwp = num(state.mix.solarKwp);
    if (kwp <= 0) return zeros();
    const yieldPerKwp = EXISTING_SOLAR_YIELD;
    return state.mix.total.map((t, h) => Math.min(Math.round(kwp * yieldPerKwp * SOLAR_SHAPE[h]), num(t)));
  }

  function manualAllocSum(h, excludeKey) {
    return ALLOC_ORDER.reduce(
      (sum, k) => sum + (state.mix.enabled[k] && k !== excludeKey ? num(state.mix.hourly[k][h]) : 0),
      0
    );
  }

  function allocSum(h, excludeKey) {
    return existingSolarHourly()[h] + manualAllocSum(h, excludeKey);
  }

  function gridHourly() {
    return state.mix.total.map((t, h) => Math.max(0, num(t) - allocSum(h)));
  }

  function sourceHourly(key) {
    if (key === "grid") return gridHourly();
    if (key === "solar") return existingSolarHourly();
    return state.mix.enabled[key] ? state.mix.hourly[key].map((v) => num(v)) : zeros();
  }

  // If total (or auto-solar) leaves less room than the manual allocations, scale them down to fit
  function fitAllocations(h) {
    const room = Math.max(0, num(state.mix.total[h]) - existingSolarHourly()[h]);
    const s = manualAllocSum(h);
    if (s <= room) return;
    const scale = s > 0 ? room / s : 0;
    ALLOC_ORDER.forEach((k) => {
      if (!state.mix.enabled[k]) return;
      state.mix.hourly[k][h] = Math.floor((num(state.mix.hourly[k][h]) * scale) / 10) * 10;
    });
  }

  function normalizeMix() {
    for (let h = 0; h < 24; h += 1) fitAllocations(h);
  }

  function setTotalValue(h, val) {
    state.mix.total[h] = round10(val);
    state.mix.profileAuto = false; // user has taken over the curve
    fitAllocations(h);
  }

  function setSourceValue(key, h, val) {
    const headroom = Math.max(0, num(state.mix.total[h]) - existingSolarHourly()[h] - manualAllocSum(h, key));
    state.mix.hourly[key][h] = Math.max(0, Math.min(round10(val), Math.floor(headroom / 10) * 10));
  }

  function sourceCost(key) {
    return num(state.mix.cost[key], SOURCES[key].defCost);
  }

  function loadStats() {
    const total = totalHourly();
    const dailyKwh = total.reduce((a, b) => a + b, 0);
    const peakKw = Math.max(...total);
    let costDay = 0;
    SOURCE_ORDER.forEach((k) => {
      if (!state.mix.enabled[k]) return;
      costDay += sourceHourly(k).reduce((a, b) => a + b, 0) * sourceCost(k);
    });
    return {
      total,
      dailyKwh,
      peakKw,
      costDay,
      blended: dailyKwh > 0 ? costDay / dailyKwh : 0,
      sanctionedKw: num(state.site.sanctionedKw)
    };
  }

  function getAxisMax() {
    const sanctioned = num(state.site.sanctionedKw);
    const peak = Math.max(...totalHourly(), 0);
    const target = Math.max(sanctioned, peak * 1.1, 100);
    return Math.ceil(target / 50) * 50;
  }

  // Normalized solar generation shape (bell over 06:00–18:00)
  const SOLAR_SHAPE = (() => {
    const w = Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 18 ? Math.sin((Math.PI * (h - 6)) / 12) : 0));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  })();

  // Typical IEX day-ahead market clearing price pattern (₹/kWh) — historically
  // cheapest during the midday solar glut, most expensive in the evening peak.
  const IEX_MARKET_TOD = [
    4.2, 4.0, 3.9, 3.8, 3.9, 4.4, // 00–05 night
    5.8, 6.4, 6.0, 4.5, 3.4, 3.0, // 06–11 morning ramp into solar hours
    2.9, 3.0, 3.2, 3.6, 4.4, 5.8, // 12–17 solar glut, late-afternoon ramp
    8.5, 9.5, 9.2, 8.4, 6.5, 5.0 // 18–23 evening peak, easing off
  ];
  const OA_CHARGES_INR = 1.5; // wheeling + transmission + cross-subsidy surcharge etc.
  const OPEN_ACCESS_SOLAR_INR = 4.5; // prevalent landed cost of open-access solar PPA
  const ROOFTOP_SQM_PER_KWP = 10; // ~100 sq ft of shadow-free roof per kWp

  function exchangeLandedTod() {
    return IEX_MARKET_TOD.map((p) => p + OA_CHARGES_INR);
  }

  // ---------------- Stacked chart renderer ----------------
  function drawStack(canvas, seriesList, opts = {}) {
    const ctx = canvas.getContext("2d");
    const pad = { left: 64, right: 18, top: opts.legend ? 36 : 18, bottom: 46 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;
    const axisMax = opts.axisMax || 100;

    const x = (hour) => pad.left + (hour / 23) * w;
    const y = (kw) => pad.top + (1 - Math.min(kw, axisMax) / axisMax) * h;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (opts.fillWhite) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // plot background + grid
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(pad.left, pad.top, w, h);
    ctx.font = "11px Inter, sans-serif";
    for (let i = 0; i <= 5; i += 1) {
      const py = pad.top + (i / 5) * h;
      ctx.strokeStyle = "#e4ebf7";
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(pad.left + w, py);
      ctx.stroke();
      ctx.fillStyle = "#73839c";
      ctx.textAlign = "right";
      ctx.fillText(fmt(((5 - i) / 5) * axisMax, 0), pad.left - 8, py + 4);
    }
    ctx.textAlign = "left";
    for (let hour = 0; hour < 24; hour += 1) {
      ctx.strokeStyle = hour % 6 === 0 ? "#e9eff9" : "#f4f8fd";
      ctx.beginPath();
      ctx.moveTo(x(hour), pad.top);
      ctx.lineTo(x(hour), pad.top + h);
      ctx.stroke();
    }

    // cumulative stack
    const base = zeros();
    const tops = {};
    seriesList.forEach((s) => {
      const topArr = base.map((b, hh) => b + Math.max(0, num(s.data[hh])));
      tops[s.key] = { base: [...base], top: topArr };
      // area
      ctx.beginPath();
      topArr.forEach((v, hh) => (hh === 0 ? ctx.moveTo(x(hh), y(v)) : ctx.lineTo(x(hh), y(v))));
      for (let hh = 23; hh >= 0; hh -= 1) ctx.lineTo(x(hh), y(base[hh]));
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
      // top stroke
      ctx.beginPath();
      topArr.forEach((v, hh) => (hh === 0 ? ctx.moveTo(x(hh), y(v)) : ctx.lineTo(x(hh), y(v))));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      for (let hh = 0; hh < 24; hh += 1) base[hh] = topArr[hh];
    });

    // total outline (solid when the total itself is being edited)
    const stackTop = [...base];
    ctx.beginPath();
    stackTop.forEach((v, hh) => (hh === 0 ? ctx.moveTo(x(hh), y(v)) : ctx.lineTo(x(hh), y(v))));
    if (opts.editableTotal) {
      ctx.strokeStyle = "#0f1f38";
      ctx.lineWidth = 2.4;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(15,31,56,.55)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // editable points (a source band, or the total line itself)
    const editTotal = !!opts.editableTotal;
    const editSeries = !editTotal && opts.editableKey && tops[opts.editableKey] ? tops[opts.editableKey] : null;
    if (editTotal || editSeries) {
      const meta = editTotal ? null : seriesList.find((s) => s.key === opts.editableKey);
      const pointY = (hh) => (editTotal ? (opts.totalData ? num(opts.totalData[hh]) : stackTop[hh]) : editSeries.top[hh]);
      const color = editTotal ? "#0f1f38" : meta.color;
      for (let hh = 0; hh < 24; hh += 1) {
        const selected = hh === opts.selectedHour;
        ctx.beginPath();
        ctx.arc(x(hh), y(pointY(hh)), selected ? 7 : 4.6, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "#d97706" : color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      const sh = opts.selectedHour ?? 0;
      const val = editTotal ? (opts.totalData ? num(opts.totalData[sh]) : stackTop[sh]) : num(meta.data[sh]);
      const label = `${editTotal ? "Total demand" : meta.label} · H${sh}: ${fmt(val, 0)} kW`;
      ctx.font = "600 11px Inter, sans-serif";
      const lw = ctx.measureText(label).width + 16;
      const lx = Math.max(pad.left, Math.min(x(sh) - lw / 2, pad.left + w - lw));
      const ly = Math.max(pad.top + 4, y(pointY(sh)) - 32);
      ctx.fillStyle = "rgba(15,31,56,.92)";
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 8, ly + 15);
    }

    // axes labels
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#5d6f8a";
    for (let hour = 0; hour < 24; hour += 3) {
      ctx.fillText(String(hour).padStart(2, "0"), x(hour) - 7, canvas.height - 26);
    }
    ctx.fillText("Hour of day", pad.left + w / 2 - 26, canvas.height - 8);
    ctx.save();
    ctx.translate(14, pad.top + h / 2 + 18);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Power (kW)", 0, 0);
    ctx.restore();

    // legend
    if (opts.legend) {
      let lx = pad.left;
      ctx.font = "600 11px Inter, sans-serif";
      seriesList.forEach((s) => {
        if (!s.data.some((v) => num(v) > 0)) return;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.roundRect(lx, 10, 10, 10, 2);
        ctx.fill();
        ctx.fillStyle = "#33486b";
        ctx.fillText(s.label, lx + 14, 19);
        lx += 22 + ctx.measureText(s.label).width + 14;
      });
    }

    ctx.strokeStyle = "#c9d6ec";
    ctx.strokeRect(pad.left, pad.top, w, h);
    return { x, y, tops, stackTop, pad, w, h, axisMax };
  }

  function mixSeriesList() {
    return SOURCE_ORDER.filter((k) => state.mix.enabled[k]).map((k) => ({
      key: k,
      label: k === "grid" ? "Grid (remainder)" : SOURCES[k].label,
      color: SOURCES[k].color,
      fill: SOURCES[k].fill,
      data: sourceHourly(k)
    }));
  }

  // ---------------- Step: site ----------------
  function renderSite() {
    const s = state.site;
    const states = Object.keys(referenceData.locations);
    const districts = referenceData.locations[s.state] || [];
    el.view.innerHTML = `
      <div class="grid">
        <div class="col-12 card">
          <h3>Site basics</h3>
          <div class="grid">
            <div class="col-6"><label>Site name</label><input id="siteName" placeholder="e.g. Taloja Plant 2" value="${escapeHtml(s.siteName)}" /></div>
            <div class="col-6"><label>Type of premises</label><select id="premisesType"><option value="">Select</option>${referenceData.premises
              .map((x) => `<option value="${x}" ${s.premisesType === x ? "selected" : ""}>${x}</option>`)
              .join("")}</select></div>
            ${
              s.premisesType === "Other"
                ? `<div class="col-6"><label>Describe the premises</label><input id="premisesOther" value="${escapeHtml(s.premisesOther)}" /></div>`
                : ""
            }
            <div class="col-6"><label>State</label><select id="state"><option value="">Select</option>${states
              .map((x) => `<option value="${x}" ${s.state === x ? "selected" : ""}>${x}</option>`)
              .join("")}</select></div>
            <div class="col-6"><label>District</label><select id="district"><option value="">Select</option>${districts
              .map((x) => `<option value="${x}" ${s.district === x ? "selected" : ""}>${x}</option>`)
              .join("")}</select></div>
            <div class="col-6"><label>Sanctioned load (kW)</label><input id="sanctionedKw" type="number" min="0" placeholder="e.g. 2000" value="${s.sanctionedKw}" />
              <div class="field-hint">From your DISCOM connection agreement. We prefill a typical demand curve for your premises type from this.</div></div>
            <div class="col-12"><label>Location / address details (optional)</label><textarea id="locationDetails">${escapeHtml(s.locationDetails)}</textarea></div>
          </div>
        </div>
        <div class="col-12 card">
          <h3>What are you trying to achieve?</h3>
          <p class="sub">Pick everything that applies — this shapes the recommendation in your report.</p>
          <div class="chip-row" id="objectiveChips">
            ${referenceData.objectives
              .map((o) => `<button type="button" class="chip ${s.objectives.includes(o) ? "on" : ""}" data-obj="${escapeHtml(o)}">${escapeHtml(o)}</button>`)
              .join("")}
          </div>
          ${
            s.objectives.includes("Other")
              ? `<div style="margin-top:.8rem"><label>Tell us more</label><input id="objectiveOther" value="${escapeHtml(s.objectiveOther)}" /></div>`
              : ""
          }
        </div>
      </div>`;

    bindInput("siteName", (v) => (s.siteName = v));
    bindInput("premisesType", (v) => {
      s.premisesType = v;
      renderSite();
    });
    bindInput("premisesOther", (v) => (s.premisesOther = v));
    bindInput("state", (v) => {
      s.state = v;
      s.district = "";
      renderSite();
    });
    bindInput("district", (v) => (s.district = v));
    bindInput("sanctionedKw", (v) => (s.sanctionedKw = v));
    bindInput("locationDetails", (v) => (s.locationDetails = v));
    bindInput("objectiveOther", (v) => (s.objectiveOther = v));

    el.view.querySelectorAll("[data-obj]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const o = chip.dataset.obj;
        const i = s.objectives.indexOf(o);
        if (i >= 0) s.objectives.splice(i, 1);
        else s.objectives.push(o);
        renderSite();
      });
    });
  }

  // ---------------- Step: mix ----------------
  // Typical demand patterns for large consumers in India.
  // peakFrac: typical maximum demand as a share of sanctioned/contract demand
  // (utilities levy penal charges above contract demand, so sites stay below it).
  // gridInr: indicative HT tariff (₹/kWh, energy charge). shape(h): fraction of peak demand.
  const PREMISES_NORMS = {
    Industrial: {
      peakFrac: 0.85,
      gridInr: 8.5,
      note: "3-shift industrial pattern, ~75% load factor",
      shape: (h) => (h >= 6 && h <= 13 ? 1 : h >= 14 && h <= 21 ? 0.95 : 0.78)
    },
    Commercial: {
      peakFrac: 0.9,
      gridInr: 10,
      note: "business-hours pattern, ~45% load factor",
      shape: (h) => (h >= 9 && h <= 18 ? 1 : h === 8 || (h >= 19 && h <= 20) ? 0.75 : h === 21 ? 0.5 : 0.25)
    },
    "EV Charging": {
      peakFrac: 0.9,
      gridInr: 8,
      note: "morning & evening charging peaks with overnight depot charging",
      shape: (h) => (h >= 17 && h <= 22 ? 1 : h >= 8 && h <= 11 ? 0.9 : h >= 12 && h <= 16 ? 0.7 : h === 23 || h <= 4 ? 0.55 : 0.7)
    },
    Mining: {
      peakFrac: 0.85,
      gridInr: 8.5,
      note: "near-continuous operation, ~80% load factor",
      shape: (h) => (h >= 6 && h <= 17 ? 1 : 0.88)
    },
    "Data Center": {
      peakFrac: 0.9,
      gridInr: 8.5,
      note: "flat IT load with afternoon cooling bump, ~90% load factor",
      shape: (h) => (h >= 11 && h <= 16 ? 1 : 0.93)
    },
    Hospital: {
      peakFrac: 0.85,
      gridInr: 9.5,
      note: "day-heavy clinical load on a 24×7 base",
      shape: (h) => (h >= 9 && h <= 18 ? 1 : (h >= 7 && h <= 8) || (h >= 19 && h <= 21) ? 0.8 : 0.55)
    },
    "Cold Storage": {
      peakFrac: 0.85,
      gridInr: 9,
      note: "afternoon cooling peak on a 24×7 refrigeration base",
      shape: (h) => (h >= 11 && h <= 17 ? 1 : h >= 7 && h <= 10 ? 0.8 : h >= 18 && h <= 21 ? 0.85 : 0.65)
    },
    "Airport/Port": {
      peakFrac: 0.85,
      gridInr: 9.5,
      note: "early-morning and evening operational peaks",
      shape: (h) => (h >= 5 && h <= 9 ? 1 : h >= 17 && h <= 22 ? 0.95 : h >= 10 && h <= 16 ? 0.85 : 0.6)
    },
    Other: {
      peakFrac: 0.85,
      gridInr: 9,
      note: "generic day-peaking profile",
      shape: (h) => (h >= 8 && h <= 20 ? 1 : 0.45)
    }
  };

  function premisesNorm() {
    return PREMISES_NORMS[state.site.premisesType] || PREMISES_NORMS.Other;
  }

  function autoProfileTotal() {
    const sanctioned = num(state.site.sanctionedKw);
    if (sanctioned <= 0) return null;
    const norm = premisesNorm();
    const peak = sanctioned * norm.peakFrac;
    return Array.from({ length: 24 }, (_, h) => Math.max(10, Math.round((norm.shape(h) * peak) / 10) * 10));
  }

  // While the user hasn't hand-edited the total curve, keep it in sync with
  // sanctioned load + premises type so corrections upstream flow through.
  function seedStarterProfile() {
    const m = state.mix;
    if (!m.profileAuto) return;
    const auto = autoProfileTotal();
    if (!auto) return;
    if (m.cost.grid === "") m.cost.grid = String(premisesNorm().gridInr);
    if (auto.some((v, h) => v !== num(m.total[h]))) {
      m.total = auto;
      normalizeMix();
      if (!m.seeded) toast("We prefilled a typical demand curve for your premises type and sanctioned load — drag to adjust.");
      m.seeded = true;
    }
  }

  function applySeriesPreset(key, type) {
    const m = state.mix;
    const scale = Math.max(num(state.site.sanctionedKw), Math.max(...totalHourly(), 0), 100);
    const base = scale * 0.55;
    const shape = (h) => {
      if (type === "flat") return base;
      if (type === "day") return h >= 8 && h <= 20 ? base * 1.15 : base * 0.55;
      if (type === "night") return h >= 22 || h <= 6 ? base : base * 0.5;
      return 0; // zero
    };
    if (key === "total") {
      for (let h = 0; h < 24; h += 1) setTotalValue(h, shape(h));
    } else {
      for (let h = 0; h < 24; h += 1) setSourceValue(key, h, shape(h));
    }
  }

  function enableSource(key, on) {
    const m = state.mix;
    m.enabled[key] = on;
    if (on) {
      if (m.cost[key] === "") m.cost[key] = String(SOURCES[key].defCost);
      if (ALLOC_ORDER.includes(key)) m.activeSeries = key;
    } else if (m.activeSeries === key) {
      m.activeSeries = "total";
    }
    normalizeMix();
  }

  function renderMix() {
    seedStarterProfile();
    const m = state.mix;
    if (m.activeSeries !== "total" && (!m.enabled[m.activeSeries] || !ALLOC_ORDER.includes(m.activeSeries))) m.activeSeries = "total";
    normalizeMix();
    const ls = loadStats();
    const enabledKeys = SOURCE_ORDER.filter((k) => m.enabled[k]);
    const editingTotal = m.activeSeries === "total";
    const activeLabel = editingTotal ? "Total demand" : SOURCES[m.activeSeries].label;
    const activeData = editingTotal ? m.total : m.hourly[m.activeSeries];
    const allocOn = ALLOC_ORDER.filter((k) => m.enabled[k]);
    const solarDailyKwh = existingSolarHourly().reduce((a, b) => a + b, 0);

    el.view.innerHTML = `
      <div class="grid">
        <div class="col-12 card">
          <h3>1 · Shape your total demand</h3>
          <p class="sub">Start with how much power the site draws over 24 hours — the dark line on the chart. It stays constant while you assign sources below.</p>
          ${
            num(state.site.sanctionedKw) > 0
              ? `<div class="tag-row" style="margin-top:.2rem">
                  <span class="tag ${m.profileAuto ? "accent" : ""}">${
                  m.profileAuto
                    ? `Prefilled for ${escapeHtml(state.site.premisesType || "your site")}: ${escapeHtml(premisesNorm().note)} · peak ~${Math.round(premisesNorm().peakFrac * 100)}% of ${fmt(num(state.site.sanctionedKw), 0)} kW sanctioned`
                    : `Custom curve — use the Typical button to restore the ${escapeHtml(state.site.premisesType || "standard")} pattern`
                }</span>
                </div>`
              : ""
          }
          <h3 style="margin-top:1rem">2 · Have solar already? Just enter its capacity</h3>
          <p class="sub">We generate its hourly output automatically on a standard solar curve.</p>
          <div class="chip-row">
            <button type="button" class="chip ${m.enabled.solar ? "on" : ""}" data-src="solar">
              <span class="swatch" style="background:${SOURCES.solar.color}"></span>Existing Solar</button>
            ${
              m.enabled.solar
                ? `<span style="display:inline-flex;align-items:center;gap:.45rem">
                    <input id="solarKwp" type="number" min="0" step="10" style="width:9rem" placeholder="Capacity (kWp)" value="${m.solarKwp}" />
                    <span class="tag">${solarDailyKwh > 0 ? `~${fmt(solarDailyKwh, 0)} kWh/day` : `${EXISTING_SOLAR_YIELD} kWh/kWp/day`}</span>
                  </span>`
                : ""
            }
          </div>
          <h3 style="margin-top:1rem">3 · Adjust diesel and exchange power</h3>
          <p class="sub">Toggle what you use and paint its share on the chart. <strong>Everything left over is grid supply</strong> — it fills automatically.</p>
          <div class="chip-row">
            ${["dg", "exchange"]
              .map((k) => {
                const src = SOURCES[k];
                return `<button type="button" class="chip ${m.enabled[k] ? "on" : ""}" data-src="${k}">
                <span class="swatch" style="background:${src.color}"></span>${src.label}</button>`;
              })
              .join("")}
            <span class="chip locked"><span class="swatch" style="background:${SOURCES.grid.color}"></span>Grid (remainder) ✓</span>
          </div>
          <div class="grid" style="margin-top:.9rem">
            ${enabledKeys
              .map(
                (k) => `
              <div class="col-3"><label>${SOURCES[k].label} cost (₹/kWh)</label>
                <input id="cost_${k}" type="number" step="0.1" min="0" value="${m.cost[k]}" placeholder="${SOURCES[k].defCost}" /></div>`
              )
              .join("")}
            <div class="col-3"><label>Monthly bill (₹, optional)</label><input id="monthlyBill" type="number" min="0" value="${m.monthlyBillInr}" /></div>
          </div>
        </div>

        <div class="col-12 chart-panel">
          <div class="chart-toolbar">
            <div class="seg" id="seriesSeg">
              <button type="button" class="${editingTotal ? "active" : ""}" data-series="total"><span class="swatch" style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:#0f1f38;margin-right:.35rem"></span>Total demand</button>
              ${allocOn
                .map(
                  (k) =>
                    `<button type="button" class="${m.activeSeries === k ? "active" : ""}" data-series="${k}"><span class="swatch" style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:${SOURCES[k].color};margin-right:.35rem"></span>${SOURCES[k].label}</button>`
                )
                .join("")}
            </div>
            <div style="flex:1"></div>
            <label style="margin:0;display:flex;align-items:center;gap:.45rem;font-weight:500">H${m.selectedHour} kW
              <input id="selectedKw" type="number" min="0" style="width:7rem" value="${num(activeData[m.selectedHour])}" /></label>
            <div class="btn-row">
              ${editingTotal ? '<button class="btn btn-sm" data-preset="typical">Typical</button>' : ""}
              <button class="btn btn-sm" data-preset="flat">Flat</button>
              <button class="btn btn-sm" data-preset="day">Day</button>
              <button class="btn btn-sm" data-preset="night">Night</button>
              <button class="btn btn-sm" data-preset="zero">Clear</button>
            </div>
          </div>
          <canvas id="mixCanvas" width="1080" height="400"></canvas>
          <div class="legend">${enabledKeys
            .map(
              (k) =>
                `<span class="li"><span class="swatch" style="background:${SOURCES[k].color}"></span>${
                  k === "grid" ? "Grid (remainder)" : k === "solar" ? "Existing Solar (auto)" : SOURCES[k].label
                }</span>`
            )
            .join("")}<span class="li"><span class="swatch" style="background:transparent;border:1.5px ${editingTotal ? "solid" : "dashed"} #0f1f38"></span>Total demand</span></div>
          <div class="hint">${
            editingTotal
              ? "You are editing <strong>Total demand</strong> — the overall curve. Drag the dark points, or use ←/→ and ↑/↓. Solar generates automatically from its capacity; grid fills whatever is left."
              : `You are editing <strong>${SOURCES[m.activeSeries].label}</strong>'s share. It is capped by what solar doesn't already cover — the grid automatically absorbs the rest.`
          }</div>
        </div>

        <div class="col-12 card">
          <div class="stat-grid">
            <div class="stat"><div class="k">Daily consumption</div><div class="v">${fmt(ls.dailyKwh, 0)}<small>kWh</small></div></div>
            <div class="stat"><div class="k">Peak demand</div><div class="v">${fmt(ls.peakKw, 0)}<small>kW</small></div></div>
            <div class="stat"><div class="k">Today's energy cost</div><div class="v">${fmtInr(ls.costDay)}<small>/day</small></div></div>
            <div class="stat"><div class="k">Blended rate</div><div class="v">${fmt(ls.blended, 2)}<small>₹/kWh</small></div></div>
          </div>
        </div>

        ${
          m.enabled.dg
            ? `
        <div class="col-12 card">
          <h3>Diesel gensets on site</h3>
          <div class="repeat-list" id="dgList">${m.gensets
            .map(
              (g, i) => `
            <div class="repeat-item">
              <div class="grid">
                <div class="col-4"><label>Rating (kVA)</label><input type="number" data-dg-i="${i}" data-dg-k="ratingKva" value="${g.ratingKva || ""}" /></div>
                <div class="col-4"><label>Quantity</label><input type="number" data-dg-i="${i}" data-dg-k="quantity" value="${g.quantity || ""}" /></div>
                <div class="col-4"><label>Run hours/day</label><input type="number" data-dg-i="${i}" data-dg-k="runHours" value="${g.runHours || ""}" /></div>
              </div>
              <div class="btn-row" style="margin-top:.5rem"><button class="btn btn-sm dgRemove" data-dg-i="${i}">Remove</button></div>
            </div>`
            )
            .join("")}</div>
          <div class="btn-row" style="margin-top:.6rem"><button id="addGenset" class="btn btn-sm">+ Add genset</button></div>
        </div>`
            : ""
        }

        <div class="col-12 card">
          <h3>Fast edit — ${activeLabel}</h3>
          <label>24 hourly values (CSV, kW)</label>
          <textarea id="hourlyCsv">${activeData.map((v) => num(v)).join(",")}</textarea>
          <div class="btn-row" style="margin-top:.6rem"><button id="applyCsv" class="btn btn-sm">Apply to ${activeLabel}</button></div>
        </div>
      </div>`;

    // source toggles
    el.view.querySelectorAll("[data-src]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const k = chip.dataset.src;
        if (!SOURCES[k].removable) return;
        enableSource(k, !state.mix.enabled[k]);
        renderMix();
      });
    });

    enabledKeys.forEach((k) => bindInput(`cost_${k}`, (v) => (m.cost[k] = v)));
    bindInput("monthlyBill", (v) => (m.monthlyBillInr = v));

    // solar capacity drives the auto-generated solar curve
    bindInput("solarKwp", (v) => {
      m.solarKwp = v;
      normalizeMix();
      paintMixChart();
      const tag = document.querySelector("#solarKwp + .tag");
      if (tag) {
        const kwh = existingSolarHourly().reduce((a, b) => a + b, 0);
        tag.textContent = kwh > 0 ? `~${fmt(kwh, 0)} kWh/day` : `${EXISTING_SOLAR_YIELD} kWh/kWp/day`;
      }
    });

    // series selector
    el.view.querySelectorAll("[data-series]").forEach((btn) => {
      btn.addEventListener("click", () => {
        m.activeSeries = btn.dataset.series;
        renderMix();
      });
    });

    // presets
    el.view.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.preset === "typical") {
          m.profileAuto = true; // hand the curve back to the auto-profile
        } else {
          applySeriesPreset(m.activeSeries, btn.dataset.preset);
        }
        renderMix();
      });
    });

    bindInput("selectedKw", (v) => {
      if (editingTotal) setTotalValue(m.selectedHour, v);
      else setSourceValue(m.activeSeries, m.selectedHour, v);
      paintMixChart();
    });

    document.getElementById("applyCsv").addEventListener("click", () => {
      const vals = document
        .getElementById("hourlyCsv")
        .value.split(",")
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x));
      if (vals.length !== 24) return toast("Need exactly 24 numbers");
      for (let h = 0; h < 24; h += 1) {
        if (editingTotal) setTotalValue(h, vals[h]);
        else setSourceValue(m.activeSeries, h, vals[h]);
      }
      renderMix();
    });

    // gensets
    const addG = document.getElementById("addGenset");
    if (addG) addG.addEventListener("click", () => (m.gensets.push({ ratingKva: "", quantity: "", runHours: "" }), renderMix()));
    el.view.querySelectorAll("[data-dg-k]").forEach((node) => {
      node.addEventListener("input", () => {
        m.gensets[Number(node.dataset.dgI)][node.dataset.dgK] = node.value;
      });
    });
    el.view.querySelectorAll(".dgRemove").forEach((btn) =>
      btn.addEventListener("click", () => {
        m.gensets.splice(Number(btn.dataset.dgI), 1);
        renderMix();
      })
    );

    bindMixChart();
    paintMixChart();
  }

  function paintMixChart() {
    const canvas = document.getElementById("mixCanvas");
    if (!canvas) return null;
    const editingTotal = state.mix.activeSeries === "total";
    return drawStack(canvas, mixSeriesList(), {
      axisMax: getAxisMax(),
      editableKey: editingTotal ? null : state.mix.activeSeries,
      editableTotal: editingTotal,
      totalData: editingTotal ? state.mix.total : null,
      selectedHour: state.mix.selectedHour
    });
  }

  function bindMixChart() {
    const canvas = document.getElementById("mixCanvas");
    if (!canvas) return;
    const m = state.mix;
    const editingTotal = () => m.activeSeries === "total";

    const pointer = (evt) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (evt.clientX - rect.left) * (canvas.width / rect.width),
        y: (evt.clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const geometry = () => paintMixChart();

    const pointHeights = (geo) => {
      if (editingTotal()) return m.total.map((v) => num(v));
      const t = geo.tops[m.activeSeries];
      return t ? t.top : null;
    };

    const nearestHour = (geo, px, py) => {
      const heights = pointHeights(geo);
      if (!heights) return -1;
      let best = -1;
      let dist = Number.POSITIVE_INFINITY;
      for (let hh = 0; hh < 24; hh += 1) {
        const d = Math.hypot(px - geo.x(hh), py - geo.y(heights[hh]));
        if (d < dist) {
          dist = d;
          best = hh;
        }
      }
      return dist <= 20 ? best : -1;
    };

    const applyDrag = (geo, hour, py) => {
      const kwAtPointer = ((geo.pad.top + geo.h - py) / geo.h) * geo.axisMax;
      if (editingTotal()) {
        setTotalValue(hour, kwAtPointer);
      } else {
        const t = geo.tops[m.activeSeries];
        const baseVal = t ? t.base[hour] : 0;
        setSourceValue(m.activeSeries, hour, kwAtPointer - baseVal);
      }
    };

    canvas.onmousedown = (evt) => {
      const geo = geometry();
      const p = pointer(evt);
      const target = nearestHour(geo, p.x, p.y);
      if (target < 0) return;
      draggingHour = target;
      m.selectedHour = target;
      applyDrag(geo, target, p.y);
      syncSelectedInput();
      paintMixChart();
    };

    canvas.onmousemove = (evt) => {
      if (draggingHour === null) return;
      const geo = paintMixChart();
      const p = pointer(evt);
      applyDrag(geo, draggingHour, p.y);
      m.selectedHour = draggingHour;
      syncSelectedInput();
      paintMixChart();
    };

    window.onmouseup = () => {
      draggingHour = null;
    };

    canvas.onclick = (evt) => {
      if (draggingHour !== null) return;
      const geo = geometry();
      const p = pointer(evt);
      const target = nearestHour(geo, p.x, p.y);
      if (target < 0) return;
      m.selectedHour = target;
      syncSelectedInput();
      paintMixChart();
    };

    const activeValue = () => (editingTotal() ? num(m.total[m.selectedHour]) : num(m.hourly[m.activeSeries][m.selectedHour]));

    const syncSelectedInput = () => {
      const node = document.getElementById("selectedKw");
      if (node) node.value = String(activeValue());
      const lbl = node && node.parentElement;
      if (lbl) lbl.firstChild.textContent = `H${m.selectedHour} kW `;
    };

    if (window.__mixKeydown) window.removeEventListener("keydown", window.__mixKeydown);
    window.__mixKeydown = (evt) => {
      if (steps[current].id !== "mix") return;
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      if (evt.key === "ArrowLeft") m.selectedHour = Math.max(0, m.selectedHour - 1);
      else if (evt.key === "ArrowRight") m.selectedHour = Math.min(23, m.selectedHour + 1);
      else if (evt.key === "ArrowUp") {
        if (editingTotal()) setTotalValue(m.selectedHour, activeValue() + 10);
        else setSourceValue(m.activeSeries, m.selectedHour, activeValue() + 10);
      } else if (evt.key === "ArrowDown") {
        if (editingTotal()) setTotalValue(m.selectedHour, activeValue() - 10);
        else setSourceValue(m.activeSeries, m.selectedHour, activeValue() - 10);
      } else return;
      evt.preventDefault();
      syncSelectedInput();
      paintMixChart();
    };
    window.addEventListener("keydown", window.__mixKeydown);
  }

  // ---------------- Solution metrics + validation ----------------
  function solutionMetrics() {
    const sol = state.solution;
    const m = { pv: null, bess: null, exchange: null };

    if (sol.pv.enabled) {
      const module = productById(sol.pv.moduleId);
      const inverter = productById(sol.pv.inverterId);
      const mv = productById(sol.pv.mvStationId);
      const moduleQty = num(sol.pv.moduleQty);
      const inverterQty = num(sol.pv.inverterQty);
      const mvQty = num(sol.pv.mvStationQty);
      const dcKwp = module ? (module.specs.powerWp * moduleQty) / 1000 : null;
      const acKw = inverter ? inverter.specs.acKw * inverterQty : null;
      m.pv = {
        module,
        moduleQty,
        inverter,
        inverterQty,
        mv,
        mvQty,
        dcKwp,
        acKw,
        ratio: dcKwp && acKw ? dcKwp / acKw : null,
        areaAcres: dcKwp ? (dcKwp / 1000) * 5 : null,
        areaSqm: dcKwp ? dcKwp * ROOFTOP_SQM_PER_KWP : null,
        dailyGenKwh: dcKwp ? dcKwp * num(sol.pv.specificYield, 4.2) : null,
        mvKva: mv ? mv.specs.kva * mvQty : null,
        stringWindow: null
      };
      if (module && inverter) {
        const maxDcV = inverter.specs.maxDcV || inverter.specs.mpptMaxV;
        const minPerString = Math.ceil((inverter.specs.mpptMinV || 0) / module.specs.vmp);
        const maxPerString = Math.floor(maxDcV / (module.specs.voc * 1.08));
        m.pv.stringWindow = { min: minPerString, max: maxPerString };
      }
    }

    if (sol.bess.enabled) {
      const battery = productById(sol.bess.batteryId);
      const pcs = productById(sol.bess.pcsId);
      const batteryQty = num(sol.bess.batteryQty);
      const pcsQty = num(sol.bess.pcsQty);
      const acCoupled = battery ? String(battery.specs.coupling || "").toUpperCase() === "AC" : false;
      const energyKwh = battery ? battery.specs.energyKwh * batteryQty : null;
      const batteryPowerKw = battery ? battery.specs.powerKw * batteryQty : null;
      const pcsPowerKw = pcs ? pcs.specs.powerKw * pcsQty : null;
      const powerKw = acCoupled
        ? batteryPowerKw
        : pcsPowerKw !== null && batteryPowerKw !== null
          ? Math.min(batteryPowerKw, pcsPowerKw)
          : pcsPowerKw ?? batteryPowerKw;
      m.bess = { battery, batteryQty, pcs, pcsQty, acCoupled, energyKwh, batteryPowerKw, pcsPowerKw, powerKw, durationH: energyKwh && powerKw ? energyKwh / powerKw : null };
    }

    if (sol.exchange.enabled) {
      const tod = exchangeLandedTod();
      m.exchange = {
        maxKw: num(sol.exchange.maxKw, num(state.site.sanctionedKw)),
        tod,
        minInr: Math.min(...tod),
        maxInr: Math.max(...tod),
        avgInr: tod.reduce((a, b) => a + b, 0) / 24
      };
    }

    return m;
  }

  function validateSolution() {
    const checks = [];
    const m = solutionMetrics();
    const ls = loadStats();
    const push = (level, text) => checks.push({ level, text });

    if (m.pv) {
      const pv = m.pv;
      if (!pv.module || !pv.moduleQty) push("warn", "Solar PV: select a module and quantity.");
      if (!pv.inverter || !pv.inverterQty) push("warn", "Solar PV: select an inverter and quantity.");
      if (pv.ratio !== null) {
        if (pv.ratio < 1.0) push("warn", `DC/AC ratio ${fmt(pv.ratio, 2)} is below 1.0 — inverters are oversized for the array.`);
        else if (pv.ratio > 1.5) push("warn", `DC/AC ratio ${fmt(pv.ratio, 2)} exceeds 1.5 — expect significant clipping losses.`);
        else push("ok", `DC/AC ratio ${fmt(pv.ratio, 2)} is within the recommended 1.0–1.5 band.`);
      }
      if (pv.stringWindow) {
        if (pv.stringWindow.max < pv.stringWindow.min) {
          push("warn", `String sizing: ${pv.module.model} is not electrically compatible with ${pv.inverter.model} (no valid modules-per-string count).`);
        } else {
          push("ok", `String sizing: use ${pv.stringWindow.min}–${pv.stringWindow.max} modules per string on the ${pv.inverter.model} (MPPT ${pv.inverter.specs.mpptMinV}–${pv.inverter.specs.mpptMaxV} V).`);
        }
      }
      if (pv.mv && pv.acKw !== null) {
        if (pv.mvKva < pv.acKw) push("warn", `MV station capacity ${fmt(pv.mvKva, 0)} kVA is below total inverter AC output ${fmt(pv.acKw, 0)} kW.`);
        else push("ok", `MV station capacity ${fmt(pv.mvKva, 0)} kVA covers inverter AC output ${fmt(pv.acKw, 0)} kW.`);
        if (pv.mv.specs.pairingHint) push("ok", `${pv.mv.model} typical pairing: ${pv.mv.specs.pairingHint}.`);
        if (pv.inverter && pv.inverter.specs.acVoltage && pv.mv.specs.lvVoltage && pv.inverter.specs.acVoltage !== pv.mv.specs.lvVoltage) {
          push("warn", `Inverter AC voltage ${pv.inverter.specs.acVoltage} V differs from MV station LV side ${pv.mv.specs.lvVoltage} V.`);
        }
      }
      if (state.solution.pv.mode === "rooftop" && pv.acKw !== null && ls.sanctionedKw > 0 && pv.acKw > ls.sanctionedKw) {
        push("warn", `Rooftop PV AC ${fmt(pv.acKw, 0)} kW exceeds sanctioned load ${fmt(ls.sanctionedKw, 0)} kW — check net-metering rules with your DISCOM.`);
      }
      const app = state.solution.appetite;
      if (state.solution.pv.mode === "rooftop" && pv.areaSqm) {
        if (app.roofAvail === "none") {
          push("warn", `Rooftop PV selected but you indicated no roof space — consider open-access solar instead.`);
        } else if (app.roofAvail === "limited" && num(app.roofAreaSqm) > 0 && pv.areaSqm > num(app.roofAreaSqm)) {
          push("warn", `This array needs ~${fmt(pv.areaSqm, 0)} m² of roof but you have ~${fmt(num(app.roofAreaSqm), 0)} m² — reduce size or use open access.`);
        } else {
          push("ok", `Rooftop array needs ~${fmt(pv.areaSqm, 0)} m² (${fmt(pv.areaSqm * 10.76, 0)} sq ft) of shadow-free roof.`);
        }
      }
    }

    if (m.bess) {
      const b = m.bess;
      if (!b.battery || !b.batteryQty) push("warn", "BESS: select a battery product and quantity.");
      if (b.battery && !b.acCoupled) {
        if (!b.pcs || !b.pcsQty) push("warn", `BESS: ${b.battery.model} is DC-coupled — add a PCS and quantity.`);
        else {
          const bs = b.battery.specs;
          const ps = b.pcs.specs;
          if (bs.dcVminV !== undefined && ps.dcVminV !== undefined) {
            if (bs.dcVminV < ps.dcVminV || bs.dcVmaxV > ps.dcVmaxV) {
              push("warn", `PCS DC window ${ps.dcVminV}–${ps.dcVmaxV} V does not fully cover battery voltage range ${bs.dcVminV}–${bs.dcVmaxV} V.`);
            } else {
              push("ok", `PCS DC window ${ps.dcVminV}–${ps.dcVmaxV} V covers battery range ${bs.dcVminV}–${bs.dcVmaxV} V.`);
            }
          }
          if (ps.maxParallel && b.pcsQty > ps.maxParallel) push("warn", `${b.pcs.model} supports up to ${ps.maxParallel} parallel units; ${b.pcsQty} configured.`);
        }
      }
      if (b.battery && b.acCoupled) push("ok", `${b.battery.model} is AC-coupled (integrated PCS) — no separate PCS required.`);
      if (b.powerKw !== null && ls.peakKw > 0) {
        const cover = (b.powerKw / ls.peakKw) * 100;
        push(cover >= 30 ? "ok" : "warn", `BESS power ${fmt(b.powerKw, 0)} kW covers ${fmt(cover, 0)}% of your ${fmt(ls.peakKw, 0)} kW peak.`);
      }
    }

    if (m.exchange) {
      const gridCost = sourceCost("grid");
      const cheapHours = m.exchange.tod.filter((p) => p < gridCost).length;
      if (cheapHours === 0) {
        push("warn", `At typical IEX prices (₹${fmt(m.exchange.minInr, 1)}–${fmt(m.exchange.maxInr, 1)}/kWh landed), exchange power never beats your grid rate ₹${fmt(gridCost, 2)}/kWh.`);
      } else {
        push("ok", `Exchange power beats your ₹${fmt(gridCost, 2)}/kWh grid rate in ${cheapHours} of 24 hours — cheapest ~₹${fmt(m.exchange.minInr, 1)}/kWh around midday.`);
      }
    }

    if (!m.pv && !m.bess && !m.exchange) push("warn", "Enable at least one block — solar, BESS, or exchange power.");
    return { metrics: m, checks };
  }

  function solutionBom() {
    const sol = state.solution;
    const rows = [];
    const add = (product, qty, note) => {
      if (!product || !num(qty)) return;
      rows.push({ category: product.categoryName, manufacturer: product.manufacturer, model: product.model, qty: num(qty), note: note || "" });
    };
    if (sol.pv.enabled) {
      const mod = productById(sol.pv.moduleId);
      add(mod, sol.pv.moduleQty, mod ? `${mod.specs.powerWp} Wp` : "");
      const inv = productById(sol.pv.inverterId);
      add(inv, sol.pv.inverterQty, inv ? `${inv.specs.acKw} kW AC` : "");
      const mv = productById(sol.pv.mvStationId);
      add(mv, sol.pv.mvStationQty, mv ? `${fmt(mv.specs.kva, 0)} kVA` : "");
    }
    if (sol.bess.enabled) {
      const bat = productById(sol.bess.batteryId);
      add(bat, sol.bess.batteryQty, bat ? `${fmt(bat.specs.energyKwh, 0)} kWh / ${fmt(bat.specs.powerKw, 0)} kW` : "");
      const acCoupled = bat ? String(bat.specs.coupling || "").toUpperCase() === "AC" : false;
      if (!acCoupled) {
        const pcs = productById(sol.bess.pcsId);
        add(pcs, sol.bess.pcsQty, pcs ? `${fmt(pcs.specs.powerKw, 0)} kW` : "");
      }
    }
    return rows;
  }

  // ---------------- Dispatch + savings engine ----------------
  function simulate() {
    const m = solutionMetrics();
    const mix = state.mix;
    const total = totalHourly();

    const cost = {
      grid: sourceCost("grid"),
      dg: sourceCost("dg"),
      solar: sourceCost("solar"),
      exchange: sourceCost("exchange")
    };

    const existSolar = existingSolarHourly();
    const existExchange = mix.enabled.exchange ? mix.hourly.exchange.map((v) => num(v)) : zeros();
    const existDg = mix.enabled.dg ? mix.hourly.dg.map((v) => num(v)) : zeros();
    // Hours where DG runs today are treated as grid-unavailable (outage / restricted) hours
    const outage = existDg.map((v) => v > 0);

    const pvKwp = m.pv && m.pv.dcKwp ? m.pv.dcKwp : 0;
    const pvYield = num(state.solution.pv.specificYield, 4.2);
    const pvLcoe = num(state.solution.pv.lcoeInr, 3.8);
    const newSolarGen = SOLAR_SHAPE.map((w) => pvKwp * pvYield * w);

    const bessCap = m.bess && m.bess.energyKwh ? m.bess.energyKwh : 0;
    const bessPow = m.bess && m.bess.powerKw ? m.bess.powerKw : 0;

    const exNew = m.exchange;
    const exTod = exchangeLandedTod(); // hourly landed IEX price
    const exMaxKw = exNew ? exNew.maxKw : 0;
    // Cheapest marginal purchase rate at each hour (new exchange vs grid)
    const buyRate = (h) => (exNew && exTod[h] < cost.grid ? exTod[h] : cost.grid);

    const serve = {
      existingSolar: zeros(),
      newSolar: zeros(),
      bess: zeros(),
      exchange: zeros(),
      grid: zeros(),
      dg: zeros()
    };
    const remaining = [...total];
    const surplus = zeros();

    for (let h = 0; h < 24; h += 1) {
      serve.existingSolar[h] = Math.min(existSolar[h], remaining[h]);
      remaining[h] -= serve.existingSolar[h];
      serve.newSolar[h] = Math.min(newSolarGen[h], remaining[h]);
      surplus[h] = newSolarGen[h] - serve.newSolar[h];
      remaining[h] -= serve.newSolar[h];
    }

    // BESS charging: solar surplus first, then the cheapest purchase hours
    // (typically midday exchange power or off-peak grid)
    let soc = 0;
    let chargeCost = 0;
    let chargeKwh = 0;
    if (bessCap > 0) {
      for (let h = 0; h < 24; h += 1) {
        const c = Math.min(surplus[h], bessPow, bessCap - soc);
        if (c > 0) {
          soc += c;
          chargeKwh += c;
          chargeCost += c * pvLcoe;
        }
      }
      if (soc < bessCap * 0.98) {
        const chargeHours = [];
        for (let h = 0; h < 24; h += 1) if (!outage[h]) chargeHours.push({ h, rate: buyRate(h) });
        chargeHours.sort((a, b) => a.rate - b.rate);
        for (const { h, rate } of chargeHours) {
          const c = Math.min(bessPow, bessCap - soc);
          if (c <= 0) break;
          soc += c;
          chargeKwh += c;
          chargeCost += c * rate;
          // charging energy is an extra purchase, tracked for cost (not load service)
          if (exNew && exTod[h] < cost.grid) serve._exchangeChargeKwh = (serve._exchangeChargeKwh || 0) + c;
          else serve._gridChargeKwh = (serve._gridChargeKwh || 0) + c;
        }
      }
    }
    const avgChargeRate = chargeKwh > 0 ? chargeCost / chargeKwh : 0;
    const dischargeRate = avgChargeRate / BESS_ROUNDTRIP;
    let dischargeAvail = soc * BESS_ROUNDTRIP;

    // Discharge priority 1: outage (DG) hours — most expensive energy today
    const hoursByPriority = [];
    for (let h = 0; h < 24; h += 1) if (outage[h] && remaining[h] > 0) hoursByPriority.push({ h, rate: cost.dg });
    // Priority 2: normal hours where stored energy beats that hour's marginal source
    for (let h = 0; h < 24; h += 1) {
      if (!outage[h] && remaining[h] > 0) hoursByPriority.push({ h, rate: buyRate(h) });
    }
    hoursByPriority.sort((a, b) => b.rate - a.rate);
    for (const { h, rate } of hoursByPriority) {
      if (dischargeAvail <= 0) break;
      if (dischargeRate >= rate && !outage[h]) continue; // not economic outside outage hours
      const d = Math.min(remaining[h], bessPow, dischargeAvail);
      if (d > 0) {
        serve.bess[h] += d;
        remaining[h] -= d;
        dischargeAvail -= d;
      }
    }

    // Existing exchange contracts keep serving at their contracted rate (non-outage hours)
    let exCostTotal = 0;
    for (let h = 0; h < 24; h += 1) {
      if (outage[h]) continue;
      const e = Math.min(existExchange[h], remaining[h]);
      serve.exchange[h] += e;
      remaining[h] -= e;
      exCostTotal += e * cost.exchange;
    }
    // New exchange power in the hours where IEX landed price beats grid
    if (exNew) {
      for (let h = 0; h < 24; h += 1) {
        if (outage[h] || exTod[h] >= cost.grid) continue;
        const e = Math.min(remaining[h], Math.max(0, exMaxKw - serve.exchange[h]));
        serve.exchange[h] += e;
        remaining[h] -= e;
        exCostTotal += e * exTod[h];
      }
    }
    // Grid takes the rest in normal hours, DG only in outage hours
    for (let h = 0; h < 24; h += 1) {
      if (outage[h]) {
        serve.dg[h] = remaining[h];
      } else {
        serve.grid[h] = remaining[h];
      }
      remaining[h] = 0;
    }

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);

    const costAfter =
      sum(serve.existingSolar) * cost.solar +
      sum(serve.newSolar) * pvLcoe +
      sum(serve.bess) * dischargeRate +
      exCostTotal +
      sum(serve.grid) * cost.grid +
      sum(serve.dg) * cost.dg;

    const ls = loadStats();
    const costBefore = ls.costDay;
    const savingsDay = costBefore - costAfter;
    const dgBeforeKwh = sum(existDg);
    const dgAfterKwh = sum(serve.dg);
    const renewableShare = ls.dailyKwh > 0 ? ((sum(serve.existingSolar) + sum(serve.newSolar)) / ls.dailyKwh) * 100 : 0;

    return {
      serve,
      newSolarGen,
      surplusKwh: sum(surplus),
      chargeKwh,
      dischargeRate,
      costBefore,
      costAfter,
      savingsDay,
      savingsYear: savingsDay * 365,
      savingsPct: costBefore > 0 ? (savingsDay / costBefore) * 100 : 0,
      dgBeforeKwh,
      dgAfterKwh,
      renewableShare,
      blendedAfter: ls.dailyKwh > 0 ? costAfter / ls.dailyKwh : 0,
      assumptions: [
        `New solar generates ${fmt(pvYield, 1)} kWh/kWp/day on a standard bell curve (06:00–18:00) at ₹${fmt(pvLcoe, 2)}/kWh.`,
        `BESS round-trip efficiency ${Math.round(BESS_ROUNDTRIP * 100)}%; charged from solar surplus first, then the cheapest purchase hours of the day.`,
        `Exchange power priced on typical IEX day-ahead patterns — ~₹${fmt(Math.min(...IEX_MARKET_TOD), 1)}/kWh midday to ~₹${fmt(Math.max(...IEX_MARKET_TOD), 1)}/kWh evening peak, plus ₹${fmt(OA_CHARGES_INR, 1)}/kWh open-access charges.`,
        "Hours where your DG runs today are treated as grid-unavailable; only solar, BESS, and DG can serve them.",
        "Savings compare daily energy cost before vs after, annualised × 365. Capex and demand charges are not modelled in v1."
      ]
    };
  }

  function afterSeriesList(sim) {
    return AFTER_ORDER.map((k) => ({
      key: k,
      label: AFTER_META[k].label,
      color: AFTER_META[k].color,
      fill: AFTER_META[k].fill,
      data: sim.serve[k]
    })).filter((s) => s.data.some((v) => v > 0.5) || ["grid"].includes(s.key));
  }

  // ---------------- Outcome buckets + auto product selection ----------------
  const PLAN_ORDER = ["starter", "balanced", "max"];
  const PLAN_BUCKETS = {
    starter: {
      label: "Quick Start",
      tagline: "Smallest system, fastest payback — daytime solar plus a battery only if you run diesel."
    },
    balanced: {
      label: "Balanced",
      tagline: "Solar covering most daytime demand with a right-sized battery for evenings and outages."
    },
    max: {
      label: "Max Savings",
      tagline: "The full stack — maximum solar, a bigger battery, and cheap exchange power round the clock."
    }
  };
  const PLAN_SHARES = {
    starter: { pvShare: 0.45, bessPeakShare: 0, bessHours: 0, exchange: false },
    balanced: { pvShare: 0.75, bessPeakShare: 0.3, bessHours: 2, exchange: true },
    max: { pvShare: 1.0, bessPeakShare: 0.45, bessHours: 3, exchange: true }
  };

  // Rooftop capacity the customer's available shadow-free roof can host
  function roofCapKwp() {
    const a = state.solution.appetite;
    if (a.roofAvail === "none") return 0;
    if (a.roofAvail === "limited") return Math.max(0, num(a.roofAreaSqm) / ROOFTOP_SQM_PER_KWP);
    return Infinity;
  }
  const PREF_ROLES = [
    { role: "pv_module", label: "PV modules" },
    { role: "pv_inverter", label: "Solar inverters" },
    { role: "battery", label: "Batteries" },
    { role: "pcs", label: "PCS (power conversion)" },
    { role: "mv_station", label: "MV stations" }
  ];

  function brandsForRole(role) {
    return [...new Set(productsByRole(role).map((p) => p.manufacturer))].sort();
  }

  function preferredProducts(role) {
    const pref = state.solution.prefs[role];
    const list = productsByRole(role);
    if (!pref) return list;
    const filtered = list.filter((p) => p.manufacturer === pref);
    return filtered.length ? filtered : list;
  }

  // Largest unit that fits within the target; smallest available if the target is below all units
  function pickUnit(list, capOf, target) {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => capOf(a) - capOf(b));
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (capOf(sorted[i]) <= target) return sorted[i];
    }
    return sorted[0];
  }

  function planTargets(bucketKey) {
    const b = PLAN_SHARES[bucketKey];
    const total = totalHourly();
    const existSolar = existingSolarHourly();
    const dg = sourceHourly("dg");
    let dayHeadroomKwh = 0;
    for (let h = 6; h <= 18; h += 1) dayHeadroomKwh += Math.max(0, total[h] - existSolar[h]);
    const dgKwh = dg.reduce((a, c) => a + c, 0);
    const dgPeakKw = Math.max(...dg, 0);
    const peakKw = Math.max(...total, 0);
    const sanctioned = num(state.site.sanctionedKw);
    const yieldDay = num(state.solution.pv.specificYield, 4.2);

    const a = state.solution.appetite;
    const pvKwpIdeal = Math.round((dayHeadroomKwh * b.pvShare) / yieldDay);
    const bessPowKw = Math.round(Math.max(peakKw * b.bessPeakShare, dgPeakKw));
    const bessKwh = Math.round(Math.max(bessPowKw * b.bessHours, dgKwh));

    // Rooftop is the default; it is limited by both roof space and sanctioned
    // load (net-metering). When the ideal size doesn't fit, fall back to
    // open-access solar if the customer is open to it — else cap to the roof.
    const rooftopLimit = Math.min(roofCapKwp(), sanctioned > 0 ? sanctioned : Infinity);
    let mode = "rooftop";
    let pvKwp = pvKwpIdeal;
    if (pvKwpIdeal > rooftopLimit) {
      if (a.openAccessOk) {
        mode = "openaccess";
      } else {
        pvKwp = Math.floor(Number.isFinite(rooftopLimit) ? rooftopLimit : 0);
      }
    }
    return { pvKwp, pvKwpIdeal, bessPowKw, bessKwh, mode, exchange: b.exchange && a.exchangeOk, peakKw, sanctioned };
  }

  function buildPlanSolution(bucketKey) {
    const t = planTargets(bucketKey);
    const sol = blankState().solution;
    sol.plan = bucketKey;
    sol.appetite = { ...state.solution.appetite };
    sol.prefs = { ...state.solution.prefs };
    sol.pv.specificYield = state.solution.pv.specificYield || "4.2";

    if (t.pvKwp >= 50) {
      sol.pv.enabled = true;
      sol.pv.mode = t.mode;
      sol.pv.lcoeInr = t.mode === "rooftop" ? "3.8" : String(OPEN_ACCESS_SOLAR_INR);
      const module = preferredProducts("pv_module").sort((a, b) => b.specs.powerWp - a.specs.powerWp)[0] || null;
      if (module) {
        sol.pv.moduleId = String(module.id);
        sol.pv.moduleQty = String(Math.max(1, Math.round((t.pvKwp * 1000) / module.specs.powerWp)));
      }
      const targetAcKw = t.pvKwp / 1.25;
      const inverters = preferredProducts("pv_inverter");
      const ci = inverters.filter((p) => p.categoryName.includes("C&I"));
      const utility = inverters.filter((p) => !p.categoryName.includes("C&I"));
      const pool = t.mode === "rooftop" ? (ci.length ? ci : inverters) : (utility.length ? utility : inverters);
      const inverter = pickUnit(pool, (p) => p.specs.acKw, targetAcKw);
      if (inverter) {
        sol.pv.inverterId = String(inverter.id);
        sol.pv.inverterQty = String(Math.max(1, Math.round(targetAcKw / inverter.specs.acKw)));
      }
      if (t.mode === "openaccess" && inverter) {
        const acTotal = inverter.specs.acKw * num(sol.pv.inverterQty, 1);
        const mvs = [...preferredProducts("mv_station")].sort((a, b) => a.specs.kva - b.specs.kva);
        const mv = mvs.find((p) => p.specs.kva >= acTotal) || mvs[mvs.length - 1] || null;
        if (mv) {
          sol.pv.mvStationId = String(mv.id);
          sol.pv.mvStationQty = String(Math.max(1, Math.ceil(acTotal / mv.specs.kva)));
        }
      }
    } else {
      sol.pv.enabled = false;
    }

    if (t.bessKwh >= 100) {
      sol.bess.enabled = true;
      const batteries = preferredProducts("battery");
      const containers = batteries.filter((p) => p.categoryName.includes("Container"));
      const cabinets = batteries.filter((p) => !p.categoryName.includes("Container"));
      const pool = t.bessKwh >= 3000 ? (containers.length ? containers : batteries) : (cabinets.length ? cabinets : batteries);
      const battery = pickUnit(pool, (p) => p.specs.energyKwh, t.bessKwh);
      if (battery) {
        const qty = Math.max(1, Math.round(t.bessKwh / battery.specs.energyKwh));
        sol.bess.batteryId = String(battery.id);
        sol.bess.batteryQty = String(qty);
        const acCoupled = String(battery.specs.coupling || "").toUpperCase() === "AC";
        if (!acCoupled) {
          const batPowKw = battery.specs.powerKw * qty;
          const pcsList = preferredProducts("pcs");
          const stringPcs = pcsList.filter((p) => p.categoryName.includes("String"));
          const pcsPool = batPowKw <= 1000 && stringPcs.length ? stringPcs : pcsList;
          const pcs = pickUnit(pcsPool, (p) => p.specs.powerKw, batPowKw);
          if (pcs) {
            sol.bess.pcsId = String(pcs.id);
            sol.bess.pcsQty = String(Math.max(1, Math.ceil(batPowKw / pcs.specs.powerKw)));
          }
        }
      }
    } else {
      sol.bess.enabled = false;
    }

    sol.exchange.enabled = t.exchange;
    if (t.exchange) {
      sol.exchange.maxKw = String(t.sanctioned || Math.round(t.peakKw));
    }
    return sol;
  }

  function withSolution(solution, fn) {
    const prev = state.solution;
    state.solution = solution;
    try {
      return fn();
    } finally {
      state.solution = prev;
    }
  }

  function planSummary(bucketKey) {
    const solution = buildPlanSolution(bucketKey);
    return withSolution(solution, () => {
      const metrics = solutionMetrics();
      const sim = simulate();
      return { solution, metrics, sim };
    });
  }

  function applyPlan(bucketKey) {
    state.solution = buildPlanSolution(bucketKey);
  }

  // ---------------- Step: design ----------------
  function productSelect(id, role, selectedId) {
    const list = productsByRole(role);
    const groups = {};
    list.forEach((p) => {
      (groups[p.categoryName] = groups[p.categoryName] || []).push(p);
    });
    const options = Object.entries(groups)
      .map(
        ([cat, prods]) =>
          `<optgroup label="${escapeHtml(cat)}">${prods
            .map((p) => `<option value="${p.id}" ${Number(selectedId) === p.id ? "selected" : ""}>${escapeHtml(productShortLabel(p))}</option>`)
            .join("")}</optgroup>`
      )
      .join("");
    return `<select id="${id}"><option value="">Select product</option>${options}</select>`;
  }

  function checkListHtml(checks) {
    if (!checks.length) return '<p class="hint">Pick products to see compatibility results.</p>';
    return `<ul class="check-list">${checks
      .map((c) => `<li class="${c.level === "warn" ? "check-warn" : "check-ok"}"><span>${c.level === "warn" ? "⚠" : "✓"}</span><span>${escapeHtml(c.text)}</span></li>`)
      .join("")}</ul>`;
  }

  function renderDesign() {
    if (!catalog.loaded) {
      el.view.innerHTML = `<div class="card"><h3>New Solution</h3><p class="hint">${
        catalog.error ? escapeHtml(catalog.error) : "Loading product catalog…"
      }</p>${catalog.error ? '<div class="btn-row" style="margin-top:.6rem"><button id="retryCatalog" class="btn">Retry</button></div>' : ""}</div>`;
      const retry = document.getElementById("retryCatalog");
      if (retry) retry.addEventListener("click", loadCatalog);
      return;
    }

    if (!state.solution.plan && !state.solution.pv.moduleId && !state.solution.bess.batteryId) {
      applyPlan("balanced");
    }
    const sol = state.solution;
    const { metrics, checks } = validateSolution();
    const sim = simulate();
    const bom = solutionBom();
    const selectedBattery = productById(sol.bess.batteryId);
    const batteryIsAc = selectedBattery ? String(selectedBattery.specs.coupling || "").toUpperCase() === "AC" : false;
    const plans = {};
    PLAN_ORDER.forEach((k) => (plans[k] = planSummary(k)));
    const prefRolesAvailable = PREF_ROLES.filter((r) => brandsForRole(r.role).length > 0);
    const app = sol.appetite;
    const recommended = (() => {
      const t = planTargets("max");
      return { kwp: t.pvKwpIdeal, sqm: t.pvKwpIdeal * ROOFTOP_SQM_PER_KWP };
    })();

    const planCardHtml = (key) => {
      const p = plans[key];
      const pv = p.metrics.pv;
      const bess = p.metrics.bess;
      const t = planTargets(key);
      const bits = [];
      if (pv && pv.dcKwp) {
        const suffix = p.solution.pv.mode === "openaccess" ? " (open access)" : t.pvKwp < t.pvKwpIdeal ? " (sized to your roof)" : "";
        bits.push(`Solar ${fmt(pv.dcKwp, 0)} kWp${suffix}`);
      }
      if (bess && bess.energyKwh) bits.push(`BESS ${fmt(bess.energyKwh / 1000, 2)} MWh`);
      if (p.solution.exchange.enabled) bits.push("Exchange power");
      if (!bits.length) bits.push("No new equipment fits this profile");
      return `
        <button type="button" class="plan-card ${sol.plan === key ? "selected" : ""}" data-plan="${key}">
          <div class="plan-head">
            <span class="plan-name">${PLAN_BUCKETS[key].label}</span>
            ${sol.plan === key ? '<span class="plan-check">✓ Selected</span>' : ""}
          </div>
          <p class="plan-tagline">${PLAN_BUCKETS[key].tagline}</p>
          <div class="plan-sizes">${bits.map((b) => `<span class="tag">${escapeHtml(b)}</span>`).join("")}</div>
          <div class="plan-save">
            <strong>${fmtInr(p.sim.savingsDay)}</strong>/day saved
            <span class="plan-pct">${fmt(p.sim.savingsPct, 0)}% lower cost</span>
          </div>
        </button>`;
    };

    el.view.innerHTML = `
      <div class="grid">
        <div class="col-12 card" style="background:linear-gradient(140deg,#f4fbf6,#eef7ff);border-color:#cde4d6">
          <div class="stat-grid">
            <div class="stat hero"><div class="k">Estimated savings</div><div class="v">${fmtInr(sim.savingsDay)}<small>/day</small></div></div>
            <div class="stat hero"><div class="k">Annualised</div><div class="v">${fmtInr(sim.savingsYear / 1e5, 1)}<small>lakh/yr</small></div></div>
            <div class="stat"><div class="k">Cost reduction</div><div class="v">${fmt(sim.savingsPct, 1)}<small>%</small></div></div>
            <div class="stat"><div class="k">Renewable share</div><div class="v">${fmt(sim.renewableShare, 0)}<small>%</small></div></div>
          </div>
          <div class="hint">Live estimate for your ${sol.plan === "custom" ? "custom configuration" : `<strong>${PLAN_BUCKETS[sol.plan] ? PLAN_BUCKETS[sol.plan].label : "selected"}</strong> plan`}. Full dispatch picture on the next step.</div>
        </div>

        <div class="col-12 card">
          <h3>1 · What are you open to?</h3>
          <p class="sub">Your answers shape the recommendations below — we only suggest what you can actually build.</p>
          <div class="grid">
            <div class="col-12">
              <label>Rooftop solar space</label>
              <div class="field-hint" style="margin-bottom:.45rem">Fully covering your daytime demand needs ~<strong>${fmt(recommended.kwp, 0)} kWp</strong> of solar — about <strong>${fmt(recommended.sqm, 0)} m²</strong> (${fmt(recommended.sqm * 10.76, 0)} sq ft) of shadow-free roof. Is that available?</div>
              <div class="seg" id="roofSeg">
                <button type="button" class="${app.roofAvail === "yes" ? "active" : ""}" data-roof="yes">Yes, available</button>
                <button type="button" class="${app.roofAvail === "limited" ? "active" : ""}" data-roof="limited">Only some space</button>
                <button type="button" class="${app.roofAvail === "none" ? "active" : ""}" data-roof="none">No roof space</button>
              </div>
            </div>
            ${
              app.roofAvail === "limited"
                ? `<div class="col-3"><label>Available roof area (m²)</label><input id="roofAreaSqm" type="number" min="0" step="10" value="${app.roofAreaSqm}" />
                    <div class="field-hint">≈ ${fmt(num(app.roofAreaSqm) / ROOFTOP_SQM_PER_KWP, 0)} kWp of rooftop solar</div></div>`
                : ""
            }
            ${
              app.roofAvail !== "yes"
                ? `<div class="col-12"><label>Not enough roof — go offsite?</label>
                    <div class="chip-row"><button type="button" class="chip ${app.openAccessOk ? "on" : ""}" data-appetite="openAccessOk">Open to open-access solar — offsite plant, ~₹${fmt(OPEN_ACCESS_SOLAR_INR, 1)}/kWh landed</button></div></div>`
                : ""
            }
            <div class="col-12"><label>Power exchange (IEX)</label>
              <div class="chip-row"><button type="button" class="chip ${app.exchangeOk ? "on" : ""}" data-appetite="exchangeOk">Open to exchange-traded power — historically ~₹${fmt(Math.min(...IEX_MARKET_TOD) + OA_CHARGES_INR, 1)}/kWh landed midday, ~₹${fmt(Math.max(...IEX_MARKET_TOD) + OA_CHARGES_INR, 1)}/kWh evening peak</button></div></div>
          </div>
        </div>

        <div class="col-12 card">
          <h3>2 · Pick the outcome you want</h3>
          <p class="sub">We sized each option from your demand profile and what you're open to — solar, battery, and exchange power are pre-selected for you.</p>
          <div class="plan-row">${PLAN_ORDER.map(planCardHtml).join("")}</div>
        </div>

        <div class="col-12 card">
          <h3>3 · Brand preferences <span class="tag" style="margin-left:.4rem">optional</span></h3>
          <p class="sub">Prefer a manufacturer? We will use their products in the suggested configuration where available.</p>
          <div class="grid">
            ${prefRolesAvailable
              .map((r) => {
                const brands = brandsForRole(r.role);
                return `<div class="col-3"><label>${r.label}</label>
                  <select data-pref="${r.role}">
                    <option value="">No preference (best fit)</option>
                    ${brands.map((b) => `<option value="${escapeHtml(b)}" ${sol.prefs[r.role] === b ? "selected" : ""}>${escapeHtml(b)}</option>`).join("")}
                  </select></div>`;
              })
              .join("")}
          </div>
        </div>

        <div class="col-12 card">
          <h3>4 · Your ${sol.plan === "custom" ? "custom" : "suggested"} configuration</h3>
          ${
            bom.length
              ? `<table class="bom-table"><thead><tr><th>Item</th><th>Qty</th><th>Spec</th></tr></thead><tbody>
                ${bom.map((r) => `<tr><td>${escapeHtml(r.manufacturer)} ${escapeHtml(r.model)}</td><td>${r.qty}</td><td>${escapeHtml(r.note)}</td></tr>`).join("")}
              </tbody></table>`
              : '<p class="hint">No equipment selected — pick an outcome above or fine-tune below.</p>'
          }
          <div class="tag-row">
            ${metrics.pv ? `<span class="tag accent">Solar DC ${fmt(metrics.pv.dcKwp, 0)} kWp</span><span class="tag accent">AC ${fmt(metrics.pv.acKw, 0)} kW</span><span class="tag">DC/AC ${fmt(metrics.pv.ratio, 2)}</span><span class="tag">~${fmt(metrics.pv.dailyGenKwh, 0)} kWh/day</span>` : ""}
            ${metrics.bess ? `<span class="tag accent">BESS ${fmt(metrics.bess.energyKwh !== null ? metrics.bess.energyKwh / 1000 : null, 2)} MWh / ${fmt(metrics.bess.powerKw !== null ? metrics.bess.powerKw / 1000 : null, 2)} MW</span>` : ""}
            ${metrics.exchange ? `<span class="tag accent">Exchange up to ${fmt(metrics.exchange.maxKw, 0)} kW @ ₹${fmt(metrics.exchange.minInr, 1)}–${fmt(metrics.exchange.maxInr, 1)}/kWh (IEX ToD)</span>` : ""}
          </div>
          <details class="adv" id="advTune" ${sol.plan === "custom" ? "open" : ""}>
            <summary>Fine-tune products &amp; quantities (advanced)</summary>
            <div class="adv-body">
        <div class="adv-block">
          <h3><label class="inline-check"><input type="checkbox" id="pvEnabled" ${sol.pv.enabled ? "checked" : ""} /> Solar PV</label></h3>
          <div class="${sol.pv.enabled ? "" : "hidden"}">
            <div class="chart-toolbar" style="margin-bottom:.8rem">
              <div class="seg" id="pvModeSeg">
                <button type="button" class="${sol.pv.mode === "rooftop" ? "active" : ""}" data-mode="rooftop">Rooftop / Onsite</button>
                <button type="button" class="${sol.pv.mode === "openaccess" ? "active" : ""}" data-mode="openaccess">Open Access (offsite)</button>
              </div>
            </div>
            <div class="grid">
              <div class="col-8"><label>PV module</label>${productSelect("pvModule", "pv_module", sol.pv.moduleId)}</div>
              <div class="col-4"><label>Module quantity</label><input id="pvModuleQty" type="number" min="0" value="${sol.pv.moduleQty}" /></div>
              <div class="col-8"><label>Inverter</label>${productSelect("pvInverter", "pv_inverter", sol.pv.inverterId)}</div>
              <div class="col-4"><label>Inverter quantity</label><input id="pvInverterQty" type="number" min="0" value="${sol.pv.inverterQty}" /></div>
              ${
                sol.pv.mode === "openaccess"
                  ? `<div class="col-8"><label>MV transformer station (optional)</label>${productSelect("pvMv", "mv_station", sol.pv.mvStationId)}</div>
                     <div class="col-4"><label>MV station quantity</label><input id="pvMvQty" type="number" min="0" value="${sol.pv.mvStationQty}" /></div>`
                  : ""
              }
              <div class="col-4"><label>Specific yield (kWh/kWp/day)</label><input id="pvYield" type="number" step="0.1" value="${sol.pv.specificYield}" /></div>
              <div class="col-4"><label>Solar energy cost (₹/kWh)</label><input id="pvLcoe" type="number" step="0.1" value="${sol.pv.lcoeInr}" />
                <div class="field-hint">${sol.pv.mode === "rooftop" ? "Typical rooftop LCOE/PPA: ₹3.5–4.5" : "Typical open access landed cost: ₹4.0–5.5 incl. charges"}</div></div>
            </div>
            ${
              metrics.pv
                ? `<div class="tag-row">
              <span class="tag accent">DC ${fmt(metrics.pv.dcKwp, 1)} kWp</span>
              <span class="tag accent">AC ${fmt(metrics.pv.acKw, 0)} kW</span>
              <span class="tag">DC/AC ${fmt(metrics.pv.ratio, 2)}</span>
              ${sol.pv.mode === "rooftop" ? `<span class="tag">~${fmt(metrics.pv.areaSqm, 0)} m² roof</span>` : `<span class="tag">~${fmt(metrics.pv.areaAcres, 1)} acres</span>`}
              <span class="tag">~${fmt(metrics.pv.dailyGenKwh, 0)} kWh/day</span>
            </div>`
                : ""
            }
          </div>
        </div>

        <div class="adv-block">
          <h3><label class="inline-check"><input type="checkbox" id="bessEnabled" ${sol.bess.enabled ? "checked" : ""} /> Battery Storage (BESS)</label></h3>
          <div class="${sol.bess.enabled ? "" : "hidden"}">
            <div class="grid">
              <div class="col-8"><label>Battery product</label>${productSelect("bessBattery", "battery", sol.bess.batteryId)}</div>
              <div class="col-4"><label>Battery quantity</label><input id="bessBatteryQty" type="number" min="0" value="${sol.bess.batteryQty}" /></div>
              <div class="col-8 ${batteryIsAc ? "hidden" : ""}"><label>PCS (power conversion)</label>${productSelect("bessPcs", "pcs", sol.bess.pcsId)}</div>
              <div class="col-4 ${batteryIsAc ? "hidden" : ""}"><label>PCS quantity</label><input id="bessPcsQty" type="number" min="0" value="${sol.bess.pcsQty}" /></div>
            </div>
            ${batteryIsAc ? '<p class="hint">This battery is AC-coupled with integrated PCS — no separate PCS needed.</p>' : ""}
            ${
              metrics.bess
                ? `<div class="tag-row">
              <span class="tag accent">${fmt(metrics.bess.energyKwh !== null ? metrics.bess.energyKwh / 1000 : null, 2)} MWh</span>
              <span class="tag accent">${fmt(metrics.bess.powerKw !== null ? metrics.bess.powerKw / 1000 : null, 2)} MW</span>
              <span class="tag">${fmt(metrics.bess.durationH, 2)} h duration</span>
            </div>`
                : ""
            }
          </div>
        </div>

        <div class="adv-block">
          <h3><label class="inline-check"><input type="checkbox" id="exEnabled" ${sol.exchange.enabled ? "checked" : ""} /> Exchange / Open Access Power</label></h3>
          <div class="${sol.exchange.enabled ? "" : "hidden"}">
            <p class="sub">Buys from the exchange (IEX) only in the hours where it beats your grid tariff, using typical day-ahead price patterns.</p>
            <div class="tag-row" style="margin:.2rem 0 .7rem">
              <span class="tag">Midday ~₹${fmt(IEX_MARKET_TOD[12] + OA_CHARGES_INR, 1)}/kWh</span>
              <span class="tag">Night ~₹${fmt(IEX_MARKET_TOD[2] + OA_CHARGES_INR, 1)}/kWh</span>
              <span class="tag">Evening peak ~₹${fmt(IEX_MARKET_TOD[19] + OA_CHARGES_INR, 1)}/kWh</span>
              <span class="tag">incl. ₹${fmt(OA_CHARGES_INR, 1)}/kWh open-access charges</span>
            </div>
            <div class="grid">
              <div class="col-4"><label>Max drawal (kW)</label><input id="exMaxKw" type="number" min="0" placeholder="${num(state.site.sanctionedKw) || ""}" value="${sol.exchange.maxKw}" /></div>
            </div>
          </div>
        </div>
            </div>
          </details>
        </div>

        <div class="col-12 card">
          <h3>Compatibility & sizing checks</h3>
          ${checkListHtml(checks)}
        </div>
      </div>`;

    const adv = document.getElementById("advTune");
    if (adv) {
      adv.open = sol.plan === "custom" || advOpen;
      adv.addEventListener("toggle", () => (advOpen = adv.open));
    }

    // Appetite answers re-size the suggested plans
    const reapplyPlan = () => {
      if (sol.plan && sol.plan !== "custom") applyPlan(sol.plan);
      renderDesign();
    };
    el.view.querySelectorAll("#roofSeg [data-roof]").forEach((btn) =>
      btn.addEventListener("click", () => {
        app.roofAvail = btn.dataset.roof;
        reapplyPlan();
      })
    );
    const roofArea = document.getElementById("roofAreaSqm");
    if (roofArea) roofArea.addEventListener("change", () => {
      app.roofAreaSqm = roofArea.value;
      reapplyPlan();
    });
    el.view.querySelectorAll("[data-appetite]").forEach((chip) =>
      chip.addEventListener("click", () => {
        app[chip.dataset.appetite] = !app[chip.dataset.appetite];
        reapplyPlan();
      })
    );

    el.view.querySelectorAll("[data-plan]").forEach((cardBtn) =>
      cardBtn.addEventListener("click", () => {
        applyPlan(cardBtn.dataset.plan);
        renderDesign();
      })
    );

    el.view.querySelectorAll("[data-pref]").forEach((sel) =>
      sel.addEventListener("change", () => {
        sol.prefs[sel.dataset.pref] = sel.value;
        // re-pick products for the selected bucket with the new brand constraint
        if (sol.plan && sol.plan !== "custom") applyPlan(sol.plan);
        renderDesign();
      })
    );

    const markCustom = () => {
      sol.plan = "custom";
    };

    bindCheck("pvEnabled", (v) => {
      sol.pv.enabled = v;
      markCustom();
      renderDesign();
    });
    bindCheck("bessEnabled", (v) => {
      sol.bess.enabled = v;
      markCustom();
      renderDesign();
    });
    bindCheck("exEnabled", (v) => {
      sol.exchange.enabled = v;
      if (v && !sol.exchange.maxKw) sol.exchange.maxKw = state.site.sanctionedKw;
      markCustom();
      renderDesign();
    });

    el.view.querySelectorAll("#pvModeSeg [data-mode]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const prevDefault = sol.pv.mode === "rooftop" ? "3.8" : "4.5";
        sol.pv.mode = btn.dataset.mode;
        if (sol.pv.lcoeInr === prevDefault) sol.pv.lcoeInr = sol.pv.mode === "rooftop" ? "3.8" : "4.5";
        markCustom();
        renderDesign();
      })
    );

    const rerenderOn = (id, setter, makesCustom = true) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener(node.tagName === "SELECT" ? "change" : "input", () => {
        setter(node.value);
        if (makesCustom) markCustom();
        renderDesign();
      });
    };
    rerenderOn("pvModule", (v) => (sol.pv.moduleId = v));
    rerenderOn("pvModuleQty", (v) => (sol.pv.moduleQty = v));
    rerenderOn("pvInverter", (v) => (sol.pv.inverterId = v));
    rerenderOn("pvInverterQty", (v) => (sol.pv.inverterQty = v));
    rerenderOn("pvMv", (v) => (sol.pv.mvStationId = v));
    rerenderOn("pvMvQty", (v) => (sol.pv.mvStationQty = v));
    rerenderOn("pvYield", (v) => (sol.pv.specificYield = v), false);
    rerenderOn("pvLcoe", (v) => (sol.pv.lcoeInr = v), false);
    rerenderOn("bessBattery", (v) => (sol.bess.batteryId = v));
    rerenderOn("bessBatteryQty", (v) => (sol.bess.batteryQty = v));
    rerenderOn("bessPcs", (v) => (sol.bess.pcsId = v));
    rerenderOn("bessPcsQty", (v) => (sol.bess.pcsQty = v));
    rerenderOn("exMaxKw", (v) => (sol.exchange.maxKw = v), false);
  }

  // ---------------- Step: results ----------------
  function renderResults() {
    const sim = simulate();
    const ls = loadStats();
    const bom = solutionBom();
    const { checks } = validateSolution();
    const warns = checks.filter((c) => c.level === "warn");

    el.view.innerHTML = `
      <div class="grid">
        <div class="col-12 card" style="background:linear-gradient(140deg,#f0faf3,#eef5ff);border-color:#cbe5d4">
          <div class="stat-grid">
            <div class="stat hero"><div class="k">You save</div><div class="v">${fmtInr(sim.savingsDay)}<small>/day</small></div></div>
            <div class="stat hero"><div class="k">Per year</div><div class="v">${fmtInr(sim.savingsYear / 1e7, 2)}<small>crore</small></div></div>
            <div class="stat"><div class="k">Cost reduction</div><div class="v">${fmt(sim.savingsPct, 1)}<small>%</small></div></div>
            <div class="stat"><div class="k">Blended rate</div><div class="v">${fmt(ls.blended, 2)} → ${fmt(sim.blendedAfter, 2)}<small>₹/kWh</small></div></div>
            <div class="stat"><div class="k">Diesel energy</div><div class="v">${fmt(sim.dgBeforeKwh, 0)} → ${fmt(sim.dgAfterKwh, 0)}<small>kWh/day</small></div></div>
            <div class="stat"><div class="k">Renewable share</div><div class="v">${fmt(sim.renewableShare, 0)}<small>%</small></div></div>
          </div>
        </div>

        <div class="col-12 chart-panel">
          <h3 style="margin:.1rem 0 .6rem;font-size:.95rem">Today — how your demand is served</h3>
          <canvas id="beforeCanvas" width="1080" height="360"></canvas>
          <div class="legend">${SOURCE_ORDER.filter((k) => state.mix.enabled[k])
            .map((k) => `<span class="li"><span class="swatch" style="background:${SOURCES[k].color}"></span>${SOURCES[k].label}</span>`)
            .join("")}</div>
        </div>

        <div class="col-12 chart-panel">
          <h3 style="margin:.1rem 0 .6rem;font-size:.95rem">With your new solution — same demand, new mix</h3>
          <canvas id="afterCanvas" width="1080" height="360"></canvas>
          <div class="legend">${afterSeriesList(sim)
            .map((s) => `<span class="li"><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`)
            .join("")}</div>
        </div>

        <div class="col-6 card">
          <h3>Bill of materials</h3>
          ${
            bom.length
              ? `<table class="bom-table"><thead><tr><th>Item</th><th>Qty</th><th>Spec</th></tr></thead><tbody>
                ${bom.map((r) => `<tr><td>${escapeHtml(r.manufacturer)} ${escapeHtml(r.model)}</td><td>${r.qty}</td><td>${escapeHtml(r.note)}</td></tr>`).join("")}
              </tbody></table>`
              : '<p class="hint">No products selected yet — go back to New Solution.</p>'
          }
          <div class="tag-row"><span class="tag ${warns.length ? "" : "good"}">${warns.length ? `${warns.length} warning(s) — see New Solution step` : "All compatibility checks passed"}</span></div>
        </div>

        <div class="col-6 card">
          <h3>How we calculated this</h3>
          <ul class="check-list">${sim.assumptions.map((a) => `<li class="check-ok"><span>•</span><span>${escapeHtml(a)}</span></li>`).join("")}</ul>
        </div>
      </div>`;

    const axisMax = getAxisMax();
    drawStack(document.getElementById("beforeCanvas"), mixSeriesList(), { axisMax });
    drawStack(document.getElementById("afterCanvas"), afterSeriesList(sim), { axisMax });
  }

  // ---------------- Step: details ----------------
  function renderDetails() {
    const c = state.contact;
    const sim = simulate();
    el.view.innerHTML = `
      <div class="grid">
        <div class="col-12 card" style="background:var(--brand-soft);border-color:#bdd2fb">
          <h3>Your solution is ready</h3>
          <p class="sub" style="margin-bottom:0">Estimated savings of <strong>${fmtInr(sim.savingsDay)}/day</strong> (${fmt(sim.savingsPct, 1)}% reduction). Add your details to generate the full PDF report.</p>
        </div>
        <div class="col-12 card">
          <h3>Company & contact</h3>
          <div class="grid">
            <div class="col-6"><label>Company name</label><input id="companyName" value="${escapeHtml(c.companyName)}" /></div>
            <div class="col-6"><label>Your name</label><input id="personName" value="${escapeHtml(c.personName)}" /></div>
            <div class="col-6"><label>Role (optional)</label><input id="personRole" value="${escapeHtml(c.personRole)}" /></div>
            <div class="col-6"><label>Phone</label><input id="personPhone" placeholder="10-digit mobile" value="${escapeHtml(c.personPhone)}" /></div>
            <div class="col-6"><label>Email</label><input id="personEmail" value="${escapeHtml(c.personEmail)}" /></div>
          </div>
        </div>
        <div class="col-12 card">
          <label class="check"><input id="consent" type="checkbox" ${state.consent ? "checked" : ""} /> I confirm the details are accurate and agree to be contacted about this solution.</label>
        </div>
      </div>`;

    bindInput("companyName", (v) => (c.companyName = v));
    bindInput("personName", (v) => (c.personName = v));
    bindInput("personRole", (v) => (c.personRole = v));
    bindInput("personPhone", (v) => (c.personPhone = v));
    bindInput("personEmail", (v) => (c.personEmail = v));
    bindCheck("consent", (v) => (state.consent = v));
  }

  // ---------------- Shell ----------------
  function renderStepper() {
    el.stepper.innerHTML = steps
      .map(
        (s, i) => `
      <li><button class="${i === current ? "active" : ""} ${i < current ? "done" : ""}" data-step="${i}">
        <span class="dot">${i < current ? "✓" : i + 1}</span>${s.title}</button></li>`
      )
      .join("");
    el.stepper.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        const target = Number(btn.dataset.step);
        if (target <= current || validateCurrent()) {
          current = target;
          render();
        }
      })
    );
  }

  function render() {
    renderStepper();
    const active = steps[current];
    el.stepTitle.textContent = active.title;
    el.stepDescription.textContent = active.desc;
    el.actionNote.textContent = `Step ${current + 1} of ${steps.length}`;
    el.prevBtn.disabled = current === 0;
    el.nextBtn.classList.toggle("hidden", current === steps.length - 1);
    el.submitBtn.classList.toggle("hidden", current !== steps.length - 1);

    if (active.id === "site") renderSite();
    if (active.id === "mix") renderMix();
    if (active.id === "design") renderDesign();
    if (active.id === "results") renderResults();
    if (active.id === "details") renderDetails();
    persistDraft();
  }

  function validateCurrent() {
    const id = steps[current].id;
    if (id === "site") {
      const s = state.site;
      if (!s.siteName) return toast("Give your site a name"), false;
      if (!s.premisesType) return toast("Pick the type of premises"), false;
      if (!s.state || !s.district) return toast("Select state and district"), false;
      if (num(s.sanctionedKw) <= 0) return toast("Enter your sanctioned load in kW"), false;
    }
    if (id === "mix") {
      if (!totalHourly().some((v) => v > 0)) return toast("Set your hourly demand — it cannot be all zero"), false;
    }
    if (id === "design" && catalog.loaded) {
      const anyBlock = solutionBom().length > 0 || state.solution.exchange.enabled;
      if (!anyBlock) return toast("Configure at least one block — solar, BESS, or exchange"), false;
    }
    if (id === "details") {
      const c = state.contact;
      if (!c.companyName) return toast("Company name is required"), false;
      if (!c.personName) return toast("Your name is required"), false;
      if (!/^\+?[0-9]{10,15}$/.test(c.personPhone || "")) return toast("Enter a valid phone number"), false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.personEmail || "")) return toast("Enter a valid email"), false;
      if (!state.consent) return toast("Please confirm consent"), false;
    }
    return true;
  }

  // ---------------- Payload + PDF ----------------
  function buildPayload() {
    const { metrics, checks } = validateSolution();
    const sim = simulate();
    return {
      site: state.site,
      mix: { ...state.mix, derived: { solar: existingSolarHourly(), grid: gridHourly() } },
      solution: {
        ...state.solution,
        bom: solutionBom(),
        totals: {
          pv: metrics.pv ? { dcKwp: metrics.pv.dcKwp, acKw: metrics.pv.acKw, ratio: metrics.pv.ratio, areaAcres: metrics.pv.areaAcres, dailyGenKwh: metrics.pv.dailyGenKwh } : null,
          bess: metrics.bess ? { energyKwh: metrics.bess.energyKwh, powerKw: metrics.bess.powerKw, durationH: metrics.bess.durationH, acCoupled: metrics.bess.acCoupled } : null,
          exchange: metrics.exchange
        },
        checks
      },
      savings: {
        costBeforeDay: sim.costBefore,
        costAfterDay: sim.costAfter,
        savingsDay: sim.savingsDay,
        savingsYear: sim.savingsYear,
        savingsPct: sim.savingsPct,
        renewableSharePct: sim.renewableShare,
        dgBeforeKwh: sim.dgBeforeKwh,
        dgAfterKwh: sim.dgAfterKwh,
        dispatch: sim.serve
      },
      contact: state.contact,
      profile: { companyName: state.contact.companyName, siteName: state.site.siteName },
      consent: state.consent,
      submissionMeta: { submittedAt: new Date().toISOString(), appVersion: "4.0.0", country: "India" }
    };
  }

  function chartImage(seriesList, opts) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 420;
    drawStack(canvas, seriesList, { ...opts, fillWhite: true, legend: true });
    return canvas.toDataURL("image/png");
  }

  function generatePdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const margin = 14;
    const usable = W - margin * 2;
    let y = 0;

    const BRAND = [37, 99, 235];
    const DARK = [15, 31, 56];
    const MUTED = [93, 111, 138];
    const WARN = [217, 119, 6];
    const OK = [22, 163, 74];

    const sim = simulate();
    const ls = loadStats();
    const { metrics, checks } = validateSolution();
    const bom = solutionBom();

    const newPage = () => {
      doc.addPage();
      y = margin;
    };
    const ensure = (needed) => {
      if (y + needed > 283) newPage();
    };

    const sectionTitle = (text) => {
      ensure(16);
      doc.setFillColor(...BRAND);
      doc.rect(margin, y, 2.4, 7, "F");
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.text(text, margin + 5, y + 5.4);
      y += 11;
    };

    const kvRows = (pairs, cols = 2) => {
      const colW = usable / cols;
      doc.setFontSize(9.5);
      for (let i = 0; i < pairs.length; i += cols) {
        ensure(12);
        for (let c = 0; c < cols && i + c < pairs.length; c += 1) {
          const [k, v] = pairs[i + c];
          const x = margin + c * colW;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MUTED);
          doc.text(String(k), x, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...DARK);
          doc.text(String(v || "—"), x, y + 4.6, { maxWidth: colW - 6 });
        }
        y += 11.5;
      }
      y += 1;
    };

    const table = (headers, rows, widths) => {
      const rowH = 7;
      ensure(rowH + 4);
      doc.setFillColor(232, 239, 255);
      doc.rect(margin, y, usable, rowH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...DARK);
      let x = margin + 2;
      headers.forEach((hdr, i) => {
        doc.text(hdr, x, y + 4.8);
        x += widths[i];
      });
      y += rowH;
      doc.setFont("helvetica", "normal");
      rows.forEach((row, ri) => {
        const cellLines = row.map((cell, i) => doc.splitTextToSize(String(cell ?? ""), widths[i] - 4));
        const lines = Math.max(...cellLines.map((cl) => cl.length), 1);
        const h = lines * 4 + 3;
        ensure(h);
        if (ri % 2 === 1) {
          doc.setFillColor(249, 251, 255);
          doc.rect(margin, y, usable, h, "F");
        }
        let cx = margin + 2;
        cellLines.forEach((cell, i) => {
          doc.setTextColor(...DARK);
          doc.text(cell, cx, y + 4.4);
          cx += widths[i];
        });
        doc.setDrawColor(226, 232, 244);
        doc.line(margin, y + h, margin + usable, y + h);
        y += h;
      });
      y += 4;
    };

    const inr = (n, d = 0) => "Rs " + (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: d }) : "—");

    // ---- Cover ----
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, W, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Solar + BESS Savings Report", margin, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      `${state.contact.companyName || "—"}  |  ${state.site.siteName || "—"}  |  ${[state.site.district, state.site.state].filter(Boolean).join(", ") || "India"}`,
      margin,
      23
    );
    doc.text(`Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, margin, 29);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(`Estimated savings: ${inr(sim.savingsDay)}/day  (~${inr(sim.savingsYear / 1e5, 1)} lakh/year, ${fmt(sim.savingsPct, 1)}% reduction)`, margin, 36);
    y = 48;

    // ---- Site ----
    sectionTitle("Site");
    kvRows([
      ["Site", state.site.siteName],
      ["Premises", state.site.premisesType === "Other" ? `Other — ${state.site.premisesOther}` : state.site.premisesType],
      ["Location", [state.site.district, state.site.state].filter(Boolean).join(", ")],
      ["Sanctioned load", `${fmt(num(state.site.sanctionedKw), 0)} kW`],
      ["Objectives", state.site.objectives.join(", ") || "—"],
      ["Details", state.site.locationDetails]
    ]);

    // ---- Today's mix ----
    sectionTitle("Today's Power Mix");
    kvRows(
      [
        ["Daily consumption", `${fmt(ls.dailyKwh, 0)} kWh`],
        ["Peak demand", `${fmt(ls.peakKw, 0)} kW`],
        ["Energy cost", `${inr(ls.costDay)}/day`],
        ["Blended rate", `${inr(ls.blended, 2)}/kWh`]
      ],
      4
    );
    table(
      ["Source", "Daily energy (kWh)", "Rate (Rs/kWh)", "Cost/day"],
      SOURCE_ORDER.filter((k) => state.mix.enabled[k]).map((k) => {
        const kwh = sourceHourly(k).reduce((a, b) => a + b, 0);
        return [k === "grid" ? "Grid (remainder)" : SOURCES[k].label, fmt(kwh, 0), fmt(sourceCost(k), 2), inr(kwh * sourceCost(k))];
      }),
      [62, 42, 38, 40]
    );
    const beforeImg = chartImage(mixSeriesList(), { axisMax: getAxisMax() });
    const imgH = usable * (420 / 1080);
    ensure(imgH + 4);
    doc.addImage(beforeImg, "PNG", margin, y, usable, imgH);
    y += imgH + 6;

    if (state.mix.enabled.dg && state.mix.gensets.length) {
      table(
        ["DG rating (kVA)", "Quantity", "Run hours/day"],
        state.mix.gensets.map((g) => [g.ratingKva || "—", g.quantity || "—", g.runHours || "—"]),
        [62, 60, 60]
      );
    }

    // ---- Solution ----
    newPage();
    sectionTitle(
      state.solution.plan && state.solution.plan !== "custom" && PLAN_BUCKETS[state.solution.plan]
        ? `Proposed Solution — ${PLAN_BUCKETS[state.solution.plan].label} plan`
        : "Proposed Solution"
    );
    if (bom.length) {
      table(
        ["Category", "Manufacturer", "Model", "Qty", "Key spec"],
        bom.map((r) => [r.category, r.manufacturer, r.model, String(r.qty), r.note]),
        [42, 32, 56, 14, 38]
      );
    }
    const totalPairs = [];
    if (metrics.pv) {
      totalPairs.push(
        ["PV capacity", metrics.pv.dcKwp !== null ? `${fmt(metrics.pv.dcKwp, 1)} kWp / ${fmt(metrics.pv.acKw, 0)} kW AC` : "—"],
        ["PV mode", state.solution.pv.mode === "rooftop" ? "Rooftop / onsite" : "Open access (offsite)"],
        ["DC/AC ratio", metrics.pv.ratio !== null ? fmt(metrics.pv.ratio, 2) : "—"],
        ["Indicative generation", metrics.pv.dailyGenKwh !== null ? `~${fmt(metrics.pv.dailyGenKwh, 0)} kWh/day` : "—"]
      );
    }
    if (metrics.bess) {
      totalPairs.push(
        ["BESS", metrics.bess.energyKwh !== null ? `${fmt(metrics.bess.energyKwh / 1000, 2)} MWh / ${fmt((metrics.bess.powerKw || 0) / 1000, 2)} MW` : "—"],
        ["Duration", metrics.bess.durationH !== null ? `${fmt(metrics.bess.durationH, 2)} h` : "—"]
      );
    }
    if (metrics.exchange) {
      totalPairs.push(["Exchange power", `up to ${fmt(metrics.exchange.maxKw, 0)} kW @ ${inr(metrics.exchange.minInr, 1)}-${fmt(metrics.exchange.maxInr, 1)}/kWh (IEX ToD)`]);
    }
    if (totalPairs.length) kvRows(totalPairs, 2);

    if (checks.length) {
      sectionTitle("Compatibility & Sizing Checks");
      doc.setFontSize(9);
      checks.forEach((c) => {
        const prefix = c.level === "warn" ? "!" : "OK";
        const lines = doc.splitTextToSize(c.text, usable - 12);
        ensure(lines.length * 4.4 + 3);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(c.level === "warn" ? WARN : OK));
        doc.text(prefix, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        doc.text(lines, margin + 9, y);
        y += lines.length * 4.4 + 2.4;
      });
    }

    // ---- Savings ----
    newPage();
    sectionTitle("Savings & Dispatch");
    kvRows(
      [
        ["Cost today", `${inr(sim.costBefore)}/day`],
        ["Cost with solution", `${inr(sim.costAfter)}/day`],
        ["Savings", `${inr(sim.savingsDay)}/day (${fmt(sim.savingsPct, 1)}%)`],
        ["Annualised savings", `~${inr(sim.savingsYear / 1e5, 1)} lakh/year`],
        ["Blended rate", `${inr(ls.blended, 2)} -> ${inr(sim.blendedAfter, 2)} per kWh`],
        ["Diesel energy", `${fmt(sim.dgBeforeKwh, 0)} -> ${fmt(sim.dgAfterKwh, 0)} kWh/day`],
        ["Renewable share", `${fmt(sim.renewableShare, 0)}%`]
      ],
      2
    );
    const afterImg = chartImage(afterSeriesList(sim), { axisMax: getAxisMax() });
    ensure(imgH + 4);
    doc.addImage(afterImg, "PNG", margin, y, usable, imgH);
    y += imgH + 6;

    sectionTitle("Assumptions");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    sim.assumptions.forEach((a) => {
      const lines = doc.splitTextToSize("- " + a.replaceAll("₹", "Rs "), usable);
      ensure(lines.length * 4.2 + 2);
      doc.setTextColor(...DARK);
      doc.text(lines, margin, y);
      y += lines.length * 4.2 + 1.6;
    });

    // ---- Contact ----
    sectionTitle("Contact");
    kvRows([
      ["Company", state.contact.companyName],
      ["Name", [state.contact.personName, state.contact.personRole].filter(Boolean).join(", ")],
      ["Phone", state.contact.personPhone],
      ["Email", state.contact.personEmail]
    ]);

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Solar + BESS Savings Report — ${state.contact.companyName || state.site.siteName || "Draft"}`, margin, 291.5);
      doc.text(`Page ${i} of ${pages}`, W - margin, 291.5, { align: "right" });
    }

    const safeName = (state.contact.companyName || state.site.siteName || "solution").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`solar-bess-savings-${safeName}-${Date.now()}.pdf`);
  }

  async function submitToServer(payload) {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
  }

  // ---------------- Wiring ----------------
  el.prevBtn.addEventListener("click", () => {
    if (current > 0) current -= 1;
    render();
  });
  el.nextBtn.addEventListener("click", () => {
    if (!validateCurrent()) return;
    current += 1;
    render();
  });
  el.submitBtn.addEventListener("click", async () => {
    if (!validateCurrent()) return;
    persistDraft();
    const payload = buildPayload();
    el.submitBtn.disabled = true;
    try {
      const saved = await submitToServer(payload);
      toast(`Submission #${saved.id} saved. Generating your PDF…`);
    } catch (_) {
      toast("Could not reach the server — generating PDF only.");
    }
    try {
      generatePdf();
    } catch (e) {
      toast("PDF generation failed: " + e.message);
    }
    el.submitBtn.disabled = false;
  });
  el.saveDraftBtn.addEventListener("click", () => {
    persistDraft();
    toast("Draft saved on this device.");
  });
  el.exportBtn.addEventListener("click", () => {
    try {
      generatePdf();
      toast("PDF exported.");
    } catch (e) {
      toast("PDF generation failed: " + e.message);
    }
  });

  window.addEventListener("beforeunload", persistDraft);
  loadCatalog();
  render();
})();
