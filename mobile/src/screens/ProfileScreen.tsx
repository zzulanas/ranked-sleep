import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { getUser, getMatchHistory, updatePushToken, Match, UserProfile } from '../services/api';
import { signOut } from '../services/auth';
import { RankBadge } from '../components/RankBadge';
import { MatchCard } from '../components/MatchCard';

interface ProfileScreenProps {
  userId: string;
  onLogout?: () => void;
}

export function ProfileScreen({ userId, onLogout }: ProfileScreenProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    registerPushToken();
  }, [userId]);

  const loadData = async () => {
    try {
      const [{ user: u }, matchHistory] = await Promise.all([
        getUser(userId),
        getMatchHistory(userId),
      ]);
      setUser(u);
      setHistory(matchHistory);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const registerPushToken = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = await Notifications.getExpoPushTokenAsync();
      await updatePushToken(userId, token.data);
    } catch {
      // Non-critical — notifications are best-effort
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          onLogout?.();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>
            {user?.provider === 'GARMIN' ? '⌚'
              : user?.provider === 'APPLE' ? '🍎'
              : user?.provider === 'OURA' ? '💍'
              : '😴'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        {user && <RankBadge tier={user.tier} elo={user.elo_rating} size="lg" />}
        {user?.provider && (
          <Text style={styles.provider}>via {user.provider}</Text>
        )}
      </View>

      {/* Stats */}
      {user && (
        <View style={styles.stats}>
          {[
            { label: 'Wins', value: user.wins, color: '#4ecca3' },
            { label: 'Losses', value: user.losses, color: '#ff6b6b' },
            { label: 'ELO', value: user.elo_rating, color: '#6c63ff' },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.stat}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Match history */}
      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Matches</Text>
          <View style={styles.historyList}>
            {history.slice(0, 10).map(match => (
              <MatchCard key={match.id} match={match} currentUserId={userId} />
            ))}
          </View>
        </>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { paddingBottom: 40, gap: 16 },
  center: { flex: 1, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center' },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a3d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarEmoji: { fontSize: 36 },
  username: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  provider: { color: '#555', fontSize: 13, marginTop: 4 },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3d',
    padding: 16,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  statLabel: { color: '#666', fontSize: 12, marginTop: 4 },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  historyList: { gap: 12 },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff6b6b',
    alignItems: 'center',
  },
  logoutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 15 },
});
