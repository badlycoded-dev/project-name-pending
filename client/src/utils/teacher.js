import config from '../config/config';

const API_URL = config.API_URL;

/**
 * submitTeacherApplication
 * POST /forms/apply/tutor  (multipart/form-data)
 * Поля FormData:
 *   data       — JSON string { firstName, lastName, email, bio }
 *   skills     — JSON string массив skill объектов
 *   cert_N     — файлы сертификатов
 *   example_N  — файлы примеров работ
 */
export async function submitTeacherApplication(formData, formType = 'tutor') {
  const token = localStorage.getItem('token');

  const headers = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`;
  }
  // Content-Type НЕ устанавливаем — браузер сам выставит boundary для multipart

  const res = await fetch(`${API_URL}/forms/apply/${formType}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(body?.message || `Server error: ${res.status}`);
  }

  return res.json();
}