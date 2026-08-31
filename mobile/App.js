import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/lib/auth";
import { Loading } from "./src/lib/ui";
import { colors } from "./src/lib/theme";
import { navigationRef } from "./src/lib/navigationRef";
import { ProfileButton } from "./src/lib/ProfileButton";
import { IconCourt, IconCoach, IconPlayers, IconMessages } from "./src/lib/icons";

import LoginScreen from "./src/screens/LoginScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import NewMatchScreen from "./src/screens/NewMatchScreen";
import ClubsScreen from "./src/screens/ClubsScreen";
import ClubScreen from "./src/screens/ClubScreen";
import CoachesScreen from "./src/screens/CoachesScreen";
import CoachScreen from "./src/screens/CoachScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ThreadsScreen from "./src/screens/ThreadsScreen";
import ChatScreen from "./src/screens/ChatScreen";
import SwipeScreen from "./src/screens/SwipeScreen";

const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MatchStack = createNativeStackNavigator();
const ClubStack = createNativeStackNavigator();
const CoachStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();

// Fælles udseende for hver fanes eget navigationshoved. Profil-knappen
// sidder i hjørnet på alle skærme, ligesom på websitet.
const screenOptions = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.chalk,
  headerTitleStyle: { fontWeight: "800" },
  headerRight: () => <ProfileButton />,
};

function ClubsStack() {
  return (
    <ClubStack.Navigator screenOptions={screenOptions}>
      <ClubStack.Screen name="Klubber" component={ClubsScreen} options={{ title: "Book bane" }} />
      <ClubStack.Screen
        name="Klub"
        component={ClubScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Klub" })}
      />
    </ClubStack.Navigator>
  );
}

function CoachesStack() {
  return (
    <CoachStack.Navigator screenOptions={screenOptions}>
      <CoachStack.Screen name="Traenere" component={CoachesScreen} options={{ title: "Find træner" }} />
      <CoachStack.Screen
        name="Traener"
        component={CoachScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Træner" })}
      />
    </CoachStack.Navigator>
  );
}

function MatchesStack() {
  return (
    <MatchStack.Navigator screenOptions={screenOptions}>
      <MatchStack.Screen name="Spillere" component={SwipeScreen} options={{ title: "Find medspiller" }} />
      <MatchStack.Screen name="Makkere" component={MatchesScreen} options={{ title: "Opslag" }} />
      <MatchStack.Screen name="NytOpslag" component={NewMatchScreen} options={{ title: "Opret opslag" }} />
    </MatchStack.Navigator>
  );
}

function MessagesStack() {
  return (
    <ChatStack.Navigator screenOptions={screenOptions}>
      <ChatStack.Screen name="Beskeder" component={ThreadsScreen} options={{ title: "Beskeder" }} />
      <ChatStack.Screen
        name="Samtale"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Samtale" })}
      />
    </ChatStack.Navigator>
  );
}

// Rækkefølgen matcher websitets bundlinje præcist: Book, Trænere,
// Medspillere, Beskeder. Profilen er bevidst ikke en femte fane.
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.court,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="KlubberTab"
        component={ClubsStack}
        options={{
          title: "Book bane",
          tabBarIcon: ({ focused, color }) => <IconCourt active={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="TraenereTab"
        component={CoachesStack}
        options={{
          title: "Trænere",
          tabBarIcon: ({ focused, color }) => <IconCoach active={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="MakkereTab"
        component={MatchesStack}
        options={{
          title: "Medspillere",
          tabBarIcon: ({ focused, color }) => <IconPlayers active={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="BeskederTab"
        component={MessagesStack}
        options={{
          title: "Beskeder",
          tabBarIcon: ({ focused, color }) => <IconMessages active={focused} color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Starter RacketBuddy…" />;
  if (!user) return <LoginScreen />;

  return (
    <RootStack.Navigator>
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          title: "Min profil",
          presentation: "modal",
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.chalk,
          headerTitleStyle: { fontWeight: "800" },
        }}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
