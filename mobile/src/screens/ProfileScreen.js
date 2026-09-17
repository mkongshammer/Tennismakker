import React, { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, checkoutUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PlayAgain } from "../lib/PlayAgain";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS } from "../lib/theme";
import { dateTimeLong } from "../lib/dates";

const PRIVACY_URL = "https://racketbuddy.app/privatliv";
const TERMS_URL = "https://racketbuddy.app/vilkaar";
const DELETE_URL = "https://racketbuddy.app/slet-konto";
const SUPPORT_EMAIL = "racketbuddy.app@gmail.com";

export default function ProfileScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, bookings: [] });
  const [repeatable, setRepeatable] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ bookings }, { items }, blocked] = await Promise.all([
        api.bookings(),
        api.repeatableBookings(),
        api.blockedUsers(),
      ]);
      setState({ loading: false, error: null, bookings });
      setRepeatable(items);
      setBlockedUsers(blocked.users ?? []);
    } catch (e) {
      setState({ loading: false, error: e.message, bookings: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unblock = async (blockedUser) => {
    try {
      setUnblockingId(blockedUser.id);
      await api.unblockUser(blockedUser.id);
      setBlockedUsers((users) => users.filter((u) => u.id !== blockedUser.id));
    } catch (e) {
      Alert.alert("Kunne ikke fjerne blokering", e.message);
    } finally {
      setUnblockingId(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Slet konto",
      "Din profil og personlige oplysninger fjernes. Historiske oplysninger, som vi er forpligtet til at gemme, kan blive bevaret i anonymiseret form. Handlingen kan ikke fortrydes.",
      [
        { text: "Annullér", style: "cancel" },
        {
          text: "Slet min konto",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteAccount();
            } catch (e) {
              setDeleting(false);
              Alert.alert("Kunne ikke slette kontoen", e.message ?? "Prøv igen senere.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
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

      <Text style={styles.section}>Sikkerhed</Text>
      {blockedUsers.length === 0 ? (
        <Card><Text style={styles.meta}>Du har ikke blokeret nogen brugere.</Text></Card>
      ) : (
        blockedUsers.map((blockedUser) => (
          <Card key={blockedUser.id}>
            <View style={styles.blockedRow}>
              <Text style={styles.blockedName}>{blockedUser.name}</Text>
              <Button
                title="Fjern blokering"
                variant="ink"
                onPress={() => unblock(blockedUser)}
                loading={unblockingId === blockedUser.id}
              />
            </View>
          </Card>
        ))
      )}

      <Text style={styles.section}>Konto og vilkår</Text>
      <Card>
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privatlivspolitik</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>Vilkår</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(DELETE_URL)}>Sådan slettes en konto</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>Kontakt RacketBuddy support</Text>
      </Card>

      <View style={{ gap: 10 }}>
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
        <Button title="Slet konto permanent" onPress={confirmDelete} loading={deleting} />
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
  link: { color: colors.court, fontWeight: "700", paddingVertical: 8 },
  blockedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  blockedName: { color: colors.ink, fontWeight: "800", flex: 1 },
});
