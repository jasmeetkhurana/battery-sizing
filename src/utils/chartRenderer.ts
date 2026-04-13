const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

interface ChartConfig {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  colors: {
    line: string;
    fill: string;
    point: string;
    selectedPoint: string;
    grid: string;
    axis: string;
    text: string;
    sanctioned: string;
    peak: string;
    bg: string;
  };
}

const DEFAULT_CONFIG: ChartConfig = {
  width: 800,
  height: 340,
  padding: { top: 24, right: 24, bottom: 48, left: 60 },
  colors: {
    line: '#2563eb',
    fill: 'rgba(37,99,235,0.08)',
    point: '#2563eb',
    selectedPoint: '#f59e0b',
    grid: '#e5e7eb',
    axis: '#6b7280',
    text: '#374151',
    sanctioned: '#ef4444',
    peak: '#f97316',
    bg: '#ffffff',
  },
};

export function computeYMax(
  values: number[],
  sanctionedLoad: number | null,
  peakLoad: number | null
): number {
  const dataMax = Math.max(...values, 0);
  const refMax = Math.max(sanctionedLoad ?? 0, peakLoad ?? 0);
  const raw = refMax > 0 ? Math.max(refMax, dataMax) : Math.max(dataMax, 100);

  const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = magnitude >= 100 ? magnitude / 2 : magnitude;
  return Math.ceil(raw / step) * step || 100;
}

function niceSteps(max: number): number[] {
  const stepCount = 5;
  const step = max / stepCount;
  return Array.from({ length: stepCount + 1 }, (_, i) => i * step);
}

export function renderChart(
  canvas: HTMLCanvasElement,
  values: number[],
  selectedHour: number | null,
  sanctionedLoad: number | null,
  peakLoad: number | null,
  config: Partial<ChartConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config, colors: { ...DEFAULT_CONFIG.colors, ...(config.colors ?? {}) } };
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = cfg.width * dpr;
  canvas.height = cfg.height * dpr;
  canvas.style.width = `${cfg.width}px`;
  canvas.style.height = `${cfg.height}px`;
  ctx.scale(dpr, dpr);

  const { padding: p } = cfg;
  const plotW = cfg.width - p.left - p.right;
  const plotH = cfg.height - p.top - p.bottom;
  const yMax = computeYMax(values, sanctionedLoad, peakLoad);

  const xOf = (i: number) => p.left + (i / 23) * plotW;
  const yOf = (v: number) => p.top + plotH - (v / yMax) * plotH;

  // Background
  ctx.fillStyle = cfg.colors.bg;
  ctx.fillRect(0, 0, cfg.width, cfg.height);

  // Grid
  const steps = niceSteps(yMax);
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.5;
  for (const s of steps) {
    const gy = yOf(s);
    ctx.beginPath();
    ctx.moveTo(p.left, gy);
    ctx.lineTo(cfg.width - p.right, gy);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = cfg.colors.axis;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const s of steps) {
    ctx.fillText(`${s}`, p.left - 8, yOf(s));
  }

  // Y-axis title
  ctx.save();
  ctx.translate(14, p.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillStyle = cfg.colors.text;
  ctx.fillText('Load (kW)', 0, 0);
  ctx.restore();

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = cfg.colors.axis;
  for (let i = 0; i < 24; i++) {
    if (i % 2 === 0 || cfg.width > 700) {
      ctx.fillText(HOUR_LABELS[i], xOf(i), cfg.height - p.bottom + 8);
    }
  }

  // Reference lines
  if (sanctionedLoad !== null && sanctionedLoad > 0) {
    const sy = yOf(sanctionedLoad);
    ctx.strokeStyle = cfg.colors.sanctioned;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p.left, sy);
    ctx.lineTo(cfg.width - p.right, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cfg.colors.sanctioned;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Sanctioned: ${sanctionedLoad} kW`, p.left + 4, sy - 10);
  }

  if (peakLoad !== null && peakLoad > 0) {
    const py = yOf(peakLoad);
    ctx.strokeStyle = cfg.colors.peak;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p.left, py);
    ctx.lineTo(cfg.width - p.right, py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cfg.colors.peak;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Peak: ${peakLoad} kW`, p.left + 4, py - 10);
  }

  // Area fill
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(0));
  for (let i = 0; i < 24; i++) {
    ctx.lineTo(xOf(i), yOf(values[i]));
  }
  ctx.lineTo(xOf(23), yOf(0));
  ctx.closePath();
  ctx.fillStyle = cfg.colors.fill;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(values[0]));
  for (let i = 1; i < 24; i++) {
    ctx.lineTo(xOf(i), yOf(values[i]));
  }
  ctx.strokeStyle = cfg.colors.line;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Points
  for (let i = 0; i < 24; i++) {
    const isSelected = i === selectedHour;
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(values[i]), isSelected ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? cfg.colors.selectedPoint : cfg.colors.point;
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Tooltip for selected
  if (selectedHour !== null) {
    const sx = xOf(selectedHour);
    const sy = yOf(values[selectedHour]);
    const label = `H${String(selectedHour).padStart(2, '0')}: ${values[selectedHour]} kW`;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 16;
    const tx = Math.min(Math.max(sx - tw / 2, p.left), cfg.width - p.right - tw);
    const ty = sy - 32;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    const r = 6;
    ctx.roundRect(tx, ty, tw, 22, r);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tx + tw / 2, ty + 11);
  }
}

export function getChartDataUrl(
  values: number[],
  sanctionedLoad: number | null,
  peakLoad: number | null
): string {
  const offscreen = document.createElement('canvas');
  offscreen.width = 800;
  offscreen.height = 340;
  const dprBackup = window.devicePixelRatio;
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  renderChart(offscreen, values, null, sanctionedLoad, peakLoad);
  Object.defineProperty(window, 'devicePixelRatio', { value: dprBackup, writable: true });
  return offscreen.toDataURL('image/png');
}

export function hitTestPoint(
  canvasRect: DOMRect,
  clientX: number,
  clientY: number,
  values: number[],
  sanctionedLoad: number | null,
  peakLoad: number | null,
  canvasDisplayWidth: number
): number | null {
  const cfg = DEFAULT_CONFIG;
  const scale = canvasDisplayWidth / cfg.width;
  const p = cfg.padding;
  const plotW = cfg.width - p.left - p.right;
  const plotH = cfg.height - p.top - p.bottom;
  const yMax = computeYMax(values, sanctionedLoad, peakLoad);

  const localX = (clientX - canvasRect.left) / scale;
  const localY = (clientY - canvasRect.top) / scale;

  const xOf = (i: number) => p.left + (i / 23) * plotW;
  const yOf = (v: number) => p.top + plotH - (v / yMax) * plotH;

  let closest = -1;
  let closestDist = Infinity;

  for (let i = 0; i < 24; i++) {
    const dx = localX - xOf(i);
    const dy = localY - yOf(values[i]);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }

  return closestDist < 20 ? closest : null;
}

export function yValueFromClientY(
  canvasRect: DOMRect,
  clientY: number,
  values: number[],
  sanctionedLoad: number | null,
  peakLoad: number | null,
  canvasDisplayWidth: number
): number {
  const cfg = DEFAULT_CONFIG;
  const scale = canvasDisplayWidth / cfg.width;
  const p = cfg.padding;
  const plotH = cfg.height - p.top - p.bottom;
  const yMax = computeYMax(values, sanctionedLoad, peakLoad);

  const localY = (clientY - canvasRect.top) / scale;
  const ratio = 1 - (localY - p.top) / plotH;
  const raw = ratio * yMax;
  return Math.max(0, Math.round(raw));
}
