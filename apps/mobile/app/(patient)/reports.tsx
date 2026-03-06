import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Badge, Button, Card, EmptyState } from '../../components/ui';

// ---- Types ----

type ReportStatus = 'GENERATED' | 'SIGNED' | 'DELIVERED' | 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | string;

interface ReportItem {
  id: string;
  reportNumber: string;
  status: ReportStatus;
  createdAt: string;
  pdfUrl?: string;
  order?: {
    orderNumber?: string;
    items?: Array<{ testCatalog?: { name: string } }>;
    patient?: { firstName: string; lastName: string };
  };
}

type FilterTab = 'ALL' | 'NORMAL' | 'ABNORMAL' | 'CRITICAL';

// ---- Helpers ----

function getStatusBadgeColor(status: string): 'green' | 'amber' | 'red' | 'grey' {
  const s = status.toUpperCase();
  if (s === 'NORMAL' || s === 'SIGNED' || s === 'DELIVERED') return 'green';
  if (s === 'ABNORMAL') return 'amber';
  if (s === 'CRITICAL') return 'red';
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

function getTestNames(report: ReportItem): string {
  return (
    report.order?.items
      ?.map((i) => i.testCatalog?.name)
      .filter(Boolean)
      .join(', ') ?? 'Lab Report'
  );
}

function matchesFilter(report: ReportItem, filter: FilterTab): boolean {
  if (filter === 'ALL') return true;
  return report.status.toUpperCase() === filter;
}

// ---- Report Card ----

function ReportCard({ report, onPress }: { report: ReportItem; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Card>
        <View style={s.reportRow}>
          <View style={s.reportMain}>
            <Text style={s.reportTests} numberOfLines={2}>
              {getTestNames(report)}
            </Text>
            <Text style={s.reportDate}>{formatDate(report.createdAt)}</Text>
            {report.order?.orderNumber ? (
              <Text style={s.reportOrderNum}>{report.order.orderNumber}</Text>
            ) : null}
          </View>
          <View style={s.reportRight}>
            <Badge label={report.status} color={getStatusBadgeColor(report.status)} />
            <Text style={s.viewMore}>View →</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ---- Detail Modal ----

function ReportDetailModal({
  report,
  visible,
  onClose,
}: {
  report: ReportItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!report) return null;

  const testNames = getTestNames(report);
  const hasPdf = Boolean(report.pdfUrl);

  const openPdf = async () => {
    if (report.pdfUrl) {
      try {
        await Linking.openURL(report.pdfUrl);
      } catch {
        // silently fail on unsupported deep link
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={m.container} edges={['top', 'left', 'right', 'bottom']}>
        {/* Modal Header */}
        <View style={m.header}>
          <Text style={m.headerTitle}>Report Details</Text>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <Text style={m.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Status badge */}
          <View style={m.statusRow}>
            <Badge label={report.status} color={getStatusBadgeColor(report.status)} />
          </View>

          {/* Report info */}
          <View style={m.infoSection}>
            <View style={m.infoRow}>
              <Text style={m.infoLabel}>Report No.</Text>
              <Text style={m.infoValue}>{report.reportNumber}</Text>
            </View>
            {report.order?.orderNumber ? (
              <View style={m.infoRow}>
                <Text style={m.infoLabel}>Order No.</Text>
                <Text style={m.infoValue}>{report.order.orderNumber}</Text>
              </View>
            ) : null}
            <View style={m.infoRow}>
              <Text style={m.infoLabel}>Date</Text>
              <Text style={m.infoValue}>{formatDate(report.createdAt)}</Text>
            </View>
          </View>

          {/* Tests */}
          <View style={m.section}>
            <Text style={m.sectionTitle}>Tests Included</Text>
            {report.order?.items?.length ? (
              report.order.items.map((item, idx) => (
                <View key={idx} style={m.testRow}>
                  <Text style={m.testDot}>•</Text>
                  <Text style={m.testName}>{item.testCatalog?.name ?? 'Unknown Test'}</Text>
                </View>
              ))
            ) : (
              <Text style={m.fallbackText}>{testNames}</Text>
            )}
          </View>

          {/* PDF Actions */}
          <View style={m.actionsSection}>
            <Button
              label="View PDF"
              onPress={openPdf}
              disabled={!hasPdf}
              fullWidth
              style={{ marginBottom: 12 }}
            />
            <Button
              label="Download Report"
              onPress={openPdf}
              variant="outline"
              disabled={!hasPdf}
              fullWidth
            />
            {!hasPdf && (
              <Text style={m.noPdfText}>PDF not yet available for this report.</Text>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: Colors.textSecondary },
  statusRow: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
  infoSection: {
    backgroundColor: Colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  testDot: { color: Colors.teal, fontSize: 16, marginRight: 8, lineHeight: 20 },
  testName: { fontSize: 14, color: Colors.textPrimary, flex: 1, lineHeight: 20 },
  fallbackText: { fontSize: 14, color: Colors.textPrimary },
  actionsSection: { marginHorizontal: 16, marginTop: 8 },
  noPdfText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
});

// ---- Filter Tabs ----

const FILTER_TABS: FilterTab[] = ['ALL', 'NORMAL', 'ABNORMAL', 'CRITICAL'];

function FilterTabs({
  active,
  onChange,
}: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={ft.row}
      contentContainerStyle={ft.content}
    >
      {FILTER_TABS.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[ft.tab, active === tab ? ft.tabActive : {}]}
          onPress={() => onChange(tab)}
        >
          <Text style={[ft.tabText, active === tab ? ft.tabTextActive : {}]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const ft = StyleSheet.create({
  row: { backgroundColor: Colors.cardBg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  content: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  tabActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
});

// ---- Main Screen ----

export default function ReportsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching } = useQuery<ReportItem[]>({
    queryKey: ['patient-reports', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get<
          { data?: ReportItem[]; reports?: ReportItem[] } | ReportItem[]
        >('/reports?patientId=ME&limit=50');
        const raw = res.data;
        if (Array.isArray(raw)) return raw;
        return (raw as { data?: ReportItem[]; reports?: ReportItem[] }).data ??
          (raw as { data?: ReportItem[]; reports?: ReportItem[] }).reports ??
          [];
      } catch {
        return [];
      }
    },
  });

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const reports = data ?? [];
  const filtered = reports.filter((r) => matchesFilter(r, activeFilter));

  const openReport = (report: ReportItem) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>My Reports</Text>
        {isFetching && <ActivityIndicator color={Colors.teal} size="small" />}
      </View>

      {/* Filter tabs */}
      <FilterTabs active={activeFilter} onChange={setActiveFilter} />

      {/* List */}
      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={Colors.teal} size="large" />
          <Text style={s.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={Colors.teal} />
          }
          renderItem={({ item }) => (
            <ReportCard report={item} onPress={() => openReport(item)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="📄"
              title="No reports yet"
              subtitle={
                activeFilter === 'ALL'
                  ? 'Your lab reports will appear here once ready.'
                  : `No ${activeFilter.toLowerCase()} reports found.`
              }
            />
          }
        />
      )}

      {/* Detail modal */}
      <ReportDetailModal
        report={selectedReport}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedReport(null);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reportMain: { flex: 1, marginRight: 8 },
  reportTests: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  reportDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  reportOrderNum: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  reportRight: { alignItems: 'flex-end', gap: 8 },
  viewMore: { fontSize: 12, color: Colors.teal, fontWeight: '600', marginTop: 4 },
});
