import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";

export default function ClubsScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, clubs: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { clubs } = await api.clubs();
      setState({ loading: false, error: null, clubs });
    } catch (e) {
      setState({ loading: false, error: e.message, clubs: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.kridt }}
      contentContainerStyle={{ padding: 16 }}
      data={state.clubs}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
      ListEmptyComponent={<Empty>Ingen klubber endnu.</Empty>}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate("Klub", { slug: item.slug, name: item.name })}>
          <Card>
            <View style={[styles.stripe, { backgroundColor: item.color }]} />
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.city}</Text>
            <Text style={styles.meta}>
              {item.courtCount} baner · fra {item.priceHour} kr/time
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  stripe: { height: 4, borderRadius: 2, marginBottom: 12, width: 48 },
  name: { fontWeight: "800", fontSize: 17 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
});
