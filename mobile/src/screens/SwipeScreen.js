import { tr, useInternational } from "../lib/international";import React, { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useScreenData } from "../lib/useScreenData";
import { feedback as Alert } from "../lib/feedback";
import { api } from "../lib/api";
import { AppHeading, Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, LEVELS, SPORT_LABELS } from "../lib/theme";

export default function SwipeScreen({ navigation }) {useInternational();
  const state = useScreenData(useCallback(() => api.players(), []));
  const load = state.refresh;
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);

  const contact = async (player) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(player.id);
    try {
      const { threadId, otherName } = await api.contactPlayer(player.id);
      navigation.navigate("BeskederTab", {
        screen: "Samtale",
        params: { id: threadId, name: otherName }
      });
    } catch (e) {
      Alert.alert("Kunne ikke åbne beskeder", e.message);
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
      contentContainerStyle={pageContent}
      data={state.data.players}
      keyExtractor={(p) => p.id}
      refreshControl={
      <RefreshControl
        refreshing={state.refreshing}
        onRefresh={load} />

      }
      ListHeaderComponent={
      <View style={styles.header}>
          {state.error && <ErrorMessage message={state.error} onRetry={load} />}
          <AppHeading eyebrow={tr("BEDRE SAMMEN")} title={tr("Find din makker.")} subtitle={tr("Samme sport. Nyt bekendtskab. Skriv til en spiller og aftal jeres n\xE6ste kamp.")} />
          <Button title={tr("Se \xE5bne spilleaftaler \u2197")} variant="ink" onPress={() => navigation.navigate("Makkere")} />
        </View>
      }
      ListEmptyComponent={<Empty title={tr("G\xF8r plads til en ny makker")} icon="↗" action={tr("Se spilleaftaler")} onAction={() => navigation.navigate("Makkere")}>{tr("Der er ingen andre spillerprofiler at vise endnu. Pr\xF8v de \xE5bne opslag.")}</Empty>}
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
                  {item.isCoach ? <Badge>{tr("Tr\xE6ner")}</Badge> : null}
                </View>
                <Text style={styles.meta}>{tr("Niveau")}
                  {item.level} · {LEVELS[item.level] ?? ""}
                </Text>
                {item.area ? <Text style={styles.meta}>{item.area}</Text> : null}
                {item.sports?.length ? <Text style={styles.sports}>{item.sports.map((s) => SPORT_LABELS[s] ?? s).join(" · ")}</Text> : null}
              </View>
            </View>
            {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}
            <View style={{ marginTop: 12 }}>
              <Button
                title={tr("Send besked")}
                onPress={() => contact(item)}
                disabled={busyId !== null}
                loading={busyId === item.id} />

            </View>
          </Card>);

      }} />);


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
    backgroundColor: colors.courtTint,
    alignItems: "center",
    justifyContent: "center"
  },
  initials: { color: colors.court, fontWeight: "800", fontSize: 17 },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { color: colors.ink, fontWeight: "800", fontSize: 19 },
  meta: { color: colors.slate, marginTop: 2, fontSize: 13 },
  sports: { color: colors.court, fontWeight: "700", marginTop: 4, fontSize: 12 },
  bio: { marginTop: 12, lineHeight: 20 }
});
