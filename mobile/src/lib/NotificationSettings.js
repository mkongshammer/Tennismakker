import React, {useEffect,useState} from 'react';
import {Platform,Text,View,Switch,Linking} from 'react-native';
import {api} from './api';
import {enablePush,disablePush} from './push';
import {Button,Card} from './ui';
import {colors} from './theme';
const labels={bookings:'Bookinger og ændringer',reminders:'Påmindelser: dagen før og en time før',messages:'Nye beskeder',coaching:'Trænerforespørgsler og svar'};
export function NotificationSettings() {
  const [prefs,setPrefs]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{if(Platform.OS!=='web')api.pushPreferences().then(r=>setPrefs(r.preferences)).catch(e=>setMessage(e.message));},[]);
  if(Platform.OS==='web')return null;
  const run=async action=>{setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
  return <Card><Text style={{fontSize:20,fontWeight:'700',color:colors.ink}}>Notifikationer</Text>
    <Text style={{color:colors.slate,marginVertical:12}}>Vælg beskeder, der hjælper dig med dine aftaler. Ingen reklamer.</Text>
    {prefs && Object.entries(labels).map(([key,label])=><View key={key} style={{flexDirection:'row',alignItems:'center',minHeight:52,gap:12}}><Text style={{flex:1,color:colors.ink}}>{label}</Text><Switch accessibilityLabel={label} disabled={busy} value={prefs[key]} onValueChange={value=>run(async()=>{const next={...prefs,[key]:value};await api.savePushPreferences(next);setPrefs(next);})}/></View>)}
    <Button title="Aktivér på denne telefon" disabled={busy} onPress={()=>run(async()=>{await enablePush(true);setMessage('Telefonen er tilmeldt pushnotifikationer.');})}/>
    <Button title="Slå fra på denne telefon" disabled={busy} onPress={()=>run(async()=>{await disablePush();setMessage('Push er slået fra på denne telefon.');})}/>
    <Text onPress={()=>Linking.openSettings().catch(()=>{})} accessibilityRole="link" style={{color:colors.court,marginVertical:12}}>Åbn telefonens indstillinger</Text>
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </Card>;
}
