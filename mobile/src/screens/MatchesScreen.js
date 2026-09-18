import React, { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useScreenData } from "../lib/useScreenData";
import { feedback as Alert } from "../lib/feedback";
import { api } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS, MATCH_TYPES } from "../lib/theme";

export default function MatchesScreen({ navigation }) {
  const state = useScreenData(useCallback(() => api.matches(), []));
  const load = state.refresh;
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);

  const accept = async (id) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
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
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
      contentContainerStyle={{ padding: 16 }}
      data={state.data.matches}
      keyExtractor={(m) => m.id}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={load}
        />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          {state.error && <ErrorMessage message={state.error} onRetry={load} />}
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
              <Button title="Slå til" onPress={() => accept(item.id)} loading={busyId === item.id} disabled={busyId !== null} />
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
  type: { color: colors.court, fontWeight: "700", fontSize: 12, marginTop: 6 },
  message: { marginTop: 6, lineHeight: 20 },
  meta: { color: colors.slate, marginTop: 6, fontSize: 13 },
  mine: { color: colors.slate, marginTop: 10, fontStyle: "italic" },
});
