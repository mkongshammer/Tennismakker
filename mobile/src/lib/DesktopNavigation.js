import { tr, useInternational } from "./international";import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "./theme";
import { openProfile } from "./navigationRef";

export function DesktopNavigation({ state, descriptors, navigation }) {useInternational();
  return <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 232, backgroundColor: colors.ink, padding: 20 }}>
    <Text style={{ color: colors.chalk, fontSize: 25, fontWeight: "800", marginTop: 12, marginBottom: 8 }}>{"RacketBuddy"}<Text style={{ color: colors.optic }}>.</Text></Text>
    <Text style={{ color: "#BCCBDD", fontSize: 14, marginBottom: 36 }}>{tr("Mere tid p\xE5 banen.")}</Text>
    <View style={{ gap: 8 }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key].options;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, padding: 12, borderRadius: 12, backgroundColor: focused ? colors.court : pressed ? colors.inkSoft : "transparent" })}>
          {options.tabBarIcon?.({ focused, color: colors.chalk, size: 24 })}
          <Text style={{ color: colors.chalk, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>{options.title ?? route.name}</Text>
        </Pressable>;
      })}
    </View>
    <Pressable accessibilityRole="button" onPress={openProfile} style={{ marginTop: "auto", minHeight: 48, justifyContent: "center", padding: 12 }}>
      <Text style={{ color: colors.chalk, fontSize: 15 }}>{tr("Min profil")}</Text>
    </Pressable>
  </View>;
}
