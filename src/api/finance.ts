import type { FinanceAccount, FinanceCategory, FinanceEntry, FinanceEntryKind, FinanceOverview } from '../types';
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
  date: string;
  note: string;
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
