import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';

const BASE_URL = (process.env.REACT_APP_API_URL || '${BASE_URL}/api').replace('/api', '');
import { useCart } from '../../contexts/CartContext';
import { courseService } from '../../api/courseService';

function HomePage() {
  const navigate = useNavigate();
  const { t } = useContext(SettingsContext);
  const { addItem } = useCart();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestCourses = async () => {
      try {
        const data = await courseService.getAll();
        
        const latest = data.slice(0, 4).map(c => {
          let imgSrc = 'https://placehold.co/400x250/21262d/e6edf3?text=No+Image';
          if (c.links && c.links.length > 0) {
            const imageLink = c.links.find(l => l.type === 'image') || c.links[0];
            if (imageLink && imageLink.url) {
              let cleanUrl = imageLink.url.replace(/\\/g, '/');
              cleanUrl = cleanUrl.replace('/api/manage/courses', '/api/courses');
              imgSrc = cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl}`;
            }
          }

          return {
            id: c._id || c.id,
            title: c.title,
            description: c.description, // Перевод заглушки сделаем в верстке
            author: c.userId?.nickname || c.author, // Перевод заглушки сделаем в верстке
            price: Number(c.price) || 0,
            img: imgSrc
          };
        });

        setCourses(latest);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestCourses();
  }, []);

  const features = [
    { icon: 'bi-laptop', titleKey: 'feature1Title', descKey: 'feature1Desc', color: 'text-primary' },
    { icon: 'bi-people-fill', titleKey: 'feature2Title', descKey: 'feature2Desc', color: 'text-success' },
    { icon: 'bi-alarm', titleKey: 'feature3Title', descKey: 'feature3Desc', color: 'text-warning' }
  ];

  return (
    <div className="homepage-wrapper">
      <header className="hero-section py-5 mb-5">
        <div className="container h-100">
          <div className="row align-items-center h-100">
            <div className="col-lg-6 my-4">
              <h1 className="display-4 fw-bold mb-3">{t('heroTitle')}</h1>
              <p className="lead mb-4 opacity-75">{t('heroLead')}</p>
              <div className="d-flex gap-3">
                <button className="btn btn-primary btn-lg px-4 shadow-sm" onClick={() => navigate('/search')}>{t('getStarted')}</button>
                <button className="btn btn-outline-dark btn-lg px-4" onClick={() => {
                  const el = document.getElementById('features');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}>{t('learnMore')}</button>
              </div>
            </div>
            <div className="col-lg-6">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" alt="Learning" className="img-fluid rounded-4 shadow-lg hero-img" />
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="py-5">
        <div className="container">
          <div className="row g-4 justify-content-center">
            {features.map((f, idx) => (
              <div className="col-md-4" key={idx}>
                <div className="card h-100 border-0 shadow-sm feature-card text-center p-4">
                  <div className={`mb-3 display-4 ${f.color}`}><i className={`bi ${f.icon}`}></i></div>
                  <h5 className="fw-bold">{t(f.titleKey)}</h5>
                  <p className="text-muted small">{t(f.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="py-5 bg-opacity-10">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4">
            <h2 className="fw-bold mb-0">{t('popularCourses')}</h2>
            <button className="btn btn-link text-decoration-none" onClick={() => navigate('/search')}>{t('all')} &rarr;</button>
          </div>
          
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
          ) : courses.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 mb-3 d-block opacity-50"></i>
              <p>{t('noCoursesAvailable')}</p>
            </div>
          ) : (
            <div className="row g-4">
              {courses.map((c) => (
                <div className="col-12 col-md-6 col-lg-3" key={c.id}>
                  <div className="card h-100 border-0 shadow-sm course-card" onClick={() => navigate(`/course/${c.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="position-relative overflow-hidden rounded-top">
                      <img src={c.img} className="card-img-top course-img" alt={c.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                    </div>
                    <div className="card-body d-flex flex-column">
                      <h6 className="card-title fw-bold mb-1 text-truncate">{c.title}</h6>
                      <p className="text-muted small mb-2 text-truncate"><i className="bi bi-person me-1"></i>{c.author || t('unknownAuthor')}</p>
                      
                      <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top border-opacity-10">
                        <span className="fw-bold text-primary">${c.price.toFixed(2)}</span>
                        <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={(e) => { e.stopPropagation(); addItem({ id: c.id, title: c.title, price: c.price, img: c.img }, 1); }}>
                          <i className="bi bi-cart-plus"></i> {t('addToCartBtn')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default HomePage;