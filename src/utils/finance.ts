import { dateLocaleTag } from '../i18n';
import { formatLocalDate, parseLocalDate } from './date';

export const FINANCE_CURRENCIES = ['BYN', 'USD', 'EUR', 'RUB', 'PLN', 'CNY'] as const;
export const DEFAULT_CURRENCY = 'BYN';

export const FINANCE_COLORS = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#5ac8fa',
  '#007aff',
  '#5856d6',
  '#ff2d55',
  '#af52de',
  '#a2845e',
  '#8e8e93',
  '#d9a59a',
];

const amountFormatter = new Intl.NumberFormat(dateLocaleTag, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat(dateLocaleTag, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatAmount(cents: number): string {
  return amountFormatter.format(cents / 100);
}

export function formatMoney(cents: number, currency: string): string {
  return `${amountFormatter.format(cents / 100)} ${currency}`;
}

const rateFormatter = new Intl.NumberFormat(dateLocaleTag, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export function formatRate(rate: number): string {
  return rateFormatter.format(rate);
}

/** От самой дорогой к самой дешёвой: курс показывается за 1 единицу более дорогой валюты. */
const CURRENCY_STRENGTH = ['EUR', 'USD', 'BYN', 'PLN', 'CNY', 'RUB'];

function strengthRank(code: string): number {
  const index = CURRENCY_STRENGTH.indexOf(code);
  return index === -1 ? CURRENCY_STRENGTH.length : index;
}

export interface RateQuote {
  unit: string;
  quote: string;
  /** true, если в интерфейсе вводится обратный курс (сколько валюты операции за 1 основную). */
  inverted: boolean;
}

/** `rate` всегда хранится как «основная валюта за 1 единицу валюты операции». */
export function rateQuote(currency: string, baseCurrency: string): RateQuote {
  const inverted = strengthRank(currency) > strengthRank(baseCurrency);
  return inverted
    ? { unit: baseCurrency, quote: currency, inverted }
    : { unit: currency, quote: baseCurrency, inverted };
}

export function displayRateToStored(value: number, inverted: boolean): number {
  return inverted ? 1 / value : value;
}

export function storedRateToDisplay(rate: number, inverted: boolean): number {
  return inverted ? 1 / rate : rate;
}

/** Сумма операции в основной валюте или null, если курса к ней нет. */
export function toBaseCents(
  entry: { amount_cents: number; currency: string; rate: number | null; rate_currency: string | null },
  baseCurrency: string,
): number | null {
  if (entry.currency === baseCurrency) return entry.amount_cents;
  if (entry.rate != null && entry.rate_currency === baseCurrency) {
    return Math.round(entry.amount_cents * entry.rate);
  }
  return null;
}

export function formatAmountCompact(cents: number): string {
  return compactFormatter.format(cents / 100);
}

export interface FinancePeriod {
  from: string;
  to: string;
}

export function monthPeriod(date: Date, offset = 0): FinancePeriod {
  const start = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { from: formatLocalDate(start), to: formatLocalDate(end) };
}

export function yearPeriod(date: Date): FinancePeriod {
  return {
    from: formatLocalDate(new Date(date.getFullYear(), 0, 1)),
    to: formatLocalDate(new Date(date.getFullYear(), 11, 31)),
  };
}

export function lastDaysPeriod(date: Date, days: number): FinancePeriod {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (days - 1));
  return { from: formatLocalDate(start), to: formatLocalDate(date) };
}

export function formatPeriod(period: FinancePeriod): string {
  const from = parseLocalDate(period.from);
  const to = parseLocalDate(period.to);
  const sameYear = from.getFullYear() === to.getFullYear();
  const isWholeMonth = from.getDate() === 1
    && to.getDate() === new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate()
    && sameYear
    && from.getMonth() === to.getMonth();

  if (isWholeMonth) {
    return from.toLocaleDateString(dateLocaleTag, { month: 'long', year: 'numeric' });
  }
  if (period.from === period.to) {
    return from.toLocaleDateString(dateLocaleTag, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const fromLabel = from.toLocaleDateString(dateLocaleTag, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const toLabel = to.toLocaleDateString(dateLocaleTag, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fromLabel} – ${toLabel}`;
}

export interface FinanceBucket {
  key: string;
  label: string;
  title: string;
}

export function periodBuckets(period: FinancePeriod): { buckets: FinanceBucket[]; keyOf: (date: string) => string } {
  const from = parseLocalDate(period.from);
  const to = parseLocalDate(period.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (days <= 31) {
    const buckets: FinanceBucket[] = [];
    for (let index = 0; index < days; index += 1) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
      buckets.push({
        key: formatLocalDate(day),
        label: String(day.getDate()),
        title: day.toLocaleDateString(dateLocaleTag, { day: 'numeric', month: 'long' }),
      });
    }
    return { buckets, keyOf: (date) => date };
  }

  const buckets: FinanceBucket[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const multiYear = from.getFullYear() !== to.getFullYear();
  while (cursor <= to) {
    buckets.push({
      key: formatLocalDate(cursor).slice(0, 7),
      label: cursor.toLocaleDateString(dateLocaleTag, { month: 'short' }).replace('.', ''),
      title: cursor.toLocaleDateString(dateLocaleTag, {
        month: 'long',
        ...(multiYear ? { year: 'numeric' } : {}),
      }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return { buckets, keyOf: (date) => date.slice(0, 7) };
}
