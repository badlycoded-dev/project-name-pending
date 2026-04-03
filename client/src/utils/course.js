import { getUser } from './auth';

/**
 * submitCourse
 * payload is a plain object { title, repoUrl, description, tags, price, visibility }
 * POST /api/courses
 * Returns parsed JSON on success, throws Error on failure.
 */
export async function submitCourse(payload) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = getUser();
    if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
  } catch (e) {}

  const res = await fetch('/api/courses', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    throw new Error(body?.message || `Server error: ${res.status}`);
  }

  return res.json();
}
