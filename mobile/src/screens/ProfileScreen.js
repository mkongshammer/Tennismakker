import React, { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, checkoutUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PlayAgain } from "../lib/PlayAgain";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS } from "../lib/theme";
import { dateTimeLong } from "../lib/dates";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, bookings: [] });
  const [repeatable, setRepeatable] = useState([]);

  const load = useCallback(async () => {
    try {
      const [{ bookings }, { items }] = await Promise.all([
        api.bookings(),
        api.repeatableBookings(),
      ]);
      setState({ loading: false, error: null, bookings });
      setRepeatable(items);
    } catch (e) {
      setState({ loading: false, error: e.message, bookings: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
          <Badge>{`${user?.level} · ${LEVELS[user?.level] ?? ""}`}</Badge>
          {user?.area ? <Text style={styles.meta}>{user.area}</Text> : null}
        </View>
        <Text style={styles.meta}>{user?.email}</Text>
      </Card>

      <View style={{ marginTop: 20 }}>
        <PlayAgain items={repeatable} onBooked={load} />
      </View>

      <Text style={styles.section}>Kommende bookinger</Text>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorMessage message={state.error} onRetry={load} />
      ) : state.bookings.length === 0 ? (
        <Empty>Ingen bookinger endnu.</Empty>
      ) : (
        state.bookings.map((b) => (
          <Card key={b.id}>
            <Text style={styles.bookingTitle}>{b.title}</Text>
            <Text style={styles.meta}>
              {dateTimeLong(new Date(b.startsAt))} · {b.priceKr} kr
            </Text>
            {b.status === "HOLD" && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.warn}>Afventer betaling</Text>
                <Button
                  title="Betal nu"
                  onPress={() => Linking.openURL(checkoutUrl(`/checkout/${b.id}/start`))}
                />
              </View>
            )}
          </Card>
        ))
      )}

      <View style={{ marginTop: 24 }}>
        <Button
          title="Log ud"
          variant="ink"
          onPress={() =>
            Alert.alert("Log ud", "Er du sikker?", [
              { text: "Annullér", style: "cancel" },
              { text: "Log ud", style: "destructive", onPress: logout },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: "900", color: colors.ink },
  meta: { color: colors.slate, marginTop: 4, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginVertical: 14, color: colors.ink },
  bookingTitle: { fontWeight: "800" },
  warn: { color: colors.court, fontWeight: "700", marginBottom: 8, fontSize: 13 },
});
