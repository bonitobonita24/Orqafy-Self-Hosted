import type { SVGProps } from 'react';
import { cn } from '@orqafy/ui';

/**
 * Orqafy product mark — "Rising Diagonal Leap" (ORQ-37, D-29, Concept A).
 *
 * Three orcas on a rising diagonal inside a self-contained rounded-square
 * badge: an amber leader (eye-patch detail) followed by two blue/white
 * followers. The dark badge background is baked into the artwork, so the
 * mark reads correctly on both light and dark surfaces without any theme
 * wiring — it is NOT theme-token-driven like the former monogram
 * placeholder, by design (a brand mark's colors are fixed, not themed).
 *
 * This is the ORQAFY PRODUCT mark (D-29): sidebar, login screen, favicon.
 * It must never appear near the "Developed by Powerbyte IT Solutions"
 * footer credit — that stays text-only per D-29.
 *
 * Server/Client-safe (no hooks, no client-only deps).
 */
export function OrcaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label="Orqafy"
      className={cn('shrink-0', className)}
      {...props}
    >
      <rect x="8" y="8" width="304" height="304" rx="56" fill="#0F1729" />
      {/* Follower 1 — rearmost, blue/white */}
      <g transform="translate(78,232) rotate(-14) scale(0.95)">
        <path
          d="M -52,10 C -24,-22 30,-26 52,-6 C 42,8 8,20 -20,20 C -36,20 -47,16 -52,10 Z"
          fill="#4C8CE6"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
        <path
          d="M 30,-12 Q 10,-16 2,-18 Q 10,-30 16,-50 Q 20,-28 30,-12 Z"
          fill="#4C8CE6"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
      </g>
      {/* Follower 2 — mid, white */}
      <g transform="translate(150,176) rotate(-17) scale(1.15)">
        <path
          d="M -52,10 C -24,-22 30,-26 52,-6 C 42,8 8,20 -20,20 C -36,20 -47,16 -52,10 Z"
          fill="#FFFFFF"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
        <path
          d="M 30,-12 Q 10,-16 2,-18 Q 10,-30 16,-50 Q 20,-28 30,-12 Z"
          fill="#FFFFFF"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
      </g>
      {/* Leader — frontmost, amber, with eye-patch detail */}
      <g transform="translate(228,108) rotate(-21) scale(1.4)">
        <path
          d="M -52,10 C -24,-22 30,-26 52,-6 C 42,8 8,20 -20,20 C -36,20 -47,16 -52,10 Z"
          fill="#F59F0A"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
        <path
          d="M 30,-12 Q 10,-16 2,-18 Q 10,-30 16,-50 Q 20,-28 30,-12 Z"
          fill="#F59F0A"
          stroke="#0F1729"
          strokeWidth={9}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
        <path
          d="M -4,-15 C -14,-11 -20,-2 -16,8 C -8,4 0,-4 4,-12 Z"
          fill="rgba(15,23,41,0.3)"
        />
      </g>
    </svg>
  );
}
