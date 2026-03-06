import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

// ---- Types ----

interface DashboardData {
  totalPatients?: number;
  pendingReports?: number;
  criticalToday?: number;
}

interface CriticalResult {
  id: string;
  testName: string;
  value: string;
  numericValue: number | null;
  interpretation: string;
  order: {
    patient: { firstName: string; lastName: string; id: string };
  };
}

interface RecentPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string | null;
  gender: string;
  orders: Array<{
    id: string;
    createdAt: string;
    items: Array<{ testCatalog: { name: string } }>;
    report: { status: string } | null;
  }>;
}

interface PatientSummaryModal {
  visible: boolean;
  patient: RecentPatient | null;
}

// ---- Helpers ----

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  return String(age);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

// ---- Sub-components ----

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CriticalResultCard({ result }: { result: CriticalResult }) {
  const patientName = `${result.order?.patient?.firstName ?? ''} ${result.order?.patient?.lastName ?? ''}`.trim();
  return (
    <View style={styles.criticalItem}>
      <View style={styles.criticalLeft}>
        <Text style={styles.criticalPatient}>{patientName || 'Unknown'}</Text>
        <Text style={styles.criticalTest}>{result.testName}</Text>
        {result.value ? (
          <Text style={styles.criticalValue}>Value: {result.value}</Text>
        ) : null}
      </View>
      <Badge label="CRITICAL" color="red" />
    </View>
  );
}

// ---- Main Screen ----

