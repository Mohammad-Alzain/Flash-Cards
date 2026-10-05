import { AIProvider, AIMessage, AICompletionOptions, AIResponse } from '../types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Candidate fallback models in priority order
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-pro',
];

let cachedWorkingModel: string | null = null;

/**
 * Dynamically queries available models for the given API key from Google AI Studio,
 * or falls back to prioritized candidate models.
 */
async function resolveActiveModel(apiKey: string): Promise<string> {
  if (cachedWorkingModel) {
    return cachedWorkingModel;
  }

  try {
    const res = await fetch(`${GEMINI_BASE_URL}/models?key=${encodeURIComponent(apiKey.trim())}`);
    if (res.ok) {
      const data = await res.json();
      const models: any[] = data.models || [];

      // Filter only models that support text/content generation
      const contentModels = models.filter((m) => {
        const methods = m.supportedGenerationMethods;
        return Array.isArray(methods) && methods.includes('generateContent');
      });

      if (contentModels.length > 0) {
        // Priority 1: gemini 2.x flash
        let picked = contentModels.find((m) => m.name?.includes('2.0') && m.name?.includes('flash'));
        // Priority 2: any flash model
        if (!picked) {
          picked = contentModels.find((m) => m.name?.includes('flash') && !m.name?.includes('vision'));
        }
        // Priority 3: any gemini model
        if (!picked) {
          picked = contentModels.find((m) => m.name?.includes('gemini'));
        }
        if (!picked) {
          picked = contentModels[0];
        }

        if (picked?.name) {
          // Model name is typically "models/gemini-2.0-flash" -> extract clean name
          const clean = picked.name.replace(/^models\//, '');
          cachedWorkingModel = clean;
          return clean;
        }
      }
    }
  } catch (err) {
    console.warn('[GeminiProvider] Could not list models from Google API:', err);
  }

  return CANDIDATE_MODELS[0];
}

export class GeminiProvider implements AIProvider {
  type: 'gemini' = 'gemini';
  name = 'Google Gemini (مجاني)';

  private parseError(status: number, errorData: any): string {
    const errorMsg = errorData?.error?.message || '';
    const statusStr = errorData?.error?.status || '';

    if (
      status === 400 &&
      (errorMsg.includes('API key not valid') ||
        errorMsg.includes('API_KEY_INVALID') ||
        errorMsg.includes('INVALID_ARGUMENT'))
    ) {
      return 'مفتاح Google Gemini API غير صالح. يرجى التأكد من نسخه بشكل صحيح من Google AI Studio.';
    }
    if (
      status === 403 ||
      errorMsg.includes('PERMISSION_DENIED') ||
      statusStr === 'PERMISSION_DENIED'
    ) {
      return 'المفتاح لا يملك صلاحية الوصول أو أن الخدمة مقيدة في منطقتك الجغرافية. يرجى مراجعة Google AI Studio.';
    }
    if (status === 404 || errorMsg.includes('not found') || errorMsg.includes('not supported')) {
      return 'الموديل المطلوب غير متاح لهذا المفتاح حالياً. تم تحديث الموديل التلقائي، يرجى إعادة المحاولة الآن.';
    }
    if (
      status === 429 ||
      statusStr === 'RESOURCE_EXHAUSTED' ||
      errorMsg.includes('Quota exceeded')
    ) {
      return 'تم تجاوز حد الطلبات المجاني المؤقت لـ Gemini (Rate Limit). يرجى الانتظار دقيقة ثم إعادة المحاولة.';
    }
    if (status >= 500) {
      return 'خوادم Google Gemini تواجه ضغطاً حالياً. يرجى المحاولة بعد لحظات.';
    }
    return errorMsg || `حدث خطأ أثناء الاتصال بـ Google Gemini (رمز الخطأ ${status}).`;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      throw new Error('لم يتم إدخال مفتاح API.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    try {
      // 1. Discover active supported model
      const model = await resolveActiveModel(trimmedKey);

      // 2. Perform lightweight verification call
      const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hello' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 5,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // If 404 on model, clear cache and try fallback
        if (response.status === 404) {
          cachedWorkingModel = null;
          for (const fallbackModel of CANDIDATE_MODELS) {
            if (fallbackModel === model) continue;
            try {
              const fallbackUrl = `${GEMINI_BASE_URL}/models/${fallbackModel}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
              const fbRes = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
                  generationConfig: { maxOutputTokens: 5 },
                }),
              });
              if (fbRes.ok) {
                cachedWorkingModel = fallbackModel;
                return true;
              }
            } catch {}
          }
        }

        const errorJson = await response.json().catch(() => ({}));
        throw new Error(this.parseError(response.status, errorJson));
      }

      cachedWorkingModel = model;
      return true;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('انتهت مهلة اختبار الاتصال (14 ثانية). تأكد من اتصالك بالإنترنت.');
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

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    // Separate system messages
    const systemParts: string[] = [];
    const nonSystemMessages: AIMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        nonSystemMessages.push(msg);
      }
    }

    // Ensure contents alternate roles as required by Gemini
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const msg of nonSystemMessages) {
      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];
      if (last && last.role === geminiRole) {
        last.parts.push({ text: msg.content });
      } else {
        contents.push({
          role: geminiRole,
          parts: [{ text: msg.content }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : 0.2,
        maxOutputTokens: options.maxTokens || 4096,
      },
    };

    if (systemParts.length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    try {
      let activeModel = await resolveActiveModel(trimmedKey);
      let url = `${GEMINI_BASE_URL}/models/${activeModel}:generateContent?key=${encodeURIComponent(trimmedKey)}`;

      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      // If the model was not found (404), iterate through fallback models
      if (!response.ok && response.status === 404) {
        cachedWorkingModel = null;
        for (const candidate of CANDIDATE_MODELS) {
          if (candidate === activeModel) continue;
          const retryUrl = `${GEMINI_BASE_URL}/models/${candidate}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
          const retryRes = await fetch(retryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          if (retryRes.ok) {
            response = retryRes;
            activeModel = candidate;
            cachedWorkingModel = candidate;
            break;
          }
        }
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(this.parseError(response.status, errorJson));
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (candidate?.finishReason === 'SAFETY') {
        throw new Error('تم حجب الرد بواسطة فلاتر الأمان التلقائية لـ Google Gemini.');
      }

      const textParts = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean) || [];
      const text = textParts.join('').trim();
      const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

      return {
        text,
        tokensUsed,
        model: activeModel,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('انتهت مهلة استجابة الذكاء الاصطناعي. تأكد من اتصال الإنترنت وحاول مجدداً.');
      }
      throw err;
    }
  }
}

export const geminiProvider = new GeminiProvider();
