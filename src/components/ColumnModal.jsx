import { useEffect, useRef, useState } from 'react'
import { COLUMN_COLOR_OPTIONS, COLUMN_ICON_OPTIONS, COLUMN_SOUND_OPTIONS } from '../utils/data'

export default function ColumnModal({ column, onSave, onClose, onPreviewSound }) {
  const nameRef = useRef(null)
  const isEdit = !!column

  const [form, setForm] = useState({
    title: column?.title || '',
    color: column?.color || COLUMN_COLOR_OPTIONS[0],
    icon: column?.icon || COLUMN_ICON_OPTIONS[0],
    soundPreset: column?.soundPreset || COLUMN_SOUND_OPTIONS[0].id,
  })

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    onSave({
      title: form.title.trim(),
      color: form.color,
      icon: form.icon,
      soundPreset: form.soundPreset,
    })
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal modal--column">
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Edit column' : 'New column'}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="column-preview" style={{ borderColor: form.color + '66' }}>
            <span className="column-preview__icon">{form.icon}</span>
            <div className="column-preview__text">
              <strong>{form.title || 'Column name'}</strong>
              <span>{COLUMN_SOUND_OPTIONS.find(option => option.id === form.soundPreset)?.label}</span>
            </div>
            <span className="column-preview__dot" style={{ background: form.color }} />
          </div>

          <div className="field">
            <label>Name</label>
            <input
              ref={nameRef}
              type="text"
              value={form.title}
              onChange={event => setField('title', event.target.value)}
              placeholder="Column name"
            />
          </div>

          <div className="field">
            <label>Dot color</label>
            <div className="column-color-grid">
              {COLUMN_COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${form.color === color ? 'color-swatch--active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setField('color', color)}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <label>Icon</label>
            <div className="create-modal__emojis">
              {COLUMN_ICON_OPTIONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  className={`emoji-opt ${form.icon === icon ? 'emoji-opt--active' : ''}`}
                  onClick={() => setField('icon', icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Column sound</label>
            <div className="sound-choice-grid">
              {COLUMN_SOUND_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`sound-choice ${form.soundPreset === option.id ? 'sound-choice--active' : ''}`}
                  onClick={() => {
                    setField('soundPreset', option.id)
                    onPreviewSound?.(option.id)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {isEdit ? 'Save column' : 'Create column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
