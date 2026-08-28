import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/lib/auth";
import { Loading } from "./src/lib/ui";
import { colors } from "./src/lib/theme";

import LoginScreen from "./src/screens/LoginScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import NewMatchScreen from "./src/screens/NewMatchScreen";
import ClubsScreen from "./src/screens/ClubsScreen";
import ClubScreen from "./src/screens/ClubScreen";
import CoachesScreen from "./src/screens/CoachesScreen";
import CoachScreen from "./src/screens/CoachScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Tabs = createBottomTabNavigator();
const MatchStack = createNativeStackNavigator();
const ClubStack = createNativeStackNavigator();
const CoachStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bane },
  headerTintColor: colors.kridt,
  headerTitleStyle: { fontWeight: "800" },
};

// Simpelt tekst-ikon, så appen ikke afhænger af et ikonbibliotek
function TabIcon({ label, focused }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{label}</Text>
    </View>
  );
}

function MatchesStack() {
  return (
    <MatchStack.Navigator screenOptions={screenOptions}>
      <MatchStack.Screen name="Makkere" component={MatchesScreen} options={{ title: "Find makker" }} />
      <MatchStack.Screen name="NytOpslag" component={NewMatchScreen} options={{ title: "Opret opslag" }} />
    </MatchStack.Navigator>
  );
}

function ClubsStack() {
  return (
    <ClubStack.Navigator screenOptions={screenOptions}>
      <ClubStack.Screen name="Klubber" component={ClubsScreen} options={{ title: "Klubber" }} />
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
      <CoachStack.Screen name="Traenere" component={CoachesScreen} options={{ title: "Trænere" }} />
      <CoachStack.Screen
        name="Traener"
        component={CoachScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Træner" })}
      />
    </CoachStack.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Starter Tennis Makker…" />;
  if (!user) return <LoginScreen />;

  return (
    <Tabs.Navigator
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        tabBarActiveTintColor: colors.bane,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="MakkereTab"
        component={MatchesStack}
        options={{
          title: "Makkere",
          tabBarIcon: ({ focused }) => <TabIcon label="🎾" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="KlubberTab"
        component={ClubsStack}
        options={{
          title: "Baner",
          tabBarIcon: ({ focused }) => <TabIcon label="📍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="TraenereTab"
        component={CoachesStack}
        options={{
          title: "Trænere",
          tabBarIcon: ({ focused }) => <TabIcon label="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ProfilTab"
        component={ProfileScreen}
        options={{
          title: "Profil",
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
