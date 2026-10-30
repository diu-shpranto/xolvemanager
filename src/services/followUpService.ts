import type { Reminder, ReminderStatus } from '../types';
import { sanitizeReminderText, type ReminderCandidate } from './reminderEngine';

type ManualReminderInput = Omit<ReminderCandidate, 'businessId' | 'deterministicKey' | 'systemGenerated'>;

interface ReminderIdentity {
  id: string;
  businessId?: string;
  now?: string;
}

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
};

export function createManualReminderRecord(
  details: ManualReminderInput,
  existing: Reminder[],
  identity: ReminderIdentity
): Reminder {
  if (!details.title.trim()) throw new Error('Enter a follow-up reason.');
  if (!details.customerId) throw new Error('Select a customer for this follow-up.');
  if (!isValidDate(details.dueDate)) throw new Error('Choose a valid follow-up date.');
  if (details.dueAt && !Number.isFinite(Date.parse(details.dueAt))) {
    throw new Error('Choose a valid follow-up time.');
  }

  const sourceEntityId = details.sourceEntityId || details.customerId;
  const deterministicKey = [
    identity.businessId || 'local',
    details.type,
    sourceEntityId,
    details.targetDate || details.dueDate,
    details.stage || details.title.trim().toLocaleLowerCase(),
  ].join(':');
  if (existing.some(reminder => reminder.deterministicKey === deterministicKey
    && (!identity.businessId || !reminder.businessId || reminder.businessId === identity.businessId))) {
    throw new Error('A follow-up for this customer and date already exists.');
  }

  const now = identity.now || new Date().toISOString();
  const reminder: Reminder = {
    ...details,
    title: sanitizeReminderText(details.title.trim()),
    description: details.description ? sanitizeReminderText(details.description) : undefined,
    id: identity.id,
    reminderId: identity.id,
    businessId: identity.businessId,
    deterministicKey,
    sourceEntityId,
    status: 'open',
    systemGenerated: false,
    createdAt: now,
    updatedAt: now,
  };
  return reminder;
}

export function updateReminderRecord(
  reminders: Reminder[],
  reminderId: string,
  status: ReminderStatus,
  now: string,
  details: { snoozedUntil?: string; outcome?: string } = {},
  businessId?: string
): Reminder[] {
  const reminder = reminders.find(item => item.id === reminderId
    && (!businessId || !item.businessId || item.businessId === businessId));
  if (!reminder) throw new Error('Reminder could not be found.');

  return reminders.map(item => item.id === reminderId
    && (!businessId || !item.businessId || item.businessId === businessId) ? {
    ...item,
    status,
    snoozedUntil: status === 'snoozed' ? details.snoozedUntil : undefined,
    completedAt: status === 'completed' ? now : undefined,
    dismissedAt: status === 'dismissed' ? now : undefined,
    outcome: details.outcome === undefined ? item.outcome : sanitizeReminderText(details.outcome.trim()),
    updatedAt: now,
  } : item);
}
