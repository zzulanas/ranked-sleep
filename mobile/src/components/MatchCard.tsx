import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Match } from '../services/api';
import { RankBadge } from './RankBadge';

interface MatchCardProps {
  match: Match;
  currentUserId: string;
}

export function MatchCard({ match, currentUserId }: MatchCardProps) {
  const isUserA = match.user_a_id === currentUserId;
  const myScore = isUserA ? match.score_a : match.score_b;
  const theirScore = isUserA ? match.score_b : match.score_a;
  const opponent = isUserA ? match.user_b : match.user_a;
  const iWon = match.winner_id === currentUserId;
  const isResolved = match.status === 'resolved';

  const formatScore = (s: number | null) => (s == null ? '—' : s.toFixed(1));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{match.date}</Text>
        {isResolved && (
          <Text style={[styles.result, iWon ? styles.win : styles.loss]}>
            {iWon ? '🏆 WIN' : '😴 LOSS'}
          </Text>
        )}
        {match.status === 'pending' && (
          <Text style={styles.pending}>⏳ PENDING</Text>
        )}
        {match.status === 'voided' && (
          <Text style={styles.voided}>⚡ VOIDED</Text>
        )}
      </View>

      <View style={styles.versus}>
        {/* Me */}
        <View style={styles.player}>
          <Text style={styles.playerName}>You</Text>
          <Text style={[styles.score, isResolved && iWon ? styles.winScore : undefined]}>
            {formatScore(myScore)}
          </Text>
          {isResolved && match.elo_delta != null && (
            <Text style={[styles.eloDelta, iWon ? styles.eloGain : styles.eloLoss]}>
              {iWon ? `+${match.elo_delta}` : `-${match.elo_delta}`} ELO
            </Text>
          )}
        </View>

        <Text style={styles.vs}>VS</Text>

        {/* Opponent */}
        <View style={styles.player}>
          <Text style={styles.playerName}>{opponent?.username ?? '?'}</Text>
          <Text style={[styles.score, isResolved && !iWon ? styles.winScore : undefined]}>
            {formatScore(theirScore)}
          </Text>
          <Text style={styles.opponentElo}>
            {opponent?.elo_rating} ELO
          </Text>
        </View>
      </View>

      {match.status === 'pending' && (
        <Text style={styles.pendingNote}>
          Match resolves when both players sync their sleep tracker
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a3d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    color: '#888',
    fontSize: 13,
  },
  result: {
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  win: { color: '#4ecca3' },
  loss: { color: '#ff6b6b' },
  pending: { color: '#f9a825', fontSize: 13, fontWeight: '600' },
  voided: { color: '#666', fontSize: 13 },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  player: {
    flex: 1,
    alignItems: 'center',
  },
  playerName: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  score: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  winScore: {
    color: '#4ecca3',
  },
  eloDelta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  eloGain: { color: '#4ecca3' },
  eloLoss: { color: '#ff6b6b' },
  opponentElo: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  vs: {
    color: '#444',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  pendingNote: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
