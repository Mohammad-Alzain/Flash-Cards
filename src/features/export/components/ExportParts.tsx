import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha, ToneName } from '../../../theme';
import { AppText, Row, IconTile, PressableScale, ListGroup, ListItem, ProgressBar, Button, IconName } from '../../../components/ui';
import { Illustration } from '../../../components/illustrations';
import { ExportFormat } from '../../../core/exporters/types';
import { formatBytes } from '../../../core/utils/format';
import type { Exporter } from '../useExporter';

const FORMATS: { id: ExportFormat; icon: IconName; tone: ToneName; descKey: string }[] = [
  { id: 'apkg', icon: 'cube', tone: 'indigo', descKey: 'export.apkgDesc' },
  { id: 'xlsx', icon: 'grid', tone: 'green', descKey: 'export.xlsxDesc' },
  { id: 'csv', icon: 'document-text', tone: 'amber', descKey: 'export.csvDesc' },
  { id: 'tsv', icon: 'reader', tone: 'sky', descKey: 'export.tsvDesc' },
];

/** Format picker + scheduling/media toggles. */
export const ExportOptionsForm: React.FC<{ ex: Exporter }> = ({ ex }) => {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <View style={{ gap: 10, marginBottom: 18 }}>
        {FORMATS.map((f) => {
          const selected = ex.format === f.id;
          return (
            <PressableScale
              key={f.id}
              onPress={() => ex.setFormat(f.id)}
              haptic
              style={{
                padding: 12,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: selected ? tone(f.tone).fg : colors.border,
                backgroundColor: selected ? alpha(tone(f.tone).fg, 0.08) : colors.surfaceRaised,
              }}
            >
              <Row gap={12}>
                <IconTile icon={f.icon} tone={f.tone} size={44} variant={selected ? 'solid' : 'soft'} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{t(`export.fmt_${f.id}`)}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {t(f.descKey)}
                  </AppText>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? tone(f.tone).fg : colors.textMuted} />
              </Row>
            </PressableScale>
          );
        })}
      </View>
      <ListGroup title={t('export.options')}>
        <ListItem
          icon="calendar"
          tone="violet"
          title={t('export.includeScheduling')}
          subtitle={t('export.includeSchedulingDesc')}
          switchValue={ex.includeScheduling}
          onSwitchChange={ex.setIncludeScheduling}
        />
        {ex.format === 'apkg' && (
          <ListItem
            icon="images"
            tone="pink"
            title={t('export.includeMedia')}
            subtitle={t('export.includeMediaDesc')}
            switchValue={ex.includeMedia}
            onSwitchChange={ex.setIncludeMedia}
          />
        )}
      </ListGroup>
    </>
  );
};

/** Live export progress. */
export const ExportProgressView: React.FC<{ ex: Exporter }> = ({ ex }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pct = ex.progress?.percent || 0;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Illustration name="import" size={170} />
      <ActivityIndicator color={colors.primary} />
      <AppText variant="bodyStrong" align="center" style={{ marginTop: 10 }}>
        {ex.progress?.message || t('export.preparingPackage')}
      </AppText>
      <ProgressBar progress={pct / 100} height={10} style={{ marginVertical: 12 }} />
      <AppText variant="h2" color="primary" align="center">
        {pct}%
      </AppText>
    </View>
  );
};

export const ExportError: React.FC<{ message: string | null }> = ({ message }) => {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <Row gap={8} style={{ padding: 12, borderRadius: 14, backgroundColor: alpha(colors.error, 0.1), marginBottom: 12 }}>
      <Ionicons name="alert-circle" size={18} color={colors.error} />
      <AppText variant="bodySm" color="error" style={{ flex: 1 }}>
        {message}
      </AppText>
    </Row>
  );
};

/** Success summary with save / share actions. */
export const ExportResultView: React.FC<{ ex: Exporter; onClose?: () => void }> = ({ ex, onClose }) => {
  const { t } = useTranslation();
  const res = ex.result;
  if (!res) return null;
  const rows = [
    { icon: 'copy' as const, label: t('export.stat_cards'), value: String(res.cardCount) },
    { icon: 'document-text' as const, label: t('export.stat_notes'), value: String(res.noteCount) },
    ...(res.mediaCount > 0 ? [{ icon: 'images' as const, label: t('export.stat_media'), value: String(res.mediaCount) }] : []),
    { icon: 'server' as const, label: t('export.stat_size'), value: formatBytes(res.sizeBytes) },
  ];
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Illustration name="all-done" size={170} />
        <AppText variant="h3" align="center">
          {t('export.done_title')}
        </AppText>
        <AppText variant="caption" color="textSecondary" align="center" style={{ marginTop: 2, marginBottom: 14 }}>
          {res.fileName}
        </AppText>
      </View>
      <ListGroup style={{ marginBottom: 14 }}>
        {rows.map((r) => (
          <ListItem key={r.label} icon={r.icon} tone="slate" title={r.label} value={r.value} />
        ))}
      </ListGroup>
      {ex.saved && (
        <Row gap={8} style={{ padding: 12, borderRadius: 14, marginBottom: 12 }}>
          <IconTile icon="checkmark-done" tone="green" size={28} shape="circle" />
          <AppText variant="bodySm" weight="bold">
            {t('export.saved_banner')}
          </AppText>
        </Row>
      )}
      <ExportError message={ex.error} />
      <Button title={ex.busy === 'save' ? t('export.savingToDevice') : t('export.saveToDevice')} icon="download" fullWidth loading={ex.busy === 'save'} disabled={!!ex.busy} onPress={() => ex.save(res)} style={{ marginBottom: 10 }} />
      <Button title={t('export.shareFile')} icon="share-social" variant="ghost" fullWidth disabled={!!ex.busy} onPress={() => ex.share(res)} style={{ marginBottom: 8 }} />
      {onClose && <Button title={t('common.close')} variant="soft" size="sm" fullWidth disabled={!!ex.busy} onPress={onClose} />}
    </View>
  );
};
