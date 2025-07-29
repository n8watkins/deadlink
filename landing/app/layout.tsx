import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dead Links Switchboard - Turn Dead Links Into Revenue Streams',
  description: 'Automatically monetize broken links while improving user experience. Turn 404 errors into passive income with our AI-powered dead link solution.',
  keywords: 'dead links, broken links, 404 errors, link monetization, website revenue',
  openGraph: {
    title: 'Dead Links Switchboard - Turn Dead Links Into Revenue',
    description: 'Stop losing money to 404 errors. Start earning from every broken link on your site.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}