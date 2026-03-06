import { Linking } from 'react-native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

interface Report {
  id: string;
  reportNumber: string;
  status: string;
  createdAt: string;
  pdfUrl: string | null;
  order: {
    orderNumber: string;
    patient: { firstName: string; lastName: string };
  };
}

const STATUS_COLORS: Record<string, string> = {
  GENERATED: '#3B82F6', SIGNED: '#8B5CF6', DELIVERED: '#10B981',
};

export default function ReportsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await api.get<{ data: Report[] } | Report[]>('/reports?limit=50');
      const raw = res.data;
      return Array.isArray(raw) ? raw : (raw as { data: Report[] }).data ?? [];
    },
  });

  const openReport = (report: Report) => {
    if (report.pdfUrl) {
      Linking.openURL(report.pdfUrl);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#0D7E8A" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openReport(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.reportNumber}>{item.reportNumber}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#6B7280' }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.orderNum}>Order: {item.order?.orderNumber}</Text>
            <Text style={styles.patient}>
              {item.order?.patient?.firstName} {item.order?.patient?.lastName}
            </Text>
            <View style={styles.footer}>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              {item.pdfUrl && (
                <View style={styles.downloadHint}>
                  <Ionicons name="download-outline" size={14} color="#0D7E8A" />
                  <Text style={styles.downloadText}>Tap to open</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color="#374151" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading...' : 'No reports found'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  list: { padding: 16 },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reportNumber: { color: '#fff', fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  orderNum: { color: '#9CA3AF', fontSize: 13, marginBottom: 2 },
  patient: { color: '#D1D5DB', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#6B7280', fontSize: 12 },
  downloadHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  downloadText: { color: '#0D7E8A', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#6B7280', fontSize: 16, marginTop: 12 },
});
