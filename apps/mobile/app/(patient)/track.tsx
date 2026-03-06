import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Card } from '../../components/ui';

// ---- Types ----

type OrderStatus =
  | 'PENDING'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'RESULTED'
  | 'DELIVERED'
  | string;

interface OrderItem {
  id: string;
  testCatalog?: { name: string };
}

interface Sample {
  id: string;
  barcode?: string;
  status?: string;
  receivedAt?: string;
  collectedAt?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  patient?: { firstName: string; lastName: string };
  items?: OrderItem[];
  samples?: Sample[];
  collectedAt?: string;
  receivedAt?: string;
  processedAt?: string;
  resultedAt?: string;
  reportedAt?: string;
}

// ---- Steps definition ----

interface TrackStep {
  label: string;
  description: string;
  completedStatuses: OrderStatus[];
  activeStatuses: OrderStatus[];
}

const TRACK_STEPS: TrackStep[] = [
  {
    label: 'Order Placed',
    description: 'Your test order has been confirmed.',
    completedStatuses: ['COLLECTED', 'RECEIVED', 'PROCESSING', 'RESULTED', 'DELIVERED'],
    activeStatuses: ['PENDING'],
  },
  {
    label: 'Sample Collected',
    description: 'Blood/sample has been collected from you.',
    completedStatuses: ['RECEIVED', 'PROCESSING', 'RESULTED', 'DELIVERED'],
    activeStatuses: ['COLLECTED'],
  },
  {
    label: 'Sample Received',
    description: 'Sample received at the laboratory.',
    completedStatuses: ['PROCESSING', 'RESULTED', 'DELIVERED'],
    activeStatuses: ['RECEIVED'],
  },
  {
    label: 'Processing',
    description: 'Analysis and testing is in progress.',
    completedStatuses: ['RESULTED', 'DELIVERED'],
    activeStatuses: ['PROCESSING'],
  },
  {
    label: 'Results Ready',
    description: 'Test results have been recorded.',
    completedStatuses: ['DELIVERED'],
    activeStatuses: ['RESULTED'],
  },
  {
    label: 'Report Delivered',
    description: 'Your report is ready to view and download.',
    completedStatuses: [],
    activeStatuses: ['DELIVERED'],
  },
];

type StepState = 'completed' | 'active' | 'pending';

function getStepState(step: TrackStep, status: OrderStatus): StepState {
  if (step.completedStatuses.includes(status)) return 'completed';
  if (step.activeStatuses.includes(status)) return 'active';
  return 'pending';
}

// ---- Helpers ----

