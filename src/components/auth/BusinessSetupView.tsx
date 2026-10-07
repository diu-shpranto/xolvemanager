import React, { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ProductLogo } from '../common/BrandLockup';
import { useApp } from '../../context/AppContext';

export const BusinessSetupView: React.FC = () => {
  const { createBusiness } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submissionLock = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionLock.current) return;

    const trimmedName = businessName.trim();
    if (!trimmedName) {
      setError('Please enter your business name.');
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Business name must be between 2 and 80 characters.');
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      await createBusiness(trimmedName);
    } catch (submitError) {
      console.error('Business creation failed.', submitError);
      setError('Something went wrong. Please try again.');
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const isNameEmpty = businessName.trim().length === 0;

  return (
    <main className="flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-[#f6f8f7] px-4 py-12 text-slate-900 sm:px-6">
      <section aria-labelledby="business-setup-heading" className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <ProductLogo size="large" showTagline />
          <h1
            id="business-setup-heading"
            className="mt-10 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            Create your business
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Set up your business to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <label htmlFor="businessName" className="mb-2 block text-sm font-semibold text-slate-700">
            Business Name
          </label>
          <input
            id="businessName"
            type="text"
            value={businessName}
            onKeyDown={event => {
              if (event.key === 'Enter' && !businessName.trim()) {
                event.preventDefault();
                setError('Please enter your business name.');
              }
            }}
            onChange={event => {
              setBusinessName(event.target.value);
              if (error) setError('');
            }}
            placeholder="Enter your business name"
            maxLength={80}
            autoComplete="organization"
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'business-name-error' : undefined}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />

          {error && (
            <p id="business-name-error" role="alert" className="mt-2 text-sm text-rose-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isNameEmpty}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating your business...' : 'Start Using'}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </form>
      </section>
    </main>
  );
};
