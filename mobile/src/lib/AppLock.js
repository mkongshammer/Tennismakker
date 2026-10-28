import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "./auth";
import { Button, Loading } from "./ui";
import { colors } from "./theme";

const AppLockContext = createContext(null);
const lockKey = (userId) => `rb_biometric_lock:${userId}`;

function labelForTypes(types) {
  if (Platform.OS === "ios" && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "ansigtsgenkendelse";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return Platform.OS === "ios" ? "Touch ID" : "fingeraftryk";
  return "biometri";
}

export function AppLockProvider({ children }) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(Platform.OS === "ios" ? "Face ID" : "biometri");
  const appState = useRef(AppState.currentState);
  const authenticating = useRef(false);

  const inspectBiometrics = useCallback(async () => {
    if (Platform.OS === "web") return { available: false, label: "biometri" };
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const label = labelForTypes(types ?? []);
    setBiometricLabel(label);
    return { available: Boolean(hardware && enrolled), label };
  }, []);

  const unlock = useCallback(async () => {
    if (!user || !enabled || Platform.OS === "web" || authenticating.current) return false;
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Lås RacketBuddy op",
        cancelLabel: "Annullér",
        fallbackLabel: "Brug enhedskode",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        return true;
      }
      return false;
    } finally {
      authenticating.current = false;
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!user || Platform.OS === "web") {
      setEnabled(false);
      setLocked(false);
      setReady(true);
      return () => { cancelled = true; };
    }
    // Never hold the app on a spinner: a user who hasn't turned the lock on
    // goes straight in, and the native checks get two seconds before we give
    // up and open the app unlocked.
    const withTimeout = (p, fallback) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), 2000))]);
    void (async () => {
      let shouldLock = false;
      try {
        const stored = await withTimeout(SecureStore.getItemAsync(lockKey(user.id)), null);
        if (stored === "1") {
          const state = await withTimeout(inspectBiometrics(), { available: false });
          shouldLock = Boolean(state?.available);
        }
      } catch {
        shouldLock = false;
      }
      if (cancelled) return;
      setEnabled(shouldLock);
      setLocked(shouldLock);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, inspectBiometrics]);

  useEffect(() => {
    if (ready && user && enabled && locked && AppState.currentState === "active") void unlock();
  }, [ready, user?.id, enabled, locked, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const previous = appState.current;
      appState.current = next;
      if (!user || !enabled) return;
      if (previous === "active" && next !== "active") setLocked(true);
      if (previous !== "active" && next === "active") {
        setLocked(true);
        setTimeout(() => { void unlock(); }, 150);
      }
    });
    return () => subscription.remove();
  }, [user?.id, enabled, unlock]);

  const enableBiometricLock = useCallback(async () => {
    if (!user || Platform.OS === "web") return { ok: false, message: "Biometrisk applås er kun tilgængelig i mobilappen." };
    const state = await inspectBiometrics();
    if (!state.available) return { ok: false, message: `Aktivér ${state.label} eller en anden biometrisk metode på telefonen først.` };
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Aktivér applås",
      cancelLabel: "Annullér",
      fallbackLabel: "Brug enhedskode",
      disableDeviceFallback: false,
    });
    if (!result.success) return { ok: false, message: "Applås blev ikke aktiveret." };
    await SecureStore.setItemAsync(lockKey(user.id), "1");
    setEnabled(true);
    setLocked(false);
    return { ok: true };
  }, [user?.id, inspectBiometrics]);

  const disableBiometricLock = useCallback(async () => {
    if (user && Platform.OS !== "web") await SecureStore.deleteItemAsync(lockKey(user.id));
    setEnabled(false);
    setLocked(false);
    return { ok: true };
  }, [user?.id]);

  return (
    <AppLockContext.Provider value={{ enabled, locked, ready, biometricLabel, unlock, enableBiometricLock, disableBiometricLock }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function AppLockGate({ children }) {
  const { user } = useAuth();
  const lock = useAppLock();
  if (user && !lock.ready) return <Loading label="Sikrer RacketBuddy…" />;
  if (!user || !lock.enabled || !lock.locked) return children;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.mist }}>
      <View style={{ width: "100%", maxWidth: 420, gap: 18, alignItems: "center" }}>
        <Text style={{ color: colors.courtText, fontSize: 18, fontWeight: "800" }}>RacketBuddy</Text>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: "800", textAlign: "center" }}>Appen er låst</Text>
        <Text style={{ color: colors.slate, fontSize: 15, lineHeight: 22, textAlign: "center" }}>Bekræft med {lock.biometricLabel} for at fortsætte.</Text>
        <View style={{ width: "100%" }}><Button title={`Lås op med ${lock.biometricLabel}`} onPress={lock.unlock} /></View>
      </View>
    </View>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock skal bruges inde i AppLockProvider");
  return ctx;
}
