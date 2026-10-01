import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useScreenData } from "../lib/useScreenData";
import { api } from "../lib/api";
import { AppHeading, Avatar, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent } from "../lib/theme";
import { dayShort, time } from "../lib/dates";

export default function ThreadsScreen({ navigation }) {
  const state = useScreenData(useCallback(() => api.threads(), []), { pollMs: 15000 });
  const load = state.refresh;

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  const when = (iso) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? time(d) : dayShort(d);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
      contentContainerStyle={pageContent}
      data={state.data.threads}
      ListHeaderComponent={<><AppHeading eyebrow="SPILLET STARTER MED ET HEJ" title="Dine samtaler." subtitle="Aftal næste kamp og hold kontakten med dine medspillere." />{state.error && <ErrorMessage message={state.error} onRetry={load} />}</>}
      keyExtractor={(t) => t.id}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={load}
        />
      }
      ListEmptyComponent={
        <Empty title="Sig hej til din næste medspiller" icon="↗" action="Find en medspiller" onAction={() => navigation.navigate("MakkereTab")}>
          Find en spiller eller svar på et opslag. Jeres samtale vises her.
        </Empty>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Samtale med ${item.otherName}${item.unread ? ", ny besked" : ""}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          onPress={() =>
            navigation.navigate("Samtale", { id: item.id, name: item.otherName })
          }
        >
          <Card style={{ flexDirection: "row", gap: 14, alignItems: "center", borderColor: item.unread ? "#B8CFFA" : colors.border }}>
            <Avatar name={item.otherName} />
            <View style={{ flex: 1 }}>
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
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { color: colors.ink, fontWeight: "800", fontSize: 16, flexShrink: 1 },
  badge: { color: colors.court, fontSize: 12, fontWeight: "800" },
  time: { color: colors.slate, fontSize: 12 },
  preview: { color: colors.slate, marginTop: 4 },
});
