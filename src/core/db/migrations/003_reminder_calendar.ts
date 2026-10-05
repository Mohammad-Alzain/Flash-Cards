import { SQLiteDatabase } from 'expo-sqlite';

/** Links study reminders to events in the phone's calendar. */
export async function up(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(schedules);');
  if (!cols.some((c) => c.name === 'calendar_event_ids')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN calendar_event_ids TEXT NULL;');
  }
}
