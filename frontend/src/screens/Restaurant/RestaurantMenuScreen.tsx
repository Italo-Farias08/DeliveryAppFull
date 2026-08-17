import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import {
  AddonInput,
  MenuCategoryInput,
  MenuItemInput,
  PickedImage,
  createAddon,
  createMenuCategory,
  createMenuItem,
  deleteAddon,
  deleteMenuCategory,
  deleteMenuItem,
  listAddons,
  updateAddon,
  updateMenuItem,
  uploadMenuItemImage,
} from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { Addon, MenuCategory, MenuItem } from '../../types';
import { pickImageFromLibrary } from '../../utils/pickImage';

export default function RestaurantMenuScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const {
    restaurant,
    menuItems,
    setMenuItems,
    menuCategories,
    setMenuCategories,
    refreshing,
    reload,
  } = useRestaurantPanel();

  const [activeMenuCategoryId, setActiveMenuCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // modal de item do cardápio
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [miName, setMiName] = useState('');
  const [miDescription, setMiDescription] = useState('');
  const [miPrice, setMiPrice] = useState('');
  // Foto do item: enquanto o item ainda não existe (criação), guardamos só a
  // URI local escolhida (miPickedImage) e mandamos pro servidor depois que o
  // item for criado. Em edição, o envio já acontece na hora que a foto é
  // escolhida, então miPickedImage fica sempre null nesse caso.
  const [miPickedImage, setMiPickedImage] = useState<PickedImage | null>(null);
  const [miImagePreview, setMiImagePreview] = useState<string | null>(null);
  const [miUploadingImage, setMiUploadingImage] = useState(false);
  const [miCategoryId, setMiCategoryId] = useState<string | null>(null);

  // adicionais do item que está sendo editado (ex: bacon extra, borda
  // recheada) — só existe pra item que já foi salvo (tem id)
  const [itemAddons, setItemAddons] = useState<Addon[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [savingAddon, setSavingAddon] = useState(false);

  if (!restaurant) return null;

  async function handlePickMenuItemImage() {
    const picked = await pickImageFromLibrary([4, 3]);
    if (!picked) return;

    if (editingItem) {
      // O item já existe no servidor: manda a foto na hora.
      setMiUploadingImage(true);
      try {
        const updated = await uploadMenuItemImage(editingItem.id, picked);
        setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setEditingItem(updated);
        setMiImagePreview(updated.image);
      } catch (err) {
        Alert.alert('Erro', 'Não foi possível enviar a foto do item.');
      } finally {
        setMiUploadingImage(false);
      }
    } else {
      // Item novo ainda não existe: guarda a foto escolhida e só envia
      // depois que o item for criado (ver handleSaveMenuItem).
      setMiPickedImage(picked);
      setMiImagePreview(picked.uri);
    }
  }

  function resetAddonForm() {
    setAddonName('');
    setAddonPrice('');
    setEditingAddonId(null);
  }

  function openCreateMenuModal() {
    setEditingItem(null);
    setMiName('');
    setMiDescription('');
    setMiPrice('');
    setMiPickedImage(null);
    setMiImagePreview(null);
    // se o dono já estava filtrando por uma categoria, o novo item já nasce nela
    setMiCategoryId(activeMenuCategoryId);
    setItemAddons([]);
    resetAddonForm();
    setMenuModalVisible(true);
  }

  function openEditMenuModal(item: MenuItem) {
    setEditingItem(item);
    setMiName(item.name);
    setMiDescription(item.description || '');
    setMiPrice(String(item.price));
    setMiPickedImage(null);
    setMiImagePreview(item.image || null);
    setMiCategoryId(item.categoryId || null);
    resetAddonForm();
    setMenuModalVisible(true);
    setLoadingAddons(true);
    listAddons(item.id)
      .then(setItemAddons)
      .catch(() => setItemAddons([]))
      .finally(() => setLoadingAddons(false));
  }

  function startEditAddon(addon: Addon) {
    setEditingAddonId(addon.id);
    setAddonName(addon.name);
    setAddonPrice(String(addon.price));
  }

  async function handleSaveAddon() {
    if (!editingItem) return;
    const name = addonName.trim();
    if (!name) {
      Alert.alert('Preencha o nome', 'O adicional precisa de um nome.');
      return;
    }
    const price = Number(addonPrice.replace(',', '.'));
    if (Number.isNaN(price) || price < 0) {
      Alert.alert('Preço inválido', 'Informe um preço válido (pode ser 0).');
      return;
    }
    const payload: AddonInput = { name, price };
    setSavingAddon(true);
    try {
      if (editingAddonId) {
        const updated = await updateAddon(editingAddonId, payload);
        setItemAddons((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAddon(editingItem.id, payload);
        setItemAddons((prev) => [...prev, created]);
      }
      resetAddonForm();
    } catch (err: any) {
      Alert.alert('Erro ao salvar adicional', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingAddon(false);
    }
  }

  function handleDeleteAddon(addon: Addon) {
    Alert.alert('Remover adicional', `Remover "${addon.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddon(addon.id);
            setItemAddons((prev) => prev.filter((a) => a.id !== addon.id));
            if (editingAddonId === addon.id) resetAddonForm();
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o adicional.');
          }
        },
      },
    ]);
  }

  async function handleSaveMenuItem() {
    if (!restaurant) return;
    if (!miName.trim()) {
      Alert.alert('Preencha o nome', 'O item precisa de um nome.');
      return;
    }
    const price = Number(miPrice.replace(',', '.'));
    if (Number.isNaN(price) || price <= 0) {
      Alert.alert('Preço inválido', 'Informe um preço válido para o item.');
      return;
    }
    const payload: MenuItemInput = {
      name: miName.trim(),
      description: miDescription.trim() || undefined,
      price,
      isAvailable: true,
      categoryId: miCategoryId,
    };
    setSavingItem(true);
    try {
      if (editingItem) {
        const updated = await updateMenuItem(editingItem.id, payload);
        setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        let created = await createMenuItem(restaurant.id, payload);
        if (miPickedImage) {
          try {
            created = await uploadMenuItemImage(created.id, miPickedImage);
          } catch (err) {
            Alert.alert('Item criado', 'O item foi salvo, mas a foto não pôde ser enviada. Edite o item para tentar de novo.');
          }
        }
        setMenuItems((prev) => [created, ...prev]);
      }
      setMenuModalVisible(false);
    } catch (err: any) {
      Alert.alert('Erro ao salvar item', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingItem(false);
    }
  }

  function handleDeleteMenuItem(item: MenuItem) {
    Alert.alert('Remover item', `Remover "${item.name}" do cardápio?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMenuItem(item.id);
            setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o item.');
          }
        },
      },
    ]);
  }

  async function handleCreateMenuCategory() {
    if (!restaurant) return;
    const name = newCategoryName.trim();
    if (!name) return;
    const payload: MenuCategoryInput = { name, sortOrder: menuCategories.length };
    setSavingCategory(true);
    try {
      const created = await createMenuCategory(restaurant.id, payload);
      setMenuCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch (err: any) {
      Alert.alert('Erro ao criar categoria', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingCategory(false);
    }
  }

  function handleDeleteMenuCategory(category: MenuCategory) {
    Alert.alert(
      'Remover categoria',
      `Remover "${category.name}"? Os itens dela continuam no cardápio, só ficam sem categoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenuCategory(category.id);
              setMenuCategories((prev) => prev.filter((c) => c.id !== category.id));
              setMenuItems((prev) =>
                prev.map((m) => (m.categoryId === category.id ? { ...m, categoryId: null } : m))
              );
              if (activeMenuCategoryId === category.id) setActiveMenuCategoryId(null);
            } catch {
              Alert.alert('Erro', 'Não foi possível remover a categoria.');
            }
          },
        },
      ]
    );
  }

  const filteredMenuItems = activeMenuCategoryId
    ? menuItems.filter((item) => item.categoryId === activeMenuCategoryId)
    : menuItems;

  return (
    <RestaurantScreenLayout
      title="Cardápio"
      subtitle={`${menuItems.length} ${menuItems.length === 1 ? 'item' : 'itens'}`}
      active="Menu"
      headerRight={
        <TouchableOpacity style={styles.headerAddBtn} onPress={openCreateMenuModal}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.primary} />}
      >
        <Text style={styles.label}>Categorias do cardápio</Text>
        <Text style={styles.helperText}>
          Crie categorias como Pizzas, Carnes ou Hambúrgueres. Elas aparecem como filtros para o
          cliente e ajudam a organizar seus itens.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
        >
          <TouchableOpacity
            style={[styles.pill, !activeMenuCategoryId && styles.pillActive]}
            onPress={() => setActiveMenuCategoryId(null)}
          >
            <Text style={[styles.pillText, !activeMenuCategoryId && styles.pillTextActive]}>Todos</Text>
          </TouchableOpacity>
          {menuCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.pill, styles.pillWithAction, activeMenuCategoryId === cat.id && styles.pillActive]}
              onPress={() => setActiveMenuCategoryId(cat.id)}
              onLongPress={() => handleDeleteMenuCategory(cat)}
            >
              <Text style={[styles.pillText, activeMenuCategoryId === cat.id && styles.pillTextActive]}>
                {cat.name}
              </Text>
              <TouchableOpacity hitSlop={8} onPress={() => handleDeleteMenuCategory(cat)}>
                <Ionicons
                  name="close-circle"
                  size={15}
                  color={activeMenuCategoryId === cat.id ? colors.white : colors.textMuted}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.addCategoryRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Nova categoria, ex: Pizzas"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={handleCreateMenuCategory}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addCategoryBtn, savingCategory && { opacity: 0.6 }]}
            onPress={handleCreateMenuCategory}
            disabled={savingCategory}
          >
            {savingCategory ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="add" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.menuBtn, { marginTop: 18 }]} activeOpacity={0.8} onPress={openCreateMenuModal}>
          <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
          <Text style={styles.menuBtnText}>Adicionar item ao cardápio</Text>
        </TouchableOpacity>

        {filteredMenuItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="restaurant-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>Nenhum item cadastrado</Text>
            <Text style={styles.emptySub}>
              {activeMenuCategoryId ? 'Nenhum item nesta categoria ainda' : 'Adicione o primeiro item do seu cardápio'}
            </Text>
          </View>
        ) : (
          filteredMenuItems.map((item) => {
            const itemCategory = menuCategories.find((c) => c.id === item.categoryId);
            return (
              <View key={item.id} style={styles.menuItemRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.menuItemThumb} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.menuItemThumb, styles.imagePlaceholder]}>
                    <Ionicons name="restaurant-outline" size={16} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.menuItemMetaRow}>
                    <Text style={styles.menuItemPrice}>R$ {Number(item.price).toFixed(2)}</Text>
                    {itemCategory && (
                      <View style={styles.menuItemCategoryTag}>
                        <Text style={styles.menuItemCategoryTagText}>{itemCategory.name}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.menuItemActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMenuModal(item)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteMenuItem(item)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={menuModalVisible} animationType="slide" transparent onRequestClose={() => setMenuModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingItem ? 'Editar item' : 'Novo item do cardápio'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMenuModalVisible(false)}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={miName} onChangeText={setMiName} placeholder="Ex: Cheeseburger Duplo" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput style={styles.input} value={miDescription} onChangeText={setMiDescription} placeholder="Ex: Dois blends, queijo cheddar" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Preço (R$)</Text>
              <TextInput style={styles.input} value={miPrice} onChangeText={setMiPrice} placeholder="Ex: 28.90" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

              {menuCategories.length > 0 && (
                <>
                  <Text style={styles.label}>Categoria</Text>
                  <View style={styles.pillsWrap}>
                    <TouchableOpacity
                      style={[styles.pill, !miCategoryId && styles.pillActive]}
                      onPress={() => setMiCategoryId(null)}
                    >
                      <Text style={[styles.pillText, !miCategoryId && styles.pillTextActive]}>Sem categoria</Text>
                    </TouchableOpacity>
                    {menuCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.pill, miCategoryId === cat.id && styles.pillActive]}
                        onPress={() => setMiCategoryId(cat.id)}
                      >
                        <Text style={[styles.pillText, miCategoryId === cat.id && styles.pillTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Foto do item (opcional)</Text>
              <TouchableOpacity style={styles.menuItemImagePicker} onPress={handlePickMenuItemImage} activeOpacity={0.85}>
                {miImagePreview ? (
                  <Image source={{ uri: miImagePreview }} style={styles.menuItemImagePreview} contentFit="cover" />
                ) : (
                  <View style={[styles.menuItemImagePreview, styles.imagePlaceholder]}>
                    <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemImagePickerText}>
                    {miImagePreview ? 'Trocar foto' : 'Escolher foto do item'}
                  </Text>
                  <Text style={styles.menuItemImagePickerSub}>Foto direto da galeria do celular</Text>
                </View>
                {miUploadingImage && <ActivityIndicator color={colors.secondary} />}
              </TouchableOpacity>

              {editingItem && (
                <>
                  <View style={styles.modalDivider} />
                  <Text style={styles.label}>Adicionais</Text>
                  {loadingAddons ? (
                    <ActivityIndicator color={colors.secondary} style={{ marginVertical: 10 }} />
                  ) : (
                    <>
                      {itemAddons.map((addon) => (
                        <View key={addon.id} style={styles.addonRow}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => startEditAddon(addon)}>
                            <Text style={styles.addonRowName}>{addon.name}</Text>
                            <Text style={styles.addonRowPrice}>+ R$ {addon.price.toFixed(2)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => startEditAddon(addon)}>
                            <Ionicons name="pencil" size={16} color={colors.secondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteAddon(addon)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {itemAddons.length === 0 && (
                        <Text style={styles.emptySub}>Nenhum adicional ainda. Ex: bacon extra, borda recheada.</Text>
                      )}

                      <View style={styles.addAddonRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={addonName}
                          onChangeText={setAddonName}
                          placeholder="Nome (ex: Bacon extra)"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={[styles.input, { width: 90 }]}
                          value={addonPrice}
                          onChangeText={setAddonPrice}
                          placeholder="R$"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        {editingAddonId && (
                          <TouchableOpacity style={styles.outlineBtn} onPress={resetAddonForm}>
                            <Text style={styles.outlineBtnText}>Cancelar</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.addCategoryBtn, { flex: 1, flexDirection: 'row', gap: 6 }, savingAddon && { opacity: 0.6 }]}
                          onPress={handleSaveAddon}
                          disabled={savingAddon}
                        >
                          {savingAddon ? (
                            <ActivityIndicator color={colors.white} />
                          ) : (
                            <>
                              <Ionicons name={editingAddonId ? 'checkmark' : 'add'} size={18} color={colors.white} />
                              <Text style={{ color: colors.white, fontWeight: '700', fontSize: 13 }}>
                                {editingAddonId ? 'Salvar adicional' : 'Adicionar'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setMenuModalVisible(false)}>
                  <Text style={styles.outlineBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingItem && { opacity: 0.6 }]}
                  onPress={handleSaveMenuItem}
                  disabled={savingItem}
                >
                  {savingItem ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerAddBtn: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 20, padding: 32,
    ...shadows.sm, marginTop: 16,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 16, marginBottom: 14,
  },
  menuBtnText: { color: colors.secondary, fontWeight: '700' },

  menuItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 10,
    ...shadows.sm,
  },
  menuItemThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.border },
  menuItemName: { ...typography.bodyBold, color: colors.text },
  menuItemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  menuItemPrice: { color: colors.secondary, fontSize: 13, fontWeight: '800' },
  menuItemCategoryTag: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  menuItemCategoryTagText: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  menuItemActions: { flexDirection: 'row', gap: 6 },

  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.border },
  helperText: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },

  menuItemImagePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10, marginTop: 4,
    backgroundColor: colors.background,
  },
  menuItemImagePreview: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.border },
  menuItemImagePickerText: { ...typography.bodyBold, color: colors.text, fontSize: 13.5 },
  menuItemImagePickerSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },

  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

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
  pillWithAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  addCategoryRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addCategoryBtn: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { ...typography.h2, color: colors.text },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  modalDivider: { height: 1, backgroundColor: colors.border, marginTop: 18, marginBottom: 4 },

  addonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: colors.surface,
  },
  addonRowName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  addonRowPrice: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  addAddonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
};
