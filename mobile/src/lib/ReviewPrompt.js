import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { useScreenData } from "./useScreenData";
import { Button, Card } from "./ui";
import { colors } from "./theme";

// "How was it?" — lessons and court times that are over and not yet rated.
// A coach's public rating only grows from these, so it sits at the top of the
// profile, one tap per star, with the comment optional.
export function ReviewPrompt({ onDone }) {
  const state = useScreenData(useCallback(() => api.pendingReviews(), []));
  const [done, setDone] = useState([]);
  const pending = (state.data?.pending ?? []).filter((p) => !done.includes(p.bookingId));
  if (pending.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.section}>How was it?</Text>
      {pending.slice(0, 3).map((p) =>
        <ReviewCard key={p.bookingId} item={p} onSubmitted={() => {setDone((d) => [...d, p.bookingId]);onDone?.();}} />
      )}
    </View>);
}

function ReviewCard({ item, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [thanks, setThanks] = useState(false);
  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);setError(null);
    try {
      await api.review(item.bookingId, rating, comment.trim());
      setThanks(true);
      setTimeout(onSubmitted, 1200);
    } catch (e) {
      setError(e.message ?? "Could not save your review.");
    } finally {setBusy(false);}
  };
  if (thanks) return <Card><Text style={styles.title}>Thanks — your review is published.</Text></Card>;
  return (
    <Card>
      <Text style={styles.title}>{item.what}</Text>
      <Text style={styles.meta}>{new Date(item.startsAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
        {[1, 2, 3, 4, 5].map((n) =>
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ checked: rating === n }} accessibilityLabel={`${n} out of 5 stars`} style={styles.starButton}>
            <Text style={[styles.star, { color: n <= rating ? colors.optic : colors.border }]}>★</Text>
          </Pressable>
        )}
      </View>
      {rating > 0 &&
        <>
          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, 1000))}
            placeholder="Add a few words (optional) — shown on their public profile."
            placeholderTextColor={colors.slateLight}
            multiline
            maxLength={1000}
            accessibilityLabel="Review comment (optional)"
            style={styles.input} />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Button title="Publish review" onPress={submit} loading={busy} />
        </>
      }
    </Card>);
}

const styles = StyleSheet.create({
  section: { fontSize: 20, fontWeight: "900", marginBottom: 10, color: colors.text },
  title: { fontWeight: "800", fontSize: 16, color: colors.text },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  stars: { flexDirection: "row", gap: 4, marginVertical: 10 },
  starButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  star: { fontSize: 32 },
  input: { minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, fontSize: 16, lineHeight: 22, color: colors.text, textAlignVertical: "top", marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 8 }
});
