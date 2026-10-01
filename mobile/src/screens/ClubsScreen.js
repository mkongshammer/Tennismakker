import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useInternational, money, tr } from "../lib/international";
import { PreferencesPicker } from "../lib/PreferencesPicker";
import { api } from "../lib/api";
import { AppHeading, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, SPORT_LABELS, sportColor } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { CourtGraphic } from "../lib/CourtGraphic";
import { useScreenData } from "../lib/useScreenData";
import { CourtScene } from "../lib/CourtScene";

function Stars({ average, count }) {useInternational();
  if (!count) return <Text style={styles.newBadge}>{tr("Ny p\xE5 RacketBuddy")}</Text>;
  return (
    <Text style={styles.rating}>
      <Text style={{ color: colors.court }}>★</Text> {average.toFixed(1)}{" "}
      <Text style={styles.meta}>({count})</Text>
    </Text>);

}

export default function ClubsScreen({ navigation }) {
  const { country } = useInternational();
  const [sport, setSport] = useSport();
  const [query, setQuery] = useState("");
  const { data, loading, error, refreshing, refresh } = useScreenData(useCallback(() => api.clubs(sport, country), [sport, country]));
  const state = { loading, error, clubs: data?.clubs ?? [] };
  const needle = query.trim().toLocaleLowerCase("da-DK");
  const clubs = state.clubs.filter((c) => `${c.name} ${c.city}`.toLocaleLowerCase("da-DK").includes(needle));

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
        <FlatList
        contentContainerStyle={pageContent}
        data={state.loading ? [] : clubs}
        ListHeaderComponent={<>
            <PreferencesPicker /><AppHeading eyebrow={tr("DIT N\xC6STE SPIL")} title={tr("Mere tid p\xE5 banen.")} subtitle={tr("Find en klub, v\xE6lg en tid, og kom ud at spille.")} />
            <View style={styles.hero}>
              <View style={styles.heroCopy}><Text style={styles.heroEyebrow}>{tr("BANEN ER DIN")}</Text><Text style={styles.heroTitle}>{tr("Klar til n\xE6ste\\nserve?")}</Text><Text style={styles.heroHint}>{tr("Dit n\xE6ste spil starter med en ledig bane.")}</Text></View>
              <View style={styles.heroArt}><CourtScene height={180} /></View>
            </View>
            <Text style={styles.label}>{tr("Hvad spiller du?")}</Text>
            <SportPicker value={sport} onChange={setSport} />
            <View style={styles.search}><Text accessible={false} style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel={tr("S\xF8g klub eller by")} placeholder={tr("S\xF8g klub eller by")} placeholderTextColor={colors.slateLight} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" style={styles.searchInput} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel={tr("Ryd s\xF8gning")} onPress={() => setQuery("")} style={styles.clear}><Text style={{ color: colors.slate, fontSize: 22 }}>×</Text></Pressable>}</View>
            <View style={styles.resultRow}><Text style={styles.resultTitle}>{tr(SPORT_LABELS[sport])} {tr("klubber")}</Text>{!loading && <Text style={styles.meta}>{clubs.length} {clubs.length === 1 ? tr("klub") : tr("klubber")}</Text>}</View>
            {error && <ErrorMessage message={error} onRetry={refresh} />}
          </>}
        keyExtractor={(c) => c.id}
        refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh} />

        }
        ListEmptyComponent={
        state.loading ? <Loading label={tr("Finder klubber\u2026")} /> : error && !data ? null : <Empty title={needle ? tr("Ingen klubber matcher") : tr("Flere baner p\xE5 vej")} icon="⌕" action={needle ? tr("Ryd s\xF8gning") : undefined} onAction={() => setQuery("")}>{needle ? tr("Pr\xF8v et andet klubnavn eller en anden by.") : tr("Der er ingen klubber for denne sportsgren endnu. Pr\xF8v en anden sportsgren ovenfor.")}</Empty>
        }
        renderItem={({ item }) =>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Se ledige tider hos ${item.name}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          onPress={() => navigation.navigate("Klub", { slug: item.slug, name: item.name })}>

              <Card style={{ padding: 0, overflow: "hidden" }}>
                <View style={styles.clubBody}>
                <View style={styles.thumb}>
                  <CourtGraphic color={item.color || sportColor(sport)} width={84} height={84} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Stars average={item.rating?.average ?? 0} count={item.rating?.count ?? 0} />
                  </View>
                  <Text style={styles.meta}>{item.city}</Text>
                  <Text style={styles.meta}>
                    {item.courtCount}{tr("baner")}
                </Text>
                </View>
                </View>
                <View style={styles.cardFoot}><Text style={styles.price}>{tr("Fra") + " "}{money(item.priceHour, item.currency)} <Text style={styles.meta}>{tr("/ time")}</Text></Text><View style={styles.cardAction}><Text style={styles.actionText}>{tr("Se tider")}</Text><Text style={styles.arrow}>↗</Text></View></View>
              </Card>
            </Pressable>
        } />

    </View>);

}

const styles = StyleSheet.create({
  thumb: { width: 84, height: 84, borderRadius: 18, overflow: "hidden" },
  row: { gap: 4 },
  name: { fontWeight: "800", fontSize: 19, lineHeight: 24, flexShrink: 1, color: colors.ink },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  price: { fontWeight: "800", marginTop: 4, color: colors.ink },
  rating: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  newBadge: { fontSize: 13, color: colors.slate },
  hero: { backgroundColor: colors.ink, borderRadius: 24, marginBottom: 24, flexDirection: "row", overflow: "hidden", alignItems: "center" },
  heroCopy: { flex: 1, padding: 22, paddingRight: 0, zIndex: 1 },
  heroEyebrow: { fontSize: 10, color: colors.optic, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  heroTitle: { color: colors.chalk, fontSize: 29, fontWeight: "800", lineHeight: 32, letterSpacing: -0.8 },
  heroHint: { color: "#CCD8E8", fontSize: 13, lineHeight: 19, marginTop: 10 },
  heroArt: { width: "43%", maxWidth: 270 },
  label: { fontSize: 14, color: colors.ink, fontWeight: "700", marginBottom: 12 },
  search: { backgroundColor: colors.chalk, borderColor: colors.border, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 54 },
  searchIcon: { color: colors.slate, fontSize: 26, marginRight: 10 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 15, paddingVertical: 16 },
  clear: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 24, marginBottom: 14 },
  resultTitle: { fontSize: 19, fontWeight: "800", color: colors.ink, flexShrink: 1 },
  clubBody: { flexDirection: "row", gap: 16, padding: 20, alignItems: "center" },
  cardFoot: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", padding: 16, paddingHorizontal: 20, borderTopWidth: 1, borderColor: colors.border },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionText: { color: colors.court, fontWeight: "700", fontSize: 14 },
  arrow: { color: colors.court, fontSize: 22 }
});
