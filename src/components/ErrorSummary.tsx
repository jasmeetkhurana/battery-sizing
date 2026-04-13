import type { ValidationErrors } from '../types';

interface ErrorSummaryProps {
  errors: ValidationErrors;
}

export function ErrorSummary({ errors }: ErrorSummaryProps) {
  const entries = Object.values(errors);
  if (entries.length === 0) return null;

  return (
    <div className="error-summary" role="alert">
      <div className="error-summary__title">Please fix the following:</div>
      <ul className="error-summary__list">
        {entries.map((msg, i) => (
          <li key={i}>• {msg}</li>
        ))}
      </ul>
    </div>
  );
}
