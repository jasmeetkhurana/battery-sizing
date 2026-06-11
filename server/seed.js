/*
 * Seeds the product catalog from the supplied manufacturer datasheets.
 * Wind products are intentionally excluded (out of scope for v1),
 * but the category model supports adding them later without code changes.
 */
const db = require("./db");

const categories = [
  {
    key: "pv_module",
    name: "PV Module",
    role: "pv_module",
    specSchema: [
      { key: "powerWp", label: "Rated Power", unit: "Wp", type: "number" },
      { key: "voc", label: "Open Circuit Voltage (Voc)", unit: "V", type: "number" },
      { key: "vmp", label: "Voltage at Pmax (Vmp)", unit: "V", type: "number" },
      { key: "imp", label: "Current at Pmax (Imp)", unit: "A", type: "number" },
      { key: "isc", label: "Short Circuit Current (Isc)", unit: "A", type: "number" },
      { key: "efficiencyPct", label: "Module Efficiency", unit: "%", type: "number" },
      { key: "bifacial", label: "Bifacial", unit: "", type: "boolean" },
      { key: "technology", label: "Cell Technology", unit: "", type: "text" }
    ]
  },
  {
    key: "ci_string_inverter",
    name: "PV String Inverter (C&I)",
    role: "pv_inverter",
    specSchema: [
      { key: "acKw", label: "Rated AC Power", unit: "kW", type: "number" },
      { key: "maxDcV", label: "Max DC Voltage", unit: "V", type: "number" },
      { key: "mpptMinV", label: "MPPT Range Min", unit: "V", type: "number" },
      { key: "mpptMaxV", label: "MPPT Range Max", unit: "V", type: "number" },
      { key: "mpptCount", label: "Number of MPPTs", unit: "", type: "number" },
      { key: "stringsPerMppt", label: "Strings per MPPT", unit: "", type: "number" },
      { key: "acVoltage", label: "Rated AC Voltage", unit: "V", type: "number" },
      { key: "efficiencyPct", label: "Max Efficiency", unit: "%", type: "number" }
    ]
  },
  {
    key: "utility_string_inverter",
    name: "Utility String Inverter",
    role: "pv_inverter",
    specSchema: [
      { key: "acKw", label: "Rated AC Power", unit: "kW", type: "number" },
      { key: "maxDcV", label: "Max DC Voltage", unit: "V", type: "number" },
      { key: "mpptMinV", label: "MPPT Range Min", unit: "V", type: "number" },
      { key: "mpptMaxV", label: "MPPT Range Max", unit: "V", type: "number" },
      { key: "mpptCount", label: "Number of MPPTs", unit: "", type: "number" },
      { key: "stringsPerMppt", label: "Strings per MPPT", unit: "", type: "number" },
      { key: "acVoltage", label: "Rated AC Voltage", unit: "V", type: "number" },
      { key: "efficiencyPct", label: "Max Efficiency", unit: "%", type: "number" }
    ]
  },
  {
    key: "mv_station",
    name: "MV Transformer Station",
    role: "mv_station",
    specSchema: [
      { key: "kva", label: "Rated Capacity", unit: "kVA", type: "number" },
      { key: "lvVoltage", label: "LV Voltage", unit: "V", type: "number" },
      { key: "mvKv", label: "MV Voltage Range", unit: "kV", type: "text" },
      { key: "pairingHint", label: "Typical Inverter Pairing", unit: "", type: "text" }
    ]
  },
  {
    key: "bess_cabinet_ac",
    name: "BESS Cabinet (AC-coupled)",
    role: "battery",
    specSchema: [
      { key: "energyKwh", label: "Rated Energy", unit: "kWh", type: "number" },
      { key: "powerKw", label: "Rated Power", unit: "kW", type: "number" },
      { key: "coupling", label: "Coupling", unit: "", type: "text" },
      { key: "cooling", label: "Cooling", unit: "", type: "text" },
      { key: "acVoltage", label: "AC Output Voltage", unit: "V", type: "number" }
    ]
  },
  {
    key: "bess_cabinet_dc",
    name: "BESS Cabinet (DC)",
    role: "battery",
    specSchema: [
      { key: "energyKwh", label: "Rated Energy", unit: "kWh", type: "number" },
      { key: "powerKw", label: "Rated Power", unit: "kW", type: "number" },
      { key: "coupling", label: "Coupling", unit: "", type: "text" },
      { key: "dcVminV", label: "DC Voltage Min", unit: "V", type: "number" },
      { key: "dcVmaxV", label: "DC Voltage Max", unit: "V", type: "number" },
      { key: "cooling", label: "Cooling", unit: "", type: "text" }
    ]
  },
  {
    key: "bess_container",
    name: "BESS Container",
    role: "battery",
    specSchema: [
      { key: "energyKwh", label: "Rated Energy", unit: "kWh", type: "number" },
      { key: "powerKw", label: "Rated Power", unit: "kW", type: "number" },
      { key: "coupling", label: "Coupling", unit: "", type: "text" },
      { key: "dcVminV", label: "DC Voltage Min", unit: "V", type: "number" },
      { key: "dcVmaxV", label: "DC Voltage Max", unit: "V", type: "number" },
      { key: "formFactor", label: "Form Factor", unit: "", type: "text" }
    ]
  },
  {
    key: "string_pcs",
    name: "String PCS",
    role: "pcs",
    specSchema: [
      { key: "powerKw", label: "Rated AC Power", unit: "kW", type: "number" },
      { key: "dcVminV", label: "DC Voltage Min", unit: "V", type: "number" },
      { key: "dcVmaxV", label: "DC Voltage Max", unit: "V", type: "number" },
      { key: "acVoltage", label: "Rated AC Voltage", unit: "V", type: "number" },
      { key: "gridForming", label: "Grid Forming", unit: "", type: "boolean" },
      { key: "maxParallel", label: "Max Parallel Units", unit: "", type: "number" }
    ]
  },
  {
    key: "pcs_station",
    name: "PCS Turnkey Station",
    role: "pcs",
    specSchema: [
      { key: "powerKw", label: "Rated AC Power", unit: "kW", type: "number" },
      { key: "dcVminV", label: "DC Voltage Min", unit: "V", type: "number" },
      { key: "dcVmaxV", label: "DC Voltage Max", unit: "V", type: "number" },
      { key: "mvKv", label: "MV Voltage Range", unit: "kV", type: "text" },
      { key: "formFactor", label: "Form Factor", unit: "", type: "text" }
    ]
  }
];

