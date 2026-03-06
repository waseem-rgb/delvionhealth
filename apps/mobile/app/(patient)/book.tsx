import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Button, Card } from '../../components/ui';

// ---- Types ----

interface TestCatalogItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  turnaroundTime?: string;
  description?: string;
}

interface AiSuggestion {
  test_name: string;
  relevance_score: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
}

type CollectionType = 'HOME' | 'CENTRE';

const POPULAR_TESTS = ['CBC', 'HbA1c', 'Lipid Profile', 'TSH', 'LFT', 'KFT', 'Vitamin D'];

const TIME_SLOTS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
];

function getNextSevenDays(): Array<{ label: string; value: string; dayName: string }> {
  const days: Array<{ label: string; value: string; dayName: string }> = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: d.toISOString().split('T')[0],
    });
  }
  return days;
}

// ---- Step Indicator ----

function StepIndicator({ current }: { current: number }) {
  const steps = [1, 2, 3];
  return (
    <View style={si.container}>
      {steps.map((step, idx) => (
        <View key={step} style={si.stepRow}>
          <View
            style={[
              si.circle,
              current >= step ? si.circleDone : si.circlePending,
            ]}
          >
            {current > step ? (
              <Text style={si.checkText}>✓</Text>
            ) : (
              <Text style={[si.stepNum, current === step ? si.stepNumActive : si.stepNumInactive]}>
                {step}
              </Text>
            )}
          </View>
          {idx < steps.length - 1 && (
            <View style={[si.line, current > step ? si.lineDone : si.linePending]} />
          )}
        </View>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: Colors.teal },
  circlePending: { backgroundColor: Colors.border },
  checkText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stepNum: { fontSize: 13, fontWeight: '700' },
  stepNumActive: { color: '#fff' },
  stepNumInactive: { color: Colors.textSecondary },
  line: { flex: 1, height: 2, marginHorizontal: 4 },
  lineDone: { backgroundColor: Colors.teal },
  linePending: { backgroundColor: Colors.border },
});

// ---- Step 1: Choose Tests ----

function Step1ChooseTests({
  cart,
  onCartChange,
  onNext,
}: {
  cart: CartItem[];
  onCartChange: (items: CartItem[]) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TestCatalogItem[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setAiSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const [catalogRes, aiRes] = await Promise.allSettled([
        apiClient.get<{ data?: TestCatalogItem[]; tests?: TestCatalogItem[] } | TestCatalogItem[]>(
          `/test-catalog?search=${encodeURIComponent(q)}&limit=10`
        ),
        q.length >= 3
          ? apiClient.get<{ suggestions?: AiSuggestion[] }>(`/test-catalog/ai-suggest?q=${encodeURIComponent(q)}`)
          : Promise.resolve({ data: { suggestions: [] } }),
      ]);

      if (catalogRes.status === 'fulfilled') {
        const raw = catalogRes.value.data;
        const items: TestCatalogItem[] = Array.isArray(raw)
          ? raw
          : (raw as { data?: TestCatalogItem[]; tests?: TestCatalogItem[] }).data ??
            (raw as { data?: TestCatalogItem[]; tests?: TestCatalogItem[] }).tests ??
            [];
        setResults(items);
      }

      if (aiRes.status === 'fulfilled') {
        const sugg =
          (aiRes.value as { data: { suggestions?: AiSuggestion[] } }).data?.suggestions ?? [];
        setAiSuggestions(sugg);
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const isInCart = (id: string) => cart.some((c) => c.id === id);

  const toggleTest = (test: TestCatalogItem) => {
    if (isInCart(test.id)) {
      onCartChange(cart.filter((c) => c.id !== test.id));
    } else {
      onCartChange([...cart, { id: test.id, name: test.name, price: test.price }]);
    }
  };

  const totalPrice = cart.reduce((sum, c) => sum + c.price, 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Search input */}
      <View style={s1.searchRow}>
        <TextInput
          style={s1.searchInput}
          placeholder="Search tests, symptoms..."
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {searching && (
          <ActivityIndicator size="small" color={Colors.teal} style={s1.searchSpinner} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Popular Tests */}
        <Text style={s1.sectionLabel}>Popular Tests</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s1.popularRow}>
          {POPULAR_TESTS.map((t) => (
            <TouchableOpacity
              key={t}
              style={s1.popularChip}
              onPress={() => setQuery(t)}
            >
              <Text style={s1.popularChipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <>
            <Text style={s1.sectionLabel}>
              <Text style={s1.aiLabel}>✨ AI Suggestions</Text>
            </Text>
            <View style={s1.aiRow}>
              {aiSuggestions.map((sg) => (
                <TouchableOpacity
                  key={sg.test_name}
                  style={s1.aiChip}
                  onPress={() => setQuery(sg.test_name)}
                >
                  <Text style={s1.aiChipText}>{sg.test_name}</Text>
                  <Text style={s1.aiScore}>{Math.round(sg.relevance_score * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <Text style={s1.sectionLabel}>Search Results</Text>
            {results.map((test) => (
              <Card key={test.id} style={s1.testCard}>
                <View style={s1.testRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s1.testName}>{test.name}</Text>
                    <Text style={s1.testMeta}>
                      {test.category ?? 'General'}
                      {test.turnaroundTime ? ` · ${test.turnaroundTime}` : ''}
                    </Text>
                    <Text style={s1.testPrice}>₹{test.price?.toFixed(0) ?? '—'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s1.toggleBtn, isInCart(test.id) ? s1.toggleBtnActive : s1.toggleBtnInactive]}
                    onPress={() => toggleTest(test)}
                  >
                    <Text style={[s1.toggleBtnText, isInCart(test.id) ? s1.toggleBtnTextActive : {}]}>
                      {isInCart(test.id) ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky Cart Footer */}
      {cart.length > 0 && (
        <View style={s1.cartFooter}>
          <View>
            <Text style={s1.cartCount}>{cart.length} test{cart.length !== 1 ? 's' : ''}</Text>
            <Text style={s1.cartTotal}>₹{totalPrice.toFixed(0)}</Text>
          </View>
          <TouchableOpacity style={s1.continueBtn} onPress={onNext}>
            <Text style={s1.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s1 = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    margin: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  searchSpinner: { marginLeft: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiLabel: { color: '#7C3AED', fontWeight: '700' },
  popularRow: { paddingHorizontal: 12, marginBottom: 12 },
  popularChip: {
    backgroundColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 4,
  },
  popularChipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  aiRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 12, gap: 8 },
  aiChip: {
    backgroundColor: '#F3E8FF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  aiChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  aiScore: { fontSize: 11, color: '#9333EA', fontWeight: '700' },
  testCard: { marginHorizontal: 16 },
  testRow: { flexDirection: 'row', alignItems: 'center' },
  testName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  testMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  testPrice: { fontSize: 14, color: Colors.teal, fontWeight: '700', marginTop: 4 },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  toggleBtnActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  toggleBtnInactive: { backgroundColor: 'transparent', borderColor: Colors.teal },
  toggleBtnText: { fontSize: 18, fontWeight: '700', color: Colors.teal },
  toggleBtnTextActive: { color: '#fff' },
  cartFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navy,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  cartCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cartTotal: { color: '#fff', fontSize: 18, fontWeight: '700' },
  continueBtn: {
    backgroundColor: Colors.teal,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ---- Step 2: Schedule ----

function Step2Schedule({
  collectionType,
  onCollectionTypeChange,
  address,
  onAddressChange,
  selectedDate,
  onDateChange,
  selectedSlot,
  onSlotChange,
  onNext,
  onBack,
}: {
  collectionType: CollectionType;
  onCollectionTypeChange: (t: CollectionType) => void;
  address: string;
  onAddressChange: (a: string) => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  selectedSlot: string;
  onSlotChange: (s: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const days = getNextSevenDays();

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={s2.section}>
        <Text style={s2.sectionTitle}>Collection Type</Text>
        <View style={s2.collectionRow}>
          <TouchableOpacity
            style={[s2.collectionCard, collectionType === 'HOME' ? s2.collectionCardActive : {}]}
            onPress={() => onCollectionTypeChange('HOME')}
          >
            <Text style={s2.collectionEmoji}>🏠</Text>
            <Text style={[s2.collectionLabel, collectionType === 'HOME' ? s2.collectionLabelActive : {}]}>
              Home Collection
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s2.collectionCard, collectionType === 'CENTRE' ? s2.collectionCardActive : {}]}
            onPress={() => onCollectionTypeChange('CENTRE')}
          >
            <Text style={s2.collectionEmoji}>🏥</Text>
            <Text style={[s2.collectionLabel, collectionType === 'CENTRE' ? s2.collectionLabelActive : {}]}>
              Visit Centre
            </Text>
          </TouchableOpacity>
        </View>

        {collectionType === 'HOME' && (
          <TextInput
            style={s2.addressInput}
            placeholder="Enter your home address..."
            placeholderTextColor={Colors.textSecondary}
            value={address}
            onChangeText={onAddressChange}
            multiline
            numberOfLines={3}
          />
        )}
      </View>

      <View style={s2.section}>
        <Text style={s2.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {days.map((day) => (
            <TouchableOpacity
              key={day.value}
              style={[s2.datePill, selectedDate === day.value ? s2.datePillActive : {}]}
              onPress={() => onDateChange(day.value)}
            >
              <Text style={[s2.dayName, selectedDate === day.value ? s2.datePillTextActive : {}]}>
                {day.dayName}
              </Text>
              <Text style={[s2.dateLabel, selectedDate === day.value ? s2.datePillTextActive : {}]}>
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={s2.section}>
        <Text style={s2.sectionTitle}>Select Time Slot</Text>
        <View style={s2.slotsGrid}>
          {TIME_SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              style={[s2.slotPill, selectedSlot === slot ? s2.slotPillActive : {}]}
              onPress={() => onSlotChange(slot)}
            >
              <Text style={[s2.slotText, selectedSlot === slot ? s2.slotTextActive : {}]}>
                {slot}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s2.navRow}>
        <Button label="← Back" onPress={onBack} variant="outline" style={{ flex: 1 }} />
        <View style={{ width: 12 }} />
        <Button
          label="Continue →"
          onPress={() => {
            if (!selectedDate) {
              Alert.alert('Select Date', 'Please select a date for your test.');
              return;
            }
            if (!selectedSlot) {
              Alert.alert('Select Slot', 'Please select a time slot.');
              return;
            }
            if (collectionType === 'HOME' && !address.trim()) {
              Alert.alert('Address Required', 'Please enter your home address for collection.');
              return;
            }
            onNext();
          }}
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  collectionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  collectionCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    paddingVertical: 16,
  },
  collectionCardActive: { borderColor: Colors.teal, backgroundColor: '#F0FDFA' },
  collectionEmoji: { fontSize: 26, marginBottom: 6 },
  collectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  collectionLabelActive: { color: Colors.teal },
  addressInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  datePill: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    marginRight: 8,
    minWidth: 64,
  },
  datePillActive: { borderColor: Colors.teal, backgroundColor: Colors.teal },
  datePillTextActive: { color: '#fff' },
  dayName: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  dateLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  slotPillActive: { borderColor: Colors.teal, backgroundColor: Colors.teal },
  slotText: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  slotTextActive: { color: '#fff' },
  navRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24 },
});

// ---- Step 3: Confirm & Pay ----

function Step3Confirm({
  cart,
  collectionType,
  address,
  selectedDate,
  selectedSlot,
  onConfirm,
  onBack,
  loading,
}: {
  cart: CartItem[];
  collectionType: CollectionType;
  address: string;
  selectedDate: string;
  selectedSlot: string;
  onConfirm: (paymentMethod: 'ONLINE' | 'CENTRE') => void;
  onBack: () => void;
  loading: boolean;
}) {
  const totalPrice = cart.reduce((sum, c) => sum + c.price, 0);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={s3.section}>
        <Text style={s3.sectionTitle}>Order Summary</Text>
        <Card>
          {cart.map((item, idx) => (
            <View key={item.id} style={[s3.summaryRow, idx < cart.length - 1 ? s3.summaryRowBorder : {}]}>
              <Text style={s3.testName} numberOfLines={1}>{item.name}</Text>
              <Text style={s3.testPrice}>₹{item.price.toFixed(0)}</Text>
            </View>
          ))}
          <View style={s3.totalRow}>
            <Text style={s3.totalLabel}>Total</Text>
            <Text style={s3.totalValue}>₹{totalPrice.toFixed(0)}</Text>
          </View>
        </Card>
      </View>

      <View style={s3.section}>
        <Text style={s3.sectionTitle}>Collection Details</Text>
        <Card>
          <View style={s3.detailRow}>
            <Text style={s3.detailLabel}>Type</Text>
            <Text style={s3.detailValue}>{collectionType === 'HOME' ? '🏠 Home Collection' : '🏥 Visit Centre'}</Text>
          </View>
          {collectionType === 'HOME' && address ? (
            <View style={s3.detailRow}>
              <Text style={s3.detailLabel}>Address</Text>
              <Text style={[s3.detailValue, { flex: 1, textAlign: 'right' }]}>{address}</Text>
            </View>
          ) : null}
          <View style={s3.detailRow}>
            <Text style={s3.detailLabel}>Date</Text>
            <Text style={s3.detailValue}>{selectedDate}</Text>
          </View>
          <View style={s3.detailRow}>
            <Text style={s3.detailLabel}>Time</Text>
            <Text style={s3.detailValue}>{selectedSlot}</Text>
          </View>
        </Card>
      </View>

      <View style={s3.section}>
        <Text style={s3.sectionTitle}>Payment</Text>
        <View style={s3.paymentRow}>
          <TouchableOpacity
            style={s3.payBtn}
            onPress={() => onConfirm('ONLINE')}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={s3.payBtnText}>Pay Online</Text>
                <Text style={s3.razorpayBadge}>Razorpay</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s3.payBtnOutline}
            onPress={() => onConfirm('CENTRE')}
            disabled={loading}
          >
            <Text style={s3.payBtnOutlineText}>Pay at Centre</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={s3.backRow} onPress={onBack}>
        <Text style={s3.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s3 = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  testName: { fontSize: 14, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  testPrice: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '800', color: Colors.teal },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  paymentRow: { gap: 12 },
  payBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  razorpayBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  payBtnOutline: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.teal,
  },
  payBtnOutlineText: { color: Colors.teal, fontSize: 15, fontWeight: '700' },
  backRow: { alignItems: 'center', marginTop: 16 },
  backText: { color: Colors.textSecondary, fontSize: 14 },
});

// ---- Step 4: Success ----

function Step4Success({
  orderNumber,
  collectionType,
  onTrack,
  onViewReports,
  onBookAnother,
}: {
  orderNumber: string;
  collectionType: CollectionType;
  onTrack: () => void;
  onViewReports: () => void;
  onBookAnother: () => void;
}) {
  const router = useRouter();

  return (
    <View style={s4.container}>
      <Text style={s4.successEmoji}>✅</Text>
      <Text style={s4.title}>Booking Confirmed!</Text>
      <Text style={s4.orderNum}>{orderNumber}</Text>
      <Text style={s4.message}>
        {collectionType === 'HOME'
          ? 'Our phlebotomist will arrive at your selected time slot. Please be available.'
          : 'Please visit our centre at your selected date and time with this order number.'}
      </Text>

      <View style={s4.actions}>
        <Button label="Track This Order" onPress={onTrack} fullWidth />
        <View style={{ height: 12 }} />
        <Button label="View My Reports" onPress={onViewReports} variant="outline" fullWidth />
      </View>

      <TouchableOpacity style={s4.resetRow} onPress={onBookAnother}>
        <Text style={s4.resetText}>Book Another Test</Text>
      </TouchableOpacity>
    </View>
  );
}

const s4 = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  orderNum: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.teal,
    marginBottom: 16,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actions: { width: '100%' },
  resetRow: { marginTop: 20 },
  resetText: { color: Colors.primary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

// ---- Main Export ----

export default function BookTestScreen() {
  const router = useRouter();
  const user = useAuthStore((st) => st.user);
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [collectionType, setCollectionType] = useState<CollectionType>('CENTRE');
  const [address, setAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState(getNextSevenDays()[0].value);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');

  const handleConfirm = async (_paymentMethod: 'ONLINE' | 'CENTRE') => {
    if (!user?.patientId) {
      Alert.alert('Error', 'Patient profile not found. Please contact support.');
      return;
    }
    setBookingLoading(true);
    try {
      const payload = {
        patientId: user.patientId,
        tests: cart.map((c) => ({ testCatalogId: c.id, quantity: 1 })),
        priority: 'ROUTINE',
        collectionType,
        collectionAddress: collectionType === 'HOME' ? address : undefined,
        notes: `Scheduled for ${selectedDate} at ${selectedSlot}`,
      };
      const res = await apiClient.post<{ orderNumber?: string; order?: { orderNumber: string } }>(
        '/orders',
        payload
      );
      const orderNum =
        res.data.orderNumber ??
        res.data.order?.orderNumber ??
        `DH-ORD-${Date.now()}`;
      setConfirmedOrderNumber(orderNum);
      setStep(4);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to place order. Please try again.';
      Alert.alert('Booking Failed', msg);
    } finally {
      setBookingLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCart([]);
    setCollectionType('CENTRE');
    setAddress('');
    setSelectedDate(getNextSevenDays()[0].value);
    setSelectedSlot('');
    setConfirmedOrderNumber('');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Book a Test</Text>
      </View>

      {/* Step Indicator (steps 1-3 only) */}
      {step <= 3 && (
        <View style={s.stepIndicatorWrapper}>
          <StepIndicator current={step} />
          <Text style={s.stepLabel}>
            {step === 1 ? 'Choose Tests' : step === 2 ? 'Schedule' : 'Confirm & Pay'}
          </Text>
        </View>
      )}

      {/* Step content */}
      <View style={{ flex: 1 }}>
        {step === 1 && (
          <Step1ChooseTests
            cart={cart}
            onCartChange={setCart}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Schedule
            collectionType={collectionType}
            onCollectionTypeChange={setCollectionType}
            address={address}
            onAddressChange={setAddress}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedSlot={selectedSlot}
            onSlotChange={setSelectedSlot}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Confirm
            cart={cart}
            collectionType={collectionType}
            address={address}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onConfirm={handleConfirm}
            onBack={() => setStep(2)}
            loading={bookingLoading}
          />
        )}
        {step === 4 && (
          <Step4Success
            orderNumber={confirmedOrderNumber}
            collectionType={collectionType}
            onTrack={() => router.push('/(patient)/track')}
            onViewReports={() => router.push('/(patient)/reports')}
            onBookAnother={reset}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  stepIndicatorWrapper: {
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.teal,
    paddingBottom: 10,
  },
});
