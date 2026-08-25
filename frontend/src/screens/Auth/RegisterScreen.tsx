import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { register, RegisterPayload } from '../../services/authService';
import { TERMS_URL } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows, coloredShadow } from '../../theme/shadows';
import { UserRole } from '../../types';

const ROLES: { key: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'client', label: 'Cliente', icon: 'person' },
  { key: 'restaurant', label: 'Restaurante', icon: 'restaurant' },
  { key: 'deliverer', label: 'Entregador', icon: 'bicycle' },
];

type VehicleType = 'moto' | 'bike' | 'carro';
const VEHICLE_TYPES: { key: VehicleType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'moto', label: 'Moto', icon: 'bicycle' },
  { key: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { key: 'carro', label: 'Carro', icon: 'car-outline' },
];

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPlate(value: string) {
  return value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 7);
}

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { signIn } = useAuth();
  const [role, setRole] = useState<UserRole>('client');

  // Campos comuns
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cliente / Entregador
  const [cpf, setCpf] = useState('');

  // Restaurante
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');

  // Entregador
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  // Código do restaurante (opcional) — vincula como entregador "da casa"
  // em vez de autônomo. Quem não tiver, deixa em branco e vira autônomo.
  const [inviteCode, setInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function validate(): string | null {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return 'Preencha nome, e-mail e senha para continuar.';
    }
    if (password.length < 6) {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }

    if (role === 'client' || role === 'deliverer') {
      const cpfDigits = cpf.replace(/\D/g, '');
      if (cpfDigits.length !== 11) {
        return 'Digite um CPF válido com 11 dígitos.';
      }
    }

    if (role === 'restaurant') {
      if (!businessName.trim()) {
        return 'Informe o nome do restaurante.';
      }
      const cnpjDigits = cnpj.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) {
        return 'Digite um CNPJ válido com 14 dígitos.';
      }
    }

    if (role === 'deliverer' && vehicleType !== 'bike') {
      const plateDigits = vehiclePlate.replace(/[^A-Za-z0-9]/g, '');
      if (plateDigits.length !== 7) {
        return 'Digite uma placa válida (ex: ABC1234).';
      }
    }

    if (!acceptedTerms) {
      return 'Você precisa aceitar os Termos de Uso para continuar.';
    }

    return null;
  }

  async function handleRegister() {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Ops', validationError);
      return;
    }

    let payload: RegisterPayload;
    if (role === 'client') {
      payload = {
        role: 'client',
        name: name.trim(),
        email: email.trim(),
        password,
        cpf: cpf.replace(/\D/g, ''),
      };
    } else if (role === 'restaurant') {
      payload = {
        role: 'restaurant',
        name: name.trim(),
        email: email.trim(),
        password,
        businessName: businessName.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
      };
    } else {
      payload = {
        role: 'deliverer',
        name: name.trim(),
        email: email.trim(),
        password,
        cpf: cpf.replace(/\D/g, ''),
        vehicleType,
        vehiclePlate: vehicleType === 'bike' ? undefined : vehiclePlate.replace(/[^A-Za-z0-9]/g, ''),
        inviteCode: inviteCode.trim() ? inviteCode.trim().toUpperCase() : undefined,
      };
    }

    setLoading(true);
    try {
      const user = await register(payload);
      await signIn(user);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        `${err?.message || 'Erro desconhecido'} (code: ${err?.code || 'sem código'})`;
      Alert.alert('Erro ao cadastrar', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={10} scaleTo={0.88}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </PressableScale>

          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Preencha seus dados para começar</Text>

          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <PressableScale
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  scaleTo={0.94}
                >
                  <Ionicons name={r.icon} size={17} color={active ? colors.white : colors.primary} />
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          {/* Nome — label muda pra "responsável" no caso de restaurante */}
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder={role === 'restaurant' ? 'Nome do responsável' : 'Nome completo'}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Campos exclusivos do Restaurante */}
          {role === 'restaurant' && (
            <FadeSlideIn>
              <View style={styles.inputWrap}>
                <Ionicons name="storefront-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome do restaurante"
                  placeholderTextColor={colors.textMuted}
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="business-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="CNPJ"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={18}
                  value={cnpj}
                  onChangeText={(v) => setCnpj(formatCnpj(v))}
                />
              </View>
            </FadeSlideIn>
          )}

          {/* CPF — Cliente e Entregador */}
          {(role === 'client' || role === 'deliverer') && (
            <FadeSlideIn style={styles.inputWrap}>
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
            </FadeSlideIn>
          )}

          {/* Campos exclusivos do Entregador */}
          {role === 'deliverer' && (
            <FadeSlideIn>
              <Text style={styles.fieldLabel}>Veículo</Text>
              <View style={styles.vehicleRow}>
                {VEHICLE_TYPES.map((v) => {
                  const active = vehicleType === v.key;
                  return (
                    <PressableScale
                      key={v.key}
                      onPress={() => setVehicleType(v.key)}
                      style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                      scaleTo={0.94}
                    >
                      <Ionicons name={v.icon} size={16} color={active ? colors.white : colors.primary} />
                      <Text style={[styles.vehicleLabel, active && styles.vehicleLabelActive]}>{v.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>

              {vehicleType !== 'bike' && (
                <View style={styles.inputWrap}>
                  <Ionicons name="pricetag-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Placa (ex: ABC1234)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={7}
                    value={vehiclePlate}
                    onChangeText={(v) => setVehiclePlate(formatPlate(v))}
                  />
                </View>
              )}

              <View style={styles.inputWrap}>
                <Ionicons name="business-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Código do restaurante (opcional)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={6}
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase())}
                />
              </View>
              <Text style={styles.inviteHint}>
                Vai trabalhar fixo pra um restaurante? Peça o código pra ele e cole aqui. Sem código, você entra como
                entregador autônomo e pega corridas de qualquer loja.
              </Text>
            </FadeSlideIn>
          )}

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
            <PressableScale onPress={() => setShowPassword((v) => !v)} hitSlop={10} scaleTo={0.85}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </PressableScale>
          </View>

          <PressableScale
            onPress={() => setAcceptedTerms((v) => !v)}
            style={styles.termsRow}
            scaleTo={0.99}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={13} color={colors.white} />}
            </View>
            <Text style={styles.termsText}>
              Li e aceito os{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                Termos de Uso
              </Text>
            </Text>
          </PressableScale>

          <PressableScale onPress={handleRegister} disabled={loading} style={styles.registerButton} scaleTo={0.97}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>Criar conta</Text>
            )}
          </PressableScale>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem conta? </Text>
            <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9}>
              <Text style={styles.footerLink}>Entrar</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  roleCardActive: { backgroundColor: colors.primary, ...coloredShadow(colors.primary, 0.3) },
  roleLabel: { fontSize: 11.5, fontWeight: '700', color: colors.primaryDark },
  roleLabelActive: { color: colors.white },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  vehicleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  vehicleCard: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  vehicleCardActive: { backgroundColor: colors.primary, ...coloredShadow(colors.primary, 0.3) },
  vehicleLabel: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark },
  vehicleLabelActive: { color: colors.white },
  inviteHint: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: -6, marginBottom: 12 },
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
    ...shadows.xs,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  registerButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: 8,
    ...coloredShadow(colors.primary, 0.32),
  },
  registerButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6, marginBottom: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1, color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
  termsLink: { color: colors.primary, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
};