function formatDate(dateStr: string): string {
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

function getStepTimestamp(step: TrackStep, order: Order): string | null {
  const label = step.label;
  if (label === 'Order Placed' && order.createdAt) return formatDate(order.createdAt);
  if (label === 'Sample Collected' && order.collectedAt) return formatDate(order.collectedAt);
  if (label === 'Sample Received' && order.receivedAt) return formatDate(order.receivedAt);
  if (label === 'Processing' && order.processedAt) return formatDate(order.processedAt);
  if (label === 'Results Ready' && order.resultedAt) return formatDate(order.resultedAt);
  if (label === 'Report Delivered' && order.reportedAt) return formatDate(order.reportedAt);
  return null;
}

// ---- Stepper ----

function OrderStepper({ order }: { order: Order }) {
  return (
    <View style={st.container}>
      {TRACK_STEPS.map((step, idx) => {
        const state = getStepState(step, order.status);
        const isLast = idx === TRACK_STEPS.length - 1;
        const timestamp = getStepTimestamp(step, order);

        return (
          <View key={step.label} style={st.stepRow}>
            {/* Circle + connector line */}
            <View style={st.lineColumn}>
              <View
                style={[
                  st.circle,
                  state === 'completed'
                    ? st.circleCompleted
                    : state === 'active'
                    ? st.circleActive
                    : st.circlePending,
                ]}
              >
                {state === 'completed' ? (
                  <Text style={st.checkIcon}>✓</Text>
                ) : state === 'active' ? (
                  <View style={st.activeDot} />
                ) : null}
              </View>
              {!isLast && (
                <View
                  style={[
                    st.connector,
                    state === 'completed' ? st.connectorDone : st.connectorPending,
                  ]}
                />
              )}
            </View>

            {/* Label + description */}
            <View style={st.textBlock}>
              <Text
                style={[
                  st.stepLabel,
                  state === 'pending' ? st.stepLabelPending : {},
                  state === 'active' ? st.stepLabelActive : {},
                ]}
              >
                {step.label}
              </Text>
              {state !== 'pending' && (
                <Text style={st.stepDesc}>{step.description}</Text>
              )}
              {timestamp && <Text style={st.timestamp}>{timestamp}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  stepRow: { flexDirection: 'row', marginBottom: 0 },
  lineColumn: { alignItems: 'center', marginRight: 14, width: 28 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleCompleted: { backgroundColor: Colors.teal },
  circleActive: { backgroundColor: Colors.navy, borderWidth: 2, borderColor: Colors.teal },
  circlePending: { backgroundColor: Colors.border },
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.teal,
  },
  connector: { width: 2, flex: 1, minHeight: 32, marginVertical: 2 },
  connectorDone: { backgroundColor: Colors.teal },
  connectorPending: { backgroundColor: Colors.border },
  textBlock: { flex: 1, paddingBottom: 24 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  stepLabelPending: { color: Colors.textSecondary },
  stepLabelActive: { color: Colors.teal },
  stepDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  timestamp: {
    fontSize: 11,
    color: Colors.teal,
    marginTop: 4,
    fontWeight: '500',
  },
});

// ---- Main Screen ----

export default function TrackScreen() {
  const [manualOrderNum, setManualOrderNum] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-fetch latest order on mount
  const { data: latestOrderData, isLoading: latestLoading } = useQuery<Order | null>({
    queryKey: ['latest-order', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get<
          { data?: Order[]; orders?: Order[] } | Order[]
        >('/orders?limit=1');
        const raw = res.data;
        const list: Order[] = Array.isArray(raw)
          ? raw
          : (raw as { data?: Order[]; orders?: Order[] }).data ??
            (raw as { data?: Order[]; orders?: Order[] }).orders ??
            [];
        return list[0] ?? null;
      } catch {
        return null;
      }
    },
    enabled: !lookupQuery,
  });

  const { data: searchedOrder, isLoading: searchLoading } = useQuery<Order | null>({
    queryKey: ['order-lookup', lookupQuery],
    queryFn: async () => {
      if (!lookupQuery.trim()) return null;
      try {
        const res = await apiClient.get<
          { data?: Order[]; orders?: Order[] } | Order[]
        >(`/orders?orderNumber=${encodeURIComponent(lookupQuery)}&limit=1`);
        const raw = res.data;
        const list: Order[] = Array.isArray(raw)
          ? raw
          : (raw as { data?: Order[]; orders?: Order[] }).data ??
            (raw as { data?: Order[]; orders?: Order[] }).orders ??
            [];
        return list[0] ?? null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(lookupQuery.trim()),
  });

  const order = lookupQuery.trim() ? searchedOrder : latestOrderData;
  const isLoading = lookupQuery.trim() ? searchLoading : latestLoading;

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSearch = () => {
    setLookupQuery(manualOrderNum.trim());
  };

  const handleClear = () => {
    setManualOrderNum('');
    setLookupQuery('');
  };

  const testNames =
    order?.items?.map((i) => i.testCatalog?.name).filter(Boolean).join(', ') ?? '';

  const patientFullName = order?.patient
    ? `${order.patient.firstName} ${order.patient.lastName}`.trim()
    : '';

  const barcode = order?.samples?.[0]?.barcode ?? null;

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Track Sample</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.teal} />
        }
        contentContainerStyle={s.scrollContent}
      >
        {/* Order number lookup */}
        <View style={s.searchCard}>
          <Text style={s.searchLabel}>Track by Order Number</Text>
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              placeholder="e.g. DH-ORD-20240301-0001"
              placeholderTextColor={Colors.textSecondary}
              value={manualOrderNum}
              onChangeText={setManualOrderNum}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {lookupQuery ? (
              <TouchableOpacity style={s.clearBtn} onPress={handleClear}>
                <Text style={s.clearBtnText}>✕</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.searchBtn} onPress={handleSearch}>
                <Text style={s.searchBtnText}>Search</Text>
              </TouchableOpacity>
            )}
          </View>
          {!lookupQuery && (
            <Text style={s.autoLoadHint}>Showing your latest order automatically.</Text>
          )}
        </View>

        {/* Loading state */}
        {isLoading && (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={Colors.teal} size="large" />
            <Text style={s.loadingText}>Loading order status...</Text>
          </View>
        )}

        {/* No order found */}
        {!isLoading && !order && (
          <Card style={s.emptyCard}>
            <Text style={s.emptyEmoji}>📦</Text>
            <Text style={s.emptyTitle}>No order found</Text>
            <Text style={s.emptySubtitle}>
              {lookupQuery
                ? `No order matching "${lookupQuery}" was found.`
                : 'You have no orders yet. Book a test to get started.'}
            </Text>
          </Card>
        )}

        {/* Order info card */}
        {!isLoading && order && (
          <>
            <Card style={s.orderInfoCard}>
              <View style={s.orderInfoRow}>
                <Text style={s.orderInfoLabel}>Order</Text>
                <Text style={s.orderInfoValue}>{order.orderNumber}</Text>
              </View>
              {patientFullName ? (
                <View style={s.orderInfoRow}>
                  <Text style={s.orderInfoLabel}>Patient</Text>
                  <Text style={s.orderInfoValue}>{patientFullName}</Text>
                </View>
              ) : null}
              {testNames ? (
                <View style={s.orderInfoRow}>
                  <Text style={s.orderInfoLabel}>Tests</Text>
                  <Text style={[s.orderInfoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                    {testNames}
                  </Text>
                </View>
              ) : null}
              <View style={s.orderInfoRow}>
                <Text style={s.orderInfoLabel}>Booked On</Text>
                <Text style={s.orderInfoValue}>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={[s.orderInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={s.orderInfoLabel}>Status</Text>
                <View style={[s.statusBadge, { backgroundColor: getStatusBgColor(order.status) }]}>
                  <Text style={[s.statusBadgeText, { color: getStatusTextColor(order.status) }]}>
                    {order.status?.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Barcode */}
            {barcode && (
              <Card style={s.barcodeCard}>
                <Text style={s.barcodeLabel}>Sample Barcode</Text>
                <Text style={s.barcodeText}>{barcode}</Text>
              </Card>
            )}

            {/* Vertical stepper */}
            <Text style={s.stepperTitle}>Order Progress</Text>
            <Card>
              <OrderStepper order={order} />
            </Card>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'PENDING': return '#FEF3C7';
    case 'COLLECTED': return '#DBEAFE';
    case 'RECEIVED': return '#E0E7FF';
    case 'PROCESSING': return '#F3E8FF';
    case 'RESULTED': return '#CCFBF1';
    case 'DELIVERED': return '#DCFCE7';
    default: return Colors.border;
  }
}

function getStatusTextColor(status: string): string {
  switch (status) {
    case 'PENDING': return '#92400E';
    case 'COLLECTED': return Colors.primary;
    case 'RECEIVED': return '#3730A3';
    case 'PROCESSING': return '#7C3AED';
    case 'RESULTED': return Colors.teal;
    case 'DELIVERED': return Colors.success;
    default: return Colors.textSecondary;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingBottom: 32 },
  searchCard: {
    backgroundColor: Colors.cardBg,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'monospace' as const,
  },
  searchBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  clearBtn: {
    backgroundColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  clearBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  autoLoadHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 8 },
  loadingBlock: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  emptyCard: { marginHorizontal: 16, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  orderInfoCard: { marginHorizontal: 16 },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderInfoLabel: { fontSize: 13, color: Colors.textSecondary },
  orderInfoValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  barcodeCard: { marginHorizontal: 16 },
  barcodeLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  barcodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
  },
  stepperTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
});
