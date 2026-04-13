import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormStore } from '../store/useFormStore';
import { validateStep } from '../utils/validators';
import { wantsDiesel, wantsOpenAccess } from '../utils/useCaseRelevance';
import type { StepId } from '../types';

interface StepNavProps {
  onSubmit?: () => void;
}

export function StepNav({ onSubmit }: StepNavProps) {
  const currentStep = useFormStore((s) => s.currentStep);
  const setStep = useFormStore((s) => s.setStep);
  const formData = useFormStore((s) => s.formData);
  const setStepErrors = useFormStore((s) => s.setStepErrors);
  const clearStepErrors = useFormStore((s) => s.clearStepErrors);
  const syncSanctionedLoadToDiscom = useFormStore((s) => s.syncSanctionedLoadToDiscom);
  const updateSupplyStack = useFormStore((s) => s.updateSupplyStack);

  const isFirst = currentStep === 0;
  const isLast = currentStep === 4;
  const gridConnection = formData.company.gridConnection;

  function goNext() {
    const errors = validateStep(currentStep, formData);
    if (Object.keys(errors).length > 0) {
      setStepErrors(currentStep, errors);
      return;
    }
    clearStepErrors(currentStep);
    if (!isLast) {
      const nextStep = (currentStep + 1) as StepId;
      if (nextStep === 3) {
        const offGrid = gridConnection === 'Off-grid (no grid connection)';
        const useCases = formData.useCases.selected;
        const patch: Record<string, boolean> = {};
        if (offGrid) patch.discomNotApplicable = true;
        // Only pre-check "Not relevant" if the user hasn't manually added entries yet.
        // Never pre-dismiss diesel for off-grid — it's their primary power source.
        if (!offGrid && !wantsDiesel(useCases) && formData.supplyStack.dieselGensets.length === 0) {
          patch.dieselNotRelevant = true;
        }
        if (!wantsOpenAccess(useCases) && formData.supplyStack.otherSources.length === 0) {
          patch.otherSourcesNotRelevant = true;
        }
        if (Object.keys(patch).length > 0) updateSupplyStack(patch);
        syncSanctionedLoadToDiscom();
      }
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (!isFirst) {
      setStep((currentStep - 1) as StepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="step-nav">
      <button
        className="btn btn--secondary"
        onClick={goPrev}
        disabled={isFirst}
      >
        <ChevronLeft size={16} /> Back
      </button>

      {isLast ? (
        <button className="btn btn--primary" onClick={onSubmit}>
          Generate PDF Report
        </button>
      ) : (
        <button className="btn btn--primary" onClick={goNext}>
          Continue <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
