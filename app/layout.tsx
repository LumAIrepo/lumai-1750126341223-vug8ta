```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/providers/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PumpClone - Solana Meme Token Launchpad',
  description: 'Launch and trade meme tokens on Solana with bonding curves and fair launches',
  keywords: ['solana', 'meme tokens', 'defi', 'bonding curve', 'fair launch', 'crypto'],
  authors: [{ name: 'PumpClone' }],
  creator: 'PumpClone',
  publisher: 'PumpClone',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://pumpclone.app'),
  openGraph: {
    title: 'PumpClone - Solana Meme Token Launchpad',
    description: 'Launch and trade meme tokens on Solana with bonding curves and fair launches',
    url: 'https://pumpclone.app',
    siteName: 'PumpClone',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PumpClone - Solana Meme Token Launchpad',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PumpClone - Solana Meme Token Launchpad',
    description: 'Launch and trade meme tokens on Solana with bonding curves and fair launches',
    images: ['/og-image.png'],
    creator: '@pumpclone',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PumpClone" />
        <meta name="application-name" content="PumpClone" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mainnet-beta.solana.com" />
        <link rel="dns-prefetch" href="https://solana-api.projectserum.com" />
      </head>
      <body className={`${inter.className} antialiased bg-black text-white min-h-screen overflow-x-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <WalletProvider>
            <div className="relative flex min-h-screen flex-col">
              <div className="flex-1">
                {children}
              </div>
            </div>
            <Toaster />
          </WalletProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
```