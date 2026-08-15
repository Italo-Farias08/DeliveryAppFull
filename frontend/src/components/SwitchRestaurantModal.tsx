import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  visible: boolean;
  currentRestaurantName?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Aviso animado (fade + scale com leve bounce) mostrado quando o cliente
// tenta adicionar um item de um restaurante diferente do que já está no
// carrinho. Antes disso o app trocava o carrinho em silêncio -- agora
// avisa e pede confirmação antes de apagar os itens antigos.
export default function SwitchRestaurantModal({ visible, currentRestaurantName, onCancel, onConfirm }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.85);
      iconRotate.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(iconRotate, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(iconRotate, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible]);

  const rotateDeg = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-12deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Animated.View style={[styles.iconCircle, { transform: [{ rotate: rotateDeg }] }]}>
            <Ionicons name="cart-outline" size={30} color={colors.primary} />
          </Animated.View>

          <Text style={styles.brand}>Vitória Delivery</Text>
          <Text style={styles.title}>Trocar de restaurante?</Text>
          <Text style={styles.message}>
            {currentRestaurantName
              ? `Seu carrinho tem itens do ${currentRestaurantName}. `
              : 'Seu carrinho tem itens de outro restaurante. '}
            Se continuar, esses itens serão removidos e um novo carrinho será iniciado aqui.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={styles.confirmText}>Trocar mesmo assim</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brand: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: 8 },
  message: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  confirmText: { color: colors.white, fontWeight: '700', fontSize: 13.5 },
});
};