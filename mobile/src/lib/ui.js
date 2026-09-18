import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "./theme";

// Quiet variants keep account actions subordinate to booking actions.
export function Button({ title, onPress, variant = "court", disabled, loading }) {
  const quiet = variant === "quiet" || variant === "dangerQuiet";
  const bg = quiet ? "transparent" : variant === "ink" ? colors.ink : colors.court;
  const foreground = variant === "dangerQuiet" ? "#9B2525" : quiet ? colors.ink : colors.chalk;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading && <ActivityIndicator accessible={false} style={{ position: "absolute", left: 12 }} size="small" color={foreground} />}
      <Text style={[styles.buttonText, { color: foreground, fontWeight: quiet ? "600" : "700" }]}>{title}</Text>
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
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>
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
    paddingHorizontal: 40,
    alignItems: "center",
    minHeight: 48,
    minWidth: 48,
    gap: 8,
    justifyContent: "center",
  },
  buttonText: { color: colors.chalk, fontWeight: "700", fontSize: 16, textAlign: "center" },
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
