import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';

export interface OcclusionBox {
  id: string;
  xPercent: number; // 0 to 100 percentage of width
  yPercent: number; // 0 to 100 percentage of height
  widthPercent: number;
  heightPercent: number;
  label?: string;
  isQuestion?: boolean;
}

interface ImageOcclusionProps {
  imageUri: string;
  occlusions: OcclusionBox[];
  activeOcclusionId?: string;
  onBoxPressed?: (box: OcclusionBox) => void;
}

export const ImageOcclusion: React.FC<ImageOcclusionProps> = ({
  imageUri,
  occlusions,
  activeOcclusionId,
  onBoxPressed,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const toggleReveal = (id: string, box: OcclusionBox) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    onBoxPressed?.(box);
  };

  const handleRevealAll = () => {
    setRevealedIds(new Set(occlusions.map(b => b.id)));
  };

  const handleHideAll = () => {
    setRevealedIds(new Set());
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper} onLayout={handleLayout}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Occlusion Boxes */}
        {containerSize.width > 0 &&
          occlusions.map(box => {
            const isRevealed = revealedIds.has(box.id);
            const isCurrentQuestion = box.id === activeOcclusionId;

            const left = (box.xPercent / 100) * containerSize.width;
            const top = (box.yPercent / 100) * containerSize.height;
            const width = (box.widthPercent / 100) * containerSize.width;
            const height = (box.heightPercent / 100) * containerSize.height;

            if (isRevealed) {
              return (
                <TouchableOpacity
                  key={box.id}
                  style={[
                    styles.boxRevealed,
                    { left, top, width, height, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => toggleReveal(box.id, box)}
                  activeOpacity={0.7}
                >
                  {box.label ? (
                    <Text style={[styles.boxLabel, { color: theme.colors.primary }]}>
                      {box.label}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={box.id}
                style={[
                  styles.boxOccluded,
                  {
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: isCurrentQuestion ? '#EF4444' : '#3B82F6',
                    borderColor: isCurrentQuestion ? '#B91C1C' : '#1D4ED8',
                  },
                ]}
                onPress={() => toggleReveal(box.id, box)}
                activeOpacity={0.8}
              >
                <Text style={styles.boxText}>{isCurrentQuestion ? '?' : ''}</Text>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.ctrlBtn, { borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center' }]}
          onPress={handleRevealAll}
        >
          <Ionicons name="eye-outline" size={16} color={theme.colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.ctrlBtnText, { color: theme.colors.text }]}>
            {t('study.revealAll') || 'Reveal All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, { borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center' }]}
          onPress={handleHideAll}
        >
          <Ionicons name="eye-off-outline" size={16} color={theme.colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.ctrlBtnText, { color: theme.colors.text }]}>
            {t('study.hideAll') || 'Hide All'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  boxOccluded: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  boxRevealed: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  boxLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  ctrlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  ctrlBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
