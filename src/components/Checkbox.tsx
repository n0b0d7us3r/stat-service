import React from 'react';
import '../styles/components/Checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Checkbox({ checked, onChange, label, disabled = false, ariaLabel, className, children }: CheckboxProps) {
  return (
    <label className={['checkbox-wrapper', className].filter(Boolean).join(' ')}>
      <div className="checkbox-visual-container">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          onChange={(event) => onChange(event.target.checked)}
          className="checkbox-input-hidden"
        />
        {checked && <div className="checkbox-inner-square" />}
      </div>
      {label && <span className="checkbox-label-text">{label}</span>}
      {children}
    </label>
  );
}
