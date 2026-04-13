import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

interface InputFieldProps extends BaseProps {
  type?: 'text' | 'email' | 'tel' | 'number';
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}

interface SelectFieldProps extends BaseProps {
  options: { value: string; label: string }[];
  selectProps: SelectHTMLAttributes<HTMLSelectElement>;
}

interface TextareaFieldProps extends BaseProps {
  textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement>;
}

export function InputField({ label, required, error, hint, type = 'text', inputProps, className }: InputFieldProps) {
  const id = inputProps.id || inputProps.name || label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id} className={`field__label ${required ? 'field__label--required' : ''}`}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`field__input ${error ? 'field__input--error' : ''}`}
        {...inputProps}
      />
      {error && <span className="field__error">{error}</span>}
      {hint && !error && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function SelectField({ label, required, error, hint, options, selectProps, className }: SelectFieldProps) {
  const id = selectProps.id || selectProps.name || label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id} className={`field__label ${required ? 'field__label--required' : ''}`}>
        {label}
      </label>
      <select
        id={id}
        className={`field__input ${error ? 'field__input--error' : ''}`}
        {...selectProps}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="field__error">{error}</span>}
      {hint && !error && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function TextareaField({ label, required, error, hint, textareaProps, className }: TextareaFieldProps) {
  const id = textareaProps.id || textareaProps.name || label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id} className={`field__label ${required ? 'field__label--required' : ''}`}>
        {label}
      </label>
      <textarea
        id={id}
        className={`field__input field__textarea ${error ? 'field__input--error' : ''}`}
        {...textareaProps}
      />
      {error && <span className="field__error">{error}</span>}
      {hint && !error && <span className="field__hint">{hint}</span>}
    </div>
  );
}
