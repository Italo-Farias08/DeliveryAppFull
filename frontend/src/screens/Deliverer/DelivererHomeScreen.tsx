import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function DelivererHomeScreen() {
  const { user, signOut } = useAuth();
  const [available, setAvailable] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name}</Text>
            <Text style={styles.sub}>Painel do entregador</Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {available ? 'Disponível para entregas' : 'Indisponível'}
            </Text>
            <Text style={styles.statusSub}>
              {available ? 'Você vai receber corridas próximas' : 'Ative para começar a receber pedidos'}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Entregas hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color={colors.secondary} />
            <Text style={styles.statValue}>R$ 0,00</Text>
            <Text style={styles.statLabel}>Ganhos hoje</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Corrida disponível</Text>
          <View style={styles.emptyBox}>
            <Ionicons name="bicycle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {available ? 'Procurando corridas...' : 'Nenhuma entrega no momento'}
            </Text>
            <Text style={styles.emptySub}>Modo demonstração — conecte o backend para receber corridas reais</Text>
          </View>
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
});
