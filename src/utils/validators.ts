import type { FormData, ValidationErrors, StepId } from '../types';
import { SOURCES_NEEDING_POWER_TYPE } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

function required(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return `${label} is required`;
  if (typeof value === 'string' && value.trim() === '') return `${label} is required`;
  return null;
}

function validEmail(value: string): string | null {
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address';
  return null;
}

function validPhone(value: string): string | null {
  const cleaned = value.replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(cleaned)) return 'Enter a valid phone number (10-15 digits, optional +country code)';
  return null;
}

function nonNegativeNumber(value: number | null, label: string): string | null {
  if (value !== null && value < 0) return `${label} must be non-negative`;
  return null;
}

export function isOffGrid(data: FormData): boolean {
  return data.company.gridConnection === 'Off-grid (no grid connection)';
}

export function isPartialGrid(data: FormData): boolean {
  return data.company.gridConnection === 'Partial (unreliable grid, primarily DG/other)';
}

export function hasGrid(data: FormData): boolean {
  return !isOffGrid(data);
}

export function validateStep0(data: FormData): ValidationErrors {
  const e: ValidationErrors = {};
  const c = data.company;

  const checks: [unknown, string][] = [
    [c.companyName, 'Company Name'],
    [c.siteName, 'Site Name'],
    [c.premisesType, 'Premises Type'],
    [c.gridConnection, 'Grid Connection'],
    [c.state, 'State'],
    [c.district, 'District'],
    [c.contactName, 'Contact Name'],
    [c.contactPhone, 'Contact Phone'],
    [c.contactEmail, 'Contact Email'],
  ];

  for (const [val, label] of checks) {
    const key = label.toLowerCase().replace(/[^a-z]/g, '');
    const err = required(val, label);
    if (err) e[key] = err;
  }

  if (c.premisesType === 'Other') {
    const err = required(c.premisesOtherText, 'Premises description');
    if (err) e['premisesothertext'] = err;
  }

  if (c.contactPhone && !e['contactphone']) {
    const err = validPhone(c.contactPhone);
    if (err) e['contactphone'] = err;
  }

  if (c.contactEmail && !e['contactemail']) {
    const err = validEmail(c.contactEmail);
    if (err) e['contactemail'] = err;
  }

  return e;
}

export function validateStep1(data: FormData): ValidationErrors {
  const e: ValidationErrors = {};
  if (data.useCases.selected.length === 0) {
    e['usecases'] = 'Select at least one use case';
  }
  if (data.useCases.selected.includes('Other') && !data.useCases.otherText.trim()) {
    e['othertext'] = 'Describe the other use case';
  }
  return e;
}

export function validateStep2(data: FormData): ValidationErrors {
  const e: ValidationErrors = {};
  const lp = data.loadProfile;

  if (lp.sanctionedLoad !== null) {
    const err = nonNegativeNumber(lp.sanctionedLoad, 'Sanctioned Load');
    if (err) e['sanctionedload'] = err;
  }
  if (lp.peakLoad !== null) {
    const err = nonNegativeNumber(lp.peakLoad, 'Peak Load');
    if (err) e['peakload'] = err;
  }

  if (lp.hourlyValues.length !== 24) {
    e['hourly'] = 'Exactly 24 hourly values required';
  } else {
    if (lp.hourlyValues.some((v) => v < 0)) {
      e['hourly'] = 'All hourly values must be non-negative';
    }
    if (lp.hourlyValues.every((v) => v === 0)) {
      e['hourly'] = 'At least one hourly value must be non-zero';
    }
  }

  if (lp.powerFactor !== null && (lp.powerFactor < 0 || lp.powerFactor > 1)) {
    e['powerfactor'] = 'Power factor must be between 0 and 1';
  }

  return e;
}

export function validateStep3(data: FormData): ValidationErrors {
  const e: ValidationErrors = {};
  const ss = data.supplyStack;

  // DISCOM only required for grid-connected sites
  if (!ss.discomNotApplicable) {
    if (ss.discom.sanctionedLoad === null) {
      e['discom_sanctionedload'] = 'DISCOM sanctioned load is required';
    } else {
      const err = nonNegativeNumber(ss.discom.sanctionedLoad, 'DISCOM sanctioned load');
      if (err) e['discom_sanctionedload'] = err;
    }
    if (ss.discom.monthlyBill === null) {
      e['discom_monthlybill'] = 'Monthly electricity bill is required';
    } else {
      const err = nonNegativeNumber(ss.discom.monthlyBill, 'Monthly bill');
      if (err) e['discom_monthlybill'] = err;
    }
  }

  if (!ss.dieselNotRelevant) {
    for (const g of ss.dieselGensets) {
      if (g.ratingKva === null) e[`diesel_${g.id}_rating`] = 'Rating is required';
      if (g.quantity === null) e[`diesel_${g.id}_qty`] = 'Quantity is required';
      if (g.runHoursPerDay === null)
        e[`diesel_${g.id}_hours`] = 'Run hours is required';
    }
  }

  if (!ss.otherSourcesNotRelevant) {
    for (const s of ss.otherSources) {
      if (!s.sourceType) e[`other_${s.id}_type`] = 'Source type is required';
      if (
        s.sourceType &&
        SOURCES_NEEDING_POWER_TYPE.includes(s.sourceType as (typeof SOURCES_NEEDING_POWER_TYPE)[number]) &&
        !s.powerSource
      ) {
        e[`other_${s.id}_powersource`] = 'Source of power is required';
      }
      if (s.monthlyEnergyMwh === null)
        e[`other_${s.id}_energy`] = 'Monthly energy is required';
      if (s.avgCostPerKwh === null)
        e[`other_${s.id}_cost`] = 'Average cost is required';
    }
  }

  return e;
}

export function validateStep4(data: FormData): ValidationErrors {
  const e: ValidationErrors = {};
  if (!data.consentGiven) {
    e['consent'] = 'You must agree to the declaration before submitting';
  }
  return e;
}

const VALIDATORS: Record<StepId, (data: FormData) => ValidationErrors> = {
  0: validateStep0,
  1: validateStep1,
  2: validateStep2,
  3: validateStep3,
  4: validateStep4,
};

export function validateStep(step: StepId, data: FormData): ValidationErrors {
  return VALIDATORS[step](data);
}
