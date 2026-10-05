import React from 'react';
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ToneName } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconTile } from './IconTile';
import { IconButton } from './IconButton';
import { IconName } from './types';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  tone?: ToneName;
  children: React.ReactNode;
  /** Sticky footer (action buttons). */
  footer?: React.ReactNode;
  /** Let content scroll when tall. */
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Modal bottom sheet with drag-handle, header tile and keyboard avoidance. */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  tone = 'indigo',
  children,
  footer,
  scrollable = false,
  style,
}) => {
  const { colors, shape } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.5)' }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            {
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: shape.sheet,
              borderTopRightRadius: shape.sheet,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              maxHeight: '90%',
            },
            style,
          ]}
        >
          <View
            style={{
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          {!!title && (
            <Row gap={12} style={{ marginBottom: 18 }}>
              {icon && <IconTile icon={icon} tone={tone} size={44} />}
              <View style={{ flex: 1 }}>
                <AppText variant="h2">{title}</AppText>
                {!!subtitle && (
                  <AppText variant="bodySm" color="textSecondary">
                    {subtitle}
                  </AppText>
                )}
              </View>
              <IconButton icon="close" onPress={onClose} variant="ghost" size={36} accessibilityLabel="Close" />
            </Row>
          )}
          {scrollable ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}
          {footer && <View style={{ marginTop: 12 }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
