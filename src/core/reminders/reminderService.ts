import { scheduleRepository } from '../db/repositories/scheduleRepository';
import { notificationService } from '../notifications/notificationService';
import { Schedule } from '../types/models';
import { createReminderEvents, deleteReminderEvents } from './calendarSync';
import { ALL_DAYS_MASK, isEveryDay, joinIds, parseTimeOfDay, selectedDays, splitIds } from './reminderTime';

const DEFAULT_DURATION_MIN = 15;

export type ReminderErrorCode =
  | 'INVALID_TIME'
  | 'NO_DAYS'
  | 'NOTIFICATIONS_UNSUPPORTED'
  | 'NOTIFICATIONS_PERMISSION_DENIED'
  | 'CALENDAR_PERMISSION_DENIED'
  | 'CALENDAR_FAILED';

export class ReminderError extends Error {
  constructor(public code: ReminderErrorCode, cause?: unknown) {
    super(code);
    if (cause) console.warn(`[Reminders] ${code}:`, cause);
  }
}

const KNOWN_CODES: ReminderErrorCode[] = ['NOTIFICATIONS_UNSUPPORTED', 'NOTIFICATIONS_PERMISSION_DENIED', 'CALENDAR_PERMISSION_DENIED'];
const asReminderError = (e: unknown, fallback: ReminderErrorCode) => {
  if (e instanceof ReminderError) return e;
  const msg = (e as Error)?.message as ReminderErrorCode;
  return new ReminderError(KNOWN_CODES.includes(msg) ? msg : fallback, e);
};

const scheduleNotifications = (s: Pick<Schedule, 'id' | 'time_of_day' | 'days_of_week_mask' | 'deck_id'>) => {
  const time = parseTimeOfDay(s.time_of_day);
  if (!time) throw new ReminderError('INVALID_TIME');
  return notificationService.scheduleReminder({
    scheduleId: s.id,
    ...time,
    weekdays: isEveryDay(s.days_of_week_mask) ? 'daily' : selectedDays(s.days_of_week_mask),
    deckId: s.deck_id,
  });
};

const cancelNotifications = async (s: Pick<Schedule, 'notification_id'>) => {
  for (const id of splitIds(s.notification_id)) await notificationService.cancelNotification(id);
};

const linkCalendar = async (s: Schedule) => {
  const time = parseTimeOfDay(s.time_of_day);
  if (!time) throw new ReminderError('INVALID_TIME');
  try {
    return await createReminderEvents({ ...time, daysMask: s.days_of_week_mask, durationMin: s.duration_min });
  } catch (e) {
    throw asReminderError(e, 'CALENDAR_FAILED');
  }
};

/**
 * Study reminders: the single place that keeps the DB row, the OS notifications
 * and (optionally) the phone-calendar events in step.
 */
export const reminderService = {
  list: () => scheduleRepository.getAll(),

  async create(params: { timeOfDay: string; daysMask?: number; deckId?: string | null; addToCalendar?: boolean }): Promise<Schedule> {
    const daysMask = params.daysMask ?? ALL_DAYS_MASK;
    if (!parseTimeOfDay(params.timeOfDay)) throw new ReminderError('INVALID_TIME');
    if ((daysMask & ALL_DAYS_MASK) === 0) throw new ReminderError('NO_DAYS');

    const schedule: Schedule = {
      id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deck_id: params.deckId ?? null,
      type: 'review',
      time_of_day: params.timeOfDay.trim(),
      days_of_week_mask: daysMask,
      duration_min: DEFAULT_DURATION_MIN,
      enabled: 1,
      notification_id: null,
      calendar_event_ids: null,
      created_at: Date.now(),
    };

    let notificationIds: string[];
    try {
      notificationIds = await scheduleNotifications(schedule);
    } catch (e) {
      throw asReminderError(e, 'NOTIFICATIONS_UNSUPPORTED');
    }
    schedule.notification_id = joinIds(notificationIds);

    // Calendar linking is best-effort: the reminder still works without it.
    let calendarError: ReminderError | null = null;
    if (params.addToCalendar) {
      try {
        schedule.calendar_event_ids = joinIds(await linkCalendar(schedule));
      } catch (e) {
        calendarError = asReminderError(e, 'CALENDAR_FAILED');
      }
    }

    await scheduleRepository.insert(schedule);
    if (calendarError) throw calendarError;
    return schedule;
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const s = await scheduleRepository.getById(id);
    if (!s) return;
    await cancelNotifications(s);
    if (!enabled) {
      await scheduleRepository.update(id, { enabled: 0, notification_id: null });
      return;
    }
    try {
      const ids = await scheduleNotifications(s);
      await scheduleRepository.update(id, { enabled: 1, notification_id: joinIds(ids) });
    } catch (e) {
      await scheduleRepository.update(id, { enabled: 0, notification_id: null });
      throw asReminderError(e, 'NOTIFICATIONS_UNSUPPORTED');
    }
  },

  /** Adds the reminder to the phone calendar, or removes it when already linked. */
  async toggleCalendar(id: string): Promise<boolean> {
    const s = await scheduleRepository.getById(id);
    if (!s) return false;
    const existing = splitIds(s.calendar_event_ids);
    if (existing.length > 0) {
      await deleteReminderEvents(existing);
      await scheduleRepository.update(id, { calendar_event_ids: null });
      return false;
    }
    const ids = await linkCalendar(s);
    await scheduleRepository.update(id, { calendar_event_ids: joinIds(ids) });
    return true;
  },

  async remove(id: string): Promise<void> {
    const s = await scheduleRepository.getById(id);
    if (!s) return;
    await cancelNotifications(s);
    await deleteReminderEvents(splitIds(s.calendar_event_ids));
    await scheduleRepository.delete(id);
  },

  /**
   * Brings OS notifications back in line with the DB (e.g. after a backup restore,
   * an app update or reminders saved by older builds whose scheduling silently failed).
   */
  async resync(): Promise<void> {
    if (!notificationService.isSupported()) return;
    try {
      const schedules = await scheduleRepository.getAll();
      const scheduled = await notificationService.getScheduledIds();
      const valid = new Set(schedules.filter((s) => s.enabled === 1).map((s) => s.id));

      // Drop orphaned reminder notifications.
      for (const n of await notificationService.getScheduledReminders()) {
        if (!valid.has(n.scheduleId)) await notificationService.cancelNotification(n.id);
      }

      for (const s of schedules) {
        if (s.enabled !== 1) continue;
        const ids = splitIds(s.notification_id);
        if (ids.length > 0 && ids.every((id) => scheduled.has(id))) continue;
        await cancelNotifications(s);
        try {
          await scheduleRepository.update(s.id, { notification_id: joinIds(await scheduleNotifications(s)) });
        } catch (e) {
          console.warn('[Reminders] resync failed for', s.id, e);
        }
      }
    } catch (e) {
      console.warn('[Reminders] resync failed:', e);
    }
  },
};
