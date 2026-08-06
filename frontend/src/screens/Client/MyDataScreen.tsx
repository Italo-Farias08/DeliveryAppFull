import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { getMe, updateMe } from '../../services/userService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function formatCpf(raw?: string | null) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 11) return raw || '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function MyDataScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [cpf, setCpf] = useState(user?.cpf ?? '');

  useEffect(() => {
    let active = true;
    getMe()
      .then((data) => {
        if (!active) return;
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        setPhone(data.phone ?? '');
        setCpf(data.cpf ?? '');
      })
      .catch(() => {
        // se a busca falhar, seguimos com o que já tínhamos no contexto
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Ops', 'Nome e e-mail são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMe({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        cpf: cpf.trim() || undefined,
      });
      if (user) {
        await updateUser({ ...user, ...updated });
      }
      setEditing(false);
      Alert.alert('Pronto', 'Seus dados foram atualizados.');
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível salvar seus dados agora.';
      Alert.alert('Erro ao salvar', message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setCpf(user?.cpf ?? '');
    setEditing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus dados</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={10}>
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field
              icon="person-outline"
              label="Nome completo"
              value={name}
              editable={editing}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Field
              icon="mail-outline"
              label="E-mail"
              value={email}
              editable={editing}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              icon="call-outline"
              label="Telefone"
              value={phone}
              editable={editing}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="(00) 00000-0000"
            />
            <Field
              icon="card-outline"
              label="CPF"
              value={editing ? cpf : formatCpf(cpf)}
              editable={editing}
              onChangeText={setCpf}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />

            {editing && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Field({
  icon,
  label,
  value,
  editable,
  onChangeText,
  keyboardType,
  autoCapitalize,
  placeholder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  editable: boolean;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'words';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, editable && styles.inputWrapEditing]}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 10,
  },
  title: { ...typography.h1, color: colors.text, fontSize: 19 },
  editLink: { color: colors.primary, fontSize: 14.5, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  field: { marginBottom: 16 },
  fieldLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: colors.border,
  },
  inputWrapEditing: { borderColor: colors.primary },
  input: { flex: 1, fontSize: 15, color: colors.text },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  cancelButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  saveButton: {
    flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  saveButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
