import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getLastNightSleep } from '../services/healthData';

interface ConnectTrackerScreenProps {
  onConnected: () => void;
}

export function ConnectTrackerScreen({ onConnected }: ConnectTrackerScreenProps) {
  const [loading, setLoading] = useState(false);

  const isIOS = Platform.OS === 'ios';

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Calling getLastNightSleep() triggers the OS permission dialog.
      // Data may be null if no sleep was recorded yet — that's fine.
      await getLastNightSleep();
      onConnected();
    } catch {
      Alert.alert(
        'Permission Required',
        isIOS
          ? 'Please allow access to Health data in Settings → Privacy & Security → Health → Ranked Sleep.'
          : 'Please allow Ranked Sleep to access Health Connect. Make sure the Health Connect app is installed and your tracker is synced.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{isIOS ? '🍎' : '🤖'}</Text>
      <Text style={styles.title}>Connect Your Sleep Tracker</Text>
      <Text style={styles.subtitle}>
        {isIOS
          ? 'Ranked Sleep reads sleep data from Apple Health, which automatically syncs from your Garmin, Oura Ring, or other wearable.'
          : 'Ranked Sleep reads sleep data from Health Connect. Garmin users: make sure "Health Snapshot" sync is enabled in the Garmin Connect app settings.'}
      </Text>

      {isIOS ? (
        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>Garmin users:</Text>
          <Text style={styles.step}>1. Open Garmin Connect → More → Health &amp; Wellness</Text>
          <Text style={styles.step}>2. Enable "Apple Health" sync</Text>
          <Text style={styles.step}>3. Sleep data will sync automatically each morning</Text>
        </View>
      ) : (
        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>Garmin users:</Text>
          <Text style={styles.step}>1. Open Garmin Connect → Settings → Health Snapshot</Text>
          <Text style={styles.step}>2. Enable "Health Connect" sync</Text>
          <Text style={styles.step}>3. Sleep data will sync automatically each morning</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleConnect}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Connect {isIOS ? 'Apple Health' : 'Health Connect'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.skip} onPress={onConnected}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  steps: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3d',
    padding: 16,
    width: '100%',
    marginBottom: 32,
    gap: 6,
  },
  stepsTitle: {
    color: '#aaa',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  step: {
    color: '#888',
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#6c63ff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  skip: { marginTop: 20 },
  skipText: { color: '#555', fontSize: 14 },
});
