import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../../utils/auth';

const API_URL = process.env.REACT_APP_API_URL || '${API_URL}';
import { SettingsContext } from '../../contexts/SettingsContext';

function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useContext(SettingsContext);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert(t('auth.passwordsNotMatch'));
      return;
    }

    try {
      // 1. Отправляем данные на реальную регистрацию
      const regResponse = await fetch('${API_URL}/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          nickname: fullName || email.split('@')[0],
          login: email
        })
      });

      if (!regResponse.ok) {
        let errorMsg = t('auth.regFailed');
        const text = await regResponse.text(); 
        try {
          errorMsg = JSON.parse(text).message || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // 2. Регистрация прошла успешно! Теперь сразу делаем логин, чтобы получить ТОКЕН
      const loginResponse = await fetch('${API_URL}/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!loginResponse.ok) {
        throw new Error(t('auth.autoLoginFailed'));
      }

      const data = await loginResponse.json();
      const token = data.token;

      if (!token) throw new Error(t('auth.noToken'));

      // 3. Расшифровываем токен, чтобы достать данные юзера (id, email, роль)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jwtPayload = JSON.parse(window.atob(base64));

      const userData = {
        id: jwtPayload.userId || jwtPayload._id,
        email: jwtPayload.email || email,
        role: jwtPayload.role?.accessLevel || jwtPayload.role || 'user',
        name: fullName || email.split('@')[0],
        enrolled: []
      };

      // 4. Сохраняем настоящего юзера и НАСТОЯЩИЙ токен
      setUser(userData, token);
      
      alert(t('auth.regSuccess'));
      navigate('/search');

    } catch (error) {
      console.error('Registration error:', error);
      alert(`${t('auth.regError')} ${error.message}`);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 page-bg">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '450px', borderRadius: '15px' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <img 
              src="https://getbootstrap.com/docs/4.0/assets/brand/bootstrap-solid.svg" 
              alt="Logo" 
              width="80" 
              height="80"
              className="mb-3"
            />
            <h2 className="fw-bold mb-2">{t('auth.registerTitle')}</h2>
            <p className="text-muted">{t('auth.registerSubtitle')}</p>
          </div>

          <div>
            <div className="mb-3">
              <label htmlFor="nickName" className="form-label">{t('auth.nickName')}</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="nickName"
                placeholder={t('auth.nickName')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="signupEmail" className="form-label">{t('auth.email')}</label>
              <input
                type="email"
                className="form-control form-control-lg"
                id="signupEmail"
                placeholder={t('auth.enterYourEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="signupPassword" className="form-label">{t('auth.password')}</label>
              <input
                type="password"
                className="form-control form-control-lg"
                id="signupPassword"
                placeholder={t('auth.enterYourPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="confirmPassword" className="form-label">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                className="form-control form-control-lg"
                id="confirmPassword"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-check mb-4">
              <input
                className="form-check-input"
                type="checkbox"
                id="agreeTerms"
                required
              />
              <label className="form-check-label" htmlFor="agreeTerms">
                {t('auth.agreeTerms')}
              </label>
            </div>

            <button 
              onClick={handleSignUp}
              className="btn btn-primary btn-lg w-100 mb-3"
              style={{ borderRadius: '10px' }}
            >
              {t('auth.signUpBtn')}
            </button>

            <div className="text-center">
              <p className="mb-0">
                {t('auth.alreadyHaveAccount')} <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="text-decoration-none fw-bold">Login</a>
              </p>
            </div>
          </div>

          <div className="text-center mt-4">
            <p className="text-muted mb-3">{t('auth.orSignUpWith')}</p>
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-outline-secondary" style={{ borderRadius: '10px', width: '45%' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-google me-2" viewBox="0 0 16 16">
                  <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                </svg>
                Google
              </button>
              <button className="btn btn-outline-secondary" style={{ borderRadius: '10px', width: '45%' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-github me-2" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;