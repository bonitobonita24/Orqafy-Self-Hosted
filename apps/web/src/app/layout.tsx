import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { fontSans, fontMono } from '@/lib/fonts';
import './globals.css';

// Typeface: DESIGN.md sets IBM Plex Sans (UI) + JetBrains Mono (figures), self-hosted
// via next/font/local from vendored OFL woff2 (see src/lib/fonts.ts). The generated
// classes bind --font-sans / --font-mono on <html>, overriding the system-font
// fallbacks in @orqafy/ui/theme/globals.css — no external font request at runtime.
export const metadata: Metadata = {
  title: 'Orqafy',
  description: 'Self-hosted construction project management, file sync, and geofenced site tasks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
