import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useScreenData } from "../lib/useScreenData";
import { feedback as Alert } from "../lib/feedback";
import { api, checkoutUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PlayAgain } from "../lib/PlayAgain";
import { Badge, Button, Card, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS } from "../lib/theme";
import { dateTimeLong } from "../lib/dates";

import {NotificationSettings} from "../lib/NotificationSettings";

const PRIVACY_URL = "https://racketbuddy.app/privatliv";
const TERMS_URL = "https://racketbuddy.app/vilkaar";

export default function ProfileScreen({ navigation }) {
  const { user, logout, deleteAccount } = useAuth();
  const state = useScreenData(useCallback(async () => {
    const [bookings, repeatable] = await Promise.all([
      api.bookings(), api.repeatableBookings().catch(() => ({ items: [] })),
    ]);
    return { bookings: bookings.bookings, repeatable: repeatable.items };
  }, []));
  const load = state.refresh;
  const repeatable = state.data?.repeatable ?? [];
  const [deleting, setDeleting] = useState(false);
  const [openingDoor, setOpeningDoor] = useState(null);
  const doorLock = useRef(false);
  const paymentLock = useRef(false);
  const deleteLock = useRef(false);
  const [paying, setPaying] = useState(null);
  const [now, setNow] = useState(Date.now());

  // En skærm, der allerede står åben, skal selv aktivere dørknappen, når
  // adgangsvinduet begynder. Serveren laver stadig den afgørende kontrol.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const pay = async (id) => {
    if (paymentLock.current) return;
    paymentLock.current = true;
    setPaying(id);
    try {
      const result = await api.resumePayment(id);
      if (result.status === "CONFIRMED") Alert.alert("Bookingen er bekræftet", "Du behøver ikke betale igen.");
      else await Linking.openURL(checkoutUrl(result.checkoutUrl));
    } catch (error) { Alert.alert("Kunne ikke åbne betaling", error.message); }
    finally { paymentLock.current = false; setPaying(null); load(); }
  };

  const openLink = async url => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Linket kunne ikke åbnes", "Prøv igen om lidt."); }
  };

  const openDoor = async (booking) => {
    if (doorLock.current) return;
    doorLock.current = true;
    try {
      setOpeningDoor(booking.id);
      const result = await api.openDoor(booking.id);
      Alert.alert(
        "Døråbning sendt",
        `${result.label ?? "Døren"}: åbnekommandoen gælder i ${result.unlockSeconds ?? 5} sekunder. Kontrollér at døren åbner.`
      );
    } catch (e) {
      Alert.alert("Kunne ikke åbne døren", e.message ?? "Prøv igen eller kontakt klubben.");
    } finally {
      doorLock.current = false;
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
            if (deleteLock.current) return;
            deleteLock.current = true;
            try {
              setDeleting(true);
              await deleteAccount();
            } catch (e) {
              setDeleting(false);
              Alert.alert("Kunne ikke slette kontoen", e.message ?? "Prøv igen senere.");
            } finally {
              deleteLock.current = false;
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 20, paddingBottom: 36, width: "100%", maxWidth: 600, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={load} />}>
      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
          <Badge>{`${user?.level} · ${LEVELS[user?.level] ?? ""}`}</Badge>
          {user?.area ? <Text style={styles.meta}>{user.area}</Text> : null}
        </View>
        <Text style={styles.meta}>{user?.email}</Text>
      </Card>

      {repeatable.length > 0 && <View style={{ marginTop: 16 }}>
        <PlayAgain items={repeatable} onBooked={load} />
      </View>}

      <Text style={styles.section}>Kommende bookinger</Text>
      {state.error && <ErrorMessage message={state.error} onRetry={load} />}
      {state.loading ? (
        <Loading />
      ) : !state.data ? null : state.data.bookings.length === 0 ? (
        <Card style={{ padding: 20, gap: 16 }}>
          <Text style={{ color: colors.slate, fontSize: 15, lineHeight: 23 }}>Ingen bookinger endnu. Find din næste banetid — dine reservationer vises her.</Text>
          <Button title="Find en ledig bane" onPress={() => navigation.navigate("MainTabs", { screen: "KlubberTab" })} />
        </Card>
      ) : (
        state.data.bookings.map((b) => {
          const access = b.access;
          const accessFrom = access ? new Date(access.availableFrom).getTime() : 0;
          const accessUntil = access ? new Date(access.availableUntil).getTime() : 0;
          const doorAvailable = Boolean(access && now >= accessFrom && now <= accessUntil);
          const paymentExpired = b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= now;

          return (
            <Card key={b.id}>
              <Text style={styles.bookingTitle}>{b.title}</Text>
              <Text style={styles.meta}>
                {dateTimeLong(new Date(b.startsAt))} · {b.priceKr} kr
              </Text>
              {b.status === "REQUESTED" && <Text style={styles.warn}>Afventer trænerens svar</Text>}
              {b.status === "CONFIRMED" && <Text style={styles.meta}>Bekræftet</Text>}
              {b.status === "HOLD" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.warn}>{paymentExpired ? "Betalingsfristen er udløbet" : "Afventer betaling"}</Text>
                  <Text style={[styles.meta, { marginBottom: 12 }]}>
                    {paymentExpired
                      ? "Har du betalt, så opdatér status. Kontakt support, hvis din betaling stadig ikke er bekræftet."
                      : b.holdExpiresAt ? `Betal senest ${dateTimeLong(new Date(b.holdExpiresAt))}.` : "Fuldfør betalingen for at bekræfte din tid."}
                  </Text>
                  <Button
                    title={paymentExpired ? "Opdatér status" : "Fortsæt til betaling"}
                    onPress={paymentExpired ? load : () => pay(b.id)}
                    loading={paying === b.id}
                    disabled={paying !== null}
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
                      disabled={openingDoor !== null}
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

      {user.clubId && <Button title="Min klubwallet" onPress={()=>navigation.navigate("WalletPortal",{destination:"/wallet"})}/>}
      <NotificationSettings />
      <Text style={styles.section}>Konto og vilkår</Text>
      <Card>
        <Text accessibilityRole="link" style={styles.link} onPress={() => openLink(PRIVACY_URL)}>Privatlivspolitik</Text>
        <Text accessibilityRole="link" style={styles.link} onPress={() => openLink(TERMS_URL)}>Vilkår</Text>
      </Card>

      <View style={{ gap: 4, marginTop: 8 }}>
        <Button
          title="Log ud"
          variant="quiet"
          onPress={() =>
            Alert.alert("Log ud", "Er du sikker?", [
              { text: "Annullér", style: "cancel" },
              { text: "Log ud", style: "destructive", onPress: () => logout().catch(e => Alert.alert("Kunne ikke logge ud", e.message)) },
            ])
          }
        />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }}>
          <Button title="Slet konto" variant="dangerQuiet" onPress={confirmDelete} loading={deleting} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: "700", color: colors.ink },
  meta: { color: colors.slate, marginTop: 4, fontSize: 13 },
  section: { fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 12, color: colors.ink },
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
