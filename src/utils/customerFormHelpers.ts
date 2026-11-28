export type CustomerFormErrorTarget = 'name' | 'phone' | 'email' | 'facebook';

export interface CustomerFormErrorTargetInput {
  name: string;
  phone: string;
  email: string;
  facebookUrl: string;
}

/**
 * Mirrors the check order of CustomersView.validateForm and returns the field
 * the user should be jumped to for the FIRST failing check, or null when the
 * form is valid. Pure — used by the Add/Edit Customer modal to scroll to and
 * focus the field that needs fixing (opening the collapsed advanced section
 * first when the failing field lives there).
 */
export function getFirstCustomerFormErrorTarget(
  input: CustomerFormErrorTargetInput,
): CustomerFormErrorTarget | null {
  if (!input.name.trim() || input.name.trim().length < 2) return 'name';
  if (!input.phone.trim()) return 'phone';
  if (input.phone.replace(/[^0-9]/g, '').length < 6) return 'phone';
  if (input.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) return 'email';
  }
  if (input.facebookUrl.trim()) {
    const url = input.facebookUrl.trim().toLowerCase();
    if (
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('facebook.com') &&
      !url.startsWith('fb.com')
    ) {
      return 'facebook';
    }
  }
  return null;
}
