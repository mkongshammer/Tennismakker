import { money, tr, useInternational } from "../lib/international";
import React, { useCallback, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { feedback as Alert } from "../lib/feedback";
import { useScreenData } from "../lib/useScreenData";
import { api, checkoutUrl } from "../lib/api";
import { Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent } from "../lib/theme";
import { dayLong, groupByDay, time } from "../lib/dates";
import { BookingReview } from "../lib/BookingReview";

export default function CoachScreen({ route }) {useInternational();
  const { id } = route.params;
  const state = useScreenData(useCallback(() => api.coach(id), [id]));
  const load = state.refresh;
  const [booking, setBooking] = useState(null);
  const [selection, setSelection] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const bookingLock = useRef(false);
  const [notice, setNotice] = useState(null);
  const [note, setNote] = useState("");

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  const { coach, packages, reviews, slots } = state.data;
  const days = groupByDay(slots.map((s) => new Date(s)), (d) => d, coach.timeZone);

  const book = async (date) => {
    if (bookingLock.current) return;
    bookingLock.current = true;
    setBooking(date.toISOString());
    setBookingError(null);
    try {
      const result = await api.book({
        coachProfileId: coach.id,
        startsAt: date.toISOString(),
        note: note.trim() || undefined
      });
      if (result.status === "REQUESTED") {
        setSelection(null);
        setNote("");
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
    <ScrollView style={{ backgroundColor: colors.mist }} contentContainerStyle={pageContent}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={load} />}>
      {state.error && <ErrorMessage message={state.error} onRetry={load} />}
      {notice && <Card><Text accessibilityLiveRegion="polite">{tr(notice)}</Text></Card>}
      <Card>
        <View style={styles.row}>
          <Text style={styles.name}>{coach.name}</Text>
          <Text style={styles.price}>{money(coach.priceHour, coach.currency)}/{tr("time")}</Text>
        </View>
        {coach.rating?.count > 0 &&
          <Text style={styles.rating}>
            <Text style={{ color: colors.courtText }}>★</Text> {coach.rating.average.toFixed(1)}{" "}
            <Text style={styles.meta}>({coach.rating.count})</Text>
          </Text>
          }
        <Text style={styles.headline}>{coach.headline}</Text>
        <Text style={styles.meta}>{coach.area}</Text>
        <Text style={styles.meta}>{coach.lessonMinutes ?? 60}{" " + tr("minutter \xB7") + " "}{money(coach.lessonPriceKr ?? coach.priceHour, coach.currency)} / {tr("lektion")}</Text>
      </Card>

      {(coach.levels?.length > 0 || coach.ages?.length > 0 || coach.lessonPlace || coach.whatToBring) &&
        <Card>
          <Text style={styles.cardTitle}>About the lessons</Text>
          {coach.levels?.length > 0 && <Fact label="Levels" value={coach.levels.join(" · ")} />}
          {coach.ages?.length > 0 && <Fact label="Ages" value={coach.ages.join(" · ")} />}
          {coach.lessonPlace ? <Fact label="Where" value={coach.lessonPlace} /> : null}
          {coach.whatToBring ? <Fact label="What to bring" value={coach.whatToBring} /> : null}
        </Card>
      }

      {packages.length > 0 &&
        <>
          <Text style={styles.section}>{tr("Pakkeforl\xF8b")}</Text>
          <Text style={styles.sectionHint}>{tr("Aftales direkte med tr\xE6neren \u2014 book en enkelt time f\xF8rst for at komme i kontakt.")}

          </Text>
          {packages.map((p) =>
          <Card key={p.id}>
              <View style={styles.row}>
                <Text style={styles.packageName}>{p.name}</Text>
                <Text style={styles.price}>{money(p.priceKr, coach.currency)}</Text>
              </View>
              <Text style={styles.meta}>
                {p.sessions}{" " + tr("timer \xB7") + " "}{money(Math.round(p.priceKr / p.sessions), coach.currency)} / {tr("time")}
              </Text>
              {p.description ? <Text style={styles.packageDesc}>{p.description}</Text> : null}
            </Card>
          )}
        </>
        }

      <Text style={styles.meta}>{tr("Lokal tid")}: {coach.timeZone}</Text>
      <Text style={styles.section}>{tr("Ledige tider")}</Text>
      <Text style={styles.sectionHint}>{tr("Send en anmodning. Betaling sker efter tr\xE6nerens godkendelse.")}</Text>
      {days.length === 0 ?
        <Empty title={tr("Nye tr\xE6ningstider p\xE5 vej")} action={tr("Opdat\xE9r tider")} onAction={load}>{tr("Ingen ledige tider de n\xE6ste 7 dage. Kig igen senere eller v\xE6lg en anden tr\xE6ner.")}</Empty> :

        days.map((d) =>
        <View key={d.date.toISOString()} style={{ marginBottom: 18 }}>
            <Text style={styles.dayLabel}>{dayLong(d.date, coach.timeZone)}</Text>
            {d.items.map((date) =>
          <Card key={date.toISOString()}>
                <View style={styles.row}>
                  <View style={{ flexShrink: 1 }}><Text style={styles.slotTime}>{time(date, coach.timeZone)}</Text>
                    <Text style={styles.meta}>{coach.lessonMinutes ?? 60}{" " + tr("min \xB7") + " "}{money(coach.lessonPriceKr ?? coach.priceHour, coach.currency)}</Text>
                  </View>
                  <Button
                title={tr("V\xE6lg tid")}
                disabled={booking !== null}
                onPress={() => {setBookingError(null);setSelection(date);}}
                loading={booking === date.toISOString()} />

                </View>
              </Card>
          )}
          </View>
        )
        }

      <Text style={styles.section}>
        {coach.rating?.count > 0 ? `★ ${coach.rating.average.toFixed(2).replace(/0$/, "")} · ${coach.rating.count} ${coach.rating.count === 1 ? "review" : "reviews"}` : "Reviews"}
      </Text>
      <Text style={styles.sectionHint}>
        {coach.rating?.count > 0 ? "Every review is from a player who booked and paid for a lesson on RacketBuddy." : "New on RacketBuddy. After each paid lesson, players can leave a rating and a review."}
      </Text>
      {coach.rating?.count > 0 && Array.isArray(coach.ratingDistribution) &&
        <Card>
          {coach.ratingDistribution.map((n, i) =>
            <View key={i} style={styles.barRow} accessible accessibilityLabel={`${n} ${n === 1 ? "review" : "reviews"} with ${5 - i} stars`}>
              <Text style={styles.barLabel}>{5 - i}</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: `${coach.rating.count ? Math.round(n / coach.rating.count * 100) : 0}%` }]} /></View>
            </View>
          )}
        </Card>
      }
      {reviews.map((r) =>
        <Card key={r.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(r.authorName || "?")[0]}</Text></View>
            <View>
              <Text style={styles.packageName}>{r.authorName}</Text>
              {r.createdAt ? <Text style={styles.meta}>{new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Text> : null}
            </View>
          </View>
          <Text style={{ color: colors.courtText, marginTop: 8 }} accessibilityLabel={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}</Text>
          {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
        </Card>
      )}
    </ScrollView>
    {selection && <BookingReview
        visible
        title={coach.name}
        details={[dayLong(selection, coach.timeZone), `${time(selection, coach.timeZone)} · ${coach.lessonMinutes ?? 60} ${tr("minutter")}`]}
        currency={coach.currency}
        priceKr={coach.lessonPriceKr ?? coach.priceHour}
        hint={tr("Du sender en anmodning til tr\xE6neren. Du betaler f\xF8rst, n\xE5r tr\xE6neren har godkendt tiden.")}
        action={tr("Send anmodning")}
        busy={booking !== null}
        error={bookingError}
        onConfirm={() => book(selection)}
        onClose={() => setSelection(null)}
        note={note}
        onNoteChange={setNote}
        noteLabel={`Note to ${String(coach.name).split(" ")[0]} (optional)`}
        notePlaceholder="E.g. your level, what you'd like to work on, or a question." />
      }
    </>);

}

function Fact({ label, value }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.factLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>);
}

