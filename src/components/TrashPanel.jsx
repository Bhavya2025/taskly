import { useState } from 'react'

const EXPIRE_DAYS = 15

function daysAgo(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function daysLeft(iso) {
  return Math.max(0, EXPIRE_DAYS - daysAgo(iso))
}

export default function TrashPanel({ trashedProjects, onRestore, onPermanentDelete, onEmptyTrash, onClose }) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [confirmId, setConfirmId]       = useState(null)  // project id to perm-delete

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>🗑️</span>
            <span style={s.headerTitle}>Trash</span>
            {trashedProjects.length > 0 && (
              <span style={s.badge}>{trashedProjects.length}</span>
            )}
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={s.subNote}>
          Projects are permanently deleted after {EXPIRE_DAYS} days. Restore anytime before then.
        </p>

        {/* Empty trash button */}
        {trashedProjects.length > 0 && (
          <div style={s.topActions}>
            {confirmEmpty ? (
              <div style={s.inlineConfirm}>
                <span style={s.inlineConfirmText}>Empty all trash?</span>
                <button style={s.inlineConfirmYes} onClick={() => { setConfirmEmpty(false); onEmptyTrash() }}>
                  Yes, delete all
                </button>
                <button style={s.inlineConfirmNo} onClick={() => setConfirmEmpty(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button style={s.emptyBtn} onClick={() => setConfirmEmpty(true)}>
                Empty trash
              </button>
            )}
          </div>
        )}

        {/* Project list */}
        <div style={s.list}>
          {trashedProjects.length === 0 ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>✨</div>
              <p style={s.emptyText}>Trash is empty</p>
            </div>
          ) : (
            trashedProjects.map(project => {
              const ago  = daysAgo(project.deletedAt)
              const left = daysLeft(project.deletedAt)
              const urgent = left <= 3

              return (
                <div key={project.id} style={s.row}>
                  <span style={{ ...s.rowEmoji, background: project.color + '22' }}>
                    {project.emoji}
                  </span>
                  <div style={s.rowInfo}>
                    <div style={s.rowName}>{project.name}</div>
                    <div style={{ ...s.rowMeta, color: urgent ? '#e05252' : 'var(--text-3)' }}>
                      Deleted {ago === 0 ? 'today' : `${ago}d ago`}
                      {' · '}
                      {left === 0
                        ? 'Expires today'
                        : `${left}d left`}
                    </div>
                  </div>
                  <div style={s.rowActions}>
                    <button style={s.restoreBtn} onClick={() => onRestore(project.id)} title="Restore">
                      ↩ Restore
                    </button>
                    {confirmId === project.id ? (
                      <>
                        <button style={s.confirmDeleteBtn} onClick={() => { setConfirmId(null); onPermanentDelete(project.id) }}>
                          Delete forever
                        </button>
                        <button style={s.cancelSmBtn} onClick={() => setConfirmId(null)}>✕</button>
                      </>
                    ) : (
                      <button style={s.deleteBtn} onClick={() => setConfirmId(project.id)} title="Delete forever">
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'var(--bg-overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    padding: '24px',
  },
  panel: {
    width: '100%', maxWidth: '460px',
    background: 'var(--bg-card)',
    border: 'var(--chrome-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    display: 'flex', flexDirection: 'column',
    maxHeight: '80vh',
    overflow: 'hidden',
    animation: 'modalPop 0.18s ease',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 10px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  headerIcon: { fontSize: '18px' },
  headerTitle: {
    fontSize: '15px', fontWeight: 700, color: 'var(--text-1)',
  },
  badge: {
    fontSize: '11px', fontWeight: 700,
    background: 'var(--bg-hover)',
    color: 'var(--text-2)',
    borderRadius: '10px', padding: '1px 7px',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-3)', cursor: 'pointer', fontSize: '15px', padding: '4px',
  },
  subNote: {
    fontSize: '11px', color: 'var(--text-3)',
    padding: '0 20px 10px',
    flexShrink: 0,
  },
  topActions: {
    padding: '0 20px 10px',
    flexShrink: 0,
  },
  emptyBtn: {
    fontSize: '12px', fontWeight: 600,
    color: '#e05252', background: 'none',
    border: '1px solid #e05252',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 12px', cursor: 'pointer',
  },
  inlineConfirm: {
    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
  },
  inlineConfirmText: {
    fontSize: '12px', color: 'var(--text-1)', fontWeight: 600,
  },
  inlineConfirmYes: {
    fontSize: '12px', fontWeight: 700,
    background: '#e05252', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-sm)',
    padding: '5px 10px', cursor: 'pointer',
  },
  inlineConfirmNo: {
    fontSize: '12px', color: 'var(--text-2)',
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 10px', cursor: 'pointer',
  },
  list: {
    overflowY: 'auto',
    flex: 1,
    padding: '0 20px 16px',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 0',
    gap: '8px',
  },
  emptyIcon: { fontSize: '28px' },
  emptyText: {
    fontSize: '13px', color: 'var(--text-3)',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 0',
    borderBottom: '0.5px solid var(--border)',
  },
  rowEmoji: {
    width: 36, height: 36, borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', flexShrink: 0,
  },
  rowInfo: {
    flex: 1, minWidth: 0,
  },
  rowName: {
    fontSize: '13px', fontWeight: 600, color: 'var(--text-1)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  rowMeta: {
    fontSize: '11px', marginTop: '2px',
  },
  rowActions: {
    display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
  },
  restoreBtn: {
    fontSize: '11px', fontWeight: 600,
    color: 'var(--accent)', background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px', cursor: 'pointer',
  },
  deleteBtn: {
    fontSize: '14px', background: 'none', border: 'none',
    color: 'var(--text-3)', cursor: 'pointer', padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
  },
  confirmDeleteBtn: {
    fontSize: '11px', fontWeight: 700,
    background: '#e05252', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-sm)',
    padding: '4px 8px', cursor: 'pointer',
  },
  cancelSmBtn: {
    fontSize: '11px', color: 'var(--text-3)',
    background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px',
  },
}
