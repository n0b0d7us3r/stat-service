import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { t } from '../i18n';
import '../styles/components/FieldHelpButton.css';

interface FieldHelpButtonProps {
  text: string;
  className?: string;
}

export function FieldHelpButton({ text, className = '' }: FieldHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div className={`field-help-root ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`field-help-btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={t('settingsHintButton')}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={17} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div id={tooltipId} className="field-help-popover" role="tooltip">
          <p>{text}</p>
        </div>
      )}
    </div>
  );
}
