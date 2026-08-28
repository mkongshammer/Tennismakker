import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, checkoutUrl } from "../lib/api";
import { Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, SURFACES } from "../lib/theme";
import { dayLong, dayShort, groupByDay, time } from "../lib/dates";

export default function ClubScreen({ route }) {
  const { slug } = route.params;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [dayIndex, setDayIndex] = useState(0);
  const [booking, setBooking] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.club(slug, 7);
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  const { club, slots } = state.data;
  const parsed = slots.map((s) => ({ ...s, start: new Date(s.startsAt) }));
  const days = groupByDay(parsed, (s) => s.start);
  const current = days[dayIndex] ?? null;

  const book = async (slot) => {
    setBooking(slot.courtId + slot.startsAt);
    try {
      const { checkoutUrl: path } = await api.book({
        courtId: slot.courtId,
        startsAt: slot.startsAt,
      });
      // Betaling foregår på web, så appen ikke skal håndtere kortdata
      await Linking.openURL(checkoutUrl(path));
      await load();
    } catch (e) {
      Alert.alert("Kunne ikke booke", e.message);
      await load();
    } finally {
      setBooking(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.kridt }} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.hero, { backgroundColor: club.color }]}>
        <Text style={styles.heroTitle}>{club.name}</Text>
        <Text style={styles.heroCity}>{club.city}</Text>
        {club.description ? <Text style={styles.heroText}>{club.description}</Text> : null}
        <Text style={styles.heroMeta}>
          {club.courts.length} baner · fra {club.priceHour} kr/time
        </Text>
      </View>

      <Text style={styles.section}>Ledige tider</Text>

      {days.length === 0 ? (
        <Empty>Ingen ledige tider de næste 7 dage.</Empty>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {days.map((d, i) => (
                <Pressable
                  key={d.date.toISOString()}
                  onPress={() => setDayIndex(i)}
                  style={[styles.dayChip, dayIndex === i && styles.dayChipActive]}
                >
                  <Text style={[styles.dayChipText, dayIndex === i && styles.dayChipTextActive]}>
                    {dayShort(d.date)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {current && (
            <>
              <Text style={styles.dayLabel}>{dayLong(current.date)}</Text>
              {current.items.map((slot) => (
                <Card key={slot.courtId + slot.startsAt}>
                  <View style={styles.slotRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotTime}>{time(slot.start)}</Text>
                      <Text style={styles.meta}>
                        {slot.courtName} · {SURFACES[slot.surface] ?? slot.surface}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <Text style={styles.price}>{slot.priceKr} kr</Text>
                      <Button
                        title="Book"
                        onPress={() => book(slot)}
                        loading={booking === slot.courtId + slot.startsAt}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 12, padding: 20, marginBottom: 20 },
  heroTitle: { color: colors.kridt, fontSize: 24, fontWeight: "900" },
  heroCity: { color: colors.kridt, opacity: 0.8, marginTop: 2 },
  heroText: { color: colors.kridt, opacity: 0.95, marginTop: 10, lineHeight: 20 },
  heroMeta: { color: colors.kridt, fontWeight: "700", marginTop: 12, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginBottom: 12, color: colors.bane },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dayChipActive: { backgroundColor: colors.bane, borderColor: colors.bane },
  dayChipText: { fontWeight: "700", color: colors.net },
  dayChipTextActive: { color: colors.kridt },
  dayLabel: { fontWeight: "800", marginBottom: 10, textTransform: "capitalize" },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  slotTime: { fontSize: 20, fontWeight: "800" },
  price: { fontWeight: "800", color: colors.grus },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
});
