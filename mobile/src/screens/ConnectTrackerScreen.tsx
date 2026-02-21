import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
// @ts-ignore — terra-react-native types may not be perfect
import Terra from 'terra-react-native';
import { getUser } from '../services/api';

interface ConnectTrackerScreenProps {
  userId: string;
  onConnected: () => void;
}

export function ConnectTrackerScreen({ userId, onConnected }: ConnectTrackerScreenProps) {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Initialize Terra SDK with your Dev ID and API key
      // The reference ID (userId) is sent to the backend via the USER_AUTH webhook
      await Terra.initializeTerra({
        devId: process.env.EXPO_PUBLIC_TERRA_DEV_ID ?? '',
        referenceId: userId,
      });

      // Open the Terra widget for provider selection
      await Terra.openWidget();

      // Start polling for terra_user_id to be set by the webhook
      setLoading(false);
      setPolling(true);
      await pollForConnection();
    } catch (err) {
      setLoading(false);
      Alert.alert(
        'Connection failed',
        err instanceof Error ? err.message : 'Failed to open Terra widget'
      );
    }
  };

  const pollForConnection = async () => {
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      try {
        const { user } = await getUser(userId);
        if (user.terra_connected) {
          setPolling(false);
          onConnected();
          return;
        }
      } catch {
        // Keep polling
      }
    }

    setPolling(false);
    Alert.alert(
      'Still connecting...',
      'Your tracker may still be syncing. You can continue to the app — we\'ll update once connected.',
      [{ text: 'Continue', onPress: onConnected }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📱</Text>
      <Text style={styles.title}>Connect Your Sleep Tracker</Text>
      <Text style={styles.subtitle}>
        Link your Garmin, Apple Watch, Oura Ring, Fitbit, or other device to start competing.
      </Text>

      <View style={styles.supported}>
        {['Garmin', 'Apple Health', 'Oura', 'Fitbit', 'Whoop'].map(name => (
          <View key={name} style={styles.deviceChip}>
            <Text style={styles.deviceText}>{name}</Text>
          </View>
        ))}
      </View>

      {polling ? (
        <View style={styles.pollingContainer}>
          <ActivityIndicator color="#6c63ff" size="large" />
          <Text style={styles.pollingText}>Waiting for connection...</Text>
          <Text style={styles.pollingSubtext}>
            Complete the setup in your browser, then come back here.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect Sleep Tracker</Text>
          )}
        </TouchableOpacity>
      )}

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
  emoji: { fontSize: 64, marginBottom: 16 },
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
    marginBottom: 32,
  },
  supported: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  deviceChip: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3d',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  deviceText: {
    color: '#aaa',
    fontSize: 13,
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
  pollingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  pollingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pollingSubtext: { color: '#888', fontSize: 14, textAlign: 'center' },
  skip: { marginTop: 24 },
  skipText: { color: '#555', fontSize: 14 },
});
