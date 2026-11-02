'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  ChartNoAxesCombined,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Globe2,
  Headset,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircleMore,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import type { LocalAuthUser } from '../../services/localAuthService';
import { ProductLogo } from '../common/BrandLockup';
import { LocalAuthError } from '../../services/localAuthService';
import {
  createOwnerAccount,
  getPasswordStrength,
  hasLocalAccount,
  isValidAuthEmail,
  localAuthMessages,
  resetLocalPassword,
  signInLocally,
  signInWithDemoAccount,
} from '../../services/localAuthService';

type AuthMode = 'login' | 'signup' | 'forgot-password';
type Language = 'en' | 'bn';

interface AuthScreenProps {
  mode: AuthMode;
  hasAccount: boolean;
  initialError?: string;
  onAuthenticated: (user: LocalAuthUser) => void;
  onNavigate: (path: string) => void;
}

const copy = {
  en: {
    loginTitle: 'Sign in',
    loginIntro: 'Use the account created in this browser. Your business records stay here and do not sync between devices.',
    signupTitle: 'Create your account',
    signupIntro: 'Create an account on this browser.',
    recoveryTitle: 'Reset your password',
    recoveryIntro: 'Use the recovery key you saved when you created your account.',
    fullName: 'Full name',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Enter password again',
    recoveryKey: 'Recovery code',
    persistentSession: 'You will stay signed in on this device until you sign out.',
    welcomeEyebrow: 'WELCOME BACK',
    signIn: 'Sign in',
    create: 'Create account',
    createNewAccount: 'Create an account',
    divider: 'or',
    recover: 'Set new password',
    forgot: 'Forgot password?',
    createLink: 'Create Account',
    loginLink: 'Back to sign in',
    haveAccount: 'Already set up?',
    noAccount: 'First time here?',
    show: 'Show password',
    hide: 'Hide password',
    strength: ['Add more variety', 'Weak', 'Fair', 'Good', 'Strong'],
    setupDisabled: 'An account is already set up in this browser. New sign-ups are turned off.',
    recoverySavedTitle: 'Save your new recovery code',
    recoverySaved: 'You will not see it again. Keep it somewhere safe.',
    accountSavedTitle: 'Account created — save your recovery code',
    accountSaved: 'This code is shown only once. Keep it private. You can use it to reset your password.',
    copyKey: 'Copy recovery code',
    copied: 'Copied',
    continue: 'Continue to sign in',
    localTitle: 'Account on this device',
    termsLabel: 'I acknowledge the draft Terms & Conditions and Privacy & Data Notice for this local-only app.',
    termsLink: 'View draft terms',
    singleOwnerPolicy: localAuthMessages.singleOwnerPolicy,
    brandHeadline: 'Manage your',
    brandHeadlineSecond: 'Business',
    brandHeadlineAccent: 'with ease.',
    brandDescription: 'Manage customers, plans, sales, and payments in one place.',
    brandFootnote: 'Your business records are stored in this browser.',
    featureCustomers: 'Customers',
    featureSubscriptions: 'Plans and Renewals',
    featureSales: 'Sales & Payments',
    featureAccounts: 'Accounts and Profiles',
    featureWhatsApp: 'WhatsApp Messages',
    featureReports: 'Reports',
    previewLabel: 'APP PREVIEW',
    previewTitle: 'Business Summary',
    previewCustomers: 'Customers',
    previewSubscriptions: 'Subscriptions',
    previewPayments: 'Payments',
    previewActivity: 'Recent activity',
    previewIllustration: 'Example only · no business data',
    workspaceEyebrow: 'XolveManager workspace',
    setupEyebrow: 'First-time setup',
    recoveryEyebrow: 'Reset password',
    loading: 'Working…',
    language: 'বাংলা',
    demoLogin: 'Try the Demo',
    demoLoginSubtitle: 'Explore XolveManager with sample data.',
    demoLoading: 'Loading demo…',
  },
  bn: {
    loginTitle: 'সাইন ইন করুন',
    loginIntro: 'এই ব্রাউজারে তৈরি করা অ্যাকাউন্ট দিয়ে সাইন ইন করুন। ব্যবসার তথ্য এখানেই থাকে, অন্য ডিভাইসে সিঙ্ক হয় না।',
    signupTitle: 'মালিকের অ্যাকাউন্ট তৈরি করুন',
    signupIntro: 'এই ব্রাউজারের জন্য একটিমাত্র স্থানীয় মালিক অ্যাকাউন্ট তৈরি করুন।',
    recoveryTitle: 'অ্যাকাউন্ট পুনরুদ্ধার',
    recoveryIntro: 'অ্যাকাউন্ট তৈরির সময় সংরক্ষিত রিকভারি কী ব্যবহার করুন।',
    fullName: 'পূর্ণ নাম',
    email: 'ইমেইল ঠিকানা',
    password: 'পাসওয়ার্ড',
    confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
    recoveryKey: 'রিকভারি কী',
    persistentSession: 'সাইন আউট না করা পর্যন্ত এই ডিভাইসে সাইন ইন থাকবে।',
    welcomeEyebrow: 'আবার স্বাগতম',
    signIn: 'সাইন ইন',
    create: 'অ্যাকাউন্ট তৈরি করুন',
    createNewAccount: 'নতুন অ্যাকাউন্ট তৈরি করুন',
    divider: 'অথবা',
    recover: 'নতুন পাসওয়ার্ড সেট করুন',
    forgot: 'পাসওয়ার্ড ভুলে গেছেন?',
    createLink: 'অ্যাকাউন্ট তৈরি করুন',
    loginLink: 'সাইন ইন-এ ফিরে যান',
    haveAccount: 'আগে থেকেই সেট আপ করেছেন?',
    noAccount: 'প্রথমবার ব্যবহার করছেন?',
    show: 'পাসওয়ার্ড দেখান',
    hide: 'পাসওয়ার্ড লুকান',
    strength: ['আরও বৈচিত্র্য যোগ করুন', 'দুর্বল', 'মোটামুটি', 'ভালো', 'শক্তিশালী'],
    setupDisabled: 'এই ব্রাউজারে মালিক অ্যাকাউন্ট সেট আপ করা আছে। নতুন নিবন্ধন বন্ধ।',
    recoverySavedTitle: 'নতুন রিকভারি কী সংরক্ষণ করুন',
    recoverySaved: 'কীটি আবার দেখানো হবে না। নিরাপদ স্থানে সংরক্ষণ করুন।',
    accountSavedTitle: 'অ্যাকাউন্ট তৈরি হয়েছে — রিকভারি কী সংরক্ষণ করুন',
    accountSaved: 'কীটি শুধু এখন দেখানো হচ্ছে। এটি ব্যক্তিগত রাখুন।',
    copyKey: 'রিকভারি কী কপি করুন',
    copied: 'কপি হয়েছে',
    continue: 'সাইন ইন করতে এগিয়ে যান',
    localTitle: 'শুধু স্থানীয় অ্যাকাউন্ট',
    termsLabel: 'আমি এই স্থানীয়-শুধু অ্যাপের জন্য ড্রাফ্ট টার্মস ও প্রাইভেসি নোটিশ বুঝে নিশ্চিত করছি।',
    termsLink: 'ড্রাফ্ট শর্ত দেখুন',
    singleOwnerPolicy: 'এই অ্যাপ প্রতি ব্রাউজার প্রোফাইলে একটি মালিক অ্যাকাউন্ট সমর্থন করে। প্রথম অ্যাকাউন্টটি মালিক হবে; পরবর্তী নিবন্ধন বন্ধ থাকবে।',
    brandEyebrow: 'সহজ হোক আপনার ব্যবসা।',
    brandHeadline: 'আরও বুদ্ধিমত্তার সাথে',
    brandHeadlineSecond: 'ব্যবসা',
    brandHeadlineAccent: 'পরিচালনা করুন।',
    brandDescription: 'গ্রাহক, সাবস্ক্রিপশন, বিক্রয়, পেমেন্ট এবং আরও অনেক কিছু — সব এক শক্তিশালী কর্মক্ষেত্রে।',
    brandFootnote: 'আপনার ব্যবসার তথ্য এই ব্রাউজারেই সংরক্ষিত।',
    featureCustomers: 'গ্রাহক ব্যবস্থাপনা',
    featureSubscriptions: 'সাবস্ক্রিপশন ও নবায়ন',
    featureSales: 'বিক্রয় ও পেমেন্ট',
    featureAccounts: 'অ্যাকাউন্ট ও প্রোফাইল',
    featureWhatsApp: 'হোয়াটসঅ্যাপ সংযোগ',
    featureReports: 'রিপোর্ট ও বিশ্লেষণ',
    previewLabel: 'কর্মক্ষেত্রের নমুনা',
    previewTitle: 'ব্যবসার সারসংক্ষেপ',
    previewCustomers: 'গ্রাহক',
    previewSubscriptions: 'সাবস্ক্রিপশন',
    previewPayments: 'পেমেন্ট',
    previewActivity: 'সাম্প্রতিক কার্যকলাপ',
    previewIllustration: 'শুধু নমুনা · ব্যবসার তথ্য নয়',
    workspaceEyebrow: 'XolveManager কর্মক্ষেত্র',
    setupEyebrow: 'প্রথমবার সেটআপ',
    recoveryEyebrow: 'অ্যাকাউন্ট পুনরুদ্ধার',
    loading: 'অপেক্ষা করুন…',
    language: 'English',
    demoLogin: 'ডেমো অ্যাকাউন্ট দেখুন',
    demoLoginSubtitle: 'নমুনা তথ্য দিয়ে XolveManager ঘুরে দেখুন।',
    demoLoading: 'ডেমো ওয়ার্কস্পেস প্রস্তুত হচ্ছে…',
  },
} as const;

