import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFocusData } from '../../hooks/useFocusData';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { quizGenerator } from '../../core/quiz/generator';

export type QuizMode = 'written_ai' | 'mixed' | 'exam' | 'survival';
export type SmartFocus = 'all' | 'due' | 'new' | 'hardest' | 'mistakes';

export const QUESTION_COUNTS = [5, 10, 20, 50, 0] as const; // 0 = whole deck
export const TIME_LIMITS = [0, 60, 120, 300] as const; // seconds, 0 = none
/** Exam mode always runs against a clock. */
const EXAM_DEFAULT_LIMIT_SEC = 120;
const AUTO = 'auto';

interface QuizSetupData {
  decks: DeckWithCounts[];
  mistakesCount: number;
}

/** State + derived values for the quiz configuration screen. */
export const useQuizSetup = () => {
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { data } = useFocusData<QuizSetupData>(
    async () => {
      const [decks, mistakesCount] = await Promise.all([
        deckRepository.getAllWithCounts(),
        mistakesManager.getMistakesCount(),
      ]);
      return { decks, mistakesCount };
    },
    { decks: [], mistakesCount: 0 },
    'quiz setup'
  );

  const [deckId, setDeckId] = useState<string | null>(params.deckId || null);
  const [fields, setFields] = useState<string[]>([]);
  const [questionField, setQuestionField] = useState<string>(AUTO);
  const [answerField, setAnswerField] = useState<string>(AUTO);
  const [count, setCount] = useState<number>(10);
  const [focus, setFocus] = useState<SmartFocus>('all');
  const [timeLimit, setTimeLimit] = useState<number>(0);

  useEffect(() => {
    if (params.deckId) setDeckId(params.deckId);
  }, [params.deckId]);

  // Field options depend on the selected deck; drop selections that no longer exist.
  useEffect(() => {
    quizGenerator
      .getAvailableFields(deckId || undefined)
      .then((next) => {
        setFields(next);
        setQuestionField((q) => (q !== AUTO && !next.includes(q) ? AUTO : q));
        setAnswerField((a) => (a !== AUTO && !next.includes(a) ? AUTO : a));
      })
      .catch(() => setFields([]));
  }, [deckId]);

  // "My mistakes" disappears once all mistakes are cleared.
  useEffect(() => {
    if (focus === 'mistakes' && data.mistakesCount === 0) setFocus('all');
  }, [focus, data.mistakesCount]);

  const totalCards = data.decks.reduce((acc, d) => acc + (d.card_count || 0), 0);
  const selectedDeck = deckId ? data.decks.find((d) => d.id === deckId) ?? null : null;
  const availableCards = selectedDeck ? selectedDeck.total_card_count ?? selectedDeck.card_count : totalCards;

  const buildPlayHref = (mode: QuizMode) => {
    const q: Record<string, string | undefined> = {
      mode,
      deckId: deckId ?? undefined,
      questionField: questionField !== AUTO ? questionField : undefined,
      answerField: answerField !== AUTO ? answerField : undefined,
      timeLimitSec:
        timeLimit > 0 || mode === 'exam' ? String(timeLimit > 0 ? timeLimit : EXAM_DEFAULT_LIMIT_SEC) : undefined,
      count: String(count > 0 ? count : availableCards),
      smartFocus: focus !== 'all' ? focus : undefined,
    };
    const query = Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&');
    return `/quiz/play?${query}`;
  };

  return {
    decks: data.decks,
    mistakesCount: data.mistakesCount,
    totalCards,
    availableCards,
    deckId,
    setDeckId,
    fields,
    questionField,
    setQuestionField,
    answerField,
    setAnswerField,
    count,
    setCount,
    focus,
    setFocus,
    timeLimit,
    setTimeLimit,
    buildPlayHref,
    AUTO,
  };
};
