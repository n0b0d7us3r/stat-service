import type {
  FinanceAccount,
  FinanceBalance,
  FinanceCategory,
  FinanceEntry,
  FinanceEntryKind,
  FinanceOverview,
  FinanceRateMode,
  FinanceTransfer,
  TodayRates,
} from '../types';
import { apiFetch } from './client';

export async function getFinanceOverview(from: string, to: string): Promise<FinanceOverview> {
  return apiFetch<FinanceOverview>(`/finance?from=${from}&to=${to}`);
}

export interface FinanceEntryInput {
  amount: number;
  currency: string;
  categoryId: number;
  accountId: number;
  rate: number | null;
  rateMode: FinanceRateMode;
  date: string;
  note: string;
}

export interface FinanceTransferInput {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  toAmount: number;
  currency: string;
  toCurrency: string;
  fee: number;
  date: string;
  note: string;
}

export async function createFinanceTransfer(input: FinanceTransferInput): Promise<FinanceTransfer> {
  const { transfer } = await apiFetch<{ transfer: FinanceTransfer }>('/finance/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return transfer;
}

export async function updateFinanceTransfer(transferId: number, input: FinanceTransferInput): Promise<FinanceTransfer> {
  const { transfer } = await apiFetch<{ transfer: FinanceTransfer }>(`/finance/transfers/${transferId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return transfer;
}

export async function deleteFinanceTransfer(transferId: number): Promise<void> {
  await apiFetch(`/finance/transfers/${transferId}`, { method: 'DELETE' });
}

export async function getFinanceBalances(): Promise<{ balances: FinanceBalance[]; rates: TodayRates }> {
  return apiFetch<{ balances: FinanceBalance[]; rates: TodayRates }>('/finance/balances');
}

export async function getTodayRates(): Promise<TodayRates> {
  const { rates } = await apiFetch<{ rates: TodayRates }>('/finance/rates');
  return rates;
}

export async function refreshTodayRates(): Promise<TodayRates> {
  const { rates } = await apiFetch<{ rates: TodayRates }>('/finance/rates/refresh', { method: 'POST' });
  return rates;
}

export async function setRateOverride(rates: Record<string, number>): Promise<TodayRates> {
  const { rates: next } = await apiFetch<{ rates: TodayRates }>('/finance/rates/override', {
    method: 'PUT',
    body: JSON.stringify({ rates }),
  });
  return next;
}

export async function clearRateOverride(): Promise<TodayRates> {
  const { rates } = await apiFetch<{ rates: TodayRates }>('/finance/rates/override', { method: 'DELETE' });
  return rates;
}

export async function createFinanceEntry(input: FinanceEntryInput & { kind: FinanceEntryKind }): Promise<FinanceEntry> {
  const { entry } = await apiFetch<{ entry: FinanceEntry }>('/finance/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return entry;
}

export async function updateFinanceEntry(entryId: number, input: FinanceEntryInput): Promise<FinanceEntry> {
  const { entry } = await apiFetch<{ entry: FinanceEntry }>(`/finance/entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return entry;
}

export async function deleteFinanceEntry(entryId: number): Promise<void> {
  await apiFetch(`/finance/entries/${entryId}`, { method: 'DELETE' });
}

export async function createFinanceCategory(input: {
  kind: FinanceEntryKind;
  name: string;
  color: string;
  icon: string;
}): Promise<FinanceCategory> {
  const { category } = await apiFetch<{ category: FinanceCategory }>('/finance/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return category;
}

export async function deleteFinanceCategory(categoryId: number): Promise<void> {
  await apiFetch(`/finance/categories/${categoryId}`, { method: 'DELETE' });
}

export async function createFinanceAccount(input: {
  name: string;
  color: string;
  icon: string;
}): Promise<FinanceAccount> {
  const { account } = await apiFetch<{ account: FinanceAccount }>('/finance/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return account;
}

export async function deleteFinanceAccount(accountId: number): Promise<void> {
  await apiFetch(`/finance/accounts/${accountId}`, { method: 'DELETE' });
}
