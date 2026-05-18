import { useState, useRef } from 'react'
import { uploadProjectImage, deleteProjectImage } from '../lib/supabase'

const PROJECT_ICONS = [
  '📝','💻','📚','📣','🖌️','💰','✈️','🌿','💼','🔎',
  '🎉','🏠','🛍️','🍽️','📷','⚖️','🚀','🎮','🎵','📦',
  '🧪','🎓','🏋️','🤝','📊','🗓️','🔧','🌍','💡','🎯',
]

const THEMES = [
  { id: null,     label: 'Follow global', icon: '🌐' },
  { id: 'dark',   label: 'Dark',          icon: '🌑' },
  { id: 'light',  label: 'Light',         icon: '☀️' },
]

export default function ProjectSettingsModal({
  project,
  user,
  onClose,
  onRename,
  onImageUpdate,
  onProjectThemeChange,
  onDeleteRequest,
}) {
  const [tab, setTab]             = useState('icon')
  const [name, setName]           = useState(project?.name || '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  if (!project) return null

  const hasCustomImage = !!project.image_url

  function handleRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name) {
      onRename(project.id, trimmed)
    }
    onClose()
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadProjectImage(project.id, user.id, file)
      onImageUpdate(project.id, url, null)
    } catch (err) {
      setUploadError('Upload failed. Check your Supabase storage bucket.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemoveImage() {
    if (user) await deleteProjectImage(project.id, user.id)
    onImageUpdate(project.id, null, project.emoji)
  }

  function handleEmojiSelect(em) {
    onImageUpdate(project.id, null, em)
    onClose()
  }

  return (
    <div className="ps-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ps-modal">

        {/* Header */}
        <div className="ps-modal__header">
          <div className="ps-modal__preview">
            <span
              className="ps-modal__preview-icon"
              style={{ background: project.color + '22', borderColor: project.color + '44' }}
            >
              {project.image_url
                ? <img src={project.image_url} alt="" className="ps-modal__preview-img" />
                : project.emoji}
            </span>
            <div className="ps-modal__preview-text">
              <div className="ps-modal__preview-name">{project.name}</div>
              <div className="ps-modal__preview-sub">
                {project.taskCount ?? 0} task{(project.taskCount ?? 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button className="ps-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="ps-modal__tabs">
          {[
            { id: 'icon',   label: '🖼 Icon'   },
            { id: 'rename', label: '✏️ Rename'  },
            { id: 'theme',  label: '🎨 Theme'  },
          ].map(t => (
            <button
              key={t.id}
              className={`ps-modal__tab ${tab === t.id ? 'ps-modal__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="ps-modal__body">

          {/* ── Icon tab ─────────────────────────────────────────────────── */}
          {tab === 'icon' && (
            <>
              <p className="ps-modal__section-label">Choose an emoji</p>
              <div className="ps-emoji-grid">
                {PROJECT_ICONS.map(em => (
                  <button
                    key={em}
                    className={`ps-emoji-btn ${!hasCustomImage && project.emoji === em ? 'ps-emoji-btn--active' : ''}`}
                    onClick={() => handleEmojiSelect(em)}
                    title={em}
                  >
                    {em}
                  </button>
                ))}
              </div>

              <div className="ps-divider" />
              <p className="ps-modal__section-label">Or upload a custom image</p>

              {hasCustomImage ? (
                <div className="ps-image-row">
                  <img src={project.image_url} alt="Project" className="ps-image-preview" />
                  <button className="ps-image-remove" onClick={handleRemoveImage}>
                    ✕ Remove image
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className="ps-upload-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={!user || uploading}
                  >
                    {uploading ? '⏳ Uploading…' : '📷 Upload image'}
                  </button>
                  {!user && (
                    <p className="ps-upload-note">Sign in to upload custom images</p>
                  )}
                </>
              )}
              {uploadError && <p className="ps-upload-error">{uploadError}</p>}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </>
          )}

          {/* ── Rename tab ───────────────────────────────────────────────── */}
          {tab === 'rename' && (
            <>
              <p className="ps-modal__section-label">Project name</p>
              <input
                className="ps-rename-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') onClose()
                }}
                autoFocus
                maxLength={60}
                placeholder="Project name"
              />
              <div className="ps-modal__actions">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={handleRename}
                  disabled={!name.trim()}
                >
                  Save name
                </button>
              </div>
            </>
          )}

          {/* ── Theme tab ────────────────────────────────────────────────── */}
          {tab === 'theme' && (
            <>
              <p className="ps-modal__section-label">Project theme</p>
              <p className="ps-theme-note">Override the global theme just for this project.</p>
              <div className="ps-theme-options">
                {THEMES.map(t => {
                  const isActive = (project.theme ?? null) === t.id
                  return (
                    <button
                      key={String(t.id)}
                      className={`ps-theme-opt ${isActive ? 'ps-theme-opt--active' : ''}`}
                      onClick={() => { onProjectThemeChange(t.id); onClose() }}
                    >
                      <span className="ps-theme-opt__icon">{t.icon}</span>
                      <span className="ps-theme-opt__label">{t.label}</span>
                      {isActive && <span className="ps-theme-opt__check">✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — always visible delete */}
        <div className="ps-modal__footer">
          <button
            className="ps-delete-btn"
            onClick={() => { onClose(); onDeleteRequest(project) }}
          >
            🗑️ Delete project
          </button>
        </div>

      </div>
    </div>
  )
}
