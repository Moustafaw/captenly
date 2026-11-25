import type { Config } from "tailwindcss";
import fs from "node:fs";
import path from "node:path";

// Design tokens extracted 1:1 from the reference screens (Screens/**/code.html → tailwind-config).
const screenTokensPath = path.resolve(process.cwd(), "src/screens/_tw.json");
const screenTokens = JSON.parse(fs.readFileSync(screenTokensPath, "utf-8"));

const fontVar = (families: string[]) =>
  families
    .map((f) => (f === "Cairo" ? "var(--font-cairo)" : f === "Inter" ? "var(--font-inter)" : f))
    .concat(["Cairo", "sans-serif"]);

const fontFamily: Record<string, string[]> = {
  cairo: ["var(--font-cairo)", "Cairo", "sans-serif"],
  inter: ["var(--font-inter)", "Inter", "sans-serif"],
};
for (const [k, v] of Object.entries((screenTokens.fontFamily || {}) as Record<string, string[]>)) {
  fontFamily[k] = fontVar(v);
}

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/screens/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ...(screenTokens.colors as Record<string, string>),
        captenly: {
          slate: "#0F172A",
          carbon: "#0B1220",
          volt: "#B0FE09",
          teal: "#1D6E7D",
          tealDark: "#155460",
          aqua: "#EAF4F8",
          mist: "#F7F9FA",
          ink: "#0F172A",
          olive: "#1D6E7D",
          lime: "#1D6E7D",
          tint: "#EAF4F8",
          soft: "#F1F7FA",
          surface: "#FFFFFF",
          alabaster: "#F7F9FA",
        },
      },
      fontFamily,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontSize: screenTokens.fontSize as any,
      spacing: screenTokens.spacing as Record<string, string>,
      borderRadius: screenTokens.borderRadius as Record<string, string>,
      boxShadow: {
        volt: "0 0 20px rgba(176, 254, 9, 0.25)",
        card: "0 4px 20px -2px rgba(44, 52, 55, 0.08)",
        floating: "0 12px 36px rgba(26, 31, 33, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;

