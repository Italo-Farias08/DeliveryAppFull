import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';

const CONFIRM_WORD = 'EXCLUIR';

interface Props {
  visible: boolean;
  onClose: () => void;
  // Executa a exclusão de fato (chama o backend). Deve rejeitar a Promise
  // em caso de erro (ex: senha incorreta) com uma mensagem legível.
  onConfirm: (password: string) => Promise<void>;
  // Frase(s) extra explicando o que se perde, específica de cada tipo de
  // conta (cliente / restaurante / entregador).
  consequences: string[];
}

// Tela de confirmação de exclusão de conta, usada por cliente, restaurante
// e entregador. Propositalmente tem VÁRIAS barreiras contra clique
// acidental: (1) precisa digitar a palavra "EXCLUIR" exatamente, (2)
// precisa confirmar a senha atual, (3) o botão final só acende quando as
// duas coisas acima estão certas, e (4) ainda mostra um Alert nativo de
// "tem certeza?" antes de chamar o backend.
export default function DeleteAccountModal({ visible, onClose, onConfirm, consequences }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordMatches = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  const canSubmit = wordMatches && password.length > 0 && !submitting;

  function resetAndClose() {
    setConfirmText('');
    setPassword('');
    setError(null);
    setSubmitting(false);
    onClose();
  }

  function handlePressDelete() {
    if (!canSubmit) return;
    Alert.alert(
      'Excluir conta de verdade?',
      'Essa ação não pode ser desfeita. Sua conta será encerrada permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]
    );
  }

  async function doDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(password);
      resetAndClose();
    } catch (err: any) {
      setSubmitting(false);
      setError(err?.response?.data?.error || 'Não foi possível excluir a conta. Tente novamente.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={{ width: '100%', alignItems: 'center' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={28} color={colors.danger} />
            </View>

            <Text style={styles.title}>Excluir minha conta</Text>
            <Text style={styles.subtitle}>Isso é permanente e não pode ser desfeito.</Text>

            <ScrollView style={styles.consequencesBox} contentContainerStyle={{ padding: 14 }}>
              {consequences.map((line, idx) => (
                <View key={idx} style={styles.consequenceRow}>
                  <Ionicons name="close-circle" size={15} color={colors.danger} style={{ marginTop: 1.5 }} />
                  <Text style={styles.consequenceText}>{line}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.label}>
              Para confirmar, digite <Text style={styles.labelStrong}>{CONFIRM_WORD}</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Confirme sua senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha atual"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose} activeOpacity={0.8} disabled={submitting}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
                onPress={handlePressDelete}
                activeOpacity={0.85}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>Excluir permanentemente</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FCE8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  consequencesBox: {
    width: '100%',
    maxHeight: 130,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  consequenceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  consequenceText: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 17 },
  label: { alignSelf: 'flex-start', color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  labelStrong: { color: colors.danger, fontWeight: '800' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 4,
  },
  errorText: { color: colors.danger, fontSize: 12.5, marginTop: 8, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 18 },
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
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  confirmBtnDisabled: { backgroundColor: colors.border },
  confirmText: { color: colors.white, fontWeight: '700', fontSize: 13.5 },
});
};
