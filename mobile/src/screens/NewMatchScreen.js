import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { api } from "../lib/api";
import { Button } from "../lib/ui";
import { colors, LEVELS, MATCH_TYPES } from "../lib/theme";

export default function NewMatchScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [area, setArea] = useState("");
  const [matchType, setMatchType] = useState("SINGLE");
  const [level, setLevel] = useState(3);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.createMatch({ message, area, matchType, level });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Hvad søger du?</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        multiline
        value={message}
        onChangeText={setMessage}
        placeholder="fx: Søger single-modstander tirsdag aften i Valby"
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {Object.entries(MATCH_TYPES).map(([key, label]) => (
          <Pressable
            key={key}
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
            onPress={() => setLevel(Number(n))}
            style={[styles.chip, level === Number(n) && styles.chipActive]}
          >
            <Text style={[styles.chipText, level === Number(n) && styles.chipTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{LEVELS[level]}</Text>

      <Text style={styles.label}>Område</Text>
      <TextInput
        style={styles.input}
        value={area}
        onChangeText={setArea}
        placeholder="fx Valby"
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={{ marginTop: 20 }}>
        <Button title="Slå op" onPress={submit} loading={busy} />
      </View>
    </ScrollView>
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
