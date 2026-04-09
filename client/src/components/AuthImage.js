import { useEffect, useState } from 'react';

const BASE_URL = (process.env.REACT_APP_API_URL || '${BASE_URL}/api').replace('/api', '');

function AuthImage({ src, alt, className, style, fallback }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) {
            setError(true);
            return;
        }

        let isMounted = true;
        const fetchImage = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    if (isMounted) setError(true);
                    return;
                }

                // Правильный формат токена для заголовка Authorization
                const headers = {
                    'Authorization': `Bearer ${token}`
                };

                let imageUrl;
                if (src.startsWith('http://') || src.startsWith('https://')) {
                    imageUrl = src;
                } else if (src.startsWith('/')) {
                    imageUrl = `${BASE_URL}${src}`;
                } else {
                    imageUrl = `${BASE_URL}/${src}`;
                }

                const response = await fetch(imageUrl, { headers });
                
                if (response.ok) {
                    const blob = await response.blob();
                    if (isMounted) {
                        const objectUrl = URL.createObjectURL(blob);
                        setImageSrc(objectUrl);
                        setError(false);
                    }
                } else {
                    console.warn(`Failed to fetch image (${response.status}): ${imageUrl}`);
                    if (isMounted) setError(true);
                }
            } catch (err) {
                console.error('Error fetching authenticated image:', err);
                if (isMounted) setError(true);
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
            if (imageSrc && imageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(imageSrc);
            }
        };
    }, [src]);

    if (error || !imageSrc) {
        return fallback || null;
    }

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            style={style}
        />
    );
}

export default AuthImage;