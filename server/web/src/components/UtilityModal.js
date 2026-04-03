import { useState, useEffect } from "react";

// ─── UtilityModal ─────────────────────────────────────────────────────────────
//
//  A single modal component covering four interaction types:
//
//  type="confirm"  — ask yes/no before an action
//                    props: title, message, confirmLabel, cancelLabel, onConfirm, onCancel
//
//  type="input"    — prompt the user for a text value
//                    props: title, message, inputLabel, inputPlaceholder, inputType,
//                           submitLabel, cancelLabel, onSubmit(value), onCancel
//
//  type="info"     — display a non-destructive notice or status message
//                    props: title, message, okLabel, onClose
//
//  type="delete"   — destructive confirmation that requires the user to retype a
//                    specific token (e.g. an email address) before proceeding
//                    props: title, message, confirmToken, tokenLabel, tokenPlaceholder,
//                           deleteLabel, cancelLabel, onDelete, onCancel
//
//  All types share:
//    show          — boolean, controls visibility
//    type          — "confirm" | "input" | "info" | "delete"
//
// Usage examples
// ──────────────
//  // Confirm
//  <UtilityModal
//      show={!!confirm}
//      type="confirm"
//      title="Approve submission?"
//      message={`Approve "${name}"?`}
//      danger
//      onConfirm={handleConfirm}
//      onCancel={() => setConfirm(null)}
//  />
//
//  // Input
//  <UtilityModal
//      show={showInput}
//      type="input"
//      title="Rename item"
//      message="Enter a new name for this item."
//      inputLabel="Name"
//      inputPlaceholder="e.g. Project Alpha"
//      onSubmit={(val) => handleRename(val)}
//      onCancel={() => setShowInput(false)}
//  />
//
//  // Info
//  <UtilityModal
//      show={showInfo}
//      type="info"
//      title="Session extended"
//      message="Your session has been renewed for another 30 minutes."
//      onClose={() => setShowInfo(false)}
//  />
//
//  // Delete
//  <UtilityModal
//      show={showDelete}
//      type="delete"
//      title="Delete user"
//      message={`You are about to permanently delete "${user.nickname}". This cannot be undone.`}
//      confirmToken={user.email}
//      tokenLabel="Type the user's email to confirm"
//      tokenPlaceholder={user.email}
//      onDelete={() => handleDelete(user)}
//      onCancel={() => setShowDelete(false)}
//  />

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const IconInfo = () => (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>
);

const IconWarning = () => (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
    </svg>
);

const IconTrash = () => (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3h11V2h-11v1z"/>
    </svg>
);

