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
      hitSlop={8}
      style={({ pressed }) => ({ marginRight: 4, minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", opacity: pressed ? 0.6 : 1 })}>

      <View style={styles.circle}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
    </Pressable>);

}

const styles = StyleSheet.create({
  circle: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: colors.courtTint,
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    color: colors.court,
    fontWeight: "800",
    fontSize: 12
  }
});
