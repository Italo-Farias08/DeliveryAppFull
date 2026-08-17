import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { PressableScale } from './PressableScale';

interface Props {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  editable?: boolean;
  onPress?: () => void;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

// Recebe ref pra permitir focar o campo de forma imperativa (ex: só depois
// que a animação de navegação terminar, em vez de autoFocus na hora do
// mount, que briga com a transição da tela e trava a animação).
export const SearchBar = forwardRef<TextInput, Props>(function SearchBar(
  { placeholder = 'Buscar restaurantes ou comidas', value, onChangeText, editable = true, onPress, autoFocus, onSubmitEditing },
  ref
) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  // Anima um leve "glow" na borda quando o campo ganha foco -- dá uma
  // resposta visual mais viva do que a borda estática de antes.
  const focusAnim = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  function animateFocus(toValue: number) {
    Animated.timing(focusAnim, { toValue, duration: 180, useNativeDriver: false }).start();
  }

  if (!editable && onPress) {
    return (
      <PressableScale onPress={onPress} style={[styles.wrapper, shadows.xs]} scaleTo={0.98}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.placeholderText}>{placeholder}</Text>
      </PressableScale>
    );
  }

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { borderColor },
        focused && { ...shadows.sm, shadowColor: colors.primary },
      ]}
    >
      <Ionicons name="search" size={18} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        ref={ref}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        onFocus={() => {
          setFocused(true);
          animateFocus(1);
        }}
        onBlur={() => {
          setFocused(false);
          animateFocus(0);
        }}
      />
    </Animated.View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: { flex: 1, fontSize: 14.5, color: colors.text },
    placeholderText: { color: colors.textMuted, fontSize: 14.5 },
  });
}
