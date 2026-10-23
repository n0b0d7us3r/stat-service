import { t } from '../i18n';

interface ModalActionsProps {
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  submitDisabled?: boolean;
}

export function ModalActions({
  onCancel,
  submitLabel,
  pending = false,
  pendingLabel = t('saving'),
  submitDisabled = false,
}: ModalActionsProps) {
  return (
    <div className="modal-actions">
      <button type="button" className="modal-action-cancel" onClick={onCancel}>
        {t('cancel')}
      </button>
      <button type="submit" className="modal-action-submit" disabled={pending || submitDisabled}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
