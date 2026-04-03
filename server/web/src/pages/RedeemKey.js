import { toHttps } from '../utils/utils';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
const BASE_URL = toHttps(process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://localhost:4040');


// Format code as user types: strip non-alnum, insert dashes every 5 chars
function formatCode(raw) {
    const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 15);
    const parts = [];
    for (let i = 0; i < clean.length; i += 5) parts.push(clean.slice(i, i + 5));
    return parts.join("-");
}

function RedeemKey({ data, onLogout }) {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // null | { courses, newlyUnlocked, alreadyOwned }
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setCode(formatCode(e.target.value));
        setError("");
        setResult(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const stripped = code.replace(/-/g, "");
        if (stripped.length !== 15) { setError("Please enter a complete 15-character code (format: XXXXX-XXXXX-XXXXX)"); return; }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const res = await fetch(process.env.REACT_APP_API_URL + "/keys/redeem", {
                method: "POST",
                headers: {
                    Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ code })
            });
            const json = await res.json();
            if (res.ok) {
                setResult(json.data);
                setCode("");
            } else {
                setError(json.message || "Redemption failed");
            }
        } catch (e) {
            setError("Network error. Please try again.");
        }
        setLoading(false);
    };

    return (
    <AppLayout data={data} onLogout={onLogout} title="Redeem Key">
<div className="flex-grow-1 d-flex align-items-start justify-content-center p-3 p-md-5">
                <div className="w-100" style={{ maxWidth: 520 }}>

                    <div className="mb-4">
                        <h1 className="h3 fw-bold mb-1">Redeem a Product Key</h1>
                        <p className="text-muted small">Enter your key code to unlock courses in your library.</p>
                    </div>

                    {/* Success state */}
                    {result && (
                        <div className="card border-0 shadow-sm mb-4 border-start border-success border-4">
                            <div className="card-body p-4">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <i className="bi bi-check-circle-fill text-success fs-4"></i>
                                    <h5 className="fw-bold mb-0 text-success">Key Redeemed!</h5>
                                </div>
                                <p className="text-muted small mb-3">
                                    {result.newlyUnlocked > 0
                                        ? <><strong>{result.newlyUnlocked}</strong> course(s) added to your library.</>
                                        : "All courses from this key were already in your library."}
                                    {result.alreadyOwned > 0 && (
                                        <span className="ms-1 text-muted">({result.alreadyOwned} already owned)</span>
                                    )}
                                </p>
                                <div className="d-flex flex-column gap-2">
                                    {result.courses.map(c => (
                                        <div key={c._id} className="d-flex align-items-center gap-3 p-2 rounded bg-light border">
                                            {c.thumbnail ? (
                                                <img src={`${BASE_URL}${c.thumbnail}`} alt={c.title}
                                                    className="rounded" style={{ width: 48, height: 48, objectFit: "cover" }} />
                                            ) : (
                                                <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                                                    style={{ width: 48, height: 48 }}>
                                                    <i className="bi bi-book text-primary"></i>
                                                </div>
                                            )}
                                            <div className="flex-grow-1">
                                                <div className="fw-semibold small">{c.title}</div>
                                            </div>
                                            <button className="btn btn-sm btn-outline-primary"
                                                onClick={() => navigate(`/course/view/${c._id}`)}>
                                                View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-link p-0 mt-3 small" onClick={() => setResult(null)}>
                                    Redeem another key
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Redemption form */}
                    {!result && (
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <label className="form-label fw-semibold">Key Code</label>
                                        <input
                                            type="text"
                                            className={`form-control form-control-lg text-center font-monospace ${error ? "is-invalid" : ""}`}
                                            value={code}
                                            onChange={handleChange}
                                            placeholder="XXXXX-XXXXX-XXXXX"
                                            maxLength={17}
                                            autoFocus
                                            autoComplete="off"
                                            spellCheck={false}
                                            style={{ letterSpacing: "0.15em" }}
                                        />
                                        {error && <div className="invalid-feedback d-block">{error}</div>}
                                        <small className="text-muted">
                                            Keys are case-insensitive. Dashes are added automatically.
                                        </small>
                                    </div>

                                    <button type="submit" className="btn btn-primary w-100"
                                        disabled={loading || code.replace(/-/g, "").length !== 15}>
                                        {loading
                                            ? <><span className="spinner-border spinner-border-sm me-2" />Redeeming…</>
                                            : <><i className="bi bi-key me-2"></i>Redeem Key</>}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* My redeemed keys link */}
                    <p className="text-center text-muted small mt-3">
                        Looking for your course library?{" "}
                        <button className="btn btn-link p-0 small" onClick={() => navigate("/manage/courses")}>
                            Go to Courses
                        </button>
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}

export default RedeemKey;
