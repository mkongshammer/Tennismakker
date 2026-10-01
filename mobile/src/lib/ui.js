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
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
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

export function Empty({ children, title = "Her er lidt stille endnu", icon = "○", action, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Text accessible={false} style={styles.emptySymbol}>{icon}</Text></View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{children}</Text>
      {action && onAction && <Button title={action} variant="quiet" onPress={onAction} />}
    </View>
  );
}

export function Avatar({ name = "", size = 48, tone = "light" }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === "dark" ? colors.inkSoft : colors.courtTint, alignItems: "center", justifyContent: "center" }}><Text style={{ color: tone === "dark" ? colors.chalk : colors.court, fontSize: size / 3, fontWeight: "800" }}>{initials || "RB"}</Text></View>;
}

export function AppHeading({ eyebrow, title, subtitle, trailing }) {
  return <View style={styles.headingWrap}><View style={{ flex: 1 }}>
    {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>{trailing}</View>;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
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
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    // Samme bløde skygge som websitets .card
    shadowColor: colors.ink,
    shadowOpacity: 0.035,
    shadowRadius: 16,
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
  muted: { color: colors.slate, textAlign: "center", fontSize: 15, lineHeight: 23, maxWidth: 420 },
  error: { color: colors.court, fontWeight: "600", textAlign: "center" },
  empty: { padding: 28, marginVertical: 12, alignItems: "center", gap: 12, borderRadius: 24, backgroundColor: colors.chalk, borderColor: colors.border, borderWidth: 1 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.courtTint, alignItems: "center", justifyContent: "center" },
  emptySymbol: { color: colors.court, fontSize: 28 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", textAlign: "center" },
  headingWrap: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  eyebrow: { color: colors.slate, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { color: colors.slate, fontSize: 15, lineHeight: 23, marginTop: 8, maxWidth: 560 },
});
