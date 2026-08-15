import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { getDelivererInviteCode, removeOwnDeliverer } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Entregadores "da casa": exclusivos deste restaurante. Diferente do
// entregador autônomo (que pega corridas de qualquer loja pelo radar),
// esse aqui só recebe pedidos daqui, direto, sem passar pelo radar.
export default function RestaurantDeliverersScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { ownDeliverers, reloadOwnDeliverers, refreshing } = useRestaurantPanel();
  const [code, setCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    getDelivererInviteCode()
      .then(setCode)
      .catch(() => Alert.alert('Erro', 'Não foi possível carregar o código de convite.'))
      .finally(() => setLoadingCode(false));
    reloadOwnDeliverers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopyCode() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copiado!', 'Código copiado — agora é só mandar pro seu entregador.');
  }

  async function handleShareCode() {
    if (!code) return;
    try {
      await Share.share({
        message: `Pra ser meu entregador no app, se cadastre como entregador e use o código: ${code}`,
      });
    } catch {
      // usuário cancelou o compartilhamento, tudo bem
    }
  }

  function handleRemove(id: string, name: string) {
    Alert.alert('Remover entregador', `${name} deixa de ser um entregador da sua loja e volta a ser autônomo. Continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(id);
          try {
            await removeOwnDeliverer(id);
            await reloadOwnDeliverers();
          } catch {
            Alert.alert('Erro', 'Não foi possível remover esse entregador.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  }

  return (
    <RestaurantScreenLayout title="Meus entregadores" subtitle="Entregadores exclusivos da sua loja" active="Deliverers">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadOwnDeliverers} />}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="bicycle-outline" size={16} color={colors.secondary} />
          <Text style={styles.infoBannerText}>
            Um entregador da casa recebe os pedidos direto de você, sem passar pelo radar de entregadores autônomos.
            Na hora de marcar um pedido como pronto, você escolhe entre "Chamar entregador" (radar) ou "Usar meu
            entregador" (aqui da lista).
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Código de convite</Text>
        <View style={styles.codeCard}>
          {loadingCode ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.codeText}>{code}</Text>
              <Text style={styles.codeHint}>
                Peça pro seu entregador se cadastrar no app como "Entregador" e colar esse código no cadastro — ele já
                fica vinculado à sua loja automaticamente.
              </Text>
              <View style={styles.codeActions}>
                <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
                  <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  <Text style={styles.codeBtnText}>Copiar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.codeBtn} onPress={handleShareCode}>
                  <Ionicons name="share-social-outline" size={15} color={colors.primary} />
                  <Text style={styles.codeBtnText}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Entregadores vinculados</Text>
        {ownDeliverers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bicycle-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum entregador vinculado ainda.</Text>
            <Text style={styles.emptySub}>Compartilhe o código acima com quem entrega por você.</Text>
          </View>
        ) : (
          ownDeliverers.map((d) => (
            <View key={d.id} style={styles.delivererCard}>
              <View style={[styles.statusDot, { backgroundColor: d.isAvailable ? colors.secondary : colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.delivererName}>{d.name}</Text>
                <Text style={styles.delivererSub}>
                  {d.isAvailable ? 'Disponível agora' : 'Indisponível'}
                  {d.vehicleType ? ` · ${d.vehicleType}` : ''}
                  {d.phone ? ` · ${d.phone}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(d.id, d.name)}
                disabled={removingId === d.id}
              >
                {removingId === d.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 12, marginBottom: 20,
  },
  infoBannerText: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 17 },

  sectionTitle: { ...typography.bodyBold, color: colors.text, fontSize: 14, marginBottom: 10 },

  codeCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 24,
  },
  codeText: { fontSize: 30, fontWeight: '800', letterSpacing: 6, color: colors.primary },
  codeHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  codeActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  codeBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 6 },
  emptyText: { color: colors.text, fontWeight: '700', marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center' },

  delivererCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  delivererName: { ...typography.bodyBold, color: colors.text, fontSize: 14.5 },
  delivererSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 4 },
});
};
