import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BISWIC Member Platform',
  description: 'Brothers in Service Welfare, Land & Investment Cooperative',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BISWIC',
  },
  applicationName: 'BISWIC',
  formatDetection: { telephone: false },
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
        {children}
      </body>
    </html>
  );
}
