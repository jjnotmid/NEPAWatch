'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '⚡' },
  { href: '/residents', label: 'Residents', icon: '👥' },
  { href: '/alerts', label: 'Alerts', icon: '📢' },
  { href: '/reports', label: 'Reports', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

interface Props {
  estateName?: string
  children: React.ReactNode
}

export default function AppShell({ estateName, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0 }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="var(--green)" /><path d="M18 5L10 17h8l-2 10 10-12h-8L18 5z" fill="#0A0A0A" /></svg>
            <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text1)' }}>
              NEPA<span style={{ color: 'var(--green)' }}>Watch</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', textDecoration: 'none', fontSize: '13px', fontWeight: active ? 600 : 400,
                  color: active ? 'var(--green)' : 'var(--text2)', background: active ? 'var(--green-dim)' : 'transparent', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '12px' }}>{icon}</span>
                  <span className="nav-label">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {estateName && <span style={{ color: 'var(--text3)', fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{estateName}</span>}
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '24px 20px 48px' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 600px) {
          .nav-label { display: none; }
        }
      `}</style>
    </div>
  )
}
