import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/lib/api';

interface OrderSummary {
  id: string;
  orderNumber: string;
  patientName: string;
  status: string;
  createdAt: string;
  testCount: number;
}

interface DashboardData {
  pendingOrders: number;
  pendingSamples: number;
  recentOrders: OrderSummary[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  SAMPLE_COLLECTED: '#3B82F6',
  IN_PROGRESS: '#8B5CF6',
  RESULTED: '#10B981',
  REPORTED: '#6B7280',
  CANCELLED: '#EF4444',
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, samplesRes] = await Promise.all([
        api.get<{ data: Array<{ id: string; orderNumber: string; patient: { firstName: string; lastName: string }; status: string; createdAt: string; items: unknown[] }> }>('/orders?limit=5'),
        api.get<{ data: unknown[] }>('/samples?status=PENDING_COLLECTION&limit=1'),
      ]);
      const orders = ordersRes.data.data ?? (ordersRes.data as unknown as Array<{ id: string; orderNumber: string; patient: { firstName: string; lastName: string }; status: string; createdAt: string; items: unknown[] }>);
      setData({
        pendingOrders: 0,
        pendingSamples: 0,
        recentOrders: (Array.isArray(orders) ? orders : []).slice(0, 5).map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          patientName: `${o.patient?.firstName ?? ''} ${o.patient?.lastName ?? ''}`.trim(),
          status: o.status,
          createdAt: o.createdAt,
          testCount: Array.isArray(o.items) ? o.items.length : 0,
        })),
      });
    } catch (err) {
      console.warn('Home fetch error:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7E8A" />}
      >
        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>Good morning,</Text>
          <Text style={styles.userName}>{user?.firstName ?? 'User'}</Text>
          <Text style={styles.userRole}>{user?.role?.replace(/_/g, ' ')}</Text>
        </View>

        {/* Recent Orders */}
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {data?.recentOrders.map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] ?? '#6B7280' }]}>
                <Text style={styles.statusText}>{order.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.patientName}>{order.patientName || 'Unknown Patient'}</Text>
            <View style={styles.orderMeta}>
              <Ionicons name="flask-outline" size={12} color="#6B7280" />
              <Text style={styles.metaText}>{order.testCount} test{order.testCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{new Date(order.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        ))}
        {(!data?.recentOrders || data.recentOrders.length === 0) && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#374151" />
            <Text style={styles.emptyText}>No recent orders</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16, paddingBottom: 32 },
  welcomeCard: { backgroundColor: '#0D7E8A', borderRadius: 16, padding: 20, marginBottom: 24 },
  welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  sectionTitle: { color: '#D1D5DB', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  orderCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  patientName: { color: '#9CA3AF', fontSize: 14, marginBottom: 6 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#6B7280', fontSize: 12 },
  metaDot: { color: '#6B7280', fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#6B7280', fontSize: 16, marginTop: 12 },
});
