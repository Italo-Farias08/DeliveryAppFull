import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { coloredShadow } from '../theme/shadows';
import { PressableScale } from './PressableScale';

interface Props {
  name: string;
  icon: any;
  active?: boolean;
  onPress: () => void;
}

export function CategoryPill({ name, icon, active, onPress }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <PressableScale onPress={onPress} style={[styles.pill, active && styles.pillActive]} scaleTo={0.93}>
      <Ionicons name={icon} size={16} color={active ? colors.white : colors.secondary} />
      <Text style={[styles.text, active && styles.textActive]}>{name}</Text>
    </PressableScale>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.secondaryLight,
    marginRight: 10,
  },
  pillActive: { backgroundColor: colors.secondary, ...coloredShadow(colors.secondary, 0.3) },
  text: { fontSize: 13, fontWeight: '600', color: colors.secondary },
  textActive: { color: colors.white },
});
};
