import { cardRepository } from '../db/repositories/cardRepository';
import { settingsRepository } from '../db/repositories/settingsRepository';
import { statsRepository } from '../db/repositories/statsRepository';
import { queueBuilder } from '../scheduler/queueBuilder';
import { Rating } from '../scheduler/types';
import { cleanTextForQuiz } from '../quiz/generator';
import { mistakesManager } from '../quiz/mistakesManager';

import Constants, { ExecutionEnvironment } from 'expo-constants';

let Notifications: any = null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
  } catch (e) {
    // Gracefully fallback when notifications are unavailable in current environment
  }
}

export const FLASHCARD_CATEGORY = 'FLASHCARD_INTERACTIVE_REVIEW';
export const ACTION_KNOW = 'ACTION_KNOW';
export const ACTION_DONT_KNOW = 'ACTION_DONT_KNOW';

export const notificationService = {
  /**
   * Request local notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      return false;
    }
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Registers the interactive action category for flashcards
   */
  async registerCategories(): Promise<void> {
    if (!Notifications || typeof Notifications.setNotificationCategoryAsync !== 'function') {
      return;
    }
    try {
      await Notifications.setNotificationCategoryAsync(FLASHCARD_CATEGORY, [
        {
          identifier: ACTION_KNOW,
          buttonTitle: 'أعرفها ✓',
          options: { opensAppToForeground: false },
        },
        {
          identifier: ACTION_DONT_KNOW,
          buttonTitle: 'لا أعرفها ✗',
          options: { opensAppToForeground: false },
        },
      ]);
    } catch (e) {
      console.warn('Failed to register notification category:', e);
    }
  },

  /**
   * Sends an interactive Flashcard Notification with "أعرفها" and "لا أعرفها" buttons
   */
  async sendInteractiveFlashcardNotification(cardId?: string): Promise<boolean> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;
    await this.registerCategories();

    let targetCard: any = null;
    if (cardId) {
      targetCard = await cardRepository.getById(cardId);
    }

    if (!targetCard) {
      // Pick a due card or a learning card or a new card
      const dueQueue = await queueBuilder.buildReviewQueue(undefined, undefined, 'due');
      if (dueQueue.length > 0) {
        targetCard = dueQueue[0];
      } else {
        const learnQueue = await queueBuilder.buildLearnQueue(undefined, 1);
        if (learnQueue.length > 0) {
          targetCard = learnQueue[0];
        }
      }
    }

    if (!targetCard) return false;

    const fields = targetCard.note_fields || {};
    const rawPrompt = fields.Front || Object.values(fields)[0] || 'سؤال المذاكرة';
    const rawAnswer = fields.Back || Object.values(fields)[1] || 'الجواب';

    const cleanPrompt = cleanTextForQuiz(rawPrompt);
    const cleanAnswer = cleanTextForQuiz(rawAnswer);

    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return false;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎴 سؤال المذاكرة: ${cleanPrompt}`,
          body: `ما معنى هذه الكلمة؟ اضغط على 'أعرفها' أو 'لا أعرفها' للمراجعة دون فتح التطبيق.`,
          categoryIdentifier: FLASHCARD_CATEGORY,
          data: {
            cardId: targetCard.id,
            deckId: targetCard.deck_id,
            cleanPrompt,
            cleanAnswer,
          },
          sound: true,
        },
        trigger: null, // Send immediately
      });
      return true;
    } catch (e) {
      console.error('Failed to send interactive card notification:', e);
      return false;
    }
  },

  /**
   * Handles user response to interactive notification actions (without opening app)
   */
  async handleNotificationResponse(response: any): Promise<void> {
    const actionId = response?.actionIdentifier;
    const data = response?.notification?.request?.content?.data;
    if (!data?.cardId) return;

    try {
      const card = await cardRepository.getById(data.cardId);
      if (!card) return;

      if (actionId === ACTION_KNOW) {
        // User knows the card: Rating.Good (3)
        await queueBuilder.answerCard(card, Rating.Good, 4000);

        if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `✨ أحسنت! تم تسجيل الإتقان`,
              body: `المعنى: ${data.cleanAnswer}`,
              sound: false,
            },
            trigger: null,
          });
        }
      } else if (actionId === ACTION_DONT_KNOW) {
        // User doesn't know the card: Rating.Again (1)
        await queueBuilder.answerCard(card, Rating.Again, 4000);
        await mistakesManager.recordWrongAnswer(card.id);

        if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `💡 تذكّر الجواب للمرة القادمة`,
              body: `الجواب الصحيح: ${data.cleanAnswer}`,
              sound: false,
            },
            trigger: null,
          });
        }
      }
    } catch (e) {
      console.error('Failed to handle notification response:', e);
    }
  },

  /**
   * Schedules a daily recurring reminder at target hour & minute
   */
  async scheduleDailyReminder(
    scheduleId: string,
    timeOfDay: string, // "08:30"
    deckId?: string | null
  ): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    const [hourStr, minStr] = timeOfDay.split(':');
    const hour = parseInt(hourStr, 10) || 8;
    const minute = parseInt(minStr, 10) || 0;

    // Check due cards count
    const globalCounts = await cardRepository.getGlobalCounts();
    const count = globalCounts.due;

    // Smart reminder check: skip if goal is already met today
    const todayStats = await statsRepository.getTodaySummary();
    if (todayStats.totalDone >= todayStats.dailyGoal && todayStats.dailyGoal > 0) {
      console.log('[Notification] Daily goal already met. Skipping reminder.');
    }

    const title = count > 0 ? `${count} cards are waiting for you!` : `Daily Flashcards Review`;
    const body =
      count > 0
        ? `Keep your streak alive! Complete your reviews today.`
        : `Start a quick session or learn new words today!`;

    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { deckId, scheduleId },
          sound: true,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      return notificationId;
    } catch {
      return null;
    }
  },

  /**
   * Cancels a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    if (!Notifications || typeof Notifications.cancelScheduledNotificationAsync !== 'function') {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Ignore
    }
  },

  /**
   * Cancels all notifications
   */
  async cancelAll(): Promise<void> {
    if (!Notifications || typeof Notifications.cancelAllScheduledNotificationsAsync !== 'function') {
      return;
    }
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Ignore
    }
  },
};
