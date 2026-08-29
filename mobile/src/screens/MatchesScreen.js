import React, { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS, MATCH_TYPES } from "../lib/theme";

export default function MatchesScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, matches: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { matches } = await api.matches();
      setState({ loading: false, error: null, matches });
    } catch (e) {
      setState({ loading: false, error: e.message, matches: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accept = async (id) => {
    try {
      const { threadId, otherName } = await api.acceptMatch(id);
      load();
      // Send brugeren direkte ind i samtalen, så de kan aftale en tid med det samme
      navigation.navigate("BeskederTab", {
        screen: "Samtale",
        params: { id: threadId, name: otherName },
      });
    } catch (e) {
      Alert.alert("Kunne ikke svare", e.message);
    }
  };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.kridt }}
      contentContainerStyle={{ padding: 16 }}
      data={state.matches}
      keyExtractor={(m) => m.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <Button
            title="Opret opslag"
            onPress={() => navigation.navigate("NytOpslag")}
          />
        </View>
      }
      ListEmptyComponent={<Empty>Ingen åbne opslag lige nu. Opret det første.</Empty>}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.row}>
            <Text style={styles.name}>{item.requesterName}</Text>
            <Badge>{`${item.level} · ${LEVELS[item.level] ?? ""}`}</Badge>
          </View>
          <Text style={styles.type}>{MATCH_TYPES[item.matchType] ?? item.matchType}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.meta}>{item.area}</Text>
          {item.isMine ? (
            <Text style={styles.mine}>Dit opslag</Text>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Button title="Slå til" onPress={() => accept(item.id)} />
            </View>
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "800", fontSize: 16, flexShrink: 1 },
  type: { color: colors.grus, fontWeight: "700", fontSize: 12, marginTop: 6 },
  message: { marginTop: 6, lineHeight: 20 },
  meta: { color: colors.muted, marginTop: 6, fontSize: 13 },
  mine: { color: colors.muted, marginTop: 10, fontStyle: "italic" },
});