const adaniVariants = [
  { wp: 605, vmp: 40.5, imp: 14.94, voc: 48.7, isc: 15.83, eff: 22.4 },
  { wp: 610, vmp: 40.8, imp: 14.96, voc: 49.0, isc: 15.86, eff: 22.6 },
  { wp: 615, vmp: 41.1, imp: 14.98, voc: 49.3, isc: 15.89, eff: 22.79 },
  { wp: 620, vmp: 41.4, imp: 14.99, voc: 49.6, isc: 15.91, eff: 22.97 },
  { wp: 625, vmp: 41.7, imp: 15.01, voc: 49.9, isc: 15.94, eff: 23.16 },
  { wp: 630, vmp: 42.0, imp: 15.03, voc: 50.2, isc: 15.97, eff: 23.34 },
  { wp: 635, vmp: 42.3, imp: 15.05, voc: 50.5, isc: 16.0, eff: 23.53 },
  { wp: 640, vmp: 42.6, imp: 15.07, voc: 50.8, isc: 16.03, eff: 23.71 }
];

const products = [];

adaniVariants.forEach((v) => {
  products.push({
    category: "pv_module",
    manufacturer: "Adani Solar",
    model: `ELAN SHINE TOPCon Bifacial ${v.wp} Wp`,
    specs: {
      powerWp: v.wp,
      voc: v.voc,
      vmp: v.vmp,
      imp: v.imp,
      isc: v.isc,
      efficiencyPct: v.eff,
      bifacial: true,
      technology: "G2G N-type TOPCon"
    }
  });
});

[
  { kw: 60, gen: "G02" },
  { kw: 70, gen: "G02" },
  { kw: 75, gen: "G02" },
  { kw: 100, gen: "G01" },
  { kw: 100, gen: "G02" },
  { kw: 110, gen: "G01" },
  { kw: 110, gen: "G02" }
].forEach((v) => {
  products.push({
    category: "ci_string_inverter",
    manufacturer: "Hopewind",
    model: `HSNV${v.kw}K-${v.gen}`,
    specs: {
      acKw: v.kw,
      maxDcV: 1100,
      mpptMinV: 200,
      mpptMaxV: 1000,
      mpptCount: v.kw >= 100 ? 6 : 4,
      stringsPerMppt: 2,
      acVoltage: 400,
      efficiencyPct: 98.7
    }
  });
});

[125, 150].forEach((kw) => {
  products.push({
    category: "ci_string_inverter",
    manufacturer: "Hopewind",
    model: `HSNV${kw}K-G01`,
    specs: {
      acKw: kw,
      maxDcV: 1100,
      mpptMinV: 200,
      mpptMaxV: 1000,
      mpptCount: 6,
      stringsPerMppt: 2,
      acVoltage: 400,
      efficiencyPct: 98.8
    }
  });
});

