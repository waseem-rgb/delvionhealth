import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Linking,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

// ---- Types ----

interface TestCatalogItem {
  name: string;
}

interface OrderItem {
  testCatalog: TestCatalogItem;
}

interface Report {
  status: string;
  pdfUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  items: OrderItem[];
  report: Report | null;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string | null;
  gender: string;
  phone: string | null;
  email: string | null;
  orders: Order[];
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

function getLastVisitDate(orders: Order[]): string {
  if (!orders || orders.length === 0) return '—';
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return formatDate(sorted[0].createdAt);
}

function getOrderStatusBadgeColor(status: string): 'green' | 'amber' | 'blue' | 'red' | 'grey' {
  const map: Record<string, 'green' | 'amber' | 'blue' | 'red' | 'grey'> = {
    RESULTED: 'green',
    REPORTED: 'green',
    IN_PROGRESS: 'blue',
    SAMPLE_COLLECTED: 'blue',
    PENDING: 'amber',
    CANCELLED: 'red',
  };
  return map[status] ?? 'grey';
}

// ---- Debounce hook ----

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (val: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setDebouncedValue(val);
      }, delay);
    },
    [delay],
  );

  return debouncedValue;
}

// ---- Patient Detail Modal ----

function PatientDetailModal({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const openPdf = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Avatar
              name={`${patient.firstName} ${patient.lastName}`}
              size={56}
              bg={Colors.navy}
            />
            <View style={styles.modalHeaderInfo}>
              <Text style={styles.modalPatientName}>
                {patient.firstName} {patient.lastName}
              </Text>
              <View style={styles.mrnRow}>
                <Badge label={patient.mrn} color="grey" />
              </View>
              <Text style={styles.modalMeta}>
                Age {calcAge(patient.dateOfBirth)} · {patient.gender}
              </Text>
              {patient.phone ? (
                <Text style={styles.modalMeta}>{patient.phone}</Text>
              ) : null}
              {patient.email ? (
                <Text style={styles.modalMeta}>{patient.email}</Text>
              ) : null}
            </View>
          </View>

          {/* Orders */}
          <Text style={styles.modalSectionTitle}>Recent Orders</Text>
          {patient.orders && patient.orders.length > 0 ? (
            patient.orders.slice(0, 4).map((order) => {
              const tests = order.items
                ?.slice(0, 3)
                .map((i) => i.testCatalog?.name)
                .filter(Boolean)
                .join(', ');
              const hasPdf = order.report?.pdfUrl;
              return (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderRowLeft}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                    {tests ? (
                      <Text style={styles.orderTests} numberOfLines={1}>
                        {tests}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.orderRowRight}>
                    <Badge
                      label={order.status.replace(/_/g, ' ')}
                      color={getOrderStatusBadgeColor(order.status)}
                    />
                    {hasPdf ? (
                      <TouchableOpacity
                        style={styles.pdfBtn}
                        onPress={() => openPdf(hasPdf)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.pdfBtnText}>View PDF</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyOrdersText}>No orders found</Text>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---- Patient Row Card ----

function PatientCard({
  patient,
  onPress,
}: {
  patient: Patient;
  onPress: () => void;
}) {
  const firstTests = patient.orders?.[0]?.items?.slice(0, 2).map((i) => i.testCatalog?.name).filter(Boolean) ?? [];
  const extraCount = (patient.orders?.[0]?.items?.length ?? 0) - 2;

  return (
    <Card>
      <View style={styles.patientRow}>
        <Avatar
          name={`${patient.firstName} ${patient.lastName}`}
          size={44}
          bg={Colors.teal}
        />
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>
            {patient.firstName} {patient.lastName}
          </Text>
          <View style={styles.patientMetaRow}>
            <Badge label={patient.mrn} color="grey" />
            <Text style={styles.patientMeta}>
              Age {calcAge(patient.dateOfBirth)} · {patient.gender}
            </Text>
          </View>
          <Text style={styles.lastVisit}>
            Last visit: {getLastVisitDate(patient.orders)}
          </Text>
          {firstTests.length > 0 && (
            <Text style={styles.testNames} numberOfLines={1}>
              {firstTests.join(', ')}
              {extraCount > 0 ? ` +${extraCount} more` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={onPress}
          activeOpacity={0.75}
        >
          <Text style={styles.viewBtnText}>View{'\n'}Reports</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ---- Main Screen ----

export default function PatientsScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Manually track debounced value
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 500);
  };

  const {
    data: patients,
    isLoading,
    refetch,
  } = useQuery<Patient[]>({
    queryKey: ['doctor-patients', debouncedSearch],
    queryFn: async () => {
      try {
        const url = debouncedSearch
          ? `/patients?search=${encodeURIComponent(debouncedSearch)}&limit=50`
          : '/patients?limit=50';
        const res = await apiClient.get<unknown>(url);
        const raw = res.data as Record<string, unknown>;
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
          ? (raw.data as unknown[])
          : [];
        return items as Patient[];
      } catch {
        return [];
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>My Patients</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or MRN..."
          placeholderTextColor={Colors.textSecondary}
          value={searchText}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              setDebouncedSearch('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Patient List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading patients...</Text>
        </View>
      ) : (
        <FlatList
          data={patients ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() => setSelectedPatient(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="👥"
              title={debouncedSearch ? 'No patients found' : 'No patients yet'}
              subtitle={
                debouncedSearch
                  ? `No results for "${debouncedSearch}"`
                  : 'Patients will appear here'
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },

  // Page header
  pageHeader: {
    backgroundColor: Colors.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    padding: 0,
  },
  clearIcon: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Patient card
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientInfo: { flex: 1 },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  patientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  patientMeta: { fontSize: 12, color: Colors.textSecondary },
  lastVisit: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  testNames: { fontSize: 12, color: Colors.teal, fontWeight: '500' },
  viewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  viewBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  modalHeaderInfo: { flex: 1 },
  modalPatientName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  mrnRow: { marginBottom: 4 },
  modalMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Order rows in modal
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  orderRowLeft: { flex: 1 },
  orderRowRight: { alignItems: 'flex-end', gap: 6 },
  orderNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  orderDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  orderTests: { fontSize: 12, color: Colors.teal },
  pdfBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pdfBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  emptyOrdersText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },

  closeBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
