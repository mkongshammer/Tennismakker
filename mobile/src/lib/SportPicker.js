// Sportsvælger — samme idé som websitets SportPicker.tsx, men gemt lokalt
// på telefonen i stedet for i en cookie. Farveprikken er den samme farve,
// banefliserne bruger, så valget og resultatet hænger visuelt sammen.
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView, Pressable, Text, View, StyleSheet } from "react-native";
import { colors, SPORTS, SPORT_LABELS, sportColor } from "./theme";

const KEY = "rb_sport";

export async function getSavedSport() {
  return (await AsyncStorage.getItem(KEY)) ?? "TENNIS";
}

export function SportPicker({ value, onChange }) {
  const select = async (sport) => {
    await AsyncStorage.setItem(KEY, sport);
    onChange(sport);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {SPORTS.map((s) => {
        const active = value === s;
        return (
          <Pressable
            key={s}
            onPress={() => select(s)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <View style={[styles.dot, { backgroundColor: sportColor(s) }]} />
            <Text style={[styles.label, active && styles.labelActive]}>
              {SPORT_LABELS[s]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Hook der indlæser det gemte valg én gang og holder det i state. */
export function useSport() {
  const [sport, setSport] = useState("TENNIS");
  useEffect(() => {
    getSavedSport().then(setSport);
  }, []);
  return [sport, setSport];
}

const styles = StyleSheet.create({
  row: { marginBottom: 12, flexGrow: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.chalk,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  labelActive: { color: colors.chalk },
});
