import { useRef, useEffect, useCallback } from 'react';
import { useFormStore } from '../store/useFormStore';
import { SelectField } from '../components/FormField';
import { ErrorSummary } from '../components/ErrorSummary';
import { StepNav } from '../components/StepNav';
import { renderChart, getChartDataUrl } from '../utils/chartRenderer';
import { generatePdf, buildPayloadJson } from '../utils/pdfGenerator';
import {
  validateStep0,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
} from '../utils/validators';
import { BUDGET_RANGE_OPTIONS } from '../types';
import type { StepId } from '../types';
import { wantsSolar } from '../utils/useCaseRelevance';

export function Step4_Review() {
  const formData = useFormStore((s) => s.formData);
  const setConsent = useFormStore((s) => s.setConsent);
  const setBudgetRange = useFormStore((s) => s.setBudgetRange);
  const errors = useFormStore((s) => s.stepErrors[4]);
  const setStepErrors = useFormStore((s) => s.setStepErrors);
  const setStep = useFormStore((s) => s.setStep);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { company, useCases, loadProfile, supplyStack, consentGiven, budgetRange } = formData;
  const { discom, powerOutage, solarOnSite } = supplyStack;
  const wantsSolarUC = wantsSolar(useCases.selected);

  const draw = useCallback(() => {
    if (!canvasRef.current) return;
    renderChart(
      canvasRef.current,
      loadProfile.hourlyValues,
      null,
      loadProfile.sanctionedLoad,
      loadProfile.peakLoad
    );
  }, [loadProfile]);

  useEffect(() => {
    draw();
  }, [draw]);

  const peakVal = Math.max(...loadProfile.hourlyValues);
  const avgVal = loadProfile.hourlyValues.reduce((a, b) => a + b, 0) / 24;

  function numDisplay(v: number | null, suffix = ''): string {
    return v !== null ? `${v.toLocaleString('en-IN')}${suffix}` : '—';
  }

  async function handleSubmit() {
    const allErrors: Record<StepId, Record<string, string>> = {
      0: validateStep0(formData),
      1: validateStep1(formData),
      2: validateStep2(formData),
      3: validateStep3(formData),
      4: validateStep4(formData),
    };

    let firstBadStep: StepId | null = null;
    for (const step of [0, 1, 2, 3, 4] as StepId[]) {
      setStepErrors(step, allErrors[step]);
      if (Object.keys(allErrors[step]).length > 0 && firstBadStep === null) {
        firstBadStep = step;
      }
    }

    if (firstBadStep !== null) {
      if (firstBadStep !== 4) {
        setStep(firstBadStep);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const chartDataUrl = getChartDataUrl(
      loadProfile.hourlyValues,
      loadProfile.sanctionedLoad,
      loadProfile.peakLoad
    );

    await generatePdf(formData, chartDataUrl);

    const json = buildPayloadJson(formData);
    console.log('Payload JSON:', json);
  }

  const sectionHeaderStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', width: '100%', padding: 0,
  };

  return (
    <div>
      <ErrorSummary errors={errors} />

      <div className="card">
        <h2 className="card__title">Review Summary</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Please review all information before generating the report. Click any section header to go back and edit.
        </p>

        {/* Company & Contact */}
        <div className="review-section">
          <button className="review-section__header" style={sectionHeaderStyle} onClick={() => setStep(0)}>
            1. Company & Site Profile →
          </button>
          <dl className="review-grid">
            <dt>Company</dt><dd>{company.companyName || '—'}</dd>
            <dt>Site</dt><dd>{company.siteName || '—'}</dd>
            <dt>Premises</dt>
            <dd>{company.premisesType === 'Other' ? `Other — ${company.premisesOtherText}` : company.premisesType || '—'}</dd>
            <dt>Grid Connection</dt><dd>{company.gridConnection || '—'}</dd>
            <dt>Location</dt><dd>{`${company.state}, ${company.district}`}{company.locationDetails ? ` (${company.locationDetails})` : ''}</dd>
            <dt>Contact</dt><dd>{company.contactName}{company.contactRole ? ` — ${company.contactRole}` : ''}</dd>
            <dt>Phone</dt><dd>{company.contactPhone || '—'}</dd>
            <dt>Email</dt><dd>{company.contactEmail || '—'}</dd>
          </dl>
        </div>

        {/* Use Cases */}
        <div className="review-section">
          <button className="review-section__header" style={sectionHeaderStyle} onClick={() => setStep(1)}>
            2. Use Cases →
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {useCases.selected.map((uc) => (
              <span key={uc} className="review-badge review-badge--success">
                {uc === 'Other' ? `Other — ${useCases.otherText}` : uc}
              </span>
            ))}
            {useCases.selected.length === 0 && (
              <span className="review-badge review-badge--warn">None selected</span>
            )}
          </div>
        </div>

        {/* Load Profile */}
        <div className="review-section">
          <button className="review-section__header" style={sectionHeaderStyle} onClick={() => setStep(2)}>
            3. Load Profile →
          </button>
          <dl className="review-grid" style={{ marginBottom: 12 }}>
            <dt>Sanctioned Load</dt><dd>{numDisplay(loadProfile.sanctionedLoad, ' kW')}</dd>
            <dt>Peak Load</dt><dd>{numDisplay(loadProfile.peakLoad, ' kW')}</dd>
            <dt>Observed Peak</dt><dd>{peakVal.toLocaleString('en-IN')} kW</dd>
            <dt>Average Load</dt><dd>{avgVal.toFixed(1)} kW</dd>
            {loadProfile.avgMonthlyConsumption !== null && (
              <><dt>Monthly Consumption</dt><dd>{numDisplay(loadProfile.avgMonthlyConsumption, ' kWh')}</dd></>
            )}
            {loadProfile.powerFactor !== null && (
              <><dt>Power Factor</dt><dd>{loadProfile.powerFactor}</dd></>
            )}
          </dl>
          <div style={{ maxWidth: 700 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--color-border)' }} />
          </div>
        </div>

        {/* Supply Stack */}
        <div className="review-section">
          <button className="review-section__header" style={sectionHeaderStyle} onClick={() => setStep(3)}>
            4. Existing Supply Stack →
          </button>

          {/* DISCOM */}
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: 6 }}>DISCOM / Grid Supply</strong>
            {supplyStack.discomNotApplicable ? (
              <span className="review-badge review-badge--muted">Not applicable (off-grid)</span>
            ) : (
              <dl className="review-grid">
                <dt>Sanctioned Load</dt><dd>{numDisplay(discom.sanctionedLoad, ' kW')}</dd>
                <dt>Contract Demand</dt><dd>{numDisplay(discom.contractDemand, ' kVA')}</dd>
                <dt>Monthly Bill</dt><dd>{numDisplay(discom.monthlyBill, ' INR')}</dd>
                {discom.tariffCategory && <><dt>Tariff Category</dt><dd>{discom.tariffCategory}</dd></>}
                {discom.voltageLevel && <><dt>Voltage Level</dt><dd>{discom.voltageLevel}</dd></>}
                {discom.todApplicable && <><dt>ToD Tariff</dt><dd>{discom.todApplicable}</dd></>}
                {discom.demandChargeRate !== null && <><dt>Demand Charge</dt><dd>{numDisplay(discom.demandChargeRate, ' INR/kVA/mo')}</dd></>}
                {discom.avgEnergyRate !== null && <><dt>Avg Energy Rate</dt><dd>{numDisplay(discom.avgEnergyRate, ' INR/kWh')}</dd></>}
              </dl>
            )}
          </div>

          {/* Power Outage */}
          {(powerOutage.outageFrequency || powerOutage.backupHoursNeeded !== null) && (
            <div style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: 6 }}>Power Outages & Backup</strong>
              <dl className="review-grid">
                {powerOutage.outageFrequency && <><dt>Outage Frequency</dt><dd>{powerOutage.outageFrequency}</dd></>}
                {powerOutage.typicalDuration && <><dt>Typical Duration</dt><dd>{powerOutage.typicalDuration}</dd></>}
                {powerOutage.backupHoursNeeded !== null && <><dt>Backup Needed</dt><dd>{powerOutage.backupHoursNeeded} hours</dd></>}
                {powerOutage.estimatedOutageCost !== null && <><dt>Downtime Cost</dt><dd>{numDisplay(powerOutage.estimatedOutageCost, ' INR/hr')}</dd></>}
              </dl>
            </div>
          )}

          {/* Solar — only show if relevant use case or user has solar */}
          {(solarOnSite.hasSolar || wantsSolarUC) && (
            <div style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: '0.88rem' }}>On-Site Solar: </strong>
              {solarOnSite.hasSolar ? (
                <>
                  <span className="review-badge review-badge--success">Yes</span>
                  <dl className="review-grid" style={{ marginTop: 6 }}>
                    {solarOnSite.installedCapacityKwp !== null && <><dt>Installed Capacity</dt><dd>{numDisplay(solarOnSite.installedCapacityKwp, ' kWp')}</dd></>}
                    {solarOnSite.avgDailyGenerationKwh !== null && <><dt>Avg Daily Gen</dt><dd>{numDisplay(solarOnSite.avgDailyGenerationKwh, ' kWh')}</dd></>}
                  </dl>
                </>
              ) : (
                <span className="review-badge review-badge--muted">None</span>
              )}
            </div>
          )}

          {/* Diesel */}
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: '0.85rem' }}>Diesel Genset: </strong>
            {supplyStack.dieselNotRelevant ? (
              <span className="review-badge review-badge--muted">Not relevant</span>
            ) : supplyStack.dieselGensets.length > 0 ? (
              <span className="review-badge review-badge--success">{supplyStack.dieselGensets.length} genset(s)</span>
            ) : (
              <span className="review-badge review-badge--muted">None added</span>
            )}
          </div>

          {!supplyStack.dieselNotRelevant && supplyStack.dieselGensets.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', paddingLeft: 12 }}>
              {supplyStack.dieselGensets.map((g, i) => (
                <div key={g.id} style={{ marginBottom: 4 }}>
                  #{i + 1}: {g.ratingKva} kVA x {g.quantity}, {g.runHoursPerDay} hrs/day
                  {g.fuelCost ? `, INR ${g.fuelCost}/L` : ''}
                </div>
              ))}
              {supplyStack.monthlyDieselSpend !== null && (
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  Monthly diesel spend: {numDisplay(supplyStack.monthlyDieselSpend, ' INR')}
                </div>
              )}
            </div>
          )}

          {/* Other Sources */}
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: '0.85rem' }}>Other Sources: </strong>
            {supplyStack.otherSourcesNotRelevant ? (
              <span className="review-badge review-badge--muted">Not relevant</span>
            ) : supplyStack.otherSources.length > 0 ? (
              <span className="review-badge review-badge--success">{supplyStack.otherSources.length} source(s)</span>
            ) : (
              <span className="review-badge review-badge--muted">None added</span>
            )}
          </div>

          {!supplyStack.otherSourcesNotRelevant && supplyStack.otherSources.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', paddingLeft: 12 }}>
              {supplyStack.otherSources.map((s, i) => (
                <div key={s.id} style={{ marginBottom: 4 }}>
                  #{i + 1}: {s.sourceType}
                  {s.powerSource ? ` (${s.powerSource})` : ''}
                  {' — '}{s.monthlyEnergyMwh} MWh/mo @ INR {s.avgCostPerKwh}/kWh
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget Range */}
      <div className="card">
        <h2 className="card__title">Budget Indication</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          Optional — helps scope the right solution size. This is indicative only.
        </p>
        <div style={{ maxWidth: 320 }}>
          <SelectField
            label="Approximate Budget Range"
            options={BUDGET_RANGE_OPTIONS.map((b) => ({ value: b, label: b }))}
            selectProps={{
              value: budgetRange,
              onChange: (e) => setBudgetRange(e.target.value as typeof budgetRange),
            }}
          />
        </div>
      </div>

      {/* Consent */}
      <div className={`card consent-box ${errors['consent'] ? 'consent-box--error' : ''}`}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <div>
            <strong style={{ fontSize: '0.9rem' }}>Declaration & Consent</strong>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              I confirm that all information provided is accurate to the best of my knowledge.
              This data will be used to assess battery energy storage opportunities for the specified site.
            </p>
          </div>
        </label>
        {errors['consent'] && <span className="field__error" style={{ display: 'block', marginTop: 8, paddingLeft: 28 }}>{errors['consent']}</span>}
      </div>

      <StepNav onSubmit={handleSubmit} />
    </div>
  );
}
