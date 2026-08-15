// Identidade visual do app -- agora com paleta clara e escura.
// `colors` continua existindo (= paleta clara) só por segurança, pra
// qualquer arquivo que eventualmente não passe pelo ThemeContext não
// quebrar. Mas o certo é sempre pegar as cores via useTheme().

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryLight: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  star: string;
  danger: string;
  dangerLight: string;
  white: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  primary: '#E4002B',
  primaryDark: '#A30020',
  primaryLight: '#FFE1E1',
  secondary: '#1F6F5C',
  secondaryLight: '#DCEFE9',
  background: '#FFFBFB',
  surface: '#FFFFFF',
  text: '#1C1B1A',
  textMuted: '#8A8580',
  border: '#F5E4E4',
  star: '#FFB400',
  danger: '#E5484D',
  dangerLight: '#FDECEA',
  white: '#FFFFFF',
  overlay: 'rgba(28,27,26,0.55)',
};

export const darkColors: ThemeColors = {
  primary: '#FF4D6D',
  primaryDark: '#FF7A90',
  primaryLight: '#3A1620',
  secondary: '#33C9A0',
  secondaryLight: '#123A30',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#F2F2F2',
  textMuted: '#9C9C9C',
  border: '#2E2E2E',
  star: '#FFC94D',
  danger: '#FF6B6B',
  dangerLight: '#3A1414',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.65)',
};

// Mantido por compatibilidade -- prefira useTheme().colors
export const colors = lightColors;
