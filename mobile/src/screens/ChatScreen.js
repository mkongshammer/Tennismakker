import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../lib/api";
import { Button, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent } from "../lib/theme";
import { time } from "../lib/dates";
import { useScreenData } from "../lib/useScreenData";
import { mergeMessages } from "../lib/messages.mjs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen({ route }) {
  const { id } = route.params;
  const state = useScreenData(useCallback(() => api.thread(id), [id]), { pollMs: 8000 });
  const load = state.refresh;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState([]);
  const listRef = useRef(null);
  const sendingLock = useRef(false);
  const nearBottom = useRef(true);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  useEffect(() => { setSent([]); setDraft(""); setSendError(null); nearBottom.current = true; }, [id]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sendingLock.current) return;
    sendingLock.current = true;
    setSendError(null);
    setSending(true);
    try {
      const msg = await api.sendMessage(id, body);
      setDraft("");
      nearBottom.current = true;
      setSent(messages => mergeMessages(messages, [msg]));
    } catch (e) {
      setSendError(e.message);
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.mist }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Text style={styles.subject}>Om: {state.data.subject}</Text>
      {state.error && <ErrorMessage message={state.error} onRetry={load} />}
      {sendError && <Text accessibilityRole="alert" style={{ padding: 12, color: colors.court }}>{sendError}</Text>}

      <FlatList
        ref={listRef}
        data={mergeMessages(state.data.messages, sent)}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[pageContent, { gap: 10 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false }); }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Ingen beskeder endnu — skriv den første og aftal en tid.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={item.mine ? styles.rowMine : styles.rowTheirs}>
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <Text style={item.mine ? styles.textMine : styles.textTheirs}>{item.body}</Text>
              <Text style={item.mine ? styles.timeMine : styles.timeTheirs}>
                {time(new Date(item.createdAt))}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={{ backgroundColor: colors.chalk, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: colors.border }}><View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Skriv en besked…"
          accessibilityLabel="Besked"
          editable={!sending}
          multiline
          maxLength={2000}
        />
        <Button title="Send" onPress={send} loading={sending} disabled={!draft.trim()} />
      </View></View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  subject: {
    padding: 12,
    color: colors.slate,
    fontSize: 13,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  mine: { backgroundColor: colors.court, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  textMine: { color: colors.chalk, lineHeight: 23, fontSize: 15 },
  textTheirs: { color: colors.ink, lineHeight: 23, fontSize: 15 },
  timeMine: { color: "#E1ECFF", fontSize: 11, marginTop: 6, alignSelf: "flex-end" },
  timeTheirs: { color: colors.slate, fontSize: 11, marginTop: 3 },
  empty: { textAlign: "center", color: colors.slate, marginTop: 32 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#fff",
    alignItems: "flex-end",
    width: "100%", maxWidth: 960, alignSelf: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: colors.ink,
    minHeight: 48,
  },
});
