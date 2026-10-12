export const AUTH_ACCOUNTS_KEY = 'xolvemanager.auth.accounts.v1';
export const AUTH_SESSION_KEY = 'xolvemanager.auth.session.v1';
export const AUTH_LOGOUT_SIGNAL_KEY = 'xolvemanager.auth.logout-signal.v1';
export const AUTH_STATE_EVENT = 'xolvemanager:auth-state';
export const PASSWORD_ITERATIONS = 600_000;

export interface LocalAuthUser {
  uid: string;
  email: string;
  name: string;
  role: 'owner';
}

interface PasswordCredential {
  salt: string;
  verifier: string;
  iterations: number;
}

interface LocalAccount extends LocalAuthUser {
  passwordCredential: PasswordCredential;
  recoveryCredential: PasswordCredential;
  activeSessions: string[];
  createdAt: string;
}

interface AuthDatabase {
  version: 1;
  account: LocalAccount;
}

interface SessionRecord {
  version: 1;
  uid: string;
  sessionId: string;
}

export type AuthErrorCode =
  | 'AUTH_UNAVAILABLE'
  | 'CORRUPT_AUTH_DATA'
  | 'ACCOUNT_EXISTS'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_EMAIL'
  | 'INVALID_NAME'
  | 'WEAK_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'INVALID_RECOVERY_KEY'
  | 'STORAGE_FAILURE';

export class LocalAuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'LocalAuthError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isValidAuthEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

export const getPasswordStrength = (password: string): number => {
  const checks = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length;
};

export const isStrongAuthPassword = (password: string): boolean =>
  getPasswordStrength(password) >= 3;

const getBrowserWindow = (): Window => {
  if (typeof window === 'undefined' || !window.localStorage || !window.sessionStorage) {
    throw new LocalAuthError('AUTH_UNAVAILABLE', 'Browser storage is unavailable. Local sign-in cannot continue.');
  }
  return window;
};

const getCrypto = (): Crypto => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new LocalAuthError('AUTH_UNAVAILABLE', 'Secure browser cryptography is unavailable in this environment.');
  }
  return globalThis.crypto;
};

const randomHex = (byteLength: number): string => {
  const bytes = getCrypto().getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const hexToBytes = (value: string): Uint8Array =>
  new Uint8Array(value.match(/.{2}/g)?.map(byte => Number.parseInt(byte, 16)) || []);

const deriveVerifier = async (secret: string, salt: string): Promise<string> => {
  const crypto = getCrypto();
  const saltBytes = hexToBytes(salt);
  const saltBuffer = new ArrayBuffer(saltBytes.length);
  new Uint8Array(saltBuffer).set(saltBytes);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: saltBuffer,
    iterations: PASSWORD_ITERATIONS,
  }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
};

const equalsConstantTime = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const isCredential = (value: unknown): value is PasswordCredential =>
  isRecord(value)
  && typeof value.salt === 'string'
  && /^[a-f0-9]{32}$/.test(value.salt)
  && typeof value.verifier === 'string'
  && /^[a-f0-9]{64}$/.test(value.verifier)
  && value.iterations === PASSWORD_ITERATIONS;

const isAuthDatabase = (value: unknown): value is AuthDatabase => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.account)) return false;
  const account = value.account;
  return typeof account.uid === 'string'
    && /^[a-f0-9]{64}$/.test(account.uid)
    && typeof account.email === 'string'
    && isValidAuthEmail(account.email)
    && account.email === normalizeEmail(account.email)
    && typeof account.name === 'string'
    && Boolean(account.name.trim())
    && account.name.length <= 100
    && account.role === 'owner'
    && isCredential(account.passwordCredential)
    && isCredential(account.recoveryCredential)
    && Array.isArray(account.activeSessions)
    && account.activeSessions.every(session => typeof session === 'string' && /^[a-f0-9]{64}$/.test(session))
    && new Set(account.activeSessions).size === account.activeSessions.length
    && typeof account.createdAt === 'string'
    && Number.isFinite(Date.parse(account.createdAt));
};

const readDatabase = (): AuthDatabase | null => {
  let raw: string | null;
  try {
    raw = getBrowserWindow().localStorage.getItem(AUTH_ACCOUNTS_KEY);
  } catch (error) {
    if (error instanceof LocalAuthError) throw error;
    throw new LocalAuthError('STORAGE_FAILURE', 'Local authentication data could not be read. Existing data was not changed.');
  }
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAuthDatabase(parsed)) return parsed;
  } catch {
    // Keep the invalid auth value untouched so it can be recovered manually.
  }
  throw new LocalAuthError(
    'CORRUPT_AUTH_DATA',
    'Local authentication data is damaged. It has been left untouched; do not clear browser storage or try to sign up again.'
  );
};

const writeDatabase = (database: AuthDatabase): void => {
  try {
    getBrowserWindow().localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(database));
  } catch (error) {
    if (error instanceof LocalAuthError) throw error;
    throw new LocalAuthError('STORAGE_FAILURE', 'Local authentication data could not be saved. Existing business data was not changed.');
  }
  notifyAuthStateChange();
};

