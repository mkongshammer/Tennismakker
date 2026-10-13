export const US_STATES = Object.freeze([
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
].map(([code,name])=>({code,name})));

const STATE_CODES = new Set(US_STATES.map(state=>state.code));

export function normalizeUSState(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function validUSState(value) {
  return STATE_CODES.has(normalizeUSState(value));
}

export function normalizeUSPostalCode(value) {
  return String(value ?? '').trim().replace(/\s+/g,'').slice(0,10);
}

export function validUSPostalCode(value) {
  return /^\d{5}(?:-\d{4})?$/.test(normalizeUSPostalCode(value));
}

export const US_STATE_TIME_ZONES = Object.freeze({
  AL:'America/Chicago', AK:'America/Anchorage', AZ:'America/Phoenix', AR:'America/Chicago',
  CA:'America/Los_Angeles', CO:'America/Denver', CT:'America/New_York', DE:'America/New_York', DC:'America/New_York',
  FL:'America/New_York', GA:'America/New_York', HI:'Pacific/Honolulu', ID:'America/Denver', IL:'America/Chicago',
  IN:'America/New_York', IA:'America/Chicago', KS:'America/Chicago', KY:'America/New_York', LA:'America/Chicago',
  ME:'America/New_York', MD:'America/New_York', MA:'America/New_York', MI:'America/New_York', MN:'America/Chicago',
  MS:'America/Chicago', MO:'America/Chicago', MT:'America/Denver', NE:'America/Chicago', NV:'America/Los_Angeles',
  NH:'America/New_York', NJ:'America/New_York', NM:'America/Denver', NY:'America/New_York', NC:'America/New_York',
  ND:'America/Chicago', OH:'America/New_York', OK:'America/Chicago', OR:'America/Los_Angeles', PA:'America/New_York',
  RI:'America/New_York', SC:'America/New_York', SD:'America/Chicago', TN:'America/Chicago', TX:'America/Chicago',
  UT:'America/Denver', VT:'America/New_York', VA:'America/New_York', WA:'America/Los_Angeles', WV:'America/New_York',
  WI:'America/Chicago', WY:'America/Denver',
});

export function usStateTimeZone(value) {
  return US_STATE_TIME_ZONES[normalizeUSState(value)] ?? 'America/New_York';
}

export function formatUSAddress(street, city, state, postalCode) {
  const line = String(street ?? '').trim();
  const place = String(city ?? '').trim();
  const region = normalizeUSState(state);
  const zip = normalizeUSPostalCode(postalCode);
  return [line, [place, region].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '')].filter(Boolean).join(', ');
}
