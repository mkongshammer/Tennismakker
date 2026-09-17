import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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

const TERMS_URL = "https://racketbuddy.app/vilkaar";
const PRIVACY_URL = "https://racketbuddy.app/privatliv";
const FORGOT_URL = "https://racketbuddy.app/login/glemt";

function CheckRow({ checked, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === "signup" && !area) {
      setError("Vælg en region.");
      return;
    }
    if (mode === "signup" && !ageConfirmed) {
      setError("Du skal være fyldt 18 år for at oprette en profil.");
      return;
    }
    if (mode === "signup" && !termsAccepted) {
      setError("Du skal acceptere vilkår og privatlivspolitik.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup({
          email,
          password,
          name,
          area,
          level: 3,
          ageConfirmed: true,
          termsAccepted: true,
        });
      }
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
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {mode === "login" ? (
          <Pressable onPress={() => Linking.openURL(FORGOT_URL)}>
            <Text style={styles.forgot}>Glemt adgangskode?</Text>
          </Pressable>
        ) : null}

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

            <View style={styles.consentBox}>
              <CheckRow checked={ageConfirmed} onPress={() => setAgeConfirmed((v) => !v)}>
                Jeg er fyldt 18 år.
              </CheckRow>
              <CheckRow checked={termsAccepted} onPress={() => setTermsAccepted((v) => !v)}>
                Jeg accepterer RacketBuddys vilkår og privatlivspolitik.
              </CheckRow>
              <View style={styles.legalLinks}>
                <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Læs vilkår</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Læs privatlivspolitik</Text>
              </View>
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

        <Pressable
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
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
  forgot: { color: colors.court, fontWeight: "700", alignSelf: "flex-end", marginTop: 9, fontSize: 13 },
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
  consentBox: { marginTop: 18, gap: 12 },
  checkRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.slate,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkmark: { color: colors.chalk, fontWeight: "900", fontSize: 14 },
  checkText: { flex: 1, color: colors.ink, lineHeight: 21 },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: 32 },
  legalLink: { color: colors.court, fontWeight: "700", fontSize: 13 },
  dot: { color: colors.slate },
  error: { color: colors.court, fontWeight: "600", marginTop: 14 },
  switch: { color: colors.court, textAlign: "center", marginTop: 20, fontWeight: "600" },
});
