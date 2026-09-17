import React, { useCallback, useEffect, useState } from "react";
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

export default function ProfileScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, bookings: [] });
  const [repeatable, setRepeatable] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [openingDoor, setOpeningDoor] = useState(null);
  const [now, setNow] = useState(Date.now());

  // En skærm, der allerede står åben, skal selv aktivere dørknappen, når
  // adgangsvinduet begynder. Serveren laver stadig den afgørende kontrol.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

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

  const openDoor = async (booking) => {
    try {
      setOpeningDoor(booking.id);
      const result = await api.openDoor(booking.id);
      Alert.alert(
        `${result.label ?? "Døren"} er åbnet`,
        `Låsen er aktiveret i ${result.unlockSeconds ?? 5} sekunder.`
      );
    } catch (e) {
      Alert.alert("Kunne ikke åbne døren", e.message ?? "Prøv igen eller kontakt klubben.");
    } finally {
      setOpeningDoor(null);
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
        state.bookings.map((b) => {
          const access = b.access;
          const accessFrom = access ? new Date(access.availableFrom).getTime() : 0;
          const accessUntil = access ? new Date(access.availableUntil).getTime() : 0;
          const doorAvailable = Boolean(access && now >= accessFrom && now <= accessUntil);

          return (
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
              {access && b.status === "CONFIRMED" && (
                <View style={styles.accessBox}>
                  <Text style={styles.accessTitle}>Digital adgang</Text>
                  {doorAvailable ? (
                    <Button
                      title={`Åbn ${access.label ?? "døren"}`}
                      onPress={() => openDoor(b)}
                      loading={openingDoor === b.id}
                    />
                  ) : now < accessFrom ? (
                    <Text style={styles.meta}>
                      Døren kan åbnes fra {dateTimeLong(new Date(access.availableFrom))}.
                    </Text>
                  ) : (
                    <Text style={styles.meta}>Adgangsvinduet til denne booking er lukket.</Text>
                  )}
                  {access.instructions ? (
                    <Text style={styles.accessInstructions}>{access.instructions}</Text>
                  ) : null}
                </View>
              )}
            </Card>
          );
        })
      )}

      <Text style={styles.section}>Konto og vilkår</Text>
      <Card>
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privatlivspolitik</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>Vilkår</Text>
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
  accessBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  accessTitle: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  accessInstructions: { color: colors.slate, fontSize: 13, lineHeight: 18 },
  link: { color: colors.court, fontWeight: "700", paddingVertical: 8 },
});
