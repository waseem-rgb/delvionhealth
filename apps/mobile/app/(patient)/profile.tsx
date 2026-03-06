import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { unregisterPushToken } from '../../lib/notifications';
import { Avatar, Card } from '../../components/ui';

// ---- Types ----

interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

// ---- Helpers ----

function formatDOB(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function buildAddress(profile: PatientProfile): string {
  const parts = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean);
  return parts.join(', ');
}

// ---- Info Row ----

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value || '—'}</Text>
    </View>
  );
}

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  value: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 2, textAlign: 'right' },
});

// ---- Main Screen ----

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((st) => st.logout);
  const authUser = useAuthStore((st) => st.user);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<PatientProfile>('/auth/me');
        setProfile(res.data);
      } catch {
        // Fallback to auth store user info
        if (authUser) {
          setProfile({
            id: authUser.id,
            firstName: authUser.firstName,
            lastName: authUser.lastName,
            email: authUser.email,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [authUser]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await unregisterPushToken();
              await logout();
              router.replace('/login');
            } catch {
              router.replace('/login');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const fullName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : authUser
    ? `${authUser.firstName} ${authUser.lastName}`.trim()
    : 'Patient';

  const email = profile?.email ?? authUser?.email ?? '';
  const addressStr = profile ? buildAddress(profile) : '';

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>My Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={Colors.teal} size="large" />
            <Text style={s.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <>
            {/* Avatar + identity */}
            <View style={s.avatarSection}>
              <Avatar name={fullName} size={72} bg={Colors.teal} />
              <Text style={s.profileName}>{fullName}</Text>
              <Text style={s.profileEmail}>{email}</Text>
              {authUser?.role && (
                <View style={s.roleBadge}>
                  <Text style={s.roleBadgeText}>{authUser.role.replace(/_/g, ' ')}</Text>
                </View>
              )}
            </View>

            {/* Personal Info */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionEmoji}>👤</Text>
              <Text style={s.sectionTitle}>Personal Information</Text>
            </View>
            <Card style={s.infoCard}>
              <InfoRow label="Date of Birth" value={profile?.dateOfBirth ? formatDOB(profile.dateOfBirth) : null} />
              <InfoRow label="Gender" value={profile?.gender} />
              <InfoRow label="Blood Group" value={profile?.bloodGroup} />
              <View style={[ir.row, { borderBottomWidth: 0 }]}>
                <Text style={ir.label}>Phone</Text>
                <Text style={ir.value}>{profile?.phone || '—'}</Text>
              </View>
            </Card>

            {/* Address */}
            {addressStr ? (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionEmoji}>📍</Text>
                  <Text style={s.sectionTitle}>Address</Text>
                </View>
                <Card style={s.infoCard}>
                  <View style={[ir.row, { borderBottomWidth: 0 }]}>
                    <Text style={ir.label}>Full Address</Text>
                    <Text style={[ir.value, { lineHeight: 20 }]}>{addressStr}</Text>
                  </View>
                </Card>
              </>
            ) : null}

            {/* Emergency Contact */}
            {(profile?.emergencyContactName || profile?.emergencyContactPhone) && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionEmoji}>🚨</Text>
                  <Text style={s.sectionTitle}>Emergency Contact</Text>
                </View>
                <Card style={s.infoCard}>
                  <InfoRow label="Name" value={profile?.emergencyContactName} />
                  <View style={[ir.row, { borderBottomWidth: 0 }]}>
                    <Text style={ir.label}>Phone</Text>
                    <Text style={ir.value}>{profile?.emergencyContactPhone || '—'}</Text>
                  </View>
                </Card>
              </>
            )}

            {/* Sign Out */}
            <View style={s.signOutSection}>
              <TouchableOpacity
                style={s.signOutBtn}
                onPress={handleSignOut}
                disabled={signingOut}
                activeOpacity={0.75}
              >
                {signingOut ? (
                  <ActivityIndicator color={Colors.danger} size="small" />
                ) : (
                  <Text style={s.signOutText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  scrollContent: { paddingBottom: 32 },

  loadingBlock: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#CCFBF1',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.teal,
    textTransform: 'capitalize',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  infoCard: { marginHorizontal: 16 },

  signOutSection: { marginHorizontal: 16, marginTop: 24 },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
});
