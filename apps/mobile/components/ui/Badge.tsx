import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

type BadgeColor = 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'grey';

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string }> = {
  green: { bg: '#DCFCE7', text: Colors.success },
  amber: { bg: '#FEF3C7', text: '#92400E' },
  red: { bg: '#FEE2E2', text: Colors.danger },
  blue: { bg: '#DBEAFE', text: Colors.primary },
  teal: { bg: '#CCFBF1', text: Colors.teal },
  grey: { bg: '#F1F5F9', text: Colors.textSecondary },
};

export function Badge({ label, color = 'grey' }: { label: string; color?: BadgeColor }) {
  const { bg, text } = COLOR_MAP[color] ?? COLOR_MAP.grey;
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  label: { fontSize: 11, fontWeight: '700' },
});
