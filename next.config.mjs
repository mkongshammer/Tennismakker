/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next henter og indlejrer normalt Google Fonts ved bygning. Det gør et
  // deploy afhængigt af, at fonts.googleapis.com svarer i byggeøjeblikket.
  // Vi henter dem i stedet i browseren, så et fejlende font-CDN højst
  // koster et skifte af skrifttype — aldrig et mislykket deploy.
  optimizeFonts: false,

  async rewrites() {
    return [
      // Web-udgaven af appen ligger som statiske filer i public/app.
      { source: "/app", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
