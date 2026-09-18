import React, { useCallback, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { feedback as Alert } from "../lib/feedback";
import { useScreenData } from "../lib/useScreenData";
import { api, checkoutUrl } from "../lib/api";
import { Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { dayLong, groupByDay, time } from "../lib/dates";
import { BookingReview } from "../lib/BookingReview";

export default function CoachScreen({ route }) {
  const { id } = route.params;
  const state = useScreenData(useCallback(() => api.coach(id), [id]));
  const load = state.refresh;
  const [booking, setBooking] = useState(null);
  const [selection, setSelection] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const bookingLock = useRef(false);
  const [notice, setNotice] = useState(null);

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  const { coach, packages, reviews, slots } = state.data;
  const days = groupByDay(slots.map((s) => new Date(s)), (d) => d);

  const book = async (date) => {
    if (bookingLock.current) return;
    bookingLock.current = true;
    setBooking(date.toISOString());
    setBookingError(null);
    try {
      const result = await api.book({
        coachProfileId: coach.id,
        startsAt: date.toISOString(),
      });
      if (result.status === "REQUESTED") {
        setSelection(null);
        setNotice("Din anmodning er sendt. Du betaler først, når træneren har godkendt tiden. Følg den under Min profil.");
        Alert.alert("Anmodning sendt", "Træneren skal godkende tiden. Du kan følge din booking under Min profil.");
      } else {
        setSelection(null);
        await Linking.openURL(checkoutUrl(result.checkoutUrl));
      }
      await load();
    } catch (e) {
      setBookingError(e.message);
      Alert.alert("Kunne ikke booke", e.message);
      await load();
    } finally {
      bookingLock.current = false;
      setBooking(null);
    }
  };

  return (
    <>
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={load} />}>
      {state.error && <ErrorMessage message={state.error} onRetry={load} />}
      {notice && <Card><Text accessibilityLiveRegion="polite">{notice}</Text></Card>}
      <Card>
        <View style={styles.row}>
          <Text style={styles.name}>{coach.name}</Text>
          <Text style={styles.price}>{coach.priceHour} kr/t</Text>
        </View>
        {coach.rating?.count > 0 && (
          <Text style={styles.rating}>
            <Text style={{ color: colors.court }}>★</Text> {coach.rating.average.toFixed(1)}{" "}
            <Text style={styles.meta}>({coach.rating.count})</Text>
          </Text>
        )}
        <Text style={styles.headline}>{coach.headline}</Text>
        <Text style={styles.meta}>{coach.area}</Text>
        <Text style={styles.meta}>{coach.lessonMinutes ?? 60} minutter · {coach.lessonPriceKr ?? coach.priceHour} kr pr. lektion</Text>
      </Card>

      {packages.length > 0 && (
        <>
          <Text style={styles.section}>Pakkeforløb</Text>
          <Text style={styles.sectionHint}>
            Aftales direkte med træneren — book en enkelt time først for at komme i kontakt.
          </Text>
          {packages.map((p) => (
            <Card key={p.id}>
              <View style={styles.row}>
                <Text style={styles.packageName}>{p.name}</Text>
                <Text style={styles.price}>{p.priceKr} kr</Text>
              </View>
              <Text style={styles.meta}>
                {p.sessions} timer · {Math.round(p.priceKr / p.sessions)} kr pr. time
              </Text>
              {p.description ? <Text style={styles.packageDesc}>{p.description}</Text> : null}
            </Card>
          ))}
        </>
      )}

      <Text style={styles.section}>Ledige tider</Text>
      <Text style={styles.sectionHint}>Send en anmodning. Betaling sker efter trænerens godkendelse.</Text>
      {days.length === 0 ? (
        <Empty>Ingen ledige tider de næste 7 dage.</Empty>
      ) : (
        days.map((d) => (
          <View key={d.date.toISOString()} style={{ marginBottom: 18 }}>
            <Text style={styles.dayLabel}>{dayLong(d.date)}</Text>
            {d.items.map((date) => (
              <Card key={date.toISOString()}>
                <View style={styles.row}>
                  <View style={{ flexShrink: 1 }}><Text style={styles.slotTime}>{time(date)}</Text>
                    <Text style={styles.meta}>{coach.lessonMinutes ?? 60} min · {coach.lessonPriceKr ?? coach.priceHour} kr</Text>
                  </View>
                  <Button
                    title="Vælg tid"
                    disabled={booking !== null}
                    onPress={() => { setBookingError(null); setSelection(date); }}
                    loading={booking === date.toISOString()}
                  />
                </View>
              </Card>
            ))}
          </View>
        ))
      )}

      {reviews.length > 0 && (
        <>
          <Text style={styles.section}>Hvad elever siger</Text>
          {reviews.map((r) => (
            <Card key={r.id}>
              <Text style={{ color: colors.court }}>{"★".repeat(r.rating)}</Text>
              {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
              <Text style={styles.meta}>{r.authorName}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
    {selection && <BookingReview
      visible
      title={coach.name}
      details={[dayLong(selection), `${time(selection)} · ${coach.lessonMinutes ?? 60} minutter`]}
      priceKr={coach.lessonPriceKr ?? coach.priceHour}
      hint="Du sender en anmodning til træneren. Du betaler først, når træneren har godkendt tiden."
      action="Send anmodning"
      busy={booking !== null}
      error={bookingError}
      onConfirm={() => book(selection)}
      onClose={() => setSelection(null)}
    />}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 },
  name: { fontWeight: "900", fontSize: 20, flexShrink: 1, color: colors.ink },
  price: { fontWeight: "800", color: colors.court, fontSize: 17 },
  rating: { marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.ink },
  headline: { marginTop: 8, lineHeight: 20 },
  meta: { color: colors.slate, marginTop: 4, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginVertical: 14, color: colors.ink },
  sectionHint: { color: colors.slate, marginTop: -10, marginBottom: 10, fontSize: 13 },
  packageName: { fontWeight: "800", flexShrink: 1, color: colors.ink },
  packageDesc: { marginTop: 8, lineHeight: 19 },
  dayLabel: { fontWeight: "800", marginBottom: 8, textTransform: "capitalize", color: colors.ink },
  slotTime: { fontSize: 20, fontWeight: "800", color: colors.ink },
  comment: { marginTop: 6, lineHeight: 19 },
});
