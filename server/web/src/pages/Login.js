import { toHttps } from '../utils/utils';
import { useState } from 'react';
import { useTheme } from '../components/Layout';

const API = toHttps(process.env.REACT_APP_API_URL);

export default function Login({ onLogin }) {
  const { theme, toggle } = useTheme();
  const [form, setForm]     = useState({ login: '', password: '', memo: false });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [e.target.name]: v }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login || !form.password) { setError('Please fill in all fields'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const r1 = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.login, password: form.password })
      });
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({}));
        setError(d.message || 'Invalid email or password');
        return;
      }
      const { token, tokenType } = await r1.json();
      const fullToken = `${tokenType} ${token}`;

      // Always store the token — localStorage if "remember me", sessionStorage otherwise
      if (form.memo) {
        localStorage.setItem('token', fullToken);
      } else {
        sessionStorage.setItem('token', fullToken);
      }

      const r2 = await fetch(`${API}/users/c`, {
        headers: { Authorization: fullToken }
      });
      if (!r2.ok) { setError('Failed to load user profile'); return; }
      const { user } = await r2.json();
      onLogin(user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <button
        className="theme-toggle"
        onClick={toggle}
        title="Toggle theme"
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`} />
      </button>

      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', marginBottom: '.75rem' }}>🎓</div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Admin Panel</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', margin: '.25rem 0 0' }}>Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3" role="alert">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Email / Login</label>
            <div className="input-group">
              <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-muted)' }}>
                <i className="bi bi-envelope" />
              </span>
              <input type="text" className="form-control" name="login"
                value={form.login} onChange={handleChange}
                placeholder="your@email.com" autoComplete="username" />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-muted)' }}>
                <i className="bi bi-lock" />
              </span>
              <input type="password" className="form-control" name="password"
                value={form.password} onChange={handleChange}
                placeholder="••••••••" autoComplete="current-password" />
            </div>
          </div>

          <div className="mb-4 form-check">
            <input className="form-check-input" type="checkbox"
              id="memo" name="memo" checked={form.memo} onChange={handleChange} />
            <label className="form-check-label" htmlFor="memo">Remember me</label>
          </div>

          <button type="submit" className="btn btn-primary w-100 fw-semibold" disabled={loading}>
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2" />Signing in…</>
            ) : (
              <><i className="bi bi-box-arrow-in-right me-2" />Sign In</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}