const notifyAuthStateChange = (): void => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT));
  }
};

const toUser = (account: LocalAccount): LocalAuthUser => ({
  uid: account.uid,
  email: account.email,
  name: account.name,
  role: account.role,
});

const formatRecoveryKey = (): string => {
  const raw = randomHex(32).toUpperCase();
  return raw.match(/.{1,8}/g)?.join('-') || raw;
};

const normalizeRecoveryKey = (key: string): string =>
  key.replace(/[^a-f0-9]/gi, '').toLowerCase();

const readSession = (): { record: SessionRecord; storage: Storage } | null => {
  const browser = getBrowserWindow();
  for (const storage of [browser.localStorage, browser.sessionStorage]) {
    let raw: string | null;
    try {
      raw = storage.getItem(AUTH_SESSION_KEY);
    } catch {
      throw new LocalAuthError('STORAGE_FAILURE', 'The local sign-in session could not be read.');
    }
    if (raw === null) continue;
    try {
      const value: unknown = JSON.parse(raw);
      if (isRecord(value)
        && value.version === 1
        && typeof value.uid === 'string'
        && /^[a-f0-9]{64}$/.test(value.uid)
        && typeof value.sessionId === 'string'
        && /^[a-f0-9]{64}$/.test(value.sessionId)) {
        return {
          record: { version: 1, uid: value.uid, sessionId: value.sessionId },
          storage,
        };
      }
    } catch {
      // Remove only this malformed authentication session; never touch business records.
    }
    storage.removeItem(AUTH_SESSION_KEY);
  }
  return null;
};

const removeLocalSession = (): void => {
  const browser = getBrowserWindow();
  browser.localStorage.removeItem(AUTH_SESSION_KEY);
  browser.sessionStorage.removeItem(AUTH_SESSION_KEY);
};

const signalOtherTabs = (): void => {
  try {
    getBrowserWindow().localStorage.setItem(AUTH_LOGOUT_SIGNAL_KEY, randomHex(16));
  } catch {
    // The current tab is still signed out even if cross-tab signaling is unavailable.
  }
};

export const DEMO_OWNER_EMAIL = 'demo@xolvemanager.com';
export const DEMO_OWNER_PASSWORD = 'Demo@1234';

export const hasLocalAccount = (): boolean => Boolean(readDatabase());

export const signInWithDemoAccount = async (): Promise<LocalAuthUser> => {
  const database = readDatabase();
  if (!database) {
    await createOwnerAccount('Demo Owner', DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD, DEMO_OWNER_PASSWORD);
  }
  return signInLocally(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD);
};

export const restoreLocalSession = (): LocalAuthUser | null => {
  const session = readSession();
  if (!session) return null;
  const database = readDatabase();
  if (!database
    || database.account.uid !== session.record.uid
    || !database.account.activeSessions.includes(session.record.sessionId)) {
    removeLocalSession();
    return null;
  }
  return toUser(database.account);
};

export const createOwnerAccount = async (
  name: string,
  email: string,
  password: string,
  confirmation: string
): Promise<{ user: LocalAuthUser; recoveryKey: string }> => {
  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedName || normalizedName.length > 100) {
    throw new LocalAuthError('INVALID_NAME', 'Enter your full name (up to 100 characters).');
  }
  if (!isValidAuthEmail(normalizedEmail)) {
    throw new LocalAuthError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  if (!isStrongAuthPassword(password)) {
    throw new LocalAuthError('WEAK_PASSWORD', 'Use at least 10 characters and include three of: uppercase, lowercase, number, and symbol.');
  }
  if (password !== confirmation) {
    throw new LocalAuthError('PASSWORD_MISMATCH', 'The passwords do not match.');
  }
  if (readDatabase()) {
    throw new LocalAuthError('ACCOUNT_EXISTS', 'An owner account is already set up in this browser. Additional registrations are disabled.');
  }

  const recoveryKey = formatRecoveryKey();
  const [passwordSalt, recoverySalt] = [randomHex(16), randomHex(16)];
  const [passwordVerifier, recoveryVerifier] = await Promise.all([
    deriveVerifier(password, passwordSalt),
    deriveVerifier(normalizeRecoveryKey(recoveryKey), recoverySalt),
  ]);
  const account: LocalAccount = {
    uid: randomHex(32),
    email: normalizedEmail,
    name: normalizedName,
    role: 'owner',
    passwordCredential: { salt: passwordSalt, verifier: passwordVerifier, iterations: PASSWORD_ITERATIONS },
    recoveryCredential: { salt: recoverySalt, verifier: recoveryVerifier, iterations: PASSWORD_ITERATIONS },
    activeSessions: [],
    createdAt: new Date().toISOString(),
  };
  if (readDatabase()) {
    throw new LocalAuthError('ACCOUNT_EXISTS', 'An owner account is already set up in this browser. Additional registrations are disabled.');
  }
  writeDatabase({ version: 1, account });
  return { user: toUser(account), recoveryKey };
};

