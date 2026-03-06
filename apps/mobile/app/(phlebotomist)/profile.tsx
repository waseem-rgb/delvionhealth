import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Badge, Card, Button } from '../../components/ui';

// ---- Types ----

interface AppointmentsResponse {
  data?: unknown[];
  appointments?: unknown[];
}

// ---- Info Row ----

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={s.infoContent}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ---- Stat Row ----

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

// ---- Main Component ----

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((st) => st.user);
  const logout = useAuthStore((st) => st.logout);

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Phlebotomist';
  const employeeId = user?.id ? user.id.slice(0, 8).toUpperCase() : 'N/A';
  const branchId = user?.tenantId ? user.tenantId.slice(0, 8).toUpperCase() : 'N/A';

  // Fetch today's samples count
  const { data: todayData, isLoading: todayLoading } = useQuery<AppointmentsResponse>({
    queryKey: ['phlebotomist-today-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get(
          '/appointments?assignedTo=ME&status=COMPLETED&date=TODAY&limit=100'
        );
        return res.data as AppointmentsResponse;
      } catch {
        return { data: [] };
      }
    },
  });

  const todayList: unknown[] = todayData?.data ?? todayData?.appointments ?? [];
  const samplesToday = todayList.length;

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout, router]);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Screen Header */}
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={s.avatarSection}>
          <Avatar name={fullName} size={72} bg={Colors.teal} />
          <Text style={s.nameText}>{fullName}</Text>
          <View style={s.roleBadgeRow}>
            <Badge label="Phlebotomist" color="teal" />
          </View>
        </View>

        {/* Info Card */}
        <Text style={s.sectionTitle}>Account Information</Text>
        <Card>
          <InfoRow
            icon="✉️"
            label="Email"
            value={user?.email ?? 'Not available'}
          />
          <View style={s.divider} />
          <InfoRow
            icon="🆔"
            label="Employee ID"
            value={employeeId}
          />
          <View style={s.divider} />
          <InfoRow
            icon="🏢"
            label="Branch"
            value={branchId}
          />
        </Card>

        {/* Stats Card */}
        <Text style={s.sectionTitle}>Performance</Text>
        <Card>
          <View style={s.statsCardContent}>
            <View style={s.statsCol}>
              {todayLoading ? (
                <ActivityIndicator size="small" color={Colors.teal} />
              ) : (
                <Text style={[s.statsNumber, { color: Colors.teal }]}>{samplesToday}</Text>
              )}
              <Text style={s.statsColLabel}>Samples Today</Text>
            </View>
            <View style={s.statsColDivider} />
            <View style={s.statsCol}>
              <Text style={[s.statsNumber, { color: Colors.primary }]}>0</Text>
              <Text style={s.statsColLabel}>Total This Month</Text>
            </View>
          </View>
        </Card>

        {/* Activity Summary */}
        <Text style={s.sectionTitle}>Today's Summary</Text>
        <Card>
          {todayLoading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={Colors.teal} />
              <Text style={s.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              <StatRow
                label="Samples Collected"
                value={samplesToday}
                color={Colors.success}
              />
              <View style={s.divider} />
              <StatRow
                label="Pending Collections"
                value={0}
                color={Colors.amber}
              />
              <View style={s.divider} />
              <StatRow label="Total Assignments" value={samplesToday} />
            </>
          )}
        </Card>

        {/* App Info */}
        <Text style={s.sectionTitle}>App</Text>
        <Card>
          <InfoRow icon="📱" label="Version" value="1.0.0" />
          <View style={s.divider} />
          <InfoRow icon="🏥" label="Platform" value="DELViON Health" />
        </Card>

        {/* Sign Out */}
        <View style={s.signOutSection}>
          <Button
            label="Sign Out"
            onPress={handleSignOut}
            variant="danger"
            fullWidth
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 32 },

  // Screen Header
  screenHeader: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  screenTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  roleBadgeRow: {
    flexDirection: 'row',
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Stats card
  statsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statsColDivider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border,
  },
  statsNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  statsColLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Stat row
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statLabel: { fontSize: 14, color: Colors.textPrimary },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary },

  // Sign out
  signOutSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
});
