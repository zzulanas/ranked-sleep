import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useMatch } from '../hooks/useMatch';
import { MatchCard } from '../components/MatchCard';
import { RankBadge } from '../components/RankBadge';
import { getUser, UserProfile } from '../services/api';
import { eloTierFromRating } from '../utils/elo';

interface HomeScreenProps {
  userId: string;
}

export function HomeScreen({ userId }: HomeScreenProps) {
  const { match, loading: matchLoading, error: matchError, refresh } = useMatch(userId);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = async () => {
    try {
      const { user: u } = await getUser(userId);
      setUser(u);
    } catch {
      // Silently fail — non-critical
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadUser()]);
    setRefreshing(false);
  };

  const renderMatchSection = () => {
    if (matchLoading) {
      return <ActivityIndicator color="#6c63ff" style={styles.loader} />;
    }
    if (matchError) {
      return <Text style={styles.errorText}>Failed to load match: {matchError}</Text>;
    }
    if (!match) {
      return (
        <View style={styles.noMatch}>
          <Text style={styles.noMatchEmoji}>🌙</Text>
          <Text style={styles.noMatchTitle}>No match tonight</Text>
          <Text style={styles.noMatchSubtitle}>Check back after matches are created for the day</Text>
        </View>
      );
    }
    return <MatchCard match={match} currentUserId={userId} />;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#6c63ff"
        />
      }
    >
      {/* User header */}
      {user && !userLoading && (
        <View style={styles.userHeader}>
          <Text style={styles.greeting}>
            Good {getTimeOfDay()},{' '}
            <Text style={styles.username}>{user.username}</Text>
          </Text>
          <RankBadge tier={user.tier} elo={user.elo_rating} size="md" />
        </View>
      )}

      {/* Win/Loss record */}
      {user && (
        <View style={styles.record}>
          <View style={styles.recordStat}>
            <Text style={styles.recordNumber}>{user.wins}</Text>
            <Text style={styles.recordLabel}>Wins</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordStat}>
            <Text style={styles.recordNumber}>{user.losses}</Text>
            <Text style={styles.recordLabel}>Losses</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordStat}>
            <Text style={[styles.recordNumber, { color: '#6c63ff' }]}>
              {user.wins + user.losses > 0
                ? Math.round((user.wins / (user.wins + user.losses)) * 100)
                : 0}%
            </Text>
            <Text style={styles.recordLabel}>Win Rate</Text>
          </View>
        </View>
      )}

      {/* Tonight's match */}
      <Text style={styles.sectionTitle}>Tonight's Match</Text>
      {renderMatchSection()}
    </ScrollView>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  userHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    color: '#aaa',
    fontSize: 16,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
  },
  record: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3d',
    padding: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  recordStat: {
    alignItems: 'center',
  },
  recordNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  recordLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  recordDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2a2a3d',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    padding: 20,
  },
  noMatch: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  noMatchEmoji: { fontSize: 48 },
  noMatchTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  noMatchSubtitle: { color: '#666', fontSize: 14, textAlign: 'center' },
});
