import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        grus: { DEFAULT: "#B4491E", dark: "#933813", deep: "#8F3510" },
        bane: { DEFAULT: "#1E3D2F", dyb: "#142B21", lys: "#2C5743" },
        kridt: "#FAF7F0",
        net: "#171B19"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      }
    }
  },
  plugins: []
};
export default config;
