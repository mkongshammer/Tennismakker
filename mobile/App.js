import { tr, useInternational } from "./src/lib/international";import { PushLifecycle, flushPushNavigation } from "./src/lib/PushLifecycle";
import AppPortal from "./src/screens/AppPortal";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { View, Pressable, Text, Platform, useWindowDimensions } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator, BottomTabBar } from "@react-navigation/bottom-tabs";
import { DesktopNavigation } from "./src/lib/DesktopNavigation";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/lib/auth";
import { Loading, ErrorMessage } from "./src/lib/ui";
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
  headerStyle: { backgroundColor: colors.chalk },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: "700", fontSize: 17 },
  headerShadowVisible: false,
  headerRight: () => <ProfileButton />
};

function ClubsStack() {useInternational();
  return (
    <ClubStack.Navigator screenOptions={screenOptions}>
      <ClubStack.Screen name="Klubber" component={ClubsScreen} options={{ title: tr("Book bane") }} />
      <ClubStack.Screen
        name="Klub"
        component={ClubScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Klub" })} />

    </ClubStack.Navigator>);

}

function CoachesStack() {useInternational();
  return (
    <CoachStack.Navigator screenOptions={screenOptions}>
      <CoachStack.Screen name="Traenere" component={CoachesScreen} options={{ title: tr("Find tr\xE6ner") }} />
      <CoachStack.Screen
        name="Traener"
        component={CoachScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Træner" })} />

    </CoachStack.Navigator>);

}

function MatchesStack() {useInternational();
  return (
    <MatchStack.Navigator screenOptions={screenOptions}>
      <MatchStack.Screen name="Spillere" component={SwipeScreen} options={{ title: tr("Find medspiller") }} />
      <MatchStack.Screen name="Makkere" component={MatchesScreen} options={{ title: tr("Opslag") }} />
      <MatchStack.Screen name="NytOpslag" component={NewMatchScreen} options={{ title: tr("Opret opslag") }} />
    </MatchStack.Navigator>);

}

function MessagesStack() {useInternational();
  return (
    <ChatStack.Navigator screenOptions={screenOptions}>
      <ChatStack.Screen name="Beskeder" component={ThreadsScreen} options={{ title: tr("Beskeder") }} />
      <ChatStack.Screen
        name="Samtale"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params?.name ?? "Samtale" })} />

    </ChatStack.Navigator>);

}

// Rækkefølgen matcher websitets bundlinje præcist: Book, Trænere,
// Medspillere, Beskeder. Profilen er bevidst ikke en femte fane.
function MainTabs() {useInternational();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  return (
    <Tabs.Navigator
      initialRouteName={user?.role === "CLUB_ADMIN" ? "AdminTab" : "KlubberTab"}
      tabBar={(props) => desktop ? <DesktopNavigation {...props} /> : <BottomTabBar {...props} />}
      sceneContainerStyle={desktop ? { marginLeft: 232 } : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.court,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.chalk, paddingTop: 6 },
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 4, marginBottom: 4 },
        tabBarActiveBackgroundColor: colors.courtTint,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
      }}>

      <Tabs.Screen
        name="KlubberTab"
        component={ClubsStack}
        options={{
          title: tr("Book bane"),
          tabBarIcon: ({ focused, color }) => <IconCourt active={focused} color={color} />
        }} />

      <Tabs.Screen
        name="TraenereTab"
        component={CoachesStack}
        options={{
          title: tr("Tr\xE6nere"),
          tabBarIcon: ({ focused, color }) => <IconCoach active={focused} color={color} />
        }} />

      <Tabs.Screen
        name="MakkereTab"
        component={MatchesStack}
        options={{
          title: tr("Medspillere"),
          tabBarIcon: ({ focused, color }) => <IconPlayers active={focused} color={color} />
        }} />

      <Tabs.Screen
        name="BeskederTab"
        component={MessagesStack}
        options={{
          title: tr("Beskeder"),
          tabBarIcon: ({ focused, color }) => <IconMessages active={focused} color={color} />
        }} />

      {user?.role === "CLUB_ADMIN" && <Tabs.Screen name="AdminTab" component={AppPortal} options={{ title: tr("Min klub"), tabBarIcon: ({ color }) => <IconCourt color={color} /> }} />}
    </Tabs.Navigator>);

}

function Root() {useInternational();
  const { user, loading, sessionError, restore } = useAuth();

  if (loading) return <Loading label={tr("Starter RacketBuddy\u2026")} />;
  if (sessionError) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.mist }}><ErrorMessage message={sessionError} onRetry={restore} /></View>;
  if (!user) return <LoginScreen />;

  return (
    <RootStack.Navigator initialRouteName="MainTabs">
      <RootStack.Screen name="WalletPortal" component={AppPortal} initialParams={{ destination: "/wallet" }} options={{ title: tr("Min klubwallet") }} />
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          title: tr("Min profil"),
          presentation: "modal",
          headerStyle: { backgroundColor: colors.chalk },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={tr("Luk min profil")} style={{ minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" }} onPress={() => navigationRef.goBack()}><Text style={{ color: colors.court, fontWeight: "700" }}>{tr("Luk")}</Text></Pressable>
        }} />

    </RootStack.Navigator>);

}

export default function App() {useInternational();
  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
    <View style={{ flex: 1, width: "100%", backgroundColor: colors.mist }}>
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer documentTitle={{ formatter: (options) => options?.title ? `${options.title} · RacketBuddy` : "RacketBuddy" }} onReady={flushPushNavigation} ref={navigationRef} theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.mist, primary: colors.court, card: colors.chalk, text: colors.ink, border: colors.border } }}>
          <SessionStatusBar />
          <PushLifecycle />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
    </View>
    </View>);

}

function SessionStatusBar() {useInternational();return <StatusBar style="dark" />;}
