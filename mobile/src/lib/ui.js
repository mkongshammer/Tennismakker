import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "./theme";

export function Button({ title, onPress, variant = "grus", disabled, loading }) {
  const bg = variant === "bane" ? colors.bane : colors.grus;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.kridt} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ children, tone = "bane" }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone === "grus" ? colors.grus : colors.bane },
      ]}
    >
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Loading({ label = "Henter…" }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.bane} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      {onRetry && <Button title="Prøv igen" onPress={onRetry} variant="bane" />}
    </View>
  );
}

export function Empty({ children }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    minHeight: 46,
    justifyContent: "center",
  },
  buttonText: { color: colors.kridt, fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.kridt, fontSize: 12, fontWeight: "700" },
  center: { padding: 32, alignItems: "center", gap: 12 },
  muted: { color: colors.muted, textAlign: "center" },
  error: { color: colors.grus, fontWeight: "600", textAlign: "center" },
});
