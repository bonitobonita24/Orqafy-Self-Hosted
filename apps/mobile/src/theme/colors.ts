// RN theme adapter — consumes the fleet design-token VALUES from `@orqafy/ui/theme`
// (Rule 13: theme token VALUES only — NEVER `@orqafy/ui` components). React Native
// cannot read CSS variables, so each HSL triple ("H S% L%") is converted to an
// RN-parsable comma-form `hsl(H, S%, L%)` string at module load. Pure module: no
// React Native imports (types only), safe to unit-test.
import { lightColors, darkColors, type ColorTokens } from '@orqafy/ui/theme';

/** "215 70% 42%" -> "hsl(215, 70%, 42%)" (RN's color parser expects comma form). */
function toRnHsl(triple: string): string {
  return `hsl(${triple.trim().split(/\s+/).join(', ')})`;
}

/** Every design token, mapped to an RN-usable color string. */
export type ThemeColors = { [K in keyof ColorTokens]: string };

function adapt(source: ColorTokens): ThemeColors {
  const out = {} as ThemeColors;
  for (const key of Object.keys(source) as Array<keyof ColorTokens>) {
    out[key] = toRnHsl(source[key]);
  }
  return out;
}

export const lightThemeColors: ThemeColors = adapt(lightColors);
export const darkThemeColors: ThemeColors = adapt(darkColors);

/**
 * Default palette (light). Screens read from here; dark-scheme wiring
 * (`useColorScheme()` -> darkThemeColors) lands with the theming chunk.
 */
export const colors: ThemeColors = lightThemeColors;
