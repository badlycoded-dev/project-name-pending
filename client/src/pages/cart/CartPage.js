import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { SettingsContext } from '../../contexts/SettingsContext';
import { promoService } from '../../api/promoService';
import { getUser, setUser } from '../../utils/auth';
import { UtilityModal } from '../../components/UtilityModal';
import config from '../../config/config';

const API_URL = config.API_URL;

/* ---------- helpers ---------- */
function formatCard(raw = '') {
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function getCardType(num = '') {
  if (/^4/.test(num)) return 'visa';
  if (/^5[1-5]/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  return 'generic';
}

/* ---------- visual card preview ---------- */
function CardPreview({ data }) {
  const type = getCardType(data.cardNumber);
  const colorMap = {
    visa:       'linear-gradient(135deg, #1a56db 0%, #0e3a9e 100%)',
    mastercard: 'linear-gradient(135deg, #eb5757 0%, #b91c1c 100%)',
    amex:       'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
    generic:    'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)',
  };

  const logoMap = {
    visa: (
      <span style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 22, letterSpacing: 2, color: '#fff', fontFamily: 'serif' }}>
        VISA
      </span>
    ),
    mastercard: (
      <svg width="46" height="28" viewBox="0 0 46 28">
        <circle cx="16" cy="14" r="13" fill="#EB001B" opacity=".9"/>
        <circle cx="30" cy="14" r="13" fill="#F79E1B" opacity=".9"/>
        <path d="M23 5.7a13 13 0 0 1 0 16.6A13 13 0 0 1 23 5.7z" fill="#FF5F00" opacity=".85"/>
      </svg>
    ),
    amex: <span style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: 1 }}>AMEX</span>,
    generic: <i className="bi bi-credit-card-2-front" style={{ fontSize: 26, color: 'rgba(255,255,255,.8)' }}></i>,
  };

  const display = data.cardNumber
    ? formatCard(data.cardNumber).padEnd(19, '·').replace(/ /g, ' ')
    : '•••• •••• •••• ••••';

  return (
    <div style={{
      background: colorMap[type],
      borderRadius: 16,
      padding: '20px 24px',
      color: '#fff',
      fontFamily: "'Courier New', monospace",
      boxShadow: '0 8px 32px rgba(0,0,0,.25)',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }}/>
      <div style={{ position: 'absolute', bottom: -30, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }}/>

      <div className="d-flex justify-content-between align-items-start mb-3">
        <i className="bi bi-sim-fill" style={{ fontSize: 28, opacity: .8 }}></i>
        <div>{logoMap[type]}</div>
      </div>

      <div style={{ letterSpacing: '3px', fontSize: 16, marginBottom: 16, opacity: .9 }}>
        {display}
      </div>

      <div className="d-flex justify-content-between align-items-end">
        <div>
          <div style={{ fontSize: 9, opacity: .6, textTransform: 'uppercase', marginBottom: 2 }}>Card Holder</div>
          <div style={{ fontSize: 13, fontFamily: 'sans-serif', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.cardholderName || 'FULL NAME'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, opacity: .6, textTransform: 'uppercase', marginBottom: 2 }}>Expires</div>
          <div style={{ fontSize: 13 }}>{data.expiryDate || 'MM/YY'}</div>
        </div>
      </div>
    </div>
  );
}

