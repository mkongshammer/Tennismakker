import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useInternational, money, tr } from "../lib/international";
import { PreferencesPicker } from "../lib/PreferencesPicker";
import { api } from "../lib/api";
import { AppHeading, Avatar, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, SPORT_LABELS } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { useScreenData } from "../lib/useScreenData";

export default function CoachesScreen({ navigation }) {
  const { country } = useInternational();
  const [sport, setSport] = useSport();
  const { data, loading, error, refreshing, refresh } = useScreenData(useCallback(() => api.coaches(sport, undefined, country), [sport, country]));
  const state = { loading, error, coaches: data?.coaches ?? [] };

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
        <FlatList
        contentContainerStyle={pageContent}
        data={loading ? [] : state.coaches}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={<><PreferencesPicker /><AppHeading eyebrow={tr("L\xD8FT DIT SPIL")} title={tr("Et skridt videre.")} subtitle={tr("Find en tr\xE6ner, der passer til din sport og dit niveau.")} /><SportPicker value={sport} onChange={setSport} />{error && <ErrorMessage message={error} onRetry={refresh} />}</>}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={loading ? <Loading label={tr("Finder tr\xE6nere\u2026")} /> : error && !data ? null : <Empty title={tr("Dit n\xE6ste tr\xE6nerteam er p\xE5 vej")} icon="↗">{tr("Ingen tr\xE6nere i") + " "}{SPORT_LABELS[sport]?.toLowerCase()}{" " + tr("endnu. V\xE6lg en anden sportsgren for at se de tilmeldte tr\xE6nere.")}</Empty>}
        renderItem={({ item }) =>
        <Pressable accessibilityRole="button" accessibilityLabel={`Se ${item.name}`} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} onPress={() => navigation.navigate("Traener", { id: item.id, name: item.name })}>
              <Card>
                <View style={styles.coachTop}><Avatar name={item.name} size={56} /><View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.area}</Text>
                  </View>
                </View>
                {item.rating?.count > 0 &&
            <Text style={styles.rating}>
                    <Text style={{ color: colors.court }}>★</Text> {item.rating.average.toFixed(1)}{" "}
                    <Text style={styles.meta}>({item.rating.count})</Text>
                  </Text>
            }
                <Text style={styles.headline}>{item.headline}</Text>
                {item.specialties?.length > 0 &&
            <View style={styles.tags}>
                    {item.specialties.map((s) =>
              <View key={s} style={styles.tag}>
                        <Text style={styles.tagText}>{s}</Text>
                      </View>
              )}
                  </View>
            }
                {item.packageCount > 0 &&
            <Text style={styles.packages}>
                    {item.packageCount === 1 ? tr("Tilbyder ogs\xE5 en pakke") : `Tilbyder også ${item.packageCount} pakker`}
                  </Text>
            }
                <View style={styles.footer}><Text style={styles.price}>{money(item.priceHour, item.currency)} <Text style={styles.meta}>{tr("/ time")}</Text></Text><Text style={styles.action}>{tr("Se tr\xE6ner \u2197")}</Text></View>
              </Card>
            </Pressable>
        } />

    </View>);

}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { fontWeight: "800", fontSize: 17, flexShrink: 1, color: colors.ink },
  price: { fontWeight: "800", color: colors.court, fontSize: 16 },
  rating: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.ink },
  headline: { marginTop: 6, lineHeight: 20 },
  meta: { color: colors.slate, marginTop: 4, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: colors.mist, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  packages: { marginTop: 8, fontSize: 13, fontWeight: "700", color: colors.court },
  coachTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTopWidth: 1, borderColor: colors.border, marginTop: 20, paddingTop: 16 },
  action: { color: colors.court, fontWeight: "700", fontSize: 14 }
});
