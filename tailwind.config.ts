import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0b1f3a",
          800: "#123056",
          700: "#1a3f6d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
