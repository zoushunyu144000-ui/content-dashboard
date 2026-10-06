import type { Metadata } from 'next';
import localFont from 'next/font/local';
import ClientLayout from '@/components/ClientLayout';
import ThemeProvider from '@/components/ThemeProvider';
import ToastProvider from '@/components/ToastProvider';
import GlobalFeatures from '@/components/GlobalFeatures';
import { BRAND } from '@/lib/brand';
import './globals.css';

const geistHeading = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-heading',
  weight: '100 900',
  display: 'swap',
});

const geistBody = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-body',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name} 研究台`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistHeading.variable} ${geistBody.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-body antialiased">
        <ThemeProvider>
          <GlobalFeatures />
          <ToastProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
