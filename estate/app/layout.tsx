import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NEPAWatch Estate — Power Management Dashboard',
  description: 'Real-time estate power management for Lagos gated communities',
  robots: 'noindex,nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
