import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { getRestaurantHours, setRestaurantHours } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { RestaurantHours } from '../../types';

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Horário padrão sugerido pra dia que ainda não foi configurado -- o dono
// só ajusta o que for diferente, em vez de preencher tudo do zero.
function defaultDays(): RestaurantHours[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    closed: dayOfWeek === 0, // domingo fechado por padrão, só um chute razoável
    openTime: '08:00',
    closeTime: '18:00',
  }));
}

// Digita só números; a gente insere o ":" sozinho depois do 2º dígito, tipo
// "0800" -> "08:00", pra não depender de um picker nativo separado.
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <TextInput
      style={styles.timeInput}
      value={value}
      onChangeText={(t) => onChange(formatTimeInput(t))}
      placeholder="00:00"
      placeholderTextColor={colors.textMuted}
      keyboardType="number-pad"
      maxLength={5}
    />
  );
}

export default function RestaurantHoursScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { restaurant } = useRestaurantPanel();
  const [days, setDays] = useState<RestaurantHours[]>(defaultDays());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    getRestaurantHours(restaurant.id)
      .then((saved) => {
        if (saved.length === 7) {
          setDays([...saved].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
        }
        // menos que 7 dias salvos = restaurante nunca configurou agenda
        // ainda -- mantém os padrões sugeridos, é mais rápido pro dono
        // só ajustar do que preencher os 7 do zero.
      })
      .finally(() => setLoading(false));
  }, [restaurant?.id]);

  if (!restaurant) return null;

  function updateDay(dayOfWeek: number, patch: Partial<RestaurantHours>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  }

  // Atalho: copia o horário de um dia pros outros 6, pra não precisar
  // digitar a mesma coisa sete vezes quando o restaurante funciona igual
  // todo dia.
  function applyToAllDays(dayOfWeek: number) {
    const source = days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!source) return;
    setDays((prev) => prev.map((d) => ({ ...d, closed: source.closed, openTime: source.openTime, closeTime: source.closeTime })));
  }

  async function handleSave() {
    for (const day of days) {
      if (!day.closed) {
        const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(day.openTime || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(day.closeTime || '');
        if (!valid) {
          Alert.alert('Horário inválido', `Confira o horário de ${DAY_NAMES[day.dayOfWeek]} -- use o formato HH:MM.`);
          return;
        }
        if ((day.openTime || '') >= (day.closeTime || '')) {
          Alert.alert('Horário inválido', `Em ${DAY_NAMES[day.dayOfWeek]}, o fechamento precisa ser depois da abertura.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await setRestaurantHours(restaurant!.id, days);
      Alert.alert('Pronto', 'Horário de funcionamento salvo.');
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível salvar o horário agora. Tente de novo.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <RestaurantScreenLayout title="Horário de funcionamento" subtitle={restaurant.name} active="Hours">
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              O botão "Aberta/Fechada" no início continua funcionando como uma chave geral. Com essa agenda preenchida,
              sua loja só aparece como aberta pros clientes dentro do horário de cada dia.
            </Text>
          </View>

          {days.map((day) => (
            <View key={day.dayOfWeek} style={styles.dayCard}>
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayName}>{DAY_NAMES[day.dayOfWeek]}</Text>
                <View style={styles.dayHeaderRight}>
                  <Text style={styles.dayToggleLabel}>{day.closed ? 'Fechado' : 'Aberto'}</Text>
                  <Switch
                    value={!day.closed}
                    onValueChange={(open) => updateDay(day.dayOfWeek, { closed: !open })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>

              {!day.closed && (
                <View style={styles.timesRow}>
                  <View style={styles.timeGroup}>
                    <Text style={styles.timeLabel}>Abre</Text>
                    <TimeField value={day.openTime || ''} onChange={(v) => updateDay(day.dayOfWeek, { openTime: v })} />
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={colors.textMuted} style={{ marginTop: 16 }} />
                  <View style={styles.timeGroup}>
                    <Text style={styles.timeLabel}>Fecha</Text>
                    <TimeField value={day.closeTime || ''} onChange={(v) => updateDay(day.dayOfWeek, { closeTime: v })} />
                  </View>
                  <TouchableOpacity style={styles.applyAllBtn} onPress={() => applyToAllDays(day.dayOfWeek)} hitSlop={8}>
                    <Ionicons name="copy-outline" size={13} color={colors.primary} />
                    <Text style={styles.applyAllText}>Aplicar a todos</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Salvar horário</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBox: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: 12, marginBottom: 18,
  },
  infoText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17 },

  dayCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10,
    ...shadows.sm,
  },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { ...typography.bodyBold, color: colors.text, fontSize: 14 },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayToggleLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },

  timesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  timeGroup: { alignItems: 'center' },
  timeLabel: { fontSize: 10.5, color: colors.textMuted, fontWeight: '700', marginBottom: 4 },
  timeInput: {
    ...shadows.sm, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    width: 68, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.text,
    backgroundColor: colors.background,
  },
  applyAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  applyAllText: { color: colors.primary, fontSize: 11.5, fontWeight: '700' },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 14.5 },
});
};