export default function DoctorDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [patientModal, setPatientModal] = useState<PatientSummaryModal>({
    visible: false,
    patient: null,
  });

  // Dashboard stats
  const {
    data: dashData,
    isLoading: dashLoading,
    refetch: refetchDash,
  } = useQuery<DashboardData>({
    queryKey: ['doctor-dashboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<unknown>('/analytics/dashboard');
        const raw = res.data as Record<string, unknown>;
        return {
          totalPatients:
            typeof raw.totalPatients === 'number' ? raw.totalPatients : 0,
          pendingReports: 0,
          criticalToday: 0,
        };
      } catch {
        return { totalPatients: 0, pendingReports: 0, criticalToday: 0 };
      }
    },
  });

  // Critical results
  const {
    data: criticalResults,
    isLoading: criticalLoading,
    refetch: refetchCritical,
  } = useQuery<CriticalResult[]>({
    queryKey: ['doctor-critical-results'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<unknown>(
          '/results?interpretation=CRITICAL&limit=5',
        );
        const raw = res.data as Record<string, unknown>;
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
          ? (raw.data as unknown[])
          : [];
        return items as CriticalResult[];
      } catch {
        return [];
      }
    },
  });

  // Recent patients
  const {
    data: recentPatients,
    isLoading: patientsLoading,
    refetch: refetchPatients,
  } = useQuery<RecentPatient[]>({
    queryKey: ['doctor-recent-patients'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<unknown>('/patients?limit=10');
        const raw = res.data as Record<string, unknown>;
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
          ? (raw.data as unknown[])
          : [];
        return items as RecentPatient[];
      } catch {
        return [];
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchDash(), refetchCritical(), refetchPatients()]);
    setRefreshing(false);
  }, [refetchDash, refetchCritical, refetchPatients]);

  const doctorName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const isLoading = dashLoading || criticalLoading || patientsLoading;

  const hasCritical = (criticalResults?.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerWelcome}>Welcome back</Text>
            <Text style={styles.headerName}>Dr. {doctorName}</Text>
          </View>
          <Avatar name={doctorName || 'Doctor'} size={48} bg={Colors.navy} />
        </View>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total Patients"
            value={dashData?.totalPatients ?? '—'}
            color={Colors.primary}
          />
          <StatCard
            label="Pending Reports"
            value={dashData?.pendingReports ?? '—'}
            color={Colors.amber}
          />
          <StatCard
            label="Critical Today"
            value={dashData?.criticalToday ?? (criticalResults?.length ?? '—')}
            color={Colors.danger}
          />
        </View>

        {/* Critical Results Alert */}
        {hasCritical && (
          <View style={styles.criticalAlert}>
            <View style={styles.criticalAlertHeader}>
              <Text style={styles.criticalAlertIcon}>🚨</Text>
              <Text style={styles.criticalAlertTitle}>
                Critical Results ({criticalResults!.length})
              </Text>
            </View>
            {criticalResults!.map((r) => (
              <CriticalResultCard key={r.id} result={r} />
            ))}
          </View>
        )}

        {/* Recent Patients */}
        <Text style={styles.sectionTitle}>Recent Patients</Text>
        {recentPatients && recentPatients.length > 0 ? (
          <FlatList
            data={recentPatients}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const lastOrder = item.orders?.[0];
              const testNames = lastOrder?.items
                ?.slice(0, 2)
                .map((i) => i.testCatalog?.name)
                .filter(Boolean)
                .join(', ');
              return (
                <TouchableOpacity
                  onPress={() => setPatientModal({ visible: true, patient: item })}
                  activeOpacity={0.75}
                >
                  <Card>
                    <View style={styles.patientRow}>
                      <Avatar
                        name={`${item.firstName} ${item.lastName}`}
                        size={40}
                        bg={Colors.teal}
                      />
                      <View style={styles.patientInfo}>
                        <Text style={styles.patientName}>
                          {item.firstName} {item.lastName}
                        </Text>
                        <Text style={styles.patientMeta}>
                          MRN: {item.mrn} · Age {calcAge(item.dateOfBirth)} ·{' '}
                          {item.gender}
                        </Text>
                        {testNames ? (
                          <Text style={styles.patientTests} numberOfLines={1}>
                            {testNames}
                          </Text>
                        ) : null}
                        {lastOrder?.createdAt ? (
                          <Text style={styles.patientDate}>
                            Last visit: {formatDate(lastOrder.createdAt)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          !isLoading && (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No recent patients</Text>
            </View>
          )
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(doctor)/patients')}
            activeOpacity={0.75}
          >
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={styles.quickActionLabel}>All Patients</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(doctor)/reports')}
            activeOpacity={0.75}
          >
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionLabel}>Pending Reports</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Patient Summary Modal */}
      <Modal
        visible={patientModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setPatientModal({ visible: false, patient: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {patientModal.patient && (
              <>
                <View style={styles.modalHeader}>
                  <Avatar
                    name={`${patientModal.patient.firstName} ${patientModal.patient.lastName}`}
                    size={52}
                    bg={Colors.navy}
                  />
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalPatientName}>
                      {patientModal.patient.firstName}{' '}
                      {patientModal.patient.lastName}
                    </Text>
                    <Text style={styles.modalPatientMeta}>
                      MRN: {patientModal.patient.mrn}
                    </Text>
                    <Text style={styles.modalPatientMeta}>
                      Age: {calcAge(patientModal.patient.dateOfBirth)} ·{' '}
                      {patientModal.patient.gender}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Recent Tests</Text>
                {patientModal.patient.orders?.length > 0 ? (
                  patientModal.patient.orders.slice(0, 3).map((order) => {
                    const reportStatus = order.report?.status;
                    const badgeColor =
                      reportStatus === 'DELIVERED'
                        ? 'green'
                        : reportStatus === 'SIGNED'
                        ? 'blue'
                        : reportStatus === 'GENERATED'
                        ? 'amber'
                        : 'grey';
                    return (
                      <View key={order.id} style={styles.modalOrderRow}>
                        <View>
                          <Text style={styles.modalOrderTests}>
                            {order.items
                              ?.slice(0, 2)
                              .map((i) => i.testCatalog?.name)
                              .filter(Boolean)
                              .join(', ') || 'No tests'}
                          </Text>
                          <Text style={styles.modalOrderDate}>
                            {formatDate(order.createdAt)}
                          </Text>
                        </View>
                        {reportStatus && (
                          <Badge label={reportStatus} color={badgeColor} />
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.modalEmptyText}>No orders found</Text>
                )}
              </>
            )}

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setPatientModal({ visible: false, patient: null })}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  headerWelcome: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 2 },
  headerName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Critical Alert
  criticalAlert: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
  },
  criticalAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  criticalAlertIcon: { fontSize: 18 },
  criticalAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
  },
  criticalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  criticalLeft: { flex: 1, marginRight: 8 },
  criticalPatient: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  criticalTest: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  criticalValue: { fontSize: 12, color: Colors.danger, marginTop: 1, fontWeight: '600' },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },

  // Patient card
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  patientMeta: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  patientTests: { fontSize: 12, color: Colors.teal, marginBottom: 2 },
  patientDate: { fontSize: 11, color: Colors.textSecondary },

  // Empty
  emptyBlock: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: { fontSize: 28, marginBottom: 6 },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  modalHeaderInfo: { flex: 1 },
  modalPatientName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalPatientMeta: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOrderTests: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500', maxWidth: 220 },
  modalOrderDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  modalEmptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  modalCloseBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
