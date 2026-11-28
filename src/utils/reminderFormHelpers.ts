/**
 * Pure helpers for the Add Follow-up form (SmartRemindersView).
 *
 * The helper line explains what a follow-up is in plain Bangla. The form
 * mentions no service account or money account, so the distinct
 * "সার্ভিস অ্যাকাউন্ট (লগইন)" / "টাকার অ্যাকাউন্ট (ওয়ালেট)" labels do not
 * apply here — the only account-like field is the customer.
 */
export const REMINDER_HELPER_LINE =
  'ফলো-আপ হলো কাস্টমারকে মনে করিয়ে দেওয়া — যেমন পেমেন্ট বা সাবস্ক্রিপশন শেষ হওয়ার আগে।';

export type ReminderFormErrorTarget = 'customer' | 'title' | 'dueAt';

export interface ReminderFormErrorTargetInput {
  /** An existing (non-archived) customer is selected. */
  hasCustomer: boolean;
  /** The follow-up reason, as typed. */
  title: string;
  /** The due date & time value from the datetime-local input. */
  dueAt: string;
}

/**
 * Mirrors the check order of SmartRemindersView.submitReminder and returns
 * the field the user should be jumped to for the FIRST failing check, or
 * null when the form is valid. Pure — used by the Add Follow-up modal to
 * scroll to and focus the field that needs fixing.
 *
 * The check order follows the visual step order of the form, and the rules
 * match the save handler exactly: a customer must be selected, a reason
 * must be typed, and the due date & time must be a valid date. Notes and
 * priority are optional and live in the collapsed advanced section, so they
 * never produce an error target.
 */
export function getFirstReminderFormErrorTarget(
  input: ReminderFormErrorTargetInput,
): ReminderFormErrorTarget | null {
  if (!input.hasCustomer) return 'customer';
  if (!input.title.trim()) return 'title';
  if (
    input.dueAt.trim() === '' ||
    !Number.isFinite(new Date(input.dueAt).getTime())
  ) {
    return 'dueAt';
  }
  return null;
}
