import type { FinanceCategory, FinanceEntry, FinanceEntryKind, FinanceOverview } from '../types';
import { apiFetch } from './client';

export async function getFinanceOverview(from: string, to: string): Promise<FinanceOverview> {
  return apiFetch<FinanceOverview>(`/finance?from=${from}&to=${to}`);
}

export async function createFinanceEntry(input: {
  kind: FinanceEntryKind;
  amount: number;
  currency: string;
  categoryId: number;
  date: string;
  note: string;
}): Promise<FinanceEntry> {
  const { entry } = await apiFetch<{ entry: FinanceEntry }>('/finance/entries', {
    method: 'POST',
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
