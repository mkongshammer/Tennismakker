import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Button } from "../lib/ui";
import { colors, LEVELS, MATCH_TYPES } from "../lib/theme";
import { DK_REGIONS } from "../lib/regions";

export default function NewMatchScreen({ navigation }) {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [area, setArea] = useState(DK_REGIONS.includes(user?.area) ? user.area : "");
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
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
      <Text style={styles.label}>Hvad søger du?</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        multiline
        accessibilityLabel="Hvad søger du?"
        maxLength={2000}
        editable={!busy}
        value={message}
        onChangeText={setMessage}
        placeholder="fx: Søger single-modstander tirsdag aften"
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {Object.entries(MATCH_TYPES).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: matchType === key, disabled: busy }}
            disabled={busy}
            onPress={() => setMatchType(key)}
            style={[styles.chip, matchType === key && styles.chipActive]}
          >
            <Text style={[styles.chipText, matchType === key && styles.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Niveau</Text>
      <View style={styles.chips}>
        {Object.keys(LEVELS).map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n}: ${LEVELS[n]}`}
            accessibilityState={{ selected: level === Number(n), disabled: busy }}
            disabled={busy}
            onPress={() => setLevel(Number(n))}
            style={[styles.chip, level === Number(n) && styles.chipActive]}
          >
            <Text style={[styles.chipText, level === Number(n) && styles.chipTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{LEVELS[level]}</Text>

      <Text style={styles.label}>Region</Text>
      <View style={styles.chips}>
        {DK_REGIONS.map((region) => (
          <Pressable
            key={region}
            accessibilityRole="button"
            accessibilityState={{ selected: area === region, disabled: busy }}
            disabled={busy}
            onPress={() => setArea(region)}
            style={[styles.chip, area === region && styles.chipActive]}
          >
            <Text style={[styles.chipText, area === region && styles.chipTextActive]}>{region}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={{ marginTop: 20 }}>
        <Button title="Slå op" onPress={submit} loading={busy} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "700", color: colors.slate, marginBottom: 6, marginTop: 14, fontSize: 13 },
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.chalk },
  hint: { color: colors.slate, marginTop: 6, fontSize: 13 },
  error: { color: colors.court, fontWeight: "600", marginTop: 14 },
});
