# Phase 6: Planner & Notifications (Section 6)

## 📋 What was built in Phase 6

1. **Local Due Cards Notification Service (`src/core/notifications/notificationService.ts`)**:
   - Built using `expo-notifications` (100% offline, zero internet or push server needed).
   - Permission management.
   - **Smart reminder check**: Computes remaining due cards, sends reminder only if cards are due today, and can automatically skip notifications if today's daily goal is already met.
   - Schedules daily reminders with custom hour and minute.
   - Dynamic cancel and reschedule support.

2. **Review Forecast & Exam-Date Planner (`src/core/scheduler/forecast.ts`)**:
   - `getDueForecast(14)`: Projects the exact count of cards due over the next 14 days based on card scheduling timestamps and rollover hour.
   - `calculateExamPace`:
     - Inputs: Days until exam (e.g. 30 days) and total unlearned new cards in the deck.
     - Computes recommended daily new card intake + buffer days for final review.
     - Projects estimated daily review burden.
     - Calculates deck completion target date.

3. **Schedule Repository (`src/core/db/repositories/scheduleRepository.ts`)**:
   - Full CRUD over the SQLite `schedules` table.
   - Automatically synchronizes notification triggers with database state.

4. **Planner Screen (`src/app/planner/index.tsx`)**:
   - **14-Day Visual Forecast**: Horizontal scrollable bar chart showing cards due per day with distinct colors for today's cards.
   - **Exam Target Date Planner**: User specifies days until exam -> App calculates recommended daily pace -> User can tap **"Apply to Target Deck"** to instantly update the deck's `new_per_day` setting.
   - **Daily Reminders Manager**: Lists active schedules, allows toggling switches on/off, adding new times, and deleting reminders.

---

## 🧪 Testing Instructions

1. **Test Planner Screen**:
   - On the Home screen, tap the **"Study Planner & Forecast"** card (or navigate to `/planner`).
   - View the 14-day forecast chart showing future due cards.
2. **Test Exam Target Pace**:
   - Under "Exam & Target Date Planner", enter `15` days.
   - Tap "Recalculate" -> View the calculated recommended new cards/day and completion date.
   - Tap **"Apply to Target Deck"** -> Updates the deck's daily limit in SQLite.
3. **Test Study Reminders**:
   - Tap `+ Add Reminder` -> Enter `07:30` -> Tap Save.
   - Verify the reminder appears with the toggle switch enabled.
   - Toggle switch off and on to verify notification state synchronization.
