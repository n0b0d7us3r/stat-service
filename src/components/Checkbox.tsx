import React from 'react';
import '../styles/components/Checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="checkbox-wrapper">
      <div className="checkbox-visual-container">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="checkbox-input-hidden"
        />
        {checked && <div className="checkbox-inner-square" />}
      </div>
      <span className="checkbox-label-text">{label}</span>
    </label>
  );
}