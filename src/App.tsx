import { useFormStore } from './store/useFormStore';
import { Stepper } from './components/Stepper';
import { Step0_CompanyProfile } from './steps/Step0_CompanyProfile';
import { Step1_UseCases } from './steps/Step1_UseCases';
import { Step2_LoadProfile } from './steps/Step2_LoadProfile';
import { Step3_SupplyStack } from './steps/Step3_SupplyStack';
import { Step4_Review } from './steps/Step4_Review';
import { Save } from 'lucide-react';

const STEPS = [Step0_CompanyProfile, Step1_UseCases, Step2_LoadProfile, Step3_SupplyStack, Step4_Review];

function formatLastSaved(ts: number | null): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'Just saved';
  if (diff < 60) return `Saved ${diff}s ago`;
  if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
  return `Saved ${Math.floor(diff / 3600)}h ago`;
}

export default function App() {
  const currentStep = useFormStore((s) => s.currentStep);
  const lastSaved = useFormStore((s) => s.lastSaved);
  const resetForm = useFormStore((s) => s.resetForm);

  const StepComponent = STEPS[currentStep];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__logo">B</div>
        <div>
          <div className="app-header__title">Battery Opportunity Intake</div>
          <div className="app-header__subtitle">C&I Energy Storage Assessment — India</div>
        </div>
        <div className="app-header__save-info">
          {lastSaved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={13} />
              {formatLastSaved(lastSaved)}
            </span>
          )}
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 4, fontSize: '0.75rem' }}
            onClick={() => {
              if (window.confirm('Reset all data and start over?')) resetForm();
            }}
          >
            Reset Draft
          </button>
        </div>
      </header>

      <Stepper />

      <main>
        <StepComponent />
      </main>
    </div>
  );
}
