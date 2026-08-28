/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Web-udgaven af mobilappen ligger som statiske filer i public/app.
      // Denne rewrite gør, at /app viser appen i stedet for en 404.
      { source: "/app", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
