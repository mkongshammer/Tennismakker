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
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../lib/auth";
import { Button } from "../lib/ui";
import { colors } from "../lib/theme";
import { CourtScene } from "../lib/CourtScene";
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
  const [showPassword, setShowPassword] = useState(false);
  const lock = useRef(false);
  const passwordRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;

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
      if (mode !== "signup") await login(email.trim().toLowerCase(), password, mode === "club");
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
      <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={[styles.wrap, { paddingTop: Math.max(24, insets.top + 20), paddingBottom: Math.max(24, insets.bottom + 16) }, desktop && styles.desktopWrap]} keyboardShouldPersistTaps="handled">
        <View style={[styles.welcome, desktop && styles.desktopWelcome]}>
        <Text style={styles.logo}>
          Racket<Text style={{ color: colors.optic }}>Buddy</Text><Text style={{ color: colors.optic }}>.</Text>
        </Text>
        <View style={styles.welcomeBody}>
          <Text style={styles.kicker}>MERE TID PÅ BANEN</Text>
          <Text style={styles.heroTitle}>{mode === "club" ? "Din klub.\nSamlet ét sted." : "Godt spil\nstarter her."}</Text>
          <Text style={styles.tagline}>{mode === "club" ? "Bookinger, medlemmer og klubdrift — også når du er på farten." : "Din næste bane, træner og medspiller. Lige ved hånden."}</Text>
        </View>
        <CourtScene height={desktop ? 220 : 110} />
        </View>
        <View style={[styles.form, desktop && styles.desktopForm]}>
        <Text accessibilityRole="header" style={styles.formTitle}>{mode === "club" ? "Klublogin" : mode === "signup" ? "Velkommen på holdet" : "Velkommen tilbage"}</Text>
        <Text style={styles.formHint}>{mode === "club" ? "Brug klubbens administratorkonto." : mode === "signup" ? "Opret din profil og find dit næste spil." : "Log ind som spiller eller træner."}</Text>
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
          placeholder="dig@eksempel.dk"
          placeholderTextColor={colors.slateLight}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Text style={styles.label}>Adgangskode</Text>
        <View style={styles.passwordWrap}><TextInput
          style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          ref={passwordRef}
          accessibilityLabel="Adgangskode"
          editable={!busy}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          returnKeyType="go"
          onSubmitEditing={submit}
        /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Skjul adgangskode" : "Vis adgangskode"} disabled={busy} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><Text style={{ color: colors.court, fontWeight: "700", fontSize: 13 }}>{showPassword ? "Skjul" : "Vis"}</Text></Pressable></View>
        {mode === "signup" && <Text style={{ marginTop: 6, color: colors.slate }}>Mindst 8 tegn.</Text>}
        {mode !== "signup" && <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://racketbuddy.app/login/glemt").catch(() => setError("Kunne ikke åbne siden. Prøv igen."))}>
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
            title={mode === "club" ? "Log ind på klubben" : mode === "login" ? "Log ind" : "Opret profil"}
            onPress={submit}
            loading={busy}
          />
        </View>

        <View style={{marginTop:12}}><Button variant="quiet" title={mode === "club" ? "Tilbage til spiller- og trænerlogin" : "Klublogin"} disabled={busy} onPress={()=>{setMode(mode === "club" ? "login" : "club");setError(null);}}/></View>
        <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
          <Text style={styles.switch}>
            {mode === "login" ? "Ny her? Opret profil" : "Har du en konto? Log ind"}
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, width: "100%", maxWidth: 560, alignSelf: "center", flexGrow: 1, gap: 16 },
  desktopWrap: { maxWidth: 1100, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 40, gap: 48 },
  welcome: { backgroundColor: colors.ink, borderRadius: 28, overflow: "hidden", paddingTop: 24 },
  desktopWelcome: { flex: 1, paddingTop: 36 },
  welcomeBody: { paddingHorizontal: 24, paddingTop: 28 },
  logo: { fontSize: 24, fontWeight: "800", color: colors.chalk, letterSpacing: -0.7, paddingHorizontal: 24 },
  kicker: { color: "#B8C9E0", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  heroTitle: { color: colors.chalk, fontSize: 38, lineHeight: 41, fontWeight: "800", letterSpacing: -1.4 },
  tagline: { color: "#CCD8E8", marginTop: 12, lineHeight: 22, fontSize: 14, maxWidth: 340 },
  form: { padding: 12 },
  desktopForm: { flex: 1, maxWidth: 400 },
  formTitle: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  formHint: { color: colors.slate, marginTop: 6, marginBottom: 12, fontSize: 14, lineHeight: 22 },
  label: { fontWeight: "700", color: colors.ink, marginBottom: 7, marginTop: 14, fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    color: colors.ink,
    minHeight: 52,
  },
  passwordWrap: { flexDirection: "row", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chalk, alignItems: "center" },
  passwordToggle: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  switch: { color: colors.court, textAlign: "center", fontSize: 14, fontWeight: "600", paddingVertical: 16 },
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
