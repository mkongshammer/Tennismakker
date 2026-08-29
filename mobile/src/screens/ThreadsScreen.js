import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { dayShort, time } from "../lib/dates";

export default function ThreadsScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, threads: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { threads } = await api.threads();
      setState({ loading: false, error: null, threads });
    } catch (e) {
      setState({ loading: false, error: e.message, threads: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  const when = (iso) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? time(d) : dayShort(d);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.kridt }}
      contentContainerStyle={{ padding: 16 }}
      data={state.threads}
      keyExtractor={(t) => t.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
      ListEmptyComponent={
        <Empty>
          Ingen samtaler endnu. Slå til på et makker-opslag, så åbner der en samtale her.
        </Empty>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate("Samtale", { id: item.id, name: item.otherName })
          }
        >
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>
                {item.otherName}
                {item.unread && <Text style={styles.badge}>  ny</Text>}
              </Text>
              <Text style={styles.time}>{when(item.lastAt)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastBody ?? `Om: ${item.subject}`}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { fontWeight: "800", fontSize: 16, flexShrink: 1 },
  badge: { color: colors.grus, fontSize: 12, fontWeight: "800" },
  time: { color: colors.muted, fontSize: 12 },
  preview: { color: colors.muted, marginTop: 4 },
});
