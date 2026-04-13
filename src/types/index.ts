export const PREMISES_TYPES = [
  'Industrial',
  'Commercial',
  'EV Charging',
  'Mining',
  'Data Center',
  'Cold Storage',
  'Hospital',
  'Airport/Port',
  'Rail/Metro',
  'Other',
] as const;

export type PremisesType = (typeof PREMISES_TYPES)[number];

export const USE_CASE_OPTIONS = [
  'Demand charge reduction',
  'Diesel replacement',
  'Power trading/arbitrage',
  'Time shifting for solar PV',
  'Peak shaving',
  'Backup/reliability',
  'EV charging optimization',
  'Open access optimization',
  'Carbon reduction target',
  'Other',
] as const;

export type UseCaseOption = (typeof USE_CASE_OPTIONS)[number];

export const SOURCE_TYPES = [
  'Open Access',
  'Captive Plant',
  'Bilateral PPA',
  'Third-party PPA',
  'Other',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCES_NEEDING_POWER_TYPE: SourceType[] = [
  'Captive Plant',
  'Bilateral PPA',
  'Third-party PPA',
  'Other',
];

export const POWER_SOURCE_OPTIONS = [
  'Solar',
  'Wind',
  'Solar + Wind Hybrid',
  'Biomass / Bagasse',
  'Small Hydro',
  'Cogeneration (CHP)',
  'Waste-to-Energy',
  'Thermal (Coal/Gas)',
  'Diesel',
  'Other',
] as const;

export type PowerSourceOption = (typeof POWER_SOURCE_OPTIONS)[number];

export const VOLTAGE_LEVELS = [
  'LT (Below 1 kV)',
  'HT (1 kV – 33 kV)',
  'EHT (Above 33 kV)',
] as const;

export type VoltageLevel = (typeof VOLTAGE_LEVELS)[number];

export const TARIFF_CATEGORIES = [
  'Industrial',
  'Commercial',
  'Industrial (HT)',
  'Industrial (EHT)',
  'Railway Traction',
  'Agricultural',
  'EV Charging',
  'Temporary',
  'Other / Not sure',
] as const;

export type TariffCategory = (typeof TARIFF_CATEGORIES)[number];

export const TOD_OPTIONS = [
  'Yes — Time of Day tariff applies',
  'No — Flat tariff',
  'Not sure',
] as const;

export type ToDOption = (typeof TOD_OPTIONS)[number];

export const OUTAGE_FREQUENCY_OPTIONS = [
  'Rare (< 1/month)',
  'Occasional (1–4/month)',
  'Frequent (1–3/week)',
  'Daily',
  'Multiple times/day',
] as const;

export type OutageFrequency = (typeof OUTAGE_FREQUENCY_OPTIONS)[number];

export const OUTAGE_DURATION_OPTIONS = [
  '< 15 minutes',
  '15 min – 1 hour',
  '1 – 4 hours',
  '4 – 8 hours',
  '> 8 hours',
] as const;

export type OutageDuration = (typeof OUTAGE_DURATION_OPTIONS)[number];

export const BUDGET_RANGE_OPTIONS = [
  'Under ₹1 Crore',
  '₹1 – 5 Crore',
  '₹5 – 15 Crore',
  '₹15 – 50 Crore',
  'Above ₹50 Crore',
  'Not decided / Exploratory',
] as const;

export type BudgetRange = (typeof BUDGET_RANGE_OPTIONS)[number];

export const GRID_CONNECTION_OPTIONS = [
  'Grid-connected',
  'Off-grid (no grid connection)',
  'Partial (unreliable grid, primarily DG/other)',
] as const;

export type GridConnection = (typeof GRID_CONNECTION_OPTIONS)[number];

// ─── Interfaces ───

export interface CompanyProfile {
  companyName: string;
  siteName: string;
  premisesType: PremisesType | '';
  premisesOtherText: string;
  gridConnection: GridConnection | '';
  state: string;
  district: string;
  locationDetails: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
}

export interface UseCases {
  selected: UseCaseOption[];
  otherText: string;
}

export interface LoadProfile {
  sanctionedLoad: number | null;
  peakLoad: number | null;
  hourlyValues: number[];
  avgMonthlyConsumption: number | null;
  powerFactor: number | null;
}

export interface DiscomDetails {
  sanctionedLoad: number | null;
  contractDemand: number | null;
  monthlyBill: number | null;
  tariffCategory: TariffCategory | '';
  voltageLevel: VoltageLevel | '';
  demandChargeRate: number | null;
  avgEnergyRate: number | null;
  todApplicable: ToDOption | '';
}

export interface PowerOutage {
  outageFrequency: OutageFrequency | '';
  typicalDuration: OutageDuration | '';
  backupHoursNeeded: number | null;
  estimatedOutageCost: number | null;
}

export interface SolarOnSite {
  hasSolar: boolean;
  installedCapacityKwp: number | null;
  avgDailyGenerationKwh: number | null;
}

export interface DieselGenset {
  id: string;
  ratingKva: number | null;
  quantity: number | null;
  runHoursPerDay: number | null;
  fuelCost: number | null;
}

export interface OtherPowerSource {
  id: string;
  sourceType: SourceType | '';
  powerSource: PowerSourceOption | '';
  monthlyEnergyMwh: number | null;
  avgCostPerKwh: number | null;
}

export interface SupplyStack {
  discom: DiscomDetails;
  discomNotApplicable: boolean;
  powerOutage: PowerOutage;
  solarOnSite: SolarOnSite;
  dieselNotRelevant: boolean;
  dieselGensets: DieselGenset[];
  monthlyDieselSpend: number | null;
  otherSourcesNotRelevant: boolean;
  otherSources: OtherPowerSource[];
}

export interface FormData {
  company: CompanyProfile;
  useCases: UseCases;
  loadProfile: LoadProfile;
  supplyStack: SupplyStack;
  budgetRange: BudgetRange | '';
  consentGiven: boolean;
}

export interface ValidationErrors {
  [key: string]: string;
}

export type StepId = 0 | 1 | 2 | 3 | 4;

export const STEP_LABELS: Record<StepId, string> = {
  0: 'Company & Site',
  1: 'Use Cases',
  2: 'Load Profile',
  3: 'Supply Stack',
  4: 'Review & Submit',
};