// ─── TYPE CONFIGS ─────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
    confirm: {
        headerClass: (danger) => danger ? "bg-danger text-white" : "bg-primary text-white",
        iconColor:   (danger) => danger ? "text-danger" : "text-primary",
        Icon: IconWarning,
    },
    input: {
        headerClass: () => "bg-primary text-white",
        iconColor:   () => "text-primary",
        Icon: IconInfo,
    },
    info: {
        headerClass: () => "bg-primary text-white",
        iconColor:   () => "text-primary",
        Icon: IconInfo,
    },
    delete: {
        headerClass: () => "bg-danger text-white",
        iconColor:   () => "text-danger",
        Icon: IconTrash,
    },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function UtilityModal({
    // shared
    show,
    type = "confirm",
    title,
    message,

    // confirm / delete shared styling
    danger = false,

    // confirm
    confirmLabel = "Confirm",
    cancelLabel  = "Cancel",
    onConfirm,
    onCancel,

    // input
    inputLabel       = "",
    inputPlaceholder = "",
    inputType        = "text",
    submitLabel      = "Submit",
    onSubmit,

    // info
    okLabel = "OK",
    onClose,

    // delete
    confirmToken      = "",
    tokenLabel        = "Type the value below to confirm",
    tokenPlaceholder  = "",
    deleteLabel       = "Delete",
    onDelete,
}) {
    const [inputValue, setInputValue] = useState("");
    const [tokenValue, setTokenValue] = useState("");

    // Reset internal state when modal opens
    useEffect(() => {
        if (show) {
            setInputValue("");
            setTokenValue("");
        }
    }, [show]);

    if (!show) return null;

    const cfg    = TYPE_CONFIG[type] ?? TYPE_CONFIG.confirm;
    const isDanger = type === "delete" || danger;

    // ── Close handler: choose the correct dismissal callback ──────────────────
    const handleClose = () => {
        if (type === "info")             onClose?.();
        else if (type === "input")       onCancel?.();
        else if (type === "delete")      onCancel?.();
        else                             onCancel?.();
    };

    // ── Submit handler ────────────────────────────────────────────────────────
    const handleSubmit = () => {
        if (type === "input")  onSubmit?.(inputValue.trim());
        if (type === "confirm") onConfirm?.();
        if (type === "delete" && tokenValue.trim() === confirmToken) onDelete?.();
    };

    const deleteTokenMatch = type === "delete" && tokenValue.trim() === confirmToken;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="modal-backdrop fade show"
                style={{ zIndex: 1040 }}
                onClick={handleClose}
            />

            {/* Modal shell */}
            <div
                className="modal fade show d-block"
                style={{ zIndex: 1050 }}
                tabIndex="-1"
                aria-modal="true"
                role="dialog"
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg">

                        {/* Header */}
                        <div className={`modal-header border-0 ${cfg.headerClass(isDanger)}`}>
                            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                <cfg.Icon />
                                {title}
                            </h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white btn-sm"
                                onClick={handleClose}
                                aria-label="Close"
                            />
                        </div>

                        {/* Body */}
                        <div className="modal-body py-4 px-4">
                            {message && (
                                <p className="mb-0" style={{ lineHeight: 1.6 }}>
                                    {message}
                                </p>
                            )}

                            {/* Input type — text field */}
                            {type === "input" && (
                                <div className="mt-3">
                                    {inputLabel && (
                                        <label className="form-label fw-semibold small text-muted text-uppercase mb-1">
                                            {inputLabel}
                                        </label>
                                    )}
                                    <input
                                        autoFocus
                                        type={inputType}
                                        className="form-control"
                                        placeholder={inputPlaceholder}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                    />
                                </div>
                            )}

                            {/* Delete type — confirmation token input */}
                            {type === "delete" && (
                                <div className="mt-3">
                                    <label className="form-label small text-muted mb-1">
                                        {tokenLabel}:&nbsp;
                                        <span className="fw-semibold text-dark">{confirmToken}</span>
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        className={`form-control ${tokenValue && !deleteTokenMatch ? "is-invalid" : ""} ${deleteTokenMatch ? "is-valid" : ""}`}
                                        placeholder={tokenPlaceholder || confirmToken}
                                        value={tokenValue}
                                        onChange={(e) => setTokenValue(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && deleteTokenMatch && handleSubmit()}
                                    />
                                    {tokenValue && !deleteTokenMatch && (
                                        <div className="invalid-feedback">Doesn't match. Please try again.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="modal-footer border-top pt-3">

                            {/* INFO — single close button */}
                            {type === "info" && (
                                <button className="btn btn-primary px-4" onClick={onClose}>
                                    {okLabel}
                                </button>
                            )}

                            {/* CONFIRM */}
                            {type === "confirm" && (
                                <>
                                    <button className="btn btn-outline-secondary" onClick={onCancel}>
                                        {cancelLabel}
                                    </button>
                                    <button
                                        className={`btn ${isDanger ? "btn-danger" : "btn-primary"} px-4`}
                                        onClick={handleSubmit}
                                    >
                                        {confirmLabel}
                                    </button>
                                </>
                            )}

                            {/* INPUT */}
                            {type === "input" && (
                                <>
                                    <button className="btn btn-outline-secondary" onClick={onCancel}>
                                        {cancelLabel}
                                    </button>
                                    <button
                                        className="btn btn-primary px-4"
                                        onClick={handleSubmit}
                                        disabled={!inputValue.trim()}
                                    >
                                        {submitLabel}
                                    </button>
                                </>
                            )}

                            {/* DELETE */}
                            {type === "delete" && (
                                <>
                                    <button className="btn btn-outline-secondary" onClick={onCancel}>
                                        {cancelLabel}
                                    </button>
                                    <button
                                        className="btn btn-danger px-4"
                                        onClick={handleSubmit}
                                        disabled={!deleteTokenMatch}
                                    >
                                        {deleteLabel}
                                    </button>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}

export default UtilityModal;