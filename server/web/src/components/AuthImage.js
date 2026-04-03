import { useEffect, useState } from 'react';
import { toHttps } from '../utils/utils';

const API_BASE = toHttps(
  process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : 'https://localhost:4040'
);

/**
 * Fetches images with Authorization headers to avoid 401 errors
 * on protected image endpoints.
 */
function AuthImage({ src, alt, className, style, fallback = null }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }

    let isMounted = true;

    const fetchImage = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          if (isMounted) setHasError(true);
          return;
        }

        const [tokenType, tokenValue] = token.split(' ');

        let imageUrl;
        if (src.startsWith('http://') || src.startsWith('https://')) {
          imageUrl = src;
        } else {
          imageUrl = `${API_BASE}${src.startsWith('/') ? '' : '/'}${src}`;
        }

        const response = await fetch(imageUrl, {
          headers: { Authorization: `${tokenType} ${tokenValue}` },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch image (${response.status}): ${imageUrl}`);
          if (isMounted) setHasError(true);
          return;
        }

        const blob = await response.blob();
        if (isMounted) {
          setImageSrc(URL.createObjectURL(blob));
          setHasError(false);
        }
      } catch (err) {
        console.error('Error fetching authenticated image:', err);
        if (isMounted) setHasError(true);
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (imageSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  if (hasError || !imageSrc) {
    return fallback;
  }

  return <img src={imageSrc} alt={alt} className={className} style={style} />;
}

export default AuthImage;
