import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha, ToneName } from '../../../theme';
import {
  AppText,
  Row,
  Badge,
  PressableScale,
  IconTile,
  BottomSheet,
  Button,
  TextField,
  SegmentedControl,
  IconName,
} from '../../../components/ui';
import type { BrowserCardItem, BrowserSortColumn, BrowserSortOrder } from '../../../core/db/repositories/browserRepository';

interface RowProps {
  item: BrowserCardItem;
  selected: boolean;
  multiSelect: boolean;
  onToggleSelect: (id: string) => void;
  onOpenEdit: (noteId: string) => void;
}

/** Browser list row (memoised: lists can hold thousands of cards). */
export const BrowserCardRow = React.memo<RowProps>(
  ({ item, selected, multiSelect, onToggleSelect, onOpenEdit }) => {
    const { colors, shadow } = useTheme();
    const { t } = useTranslation();
    const stateBadge =
      item.suspended === 1 ? (
        <Badge size="sm" variant="warning" icon="pause" label={t('browser.suspended')} />
      ) : item.state === 0 ? (
        <Badge size="sm" variant="new" icon="sparkles" label={t('browser.new')} />
      ) : (
        <Badge size="sm" variant="due" icon="time" label={t('browser.interval_days', { count: item.interval_days })} />
      );

    return (
      <PressableScale
        onPress={() => (multiSelect ? onToggleSelect(item.id) : onOpenEdit(item.note_id))}
        onLongPress={() => onToggleSelect(item.id)}
        activeScale={0.985}
        style={[
          {
            marginBottom: 8,
            padding: 12,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? alpha(colors.primary, 0.08) : colors.surfaceRaised,
          },
          selected ? null : shadow(1),
        ]}
      >
        <Row gap={12}>
          {multiSelect && (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: selected ? colors.primary : colors.borderDarker,
                backgroundColor: selected ? colors.primary : 'transparent',
              }}
            >
              {selected && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {item.sort_field || t('browser.no_prompt')}
            </AppText>
            <Row gap={8} style={{ marginTop: 4 }}>
              <Row gap={3}>
                <Ionicons name="layers" size={11} color={colors.textMuted} />
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {item.deck_name}
                </AppText>
              </Row>
              {!!item.tags && (
                <Row gap={3} style={{ flexShrink: 1 }}>
                  <Ionicons name="pricetag" size={11} color={colors.textMuted} />
                  <AppText variant="caption" color="textMuted" numberOfLines={1}>
                    {item.tags}
                  </AppText>
                </Row>
              )}
            </Row>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            {stateBadge}
            {!multiSelect && <Ionicons name="create-outline" size={16} color={colors.textMuted} />}
          </View>
        </Row>
      </PressableScale>
    );
  },
  (a, b) =>
    a.selected === b.selected &&
    a.multiSelect === b.multiSelect &&
    a.item.id === b.item.id &&
    a.item.sort_field === b.item.sort_field &&
    a.item.tags === b.item.tags &&
    a.item.suspended === b.item.suspended &&
    a.item.interval_days === b.item.interval_days &&
    a.onToggleSelect === b.onToggleSelect &&
    a.onOpenEdit === b.onOpenEdit
);

interface BulkAction {
  key: string;
  icon: IconName;
  tone: ToneName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** Floating action tray shown while cards are selected. */
export const BulkActionBar: React.FC<{ count: number; onStudy: () => void; actions: BulkAction[] }> = ({ count, onStudy, actions }) => {
  const { colors, shape, shadow } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 16,
          borderRadius: shape.card,
          padding: 12,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow(3),
      ]}
    >
      <Row justify="space-between" style={{ marginBottom: 10 }}>
        <Row gap={8}>
          <View style={{ minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="caption" weight="black" color="#FFFFFF" align="center">
              {count}
            </AppText>
          </View>
          <AppText variant="bodyStrong">{t('browser.selected_count')}</AppText>
        </Row>
        <Button title={t('browser.study_selected')} icon="play" size="sm" onPress={onStudy} />
      </Row>
      <Row justify="space-between">
        {actions.map((a) => (
          <PressableScale key={a.key} onPress={a.onPress} activeScale={0.9} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <IconTile icon={a.icon} tone={a.destructive ? 'rose' : a.tone} size={38} />
            <AppText variant="caption" size={10.5} weight="bold" color={a.destructive ? 'error' : 'text'} align="center" numberOfLines={1}>
              {a.label}
            </AppText>
          </PressableScale>
        ))}
      </Row>
    </View>
  );
};

const SORT_COLUMNS: { col: BrowserSortColumn; icon: IconName }[] = [
  { col: 'created_at', icon: 'calendar' },
  { col: 'due', icon: 'alarm' },
  { col: 'sort_field', icon: 'text' },
  { col: 'ease_factor', icon: 'speedometer' },
  { col: 'interval_days', icon: 'hourglass' },
  { col: 'reps', icon: 'repeat' },
  { col: 'lapses', icon: 'bug' },
];

interface SortSheetProps {
  visible: boolean;
  onClose: () => void;
  column: BrowserSortColumn;
  order: BrowserSortOrder;
  onChange: (col: BrowserSortColumn, ord: BrowserSortOrder) => void;
}

export const SortSheet: React.FC<SortSheetProps> = ({ visible, onClose, column, order, onChange }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('browser.sort_title')} icon="swap-vertical" tone="sky" scrollable>
      <SegmentedControl<BrowserSortOrder>
        value={order}
        onChange={(o) => onChange(column, o)}
        style={{ marginBottom: 14 }}
        options={[
          { value: 'DESC', label: t('browser.desc'), icon: 'arrow-down' },
          { value: 'ASC', label: t('browser.asc'), icon: 'arrow-up' },
        ]}
      />
      {SORT_COLUMNS.map(({ col, icon }) => {
        const active = column === col;
        return (
          <PressableScale
            key={col}
            onPress={() => {
              onChange(col, order);
              onClose();
            }}
            style={{
              padding: 12,
              marginBottom: 8,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? alpha(colors.primary, 0.08) : colors.surfaceRaised,
            }}
          >
            <Row gap={12}>
              <IconTile icon={icon} tone={active ? 'indigo' : 'slate'} size={34} />
              <AppText variant="bodyStrong" color={active ? 'primary' : 'text'} style={{ flex: 1 }}>
                {t(`browser.col_${col}`)}
              </AppText>
              {active && <Ionicons name={order === 'DESC' ? 'arrow-down' : 'arrow-up'} size={18} color={colors.primary} />}
            </Row>
          </PressableScale>
        );
      })}
    </BottomSheet>
  );
};

export const TagSheet: React.FC<{ visible: boolean; count: number; onClose: () => void; onApply: (tag: string) => Promise<boolean> }> = ({
  visible,
  count,
  onClose,
  onApply,
}) => {
  const { t } = useTranslation();
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    setTag('');
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t('browser.tag_title')}
      icon="pricetag"
      tone="green"
      footer={
        <Row gap={10}>
          <Button title={t('common.cancel')} variant="ghost" onPress={close} style={{ flex: 1 }} />
          <Button
            title={t('browser.apply_tag')}
            icon="checkmark"
            disabled={!tag.trim()}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await onApply(tag);
              setBusy(false);
              if (ok) close();
            }}
            style={{ flex: 1 }}
          />
        </Row>
      }
    >
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 12 }}>
        {t('browser.tag_desc', { count })}
      </AppText>
      <TextField value={tag} onChangeText={setTag} placeholder={t('browser.tag_placeholder')} icon="pricetag" autoFocus clearButton style={{ marginBottom: 0 }} />
    </BottomSheet>
  );
};
