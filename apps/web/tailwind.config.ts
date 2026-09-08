import type { Config } from 'tailwindcss';
import { orqafyPreset } from '@orqafy/ui/theme';

// Orqafy tokens (DESIGN.md §2–§3 / D-23) come from the shared preset. Content
// globs cover the app AND the @orqafy/ui source so themed component classes are
// not tree-shaken out of the build.
const config: Config = {
  presets: [orqafyPreset as unknown as Config],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
