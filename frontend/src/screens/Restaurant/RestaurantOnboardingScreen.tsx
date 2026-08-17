import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { RestaurantInput } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

export default function RestaurantOnboardingScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, signOut } = useAuth();
  const { categories, onboardingSaving, handleCreateRestaurant } = useRestaurantPanel();

  const [obName, setObName] = useState('');
  const [obCategoryId, setObCategoryId] = useState<string | null>(null);
  const [obFee, setObFee] = useState('');
  const [obMin, setObMin] = useState('25');
  const [obMax, setObMax] = useState('40');

  async function handleSubmit() {
    if (!obName.trim() || !obCategoryId) {
      Alert.alert('Preencha os campos', 'Nome e categoria são obrigatórios.');
      return;
    }
    const fee = Number(obFee.replace(',', '.'));
    const min = parseInt(obMin, 10);
    const max = parseInt(obMax, 10);
    if (Number.isNaN(fee) || fee < 0) {
      Alert.alert('Taxa inválida', 'Informe uma taxa de entrega válida.');
      return;
    }
    if (!min || !max || min <= 0 || max <= 0) {
      Alert.alert('Tempo inválido', 'Informe o tempo mínimo e máximo de entrega.');
      return;
    }
    const payload: RestaurantInput = {
      name: obName.trim(),
      categoryId: obCategoryId,
      deliveryFee: fee,
      deliveryTimeMin: min,
      deliveryTimeMax: max,
      isOpen: true,
    };
    await handleCreateRestaurant(payload);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PAINEL DO RESTAURANTE</Text>
            <Text style={styles.hello}>Olá, {user?.name}</Text>
            <Text style={styles.sub}>Vamos criar seu restaurante</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="storefront-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Dados do restaurante</Text>
          </View>

          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={obName} onChangeText={setObName} placeholder="Ex: Brasa & Cia" placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.pillsWrap}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setObCategoryId(c.id)}
                style={[styles.pill, obCategoryId === c.id && styles.pillActive]}
              >
                <Text style={[styles.pillText, obCategoryId === c.id && styles.pillTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Taxa de entrega (R$)</Text>
          <TextInput
            style={styles.input}
            value={obFee}
            onChangeText={setObFee}
            placeholder="Ex: 6.90"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tempo mín. (min)</Text>
              <TextInput style={styles.input} value={obMin} onChangeText={setObMin} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tempo máx. (min)</Text>
              <TextInput style={styles.input} value={obMax} onChangeText={setObMax} keyboardType="number-pad" />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, onboardingSaving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={onboardingSaving}
          >
            {onboardingSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Criar restaurante</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  hello: { ...typography.h1, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  signOutBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, ...shadows.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginTop: 16,
    ...shadows.sm,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconCircle: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    ...shadows.sm, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    ...shadows.sm, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.background,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  primaryBtn: {
    marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
};
