import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FormData,
  StepId,
  CompanyProfile,
  UseCases,
  LoadProfile,
  SupplyStack,
  DieselGenset,
  OtherPowerSource,
  PowerSourceOption,
  BudgetRange,
  PowerOutage,
  SolarOnSite,
} from '../types';

const DEFAULT_HOURLY = Array(24).fill(0);

function createDefaultCompany(): CompanyProfile {
  return {
    companyName: '',
    siteName: '',
    premisesType: '',
    premisesOtherText: '',
    gridConnection: '',
    state: '',
    district: '',
    locationDetails: '',
    contactName: '',
    contactRole: '',
    contactPhone: '',
    contactEmail: '',
  };
}

function createDefaultUseCases(): UseCases {
  return { selected: [], otherText: '' };
}

function createDefaultLoadProfile(): LoadProfile {
  return {
    sanctionedLoad: null,
    peakLoad: null,
    hourlyValues: [...DEFAULT_HOURLY],
    avgMonthlyConsumption: null,
    powerFactor: null,
  };
}

function createDefaultPowerOutage(): PowerOutage {
  return {
    outageFrequency: '',
    typicalDuration: '',
    backupHoursNeeded: null,
    estimatedOutageCost: null,
  };
}

function createDefaultSolarOnSite(): SolarOnSite {
  return {
    hasSolar: false,
    installedCapacityKwp: null,
    avgDailyGenerationKwh: null,
  };
}

function createDefaultSupplyStack(): SupplyStack {
  return {
    discom: {
      sanctionedLoad: null,
      contractDemand: null,
      monthlyBill: null,
      tariffCategory: '',
      voltageLevel: '',
      demandChargeRate: null,
      avgEnergyRate: null,
      todApplicable: '',
    },
    discomNotApplicable: false,
    powerOutage: createDefaultPowerOutage(),
    solarOnSite: createDefaultSolarOnSite(),
    dieselNotRelevant: false,
    dieselGensets: [],
    monthlyDieselSpend: null,
    otherSourcesNotRelevant: false,
    otherSources: [],
  };
}

export function createDefaultFormData(): FormData {
  return {
    company: createDefaultCompany(),
    useCases: createDefaultUseCases(),
    loadProfile: createDefaultLoadProfile(),
    supplyStack: createDefaultSupplyStack(),
    budgetRange: '',
    consentGiven: false,
  };
}

interface FormStore {
  currentStep: StepId;
  formData: FormData;
  stepErrors: Record<StepId, Record<string, string>>;
  lastSaved: number | null;

  syncSanctionedLoadToDiscom: () => void;
  setStep: (step: StepId) => void;
  updateCompany: (patch: Partial<CompanyProfile>) => void;
  updateUseCases: (patch: Partial<UseCases>) => void;
  updateLoadProfile: (patch: Partial<LoadProfile>) => void;
  setHourlyValue: (hour: number, value: number) => void;
  setAllHourlyValues: (values: number[]) => void;
  updateSupplyStack: (patch: Partial<SupplyStack>) => void;
  updatePowerOutage: (patch: Partial<PowerOutage>) => void;
  updateSolarOnSite: (patch: Partial<SolarOnSite>) => void;
  addDieselGenset: () => void;
  updateDieselGenset: (id: string, patch: Partial<DieselGenset>) => void;
  removeDieselGenset: (id: string) => void;
  addOtherSource: () => void;
  updateOtherSource: (id: string, patch: Partial<OtherPowerSource>) => void;
  removeOtherSource: (id: string) => void;
  setBudgetRange: (value: BudgetRange | '') => void;
  setConsent: (value: boolean) => void;
  setStepErrors: (step: StepId, errors: Record<string, string>) => void;
  clearStepErrors: (step: StepId) => void;
  resetForm: () => void;
}

let idCounter = Date.now();
function genId(): string {
  return (++idCounter).toString(36);
}

