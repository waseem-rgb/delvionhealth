import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

// ---- Types ----

interface DoctorRecord {
  id: string;
  engagementScore: number | null;
  referralCount: number | null;
  totalReferrals: number | null;
}

// ---- AI Tier helper ----

type AiTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';

function getAiTier(score: number): AiTier {
  if (score >= 80) return 'PLATINUM';
  if (score >= 60) return 'GOLD';
  if (score >= 40) return 'SILVER';
  return 'BRONZE';
}

function getAiTierBadgeColor(tier: AiTier): 'blue' | 'amber' | 'grey' | 'teal' {
  const map: Record<AiTier, 'blue' | 'amber' | 'grey' | 'teal'> = {
    PLATINUM: 'teal',
    GOLD: 'amber',
    SILVER: 'grey',
    BRONZE: 'grey',
  };
  return map[tier];
}

function getAiTierEmoji(tier: AiTier): string {
  const map: Record<AiTier, string> = {
    PLATINUM: '💎',
    GOLD: '🥇',
    SILVER: '🥈',
    BRONZE: '🥉',
  };
  return map[tier];
}

// ---- Info Row ----

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoRowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ---- Stat Card ----

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---- Main Screen ----

export default function DoctorProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const doctorFullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const displayName = `Dr. ${doctorFullName}`;

  // Fetch doctor CRM record
  const {
    data: doctorData,
    isLoading,
    refetch,
  } = useQuery<DoctorRecord | null>({
    queryKey: ['doctor-profile', user?.email],
    queryFn: async () => {
      try {
        if (!user?.email) return null;
        const searchTerm = encodeURIComponent(user.email.split('@')[0]);
        const res = await apiClient.get<unknown>(
          `/crm/doctors?search=${searchTerm}`,
        );
        const raw = res.data as Record<string, unknown>;
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
          ? (raw.data as unknown[])
          : [];
        if (items.length === 0) return null;
        const first = items[0] as Record<string, unknown>;
        return {
          id: String(first.id ?? ''),
          engagementScore:
            typeof first.engagementScore === 'number' ? first.engagementScore : null,
          referralCount:
            typeof first.referralCount === 'number' ? first.referralCount : null,
          totalReferrals:
            typeof first.totalReferrals === 'number' ? first.totalReferrals : null,
        };
      } catch {
        return null;
      }
    },
    enabled: Boolean(user?.email),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const engagementScore = doctorData?.engagementScore ?? 0;
  const tier = getAiTier(engagementScore);
  const tierEmoji = getAiTierEmoji(tier);
  const tierBadgeColor = getAiTierBadgeColor(tier);
  const referrals = doctorData?.totalReferrals ?? doctorData?.referralCount ?? 0;

  // Truncated user ID as reg number placeholder
  const regNumber = user?.id ? `REG-${user.id.slice(0, 8).toUpperCase()}` : '—';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
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
        {/* Profile Hero */}
        <View style={styles.hero}>
          <Avatar name={doctorFullName || 'Doctor'} size={72} bg={Colors.navy} />
          <Text style={styles.heroName}>{displayName}</Text>
          <View style={styles.heroBadgeRow}>
            <Badge label="Doctor" color="blue" />
          </View>
          <Text style={styles.heroEmail}>{user?.email ?? ''}</Text>
        </View>

        {/* Info Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Information</Text>
        </View>
        <Card style={styles.infoCard}>
          <InfoRow icon="📧" label="Email" value={user?.email ?? '—'} />
          <View style={styles.infoSeparator} />
          <InfoRow icon="🩺" label="Specialization" value="General Physician" />
          <View style={styles.infoSeparator} />
          <InfoRow icon="🪪" label="Registration Number" value={regNumber} />
          <View style={styles.infoSeparator} />
          <InfoRow icon="🏥" label="Hospital / Clinic" value="DELViON Health" />
        </Card>

        {/* Stats Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : (
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <StatItem
                label="Total Referrals"
                value={referrals}
                color={Colors.primary}
              />
              <View style={styles.statDivider} />
              <StatItem
                label="Engagement Score"
                value={engagementScore > 0 ? `${engagementScore}%` : '—'}
                color={Colors.teal}
              />
            </View>

            {/* Engagement Bar */}
            {engagementScore > 0 && (
              <View style={styles.engagementBarContainer}>
                <View style={styles.engagementBarBg}>
                  <View
                    style={[
                      styles.engagementBarFill,
                      { width: `${Math.min(engagementScore, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.engagementPct}>{engagementScore}%</Text>
              </View>
            )}

            {/* AI Tier */}
            <View style={styles.tierRow}>
              <Text style={styles.tierLabel}>AI Tier</Text>
              <View style={styles.tierBadgeWrapper}>
                <Text style={styles.tierEmoji}>{tierEmoji}</Text>
                <Badge label={tier} color={tierBadgeColor} />
              </View>
            </View>
          </Card>
        )}

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.75}
        >
          <Text style={styles.signOutIcon}>🚪</Text>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  heroEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Info Card
  infoCard: { marginHorizontal: 16, marginBottom: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoRowContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 1 },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  infoSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
    marginLeft: 36,
  },

  // Stats Card
  statsCard: { marginHorizontal: 16, marginBottom: 0 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },

  // Engagement bar
  engagementBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  engagementBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  engagementBarFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 4,
  },
  engagementPct: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.teal,
    minWidth: 32,
    textAlign: 'right',
  },

  // AI Tier row
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tierLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  tierBadgeWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierEmoji: { fontSize: 18 },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    gap: 10,
  },
  signOutIcon: { fontSize: 18 },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.danger,
  },
});
