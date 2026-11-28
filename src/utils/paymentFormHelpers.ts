export interface WalletMappingMethod {
  name: string;
  financialAccountId?: string;
}

export interface WalletMappingAccount {
  id: string;
  name: string;
}

/**
 * The wallet a payment method points to: the account configured on the
 * method, or an account whose name matches the method (bKash → the bKash
 * account). Pure — mirrors the mapping PaymentsView used inline.
 */
export function resolveMappedWalletAccountId(
  methodName: string,
  methods: WalletMappingMethod[],
  accounts: WalletMappingAccount[],
): string {
  return methods.find(method => method.name === methodName)?.financialAccountId
    || accounts.find(account => account.name.toLocaleLowerCase() === methodName.toLocaleLowerCase())?.id
    || '';
}

/**
 * The wallet a payment actually goes to: the seller's explicit pick wins,
 * otherwise the method's mapped wallet. Pure.
 */
export function resolvePaymentWalletAccountId(
  overrideAccountId: string,
  mappedAccountId: string,
): string {
  return overrideAccountId || mappedAccountId || '';
}

export type PaymentFormErrorTarget =
  | 'sale'
  | 'customer'
  | 'amount'
  | 'date'
  | 'method'
  | 'transactionId';

export interface PaymentFormErrorTargetInput {
  mode: 'sale' | 'advance' | 'apply-advance';
  saleId: string;
  saleCustomerId: string | undefined;
  customerFilter: string;
  amountMinor: number | null;
  maximumAdvanceApplicationMinor: number;
  saleDueMinor: number | null;
  status: 'paid' | 'pending' | 'failed';
  paymentDateValid: boolean;
  paymentDateIsFuture: boolean;
  methodActive: boolean;
  transactionIdRequired: boolean;
  transactionId: string;
}

/**
 * Mirrors the check order of PaymentsView.handleRecordPayment (non-collect
 * modes) and returns the field the user should be jumped to for the FIRST
 * failing check, or null when the form is valid. Pure — used by the Add
 * Payment modal to scroll to and focus the field that needs fixing.
 */
export function getFirstPaymentFormErrorTarget(
  input: PaymentFormErrorTargetInput,
): PaymentFormErrorTarget | null {
  if (input.mode !== 'advance' && !input.saleId) return 'sale';
  if (input.mode !== 'sale' && input.customerFilter === 'all') return 'customer';
  if (input.mode === 'apply-advance' && input.saleCustomerId !== input.customerFilter) return 'sale';
  if (input.amountMinor === null || input.amountMinor <= 0) return 'amount';
  if (input.mode === 'apply-advance' && input.amountMinor > input.maximumAdvanceApplicationMinor) return 'amount';
  if (
    input.mode === 'sale' &&
    input.status !== 'paid' &&
    input.saleDueMinor !== null &&
    input.amountMinor > input.saleDueMinor
  ) {
    return 'amount';
  }
  if (input.mode !== 'apply-advance' && (!input.paymentDateValid || input.paymentDateIsFuture)) return 'date';
  if (input.mode !== 'apply-advance' && !input.methodActive) return 'method';
  if (
    input.mode !== 'apply-advance' &&
    input.transactionIdRequired &&
    !input.transactionId.trim()
  ) {
    return 'transactionId';
  }
  return null;
}
