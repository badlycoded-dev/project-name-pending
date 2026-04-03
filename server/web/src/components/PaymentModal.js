import { toHttps } from '../utils/utils';
import { useState } from 'react';

const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

export function PaymentModal({ course, onClose, onSuccess }) {
    const token = localStorage.getItem('token');
    const ah = { Authorization: `${token?.split(' ')[0]} ${token?.split(' ')[1]}`, 'Content-Type': 'application/json' };

    const [promoCode, setPromoCode]       = useState('');
    const [promoResult, setPromoResult]   = useState(null); // { valid, finalPrice, discount, ... }
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoError, setPromoError]     = useState('');
    const [paying, setPaying]             = useState(false);
    const [step, setStep]                 = useState('details'); // 'details' | 'card' | 'done'

    // Mock card form
    const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' });
    const [cardError, setCardError] = useState('');

    const title = course?.trans?.[0]?.title || '(untitled)';
    const basePrice = course?.price || 0;
    const finalPrice = promoResult?.valid ? promoResult.finalPrice : basePrice;
    const isFree = finalPrice === 0;

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setPromoLoading(true); setPromoError('');
        try {
            const res = await fetch(`${API}/promos/validate`, {
                method: 'POST', headers: ah,
                body: JSON.stringify({ code: promoCode.trim(), courseId: course._id })
            });
            const d = await res.json();
            if (d.valid) { setPromoResult(d); }
            else { setPromoResult(null); setPromoError(d.reason || 'Invalid promo code'); }
        } catch { setPromoError('Could not validate promo code'); }
        setPromoLoading(false);
    };

    const validateCard = () => {
        if (isFree) return true;
        const n = card.number.replace(/\s/g, '');
        if (!/^\d{16}$/.test(n))        { setCardError('Enter a valid 16-digit card number'); return false; }
        if (!/^\d{2}\/\d{2}$/.test(card.expiry)) { setCardError('Enter expiry as MM/YY');     return false; }
        if (!/^\d{3,4}$/.test(card.cvc))          { setCardError('Enter a valid CVC');         return false; }
        if (!card.name.trim())                    { setCardError('Enter cardholder name');      return false; }
        return true;
    };

    const handlePay = async () => {
        if (step === 'details') {
            if (!isFree) { setStep('card'); return; }
            // Free — go straight to confirm
        }
        if (!isFree && !validateCard()) return;
        setPaying(true); setCardError('');
        try {
            const res = await fetch(`${API}/courses/${course._id}/purchase`, {
                method: 'POST', headers: ah,
                body: JSON.stringify({ promoCode: promoResult?.valid ? promoCode.trim() : undefined })
            });
            const d = await res.json();
            if (res.ok) { setStep('done'); setTimeout(onSuccess, 1200); }
            else setCardError(d.message || 'Purchase failed');
        } catch { setCardError('Network error — please try again'); }
        setPaying(false);
    };

    return (
        <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card border-0 shadow-lg" style={{ width:'100%', maxWidth:440, borderRadius:16, overflow:'hidden' }}>

                {/* Header */}
                <div className="card-header border-0 d-flex align-items-center justify-content-between"
                    style={{ background:'linear-gradient(135deg,#3b5bdb,#7048e8)', color:'#fff', padding:'1rem 1.25rem' }}>
                    <div>
                        <div className="fw-bold" style={{ fontSize:'1rem' }}>
                            {step === 'done' ? '🎉 Purchase complete!' : 'Enrol in course'}
                        </div>
                        <div style={{ fontSize:'.8rem', opacity:.85 }}>{title}</div>
                    </div>
                    {step !== 'done' && (
                        <button className="btn-close btn-close-white" onClick={onClose}></button>
                    )}
                </div>

                <div className="card-body p-4">

                    {/* ── Step: done ── */}
                    {step === 'done' && (
                        <div className="text-center py-2">
                            <div style={{ fontSize:3+'rem' }}>✅</div>
                            <p className="fw-semibold mt-2 mb-1">You now have access to this course.</p>
                            <p className="text-muted small">Redirecting you in a moment…</p>
                        </div>
                    )}

                    {/* ── Step: details ── */}
                    {step === 'details' && (
                        <>
                            {/* Price summary */}
                            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                <span className="text-muted">Course price</span>
                                <span className="fw-bold">{basePrice > 0 ? `$${basePrice.toFixed(2)}` : 'Free'}</span>
                            </div>

                            {/* Promo code */}
                            {basePrice > 0 && (
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Promo code</label>
                                    <div className="input-group">
                                        <input type="text" className={`form-control ${promoError ? 'is-invalid' : ''}`}
                                            placeholder="Enter code…"
                                            value={promoCode}
                                            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(''); }}
                                            onKeyDown={e => e.key === 'Enter' && validatePromo()} />
                                        <button className="btn btn-outline-secondary" onClick={validatePromo} disabled={promoLoading || !promoCode.trim()}>
                                            {promoLoading ? <span className="spinner-border spinner-border-sm" /> : 'Apply'}
                                        </button>
                                    </div>
                                    {promoError && <div className="text-danger small mt-1">{promoError}</div>}
                                    {promoResult?.valid && (
                                        <div className="alert alert-success py-2 mt-2 mb-0 small">
                                            <i className="bi bi-check-circle-fill me-1"></i>
                                            {promoResult.discountType === 'percent'
                                                ? `${promoResult.discountValue}% off`
                                                : `$${promoResult.discountValue} off`}
                                            {' '}— new price: <strong>${promoResult.finalPrice.toFixed(2)}</strong>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Final price */}
                            <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded"
                                style={{ background:'#f8f9fa' }}>
                                <span className="fw-semibold">Total</span>
                                <span className="fw-bold" style={{ fontSize:'1.3rem', color: isFree ? '#2f9e44' : '#3b5bdb' }}>
                                    {isFree ? 'Free' : `$${finalPrice.toFixed(2)}`}
                                </span>
                            </div>

                            <div className="d-flex gap-2">
                                <button className="btn btn-outline-secondary flex-1" onClick={onClose}>Cancel</button>
                                <button className="btn btn-primary flex-1" onClick={handlePay}>
                                    {isFree ? 'Enrol for free' : `Continue to payment →`}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step: card ── */}
                    {step === 'card' && (
                        <>
                            <p className="text-muted small mb-3">
                                <i className="bi bi-lock-fill me-1 text-success"></i>
                                This is a demo payment form — no real charge will be made.
                            </p>
                            <div className="mb-2">
                                <label className="form-label small fw-semibold">Card number</label>
                                <input type="text" className="form-control" placeholder="1234 5678 9012 3456" maxLength={19}
                                    value={card.number}
                                    onChange={e => {
                                        const v = e.target.value.replace(/\D/g,'').slice(0,16);
                                        setCard(p => ({ ...p, number: v.replace(/(.{4})/g,'$1 ').trim() }));
                                    }} />
                            </div>
                            <div className="row g-2 mb-2">
                                <div className="col-6">
                                    <label className="form-label small fw-semibold">Expiry (MM/YY)</label>
                                    <input type="text" className="form-control" placeholder="12/27" maxLength={5}
                                        value={card.expiry}
                                        onChange={e => {
                                            let v = e.target.value.replace(/\D/g,'').slice(0,4);
                                            if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
                                            setCard(p => ({ ...p, expiry: v }));
                                        }} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label small fw-semibold">CVC</label>
                                    <input type="text" className="form-control" placeholder="123" maxLength={4}
                                        value={card.cvc}
                                        onChange={e => setCard(p => ({ ...p, cvc: e.target.value.replace(/\D/g,'').slice(0,4) }))} />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label small fw-semibold">Cardholder name</label>
                                <input type="text" className="form-control" placeholder="John Smith"
                                    value={card.name}
                                    onChange={e => setCard(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            {cardError && <div className="alert alert-danger py-2 small">{cardError}</div>}
                            <div className="d-flex justify-content-between align-items-center mb-3 py-2 border-top">
                                <span className="text-muted small">Total charge</span>
                                <span className="fw-bold text-primary">${finalPrice.toFixed(2)}</span>
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-outline-secondary flex-1" onClick={() => setStep('details')}>← Back</button>
                                <button className="btn btn-primary flex-1" onClick={handlePay} disabled={paying}>
                                    {paying ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-lock-fill me-1"></i>}
                                    Pay ${finalPrice.toFixed(2)}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}