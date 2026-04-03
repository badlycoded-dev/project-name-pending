import { useWishlist } from '../contexts/WishlistContext';

// ДОБАВЛЯЕМ ПРАВИЛЬНЫЙ БАЗОВЫЙ URL (как просил Миша в контракте)
const BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:4040';

function CourseCard({ course, viewMode, onCardClick, onEnroll, onAddToCart, t }) {
  const gridImageStyle = { width: '100%', height: '160px', objectFit: 'cover' };
  const listImageStyle = { width: '100%', height: '100%', minHeight: '180px', objectFit: 'cover' };

  const getLevelBadgeClass = (level) => {
    switch (level?.toLowerCase()) {
      case 'junior': return 'bg-success';
      case 'middle': return 'bg-warning text-dark';
      case 'senior': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'Programming': return 'bg-primary';
      case 'Data Science': return 'bg-info text-dark';
      case 'Game Dev': return 'bg-dark';
      case 'Design': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  const { toggleWishlist, isInWishlist } = useWishlist();

  const handleImageError = (e) => {
    e.target.onerror = null; 
    e.target.src = 'https://placehold.co/400x250/21262d/e6edf3?text=No+Image'; 
  };

  // --- УМНАЯ ПОДСТАНОВКА ДАННЫХ ИЗ БАЗЫ МИШИ ---
  
  // 1. Достаем название и описание (учитываем, что они могут лежать внутри массива trans)
  const displayTitle = course.title || (course.trans && course.trans[0]?.title) || 'Без названия';
  const displayDesc = course.description || (course.trans && course.trans[0]?.description) || 'Описание недоступно.';
  
  // 2. Достаем картинку и клеим правильный URL
  let displayImg = course.img || course.thumbnailUrl || course.thumbnail;
  if (displayImg && displayImg.startsWith('/')) {
    // Если путь относительный (начинается со слэша), добавляем BASE_URL
    displayImg = `${BASE_URL}${displayImg.replace('/api/api', '/api')}`; 
  }

  // 3. Безопасная цена
  const displayPrice = course.price !== undefined && course.price !== null ? course.price : 0;

  // ===================== РЕЖИМ СЕТКИ (GRID) =====================
  if (viewMode === 'grid') {
    return (
      <div 
        className="card h-100 course-card border-0 shadow-sm" 
        onClick={() => onCardClick(course._id || course.id)} 
        style={{ cursor: 'pointer' }} 
      >
        <div className="position-relative">
          <img 
            src={displayImg} 
            className="card-img-top course-img" 
            alt={displayTitle} 
            style={gridImageStyle} 
            onError={handleImageError} 
          />
          <div className="position-absolute top-0 start-0 p-2">
             <span className={`badge ${getLevelBadgeClass(course.level)} shadow-sm`}>
               {course.level || 'All levels'}
             </span>
          </div>
          
          <button
            className="btn btn-light rounded-circle shadow-sm position-absolute top-0 end-0 m-2 d-flex justify-content-center align-items-center"
            onClick={(e) => {
              e.preventDefault(); 
              e.stopPropagation(); 
              toggleWishlist(course); 
            }}
            style={{ zIndex: 10, width: '35px', height: '35px', padding: 0 }}
            title={t('common.addToWishlist') || 'Add to Wishlist'}
          >
            <i className={isInWishlist(course._id || course.id) ? "bi bi-heart-fill text-danger" : "bi bi-heart text-secondary"}></i>
          </button>
        </div>
        
        <div className="card-body d-flex flex-column">
          <h6 className="card-title fw-bold mb-1 text-truncate">{displayTitle}</h6>
          
          {/* Выводим описание даже в режиме сетки (раньше тут был автор) */}
          <p className="text-muted small mb-2 text-truncate" title={displayDesc}>
            {displayDesc}
          </p>
          
          <div className="mb-3">
            <span className={`badge ${getTypeBadgeClass(course.direction || course.type)}`}>
              {course.direction || course.type || 'Course'}
            </span>
          </div>
          
          <div className="mt-auto d-flex justify-content-between align-items-center gap-2">
            <div className="d-flex gap-2 flex-grow-1" style={{ minWidth: 0 }}>
              <button 
                className="btn btn-sm btn-primary rounded-pill px-3 text-truncate" 
                style={{ flexShrink: 1, minWidth: 0 }}
                onClick={(e) => onEnroll(e, course)}
              >
                {t('enroll') || 'Enroll'}
              </button>
              <button 
                className="btn btn-sm btn-outline-secondary rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" 
                style={{ width: '32px', height: '32px', padding: 0 }}
                onClick={(e) => onAddToCart(e, course)}
              >
                <i className="bi bi-cart-plus"></i>
              </button>
            </div>
            <div className="fw-bold fs-5 flex-shrink-0 text-nowrap">
              ${displayPrice.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================== РЕЖИМ СПИСКА (LIST) =====================
  return (
    <div 
      className="card h-100 course-card border-0 shadow-sm"
      onClick={() => onCardClick(course._id || course.id)}
      style={{ cursor: 'pointer' }}
    >
      <div className="row g-0 h-100">
        <div className="col-md-4 col-lg-3 position-relative">
           <img 
              src={displayImg} 
              alt={displayTitle} 
              style={listImageStyle} 
              className="rounded-start course-img" 
              onError={handleImageError}
           />
           <div className="position-absolute top-0 start-0 p-2">
              <span className={`badge ${getLevelBadgeClass(course.level)} shadow-sm`}>
                {course.level || 'All levels'}
              </span>
           </div>

           <button
             className="btn btn-light rounded-circle shadow-sm position-absolute top-0 end-0 m-2 d-flex justify-content-center align-items-center"
             onClick={(e) => {
               e.preventDefault(); 
               e.stopPropagation();
               toggleWishlist(course); 
             }}
             style={{ zIndex: 10, width: '35px', height: '35px', padding: 0 }}
           >
             <i className={isInWishlist(course._id || course.id) ? "bi bi-heart-fill text-danger" : "bi bi-heart text-secondary"}></i>
           </button>
        </div>

        <div className="col-md-8 col-lg-9">
          <div className="card-body d-flex flex-column h-100">
            <div className="d-flex justify-content-between align-items-start gap-2">
               <div style={{ minWidth: 0 }}>
                 <h5 className="card-title fw-bold mb-1 text-truncate">{displayTitle}</h5>
                 <span className={`badge ${getTypeBadgeClass(course.direction || course.type)}`}>
                   {course.direction || course.type || 'Course'}
                 </span>
               </div>
               <div className="fw-bold fs-4 text-primary flex-shrink-0 text-nowrap">
                  ${displayPrice.toFixed(2)}
               </div>
            </div>

            {/* ВЫВОДИМ РЕАЛЬНОЕ ОПИСАНИЕ ИЗ БАЗЫ */}
            <p className="card-text text-muted mt-3" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
               {displayDesc}
            </p>
            
            <div className="mt-auto d-flex gap-2">
              <button className="btn btn-sm btn-primary rounded-pill px-4" onClick={(e) => onEnroll(e, course)}>{t('enroll') || 'Enroll'}</button>
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 flex-shrink-0" onClick={(e) => onAddToCart(e, course)}>
                <i className="bi bi-cart-plus me-1"></i> {t('common.addToCart')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseCard;