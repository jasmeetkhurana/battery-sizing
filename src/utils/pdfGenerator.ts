import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FormData } from '../types';

const COLORS = {
  primary: [17, 24, 39] as [number, number, number],
  accent: [37, 99, 235] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  light: [243, 244, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
};

function formatTimestamp(): string {
  const d = new Date();
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function formatFilename(data: FormData): string {
  const name = (data.company.siteName || data.company.companyName || 'report')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `battery-intake-${name}-${ts}.pdf`;
}

function addSectionTitle(doc: jsPDF, y: number, title: string): number {
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  y += 2;
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  return y + 6;
}

function addSubheading(doc: jsPDF, y: number, title: string): number {
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(title, 14, y);
  return y + 6;
}

function addField(doc: jsPDF, y: number, label: string, value: string): number {
  if (y > 274) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.muted);
  doc.text(label, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.primary);
  doc.text(String(value || '—'), 80, y);
  return y + 6;
}

function addItalicNote(doc: jsPDF, y: number, text: string): number {
  if (y > 274) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.muted);
  doc.text(text, 18, y);
  return y + 6;
}

function numOrDash(v: number | null, suffix = ''): string {
  return v !== null && v !== undefined ? `${v.toLocaleString('en-IN')}${suffix}` : '—';
}

export async function generatePdf(
  data: FormData,
  chartDataUrl: string | null
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 14;

  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Battery Opportunity Intake Report', 14, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.company.companyName} — ${data.company.siteName}`, 14, 24);
  doc.setFontSize(8);
  doc.text(`Generated: ${formatTimestamp()}  |  Version 1.0`, 14, 31);
  y = 44;

  // ── Section 1: Company & Contact ──
  y = addSectionTitle(doc, y, '1. Company & Site Profile');
  y = addField(doc, y, 'Company Name', data.company.companyName);
  y = addField(doc, y, 'Site Name', data.company.siteName);
  const premisesText =
    data.company.premisesType === 'Other'
      ? `Other — ${data.company.premisesOtherText}`
      : data.company.premisesType;
  y = addField(doc, y, 'Premises Type', premisesText);
  y = addField(doc, y, 'Grid Connection', data.company.gridConnection);
  y = addField(doc, y, 'State', data.company.state);
  y = addField(doc, y, 'District', data.company.district);
  if (data.company.locationDetails) {
    y = addField(doc, y, 'Location Details', data.company.locationDetails);
  }
  y += 3;
  y = addField(doc, y, 'Contact Name', data.company.contactName);
  if (data.company.contactRole) {
    y = addField(doc, y, 'Role/Designation', data.company.contactRole);
  }
  y = addField(doc, y, 'Phone', data.company.contactPhone);
  y = addField(doc, y, 'Email', data.company.contactEmail);
  y += 4;

  // ── Section 2: Use Cases ──
  y = addSectionTitle(doc, y, '2. Use Cases');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.primary);
  for (const uc of data.useCases.selected) {
    if (y > 274) { doc.addPage(); y = 20; }
    const label = uc === 'Other' ? `Other — ${data.useCases.otherText}` : uc;
    doc.text(`•  ${label}`, 18, y);
    y += 6;
  }
  y += 4;

  // ── Section 3: Load Profile ──
  y = addSectionTitle(doc, y, '3. Hourly Load Profile');
  y = addField(doc, y, 'Sanctioned Load', numOrDash(data.loadProfile.sanctionedLoad, ' kW'));
  y = addField(doc, y, 'Peak Load', numOrDash(data.loadProfile.peakLoad, ' kW'));

  const vals = data.loadProfile.hourlyValues;
  const peakVal = Math.max(...vals);
  const avgVal = vals.reduce((a, b) => a + b, 0) / 24;
  y = addField(doc, y, 'Observed Peak', `${peakVal.toLocaleString('en-IN')} kW`);
  y = addField(doc, y, 'Avg Load', `${avgVal.toFixed(1)} kW`);
  if (data.loadProfile.avgMonthlyConsumption !== null) {
    y = addField(doc, y, 'Avg Monthly Consumption', numOrDash(data.loadProfile.avgMonthlyConsumption, ' kWh'));
  }
  if (data.loadProfile.powerFactor !== null) {
    y = addField(doc, y, 'Power Factor', String(data.loadProfile.powerFactor));
  }
  y += 2;

  // Hourly table
  const tableRows: string[][] = [];
  for (let i = 0; i < 24; i += 4) {
    const row: string[] = [];
    for (let j = i; j < i + 4; j++) {
      row.push(`H${String(j).padStart(2, '0')}`);
      row.push(`${vals[j]} kW`);
    }
    tableRows.push(row);
  }

  autoTable(doc, {
    startY: y,
    head: [['Hour', 'kW', 'Hour', 'kW', 'Hour', 'kW', 'Hour', 'kW']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Chart image
  if (chartDataUrl) {
    if (y > 160) { doc.addPage(); y = 20; }
    doc.addImage(chartDataUrl, 'PNG', 14, y, 182, 75);
    y += 80;
  }
  y += 4;

  // ── Section 4: Existing Supply Stack ──
  if (y > 230) { doc.addPage(); y = 20; }
  y = addSectionTitle(doc, y, '4. Existing Supply Stack');

  // DISCOM
  y = addSubheading(doc, y, 'DISCOM / Grid Supply');
  if (data.supplyStack.discomNotApplicable) {
    y = addItalicNote(doc, y, 'Not applicable — off-grid site');
  } else {
    y = addField(doc, y, 'Sanctioned Load', numOrDash(data.supplyStack.discom.sanctionedLoad, ' kW'));
    y = addField(doc, y, 'Contract Demand', numOrDash(data.supplyStack.discom.contractDemand, ' kVA'));
    y = addField(doc, y, 'Monthly Bill', numOrDash(data.supplyStack.discom.monthlyBill, ' INR'));
    if (data.supplyStack.discom.tariffCategory) {
      y = addField(doc, y, 'Tariff Category', data.supplyStack.discom.tariffCategory);
    }
    if (data.supplyStack.discom.voltageLevel) {
      y = addField(doc, y, 'Voltage Level', data.supplyStack.discom.voltageLevel);
    }
    if (data.supplyStack.discom.todApplicable) {
      y = addField(doc, y, 'ToD Tariff', data.supplyStack.discom.todApplicable);
    }
    if (data.supplyStack.discom.demandChargeRate !== null) {
      y = addField(doc, y, 'Demand Charge Rate', numOrDash(data.supplyStack.discom.demandChargeRate, ' INR/kVA/mo'));
    }
    if (data.supplyStack.discom.avgEnergyRate !== null) {
      y = addField(doc, y, 'Avg Energy Rate', numOrDash(data.supplyStack.discom.avgEnergyRate, ' INR/kWh'));
    }
  }
  y += 3;

  // Power Outage
  const po = data.supplyStack.powerOutage;
  if (po.outageFrequency || po.backupHoursNeeded !== null) {
    y = addSubheading(doc, y, 'Power Outages & Backup');
    if (po.outageFrequency) y = addField(doc, y, 'Outage Frequency', po.outageFrequency);
    if (po.typicalDuration) y = addField(doc, y, 'Typical Duration', po.typicalDuration);
    if (po.backupHoursNeeded !== null) y = addField(doc, y, 'Backup Needed', `${po.backupHoursNeeded} hours`);
    if (po.estimatedOutageCost !== null) y = addField(doc, y, 'Downtime Cost', numOrDash(po.estimatedOutageCost, ' INR/hr'));
    y += 3;
  }

  // Solar On-Site
  y = addSubheading(doc, y, 'On-Site Solar / Rooftop PV');
  if (data.supplyStack.solarOnSite.hasSolar) {
    if (data.supplyStack.solarOnSite.installedCapacityKwp !== null) {
      y = addField(doc, y, 'Installed Capacity', numOrDash(data.supplyStack.solarOnSite.installedCapacityKwp, ' kWp'));
    }
    if (data.supplyStack.solarOnSite.avgDailyGenerationKwh !== null) {
      y = addField(doc, y, 'Avg Daily Generation', numOrDash(data.supplyStack.solarOnSite.avgDailyGenerationKwh, ' kWh'));
    }
  } else {
    y = addItalicNote(doc, y, 'No on-site solar installed');
  }
  y += 3;

  // Diesel
  y = addSubheading(doc, y, 'Diesel Genset');
  if (data.supplyStack.dieselNotRelevant) {
    y = addItalicNote(doc, y, 'Not relevant for this site');
  } else if (data.supplyStack.dieselGensets.length === 0) {
    y = addItalicNote(doc, y, 'No gensets added');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Rating (kVA)', 'Qty', 'Run Hrs/Day', 'Fuel Cost (INR/L)']],
      body: data.supplyStack.dieselGensets.map((g, i) => [
        String(i + 1),
        numOrDash(g.ratingKva),
        numOrDash(g.quantity),
        numOrDash(g.runHoursPerDay),
        numOrDash(g.fuelCost),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    if (data.supplyStack.monthlyDieselSpend !== null) {
      y = addField(doc, y, 'Monthly Diesel Spend', numOrDash(data.supplyStack.monthlyDieselSpend, ' INR'));
    }
  }
  y += 2;

  // Other Power
  if (y > 270) { doc.addPage(); y = 20; }
  y = addSubheading(doc, y, 'Other Power Sources');
  if (data.supplyStack.otherSourcesNotRelevant) {
    y = addItalicNote(doc, y, 'Not relevant for this site');
  } else if (data.supplyStack.otherSources.length === 0) {
    y = addItalicNote(doc, y, 'No sources added');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Source Type', 'Power Source', 'Monthly Energy (MWh)', 'Avg Cost (INR/kWh)']],
      body: data.supplyStack.otherSources.map((s, i) => [
        String(i + 1),
        s.sourceType || '—',
        s.powerSource || '—',
        numOrDash(s.monthlyEnergyMwh),
        numOrDash(s.avgCostPerKwh),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
  y += 4;

  // ── Section 5: Budget & Declaration ──
  if (y > 260) { doc.addPage(); y = 20; }
  y = addSectionTitle(doc, y, '5. Budget & Declaration');
  if (data.budgetRange) {
    y = addField(doc, y, 'Budget Range', data.budgetRange);
  }
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.primary);
  doc.text(
    data.consentGiven
      ? 'The submitter has confirmed that all provided information is accurate to the best of their knowledge.'
      : 'Consent was not provided.',
    14,
    y,
    { maxWidth: 180 }
  );
  y += 10;

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Battery Opportunity Intake Report — Confidential — Page ${p} of ${totalPages}`,
      105,
      290,
      { align: 'center' }
    );
  }

  doc.save(formatFilename(data));
}

export function buildPayloadJson(data: FormData): string {
  return JSON.stringify(
    {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      data,
    },
    null,
    2
  );
}
