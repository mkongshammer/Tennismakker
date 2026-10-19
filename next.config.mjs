import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {'/*':['./data/ip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/dbip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/package.json']},
  // Legacy Danish routes → English routes. Permanent (308) so search engines,
  // shared booking links and old e-mails keep working and transfer their
  // ranking. Query strings are preserved by Next automatically.
  async redirects() {
    const legacy = [
      ["/book", "/courts"],
      ["/klubber", "/courts"],
      ["/traenere", "/coaches"],
      ["/traenere/:id", "/coaches/:id"],
      ["/spillere", "/players"],
      ["/makkere", "/matches"],
      ["/makkere/ny", "/matches/new"],
      ["/klub/:slug", "/clubs/:slug"],
      ["/klub/:slug/medlem", "/clubs/:slug/membership"],
      ["/opret-klub", "/list-your-club"],
      ["/profil", "/profile"],
      ["/profil/kvitteringer", "/profile/receipts"],
      ["/profil/traener", "/profile/coaching"],
      ["/profil/traener/opret", "/profile/coaching/new"],
      ["/profil/traener/billede", "/profile/coaching/photo"],
      ["/profil/traener/pakker", "/profile/coaching/packages"],
      ["/beskeder", "/messages"],
      ["/beskeder/:id", "/messages/:id"],
      ["/hjemmeside", "/website"],
      ["/privatliv", "/privacy"],
      ["/slet-konto", "/delete-account"],
      ["/vilkaar", "/terms"],
      ["/vilkaar/usa", "/terms/us"],
      ["/vilkaar/eu", "/terms/eu"],
      ["/vilkaar/international", "/terms/international"],
      ["/databehandleraftale", "/dpa"],
    ];
    return legacy.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async rewrites() {
    return [
      // Web-udgaven af appen ligger som statiske filer i public/app.
      { source: "/app", destination: "/app/index.html" },
    ];
  },
  webpack(config, { isServer }) {
    // Browsers get the English-only dictionary; the server keeps every
    // language for legacy pages, e-mails and receipts. See shared/dictionaries.mjs.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        [path.join(root, 'shared/dictionaries.mjs')]: path.join(root, 'shared/dictionaries.client.mjs'),
      };
    }
    return config;
  },
};

export default nextConfig;
