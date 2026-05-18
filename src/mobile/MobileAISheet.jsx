import { useState, useRef, useEffect } from 'react'
import { fuzzyFindColumn, fuzzyFindTask, generateTasks, parseCommand } from '../utils/aiAgent'
import { createColumn, generateId } from '../utils/data'

const HINTS = [
  'Add task "Review PR" to In Progress',
  'Move "Write tests" to Done',
  'Rename column "Todo" to "Backlog"',
  'Complete "Design mockups"',
  'Summary of this board',
]

export default function MobileAISheet({
  columns,
  tasks,
  onAddTasks,
  onAddColumns,
  onApplyGeneratedResult,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onDeleteColumn,
  onRenameColumn,
  onUpdateColumn,
  onClose,
  sounds,
}) {
  const [tab, setTab] = useState('generate')

  // Generate tab
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [selected,    setSelected]    = useState(new Set())
  const [addCols,     setAddCols]     = useState(true)

  // Command tab
  const [cmdInput,   setCmdInput]   = useState('')
  const [cmdLog,     setCmdLog]     = useState([
    { role: 'ai', text: 'Tell me what to do — move tasks, rename columns, complete items, or ask for a summary.' },
  ])
  const [cmdLoading, setCmdLoading] = useState(false)
  const logRef   = useRef(null)
  const hintIdx  = useRef(0)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [cmdLog])

  // ── Generate ────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    setSelected(new Set())
    try {
      sounds?.playAIGenerate?.()
      const res = await generateTasks(description, columns)
      setResult(res)
      setSelected(new Set(res.tasks.map(t => t.id)))
    } catch (err) {
      setError(err.message || 'Could not generate tasks right now.')
    } finally {
      setLoading(false)
    }
  }

  function toggleTask(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleAdd() {
    if (!result) return
    onApplyGeneratedResult?.({ result, selectedIds: [...selected], addSuggestedColumns: addCols })
    onClose()
  }

  // ── Command ─────────────────────────────────────────────────────────────────
  async function handleCommand(override) {
    const raw = (override ?? cmdInput).trim()
    if (!raw) return
    setCmdLog(log => [...log, { role: 'user', text: raw }])
    setCmdInput('')
    setCmdLoading(true)
    try {
      const res = await parseCommand(raw, columns, tasks)
      let reply = res.response
      const task   = res.taskQuery   ? fuzzyFindTask(res.taskQuery, tasks)     : null
      const column = res.columnQuery ? fuzzyFindColumn(res.columnQuery, columns) : null

      switch (res.type) {
        case 'delete_task':
          if (!task) reply = `Couldn't find a task matching "${res.taskQuery}".`
          else { onDeleteTask(task.id); sounds?.playDelete?.() }
          break
        case 'mark_done':
          if (!task) reply = `Couldn't find "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { done: res.done, completedAt: res.done ? new Date().toISOString() : null })
            res.done ? sounds?.playComplete?.() : sounds?.playUncomplete?.()
          }
          break
        case 'move_task':
          if (!task) reply = `Couldn't find task "${res.taskQuery}".`
          else if (!column) reply = `Couldn't find column "${res.columnQuery}".`
          else { onMoveTask(task.id, column.id); sounds?.playClick?.() }
          break
        case 'rename_col':
          if (!column) reply = `Couldn't find column "${res.columnQuery}".`
          else if (!res.title) reply = 'Need a new column name.'
          else { onRenameColumn(column.id, res.title); sounds?.playClick?.() }
          break
        case 'delete_col':
          if (!column) reply = `Couldn't find column "${res.columnQuery}".`
          else onDeleteColumn(column.id)
          break
        case 'add_col':
          if (!res.title) reply = 'Need a column name.'
          else onAddColumns([createColumn({ id: generateId(), title: res.title, color: res.color, custom: true })])
          break
        case 'add_task': {
          const targetCol = column || columns[0]
          if (!res.title) reply = 'Need a task title.'
          else {
            onAddTasks([{
              id: generateId(),
              title: res.title,
              description: res.description || '',
              priority: res.priority || 'medium',
              columnId: targetCol?.id,
              tags: [],
              dueDate: null,
              done: false,
              createdAt: new Date().toISOString(),
              emoji: res.emoji || '',
              accentColor: res.color || '',
            }])
            sounds?.playAdd?.()
          }
          break
        }
        case 'update_task':
          if (!task) reply = `Couldn't find "${res.taskQuery}".`
          else {
            const upd = {}
            if (res.emoji) upd.emoji = res.emoji
            if (res.color) upd.accentColor = res.color
            if (res.priority) upd.priority = res.priority
            if (res.title) upd.title = res.title
            onUpdateTask(task.id, upd)
            sounds?.playClick?.()
          }
          break
        case 'update_col':
          if (!column) reply = `Couldn't find column "${res.columnQuery}".`
          else {
            const upd = {}
            if (res.color) upd.color = res.color
            if (res.icon) upd.icon = res.icon
            if (res.soundPreset) upd.soundPreset = res.soundPreset
            onUpdateColumn(column.id, upd)
            sounds?.playClick?.()
          }
          break
        default:
          break
      }
      setCmdLog(log => [...log, { role: 'ai', text: reply }])
    } catch (err) {
      setCmdLog(log => [...log, { role: 'ai', text: err.message || 'Something went wrong.' }])
    } finally {
      setCmdLoading(false)
    }
  }

  function useHint() {
    const h = HINTS[hintIdx.current % HINTS.length]
    hintIdx.current++
    setCmdInput(h)
  }

  return (
    <div className="mob-overlay" onClick={onClose}>
      <div className="mob-ai-sheet" onClick={e => e.stopPropagation()}>
        <div className="mob-sheet__drag-handle" />

        {/* Header */}
        <div className="mob-ai-sheet__header">
          <div className="mob-ai-sheet__title-row">
            <span className="mob-ai-sheet__spark">✦</span>
            <span className="mob-ai-sheet__title">AI Assistant</span>
          </div>
          <button className="mob-sheet__x" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="mob-ai-sheet__tabs">
          <button
            className={`mob-ai-sheet__tab${tab === 'generate' ? ' mob-ai-sheet__tab--on' : ''}`}
            onClick={() => setTab('generate')}
          >
            ✨ Generate tasks
          </button>
          <button
            className={`mob-ai-sheet__tab${tab === 'command' ? ' mob-ai-sheet__tab--on' : ''}`}
            onClick={() => setTab('command')}
          >
            💬 Command
          </button>
        </div>

        {/* ── Generate tab ── */}
        {tab === 'generate' && (
          <div className="mob-ai-sheet__body">
            <p className="mob-ai-sheet__hint-text">
              Describe your project and the AI will suggest starter tasks.
            </p>
            <div className="mob-form__group">
              <textarea
                className="mob-form__textarea"
                rows={3}
                placeholder='e.g. "launch a new mobile app", "study for finals"…'
                value={description}
                onChange={e => setDescription(e.target.value)}
                autoFocus
              />
            </div>
            <button
              className="mob-sheet__primary-btn mob-sheet__primary-btn--full"
              onClick={handleGenerate}
              disabled={loading || !description.trim()}
            >
              {loading ? '✦ Generating…' : '✦ Generate tasks'}
            </button>

            {error && <p className="mob-ai-sheet__error">{error}</p>}

            {result && (
              <div className="mob-ai-sheet__results">
                <div className="mob-ai-sheet__results-header">
                  <span className="mob-ai-sheet__results-count">
                    {selected.size} of {result.tasks.length} selected
                  </span>
                  <label className="mob-ai-sheet__cols-toggle">
                    <input
                      type="checkbox"
                      checked={addCols}
                      onChange={e => setAddCols(e.target.checked)}
                    />
                    Add suggested columns
                  </label>
                </div>
                <div className="mob-ai-sheet__task-list">
                  {result.tasks.map(task => (
                    <button
                      key={task.id}
                      className={`mob-ai-task${selected.has(task.id) ? ' mob-ai-task--on' : ''}`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <span className={`mob-ai-task__check${selected.has(task.id) ? ' mob-ai-task__check--on' : ''}`}>
                        {selected.has(task.id) ? '✓' : ''}
                      </span>
                      <span className="mob-ai-task__title">{task.title}</span>
                      {task.suggestedColumn && (
                        <span className="mob-ai-task__col">{task.suggestedColumn}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="mob-sheet__primary-btn mob-sheet__primary-btn--full"
                  onClick={handleAdd}
                  disabled={selected.size === 0}
                >
                  Add {selected.size} task{selected.size !== 1 ? 's' : ''} to board
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Command tab ── */}
        {tab === 'command' && (
          <div className="mob-ai-sheet__body mob-ai-sheet__body--cmd">
            {/* Chat log */}
            <div className="mob-ai-chat" ref={logRef}>
              {cmdLog.map((msg, i) => (
                <div
                  key={i}
                  className={`mob-ai-msg${msg.role === 'user' ? ' mob-ai-msg--user' : ' mob-ai-msg--ai'}`}
                >
                  {msg.role === 'ai' && <span className="mob-ai-msg__spark">✦</span>}
                  <span className="mob-ai-msg__text">{msg.text}</span>
                </div>
              ))}
              {cmdLoading && (
                <div className="mob-ai-msg mob-ai-msg--ai mob-ai-msg--loading">
                  <span className="mob-ai-msg__spark">✦</span>
                  <span className="mob-ai-msg__dots"><span /><span /><span /></span>
                </div>
              )}
            </div>

            {/* Hint button */}
            <button className="mob-ai-hint-btn" onClick={useHint}>
              Try: "{HINTS[hintIdx.current % HINTS.length]}"
            </button>

            {/* Input row */}
            <div className="mob-ai-input-row">
              <input
                className="mob-ai-input"
                placeholder="Type a command…"
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !cmdLoading && handleCommand()}
              />
              <button
                className="mob-ai-send"
                onClick={() => handleCommand()}
                disabled={!cmdInput.trim() || cmdLoading}
              >
                ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
