import { aiKeyStorage } from './aiKeyStorage';
import { aiCacheService, hashString } from './aiCacheService';
import { anthropicProvider } from './providers/anthropicProvider';
import { geminiProvider } from './providers/geminiProvider';
import { AIProvider, AIMessage, AICompletionOptions, AIResponse, AIProviderType } from './types';
import { settingsRepository } from '../db/repositories/settingsRepository';

class AIService {
  private providers: Record<AIProviderType, AIProvider> = {
    gemini: geminiProvider,
    anthropic: anthropicProvider,
    openai: geminiProvider,
    openrouter: geminiProvider,
  };

  /**
   * Checks if AI assistant is globally enabled in settings
   */
  async isEnabled(): Promise<boolean> {
    const val = await settingsRepository.get('ai_enabled', '1');
    return val !== '0';
  }

  /**
   * Sets the global AI enabled state
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await settingsRepository.set('ai_enabled', enabled ? '1' : '0');
  }

  /**
   * Gets the active AI provider type from settings (default: gemini)
   */
  async getActiveProviderType(): Promise<AIProviderType> {
    const val = await settingsRepository.get('ai_provider', 'gemini');
    return (val as AIProviderType) || 'gemini';
  }

  /**
   * Sets the active AI provider type
   */
  async setActiveProviderType(type: AIProviderType): Promise<void> {
    await settingsRepository.set('ai_provider', type);
  }

  /**
   * Returns the active provider instance
   */
  async getActiveProvider(): Promise<AIProvider> {
    const type = await this.getActiveProviderType();
    return this.providers[type] || this.providers.gemini;
  }

  /**
   * Verifies if the active provider has an API key stored
   */
  async hasConfiguredKey(): Promise<boolean> {
    const type = await this.getActiveProviderType();
    return await aiKeyStorage.hasApiKey(type);
  }

  /**
   * Tests the connection with the given API key
   */
  async testConnection(apiKey: string): Promise<boolean> {
    const provider = await this.getActiveProvider();
    return await provider.testConnection(apiKey);
  }

  /**
   * Executes a prompt with automatic SQLite caching
   */
  async completeWithCache(
    messages: AIMessage[],
    options: {
      requestType: string;
      cardId?: string;
      forceRefresh?: boolean;
      completionOptions?: AICompletionOptions;
    }
  ): Promise<AIResponse> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('الذكاء الاصطناعي معطل في الإعدادات.');
    }

    const providerType = await this.getActiveProviderType();
    const apiKey = await aiKeyStorage.getApiKey(providerType);
    if (!apiKey) {
      throw new Error('لم يتم تعيين مفتاح API للذكاء الاصطناعي. يرجى إضافته من صفحة الإعدادات.');
    }

    // Build deterministic cache key from messages + provider + model
    const serializedPrompt = JSON.stringify({ providerType, messages });
    const promptHash = hashString(serializedPrompt);

    if (!options.forceRefresh) {
      const cached = await aiCacheService.getCached(promptHash);
      if (cached) {
        return {
          text: cached,
          tokensUsed: 0,
          model: 'cached',
        };
      }
    }

    const provider = await this.getActiveProvider();
    const result = await provider.complete(apiKey, messages, options.completionOptions);

    // Save to cache
    if (result.text && result.text.trim().length > 0) {
      await aiCacheService.setCached({
        promptHash,
        cardId: options.cardId,
        requestType: options.requestType,
        model: result.model,
        responseText: result.text,
        tokensUsed: result.tokensUsed,
      });

      // Update total tokens usage counter in settings
      const prevUsage = parseInt(await settingsRepository.get('ai_tokens_used', '0'), 10) || 0;
      await settingsRepository.set('ai_tokens_used', String(prevUsage + (result.tokensUsed || 0)));
    }

    return result;
  }
}

export const aiService = new AIService();
