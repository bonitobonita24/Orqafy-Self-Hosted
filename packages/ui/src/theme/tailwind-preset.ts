// Tailwind preset binding the shadcn CSS variables (globals.css) to Tailwind
// color/radius/font tokens. Apps extend it: `presets: [orqafyPreset]`.
// Typed with a local minimal shape so this package needs no `tailwindcss` dep.

import { fonts } from './tokens';

interface TailwindThemeExtension {
  [key: string]: unknown;
}

interface TailwindPreset {
  darkMode?: string | string[];
  theme?: { extend?: TailwindThemeExtension };
}

const withOpacity = (variable: string) => `hsl(var(${variable}) / <alpha-value>)`;

export const orqafyPreset: TailwindPreset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        card: {
          DEFAULT: withOpacity('--card'),
          foreground: withOpacity('--card-foreground'),
        },
        muted: {
          DEFAULT: withOpacity('--muted'),
          foreground: withOpacity('--muted-foreground'),
        },
        border: withOpacity('--border'),
        input: withOpacity('--input'),
        primary: {
          DEFAULT: withOpacity('--primary'),
          foreground: withOpacity('--primary-foreground'),
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: withOpacity('--accent-foreground'),
        },
        destructive: {
          DEFAULT: withOpacity('--destructive'),
          foreground: withOpacity('--destructive-foreground'),
        },
        success: withOpacity('--success'),
        warning: withOpacity('--warning'),
        ring: withOpacity('--ring'),
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', fonts.sans],
        mono: ['var(--font-mono)', fonts.mono],
      },
    },
  },
};

export default orqafyPreset;
