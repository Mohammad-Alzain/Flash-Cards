/** Bit `d` is set when JS weekday `d` (0 = Sunday … 6 = Saturday) is selected. */
export const ALL_DAYS_MASK = 0b1111111;

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const isDaySelected = (mask: number, day: number) => (mask & (1 << day)) !== 0;

export const toggleDay = (mask: number, day: number) => mask ^ (1 << day);

export const selectedDays = (mask: number) => WEEKDAYS.filter((d) => isDaySelected(mask, d));

export const isEveryDay = (mask: number) => (mask & ALL_DAYS_MASK) === ALL_DAYS_MASK;

/** Parses "HH:MM" (24h). Returns null for anything out of range. */
export const parseTimeOfDay = (value: string): { hour: number; minute: number } | null => {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

export const formatTimeOfDay = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Next Date (from now) that falls on `weekday` at hour:minute — or the next such moment on any day. */
export const nextOccurrence = (hour: number, minute: number, weekday?: number, from = new Date()) => {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(hour, minute);
  if (weekday === undefined) {
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }
  let add = (weekday - d.getDay() + 7) % 7;
  if (add === 0 && d <= from) add = 7;
  d.setDate(d.getDate() + add);
  return d;
};

export const splitIds = (value: string | null | undefined) => (value ? value.split(',').filter(Boolean) : []);
export const joinIds = (ids: string[]) => (ids.length ? ids.join(',') : null);
