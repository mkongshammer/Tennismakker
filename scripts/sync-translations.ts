/** Keep the native app's dictionary aligned with the website. */
import {writeFileSync} from 'node:fs';
import {T} from '../src/lib/i18n';
writeFileSync(new URL('../shared/translations.json',import.meta.url),JSON.stringify(T,null,2)+'\n');
