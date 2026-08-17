import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Posição no grupo -- usada pra escalonar o atraso (efeito cascata numa lista). */
  index?: number;
  /** Atraso extra fixo, em ms, somado ao atraso calculado do index. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  /** Distância (px) de onde o conteúdo desliza até a posição final. */
  distance?: number;
}

// Anima a entrada de qualquer bloco: some sobe suavemente, com leve atraso
// escalonado quando usado dentro de uma lista (via `index`). Mesmo efeito que
// já existia isolado na HomeScreen, agora reutilizável em qualquer tela.
export function FadeSlideIn({ children, index = 0, delay = 0, style, distance = 16 }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const computedDelay = delay + Math.min(index, 8) * 60;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        delay: computedDelay,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        delay: computedDelay,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity: fade, transform: [{ translateY: translate }] }]}>
      {children}
    </Animated.View>
  );
}
