import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  restaurantName: string;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
}

const STAR_HINTS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Ok',
  4: 'Bom',
  5: 'Excelente',
};

export default function RatingModal({ visible, onClose, restaurantName, onSubmit }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRating(0);
    setComment('');
  }

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert('Escolha uma nota', 'Toque nas estrelas pra avaliar o pedido antes de enviar.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim() || undefined);
      reset();
    } catch (err: any) {
      const message =
        err?.response?.status === 409
          ? 'Você já avaliou esse pedido.'
          : 'Não foi possível enviar sua avaliação. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} edges={['bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <Text style={styles.title}>Avaliar pedido</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Como foi seu pedido no {restaurantName}?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={38}
                    color={n <= rating ? '#F5A623' : colors.border}
                    style={{ marginHorizontal: 4 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && <Text style={styles.hintText}>{STAR_HINTS[rating]}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Quer contar mais alguma coisa? (opcional)"
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Enviar avaliação</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.h2, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13.5, marginTop: 6, marginBottom: 18 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  hintText: { textAlign: 'center', color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 18 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14,
    minHeight: 70, maxHeight: 120, color: colors.text, fontSize: 14, textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { color: colors.white, fontWeight: '700', fontSize: 14.5 },
});
};
