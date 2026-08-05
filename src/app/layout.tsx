import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SwRegister } from '@/components/pwa/sw-register';

export const metadata: Metadata = {
  title: 'BISWIC Member Platform',
  description: 'Brothers in Service Welfare, Land & Investment Cooperative',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BISWIC',
    startupImage: '/icons/icon-512.png',
  },
  applicationName: 'BISWIC',
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'BISWIC',
    'msapplication-TileColor': '#0a3a5c',
    'msapplication-TileImage': '/icons/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a3a5c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
