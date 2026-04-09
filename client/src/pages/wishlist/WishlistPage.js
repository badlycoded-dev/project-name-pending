import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useWishlist } from '../../contexts/WishlistContext';
import config from '../../config/config';

const API_URL = config.API_URL;
const BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:4040';

function WishlistPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wishlist, toggleWishlist } = useWishlist();
  const { theme } = useContext(SettingsContext);

  const isDark = theme === 'dark';

  return (
    <div className={`min-vh-100 py-5 ${isDark ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
      <div className="container">
        <h2 className="fw-bold mb-4">
          <i className="bi bi-heart-fill text-danger me-2"></i> 
          {t('wishlistPage.title') || 'Мое Избранное (Wishlist)'}
        </h2>

        {wishlist.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-heartbreak text-muted" style={{ fontSize: '4rem' }}></i>
            <h4 className="mt-3">{t('wishlistPage.emptyTitle') || 'Ваш список желаний пуст'}</h4>
            <p className="text-muted">{t('wishlistPage.emptyDesc') || 'Сохраняйте сюда курсы, чтобы не потерять их!'}</p>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/search')}>
              {t('wishlistPage.searchCourses') || 'Искать курсы'}
            </button>
          </div>
        ) : (
          <div className="row g-4">
            {wishlist.map(course => {
              
              // --- ИСПРАВЛЕНИЕ КАРТИНОК ---
              let displayImg = course.thumbnail || course.img || course.thumbnailUrl;
              if (displayImg && displayImg.startsWith('/')) {
                // Если путь относительный, клеим BASE_URL
                displayImg = `${BASE_URL}${displayImg.replace('/api/api', '/api')}`; 
              }

              return (
                <div key={course._id || course.id} className="col-md-6 col-lg-4">
                  <div className={`card h-100 shadow-sm ${isDark ? 'bg-secondary text-light border-secondary' : ''}`}>
                    
                    {/* Картинка курса */}
                    <div className="position-relative">
                      <img 
                        src={displayImg || 'https://placehold.co/400x250?text=No+Img'} 
                        className="card-img-top" 
                        alt={course.title} 
                        style={{ height: '180px', objectFit: 'cover' }}
                      />
                      {/* Кнопка УДАЛЕНИЯ из избранного */}
                      <button
                        className="btn btn-light rounded-circle shadow-sm position-absolute top-0 end-0 m-2"
                        onClick={() => toggleWishlist(course)}
                        title={t('common.removeFromWishlist')}
                      >
                        <i className="bi bi-heart-fill text-danger fs-5"></i>
                      </button>
                    </div>

                    <div className="card-body d-flex flex-column">
                      <h5 className="card-title fw-bold">{course.title}</h5>
                      
                      <p className="card-text text-muted small mb-3">
                        {course.description ? course.description.substring(0, 80) + '...' : (t('wishlistPage.courseDescFallback') || 'Описание курса...')}
                      </p>
                      
                      <div className="mt-auto d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-primary fs-5">
                          {course.price ? `$${course.price}` : (t('wishlistPage.free') || 'Free')}
                        </span>
                        <button 
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => navigate(`/course/${course._id || course.id}`)}
                        >
                          {t('wishlistPage.details') || 'Подробнее'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WishlistPage;