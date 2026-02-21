import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getLeaderboard, LeaderboardEntry } from '../services/api';
import { RankBadge } from '../components/RankBadge';

interface LeaderboardScreenProps {
  currentUserId: string;
}

export function LeaderboardScreen({ currentUserId }: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await getLeaderboard();
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.id === currentUserId;
    return (
      <View style={[styles.row, isMe && styles.myRow]}>
        <Text style={[styles.rank, item.rank <= 3 && styles.topRank]}>
          {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
        </Text>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, isMe && styles.myName]}>
              {item.username}{isMe ? ' (you)' : ''}
            </Text>
            <RankBadge tier={item.tier} size="sm" />
          </View>
          <Text style={styles.record}>
            {item.wins}W · {item.losses}L
            {item.wins + item.losses > 0
              ? ` · ${Math.round((item.wins / (item.wins + item.losses)) * 100)}% WR`
              : ''}
          </Text>
        </View>
        <Text style={styles.elo}>{item.elo_rating}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6c63ff" />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerSubtitle}>{entries.length} competitors</Text>
        </View>
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20, paddingTop: 24 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { color: '#666', fontSize: 14, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  myRow: {
    backgroundColor: '#1a1a2e',
  },
  rank: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
    width: 36,
    fontVariant: ['tabular-nums'],
  },
  topRank: { fontSize: 18 },
  userInfo: { flex: 1, marginLeft: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: '#fff', fontSize: 15, fontWeight: '600' },
  myName: { color: '#6c63ff' },
  record: { color: '#666', fontSize: 12, marginTop: 3 },
  elo: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  errorText: { color: '#ff6b6b', textAlign: 'center' },
});
