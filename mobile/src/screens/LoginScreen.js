import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { useAuth } from "../lib/auth";
import { Button } from "../lib/ui";
import { colors } from "../lib/theme";
import { DK_REGIONS } from "../lib/regions";

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === "signup" && !area) {
      setError("Vælg en region.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup({ email, password, name, area, level: 3 });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          Racket<Text style={{ color: colors.court }}>Buddy</Text>
        </Text>
        <Text style={styles.tagline}>
          Find en makker på dit niveau, book en træner, eller find en ledig bane.
        </Text>

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Navn</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" />
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
        />

        <Text style={styles.label}>Adgangskode</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Region</Text>
            <View style={styles.chips}>
              {DK_REGIONS.map((region) => (
                <Pressable
                  key={region}
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

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          <Button
            title={mode === "login" ? "Log ind" : "Opret profil"}
            onPress={submit}
            loading={busy}
          />
        </View>

        <Pressable onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
          <Text style={styles.switch}>
            {mode === "login" ? "Ny her? Opret profil" : "Har du en konto? Log ind"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 72, backgroundColor: colors.mist, flexGrow: 1 },
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
