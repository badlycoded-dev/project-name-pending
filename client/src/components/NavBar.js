import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, clearUser } from '../utils/auth';
import { SettingsContext } from '../contexts/SettingsContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

function NavBar() {
  const navigate = useNavigate();
  const { lang, setLang, t, theme, setTheme } = useContext(SettingsContext);
  
  const { items } = useCart(); 
  const uniqueItemsCount = items.length;

  const { wishlist } = useWishlist();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    clearUser();
    setShowDropdown(false);
    navigate('/login');
  };

  const toggleTheme = (e) => {
    e.stopPropagation(); 
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const navbarClasses = theme === 'dark' 
    ? 'navbar navbar-expand-lg navbar-dark shadow-sm' 
    : 'navbar navbar-expand-lg navbar-light bg-white shadow-sm';

  return (
    <nav className={navbarClasses}>
      <div className="container">
        <a className="navbar-brand" href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <img src="https://getbootstrap.com/docs/4.0/assets/brand/bootstrap-solid.svg" width="30" height="30" className="d-inline-block align-top me-2" alt="" />
          Project Name
        </a>

        <div className="d-flex align-items-center ms-auto">
          <button className="btn btn-link me-3 text-decoration-none" onClick={() => navigate('/search')}>{t('courses')}</button>

          {/* КНОПКА ИЗБРАННОГО */}
          <button 
            className="btn btn-outline-danger me-2 position-relative" 
            onClick={() => navigate('/wishlist')} 
            aria-label={t('common.wishlist')}
            title={t('common.wishlist')}
          >
            <i className={wishlist.length > 0 ? "bi bi-heart-fill" : "bi bi-heart"}></i>
            {wishlist.length > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                {wishlist.length}
              </span>
            )}
          </button> 

          {/* ИД 1: КОРЗИНА */}
          <button id="tour-cart" className="btn btn-outline-primary me-3 position-relative" onClick={() => navigate('/cart')} aria-label="Cart">
            <i className="bi bi-cart" aria-hidden="true"></i>
            {uniqueItemsCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                {uniqueItemsCount}
              </span>
            )}
          </button>

          <div className="d-flex align-items-center me-3">
            {/* ИД 2: ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ */}
            <button 
              id="tour-theme-toggle"
              className="btn btn-link text-decoration-none p-0 me-3" 
              onClick={toggleTheme}
              style={{ color: theme === 'dark' ? '#f1c40f' : '#6c757d' }}
              title={t('common.toggleTheme')}
            >
              <i className={`bi fs-5 ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
            </button>

            <select 
              className={`form-select form-select-sm w-auto ${theme === 'dark' ? 'bg-dark text-light border-secondary' : ''}`} 
              value={lang} 
              onChange={(e) => setLang(e.target.value)} 
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="uk">Українська</option>
              <option value="de">Deutsch (German)</option>
              <option value="fr">Français (French)</option>
              <option value="it">Italiano (Italian)</option>
              <option value="sv">Svenska (Swedish)</option>
            </select>
          </div>

          {/* ИД 3: МЕНЮ ПОЛЬЗОВАТЕЛЯ ИЛИ КНОПКИ ЛОГИНА */}
          <div id="tour-user-menu" className="d-flex align-items-center">
            {(() => {
              const u = getUser();
              return u ? (
                <>
                  {['create', 'manage', 'admin', 'root'].includes(u.role) && (
                    <button 
                      className="btn btn-success me-3 fw-bold" 
                      onClick={() => navigate('/add-course')}
                    >
                      <i className="bi bi-plus-circle me-1"></i> {t('createCourseBtn')}
                    </button>
                  )}

                  <div className="dropdown" ref={dropdownRef}>
                    <button 
                      className={`btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2 ${showDropdown ? 'show' : ''}`}
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-expanded={showDropdown}
                    >
                      <i className="bi bi-person-circle"></i>
                    </button>

                    <ul className={`dropdown-menu dropdown-menu-end shadow-lg border-0 ${showDropdown ? 'show' : ''} ${theme === 'dark' ? 'dropdown-menu-dark' : ''}`} style={{ minWidth: '240px', borderRadius: '12px', overflow: 'hidden' }}>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { navigate('/account'); setShowDropdown(false); }}>
                          <i className="bi bi-person me-3 text-muted fs-5"></i> <span className="fw-medium">{t('account')}</span>
                        </button>
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { navigate('/settings'); setShowDropdown(false); }}>
                          <i className="bi bi-gear me-3 text-muted fs-5"></i> <span className="fw-medium">{t('settings')}</span>
                        </button>
                      </li>
                      
                      <li><hr className="dropdown-divider my-2" /></li>
                      
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center text-primary" onClick={() => { navigate('/redeem'); setShowDropdown(false); }}>
                          <i className="bi bi-key-fill me-3 fs-5"></i> <span className="fw-bold">{t('nav.redeem')}</span>
                        </button>
                      </li>

                      {['create', 'manage', 'admin', 'root'].includes(u.role) && (
                        <>
                          <li><hr className="dropdown-divider my-2" /></li>
                          <li className="px-3 pt-2 pb-1">
                            <span className="text-muted small fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>{t('nav.management')}</span>
                          </li>
                          
                          <li>
                            <button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { navigate('/manage/keys'); setShowDropdown(false); }}>
                              <i className="bi bi-upc-scan me-3 text-muted fs-5"></i> <span className="fw-medium">{t('nav.manageKeys')}</span>
                            </button>
                          </li>
                          <li>
                            <button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { navigate('/account'); setShowDropdown(false); }}>
                              <i className="bi bi-kanban me-3 text-muted fs-5"></i> <span className="fw-medium">{t('nav.manageSessions')}</span>
                            </button>
                          </li>
                        </>
                      )}

                      <li><hr className="dropdown-divider my-2" /></li>
                      
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center text-danger" onClick={handleLogout}>
                          <i className="bi bi-box-arrow-right me-3 fs-5"></i> <span className="fw-medium">{t('logout')}</span>
                        </button>
                      </li>
                    </ul>

                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => navigate('/login')} className="btn btn-outline-primary me-2">{t('login')}</button>
                  <button onClick={() => navigate('/register')} className="btn btn-primary">{t('signup')}</button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;