export const signInLocally = async (
  email: string,
  password: string
): Promise<LocalAuthUser> => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidAuthEmail(normalizedEmail)) {
    throw new LocalAuthError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  const database = readDatabase();
  if (!database) throw new LocalAuthError('ACCOUNT_NOT_FOUND', 'No local account exists yet. Create the owner account first.');
  if (database.account.email !== normalizedEmail) {
    throw new LocalAuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const { salt, verifier } = database.account.passwordCredential;
  const candidate = await deriveVerifier(password, salt);
  if (!equalsConstantTime(candidate, verifier)) {
    throw new LocalAuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const browser = getBrowserWindow();
  const sessionId = randomHex(32);
  const record: SessionRecord = { version: 1, uid: database.account.uid, sessionId };
  const targetStorage = browser.localStorage;
  const otherStorage = browser.sessionStorage;
  try {
    database.account.activeSessions.push(sessionId);
    writeDatabase(database);
    targetStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(record));
    otherStorage.removeItem(AUTH_SESSION_KEY);
  } catch (error) {
    targetStorage.removeItem(AUTH_SESSION_KEY);
    database.account.activeSessions = database.account.activeSessions.filter(id => id !== sessionId);
    try {
      writeDatabase(database);
    } catch (rollbackError) {
      console.error('Could not roll back an incomplete local sign-in.');
      throw rollbackError;
    }
    throw error instanceof LocalAuthError
      ? error
      : new LocalAuthError('STORAGE_FAILURE', 'The local sign-in session could not be saved.');
  }
  return toUser(database.account);
};

export const signOutLocally = (broadcast = true): void => {
  let failure: unknown;
  try {
    const session = readSession();
    const database = readDatabase();
    if (session && database && database.account.uid === session.record.uid) {
      database.account.activeSessions = database.account.activeSessions
        .filter(sessionId => sessionId !== session.record.sessionId);
      writeDatabase(database);
    }
  } catch (error) {
    failure = error;
  }
  try {
    removeLocalSession();
  } catch (error) {
    failure ??= error;
  }
  if (broadcast) signalOtherTabs();
  notifyAuthStateChange();
  if (failure) throw failure;
};

export const resetLocalPassword = async (
  email: string,
  recoveryKey: string,
  password: string,
  confirmation: string
): Promise<{ recoveryKey: string }> => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidAuthEmail(normalizedEmail)) {
    throw new LocalAuthError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  if (!isStrongAuthPassword(password)) {
    throw new LocalAuthError('WEAK_PASSWORD', 'Use at least 10 characters and include three of: uppercase, lowercase, number, and symbol.');
  }
  if (password !== confirmation) {
    throw new LocalAuthError('PASSWORD_MISMATCH', 'The passwords do not match.');
  }
  const database = readDatabase();
  if (!database || database.account.email !== normalizedEmail) {
    throw new LocalAuthError('INVALID_RECOVERY_KEY', 'The email address or recovery key is incorrect.');
  }
  const normalizedKey = normalizeRecoveryKey(recoveryKey);
  if (!/^[a-f0-9]{64}$/.test(normalizedKey)) {
    throw new LocalAuthError('INVALID_RECOVERY_KEY', 'The email address or recovery key is incorrect.');
  }
  const { salt, verifier } = database.account.recoveryCredential;
  const candidate = await deriveVerifier(normalizedKey, salt);
  if (!equalsConstantTime(candidate, verifier)) {
    throw new LocalAuthError('INVALID_RECOVERY_KEY', 'The email address or recovery key is incorrect.');
  }

  const nextRecoveryKey = formatRecoveryKey();
  const passwordSalt = randomHex(16);
  const recoverySalt = randomHex(16);
  const [passwordVerifier, recoveryVerifier] = await Promise.all([
    deriveVerifier(password, passwordSalt),
    deriveVerifier(normalizeRecoveryKey(nextRecoveryKey), recoverySalt),
  ]);
  database.account.passwordCredential = {
    salt: passwordSalt,
    verifier: passwordVerifier,
    iterations: PASSWORD_ITERATIONS,
  };
  database.account.recoveryCredential = {
    salt: recoverySalt,
    verifier: recoveryVerifier,
    iterations: PASSWORD_ITERATIONS,
  };
  database.account.activeSessions = [];
  writeDatabase(database);
  removeLocalSession();
  signalOtherTabs();
  return { recoveryKey: nextRecoveryKey };
};

export const localAuthMessages = {
  storageWarning: 'This local account is stored only in this browser profile. It is not a secure server-side identity system; anyone with access to this device/browser profile may access or change local data.',
  singleOwnerPolicy: 'This app supports one owner account per browser profile. The first person who creates it becomes the owner. Additional sign-ups are disabled.',
} as const;
