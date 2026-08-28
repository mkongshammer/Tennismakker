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
        <Text style={styles.logo}>TENNIS MAKKER</Text>
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
            <Text style={styles.label}>Område</Text>
            <TextInput
              style={styles.input}
              value={area}
              onChangeText={setArea}
              placeholder="fx Frederiksberg"
            />
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
  wrap: { padding: 24, paddingTop: 72, backgroundColor: colors.kridt, flexGrow: 1 },
  logo: { fontSize: 30, fontWeight: "900", color: colors.bane, letterSpacing: -0.5 },
  tagline: { color: colors.muted, marginTop: 8, marginBottom: 28, lineHeight: 20 },
  label: { fontWeight: "700", color: colors.muted, marginBottom: 5, marginTop: 12, fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 13,
    fontSize: 16,
  },
  error: { color: colors.grus, fontWeight: "600", marginTop: 14 },
  switch: { color: colors.grus, textAlign: "center", marginTop: 20, fontWeight: "600" },
});
