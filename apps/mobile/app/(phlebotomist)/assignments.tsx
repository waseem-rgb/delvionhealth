import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Avatar, Badge, Card, EmptyState } from '../../components/ui';

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
    orderNumber?: string;
  };
}

interface AppointmentsResponse {
  data?: Appointment[];
  appointments?: Appointment[];
}

type FilterStatus = 'ALL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// ---- Constants ----

const FILTER_TABS: Array<{ label: string; value: FilterStatus }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'SCHEDULED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
];

// ---- Helpers ----

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

// ---- Assignment Card ----

function AssignmentCard({
  appointment,
  onStartCollection,
  onMarkComplete,
  isUpdating,
}: {
  appointment: Appointment;
  onStartCollection: (id: string) => void;
  onMarkComplete: (id: string) => void;
  isUpdating: boolean;
}) {
  const patientName = appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
    : 'Unknown Patient';

  const initials = patientName.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const testNames =
    appointment.order?.items
      ?.map((i) => i.testCatalog?.name)
      .filter(Boolean)
      .join(', ') ?? 'Tests pending';

  const address = appointment.patient?.address ?? null;
  const dateTime = formatDateTime(appointment.appointmentDate);
  const statusColor = getStatusColor(appointment.status);

  const isScheduled = appointment.status === 'SCHEDULED';
  const isInProgress = appointment.status === 'IN_PROGRESS';

  return (
    <Card>
      {/* Top row: Avatar + Info + Badge */}
      <View style={s.cardTopRow}>
        <Avatar name={patientName} size={44} bg={Colors.navy} />
        <View style={s.cardInfo}>
          <Text style={s.patientName}>{patientName}</Text>
          {address ? (
            <Text style={s.addressText} numberOfLines={1}>
              📍 {address}
            </Text>
          ) : null}
          <Text style={s.dateText}>🕐 {dateTime}</Text>
          <Text style={s.testsText} numberOfLines={2}>
            🧪 {testNames}
          </Text>
        </View>
        <Badge label={appointment.status.replace(/_/g, ' ')} color={statusColor} />
      </View>

      {/* Action buttons */}
      {isScheduled && (
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: Colors.primary }]}
          onPress={() => onStartCollection(appointment.id)}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.actionBtnText}>Start Collection</Text>
          )}
        </TouchableOpacity>
      )}

      {isInProgress && (
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: Colors.success }]}
          onPress={() => onMarkComplete(appointment.id)}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.actionBtnText}>Mark Complete</Text>
          )}
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ---- Main Component ----

export default function AssignmentsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const {
    data: appointmentsData,
    isLoading,
    refetch,
  } = useQuery<AppointmentsResponse>({
    queryKey: ['phlebotomist-assignments', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/appointments?assignedTo=ME&limit=100');
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

  const handleStartCollection = useCallback(
    async (appointmentId: string) => {
      setUpdatingId(appointmentId);
      try {
        await apiClient.patch(`/appointments/${appointmentId}`, { status: 'IN_PROGRESS' });
        await refetch();
      } catch {
        // silently handle; UI unchanged
      } finally {
        setUpdatingId(null);
      }
    },
    [refetch]
  );

  const handleMarkComplete = useCallback(
    async (appointmentId: string) => {
      setUpdatingId(appointmentId);
      try {
        await apiClient.patch(`/appointments/${appointmentId}`, { status: 'COMPLETED' });
        await refetch();
      } catch {
        // silently handle; UI unchanged
      } finally {
        setUpdatingId(null);
      }
    },
    [refetch]
  );

  const allAppointments: Appointment[] =
    appointmentsData?.data ?? appointmentsData?.appointments ?? [];

  const filteredAppointments =
    activeFilter === 'ALL'
      ? allAppointments
      : allAppointments.filter((a) => a.status === activeFilter);

  const renderItem = useCallback(
    ({ item }: { item: Appointment }) => (
      <AssignmentCard
        appointment={item}
        onStartCollection={handleStartCollection}
        onMarkComplete={handleMarkComplete}
        isUpdating={updatingId === item.id}
      />
    ),
    [handleStartCollection, handleMarkComplete, updatingId]
  );

  const keyExtractor = useCallback((item: Appointment) => item.id, []);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Screen Header */}
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>My Assignments</Text>
        <Text style={s.screenSubtitle}>{allAppointments.length} total</Text>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterContainer}>
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === 'ALL'
              ? allAppointments.length
              : allAppointments.filter((a) => a.status === tab.value).length;
          const isActive = activeFilter === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={[s.filterTab, isActive && s.filterTabActive]}
              onPress={() => setActiveFilter(tab.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterTabText, isActive && s.filterTabTextActive]}>
                {tab.label}
              </Text>
              <View style={[s.filterBadge, isActive && s.filterBadgeActive]}>
                <Text style={[s.filterBadgeText, isActive && s.filterBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.teal} />
          <Text style={s.loadingText}>Loading assignments...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            s.listContent,
            filteredAppointments.length === 0 && s.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No assignments found"
              subtitle={
                activeFilter === 'ALL'
                  ? 'You have no assignments yet.'
                  : `No ${activeFilter.replace(/_/g, ' ').toLowerCase()} assignments.`
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Screen Header
  screenHeader: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  screenSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: Colors.teal,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: Colors.border,
    borderRadius: 99,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterBadgeTextActive: {
    color: '#fff',
  },

  // List
  listContent: { padding: 16, paddingBottom: 32 },
  listContentEmpty: { flex: 1 },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },

  // Card
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  cardInfo: { flex: 1, gap: 3 },
  patientName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  addressText: { fontSize: 12, color: Colors.textSecondary },
  dateText: { fontSize: 12, color: Colors.textSecondary },
  testsText: { fontSize: 12, color: Colors.textSecondary },

  // Action button
  actionBtn: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
