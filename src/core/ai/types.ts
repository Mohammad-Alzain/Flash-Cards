export type AIProviderType = 'anthropic' | 'openai' | 'gemini' | 'openrouter';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AIResponse {
  text: string;
  tokensUsed?: number;
  model: string;
}

export interface AIProvider {
  type: AIProviderType;
  name: string;
  testConnection(apiKey: string): Promise<boolean>;
  complete(apiKey: string, messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;
  stream?(
    apiKey: string,
    messages: AIMessage[],
    onChunk: (delta: string) => void,
    options?: AICompletionOptions
  ): Promise<AIResponse>;
}

export interface AIErrorDetails {
  code: 'NO_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'UNKNOWN';
  message: string;
  userFriendlyMessage: string;
}

// Quiz grading types
export interface AIGradedQuestionResult {
  questionId: string;
  cardId: string;
  userAnswer: string;
  expectedAnswer: string;
  ai_answer: string;
  verdict: 'correct' | 'partial' | 'incorrect';
  score: number; // 0.0 to 1.0
  feedback: string;
  tip?: string;
  confidence: number;
  isLocalEvaluation?: boolean;
}

export interface AIGradedBatchResponse {
  results: AIGradedQuestionResult[];
  overall_analysis?: string;
}
