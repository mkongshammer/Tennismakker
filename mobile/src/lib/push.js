import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
const KEY='rb_push_token';
async function unregister() {
  const token=await AsyncStorage.getItem(KEY);
  if(token) { await api.unregisterPush(token); await AsyncStorage.removeItem(KEY); }
}
async function register(ask=false) {
  if(Platform.OS==='web') return false;
  if(!ask && !await AsyncStorage.getItem(KEY)) return false;
  const Device=await import('expo-device');
  if(!Device.isDevice) { if(ask) throw Error('Push skal aktiveres på en fysisk telefon.'); return false; }
  const projectId=Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if(!projectId) { if(ask) throw Error('Push er endnu ikke konfigureret i denne app-build.'); return false; }
  const N=await import('expo-notifications');
  if(Platform.OS==='android') await N.setNotificationChannelAsync('racketbuddy',{name:'Bookinger og beskeder',importance:N.AndroidImportance.DEFAULT});
  let permission=await N.getPermissionsAsync();
  if(!permission.granted && ask) permission=await N.requestPermissionsAsync();
  if(!permission.granted) { await unregister(); if(ask) throw Error('Tillad notifikationer i telefonens indstillinger.'); return false; }
  const {data}=await N.getExpoPushTokenAsync({projectId});
  const old=await AsyncStorage.getItem(KEY);
  if(old && old!==data) await unregister();
  // Persist first so even an ambiguous network failure can be unregistered on logout.
  await AsyncStorage.setItem(KEY,data);
  await api.registerPush(data,Platform.OS);
  return true;
}

// Serialize registration/logout to prevent a late refresh re-enabling a logged-out device.
let queue=Promise.resolve();
function serialized(action) { const result=queue.then(action);queue=result.catch(()=>{});return result; }
export const enablePush=(ask=false)=>serialized(()=>register(ask));
export const disablePush=()=>serialized(unregister);
