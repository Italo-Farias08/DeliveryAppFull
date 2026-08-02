import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const OPTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'person-outline', label: 'Meus dados' },
  { icon: 'location-outline', label: 'Endereços' },
  { icon: 'card-outline', label: 'Formas de pagamento' },
  { icon: 'heart-outline', label: 'Favoritos' },
  { icon: 'help-circle-outline', label: 'Ajuda' },
];

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const initials = (user?.name ?? '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Conta</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Cliente</Text>
          </View>
        </View>
      </View>

      <View style={styles.list}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Em breve', `${opt.label} chega com o backend.`)}
          >
            <Ionicons name={opt.icon} size={20} color={colors.text} />
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.optionLabel, { color: colors.danger }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>versão 1.0.0 · demonstração</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 18 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  name: { ...typography.h2, color: colors.text },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  roleBadge: {
    marginTop: 6, alignSelf: 'flex-start', backgroundColor: colors.secondaryLight,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  roleBadgeText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  list: { marginTop: 24, marginHorizontal: 20 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11.5, marginTop: 24 },
});
