import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { signIn, signUp } from '../services/auth';
import { registerUser } from '../services/api';

interface LoginScreenProps {
  onLogin: (userId: string) => void;
}

type Mode = 'login' | 'signup';

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const data = await signIn(email, password);
      if (data.user) {
        onLogin(data.user.id);
      }
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      Alert.alert('Error', 'Username must be 3-20 alphanumeric characters or underscores');
      return;
    }
    setLoading(true);
    try {
      const data = await signUp(email, password);
      if (!data.user) {
        Alert.alert('Error', 'Signup failed — no user returned');
        return;
      }
      // Register in our users table
      await registerUser(data.user.id, username);
      onLogin(data.user.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('Username already taken')) {
        Alert.alert('Error', 'That username is taken. Try another.');
      } else {
        Alert.alert('Signup failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🌙</Text>
        <Text style={styles.title}>Ranked Sleep</Text>
        <Text style={styles.subtitle}>Compete in nightly sleep battles</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Username (3-20 chars)"
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            <Text style={styles.switchText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 15,
    marginBottom: 48,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3d',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchMode: {
    alignItems: 'center',
    marginTop: 8,
  },
  switchText: {
    color: '#6c63ff',
    fontSize: 14,
  },
});
