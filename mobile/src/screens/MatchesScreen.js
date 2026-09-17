import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
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
      navigation.navigate("BeskederTab", {
        screen: "Samtale",
        params: { id: threadId, name: otherName },
      });
    } catch (e) {
      Alert.alert("Kunne ikke svare", e.message);
    }
  };

  const report = (item) => {
    Alert.alert(
      "Rapportér opslag",
      "Rapportér opslaget til RacketBuddy, hvis det indeholder spam, chikane eller andet upassende indhold.",
      [
        { text: "Annullér", style: "cancel" },
        {
          text: "Rapportér",
          style: "destructive",
          onPress: async () => {
            try {
              await api.report({ kind: "MATCH", targetId: item.id, reason: "OTHER" });
              Alert.alert("Tak", "Rapporten er sendt til RacketBuddy.");
            } catch (e) {
              Alert.alert("Kunne ikke rapportere", e.message);
            }
          },
        },
      ]
    );
  };

  const block = (item) => {
    Alert.alert(
      `Bloker ${item.requesterName}`,
      "I bliver skjult for hinanden og kan ikke kontakte hinanden.",
      [
        { text: "Annullér", style: "cancel" },
        {
          text: "Bloker",
          style: "destructive",
          onPress: async () => {
            try {
              await api.blockUser(item.requesterId);
              setState((s) => ({ ...s, matches: s.matches.filter((m) => m.requesterId !== item.requesterId) }));
            } catch (e) {
              Alert.alert("Kunne ikke blokere", e.message);
            }
          },
        },
      ]
    );
  };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
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
            <>
              <View style={{ marginTop: 12 }}>
                <Button title="Slå til" onPress={() => accept(item.id)} />
              </View>
              <View style={styles.safetyRow}>
                <Pressable onPress={() => report(item)} hitSlop={8}>
                  <Text style={styles.safetyLink}>Rapportér</Text>
                </Pressable>
                <Pressable onPress={() => block(item)} hitSlop={8}>
                  <Text style={styles.blockLink}>Bloker bruger</Text>
                </Pressable>
              </View>
            </>
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
  safetyRow: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 14 },
  safetyLink: { color: colors.slate, fontSize: 12, fontWeight: "700" },
  blockLink: { color: colors.court, fontSize: 12, fontWeight: "800" },
});
