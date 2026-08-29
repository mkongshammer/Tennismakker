import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, LEVELS } from "../lib/theme";

export default function SwipeScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: null, players: [], likes: 0 });
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { players, pendingLikes } = await api.swipeQueue();
      setState({ loading: false, error: null, players, likes: pendingLikes });
      setIndex(0);
    } catch (e) {
      setState({ loading: false, error: e.message, players: [], likes: 0 });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} onRetry={load} />;

  const player = state.players[index];

  const decide = async (liked) => {
    if (!player) return;
    setBusy(true);
    try {
      const result = await api.swipe(player.id, liked);
      if (result.matched && result.threadId) {
        navigation.navigate("BeskederTab", {
          screen: "Samtale",
          params: { id: result.threadId, name: result.otherName },
        });
      }
      setIndex((i) => i + 1);
    } catch (e) {
      Alert.alert("Der gik noget galt", e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!player) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.kridt, justifyContent: "center" }}>
        <Empty>
          Ikke flere spillere lige nu. Kig forbi igen om et par dage.
        </Empty>
        <View style={{ paddingHorizontal: 32 }}>
          <Button title="Hent igen" variant="bane" onPress={load} />
        </View>
      </View>
    );
  }

  const initials = player.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <View style={styles.wrap}>
      {state.likes > 0 && (
        <Text style={styles.likes}>{state.likes} har vist interesse i dig</Text>
      )}

      <Card style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{player.name}</Text>
        <Text style={styles.level}>
          Niveau {player.level} · {LEVELS[player.level]}
        </Text>
        {player.area ? <Text style={styles.area}>{player.area}</Text> : null}
        {player.bio ? <Text style={styles.bio}>{player.bio}</Text> : null}
        {player.isCoach && <Text style={styles.coach}>Er også træner</Text>}
      </Card>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title="Spring over" variant="bane" onPress={() => decide(false)} disabled={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Vil spille" onPress={() => decide(true)} disabled={busy} />
        </View>
      </View>

      <Text style={styles.hint}>
        Siger I begge ja, åbner der en samtale. Springer du over, får den anden
        ikke besked.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.kridt, padding: 16, justifyContent: "center" },
  likes: {
    textAlign: "center",
    color: colors.grus,
    fontWeight: "800",
    marginBottom: 12,
  },
  card: { alignItems: "center", paddingVertical: 32 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bane,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  initials: { color: colors.kridt, fontSize: 32, fontWeight: "900" },
  name: { fontSize: 24, fontWeight: "900" },
  level: { color: colors.muted, marginTop: 6 },
  area: { color: colors.muted, marginTop: 2 },
  bio: { marginTop: 14, textAlign: "center", lineHeight: 20 },
  coach: { marginTop: 12, color: colors.grus, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 16, lineHeight: 17 },
});