export const useFormStore = create<FormStore>()(
  persist(
    (set) => ({
      currentStep: 0 as StepId,
      formData: createDefaultFormData(),
      stepErrors: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
      lastSaved: null,

      syncSanctionedLoadToDiscom: () =>
        set((s) => {
          if (s.formData.supplyStack.discomNotApplicable) return {};
          const lpLoad = s.formData.loadProfile.sanctionedLoad;
          if (lpLoad !== null && s.formData.supplyStack.discom.sanctionedLoad === null) {
            return {
              formData: {
                ...s.formData,
                supplyStack: {
                  ...s.formData.supplyStack,
                  discom: { ...s.formData.supplyStack.discom, sanctionedLoad: lpLoad },
                },
              },
            };
          }
          return {};
        }),

      setStep: (step) => set({ currentStep: step }),

      updateCompany: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            company: { ...s.formData.company, ...patch },
          },
          lastSaved: Date.now(),
        })),

      updateUseCases: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            useCases: { ...s.formData.useCases, ...patch },
          },
          lastSaved: Date.now(),
        })),

      updateLoadProfile: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            loadProfile: { ...s.formData.loadProfile, ...patch },
          },
          lastSaved: Date.now(),
        })),

      setHourlyValue: (hour, value) =>
        set((s) => {
          const newValues = [...s.formData.loadProfile.hourlyValues];
          newValues[hour] = Math.max(0, value);
          return {
            formData: {
              ...s.formData,
              loadProfile: { ...s.formData.loadProfile, hourlyValues: newValues },
            },
            lastSaved: Date.now(),
          };
        }),

      setAllHourlyValues: (values) =>
        set((s) => ({
          formData: {
            ...s.formData,
            loadProfile: {
              ...s.formData.loadProfile,
              hourlyValues: values.map((v) => Math.max(0, v)),
            },
          },
          lastSaved: Date.now(),
        })),

      updateSupplyStack: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: { ...s.formData.supplyStack, ...patch },
          },
          lastSaved: Date.now(),
        })),

      updatePowerOutage: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              powerOutage: { ...s.formData.supplyStack.powerOutage, ...patch },
            },
          },
          lastSaved: Date.now(),
        })),

      updateSolarOnSite: (patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              solarOnSite: { ...s.formData.supplyStack.solarOnSite, ...patch },
            },
          },
          lastSaved: Date.now(),
        })),

      addDieselGenset: () =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              dieselGensets: [
                ...s.formData.supplyStack.dieselGensets,
                {
                  id: genId(),
                  ratingKva: null,
                  quantity: null,
                  runHoursPerDay: null,
                  fuelCost: null,
                },
              ],
            },
          },
          lastSaved: Date.now(),
        })),

      updateDieselGenset: (id, patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              dieselGensets: s.formData.supplyStack.dieselGensets.map((g) =>
                g.id === id ? { ...g, ...patch } : g
              ),
            },
          },
          lastSaved: Date.now(),
        })),

      removeDieselGenset: (id) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              dieselGensets: s.formData.supplyStack.dieselGensets.filter(
                (g) => g.id !== id
              ),
            },
          },
          lastSaved: Date.now(),
        })),

      addOtherSource: () =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              otherSources: [
                ...s.formData.supplyStack.otherSources,
                {
                  id: genId(),
                  sourceType: '',
                  powerSource: '' as PowerSourceOption | '',
                  monthlyEnergyMwh: null,
                  avgCostPerKwh: null,
                },
              ],
            },
          },
          lastSaved: Date.now(),
        })),

      updateOtherSource: (id, patch) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              otherSources: s.formData.supplyStack.otherSources.map((src) =>
                src.id === id ? { ...src, ...patch } : src
              ),
            },
          },
          lastSaved: Date.now(),
        })),

      removeOtherSource: (id) =>
        set((s) => ({
          formData: {
            ...s.formData,
            supplyStack: {
              ...s.formData.supplyStack,
              otherSources: s.formData.supplyStack.otherSources.filter(
                (src) => src.id !== id
              ),
            },
          },
          lastSaved: Date.now(),
        })),

      setBudgetRange: (value) =>
        set((s) => ({
          formData: { ...s.formData, budgetRange: value },
          lastSaved: Date.now(),
        })),

      setConsent: (value) =>
        set((s) => ({
          formData: { ...s.formData, consentGiven: value },
        })),

      setStepErrors: (step, errors) =>
        set((s) => ({
          stepErrors: { ...s.stepErrors, [step]: errors },
        })),

      clearStepErrors: (step) =>
        set((s) => ({
          stepErrors: { ...s.stepErrors, [step]: {} },
        })),

      resetForm: () =>
        set({
          currentStep: 0 as StepId,
          formData: createDefaultFormData(),
          stepErrors: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
          lastSaved: null,
        }),
    }),
    {
      name: 'battery-intake-draft',
      version: 3,
      migrate: () => {
        return {
          currentStep: 0 as StepId,
          formData: createDefaultFormData(),
          stepErrors: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
          lastSaved: null,
        };
      },
    }
  )
);
