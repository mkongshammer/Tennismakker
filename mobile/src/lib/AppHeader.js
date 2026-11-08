// Our own top bar for the tab screens. The native iOS header wraps every
// header button in a glass ring; here the profile shortcut is just the
// initials, as the owner asked, with the screen title in the middle and a
// back button on screens further in.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileButton } from "./ProfileButton";
import { colors } from "./theme";
import { tr, useInternational } from "./international";

export function AppHeader({ navigation, options, route, back }) {
  useInternational();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === "string" ? options.title : route.name;
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Tilbage")} hitSlop={12} onPress={navigation.goBack} style={styles.back}>
              <Text style={styles.chevron}>‹</Text>
              <Text style={styles.backText} numberOfLines={1}>{back.title ?? tr("Tilbage")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={[styles.side, { alignItems: "flex-end" }]}><ProfileButton /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface },
  row: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  side: { width: 96, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "700", fontSize: 17 },
  back: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  chevron: { color: colors.courtText, fontSize: 30, lineHeight: 32, marginTop: -3 },
  backText: { color: colors.courtText, fontSize: 16, fontWeight: "600", flexShrink: 1 },
});
