import { useState } from 'react'

const PRIORITIES = [
  { value: 'none',   label: 'None',   color: null },
  { value: 'low',    label: 'Low',    color: '#6bcb77' },
  { value: 'medium', label: 'Med',    color: '#ffd93d' },
  { value: 'high',   label: 'High',   color: '#ff6b6b' },
]

export default function MobileTaskSheet({
  task,
  columns,
  defaultColumnId,
  onSave,
  onClose,
  onDelete,
  sounds,
}) {
  const isEdit = Boolean(task)

  const [title,       setTitle]       = useState(task?.title       ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority,    setPriority]    = useState(task?.priority    ?? 'none')
  const [columnId,    setColumnId]    = useState(task?.columnId    ?? defaultColumnId ?? columns[0]?.id)
  const [dueDate,     setDueDate]     = useState(task?.dueDate     ? task.dueDate.slice(0, 10) : '')
  const [tags,        setTags]        = useState((task?.tags ?? []).join(', '))
  const [emoji,       setEmoji]       = useState(task?.emoji       ?? '')
  const [showDelete,  setShowDelete]  = useState(false)

  function handleSave() {
    if (!title.trim()) return
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    onSave({
      title:       title.trim(),
      description: description.trim(),
      priority,
      columnId,
      dueDate:     dueDate || null,
      tags:        tagList,
      emoji:       emoji.trim(),
    })
    sounds?.playAdd?.()
  }

  return (
    <div className="mob-overlay" onClick={onClose}>
      <div className="mob-task-sheet" onClick={e => e.stopPropagation()}>
        <div className="mob-sheet__drag-handle" />

        <div className="mob-sheet__header">
          <h2 className="mob-sheet__title">{isEdit ? 'Edit task' : 'New task'}</h2>
          <button className="mob-sheet__x" onClick={onClose}>✕</button>
        </div>

        {/* Title + emoji row */}
        <div className="mob-form__group" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <label className="mob-form__label">Title *</label>
            <input
              className="mob-form__input"
              placeholder="What needs doing?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mob-form__label">Emoji</label>
            <input
              className="mob-form__input mob-form__input--sm"
              placeholder="🎯"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              maxLength={2}
              style={{ textAlign: 'center', fontSize: '20px', padding: '10px 8px' }}
            />
          </div>
        </div>

        {/* Column */}
        <div className="mob-form__group">
          <label className="mob-form__label">Column</label>
          <div className="mob-form__col-pills">
            {columns.map(col => (
              <button
                key={col.id}
                className={`mob-form__col-pill${columnId === col.id ? ' mob-form__col-pill--on' : ''}`}
                onClick={() => setColumnId(col.id)}
              >
                {col.title}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="mob-form__group">
          <label className="mob-form__label">Priority</label>
          <div className="mob-form__priority-row">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                className={`mob-form__priority-btn${priority === p.value ? ' mob-form__priority-btn--on' : ''}`}
                style={priority === p.value && p.color
                  ? { borderColor: p.color, color: p.color }
                  : priority === p.value
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                  : {}
                }
                onClick={() => setPriority(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mob-form__group">
          <label className="mob-form__label">Description</label>
          <textarea
            className="mob-form__textarea"
            placeholder="Add more details…"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Due date + Tags */}
        <div className="mob-form__row">
          <div className="mob-form__half">
            <div className="mob-form__group">
              <label className="mob-form__label">Due date</label>
              <input
                type="date"
                className="mob-form__input mob-form__input--date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mob-form__half">
            <div className="mob-form__group">
              <label className="mob-form__label">Tags</label>
              <input
                className="mob-form__input"
                placeholder="design, ux…"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mob-sheet__actions">
          {isEdit && onDelete && (
            <button
              className="mob-sheet__danger-btn"
              style={{ flex: '0 0 auto', width: 'auto', padding: '14px 16px' }}
              onClick={() => setShowDelete(true)}
            >
              🗑️
            </button>
          )}
          <button className="mob-sheet__cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="mob-sheet__primary-btn"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            {isEdit ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="mob-overlay" onClick={() => setShowDelete(false)}>
          <div className="mob-sheet mob-sheet--sm" onClick={e => e.stopPropagation()}>
            <div className="mob-sheet__drag-handle" />
            <div className="mob-sheet__confirm-icon">🗑️</div>
            <p className="mob-sheet__confirm-title">Delete this task?</p>
            <p className="mob-sheet__confirm-sub">This cannot be undone.</p>
            <div className="mob-sheet__actions">
              <button className="mob-sheet__cancel-btn" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                className="mob-sheet__danger-btn"
                onClick={() => { onDelete(); setShowDelete(false) }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
