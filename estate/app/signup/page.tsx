'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, phone: form.phone } },
    })

    if (authErr) { setError(authErr.message); setLoading(false); return }
    if (!data.user) { setError('Signup failed, please try again.'); setLoading(false); return }

    router.push('/onboarding')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--green)" />
              <path d="M18 5L10 17h8l-2 10 10-12h-8L18 5z" fill="#0A0A0A" />
            </svg>
            <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.2rem' }}>
              NEPA<span style={{ color: 'var(--green)' }}>Watch</span> <span style={{ color: 'var(--text2)', fontWeight: 500, fontSize: '.95rem' }}>Estate</span>
            </span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '6px' }}>Start your free 30-day pilot today</p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Create your account</h2>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '22px' }}>You will set up your estate details in the next step.</p>

          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label className="field-label">Your Full Name</label><input type="text" placeholder="e.g. Chukwuemeka Obi" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div><label className="field-label">Work Email</label><input type="email" placeholder="manager@yourestate.com" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
            <div><label className="field-label">Phone Number</label><input type="tel" placeholder="+234 80X XXX XXXX" value={form.phone} onChange={e => set('phone', e.target.value)} required /></div>
            <div><label className="field-label">Password</label><input type="password" placeholder="Min 8 characters" value={form.password} onChange={e => set('password', e.target.value)} minLength={8} required /></div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
              {loading ? 'Creating account…' : 'Start Free Pilot'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '12px', color: 'var(--text3)' }}>By signing up you agree to our Terms of Service and Privacy Policy.</p>
          <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--text2)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
