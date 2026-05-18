import { useRef, useState } from 'react'
import { AnimalSVG } from './UserAvatar'
import { AVATAR_ANIMALS, AVATAR_COLORS, uploadAvatar, deleteAvatar } from '../lib/supabase'

export default function ProfilePanel({ user, profile, onProfileUpdate, onSignOut, onClose, globalTheme, onThemeChange, soundEnabled, onSoundToggle }) {
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [displayName, setDisplayName]     = useState(profile?.display_name || user?.email?.split('@')[0] || '')
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [uploading, setUploading]          = useState(false)
  const [uploadError, setUploadError]      = useState('')
  const fileInputRef = useRef(null)

  const color     = profile?.avatar_color  || '#6c63ff'
  const animal    = profile?.avatar_animal || 'cat'
  const avatarUrl = profile?.avatar_url    || null

  function handleNameBlur() {
    const trimmed = displayName.trim()
    if (trimmed && trimmed !== profile?.display_name) {
      onProfileUpdate({ display_name: trimmed })
    }
  }

  function handleSignOut() {
    onClose()
    onSignOut()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Please choose an image file.'); return }
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadAvatar(user.id, file)
      onProfileUpdate({ avatar_url: url })
    } catch (err) {
      setUploadError('Upload failed. Check your Supabase storage bucket.')
      console.error(err)
    } finally {
      setUploading(false)
      // reset so same file can be re-selected
      e.target.value = ''
    }
  }

  async function handleRemovePhoto() {
    setUploading(true)
    try {
      await deleteAvatar(user.id)
      onProfileUpdate({ avatar_url: null })
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>Account</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Avatar */}
        <div style={s.avatarWrap}>
          <button
            onClick={() => setEditingAvatar(v => !v)}
            style={{ ...s.bigAvatar, background: avatarUrl ? 'transparent' : color }}
            title="Change avatar"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar"
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
            ) : (
              <AnimalSVG animal={animal} size={72} />
            )}
            <span style={s.editBadge}>✏</span>
          </button>
          <span style={s.avatarHint}>Click to customise</span>

          {/* Photo upload / remove row */}
          <div style={s.photoRow}>
            <button
              style={s.photoBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : avatarUrl ? '🔄 Change photo' : '📷 Upload photo'}
            </button>
            {avatarUrl && (
              <button style={{ ...s.photoBtn, color: '#e05252' }} onClick={handleRemovePhoto} disabled={uploading}>
                ✕ Remove
              </button>
            )}
          </div>
          {uploadError && <p style={s.uploadError}>{uploadError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Avatar editor (animal + colour — only shown when no custom photo) */}
        {editingAvatar && (
          <div style={s.avatarEditor}>
            {avatarUrl ? (
              <p style={{ ...s.editorLabel, marginTop: 10 }}>Remove your photo first to pick an animal avatar.</p>
            ) : (
              <>
                <p style={s.editorLabel}>Animal</p>
                <div style={s.animalGrid}>
                  {AVATAR_ANIMALS.map(a => (
                    <button
                      key={a}
                      onClick={() => onProfileUpdate({ avatar_animal: a })}
                      style={{
                        ...s.animalBtn,
                        background: color,
                        outline: a === animal ? `3px solid ${color}` : 'none',
                        outlineOffset: '2px',
                      }}
                      title={a}
                    >
                      <AnimalSVG animal={a} size={36} />
                    </button>
                  ))}
                </div>

                <p style={s.editorLabel}>Colour</p>
                <div style={s.colorRow}>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => onProfileUpdate({ avatar_color: c })}
                      style={{
                        ...s.colorSwatch,
                        background: c,
                        outline: c === color ? '3px solid var(--text-1)' : 'none',
                        outlineOffset: '2px',
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Name + email */}
        <div style={s.section}>
          <label style={s.fieldLabel}>Display name</label>
          <input
            style={s.nameInput}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Your name"
          />
          <label style={{ ...s.fieldLabel, marginTop: '10px' }}>Email</label>
          <p style={s.email}>{user?.email}</p>
        </div>

        <div style={s.divider} />

        {/* Settings */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Settings</p>

          <div style={s.settingRow}>
            <span style={s.settingLabel}>Theme</span>
            <div style={s.themePills}>
              {['dark','light'].map(t => (
                <button
                  key={t}
                  onClick={() => { onThemeChange(t); onProfileUpdate({ global_theme: t }) }}
                  style={{
                    ...s.themePill,
                    background: globalTheme === t ? 'var(--accent)' : 'var(--bg-hover)',
                    color: globalTheme === t ? '#fff' : 'var(--text-2)',
                  }}
                >
                  {t === 'dark' ? '🌙 Dark' : '☀ Light'}
                </button>
              ))}
            </div>
          </div>

          <div style={s.settingRow}>
            <span style={s.settingLabel}>Sounds</span>
            <button
              onClick={() => { onSoundToggle(); onProfileUpdate({ sound_enabled: !soundEnabled }) }}
              style={{
                ...s.toggleBtn,
                background: soundEnabled ? 'var(--accent)' : 'var(--bg-hover)',
              }}
            >
              <span style={{
                ...s.toggleThumb,
                transform: soundEnabled ? 'translateX(18px)' : 'translateX(2px)',
              }} />
            </button>
          </div>
        </div>

        <div style={s.divider} />

        {/* Sign out */}
        {confirmSignOut ? (
          <div style={s.confirmWrap}>
            <p style={s.confirmText}>Sign out of Taskly?</p>
            <div style={s.confirmBtns}>
              <button style={s.cancelBtn} onClick={() => setConfirmSignOut(false)}>Cancel</button>
              <button style={s.signOutConfirmBtn} onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        ) : (
          <button style={s.signOutBtn} onClick={() => setConfirmSignOut(true)}>
            Sign out
          </button>
        )}

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
    width: '100%', maxWidth: '360px',
    background: 'var(--bg-card)',
    border: 'var(--chrome-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 0',
  },
  headerTitle: {
    fontSize: '15px', fontWeight: 700, color: 'var(--text-1)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-3)',
    cursor: 'pointer', fontSize: '15px', padding: '4px',
  },
  avatarWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px 20px 8px',
    gap: '6px',
  },
  bigAvatar: {
    width: 80, height: 80,
    borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    transition: 'transform 0.15s',
    padding: 0,
  },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2,
    background: 'var(--bg-card)',
    borderRadius: '50%',
    fontSize: '10px',
    width: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  avatarHint: {
    fontSize: '11px', color: 'var(--text-3)',
  },
  photoRow: {
    display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center',
  },
  photoBtn: {
    fontSize: '11px', fontWeight: 600, color: 'var(--accent)',
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    borderRadius: 'var(--radius-sm)', padding: '4px 10px',
    cursor: 'pointer',
  },
  uploadError: {
    fontSize: '11px', color: '#e05252', textAlign: 'center',
    maxWidth: '280px',
  },
  avatarEditor: {
    padding: '0 20px 12px',
    background: 'var(--bg-hover)',
    margin: '0 12px',
    borderRadius: 'var(--radius-md)',
  },
  editorLabel: {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '12px 0 8px',
  },
  animalGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
  },
  animalBtn: {
    width: 44, height: 44, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 0,
    transition: 'transform 0.1s',
  },
  colorRow: {
    display: 'flex', flexWrap: 'wrap', gap: '6px',
    marginBottom: '4px',
  },
  colorSwatch: {
    width: 26, height: 26, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'transform 0.1s',
  },
  section: {
    padding: '12px 20px',
  },
  sectionTitle: {
    fontSize: '12px', fontWeight: 600, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '10px',
  },
  fieldLabel: {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'block', marginBottom: '4px',
  },
  nameInput: {
    width: '100%', background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px', color: 'var(--text-1)',
    fontSize: '14px', outline: 'none',
    boxSizing: 'border-box',
  },
  email: {
    fontSize: '13px', color: 'var(--text-2)', margin: '2px 0 0',
  },
  divider: {
    height: '1px', background: 'var(--border)', margin: '0 20px',
  },
  settingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0',
  },
  settingLabel: {
    fontSize: '14px', color: 'var(--text-1)',
  },
  themePills: {
    display: 'flex', gap: '4px',
  },
  themePill: {
    fontSize: '12px', fontWeight: 600,
    padding: '4px 10px', border: 'none',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    transition: 'background 0.15s',
  },
  toggleBtn: {
    width: 40, height: 22, borderRadius: 11, border: 'none',
    cursor: 'pointer', position: 'relative',
    transition: 'background 0.2s', padding: 0,
  },
  toggleThumb: {
    position: 'absolute', top: 3,
    width: 16, height: 16, borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
    display: 'block',
  },
  signOutBtn: {
    margin: '12px 20px 16px',
    padding: '9px 0', width: 'calc(100% - 40px)',
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-2)', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer',
  },
  confirmWrap: {
    padding: '12px 20px 16px',
  },
  confirmText: {
    fontSize: '13px', color: 'var(--text-1)',
    marginBottom: '10px', textAlign: 'center',
  },
  confirmBtns: {
    display: 'flex', gap: '8px',
  },
  cancelBtn: {
    flex: 1, padding: '9px 0', background: 'none',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-2)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  signOutConfirmBtn: {
    flex: 1, padding: '9px 0', background: '#e05252',
    border: 'none', borderRadius: 'var(--radius-sm)',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
}
