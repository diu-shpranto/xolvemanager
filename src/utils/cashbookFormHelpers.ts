export type CashbookModalKind =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'adjustment'
  | 'account'
  | 'edit-account';

/**
 * One short helper line per kind, shown at the top of the Cashbook entry
 * form. Each line explains what the kind means in plain Bangla, and every
 * money account is called a "টাকার অ্যাকাউন্ট (ওয়ালেট)" — never a plain
 * "অ্যাকাউন্ট", and never confused with the service login
 * ("সার্ভিস অ্যাকাউন্ট (লগইন)").
 */
export const CASHBOOK_KIND_HELPER_LINES: Record<CashbookModalKind, string> = {
  account:
    'টাকার অ্যাকাউন্ট হলো টাকা রাখার জায়গা — যেমন বিকাশ নম্বর বা ক্যাশের ড্রয়ার।',
  'edit-account':
    'টাকার অ্যাকাউন্ট হলো টাকা রাখার জায়গা — যেমন বিকাশ নম্বর বা ক্যাশের ড্রয়ার।',
  expense:
    'খরচ হলো টাকা বাইরে যাওয়া — কোন টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে গেল তা এখানে লেখা হয়।',
  income:
    'ইনকাম হলো টাকা ভেতরে আসা — কোন টাকার অ্যাকাউন্টে (ওয়ালেটে) এলো তা এখানে লেখা হয়।',
  transfer:
    'ট্রান্সফার হলো এক টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে আরেকটায় টাকা সরানো।',
  adjustment:
    'সমন্বয় হলো হিসাব মেলানো — ব্যালেন্স ঠিক করতে টাকা যোগ বা বাদ দেওয়া।',
};

export type CashbookFormErrorTarget =
  | 'accountName'
  | 'openingBalance'
  | 'openingBalanceDate'
  | 'account'
  | 'toAccount'
  | 'category'
  | 'amount'
  | 'date'
  | 'description';

export interface CashbookFormErrorTargetInput {
  kind: CashbookModalKind;
  accountName: string;
  openingBalance: string;
  openingBalanceDate: string;
  hasAccount: boolean;
  hasDestination: boolean;
  sameCurrency: boolean;
  categoryId: string;
  amount: string;
  date: string;
  description: string;
}

function isValidDateString(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Date.parse(`${value.trim()}T00:00:00`));
}

/**
 * Mirrors the check order of CashbookView.validateCashbookForm and returns
 * the field the user should be jumped to for the FIRST failing check, or
 * null when the form is valid. Pure — used by the Cashbook entry modal to
 * scroll to and focus the field that needs fixing.
 *
 * The check order follows the visual step order of each kind, and the rules
 * match the save handler exactly: transfers need a destination in the same
 * currency, and only adjustments accept a zero or negative amount.
 */
export function getFirstCashbookFormErrorTarget(
  input: CashbookFormErrorTargetInput,
): CashbookFormErrorTarget | null {
  if (input.kind === 'account') {
    if (!input.accountName.trim()) return 'accountName';
    if (input.openingBalance.trim() === '' || !Number.isFinite(Number(input.openingBalance))) {
      return 'openingBalance';
    }
    if (!isValidDateString(input.openingBalanceDate)) return 'openingBalanceDate';
    return null;
  }
  if (input.kind === 'edit-account') {
    if (!input.accountName.trim()) return 'accountName';
    return null;
  }
  if (!input.hasAccount) return 'account';
  if (input.kind === 'transfer') {
    if (!input.hasDestination) return 'toAccount';
    if (!input.sameCurrency) return 'toAccount';
  }
  if (input.kind === 'expense' || input.kind === 'income') {
    if (!input.categoryId) return 'category';
  }
  if (input.amount.trim() === '' || !Number.isFinite(Number(input.amount))) return 'amount';
  if (input.kind !== 'adjustment' && Number(input.amount) <= 0) return 'amount';
  if (!isValidDateString(input.date)) return 'date';
  if (input.kind !== 'transfer' && !input.description.trim()) return 'description';
  return null;
}
