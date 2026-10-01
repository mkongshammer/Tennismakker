import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import { AppHeading, Avatar, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, SPORT_LABELS } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { useScreenData } from "../lib/useScreenData";

export default function CoachesScreen({ navigation }) {
  const [sport, setSport] = useSport();
  const { data, loading, error, refreshing, refresh } = useScreenData(useCallback(() => api.coaches(sport), [sport]));
  const state = { loading, error, coaches: data?.coaches ?? [] };

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
        <FlatList
          contentContainerStyle={pageContent}
          data={loading ? [] : state.coaches}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={<><AppHeading eyebrow="LØFT DIT SPIL" title="Et skridt videre." subtitle="Find en træner, der passer til din sport og dit niveau." /><SportPicker value={sport} onChange={setSport} />{error && <ErrorMessage message={error} onRetry={refresh} />}</>}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={loading ? <Loading label="Finder trænere…" /> : error && !data ? null : <Empty title="Dit næste trænerteam er på vej" icon="↗">Ingen trænere i {SPORT_LABELS[sport]?.toLowerCase()} endnu. Vælg en anden sportsgren for at se de tilmeldte trænere.</Empty>}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Se ${item.name}`} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} onPress={() => navigation.navigate("Traener", { id: item.id, name: item.name })}>
              <Card>
                <View style={styles.coachTop}><Avatar name={item.name} size={56} /><View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.area}</Text>
                  </View>
                </View>
                {item.rating?.count > 0 && (
                  <Text style={styles.rating}>
                    <Text style={{ color: colors.court }}>★</Text> {item.rating.average.toFixed(1)}{" "}
                    <Text style={styles.meta}>({item.rating.count})</Text>
                  </Text>
                )}
                <Text style={styles.headline}>{item.headline}</Text>
                {item.specialties?.length > 0 && (
                  <View style={styles.tags}>
                    {item.specialties.map((s) => (
                      <View key={s} style={styles.tag}>
                        <Text style={styles.tagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.packageCount > 0 && (
                  <Text style={styles.packages}>
                    {item.packageCount === 1 ? "Tilbyder også en pakke" : `Tilbyder også ${item.packageCount} pakker`}
                  </Text>
                )}
                <View style={styles.footer}><Text style={styles.price}>{item.priceHour} kr. <Text style={styles.meta}>/ time</Text></Text><Text style={styles.action}>Se træner ↗</Text></View>
              </Card>
            </Pressable>
          )}
        />
    </View>
  );
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
  action: { color: colors.court, fontWeight: "700", fontSize: 14 },
});
