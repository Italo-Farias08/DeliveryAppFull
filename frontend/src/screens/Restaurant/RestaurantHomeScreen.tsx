import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function RestaurantHomeScreen() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name}</Text>
            <Text style={styles.sub}>Painel do restaurante</Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>{isOpen ? 'Loja aberta' : 'Loja fechada'}</Text>
            <Text style={styles.statusSub}>
              {isOpen ? 'Você está recebendo pedidos' : 'Clientes não podem pedir agora'}
            </Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={setIsOpen}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Pedidos hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color={colors.secondary} />
            <Text style={styles.statValue}>R$ 0,00</Text>
            <Text style={styles.statLabel}>Faturamento hoje</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedidos recentes</Text>
          <View style={styles.emptyBox}>
            <Ionicons name="fast-food-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
            <Text style={styles.emptySub}>Modo demonstração — conecte o backend para receber pedidos reais</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cardápio</Text>
          <TouchableOpacity style={styles.menuBtn} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
            <Text style={styles.menuBtnText}>Adicionar item ao cardápio</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hello: { ...typography.h1, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  statusCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginTop: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  statusTitle: { ...typography.bodyBold, color: colors.text },
  statusSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { ...typography.h1, color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  section: { marginTop: 26 },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 12 },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 16, padding: 30,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 16,
  },
  menuBtnText: { color: colors.secondary, fontWeight: '700' },
});
