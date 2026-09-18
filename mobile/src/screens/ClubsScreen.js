import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { CourtGraphic } from "../lib/CourtGraphic";
import { useScreenData } from "../lib/useScreenData";

function Stars({ average, count }) {
  if (!count) return <Text style={styles.newBadge}>Ny på RacketBuddy</Text>;
  return (
    <Text style={styles.rating}>
      <Text style={{ color: colors.court }}>★</Text> {average.toFixed(1)}{" "}
      <Text style={styles.meta}>({count})</Text>
    </Text>
  );
}

export default function ClubsScreen({ navigation }) {
  const [sport, setSport] = useSport();
  const { data, loading, error, refreshing, refresh } = useScreenData(useCallback(() => api.clubs(sport), [sport]));
  const state = { loading, error, clubs: data?.clubs ?? [] };

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
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          data={state.clubs}
          ListHeaderComponent={error ? <ErrorMessage message={error} onRetry={refresh} /> : null}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
          ListEmptyComponent={
            <Empty>Ingen klubber for den sportsgren i dit land endnu.</Empty>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Se ledige tider hos ${item.name}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              onPress={() => navigation.navigate("Klub", { slug: item.slug, name: item.name })}
            >
              <Card style={{ flexDirection: "row", gap: 14 }}>
                <View style={styles.thumb}>
                  <CourtGraphic color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Stars average={item.rating?.average ?? 0} count={item.rating?.count ?? 0} />
                  </View>
                  <Text style={styles.meta}>{item.city}</Text>
                  <Text style={styles.meta}>
                    {item.courtCount} baner
                  </Text>
                  <Text style={styles.price}>fra {item.priceHour} kr/time</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 64, borderRadius: 12, overflow: "hidden" },
  row: { gap: 4 },
  name: { fontWeight: "800", fontSize: 16, flexShrink: 1, color: colors.ink },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  price: { fontWeight: "800", marginTop: 4, color: colors.ink },
  rating: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  newBadge: { fontSize: 13, color: colors.slate },
});
