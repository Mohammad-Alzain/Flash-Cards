import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { EmptyState } from '../../../components/ui';
import { IllustrationName } from '../../../components/illustrations';

interface StudyStateViewProps {
  loading?: boolean;
  illustration?: IllustrationName;
  title?: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

/** Full-screen loading or "nothing to study" state for study sessions. */
export const StudyStateView: React.FC<StudyStateViewProps> = ({
  loading,
  illustration = 'all-done',
  title = '',
  description = '',
  actionTitle,
  onAction,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <EmptyState
            illustration={illustration}
            title={title}
            description={description}
            actionTitle={actionTitle ?? t('study.back_home')}
            actionIcon="home"
            onAction={onAction}
          />
        )}
      </View>
    </SafeAreaView>
  );
};
