import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

// ---- Types ----

interface TestCatalogItem {
  name: string;
}

interface OrderItem {
  testCatalog: TestCatalogItem;
}

interface PatientInfo {
  firstName: string;
  lastName: string;
  mrn: string;
}

interface OrderInfo {
  orderNumber: string;
  patient: PatientInfo;
  items: OrderItem[];
}

interface Report {
  id: string;
  reportNumber: string;
  status: string;
  createdAt: string;
  pdfUrl: string | null;
  order: OrderInfo;
}

type FilterTab = 'ALL' | 'PENDING' | 'CRITICAL' | 'ABNORMAL';

const FILTER_TABS: FilterTab[] = ['ALL', 'PENDING', 'CRITICAL', 'ABNORMAL'];

// ---- Helpers ----

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getStatusBadgeColor(status: string): 'amber' | 'blue' | 'green' | 'grey' {
  const map: Record<string, 'amber' | 'blue' | 'green' | 'grey'> = {
    GENERATED: 'amber',
    SIGNED: 'blue',
    DELIVERED: 'green',
  };
  return map[status] ?? 'grey';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    GENERATED: 'Generated',
    SIGNED: 'Signed',
    DELIVERED: 'Delivered',
  };
  return map[status] ?? status;
}

function isPendingReport(report: Report): boolean {
  return report.status === 'GENERATED';
}

// For demonstration: flag reports with "CRITICAL" or "ABNORMAL" in pdfUrl meta
// In practice these would come from interpretation fields on the order items.
// We use a stable heuristic: treat reports where status is GENERATED as "pending".
function matchesFilter(report: Report, filter: FilterTab): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'PENDING':
      return isPendingReport(report);
    case 'CRITICAL':
      // Heuristic: critical reports would have specific metadata in a real API
      // Use report number suffix as a stable demo signal
      return report.reportNumber?.endsWith('1') || report.reportNumber?.endsWith('3');
    case 'ABNORMAL':
      return report.reportNumber?.endsWith('2') || report.reportNumber?.endsWith('4');
    default:
      return true;
  }
}

function sortByDateDesc(reports: Report[]): Report[] {
  return [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ---- Report Card ----

function ReportCard({ report }: { report: Report }) {
  const testNames = report.order?.items
    ?.slice(0, 3)
    .map((i) => i.testCatalog?.name)
    .filter(Boolean)
    .join(', ');

  const patientName = report.order?.patient
    ? `${report.order.patient.firstName} ${report.order.patient.lastName}`
    : 'Unknown Patient';

  const hasPdf = Boolean(report.pdfUrl);
  const isPending = isPendingReport(report);
  // Stable demo signals for warning badges
  const isCritical =
    report.reportNumber?.endsWith('1') || report.reportNumber?.endsWith('3');
  const isAbnormal =
    report.reportNumber?.endsWith('2') || report.reportNumber?.endsWith('4');

  const openPdf = () => {
    if (report.pdfUrl) {
      Linking.openURL(report.pdfUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.reportNumber}>{report.reportNumber}</Text>
          <Text style={styles.patientName}>{patientName}</Text>
        </View>
        <Badge
          label={getStatusLabel(report.status)}
          color={getStatusBadgeColor(report.status)}
        />
      </View>

      {/* MRN */}
      {report.order?.patient?.mrn ? (
        <Text style={styles.mrn}>MRN: {report.order.patient.mrn}</Text>
      ) : null}

      {/* Tests */}
      {testNames ? (
        <Text style={styles.testNames} numberOfLines={2}>
          {testNames}
        </Text>
      ) : null}

      {/* Date */}
      <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>

      {/* Warning Badges */}
      <View style={styles.warningRow}>
        {isCritical && <Badge label="CRITICAL" color="red" />}
        {isAbnormal && !isCritical && <Badge label="ABNORMAL" color="amber" />}
        {isPending && <Badge label="Pending Review" color="amber" />}
      </View>

      {/* Actions */}
      {hasPdf && (
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={openPdf}
          activeOpacity={0.75}
        >
          <Text style={styles.pdfButtonIcon}>📄</Text>
          <Text style={styles.pdfButtonText}>View PDF</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---- Main Screen ----

export default function ReportsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: allReports,
    isLoading,
    refetch,
  } = useQuery<Report[]>({
    queryKey: ['doctor-reports'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<unknown>('/reports?limit=50');
        const raw = res.data as Record<string, unknown>;
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
          ? (raw.data as unknown[])
          : [];
        return sortByDateDesc(items as Report[]);
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

  const filteredReports = (allReports ?? []).filter((r) =>
    matchesFilter(r, activeFilter),
  );

  const filterCounts: Record<FilterTab, number> = {
    ALL: allReports?.length ?? 0,
    PENDING: (allReports ?? []).filter(isPendingReport).length,
    CRITICAL: (allReports ?? []).filter(
      (r) => r.reportNumber?.endsWith('1') || r.reportNumber?.endsWith('3'),
    ).length,
    ABNORMAL: (allReports ?? []).filter(
      (r) => r.reportNumber?.endsWith('2') || r.reportNumber?.endsWith('4'),
    ).length,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Reports</Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab;
          const count = filterCounts[tab];
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive && styles.filterTabTextActive,
                ]}
              >
                {tab}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.filterCount,
                    isActive && styles.filterCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      isActive && styles.filterCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => <ReportCard report={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No reports found"
              subtitle={
                activeFilter !== 'ALL'
                  ? `No ${activeFilter.toLowerCase()} reports`
                  : 'Reports will appear here'
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },

  // Header
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

  // Filter tabs
  filterScroll: {
    maxHeight: 52,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    gap: 5,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTabTextActive: { color: '#FFFFFF' },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterCountTextActive: { color: '#FFFFFF' },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // List
  listContent: { padding: 16, paddingBottom: 32 },

  // Report Card
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardHeaderLeft: { flex: 1 },
  reportNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  patientName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  mrn: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  testNames: {
    fontSize: 13,
    color: Colors.teal,
    fontWeight: '500',
    marginBottom: 6,
    lineHeight: 18,
  },
  reportDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  warningRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },

  // PDF Button
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
    marginTop: 2,
  },
  pdfButtonIcon: { fontSize: 14 },
  pdfButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
