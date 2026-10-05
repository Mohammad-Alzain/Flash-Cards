import { getDatabase } from '../connection';
import { Schedule } from '../../types/models';

/** Persistence for study reminders. Side effects (notifications, calendar) live in reminderService. */
export const scheduleRepository = {
  async getAll(): Promise<Schedule[]> {
    const db = await getDatabase();
    return db.getAllAsync<Schedule>('SELECT * FROM schedules ORDER BY time_of_day ASC;');
  },

  async getById(id: string): Promise<Schedule | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Schedule>('SELECT * FROM schedules WHERE id = ?;', id);
  },

  async insert(schedule: Schedule): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO schedules (
         id, deck_id, type, time_of_day, days_of_week_mask, duration_min,
         enabled, notification_id, calendar_event_ids, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      schedule.id,
      schedule.deck_id,
      schedule.type,
      schedule.time_of_day,
      schedule.days_of_week_mask,
      schedule.duration_min,
      schedule.enabled,
      schedule.notification_id,
      schedule.calendar_event_ids ?? null,
      schedule.created_at
    );
  },

  async update(id: string, patch: Partial<Pick<Schedule, 'enabled' | 'notification_id' | 'calendar_event_ids'>>): Promise<void> {
    const entries = Object.entries(patch);
    if (entries.length === 0) return;
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE schedules SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?;`,
      ...entries.map(([, v]) => (v === undefined ? null : v)),
      id
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM schedules WHERE id = ?;', id);
  },
};
