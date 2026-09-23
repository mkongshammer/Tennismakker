import React,{useCallback,useEffect,useState,useRef} from 'react';
import {View,Linking,AppState} from 'react-native';
import {WebView} from 'react-native-webview';
import {api,checkoutUrl} from '../lib/api';
import {Loading,ErrorMessage} from '../lib/ui';
export default function AppPortal({route,destination='/admin'}) {
 const web=useRef(null);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state==='active')web.current?.reload();});return ()=>sub.remove();},[]);
 const target=route?.params?.destination??destination;
 const [url,setUrl]=useState(null),[error,setError]=useState(null);
 const load=useCallback(async()=>{setError(null);setUrl(null);try{setUrl(checkoutUrl((await api.appHandoff(target)).path));}catch(e){setError(e.message);}},[target]);
 useEffect(()=>{load();},[load]);
 if(error)return <ErrorMessage message={error} onRetry={load}/>;
 if(!url)return <Loading label="Åbner din klub…"/>;
 return <View style={{flex:1}}><WebView ref={web} key={url} onMessage={()=>{}} injectedJavaScript={`(function(){const s=document.createElement('style');s.textContent='body > header, body > footer, body > nav.fixed {display:none!important} main.has-tabbar {padding-bottom:24px!important}';document.head.appendChild(s);})();true;`} source={{uri:url}} incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} startInLoadingState renderLoading={()=><Loading/>} onError={()=>setError('Siden kunne ikke indlæses. Prøv igen.')} onHttpError={event=>{if(event.nativeEvent.statusCode>=400)setError('Adgangen er udløbet eller siden kunne ikke åbnes. Prøv igen.');}} onShouldStartLoadWithRequest={request=>{
  if(request.url==='about:blank')return true;
  try{const next=new URL(request.url),base=new URL(url);if(next.origin===base.origin)return true;if(next.protocol==='https:'){Linking.openURL(request.url).catch(()=>setError('Linket kunne ikke åbnes.'));}}catch{}return false;
 }}/></View>;
}
