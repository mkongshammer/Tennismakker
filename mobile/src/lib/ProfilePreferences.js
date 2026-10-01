import React,{useState} from 'react';
import {Text,TextInput,View,Pressable} from 'react-native';
import {useAuth} from './auth';
import {useInternational,tr} from './international';
import {PreferencesPicker} from './PreferencesPicker';
import {DK_REGIONS} from './regions';
import {Button,Card} from './ui';
import {colors} from './theme';
export function ProfilePreferences(){
 const {user,savePreferences}=useAuth(),{locale}=useInternational();
 const [value,setValue]=useState({country:user.country??'DK',locale:user.locale??locale,area:user.area??''}),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[error,setError]=useState(null);
 const save=async()=>{if(busy)return;setBusy(true);setError(null);setNotice(null);try{await savePreferences(value);setNotice(tr('Indstillinger gemt.'));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Card><Text style={{fontSize:18,fontWeight:'700',color:colors.ink,marginBottom:12}}>{tr('Sprog og land')}</Text><PreferencesPicker country={value.country} locale={value.locale} onChange={next=>{setValue({...next,area:next.country===value.country?value.area:''});setNotice(null);}}/>
 <Text style={{color:colors.slate,marginBottom:8}}>{tr('By / område')}</Text>
 {value.country==='DK'?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>{DK_REGIONS.map(region=><Pressable key={tr(region)} accessibilityRole="button" accessibilityState={{selected:value.area===region}} onPress={()=>setValue({...value,area:region})} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:region===value.area?colors.courtTint:colors.mist}}><Text>{tr(region)}</Text></Pressable>)}</View>:<TextInput accessibilityLabel={tr('By / område')} value={value.area} onChangeText={area=>setValue({...value,area})} maxLength={100} style={{minHeight:52,borderWidth:1,borderColor:colors.border,borderRadius:12,padding:12,marginBottom:12}}/>}
 <Button title={tr('Gem indstillinger')} onPress={save} loading={busy}/>{notice&&<Text accessibilityLiveRegion="polite" style={{marginTop:8}}>{tr(notice)}</Text>}{error&&<Text accessibilityRole="alert" style={{marginTop:8,color:colors.court}}>{tr(error)}</Text>}
 <Text style={{marginTop:12,lineHeight:21,color:colors.slate}}>{tr('Alle priser vises i klubbens eller trænerens valuta.')}</Text></Card>;
}
