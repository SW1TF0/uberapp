import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../content/legalContent';

export type LegalDocParams = { doc: 'privacy' | 'terms' };

type Props = { route: { params: LegalDocParams } };

export default function LegalDocScreen({ route }: Props) {
  const { doc } = route.params;
  const sections = doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = doc === 'privacy' ? 'Политика за поверителност' : 'Общи условия';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  section: { marginBottom: 20 },
  heading: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
});
