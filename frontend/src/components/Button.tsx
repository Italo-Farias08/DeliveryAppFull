import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { coloredShadow } from '../theme/shadows';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
}

export function Button({ label, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isOutline = variant === 'outline';
  const inactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      onPressIn={() =>
        !inactive && Animated.spring(scale, { toValue: 0.97, friction: 6, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start()
      }
    >
      <Animated.View
        style={[
          styles.base,
          isOutline ? styles.outline : styles.primary,
          inactive && { opacity: 0.6 },
          { transform: [{ scale }] },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isOutline ? colors.primary : colors.white} />
        ) : (
          <Text style={[styles.label, isOutline && { color: colors.primary }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary, ...coloredShadow(colors.primary, 0.32) },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  label: { ...typography.button, color: colors.white },
});
};
