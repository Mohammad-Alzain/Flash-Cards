import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AIProviderType } from './types';

const KEY_PREFIX = 'flashcards_ai_key_';

export const aiKeyStorage = {
  /**
   * Retrieves the secure API key for the specified provider
   */
  async getApiKey(provider: AIProviderType = 'gemini'): Promise<string | null> {
    try {
      const keyName = `${KEY_PREFIX}${provider}`;
      if (Platform.OS === 'web') {
        // Fallback for web environment
        return typeof window !== 'undefined' ? localStorage.getItem(keyName) : null;
      }
      return await SecureStore.getItemAsync(keyName);
    } catch (err) {
      console.warn(`[AIKeyStorage] Failed to get key for ${provider}:`, err);
      return null;
    }
  },

  /**
   * Saves the API key securely into Android Keystore / iOS Keychain
   */
  async setApiKey(key: string, provider: AIProviderType = 'gemini'): Promise<void> {
    const keyName = `${KEY_PREFIX}${provider}`;
    const trimmed = key.trim();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(keyName, trimmed);
      }
      return;
    }
    await SecureStore.setItemAsync(keyName, trimmed);
  },

  /**
   * Removes the API key completely from secure storage
   */
  async deleteApiKey(provider: AIProviderType = 'gemini'): Promise<void> {
    const keyName = `${KEY_PREFIX}${provider}`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(keyName);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(keyName);
    } catch (err) {
      console.warn(`[AIKeyStorage] Failed to delete key for ${provider}:`, err);
    }
  },

  /**
   * Checks whether an API key exists for the provider
   */
  async hasApiKey(provider: AIProviderType = 'gemini'): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return Boolean(key && key.length > 5);
  },
};
