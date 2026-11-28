/**
 * Pure helpers for the Add/Edit Expense form (ExpensesView).
 *
 * The helper line explains what an expense is in plain Bangla, and the
 * money account is always called a "টাকার অ্যাকাউন্ট (ওয়ালেট)" — never a
 * plain "অ্যাকাউন্ট", and never confused with the service login
 * ("সার্ভিস অ্যাকাউন্ট (লগইন)").
 */
export const EXPENSE_HELPER_LINE =
  'খরচ হলো টাকা বাইরে যাওয়া — কোন টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে গেল তা এখানে লেখা হয়।';

export type ExpenseFormErrorTarget =
  | 'account'
  | 'category'
  | 'amount'
  | 'date'
  | 'description';

export interface ExpenseFormErrorTargetInput {
  /** An enabled financial account is selected. */
  hasAccount: boolean;
  /** An enabled expense category is selected. */
  hasCategory: boolean;
  amount: string;
  date: string;
  description: string;
}

function isValidDateString(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Date.parse(`${value.trim()}T00:00:00`));
}

/**
 * Mirrors the check order of ExpensesView.saveExpense and returns the field
 * the user should be jumped to for the FIRST failing check, or null when the
 * form is valid. Pure — used by the Add/Edit Expense modal to scroll to and
 * focus the field that needs fixing.
 *
 * The check order follows the visual step order of the form, and the rules
 * match the save handler exactly: the account must be enabled, the category
 * must be enabled, the amount must be greater than zero, the date must be
 * valid, and a description is required. Vendor, reference and notes are
 * optional and live in the collapsed advanced section, so they never produce
 * an error target.
 */
export function getFirstExpenseFormErrorTarget(
  input: ExpenseFormErrorTargetInput,
): ExpenseFormErrorTarget | null {
  if (!input.hasAccount) return 'account';
  if (!input.hasCategory) return 'category';
  if (
    input.amount.trim() === '' ||
    !Number.isFinite(Number(input.amount)) ||
    Number(input.amount) <= 0
  ) {
    return 'amount';
  }
  if (!isValidDateString(input.date)) return 'date';
  if (!input.description.trim()) return 'description';
  return null;
}
