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
import { colors } from "../lib/theme";
import { time } from "../lib/dates";

export default function ChatScreen({ route }) {
  const { id } = route.params;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.thread(id);
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(id, body);
      setDraft("");
      setState((s) => ({
        ...s,
        data: { ...s.data, messages: [...s.data.messages, msg] },
      }));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
    } finally {
      setSending(false);
    }
  };

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.kridt }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Text style={styles.subject}>Om: {state.data.subject}</Text>

      <FlatList
        ref={listRef}
        data={state.data.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Skriv en besked…"
          multiline
          maxLength={2000}
        />
        <Button title="Send" onPress={send} loading={sending} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  subject: {
    padding: 12,
    color: colors.muted,
    fontSize: 13,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: colors.bane },
  theirs: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  textMine: { color: colors.kridt, lineHeight: 20 },
  textTheirs: { color: colors.net, lineHeight: 20 },
  timeMine: { color: "rgba(250,247,240,0.6)", fontSize: 11, marginTop: 3 },
  timeTheirs: { color: colors.muted, fontSize: 11, marginTop: 3 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 32 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
});
