import type { Config } from "tailwindcss";

// "Hard court" design tokens.
//
// The palette comes from a hard court under lights: a deep blue playing
// surface, cool grey-blue surroundings, chalk-white lines. Optic yellow is
// the ball and is used for one accent per screen — that restraint is what
// makes it read as an accent. Semantic colors (success/warning/danger/info)
// exist so status is never carried by brand colors alone.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F2138", // surfaces of authority: header, footer, dark sections
          deep: "#081527",
          soft: "#1B3554",
          mute: "#2A4466",
        },
        court: {
          DEFAULT: "#1B62C4", // primary action — the blue of the court
          dark: "#14509F",
          light: "#3B84E8",
          tint: "#E9F1FC",
        },
        optic: { DEFAULT: "#D8FF3E", dark: "#B8DB1F" }, // the ball. Sparingly.
        mist: { DEFAULT: "#F1F5F9", deep: "#E6ECF3" }, // page background
        chalk: "#FFFFFF", // lines and cards
        slate: {
          DEFAULT: "#54677E", // secondary text
          light: "#64768D", // 4.9:1 on white — small secondary text still passes AA
          line: "#D8E0EA",
        },
        success: { DEFAULT: "#15803D", soft: "#DCFCE7", ink: "#14532D" },
        warning: { DEFAULT: "#B45309", soft: "#FEF3C7", ink: "#78350F" },
        danger: { DEFAULT: "#B91C1C", soft: "#FEE2E2", ink: "#7F1D1D" },
        info: { DEFAULT: "#1B62C4", soft: "#E9F1FC", ink: "#14509F" },
        clay: "#B4541E",
        grass: "#2F7D4E",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Inter Tight", "system-ui", "sans-serif"],
        data: ["Martian Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        micro: ["12px", { lineHeight: "16px" }],
        small: ["14px", { lineHeight: "20px" }],
        body: ["16px", { lineHeight: "24px" }],
        title: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "display-md": ["28px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "display-lg": ["40px", { lineHeight: "44px", letterSpacing: "-0.025em" }],
        "display-xl": ["56px", { lineHeight: "60px", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        lg: "12px",
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,33,56,.06), 0 8px 24px -12px rgba(15,33,56,.18)",
        lift: "0 2px 4px rgba(15,33,56,.08), 0 16px 32px -12px rgba(15,33,56,.26)",
        pop: "0 20px 60px -20px rgba(15,33,56,.35)",
        tab: "0 -1px 0 rgba(15,33,56,.08)",
        ring: "0 0 0 4px rgba(27,98,196,.15)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "pop-in": { from: { opacity: "0", transform: "scale(.96)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-up": "fade-up 250ms cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "pop-in": "pop-in 200ms cubic-bezier(.2,.8,.2,1) both",
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
