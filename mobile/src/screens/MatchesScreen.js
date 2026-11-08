// Players: find a hitting partner the way you'd find a place to stay on
// Airbnb — one search field for the area, quick filters for sport and level,
// open games in a row you can swipe, and players near you as clear cards
// with one button to message them.
import { tr, useInternational } from "../lib/international";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { feedback as Alert } from "../lib/feedback";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, LEVELS, MATCH_TYPES, SPORTS, SPORT_LABELS, sportColor } from "../lib/theme";

const LEVEL_FILTERS = [
  { key: "any", label: "Any level" },
  { key: "near", label: "Around my level" },
];

export default function MatchesScreen({ navigation }) {
  useInternational();
  const { user } = useAuth();
  const [area, setArea] = useState(user?.area ?? "");
  const [query, setQuery] = useState(user?.area ?? "");
  const [sport, setSport] = useState(null);
  const [levelFilter, setLevelFilter] = useState("any");
  const [data, setData] = useState({ matches: [], players: [] });
  const [state, setState] = useState({ loading: true, refreshing: false, error: null });
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const id = setTimeout(() => setQuery(area.trim()), 450);
    return () => clearTimeout(id);
  }, [area]);

  const load = useCallback(async (refreshing = false) => {
    setState((s) => ({ ...s, refreshing, error: null }));
    try {
      const [m, p] = await Promise.all([
        api.matches({ area: query }),
        api.players({ area: query, sport: sport ?? undefined }),
      ]);
      setData({ matches: m.matches ?? [], players: p.players ?? [] });
      setState({ loading: false, refreshing: false, error: null });
    } catch (e) {
      setState({ loading: false, refreshing: false, error: e.message });
    }
  }, [query, sport]);

  useEffect(() => { load(); }, [load]);

  const myLevel = Number(user?.level) || null;
  const players = useMemo(() => {
    let list = data.players;
    if (levelFilter === "near" && myLevel) list = list.filter((p) => !p.level || Math.abs(Number(p.level) - myLevel) <= 1);
    return list;
  }, [data.players, levelFilter, myLevel]);
  const matches = useMemo(() => {
    let list = data.matches;
    if (levelFilter === "near" && myLevel) list = list.filter((m) => !m.level || Math.abs(Number(m.level) - myLevel) <= 1);
    return list;
  }, [data.matches, levelFilter, myLevel]);

  const run = async (id, fn) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    try {
      const { threadId, otherName } = await fn();
      navigation.navigate("BeskederTab", { screen: "Samtale", params: { id: threadId, name: otherName } });
      load();
    } catch (e) {
      Alert.alert(tr("Something went wrong"), e.message);
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  if (state.loading) return <Loading label={tr("Finding players…")} />;

  const header = (
    <View style={{ gap: 18, marginBottom: 8 }}>
      <View>
        <Text style={styles.eyebrow}>{tr("FIND A HITTING PARTNER")}</Text>
        <Text style={styles.title}>{tr("Who do you want to play with?")}</Text>
      </View>

      <View style={styles.search}>
        <Text accessible={false} style={styles.searchIcon}>⌕</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.searchLabel}>{tr("Where")}</Text>
          <TextInput
            accessibilityLabel={tr("City or area")}
            placeholder={tr("City or area")}
            placeholderTextColor={colors.slateLight}
            value={area}
            onChangeText={setArea}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setQuery(area.trim())}
            style={styles.searchInput}
          />
        </View>
        {!!area && (
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Clear")} hitSlop={10} onPress={() => setArea("")}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip active={!sport} onPress={() => setSport(null)} label={tr("All sports")} />
        {SPORTS.map((s) => (
          <Chip key={s} active={sport === s} onPress={() => setSport(sport === s ? null : s)} label={tr(SPORT_LABELS[s])} dot={sportColor(s)} />
        ))}
        <View style={styles.divider} />
        {LEVEL_FILTERS.map((f) => (
          <Chip key={f.key} active={levelFilter === f.key} onPress={() => setLevelFilter(f.key)} label={tr(f.label)} disabled={f.key === "near" && !myLevel} />
        ))}
      </ScrollView>

      {state.error && <ErrorMessage message={state.error} onRetry={() => load()} />}

      <View style={styles.sectionHead}>
        <Text style={styles.section}>{tr("Open games")}</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => navigation.navigate("NytOpslag")}>
          <Text style={styles.link}>{tr("+ Post a game")}</Text>
        </Pressable>
      </View>
      {matches.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
          {matches.map((m) => (
            <View key={m.id} style={styles.gameCard}>
              <Text style={styles.gameType}>{tr(MATCH_TYPES[m.matchType] ?? m.matchType)}</Text>
              <Text style={styles.gameName} numberOfLines={1}>{m.requesterName}</Text>
              <Text style={styles.meta} numberOfLines={1}>{[m.area, m.level ? `${tr("Level")} ${m.level}` : null].filter(Boolean).join(" · ")}</Text>
              {!!m.message && <Text style={styles.gameMsg} numberOfLines={2}>{m.message}</Text>}
              <View style={{ flex: 1 }} />
              {m.isMine
                ? <Text style={styles.mine}>{tr("Your post")}</Text>
                : <Button title={tr("I'm in")} onPress={() => run(m.id, () => api.acceptMatch(m.id))} loading={busyId === m.id} disabled={busyId !== null} />}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("NytOpslag")} style={styles.emptyGame}>
          <Text style={styles.emptyTitle}>{tr("No open games here yet")}</Text>
          <Text style={styles.meta}>{tr("Post one in 20 seconds and players nearby can join.")}</Text>
        </Pressable>
      )}

      <Text style={[styles.section, { marginTop: 8 }]}>
        {query ? `${tr("Players in")} ${query}` : tr("Players near you")}
        <Text style={styles.count}>{`  ${players.length}`}</Text>
      </Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
      contentContainerStyle={pageContent}
      data={players}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={
        <View style={styles.emptyGame}>
          <Text style={styles.emptyTitle}>{tr("No players match yet")}</Text>
          <Text style={styles.meta}>{tr("Try another area or sport, or post a game so players can find you.")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.playerCard}>
          <Avatar name={item.name} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.row}>
              <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
              {item.isCoach && <Text style={styles.coach}>{tr("Coach")}</Text>}
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {[item.level ? `${item.level} · ${tr(LEVELS[item.level] ?? "")}` : null, item.area].filter(Boolean).join("  ·  ")}
            </Text>
            {!!item.sports?.length && (
              <View style={styles.sportRow}>
                {item.sports.slice(0, 3).map((s) => (
                  <View key={s} style={styles.sportTag}>
                    <View style={[styles.dot, { backgroundColor: sportColor(String(s).toUpperCase()) }]} />
                    <Text style={styles.sportText}>{tr(SPORT_LABELS[String(s).toUpperCase()] ?? s)}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!item.bio && <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>}
            <View style={{ marginTop: 8 }}>
              <Button title={tr("Message")} onPress={() => run(item.id, () => api.contactPlayer(item.id))} loading={busyId === item.id} disabled={busyId !== null} />
            </View>
          </View>
        </View>
      )}
    />
  );
}

function Chip({ label, active, onPress, dot, disabled }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.slate, fontWeight: "800", letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontWeight: "800", fontSize: 30, letterSpacing: -0.8, marginTop: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 32, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  searchIcon: { color: colors.text, fontSize: 22 },
  searchLabel: { color: colors.text, fontWeight: "800", fontSize: 13 },
  searchInput: { color: colors.text, fontSize: 16, paddingVertical: 2 },
  clear: { color: colors.slate, fontSize: 24 },
  chips: { gap: 8, alignItems: "center", paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  chipTextActive: { color: colors.mist, fontWeight: "700" },
  divider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  section: { color: colors.text, fontWeight: "800", fontSize: 20 },
  count: { color: colors.slate, fontWeight: "600", fontSize: 15 },
  link: { color: colors.courtText, fontWeight: "700", fontSize: 15 },
  gameCard: { width: 240, minHeight: 190, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  gameType: { color: colors.courtText, fontWeight: "800", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  gameName: { color: colors.text, fontWeight: "800", fontSize: 17 },
  gameMsg: { color: colors.text, lineHeight: 20, marginTop: 4, marginBottom: 10 },
  emptyGame: { padding: 18, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, gap: 4 },
  emptyTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  meta: { color: colors.slate, fontSize: 14 },
  mine: { color: colors.slate, fontStyle: "italic" },
  playerCard: { flexDirection: "row", gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  playerName: { color: colors.text, fontWeight: "800", fontSize: 18, flexShrink: 1 },
  coach: { color: colors.courtText, fontWeight: "800", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  sportRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  sportTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.raised },
  sportText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  bio: { color: colors.text, lineHeight: 20, marginTop: 4 },
});
