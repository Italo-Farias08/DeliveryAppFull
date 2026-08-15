import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestPasswordReset, resetPassword } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRequestCode() {
    if (!email.trim()) {
      Alert.alert('Ops', 'Digite seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setStep('reset');
      Alert.alert(
        'Verifique seu e-mail',
        `Se ${email.trim()} estiver cadastrado, enviamos um código de 6 dígitos para redefinir a senha.`
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (code.trim().length !== 6) {
      Alert.alert('Ops', 'Digite o código de 6 dígitos enviado para seu e-mail.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Ops', 'A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ops', 'As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      Alert.alert('Senha redefinida', 'Sua senha foi alterada. Faça login com a nova senha.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Código inválido ou expirado. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Recuperar senha</Text>

          {step === 'email' ? (
            <>
              <Text style={styles.subtitle}>
                Digite o e-mail da sua conta. Vamos enviar um código de 6 dígitos para redefinir sua senha.
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <TouchableOpacity style={styles.button} onPress={handleRequestCode} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Enviar código</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Enviamos um código para {email.trim()}. Digite o código e escolha sua nova senha.
              </Text>

              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { letterSpacing: 4, fontSize: 18 }]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Nova senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar nova senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Redefinir senha</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRequestCode} disabled={loading} style={{ marginTop: 14 }}>
                <Text style={styles.link}>Reenviar código</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.display, color: colors.text, fontSize: 26, marginTop: 12, marginBottom: 10 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 22, lineHeight: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: colors.border, width: '100%', marginBottom: 14,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  button: {
    height: 54, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
});
};
