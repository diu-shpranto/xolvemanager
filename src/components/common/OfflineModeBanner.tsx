'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../../services/supabase/config';

/**
 * Shown only when Supabase is NOT configured: the app is running in
 * offline mode and all business data stays in this browser.
 * Renders nothing in cloud mode.
 */
export function OfflineModeBanner() {
  const [language, setLanguage] = useState<'en' | 'bn'>('en');

  useEffect(() => {
    try {
      setLanguage(window.localStorage.getItem('sqp_lang_v2') === 'bn' ? 'bn' : 'en');
    } catch {
      setLanguage('en');
    }
  }, []);

  if (isSupabaseConfigured()) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        {language === 'bn'
          ? 'অফলাইন মোড — ডেটা এই ব্রাউজারেই থাকে। ক্লাউড সিঙ্ক চালু হয়নি।'
          : 'Offline mode — data stays in this browser. Cloud sync is not set up yet.'}
      </span>
    </div>
  );
}
