import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../../theme';
import { BottomSheet, AppText, Row, Button, PressableScale, IconName } from '../../../components/ui';
import { AnswerDetail, Verdict, verdictOf } from '../useQuizResults';

interface OverrideSheetProps {
  answer: AnswerDetail | null;
  onClose: () => void;
  onSave: (answer: AnswerDetail, verdict: Verdict) => Promise<boolean>;
}

/** Lets the learner correct the AI's verdict for one answer. */
export const OverrideSheet: React.FC<OverrideSheetProps> = ({ answer, onClose, onSave }) => {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  const [verdict, setVerdict] = useState<Verdict>('correct');

  useEffect(() => {
    if (answer) setVerdict(verdictOf(answer));
  }, [answer]);

  const options: { value: Verdict; icon: IconName; color: string; title: string; desc: string }[] = [
    { value: 'correct', icon: 'checkmark-circle', color: tone('green').fg, title: t('quiz_results.v_correct'), desc: t('quiz_results.v_correct_desc') },
    { value: 'partial', icon: 'alert-circle', color: colors.warning, title: t('quiz_results.v_partial'), desc: t('quiz_results.v_partial_desc') },
    { value: 'incorrect', icon: 'close-circle', color: colors.error, title: t('quiz_results.v_incorrect'), desc: t('quiz_results.v_incorrect_desc') },
  ];

  return (
    <BottomSheet
      visible={answer !== null}
      onClose={onClose}
      title={t('quiz_results.override_title')}
      icon="options"
      tone="violet"
      footer={
        <Row gap={10}>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title={t('quiz_results.save_override')}
            icon="checkmark"
            onPress={async () => {
              if (answer && (await onSave(answer, verdict))) onClose();
            }}
            style={{ flex: 1 }}
          />
        </Row>
      }
    >
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 14 }}>
        {t('quiz_results.override_desc')}
      </AppText>
      <View style={{ gap: 10 }}>
        {options.map((o) => {
          const active = o.value === verdict;
          return (
            <PressableScale
              key={o.value}
              onPress={() => setVerdict(o.value)}
              haptic
              style={{
                padding: 12,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: active ? o.color : colors.border,
                backgroundColor: active ? alpha(o.color, 0.1) : colors.surfaceRaised,
              }}
            >
              <Row gap={12}>
                <Ionicons name={active ? o.icon : 'ellipse-outline'} size={24} color={o.color} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{o.title}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {o.desc}
                  </AppText>
                </View>
              </Row>
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
};
