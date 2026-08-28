import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";

export default function CoachesScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, coaches: [] });

  const load = useCallback(async () => {
    try {
      const { coaches } = await api.coaches();
      setState({ loading: false, error: null, coaches });
    } catch (e) {
      setState({ loading: false, error: e.message, coaches: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.kridt }}
      contentContainerStyle={{ padding: 16 }}
      data={state.coaches}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={<Empty>Ingen trænere endnu.</Empty>}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate("Traener", { id: item.id, name: item.name })}>
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{item.priceHour} kr/t</Text>
            </View>
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
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { fontWeight: "800", fontSize: 17, flexShrink: 1 },
  price: { fontWeight: "800", color: colors.grus, fontSize: 16 },
  headline: { marginTop: 6, lineHeight: 20 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: "#EDF1EE", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.bane },
});
