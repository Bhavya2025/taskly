import { useState, useEffect, useRef } from 'react'
import DatePicker from './DatePicker'
import { formatDate } from '../utils/dateUtils'
import { TASK_COLOR_OPTIONS, TASK_EMOJI_OPTIONS } from '../utils/data'

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: '#e85555' },
  { value: 'high',   label: 'High',   color: '#e8924a' },
  { value: 'medium', label: 'Medium', color: '#d4b84a' },
  { value: 'low',    label: 'Low',    color: '#4a9e6b' },
]

export default function TaskModal({ task, columns, defaultColumnId, onSave, onClose }) {
  const isEdit   = !!task
  const titleRef = useRef(null)
  const dateRef  = useRef(null)

  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    priority:    task?.priority    || 'medium',
    columnId:    task?.columnId    || defaultColumnId || columns[0]?.id,
    dueDate:     task?.dueDate     || '',
    tags:        task?.tags?.join(', ') || '',
    emoji:       task?.emoji       || '',
    accentColor: task?.accentColor || '',
  })

  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') { if (showDatePicker) setShowDatePicker(false); else onClose() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showDatePicker])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      title:       form.title.trim(),
      description: form.description.trim(),
      priority:    form.priority,
      columnId:    form.columnId,
      dueDate:     form.dueDate || null,
      tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
      emoji:       form.emoji,
      accentColor: form.accentColor || '',
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Edit task' : 'New task'}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="field">
            <label>Description <span className="field__hint">optional</span></label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Add details..."
              rows={3}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Task emoji</label>
              <div className="create-modal__emojis task-modal__emoji-grid">
                {TASK_EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji || 'none'}
                    type="button"
                    className={`emoji-opt ${form.emoji === emoji ? 'emoji-opt--active' : ''}`}
                    onClick={() => set('emoji', emoji)}
                  >
                    {emoji || '·'}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Accent color</label>
              <div className="column-color-grid">
                {TASK_COLOR_OPTIONS.map(color => (
                  <button
                    key={color || 'none'}
                    type="button"
                    className={`color-swatch ${form.accentColor === color ? 'color-swatch--active' : ''} ${!color ? 'color-swatch--empty' : ''}`}
                    style={color ? { background: color } : undefined}
                    onClick={() => set('accentColor', color)}
                    title={color ? `Accent ${color}` : 'No accent'}
                  >
                    {!color && <span>·</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Priority</label>
            <div className="prio-picker">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`prio-opt ${form.priority === p.value ? 'prio-opt--active' : ''}`}
                  style={form.priority === p.value
                    ? { borderColor: p.color, background: p.color + '22', color: p.color }
                    : {}}
                  onClick={() => set('priority', p.value)}
                >
                  <span className="prio-dot" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Column</label>
              <select value={form.columnId} onChange={e => set('columnId', e.target.value)}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Due date</label>
              <button
                ref={dateRef}
                type="button"
                className={`date-trigger ${form.dueDate ? 'date-trigger--set' : ''}`}
                onClick={() => setShowDatePicker(s => !s)}
              >
                <span className="date-trigger__icon">📅</span>
                <span>{form.dueDate ? formatDate(form.dueDate) : 'Pick a date'}</span>
                {form.dueDate && (
                  <span
                    className="date-trigger__clear"
                    onClick={e => { e.stopPropagation(); set('dueDate', '') }}
                  >✕</span>
                )}
              </button>
              {showDatePicker && (
                <DatePicker
                  value={form.dueDate}
                  onChange={val => set('dueDate', val)}
                  onClose={() => setShowDatePicker(false)}
                  triggerRef={dateRef}
                />
              )}
            </div>
          </div>

          <div className="field">
            <label>Tags <span className="field__hint">comma separated</span></label>
            <input
              type="text"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              placeholder="e.g. Client, Writing, Admin"
            />
          </div>

          <div className="modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {isEdit ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
