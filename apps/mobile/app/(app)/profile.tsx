import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(user?.firstName?.[0] ?? 'U').toUpperCase()}
        </Text>
      </View>
      <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>{user?.role?.replace(/_/g, ' ')}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={18} color="#6B7280" />
          <Text style={styles.infoLabel}>Tenant ID</Text>
          <Text style={styles.infoValue}>{user?.tenantId?.slice(0, 12)}...</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', alignItems: 'center', paddingTop: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0D7E8A', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  email: { color: '#9CA3AF', fontSize: 14, marginBottom: 4 },
  role: { color: '#0D7E8A', fontSize: 13, fontWeight: '600', marginBottom: 24 },
  infoCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, width: '90%', marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { color: '#9CA3AF', fontSize: 14, flex: 1 },
  infoValue: { color: '#D1D5DB', fontSize: 14 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444' },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
