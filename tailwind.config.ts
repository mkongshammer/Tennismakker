import type { Config } from "tailwindcss";

// Paletten kommer fra en hardcourt-bane under lys: dyb blå spilleflade,
// kølig grå-blå omgivelse, kridhvide linjer. Optic-gul er boldens farve og
// bruges kun ét sted ad gangen — det er det, der gør den til en accent.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F2138", // dybe flader: hoved, bundlinje, mørke kort
          deep: "#081527",
          soft: "#1B3554",
        },
        court: {
          DEFAULT: "#1B62C4", // primær handling — banens blå
          dark: "#14509F",
          light: "#3B84E8",
        },
        optic: "#D8FF3E", // bolden. Sparsomt.
        mist: "#F1F5F9", // sidens baggrund
        chalk: "#FFFFFF", // linjer og kort
        slate: {
          DEFAULT: "#54677E", // sekundær tekst
          light: "#8496AB",
        },
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Inter Tight", "system-ui", "sans-serif"],
        data: ["Martian Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,33,56,.06), 0 8px 24px -12px rgba(15,33,56,.18)",
        lift: "0 2px 4px rgba(15,33,56,.08), 0 16px 32px -12px rgba(15,33,56,.26)",
        tab: "0 -1px 0 rgba(15,33,56,.08)",
      },
    },
  },
  plugins: [],
};
export default config;
