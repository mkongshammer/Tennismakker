// Full dictionaries for server rendering, scripts, tests and the Expo app.
// The browser bundle resolves this module to ./dictionaries.client.mjs
// (see next.config.mjs), which carries English only: the public web
// product is en-US, and shipping eight languages to every visitor cost
// roughly 250 kB of compressed JavaScript on every page.
import romance from './romance-translations.json' with {type:'json'};
import localized from './localized-phrases.json' with {type:'json'};
import english from './phrases.json' with {type:'json'};
import translations from './translations.json' with {type:'json'};
export {romance,localized,english,translations};
