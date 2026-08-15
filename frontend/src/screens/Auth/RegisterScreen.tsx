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
import { register, RegisterPayload } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
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
            <>
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
            </>
          )}

          {/* CPF — Cliente e Entregador */}
          {(role === 'client' || role === 'deliverer') && (
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
          )}

          {/* Campos exclusivos do Entregador */}
          {role === 'deliverer' && (
            <>
              <Text style={styles.fieldLabel}>Veículo</Text>
              <View style={styles.vehicleRow}>
                {VEHICLE_TYPES.map((v) => {
                  const active = vehicleType === v.key;
                  return (
                    <TouchableOpacity
                      key={v.key}
                      onPress={() => setVehicleType(v.key)}
                      activeOpacity={0.85}
                      style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                    >
                      <Ionicons name={v.icon} size={16} color={active ? colors.white : colors.primary} />
                      <Text style={[styles.vehicleLabel, active && styles.vehicleLabelActive]}>{v.label}</Text>
                    </TouchableOpacity>
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
            </>
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
  roleCardActive: { backgroundColor: colors.primary },
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
  vehicleCardActive: { backgroundColor: colors.primary },
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
};