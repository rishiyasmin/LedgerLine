
import { useState } from 'react'
import {
  ShieldCheck,
  Wallet,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from 'lucide-react'
import axios from 'axios'
import Dashboard from './Dashboard'
import './App.css'

const API_URL = 'http://localhost:5000/api'

function App() {
  const [isRegister, setIsRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
  })

  // Restore an existing login session
const [user, setUser] = useState(() => {
  const token = localStorage.getItem('ledgerline_token')
  const savedUser = localStorage.getItem('ledgerline_user')

  if (token && savedUser) {
    try {
      return JSON.parse(savedUser)
    } catch {
      localStorage.removeItem('ledgerline_token')
      localStorage.removeItem('ledgerline_user')
    }
  }

  return null
})

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const endpoint = isRegister
        ? '/auth/register'
        : '/auth/login'

      const response = await axios.post(
        `${API_URL}${endpoint}`,
        form
      )

      if (isRegister) {
        setMessage('Registration successful! Please sign in.')
        setIsRegister(false)

        setForm({
          full_name: '',
          email: form.email,
          password: '',
        })
      } else {
        const { token, user: loggedInUser } = response.data

        if (!token || !loggedInUser) {
          throw new Error('Invalid login response from server.')
        }

        localStorage.setItem('ledgerline_token', token)
        localStorage.setItem(
          'ledgerline_user',
          JSON.stringify(loggedInUser)
        )

        setUser(loggedInUser)
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        error.message ||
        'Unable to connect to the server.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('ledgerline_token')
    localStorage.removeItem('ledgerline_user')
    setUser(null)
    setForm({
      full_name: '',
      email: '',
      password: '',
    })
    setMessage('')
  }

  // Show dashboard after successful login
  if (user) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <main className="auth-page">
      <section className="brand-panel">
        <div className="brand">
          <div className="brand-icon">
            <Wallet size={25} />
          </div>
          <span>
            Ledger<span className="brand-accent">Line</span>
          </span>
        </div>

        <div className="brand-content">
          <span className="eyebrow">
            SECURE MONEY MOVEMENT
          </span>

          <h1>
            Your money.
            <br />
            Your control.
            <br />
            <span>Your confidence.</span>
          </h1>

          <p>
            Experience secure, transparent and reliable
            digital money movement with LedgerLine.
          </p>

          <div className="security-note">
            <ShieldCheck size={21} />
            <div>
              <strong>Security comes first</strong>
              <small>
                Protected access and reliable transaction processing.
              </small>
            </div>
          </div>
        </div>

        <div className="brand-footer">
          © 2026 LedgerLine. Secure financial operations.
        </div>
      </section>

      <section className="form-panel">
        <div className="mobile-brand">
          <Wallet size={24} />
          Ledger<span>Line</span>
        </div>

        <div className="auth-card">
          <div className="card-heading">
            <span className="welcome-label">
              {isRegister
                ? 'CREATE YOUR ACCOUNT'
                : 'WELCOME TO LEDGERLINE'}
            </span>

            <h2>
              {isRegister
                ? 'Create an account'
                : 'Welcome back'}
            </h2>

            <p>
              {isRegister
                ? 'Enter your details to get started.'
                : 'Sign in to access your secure account.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <label className="input-group">
                <span>Full name</span>
                <div className="input-wrap">
                  <User size={18} />
                  <input
                    name="full_name"
                    placeholder="Enter your full name"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </label>
            )}

            <label className="input-group">
              <span>Email address</span>
              <div className="input-wrap">
                <Mail size={18} />
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </label>

            <label className="input-group">
              <span>Password</span>
              <div className="input-wrap">
                <Lock size={18} />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label="Toggle password visibility"
                >
                  {showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              className="submit-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {message && (
            <div className="form-message" role="status">
              {message}
            </div>
          )}

          <div className="switch-auth">
            {isRegister
              ? 'Already have an account?'
              : "Don't have an account?"}

            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setMessage('')
              }}
            >
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <div className="secure-caption">
            <ShieldCheck size={15} />
            Your connection is protected by secure authentication.
          </div>
        </div>
      </section>
    </main>
  )
}

export default App