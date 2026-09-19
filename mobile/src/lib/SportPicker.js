// Sportsvælger — samme idé som websitets SportPicker.tsx, men gemt lokalt
// på telefonen i stedet for i en cookie. Farveprikken er den samme farve,
// banefliserne bruger, så valget og resultatet hænger visuelt sammen.
import React, { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView, Pressable, Text, View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { colors, SPORTS, SPORT_LABELS, sportColor } from "./theme";
import { useFocusEffect } from "@react-navigation/native";

const KEY = "rb_sport";

export async function getSavedSport() {
  const saved = await AsyncStorage.getItem(KEY).catch(() => null);
  return SPORTS.includes(saved) ? saved : "TENNIS";
}

export function SportPicker({ value, onChange }) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const select = (sport) => {
    onChange(sport);
    AsyncStorage.setItem(KEY, sport).catch(() => {});
  };

  return (
    <ScrollView
      horizontal={!desktop}
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={{ gap: 8, paddingHorizontal: desktop ? 28 : 16, ...(desktop ? { flexDirection: "row", flexWrap: "wrap" } : {}) }}
    >
      {SPORTS.map((s) => {
        const active = value === s;
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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

/** Synkroniser det gemte sportsvalg, når fanen bliver aktiv. */
export function useSport() {
  const [sport, setSport] = useState("TENNIS");
  const version = useRef(0);
  useFocusEffect(useCallback(() => {
    const current = ++version.current;
    getSavedSport().then(value => { if (current === version.current) setSport(value); });
    return () => { version.current++; };
  }, []));
  return [sport, value => { version.current++; setSport(value); }];
}

const styles = StyleSheet.create({
  row: { marginBottom: 12, flexGrow: 0 },
  chip: {
    minHeight: 48,
    minWidth: 48,
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
  label: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  labelActive: { color: colors.chalk },
});
