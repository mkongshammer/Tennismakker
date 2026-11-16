// "City or area" with suggestions, for the app.
//
// Typing two letters or more asks the website for real US cities ("Bos" →
// Boston, MA) and offers them right under the field, so nobody has to know
// that the state belongs there. Tapping one fills the field and searches.
// If the suggestions can't be fetched the field still works as plain text.
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { colors } from "./theme";
import { tr } from "./international";

/** Pure: should we even ask? Two letters or more, and not something already picked. */
export function shouldSuggest(text, lastPicked) {
  const q = String(text ?? "").trim();
  return q.length >= 2 && q !== String(lastPicked ?? "").trim();
}

export function PlaceField({
  value,
  onChangeText,
  onPick,
  placeholder,
  accessibilityLabel,
  style,
  inputStyle,
  onFocus,
  returnKeyType = "search",
  onSubmitEditing,
  onLayoutY,
  right = null,
}) {
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const picked = useRef("");

  useEffect(() => {
    if (!shouldSuggest(value, picked.current)) { setOptions([]); setOpen(false); return; }
    let live = true;
    const timer = setTimeout(() => {
      api.places(value.trim())
        .then((r) => { if (live) { setOptions(r.places ?? []); setOpen((r.places ?? []).length > 0); } })
        .catch(() => { if (live) { setOptions([]); setOpen(false); } });
    }, 180);
    return () => { live = false; clearTimeout(timer); };
  }, [value]);

  const choose = (label) => {
    picked.current = label;
    setOpen(false);
    setOptions([]);
    Keyboard.dismiss();
    onChangeText(label);
    if (onPick) onPick(label);
  };

  return (
    <View style={[styles.wrap, style]} onLayout={onLayoutY ? (e) => onLayoutY(e.nativeEvent.layout.y) : undefined}>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={accessibilityLabel ?? placeholder}
          placeholder={placeholder}
          placeholderTextColor={colors.slateLight}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          autoCorrect={false}
          autoCapitalize="words"
          maxLength={100}
          returnKeyType={returnKeyType}
          onSubmitEditing={() => { setOpen(false); if (onSubmitEditing) onSubmitEditing(); }}
          style={[styles.input, inputStyle]} />
        {right}
      </View>
      {open && options.length > 0 ? (
        <View style={styles.list}>
          {options.slice(0, 6).map((o) => (
            <Pressable
              key={o}
              accessibilityRole="button"
              accessibilityLabel={o}
              onPress={() => choose(o)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.courtTint }]}>
              <Text style={styles.optionText}>{o}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Luk")} onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.closeText}>{tr("Luk")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", zIndex: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
  list: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  option: { minHeight: 46, paddingHorizontal: 14, justifyContent: "center" },
  optionText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  close: { minHeight: 40, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.border },
  closeText: { color: colors.courtText, fontWeight: "700", fontSize: 13 },
});
