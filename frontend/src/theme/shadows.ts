// Sistema de sombras do app -- escala consistente de elevação, pensada pra
// funcionar bem tanto no tema claro quanto no escuro (iOS usa shadow*, Android
// usa elevation; sempre definimos os dois juntos).
//
// Uso: style={[styles.card, shadows.sm]}
import { ViewStyle } from 'react-native';

type ShadowToken = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'shadowOffset' | 'elevation'
>;

export const shadows: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', ShadowToken> = {
  // Elementos pequenos: chips, botões de ícone
  xs: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  // Cards em listas (comida, restaurante, linhas de conteúdo)
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // Cards de destaque, headers fixos
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  // Modais, drawers, elementos flutuantes
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Splash, elementos hero
  xl: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
};

// Sombra "colorida" (glow) na cor da marca -- usada em CTAs primários pra dar
// uma sensação premium, em vez da sombra preta padrão.
export function coloredShadow(color: string, opacity = 0.3): ShadowToken {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  };
}
