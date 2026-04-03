// ─── InformationModal ─────────────────────────────────────────────────────────
//
//  A generic display modal for showing structured information about any entity.
//  Extracted and generalised from the Users.js inline user-detail modal.
//
//  Props
//  ─────
//  show          boolean                         — controls visibility
//  onClose       () => void                      — called on close / backdrop click
//
//  title         string                          — modal header title (e.g. "User Details")
//  headerClass   string                          — Bootstrap bg class for header
//                                                  default: "bg-primary text-white"
//
//  avatar        { url?, initials?, size? }      — optional avatar config
//    url         string | null                   — image URL (rendered via <img> or AuthImage)
//    initials    string                          — fallback 1–2 char initials
//    size        number                          — px size of circle, default 96
//    bgClass     string                          — Bootstrap bg class, default "bg-primary"
//
//  name          string                          — large name displayed below avatar
//  subtitle      string                          — smaller grey text below name
//
//  fields        Array<FieldDef>                 — rows in the info table
//    FieldDef:
//      label     string                          — left-column label
//      value     any                             — right-column raw value
//      render    (value) => ReactNode            — optional custom renderer
//      hide      boolean                         — if true, skip rendering this row
//
//  actions       Array<ActionDef>                — footer buttons (right-aligned)
//    ActionDef:
//      label     string
//      variant   string                          — Bootstrap btn variant, e.g. "btn-danger"
//      icon      ReactNode                       — optional icon node
//      onClick   () => void
//      hide      boolean                         — if true, skip rendering this action
//
//  children      ReactNode                       — optional extra content below the table
//
// ─── Usage example ────────────────────────────────────────────────────────────
//
//  <InformationModal
//      show={showModal}
//      onClose={closeModal}
//      title="User Details"
//      avatar={{ url: getProfilePictureUrl(user), initials: user.nickname?.[0]?.toUpperCase() }}
//      name={user.nickname}
//      subtitle={user.email}
//      fields={[
//          { label: "Email",      value: user.email },
//          { label: "Role",       value: roleName,
//            render: (v) => <span className={`badge rounded-pill ${badgeColor(v)}`}>{v}</span> },
//          { label: "Created At", value: user.createdAt, render: formatDate },
//          { label: "Updated At", value: user.updatedAt, render: formatDate },
//      ]}
//      actions={[
//          { label: "Close",  variant: "btn-outline-secondary", onClick: closeModal },
//          { label: "Edit",   variant: "btn-warning text-dark", onClick: () => { closeModal(); handleEdit(user); } },
//          { label: "Delete", variant: "btn-danger",            onClick: () => { closeModal(); handleDelete(user); } },
//      ]}
//  />

// ─── Component ────────────────────────────────────────────────────────────────

export function InformationModal({
    // visibility
    show,
    onClose,

    // header
    title       = "Details",
    headerClass = "bg-primary text-white",

    // avatar block
    avatar = null,
    //  avatar shape: { url, initials, size, bgClass }

    // identity
    name     = "",
    subtitle = "",

    // table rows
    fields = [],
    //  field shape: { label, value, render, hide }

    // footer actions
    actions = [],
    //  action shape: { label, variant, icon, onClick, hide }

    // extra slot
    children,
}) {
    if (!show) return null;

    // ── Avatar renderer ───────────────────────────────────────────────────────
    const renderAvatar = () => {
        if (!avatar) return null;

        const size    = avatar.size    ?? 96;
        const bgClass = avatar.bgClass ?? "bg-primary";
        const initial = avatar.initials ?? "?";

        const circleStyle = { width: size, height: size, fontSize: size < 48 ? "0.8rem" : "1.6rem" };

        return (
            <div className="text-center mb-4">
                {avatar.url ? (
                    <img
                        src={avatar.url}
                        alt={name || "avatar"}
                        className="rounded-circle flex-shrink-0"
                        style={{ width: size, height: size, objectFit: "cover" }}
                        onError={(e) => {
                            // fall back to initials div on load error
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display = "flex";
                        }}
                    />
                ) : null}

                {/* Initials fallback — always in DOM, hidden when img loads fine */}
                <div
                    className={`rounded-circle ${bgClass} d-flex align-items-center justify-content-center text-white flex-shrink-0 mx-auto`}
                    style={{
                        ...circleStyle,
                        display: avatar.url ? "none" : "flex",
                    }}
                >
                    {initial}
                </div>
            </div>
        );
    };

    // ── Field rows ────────────────────────────────────────────────────────────
    const visibleFields = fields.filter((f) => !f.hide);

    // ── Action buttons ────────────────────────────────────────────────────────
    const visibleActions = actions.filter((a) => !a.hide);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="modal-backdrop fade show"
                style={{ zIndex: 1040 }}
                onClick={onClose}
            />

            {/* Modal shell */}
            <div
                className="modal fade show d-block"
                tabIndex="-1"
                aria-modal="true"
                role="dialog"
                style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 1050,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                }}
            >
                <div
                    className="modal-dialog modal-dialog-centered"
                    style={{ pointerEvents: "auto" }}
                >
                    <div className="card border-0 shadow-lg rounded-3 overflow-hidden">

                        {/* Header */}
                        <div className={`card-header border-0 d-flex align-items-center justify-content-between py-3 px-4 ${headerClass}`}>
                            <h5 className="mb-0 fw-semibold">{title}</h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white btn-sm"
                                onClick={onClose}
                                aria-label="Close"
                            />
                        </div>

                        {/* Body */}
                        <div className="card-body p-4">

                            {/* Avatar */}
                            {renderAvatar()}

                            {/* Name + subtitle */}
                            {(name || subtitle) && (
                                <div className="text-center mb-3">
                                    {name     && <h5 className="fw-bold mb-1">{name}</h5>}
                                    {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
                                </div>
                            )}

                            {/* Fields table */}
                            {visibleFields.length > 0 && (
                                <table className="table table-sm table-borderless mb-0">
                                    <tbody>
                                        {visibleFields.map((field, idx) => (
                                            <tr key={idx}>
                                                <td
                                                    className="text-muted fw-semibold small text-uppercase py-2"
                                                    style={{ width: "35%" }}
                                                >
                                                    {field.label}
                                                </td>
                                                <td className="py-2">
                                                    {field.render
                                                        ? field.render(field.value)
                                                        : (field.value ?? "—")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Optional extra content slot */}
                            {children}
                        </div>

                        {/* Footer — only rendered when actions are provided */}
                        {visibleActions.length > 0 && (
                            <div className="card-footer bg-white border-top d-flex justify-content-end gap-2 py-3 px-4">
                                {visibleActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`btn btn-sm ${action.variant ?? "btn-secondary"}`}
                                        onClick={action.onClick}
                                    >
                                        {action.icon && (
                                            <span className="me-1">{action.icon}</span>
                                        )}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
}

export default InformationModal;