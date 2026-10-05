import React from 'react';
import { View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { useDirection } from '../../theme';

export interface RowProps extends ViewProps {
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** A horizontal stack that mirrors itself for right-to-left languages. */
export const Row: React.FC<RowProps> = ({
  gap,
  align = 'center',
  justify,
  wrap,
  flex,
  style,
  children,
  ...rest
}) => {
  const { row } = useDirection();
  return (
    <View
      style={[
        {
          flexDirection: row,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : undefined,
          gap,
          flex,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};
