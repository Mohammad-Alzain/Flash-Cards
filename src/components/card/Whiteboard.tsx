import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

interface Stroke {
  path: string;
  color: string;
  width: number;
}

interface WhiteboardProps {
  visible: boolean;
  onClose?: () => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ visible, onClose }) => {
  const theme = useTheme();

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#3B82F6');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  const colors = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const currentPathRef = useRef<string>('');
  currentPathRef.current = currentPath;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setStrokes(prev => [
            ...prev,
            {
              path: currentPathRef.current,
              color: selectedColor,
              width: strokeWidth,
            },
          ]);
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClear = () => {
    setStrokes([]);
    setCurrentPath('');
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Drawing Canvas */}
      <View style={styles.canvas} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {strokes.map((stroke, index) => (
            <Path
              key={index}
              d={stroke.path}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke={selectedColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {/* Colors */}
        <View style={styles.colorRow}>
          {colors.map(c => {
            const isSelected = selectedColor === c;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  isSelected && styles.colorDotSelected,
                ]}
                onPress={() => setSelectedColor(c)}
              />
            );
          })}
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.toolBtn} onPress={handleUndo} activeOpacity={0.7}>
            <Ionicons name="arrow-undo-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolBtn} onPress={handleClear} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: theme.colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 100,
  },
  canvas: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 2,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#3B82F6',
    transform: [{ scale: 1.2 }],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
