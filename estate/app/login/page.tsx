'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message.includes('Invalid') ? 'Incorrect email or password.' : error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--green)" />
              <path d="M18 5L10 17h8l-2 10 10-12h-8L18 5z" fill="#0A0A0A" strokeWidth="0" />
            </svg>
            <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.3rem' }}>
              NEPA<span style={{ color: 'var(--green)' }}>Watch</span>{' '}
              <span style={{ color: 'var(--text2)', fontWeight: 500, fontSize: '1rem' }}>Estate</span>
            </span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '8px' }}>Power management for Lagos estate managers</p>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Welcome back</h2>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Sign in to your estate dashboard</p>

          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="field-label">Email Address</label>
              <input type="email" placeholder="manager@estate.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
              {loading ? 'Signing in…' : 'Sign In to Dashboard'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text2)' }}>
            No account?{' '}
            <Link href="/signup" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>Start free 30-day pilot</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text3)' }}>
          Free 30-day pilot · No credit card required · NGN 200k–500k/mo after pilot
        </p>
      </div>
    </div>
  )
}
