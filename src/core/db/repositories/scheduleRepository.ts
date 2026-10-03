import { getDatabase } from '../connection';
import { Schedule } from '../../types/models';
import { notificationService } from '../../notifications/notificationService';

export const scheduleRepository = {
  async getAll(): Promise<Schedule[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Schedule>(
      'SELECT * FROM schedules ORDER BY time_of_day ASC;'
    );
  },

  async create(params: {
    deckId?: string | null;
    type?: 'study' | 'review' | 'custom';
    timeOfDay: string; // "08:30"
    daysOfWeekMask?: number;
    durationMin?: number;
  }): Promise<Schedule> {
    const db = await getDatabase();
    const id = `sch_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const now = Date.now();

    // Schedule notification
    const notificationId = await notificationService.scheduleDailyReminder(
      id,
      params.timeOfDay,
      params.deckId
    );

    const schedule: Schedule = {
      id,
      deck_id: params.deckId || null,
      type: params.type || 'review',
      time_of_day: params.timeOfDay,
      days_of_week_mask: params.daysOfWeekMask || 127, // All days
      duration_min: params.durationMin || 15,
      enabled: 1,
      notification_id: notificationId,
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO schedules (
         id, deck_id, type, time_of_day, days_of_week_mask, duration_min,
         enabled, notification_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      schedule.id,
      schedule.deck_id,
      schedule.type,
      schedule.time_of_day,
      schedule.days_of_week_mask,
      schedule.duration_min,
      schedule.enabled,
      schedule.notification_id,
      schedule.created_at
    );

    return schedule;
  },

  async toggle(id: string, enabled: boolean): Promise<void> {
    const db = await getDatabase();
    const current = await db.getFirstAsync<Schedule>(
      'SELECT * FROM schedules WHERE id = ?;',
      id
    );
    if (!current) return;

    if (!enabled && current.notification_id) {
      await notificationService.cancelNotification(current.notification_id);
    } else if (enabled) {
      const newNotifId = await notificationService.scheduleDailyReminder(
        id,
        current.time_of_day,
        current.deck_id
      );
      await db.runAsync(
        'UPDATE schedules SET notification_id = ? WHERE id = ?;',
        newNotifId,
        id
      );
    }

    await db.runAsync(
      'UPDATE schedules SET enabled = ? WHERE id = ?;',
      enabled ? 1 : 0,
      id
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    const current = await db.getFirstAsync<Schedule>(
      'SELECT * FROM schedules WHERE id = ?;',
      id
    );
    if (current && current.notification_id) {
      await notificationService.cancelNotification(current.notification_id);
    }

    await db.runAsync('DELETE FROM schedules WHERE id = ?;', id);
  },
};
