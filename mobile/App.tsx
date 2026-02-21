import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { ConnectTrackerScreen } from './src/screens/ConnectTrackerScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { getCurrentSession } from './src/services/auth';
import { getUser } from './src/services/api';

// Configure push notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type AppState = 'loading' | 'logged_out' | 'connect_tracker' | 'ready';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const session = await getCurrentSession();
      if (!session) {
        setAppState('logged_out');
        return;
      }
      await handleLogin(session.user.id);
    } catch {
      setAppState('logged_out');
    }
  };

  const handleLogin = async (id: string) => {
    setUserId(id);
    try {
      const { user } = await getUser(id);
      // Show connect screen until first sleep sync (provider is set after first sync)
      if (!user.health_connected) {
        setAppState('connect_tracker');
      } else {
        setAppState('ready');
      }
    } catch {
      // If user profile doesn't exist yet (first signup), go to connect tracker
      setAppState('connect_tracker');
    }
  };

  if (appState === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    );
  }

  if (appState === 'logged_out') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLogin={handleLogin} />
      </SafeAreaProvider>
    );
  }

  if (appState === 'connect_tracker' && userId) {
    return (
      <SafeAreaProvider>
        <ConnectTrackerScreen onConnected={() => setAppState('ready')} />
      </SafeAreaProvider>
    );
  }

  if (appState === 'ready' && userId) {
    return (
      <SafeAreaProvider>
        <AppNavigator userId={userId} />
      </SafeAreaProvider>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
