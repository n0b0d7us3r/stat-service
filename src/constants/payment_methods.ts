export const PAYMENT_METHOD_MAP: Record<number, string> = {
  1: 'Телефон',
  2: 'Карта',
  3: 'Аккаунт',
  4: 'Сим-карта'
};

export const getPaymentMethodLabel = (id: any): string => {
  if (!id) return '—';
  return PAYMENT_METHOD_MAP[Number(id)] || '—';
};
