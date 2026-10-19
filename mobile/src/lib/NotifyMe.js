// "Tell me when courts open near me." The honest empty state for a market
// with no supply yet: capture intent instead of inventing results.
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { tr, useInternational } from "./international";
import { Button, Card } from "./ui";
import { colors } from "./theme";

export function NotifyMe({ sport, q, kind = "COURTS" }) {
  useInternational();
  const [place, setPlace] = useState(q ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.marketInterest({ email: email.trim(), sport, q: place.trim(), kind });
      setDone(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card style={styles.card}>
        <Text style={styles.done}>
          ✓ {done.alreadyConfirmed ? tr("You’re already on the list for") : done.confirmationSent ? tr("Check your inbox — confirm your email and we’ll let you know when") : tr("Saved. We’ll let you know when")} {kind === "COURTS" ? tr("courts") : tr("coaches")} {tr("open up near")} {done.label}.
        </Text>
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{tr("Where should we look?")}</Text>
      <TextInput value={place} onChangeText={setPlace} placeholder={tr("City, state or ZIP")} placeholderTextColor={colors.slateLight} autoCorrect={false} style={styles.input} accessibilityLabel={tr("Where should we look?")} />
      <Text style={styles.label}>{tr("Email")}</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.slateLight} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} accessibilityLabel={tr("Email")} />
      {error && <Text style={styles.error} accessibilityRole="alert">{tr(error)}</Text>}
      <Button title={tr("Notify me")} onPress={submit} loading={busy} disabled={!email.includes("@") || !place.trim()} />
      <Text style={styles.hint}>{tr("We’ll ask you to confirm your email. One email when it happens, unsubscribe link included — no newsletter.")}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 4, gap: 8 },
  label: { fontSize: 13, fontWeight: "700", color: colors.slate },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.chalk, marginBottom: 4 },
  error: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  hint: { fontSize: 12, color: colors.slateLight, textAlign: "center" },
  done: { color: colors.success, fontWeight: "600", fontSize: 15, lineHeight: 22 },
});
