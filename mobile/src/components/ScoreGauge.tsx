import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScoreGaugeProps {
  score: number | null;
  size?: number;
}

function scoreColor(score: number): string {
  if (score >= 85) return '#4ecca3';   // great — teal
  if (score >= 70) return '#6c63ff';   // good — purple
  if (score >= 50) return '#f9a825';   // ok — amber
  return '#ff6b6b';                     // bad — red
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

export function ScoreGauge({ score, size = 120 }: ScoreGaugeProps) {
  if (score == null) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={[styles.circle, { width: size, height: size, borderColor: '#333' }]}>
          <Text style={styles.placeholder}>—</Text>
        </View>
      </View>
    );
  }

  const color = scoreColor(score);
  const label = scoreLabel(score);

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { width: size, height: size, borderColor: color }]}>
        <Text style={[styles.score, { color, fontSize: size * 0.28 }]}>
          {score.toFixed(0)}
        </Text>
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    borderRadius: 1000,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f1a',
  },
  score: {
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  placeholder: {
    color: '#444',
    fontSize: 32,
    fontWeight: 'bold',
  },
});
