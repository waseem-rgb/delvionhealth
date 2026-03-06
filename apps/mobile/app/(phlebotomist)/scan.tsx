import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Card, Input, Button, Badge } from '../../components/ui';

// ---- Types ----

interface OrderItem {
  testCatalog?: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  patient?: {
    firstName: string;
    lastName: string;
  };
  items?: OrderItem[];
}

interface OrdersResponse {
  data?: Order[];
  orders?: Order[];
}

interface AccessionResponse {
  id: string;
  barcode?: string;
  barcodeId?: string;
  status: string;
}

type TubeType = 'EDTA' | 'SST' | 'Heparin' | 'Plain';

const TUBE_TYPES: TubeType[] = ['EDTA', 'SST', 'Heparin', 'Plain'];

// ---- Tube Type Selector ----

function TubeTypeSelector({
  selected,
  onSelect,
}: {
  selected: TubeType | null;
  onSelect: (type: TubeType) => void;
}) {
  return (
    <View style={s.tubeRow}>
      {TUBE_TYPES.map((type) => {
        const isSelected = selected === type;
        return (
          <TouchableOpacity
            key={type}
            style={[s.tubeOption, isSelected && s.tubeOptionSelected]}
            onPress={() => onSelect(type)}
            activeOpacity={0.75}
          >
            <Text style={[s.tubeOptionText, isSelected && s.tubeOptionTextSelected]}>
              {type}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---- Success Card ----

function SuccessCard({
  barcode,
  orderNumber,
  onScanAnother,
}: {
  barcode: string;
  orderNumber: string;
  onScanAnother: () => void;
}) {
  return (
    <Card style={s.successCard}>
      <View style={s.successIcon}>
        <Text style={s.successIconText}>✅</Text>
      </View>
      <Text style={s.successTitle}>Sample Collected!</Text>
      <Text style={s.successSub}>Collection confirmed successfully</Text>

      <View style={s.barcodeCard}>
        <Text style={s.barcodeLabel}>Order</Text>
        <Text style={s.barcodeOrderNum}>{orderNumber}</Text>
        <Text style={s.barcodeLabel}>Sample Barcode</Text>
        <Text style={s.barcodeValue}>{barcode}</Text>
      </View>

      <Button label="Scan Another" onPress={onScanAnother} fullWidth />
    </Card>
  );
}

// ---- Main Component ----

export default function ScanScreen() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Collection form
  const [volume, setVolume] = useState('');
  const [tubeType, setTubeType] = useState<TubeType | null>(null);
  const [notes, setNotes] = useState('');
  const [collectLoading, setCollectLoading] = useState(false);

  // Success state
  const [successBarcode, setSuccessBarcode] = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    const query = barcodeInput.trim();
    if (!query) {
      Alert.alert('Input required', 'Please enter an order number or barcode.');
      return;
    }

    setSearchLoading(true);
    setFoundOrder(null);
    setOrderError(null);
    setSuccessBarcode(null);
    setVolume('');
    setTubeType(null);
    setNotes('');

    try {
      const res = await apiClient.get(`/orders?search=${encodeURIComponent(query)}&limit=1`);
      const responseData = res.data as OrdersResponse;
      const orders: Order[] = responseData?.data ?? responseData?.orders ?? (Array.isArray(res.data) ? (res.data as Order[]) : []);

      if (orders.length === 0) {
        setOrderError('No order found for that barcode or order number.');
      } else {
        const order = orders[0];
        if (order.status === 'COLLECTED' || order.status === 'COMPLETED') {
          setOrderError('This order has already been collected.');
        } else {
          setFoundOrder(order);
        }
      }
    } catch {
      setOrderError('Failed to look up order. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [barcodeInput]);

  const handleConfirmCollection = useCallback(async () => {
    if (!foundOrder) return;

    if (!tubeType) {
      Alert.alert('Required', 'Please select a tube type.');
      return;
    }

    setCollectLoading(true);
    try {
      const res = await apiClient.post<AccessionResponse>('/samples/accession', {
        orderId: foundOrder.id,
        volume: volume ? parseFloat(volume) : undefined,
        tubeType,
        notes: notes.trim() || undefined,
      });

      const barcode = res.data?.barcode ?? res.data?.barcodeId ?? `SAMPLE-${foundOrder.id.slice(0, 8)}`;
      setSuccessBarcode(barcode);
      setFoundOrder(null);
    } catch {
      Alert.alert('Collection Failed', 'Could not confirm sample collection. Please try again.');
    } finally {
      setCollectLoading(false);
    }
  }, [foundOrder, volume, tubeType, notes]);

  const handleReset = useCallback(() => {
    setBarcodeInput('');
    setFoundOrder(null);
    setOrderError(null);
    setSuccessBarcode(null);
    setVolume('');
    setTubeType(null);
    setNotes('');
  }, []);

  const patientName = foundOrder?.patient
    ? `${foundOrder.patient.firstName} ${foundOrder.patient.lastName}`.trim()
    : 'Unknown Patient';

  const testNames =
    foundOrder?.items
      ?.map((i) => i.testCatalog?.name)
      .filter(Boolean)
      .join(', ') ?? 'Tests pending';

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Screen Header */}
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Scan & Collect Sample</Text>
        <Text style={s.screenSubtitle}>Manual entry mode</Text>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Success State */}
          {successBarcode && foundOrder === null && (
            <SuccessCard
              barcode={successBarcode}
              orderNumber={barcodeInput}
              onScanAnother={handleReset}
            />
          )}

          {/* Camera Placeholder */}
          {!successBarcode && (
            <>
              <View style={s.cameraPlaceholder}>
                <Text style={s.cameraIcon}>📷</Text>
                <Text style={s.cameraText}>Camera scanning</Text>
                <Text style={s.cameraSubText}>(use manual entry below)</Text>
              </View>

              {/* Manual Entry */}
              <Card>
                <Text style={s.sectionLabel}>Manual Entry</Text>
                <Input
                  label="Order Number or Barcode"
                  placeholder="e.g. DH-ORD-20260303-0001"
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleLookup}
                />
                <Button
                  label="Look Up Order"
                  onPress={handleLookup}
                  loading={searchLoading}
                  fullWidth
                />
              </Card>

              {/* Error State */}
              {orderError && (
                <Card style={s.errorCard}>
                  <Text style={s.errorIcon}>⚠️</Text>
                  <Text style={s.errorText}>{orderError}</Text>
                  <TouchableOpacity onPress={handleReset} style={s.retryLink}>
                    <Text style={s.retryLinkText}>Try again</Text>
                  </TouchableOpacity>
                </Card>
              )}

              {/* Found Order Card */}
              {foundOrder && (
                <>
                  <Card style={s.orderCard}>
                    <View style={s.orderCardHeader}>
                      <Text style={s.orderCardTitle}>Order Found</Text>
                      <Badge label={foundOrder.status} color="teal" />
                    </View>
                    <Text style={s.orderNumber}>{foundOrder.orderNumber}</Text>
                    <Text style={s.orderPatient}>👤 {patientName}</Text>
                    <Text style={s.orderTests} numberOfLines={3}>
                      🧪 {testNames}
                    </Text>
                  </Card>

                  {/* Collection Form */}
                  <Card>
                    <Text style={s.sectionLabel}>Sample Collection Details</Text>

                    <Input
                      label="Volume (mL)"
                      placeholder="e.g. 5"
                      value={volume}
                      onChangeText={setVolume}
                      keyboardType="decimal-pad"
                    />

                    <Text style={s.tubeLabel}>Tube Type *</Text>
                    <TubeTypeSelector selected={tubeType} onSelect={setTubeType} />

                    <Input
                      label="Notes (optional)"
                      placeholder="Any special notes..."
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      style={s.notesInput}
                    />

                    <Button
                      label="Confirm Collection"
                      onPress={handleConfirmCollection}
                      loading={collectLoading}
                      disabled={!tubeType}
                      fullWidth
                    />
                  </Card>
                </>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  keyboardAvoid: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Screen Header
  screenHeader: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  screenTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  screenSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Camera placeholder
  cameraPlaceholder: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
  },
  cameraIcon: { fontSize: 40, marginBottom: 8 },
  cameraText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  cameraSubText: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  // Section label
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  // Error card
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorText: { fontSize: 14, color: Colors.danger, textAlign: 'center', fontWeight: '500' },
  retryLink: { marginTop: 10 },
  retryLinkText: { fontSize: 14, color: Colors.teal, fontWeight: '600' },

  // Order card
  orderCard: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.success },
  orderNumber: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  orderPatient: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  orderTests: { fontSize: 13, color: Colors.textSecondary },

  // Tube type selector
  tubeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  tubeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  tubeOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  tubeOptionSelected: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  tubeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tubeOptionTextSelected: {
    color: '#fff',
  },

  // Notes input override
  notesInput: { height: 72, textAlignVertical: 'top' },

  // Success card
  successCard: {
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconText: { fontSize: 36 },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  successSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  barcodeCard: {
    width: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    gap: 4,
  },
  barcodeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  barcodeOrderNum: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  barcodeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.teal,
    letterSpacing: 2,
    marginTop: 2,
  },
});
