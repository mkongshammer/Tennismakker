import { tr, useInternational } from "../lib/international";import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View } from
"react-native";
import { api } from "../lib/api";
import { moderationApi } from "../lib/moderationApi";
import { feedback as Alert } from "../lib/feedback";
import { Button, ErrorMessage, Loading } from "../lib/ui";
import { colors, pageContent } from "../lib/theme";
import { time } from "../lib/dates";
import { useScreenData } from "../lib/useScreenData";
import { mergeMessages } from "../lib/messages.mjs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen({ route }) {useInternational();
  const { id } = route.params;
  const state = useScreenData(useCallback(() => api.thread(id), [id]), { pollMs: 8000 });
  const load = state.refresh;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState([]);
  const [moderating, setModerating] = useState(null);
  const listRef = useRef(null);
  const sendingLock = useRef(false);
  const nearBottom = useRef(true);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  useEffect(() => {setSent([]);setDraft("");setSendError(null);nearBottom.current = true;}, [id]);

  const messagingBlocked = Boolean(state.data?.blockedByMe || state.data?.blockedByOther);

  const send = async () => {
    const body = draft.trim();
    if (!body || sendingLock.current || messagingBlocked) return;
    sendingLock.current = true;
    setSendError(null);
    setSending(true);
    try {
      const msg = await api.sendMessage(id, body);
      setDraft("");
      nearBottom.current = true;
      setSent((messages) => mergeMessages(messages, [msg]));
    } catch (e) {
      setSendError(e.message);
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  const submitReport = async (reason) => {
    if (moderating) return;
    setModerating("report");
    try {
      await moderationApi.reportThread(id, reason);
      Alert.alert("Report received", "Thank you. Our team can now review this conversation.");
    } catch (e) {
      Alert.alert("Could not send report", e.message ?? "Please try again.");
    } finally {
      setModerating(null);
    }
  };

  const reportConversation = () => {
    Alert.alert("Report conversation", "Choose the reason that best describes the problem.", [
      { text: "Cancel", style: "cancel" },
      { text: "Spam", onPress: () => submitReport("SPAM") },
      { text: "Harassment", onPress: () => submitReport("HARASSMENT") },
      { text: "Inappropriate content", onPress: () => submitReport("INAPPROPRIATE") },
      { text: "Other", onPress: () => submitReport("OTHER") },
    ]);
  };

  const toggleBlock = () => {
    if (state.data?.blockedByMe) {
      Alert.alert("Unblock user", `Allow ${state.data.otherName ?? "this user"} to contact you again?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            if (moderating) return;
            setModerating("block");
            try {
              await moderationApi.unblockThreadUser(id);
              await load();
            } catch (e) {
              Alert.alert("Could not unblock user", e.message ?? "Please try again.");
            } finally {
              setModerating(null);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert("Block user", `Block ${state.data?.otherName ?? "this user"}? They will no longer be able to message you or appear in player discovery.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          if (moderating) return;
          setModerating("block");
          try {
            await moderationApi.blockThreadUser(id);
            setDraft("");
            await load();
            Alert.alert("User blocked", "This user can no longer message you or appear in your player discovery.");
          } catch (e) {
            Alert.alert("Could not block user", e.message ?? "Please try again.");
          } finally {
            setModerating(null);
          }
        },
      },
    ]);
  };

  if (state.loading) return <Loading />;
  if (state.error && !state.data) return <ErrorMessage message={state.error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.mist }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}>

      <View style={styles.threadHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subject}>{tr("Om:") + " "}{state.data.subject}</Text>
          {!!state.data.otherName && <Text style={styles.otherName}>{state.data.otherName}</Text>}
        </View>
        <View style={styles.moderationActions}>
          <Button title="Report" variant="quiet" onPress={reportConversation} loading={moderating === "report"} />
          <Button
            title={state.data.blockedByMe ? "Unblock" : "Block"}
            variant={state.data.blockedByMe ? "quiet" : "dangerQuiet"}
            onPress={toggleBlock}
            loading={moderating === "block"} />
        </View>
      </View>
      {messagingBlocked &&
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedTitle}>{state.data.blockedByMe ? "You blocked this user" : "Messaging unavailable"}</Text>
          <Text style={styles.blockedText}>
            {state.data.blockedByMe
              ? "Messages are disabled. You can unblock this user at any time."
              : "You cannot send messages in this conversation."}
          </Text>
        </View>
      }
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
        onContentSizeChange={() => {if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false });}}
        ListEmptyComponent={
        <Text style={styles.empty}>{tr("Ingen beskeder endnu \u2014 skriv den f\xF8rste og aftal en tid.")}

        </Text>
        }
        renderItem={({ item }) =>
        <View style={item.mine ? styles.rowMine : styles.rowTheirs}>
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <Text style={item.mine ? styles.textMine : styles.textTheirs}>{item.body}</Text>
              <Text style={item.mine ? styles.timeMine : styles.timeTheirs}>
                {time(new Date(item.createdAt))}
              </Text>
            </View>
          </View>
        } />


      <View style={{ backgroundColor: colors.chalk, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: colors.border }}><View style={styles.composer}>
        <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={messagingBlocked ? "Messaging is unavailable" : tr("Skriv en besked\u2026")}
            accessibilityLabel={tr("Besked")}
            editable={!sending && !messagingBlocked}
            multiline
            maxLength={2000} />

        <Button title={tr("Send")} onPress={send} loading={sending} disabled={!draft.trim() || messagingBlocked} />
      </View></View>
    </KeyboardAvoidingView>);

}

const styles = StyleSheet.create({
  threadHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  subject: {
    color: colors.slate,
    fontSize: 13,
  },
  otherName: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 3 },
  moderationActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 4 },
  blockedBanner: { backgroundColor: "#FFF4F1", borderBottomWidth: 1, borderBottomColor: "#E9C9C1", paddingHorizontal: 16, paddingVertical: 10 },
  blockedTitle: { color: "#7E2727", fontWeight: "800", fontSize: 14 },
  blockedText: { color: "#7E4A4A", marginTop: 2, fontSize: 13, lineHeight: 18 },
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
    width: "100%", maxWidth: 960, alignSelf: "center"
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
    minHeight: 48
  }
});
