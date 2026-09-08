import React, { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS } from "../lib/theme";

export default function SwipeScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, players: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { players } = await api.players();
      setState({ loading: false, error: null, players });
    } catch (e) {
      setState({ loading: false, error: e.message, players: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const contact = async (player) => {
    setBusyId(player.id);
    try {
      const { threadId, otherName } = await api.contactPlayer(player.id);
      navigation.navigate("BeskederTab", {
        screen: "Samtale",
        params: { id: threadId, name: otherName },
      });
    } catch (e) {
      Alert.alert("Kunne ikke åbne beskeder", e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
      contentContainerStyle={{ padding: 16 }}
      data={state.players}
      keyExtractor={(p) => p.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Find en medspiller</Text>
          <Text style={styles.subtitle}>
            Se spillere på RacketBuddy og skriv direkte til dem. Ingen likes eller matches først.
          </Text>
          <Button title="Se opslag" variant="ink" onPress={() => navigation.navigate("Makkere")} />
        </View>
      }
      ListEmptyComponent={<Empty>Der er ingen andre spillere at vise endnu.</Empty>}
      renderItem={({ item }) => {
        const initials = item.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
        return (
          <Card>
            <View style={styles.playerRow}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isCoach ? <Badge>Træner</Badge> : null}
                </View>
                <Text style={styles.meta}>
                  Niveau {item.level} · {LEVELS[item.level] ?? ""}
                </Text>
                {item.area ? <Text style={styles.meta}>{item.area}</Text> : null}
                {item.sports?.length ? <Text style={styles.sports}>{item.sports.join(" · ")}</Text> : null}
              </View>
            </View>
            {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}
            <View style={{ marginTop: 12 }}>
              <Button
                title="Send besked"
                onPress={() => contact(item)}
                disabled={busyId === item.id}
              />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 14, gap: 8 },
  title: { fontSize: 22, fontWeight: "900", color: colors.ink },
  subtitle: { color: colors.slate, lineHeight: 20, marginBottom: 4 },
  playerRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.chalk, fontWeight: "900", fontSize: 17 },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontWeight: "900", fontSize: 17 },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  sports: { color: colors.court, fontWeight: "700", marginTop: 4, fontSize: 12 },
  bio: { marginTop: 12, lineHeight: 20 },
});
