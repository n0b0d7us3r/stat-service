import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { dateLocaleTag, t, weekdayLabels } from '../i18n';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import {
  formatPeriod,
  lastDaysPeriod,
  monthPeriod,
  yearPeriod,
  type FinancePeriod,
} from '../utils/finance';

interface FinancePeriodModalProps {
  period: FinancePeriod;
  onClose: () => void;
  onApply: (period: FinancePeriod) => void;
}

function monthDays(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(formatLocalDate(new Date(year, month, day)));
  }
  return cells;
}

export function FinancePeriodModal({ period, onClose, onApply }: FinancePeriodModalProps) {
  const today = new Date();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState<string | null>(period.to);
  const [view, setView] = useState(() => {
    const anchor = parseLocalDate(period.to);
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const presets: Array<{ label: string; period: FinancePeriod }> = [
    { label: t('financePeriodThisMonth'), period: monthPeriod(today) },
    { label: t('financePeriodLastMonth'), period: monthPeriod(today, -1) },
    { label: t('financePeriodLast30'), period: lastDaysPeriod(today, 30) },
    { label: t('financePeriodThisYear'), period: yearPeriod(today) },
  ];

  const selectPreset = (preset: FinancePeriod) => {
    setFrom(preset.from);
    setTo(preset.to);
    const anchor = parseLocalDate(preset.to);
    setView({ year: anchor.getFullYear(), month: anchor.getMonth() });
  };

  const handleDayClick = (date: string) => {
    if (to !== null || date < from) {
      setFrom(date);
      setTo(null);
      return;
    }
    setTo(date);
  };

  const shiftMonth = (delta: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const draft = { from, to: to ?? from };
  const todayKey = formatLocalDate(today);
  const monthTitle = new Date(view.year, view.month, 1).toLocaleDateString(dateLocaleTag, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal title={t('financePeriod')} isOpen onClose={onClose} className="glass-modal finance-period-modal">
      <form
        className="task-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
        }}
      >
        <div className="finance-period-presets">
          {presets.map((preset) => {
            const active = preset.period.from === draft.from && preset.period.to === draft.to;
            return (
              <button
                key={preset.label}
                type="button"
                className={`finance-period-preset${active ? ' is-active' : ''}`}
                onClick={() => selectPreset(preset.period)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="finance-calendar">
          <div className="finance-calendar-head">
            <button type="button" aria-label={t('financePrevMonth')} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <span>{monthTitle}</span>
            <button type="button" aria-label={t('financeNextMonth')} onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="finance-calendar-grid">
            {weekdayLabels.map((label) => (
              <span key={label} className="finance-calendar-weekday">{label}</span>
            ))}
            {monthDays(view.year, view.month).map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />;
              const inRange = date >= draft.from && date <= draft.to;
              const isEdge = date === draft.from || date === draft.to;
              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    'finance-calendar-day',
                    inRange ? 'is-in-range' : '',
                    isEdge ? 'is-edge' : '',
                    date === todayKey ? 'is-today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleDayClick(date)}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        </div>

        <p className="finance-period-summary">
          {to === null ? t('financePeriodPickEnd') : formatPeriod(draft)}
        </p>

        <ModalActions onCancel={onClose} submitLabel={t('financePeriodApply')} submitFirst />
      </form>
    </Modal>
  );
}
