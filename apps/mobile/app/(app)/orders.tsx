import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; mrn: string };
  items: Array<{ testCatalog: { name: string } }>;
}

const STATUSES = ['ALL', 'PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'REPORTED'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B', SAMPLE_COLLECTED: '#3B82F6', IN_PROGRESS: '#8B5CF6',
  RESULTED: '#10B981', REPORTED: '#6B7280', CANCELLED: '#EF4444',
};

export default function OrdersScreen() {
  const [activeStatus, setActiveStatus] = useState('ALL');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', activeStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (activeStatus !== 'ALL') params.set('status', activeStatus);
      const res = await api.get<{ data: Order[] } | Order[]>(`/orders?${params}`);
      const raw = res.data;
      return Array.isArray(raw) ? raw : (raw as { data: Order[] }).data ?? [];
    },
  });

  const renderOrder = useCallback(({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#6B7280' }]}>
          <Text style={styles.badgeText}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>
      <Text style={styles.patientName}>
        {item.patient.firstName} {item.patient.lastName}
      </Text>
      <Text style={styles.mrn}>MRN: {item.patient.mrn}</Text>
      <Text style={styles.tests}>
        {item.items.map(i => i.testCatalog.name).join(', ').slice(0, 80)}
        {item.items.map(i => i.testCatalog.name).join(', ').length > 80 ? '...' : ''}
      </Text>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  ), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Status filter tabs */}
      <View>
        <FlatList
          data={STATUSES}
          keyExtractor={(s) => s}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: status }) => (
            <TouchableOpacity
              style={[styles.filterBtn, activeStatus === status && styles.filterBtnActive]}
              onPress={() => setActiveStatus(status)}
            >
              <Text style={[styles.filterText, activeStatus === status && styles.filterTextActive]}>
                {status.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#0D7E8A" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{isLoading ? 'Loading...' : 'No orders found'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1F2937' },
  filterBtnActive: { backgroundColor: '#0D7E8A' },
  filterText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { color: '#fff', fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  patientName: { color: '#D1D5DB', fontSize: 14, fontWeight: '500', marginBottom: 2 },
  mrn: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  tests: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
  date: { color: '#4B5563', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#6B7280', fontSize: 16 },
});
