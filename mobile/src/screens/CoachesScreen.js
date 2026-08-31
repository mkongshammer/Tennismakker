import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { SportPicker, useSport } from "../lib/SportPicker";

export default function CoachesScreen({ navigation }) {
  const [sport, setSport] = useSport();
  const [state, setState] = useState({ loading: true, error: null, coaches: [] });

  const load = useCallback(async () => {
    try {
      const { coaches } = await api.coaches(sport);
      setState({ loading: false, error: null, coaches });
    } catch (e) {
      setState({ loading: false, error: e.message, coaches: [] });
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
          data={state.coaches}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Empty>Ingen trænere for den sportsgren endnu.</Empty>}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate("Traener", { id: item.id, name: item.name })}>
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
