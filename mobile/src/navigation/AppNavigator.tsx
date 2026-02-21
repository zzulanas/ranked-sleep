import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type TabParamList = {
  Home: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

interface AppNavigatorProps {
  userId: string;
}

export function AppNavigator({ userId }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#0f0f1a',
            borderTopColor: '#2a2a3d',
          },
          tabBarActiveTintColor: '#6c63ff',
          tabBarInactiveTintColor: '#666',
          headerStyle: { backgroundColor: '#0f0f1a' },
          headerTintColor: '#fff',
        }}
      >
        <Tab.Screen
          name="Home"
          options={{
            title: 'Tonight',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🌙</Text>,
          }}
        >
          {() => <HomeScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Leaderboard"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏆</Text>,
          }}
        >
          {() => <LeaderboardScreen currentUserId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
          }}
        >
          {() => <ProfileScreen userId={userId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
