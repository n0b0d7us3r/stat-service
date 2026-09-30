import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  label = 'Страницы',
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
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={18} />
        <span>Назад</span>
      </button>

      <span className="app-pagination-info">
        Страница {page} из {totalPages}
      </span>

      <button
        type="button"
        className="app-pagination-btn"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Следующая страница"
      >
        <span>Вперёд</span>
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
