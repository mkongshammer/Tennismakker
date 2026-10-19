import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {'/*':['./data/ip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/dbip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/package.json']},
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
