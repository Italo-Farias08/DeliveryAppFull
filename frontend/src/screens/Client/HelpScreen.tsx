import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Como acompanho meu pedido?',
    answer:
      'Vá em "Pedidos" para ver o status em tempo real: preparando, procurando entregador, a caminho e entregue.',
  },
  {
    question: 'Posso cancelar um pedido depois de fazer?',
    answer:
      'Enquanto o restaurante ainda não começou o preparo, é possível cancelar direto na tela do pedido. Depois disso, fale com o restaurante pelo chat do pedido.',
  },
  {
    question: 'Como troco minha forma de pagamento?',
    answer: 'Em Conta > Formas de pagamento você pode adicionar, remover ou escolher a forma padrão.',
  },
  {
    question: 'Esqueci minha senha, e agora?',
    answer:
      'Na tela de login, toque em "Esqueci minha senha" e siga o código de verificação enviado para o seu e-mail.',
  },
  {
    question: 'Como altero meu endereço de entrega?',
    answer: 'Em Conta > Endereços você pode adicionar, editar ou remover os endereços salvos (Casa, Trabalho, Outro).',
  },
  {
    question: 'O entregador não chegou, o que faço?',
    answer:
      'Use o chat do pedido para falar com o restaurante ou entre em contato com nosso suporte pelos canais abaixo.',
  },
];

const CONTACT_PHONE = '5581999999999';
const CONTACT_EMAIL = 'suporte@deliveryapp.com.br';

export default function HelpScreen() {
  const navigation = useNavigation<any>();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function openWhatsapp() {
    Linking.openURL(`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com meu pedido.')}`);
  }

  function openEmail() {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  }

  function openPhone() {
    Linking.openURL(`tel:+${CONTACT_PHONE}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Ajuda</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Perguntas frequentes</Text>
        <View style={styles.faqCard}>
          {FAQ.map((item, index) => {
            const open = openIndex === index;
            return (
              <View key={item.question} style={[styles.faqItem, index === FAQ.length - 1 && { borderBottomWidth: 0 }]}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  activeOpacity={0.7}
                  onPress={() => setOpenIndex(open ? null : index)}
                >
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {open && <Text style={styles.faqAnswer}>{item.answer}</Text>}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Fale com a gente</Text>
        <View style={styles.contactCard}>
          <TouchableOpacity style={styles.contactRow} activeOpacity={0.7} onPress={openWhatsapp}>
            <View style={[styles.contactIcon, { backgroundColor: '#DCF8E9' }]}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactSubtitle}>Resposta mais rápida, todo dia das 8h às 22h</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.7} onPress={openEmail}>
            <View style={[styles.contactIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>E-mail</Text>
              <Text style={styles.contactSubtitle}>{CONTACT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.contactRow, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={openPhone}>
            <View style={[styles.contactIcon, { backgroundColor: colors.secondaryLight }]}>
              <Ionicons name="call-outline" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Telefone</Text>
              <Text style={styles.contactSubtitle}>(81) 99999-9999</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>versão 1.0.0 · demonstração</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 10,
  },
  title: { ...typography.h1, color: colors.text, fontSize: 19 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionLabel: {
    color: colors.textMuted, fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase',
    marginTop: 20, marginBottom: 8,
  },
  faqCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16,
  },
  faqItem: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 14 },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.text },
  faqAnswer: { marginTop: 8, fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  contactCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  contactIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  contactSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11.5, marginTop: 24 },
});
