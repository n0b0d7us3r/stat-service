import { t } from '../i18n';

interface ModalActionsProps {
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  submitDisabled?: boolean;
  /** Основная кнопка сверху (для страницы финансов). */
  submitFirst?: boolean;
}

export function ModalActions({
  onCancel,
  submitLabel,
  pending = false,
  pendingLabel = t('saving'),
  submitDisabled = false,
  submitFirst = false,
}: ModalActionsProps) {
  const cancel = (
    <button type="button" className="modal-action-cancel" onClick={onCancel}>
      {t('cancel')}
    </button>
  );
  const submit = (
    <button type="submit" className="modal-action-submit" disabled={pending || submitDisabled}>
      {pending ? pendingLabel : submitLabel}
    </button>
  );

  return (
    <div className="modal-actions">
      {submitFirst ? (
        <>
          {submit}
          {cancel}
        </>
      ) : (
        <>
          {cancel}
          {submit}
        </>
      )}
    </div>
  );
}
