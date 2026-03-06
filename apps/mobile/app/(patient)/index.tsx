import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Badge, Card } from '../../components/ui';

// ---- Types ----

interface HealthInsights {
  healthScore: number;
  keyMetrics: Array<{ label: string; value: string; status: string }>;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  notes?: string;
}

interface Report {
  id: string;
  reportNumber: string;
  order?: {
    items?: Array<{ testCatalog?: { name: string } }>;
    orderNumber?: string;
  };
  status: string;
  createdAt: string;
}

// ---- Helpers ----

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getHealthScoreColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.amber;
  return Colors.danger;
}

function getReportStatusColor(status: string): 'green' | 'amber' | 'red' | 'grey' {
  if (status === 'NORMAL' || status === 'SIGNED' || status === 'DELIVERED') return 'green';
  if (status === 'ABNORMAL') return 'amber';
  if (status === 'CRITICAL') return 'red';
  return 'grey';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---- Quick Action Card ----

function QuickActionCard({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.qaCard} onPress={onPress} activeOpacity={0.75}>
      <Text style={s.qaEmoji}>{emoji}</Text>
      <Text style={s.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---- Main Component ----

export default function PatientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((st) => st.user);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: healthInsights, isLoading: healthLoading } = useQuery<HealthInsights>({
    queryKey: ['health-insights', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get<HealthInsights>('/patients/my-health-insights');
        return res.data;
      } catch {
        return { healthScore: 72, keyMetrics: [] };
      }
    },
  });

  const { data: appointmentsData } = useQuery<{ data?: Appointment[]; appointments?: Appointment[] }>({
    queryKey: ['upcoming-appointments', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/appointments?limit=1&status=SCHEDULED');
        return res.data as { data?: Appointment[]; appointments?: Appointment[] };
      } catch {
        return { data: [] };
      }
    },
  });

  const { data: reportsData } = useQuery<{ data?: Report[]; reports?: Report[] }>({
    queryKey: ['recent-reports', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/reports?limit=3');
        return res.data as { data?: Report[]; reports?: Report[] };
      } catch {
        return { data: [] };
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  }, []);

  const appointments: Appointment[] = appointmentsData?.data ?? appointmentsData?.appointments ?? [];
  const upcomingAppt = appointments[0] ?? null;

  const reports: Report[] = reportsData?.data ?? reportsData?.reports ?? [];

  const firstName = user?.firstName ?? 'there';
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const healthScore = healthInsights?.healthScore ?? 72;
  const scoreColor = getHealthScoreColor(healthScore);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />
        }
        contentContainerStyle={s.scrollContent}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.greeting}>
              {getGreeting()}, {firstName} 👋
            </Text>
            <Text style={s.headerSub}>DELViON Health</Text>
          </View>
          <Avatar name={fullName || 'Patient'} size={46} bg={Colors.teal} />
        </View>

        {/* Health Score Card */}
        <Card style={s.healthCard}>
          <View style={s.healthCardHeader}>
            <Text style={s.healthCardTitle}>Your Health Score</Text>
            {healthLoading && <ActivityIndicator size="small" color={Colors.teal} />}
          </View>
          <View style={s.scoreRow}>
            <Text style={[s.scoreValue, { color: scoreColor }]}>{healthScore}</Text>
            <Text style={s.scoreMax}>/100</Text>
          </View>
          {/* Gauge bar */}
          <View style={s.gaugeTrack}>
            <View
              style={[
                s.gaugeFill,
                { width: `${healthScore}%` as unknown as number, backgroundColor: scoreColor },
              ]}
            />
          </View>
          <Text style={[s.scoreLabel, { color: scoreColor }]}>
            {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
          </Text>
        </Card>

        {/* Quick Actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.qaGrid}>
          <QuickActionCard
            emoji="🧪"
            label="Book Test"
            onPress={() => router.push('/(patient)/book')}
          />
          <QuickActionCard
            emoji="📄"
            label="My Reports"
            onPress={() => router.push('/(patient)/reports')}
          />
          <QuickActionCard
            emoji="📍"
            label="Track Sample"
            onPress={() => router.push('/(patient)/track')}
          />
          <QuickActionCard
            emoji="👨‍👩‍👧"
            label="Family"
            onPress={() => router.push('/(patient)/family')}
          />
        </View>

        {/* Upcoming Appointment */}
        <Text style={s.sectionTitle}>Upcoming Appointment</Text>
        {upcomingAppt ? (
          <Card>
            <View style={s.apptRow}>
              <Text style={s.apptEmoji}>🗓</Text>
              <View style={s.apptInfo}>
                <Text style={s.apptType}>
                  {upcomingAppt.appointmentType?.replace(/_/g, ' ') ?? 'Appointment'}
                </Text>
                <Text style={s.apptDate}>{formatDateTime(upcomingAppt.appointmentDate)}</Text>
                {upcomingAppt.notes ? (
                  <Text style={s.apptNotes} numberOfLines={1}>
                    {upcomingAppt.notes}
                  </Text>
                ) : null}
              </View>
              <Badge label={upcomingAppt.status} color="teal" />
            </View>
          </Card>
        ) : (
          <Card style={s.emptyCard}>
            <Text style={s.emptyCardText}>No upcoming appointments</Text>
          </Card>
        )}

        {/* Recent Reports */}
        <View style={s.reportsHeader}>
          <Text style={s.sectionTitle}>Recent Reports</Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/reports')}>
            <Text style={s.seeAllLink}>See All →</Text>
          </TouchableOpacity>
        </View>
        {reports.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyCardText}>No reports yet</Text>
          </Card>
        ) : (
          reports.map((report) => {
            const testNames =
              report.order?.items
                ?.map((i) => i.testCatalog?.name)
                .filter(Boolean)
                .join(', ') ?? 'Lab Report';
            return (
              <Card key={report.id}>
                <View style={s.reportRow}>
                  <View style={s.reportInfo}>
                    <Text style={s.reportTests} numberOfLines={1}>
                      {testNames}
                    </Text>
                    <Text style={s.reportDate}>{formatDate(report.createdAt)}</Text>
                    {report.order?.orderNumber ? (
                      <Text style={s.reportOrderNum}>{report.order.orderNumber}</Text>
                    ) : null}
                  </View>
                  <Badge
                    label={report.status}
                    color={getReportStatusColor(report.status)}
                  />
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // Health Card
  healthCard: { margin: 16, marginTop: -12 },
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthCardTitle: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  scoreValue: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  scoreMax: { fontSize: 18, color: Colors.textSecondary, marginBottom: 6, marginLeft: 2 },
  gaugeTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: 4 },
  scoreLabel: { fontSize: 13, fontWeight: '600' },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  reportsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  seeAllLink: { fontSize: 14, color: Colors.teal, fontWeight: '600' },

  // Quick Actions
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  qaCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '46%',
    marginHorizontal: '1%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  qaEmoji: { fontSize: 28, marginBottom: 8 },
  qaLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },

  // Appointment
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptEmoji: { fontSize: 28 },
  apptInfo: { flex: 1 },
  apptType: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  apptDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  apptNotes: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Report row
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportInfo: { flex: 1, marginRight: 8 },
  reportTests: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  reportDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reportOrderNum: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  // Empty card
  emptyCard: { marginHorizontal: 16 },
  emptyCardText: { color: Colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
