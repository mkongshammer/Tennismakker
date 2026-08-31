import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";
import { CourtGraphic } from "../lib/CourtGraphic";

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
  const [state, setState] = useState({ loading: true, error: null, clubs: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { clubs } = await api.clubs(sport);
      setState({ loading: false, error: null, clubs });
    } catch (e) {
      setState({ loading: false, error: e.message, clubs: [] });
    }
  }, [sport]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <View style={{ paddingTop: 12 }}>
        <SportPicker value={sport} onChange={setSport} />
      </View>

      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorMessage message={state.error} onRetry={load} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          data={state.clubs}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            />
          }
          ListEmptyComponent={
            <Empty>Ingen klubber for den sportsgren i dit land endnu.</Empty>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("Klub", { slug: item.slug, name: item.name })}
            >
              <Card style={{ flexDirection: "row", gap: 14 }}>
                <View style={styles.thumb}>
                  <CourtGraphic color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 6 },
  name: { fontWeight: "800", fontSize: 16, flexShrink: 1, color: colors.ink },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  price: { fontWeight: "800", marginTop: 4, color: colors.ink },
  rating: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  newBadge: { fontSize: 11, color: colors.slateLight },
});
