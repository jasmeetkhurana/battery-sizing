import { useRef, useCallback, useEffect, useState } from 'react';
import { useFormStore } from '../store/useFormStore';
import { InputField } from '../components/FormField';
import { ErrorSummary } from '../components/ErrorSummary';
import { StepNav } from '../components/StepNav';
import { renderChart, hitTestPoint, yValueFromClientY } from '../utils/chartRenderer';
import { LOAD_PRESETS, type PresetKey } from '../utils/constants';

export function Step2_LoadProfile() {
  const loadProfile = useFormStore((s) => s.formData.loadProfile);
  const gridConnection = useFormStore((s) => s.formData.company.gridConnection);
  const updateLoadProfile = useFormStore((s) => s.updateLoadProfile);
  const setHourlyValue = useFormStore((s) => s.setHourlyValue);
  const setAllHourlyValues = useFormStore((s) => s.setAllHourlyValues);
  const errors = useFormStore((s) => s.stepErrors[2]);
  const useCases = useFormStore((s) => s.formData.useCases.selected);
  const isOffGrid = gridConnection === 'Off-grid (no grid connection)';
  const dieselReplacement = useCases.includes('Diesel replacement');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState('');
  const isDragging = useRef(false);

  const { hourlyValues, sanctionedLoad, peakLoad } = loadProfile;

  const draw = useCallback(() => {
    if (!canvasRef.current) return;
    renderChart(canvasRef.current, hourlyValues, selectedHour, sanctionedLoad, peakLoad);
  }, [hourlyValues, selectedHour, sanctionedLoad, peakLoad]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  function getCanvasDisplayWidth(): number {
    return canvasRef.current?.getBoundingClientRect().width ?? 800;
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTestPoint(rect, e.clientX, e.clientY, hourlyValues, sanctionedLoad, peakLoad, getCanvasDisplayWidth());
    if (hit !== null) {
      setSelectedHour(hit);
      isDragging.current = true;
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging.current || selectedHour === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newVal = yValueFromClientY(rect, e.clientY, hourlyValues, sanctionedLoad, peakLoad, getCanvasDisplayWidth());
    setHourlyValue(selectedHour, newVal);
  }

  function handleCanvasMouseUp() {
    isDragging.current = false;
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTestPoint(rect, e.clientX, e.clientY, hourlyValues, sanctionedLoad, peakLoad, getCanvasDisplayWidth());
    if (hit !== null) {
      setSelectedHour(hit);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (selectedHour === null) return;
    const step = e.shiftKey ? 50 : 10;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedHour(selectedHour > 0 ? selectedHour - 1 : 23);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedHour(selectedHour < 23 ? selectedHour + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHourlyValue(selectedHour, hourlyValues[selectedHour] + step);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHourlyValue(selectedHour, Math.max(0, hourlyValues[selectedHour] - step));
        break;
    }
  }

  function applyPreset(key: PresetKey) {
    const base = sanctionedLoad ?? peakLoad ?? 500;
    const values = LOAD_PRESETS[key].generate(base);
    setAllHourlyValues(values);
    setSelectedHour(null);
  }

  function applyCsv() {
    setCsvError('');
    const parts = csvText.split(',').map((s) => s.trim());
    if (parts.length !== 24) {
      setCsvError(`Expected 24 values, got ${parts.length}`);
      return;
    }
    const nums = parts.map(Number);
    if (nums.some(isNaN)) {
      setCsvError('All values must be valid numbers');
      return;
    }
    if (nums.some((n) => n < 0)) {
      setCsvError('Values must be non-negative');
      return;
    }
    setAllHourlyValues(nums);
    setSelectedHour(null);
    setCsvText('');
  }

  function handleNumericInput(value: string, setter: (v: number | null) => void) {
    if (value === '') {
      setter(null);
      return;
    }
    const num = Number(value);
    if (!isNaN(num) && num >= 0) setter(num);
  }

  return (
    <div>
      <ErrorSummary errors={errors} />

      <div className="card">
        <h2 className="card__title">Load Parameters</h2>
        <div className="field-grid">
          {!isOffGrid && (
            <InputField
              label="Sanctioned Load"
              type="number"
              error={errors['sanctionedload']}
              hint="kW — from DISCOM, sets Y-axis reference"
              inputProps={{
                name: 'sanctionedLoad',
                value: sanctionedLoad ?? '',
                onChange: (e) => handleNumericInput(e.target.value, (v) => updateLoadProfile({ sanctionedLoad: v })),
                min: 0,
                placeholder: 'e.g. 1000',
              }}
            />
          )}
          <InputField
            label={isOffGrid ? 'Peak Site Load' : 'Peak Load'}
            type="number"
            error={errors['peakload']}
            hint={isOffGrid ? 'kW — max load your gensets/sources serve' : 'kW — sets Y-axis reference'}
            inputProps={{
              name: 'peakLoad',
              value: peakLoad ?? '',
              onChange: (e) => handleNumericInput(e.target.value, (v) => updateLoadProfile({ peakLoad: v })),
              min: 0,
              placeholder: 'e.g. 800',
            }}
          />
          <InputField
            label="Avg Monthly Consumption"
            type="number"
            hint={isOffGrid && dieselReplacement
              ? 'kWh — estimate from genset output (optional)'
              : 'kWh — optional, helps cross-validate load curve'}
            inputProps={{
              name: 'avgMonthlyConsumption',
              value: loadProfile.avgMonthlyConsumption ?? '',
              onChange: (e) => handleNumericInput(e.target.value, (v) => updateLoadProfile({ avgMonthlyConsumption: v })),
              min: 0,
              placeholder: 'e.g. 150000',
            }}
          />
          {!isOffGrid && (
            <InputField
              label="Power Factor"
              type="number"
              hint="0 to 1 — from latest bill (optional)"
              inputProps={{
                name: 'powerFactor',
                value: loadProfile.powerFactor ?? '',
                onChange: (e) => {
                  const val = e.target.value;
                  if (val === '') { updateLoadProfile({ powerFactor: null }); return; }
                  const num = Number(val);
                  if (!isNaN(num) && num >= 0 && num <= 1) updateLoadProfile({ powerFactor: num });
                },
                min: 0,
                max: 1,
                step: '0.01',
                placeholder: 'e.g. 0.92',
              }}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">24-Hour Load Curve</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Click a point to select, drag vertically to adjust. Use arrow keys: ←/→ to change hour, ↑/↓ to adjust kW (hold Shift for ±50).
        </p>

        {errors['hourly'] && (
          <span className="field__error" style={{ display: 'block', marginBottom: 12 }}>
            {errors['hourly']}
          </span>
        )}

        <div className="chart-container" ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="chart-controls">
          {selectedHour !== null && (
            <div className="chart-hour-editor">
              <span style={{ fontWeight: 600 }}>H{String(selectedHour).padStart(2, '0')}</span>
              <input
                type="number"
                className="field__input chart-hour-editor__input"
                value={hourlyValues[selectedHour]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v)) setHourlyValue(selectedHour, v);
                }}
                min={0}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>kW</span>
            </div>
          )}

          <div className="presets-bar" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>Presets:</span>
            {(Object.keys(LOAD_PRESETS) as PresetKey[]).map((key) => (
              <button key={key} className="btn btn--secondary btn--sm" onClick={() => applyPreset(key)}>
                {LOAD_PRESETS[key].label}
              </button>
            ))}
          </div>
        </div>

        {/* Hourly data table */}
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} colSpan={1} style={{
                    padding: '6px 4px',
                    textAlign: 'center',
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'var(--color-text-secondary)',
                  }}>
                    H{String(i).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i} style={{
                    padding: '4px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <input
                      type="number"
                      value={hourlyValues[i]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) setHourlyValue(i, v);
                      }}
                      onFocus={() => setSelectedHour(i)}
                      min={0}
                      style={{
                        width: '100%',
                        maxWidth: 64,
                        height: 30,
                        textAlign: 'center',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.82rem',
                        background: selectedHour === i ? 'var(--color-primary-light)' : 'transparent',
                      }}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
            <thead>
              <tr>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i + 12} style={{
                    padding: '6px 4px',
                    textAlign: 'center',
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'var(--color-text-secondary)',
                  }}>
                    H{String(i + 12).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i + 12} style={{
                    padding: '4px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <input
                      type="number"
                      value={hourlyValues[i + 12]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) setHourlyValue(i + 12, v);
                      }}
                      onFocus={() => setSelectedHour(i + 12)}
                      min={0}
                      style={{
                        width: '100%',
                        maxWidth: 64,
                        height: 30,
                        textAlign: 'center',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.82rem',
                        background: selectedHour === i + 12 ? 'var(--color-primary-light)' : 'transparent',
                      }}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card__subtitle">CSV Bulk Input</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Paste exactly 24 comma-separated kW values (H00 through H23).
        </p>
        <div className="csv-input-area">
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvError('');
            }}
            placeholder="100, 120, 150, 200, ..."
          />
          <button className="btn btn--primary btn--sm" onClick={applyCsv} disabled={!csvText.trim()}>
            Apply
          </button>
        </div>
        {csvError && <span className="field__error" style={{ marginTop: 6, display: 'block' }}>{csvError}</span>}
      </div>

      <StepNav />
    </div>
  );
}
