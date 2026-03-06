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

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  notes?: string;
  patient?: {
    firstName: string;
    lastName: string;
    address?: string;
  };
  order?: {
    items?: Array<{ testCatalog?: { name: string } }>;
  };
}

interface AppointmentsResponse {
  data?: Appointment[];
  appointments?: Appointment[];
}

// ---- Helpers ----

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStatusColor(status: string): 'amber' | 'blue' | 'green' | 'red' | 'grey' {
  switch (status) {
    case 'SCHEDULED': return 'amber';
    case 'IN_PROGRESS': return 'blue';
    case 'COMPLETED':
    case 'COLLECTED': return 'green';
    case 'CANCELLED': return 'red';
    default: return 'grey';
  }
}

// ---- Stat Card ----

function StatCard({
  label,
  value,
  color,
  isLoading,
}: {
  label: string;
  value: number;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[s.statValue, { color }]}>{value}</Text>
      )}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
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

// ---- Collection Item ----

function CollectionItem({
  appointment,
  onMarkCollected,
  isUpdating,
}: {
  appointment: Appointment;
  onMarkCollected: (id: string) => void;
  isUpdating: boolean;
}) {
  const patientName = appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
    : 'Unknown Patient';

  const testNames =
    appointment.order?.items
      ?.map((i) => i.testCatalog?.name)
      .filter(Boolean)
      .join(', ') ?? 'Tests pending';

  const address = appointment.patient?.address ?? 'Address not provided';
  const timeSlot = formatTime(appointment.appointmentDate);
  const statusColor = getStatusColor(appointment.status);
  const isCollectable = appointment.status === 'SCHEDULED' || appointment.status === 'IN_PROGRESS';

  return (
    <Card>
      <View style={s.collectionRow}>
        <View style={s.collectionInfo}>
          <View style={s.collectionNameRow}>
            <Text style={s.collectionName}>{patientName}</Text>
            <Badge label={appointment.status} color={statusColor} />
          </View>
          <Text style={s.collectionAddress} numberOfLines={1}>
            📍 {address}
          </Text>
          <Text style={s.collectionTime}>🕐 {timeSlot}</Text>
          <Text style={s.collectionTests} numberOfLines={2}>
            🧪 {testNames}
          </Text>
        </View>
      </View>
      {isCollectable && (
        <TouchableOpacity
          style={s.collectButton}
          onPress={() => onMarkCollected(appointment.id)}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.collectButtonText}>Mark as Collected</Text>
          )}
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ---- Main Component ----

export default function PhlebotomistDashboard() {
  const router = useRouter();
  const user = useAuthStore((st) => st.user);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const firstName = user?.firstName ?? 'there';
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  // Fetch all today's appointments for stats
  const { data: allAppointmentsData, isLoading: statsLoading } = useQuery<AppointmentsResponse>({
    queryKey: ['phlebotomist-all-appointments', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/appointments?type=HOME_COLLECTION&status=SCHEDULED&date=TODAY&limit=100');
        return res.data as AppointmentsResponse;
      } catch {
        return { data: [] };
      }
    },
  });

  // Fetch upcoming queue for this phlebotomist
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useQuery<AppointmentsResponse>({
    queryKey: ['phlebotomist-queue', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/appointments?type=HOME_COLLECTION&assignedTo=ME&limit=20');
        return res.data as AppointmentsResponse;
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

  const handleMarkCollected = useCallback(
    async (appointmentId: string) => {
      setUpdatingId(appointmentId);
      try {
        await apiClient.patch(`/appointments/${appointmentId}`, { status: 'COLLECTED' });
        await refetchQueue();
      } catch {
        // silently handle error; UI will remain unchanged
      } finally {
        setUpdatingId(null);
      }
    },
    [refetchQueue]
  );

  const allAppointments: Appointment[] =
    allAppointmentsData?.data ?? allAppointmentsData?.appointments ?? [];
  const queueAppointments: Appointment[] =
    queueData?.data ?? queueData?.appointments ?? [];

  const pendingCount = allAppointments.filter((a) => a.status === 'SCHEDULED').length;
  const completedCount = allAppointments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'COLLECTED'
  ).length;
  const totalSamples = allAppointments.length;

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
              {getGreeting()}, {firstName}
            </Text>
            <Text style={s.headerSub}>{formatTodayDate()}</Text>
          </View>
          <Avatar name={fullName || 'Phlebotomist'} size={46} bg={Colors.teal} />
        </View>

        {/* Today's Stats */}
        <Text style={s.sectionTitle}>Today's Summary</Text>
        <View style={s.statsRow}>
          <StatCard
            label="Pending"
            value={pendingCount}
            color={Colors.amber}
            isLoading={statsLoading}
          />
          <StatCard
            label="Completed"
            value={completedCount}
            color={Colors.success}
            isLoading={statsLoading}
          />
          <StatCard
            label="Total Samples"
            value={totalSamples}
            color={Colors.teal}
            isLoading={statsLoading}
          />
        </View>

        {/* Quick Actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.qaGrid}>
          <QuickActionCard
            emoji="📋"
            label="View All Assignments"
            onPress={() => router.push('/(phlebotomist)/assignments')}
          />
          <QuickActionCard
            emoji="🧫"
            label="Scan & Collect"
            onPress={() => router.push('/(phlebotomist)/scan')}
          />
        </View>

        {/* Upcoming Collection Queue */}
        <Text style={s.sectionTitle}>Upcoming Collection Queue</Text>
        {queueLoading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.teal} />
          </View>
        ) : queueAppointments.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyText}>🎉 No pending collections for today</Text>
          </Card>
        ) : (
          <View style={s.listContainer}>
            {queueAppointments.map((appt) => (
              <CollectionItem
                key={appt.id}
                appointment={appt}
                onMarkCollected={handleMarkCollected}
                isUpdating={updatingId === appt.id}
              />
            ))}
          </View>
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
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  // Section title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Quick actions
  qaGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 10,
  },
  qaCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  qaEmoji: { fontSize: 28, marginBottom: 8 },
  qaLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },

  // Collection list
  listContainer: { paddingHorizontal: 16 },
  collectionRow: { marginBottom: 4 },
  collectionInfo: { gap: 4 },
  collectionNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  collectionName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  collectionAddress: { fontSize: 13, color: Colors.textSecondary },
  collectionTime: { fontSize: 13, color: Colors.textSecondary },
  collectionTests: { fontSize: 13, color: Colors.textSecondary },
  collectButton: {
    marginTop: 10,
    backgroundColor: Colors.teal,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Loading / empty
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { marginHorizontal: 16 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
