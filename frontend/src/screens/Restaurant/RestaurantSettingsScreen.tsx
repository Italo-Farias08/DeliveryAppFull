import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useAuth } from '../../context/AuthContext';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { deleteAccount } from '../../services/userService';
import { RestaurantInput, updateRestaurant } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { pickImageFromLibrary } from '../../utils/pickImage';

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { value: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
];

export default function RestaurantSettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const styles = createStyles(colors);
  const { user, signOut } = useAuth();
  const {
    restaurant,
    setRestaurant,
    categories,
    refreshing,
    reload,
    uploadingLogo,
    uploadingBanner,
    handlePickRestaurantLogo,
    handlePickRestaurantBanner,
  } = useRestaurantPanel();

  const [editingData, setEditingData] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  async function handleConfirmDelete(password: string) {
    await deleteAccount(password);
    await signOut();
  }
  const [name, setName] = useState(restaurant?.name || '');
  const [categoryId, setCategoryId] = useState<string | null>(restaurant?.categoryId || null);
  const [fee, setFee] = useState(restaurant ? String(restaurant.deliveryFee) : '');
  const [minOrder, setMinOrder] = useState(restaurant ? String(restaurant.minOrderValue ?? 0) : '');
  const [min, setMin] = useState(restaurant ? String(restaurant.deliveryTimeMin) : '');
  const [max, setMax] = useState(restaurant ? String(restaurant.deliveryTimeMax) : '');

  if (!restaurant) return null;

  async function handlePickLogo() {
    const picked = await pickImageFromLibrary([1, 1]);
    if (picked) handlePickRestaurantLogo(picked);
  }

  async function handlePickBanner() {
    const picked = await pickImageFromLibrary([16, 9]);
    if (picked) handlePickRestaurantBanner(picked);
  }

  function startEditData() {
    if (!restaurant) return;
    setName(restaurant.name);
    setCategoryId(restaurant.categoryId);
    setFee(String(restaurant.deliveryFee));
    setMinOrder(String(restaurant.minOrderValue ?? 0));
    setMin(String(restaurant.deliveryTimeMin));
    setMax(String(restaurant.deliveryTimeMax));
    setEditingData(true);
  }

  async function handleSaveData() {
    if (!restaurant) return;
    if (!name.trim() || !categoryId) {
      Alert.alert('Preencha os campos', 'Nome e categoria são obrigatórios.');
      return;
    }
    const feeNum = Number(fee.replace(',', '.'));
    const minOrderNum = Number((minOrder || '0').replace(',', '.'));
    const minNum = parseInt(min, 10);
    const maxNum = parseInt(max, 10);
    if (Number.isNaN(feeNum) || feeNum < 0) {
      Alert.alert('Taxa inválida', 'Informe uma taxa de entrega válida.');
      return;
    }
    if (Number.isNaN(minOrderNum) || minOrderNum < 0) {
      Alert.alert('Pedido mínimo inválido', 'Informe um valor mínimo de pedido válido (ou 0 para não ter mínimo).');
      return;
    }
    if (!minNum || !maxNum || minNum <= 0 || maxNum <= 0) {
      Alert.alert('Tempo inválido', 'Informe o tempo mínimo e máximo de entrega.');
      return;
    }
    setSavingData(true);
    try {
      const payload: RestaurantInput = {
        name: name.trim(),
        categoryId,
        deliveryFee: feeNum,
        minOrderValue: minOrderNum,
        deliveryTimeMin: minNum,
        deliveryTimeMax: maxNum,
        isOpen: restaurant.isOpen,
      };
      const updated = await updateRestaurant(restaurant.id, payload);
      setRestaurant(updated);
      setEditingData(false);
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingData(false);
    }
  }

  const categoryName = categories.find((c) => c.id === restaurant.categoryId)?.name;

  return (
    <RestaurantScreenLayout title="Configuração" subtitle="Fotos e dados da loja" active="Settings">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.primary} />}
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="images-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Fotos da loja</Text>
          </View>
          <View style={styles.photosRow}>
            <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} activeOpacity={0.85}>
              {restaurant.image ? (
                <Image source={{ uri: restaurant.image }} style={styles.logoImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.logoImage, styles.imagePlaceholder]}>
                  <Ionicons name="storefront-outline" size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.editBadge}>
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.white} />
                )}
              </View>
              <Text style={styles.photoCaption}>Logo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bannerPicker} onPress={handlePickBanner} activeOpacity={0.85}>
              {restaurant.banner ? (
                <Image source={{ uri: restaurant.banner }} style={styles.bannerImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.bannerImage, styles.imagePlaceholder]}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.imagePlaceholderText}>Banner da loja</Text>
                </View>
              )}
              <View style={styles.editBadge}>
                {uploadingBanner ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.white} />
                )}
              </View>
              <Text style={styles.photoCaption}>Banner</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            A logo aparece nos cards da sua loja. O banner é a foto de capa que o cliente vê ao abrir seu restaurante.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="storefront-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0, flex: 1 }]}>Dados do restaurante</Text>
            {!editingData && (
              <TouchableOpacity style={styles.editBtn} onPress={startEditData}>
                <Ionicons name="pencil-outline" size={15} color={colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {!editingData ? (
            <View style={{ gap: 10 }}>
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>Nome</Text>
                <Text style={styles.dataRowValue}>{restaurant.name}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>Categoria</Text>
                <Text style={styles.dataRowValue}>{categoryName || '—'}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>Taxa de entrega</Text>
                <Text style={styles.dataRowValue}>R$ {Number(restaurant.deliveryFee).toFixed(2)}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>Pedido mínimo</Text>
                <Text style={styles.dataRowValue}>
                  {Number(restaurant.minOrderValue || 0) > 0
                    ? `R$ ${Number(restaurant.minOrderValue).toFixed(2)}`
                    : 'Sem mínimo'}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataRowLabel}>Tempo de entrega</Text>
                <Text style={styles.dataRowValue}>{restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} min</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome do restaurante" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.pillsWrap}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={[styles.pill, categoryId === c.id && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, categoryId === c.id && styles.pillTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Taxa de entrega (R$)</Text>
              <TextInput style={styles.input} value={fee} onChangeText={setFee} placeholder="Ex: 6.90" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

              <Text style={styles.label}>Pedido mínimo (R$)</Text>
              <TextInput
                style={styles.input}
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="0 = sem valor mínimo"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tempo mín. (min)</Text>
                  <TextInput style={styles.input} value={min} onChangeText={setMin} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tempo máx. (min)</Text>
                  <TextInput style={styles.input} value={max} onChangeText={setMax} keyboardType="number-pad" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditingData(false)}>
                  <Text style={styles.outlineBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtnSmall, { flex: 2 }, savingData && { opacity: 0.6 }]}
                  onPress={handleSaveData}
                  disabled={savingData}
                >
                  {savingData ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="person-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Conta</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataRowLabel}>Nome</Text>
            <Text style={styles.dataRowValue}>{user?.name}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataRowLabel}>E-mail</Text>
            <Text style={styles.dataRowValue}>{user?.email}</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 8, fontSize: 13 }]}>Aparência</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = mode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  activeOpacity={0.8}
                  onPress={() => setMode(opt.value)}
                >
                  <Ionicons name={opt.icon} size={17} color={active ? colors.white : colors.textMuted} />
                  <Text style={[styles.themeOptionLabel, active && styles.themeOptionLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.signOutRow} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteRow} onPress={() => setDeleteModalVisible(true)}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Excluir conta do restaurante</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        consequences={[
          'Sua loja sai do ar e some da busca do cliente na hora.',
          'Novos pedidos deixam de ser aceitos, mas o histórico de vendas é preservado.',
          'Seus dados pessoais de acesso serão apagados e não será possível desfazer.',
        ]}
      />
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconCircle: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 12 },
  editBtn: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  photosRow: { flexDirection: 'row', gap: 14 },
  logoPicker: { alignItems: 'center', gap: 6 },
  logoImage: { width: 68, height: 68, borderRadius: 18 },
  bannerPicker: { flex: 1, alignItems: 'center', gap: 6 },
  bannerImage: { width: '100%', height: 68, borderRadius: 18 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.border },
  imagePlaceholderText: { fontSize: 10.5, color: colors.textMuted, fontWeight: '600' },
  editBadge: {
    position: 'absolute', bottom: 20, right: -4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  photoCaption: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  helperText: { color: colors.textMuted, fontSize: 11.5, marginTop: 12, lineHeight: 16 },

  dataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dataRowLabel: { color: colors.textMuted, fontSize: 13 },
  dataRowValue: { color: colors.text, fontSize: 13.5, fontWeight: '700' },

  label: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.background,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },

  outlineBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700' },
  primaryBtnSmall: {
    backgroundColor: colors.primary, borderRadius: 14, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.background, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  themeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  themeOptionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  themeOptionLabelActive: { color: colors.white },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 13.5 },
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  deleteText: { color: colors.danger, fontWeight: '600', fontSize: 12 },
});
};
