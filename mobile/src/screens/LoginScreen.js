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
  Modal,
  useWindowDimensions } from
"react-native";
import { useInternational, tr } from "../lib/international";
import { US_STATES } from "../../../shared/us-address.mjs";
import { PreferencesPicker } from "../lib/PreferencesPicker";
import { useAuth } from "../lib/auth";
import { Button } from "../lib/ui";
import { colors } from "../lib/theme";
import { CourtScene } from "../lib/CourtScene";
import { DK_REGIONS } from "../lib/regions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const { country, locale } = useInternational();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [usState, setUsState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lock = useRef(false);
  const passwordRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const isUS = country === "US";
  const stateName = US_STATES.find((state) => state.code === usState)?.name;

  const resetLocation = () => {
    setArea("");
    setStreetAddress("");
    setUsState("");
    setPostalCode("");
  };

  const submit = async () => {
    if (lock.current) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Skriv en gyldig e-mail.");
    if (!password) return setError("Skriv din adgangskode.");
    if (mode === "signup" && !name.trim()) return setError("Skriv dit navn.");
    if (mode === "signup" && password.length < 8) return setError("Adgangskoden skal være mindst 8 tegn.");
    if (mode === "signup" && !area.trim()) return setError(country === "DK" ? "Vælg en region." : isUS ? "Enter your city." : "Enter your city/area.");
    if (mode === "signup" && isUS && !usState) return setError("Choose your state.");
    if (mode === "signup" && isUS && !/^\d{5}(?:-\d{4})?$/.test(postalCode.trim())) return setError("Enter a valid US ZIP code.");
    lock.current = true;
    setBusy(true);
    try {
      if (mode !== "signup") await login(email.trim().toLowerCase(), password, mode === "club");else
      await signup({ email: email.trim().toLowerCase(), password, name: name.trim(), area: area.trim(), country, locale, level: 3, state: usState, postalCode: postalCode.trim(), streetAddress: streetAddress.trim() });
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={[styles.wrap, { paddingTop: Math.max(24, insets.top + 20), paddingBottom: Math.max(24, insets.bottom + 16) }, desktop && styles.desktopWrap]} keyboardShouldPersistTaps="handled">
        <View style={[styles.welcome, desktop && styles.desktopWelcome]}>
        <Text style={styles.logo}>{"Racket"}<Text style={{ color: colors.optic }}>{"Buddy"}</Text><Text style={{ color: colors.optic }}>.</Text></Text>
        <View style={styles.welcomeBody}>
          <Text style={styles.kicker}>{tr("MERE TID P\xC5 BANEN")}</Text>
          <Text style={styles.heroTitle}>{mode === "club" ? tr("Din klub.\nSamlet \xE9t sted.") : tr("Godt spil\nstarter her.")}</Text>
          <Text style={styles.tagline}>{mode === "club" ? tr("Bookinger, medlemmer og klubdrift \u2014 ogs\xE5 n\xE5r du er p\xE5 farten.") : tr("Din n\xE6ste bane, tr\xE6ner og medspiller. Lige ved h\xE5nden.")}</Text>
        </View>
        <CourtScene height={desktop ? 220 : 110} />
        </View>
        <View style={[styles.form, desktop && styles.desktopForm]}>
        <PreferencesPicker onChange={async (value) => {resetLocation();await import("../lib/international").then((m) => m.setInternational(value));}} />
        <Text accessibilityRole="header" style={styles.formTitle}>{mode === "club" ? tr("Klublogin") : mode === "signup" ? tr("Velkommen p\xE5 holdet") : tr("Velkommen tilbage")}</Text>
        <Text style={styles.formHint}>{mode === "club" ? tr("Brug klubbens administratorkonto.") : mode === "signup" ? tr("Opret din profil og find dit n\xE6ste spil.") : tr("Log ind som spiller eller tr\xE6ner.")}</Text>
        {mode === "signup" && <><Text style={styles.label}>{tr("Navn")}</Text><TextInput accessibilityLabel={tr("Navn")} editable={!busy} autoComplete="name" maxLength={120} style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" /></>}

        <Text style={styles.label}>{tr("E-mail")}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" accessibilityLabel={tr("E-mail")} editable={!busy} autoCorrect={false} returnKeyType="next" placeholder={tr("dig@eksempel.dk")} placeholderTextColor={colors.slateLight} onSubmitEditing={() => passwordRef.current?.focus()} />

        <Text style={styles.label}>{tr("Adgangskode")}</Text>
        <View style={styles.passwordWrap}><TextInput style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} ref={passwordRef} accessibilityLabel={tr("Adgangskode")} editable={!busy} autoComplete={mode === "signup" ? "new-password" : "current-password"} returnKeyType="go" onSubmitEditing={submit} />
          <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? tr("Skjul adgangskode") : tr("Vis adgangskode")} disabled={busy} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><Text style={{ color: colors.court, fontWeight: "700", fontSize: 13 }}>{showPassword ? tr("Skjul") : tr("Vis")}</Text></Pressable></View>
        {mode === "signup" && <Text style={{ marginTop: 6, color: colors.slate }}>{tr("Mindst 8 tegn.")}</Text>}
        {mode !== "signup" && <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://racketbuddy.app/login/glemt").catch(() => setError("Kunne ikke åbne siden. Prøv igen."))}><Text style={[styles.switch, { textAlign: "right", paddingVertical: 10, marginTop: 4 }]}>{tr("Glemt adgangskode?")}</Text></Pressable>}

        {mode === "signup" && <>
          {country === "DK" ? <>
            <Text style={styles.label}>{tr("Region")}</Text>
            <View style={styles.chips}>{DK_REGIONS.map((region) => <Pressable key={tr(region)} accessibilityRole="button" accessibilityState={{ selected: area === region }} disabled={busy} onPress={() => setArea(region)} style={[styles.chip, area === region && styles.chipActive]}><Text style={[styles.chipText, area === region && styles.chipTextActive]}>{tr(region)}</Text></Pressable>)}</View>
          </> : isUS ? <>
            <Text style={styles.label}>Street address <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput accessibilityLabel="Street address" style={styles.input} value={streetAddress} onChangeText={setStreetAddress} editable={!busy} autoComplete="street-address" textContentType="fullStreetAddress" maxLength={150} placeholder="123 Main St" placeholderTextColor={colors.slateLight}/>
            <Text style={styles.privateHint}>Used for device autofill only. Your street address is not stored or shown publicly.</Text>
            <Text style={styles.label}>City</Text>
            <TextInput accessibilityLabel="City" style={styles.input} value={area} onChangeText={setArea} editable={!busy} autoComplete="address-line2" textContentType="addressCity" maxLength={100} autoCapitalize="words" placeholder="Boston" placeholderTextColor={colors.slateLight}/>
            <Text style={styles.label}>State</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="State" disabled={busy} onPress={() => setShowStatePicker(true)} style={styles.input}><Text style={{color:usState?colors.ink:colors.slateLight,fontSize:16}}>{usState ? `${stateName} (${usState})` : "Select state"}</Text></Pressable>
            <Text style={styles.label}>ZIP code</Text>
            <TextInput accessibilityLabel="ZIP code" style={styles.input} value={postalCode} onChangeText={text=>setPostalCode(text.replace(/[^0-9-]/g,''))} editable={!busy} autoComplete="postal-code" textContentType="postalCode" keyboardType="number-pad" maxLength={10} placeholder="02108" placeholderTextColor={colors.slateLight}/>
            <Text style={styles.privateHint}>Your public location is city and state only. ZIP stays private.</Text>
          </> : <><Text style={styles.label}>{tr("By / område")}</Text><TextInput accessibilityLabel={tr("By / område")} style={styles.input} value={area} onChangeText={setArea} editable={!busy} maxLength={100} autoComplete="address-line2" /></>}
        </>}

        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{tr(error)}</Text>}

        <View style={{ marginTop: 16 }}><Button title={mode === "club" ? tr("Log ind p\xE5 klubben") : mode === "login" ? tr("Log ind") : tr("Opret profil")} onPress={submit} loading={busy} /></View>
        <View style={{ marginTop: 12 }}><Button variant="quiet" title={mode === "club" ? tr("Tilbage til spiller- og tr\xE6nerlogin") : tr("Klublogin")} disabled={busy} onPress={() => {setMode(mode === "club" ? "login" : "club");setError(null);}} /></View>
        <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => {setMode(mode === "login" ? "signup" : "login");setError(null);}}><Text style={styles.switch}>{mode === "login" ? tr("Ny her? Opret profil") : tr("Har du en konto? Log ind")}</Text></Pressable>
        </View>
      </ScrollView>
      <Modal visible={showStatePicker} transparent animationType="slide" onRequestClose={()=>setShowStatePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={()=>setShowStatePicker(false)}>
          <Pressable style={[styles.stateSheet,{paddingBottom:Math.max(20,insets.bottom+12)}]} onPress={()=>{}}>
            <View style={styles.stateHeader}><Text style={styles.stateTitle}>Select state</Text><Pressable accessibilityRole="button" onPress={()=>setShowStatePicker(false)}><Text style={styles.stateDone}>Done</Text></Pressable></View>
            <ScrollView>{US_STATES.map((state)=><Pressable key={state.code} accessibilityRole="button" accessibilityState={{selected:usState===state.code}} onPress={()=>{setUsState(state.code);setShowStatePicker(false);}} style={[styles.stateRow,usState===state.code&&styles.stateRowActive]}><Text style={styles.stateRowText}>{state.name}</Text><Text style={styles.stateCode}>{state.code}</Text></Pressable>)}</ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>);
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
  optional:{fontWeight:"500",color:colors.slate},
  privateHint:{marginTop:6,color:colors.slate,fontSize:12,lineHeight:17},
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, fontSize: 16, color: colors.ink, minHeight: 52, justifyContent:"center" },
  passwordWrap: { flexDirection: "row", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chalk, alignItems: "center" },
  passwordToggle: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  switch: { color: colors.court, textAlign: "center", marginTop: 20, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 48, minWidth: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "600", color: colors.ink, fontSize: 13 },
  chipTextActive: { color: colors.chalk },
  error: { color: colors.court, fontWeight: "600", marginTop: 14 },
  modalBackdrop:{flex:1,backgroundColor:"rgba(15,23,42,0.45)",justifyContent:"flex-end"},
  stateSheet:{maxHeight:"72%",backgroundColor:colors.chalk,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:18,paddingTop:14},
  stateHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:colors.border},
  stateTitle:{fontSize:20,fontWeight:"800",color:colors.ink},
  stateDone:{fontSize:15,fontWeight:"700",color:colors.court,padding:8},
  stateRow:{minHeight:52,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:4,borderBottomWidth:1,borderBottomColor:colors.border},
  stateRowActive:{backgroundColor:colors.mist},
  stateRowText:{fontSize:16,color:colors.ink,fontWeight:"600"},
  stateCode:{fontSize:14,color:colors.slate,fontWeight:"700"}
});
