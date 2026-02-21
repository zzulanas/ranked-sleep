import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RankBadgeProps {
  tier: string;
  elo?: number;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  Bronze: { emoji: '🥉', color: '#cd7f32', bg: '#2a1a0a' },
  Silver: { emoji: '🥈', color: '#c0c0c0', bg: '#1a1a1a' },
  Gold: { emoji: '🥇', color: '#ffd700', bg: '#2a200a' },
  Platinum: { emoji: '💎', color: '#b0e0e6', bg: '#0a1a2a' },
  Diamond: { emoji: '🔷', color: '#6c63ff', bg: '#0f0f2a' },
};

const SIZE_CONFIG = {
  sm: { fontSize: 10, padding: 4, emojiSize: 12 },
  md: { fontSize: 12, padding: 6, emojiSize: 16 },
  lg: { fontSize: 15, padding: 10, emojiSize: 22 },
};

export function RankBadge({ tier, elo, size = 'md' }: RankBadgeProps) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.Bronze;
  const sizeConf = SIZE_CONFIG[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.color,
          paddingHorizontal: sizeConf.padding * 2,
          paddingVertical: sizeConf.padding,
        },
      ]}
    >
      <Text style={{ fontSize: sizeConf.emojiSize }}>{config.emoji}</Text>
      <Text style={[styles.text, { color: config.color, fontSize: sizeConf.fontSize }]}>
        {tier}{elo != null ? ` · ${elo}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
