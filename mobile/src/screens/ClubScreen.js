import React, { useCallback, useRef, useState } from "react";
import {
  RefreshControl,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, checkoutUrl } from "../lib/api";
import { feedback as Alert } from "../lib/feedback";
import { useScreenData } from "../lib/useScreenData";
import { Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, SURFACES, sportColor } from "../lib/theme";
import { dayLong, dayShort, groupByDay, time } from "../lib/dates";
import { BookingReview } from "../lib/BookingReview";
import { readableSurface } from "../lib/contrast.mjs";

// En ledig tid som et stykke bane: sportens farve, kridhvid baglinje langs
// bunden. Samme signatur som websitets .court-tile — bare tegnet med
// StyleSheet i stedet for CSS. Linjen ligger i bunden, ikke midt i feltet,
// så den aldrig skærer gennem prisen.
function CourtTile({ slot, onPress, loading, disabled }) {
  const tint = sportColor(slot.sport);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={`${slot.courtName}, ${time(slot.start)}, ${slot.priceKr} kroner. Se og vælg tid`}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
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
  const state = useScreenData(useCallback(() => api.club(slug, 7), [slug]));
  const load = state.refresh;
  const [dayIndex, setDayIndex] = useState(0);
  const [booking, setBooking] = useState(null);
  const [selection, setSelection] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const bookingLock = useRef(false);
  const [notice, setNotice] = useState(null);

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  const { club, slots } = state.data;
  const hero = readableSurface(club.color);
  const courtSport = (id) => club.courts.find((c) => c.id === id)?.sport ?? "TENNIS";
  const parsed = slots.map((s) => ({ ...s, start: new Date(s.startsAt), sport: courtSport(s.courtId) }));
  const days = groupByDay(parsed, (s) => s.start);
  const selectedDay = Math.min(dayIndex, Math.max(0, days.length - 1));
  const current = days[selectedDay] ?? null;

  const book = async (slot) => {
    if (bookingLock.current) return;
    bookingLock.current = true;
    const key = slot.courtId + slot.startsAt;
    setBooking(key);
    setBookingError(null);
    try {
      const { checkoutUrl: path, status } = await api.book({
        courtId: slot.courtId,
        startsAt: slot.startsAt,
      });
      setNotice("Tiden er reserveret midlertidigt. Fuldfør betalingen for at bekræfte den. Du kan også fortsætte under Min profil.");
      setSelection(null);
      // Betaling foregår hos Stripe, så appen aldrig rører kortdata
      if(status === "CONFIRMED") { setNotice("Din bane er booket og bekræftet."); Alert.alert("Booking bekræftet", "Din bane er booket."); setSelection(null); await load(); return; }
      await Linking.openURL(checkoutUrl(path));
      await load();
    } catch (e) {
      setBookingError(e.message);
      Alert.alert("Kunne ikke fortsætte", e.message);
      await load();
    } finally {
      bookingLock.current = false;
      setBooking(null);
    }
  };

  return (
    <>
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={load} />}>
      {state.error && <ErrorMessage message={state.error} onRetry={load} />}
      {notice && <Text style={{ padding: 14, marginBottom: 12, backgroundColor: colors.chalk, lineHeight: 21 }} accessibilityLiveRegion="polite">{notice}</Text>}
      <View style={[styles.hero, { backgroundColor: hero.backgroundColor }]}>
        <Text style={[styles.heroTitle, { color: hero.color }]}>{club.name}</Text>
        <Text style={[styles.heroCity, { color: hero.color }]}>
          {club.address ? `${club.address}, ` : ""}{club.city}
        </Text>
        {club.description ? <Text style={[styles.heroText, { color: hero.color }]}>{club.description}</Text> : null}
        <Text style={[styles.heroMeta, { color: hero.color }]}>
          {club.courts.length} baner · fra {club.priceHour} kr/time
        </Text>
      </View>

      <Text style={styles.section}>Ledige tider</Text>
      <Text style={{ color: colors.slate, marginBottom: 14, lineHeight: 22 }}>Vælg en tid for at se detaljerne inden betaling.</Text>

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
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDay === i }}
                  style={[styles.dayChip, selectedDay === i && styles.dayChipActive]}
                >
                  <Text style={[styles.dayChipText, selectedDay === i && styles.dayChipTextActive]}>
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
                      onPress={() => { setBookingError(null); setSelection(slot); }}
                      loading={booking === key}
                      disabled={booking !== null}
                    />
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
    {selection && <BookingReview
      visible
      title={club.name}
      details={[selection.courtName, dayLong(selection.start), `${time(selection.start)}${selection.endsAt ? ` – ${time(new Date(selection.endsAt))}` : ""}`]}
      priceKr={selection.priceKr}
      hint="Du reserverer tiden midlertidigt og fortsætter til betaling. Bookingen er først bekræftet, når betalingen er gennemført."
      action="Reservér og gå til betaling"
      busy={booking !== null}
      error={bookingError}
      onConfirm={() => book(selection)}
      onClose={() => setSelection(null)}
    />}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 20, marginBottom: 20 },
  heroTitle: { color: colors.chalk, fontSize: 24, fontWeight: "900" },
  heroCity: { color: colors.chalk, marginTop: 2 },
  heroText: { color: colors.chalk, marginTop: 10, lineHeight: 22 },
  heroMeta: { color: colors.chalk, fontWeight: "700", marginTop: 12, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginBottom: 12, color: colors.ink },
  dayChip: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
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
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  tileTime: { color: colors.chalk, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  tileMeta: { color: colors.chalk, marginTop: 2, fontSize: 14 },
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
