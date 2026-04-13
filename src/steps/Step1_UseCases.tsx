import { Check } from 'lucide-react';
import { useFormStore } from '../store/useFormStore';
import { ErrorSummary } from '../components/ErrorSummary';
import { StepNav } from '../components/StepNav';
import { USE_CASE_OPTIONS, type UseCaseOption } from '../types';

export function Step1_UseCases() {
  const useCases = useFormStore((s) => s.formData.useCases);
  const update = useFormStore((s) => s.updateUseCases);
  const errors = useFormStore((s) => s.stepErrors[1]);

  function toggle(option: UseCaseOption) {
    const isSelected = useCases.selected.includes(option);
    const next = isSelected
      ? useCases.selected.filter((u) => u !== option)
      : [...useCases.selected, option];
    update({ selected: next });
  }

  return (
    <div>
      <ErrorSummary errors={errors} />

      <div className="card">
        <h2 className="card__title">What are the primary use cases for battery storage?</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 18 }}>
          Select all that apply. At least one use case is required.
        </p>

        {errors['usecases'] && (
          <span className="field__error" style={{ display: 'block', marginBottom: 12 }}>
            {errors['usecases']}
          </span>
        )}

        <div className="use-case-grid">
          {USE_CASE_OPTIONS.map((option) => {
            const selected = useCases.selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`use-case-chip ${selected ? 'use-case-chip--selected' : ''}`}
                onClick={() => toggle(option)}
                aria-pressed={selected}
              >
                <span className="use-case-chip__check">
                  {selected && <Check size={14} />}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {useCases.selected.includes('Other') && (
          <div className="field" style={{ marginTop: 16, maxWidth: 480 }}>
            <label className="field__label field__label--required" htmlFor="useCaseOther">
              Describe other use case
            </label>
            <input
              id="useCaseOther"
              className={`field__input ${errors['othertext'] ? 'field__input--error' : ''}`}
              value={useCases.otherText}
              onChange={(e) => update({ otherText: e.target.value })}
              placeholder="Describe your use case"
            />
            {errors['othertext'] && <span className="field__error">{errors['othertext']}</span>}
          </div>
        )}
      </div>

      <StepNav />
    </div>
  );
}
