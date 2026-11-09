import { dateLocaleTag, t } from '../i18n';
import type { FinanceEntry, TodayRates } from '../types';
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

/** «1 USD = 2,99 BYN» по хранимому курсу (основная валюта за 1 единицу валюты операции). */
export function formatRateQuote(currency: string, baseCurrency: string, rate: number): string {
  const quote = rateQuote(currency, baseCurrency);
  return `1 ${quote.unit} = ${formatRate(storedRateToDisplay(rate, quote.inverted))} ${quote.quote}`;
}

const RUB_RATE_LOT = 100;

/**
 * Курс перевода: `rate` — сколько toCurrency за 1 fromCurrency.
 * При участии RUB показываем, сколько другой валюты за 100 RUB.
 */
export function formatTransferRateQuote(fromCurrency: string, toCurrency: string, rate: number): string {
  if (fromCurrency !== 'RUB' && toCurrency !== 'RUB') {
    return formatRateQuote(fromCurrency, toCurrency, rate);
  }
  const other = fromCurrency === 'RUB' ? toCurrency : fromCurrency;
  const otherPer100Rub = fromCurrency === 'RUB' ? rate * RUB_RATE_LOT : RUB_RATE_LOT / rate;
  return `${RUB_RATE_LOT} RUB = ${formatRate(otherPer100Rub)} ${other}`;
}

export function todayRatesSourceLabel(todayRates: TodayRates, currency: string): string {
  if (todayRates.manual.includes(currency)) return t('financeRateSourceManual');
  if (!todayRates.market) return '';
  const time = new Date(todayRates.market.fetchedAt).toLocaleString(dateLocaleTag, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const source = todayRates.market.source === 'myfin' ? t('financeRateSourceMyfin') : t('financeRateSourceNbrb');
  return t('financeRateSourceMarket', { source, time });
}

/** Сегодняшний курс: сколько `to` за 1 единицу `from`. */
export function crossRate(todayRates: TodayRates | null, from: string, to: string): number | undefined {
  if (!todayRates) return undefined;
  const inBase = (code: string) => (code === todayRates.base ? 1 : todayRates.rates[code]);
  const fromRate = inBase(from);
  const toRate = inBase(to);
  return fromRate && toRate ? fromRate / toRate : undefined;
}

/** Сумма операции в основной валюте или null, если курса к ней нет. */
export function toBaseCents(
  entry: Pick<FinanceEntry, 'amount_cents' | 'currency' | 'rate' | 'rate_currency' | 'rate_mode'>,
  baseCurrency: string,
  todayRates?: TodayRates | null,
): number | null {
  if (entry.currency === baseCurrency) return entry.amount_cents;
  if (entry.rate_mode === 'floating') {
    const rate = todayRates?.base === baseCurrency ? todayRates.rates[entry.currency] : undefined;
    return rate ? Math.round(entry.amount_cents * rate) : null;
  }
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
