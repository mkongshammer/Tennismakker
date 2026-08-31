import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, checkoutUrl } from "../lib/api";
import { Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { dayLong, groupByDay, time } from "../lib/dates";

export default function CoachScreen({ route }) {
  const { id } = route.params;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [booking, setBooking] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.coach(id);
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  const { coach, packages, reviews, slots } = state.data;
  const days = groupByDay(slots.map((s) => new Date(s)), (d) => d);

  const book = async (date) => {
    setBooking(date.toISOString());
    try {
      const { checkoutUrl: path } = await api.book({
        coachProfileId: coach.id,
        startsAt: date.toISOString(),
      });
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
      {days.length === 0 ? (
        <Empty>Ingen ledige tider de næste 7 dage.</Empty>
      ) : (
        days.map((d) => (
          <View key={d.date.toISOString()} style={{ marginBottom: 18 }}>
            <Text style={styles.dayLabel}>{dayLong(d.date)}</Text>
            {d.items.map((date) => (
              <Card key={date.toISOString()}>
                <View style={styles.row}>
                  <Text style={styles.slotTime}>{time(date)}</Text>
                  <Button
                    title="Book"
                    onPress={() => book(date)}
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
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
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