const getErrorMessage = (error: unknown, language: Language): string => {
  if (!(error instanceof Error)) return 'Local authentication failed. Please try again.';
  if (language !== 'bn' || !(error instanceof LocalAuthError)) return error.message;
  const messages: Partial<Record<LocalAuthError['code'], string>> = {
    AUTH_UNAVAILABLE: 'এই পরিবেশে নিরাপদ স্থানীয় সাইন-ইন উপলভ্য নয়।',
    CORRUPT_AUTH_DATA: 'স্থানীয় প্রমাণীকরণ ডেটা ক্ষতিগ্রস্ত। এটি পরিবর্তন করা হয়নি; ব্রাউজার স্টোরেজ মুছবেন না।',
    ACCOUNT_EXISTS: 'এই ব্রাউজারে মালিক অ্যাকাউন্ট সেট আপ আছে। নতুন নিবন্ধন বন্ধ।',
    ACCOUNT_NOT_FOUND: 'এখনও কোনো স্থানীয় অ্যাকাউন্ট নেই। আগে মালিক অ্যাকাউন্ট তৈরি করুন।',
    INVALID_CREDENTIALS: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
    INVALID_EMAIL: 'সঠিক ইমেইল ঠিকানা লিখুন।',
    INVALID_NAME: 'পূর্ণ নাম লিখুন (সর্বোচ্চ ১০০ অক্ষর)।',
    WEAK_PASSWORD: 'কমপক্ষে ১০ অক্ষর এবং বড়/ছোট হাতের অক্ষর, সংখ্যা ও চিহ্নের মধ্যে অন্তত তিন ধরনের অক্ষর ব্যবহার করুন।',
    PASSWORD_MISMATCH: 'পাসওয়ার্ড দুটি মিলছে না।',
    INVALID_RECOVERY_KEY: 'ইমেইল ঠিকানা বা রিকভারি কী সঠিক নয়।',
    DEMO_SESSION_CONFLICT: 'ডেমো মোডে যাওয়ার আগে নিবন্ধিত অ্যাকাউন্ট থেকে সাইন আউট করুন।',
    STORAGE_FAILURE: 'স্থানীয় প্রমাণীকরণ ডেটা সংরক্ষণ বা পড়া যায়নি। ব্যবসার ডেটা পরিবর্তন করা হয়নি।',
  };
  return messages[error.code] || error.message;
};

