export type ProfileFormErrorTarget =
  | 'account'
  | 'profileName'
  | 'pin'
  | 'dates';

export interface ProfileFormErrorTargetInput {
  accountId: string;
  profileName: string;
  pin: string;
  startDate: string;
  expiryDate: string;
}

/**
 * Mirrors the check order of ProfilesView.handleAddProfile and returns the
 * field the user should be jumped to for the FIRST failing check, or null
 * when the form is valid. Pure — used by the Add Profile modal to scroll to
 * and focus the field that needs fixing (opening the collapsed advanced
 * section first when the failing field lives there).
 *
 * The date-order rule matches ProfileEditModal: the expiry date must be on
 * or after the start date.
 */
export function getFirstProfileFormErrorTarget(
  input: ProfileFormErrorTargetInput,
): ProfileFormErrorTarget | null {
  if (!input.accountId) return 'account';
  if (!input.profileName.trim()) return 'profileName';
  if (input.pin.length > 6) return 'pin';
  if (
    [input.startDate, input.expiryDate].some(
      date => date && !Number.isFinite(Date.parse(`${date}T00:00:00`)),
    )
  ) {
    return 'dates';
  }
  if (input.startDate && input.expiryDate && input.startDate > input.expiryDate) {
    return 'dates';
  }
  return null;
}
