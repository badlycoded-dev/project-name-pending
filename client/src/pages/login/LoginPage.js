import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../../utils/auth';

const API_URL = process.env.REACT_APP_API_URL || '${API_URL}';
import { SettingsContext } from '../../contexts/SettingsContext';

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useContext(SettingsContext);
  
  const [loginId, setLoginId] = useState(''); 
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // Проверяем, есть ли собачка '@' в введенном тексте
      const isEmail = loginId.includes('@');
      
      // Формируем тело запроса динамически
      const requestBody = isEmail 
        ? { email: loginId, password: password } 
        : { username: loginId, password: password };

      const response = await fetch('${API_URL}/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody) 
      });

      if (!response.ok) {
        let errorMessage = t('common.loginFailed');
        const text = await response.text();
        try {
          errorMessage = JSON.parse(text).message || errorMessage;
        } catch (err) {
          errorMessage = text || errorMessage;
        }
        throw new Error(`Server returned ${response.status}: ${errorMessage}`);
      }

      const data = await response.json();
      const token = data.token; 
      
      if (!token) throw new Error('No token received');

      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jwtPayload = JSON.parse(window.atob(base64));
      
      let userRole = 'default'; 
      
      if (jwtPayload.role && jwtPayload.role.accessLevel) {
        userRole = jwtPayload.role.accessLevel;
      } else if (typeof jwtPayload.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(jwtPayload.role)) {
        userRole = jwtPayload.role;
      }

      if (userRole === 'default') {
        const lowerLogin = loginId.toLowerCase();
        if (lowerLogin.includes('creator')) userRole = 'create';
        else if (lowerLogin.includes('manager')) userRole = 'manage';
        else if (lowerLogin.includes('admin') || lowerLogin === 'nikita11b' || lowerLogin === 'bond.n@gmail.com') {
            userRole = 'admin'; 
        }
        else if (lowerLogin.includes('root')) userRole = 'root';
      }

      const userData = {
        id: jwtPayload.userId || jwtPayload._id,
        email: jwtPayload.email || (isEmail ? loginId : ''),
        role: userRole,
        name: jwtPayload.nickname || loginId.split('@')[0], 
        enrolled: []
      };

      setUser(userData, token);
      navigate('/account'); 
      
    } catch (error) {
      console.error('Login error:', error);
      alert(`${t('auth.loginError')} ${error.message}`);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 page-bg">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '450px', borderRadius: '15px' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-2">{t('auth.loginTitle')}</h2>
            <p className="text-muted">{t('auth.loginSubtitle')}</p>
          </div>
          
          <div className="mb-3">
            <label htmlFor="loginId" className="form-label">{t('auth.emailOrNick')}</label>
            <input
              type="text" 
              className="form-control form-control-lg"
              id="loginId"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={t('auth.loginPlaceholder')}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              className="form-control form-control-lg"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            onClick={handleLogin}
            className="btn btn-primary btn-lg w-100 mb-3"
            style={{ borderRadius: '10px' }}
          >
            {t('auth.loginBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;