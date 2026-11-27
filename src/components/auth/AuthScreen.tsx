'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Cloud,
  Eye,
  EyeOff,
  Globe2,
  Headset,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { LocalAuthUser } from '../../services/localAuthService';
import { ProductLogo } from '../common/BrandLockup';
import { LocalAuthError } from '../../services/localAuthService';
import {
  clearCloudSessionFlag,
  hasCloudPasswordRecoverySession,
  requestCloudPasswordReset,
  setCloudPassword,
  verifyCloudPasswordResetCode,
  signInWithEmailLink,
  signInWithGoogle,
  signInWithSupabase,
  signUpWithSupabase,
  subscribeToSupabaseAuthChanges,
  SupabaseAuthError,
} from '../../services/supabase/auth';
import { isGoogleOAuthEnabled, isSupabaseConfigured } from '../../services/supabase/config';
import {
  createOwnerAccount,
  getPasswordStrength,
  hasLocalAccount,
  isValidAuthEmail,
  localAuthMessages,
  resetLocalPassword,
  signInLocally,
} from '../../services/localAuthService';
import styles from './AuthScreen.module.css';

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
    loginTitle: 'Welcome back',
    loginIntroCloud: 'Sign in to continue to your account.',
    loginIntroLocal: 'Sign in to the account on this device. Your data stays in this browser.',
    signupTitleCloud: 'Create your account',
    signupTitleLocal: 'Create an account on this device',
    signupIntroCloud: 'Sign up to get started.',
    signupIntroLocal: 'Create an account on this device. Its data stays in this browser.',
    recoveryTitle: 'Reset your device password',
    recoveryIntro: 'This resets the password of the account on this device. Use the recovery key you saved when you created the account.',
    fullName: 'Full name',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Enter password again',
    recoveryKey: 'Recovery code',
    persistentSession: 'You will stay signed in on this device until you sign out.',
    cloudSessionNote: 'You will stay signed in on this device until you sign out.',
    welcomeEyebrow: 'WELCOME BACK',
    localEyebrow: 'THIS DEVICE ONLY',
    setupEyebrow: 'NEW ACCOUNT',
    recoveryEyebrow: 'RESET PASSWORD',
    savedEyebrow: 'ACCOUNT SAVED',
    signIn: 'Sign in',
    create: 'Sign up',
    createAccountPrompt: "Don't have an account?",
    signUp: 'Sign up',
    signInPrompt: 'Already have an account?',
    emailDivider: 'or',
    recover: 'Set new password',
    forgot: 'Forgot password?',
    cloudForgot: 'Forgot password?',
    cloudResetTitle: 'Reset your password',
    cloudResetIntro: 'Enter your email address. We will send you a 6-digit code to set a new password.',
    cloudResetSend: 'Send reset code',
    cloudResetCodeTitle: 'Enter the code',
    cloudResetCodeIntro: 'We sent a 6-digit code to {email}. Enter it below — or click the reset link in the email instead.',
    cloudResetCodeLabel: '6-digit code',
    cloudResetVerify: 'Verify code',
    cloudResetResend: 'Resend the code',
    cloudResetResent: 'A new code was sent.',
    accountConfirmationNotice: 'Check your email — we sent a confirmation link to {email}. Open it, then sign in.',
    useEmailLink: 'Sign in with an email link instead',
    usePassword: 'Back to password sign-in',
    sendEmailLink: 'Send sign-in link',
    emailLinkSent: 'Check your email — we sent a sign-in link to {email}.',
    emailLinkResend: 'Send a new link',
    cloudResetLinkInvalid: 'That reset link did not work — it may have expired or already been used. Request a new link below.',
    cloudResetSetTitle: 'Set a new password',
    cloudResetSetIntro: 'Choose a new password. You will stay signed in after this.',
    loginLink: 'Back to sign in',
    show: 'Show password',
    hide: 'Hide password',
    strength: ['Add more variety', 'Weak', 'Fair', 'Good', 'Strong'],
    setupDisabled: 'An account is already set up in this browser. New sign-ups are turned off.',
    recoverySavedTitle: 'Save your new recovery code',
    recoverySaved: 'You will not see it again. Keep it somewhere safe.',
    accountSavedTitle: 'Account created — save your recovery code',
    accountSaved: 'This code is shown only once. Keep it private. You can use it to reset your password.',
    accountCreatedNotice: 'Account created — sign in to continue.',
    copyKey: 'Copy recovery code',
    copied: 'Copied',
    continue: 'Continue to sign in',
    termsLabel: 'I acknowledge the Terms & Conditions and Privacy & Data Notice.',
    termsLink: 'View terms',
    singleOwnerPolicy: localAuthMessages.singleOwnerPolicy,
    loading: 'Working…',
    google: 'Continue with Google',
    googleLoading: 'Connecting to Google…',
    googleNote: 'Use any Google account.',
    language: 'বাংলা',
    deviceBoxBody: 'Your data stays only in this browser.',
    deviceBoxButton: 'Continue on this device',
    backToCloud: 'Back to sign in',
    deviceActiveNote: 'You are using the account on this device. Data stays in this browser.',
    errName: 'Enter your full name.',
    errNameLong: 'Name must be 100 characters or fewer.',
    errEmail: 'Enter a valid email address.',
    errPasswordRequired: 'Enter your password.',
    errPasswordChoose: 'Choose a password.',
    errPasswordWeak: 'Choose a stronger password — at least 10 characters, with a mix of letters, numbers and symbols.',
    errConfirmRequired: 'Enter your password again.',
    errConfirmMismatch: 'The passwords do not match.',
    errRecoveryKey: 'Enter the recovery key you saved.',
    errTerms: 'Please acknowledge the terms and privacy notice to create your account.',
    errWrongCredentials: 'Email or password is incorrect. Check them and try again.',
    errAccountExists: 'An account with this email already exists. Try signing in instead.',
    errEmailNotConfirmed: 'Please confirm your email first — check your inbox for the confirmation link.',
    errPasswordTooShort: 'Your password must be at least 6 characters.',
    errNetwork: 'Could not reach the server. Check your connection and try again.',
    errTooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
    errCode: 'Enter the 6-digit code.',
    errGeneric: 'Something went wrong. Please try again.',
  },
  bn: {
    loginTitle: 'স্বাগতম',
    loginIntroCloud: 'আপনার অ্যাকাউন্টে যেতে সাইন ইন করুন।',
    loginIntroLocal: 'এই ডিভাইসের অ্যাকাউন্টে সাইন ইন করুন। আপনার ডেটা এই ব্রাউজারেই থাকবে।',
    signupTitleCloud: 'আপনার অ্যাকাউন্ট তৈরি করুন',
    signupTitleLocal: 'এই ডিভাইসে অ্যাকাউন্ট তৈরি করুন',
    signupIntroCloud: 'শুরু করতে সাইন আপ করুন।',
    signupIntroLocal: 'এই ডিভাইসে অ্যাকাউন্ট তৈরি করুন। এর ডেটা এই ব্রাউজারেই থাকবে।',
    recoveryTitle: 'ডিভাইসের পাসওয়ার্ড রিসেট করুন',
    recoveryIntro: 'এটি এই ডিভাইসের অ্যাকাউন্টের পাসওয়ার্ড রিসেট করবে। অ্যাকাউন্ট তৈরির সময় সংরক্ষিত রিকভারি কী ব্যবহার করুন।',
    fullName: 'পূর্ণ নাম',
    email: 'ইমেইল ঠিকানা',
    password: 'পাসওয়ার্ড',
    confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
    recoveryKey: 'রিকভারি কী',
    persistentSession: 'সাইন আউট না করা পর্যন্ত এই ডিভাইসে সাইন ইন থাকবে।',
    cloudSessionNote: 'সাইন আউট না করা পর্যন্ত এই ডিভাইসে সাইন ইন থাকবে।',
    welcomeEyebrow: 'স্বাগতম',
    localEyebrow: 'শুধু এই ডিভাইসে',
    setupEyebrow: 'নতুন অ্যাকাউন্ট',
    recoveryEyebrow: 'পাসওয়ার্ড রিসেট',
    savedEyebrow: 'অ্যাকাউন্ট সংরক্ষিত',
    signIn: 'সাইন ইন',
    create: 'সাইন আপ',
    createAccountPrompt: 'অ্যাকাউন্ট নেই?',
    signUp: 'সাইন আপ',
    signInPrompt: 'আগে থেকেই অ্যাকাউন্ট আছে?',
    emailDivider: 'অথবা',
    recover: 'নতুন পাসওয়ার্ড সেট করুন',
    forgot: 'পাসওয়ার্ড ভুলে গেছেন?',
    cloudForgot: 'পাসওয়ার্ড ভুলে গেছেন?',
    cloudResetTitle: 'পাসওয়ার্ড রিসেট করুন',
    cloudResetIntro: 'আপনার ইমেইল ঠিকানা লিখুন। নতুন পাসওয়ার্ড সেট করার ৬ ডিজিটের কোড পাঠানো হবে।',
    cloudResetSend: 'রিসেট কোড পাঠান',
    cloudResetCodeTitle: 'কোডটি লিখুন',
    cloudResetCodeIntro: '{email}-এ ৬ ডিজিটের কোড পাঠানো হয়েছে। নিচে কোডটি লিখুন — অথবা ইমেইলের রিসেট লিংকে ক্লিক করুন।',
    cloudResetCodeLabel: '৬ ডিজিটের কোড',
    cloudResetVerify: 'কোড যাচাই করুন',
    cloudResetResend: 'কোডটি আবার পাঠান',
    cloudResetResent: 'নতুন কোড পাঠানো হয়েছে।',
    accountConfirmationNotice: 'ইমেইল দেখুন — {email}-এ কনফার্মেশন লিংক পাঠানো হয়েছে। লিংকটি খুলে তারপর সাইন ইন করুন।',
    useEmailLink: 'ইমেইল লিংক দিয়ে সাইন ইন করুন',
    usePassword: 'পাসওয়ার্ড দিয়ে সাইন ইনে ফিরুন',
    sendEmailLink: 'সাইন-ইন লিংক পাঠান',
    emailLinkSent: 'ইমেইল দেখুন — {email}-এ সাইন-ইন লিংক পাঠানো হয়েছে।',
    emailLinkResend: 'নতুন লিংক পাঠান',
    cloudResetLinkInvalid: 'রিসেট লিংকটি কাজ করেনি — হয়তো মেয়াদ শেষ হয়ে গেছে বা ইতিমধ্যে ব্যবহৃত হয়েছে। নিচে নতুন লিংক চেয়ে নিন।',
    cloudResetSetTitle: 'নতুন পাসওয়ার্ড সেট করুন',
    cloudResetSetIntro: 'নতুন পাসওয়ার্ড বেছে নিন। এরপর সাইন ইন থাকবে।',
    loginLink: 'সাইন ইন-এ ফিরে যান',
    show: 'পাসওয়ার্ড দেখান',
    hide: 'পাসওয়ার্ড লুকান',
    strength: ['আরও বৈচিত্র্য যোগ করুন', 'দুর্বল', 'মোটামুটি', 'ভালো', 'শক্তিশালী'],
    setupDisabled: 'এই ব্রাউজারে মালিক অ্যাকাউন্ট সেট আপ করা আছে। নতুন নিবন্ধন বন্ধ।',
    recoverySavedTitle: 'নতুন রিকভারি কী সংরক্ষণ করুন',
    recoverySaved: 'কীটি আবার দেখানো হবে না। নিরাপদ স্থানে সংরক্ষণ করুন।',
    accountSavedTitle: 'অ্যাকাউন্ট তৈরি হয়েছে — রিকভারি কী সংরক্ষণ করুন',
    accountSaved: 'কীটি শুধু এখন দেখানো হচ্ছে। এটি ব্যক্তিগত রাখুন।',
    accountCreatedNotice: 'অ্যাকাউন্ট তৈরি হয়েছে — সাইন ইন করে এগিয়ে যান।',
    copyKey: 'রিকভারি কী কপি করুন',
    copied: 'কপি হয়েছে',
    continue: 'সাইন ইন করতে এগিয়ে যান',
    termsLabel: 'আমি টার্মস ও প্রাইভেসি নোটিশ পড়ে সম্মত হচ্ছি।',
    termsLink: 'শর্ত দেখুন',
    singleOwnerPolicy: 'এই অ্যাপ প্রতি ব্রাউজার প্রোফাইলে একটি মালিক অ্যাকাউন্ট সমর্থন করে। প্রথম অ্যাকাউন্টটি মালিক হবে; পরবর্তী নিবন্ধন বন্ধ থাকবে।',
    loading: 'অপেক্ষা করুন…',
    google: 'Google দিয়ে চালিয়ে যান',
    googleLoading: 'Google-এ সংযোগ হচ্ছে…',
    googleNote: 'যেকোনো Google অ্যাকাউন্ট ব্যবহার করুন।',
    language: 'English',
    deviceBoxBody: 'আপনার ডেটা শুধু এই ব্রাউজারেই থাকবে।',
    deviceBoxButton: 'এই ডিভাইসেই চালিয়ে যান',
    backToCloud: 'সাইন ইন-এ ফিরে যান',
    deviceActiveNote: 'আপনি এই ডিভাইসের অ্যাকাউন্ট ব্যবহার করছেন। ডেটা এই ব্রাউজারেই থাকবে।',
    errName: 'আপনার পূর্ণ নাম লিখুন।',
    errNameLong: 'নাম সর্বোচ্চ ১০০ অক্ষরের মধ্যে হতে হবে।',
    errEmail: 'সঠিক ইমেইল ঠিকানা লিখুন।',
    errPasswordRequired: 'পাসওয়ার্ড লিখুন।',
    errPasswordChoose: 'একটি পাসওয়ার্ড বেছে নিন।',
    errPasswordWeak: 'আরও শক্তিশালী পাসওয়ার্ড বেছে নিন — কমপক্ষে ১০ অক্ষর, অক্ষর, সংখ্যা ও চিহ্নের মিশ্রণ।',
    errConfirmRequired: 'পাসওয়ার্ড আবার লিখুন।',
    errConfirmMismatch: 'পাসওয়ার্ড দুটি মিলছে না।',
    errRecoveryKey: 'সংরক্ষিত রিকভারি কী লিখুন।',
    errTerms: 'অ্যাকাউন্ট তৈরি করতে টার্মস ও প্রাইভেসি নোটিশে সম্মত হোন।',
    errWrongCredentials: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। যাচাই করে আবার চেষ্টা করুন।',
    errAccountExists: 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। সাইন ইন করে দেখুন।',
    errEmailNotConfirmed: 'আগে আপনার ইমেইল নিশ্চিত করুন — ইনবক্সে পাঠানো নিশ্চিতকরণ লিংকটি দেখুন।',
    errPasswordTooShort: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
    errNetwork: 'সার্ভারের সাথে সংযোগ হচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।',
    errTooManyAttempts: 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।',
    errCode: '৬ ডিজিটের কোডটি লিখুন।',
    errGeneric: 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।',
  },
} as const;

