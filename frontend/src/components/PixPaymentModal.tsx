import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { connectSocket, disconnectSocket } from '../services/socket';
import { PixPayment } from '../services/orderService';

interface Props {
  visible: boolean;
  orderId: string;
  payment: PixPayment | null;
  onClose: () => void;
  onPaid: () => void;
}

export function PixPaymentModal({ visible, orderId, payment, onClose, onPaid }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    connectSocket().then((s) => {
      if (!s || !active) return;
      s.on('order:payment', ({ id, paymentStatus }: { id: string; paymentStatus: string }) => {
        if (id !== orderId) return;
        if (paymentStatus === 'pago') onPaid();
        if (paymentStatus === 'recusado') {
          Alert.alert('Pagamento recusado', 'Tente gerar um novo código Pix.');
          onClose();
        }
      });
    });
    return () => {
      active = false;
      disconnectSocket();
    };
  }, [visible, orderId]);

  async function handleCopy() {
    if (!payment) return;
    await Clipboard.setStringAsync(payment.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.title}>Pague com Pix</Text>
          <Text style={styles.subtitle}>
            Abra o app do seu banco, escolha "Pagar com Pix" e escaneie o código abaixo.
          </Text>

          {!payment ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
          ) : (
            <>
              <View style={styles.qrBox}>
                <Image
                  source={{ uri: `data:image/png;base64,${payment.qrCodeBase64}` }}
                  style={styles.qrImage}
                  contentFit="contain"
                />
              </View>

              <Text style={styles.waiting}>Aguardando confirmação do pagamento…</Text>

              <Button
                label={copied ? 'Código copiado!' : 'Copiar código Pix'}
                onPress={handleCopy}
                variant="outline"
                style={{ marginTop: 16 }}
              />
            </>
          )}

          <Button label="Fechar" onPress={onClose} style={{ marginTop: 12 }} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 16,
    },
    title: { ...typography.h2, color: colors.text, textAlign: 'center' },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    qrBox: {
      alignSelf: 'center',
      backgroundColor: colors.white,
      padding: 16,
      borderRadius: 16,
    },
    qrImage: { width: 220, height: 220 },
    waiting: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 16,
    },
  });
}