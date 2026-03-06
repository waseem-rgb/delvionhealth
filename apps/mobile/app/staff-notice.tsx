import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';

export default function StaffNotice() {
  const { logout } = useAuthStore();

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.emoji}>💻</Text>
      <Text style={s.title}>Use the Web App</Text>
      <Text style={s.body}>
        The mobile app is for patients, phlebotomists, and doctors.{'\n\n'}
        Staff members please access DELViON Health at{'\n'}
        <Text style={s.link}>app.delvion.health</Text>
      </Text>
      <Button label="Sign Out" onPress={logout} variant="secondary" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    padding: 32,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  link: { color: Colors.teal, fontWeight: '600' },
});
