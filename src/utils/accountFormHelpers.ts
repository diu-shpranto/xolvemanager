export type AccountFormErrorTarget =
  | 'service'
  | 'email'
  | 'profiles'
  | 'purchaseDate'
  | 'expiryDate'
  | 'purchaseCost';

export interface AccountFormErrorTargetInput {
  serviceId: string;
  email: string;
  maxProfiles: number;
  minimumProfiles: number;
  purchaseDate: string;
  expiryDate: string;
  purchaseCost: string;
}

/**
 * Mirrors the check order of AccountsView.handleSaveAccount and returns the
 * field the user should be jumped to for the FIRST failing check, or null
 * when the form is valid. Pure — used by the Add/Edit Service Account (Login)
 * modal to scroll to and focus the field that needs fixing (opening the
 * collapsed advanced section first when the failing field lives there).
 *
 * The email is the service login, so it is required but its shape is not
 * enforced here: some saved logins are an account ID rather than an email
 * address.
 */
export function getFirstAccountFormErrorTarget(
  input: AccountFormErrorTargetInput,
): AccountFormErrorTarget | null {
  if (!input.serviceId) return 'service';
  if (!input.email.trim()) return 'email';
  if (
    !Number.isInteger(input.maxProfiles) ||
    input.maxProfiles < input.minimumProfiles ||
    input.maxProfiles > 100
  ) {
    return 'profiles';
  }
  if (input.purchaseDate && !Number.isFinite(Date.parse(`${input.purchaseDate}T00:00:00`))) {
    return 'purchaseDate';
  }
  if (input.expiryDate && !Number.isFinite(Date.parse(`${input.expiryDate}T00:00:00`))) {
    return 'expiryDate';
  }
  const parsedPurchaseCost = input.purchaseCost.trim() ? Number(input.purchaseCost) : undefined;
  if (
    parsedPurchaseCost !== undefined &&
    (!Number.isFinite(parsedPurchaseCost) || parsedPurchaseCost < 0)
  ) {
    return 'purchaseCost';
  }
  return null;
}
