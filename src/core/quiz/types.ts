export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'type_answer'
  | 'flashcard_check'
  | 'matching';

export type QuizMode =
  | 'random'
  | 'practice'
  | 'exam'
  | 'survival'
  | 'matching'
  | 'match'
  | 'mistakes'
  | 'written_ai'
  | 'mixed';

export interface QuizConfig {
  mode: QuizMode;
  deckId?: string;
  questionCount: number; // e.g. 10, 20
  allowedTypes: QuestionType[];
  timeLimitSec?: number; // 0 = no limit
  passScorePercent?: number; // default 70%
  caseInsensitive?: boolean;
  arabicNormalization?: boolean;
  questionField?: string;
  answerField?: string;
  smartFocus?: 'all' | 'mistakes' | 'due' | 'new' | 'hardest';
}

export interface QuizQuestion {
  id: string;
  cardId: string;
  type: QuestionType;
  prompt: string; // The question (e.g. Front or Meaning)
  promptImage?: string; // Optional image URL/path for the question
  correctAnswer: string;
  options?: string[]; // For multiple choice
  tfPresentedAnswer?: string; // For True/False
  tfIsCorrect?: boolean;
  pairs?: { id: string; left: string; right: string }[]; // For matching game
}

export interface UserAnswerRecord {
  questionId: string;
  cardId: string;
  questionType: QuestionType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeMs: number;
  ai_answer?: string;
  ai_verdict?: 'correct' | 'partial' | 'incorrect';
  ai_score?: number;
  ai_feedback?: string;
  ai_tip?: string;
  ai_confidence?: number;
  manual_override?: string;
  is_marked_for_review?: boolean;
}

export interface QuizResultSummary {
  attemptId: string;
  mode: QuizMode;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  durationMs: number;
  xpEarned: number;
  passed?: boolean;
  answers: UserAnswerRecord[];
  overallAnalysis?: string;
}
