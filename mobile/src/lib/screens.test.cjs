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
    if (name in mocks) return mocks[name];
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
    '../lib/ui': Object.fromEntries(['Badge','Button','Card','ErrorMessage','Loading'].map(x => [x,x])),
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
