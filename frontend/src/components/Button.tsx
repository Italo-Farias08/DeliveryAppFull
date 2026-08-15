import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';

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
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.base,
        isOutline ? styles.outline : styles.primary,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.label, isOutline && { color: colors.primary }]}>{label}</Text>
      )}
    </TouchableOpacity>
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
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  label: { ...typography.button, color: colors.white },
});
};
