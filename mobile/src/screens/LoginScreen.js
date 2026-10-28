import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useInternational, tr } from "../lib/international";
import { PreferencesPicker } from "../lib/PreferencesPicker";
import { useAuth } from "../lib/auth";
import { Button } from "../lib/ui";
import { colors } from "../lib/theme";
import { CourtScene } from "../lib/CourtScene";
import { DK_REGIONS } from "../lib/regions";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SocialAuthButtons } from "../lib/SocialAuthButtons";

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
].map(([code,name])=>({code,name}));

const PRIVACY_URL = "https://racketbuddy.app/privacy";
const TERMS_URL = "https://racketbuddy.app/terms";

export default function LoginScreen() {
  const { login, signup, socialLogin, requestPasswordReset } = useAuth();
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
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialPending, setSocialPending] = useState(null);
  const lock = useRef(false);
  const passwordRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const isUS = country === "US";
  const stateName = US_STATES.find((state) => state.code === usState)?.name;
  const signupMode = mode === "signup";
  const forgotMode = mode === "forgot";

  const resetLocation = () => {
    setArea("");
    setStreetAddress("");
    setUsState("");
    setPostalCode("");
    setShowStatePicker(false);
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
    if (next !== "signup") setSocialPending(null);
  };

  const validateLocation = () => {
    if (!area.trim()) return country === "DK" ? "Vælg en region." : isUS ? "Enter your city." : "Enter your city/area.";
    if (isUS && !usState) return "Choose your state.";
    if (isUS && !/^\d{5}(?:-\d{4})?$/.test(postalCode.trim())) return "Enter a valid US ZIP code.";
    return null;
  };

  const profilePayload = () => ({
    name: name.trim(),
    area: area.trim(),
    country,
    locale,
    state: usState,
    postalCode: postalCode.trim(),
    streetAddress: streetAddress.trim(),
    level: 3,
  });

  const submit = async () => {
    if (lock.current) return;
    setError(null);
    setNotice(null);

    if (forgotMode) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Skriv en gyldig e-mail.");
      lock.current = true;
      setBusy(true);
      try {
        await requestPasswordReset(email.trim().toLowerCase());
        setNotice("Hvis der findes en konto med den e-mail, har vi sendt et link til at vælge en ny adgangskode.");
      } catch (e) {
        setError(e.message);
      } finally {
        lock.current = false;
        setBusy(false);
      }
      return;
    }

    if (signupMode && socialPending) {
      if (!name.trim()) return setError("Skriv dit navn.");
      const locationError = validateLocation();
      if (locationError) return setError(locationError);
      lock.current = true;
      setBusy(true);
      try {
        await socialLogin({ ...socialPending, ...profilePayload(), completeProfile: true });
      } catch (e) {
        setError(e.message);
      } finally {
        lock.current = false;
        setBusy(false);
      }
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Skriv en gyldig e-mail.");
    if (!password) return setError("Skriv din adgangskode.");
    if (signupMode && !name.trim()) return setError("Skriv dit navn.");
    if (signupMode && password.length < 8) return setError("Adgangskoden skal være mindst 8 tegn.");
    if (signupMode) {
      const locationError = validateLocation();
      if (locationError) return setError(locationError);
    }

    lock.current = true;
    setBusy(true);
    try {
      if (!signupMode) await login(email.trim().toLowerCase(), password, mode === "club");
      else await signup({ email: email.trim().toLowerCase(), password, ...profilePayload() });
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const handleSocialCredential = async (credential) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await socialLogin({ ...credential, country, locale });
    } catch (e) {
      if (e?.data?.code === "PROFILE_REQUIRED") {
        setSocialPending(credential);
        setEmail(String(e.data.email ?? ""));
        setName(String(e.data.name ?? credential.name ?? ""));
        setMode("signup");
        return;
      }
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const formTitle = forgotMode
    ? tr("Glemt adgangskode")
    : mode === "club"
      ? tr("Klublogin")
      : signupMode
        ? socialPending ? tr("Færdiggør din profil") : tr("Velkommen på holdet")
        : tr("Velkommen tilbage");

  const formHint = forgotMode
    ? tr("Skriv din e-mail, så sender vi et sikkert link til at vælge en ny adgangskode.")
    : mode === "club"
      ? tr("Brug klubbens administratorkonto.")
      : signupMode
        ? socialPending ? tr("Vi mangler kun et par oplysninger, før din konto er klar.") : tr("Opret din profil og find dit næste spil.")
        : tr("Log ind som spiller eller træner.");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={[styles.wrap, { paddingTop: Math.max(24, insets.top + 20), paddingBottom: Math.max(24, insets.bottom + 16) }, desktop && styles.desktopWrap]} keyboardShouldPersistTaps="handled">
        <View style={[styles.welcome, desktop && styles.desktopWelcome]}>
          <Text style={styles.logo}>{"Racket"}<Text style={{ color: colors.optic }}>{"Buddy"}</Text><Text style={{ color: colors.optic }}>.</Text></Text>
          <View style={styles.welcomeBody}>
            <Text style={styles.kicker}>{tr("MERE TID PÅ BANEN")}</Text>
            <Text style={styles.heroTitle}>{mode === "club" ? tr("Din klub.\nSamlet ét sted.") : tr("Godt spil\nstarter her.")}</Text>
            <Text style={styles.tagline}>{mode === "club" ? tr("Bookinger, medlemmer og klubdrift — også når du er på farten.") : tr("Din næste bane, træner og medspiller. Lige ved hånden.")}</Text>
          </View>
          <CourtScene height={desktop ? 220 : 110} />
        </View>

        <View style={[styles.form, desktop && styles.desktopForm]}>
          {!forgotMode && <PreferencesPicker onChange={async (value) => {resetLocation();await import("../lib/international").then((m) => m.setInternational(value));}} />}
          <Text accessibilityRole="header" style={styles.formTitle}>{formTitle}</Text>
          <Text style={styles.formHint}>{formHint}</Text>

          {!forgotMode && mode !== "club" && !socialPending && (
            <>
              <SocialAuthButtons disabled={busy} onCredential={handleSocialCredential} onError={(e) => setError(e.message ?? tr("Login kunne ikke gennemføres."))} />
              <View style={styles.divider}><View style={styles.dividerLine}/><Text style={styles.dividerText}>{tr("eller")}</Text><View style={styles.dividerLine}/></View>
            </>
          )}

          {signupMode && <><Text style={styles.label}>{tr("Navn")}</Text><TextInput accessibilityLabel={tr("Navn")} editable={!busy} autoComplete="name" maxLength={120} style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" /></>}

          <Text style={styles.label}>{tr("E-mail")}</Text>
          <TextInput style={[styles.input, socialPending && styles.readOnly]} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" accessibilityLabel={tr("E-mail")} editable={!busy && !socialPending} autoCorrect={false} returnKeyType={forgotMode ? "go" : "next"} placeholder={tr("dig@eksempel.dk")} placeholderTextColor={colors.slateLight} onSubmitEditing={forgotMode ? submit : () => passwordRef.current?.focus()} />

          {!forgotMode && !socialPending && <>
            <Text style={styles.label}>{tr("Adgangskode")}</Text>
            <View style={styles.passwordWrap}><TextInput style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} ref={passwordRef} accessibilityLabel={tr("Adgangskode")} editable={!busy} autoComplete={signupMode ? "new-password" : "current-password"} returnKeyType="go" onSubmitEditing={submit} />
              <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? tr("Skjul adgangskode") : tr("Vis adgangskode")} disabled={busy} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><Text style={{ color: colors.courtText, fontWeight: "700", fontSize: 13 }}>{showPassword ? tr("Skjul") : tr("Vis")}</Text></Pressable></View>
            {signupMode && <Text style={{ marginTop: 6, color: colors.slate }}>{tr("Mindst 8 tegn.")}</Text>}
          </>}

          {mode === "login" && <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode("forgot")}><Text style={[styles.switch, { textAlign: "right", paddingVertical: 10, marginTop: 4 }]}>{tr("Glemt adgangskode?")}</Text></Pressable>}

          {signupMode && <>
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
              <Pressable accessibilityRole="button" accessibilityLabel="State" accessibilityState={{expanded:showStatePicker}} disabled={busy} onPress={() => setShowStatePicker(!showStatePicker)} style={styles.input}><Text style={{color:usState?colors.text:colors.slateLight,fontSize:16}}>{usState ? `${stateName} (${usState})` : "Select state"}</Text></Pressable>
              {showStatePicker&&<View style={styles.statePicker}><ScrollView nestedScrollEnabled style={{maxHeight:260}}>{US_STATES.map((state)=><Pressable key={state.code} accessibilityRole="button" accessibilityState={{selected:usState===state.code}} onPress={()=>{setUsState(state.code);setShowStatePicker(false);}} style={[styles.stateRow,usState===state.code&&styles.stateRowActive]}><Text style={styles.stateRowText}>{state.name}</Text><Text style={styles.stateCode}>{state.code}</Text></Pressable>)}</ScrollView></View>}
              <Text style={styles.label}>ZIP code</Text>
              <TextInput accessibilityLabel="ZIP code" style={styles.input} value={postalCode} onChangeText={text=>setPostalCode(text.replace(/[^0-9-]/g,''))} editable={!busy} autoComplete="postal-code" textContentType="postalCode" keyboardType="number-pad" maxLength={10} placeholder="02108" placeholderTextColor={colors.slateLight}/>
              <Text style={styles.privateHint}>Your public location is city and state only. ZIP stays private.</Text>
            </> : <><Text style={styles.label}>{tr("By / område")}</Text><TextInput accessibilityLabel={tr("By / område")} style={styles.input} value={area} onChangeText={setArea} editable={!busy} maxLength={100} autoComplete="address-line2" /></>}
            <Text style={styles.termsText}>
              {tr("Ved at oprette en profil accepterer du ")}
              <Text style={styles.inlineLink} onPress={() => Linking.openURL(TERMS_URL)}>{tr("vilkårene")}</Text>
              {tr(" og ")}
              <Text style={styles.inlineLink} onPress={() => Linking.openURL(PRIVACY_URL)}>{tr("privatlivspolitikken")}</Text>.
            </Text>
          </>}

          {notice && <Text accessibilityRole="status" accessibilityLiveRegion="polite" style={styles.notice}>{tr(notice)}</Text>}
          {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{tr(error)}</Text>}

          <View style={{ marginTop: 16 }}><Button title={forgotMode ? tr("Send nulstillingslink") : mode === "club" ? tr("Log ind på klubben") : signupMode ? socialPending ? tr("Opret profil") : tr("Opret profil med e-mail") : tr("Log ind med e-mail")} onPress={submit} loading={busy} /></View>

          {forgotMode ? (
            <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => switchMode("login")}><Text style={styles.switch}>{tr("Tilbage til login")}</Text></Pressable>
          ) : socialPending ? (
            <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => { setSocialPending(null); setEmail(""); switchMode("login"); }}><Text style={styles.switch}>{tr("Annullér og gå tilbage")}</Text></Pressable>
          ) : (
            <>
              <View style={{ marginTop: 12 }}><Button variant="quiet" title={mode === "club" ? tr("Tilbage til spiller- og trænerlogin") : tr("Klublogin")} disabled={busy} onPress={() => switchMode(mode === "club" ? "login" : "club")} /></View>
              {mode !== "club" && <Pressable accessibilityRole="button" disabled={busy} style={{ minHeight: 48 }} onPress={() => switchMode(mode === "login" ? "signup" : "login")}><Text style={styles.switch}>{mode === "login" ? tr("Ny her? Opret profil") : tr("Har du en konto? Log ind")}</Text></Pressable>}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, width: "100%", maxWidth: 560, alignSelf: "center", flexGrow: 1, gap: 16 },
  desktopWrap: { maxWidth: 1100, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 40, gap: 48 },
  welcome: { backgroundColor: colors.raised, borderRadius: 28, overflow: "hidden", paddingTop: 24 },
  desktopWelcome: { flex: 1, paddingTop: 36 },
  welcomeBody: { paddingHorizontal: 24, paddingTop: 28 },
  logo: { fontSize: 24, fontWeight: "800", color: colors.chalk, letterSpacing: -0.7, paddingHorizontal: 24 },
  kicker: { color: "#B8C9E0", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  heroTitle: { color: colors.chalk, fontSize: 38, lineHeight: 41, fontWeight: "800", letterSpacing: -1.4 },
  tagline: { color: "#CCD8E8", marginTop: 12, lineHeight: 22, fontSize: 14, maxWidth: 340 },
  form: { padding: 12 },
  desktopForm: { flex: 1, maxWidth: 400 },
  formTitle: { color: colors.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  formHint: { color: colors.slate, marginTop: 6, marginBottom: 12, fontSize: 14, lineHeight: 22 },
  label: { fontWeight: "700", color: colors.text, marginBottom: 7, marginTop: 14, fontSize: 13 },
  optional:{fontWeight:"500",color:colors.slate},
  privateHint:{marginTop:6,color:colors.slate,fontSize:12,lineHeight:17},
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, fontSize: 16, color: colors.text, minHeight: 52, justifyContent:"center" },
  readOnly: { backgroundColor: colors.mist, color: colors.slate },
  passwordWrap: { flexDirection: "row", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center" },
  passwordToggle: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  switch: { color: colors.courtText, textAlign: "center", marginTop: 20, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 48, minWidth: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.courtTint, borderColor: colors.court },
  chipText: { color: colors.slate, fontWeight: "600" },
  chipTextActive: { color: colors.courtText, fontWeight: "800" },
  error: { color: colors.courtText, fontWeight: "700", marginTop: 12, lineHeight: 20 },
  notice: { color: colors.courtText, fontWeight: "700", marginTop: 12, lineHeight: 20, padding: 12, borderRadius: 12, backgroundColor: colors.courtTint },
  statePicker:{marginTop:8,borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor: colors.surface,overflow:'hidden'},
  stateRow:{minHeight:48,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  stateRowActive:{backgroundColor:colors.courtTint},
  stateRowText:{fontSize:15,color: colors.text},
  stateCode:{fontSize:13,color:colors.slate,fontWeight:'700'},
  divider:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:16},
  dividerLine:{height:1,backgroundColor:colors.border,flex:1},
  dividerText:{fontSize:12,color:colors.slate,fontWeight:'600'},
  termsText:{marginTop:16,color:colors.slate,fontSize:12,lineHeight:18,textAlign:'center'},
  inlineLink:{color: colors.courtText,fontWeight:'700',textDecorationLine:'underline'},
});
