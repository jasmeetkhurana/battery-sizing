/*
 * Headless end-to-end test of the v4 SPA flow against a running server
 * (node server/index.js must be listening on :3000).
 * Flow: Site -> Today's Power Mix (multi-source chart) -> New Solution ->
 * Savings & Dispatch -> Your Details -> submit + PDF.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const BASE = "http://localhost:3000";
const ROOT = path.join(__dirname, "..");

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
  }
}

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function stubCanvas(window) {
  const fakeGradient = { addColorStop() {} };
  const fakeCtx = {
    clearRect() {},
    createLinearGradient: () => fakeGradient,
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    arc() {},
    roundRect() {},
    closePath() {},
    fillText() {},
    strokeRect() {},
    setLineDash() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    measureText: () => ({ width: 24 })
  };
  window.HTMLCanvasElement.prototype.getContext = () => fakeCtx;
  window.HTMLCanvasElement.prototype.toDataURL = () => TINY_PNG;
}

function fire(window, node, type) {
  node.dispatchEvent(new window.Event(type, { bubbles: true }));
}

function setInput(window, doc, id, value) {
  const node = doc.getElementById(id);
  if (!node) throw new Error(`Missing input #${id}`);
  node.value = value;
  fire(window, node, node.tagName === "SELECT" ? "change" : "input");
  if (node.tagName === "SELECT") fire(window, node, "input");
}

function setOptionByValue(window, node, value) {
  node.value = value;
  fire(window, node, "change");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ping = await fetch(`${BASE}/api/categories`);
  check("server reachable", ping.ok);
  const adminHeaders = { "x-admin-token": "loop-admin" };
  const beforeSubs = (await (await fetch(`${BASE}/api/submissions`, { headers: adminHeaders })).json()).length;

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  const doc = window.document;

  stubCanvas(window);
  window.fetch = (input, init) => fetch(new URL(input, BASE).href, init);

  const { jsPDF } = require("jspdf");
  let savedPdfName = null;
  let pdfPageCount = 0;
  class TestPdf extends jsPDF {
    constructor(...args) {
      super(...args);
      this.save = (name) => {
        savedPdfName = name;
        pdfPageCount = this.getNumberOfPages();
        return this;
      };
    }
  }
  window.jspdf = { jsPDF: TestPdf };

  window.localStorage.clear();
  const appSrc = fs.readFileSync(path.join(ROOT, "assets", "js", "app.js"), "utf8");
  window.eval(appSrc);
  await sleep(300); // allow catalog fetch

  const stepTitle = () => doc.getElementById("stepTitle").textContent;
  const next = () => doc.getElementById("nextBtn").click();
  const statVals = () => Array.from(doc.querySelectorAll(".stat .v")).map((n) => n.textContent);

  // ---- Step 1: Your Site ----
  check("starts on site step", stepTitle() === "Your Site");
  setInput(window, doc, "siteName", "Taloja Plant 2");
  setInput(window, doc, "premisesType", "Industrial");
  setInput(window, doc, "state", "Maharashtra");
  setInput(window, doc, "district", "Pune");
  setInput(window, doc, "sanctionedKw", "300");
  const objChip = doc.querySelector('[data-obj="Reduce electricity cost"]');
  objChip.click();
  check("objective chip toggles on", doc.querySelector('[data-obj="Reduce electricity cost"]').classList.contains("on"));
  next();
  check("advanced to power mix", stepTitle() === "Today's Power Mix");

  // ---- Step 2: Today's Power Mix (total first, then distribute) ----
  // Industrial norm: peak demand ~85% of sanctioned load
  const peakStat = () => Number(statVals()[1].replace(/[^0-9]/g, ""));
  check("seeded peak reflects 300 kW sanctioned (~85%)", peakStat() === 260);
  check("grid tariff prefilled from industrial norm", doc.getElementById("cost_grid").value === "8.5");

  // correcting sanctioned load upstream re-seeds the untouched curve
  doc.getElementById("prevBtn").click();
  setInput(window, doc, "sanctionedKw", "2000");
  next();
  check("curve re-seeds when sanctioned load changes", peakStat() === 1700);
  check("typical profile reset button offered", !!doc.querySelector('[data-preset="typical"]'));

  const totalSeg = doc.querySelector('[data-series="total"]');
  check("total demand is the default edit series", !!totalSeg && totalSeg.classList.contains("active"));

  // set an explicit total demand curve: 1600 kW day, 800 kW night
  const totalCsv = Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 20 ? 1600 : 800)).join(",");
  doc.getElementById("hourlyCsv").value = totalCsv;
  doc.getElementById("applyCsv").click();
  const dailyStat = statVals()[0].replace(/[^0-9]/g, "");
  check("total daily consumption is 29,600 kWh", dailyStat === "29600");

  // existing solar: enter installed capacity, curve is auto-generated
  doc.querySelector('[data-src="solar"]').click();
  check("solar capacity input appears", !!doc.getElementById("solarKwp"));
  setInput(window, doc, "solarKwp", "1000");
  doc.querySelector('[data-series="total"]').click(); // re-render
  check("solar curve auto-generated in legend", Array.from(doc.querySelectorAll(".legend .li")).some((li) => li.textContent.includes("Existing Solar (auto)")));
  check("solar is not a manually editable series", !doc.querySelector('[data-series="solar"]'));
  check("grid shown as remainder", Array.from(doc.querySelectorAll(".legend .li")).some((li) => li.textContent.includes("Grid (remainder)")));

  // shape DG: evening outage hours
  doc.querySelector('[data-src="dg"]').click();
  doc.querySelector('[data-series="dg"]').click();
  const dgCsv = Array.from({ length: 24 }, (_, h) => (h >= 18 && h <= 21 ? 400 : 0)).join(",");
  doc.getElementById("hourlyCsv").value = dgCsv;
  doc.getElementById("applyCsv").click();

  // costs
  setInput(window, doc, "cost_grid", "9");
  setInput(window, doc, "cost_dg", "30");
  setInput(window, doc, "cost_solar", "4");

  const costStat = statVals().find((v) => v.includes("₹"));
  check("baseline daily cost computed", !!costStat && costStat !== "₹0");

  // total stays constant while distributing
  check("total unchanged after distribution", statVals()[0].replace(/[^0-9]/g, "") === "29600");

  // manual source edits are capped by what auto-solar leaves at that hour
  const shapeRaw = Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 18 ? Math.sin((Math.PI * (h - 6)) / 12) : 0));
  const shapeSum = shapeRaw.reduce((a, b) => a + b, 0);
  const solarNoon = Math.round(((1000 * 4.2 * shapeRaw[12]) / shapeSum));
  const expectedDgNoon = Math.floor((1600 - solarNoon) / 10) * 10;
  setInput(window, doc, "selectedKw", "2000"); // tries to set DG at H12 = 2000
  doc.querySelector('[data-series="dg"]').click(); // re-render to read back state
  const dgNoon = Number(doc.getElementById("hourlyCsv").value.split(",")[12]);
  check(`DG edit clamped by auto-solar headroom (${expectedDgNoon} kW)`, dgNoon === expectedDgNoon);
  next();
  check("advanced to new solution", stepTitle() === "New Solution");

  // ---- Step 3: New Solution (outcome buckets + brand prefs) ----
  const planCards = doc.querySelectorAll(".plan-card");
  check("three outcome plans suggested", planCards.length === 3);
  check("balanced plan auto-selected", doc.querySelector('.plan-card[data-plan="balanced"]').classList.contains("selected"));
  check("plan cards show estimated savings", Array.from(planCards).every((c) => c.textContent.includes("₹")));
  check("plan auto-picks products into BOM", doc.querySelectorAll(".bom-table tbody tr").length >= 2);

  doc.querySelector('.plan-card[data-plan="max"]').click();
  check("max savings plan selectable", doc.querySelector('.plan-card[data-plan="max"]').classList.contains("selected"));
  check("max plan enables exchange power", doc.getElementById("exEnabled").checked);

  const prefSelects = doc.querySelectorAll("[data-pref]");
  check("brand preference selectors offered per product type", prefSelects.length >= 4);
  const batPref = doc.querySelector('[data-pref="battery"]');
  setOptionByValue(window, batPref, "Great Power");
  check("brand preference keeps plan selected (re-applies picks)", doc.querySelector('.plan-card[data-plan="max"]').classList.contains("selected"));
  check("preferred brand used in BOM", doc.querySelector(".bom-table").textContent.includes("Great Power"));

  const pvModule = doc.getElementById("pvModule");
  check("catalog loaded into designer", !!pvModule && pvModule.options.length > 1);

  const pickByText = (selectId, match) => {
    const sel = doc.getElementById(selectId);
    const opt = Array.from(sel.options).find((o) => o.textContent.includes(match));
    if (!opt) throw new Error(`Option matching "${match}" not found in #${selectId}`);
    setInput(window, doc, selectId, opt.value);
  };

  // open access mode exposes MV station picker
  doc.querySelector('#pvModeSeg [data-mode="openaccess"]').click();
  check("open access mode shows MV station", !!doc.getElementById("pvMv"));

  pickByText("pvModule", "640 Wp");
  setInput(window, doc, "pvModuleQty", "3200");
  pickByText("pvInverter", "HSHV385K");
  setInput(window, doc, "pvInverterQty", "4");
  pickByText("pvMv", "HPMVS-3000");
  setInput(window, doc, "pvMvQty", "1");

  pickByText("bessBattery", "Magna-UTL-373");
  setInput(window, doc, "bessBatteryQty", "4");
  pickByText("bessPcs", "ESHV250K");
  setInput(window, doc, "bessPcsQty", "3");

  const exToggle = doc.getElementById("exEnabled");
  exToggle.checked = true;
  fire(window, exToggle, "change");
  setInput(window, doc, "exPrice", "5");

  const tags = Array.from(doc.querySelectorAll(".tag")).map((t) => t.textContent);
  check("PV DC total computed (2048 kWp)", tags.some((t) => t.includes("2,048") && t.includes("kWp")));
  check("DC/AC ratio computed (1.33)", tags.some((t) => t.includes("DC/AC 1.33")));
  check("BESS MWh computed (1.49)", tags.some((t) => t.includes("1.49 MWh")));

  const checksText = Array.from(doc.querySelectorAll(".check-list li")).map((li) => li.textContent).join(" | ");
  check("string sizing check produced", /modules per string/.test(checksText));
  check("PCS DC window check produced", /PCS DC window/.test(checksText));
  check("exchange price check produced", /Exchange power at|Exchange price/.test(checksText));

  const heroVals = statVals();
  check("live savings estimate shown", heroVals.length > 0 && heroVals.some((v) => v.includes("₹")));
  next();
  check("advanced to savings & dispatch", stepTitle() === "Savings & Dispatch");

  // ---- Step 4: Savings & Dispatch ----
  check("before chart rendered", !!doc.getElementById("beforeCanvas"));
  check("after chart rendered", !!doc.getElementById("afterCanvas"));
  const afterLegend = Array.from(doc.querySelectorAll(".chart-panel .legend")[1].querySelectorAll(".li")).map((n) => n.textContent);
  check("after-mix includes new solar", afterLegend.some((t) => t.includes("New Solar")));
  check("after-mix includes BESS discharge", afterLegend.some((t) => t.includes("BESS Discharge")));
  check("after-mix includes exchange", afterLegend.some((t) => t.includes("Exchange")));
  const resultVals = statVals();
  check("savings stats shown", resultVals.some((v) => v.includes("₹")));
  const assumptions = Array.from(doc.querySelectorAll(".check-list li")).map((n) => n.textContent).join(" ");
  check("assumptions listed", /round-trip/.test(assumptions));
  next();
  check("advanced to details", stepTitle() === "Your Details");

  // ---- Step 5: Your Details ----
  setInput(window, doc, "companyName", "Acme Steel Pvt Ltd");
  setInput(window, doc, "personName", "R. Sharma");
  setInput(window, doc, "personRole", "Plant Head");
  setInput(window, doc, "personPhone", "9876543210");
  setInput(window, doc, "personEmail", "r.sharma@acme.in");
  const consent = doc.getElementById("consent");
  consent.checked = true;
  fire(window, consent, "change");
  doc.getElementById("submitBtn").click();
  await sleep(800);

  const afterSubs = await (await fetch(`${BASE}/api/submissions`, { headers: adminHeaders })).json();
  check("submission stored on server", afterSubs.length === beforeSubs + 1);
  check("submission has company name", afterSubs[0].companyName === "Acme Steel Pvt Ltd");
  check("submission has site name", afterSubs[0].siteName === "Taloja Plant 2");

  const detail = await (await fetch(`${BASE}/api/submissions/${afterSubs[0].id}`, { headers: adminHeaders })).json();
  check("payload includes BOM", Array.isArray(detail.payload.solution.bom) && detail.payload.solution.bom.length >= 5);
  check("payload includes savings", Number.isFinite(detail.payload.savings.savingsDay));
  check("payload savings positive", detail.payload.savings.savingsDay > 0);
  check("payload includes dispatch series", Array.isArray(detail.payload.savings.dispatch.newSolar));
  check("payload includes checks", detail.payload.solution.checks.length > 0);
  check("payload includes mix by source", Array.isArray(detail.payload.mix.hourly.dg));

  check("PDF generated and saved", typeof savedPdfName === "string" && savedPdfName.endsWith(".pdf"));
  check("PDF has multiple pages", pdfPageCount >= 3);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
