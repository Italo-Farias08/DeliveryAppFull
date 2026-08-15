import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { TenantOrder } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Só "entregue" é venda de fato concluída — pedido pendente/em preparo ainda
// pode ser cancelado, então não entra na conta de faturamento do período.
function isCompletedSale(o: TenantOrder) {
  return o.status === 'entregue';
}

function formatMoney(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatCompact(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return v.toFixed(0);
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Period = 'week' | 'month' | 'all';

interface Bucket {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  ordersCount: number;
}

function buildBuckets(period: Period, orders: TenantOrder[]): Bucket[] {
  const completed = orders.filter(isCompletedSale);
  const now = new Date();

  if (period === 'week') {
    const buckets: Bucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayKey = d.toDateString();
      buckets.push({
        key: dayKey,
        label: WEEKDAY_LABELS[d.getDay()],
        fullLabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: 0,
        ordersCount: 0,
      });
    }
    for (const o of completed) {
      const dayKey = new Date(o.createdAt).toDateString();
      const bucket = buckets.find((b) => b.key === dayKey);
      if (bucket) {
        bucket.revenue += Number(o.total);
        bucket.ordersCount += 1;
      }
    }
    return buckets;
  }

  if (period === 'month') {
    // Semanas do mês corrente (semana 1 = dias 1-7, etc.)
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil(lastDay / 7);
    const buckets: Bucket[] = Array.from({ length: weekCount }, (_, i) => ({
      key: `w${i}`,
      label: `S${i + 1}`,
      fullLabel: `Semana ${i + 1} (dia ${i * 7 + 1}–${Math.min(lastDay, i * 7 + 7)})`,
      revenue: 0,
      ordersCount: 0,
    }));
    for (const o of completed) {
      const d = new Date(o.createdAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const weekIdx = Math.floor((d.getDate() - 1) / 7);
      buckets[weekIdx].revenue += Number(o.total);
      buckets[weekIdx].ordersCount += 1;
    }
    return buckets;
  }

  // 'all' -> últimos 6 meses
  const buckets: Bucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      fullLabel: `${MONTH_LABELS[d.getMonth()]}/${d.getFullYear()}`,
      revenue: 0,
      ordersCount: 0,
    });
  }
  for (const o of completed) {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) {
      bucket.revenue += Number(o.total);
      bucket.ordersCount += 1;
    }
  }
  return buckets;
}

function periodRangeStart(period: Period, now: Date): Date {
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), now.getMonth() - 5, 1);
}

const CHART_HEIGHT = 120;

function BarChart({ buckets }: { buckets: Bucket[] }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  return (
    <View style={styles.chartRow}>
      {buckets.map((b) => {
        const h = b.revenue > 0 ? Math.max(6, (b.revenue / max) * CHART_HEIGHT) : 3;
        return (
          <View key={b.key} style={styles.chartCol}>
            <Text style={styles.chartValue} numberOfLines={1}>
              {b.revenue > 0 ? formatCompact(b.revenue) : ''}
            </Text>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBar,
                  { height: h, backgroundColor: b.revenue > 0 ? colors.primary : colors.border },
                ]}
              />
            </View>
            <Text style={styles.chartLabel} numberOfLines={1}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function RestaurantSalesScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { orders, refreshing, reload } = useRestaurantPanel();
  const [period, setPeriod] = useState<Period>('week');

  const buckets = useMemo(() => buildBuckets(period, orders), [period, orders]);

  const { totalRevenue, ordersCount, avgTicket, topItems } = useMemo(() => {
    const now = new Date();
    const start = periodRangeStart(period, now);
    const inRange = orders.filter((o) => isCompletedSale(o) && new Date(o.createdAt) >= start);
    const revenue = inRange.reduce((sum, o) => sum + Number(o.total), 0);
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of inRange) {
      for (const it of o.items) {
        const entry = itemMap.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        entry.qty += it.qty;
        entry.revenue += it.qty * Number(it.price);
        itemMap.set(it.name, entry);
      }
    }
    const items = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    return {
      totalRevenue: revenue,
      ordersCount: inRange.length,
      avgTicket: inRange.length > 0 ? revenue / inRange.length : 0,
      topItems: items,
    };
  }, [orders, period]);

  const sortedBuckets = [...buckets].reverse();

  return (
    <RestaurantScreenLayout title="Vendas" subtitle="Registro de faturamento" active="Sales">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.primary} />}
      >
        <View style={styles.tabsRow}>
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Últimos 6 meses'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{formatMoney(totalRevenue)}</Text>
            <Text style={styles.statLabel}>Faturamento</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{ordersCount}</Text>
            <Text style={styles.statLabel}>Pedidos entregues</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{formatMoney(avgTicket)}</Text>
            <Text style={styles.statLabel}>Ticket médio</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Faturamento por período</Text>
          <BarChart buckets={buckets} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registro detalhado</Text>
          {sortedBuckets.every((b) => b.ordersCount === 0) ? (
            <Text style={styles.emptyText}>Nenhuma venda concluída nesse período ainda.</Text>
          ) : (
            sortedBuckets.map((b) => (
              <View key={b.key} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyLabel}>{b.fullLabel}</Text>
                  <Text style={styles.historySub}>
                    {b.ordersCount} {b.ordersCount === 1 ? 'pedido' : 'pedidos'}
                  </Text>
                </View>
                <Text style={styles.historyValue}>{formatMoney(b.revenue)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mais vendidos no período</Text>
          {topItems.length === 0 ? (
            <Text style={styles.emptyText}>Sem itens vendidos nesse período ainda.</Text>
          ) : (
            topItems.map((it, idx) => (
              <View key={it.name} style={styles.historyRow}>
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyLabel}>{it.name}</Text>
                  <Text style={styles.historySub}>{it.qty} vendidos</Text>
                </View>
                <Text style={styles.historyValue}>{formatMoney(it.revenue)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Esses números são de faturamento (o que entrou em vendas). Pra calcular lucro de verdade seria
            preciso cadastrar o custo de cada item — se quiser, posso te ajudar a adicionar isso depois.
          </Text>
        </View>
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  tabsRow: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  tabTextActive: { color: colors.white },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  statValue: { ...typography.bodyBold, color: colors.text, fontSize: 14.5, marginTop: 2 },
  statLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, fontSize: 14.5, marginBottom: 14 },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_HEIGHT + 40 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartValue: { fontSize: 9, color: colors.textMuted, fontWeight: '700' },
  chartBarTrack: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  chartBar: { width: 16, borderRadius: 6 },
  chartLabel: { fontSize: 10.5, color: colors.textMuted, fontWeight: '600', marginTop: 2 },

  emptyText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  historyLabel: { ...typography.bodyBold, color: colors.text, fontSize: 13.5 },
  historySub: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  historyValue: { ...typography.bodyBold, color: colors.primary, fontSize: 13.5 },
  rankCircle: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: colors.primary, fontSize: 11.5, fontWeight: '800' },

  infoBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.background, borderRadius: 14,
    padding: 12, marginTop: 16, borderWidth: 1, borderColor: colors.border,
  },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
});
};