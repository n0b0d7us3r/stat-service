import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../i18n';
import '../styles/components/Pagination.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = t('pages'),
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="app-pagination" aria-label={label}>
      <button
        type="button"
        className="app-pagination-btn"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label={t('prevPage')}
      >
        <ChevronLeft size={18} />
        <span>{t('back')}</span>
      </button>

      <span className="app-pagination-info">
        {t('pageOf', { page, total: totalPages })}
      </span>

      <button
        type="button"
        className="app-pagination-btn"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label={t('nextPage')}
      >
        <span>{t('forward')}</span>
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
