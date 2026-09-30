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
  pendingLabel = 'Сохранение...',
  submitDisabled = false,
}: ModalActionsProps) {
  return (
    <div className="modal-actions">
      <button type="button" className="modal-action-cancel" onClick={onCancel}>
        Отмена
      </button>
      <button type="submit" className="modal-action-submit" disabled={pending || submitDisabled}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
