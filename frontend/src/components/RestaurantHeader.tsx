import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  title: string;
  subtitle?: string;
  onMenuPress: () => void;
  right?: ReactNode;
}

export default function RestaurantHeader({ title, subtitle, onMenuPress, right }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="menu" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  title: { ...typography.h1, color: colors.text, fontSize: 21 },
  subtitle: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
});
};
