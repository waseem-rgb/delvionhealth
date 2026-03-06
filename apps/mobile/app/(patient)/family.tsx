import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/api';
import { Avatar, Button, Card, EmptyState } from '../../components/ui';

// ---- Types ----

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship?: string;
  dateOfBirth?: string;
  gender?: string;
  lastTestDate?: string;
  bloodGroup?: string;
}

// ---- Helpers ----

function calculateAge(dateOfBirth: string): number | null {
  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  } catch {
    return null;
  }
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

function getRelationshipEmoji(relationship?: string): string {
  if (!relationship) return '👤';
  const r = relationship.toUpperCase();
  if (r.includes('FATHER') || r.includes('DAD')) return '👨';
  if (r.includes('MOTHER') || r.includes('MOM')) return '👩';
  if (r.includes('SON') || r.includes('BOY')) return '👦';
  if (r.includes('DAUGHTER') || r.includes('GIRL')) return '👧';
  if (r.includes('SPOUSE') || r.includes('WIFE') || r.includes('HUSBAND')) return '💑';
  if (r.includes('SIBLING') || r.includes('BROTHER') || r.includes('SISTER')) return '👫';
  if (r.includes('GRAND')) return '👴';
  return '👤';
}

// ---- Family Member Card ----

function MemberCard({ member }: { member: FamilyMember }) {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const age = member.dateOfBirth ? calculateAge(member.dateOfBirth) : null;

  return (
    <Card>
      <View style={s.memberRow}>
        <Avatar name={fullName} size={48} bg={Colors.primary} />
        <View style={s.memberInfo}>
          <Text style={s.memberName}>{fullName}</Text>
          <View style={s.memberMeta}>
            {member.relationship && (
              <View style={s.relationshipChip}>
                <Text style={s.relationshipEmoji}>{getRelationshipEmoji(member.relationship)}</Text>
                <Text style={s.relationshipText}>{member.relationship}</Text>
              </View>
            )}
            {age !== null && (
              <Text style={s.metaText}>{age} yrs</Text>
            )}
            {member.bloodGroup && (
              <View style={s.bloodGroupChip}>
                <Text style={s.bloodGroupText}>{member.bloodGroup}</Text>
              </View>
            )}
          </View>
          {member.lastTestDate && (
            <Text style={s.lastTest}>
              Last test: {formatDate(member.lastTestDate)}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

// ---- Main Screen ----

export default function FamilyScreen() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching } = useQuery<FamilyMember[]>({
    queryKey: ['family-members', refreshKey],
    queryFn: async () => {
      try {
        const res = await apiClient.get<
          { data?: FamilyMember[]; members?: FamilyMember[] } | FamilyMember[]
        >('/patients/family');
        const raw = res.data;
        if (Array.isArray(raw)) return raw;
        return (raw as { data?: FamilyMember[]; members?: FamilyMember[] }).data ??
          (raw as { data?: FamilyMember[]; members?: FamilyMember[] }).members ??
          [];
      } catch {
        return [];
      }
    },
  });

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAddMember = () => {
    Alert.alert(
      'Coming Soon',
      'Adding family members will be available in the next update.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const members = data ?? [];

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Family Members</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={handleAddMember}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoading ? (
        <View style={s.loadingBlock}>
          <ActivityIndicator color={Colors.teal} size="large" />
          <Text style={s.loadingText}>Loading family members...</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={Colors.teal} />
          }
          renderItem={({ item }) => <MemberCard member={item} />}
          ListEmptyComponent={
            <View style={s.emptyWrapper}>
              <EmptyState
                icon="👨‍👩‍👧"
                title="No family members added yet"
                subtitle="Add your family members to easily manage their health tests and reports."
                actionLabel="Add Family Member"
                onAction={handleAddMember}
              />
            </View>
          }
          ListFooterComponent={
            members.length > 0 ? (
              <View style={s.footer}>
                <Button
                  label="+ Add Family Member"
                  onPress={handleAddMember}
                  variant="outline"
                  fullWidth
                />
              </View>
            ) : null
          }
        />
      )}
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
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  addBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  emptyWrapper: { flex: 1 },

  // Member card
  memberRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  relationshipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 4,
  },
  relationshipEmoji: { fontSize: 12 },
  relationshipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  bloodGroupChip: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  bloodGroupText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  lastTest: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
});
