import { tr, useInternational } from "../lib/international";import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { AppHeading, Button } from "../lib/ui";
import { colors, pageContent, LEVELS, MATCH_TYPES } from "../lib/theme";
import { DK_REGIONS } from "../lib/regions";

export default function NewMatchScreen({ navigation }) {useInternational();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [area, setArea] = useState(user?.country !== "DK" ? user.area ?? "" : DK_REGIONS.includes(user?.area) ? user.area : "");
  const [matchType, setMatchType] = useState("SINGLE");
  const [level, setLevel] = useState(user?.level ?? 3);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (lock.current) return;
    setError(null);
    if (!message.trim()) return setError("Skriv lidt om, hvad du søger.");
    if (!area) {
      setError("Vælg en region.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await api.createMatch({ message: message.trim(), area, matchType, level });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.mist }} contentContainerStyle={[pageContent, { maxWidth: 600 }]}>
      <AppHeading eyebrow={tr("INVIT\xC9R P\xC5 BANEN")} title={tr("Hvem skal du spille med?")} subtitle={tr("Fort\xE6l lidt om din spilleaftale, s\xE5 andre kan finde dig.")} />
      <Text style={styles.label}>{tr("Hvad s\xF8ger du?")}</Text>
      <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          multiline
          accessibilityLabel={tr("Hvad s\xF8ger du?")}
          maxLength={2000}
          editable={!busy}
          value={message}
          onChangeText={setMessage}
          placeholder={tr("fx: S\xF8ger single-modstander tirsdag aften")} />


      <Text style={styles.label}>{tr("Type")}</Text>
      <View style={styles.chips}>
        {Object.entries(MATCH_TYPES).map(([key, label]) =>
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: matchType === key, disabled: busy }}
            disabled={busy}
            onPress={() => setMatchType(key)}
            style={[styles.chip, matchType === key && styles.chipActive]}>

            <Text style={[styles.chipText, matchType === key && styles.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
          )}
      </View>

      <Text style={styles.label}>{tr("Niveau")}</Text>
      <View style={styles.chips}>
        {Object.keys(LEVELS).map((n) =>
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n}: ${LEVELS[n]}`}
            accessibilityState={{ selected: level === Number(n), disabled: busy }}
            disabled={busy}
            onPress={() => setLevel(Number(n))}
            style={[styles.chip, level === Number(n) && styles.chipActive]}>

            <Text style={[styles.chipText, level === Number(n) && styles.chipTextActive]}>{n}</Text>
          </Pressable>
          )}
      </View>
      <Text style={styles.hint}>{tr(LEVELS[level])}</Text>

      <Text style={styles.label}>{user?.country === "DK" ? tr("Region") : tr("By / omr\xE5de")}</Text>
      {user?.country === "DK" ? <View style={styles.chips}>
        {DK_REGIONS.map((region) =>
          <Pressable
            key={tr(region)}
            accessibilityRole="button"
            accessibilityState={{ selected: area === region, disabled: busy }}
            disabled={busy}
            onPress={() => setArea(region)}
            style={[styles.chip, area === region && styles.chipActive]}>

            <Text style={[styles.chipText, area === region && styles.chipTextActive]}>{tr(region)}</Text>
          </Pressable>
          )}
      </View> : <TextInput accessibilityLabel={tr("By / omr\xE5de")} style={styles.input} value={area} onChangeText={setArea} editable={!busy} maxLength={100} />}

      {error && <Text accessibilityRole="alert" style={styles.error}>{tr(error)}</Text>}
      <View style={{ marginTop: 20 }}>
        <Button title={tr("Sl\xE5 op")} onPress={submit} loading={busy} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>);

}

const styles = StyleSheet.create({
  label: { fontWeight: "700", color: colors.slate, marginBottom: 6, marginTop: 14, fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    fontSize: 16,
    color: colors.ink
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.chalk },
  hint: { color: colors.slate, marginTop: 6, fontSize: 13 },
  error: { color: colors.court, fontWeight: "600", marginTop: 14 }
});
