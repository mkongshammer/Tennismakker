/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Web-udgaven af appen ligger som statiske filer i public/app.
      { source: "/app", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
