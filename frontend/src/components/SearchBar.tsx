import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  editable?: boolean;
  onPress?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ placeholder = 'Buscar restaurantes ou comidas', value, onChangeText, editable = true, onPress, autoFocus }: Props) {
  if (!editable && onPress) {
    return (
      <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.placeholderText}>{placeholder}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.wrapper}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
