import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Quanto encolhe ao pressionar. 0.96 = sutil (padrão), 0.9 = bem perceptível. */
  scaleTo?: number;
  disabled?: boolean;
}

// Dá a qualquer elemento tocável um "spring" sutil ao pressionar -- a mesma
// sensação de fluidez que já existia (só na LoginScreen) agora reutilizável
// em botões, cards, chips e linhas de lista em todo o app.
export function PressableScale({ children, style, scaleTo = 0.96, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, friction: 6, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
