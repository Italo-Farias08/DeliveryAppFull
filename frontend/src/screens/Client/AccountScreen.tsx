import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount } from '../../services/userService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows, coloredShadow } from '../../theme/shadows';

const OPTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string }[] = [
  { icon: 'person-outline', label: 'Meus dados', route: 'MyData' },
  { icon: 'location-outline', label: 'Endereços', route: 'Addresses' },
  { icon: 'card-outline', label: 'Formas de pagamento' },
  { icon: 'heart-outline', label: 'Favoritos', route: 'Favorites' },
  { icon: 'help-circle-outline', label: 'Ajuda', route: 'Help' },
];

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { value: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
];

export default function AccountScreen() {
  const { colors, mode, setMode } = useTheme();
  const styles = createStyles(colors);
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const initials = (user?.name ?? '?').charAt(0).toUpperCase();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  async function handleConfirmDelete(password: string) {
    await deleteAccount(password);
    await signOut();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Conta</Text>

      <FadeSlideIn index={0} style={styles.profileCard}>
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
      </FadeSlideIn>

<Text style={styles.sectionTitle}>Aparência</Text>
<FadeSlideIn index={1} style={styles.themeRow}>
  {THEME_OPTIONS.map((opt) => {
    const active = mode === opt.value;
    return (
      <PressableScale
        key={opt.value}
        style={[styles.themeOption, active && styles.themeOptionActive]}
        onPress={() => setMode(opt.value)}
        scaleTo={0.95}
      >
        <Ionicons
          name={opt.icon}
          size={18}
          color={active ? colors.white : colors.textMuted}
        />
        <Text style={[styles.themeOptionLabel, active && styles.themeOptionLabelActive]}>
          {opt.label}
        </Text>
      </PressableScale>
    );
  })}
</FadeSlideIn>

      <FadeSlideIn index={2} style={styles.list}>
        {OPTIONS.map((opt, i) => (
          <PressableScale
            key={opt.label}
            style={[styles.optionRow, i === OPTIONS.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() =>
              opt.route
                ? navigation.navigate(opt.route)
                : Alert.alert('Em breve', `${opt.label} chega com o backend.`)
            }
            scaleTo={0.98}
          >
            <Ionicons name={opt.icon} size={20} color={colors.text} />
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </PressableScale>
        ))}
      </FadeSlideIn>

      <FadeSlideIn index={3} style={styles.list}>
        <PressableScale style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={signOut} scaleTo={0.98}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.optionLabel, { color: colors.danger }]}>Sair</Text>
        </PressableScale>
      </FadeSlideIn>

      <FadeSlideIn index={4} style={styles.dangerZone}>
        <PressableScale style={styles.deleteRow} onPress={() => setDeleteModalVisible(true)} scaleTo={0.95}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteLabel}>Excluir minha conta</Text>
        </PressableScale>
      </FadeSlideIn>

      <Text style={styles.version}>versão 1.0.0 · demonstração</Text>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        consequences={[
          'Seus dados pessoais, endereços e favoritos serão apagados.',
          'Você perde o acesso à sua conta e ao histórico de pedidos.',
          'Não será possível desfazer essa ação depois de confirmada.',
        ]}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 18 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    ...shadows.sm,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...coloredShadow(colors.primary, 0.3),
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  name: { ...typography.h2, color: colors.text },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  roleBadge: {
    marginTop: 6, alignSelf: 'flex-start', backgroundColor: colors.secondaryLight,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  roleBadgeText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  sectionTitle: {
    ...typography.bodyBold, color: colors.textMuted, fontSize: 12.5,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 26, marginHorizontal: 20, marginBottom: 10,
  },
  themeRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, minHeight: 60 },
  themeOption: {
  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10,
  borderWidth: 1, borderColor: colors.border,
},
  themeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...coloredShadow(colors.primary, 0.28) },
  themeOptionLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  themeOptionLabelActive: { color: colors.white },
  list: {
    marginTop: 24, marginHorizontal: 20, paddingHorizontal: 16,
    backgroundColor: colors.surface, borderRadius: 16, ...shadows.sm,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  dangerZone: { marginTop: 28, marginHorizontal: 20, alignItems: 'center' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  deleteLabel: { color: colors.danger, fontSize: 12.5, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11.5, marginTop: 10 },
});
};
