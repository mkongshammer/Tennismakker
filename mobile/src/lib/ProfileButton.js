import { tr, useInternational } from "./international"; // Profilen i hjørnet: initialer i en cirkel, ligesom på websitet. Den er
// noget man besøger, ikke noget man kommer for — derfor ligger den ikke i
// bundlinjen sammen med de fire ting, appen faktisk handler om.
import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useAuth } from "./auth";
import { openProfile } from "./navigationRef";
import { colors } from "./theme";

export function ProfileButton() {useInternational();
  const { user } = useAuth();
  if (!user?.name) return null;

  const initials = user.name.
  split(" ").
  map((n) => n[0]).
  slice(0, 2).
  join("").
  toUpperCase();

  return (
    <Pressable
      onPress={openProfile}
      accessibilityLabel={tr("Min profil")}
      accessibilityRole="button"
      hitSlop={12}
      style={({ pressed }) => ({ justifyContent: "center", alignItems: "center", opacity: pressed ? 0.6 : 1 })}>

      <Text style={styles.initials}>{initials}</Text>
    </Pressable>);

}

const styles = StyleSheet.create({
  circle: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: colors.courtTint,
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    color: colors.courtText,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
    paddingVertical: 10,
    paddingLeft: 12
  }
});