/** The multicolour Google "G" mark, drawn inline so the button is recognisable at a glance. */
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const fieldErrorStyle: CSSProperties = {
  color: '#a02c3c',
  fontSize: '0.72rem',
  fontWeight: 500,
  lineHeight: 1.45,
};

type FieldName = 'name' | 'email' | 'password' | 'confirmation' | 'recoveryKey' | 'terms' | 'resetCode';
type FieldErrors = Partial<Record<FieldName, string>>;

/** Cloud password reset, inside the cloud login mode: ask for the email ('request'), enter the 6-digit code from the email ('code'), or set the new password on the recovery session ('reset'). The email also keeps the reset link, which opens the 'reset' view directly. */
type CloudResetView = 'none' | 'request' | 'code' | 'reset';

const getSupabaseFriendlyMessage = (error: SupabaseAuthError, language: Language): string | null => {
  const message = error.message.toLowerCase();
  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);
  if (message.includes('invalid login credentials')) {
    return t('Email or password is incorrect. Check them and try again.', 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। যাচাই করে আবার চেষ্টা করুন।');
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return t('An account with this email already exists. Try signing in instead.', 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। সাইন ইন করে দেখুন।');
  }
  if (message.includes('signups not allowed')) {
    return t('No account uses this email yet. Sign up first.', 'এই ইমেইল দিয়ে এখনো কোনো অ্যাকাউন্ট নেই। প্রথমে সাইন আপ করুন।');
  }
  if (message.includes('email not confirmed')) {
    return t('Please confirm your email first — check your inbox for the confirmation link.', 'আগে আপনার ইমেইল নিশ্চিত করুন — ইনবক্সে পাঠানো নিশ্চিতকরণ লিংকটি দেখুন।');
  }
  if (message.includes('password should be at least')) {
    return t('Your password must be at least 6 characters.', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  }
  if (message.includes('expired or is invalid') || message.includes('otp expired')) {
    return t('That code did not work — it may have expired. Request a new code and try again.', 'কোডটি কাজ করেনি — হয়তো মেয়াদ শেষ হয়ে গেছে। নতুন কোড চেয়ে আবার চেষ্টা করুন।');
  }
  if (message.includes('session missing') || message.includes('not signed in') || message.includes('invalid token')) {
    return t('Your reset link has expired or was already used. Request a new link and try again.', 'রিসেট লিংকটির মেয়াদ শেষ হয়ে গেছে অথবা ইতিমধ্যে ব্যবহৃত হয়েছে। নতুন লিংক চেয়ে আবার চেষ্টা করুন।');
  }
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return t('Too many attempts. Please wait a moment and try again.', 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।');
  }
  if (message.includes('failed to fetch') || message.includes('fetch failed') || message.includes('network')) {
    return t('Could not reach the server. Check your connection and try again.', 'সার্ভারের সাথে সংযোগ হচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
  }
  return null;
};

const getErrorMessage = (error: unknown, language: Language): string => {
  if (!(error instanceof Error)) {
    return language === 'bn' ? 'সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Sign-in failed. Please try again.';
  }
  if (error instanceof SupabaseAuthError) {
    return getSupabaseFriendlyMessage(error, language) ?? error.message;
  }
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
    STORAGE_FAILURE: 'স্থানীয় প্রমাণীকরণ ডেটা সংরক্ষণ বা পড়া যায়নি। ব্যবসার ডেটা পরিবর্তন করা হয়নি।',
  };
  return messages[error.code] || error.message;
};

const inputClass = 'auth-input';

/** One-time marker left by a successful cloud sign-up: the sign-in page
 * reads it, shows "account created — sign in", pre-fills the email and
 * clears it, so the notice appears exactly once. */
const ACCOUNT_CREATED_KEY = 'xolvemanager.auth.account-created.v1';

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
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [resultKey, setResultKey] = useState('');
  const [copied, setCopied] = useState(false);
  /** Login only: password form, or passwordless email-link form. */
  const [loginMethod, setLoginMethod] = useState<'password' | 'link'>('password');
  const [linkSent, setLinkSent] = useState(false);
  const text = copy[language];
  // Cloud (Supabase) sign-in is the primary path when configured; the local
  // account on this device stays available as a clearly secondary option.
  // When Supabase is not configured the screen behaves exactly as before
  // (device account only).
  const cloudAvailable = isSupabaseConfigured();
  const [authProvider, setAuthProvider] = useState<'cloud' | 'local'>(cloudAvailable ? 'cloud' : 'local');
  const googleEnabled = isGoogleOAuthEnabled();
  const [cloudResetView, setCloudResetView] = useState<CloudResetView>('none');
  const [resetLinkFailed, setResetLinkFailed] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resent, setResent] = useState(false);

  // Dark mode follows the operating system (prefers-color-scheme), so the
  // wordmark switches to its light variant on dark backgrounds.
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    try {
      setLanguage(window.localStorage.getItem('sqp_lang_v2') === 'bn' ? 'bn' : 'en');
    } catch {
      setLanguage('en');
    }
  }, []);

  // Detect a cloud password-reset landing. The app shell's session check
  // runs before this screen mounts, so a recovery session is already marked
  // by then; the subscription covers the event arriving after mount.
  useEffect(() => {
    if (!cloudAvailable) return;
    let cancelled = false;
    const unsubscribe = subscribeToSupabaseAuthChanges((event) => {
      if (event === 'PASSWORD_RECOVERY' && !cancelled) {
        setAuthProvider('cloud');
        setCloudResetView('reset');
      }
    });
    void hasCloudPasswordRecoverySession().then((isRecovery) => {
      if (cancelled) return;
      if (isRecovery) {
        setAuthProvider('cloud');
        setCloudResetView('reset');
        return;
      }
      // A reset link that could not be used (expired or already used)
      // still leaves its error in the URL — in the query string for a
      // code link, or in the hash for a token link. A leftover token in
      // the hash means the link was not accepted either.
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      if (params.has('code') || params.has('error') || hashParams.has('error') || hashParams.has('access_token')) {
        setAuthProvider('cloud');
        setCloudResetView('request');
        setResetLinkFailed(true);
      }
    }).catch(() => {
      // Detection failure: stay on the normal sign-in form.
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  // After a cloud sign-up, the sign-in page shows the one-time notice
  // and pre-fills the new account's email. When email confirmation is
  // on, the notice instead asks the user to open the confirmation link.
  useEffect(() => {
    if (mode !== 'login') return;
    try {
      const raw = window.sessionStorage.getItem(ACCOUNT_CREATED_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(ACCOUNT_CREATED_KEY);
      const parsed = JSON.parse(raw) as { email?: unknown; confirmationPending?: unknown };
      const createdEmail = typeof parsed.email === 'string' ? parsed.email : '';
      if (createdEmail) setEmail(createdEmail);
      setNotice(parsed.confirmationPending === true
        ? text.accountConfirmationNotice.replace('{email}', createdEmail)
        : text.accountCreatedNotice);
    } catch {
      // No notice: sign-in works normally without it.
    }
  }, [mode, text]);

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
    setNotice('');
    setLoginMethod('password');
    setLinkSent(false);
    setFieldErrors({});
    setResultKey('');
    setCopied(false);
    setAcceptedTerms(false);
    setCloudResetView('none');
    setResetLinkFailed(false);
    setResetCode('');
    setResent(false);
    onNavigate(path);
  };

  const switchProvider = (provider: 'cloud' | 'local') => {
    setAuthProvider(provider);
    setError('');
    setFieldErrors({});
    setLoginMethod('password');
    setLinkSent(false);
    setCloudResetView('none');
    setResetLinkFailed(false);
    setResetCode('');
    setResent(false);
  };

  /** Leave the cloud reset flow and return to the normal sign-in form. */
  const closeCloudReset = () => {
    setCloudResetView('none');
    setResetLinkFailed(false);
    setResetCode('');
    setResent(false);
    setError('');
    setFieldErrors({});
    setPassword('');
    setConfirmation('');
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    // Passwordless email-link sign-in: only the email matters.
    if (mode === 'login' && authProvider === 'cloud' && loginMethod === 'link') {
      if (!isValidAuthEmail(email)) errors.email = text.errEmail;
      return errors;
    }
    if (mode === 'signup') {
      if (name.trim().length === 0) errors.name = text.errName;
      else if (name.trim().length > 100) errors.name = text.errNameLong;
    }
    if (!isValidAuthEmail(email)) errors.email = text.errEmail;
    if (mode === 'forgot-password' && recoveryKey.trim().length === 0) {
      errors.recoveryKey = text.errRecoveryKey;
    }
    if (mode === 'login') {
      if (password.length === 0) errors.password = text.errPasswordRequired;
    } else if (password.length === 0) {
      errors.password = text.errPasswordChoose;
    } else if (getPasswordStrength(password) < 3) {
      errors.password = text.errPasswordWeak;
    }
    if (mode !== 'login') {
      if (confirmation.length === 0) errors.confirmation = text.errConfirmRequired;
      else if (confirmation !== password) errors.confirmation = text.errConfirmMismatch;
    }
    if (mode === 'signup' && !acceptedTerms) errors.terms = text.errTerms;
    return errors;
  };

  const validateCloudResetForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (cloudResetView === 'request') {
      if (!isValidAuthEmail(email)) errors.email = text.errEmail;
    }
    if (cloudResetView === 'code') {
      if (!/^\d{6}$/.test(resetCode)) errors.resetCode = text.errCode;
    }
    if (cloudResetView === 'reset') {
      if (password.length === 0) errors.password = text.errPasswordChoose;
      else if (getPasswordStrength(password) < 3) errors.password = text.errPasswordWeak;
      if (confirmation.length === 0) errors.confirmation = text.errConfirmRequired;
      else if (confirmation !== password) errors.confirmation = text.errConfirmMismatch;
    }
    return errors;
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
    // Cloud password reset, inside the cloud login mode: ask for the email
    // and send a code, verify the 6-digit code, or set the new password
    // on the recovery session.
    if (cloudResetView === 'request' || cloudResetView === 'code' || cloudResetView === 'reset') {
      const errors = validateCloudResetForm();
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      setBusy(true);
      try {
        if (cloudResetView === 'request') {
          await requestCloudPasswordReset(email);
          setResetLinkFailed(false);
          setResent(false);
          setResetCode('');
          setCloudResetView('code');
        } else if (cloudResetView === 'code') {
          await verifyCloudPasswordResetCode(email, resetCode);
          setResetCode('');
          setCloudResetView('reset');
        } else {
          const user = await setCloudPassword(password);
          onAuthenticated(user);
        }
      } catch (caught) {
        setError(getErrorMessage(caught, language));
      } finally {
        setBusy(false);
      }
      return;
    }
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      if (mode === 'login' && authProvider === 'cloud' && loginMethod === 'link') {
        await signInWithEmailLink(email);
        setLinkSent(true);
        return;
      }
      if (mode === 'login' && authProvider === 'cloud') {
        const user = await signInWithSupabase(email, password);
        onAuthenticated(user);
        return;
      }
      if (mode === 'signup' && authProvider === 'cloud') {
        const { user, confirmationPending } = await signUpWithSupabase(name, email, password);
        // The new account is NOT signed in: leave a one-time marker and
        // send the user to the sign-in page to sign in with it.
        try {
          window.sessionStorage.setItem(ACCOUNT_CREATED_KEY, JSON.stringify({ email: user.email, confirmationPending, at: Date.now() }));
        } catch {
          // No marker: the sign-in page still works, just without the notice.
        }
        navigate('/login');
        return;
      }
      if (mode === 'login') {
        clearCloudSessionFlag();
        const user = await signInLocally(email, password);
        onAuthenticated(user);
      } else if (mode === 'signup') {
        if (hasAccount) {
          setError(text.setupDisabled);
          return;
        }
        clearCloudSessionFlag();
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

  const handleGoogleLogin = async () => {
    setError('');
    setOauthBusy(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(getErrorMessage(caught, language));
    } finally {
      setOauthBusy(false);
    }
  };

  const handleResendEmailLink = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithEmailLink(email);
    } catch (caught) {
      setError(getErrorMessage(caught, language));
    } finally {
      setBusy(false);
    }
  };

  const handleResendResetLink = async () => {
    setError('');
    setBusy(true);
    try {
      await requestCloudPasswordReset(email);
      setResent(true);
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
  const title = cloudResetView === 'code'
    ? text.cloudResetCodeTitle
    : cloudResetView === 'reset'
      ? text.cloudResetSetTitle
      : cloudResetView !== 'none'
        ? text.cloudResetTitle
        : mode === 'login'
          ? text.loginTitle
          : mode === 'signup'
            ? (authProvider === 'cloud' ? text.signupTitleCloud : text.signupTitleLocal)
            : text.recoveryTitle;
  const intro = cloudResetView === 'code'
    ? text.cloudResetCodeIntro.replace('{email}', email)
    : cloudResetView === 'reset'
      ? text.cloudResetSetIntro
      : cloudResetView !== 'none'
        ? text.cloudResetIntro
        : mode === 'forgot-password'
          ? text.recoveryIntro
          : authProvider === 'cloud'
            ? (mode === 'login' ? text.loginIntroCloud : text.signupIntroCloud)
            : (mode === 'login' ? text.loginIntroLocal : text.signupIntroLocal);

  const fieldError = (field: FieldName) => fieldErrors[field] ? (
    <span id={`${field}-error`} role="alert" style={fieldErrorStyle}>{fieldErrors[field]}</span>
  ) : null;

  return (
    <main className={`auth-page ${styles.shell}`} data-auth-language={language} data-auth-mode={mode}>
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button type="button" onClick={updateLanguage} className="auth-language" aria-label={language === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}><Globe2 aria-hidden="true" />{text.language}<ChevronRight aria-hidden="true" /></button>
        </div>
        <div className={styles.brandmark}>
          <ProductLogo size="compact" tone={prefersDark ? 'inverse' : 'default'} showTagline className={styles.brandLogo} />
        </div>

        {resultKey ? (
          <section className={styles.card} aria-labelledby="auth-heading">
            <div className="auth-success">
                  <div className="auth-success-mark"><KeyRound aria-hidden="true" /></div>
                  <p className="auth-eyebrow">{text.savedEyebrow}</p>
                  <h2 id="auth-heading">{mode === 'signup' ? text.accountSavedTitle : text.recoverySavedTitle}</h2>
                  <p className="auth-intro">{mode === 'signup' ? text.accountSaved : text.recoverySaved}</p>
                  <div className="auth-recovery-key" aria-label={text.recoveryKey}>{resultKey}</div>
                  <button type="button" onClick={handleCopyKey} className="auth-secondary-button">{copied ? text.copied : text.copyKey}</button>
                  {mode === 'signup' && <p className="auth-policy-note">{text.singleOwnerPolicy}</p>}
                  <button type="button" onClick={() => navigate('/login')} className={styles.primaryBtn} style={{ marginTop: '1.2rem' }}>{text.continue}</button>
                </div>
          </section>
        ) : (
          <>
            <header className={styles.heading}>
              <h1 id="auth-heading">{title}</h1>
              <p className={styles.intro}>{intro}</p>
            </header>
            <section className={styles.card} aria-labelledby="auth-heading">

                  {error && <div role="alert" aria-live="assertive" className="auth-alert auth-alert--error">{error}</div>}
                  {notice && <div role="status" className="auth-alert auth-alert--success">{notice}</div>}
                  {cloudResetView === 'request' && resetLinkFailed && <div role="alert" className="auth-alert auth-alert--warning">{text.cloudResetLinkInvalid}</div>}
                  {mode === 'signup' && hasAccount && authProvider === 'local' && <div role="alert" className="auth-alert auth-alert--warning">{text.setupDisabled}</div>}

                  {cloudAvailable && authProvider === 'local' && mode !== 'forgot-password' && (
                    <button type="button" onClick={() => switchProvider('cloud')} className="auth-text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                      <Cloud aria-hidden="true" style={{ width: '0.9rem', height: '0.9rem' }} />{text.backToCloud}
                    </button>
                  )}

                  {linkSent ? (
                    <>
                      <p className="auth-session-note" role="status">{text.emailLinkSent.replace('{email}', email)}</p>
                      <button type="button" onClick={() => void handleResendEmailLink()} disabled={busy || oauthBusy} className="auth-secondary-button" style={{ width: '100%' }}>{busy ? text.loading : text.emailLinkResend}</button>
                      <div className="auth-links">
                        <button type="button" onClick={() => { setLinkSent(false); setLoginMethod('password'); }} className="auth-text-link">{text.usePassword}</button>
                      </div>
                    </>
                  ) : (
                  <form onSubmit={handleSubmit} className="auth-form" aria-busy={busy} noValidate>
                    {mode === 'signup' && (
                      <label className="auth-field">{text.fullName}
                        <span className="auth-input-wrap"><UserRound aria-hidden="true" /><input autoComplete="name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); clearFieldError('name'); }} className={`${inputClass} auth-input--with-icon`} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'name-error' : undefined} /></span>
                        {fieldError('name')}
                      </label>
                    )}
                    {cloudResetView !== 'reset' && cloudResetView !== 'code' && (
                    <label className="auth-field">{text.email}
                      <span className="auth-input-wrap"><Mail aria-hidden="true" /><input type="email" autoComplete={mode === 'login' ? 'off' : 'email'} required value={email} onChange={event => { setEmail(event.target.value); clearFieldError('email'); }} className={`${inputClass} auth-input--with-icon`} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} /></span>
                      {fieldError('email')}
                    </label>
                    )}

                    {cloudResetView === 'code' && (
                    <label className="auth-field">{text.cloudResetCodeLabel}
                      <span className="auth-input-wrap"><KeyRound aria-hidden="true" /><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={resetCode} onChange={event => { setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('resetCode'); }} className={`${inputClass} auth-input--with-icon auth-input--mono`} aria-invalid={!!fieldErrors.resetCode} aria-describedby={fieldErrors.resetCode ? 'resetCode-error' : undefined} /></span>
                      {fieldError('resetCode')}
                    </label>
                    )}

                    {mode === 'forgot-password' && (
                      <label className="auth-field">{text.recoveryKey}
                        <input autoComplete="off" required value={recoveryKey} onChange={event => { setRecoveryKey(event.target.value); clearFieldError('recoveryKey'); }} className={`${inputClass} auth-input--mono`} aria-invalid={!!fieldErrors.recoveryKey} aria-describedby={fieldErrors.recoveryKey ? 'recoveryKey-error' : undefined} />
                        {fieldError('recoveryKey')}
                      </label>
                    )}

                    {cloudResetView !== 'request' && cloudResetView !== 'code' && loginMethod !== 'link' && (
                    <label className="auth-field">{text.password}
                      <span className="auth-password-wrap">
                        <LockKeyhole aria-hidden="true" />
                        <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={event => { setPassword(event.target.value); clearFieldError('password'); }} className={`${inputClass} auth-input--password auth-input--with-icon`} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined} />
                        <button type="button" onClick={() => setShowPassword(value => !value)} className="auth-visibility-button" aria-label={showPassword ? text.hide : text.show} aria-pressed={showPassword}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                      </span>
                      {fieldError('password')}
                    </label>
                    )}
                    {(mode !== 'login' || cloudResetView === 'reset') && password.length > 0 && (
                      <div aria-live="polite" className="auth-strength">
                        <div className="auth-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map(level => <span key={level} className={strength >= level ? `is-active strength-${strength}` : ''} />)}</div>
                        <span>{text.strength[strength]}</span>
                      </div>
                    )}

                    {(mode !== 'login' || cloudResetView === 'reset') && (
                      <label className="auth-field">{text.confirmPassword}
                        <span className="auth-password-wrap">
                          <LockKeyhole aria-hidden="true" />
                          <input type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={event => { setConfirmation(event.target.value); clearFieldError('confirmation'); }} className={`${inputClass} auth-input--password auth-input--with-icon`} aria-invalid={!!fieldErrors.confirmation} aria-describedby={fieldErrors.confirmation ? 'confirmation-error' : undefined} />
                          <button type="button" onClick={() => setShowConfirmation(value => !value)} className="auth-visibility-button" aria-label={showConfirmation ? text.hide : text.show} aria-pressed={showConfirmation}>{showConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                        </span>
                        {fieldError('confirmation')}
                      </label>
                    )}

                    {mode === 'login' && authProvider === 'local' && (
                      <div className="auth-login-options">
                        <p className="auth-session-note">{text.persistentSession}</p>
                        <button type="button" onClick={() => navigate('/forgot-password')} className="auth-text-link">{text.forgot}</button>
                      </div>
                    )}
                    {mode === 'login' && authProvider === 'cloud' && cloudResetView === 'none' && loginMethod !== 'link' && (
                      <div className="auth-login-options">
                        <p className="auth-session-note">{text.cloudSessionNote}</p>
                        <button type="button" onClick={() => { setError(''); setFieldErrors({}); setCloudResetView('request'); }} className="auth-text-link">{text.cloudForgot}</button>
                      </div>
                    )}
                    {mode === 'forgot-password' && (
                      <p className="auth-session-note">{text.deviceActiveNote}</p>
                    )}

                    {mode === 'signup' && (
                      <div>
                        <label className="auth-terms">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={event => { setAcceptedTerms(event.target.checked); clearFieldError('terms'); }}
                            aria-label="Acknowledge the terms and privacy notice"
                            aria-invalid={!!fieldErrors.terms}
                            aria-describedby={fieldErrors.terms ? 'terms-error' : undefined}
                            required
                          />
                          <span>
                            {text.termsLabel}{' '}
                            <a href="/legal/terms" className="auth-inline-link">{text.termsLink}</a>
                          </span>
                        </label>
                        {fieldError('terms')}
                      </div>
                    )}

                    <button type="submit" disabled={busy || oauthBusy || (mode === 'signup' && hasAccount && authProvider === 'local')} className={styles.primaryBtn}>{busy && <LoaderCircle className="auth-spinner" aria-hidden="true" />}{busy ? text.loading : cloudResetView === 'request' ? text.cloudResetSend : cloudResetView === 'code' ? text.cloudResetVerify : cloudResetView === 'reset' ? text.recover : mode === 'login' && authProvider === 'cloud' && loginMethod === 'link' ? text.sendEmailLink : mode === 'login' ? <>{text.signIn}<ArrowRight aria-hidden="true" /></> : mode === 'signup' ? text.create : text.recover}</button>

                    {cloudResetView === 'code' && (
                      <div style={{ textAlign: 'center' }}>
                        {resent && <p className="auth-session-note" role="status">{text.cloudResetResent}</p>}
                        <button type="button" onClick={() => void handleResendResetLink()} disabled={busy || oauthBusy} className="auth-text-link">{text.cloudResetResend}</button>
                      </div>
                    )}

                    {mode === 'login' && authProvider === 'cloud' && cloudResetView === 'none' && (
                      <div style={{ textAlign: 'center' }}>
                        <button type="button" onClick={() => { setLoginMethod(loginMethod === 'link' ? 'password' : 'link'); setError(''); setFieldErrors({}); setLinkSent(false); }} className="auth-text-link">
                          {loginMethod === 'link' ? text.usePassword : text.useEmailLink}
                        </button>
                      </div>
                    )}
                  </form>
                  )}

                  {/* Google sign-in sits below the email form, as on most sites. */}
                  {cloudAvailable && authProvider === 'cloud' && mode !== 'forgot-password' && cloudResetView === 'none' && !linkSent && (
                    <>
                      <div className="auth-divider"><span />{text.emailDivider}<span /></div>
                      <button type="button" onClick={() => void handleGoogleLogin()} disabled={busy || oauthBusy || !googleEnabled} className={styles.googleBtn} title={googleEnabled ? undefined : 'Google sign-in is not configured yet.'}>
                        {oauthBusy ? <LoaderCircle className="auth-spinner" aria-hidden="true" /> : <GoogleMark />}
                        <span>{oauthBusy ? text.googleLoading : text.google}</span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                      {googleEnabled
                        ? <p className="auth-session-note" style={{ marginTop: '0.5rem' }}>{text.googleNote}</p>
                        : <p className="auth-session-note" style={{ marginTop: '0.5rem' }}>{language === 'bn' ? 'Google সাইন-ইন এখনও চালু হয়নি — ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।' : 'Google sign-in is not configured yet — use email and password.'}</p>}
                    </>
                  )}

                  {cloudResetView !== 'none' && (
                    <div className="auth-links">
                      <button type="button" onClick={closeCloudReset} className="auth-text-link">{text.loginLink}</button>
                    </div>
                  )}

                  {mode === 'forgot-password' && (
                    <div className="auth-links">
                      <button type="button" onClick={() => navigate('/login')} className="auth-text-link">{text.loginLink}</button>
                    </div>
                  )}
                </section>

            {(mode === 'login' || mode === 'signup') && cloudResetView === 'none' && (
              <p className={styles.switch}>
                {mode === 'login' ? text.createAccountPrompt : text.signInPrompt}{' '}
                <button type="button" onClick={() => navigate(mode === 'login' ? '/signup' : '/login')} className={styles.switchLink} disabled={busy || oauthBusy}>
                  {mode === 'login' ? text.signUp : text.signIn}
                </button>
              </p>
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
    </main>
  );
}
