import React from 'react';
import { View } from 'react-native';
import { useTheme, ToneName } from '../../../theme';
import { AppText, Row, IconTile, Button, PressableScale, IconName } from '../../../components/ui';

interface QuizModeCardProps {
  title: string;
  description: string;
  icon: IconName;
  tone: ToneName;
  startLabel: string;
  onStart: () => void;
  disabled?: boolean;
}

export const QuizModeCard: React.FC<QuizModeCardProps> = ({
  title,
  description,
  icon,
  tone,
  startLabel,
  onStart,
  disabled,
}) => {
  const { shape, tone: getTone } = useTheme();
  const t = getTone(tone);
  return (
    <PressableScale
      onPress={onStart}
      disabled={disabled}
      activeScale={0.985}
      style={{
        borderRadius: shape.card,
        backgroundColor: t.bg,
        borderWidth: 1.5,
        borderColor: t.border,
        padding: 14,
        marginBottom: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Row gap={12}>
        <IconTile icon={icon} tone={tone} size={52} variant="solid" />
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="extrabold">
            {title}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {description}
          </AppText>
        </View>
        <Button title={startLabel} size="sm" icon="play" color={t.solid} onPress={onStart} disabled={disabled} />
      </Row>
    </PressableScale>
  );
};
