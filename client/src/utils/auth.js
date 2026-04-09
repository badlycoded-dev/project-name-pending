export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch (e) {
    return null;
  }
}

export function setUser(user, token) {
  // Гарантируем наличие поля id/_id
  const idVal = user._id || user.id || user.email || ('u_' + Date.now());
  const normalized = { ...user, _id: idVal, id: idVal };
  localStorage.setItem('user', JSON.stringify(normalized));

  // Сохраняем токен, если он пришел от сервера
  if (token) {
    localStorage.setItem('token', token);
  } else if (!localStorage.getItem('token')) {
    // ВРЕМЕННАЯ ЗАГЛУШКА: если ты логинишься пока без бэкенда
    // выдаем фейковый токен, чтобы форма создания курса не падала
    localStorage.setItem('token', 'fake_test_token_for_frontend');
  }
}

export function promoteToTeacher() {
  const user = getUser();
  if (!user) throw new Error('No authenticated user');
  // Отмечаем пользователя как преподавателя для клиентских тестов. Реальная проверка делается на сервере.
  user.role = 'teacher';
  user.isTeacher = true;
  setUser(user);
  return user;
}

export function clearUser() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

export function isAuthenticated() {
  return !!getUser();
}
