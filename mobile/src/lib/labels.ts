import type { PillTone } from '@/components/Pill';
import { colors } from '@/theme';
import { rupiah } from './format';
import type { Child, Expense, ExpenseCategory, HandoffEvent, InfoCategory, Person } from './types';

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; emoji: string; tile: string }> = {
  school: { label: 'School', emoji: '🎒', tile: colors.accentSoft },
  health: { label: 'Health', emoji: '🩺', tile: colors.primarySoft },
  activities: { label: 'Activities', emoji: '⚽', tile: colors.accentSoft },
  clothing: { label: 'Clothing', emoji: '👟', tile: colors.primaryTint },
  other: { label: 'Other', emoji: '🛍️', tile: colors.field },
};

export const INFO_CATEGORIES: Record<
  InfoCategory,
  { label: string; emoji: string; labelHint: string; valueHint: string }
> = {
  health: { label: 'Health', emoji: '🩺', labelHint: 'e.g. Allergies', valueHint: 'e.g. Peanuts' },
  school: { label: 'School', emoji: '🎒', labelHint: 'e.g. Homeroom teacher', valueHint: 'e.g. Bu Ratna, Grade 1B' },
  contacts: { label: 'Contacts', emoji: '📞', labelHint: 'e.g. Oma Sri (grandmother)', valueHint: 'e.g. 0812-3456-7890' },
  other: { label: 'Other', emoji: '📝', labelHint: 'e.g. Bedtime', valueHint: 'e.g. 20:00, after one story' },
};

export function kidsLabel(children: Child[] | undefined): string {
  const names = (children ?? []).map((c) => c.name);
  if (names.length === 0) return 'The kids';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** "you" for the signed-in parent, otherwise their first name. */
export function who(person: Person, meId: number): string {
  return person.id === meId ? 'you' : person.first_name;
}

export function Who(person: Person, meId: number): string {
  return person.id === meId ? 'You' : person.first_name;
}

export function eventStatus(e: HandoffEvent, meId: number): { label: string; tone: PillTone } {
  if (e.status === 'pending') {
    return e.created_by.id === meId ? { label: 'Waiting for reply', tone: 'wait' } : { label: 'Needs your OK', tone: 'warn' };
  }
  if (e.change) {
    return e.change.by.id === meId ? { label: 'Change sent', tone: 'wait' } : { label: 'Change requested', tone: 'warn' };
  }
  if (e.checked_in_at) return { label: 'Checked in', tone: 'ok' };
  return { label: 'Confirmed', tone: 'ok' };
}

export function expenseStatus(x: Expense, meId: number): { label: string; tone: PillTone } {
  switch (x.status) {
    case 'pending':
      return x.created_by.id === meId ? { label: 'Waiting for reply', tone: 'wait' } : { label: 'Needs your OK', tone: 'warn' };
    case 'approved':
      return x.debtor?.id === meId
        ? { label: `You owe ${rupiah(x.owed_amount)}`, tone: 'warn' }
        : { label: `Owed ${rupiah(x.owed_amount)}`, tone: 'wait' };
    case 'settled':
      return { label: 'Settled', tone: 'ok' };
    default:
      return { label: 'Declined', tone: 'neutral' };
  }
}
