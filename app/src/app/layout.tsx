import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NextAuthSessionProvider from '@/components/providers/SessionProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DeadLink Switchboard - Publisher Dashboard',
  description: 'Manage your links with automatic failover and analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
