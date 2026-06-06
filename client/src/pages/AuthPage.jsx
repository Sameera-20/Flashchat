import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.username.trim()) { setError('Username is required'); setLoading(false); return; }
        if (form.username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
        await register(form.username, form.email, form.password);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1>FlashChat</h1>
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: '.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          marginTop: '-.5rem',
          fontWeight: 400,
        }}>
          {tab === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to get started.'}
        </p>

        {/* Sign In / Sign Up tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>

          {tab === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="e.g. john_doe"
                value={form.username}
                onChange={update('username')}
                minLength={3}
                maxLength={20}
                autoComplete="username"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={tab === 'register' ? 'At least 6 characters' : 'Enter your password'}
              value={form.password}
              onChange={update('password')}
              minLength={6}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading
              ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
              : (tab === 'login' ? 'Sign In' : 'Create Account')
            }
          </button>
        </form>

        {/* Switch link */}
        <p style={{
          marginTop: '1.25rem',
          textAlign: 'center',
          fontSize: '.8125rem',
          color: 'var(--text-secondary)',
        }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontWeight: 600,
              fontSize: '.8125rem', fontFamily: 'var(--font)',
              textDecoration: 'underline',
            }}
          >
            {tab === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

      </div>
    </div>
  );
}