[320, 330, 350, 385].forEach((kw) => {
  products.push({
    category: "utility_string_inverter",
    manufacturer: "Hopewind",
    model: `HSHV${kw}K-G02`,
    specs: {
      acKw: kw,
      maxDcV: 1500,
      mpptMinV: 500,
      mpptMaxV: 1500,
      mpptCount: 8,
      stringsPerMppt: 2,
      acVoltage: 800,
      efficiencyPct: 99.0
    }
  });
});

[
  { model: "HPMVS-3000", kva: 3465, pairing: "9 x HSHV385K" },
  { model: "HPMVS-6000", kva: 6930, pairing: "18 x HSHV385K" },
  { model: "HPMVS-9000", kva: 9240, pairing: "24 x HSHV385K" }
].forEach((v) => {
  products.push({
    category: "mv_station",
    manufacturer: "Hopewind",
    model: v.model,
    specs: { kva: v.kva, lvVoltage: 800, mvKv: "10-35", pairingHint: v.pairing }
  });
});

products.push(
  {
    category: "bess_cabinet_ac",
    manufacturer: "Great Power",
    model: "Magna-C&I-215",
    specs: { energyKwh: 215, powerKw: 100, coupling: "AC", cooling: "Liquid", acVoltage: 400 }
  },
  {
    category: "bess_cabinet_ac",
    manufacturer: "Great Power",
    model: "Magna-C&I-260",
    specs: { energyKwh: 260, powerKw: 125, coupling: "AC", cooling: "Liquid", acVoltage: 400 }
  },
  {
    category: "bess_cabinet_dc",
    manufacturer: "Great Power",
    model: "Magna-UTL-373",
    specs: { energyKwh: 372.7, powerKw: 180, coupling: "DC", dcVminV: 900, dcVmaxV: 1500, cooling: "Liquid" }
  },
  {
    category: "bess_cabinet_dc",
    manufacturer: "Great Power",
    model: "Magna-UTL-418",
    specs: { energyKwh: 418, powerKw: 209, coupling: "DC", dcVminV: 900, dcVmaxV: 1500, cooling: "Liquid" }
  },
  {
    category: "bess_container",
    manufacturer: "Great Power",
    model: "Max-20HC-3440",
    specs: { energyKwh: 3440, powerKw: 1720, coupling: "DC", dcVminV: 1000, dcVmaxV: 1500, formFactor: "20ft HC container" }
  },
  {
    category: "bess_container",
    manufacturer: "Great Power",
    model: "Max-20HC-5000",
    specs: { energyKwh: 5000, powerKw: 2500, coupling: "DC", dcVminV: 1000, dcVmaxV: 1500, formFactor: "20ft HC container" }
  }
);

[145, 186, 200, 215, 250].forEach((kw) => {
  products.push({
    category: "string_pcs",
    manufacturer: "Hopewind",
    model: `ESHV${kw}K`,
    specs: {
      powerKw: kw,
      dcVminV: 1000,
      dcVmaxV: 1500,
      acVoltage: kw <= 145 ? 400 : 690,
      gridForming: true,
      maxParallel: 24
    }
  });
});

[
  { model: "HPPS-1250", kw: 1250 },
  { model: "HPPS-2500", kw: 2500 },
  { model: "HPPS-3000", kw: 3000 },
  { model: "HPPS-5000A", kw: 5000 },
  { model: "HPPS-5000B", kw: 5000 },
  { model: "HPPS-7500B", kw: 7500 }
].forEach((v) => {
  products.push({
    category: "pcs_station",
    manufacturer: "Hopewind",
    model: v.model,
    specs: { powerKw: v.kw, dcVminV: 1000, dcVmaxV: 1500, mvKv: "6-35", formFactor: "Containerized turnkey station" }
  });
});

function seed() {
  const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
  if (catCount > 0) {
    console.log("Catalog already seeded, skipping. Delete server/data.sqlite to reseed.");
    return;
  }

  const insertCat = db.prepare("INSERT INTO categories (key, name, role, specSchema) VALUES (?, ?, ?, ?)");
  const insertProd = db.prepare(
    "INSERT INTO products (categoryId, manufacturer, model, specs, datasheetUrl, active) VALUES (?, ?, ?, ?, ?, 1)"
  );

  const catIds = {};
  const tx = db.transaction(() => {
    categories.forEach((c) => {
      const info = insertCat.run(c.key, c.name, c.role, JSON.stringify(c.specSchema));
      catIds[c.key] = info.lastInsertRowid;
    });
    products.forEach((p) => {
      insertProd.run(catIds[p.category], p.manufacturer, p.model, JSON.stringify(p.specs), p.datasheetUrl || "");
    });
  });
  tx();
  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

seed();

module.exports = { seed };
