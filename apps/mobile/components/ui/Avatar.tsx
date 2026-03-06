import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export function Avatar({
  name,
  size = 40,
  bg = Colors.teal,
}: {
  name: string;
  size?: number;
  bg?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        s.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[s.text, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
