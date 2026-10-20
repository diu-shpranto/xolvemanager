import React, { useState } from 'react';
import { AccountProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';

interface ProfileEditModalProps {
  accountId: string;
  profile: AccountProfile;
  onClose: () => void;
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300';

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ accountId, profile, onClose }) => {
  const { language, updateProfile } = useApp();
  const { showToast } = useToast();
  const [profileName, setProfileName] = useState(profile.profileName);
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [startDate, setStartDate] = useState(profile.startDate || '');
  const [expiryDate, setExpiryDate] = useState(profile.expiryDate || '');
  const [notes, setNotes] = useState(profile.notes || '');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileName.trim()) {
      showToast(language === 'bn' ? 'প্রোফাইলের নাম লিখুন।' : 'Enter a profile name.', 'error');
      return;
    }
    if (startDate && expiryDate && startDate > expiryDate) {
      showToast(language === 'bn' ? 'মেয়াদ শেষের তারিখ শুরুর তারিখের পরে হতে হবে।' : 'Expiry date must be on or after the start date.', 'error');
      return;
    }

    try {
      updateProfile(accountId, profile.id, {
        profileName: profileName.trim(),
        pin: removePin ? '' : pin.trim() || undefined,
        startDate,
        expiryDate,
        notes,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update profile.', 'error');
      return;
    }

    showToast(language === 'bn' ? 'প্রোফাইল আপডেট হয়েছে।' : 'Profile updated successfully.', 'success');
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={language === 'bn' ? 'প্রোফাইল সম্পাদনা' : 'Edit profile'}
      subtitle={language === 'bn' ? 'প্রোফাইলের নাম, PIN ও মেয়াদের তথ্য আপডেট করুন।' : 'Update the profile name, PIN, and validity dates.'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          {language === 'bn' ? 'প্রোফাইলের নাম' : 'Profile name'}
          <input
            autoFocus
            value={profileName}
            onChange={event => setProfileName(event.target.value)}
            className={inputClass}
            maxLength={80}
            required
          />
        </label>

        <label className={labelClass}>
          {language === 'bn' ? 'প্রোফাইল PIN' : 'Profile PIN'}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={event => setPin(event.target.value)}
            className={inputClass}
            placeholder={profile.pin ? (language === 'bn' ? 'ফাঁকা রাখলে আগের PIN থাকবে' : 'Leave blank to keep the saved PIN') : (language === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
            maxLength={6}
            disabled={removePin}
          />
        </label>
        {profile.pin && (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={removePin}
              onChange={event => setRemovePin(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            {language === 'bn' ? 'সংরক্ষিত PIN মুছে ফেলুন' : 'Remove saved PIN'}
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            {language === 'bn' ? 'শুরুর তারিখ' : 'Start date'}
            <input
              type="date"
              value={startDate}
              max={expiryDate || undefined}
              onChange={event => setStartDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            {language === 'bn' ? 'মেয়াদ শেষের তারিখ' : 'Expiry date'}
            <input
              type="date"
              value={expiryDate}
              min={startDate || undefined}
              onChange={event => setExpiryDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          {language === 'bn' ? 'নোট' : 'Notes'}
          <textarea
            rows={3}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
          <button type="submit" className="min-h-10 rounded-lg bg-violet-700 px-5 text-xs font-semibold text-white hover:bg-violet-600">
            {language === 'bn' ? 'সংরক্ষণ' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
