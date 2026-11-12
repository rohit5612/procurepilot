import { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { Eye, EyeOff, Loader2, Lock, Sparkles, User, ClipboardCopy } from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    id: 'manager',
    role: 'Manager (L3)',
    detail: 'AI Buy, procurement, PayPal checkout path',
    username: 'demo_manager',
    password: 'Test@2025!'
  },
  {
    id: 'viewer',
    role: 'Viewer (L5)',
    detail: 'Read-only demo user',
    username: 'demo_viewer',
    password: 'Test@2025!'
  }
];

const LIVE_DEMO_URL = 'https://procurepilot-01w3.onrender.com/login';

import { useAuth } from '../../contexts/AuthContext';

import AuthShell, { AuthFormCard } from './AuthShell';



export default function LoginForm() {

  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const [showPassword, setShowPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');



  const { login, error: authError, clearError, isAuthenticated } = useAuth();

  const navigate = useNavigate();



  useEffect(() => {

    if (isAuthenticated) navigate('/');

  }, [isAuthenticated, navigate]);



  useEffect(() => {

    if (authError) setError(authError);

  }, [authError]);



  const applyDemo = (account) => {
    setCredentials({ username: account.username, password: account.password });
    setError('');
    clearError();
  };

  const handleChange = (e) => {

    const { name, value } = e.target;

    setCredentials((prev) => ({ ...prev, [name]: value }));

    if (error || authError) {

      setError('');

      clearError();

    }

  };



  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    setError('');

    try {

      await login(credentials.username, credentials.password, rememberMe);

    } catch (err) {

      setError(err.message || 'Login failed. Please try again.');

    } finally {

      setLoading(false);

    }

  };



  return (

    <AuthShell

      badge="Policy-first purchasing"

      headline="From request to"

      headlineAccent="approved spend"

      description="Compare offers, enforce budgets and categories, route approvals, and pay with confidence — with AI explanations at every step."

      alternateLink={{ to: '/register', label: 'Request access →' }}

    >

      <AuthFormCard

        title="Welcome back"

        subtitle="Sign in with your workspace credentials"

        headerAction={

          <Link

            to="/register"

            className="hidden sm:inline-flex text-sm font-medium text-primary hover:text-primary/80 whitespace-nowrap"

          >

            Request access

          </Link>

        }

      >

        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-3 text-sm">
          <p className="font-medium text-fg">Hackathon / demo access</p>
          <p className="text-xs text-muted leading-relaxed">
            Try the hosted build at{' '}
            <a href={LIVE_DEMO_URL} className="text-primary underline font-medium">
              procurepilot-01w3.onrender.com
            </a>
            . Use one of the test accounts below (password for both: <code className="text-xs">Test@2025!</code>).
          </p>
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg text-xs">{account.role}</p>
                  <p className="text-[11px] text-muted">{account.detail}</p>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    {account.username} / {account.password}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-xs py-1.5 px-2 shrink-0 gap-1"
                  onClick={() => applyDemo(account)}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>

          <div>

            <label htmlFor="username" className="form-label text-fg">Username</label>

            <div className="relative">

              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden />

              <input

                id="username"

                name="username"

                type="text"

                required

                autoComplete="username"

                value={credentials.username}

                onChange={handleChange}

                className="input pl-10 bg-card py-2.5"

                placeholder="you@company.com"

              />

            </div>

          </div>



          <div>

            <div className="flex items-center justify-between gap-2 mb-1.5">

              <label htmlFor="password" className="form-label text-fg mb-0">Password</label>

            </div>

            <div className="relative">

              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden />

              <input

                id="password"

                name="password"

                type={showPassword ? 'text' : 'password'}

                required

                autoComplete="current-password"

                value={credentials.password}

                onChange={handleChange}

                className="input pl-10 pr-10 bg-card py-2.5"

                placeholder="Enter your password"

              />

              <button

                type="button"

                onClick={() => setShowPassword((v) => !v)}

                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring"

                aria-label={showPassword ? 'Hide password' : 'Show password'}

              >

                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}

              </button>

            </div>

          </div>



          <div className="flex items-center justify-between gap-3">

            <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer select-none">

              <input

                type="checkbox"

                checked={rememberMe}

                onChange={(e) => setRememberMe(e.target.checked)}

                className="rounded border-default text-primary focus:ring-primary h-4 w-4"

              />

              Remember me

            </label>

          </div>



          {error ? (

            <div

              role="alert"

              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive flex gap-2 items-start"

            >

              <span className="shrink-0 mt-0.5">!</span>

              <span>{error}</span>

            </div>

          ) : null}



          <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 text-sm font-semibold">

            {loading ? (

              <>

                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />

                Signing in…

              </>

            ) : (

              'Sign in'

            )}

          </button>



          <div className="relative py-1">

            <div className="absolute inset-0 flex items-center" aria-hidden>

              <div className="w-full border-t border-border" />

            </div>

            <div className="relative flex justify-center text-xs uppercase tracking-wider">

              <span className="bg-card px-2 text-muted">New to ProcurePilot?</span>

            </div>

          </div>



          <Link

            to="/register"

            className="btn btn-secondary w-full py-3 text-sm font-medium gap-2"

          >

            <Sparkles className="h-4 w-4 text-primary" aria-hidden />

            Request workspace access

          </Link>

        </form>

      </AuthFormCard>

    </AuthShell>

  );

}


