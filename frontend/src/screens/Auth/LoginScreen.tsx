import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
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
import { login } from '../../services/authService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { UserRole } from '../../types';

const ROLES: { key: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'client', label: 'Cliente', icon: 'person' },
  { key: 'restaurant', label: 'Restaurante', icon: 'restaurant' },
  { key: 'deliverer', label: 'Entregador', icon: 'bicycle' },
];

// Cor do botão "Entrar" por perfil — na mesma ordem do array ROLES acima
const ROLE_COLORS = ['#E53935', '#111111', '#2E7D32']; // cliente: vermelho, restaurante: preto, entregador: verde

// Botão com leve "spring" ao pressionar — dá a sensação de fluidez pedida
function PressScale({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.97, friction: 6, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start()
      }
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [role, setRole] = useState<UserRole>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roleRowWidth, setRoleRowWidth] = useState(0);

  // Entrada da logo e do título
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  // Entrada escalonada dos campos do formulário
  const roleFade = useRef(new Animated.Value(0)).current;
  const roleSlide = useRef(new Animated.Value(14)).current;
  const emailFade = useRef(new Animated.Value(0)).current;
  const emailSlide = useRef(new Animated.Value(14)).current;
  const passFade = useRef(new Animated.Value(0)).current;
  const passSlide = useRef(new Animated.Value(14)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(14)).current;
  const socialFade = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;

  // Indicador deslizante do seletor de perfil
  const roleIndicatorX = useRef(new Animated.Value(0)).current;

  // Cor do botão "Entrar" — transiciona suavemente conforme o perfil escolhido
  const buttonColorAnim = useRef(new Animated.Value(0)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;

  // Shake de erro
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.stagger(90, [
        Animated.parallel([
          Animated.timing(roleFade, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(roleSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(emailFade, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(emailSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(passFade, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(passSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(buttonFade, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(buttonSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.timing(socialFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(footerFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    const idx = ROLES.findIndex((r) => r.key === role);
    Animated.timing(buttonColorAnim, {
      toValue: idx,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false, // cor não pode usar o driver nativo
    }).start();
    if (!roleRowWidth) return;
    const segment = roleRowWidth / ROLES.length;
    Animated.spring(roleIndicatorX, {
      toValue: idx * segment,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [role, roleRowWidth]);

  const buttonColor = buttonColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ROLE_COLORS,
  });

  const segmentWidth = roleRowWidth / ROLES.length;

  function triggerShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      triggerShake();
      Alert.alert('Ops', 'Preencha e-mail e senha para continuar.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email.trim(), password, role);
      await signIn(user);
    } catch (err) {
      triggerShake();
      Alert.alert('Erro ao entrar', 'Não foi possível fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const shakeTranslate = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.logoMark, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
            <Image source={require('../../img/logo.png')} style={styles.logoImage} resizeMode="contain" />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={styles.brand}>MyFood</Text>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={styles.title}>Entrar</Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: roleFade,
              transform: [{ translateY: roleSlide }, { translateX: shakeTranslate }],
            }}
          >
            <View style={styles.roleRow} onLayout={(e) => setRoleRowWidth(e.nativeEvent.layout.width)}>
              {roleRowWidth > 0 && (
                <Animated.View
                  style={[
                    styles.roleIndicatorWrap,
                    { width: segmentWidth, transform: [{ translateX: roleIndicatorX }] },
                  ]}
                >
                  <Animated.View style={[styles.roleIndicator, { backgroundColor: buttonColor }]} />
                </Animated.View>
              )}
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <TouchableOpacity key={r.key} onPress={() => setRole(r.key)} activeOpacity={0.85} style={styles.roleCard}>
                    <Ionicons name={r.icon} size={17} color={active ? colors.white : colors.primary} />
                    <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: emailFade, transform: [{ translateY: emailSlide }] }}>
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
          </Animated.View>

          <Animated.View style={{ opacity: passFade, transform: [{ translateY: passSlide }] }}>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: emailFade }}>
            <TouchableOpacity onPress={() => Alert.alert('Em breve', 'Recuperação de senha chega com o backend.')}>
              <Text style={styles.forgot}>Esqueci minha senha</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: buttonFade, transform: [{ translateY: buttonSlide }], width: '100%' }}>
            <Animated.View style={[styles.loginButton, { backgroundColor: buttonColor }]}>
              <Animated.View style={[styles.loginButtonInner, { transform: [{ scale: buttonPressScale }] }]}>
                <Pressable
                  onPress={handleLogin}
                  disabled={loading}
                  onPressIn={() =>
                    Animated.spring(buttonPressScale, { toValue: 0.97, friction: 6, useNativeDriver: true }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(buttonPressScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start()
                  }
                  style={styles.loginButtonPressable}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.loginButtonText}>Entrar</Text>
                  )}
                </Pressable>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.dividerRow, { opacity: socialFade }]}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          <Animated.View style={{ opacity: socialFade }}>
            <PressScale
              style={styles.socialButton}
              onPress={() => Alert.alert('Em breve', 'Login com Google chega com o backend.')}
            >
              <Ionicons name="logo-google" size={19} color="#EA4335" />
              <Text style={styles.socialText}>Entrar com Google</Text>
            </PressScale>

            <PressScale
              style={styles.socialButton}
              onPress={() => Alert.alert('Em breve', 'Login com Apple chega com o backend.')}
            >
              <Ionicons name="logo-apple" size={20} color={colors.text} />
              <Text style={styles.socialText}>Entrar com Apple</Text>
            </PressScale>
          </Animated.View>

          <Animated.View style={[styles.footerRow, { opacity: footerFade }]}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => Alert.alert('Em breve', 'Cadastro completo chega com o backend.')}>
              <Text style={styles.footerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28 },
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoImage: { width: 96, height: 96 },
  brand: { ...typography.display, color: colors.primary, fontSize: 22, textAlign: 'center', marginBottom: 18 },
  title: { ...typography.display, color: colors.text, fontSize: 30, alignSelf: 'flex-start', marginBottom: 20 },
  roleRow: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 18,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    width: '100%',
  },
  roleIndicatorWrap: { position: 'absolute', top: 0, left: 0, height: '100%' },
  roleIndicator: { flex: 1, borderRadius: 14 },
  roleCard: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', gap: 4 },
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
  forgot: { color: colors.primary, fontSize: 13.5, fontWeight: '600', textAlign: 'right', width: '100%', marginBottom: 18 },
  loginButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loginButtonInner: {
    height: 54,
  },
  loginButtonPressable: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 12, color: colors.textMuted, fontSize: 13 },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: '100%',
    marginBottom: 12,
  },
  socialText: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});