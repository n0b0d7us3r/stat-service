import { useEffect, type ReactNode } from 'react';
import '../styles/components/Modal.css';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  headerExtra?: ReactNode;
}

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  className = '',
  overlayClassName = '',
  headerExtra,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`modal-overlay ${overlayClassName}`.trim()}>
      <div
        className={`modal-window app-border-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          {headerExtra && <div className="modal-header-extra">{headerExtra}</div>}
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