const inputClass = 'auth-input';

export function AuthScreen({ mode, hasAccount, initialError, onAuthenticated, onNavigate }: AuthScreenProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [resultKey, setResultKey] = useState('');
  const [copied, setCopied] = useState(false);
  const text = copy[language];

  useEffect(() => {
    try {
      setLanguage(window.localStorage.getItem('sqp_lang_v2') === 'bn' ? 'bn' : 'en');
    } catch {
      setLanguage('en');
    }
  }, []);

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let revealFrame = 0;
    const revealFocusedControl = () => {
      window.cancelAnimationFrame(revealFrame);
      revealFrame = window.requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (!(focused instanceof HTMLElement) || !focused.closest('.auth-page')) return;

        const bounds = focused.getBoundingClientRect();
        const visibleTop = visualViewport.offsetTop + 12;
        const visibleBottom = visibleTop + visualViewport.height - 24;
        if (bounds.top < visibleTop || bounds.bottom > visibleBottom) {
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    };

    document.addEventListener('focusin', revealFocusedControl);
    visualViewport.addEventListener('resize', revealFocusedControl);
    visualViewport.addEventListener('scroll', revealFocusedControl);
    return () => {
      document.removeEventListener('focusin', revealFocusedControl);
      visualViewport.removeEventListener('resize', revealFocusedControl);
      visualViewport.removeEventListener('scroll', revealFocusedControl);
      window.cancelAnimationFrame(revealFrame);
    };
  }, []);

  const navigate = (path: string) => {
    setError('');
    setResultKey('');
    setCopied(false);
    setAcceptedTerms(false);
    onNavigate(path);
  };

  const updateLanguage = () => {
    const nextLanguage: Language = language === 'en' ? 'bn' : 'en';
    try {
      window.localStorage.setItem('sqp_lang_v2', nextLanguage);
    } catch {
      setError('The language preference could not be saved.');
    }
    setLanguage(nextLanguage);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!isValidAuthEmail(email)) {
      setError(language === 'bn' ? 'সঠিক ইমেইল ঠিকানা লিখুন।' : 'Enter a valid email address.');
      return;
    }
    if (mode === 'signup' && !acceptedTerms) {
      setError(language === 'bn' ? 'অ্যাকাউন্ট তৈরি করতে ড্রাফ্ট টার্মস ও প্রাইভেসি নোটিশ মেনে নিতে হবে।' : 'Please acknowledge the draft terms and privacy notice before creating your account.');
      return;
    }
    if (mode !== 'login' && password !== confirmation) {
      setError(language === 'bn' ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const user = await signInLocally(email, password);
        onAuthenticated(user);
      } else if (mode === 'signup') {
        if (hasAccount) {
          setError(text.setupDisabled);
          return;
        }
        const result = await createOwnerAccount(name, email, password, confirmation);
        setResultKey(result.recoveryKey);
      } else {
        const result = await resetLocalPassword(email, recoveryKey, password, confirmation);
        setResultKey(result.recoveryKey);
      }
    } catch (caught) {
      setError(getErrorMessage(caught, language));
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const user = await signInWithDemoAccount();
      onAuthenticated(user);
    } catch (caught) {
      setError(getErrorMessage(caught, language));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(resultKey);
      setCopied(true);
    } catch {
      setError('Clipboard access failed. Select and copy the recovery key manually.');
    }
  };

  const strength = getPasswordStrength(password);
  const title = mode === 'login' ? text.loginTitle : mode === 'signup' ? text.signupTitle : text.recoveryTitle;
  const intro = mode === 'login' ? text.loginIntro : mode === 'signup' ? text.signupIntro : text.recoveryIntro;
  const featureItems = [
    { Icon: UsersRound, label: text.featureCustomers },
    { Icon: RefreshCw, label: text.featureSubscriptions },
    { Icon: CreditCard, label: text.featureSales },
    { Icon: WalletCards, label: text.featureAccounts },
    { Icon: MessageCircleMore, label: text.featureWhatsApp },
    { Icon: ChartNoAxesCombined, label: text.featureReports },
  ];

  return (
    <main className="auth-page" data-auth-language={language} data-auth-mode={mode}>
      <div className="auth-frame">
        <section className="auth-panel" aria-labelledby="auth-heading">
          <div className="auth-card">
            <div className="auth-panel-header">
              <ProductLogo size="compact" showTagline className="auth-card-brand" />
              <button type="button" onClick={updateLanguage} className="auth-language" aria-label={language === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}><Globe2 aria-hidden="true" />{text.language}<ChevronRight aria-hidden="true" /></button>
            </div>

              {resultKey ? (
                <div className="auth-success">
                  <div className="auth-success-mark"><KeyRound aria-hidden="true" /></div>
                  <p className="auth-eyebrow">{text.localTitle}</p>
                  <h2 id="auth-heading">{mode === 'signup' ? text.accountSavedTitle : text.recoverySavedTitle}</h2>
                  <p className="auth-intro">{mode === 'signup' ? text.accountSaved : text.recoverySaved}</p>
                  <div className="auth-recovery-key" aria-label={text.recoveryKey}>{resultKey}</div>
                  <button type="button" onClick={handleCopyKey} className="auth-secondary-button">{copied ? text.copied : text.copyKey}</button>
                  {mode === 'signup' && <p className="auth-policy-note">{text.singleOwnerPolicy}</p>}
                  <button type="button" onClick={() => navigate('/login')} className="auth-primary-button">{text.continue}</button>
                </div>
              ) : (
                <>
                  <div className="auth-heading">
                    <p className="auth-eyebrow">{mode === 'login' ? text.welcomeEyebrow : mode === 'signup' ? text.setupEyebrow : text.recoveryEyebrow}</p>
                    <h2 id="auth-heading">{title}</h2>
                    <p className="auth-intro">{intro}</p>
                  </div>

                  {error && <div role="alert" aria-live="assertive" className="auth-alert auth-alert--error">{error}</div>}
                  {mode === 'signup' && hasAccount && <div role="alert" className="auth-alert auth-alert--warning">{text.setupDisabled}</div>}

                  <form onSubmit={handleSubmit} className="auth-form" aria-busy={busy}>
                    {mode === 'signup' && (
                      <label className="auth-field">{text.fullName}
                        <span className="auth-input-wrap"><UserRound aria-hidden="true" /><input autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} className={`${inputClass} auth-input--with-icon`} /></span>
                      </label>
                    )}
                    <label className="auth-field">{text.email}
                      <span className="auth-input-wrap"><Mail aria-hidden="true" /><input type="email" autoComplete={mode === 'login' ? 'off' : 'email'} required value={email} onChange={event => setEmail(event.target.value)} className={`${inputClass} auth-input--with-icon`} /></span>
                    </label>

                    {mode === 'forgot-password' && (
                      <label className="auth-field">{text.recoveryKey}
                        <input autoComplete="off" required value={recoveryKey} onChange={event => setRecoveryKey(event.target.value)} className={`${inputClass} auth-input--mono`} />
                      </label>
                    )}

                    <label className="auth-field">{text.password}
                      <span className="auth-password-wrap">
                        <LockKeyhole aria-hidden="true" />
                        <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={event => setPassword(event.target.value)} className={`${inputClass} auth-input--password auth-input--with-icon`} />
                        <button type="button" onClick={() => setShowPassword(value => !value)} className="auth-visibility-button" aria-label={showPassword ? text.hide : text.show} aria-pressed={showPassword}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                      </span>
                    </label>
                    {mode !== 'login' && password.length > 0 && (
                      <div aria-live="polite" className="auth-strength">
                        <div className="auth-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map(level => <span key={level} className={strength >= level ? `is-active strength-${strength}` : ''} />)}</div>
                        <span>{text.strength[strength]}</span>
                      </div>
                    )}

                    {mode !== 'login' && (
                      <label className="auth-field">{text.confirmPassword}
                        <span className="auth-password-wrap">
                          <LockKeyhole aria-hidden="true" />
                          <input type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className={`${inputClass} auth-input--password auth-input--with-icon`} />
                          <button type="button" onClick={() => setShowConfirmation(value => !value)} className="auth-visibility-button" aria-label={showConfirmation ? text.hide : text.show} aria-pressed={showConfirmation}>{showConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                        </span>
                      </label>
                    )}

                    {mode === 'login' && (
                      <div className="auth-login-options">
                        <p className="auth-session-note">{text.persistentSession}</p>
                        <button type="button" onClick={() => navigate('/forgot-password')} className="auth-text-link">{text.forgot}</button>
                      </div>
                    )}

                    {mode === 'signup' && (
                      <label className="auth-terms">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={event => setAcceptedTerms(event.target.checked)}
                          aria-label="Acknowledge the draft terms and privacy notice"
                          required
                        />
                        <span>
                          {text.termsLabel}{' '}
                          <a href="/legal/terms" className="auth-inline-link">{text.termsLink}</a>
                        </span>
                      </label>
                    )}

                    <button type="submit" disabled={busy || (mode === 'signup' && hasAccount)} className="auth-primary-button">{busy && <LoaderCircle className="auth-spinner" aria-hidden="true" />}{busy ? text.loading : mode === 'login' ? <>{text.signIn}<ArrowRight aria-hidden="true" /></> : mode === 'signup' ? text.create : text.recover}</button>
                  </form>

                  {mode === 'login' && (
                    <>
                      <div className="auth-divider"><span />{text.divider}<span /></div>
                      <button type="button" onClick={handleDemoLogin} disabled={busy} className="auth-account-button auth-demo-button">
                        {busy ? <LoaderCircle className="auth-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                        <span>
                          <strong>{busy ? text.demoLoading : text.demoLogin}</strong>
                          <small>{text.demoLoginSubtitle}</small>
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => navigate('/signup')} className="auth-account-button"><UserRound aria-hidden="true" /><span>{text.createNewAccount}</span><ChevronRight aria-hidden="true" /></button>
                    </>
                  )}

                  {mode !== 'login' && (
                    <div className="auth-links">
                      <span>{mode === 'signup' ? text.haveAccount : text.loginLink}</span>
                      <button type="button" onClick={() => navigate('/login')} className="auth-text-link">{text.signIn}</button>
                    </div>
                  )}

                </>
              )}
            <footer className="auth-footer" aria-label="XolveManager footer navigation">
              <nav className="auth-footer-links" aria-label="Quick links">
                <a href="/legal/privacy" className="auth-footer-link" aria-label="Privacy policy">
                  <span className="auth-footer-icon"><ShieldCheck aria-hidden="true" /></span>
                  <span className="auth-footer-label auth-footer-label--full">Privacy</span>
                  <span className="auth-footer-label auth-footer-label--short">Privacy</span>
                </a>
                <a href="/legal" className="auth-footer-link" aria-label="Legal & Trust Center">
                  <span className="auth-footer-icon"><Scale aria-hidden="true" /></span>
                  <span className="auth-footer-label auth-footer-label--full">Legal &amp; Trust Center</span>
                  <span className="auth-footer-label auth-footer-label--short">Legal</span>
                </a>
                <a href="/support" className="auth-footer-link" aria-label="Contact & Support">
                  <span className="auth-footer-icon"><Headset aria-hidden="true" /></span>
                  <span className="auth-footer-label auth-footer-label--full">Contact &amp; Support</span>
                  <span className="auth-footer-label auth-footer-label--short">Support</span>
                </a>
              </nav>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
