import { cardRepository } from '../db/repositories/cardRepository';
import { settingsRepository } from '../db/repositories/settingsRepository';
import { queueBuilder } from '../scheduler/queueBuilder';
import { Rating } from '../scheduler/types';
import { cleanTextForQuiz } from '../quiz/generator';
import { mistakesManager } from '../quiz/mistakesManager';
import {
  podcastPlayerService,
  ACTION_PODCAST_PREV,
  ACTION_PODCAST_TOGGLE,
  ACTION_PODCAST_NEXT,
  ACTION_PODCAST_STOP,
} from '../audio/podcastPlayerService';

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '../../i18n';

export const REMINDER_CHANNEL_ID = 'study-reminders';

let Notifications: any = null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
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

    // 1. Handle Podcast Player background actions
    if (actionId === ACTION_PODCAST_PREV) {
      podcastPlayerService.prev();
      return;
    }
    if (actionId === ACTION_PODCAST_TOGGLE) {
      podcastPlayerService.togglePlay();
      return;
    }
    if (actionId === ACTION_PODCAST_NEXT) {
      podcastPlayerService.next();
      return;
    }
    if (actionId === ACTION_PODCAST_STOP) {
      podcastPlayerService.stop();
      return;
    }

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
              title: `أحسنت! تم تسجيل الإتقان`,
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

  /** True when local notifications can be scheduled in this build (not Expo Go / web). */
  isSupported(): boolean {
    return !!Notifications && typeof Notifications.scheduleNotificationAsync === 'function';
  },

  /** Android 8+ only delivers notifications through a channel; reminders get a high-importance one. */
  async ensureReminderChannel(): Promise<void> {
    if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) return;
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: i18n.t('reminders.channel_name'),
      description: i18n.t('reminders.channel_desc'),
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#4F46E5',
    });
  },

  /**
   * Schedules a repeating study reminder. Returns one id per trigger:
   * a single DAILY trigger, or one WEEKLY trigger per selected weekday.
   */
  async scheduleReminder(params: {
    scheduleId: string;
    hour: number;
    minute: number;
    weekdays: number[] | 'daily';
    deckId?: string | null;
  }): Promise<string[]> {
    if (!this.isSupported()) throw new Error('NOTIFICATIONS_UNSUPPORTED');
    if (!(await this.requestPermissions())) throw new Error('NOTIFICATIONS_PERMISSION_DENIED');
    await this.ensureReminderChannel();

    const { SchedulableTriggerInputTypes } = Notifications;
    const content = {
      title: `⏰ ${i18n.t('reminders.notif_title')}`,
      body: i18n.t('reminders.notif_body'),
      data: { scheduleId: params.scheduleId, deckId: params.deckId ?? null, kind: 'study_reminder' },
      sound: true,
    };
    const base = { hour: params.hour, minute: params.minute, channelId: REMINDER_CHANNEL_ID };

    if (params.weekdays === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: SchedulableTriggerInputTypes.DAILY, ...base },
      });
      return [id];
    }
    const ids: string[] = [];
    for (const day of params.weekdays) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content,
          // expo weekday: 1 = Sunday … 7 = Saturday; JS getDay(): 0 = Sunday.
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, ...base },
        })
      );
    }
    return ids;
  },

  /** Identifiers of every notification currently scheduled with the OS. */
  async getScheduledIds(): Promise<Set<string>> {
    if (!Notifications?.getAllScheduledNotificationsAsync) return new Set();
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return new Set(all.map((n: any) => n.identifier));
    } catch {
      return new Set();
    }
  },

  /** Scheduled study reminders as { notificationId, scheduleId }. */
  async getScheduledReminders(): Promise<{ id: string; scheduleId: string }[]> {
    if (!Notifications?.getAllScheduledNotificationsAsync) return [];
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all
        .filter((n: any) => n.content?.data?.kind === 'study_reminder' || n.content?.data?.scheduleId)
        .map((n: any) => ({ id: n.identifier, scheduleId: n.content.data.scheduleId }));
    } catch {
      return [];
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
