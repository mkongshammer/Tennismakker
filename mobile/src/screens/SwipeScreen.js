// The Players tab.
//
// Laid out like the website's player page: who wants to play right now along
// the top, the newest posts under it, and then every player as a profile
// card. Native throughout — the app's own cards, chips and theme.
import { tr, useInternational, getInternational } from "../lib/international";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useScreenData } from "../lib/useScreenData";
import { feedback as Alert } from "../lib/feedback";
import { api } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent, LEVELS, SPORT_LABELS, SPORTS, MATCH_TYPES, sportColor } from "../lib/theme";
import { PlayerAvatar, CardBand, firstName } from "../lib/PlayerAvatar";

/** Pure: "2 minutes ago" in the player's own language. */
export function ago(iso, locale = "en-US", now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((then - now) / 1000);
  const steps = [["minute", 60], ["hour", 3600], ["day", 86400], ["month", 2592000], ["year", 31536000]];
  let unit = "second", value = seconds;
  for (const [name, size] of steps) {
    if (Math.abs(seconds) < size) break;
    unit = name; value = Math.round(seconds / size);
  }
  try { return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit); } catch { return ""; }
}

export default function SwipeScreen({ navigation }) {
  useInternational();
  const [sport, setSport] = useState(null);
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(
    () => Promise.all([api.players({ area: query, sport: sport ?? undefined }), api.matches({ area: query })]).then(([p, m]) => ({ players: p.players ?? [], posts: (m.matches ?? []).filter((x) => !sport || x.sport === sport) })),
    [query, sport],
  );
  const state = useScreenData(load);
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);
  const list = useRef(null);
  const searchY = useRef(0);
  const locale = getInternational().locale;

  const players = state.data?.players ?? [];
  const posts = state.data?.posts ?? [];
  const stories = useMemo(() => {
    const seen = new Set();
    return posts.filter((p) => !p.isMine && p.requesterId && !seen.has(p.requesterId) && seen.add(p.requesterId)).slice(0, 14);
  }, [posts]);
  const postingIds = useMemo(() => new Set(posts.map((p) => p.requesterId).filter(Boolean)), [posts]);
  const sportsInUse = useMemo(() => SPORTS.filter((s) => players.some((p) => (p.sports ?? []).includes(s))), [players]);

  const run = async (id, action) => {
    if (lock.current) return;
    lock.current = true; setBusyId(id);
    try {
      const r = await action();
      if (r?.threadId) navigation.navigate("BeskederTab", { screen: "Samtale", params: { id: r.threadId, name: r.otherName } });
      else state.refresh();
    } catch (e) {
      Alert.alert(tr("Kunne ikke åbne beskeder"), e.message);
    } finally { lock.current = false; setBusyId(null); }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={state.refresh} />;

  const chip = (active) => [styles.chip, active && styles.chipOn];
  const chipText = (active) => [styles.chipText, active && styles.chipTextOn];

  return (
    <FlatList
      ref={list}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ backgroundColor: colors.mist }}
      contentContainerStyle={pageContent}
      data={players}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.slate} />}
      ListHeaderComponent={
        <View>
          {state.error ? <ErrorMessage message={state.error} onRetry={state.refresh} /> : null}

          {/* Who wants to play right now */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Opret opslag")} onPress={() => navigation.navigate("NytOpslag")} style={styles.story}>
              <View style={styles.newStory}><Text style={styles.plus}>+</Text></View>
              <Text style={styles.storyName} numberOfLines={1}>{tr("Your post")}</Text>
            </Pressable>
            {stories.map((p) => (
              <Pressable key={p.requesterId} accessibilityRole="button" accessibilityLabel={p.requesterName} onPress={() => navigation.navigate("Makkere")} style={styles.story}>
                <PlayerAvatar id={p.requesterId} name={p.requesterName} size={56} ring />
                <Text style={styles.storyName} numberOfLines={1}>{firstName(p.requesterName)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Sport and city */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable accessibilityRole="button" onPress={() => setSport(null)} style={chip(!sport)}><Text style={chipText(!sport)}>{tr("Alle")}</Text></Pressable>
            {sportsInUse.map((s) => (
              <Pressable key={s} accessibilityRole="button" onPress={() => setSport(sport === s ? null : s)} style={chip(sport === s)}>
                <View style={[styles.dot, { backgroundColor: sport === s ? colors.chalk : sportColor(s) }]} />
                <Text style={chipText(sport === s)}>{tr(SPORT_LABELS[s] ?? s)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.search} onLayout={(e) => { searchY.current = e.nativeEvent.layout.y; }}>
            <View style={styles.searchField}>
            <TextInput
              accessibilityLabel={tr("City or state")}
              placeholder={tr("City or state")}
              placeholderTextColor={colors.slateLight}
              value={region}
              onChangeText={setRegion}
              onFocus={() => setTimeout(() => list.current?.scrollToOffset({ offset: Math.max(0, searchY.current - 12), animated: true }), 150)}
              onSubmitEditing={() => setQuery(region.trim())}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput} />
            {region.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tr("Ryd søgning")} onPress={() => { setRegion(""); setQuery(""); }} style={styles.clear}>
                <Text style={{ color: colors.slate, fontSize: 20 }}>×</Text>
              </Pressable>
            ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Search")} onPress={() => setQuery(region.trim())} style={styles.searchGo}>
              <Text style={styles.searchGoText}>{tr("Search")}</Text>
            </Pressable>
          </View>

          {/* The newest posts */}
          {posts.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{tr("Looking to play")}</Text>
                <Pressable accessibilityRole="link" onPress={() => navigation.navigate("Makkere")}><Text style={styles.link}>{tr("See all posts")}</Text></Pressable>
              </View>
              {posts.slice(0, 4).map((p) => (
                <Card key={p.id} style={{ marginBottom: 10 }}>
                  <View style={styles.postHead}>
                    <PlayerAvatar id={p.requesterId ?? p.requesterName} name={p.requesterName} size={40} ring />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{p.requesterName}</Text>
                      <Text style={styles.meta} numberOfLines={1}>{[p.area, ago(p.createdAt, locale)].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Badge>{p.level} · {tr(LEVELS[p.level] ?? "")}</Badge>
                  </View>
                  <Text style={styles.message}>{p.message}</Text>
                  <View style={styles.postFoot}>
                    <View style={styles.tags}>
                      {p.sport ? <View style={styles.tag}><View style={[styles.dot, { backgroundColor: sportColor(p.sport) }]} /><Text style={styles.tagText}>{tr(SPORT_LABELS[p.sport] ?? p.sport)}</Text></View> : null}
                      <View style={styles.tag}><Text style={styles.tagText}>{tr(MATCH_TYPES[p.matchType] ?? p.matchType)}</Text></View>
                    </View>
                    {p.isMine
                      ? <Text style={styles.meta}>{tr("Dit opslag")}</Text>
                      : <Button title={tr("I'm in")} onPress={() => run(p.id, () => api.acceptMatch(p.id))} loading={busyId === p.id} disabled={busyId !== null} />}
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <Text style={[styles.section, { marginTop: 18, marginBottom: 10 }]}>{tr("Players")}</Text>
        </View>
      }
      ListEmptyComponent={
        <Empty title={tr("Ingen spillere matcher dine filtre endnu.")} icon="↗" action={tr("Opret opslag")} onAction={() => navigation.navigate("NytOpslag")}>
          {tr("Prøv en anden region eller en anden sportsgren, eller opret et opslag.")}
        </Empty>
      }
      renderItem={({ item }) => (
        <Card style={styles.profile}>
          <View style={styles.band}><CardBand id={item.id} height={56} /></View>
          <View style={styles.avatarWrap}><PlayerAvatar id={item.id} name={item.name} size={56} ring={postingIds.has(item.id)} /></View>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.area ? <Text style={styles.cardMeta} numberOfLines={1}>{item.area}</Text> : null}
          <View style={styles.badges}>
            <Badge>{item.level} · {tr(LEVELS[item.level] ?? "")}</Badge>
            {item.isCoach ? <Badge tone="court">{tr("Træner")}</Badge> : null}
          </View>
          {item.sports?.length ? (
            <View style={styles.cardSports}>
              {item.sports.map((s) => (
                <View key={s} style={styles.tag}><View style={[styles.dot, { backgroundColor: sportColor(s) }]} /><Text style={styles.tagText}>{tr(SPORT_LABELS[s] ?? s)}</Text></View>
              ))}
            </View>
          ) : null}
          {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}
          <View style={{ marginTop: "auto", paddingTop: 12 }}>
            <Button title={tr("Message")} onPress={() => run(item.id, () => api.contactPlayer(item.id))} loading={busyId === item.id} disabled={busyId !== null} />
          </View>
        </Card>
      )} />
  );
}

const styles = StyleSheet.create({
  stories: { gap: 14, paddingVertical: 4, paddingRight: 8 },
  story: { width: 72, alignItems: "center", gap: 4 },
  newStory: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center", marginVertical: 6 },
  plus: { color: colors.courtText, fontSize: 26, lineHeight: 30 },
  storyName: { color: colors.text, fontSize: 12, fontWeight: "700", maxWidth: 72 },
  chips: { gap: 8, paddingVertical: 10, paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.court, borderColor: colors.court },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: colors.chalk },
  dot: { width: 8, height: 8, borderRadius: 4 },
  search: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchField: { flex: 1, minWidth: 0, justifyContent: "center" },
  searchInput: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingLeft: 14, paddingRight: 40, color: colors.text, fontSize: 16 },
  clear: { position: "absolute", right: 4, padding: 8 },
  searchGo: { minHeight: 46, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.courtTint },
  searchGoText: { color: colors.courtText, fontWeight: "800", fontSize: 15 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  section: { color: colors.text, fontSize: 19, fontWeight: "800" },
  link: { color: colors.courtText, fontWeight: "700" },
  postHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: colors.text, fontWeight: "800", fontSize: 16 },
  meta: { color: colors.slate, fontSize: 13, marginTop: 1 },
  message: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 10 },
  postFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" },
  tags: { flexDirection: "row", gap: 6, flexWrap: "wrap", flexShrink: 1 },
  tag: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.courtTint },
  tagText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  profile: { flex: 1, padding: 0, overflow: "hidden", marginBottom: 12, alignItems: "center" },
  band: { width: "100%", height: 56 },
  avatarWrap: { marginTop: -34 },
  cardName: { color: colors.text, fontWeight: "800", fontSize: 15, textAlign: "center", marginTop: 4, paddingHorizontal: 10 },
  cardMeta: { color: colors.slate, fontSize: 12, textAlign: "center", marginTop: 2, paddingHorizontal: 10 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8, paddingHorizontal: 10 },
  cardSports: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8, paddingHorizontal: 10 },
  bio: { color: colors.slate, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 8, paddingHorizontal: 12 },
});
