export type LandingLanguage = 'bn' | 'en';

/**
 * The same language key the auth pages and the app use, so a visitor's
 * choice on the landing page carries into the app.
 */
export const LANDING_LANG_KEY = 'sqp_lang_v2';

export function readStoredLandingLanguage(): LandingLanguage {
  if (typeof window === 'undefined') return 'bn';
  try {
    return window.localStorage.getItem(LANDING_LANG_KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

export function storeLandingLanguage(language: LandingLanguage): void {
  try {
    window.localStorage.setItem(LANDING_LANG_KEY, language);
  } catch {
    // Language preference is a nice-to-have; a blocked storage write
    // must never break the page.
  }
}

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, digit => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
}
