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
import { Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, SURFACES, sportColor } from "../lib/theme";
import { dayLong, dayShort, groupByDay, time } from "../lib/dates";

// En ledig tid som et stykke bane: sportens farve, kridhvid baglinje langs
// bunden. Samme signatur som websitets .court-tile — bare tegnet med
// StyleSheet i stedet for CSS. Linjen ligger i bunden, ikke midt i feltet,
// så den aldrig skærer gennem prisen.
function CourtTile({ slot, onPress, loading }) {
  const tint = sportColor(slot.sport);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tint, opacity: pressed || loading ? 0.85 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTime}>{time(slot.start)}</Text>
        <Text style={styles.tileMeta}>
          {slot.courtName} · {SURFACES[slot.surface] ?? slot.surface}
        </Text>
      </View>
      <Text style={styles.tilePrice}>{loading ? "…" : `${slot.priceKr} kr`}</Text>
      <View style={styles.tileBaseline} />
    </Pressable>
  );
}

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
  const courtSport = (id) => club.courts.find((c) => c.id === id)?.sport ?? "TENNIS";
  const parsed = slots.map((s) => ({ ...s, start: new Date(s.startsAt), sport: courtSport(s.courtId) }));
  const days = groupByDay(parsed, (s) => s.start);
  const current = days[dayIndex] ?? null;

  const book = async (slot) => {
    const key = slot.courtId + slot.startsAt;
    setBooking(key);
    try {
      const { checkoutUrl: path } = await api.book({
        courtId: slot.courtId,
        startsAt: slot.startsAt,
      });
      // Betaling foregår hos Stripe, så appen aldrig rører kortdata
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
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.hero, { backgroundColor: club.color }]}>
        <Text style={styles.heroTitle}>{club.name}</Text>
        <Text style={styles.heroCity}>
          {club.address ? `${club.address}, ` : ""}{club.city}
        </Text>
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
              <View style={{ gap: 10 }}>
                {current.items.map((slot) => {
                  const key = slot.courtId + slot.startsAt;
                  return (
                    <CourtTile
                      key={key}
                      slot={slot}
                      onPress={() => book(slot)}
                      loading={booking === key}
                    />
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 20, marginBottom: 20 },
  heroTitle: { color: colors.chalk, fontSize: 24, fontWeight: "900" },
  heroCity: { color: colors.chalk, opacity: 0.8, marginTop: 2 },
  heroText: { color: colors.chalk, opacity: 0.95, marginTop: 10, lineHeight: 20 },
  heroMeta: { color: colors.chalk, fontWeight: "700", marginTop: 12, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginBottom: 12, color: colors.ink },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.chalk,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dayChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayChipText: { fontWeight: "700", color: colors.ink },
  dayChipTextActive: { color: colors.chalk },
  dayLabel: { fontWeight: "800", marginBottom: 4, textTransform: "capitalize", color: colors.ink },
  tile: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  tileTime: { color: colors.chalk, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  tileMeta: { color: "rgba(255,255,255,0.82)", marginTop: 2, fontSize: 13 },
  tilePrice: {
    color: colors.chalk,
    fontWeight: "800",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  // Baglinjen — banemarkering, ikke en overstregning. Ligger i bunden af
  // feltet, samme rettelse som på websitet.
  tileBaseline: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 7,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
