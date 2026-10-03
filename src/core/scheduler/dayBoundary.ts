/**
 * Day Boundary & Rollover Calculations (Section 5.4)
 * Handles late-night study boundaries (default 4:00 AM) and timezone changes.
 */

export function getRolloverDate(now = Date.now(), rolloverHour = 4): Date {
  const date = new Date(now);
  // If current hour is before the rollover hour, it belongs to yesterday's study day
  if (date.getHours() < rolloverHour) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

export function getDateStringForRollover(now = Date.now(), rolloverHour = 4): string {
  const d = getRolloverDate(now, rolloverHour);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayEndTimestamp(now = Date.now(), rolloverHour = 4): number {
  const d = getRolloverDate(now, rolloverHour);
  // Next day at rolloverHour:00:00.000
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, rolloverHour, 0, 0, 0);
  return end.getTime();
}

export function isDueToday(dueTimestamp: number, now = Date.now(), rolloverHour = 4): boolean {
  const dayEnd = getDayEndTimestamp(now, rolloverHour);
  return dueTimestamp <= dayEnd;
}

export function formatIntervalPreview(minutesOrDays: { type: 'm' | 'd'; value: number }): string {
  if (minutesOrDays.type === 'm') {
    if (minutesOrDays.value < 1) return '<1m';
    if (minutesOrDays.value < 60) return `${Math.round(minutesOrDays.value)}m`;
    const hours = Math.round(minutesOrDays.value / 60);
    return `${hours}h`;
  } else {
    const days = minutesOrDays.value;
    if (days < 1) return '<1d';
    if (days < 30) return `${Math.round(days)}d`;
    if (days < 365) return `${(days / 30).toFixed(1)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }
}
