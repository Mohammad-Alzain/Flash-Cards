import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../theme';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  Button,
  TextField,
  SegmentedControl,
  ChipPicker,
  ChoiceChips,
  ListGroup,
  ListItem,
  ProgressBar,
  PressableScale,
  IconTile,
  StatTile,
  SectionHeader,
  Badge,
  FormSection,
} from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { ErrorModal } from '../../components/common/ErrorModal';
import { useImportWizard, ImportTab, DuplicateStrategy } from '../../features/import/useImportWizard';

export default function ImportWizardScreen() {
  const { colors, shape } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const w = useImportWizard();

  return (
    <Screen
      decor
      header={
        <Header
          title={t('import_wizard.title')}
          subtitle={t('import_wizard.subtitle')}
          icon="cloud-download"
          iconTone="teal"
          onBack={() => router.back()}
          rightElement={<Button title={t('import_wizard.history')} icon="time" variant="ghost" size="sm" onPress={() => router.push('/import/history')} />}
        />
      }
      overlay={<ErrorModal visible={w.error !== null} error={w.error} onClose={w.clearError} />}
    >
      <SegmentedControl<ImportTab>
        value={w.tab}
        onChange={w.setTab}
        style={{ marginBottom: 16 }}
        options={[
          { value: 'file', label: t('import_wizard.tab_file'), icon: 'document-attach' },
          { value: 'paste', label: t('import_wizard.tab_paste'), icon: 'clipboard' },
        ]}
      />

      {w.tab === 'file' ? (
        <PressableScale
          onPress={w.pickFile}
          disabled={w.parsing}
          activeScale={0.98}
          style={{
            borderRadius: shape.card,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: w.fileName ? colors.primary : colors.borderDarker,
            backgroundColor: w.fileName ? alpha(colors.primary, 0.05) : colors.surfaceRaised,
            padding: 18,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          {w.parsing ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
          ) : w.fileName ? (
            <>
              <IconTile icon={w.isApkg ? 'cube' : 'document-text'} tone="teal" size={56} variant="solid" />
              <AppText variant="bodyStrong" align="center" numberOfLines={2} style={{ marginTop: 10 }}>
                {w.fileName}
              </AppText>
              {w.preview && (
                <Row gap={6} style={{ marginTop: 6 }}>
                  <Badge size="sm" variant="primary" label={t('import_wizard.total_rows', { count: w.preview.totalRows })} />
                  {!!w.preview.detectedDelimiter && <Badge size="sm" label={t('import_wizard.delimiter', { value: w.preview.detectedDelimiter })} />}
                </Row>
              )}
              <AppText variant="caption" weight="extrabold" color="primary" style={{ marginTop: 10 }}>
                {t('import_wizard.change_file')}
              </AppText>
            </>
          ) : (
            <>
              <Illustration name="import" size={170} />
              <AppText variant="h3" align="center">
                {t('import_wizard.drop_title')}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center" style={{ marginTop: 2 }}>
                {t('import_wizard.drop_desc')}
              </AppText>
            </>
          )}
        </PressableScale>
      ) : (
        <Card style={{ marginBottom: 16, paddingBottom: 0 }}>
          <TextField
            label={t('import_wizard.tab_paste')}
            placeholder={t('import_wizard.paste_placeholder')}
            value={w.pastedText}
            onChangeText={w.setPastedText}
            multiline
            numberOfLines={6}
          />
        </Card>
      )}

      {w.preview?.sourceType === 'apkg' ? (
        <Card variant="tinted" tone="indigo" style={{ marginBottom: 14 }}>
          <Row gap={12} align="flex-start">
            <IconTile icon="cube" tone="indigo" size={42} variant="solid" />
            <View style={{ flex: 1 }}>
              <AppText variant="title" weight="extrabold">
                {t('import_wizard.anki_detected')}
              </AppText>
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {t('import_wizard.anki_auto_msg')}
              </AppText>
              {!!w.preview.decksFound?.length && (
                <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
                  {t('import_wizard.decks_found', { list: w.preview.decksFound.join('، ') })}
                </AppText>
              )}
            </View>
          </Row>
        </Card>
      ) : (
        <>
          <FormSection icon="albums" tone="violet" title={t('add_note.deck')}>
            <ChipPicker items={w.decks} selectedId={w.deckId} onSelect={w.setDeckId} getId={(d) => d.id} getLabel={(d) => d.name} />
          </FormSection>
          <FormSection icon="shapes" tone="amber" title={t('add_note.card_type')}>
            <ChipPicker items={w.noteTypes} selectedId={w.noteTypeId} onSelect={w.setNoteTypeId} getId={(n) => n.id} getLabel={(n) => n.name} />
          </FormSection>
        </>
      )}

      <SectionHeader title={t('import_wizard.options_title')} icon="options" tone="sky" />
      <Card style={{ marginBottom: 14, paddingBottom: 2 }}>
        <ChoiceChips<DuplicateStrategy>
          label={t('import_wizard.duplicate_strategy')}
          labelIcon="copy"
          options={[
            { value: 'skip', label: t('import_wizard.dup_skip'), icon: 'play-skip-forward' },
            { value: 'update', label: t('import_wizard.dup_update'), icon: 'sync' },
            { value: 'new', label: t('import_wizard.dup_new'), icon: 'add-circle' },
          ]}
          value={w.duplicateStrategy}
          onChange={w.setDuplicateStrategy}
        />
      </Card>
      {w.preview?.sourceType === 'apkg' && (
        <ListGroup>
          <ListItem icon="calendar" tone="violet" title={t('import_wizard.keep_scheduling')} switchValue={w.keepScheduling} onSwitchChange={w.setKeepScheduling} />
        </ListGroup>
      )}

      {w.importing && w.progress ? (
        <Card variant="tinted" tone="teal" style={{ marginVertical: 8 }}>
          <Row justify="space-between" style={{ marginBottom: 12 }}>
            <Row gap={8}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="title" weight="extrabold">
                {t('import_wizard.importing_title')}
              </AppText>
            </Row>
            <AppText variant="h3" color="primary">
              {w.progress.percent}%
            </AppText>
          </Row>
          <ProgressBar progress={Math.max(0.02, w.progress.percent / 100)} height={10} />
          <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 10 }}>
            {w.progress.message}
          </AppText>
          {w.progress.estimatedRemainingSeconds !== undefined && w.progress.percent < 100 && (
            <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
              ⏱ {t('import_wizard.eta', { count: w.progress.estimatedRemainingSeconds })}
            </AppText>
          )}
          <AppText variant="caption" color="textMuted" style={{ marginTop: 6, fontStyle: 'italic' }}>
            {t('import_wizard.dont_close')}
          </AppText>
        </Card>
      ) : (
        <Button title={t('import_wizard.start_import')} icon="rocket" size="lg" fullWidth disabled={!w.canStart} onPress={w.runImport} style={{ marginVertical: 8 }} />
      )}

      {w.summary && (
        <Card style={{ marginTop: 12, alignItems: 'center' }}>
          <Illustration name="all-done" size={170} />
          <AppText variant="h2" align="center">
            {t('import_wizard.summary_title')}
          </AppText>
          <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginBottom: 14 }}>
            {t('import_wizard.summary_desc')}
          </AppText>
          <Row gap={8} align="stretch" style={{ alignSelf: 'stretch', marginBottom: 14 }}>
            <StatTile layout="compact" icon="add-circle" tone="green" value={w.summary.added} label={t('import_wizard.stat_added')} />
            <StatTile layout="compact" icon="sync" tone="sky" value={w.summary.updated} label={t('import_wizard.stat_updated')} />
            <StatTile layout="compact" icon="play-skip-forward" tone="slate" value={w.summary.skipped} label={t('import_wizard.stat_skipped')} />
          </Row>
          <Button title={t('import_wizard.view_decks')} icon="albums" fullWidth onPress={() => router.replace('/(tabs)/decks')} />
        </Card>
      )}
    </Screen>
  );
}