/* ===================== MAIN COMPONENT ===================== */
function CartPage() {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, clearCart, totalItems, totalPrice } = useCart();
  const { t } = useContext(SettingsContext);

  /* --- promo --- */
  const [promoCode, setPromoCode]           = useState('');
  const [promoDiscount, setPromoDiscount]   = useState(0);
  const [promoMessage, setPromoMessage]     = useState({ type: '', text: '' });
  const [promoLoading, setPromoLoading]     = useState(false);
  const [appliedPromoInfo, setAppliedPromoInfo] = useState(null);

  /* --- modal --- */
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep]           = useState(1);
  const [isProcessing, setIsProcessing]           = useState(false);
  const [paymentSuccess, setPaymentSuccess]       = useState(false);
  const [errModal, setErrModal]                   = useState({ show: false, message: '' });

  /* --- payment form --- */
  const [paymentData, setPaymentData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    email: '',
  });
  const [cardErrors, setCardErrors] = useState({});

  /* -------- promo handler -------- */
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoMessage({ type: 'error', text: 'Please enter a promo code' });
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setPromoMessage({ type: 'error', text: 'Please log in to use promo codes' });
      return;
    }
    setPromoLoading(true);
    setPromoMessage({ type: '', text: '' });
    try {
      const courseIds = items.map(i => i.id || i.courseId).filter(Boolean);
      if (!courseIds.length) {
        setPromoMessage({ type: 'error', text: 'Cart is empty' });
        return;
      }
      const result = await promoService.validateForCart(promoCode, courseIds);
      if (result.valid) {
        const discount = result.discountType === 'percent'
          ? (totalPrice * result.discountValue) / 100
          : result.discountValue;
        setPromoDiscount(discount);
        setAppliedPromoInfo(result);
        setPromoMessage({ type: 'success', text: t('cart.promoApplied') || 'Promo code applied!' });
      } else {
        setPromoDiscount(0);
        setAppliedPromoInfo(null);
        setPromoMessage({ type: 'error', text: result.reason || t('cart.invalidPromo') || 'Invalid or expired promo code' });
      }
    } catch (err) {
      setPromoDiscount(0);
      setAppliedPromoInfo(null);
      setPromoMessage({ type: 'error', text: err.message || 'Failed to validate promo code' });
    } finally {
      setPromoLoading(false);
    }
  };

  /* -------- modal open/close -------- */
  const checkoutHandler = () => {
    setCheckoutStep(1);
    setCardErrors({});
    setPaymentData({ cardholderName: '', cardNumber: '', expiryDate: '', cvv: '', email: '' });
    setShowCheckoutModal(true);
  };

  const handleCloseModal = () => {
    if (isProcessing) return;
    setShowCheckoutModal(false);
    setCheckoutStep(1);
  };

  /* -------- payment input -------- */
  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'cardNumber') {
      setPaymentData(p => ({ ...p, cardNumber: value.replace(/\D/g, '').slice(0, 16) }));
      return;
    }
    if (name === 'cvv') {
      setPaymentData(p => ({ ...p, cvv: value.replace(/\D/g, '').slice(0, 4) }));
      return;
    }
    if (name === 'expiryDate') {
      let c = value.replace(/\D/g, '');
      if (c.length >= 2) c = c.slice(0, 2) + '/' + c.slice(2, 4);
      setPaymentData(p => ({ ...p, expiryDate: c }));
      return;
    }
    setPaymentData(p => ({ ...p, [name]: value }));
  };

  /* -------- validation -------- */
  const validateCardData = () => {
    const errs = {};
    if (!paymentData.cardholderName.trim())                               errs.cardholderName = 'Cardholder name is required';
    if (!paymentData.cardNumber || paymentData.cardNumber.length !== 16)  errs.cardNumber     = 'Card number must be 16 digits';
    if (!paymentData.expiryDate || !/^\d{2}\/\d{2}$/.test(paymentData.expiryDate)) errs.expiryDate = 'Format MM/YY';
    if (!paymentData.cvv || paymentData.cvv.length < 3)                  errs.cvv            = '3-4 digits required';
    if (!paymentData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentData.email)) errs.email = 'Valid email required';
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* -------- payment submit -------- */
  const handleProcessPayment = async () => {
    if (!validateCardData()) return;
    setIsProcessing(true);

    try {
      // 1. Симулируем задержку оплаты (здесь будет реальный платёжный API)
      await new Promise(r => setTimeout(r, 1800));

      // 2. Применяем промокод если есть — он добавляет курс на сервере
      if (appliedPromoInfo && promoCode) {
        for (const item of items) {
          const courseId = item.id || item.courseId;
          if (courseId) {
            try {
              await promoService.apply(promoCode, courseId);
            } catch (e) {
              console.warn('Promo apply failed for course', courseId, e);
            }
          }
        }
      }

      // 2b. Вызываем purchase API для каждого курса (добавляет в user.courses на сервере)
      const token = localStorage.getItem('token');
      for (const item of items) {
        const courseId = item.id || item.courseId;
        if (!courseId) continue;
        try {
          await fetch(`${API_URL}/courses/${courseId}/purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ promoCode: promoCode || undefined }),
          });
        } catch (e) {
          console.warn('Purchase API call failed for', courseId, e);
        }
      }

      // 3. Получаем актуальные данные курсов из корзины через API
      const fetchedCourses = await Promise.all(
        items.map(async (item) => {
          const courseId = item.id || item.courseId;
          if (!courseId) return null;
          try {
            const res = await fetch(`${API_URL}/courses/${courseId}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (!res.ok) return null;
            const data = await res.json();
            const c = data.data || data;
            const BASE = API_URL.replace('/api', '');
            const thumb = (c.links || []).find(l => l.type === 'image');
            // Нормализуем поля для совместимости с AccountPage
            return {
              id:     c._id || c.id || courseId,
              _id:    c._id || c.id || courseId,
              title:  c.trans?.[0]?.title || c.title || item.title || 'Course',
              img:    thumb ? `${BASE}${thumb.url}` : (item.img || null),
              author: c.userId?.nickname || item.author || 'Unknown',
              price:  c.price || item.price || 0,
            };
          } catch {
            // Если API недоступен — используем данные из корзины
            return {
              id:     courseId,
              _id:    courseId,
              title:  item.title || 'Course',
              img:    item.img   || null,
              author: item.author || 'Unknown',
              price:  item.price || 0,
            };
          }
        })
      );

      const validCourses = fetchedCourses.filter(Boolean);

      // 4. Добавляем купленные курсы в user.enrolled в localStorage
      const currentUser = getUser();
      if (currentUser) {
        const existingIds = new Set((currentUser.enrolled || []).map(c => String(c.id || c._id)));
        const newCourses = validCourses.filter(c => !existingIds.has(String(c.id)));
        const updatedUser = {
          ...currentUser,
          enrolled: [...(currentUser.enrolled || []), ...newCourses],
        };
        setUser(updatedUser, token);
      }

      // 5. Очищаем корзину и переходим в личный кабинет
      clearCart();
      setShowCheckoutModal(false);
      setPaymentSuccess(true);

      // Небольшая задержка для анимации, потом в аккаунт
      setTimeout(() => navigate('/account'), 1500);

    } catch (err) {
      console.error('Payment error:', err);
      setErrModal({ show: true, message: 'Payment failed: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  /* -------- totals -------- */
  const isAutoDiscountApplied = totalItems >= 10;
  const autoDiscountAmount    = isAutoDiscountApplied ? totalPrice * 0.15 : 0;
  const finalPrice            = Math.max(0, totalPrice - autoDiscountAmount - promoDiscount);

  const imgStyle = { width: '120px', height: '90px', objectFit: 'cover' };

  /* ===================== RENDER ===================== */
  return (
    <div>
      {showCheckoutModal && <style>{`body { overflow: hidden !important; }`}</style>}

      <div className="container py-5" style={{ maxWidth: '1100px' }}>

        {/* header */}
        <div className="d-flex justify-content-between align-items-center mb-5">
          <div>
            <h2 className="fw-bold mb-1">{t('cart.title')}</h2>
            <p className="text-muted mb-0">
              {totalItems > 0 ? t('cart.itemsInCart', { count: totalItems }) : t('cart.emptyTitle')}
            </p>
          </div>
          {totalItems > 0 && (
            <button
              className="btn btn-outline-danger rounded-pill px-4"
              onClick={() => clearCart()}
            >
              <i className="bi bi-trash3 me-2"></i> {t('cart.clearCart')}
            </button>
          )}
        </div>

        {/* empty state */}
        {items.length === 0 ? (
          <div className="text-center py-5">
            <div className="bg-secondary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
              style={{ width: '100px', height: '100px' }}>
              <i className="bi bi-cart-x fs-1 text-muted"></i>
            </div>
            <h4 className="fw-bold mb-3">{t('cart.emptyTitle')}</h4>
            <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
              {t('cart.emptyDesc')}
            </p>
            <button className="btn btn-primary btn-lg rounded-pill px-5 shadow-sm" onClick={() => navigate('/search')}>
              {t('cart.startShopping')}
            </button>
          </div>

        ) : (

          <div className="row g-4">

            {/* course list */}
            <div className="col-12 col-lg-8">
              <div className="d-grid gap-3">
                {items.map((it) => (
                  <div className="card border-0 shadow-sm overflow-hidden" key={it.id}>
                    <div className="card-body p-3">
                      <div className="d-flex flex-column flex-md-row align-items-center gap-4">
                        <img
                          src={it.img || 'https://placehold.co/150x150/21262d/e6edf3?text=Course'}
                          alt={it.title}
                          className="rounded-3 shadow-sm"
                          style={imgStyle}
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/21262d/e6edf3?text=Course'; }}
                        />
                        <div className="flex-grow-1 text-center text-md-start">
                          <h5 className="fw-bold mb-1">{it.title}</h5>
                          <p className="text-muted small mb-2">{it.author || 'Unknown Author'}</p>
                          <div className="badge bg-primary bg-opacity-10 text-primary rounded-pill">
                            {t('cart.lifetimeAccess')}
                          </div>
                        </div>
                        <div className="d-flex flex-column align-items-center align-items-md-end gap-2" style={{ minWidth: '140px' }}>
                          <div className="fs-4 fw-bold text-primary">
                            ${(Number(it.price) * (it.qty || 1)).toFixed(2)}
                          </div>
                          <div className="input-group input-group-sm" style={{ width: '100px' }}>
                            <button className="btn btn-outline-secondary" onClick={() => updateQty(it.id, (it.qty || 1) - 1)}>-</button>
                            <input readOnly className="form-control text-center border-secondary border-opacity-25" value={it.qty || 1} />
                            <button className="btn btn-outline-secondary" onClick={() => updateQty(it.id, (it.qty || 1) + 1)}>+</button>
                          </div>
                          <button className="btn btn-link text-danger text-decoration-none p-0 small mt-1" onClick={() => removeItem(it.id)}>
                            <i className="bi bi-x-circle me-1"></i> {t('cart.remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* sidebar — promo field REMOVED, now lives in modal */}
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm sticky-top" style={{ top: '20px', zIndex: 10 }}>
                <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0">
                  <h5 className="fw-bold mb-0">{t('cart.summary')}</h5>
                </div>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">{t('cart.subtotal')}</span>
                    <span className="fw-bold">${totalPrice.toFixed(2)}</span>
                  </div>

                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">
                      {t('cart.bulkDiscount')}
                      {isAutoDiscountApplied && <span className="badge bg-success ms-2">15%</span>}
                    </span>
                    <span className={isAutoDiscountApplied ? 'text-success fw-bold' : 'text-muted'}>
                      -${autoDiscountAmount.toFixed(2)}
                    </span>
                  </div>

                  {promoDiscount > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">
                        {t('cart.promoCode')}
                        <span className="badge bg-success ms-2">{promoCode.toUpperCase()}</span>
                      </span>
                      <span className="text-success fw-bold">-${promoDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {!isAutoDiscountApplied && (
                    <div className="alert alert-warning py-2 small mb-3">
                      {t('cart.addMore1')} <strong>{10 - totalItems}</strong> {t('cart.addMore2')} <strong>{t('cart.addMore3')}</strong>!
                    </div>
                  )}

                  <hr className="opacity-10" />

                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <span className="fs-5 fw-bold">{t('cart.total')}</span>
                    <span className="fs-3 fw-bold text-primary">${finalPrice.toFixed(2)}</span>
                  </div>

                  <button
                    className="btn btn-primary w-100 py-3 rounded-pill shadow fw-bold mb-3"
                    onClick={checkoutHandler}
                  >
                    <i className="bi bi-lock-fill me-2"></i>
                    {t('cart.checkoutNow')}
                  </button>

                  <button
                    className="btn btn-outline-secondary w-100 py-2 rounded-pill border-0"
                    onClick={() => navigate('/search')}
                  >
                    {t('cart.continueShopping')}
                  </button>

                  <div className="mt-4 text-center">
                    <p className="text-muted small mb-2">{t('cart.weAccept')}</p>
                    <div className="d-flex justify-content-center gap-2 text-muted fs-4">
                      <i className="bi bi-credit-card-2-front"></i>
                      <i className="bi bi-paypal"></i>
                      <i className="bi bi-apple"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ===================== CHECKOUT MODAL ===================== */}
      {showCheckoutModal && (
        <>
          {/* backdrop */}
          <div
            className="modal-backdrop fade show"
            style={{ position: 'fixed', zIndex: 999 }}
            onClick={handleCloseModal}
          />

          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            style={{
              position: 'fixed', zIndex: 1050,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              top: 0, left: 0, width: '100%', height: '100%',
            }}
          >
            <div
              className="modal-dialog w-100"
              role="document"
              style={{ margin: 'auto', maxWidth: 620 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content border-0 shadow-lg" style={{
                borderRadius: 20,
                background: 'var(--card-bg)',
                color: 'var(--text)',
              }}>

                {/* ===== SUCCESS SCREEN ===== */}
                {paymentSuccess && (
                  <div className="modal-body text-center py-5 px-4">
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 20px',
                      boxShadow: '0 8px 24px rgba(16,185,129,.35)',
                      animation: 'popIn .4s ease',
                    }}>
                      <i className="bi bi-check-lg" style={{ fontSize: 36, color: '#fff' }}/>
                    </div>
                    <h4 className="fw-bold mb-2">Payment Successful! 🎉</h4>
                    <p className="text-muted mb-1">Your courses have been added to <strong>My Learning</strong>.</p>
                    <p className="text-muted small">Redirecting to your account...</p>
                    <div className="mt-3">
                      <span className="spinner-border spinner-border-sm text-success" role="status"/>
                    </div>
                    <style>{`
                      @keyframes popIn {
                        0%   { transform: scale(0); opacity: 0; }
                        70%  { transform: scale(1.15); }
                        100% { transform: scale(1); opacity: 1; }
                      }
                    `}</style>
                  </div>
                )}

                {/* ===== HEADER + STEP INDICATOR ===== */}
                {!paymentSuccess && (<>
                <div className="modal-header border-0 px-4 pt-4 pb-0 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-center w-100 mb-3">
                    <h5 className="modal-title fw-bold mb-0">
                      {checkoutStep === 1 ? '🛒 Order Summary' : '💳 Payment Details'}
                    </h5>
                    <button type="button" className="btn-close" onClick={handleCloseModal} disabled={isProcessing}/>
                  </div>

                  {/* step indicator */}
                  <div className="d-flex align-items-center w-100 mb-1">
                    <div className="d-flex align-items-center" style={{ flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: checkoutStep >= 1 ? 'var(--primary-color)' : 'var(--border-color)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                        transition: 'background .3s',
                      }}>
                        {checkoutStep > 1
                          ? <i className="bi bi-check" style={{ fontSize: 14 }}/>
                          : '1'}
                      </div>
                      <span className="ms-2 small fw-semibold" style={{ color: checkoutStep >= 1 ? 'var(--primary-color)' : 'var(--muted)' }}>
                        Review &amp; Promo
                      </span>
                    </div>

                    <div style={{
                      height: 2, flex: 1,
                      background: checkoutStep >= 2 ? 'var(--primary-color)' : 'var(--border-color)',
                      transition: 'background .3s',
                      margin: '0 8px',
                    }}/>

                    <div className="d-flex align-items-center justify-content-end" style={{ flex: 1 }}>
                      <span className="me-2 small fw-semibold" style={{ color: checkoutStep >= 2 ? 'var(--primary-color)' : 'var(--muted)' }}>
                        Payment
                      </span>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: checkoutStep >= 2 ? 'var(--primary-color)' : 'var(--border-color)',
                        color: checkoutStep >= 2 ? '#fff' : 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                        transition: 'background .3s, color .3s',
                      }}>2</div>
                    </div>
                  </div>

                  <hr className="w-100 mt-3 mb-0 opacity-10" />
                </div>


                {/* ===== STEP 1: ORDER REVIEW + PROMO ===== */}
                {checkoutStep === 1 && (
                  <>
                    <div className="modal-body px-4 py-3">

                      {/* items list */}
                      <div className="mb-4">
                        <h6 className="fw-bold text-uppercase small mb-2" style={{ color: 'var(--muted)' }}>
                          Items ({items.length})
                        </h6>
                        <div className="rounded-3 p-3" style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border-color)',
                          maxHeight: 200, overflowY: 'auto',
                        }}>
                          {items.map((it) => (
                            <div
                              key={it.id}
                              className="d-flex justify-content-between align-items-center py-2"
                              style={{ borderBottom: '1px solid var(--border-color)' }}
                            >
                              <div>
                                <p className="fw-semibold mb-0" style={{ fontSize: 14 }}>{it.title}</p>
                                <small style={{ color: 'var(--muted)' }}>Qty: {it.qty || 1}</small>
                              </div>
                              <p className="fw-bold mb-0" style={{ color: 'var(--primary-color)' }}>
                                ${(Number(it.price) * (it.qty || 1)).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* promo code */}
                      <div className="mb-4">
                        <h6 className="fw-bold text-uppercase small mb-2" style={{ color: 'var(--muted)' }}>
                          Promo Code
                        </h6>
                        <div className="input-group">
                          <span className="input-group-text" style={{
                            background: 'var(--input-bg)',
                            borderColor: 'var(--input-border)',
                            color: 'var(--muted)',
                          }}>
                            <i className="bi bi-tag-fill"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter promo code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                            disabled={promoLoading}
                            style={{
                              background: 'var(--input-bg)',
                              borderColor: 'var(--input-border)',
                              color: 'var(--text)',
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                            }}
                          />
                          <button
                            className="btn btn-outline-primary fw-semibold"
                            onClick={handleApplyPromo}
                            disabled={promoLoading}
                            style={{ minWidth: 80 }}
                          >
                            {promoLoading
                              ? <span className="spinner-border spinner-border-sm" role="status"/>
                              : 'Apply'}
                          </button>
                        </div>
                        {promoMessage.text && (
                          <div className={`small mt-2 d-flex align-items-center gap-1 ${promoMessage.type === 'error' ? 'text-danger' : 'text-success'}`}>
                            <i className={`bi ${promoMessage.type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle-fill'}`}/>
                            {promoMessage.text}
                          </div>
                        )}
                      </div>

                      {/* order total */}
                      <div className="rounded-3 p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border-color)' }}>
                        <div className="d-flex justify-content-between mb-2 small">
                          <span style={{ color: 'var(--muted)' }}>Subtotal</span>
                          <span className="fw-semibold">${totalPrice.toFixed(2)}</span>
                        </div>
                        {isAutoDiscountApplied && (
                          <div className="d-flex justify-content-between mb-2 small">
                            <span style={{ color: 'var(--muted)' }}>Bulk Discount (15%)</span>
                            <span className="text-success fw-semibold">-${autoDiscountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {promoDiscount > 0 && (
                          <div className="d-flex justify-content-between mb-2 small">
                            <span style={{ color: 'var(--muted)' }}>Promo "{promoCode}"</span>
                            <span className="text-success fw-semibold">-${promoDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <hr className="opacity-10 my-2"/>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-bold">Total</span>
                          <span className="fw-bold fs-5 text-primary">${finalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                      <button className="btn btn-outline-secondary rounded-pill px-4" onClick={handleCloseModal}>
                        Cancel
                      </button>
                      <button className="btn btn-primary rounded-pill px-5 fw-bold" onClick={() => { setCheckoutStep(2); setCardErrors({}); }}>
                        Continue <i className="bi bi-arrow-right ms-1"/>
                      </button>
                    </div>
                  </>
                )}


                {/* ===== STEP 2: PAYMENT FORM ===== */}
                {checkoutStep === 2 && (
                  <>
                    <div className="modal-body px-4 py-3">

                      {/* card visual */}
                      <div className="mb-4 px-2">
                        <CardPreview data={paymentData} />
                      </div>

                      {/* cardholder name */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          className={`form-control ${cardErrors.cardholderName ? 'is-invalid' : ''}`}
                          name="cardholderName"
                          placeholder="JOHN DOE"
                          value={paymentData.cardholderName}
                          onChange={handlePaymentInputChange}
                          disabled={isProcessing}
                          style={{ background: 'var(--input-bg)', borderColor: cardErrors.cardholderName ? undefined : 'var(--input-border)', color: 'var(--text)', textTransform: 'uppercase' }}
                        />
                        {cardErrors.cardholderName && <div className="invalid-feedback d-block">{cardErrors.cardholderName}</div>}
                      </div>

                      {/* card number */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>
                          Card Number
                        </label>
                        <div className="input-group">
                          <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--muted)' }}>
                            <i className="bi bi-credit-card"/>
                          </span>
                          <input
                            type="text"
                            className={`form-control font-monospace ${cardErrors.cardNumber ? 'is-invalid' : ''}`}
                            placeholder="1234 5678 9012 3456"
                            maxLength="19"
                            value={formatCard(paymentData.cardNumber)}
                            onChange={(e) => setPaymentData(p => ({ ...p, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                            disabled={isProcessing}
                            style={{ background: 'var(--input-bg)', borderColor: cardErrors.cardNumber ? undefined : 'var(--input-border)', color: 'var(--text)' }}
                          />
                        </div>
                        {cardErrors.cardNumber && <div className="text-danger small mt-1">{cardErrors.cardNumber}</div>}
                      </div>

                      {/* expiry + cvv */}
                      <div className="row g-3 mb-3">
                        <div className="col-7">
                          <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            className={`form-control font-monospace ${cardErrors.expiryDate ? 'is-invalid' : ''}`}
                            name="expiryDate"
                            placeholder="MM/YY"
                            maxLength="5"
                            value={paymentData.expiryDate}
                            onChange={handlePaymentInputChange}
                            disabled={isProcessing}
                            style={{ background: 'var(--input-bg)', borderColor: cardErrors.expiryDate ? undefined : 'var(--input-border)', color: 'var(--text)' }}
                          />
                          {cardErrors.expiryDate && <div className="text-danger small mt-1">{cardErrors.expiryDate}</div>}
                        </div>
                        <div className="col-5">
                          <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>
                            CVV
                          </label>
                          <input
                            type="password"
                            className={`form-control font-monospace ${cardErrors.cvv ? 'is-invalid' : ''}`}
                            name="cvv"
                            placeholder="•••"
                            maxLength="4"
                            value={paymentData.cvv}
                            onChange={handlePaymentInputChange}
                            disabled={isProcessing}
                            style={{ background: 'var(--input-bg)', borderColor: cardErrors.cvv ? undefined : 'var(--input-border)', color: 'var(--text)' }}
                          />
                          {cardErrors.cvv && <div className="text-danger small mt-1">{cardErrors.cvv}</div>}
                        </div>
                      </div>

                      {/* email */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>
                          Email for receipt
                        </label>
                        <div className="input-group">
                          <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--muted)' }}>
                            <i className="bi bi-envelope"/>
                          </span>
                          <input
                            type="email"
                            className={`form-control ${cardErrors.email ? 'is-invalid' : ''}`}
                            name="email"
                            placeholder="john@example.com"
                            value={paymentData.email}
                            onChange={handlePaymentInputChange}
                            disabled={isProcessing}
                            style={{ background: 'var(--input-bg)', borderColor: cardErrors.email ? undefined : 'var(--input-border)', color: 'var(--text)' }}
                          />
                        </div>
                        {cardErrors.email && <div className="text-danger small mt-1">{cardErrors.email}</div>}
                      </div>

                      {/* amount */}
                      <div className="d-flex justify-content-between align-items-center rounded-3 p-3 mt-3"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border-color)' }}>
                        <span className="fw-semibold">Amount to charge:</span>
                        <span className="fw-bold fs-5 text-primary">${finalPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                      <button
                        className="btn btn-outline-secondary rounded-pill px-4"
                        onClick={() => setCheckoutStep(1)}
                        disabled={isProcessing}
                      >
                        <i className="bi bi-arrow-left me-1"/> Back
                      </button>
                      <button
                        className="btn btn-primary rounded-pill px-5 fw-bold"
                        onClick={handleProcessPayment}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <><span className="spinner-border spinner-border-sm me-2" role="status"/>Processing...</>
                        ) : (
                          <><i className="bi bi-lock-fill me-2"/>Pay ${finalPrice.toFixed(2)}</>
                        )}
                      </button>
                    </div>
                  </>
                )}
                </>)}
                {/* end !paymentSuccess */}

              </div>
            </div>
          </div>
        </>
      )}
      <UtilityModal
        show={errModal.show}
        type="info"
        title="Payment Error"
        message={errModal.message}
        onClose={() => setErrModal({ show: false, message: '' })}
      />
    </div>
  );
}

export default CartPage;