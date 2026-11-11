import type { Config } from "tailwindcss";
import fs from "node:fs";
import path from "node:path";

// Design tokens extracted 1:1 from the reference screens (Screens/**/code.html → tailwind-config).
const screenTokensPath = path.resolve(process.cwd(), "src/screens/_tw.json");
const screenTokens = JSON.parse(fs.readFileSync(screenTokensPath, "utf-8"));

const fontVar = (families: string[]) =>
  families.map((f) => (f === "Cairo" ? "Cairo" : f === "Inter" ? "Inter" : f)).concat("sans-serif");

const fontFamily: Record<string, string[]> = {
  cairo: ["Cairo", "sans-serif"],
  inter: ["Inter", "sans-serif"],
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
          slate: "#2C3437",
          carbon: "#1A1F21",
          volt: "#B0FE09",
          olive: "#3F6212",
          lime: "#65A30D",
          tint: "#ECFCCB",
          soft: "#F7FEE7",
          surface: "#F8FAFC",
          alabaster: "#F4F5F2",
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