const styles = StyleSheet.create({
  cardTitle: { fontWeight: "900", fontSize: 17, color: colors.text },
  factLabel: { color: colors.slate, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  factValue: { color: colors.text, marginTop: 2, lineHeight: 20 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 3 },
  barLabel: { width: 12, textAlign: "right", color: colors.slate, fontSize: 13 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.mist, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.raised },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mist, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800", color: colors.slate },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 },
  name: { fontWeight: "900", fontSize: 20, flexShrink: 1, color: colors.text },
  price: { fontWeight: "800", color: colors.courtText, fontSize: 17 },
  rating: { marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.text },
  headline: { marginTop: 8, lineHeight: 20 },
  meta: { color: colors.slate, marginTop: 4, fontSize: 13 },
  section: { fontSize: 20, fontWeight: "900", marginVertical: 14, color: colors.text },
  sectionHint: { color: colors.slate, marginTop: -10, marginBottom: 10, fontSize: 13 },
  packageName: { fontWeight: "800", flexShrink: 1, color: colors.text },
  packageDesc: { marginTop: 8, lineHeight: 19 },
  dayLabel: { fontWeight: "800", marginBottom: 8, textTransform: "capitalize", color: colors.text },
  slotTime: { fontSize: 20, fontWeight: "800", color: colors.text },
  comment: { marginTop: 6, lineHeight: 19 }
});
