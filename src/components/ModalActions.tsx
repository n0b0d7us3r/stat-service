interface ModalActionsProps {
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
  pendingLabel?: string;
}

export function ModalActions({
  onCancel,
  submitLabel,
  pending = false,
  pendingLabel = 'Сохранение...',
}: ModalActionsProps) {
  return (
    <div className="modal-actions">
      <button type="button" className="modal-action-cancel" onClick={onCancel}>
        Отмена
      </button>
      <button type="submit" className="modal-action-submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
