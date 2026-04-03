import { Navigate } from 'react-router-dom';
import { getUser } from '../utils/auth';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = getUser();

  // Если юзер не залогинен
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Если передан массив разрешенных ролей, и роли юзера в нем нет - на главную
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;