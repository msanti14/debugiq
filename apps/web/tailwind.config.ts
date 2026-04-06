import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "surface-0": "#0d0d0f",
        "surface-1": "#141418",
        "surface-2": "#1c1c22",
        "surface-3": "#232329",
        muted: "#6b7280",
        brand: {
          400: "#a78bfa",
          500: "#8b5cf6",
          900: "#2e1065",
        },
      },
    },
  },
  plugins: [],
};

export default config;
