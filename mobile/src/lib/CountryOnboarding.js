import React,{useEffect,useState} from 'react';
import {Modal,View,Text,ScrollView,Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth} from './auth';
import {api} from './api';
import {useInternational,getInternational,setInternational,marketFor} from './international';
import {PreferencesPicker} from './PreferencesPicker';
import {Button} from './ui';
import {colors} from './theme';
import {translatePhrase} from '../../../shared/phrase-translation.mjs';
export function CountryOnboarding(){
 const {user,loading,saveLocation}=useAuth(),prefs=useInternational();
 const [choice,setChoice]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null);
 const t=value=>translatePhrase(value,choice?.locale??prefs.locale);
 useEffect(()=>{
  if(loading||getInternational().countryChosen)return;
  let cancelled=false;
  const commit=async value=>{if(user)await saveLocation(value);await setInternational({...value,countryChosen:true});};
  void api.location().then(async detection=>{
   if(cancelled||getInternational().countryChosen)return;
   const current=getInternational(),country=detection.country??detection.suggestedCountry??current.country;
   const next={country,locale:current.languageChosen?current.locale:detection.country?marketFor(country).defaultLocale:current.locale};
   if(!detection.needsChoice&&detection.country){try{await commit(next);}catch{if(!cancelled)setChoice(next);}}
   else setChoice(next);
  }).catch(()=>{if(!cancelled&&!getInternational().countryChosen)setChoice(getInternational());});
  return()=>{cancelled=true;};
 },[loading,user?.id]);
 const choose=async value=>{setBusy(true);setError(null);try{if(user)await saveLocation(value);await setInternational({...value,countryChosen:true,languageChosen:true});setChoice(null);}catch(e){setError(prefs.t('Valget kunne ikke gemmes. Prøv igen.'));}finally{setBusy(false);}};
 return <Modal visible={!!choice} transparent animationType="fade" onRequestClose={()=>{if(!busy)choose(getInternational());}}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#0f213899'}}><SafeAreaView style={{width:'100%',maxWidth:460,alignSelf:'center',backgroundColor:colors.chalk,borderRadius:24,maxHeight:'90%'}}><ScrollView contentContainerStyle={{padding:24,gap:16}}>
  <Text style={{color:colors.court,fontWeight:'800'}}>RacketBuddy</Text><Text accessibilityRole="header" style={{fontSize:26,fontWeight:'800',color:colors.ink}}>{t('Hvor spiller du?')}</Text>
  <Text style={{fontSize:15,lineHeight:22,color:colors.slate}}>{t('Vi kunne ikke bestemme dit land sikkert. Vælg land og sprog, så viser vi de relevante klubber. Du kan altid ændre valget.')}</Text>
  {choice&&<PreferencesPicker country={choice.country} locale={choice.locale} onChange={setChoice}/>}
  <Button title={t('Fortsæt')} loading={busy} onPress={()=>choose(choice)}/><Button title={t('Ikke nu')} variant="quiet" disabled={busy} onPress={()=>choose(getInternational())}/>
  {error&&<Text accessibilityRole="alert">{error}</Text>}
  <Text style={{fontSize:11,color:colors.slate,textAlign:'center'}} onPress={()=>Linking.openURL('https://db-ip.com')}>IP Geolocation by DB-IP</Text>
 </ScrollView></SafeAreaView></View></Modal>;
}
