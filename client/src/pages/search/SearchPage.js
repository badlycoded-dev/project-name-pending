import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { getUser, setUser as setUserStorage } from '../../utils/auth'; 
import { SettingsContext } from '../../contexts/SettingsContext';
import { useCart } from '../../contexts/CartContext';
import { courseService } from '../../api/courseService'; 
import CourseCard from '../../components/CourseCard'; // ИМПОРТИРУЕМ НАШУ КАРТОЧКУ
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';

const API_URL = config.API_URL;
const BASE_URL = (process.env.REACT_APP_API_URL || '${BASE_URL}/api').replace('/api', '');

function SearchPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getUser());
  const { t } = useContext(SettingsContext);
  const { addItem } = useCart();

  const [viewMode, setViewMode] = useState('grid');
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '' });

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate('/login');
    } else {
      setUser(u);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const data = await courseService.getAll();
        
        const mappedData = data.map(c => {
          
          let imgSrc = 'https://placehold.co/400x250/21262d/e6edf3?text=No+Image';
          
          if (c.links && c.links.length > 0) {
            const imageLink = c.links.find(l => l.type === 'image') || c.links[0];
            if (imageLink && imageLink.url) {
              let cleanUrl = imageLink.url.replace(/\\/g, '/');
              cleanUrl = cleanUrl.replace('/api/manage/courses', '/api/courses');
              imgSrc = cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl}`;
            }
          } else if (c.img) {
            imgSrc = c.img;
          } else if (c._tempImage) {
            imgSrc = c._tempImage;
          }

          return {
            id: c._id || c.id, 
            title: c.title,
            author: c.userId?.nickname || c.author || 'Unknown',
            type: c.direction || 'Programming', 
            level: c.level,
            price: Number(c.price) || 0,
            img: imgSrc 
          };
        });

        setAllCourses(mappedData);
      } catch (error) {
        console.error("Error loading courses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';
    setSearchQuery(q);
  }, [location.search]);

  const maxDataPrice = allCourses.length > 0 ? Math.ceil(Math.max(...allCourses.map(c => c.price))) : 100;
  const DEFAULT_MAX = maxDataPrice > 0 ? maxDataPrice : 100;

  const [typeFilter, setTypeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sliderValues, setSliderValues] = useState([0, 1000]); 

  useEffect(() => {
    if (allCourses.length > 0) {
      setSliderValues([0, DEFAULT_MAX]);
    }
  }, [allCourses, DEFAULT_MAX]);

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setLevelFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setSliderValues([0, DEFAULT_MAX]);
  };

  const handleSliderChange = (values) => {
    setSliderValues(values);
    setMinPrice(values[0]);
    setMaxPrice(values[1]);
  };

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();

  const nq = normalize(searchQuery);
  const tf = typeFilter;
  const lf = levelFilter;

  const matchDetails = allCourses.map(c => {
    const searchMatch = nq === '' || normalize(c.title).includes(nq) || normalize(c.author).includes(nq);
    const typeMatch = tf === 'all' || c.type === tf;
    const levelMatch = lf === 'all' || c.level?.toLowerCase() === lf.toLowerCase(); 
    
    const currentMin = minPrice !== '' ? parseFloat(minPrice) : sliderValues[0];
    const currentMax = maxPrice !== '' ? parseFloat(maxPrice) : sliderValues[1];

    const minMatch = c.price >= currentMin;
    const maxMatch = c.price <= currentMax;
    
    const matched = searchMatch && typeMatch && levelMatch && minMatch && maxMatch;
    return { id: c.id, matched };
  });

  const filtered = matchDetails.filter(d => d.matched).map(d => allCourses.find(c => c.id === d.id));

  // ФУНКЦИИ ДЛЯ КАРТОЧКИ
  const handleCardClick = (courseId) => {
    navigate(`/course/${courseId}`); 
  };

  const handleEnroll = (e, course) => {   
    e.stopPropagation(); 
    const u = getUser();
    if (!u) { navigate('/login'); return; }
    u.enrolled = u.enrolled || [];
    if (!u.enrolled.find(x => String(x.id) === String(course.id))) {
      u.enrolled.push({ id: course.id, title: course.title, author: course.author, img: course.img });
      setUserStorage(u);
      setUser(u);
      setInfoModal({ show: true, title: '✓ Enrolled', message: t('enrolledIn') + course.title });
    } else {
      setInfoModal({ show: true, title: 'Already enrolled', message: t('alreadyEnrolled') });
    }
  };

  const handleAddToCart = (e, course) => {
    e.stopPropagation(); 
    addItem({ id: course.id, title: course.title, price: course.price, img: course.img, description: course.title }, 1);
  };

  return (
    <div>
      <div className="container my-4">
        
        <div className="row mb-4">
          <div className="col-12">
            <div className="input-group input-group-lg shadow-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input 
                type="text" 
                className="form-control border-start-0" 
                placeholder={t('searchPlaceholder') || "Search by title or author..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="row">
          
          <aside className="col-12 col-md-4 col-lg-3 mb-4">
            <div className="card p-3 border-0 shadow-sm">
              <h6 className="mb-3 fw-bold text-uppercase text-muted small">{t('filters')}</h6>
              
              <label className="form-label small fw-bold">{t('type')}</label>
              <select className="form-select mb-3" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">{t('all')}</option>
                <option value="Programming">Programming</option>
                <option value="Data Science">Data Science</option>
                <option value="Game Dev">Game Dev</option>
                <option value="Design">Design</option>
              </select>

              <label className="form-label small fw-bold">{t('level')}</label>
              <select className="form-select mb-3" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                <option value="all">{t('all')}</option>
                <option value="Junior">Junior</option>
                <option value="Middle">Middle</option>
                <option value="Senior">Senior</option>
              </select>

              <label className="form-label small fw-bold">{t('priceRange')}</label>
              <div className="px-2 mb-3 mt-1">
                <Slider
                  range
                  min={0}
                  max={DEFAULT_MAX}
                  value={sliderValues}
                  onChange={handleSliderChange}
                  trackStyle={[{ backgroundColor: '#0d6efd' }]}
                  handleStyle={[
                    { borderColor: '#0d6efd', backgroundColor: '#fff', opacity: 1 },
                    { borderColor: '#0d6efd', backgroundColor: '#fff', opacity: 1 }
                  ]}
                  railStyle={{ backgroundColor: 'var(--input-border)' }} 
                />
              </div>

              <div className="d-flex gap-2 mb-3">
                <input 
                  className="form-control" 
                  type="number" 
                  placeholder={t('min')} 
                  value={minPrice} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setMinPrice(val);
                    if(val !== '') setSliderValues([Number(val), sliderValues[1]]);
                  }} 
                />
                <input 
                  className="form-control" 
                  type="number" 
                  placeholder={t('max')} 
                  value={maxPrice} 
                  onChange={(e) => {
                     const val = e.target.value;
                     setMaxPrice(val);
                     if(val !== '') setSliderValues([sliderValues[0], Number(val)]);
                  }} 
                />
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small align-self-center">{filtered.length} {t('results')}</div>
                <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>{t('clear')}</button>
              </div>
            </div>
          </aside>

          <main className="col-12 col-md-8 col-lg-9">
            <div className="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0 fw-bold">{t('searchResults')}</h5>
                {searchQuery && <p className="text-muted small mb-0">for "{searchQuery}"</p>}
              </div>
              
              <div className="btn-group shadow-sm" role="group">
                <button 
                  type="button" 
                  className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-primary bg-white text-primary'}`} 
                  onClick={() => setViewMode('grid')}
                  title={t('common.gridView')}
                >
                  <i className="bi bi-grid-fill"></i>
                </button>
                <button 
                  type="button" 
                  className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary bg-white text-primary'}`} 
                  onClick={() => setViewMode('list')}
                  title={t('common.listView')}
                >
                  <i className="bi bi-list-ul"></i>
                </button>
              </div>
            </div>
            
            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}

            {!loading && (
              <div className="row g-4">
                {filtered.map(course => (
                  <div key={course.id} className={viewMode === 'grid' ? "col-12 col-md-6 col-lg-4" : "col-12"}>
                    
                    {/* ВОТ ЗДЕСЬ МЫ ИСПОЛЬЗУЕМ НАШ НОВЫЙ КОМПОНЕНТ */}
                    <CourseCard 
                      course={course}
                      viewMode={viewMode}
                      onCardClick={handleCardClick}
                      onEnroll={handleEnroll}
                      onAddToCart={handleAddToCart}
                      t={t}
                    />
  
                  </div>
                ))}
  
                {filtered.length === 0 && (
                  <div className="col-12">
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-search fs-1 mb-3 d-block opacity-50"></i>
                      <h5>{t('noResults')}</h5>
                      <p>Try adjusting your search or filters.</p>
                      <button className="btn btn-outline-primary rounded-pill mt-2" onClick={clearFilters}>{t('clear')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
      <UtilityModal
        show={infoModal.show}
        type="info"
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ show: false, title: '', message: '' })}
      />
    </div>
  );
}

export default SearchPage;