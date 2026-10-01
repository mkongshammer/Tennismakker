/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {'/*':['./data/ip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/dbip-country.mmdb','./node_modules/@ip-location-db/dbip-country-mmdb/package.json']},
  async rewrites() {
    return [
      // Web-udgaven af appen ligger som statiske filer i public/app.
      { source: "/app", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
