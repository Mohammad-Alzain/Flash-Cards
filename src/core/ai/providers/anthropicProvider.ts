import { AIProvider, AIMessage, AICompletionOptions, AIResponse } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements AIProvider {
  type: 'anthropic' = 'anthropic';
  name = 'Anthropic Claude';

  private parseError(status: number, errorData: any): string {
    const errorMsg = errorData?.error?.message || '';

    if (status === 401 || errorMsg.includes('invalid x-api-key') || errorMsg.includes('authentication')) {
      return 'مفتاح API الخاص بـ Anthropic غير صحيح أو غير مفعل. يرجى التحقق من إدخاله في الإعدادات.';
    }
    if (status === 400 && errorMsg.includes('credit balance')) {
      return 'رصيد حساب Anthropic الخاص بك غير كافٍ. يرجى مراجعة الرصيد في لوحة تحكم Anthropic.';
    }
    if (status === 429) {
      return 'تجاوزت الحد المسموح به من الطلبات مؤقتاً (Rate Limit). يرجى المحاولة بعد دقيقة واحدة.';
    }
    if (status >= 500 || status === 529) {
      return 'خوادم Anthropic تواجه ضغطاً حالياً. يرجى إعادة المحاولة بعد قليل.';
    }
    return errorMsg || `حدث خطأ أثناء الاتصال بمزود الذكاء الاصطناعي (رمز الخطأ ${status}).`;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      throw new Error('لم يتم إدخال مفتاح API.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': trimmedKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(this.parseError(response.status, errorJson));
      }

      return true;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('انتهت مهلة اختبار الاتصال (12 ثانية). تأكد من اتصالك بالإنترنت.');
      }
      throw err;
    }
  }

  async complete(
    apiKey: string,
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): Promise<AIResponse> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      throw new Error('مفتاح API غير متوفر. يرجى إضافته في إعدادات الذكاء الاصطناعي.');
    }

    const timeoutMs = options.timeoutMs || 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // If external signal provided, listen to it
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    // Separate system messages for Anthropic Messages format
    const systemParts: string[] = [];
    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        chatMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    try {
      const payload: Record<string, any> = {
        model: DEFAULT_MODEL,
        max_tokens: options.maxTokens || 2048,
        messages: chatMessages,
        temperature: options.temperature !== undefined ? options.temperature : 0.2,
      };

      if (systemParts.length > 0) {
        payload.system = systemParts.join('\n\n');
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': trimmedKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(this.parseError(response.status, errorJson));
      }

      const json = await response.json();
      const textContent =
        json.content
          ?.filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n') || '';

      const tokensUsed = (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0);

      return {
        text: textContent,
        tokensUsed,
        model: json.model || DEFAULT_MODEL,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('استغرق طلب الذكاء الاصطناعي وقتاً أطول من المتوقع وانتهت المهلة.');
      }
      if (err.message && err.message.includes('Network request failed')) {
        throw new Error('تعذر الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من اتصالك بالإنترنت.');
      }
      throw err;
    }
  }

  async stream(
    apiKey: string,
    messages: AIMessage[],
    onChunk: (delta: string) => void,
    options: AICompletionOptions = {}
  ): Promise<AIResponse> {
    // For reliable cross-platform execution in React Native, stream falls back to complete()
    // if native fetch streaming is not supported, or emits progressive text
    const full = await this.complete(apiKey, messages, options);
    onChunk(full.text);
    return full;
  }
}

export const anthropicProvider = new AnthropicProvider();
