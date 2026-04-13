import { Plus, Trash2 } from 'lucide-react';
import { useFormStore } from '../store/useFormStore';
import { InputField, SelectField } from '../components/FormField';
import { ErrorSummary } from '../components/ErrorSummary';
import { StepNav } from '../components/StepNav';
import {
  SOURCE_TYPES,
  SOURCES_NEEDING_POWER_TYPE,
  POWER_SOURCE_OPTIONS,
  TARIFF_CATEGORIES,
  VOLTAGE_LEVELS,
  TOD_OPTIONS,
  OUTAGE_FREQUENCY_OPTIONS,
  OUTAGE_DURATION_OPTIONS,
} from '../types';
import { isOffGrid, isPartialGrid } from '../utils/validators';
import {
  wantsTariffDetails,
  wantsDiesel,
  wantsBackup,
  wantsSolar,
} from '../utils/useCaseRelevance';

export function Step3_SupplyStack() {
  const formData = useFormStore((s) => s.formData);
  const supplyStack = formData.supplyStack;
  const useCases = formData.useCases.selected;
  const updateSupplyStack = useFormStore((s) => s.updateSupplyStack);
  const updatePowerOutage = useFormStore((s) => s.updatePowerOutage);
  const updateSolarOnSite = useFormStore((s) => s.updateSolarOnSite);
  const addDieselGenset = useFormStore((s) => s.addDieselGenset);
  const updateDieselGenset = useFormStore((s) => s.updateDieselGenset);
  const removeDieselGenset = useFormStore((s) => s.removeDieselGenset);
  const addOtherSource = useFormStore((s) => s.addOtherSource);
  const updateOtherSource = useFormStore((s) => s.updateOtherSource);
  const removeOtherSource = useFormStore((s) => s.removeOtherSource);
  const errors = useFormStore((s) => s.stepErrors[3]);

  const { discom, powerOutage, solarOnSite } = supplyStack;
  const offGrid = isOffGrid(formData);
  const partialGrid = isPartialGrid(formData);
  const showDiscom = !offGrid && !supplyStack.discomNotApplicable;

  const showTariffFields = wantsTariffDetails(useCases);
  const dieselEffectivelyRelevant = offGrid || !supplyStack.dieselNotRelevant;
  const showDieselSection = dieselEffectivelyRelevant || wantsDiesel(useCases);
  const showOutageCard = offGrid || partialGrid || wantsBackup(useCases);
  const showSolarCard = wantsSolar(useCases) || solarOnSite.hasSolar;
  const dieselReplacementSelected = useCases.includes('Diesel replacement');

  function numOrNull(value: string): number | null {
    if (value === '') return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  function updateDiscom(patch: Partial<typeof discom>) {
    updateSupplyStack({ discom: { ...discom, ...patch } });
  }

  return (
    <div>
      <ErrorSummary errors={errors} />

      {/* ── DISCOM ── */}
      {!offGrid ? (
        <div className="card">
          <h2 className="card__title">DISCOM / Grid Supply Details</h2>
          {partialGrid && (
            <label className={`not-relevant-toggle ${supplyStack.discomNotApplicable ? 'not-relevant-toggle--active' : ''}`}
              style={{ marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={supplyStack.discomNotApplicable}
                onChange={(e) => updateSupplyStack({ discomNotApplicable: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--color-warning)' }}
              />
              <span>No DISCOM connection at this site</span>
            </label>
          )}
          {showDiscom && (
            <div className="field-grid">
              <InputField
                label="Sanctioned Load (kW)"
                required
                type="number"
                error={errors['discom_sanctionedload']}
                inputProps={{
                  value: discom.sanctionedLoad ?? '',
                  onChange: (e) => updateDiscom({ sanctionedLoad: numOrNull(e.target.value) }),
                  min: 0,
                  placeholder: 'e.g. 500',
                }}
              />
              <InputField
                label="Monthly Electricity Bill (INR)"
                required
                type="number"
                error={errors['discom_monthlybill']}
                inputProps={{
                  value: discom.monthlyBill ?? '',
                  onChange: (e) => updateDiscom({ monthlyBill: numOrNull(e.target.value) }),
                  min: 0,
                  placeholder: 'e.g. 250000',
                }}
              />
              <InputField
                label="Avg Energy Rate"
                type="number"
                hint="INR/kWh — approx from bill (optional)"
                inputProps={{
                  value: discom.avgEnergyRate ?? '',
                  onChange: (e) => updateDiscom({ avgEnergyRate: numOrNull(e.target.value) }),
                  min: 0,
                  step: '0.01',
                  placeholder: 'e.g. 8.50',
                }}
              />
              <SelectField
                label="Supply Voltage Level"
                options={VOLTAGE_LEVELS.map((v) => ({ value: v, label: v }))}
                selectProps={{
                  value: discom.voltageLevel,
                  onChange: (e) => updateDiscom({ voltageLevel: e.target.value as typeof discom.voltageLevel }),
                }}
              />

              {showTariffFields && (
                <>
                  <InputField
                    label="Contract Demand (kVA)"
                    type="number"
                    error={errors['discom_contractdemand']}
                    hint="From latest bill — key for demand charge sizing"
                    inputProps={{
                      value: discom.contractDemand ?? '',
                      onChange: (e) => updateDiscom({ contractDemand: numOrNull(e.target.value) }),
                      min: 0,
                      placeholder: 'e.g. 600',
                    }}
                  />
                  <SelectField
                    label="Tariff Category"
                    hint="From electricity bill"
                    options={TARIFF_CATEGORIES.map((t) => ({ value: t, label: t }))}
                    selectProps={{
                      value: discom.tariffCategory,
                      onChange: (e) => updateDiscom({ tariffCategory: e.target.value as typeof discom.tariffCategory }),
                    }}
                  />
                  <SelectField
                    label="Time-of-Day (ToD) Tariff?"
                    hint="Does peak/off-peak pricing apply?"
                    options={TOD_OPTIONS.map((t) => ({ value: t, label: t }))}
                    selectProps={{
                      value: discom.todApplicable,
                      onChange: (e) => updateDiscom({ todApplicable: e.target.value as typeof discom.todApplicable }),
                    }}
                  />
                  <InputField
                    label="Demand Charge Rate"
                    type="number"
                    hint="INR/kVA/month — optional, from bill"
                    inputProps={{
                      value: discom.demandChargeRate ?? '',
                      onChange: (e) => updateDiscom({ demandChargeRate: numOrNull(e.target.value) }),
                      min: 0,
                      step: '0.01',
                      placeholder: 'e.g. 350',
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary)' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-primary)', fontWeight: 500, margin: 0 }}>
            Off-grid site — DISCOM details are not applicable. Energy costs will be derived from your diesel and other power source details below.
          </p>
        </div>
      )}

      {/* ── Power Outage / Reliability ── */}
      {showOutageCard && (
        <div className="card">
          <h2 className="card__title">
            {offGrid ? 'Power Reliability & Battery Needs' : 'Power Outages & Backup Needs'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            {offGrid
              ? 'Helps size battery capacity. What are your power reliability goals?'
              : 'Helps determine backup capacity requirements. Fill what you know.'}
          </p>
          <div className="field-grid">
            {!offGrid && (
              <SelectField
                label="Grid Outage Frequency"
                hint="How often does grid power fail?"
                options={OUTAGE_FREQUENCY_OPTIONS.map((o) => ({ value: o, label: o }))}
                selectProps={{
                  value: powerOutage.outageFrequency,
                  onChange: (e) => updatePowerOutage({ outageFrequency: e.target.value as typeof powerOutage.outageFrequency }),
                }}
              />
            )}
            {!offGrid && (
              <SelectField
                label="Typical Outage Duration"
                options={OUTAGE_DURATION_OPTIONS.map((o) => ({ value: o, label: o }))}
                selectProps={{
                  value: powerOutage.typicalDuration,
                  onChange: (e) => updatePowerOutage({ typicalDuration: e.target.value as typeof powerOutage.typicalDuration }),
                }}
              />
            )}
            <InputField
              label={offGrid ? 'Desired Battery Autonomy (hours)' : 'Backup Hours Needed'}
              type="number"
              hint={offGrid
                ? 'How many hours should battery run without gensets?'
                : 'Hours of battery backup required'}
              inputProps={{
                value: powerOutage.backupHoursNeeded ?? '',
                onChange: (e) => updatePowerOutage({ backupHoursNeeded: numOrNull(e.target.value) }),
                min: 0,
                max: 24,
                step: '0.5',
                placeholder: 'e.g. 4',
              }}
            />
            <InputField
              label={offGrid ? 'Cost of Power Interruption' : 'Cost of Downtime'}
              type="number"
              hint="Estimated INR per hour (optional)"
              inputProps={{
                value: powerOutage.estimatedOutageCost ?? '',
                onChange: (e) => updatePowerOutage({ estimatedOutageCost: numOrNull(e.target.value) }),
                min: 0,
                placeholder: 'e.g. 50000',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Solar On-Site ── */}
      {showSolarCard && (
        <div className="card">
          <h2 className="card__title">On-Site Solar / Rooftop PV</h2>
          <label className="checkbox-row" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={solarOnSite.hasSolar}
              onChange={(e) => updateSolarOnSite({ hasSolar: e.target.checked })}
            />
            <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
              This site has on-site solar / rooftop PV installed
            </span>
          </label>

          {solarOnSite.hasSolar && (
            <div className="field-grid">
              <InputField
                label="Installed Capacity (kWp)"
                type="number"
                hint="Total peak capacity of solar installation"
                inputProps={{
                  value: solarOnSite.installedCapacityKwp ?? '',
                  onChange: (e) => updateSolarOnSite({ installedCapacityKwp: numOrNull(e.target.value) }),
                  min: 0,
                  placeholder: 'e.g. 200',
                }}
              />
              <InputField
                label="Avg Daily Generation (kWh)"
                type="number"
                hint="Approximate from inverter data (optional)"
                inputProps={{
                  value: solarOnSite.avgDailyGenerationKwh ?? '',
                  onChange: (e) => updateSolarOnSite({ avgDailyGenerationKwh: numOrNull(e.target.value) }),
                  min: 0,
                  placeholder: 'e.g. 800',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Diesel Genset ── */}
      {showDieselSection && (
        <div className="card">
          <h2 className="card__title">
            {offGrid ? 'Diesel Genset (Primary Power)' : 'Diesel Genset Setup'}
          </h2>

          {!offGrid && (
            <label className={`not-relevant-toggle ${supplyStack.dieselNotRelevant ? 'not-relevant-toggle--active' : ''}`}>
              <input
                type="checkbox"
                checked={supplyStack.dieselNotRelevant}
                onChange={(e) => updateSupplyStack({ dieselNotRelevant: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--color-warning)' }}
              />
              <span>Not relevant for this site</span>
            </label>
          )}

          {dieselEffectivelyRelevant && (
            <>
              {supplyStack.dieselGensets.map((g, idx) => (
                <div className="entry-card" key={g.id}>
                  <div className="entry-card__header">
                    <span className="entry-card__title">Genset #{idx + 1}</span>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeDieselGenset(g.id)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <div className="field-grid">
                    <InputField
                      label="Rating (kVA)"
                      required
                      type="number"
                      error={errors[`diesel_${g.id}_rating`]}
                      inputProps={{
                        value: g.ratingKva ?? '',
                        onChange: (e) => updateDieselGenset(g.id, { ratingKva: numOrNull(e.target.value) }),
                        min: 0,
                        placeholder: 'e.g. 500',
                      }}
                    />
                    <InputField
                      label="Quantity"
                      required
                      type="number"
                      error={errors[`diesel_${g.id}_qty`]}
                      inputProps={{
                        value: g.quantity ?? '',
                        onChange: (e) => updateDieselGenset(g.id, { quantity: numOrNull(e.target.value) }),
                        min: 1,
                        placeholder: 'e.g. 2',
                      }}
                    />
                    <InputField
                      label="Typical Run Hours / Day"
                      required
                      type="number"
                      error={errors[`diesel_${g.id}_hours`]}
                      inputProps={{
                        value: g.runHoursPerDay ?? '',
                        onChange: (e) => updateDieselGenset(g.id, { runHoursPerDay: numOrNull(e.target.value) }),
                        min: 0,
                        max: 24,
                        placeholder: offGrid ? 'e.g. 16' : 'e.g. 5',
                      }}
                    />
                    <InputField
                      label="Fuel Cost (INR/L)"
                      type="number"
                      hint={offGrid || dieselReplacementSelected ? 'Important for savings calculation' : 'Optional'}
                      inputProps={{
                        value: g.fuelCost ?? '',
                        onChange: (e) => updateDieselGenset(g.id, { fuelCost: numOrNull(e.target.value) }),
                        min: 0,
                        placeholder: 'e.g. 95',
                      }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button className="btn btn--ghost" onClick={addDieselGenset}>
                  <Plus size={16} /> Add Genset
                </button>
              </div>

              {(offGrid || dieselReplacementSelected || supplyStack.dieselGensets.length > 0) && (
                <div className="field-grid" style={{ marginTop: 16 }}>
                  <InputField
                    label="Total Monthly Diesel Spend (INR)"
                    type="number"
                    hint={offGrid || dieselReplacementSelected
                      ? 'Your current monthly fuel bill — critical for ROI analysis'
                      : 'Approx total monthly fuel spend (optional)'}
                    inputProps={{
                      value: supplyStack.monthlyDieselSpend ?? '',
                      onChange: (e) => updateSupplyStack({ monthlyDieselSpend: numOrNull(e.target.value) }),
                      min: 0,
                      placeholder: offGrid ? 'e.g. 800000' : 'e.g. 150000',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Other Power Sources ── */}
      <div className="card">
        <h2 className="card__title">Other Power Sources</h2>
        <label className={`not-relevant-toggle ${supplyStack.otherSourcesNotRelevant ? 'not-relevant-toggle--active' : ''}`}>
          <input
            type="checkbox"
            checked={supplyStack.otherSourcesNotRelevant}
            onChange={(e) => updateSupplyStack({ otherSourcesNotRelevant: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--color-warning)' }}
          />
          <span>Not relevant for this site</span>
        </label>

        {!supplyStack.otherSourcesNotRelevant && (
          <>
            {supplyStack.otherSources.map((src, idx) => {
              const needsPowerType = SOURCES_NEEDING_POWER_TYPE.includes(src.sourceType as typeof SOURCES_NEEDING_POWER_TYPE[number]);
              return (
                <div className="entry-card" key={src.id}>
                  <div className="entry-card__header">
                    <span className="entry-card__title">Source #{idx + 1}</span>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeOtherSource(src.id)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <div className="field-grid">
                    <SelectField
                      label="Source Type"
                      required
                      error={errors[`other_${src.id}_type`]}
                      options={SOURCE_TYPES.map((t) => ({ value: t, label: t }))}
                      selectProps={{
                        value: src.sourceType,
                        onChange: (e) =>
                          updateOtherSource(src.id, {
                            sourceType: e.target.value as typeof src.sourceType,
                            powerSource: '',
                          }),
                      }}
                    />
                    {needsPowerType && (
                      <SelectField
                        label="Source of Power"
                        required
                        error={errors[`other_${src.id}_powersource`]}
                        options={POWER_SOURCE_OPTIONS.map((p) => ({ value: p, label: p }))}
                        selectProps={{
                          value: src.powerSource,
                          onChange: (e) =>
                            updateOtherSource(src.id, { powerSource: e.target.value as typeof src.powerSource }),
                        }}
                      />
                    )}
                    <InputField
                      label="Monthly Energy (MWh)"
                      required
                      type="number"
                      error={errors[`other_${src.id}_energy`]}
                      inputProps={{
                        value: src.monthlyEnergyMwh ?? '',
                        onChange: (e) => updateOtherSource(src.id, { monthlyEnergyMwh: numOrNull(e.target.value) }),
                        min: 0,
                        placeholder: 'e.g. 150',
                      }}
                    />
                    <InputField
                      label="Avg Cost (INR/kWh)"
                      required
                      type="number"
                      error={errors[`other_${src.id}_cost`]}
                      inputProps={{
                        value: src.avgCostPerKwh ?? '',
                        onChange: (e) => updateOtherSource(src.id, { avgCostPerKwh: numOrNull(e.target.value) }),
                        min: 0,
                        step: '0.01',
                        placeholder: 'e.g. 5.20',
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <button className="btn btn--ghost" onClick={addOtherSource}>
              <Plus size={16} /> Add Source
            </button>
          </>
        )}
      </div>

      <StepNav />
    </div>
  );
}
