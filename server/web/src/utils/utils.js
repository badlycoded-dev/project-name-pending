import { useCallback, useEffect, useRef } from 'react';

/**
 * Converts any URL to use https:// only if USE_HTTPS flag is enabled.
 * Can be controlled via environment variable REACT_APP_USE_HTTPS.
 * Works for both localhost (self-signed cert) and production domains.
 * 
 * @param {string} url - The URL to potentially convert
 * @returns {string} - URL as-is if HTTP, or converted to HTTPS if flag enabled
 */
export const toHttps = (url) => {
  if (!url) return url;
  const useHttps = process.env.REACT_APP_USE_HTTPS === 'true';
  if (!useHttps) return url;
  // Swap protocol and HTTP port → HTTPS port
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/:4040(\/|$)/, ':4043$1')
    .replace(/:5050(\/|$)/, ':5051$1')
    .replace(/:4000(\/|$)/, ':4004$1');
};

// REACT_APP_API_URL is already the correct http/https URL — baked at build time
export const API_URL = process.env.REACT_APP_API_URL;
// Hook: runs callback after `delay` ms, with reset/clear controls
export function useTimeout(callback, delay) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const set = useCallback(() => {
    timeoutRef.current = setTimeout(() => callbackRef.current(), delay);
  }, [delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    set();
    return clear;
  }, [delay, set, clear]);

  const reset = useCallback(() => {
    clear();
    set();
  }, [clear, set]);

  return { reset, clear };
}

export const saveToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const removeToken = () => {
  localStorage.removeItem('token');
};

/**
 * Extends the current user session by refreshing the authentication token.
 * Sends the current token and receives an updated one.
 * 
 * @param {object} data - Additional data to send with session extension request
 * @returns {Promise<void>}
 */
export const extendSession = async (data) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.debug('No token found for session extension');
    return;
  }

  try {
    const [tokenType, tokenValue] = token.split(' ');
    
    if (!tokenType || !tokenValue) {
      console.warn('Invalid token format for session extension');
      return;
    }
    
    const response = await fetch(`${API_URL}/auth/ext-session`, {
      method: 'POST',
      headers: {
        Authorization: `${tokenType} ${tokenValue}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`Session extension failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    localStorage.removeItem('token');
    localStorage.setItem('token', `${result.tokenType} ${result.token}`);
  } catch (err) {
    console.error('Failed to extend session:', err);
    // Silently fail - session will expire naturally
  }
};

export const isAuthenticated = () => {
  return Boolean(getToken());
};

/**
 * Converts seconds into a human-readable duration string.
 * Example: 90061 seconds -> "1d 1h 1m 1s"
 * 
 * @param {number} seconds - Number of seconds to convert
 * @returns {string} - Human-readable duration (e.g., "2d 5h 30m 15s")
 */
export const formatUptime = (seconds) => {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '0s';
  if (seconds < 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

// Formats a timestamp into a readable date string
export const formatLaunchTime = (timestamp) => {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (err) {
    console.error('Error formatting launch time:', err);
    return 'Error formatting date';
  }
};

// Returns a "X time ago" string from a timestamp
export const getTimeAgo = (timestamp) => {
  if (!timestamp) return 'Unknown';

  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'Just now';

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  } catch (err) {
    console.error('Error calculating time ago:', err);
    return 'Unknown';
  }
};