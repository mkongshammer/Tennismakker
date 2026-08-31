import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "./theme";

// variant: "court" (banens blå, standard) | "ink" (mørk, sekundær handling)
export function Button({ title, onPress, variant = "court", disabled, loading }) {
  const bg = variant === "ink" ? colors.ink : colors.court;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.chalk} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// tone: "ink" (standard) | "court"
export function Badge({ children, tone = "ink" }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone === "court" ? colors.court : colors.ink },
      ]}
    >
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Loading({ label = "Henter…" }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.court} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      {onRetry && <Button title="Prøv igen" onPress={onRetry} variant="ink" />}
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
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: { color: colors.chalk, fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: colors.chalk,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    // Samme bløde skygge som websitets .card
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.chalk, fontSize: 12, fontWeight: "700" },
  center: { padding: 32, alignItems: "center", gap: 12 },
  muted: { color: colors.slate, textAlign: "center" },
  error: { color: colors.court, fontWeight: "600", textAlign: "center" },
});
