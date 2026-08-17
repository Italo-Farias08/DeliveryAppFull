import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { publishRestaurant } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

function todayKey(iso: string) {
  return new Date(iso).toDateString();
}

// Ponto pulsante ao lado de "Loja aberta/fechada" — dá a sensação de status
// "ao vivo" no card de destaque, sem exagerar na animação.
function PulseDot({ color, active }: { color: string; active: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.9, duration: 1000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={styles.pulseDotWrap}>
      {active && (
        <Animated.View
          style={[
            styles.pulseDotRing,
            {
              backgroundColor: color,
              transform: [{ scale }],
              opacity: scale.interpolate({ inputRange: [1, 1.9], outputRange: [0.55, 0] }),
            },
          ]}
        />
      )}
      <View style={[styles.pulseDotCore, { backgroundColor: color }]} />
    </View>
  );
}

export default function RestaurantDashboardScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const { restaurant, orders, menuItems, refreshing, reload, savingStatus, handleToggleOpen, pendingCount, setRestaurant } =
    useRestaurantPanel();
  const [publishing, setPublishing] = useState(false);

  if (!restaurant) return null;

  // "Estou pronto" -- só funciona com cardápio preenchido; o backend
  // recusa (400) e devolve uma mensagem explicando isso, que a gente
  // simplesmente repassa pro dono num alerta.
  async function handlePublish() {
    setPublishing(true);
    try {
      const updated = await publishRestaurant(restaurant!.id);
      setRestaurant(updated);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível publicar sua loja agora. Tente de novo em instantes.';
      Alert.alert('Não foi possível publicar', message);
    } finally {
      setPublishing(false);
    }
  }

  const todayStr = new Date().toDateString();
  const ordersToday = orders.filter((o) => todayKey(o.createdAt) === todayStr);
  const revenueToday = ordersToday
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <RestaurantScreenLayout title={restaurant.name} subtitle="Painel do restaurante" active="Dashboard">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.primary} />}
      >
        {restaurant.isPublished === false && (
          <View style={styles.publishBanner}>
            <View style={styles.publishIconWrap}>
              <Ionicons name="eye-off-outline" size={20} color="#8A5A00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.publishTitle}>Sua loja ainda não aparece pros clientes</Text>
              <Text style={styles.publishSub}>
                {menuItems.length === 0
                  ? 'Adicione pelo menos um item ao cardápio pra poder publicar.'
                  : 'Cardápio pronto! Quando quiser, publique pra começar a receber pedidos.'}
              </Text>
              <PressableScale
                style={[styles.publishBtn, (publishing || menuItems.length === 0) && { opacity: 0.5 }]}
                onPress={menuItems.length === 0 ? () => navigation.navigate('Menu') : handlePublish}
                disabled={publishing}
                scaleTo={0.96}
              >
                <Text style={styles.publishBtnText}>
                  {menuItems.length === 0
                    ? 'Ir pro cardápio'
                    : publishing
                    ? 'Publicando...'
                    : 'Estou pronto, publicar loja'}
                </Text>
              </PressableScale>
            </View>
          </View>
        )}

        <FadeSlideIn index={0} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>STATUS DA LOJA</Text>
              <View style={styles.heroStatusRow}>
                <PulseDot
                  color={(restaurant.isOpenNow ?? restaurant.isOpen) ? colors.secondary : 'rgba(255,255,255,0.55)'}
                  active={restaurant.isOpenNow ?? restaurant.isOpen}
                />
                <Text style={styles.heroStatusTitle}>
                  {(restaurant.isOpenNow ?? restaurant.isOpen) ? 'Aberta agora' : 'Fechada'}
                </Text>
              </View>
              <Text style={styles.heroStatusSub}>
                {!restaurant.isOpen
                  ? 'Clientes não podem pedir agora'
                  : restaurant.isOpenNow === false
                  ? 'Fora do horário programado de hoje'
                  : 'Você está recebendo pedidos'}
              </Text>
            </View>
            <Switch
              value={restaurant.isOpen}
              onValueChange={handleToggleOpen}
              disabled={savingStatus}
              trackColor={{ true: 'rgba(255,255,255,0.55)', false: 'rgba(255,255,255,0.25)' }}
              thumbColor={colors.white}
              ios_backgroundColor="rgba(255,255,255,0.25)"
            />
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconWrap}>
                <Ionicons name="receipt-outline" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.heroStatValue}>{ordersToday.length}</Text>
                <Text style={styles.heroStatLabel}>Pedidos hoje</Text>
              </View>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconWrap}>
                <Ionicons name="cash-outline" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.heroStatValue}>R$ {revenueToday.toFixed(2)}</Text>
                <Text style={styles.heroStatLabel}>Faturamento hoje</Text>
              </View>
            </View>
          </View>
        </FadeSlideIn>

        <View style={styles.shortcutsGrid}>
          <FadeSlideIn index={1} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Orders')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                {pendingCount > 0 && (
                  <View style={styles.shortcutBadge}>
                    <Text style={styles.shortcutBadgeText}>{pendingCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.shortcutTitle}>Pedidos</Text>
              <Text style={styles.shortcutSub}>{pendingCount > 0 ? `${pendingCount} novo${pendingCount > 1 ? 's' : ''}` : 'Ver tudo'}</Text>
            </PressableScale>
          </FadeSlideIn>

          <FadeSlideIn index={2} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Sales')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.shortcutTitle}>Vendas</Text>
              <Text style={styles.shortcutSub}>Faturamento e histórico</Text>
            </PressableScale>
          </FadeSlideIn>

          <FadeSlideIn index={3} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Menu')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.shortcutTitle}>Cardápio</Text>
              <Text style={styles.shortcutSub}>{menuItems.length} {menuItems.length === 1 ? 'item' : 'itens'}</Text>
            </PressableScale>
          </FadeSlideIn>

          <FadeSlideIn index={4} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Location')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.shortcutTitle}>Localização</Text>
              <Text style={styles.shortcutSub}>{restaurant.street ? 'Endereço salvo' : 'Adicionar endereço'}</Text>
            </PressableScale>
          </FadeSlideIn>

          <FadeSlideIn index={5} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Hours')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.shortcutTitle}>Horário</Text>
              <Text style={styles.shortcutSub}>Funcionamento por dia</Text>
            </PressableScale>
          </FadeSlideIn>

          <FadeSlideIn index={6} style={styles.shortcutCardWrap}>
            <PressableScale style={styles.shortcutCard} onPress={() => navigation.navigate('Settings')} scaleTo={0.95}>
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="settings-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.shortcutTitle}>Configuração</Text>
              <Text style={styles.shortcutSub}>Fotos e dados da loja</Text>
            </PressableScale>
          </FadeSlideIn>
        </View>
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  publishBanner: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#FFF6E5', borderRadius: 18, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F5D68A',
  },
  publishIconWrap: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#FCE9BE',
    alignItems: 'center', justifyContent: 'center',
  },
  publishTitle: { ...typography.bodyBold, color: '#5C3B00', fontSize: 14 },
  publishSub: { color: '#8A5A00', fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  publishBtn: {
    backgroundColor: '#8A5A00', borderRadius: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 10,
  },
  publishBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 10.5, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroStatusTitle: { fontSize: 19, fontWeight: '800', color: colors.white },
  heroStatusSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 18 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStatIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: colors.white },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 1 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  pulseDotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  pulseDotRing: { position: 'absolute', width: 11, height: 11, borderRadius: 5.5 },
  pulseDotCore: { width: 8, height: 8, borderRadius: 4 },

  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  shortcutCardWrap: { width: '47%' },
  shortcutCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16,
    ...shadows.sm,
  },
  shortcutIconWrap: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  shortcutBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  shortcutBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  shortcutTitle: { ...typography.bodyBold, color: colors.text, fontSize: 14.5 },
  shortcutSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
});
};