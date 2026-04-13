import { Check } from 'lucide-react';
import { useFormStore } from '../store/useFormStore';
import { STEP_LABELS, type StepId } from '../types';

export function Stepper() {
  const currentStep = useFormStore((s) => s.currentStep);
  const setStep = useFormStore((s) => s.setStep);

  const steps = Object.entries(STEP_LABELS) as [string, string][];

  return (
    <nav className="stepper" aria-label="Form progress">
      {steps.map(([key, label]) => {
        const idx = Number(key) as StepId;
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        const classes = [
          'stepper__step',
          isActive && 'stepper__step--active',
          isCompleted && 'stepper__step--completed',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={key}
            className={classes}
            onClick={() => setStep(idx)}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="stepper__badge">
              {isCompleted ? <Check size={14} /> : idx + 1}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
