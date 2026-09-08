import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';

// Typeface: DESIGN.md sets IBM Plex Sans (UI) + JetBrains Mono (figures). The
// family stacks are bound to --font-sans / --font-mono in @orqafy/ui/globals.css
// and fall back to the system UI font. Self-hosting the woff2 faces (next/font
// /local) is a Part-6 polish item so the production build stays network-free.
export const metadata: Metadata = {
  title: 'Orqafy',
  description: 'Self-hosted construction project management, file sync, and geofenced site tasks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
