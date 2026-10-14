// Formatting without Intl, so output is identical on Hermes (iOS/Android) and the web.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function rupiah(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.round(Math.abs(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp${digits}`;
}

export function shortRupiah(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `Rp${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace('.', ',')}jt`;
  if (abs >= 1_000) return `Rp${Math.round(abs / 1_000)}rb`;
  return rupiah(abs);
}

/** Parses "250.000" / "250000" typed by the user into a number. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function groupDigits(text: string): string {
  const n = parseAmount(text);
  return n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

export const toDate = (iso: string) => new Date(iso);

/** "09:00" */
export function time(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Sat 17 Oct" */
export function day(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat 17 Oct · 09:00" */
export function dayTime(iso: string | Date): string {
  return `${day(iso)} · ${time(iso)}`;
}

export function weekday(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return DAYS[d.getDay()];
}

export function monthShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return MONTHS[d.getMonth()];
}

/** Calendar date ("2026-10-14") in a readable form: "14 Oct". */
export function plainDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const now = new Date();
  return y === now.getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday", "Tomorrow" or "Sat 17 Oct". */
export function relativeDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return day(d);
}

/** "in 3 days", "tomorrow", "in 2 hours", "2 hours ago" */
export function fromNow(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const label =
    minutes < 60 ? `${minutes} min` : hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;
  if (minutes < 1) return 'now';
  return ms > 0 ? `in ${label}` : `${label} ago`;
}

export function age(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years -= 1;
  if (years < 1) {
    const months = (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m - (now.getDate() < d ? 1 : 0);
    return `${Math.max(months, 0)} month${months === 1 ? '' : 's'} old`;
  }
  return `${years} year${years === 1 ? '' : 's'} old`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
  } catch {
    return 'Asia/Jakarta';
  }
}
