import { tr, useInternational } from "../lib/international";import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { api, checkoutUrl } from '../lib/api';
import { Button } from '../lib/ui';
export default function AppPortal({ route, destination = '/admin' }) {useInternational();
  const [error, setError] = useState(null),[busy, setBusy] = useState(false);
  const target = route?.params?.destination ?? destination;
  return <View style={{ padding: 24, gap: 16 }}><Text>{tr("\xC5bn") + " "}{target === '/admin' ? tr("klubadministrationen") : tr("din klubwallet")}{" " + tr("med dit nuv\xE6rende login.")}</Text><Button title={tr("\xC5bn")} loading={busy} onPress={async () => {setBusy(true);setError(null);try {const { path } = await api.appHandoff(target);await Linking.openURL(checkoutUrl(path));} catch (e) {setError(e.message);} finally {setBusy(false);}}} />{error && <Text>{tr(error)}</Text>}</View>;
}
