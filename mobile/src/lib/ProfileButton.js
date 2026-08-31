// Profilen i hjørnet: initialer i en cirkel, ligesom på websitet. Den er
// noget man besøger, ikke noget man kommer for — derfor ligger den ikke i
// bundlinjen sammen med de fire ting, appen faktisk handler om.
import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useAuth } from "./auth";
import { openProfile } from "./navigationRef";
import { colors } from "./theme";

export function ProfileButton() {
  const { user } = useAuth();
  if (!user?.name) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Pressable
      onPress={openProfile}
      accessibilityLabel="Min profil"
      hitSlop={8}
      style={{ marginRight: 12 }}
    >
      <View style={styles.circle}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.chalk,
    fontWeight: "800",
    fontSize: 12,
  },
});
