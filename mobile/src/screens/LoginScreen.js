import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Linking,
} from "react-native";
import { useAuth } from "../lib/auth";
import { Button } from "../lib/ui";
import { colors } from "../lib/theme";
import { DK_REGIONS } from "../lib/regions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const passwordRef = useRef(null);
  const insets = useSafeAreaInsets();

  const submit = async () => {
    if (lock.current) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Skriv en gyldig e-mail.");
    if (!password) return setError("Skriv din adgangskode.");
    if (mode === "signup" && !name.trim()) return setError("Skriv dit navn.");
    if (mode === "signup" && password.length < 8) return setError("Adgangskoden skal være mindst 8 tegn.");
    if (mode === "signup" && !area) {
      setError("Vælg en region.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim().toLowerCase(), password);
      else await signup({ email: email.trim().toLowerCase(), password, name: name.trim(), area, level: 3 });
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={[styles.wrap, { paddingTop: Math.max(48, insets.top + 24), paddingBottom: Math.max(24, insets.bottom + 16) }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          Racket<Text style={{ color: colors.court }}>Buddy</Text>
        </Text>
        <Text style={styles.tagline}>
          Find en makker på dit niveau, book en træner, eller find en ledig bane.
        </Text>

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Navn</Text>
            <TextInput accessibilityLabel="Navn" editable={!busy} autoComplete="name" maxLength={120} style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" />
          </>
        )}

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel="E-mail"
          editable={!busy}
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Text style={styles.label}>Adgangskode</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          ref={passwordRef}
          accessibilityLabel="Adgangskode"
          editable={!busy}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {mode === "signup" && <Text style={{ marginTop: 6, color: colors.slate }}>Mindst 8 tegn.</Text>}
        {mode === "login" && <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://racketbuddy.app/login/glemt").catch(() => setError("Kunne ikke åbne siden. Prøv igen."))}>
          <Text style={[styles.switch, { textAlign: "right", paddingVertical: 10, marginTop: 4 }]}>Glemt adgangskode?</Text>
        </Pressable>}

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Region</Text>
            <View style={styles.chips}>
              {DK_REGIONS.map((region) => (
                <Pressable
                  key={region}
                  accessibilityRole="button"
                  accessibilityState={{ selected: area === region }}
                  disabled={busy}
                  onPress={() => setArea(region)}
                  style={[styles.chip, area === region && styles.chipActive]}
                >
                  <Text style={[styles.chipText, area === region && styles.chipTextActive]}>
                    {region}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          <Button
            title={mode === "login" ? "Log ind" : "Opret profil"}
            onPress={submit}
            loading={busy}
          />
        </View>

        <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
          <Text style={styles.switch}>
            {mode === "login" ? "Ny her? Opret profil" : "Har du en konto? Log ind"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, width: "100%", maxWidth: 520, alignSelf: "center", flexGrow: 1 },
  logo: { fontSize: 30, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  tagline: { color: colors.slate, marginTop: 8, marginBottom: 28, lineHeight: 20 },
  label: { fontWeight: "700", color: colors.slate, marginBottom: 5, marginTop: 12, fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 13,
    fontSize: 16,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "600", color: colors.ink, fontSize: 13 },
  chipTextActive: { color: colors.chalk },
  error: { color: colors.court, fontWeight: "600", marginTop: 14 },
  switch: { color: colors.court, textAlign: "center", marginTop: 20, fontWeight: "600" },
});
