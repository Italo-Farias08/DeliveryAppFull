import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { register } from '../../services/authService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { UserRole } from '../../types';

const ROLES: { key: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'client', label: 'Cliente', icon: 'person' },
  { key: 'restaurant', label: 'Restaurante', icon: 'restaurant' },
  { key: 'deliverer', label: 'Entregador', icon: 'bicycle' },
];

export default function RegisterScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [role, setRole] = useState<UserRole>('client');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim() || !cpf.trim()) {
      Alert.alert('Ops', 'Preencha nome completo, CPF, e-mail e senha para continuar.');
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      Alert.alert('Ops', 'Digite um CPF válido com 11 dígitos.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Ops', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const user = await register(name.trim(), email.trim(), password, role, cpfDigits);
      await signIn(user);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível criar sua conta. Tente novamente.';
      Alert.alert('Erro ao cadastrar', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Preencha seus dados para começar</Text>

          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.85}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                >
                  <Ionicons name={r.icon} size={17} color={active ? colors.white : colors.primary} />
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="card-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="CPF"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={14}
              value={cpf}
              onChangeText={(v) => setCpf(formatCpf(v))}
            />
          </View>

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

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Senha (mín. 6 caracteres)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.registerButton}>
            <Pressable onPress={handleRegister} disabled={loading} style={styles.registerButtonPressable}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.registerButtonText}>Criar conta</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  title: { ...typography.display, color: colors.text, fontSize: 28, marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 24 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  roleCard: {
    flex: 1,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
  },
  roleCardActive: { backgroundColor: colors.primary },
  roleLabel: { fontSize: 11.5, fontWeight: '700', color: colors.primaryDark },
  roleLabelActive: { color: colors.white },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: '100%',
    marginBottom: 14,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  registerButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  registerButtonPressable: { height: 54, alignItems: 'center', justifyContent: 'center' },
  registerButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
