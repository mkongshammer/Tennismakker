import {useEffect} from 'react';
import {AppState,Platform,Linking} from 'react-native';
import {useAuth} from './auth';
import {enablePush} from './push';
import {navigationRef} from './navigationRef';
let pending=null;
export function flushPushNavigation() { if(pending && navigationRef.isReady()) { const fn=pending;pending=null;fn(); } }
export function PushLifecycle() {
  const {user}=useAuth();
  useEffect(()=>{
    if(Platform.OS==='web' || !user)return;
    let disposed=false,subscription,appSubscription,readySubscription;
    const refresh=()=>enablePush(false).catch(()=>{});
    refresh();
    import('expo-notifications').then(async N=>{
      if(disposed)return;
      N.setNotificationHandler({handleNotification:async notification=>{
        const mine=notification.request.content.data?.recipientId===user.id;
        return {shouldShowBanner:mine,shouldShowList:mine,shouldPlaySound:mine,shouldSetBadge:false};
      }});
      const receive=response=>{
        const data=response?.notification?.request?.content?.data;
        if(disposed || data?.recipientId!==user.id)return;
        pending=()=>{
          if(disposed)return;
          if(data.screen==='thread' && typeof data.threadId==='string') navigationRef.navigate('MainTabs',{screen:'BeskederTab',params:{screen:'Samtale',params:{id:data.threadId}}});
          else if(data.screen==='coach') Linking.openURL('https://racketbuddy.app/profil/traener').catch(()=>{});
          else navigationRef.navigate('Profil');
        };
        flushPushNavigation();
        N.clearLastNotificationResponseAsync().catch(()=>{});
      };
      subscription=N.addNotificationResponseReceivedListener(receive);
      readySubscription=navigationRef.addListener('state',flushPushNavigation);
      receive(await N.getLastNotificationResponseAsync());
      if(disposed)return;
      appSubscription=AppState.addEventListener('change',state=>{if(state==='active'){refresh();flushPushNavigation();}});
    }).catch(()=>{});
    return ()=>{disposed=true;pending=null;subscription?.remove();appSubscription?.remove();readySubscription?.();import('expo-notifications').then(N=>N.setNotificationHandler(null)).catch(()=>{});};
  },[user?.id]);
  return null;
}
