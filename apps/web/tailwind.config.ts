import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0a0a0f",
        "bg-surface": "#111118",
        "bg-elevated": "#1a1a28",
        "border-subtle": "#2a2a3a",
        "border-default": "#3a3a50",
        "ore-500": "#f5a623",
        "ore-700": "#7a4800",
        "ore-300": "#ffe066",
        "wars-500": "#e84040",
        "wars-700": "#7a0000",
        "eth-500": "#6b7cff",
        "eth-300": "#aab4ff",
        "agent-500": "#40e8d0",
        "agent-700": "#0a6b5f",
        "text-primary": "#e8e8f0",
        "text-secondary": "#8888aa",
        "text-muted": "#4a4a66",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
