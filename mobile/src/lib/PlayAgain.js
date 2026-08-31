// "Spil igen": samme bane, samme tid, næste uge, ét tryk.
//
// Det er appens vigtigste knap, af samme grund som på websitet: en bane
// bookes sjældent én gang — den bookes hver tirsdag kl. 18. At gøre
// gentagelsen til ét tryk er langt stærkere end at presse nogen til den
// første booking.
import React, { useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { api, checkoutUrl } from "./api";
import { Button, Card } from "./ui";
import { colors } from "./theme";
import { DAYS } from "./dates";

export function PlayAgain({ items, onBooked }) {
  const [busyId, setBusyId] = useState(null);

  if (!items || items.length === 0) return null;

  const rebook = async (bookingId) => {
    setBusyId(bookingId);
    try {
      const result = await api.rebook(bookingId);
      if (result.checkoutUrl) {
        await Linking.openURL(checkoutUrl(result.checkoutUrl));
      }
      onBooked?.();
    } catch (e) {
      Alert.alert("Kunne ikke booke", e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.title}>Spil igen</Text>
      <Text style={styles.subtitle}>Samme bane, samme tid, næste uge.</Text>

      {items.map((item) => {
        const d = new Date(item.startsAt);
        const day = DAYS[d.getDay()];
        const time = `${String(d.getHours()).padStart(2, "0")}:${String(
          d.getMinutes()
        ).padStart(2, "0")}`;

        return (
          <Card key={item.bookingId}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.what}>{item.what}</Text>
                <Text style={styles.when}>
                  {day} {time}
                </Text>
              </View>
              <Button
                title={`Book næste ${day}`}
                onPress={() => rebook(item.bookingId)}
                loading={busyId === item.bookingId}
              />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "900", color: colors.ink },
  subtitle: { color: colors.slate, marginTop: 2, marginBottom: 10, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  what: { fontWeight: "800" },
  when: { color: colors.slate, marginTop: 2, fontSize: 13, fontVariant: ["tabular-nums"] },
});
