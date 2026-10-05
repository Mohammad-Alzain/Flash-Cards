import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar/legacy';
import i18n from '../../i18n';
import { selectedDays, isEveryDay, nextOccurrence } from './reminderTime';

/** Name of the fallback calendar we create when the phone has no writable primary calendar. */
const OWN_CALENDAR_TITLE = 'Flashcards';
const OWN_CALENDAR_COLOR = '#4F46E5';

export class CalendarPermissionError extends Error {
  constructor() {
    super('CALENDAR_PERMISSION_DENIED');
  }
}

const ensurePermission = async () => {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return;
  const asked = await Calendar.requestCalendarPermissionsAsync();
  if (!asked.granted) throw new CalendarPermissionError();
};

/** Picks the user's main writable calendar (so events sync to their account), else creates a local one. */
const resolveCalendarId = async (): Promise<string> => {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.allowsModifications) return def.id;
    } catch {}
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const own = writable.find((c) => c.title === OWN_CALENDAR_TITLE);
  const primary = writable.find((c) => c.isPrimary) ?? writable.find((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER);
  if (primary) return primary.id;
  if (own) return own.id;

  const source =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: OWN_CALENDAR_TITLE, type: Calendar.SourceType.LOCAL as unknown as string };
  return Calendar.createCalendarAsync({
    title: OWN_CALENDAR_TITLE,
    name: OWN_CALENDAR_TITLE,
    color: OWN_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: source.id,
    source: source as Calendar.Source,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
};

interface ReminderEventInput {
  hour: number;
  minute: number;
  daysMask: number;
  durationMin: number;
}

/**
 * Creates recurring events for a reminder and returns their ids.
 * Every day → one daily event; specific days → one weekly event per day
 * (weekday recurrence rules are iOS-only, weekly-per-day works everywhere).
 */
export const createReminderEvents = async ({ hour, minute, daysMask, durationMin }: ReminderEventInput): Promise<string[]> => {
  await ensurePermission();
  const calendarId = await resolveCalendarId();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const make = async (start: Date, frequency: Calendar.Frequency) =>
    Calendar.createEventAsync(calendarId, {
      title: `📚 ${i18n.t('reminders.event_title')}`,
      notes: i18n.t('reminders.event_notes'),
      startDate: start,
      endDate: new Date(start.getTime() + durationMin * 60_000),
      timeZone,
      alarms: [{ relativeOffset: 0 }],
      recurrenceRule: { frequency },
    });

  if (isEveryDay(daysMask)) {
    return [await make(nextOccurrence(hour, minute), Calendar.Frequency.DAILY)];
  }
  const ids: string[] = [];
  for (const day of selectedDays(daysMask)) {
    ids.push(await make(nextOccurrence(hour, minute, day), Calendar.Frequency.WEEKLY));
  }
  return ids;
};

/** Deletes previously created events; missing events (deleted by the user) are ignored. */
export const deleteReminderEvents = async (ids: string[]) => {
  if (ids.length === 0) return;
  try {
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (!perm.granted) return;
  } catch {
    return;
  }
  for (const id of ids) {
    try {
      await Calendar.deleteEventAsync(id, { futureEvents: true });
    } catch {}
  }
};
