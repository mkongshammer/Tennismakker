// Isolated component regressions: no real accounts, messages, bookings or hardware.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('@babel/core');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function loadSource(relative, mocks) {
  const filename = path.resolve(__dirname, relative);
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return name.endsWith("/ui")?{Button:"Button",...mocks[name]}:mocks[name];
    if (name.endsWith('/international')) return {tr:x=>x,useInternational:()=>({country:'DK',locale:'da',t:x=>x}),money:(n,c='DKK')=>`${n} ${c}`};
    if (name.endsWith('/PreferencesPicker')) return {PreferencesPicker:'PreferencesPicker'};
    if (name.endsWith('/ProfilePreferences')) return {ProfilePreferences:'ProfilePreferences'};
    if (name === 'react') return React;
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function hookHarness() {
  const listeners = new Set();
  const Focus = React.createContext(true);
  const useFocusEffect = callback => {
    const focused = React.useContext(Focus);
    React.useEffect(() => focused ? callback() : undefined, [focused, callback]);
  };
  const { useScreenData } = loadSource('./useScreenData.js', {
    'react-native': { AppState: { currentState: 'active', addEventListener(_event, listener) { listeners.add(listener); return { remove() { listeners.delete(listener); } }; } } },
    '@react-navigation/native': { useFocusEffect },
  });
  let state;
  function Probe({ fetcher }) { state = useScreenData(fetcher); return null; }
  return { Probe, Focus, listeners, get state() { return state; } };
}
test('a failed refresh preserves existing bookings and provides retry', async () => {
  const h = hookHarness(); let fail = false; let tree;
  const fetcher = async () => { if (fail) throw new Error('Offline'); return { bookings: ['booking-1'] }; };
  await act(async () => { tree = create(React.createElement(h.Probe, { fetcher })); });
  assert.deepEqual(h.state.data.bookings, ['booking-1']);
  fail = true;
  await act(() => h.state.refresh());
  assert.equal(h.state.error, 'Offline');
  assert.deepEqual(h.state.data.bookings, ['booking-1']);
  fail = false;
  await act(() => h.state.refresh());
  assert.equal(h.state.error, null);
  await act(() => tree.unmount());
  assert.equal(h.listeners.size, 0);
});
test('a slow previous sport cannot replace the selected sport', async () => {
  const h = hookHarness(); const old = deferred(); let tree;
  await act(async () => { tree = create(React.createElement(h.Probe, { fetcher: () => old.promise })); });
  await act(async () => tree.update(React.createElement(h.Probe, { fetcher: async () => ({ sport: 'PADEL' }) })));
  await act(async () => old.resolve({ sport: 'TENNIS' }));
  assert.equal(h.state.data.sport, 'PADEL');
  await act(() => tree.unmount());
});
test('returning to the app refreshes; blurred screens stop observing app state', async () => {
  const h = hookHarness(); let calls = 0; let tree;
  const fetcher = async () => ({ revision: ++calls });
  const render = focused => React.createElement(h.Focus.Provider, { value: focused }, React.createElement(h.Probe, { fetcher }));
  await act(async () => { tree = create(render(true)); });
  await act(async () => { h.listeners.forEach(listener => listener('active')); });
  assert.equal(h.state.data.revision, 2);
  await act(async () => tree.update(render(false)));
  assert.equal(h.listeners.size, 0);
  await act(() => tree.unmount());
});
test('coach requests never open a missing checkout URL and double taps create only one request', async () => {
  const pending = deferred(); const alerts = []; let requests = 0; let checkouts = 0; let tree;
  const data = { coach: { id: 'coach-1', name: 'Testtræner', priceHour: 500 }, packages: [], reviews: [], slots: ['2026-10-01T12:00:00Z'] };
  const { default: Coach } = loadSource('../screens/CoachScreen.js', {
    'react-native': { Linking: { openURL: async () => { checkouts++; } }, RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../lib/api': { api: { book: () => { requests++; return pending.promise; } }, checkoutUrl: () => { throw new Error('No checkout expected'); } },
    '../lib/feedback': { feedback: { alert: (...args) => alerts.push(args) } },
    '../lib/useScreenData': { useScreenData: () => ({ data, loading: false, refreshing: false, error: null, refresh: async () => {} }) },
    '../lib/ui': { Button: 'Button', Card: 'Card', Empty: 'Empty', ErrorMessage: 'ErrorMessage', Loading: 'Loading' },
    '../lib/BookingReview': { BookingReview: 'BookingReview' },
    '../lib/theme': { colors: {} },
    '../lib/dates': { dayLong: () => 'torsdag', time: () => '14:00', groupByDay: items => [{ date: items[0], items }] },
  });
  await act(async () => { tree = create(React.createElement(Coach, { route: { params: { id: 'coach-1' } } })); });
  await act(async () => tree.root.findByType('Button').props.onPress());
  assert.equal(requests, 0, 'selecting a time must not create a booking');
  await act(async () => tree.root.findByType('BookingReview').props.onClose());
  assert.equal(requests, 0, 'going back must not create a booking');
  await act(async () => tree.root.findByType('Button').props.onPress());
  const press = tree.root.findByType('BookingReview').props.onConfirm;
  let first;
  await act(async () => { first = press(); press(); });
  assert.equal(requests, 1);
  assert.equal(tree.root.findByType('Button').props.disabled, true);
  await act(async () => { pending.resolve({ id: 'booking-1', status: 'REQUESTED' }); await first; });
  assert.equal(checkouts, 0);
  assert.equal(tree.root.findAllByType('BookingReview').length, 0);
  assert.equal(alerts[0][0], 'Anmodning sendt');
  assert.equal(tree.root.findByType('Button').props.disabled, false);
  await act(() => tree.unmount());
});

test('court selection shows exact details; back does not book and confirmation is single-flight', async () => {
  let requests = 0; const pending = deferred(); const opened = []; let tree;
  const slot = { courtId: 'court-1', courtName: 'Bane 1', startsAt: '2026-10-01T12:00:00Z', endsAt: '2026-10-01T13:00:00Z', priceKr: 240 };
  const { default: Club } = loadSource('../screens/ClubScreen.js', {
    'react-native': { Linking: { openURL: async url => opened.push(url) }, Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../lib/api': { api: { book: input => { requests++; assert.equal(input.courtId, slot.courtId); return pending.promise; } }, checkoutUrl: value => value },
    '../lib/feedback': { feedback: { alert() {} } },
    '../lib/useScreenData': { useScreenData: () => ({ data: { club: { name: 'Testklub', color: '#ffffff', courts: [{ id: 'court-1' }] }, slots: [slot] }, refresh: async () => {} }) },
    '../lib/ui': { Empty: 'Empty', ErrorMessage: 'ErrorMessage', Loading: 'Loading' },
    '../lib/BookingReview': { BookingReview: 'BookingReview' },
    '../lib/contrast.mjs': { readableSurface: () => ({ backgroundColor: '#ffffff', color: '#000000' }) },
    '../lib/theme': { colors: {}, SURFACES: {}, sportColor: () => '#1B62C4' },
    '../lib/dates': { dayLong: () => 'torsdag 1. oktober', dayShort: () => 'torsdag', time: d => d.toISOString().slice(11, 16), groupByDay: items => [{ date: items[0].start, items }] },
  });
  await act(async () => { tree = create(React.createElement(Club, { route: { params: { slug: 'test' } } })); });
  const select = () => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel?.includes('Bane 1')).props.onPress();
  await act(async () => select());
  const review = () => tree.root.findByType('BookingReview');
  assert.equal(requests, 0);
  assert.equal(review().props.priceKr, 240);
  assert.deepEqual(review().props.details, ['Bane 1', 'torsdag 1. oktober', '12:00 – 13:00']);
  await act(async () => review().props.onClose());
  assert.equal(requests, 0);
  await act(async () => select());
  let first;
  await act(async () => { const confirm = review().props.onConfirm; first = confirm(); confirm(); });
  assert.equal(requests, 1);
  assert.equal(review().props.busy, true);
  await act(async () => { pending.resolve({ checkoutUrl: 'https://checkout.stripe.com/test' }); await first; });
  assert.deepEqual(opened, ['https://checkout.stripe.com/test']);
  assert.equal(tree.root.findAllByType('BookingReview').length, 0);
  await act(() => tree.unmount());
});

function doorProfile(booking, openDoor, alerts) {
  return loadSource('../screens/ProfileScreen.js', {
    'react-native': { Linking: {}, RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../lib/useScreenData': { useScreenData: () => ({ data: { bookings: [booking], repeatable: [] }, refresh: async () => {} }) },
    '../lib/feedback': { feedback: { alert: (...args) => alerts.push(args) } },
    '../lib/api': { api: { openDoor }, checkoutUrl: value => value },
    '../lib/auth': { useAuth: () => ({ user: { id: 'member', name: 'Test', level: 3 } }) },
    '../lib/PlayAgain': { PlayAgain: 'PlayAgain' },
    '../lib/ui': Object.fromEntries(['Avatar','Badge','Button','Card','ErrorMessage','Loading'].map(x => [x,x])),
    '../lib/theme': { colors: {}, LEVELS: {} },
    '../lib/dates': { dateTimeLong: d => d.toISOString() },
    '../lib/NotificationSettings': { NotificationSettings: 'NotificationSettings' },
  }).default;
}
function doorBooking() {
  return { id: 'booking', title: 'Bane 2', status: 'CONFIRMED', startsAt: new Date().toISOString(), priceKr: 100,
    access: { label: 'Indgang', availableFrom: new Date(Date.now()-60000).toISOString(), availableUntil: new Date(Date.now()+60000).toISOString() } };
}
test('door button sends once on double tap, shows loading and distinguishes command from physical opening', async () => {
  const pending=deferred(), alerts=[];let calls=0,tree;
  const Profile=doorProfile(doorBooking(),id=>{assert.equal(id,'booking');calls++;return pending.promise;},alerts);
  await act(async()=>{tree=create(React.createElement(Profile,{navigation:{}}));});
  try {
    const button=()=>tree.root.findAllByType('Button').find(n=>n.props.title==='Åbn Indgang');let first;
    await act(async()=>{const press=button().props.onPress;first=press();press();});
    assert.equal(calls,1);assert.equal(button().props.loading,true);assert.equal(button().props.disabled,true);
    await act(async()=>{pending.resolve({label:'Indgang',unlockSeconds:5});await first;});
    assert.equal(button().props.loading,false);assert.equal(button().props.disabled,false);
    assert.equal(alerts[0][0],'Døråbning sendt');assert.match(alerts[0][1],/5 sekunder/);assert.match(alerts[0][1],/Kontrollér at døren åbner/);
  } finally {await act(()=>tree.unmount());}
});
test('door button shows controller error and permits retry', async () => {
  const alerts=[];let calls=0,tree;
  const Profile=doorProfile(doorBooking(),async()=>{calls++;throw Error('Controller offline');},alerts);
  await act(async()=>{tree=create(React.createElement(Profile,{navigation:{}}));});
  try {
    const button=()=>tree.root.findAllByType('Button').find(n=>n.props.title==='Åbn Indgang');
    await act(()=>button().props.onPress());assert.deepEqual(alerts[0],['Kunne ikke åbne døren','Controller offline']);assert.equal(button().props.disabled,false);
    await act(()=>button().props.onPress());assert.equal(calls,2);
  } finally {await act(()=>tree.unmount());}
});
test('door button is absent before/after access window and for unconfirmed bookings', async () => {
  for(const scenario of ['before','after','cancelled','hold']) {
    const b=doorBooking();if(scenario==='before')b.access.availableFrom=new Date(Date.now()+60000).toISOString();
    if(scenario==='after')b.access.availableUntil=new Date(Date.now()-60000).toISOString();
    if(scenario==='cancelled')b.status='CANCELLED';if(scenario==='hold')b.status='HOLD';
    const Profile=doorProfile(b,()=>{throw Error('Must not send');},[]);let tree;
    await act(async()=>{tree=create(React.createElement(Profile,{navigation:{}}));});
    try{assert.equal(tree.root.findAllByType('Button').filter(n=>n.props.title==='Åbn Indgang').length,0,scenario);}finally{await act(()=>tree.unmount());}
  }
});

test('club login is a separate choice below login and submits in club-only mode', async () => {
  const logins=[];let tree;
  const {default:Login}=loadSource('../screens/LoginScreen.js',{
    'react-native':{KeyboardAvoidingView:'KeyboardAvoidingView',Platform:{OS:'ios'},useWindowDimensions:()=>({width:390}),ScrollView:'ScrollView',StyleSheet:{create:x=>x},Text:'Text',TextInput:'TextInput',View:'View',Pressable:'Pressable',Linking:{}},
    '../lib/auth':{useAuth:()=>({login:async(...args)=>logins.push(args),signup:async()=>{throw Error('Must not sign up a player');}})},
    '../lib/ui':{Button:'Button'},'../lib/theme':{colors:{}},'../lib/regions':{DK_REGIONS:[]},'../lib/CourtScene':{CourtScene:'CourtScene'},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
  });
  await act(async()=>{tree=create(React.createElement(Login));});
  try{
    assert.equal(tree.root.findAllByType('Button')[1].props.title,'Klublogin');
    await act(async()=>tree.root.findAllByType('Button')[1].props.onPress());
    assert.equal(tree.root.findAllByType('Button')[0].props.title,'Log ind på klubben');
    await act(async()=>{const inputs=tree.root.findAllByType('TextInput');inputs[0].props.onChangeText('ADMIN@example.invalid');inputs[1].props.onChangeText('test-password');});
    await act(()=>tree.root.findAllByType('Button')[0].props.onPress());
    assert.deepEqual(logins,[['admin@example.invalid','test-password',true]]);
    await act(async()=>tree.root.findAllByType('Button')[1].props.onPress());assert.equal(tree.root.findAllByType('Button')[0].props.title,'Log ind');
  }finally{await act(()=>tree.unmount());}
});

test('club search filters real names and cities, can clear, and preserves selected-club navigation', async () => {
  const navigations = []; let tree;
  const clubs = [
    { id: 'c1', slug: 'lyngby', name: 'Lyngby Tennis', city: 'Lyngby', courtCount: 4, priceHour: 100 },
    { id: 'c2', slug: 'valby', name: 'Valby Klub', city: 'København', courtCount: 3, priceHour: 120 },
  ];
  const {default:Clubs} = loadSource('../screens/ClubsScreen.js', {
    'react-native': { FlatList:'FlatList', Pressable:'Pressable', RefreshControl:'RefreshControl', StyleSheet:{create:x=>x}, Text:'Text', TextInput:'TextInput', View:'View' },
    '../lib/api': {api:{}},
    '../lib/ui': Object.fromEntries(['AppHeading','Card','Empty','ErrorMessage','Loading'].map(x=>[x,x])),
    '../lib/theme': {colors:{}, pageContent:{}, SPORT_LABELS:{TENNIS:'Tennis'},sportColor:()=> '#1B62C4'},
    '../lib/SportPicker': {SportPicker:'SportPicker',useSport:()=>['TENNIS',()=>{}]},
    '../lib/CourtGraphic': {CourtGraphic:'CourtGraphic'}, '../lib/CourtScene': {CourtScene:'CourtScene'},
    '../lib/useScreenData': {useScreenData:()=>({data:{clubs},loading:false,refreshing:false,refresh(){}})},
  });
  await act(async()=>{tree=create(React.createElement(Clubs,{navigation:{navigate:(...a)=>navigations.push(a)}}));});
  try {
    const list=()=>tree.root.findByType('FlatList');
    // FlatList renders its header; host mocks explicitly mount that supplied header.
    function ViewList() {return React.createElement(React.Fragment,null, list().props.ListHeaderComponent);}
    let header; await act(async()=>{header=create(React.createElement(ViewList));});
    const search=()=>header.root.findByType('TextInput');
    await act(async()=>search().props.onChangeText('KØBENHAVN'));
    assert.deepEqual(list().props.data.map(x=>x.id),['c2']);
    await act(async()=>header.update(React.createElement(ViewList)));
    const result=list().props.renderItem({item:list().props.data[0]});
    result.props.onPress();assert.deepEqual(navigations,[['Klub',{slug:'valby',name:'Valby Klub'}]]);
    await act(async()=>search().props.onChangeText('No match'));
    assert.deepEqual(list().props.data,[]);assert.equal(list().props.ListEmptyComponent.props.title,'Ingen klubber matcher');
    await act(async()=>list().props.ListEmptyComponent.props.onAction());
    assert.equal(list().props.data.length,2);
    await act(()=>header.unmount());
  }finally{await act(()=>tree.unmount());}
});

test('country and language persist without converting venue prices, and sport labels refresh', async () => {
  const storage = new Map();
  const actualDates = loadSource('./dates.js', {'../../../shared/international.mjs': require('../../../shared/international.mjs')});
  const international = loadSource('./international.js', {
    './dates.js': actualDates,
    '@react-native-async-storage/async-storage': {getItem: async key => storage.get(key), setItem: async (key,value) => storage.set(key,value)},
    '../../../shared/phrases.json': require('../../../shared/phrases.json'),
    '../../../shared/translations.json': require('../../../shared/translations.json'),
    '../../../shared/international.mjs': require('../../../shared/international.mjs'),
  });
  await international.setInternational({country:'US',locale:'en-US'});
  assert.match(international.money(80,'EUR'),/EUR\s*80/);
  assert.equal(international.tr('Log ind på klubben'),'Log in to your club');
  await international.setInternational({country:'ZZ',locale:'bad'});
  assert.deepEqual(international.getInternational(),{country:'US',locale:'en-US'});
  const {SportPicker} = loadSource('./SportPicker.js', {
    'react-native': {Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}},
    '@react-native-async-storage/async-storage': {setItem:async()=>{}},
    '@react-navigation/native': {},
    './theme': {colors:{},SPORTS:['BORDTENNIS'],SPORT_LABELS:{BORDTENNIS:'Bordtennis'},sportColor:()=>null},
    './international': international,
  });
  let tree;
  await act(async()=>{tree=create(React.createElement(SportPicker,{value:'BORDTENNIS',onChange:()=>{}}));});
  assert.equal(tree.root.findByType('Text').props.children,'Table tennis');
  await act(async()=>international.setInternational({locale:'da'}));
  assert.equal(tree.root.findByType('Text').props.children,'Bordtennis');
  await act(()=>tree.unmount());
  await international.restoreInternational();
  assert.deepEqual(international.getInternational(),{country:'US',locale:'da'});
});

test('mobile booking dates group by venue day and clock rather than device zone', () => {
  const dates=loadSource('./dates.js',{'../../../shared/international.mjs':require('../../../shared/international.mjs')});
  dates.setDateLocale('en-US');
  const instant=new Date('2027-01-04T01:00:00Z');
  assert.equal(dates.isoDay(instant,'America/Los_Angeles'),'2027-01-03');
  assert.equal(dates.time(instant,'America/Los_Angeles'),'17:00');
  const grouped=dates.groupByDay([instant,new Date('2027-01-04T07:00:00Z')],x=>x,'America/Los_Angeles');
  assert.equal(grouped.length,1);assert.match(dates.dayLong(instant,'America/Los_Angeles'),/Sunday/);
});
