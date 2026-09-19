import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, SPORT_LABELS } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { useScreenData } from "../lib/useScreenData";

export default function CoachesScreen({ navigation }) {
  const [sport, setSport] = useSport();
  const { data, loading, error, refreshing, refresh } = useScreenData(useCallback(() => api.coaches(sport), [sport]));
  const state = { loading, error, coaches: data?.coaches ?? [] };

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <View style={{ paddingTop: 12 }}>
        <SportPicker value={sport} onChange={setSport} />
      </View>

      {state.loading ? (
        <Loading />
      ) : state.error && !data ? (
        <ErrorMessage message={state.error} onRetry={refresh} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 24, paddingTop: 8, width: "100%", maxWidth: 1000, alignSelf: "center" }}
          data={state.coaches}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={error ? <ErrorMessage message={error} onRetry={refresh} /> : null}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Card style={{ marginTop: 12, padding: 28 }}>
            <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700", marginBottom: 10 }}>Ingen trænere i {SPORT_LABELS[sport]?.toLowerCase()} endnu</Text>
            <Text style={{ color: colors.slate, fontSize: 16, lineHeight: 25 }}>Der er ingen profiler at vise for dit valg. Vælg en anden sportsgren ovenfor for at se de trænere, der er tilmeldt.</Text>
          </Card>}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Se ${item.name}`} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} onPress={() => navigation.navigate("Traener", { id: item.id, name: item.name })}>
              <Card>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.price}>{item.priceHour} kr/t</Text>
                </View>
                {item.rating?.count > 0 && (
                  <Text style={styles.rating}>
                    <Text style={{ color: colors.court }}>★</Text> {item.rating.average.toFixed(1)}{" "}
                    <Text style={styles.meta}>({item.rating.count})</Text>
                  </Text>
                )}
                <Text style={styles.headline}>{item.headline}</Text>
                <Text style={styles.meta}>{item.area}</Text>
                {item.specialties.length > 0 && (
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
              </Card>
            </Pressable>
          )}
        />
      )}
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
});
