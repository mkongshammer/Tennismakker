import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./ui";
import { colors } from "./theme";

// Selection is local until the customer explicitly confirms. Scrolling and
// minimum (not fixed) heights leave room for large system text sizes.
export function BookingReview({ visible, title, details, priceKr, hint, action, busy, error, onConfirm, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.heading}>Tjek din tid</Text>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.details}>{details.map((detail, i) => <Text key={i} style={styles.detail}>{detail}</Text>)}</View>
          <View style={styles.total}>
            <Text style={styles.detail}>Pris i alt</Text>
            <Text style={styles.price}>{priceKr} kr</Text>
          </View>
          <Text style={styles.hint}>{hint}</Text>
          {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <Button title={action} loading={busy} onPress={onConfirm} />
          <Button title="Tilbage til tider" variant="ink" disabled={busy} onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chalk },
  content: { padding: 24, gap: 16, width: "100%", maxWidth: 600, alignSelf: "center", flexGrow: 1 },
  heading: { color: colors.ink, fontSize: 28, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  details: { gap: 8 },
  detail: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 20, gap: 6 },
  price: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  hint: { color: colors.slate, fontSize: 16, lineHeight: 24 },
  error: { color: "#9B2525", fontSize: 16, lineHeight: 24 },
});
