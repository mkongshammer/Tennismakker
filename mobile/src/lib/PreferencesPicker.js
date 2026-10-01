import React,{useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from './ui';
import {colors} from './theme';
import {useInternational,MARKETS,LANGUAGES,LANGUAGE_NAMES,countryLabel,setInternational} from './international';
export function PreferencesPicker({country:controlledCountry,locale:controlledLocale,onChange}){
 const prefs=useInternational(),country=controlledCountry??prefs.country,locale=controlledLocale??prefs.locale,[field,setField]=useState(null);
 const choose=value=>{const next={country,locale,[field]:value};if(onChange)onChange(next);else setInternational(next);setField(null);};
 const options=field==='country'?MARKETS.map(m=>({id:m.code,label:countryLabel(m.code,locale)})):LANGUAGES.map(id=>({id,label:LANGUAGE_NAMES[id]}));
 return <View style={styles.wrap}>
 <Pressable accessibilityRole="button" accessibilityLabel={prefs.t('Vælg land')} onPress={()=>setField('country')} style={styles.choice}><Text style={styles.label}>{countryLabel(country,locale)} ▾</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel={prefs.t('Vælg sprog')} onPress={()=>setField('locale')} style={styles.choice}><Text style={styles.label}>{LANGUAGE_NAMES[locale]} ▾</Text></Pressable>
 <Modal visible={!!field} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setField(null)}><SafeAreaView style={{flex:1,backgroundColor:colors.chalk}}><ScrollView contentContainerStyle={{padding:24,gap:8}}><Text style={styles.title}>{prefs.t(field==='country'?'Vælg land':'Vælg sprog')}</Text>{options.map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:option.id===(field==='country'?country:locale)}} onPress={()=>choose(option.id)} style={[styles.option,option.id===(field==='country'?country:locale)&&{backgroundColor:colors.courtTint}]}><Text style={styles.label}>{option.label}</Text>{option.id===(field==='country'?country:locale)&&<Text>✓</Text>}</Pressable>)}<Button title={prefs.t('Luk')} variant="quiet" onPress={()=>setField(null)}/></ScrollView></SafeAreaView></Modal>
 </View>;
}
const styles=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},choice:{minHeight:48,borderRadius:14,paddingHorizontal:14,justifyContent:'center',borderWidth:1,borderColor:colors.border,backgroundColor:colors.chalk},label:{fontSize:14,fontWeight:'600',color:colors.ink},title:{fontSize:24,fontWeight:'800',color:colors.ink,marginBottom:16},option:{minHeight:52,padding:14,borderRadius:14,flexDirection:'row',justifyContent:'space-between'}});
