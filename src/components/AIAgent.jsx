import { useState, useRef, useEffect } from 'react'
import { fuzzyFindColumn, fuzzyFindTask, generateTasks, parseCommand } from '../utils/aiAgent'
import { createColumn, generateId } from '../utils/data'

const PRIO_COLORS = {
  urgent: '#e85555',
  high:   '#e8924a',
  medium: '#d4b84a',
  low:    '#4a9e6b',
}

const COMMAND_HINTS = [
  'add task "Launch blog post" to Doing',
  'move "Write tests" to Review',
  'rename column To Learn to Practice Later',
  'set color of column Review to teal',
  'set sound of column Done to reward',
  'set emoji of "Fix bug" to 🧪',
  'set color of task "Fix bug" to purple',
  'complete "Design mockups"',
  'summary',
]

export default function AIAgent({
  columns, tasks,
  onAddTasks, onAddColumns, onApplyGeneratedResult,
  onDeleteTask, onUpdateTask, onMoveTask,
  onDeleteColumn, onRenameColumn, onUpdateColumn,
  onClose, sounds,
}) {
  const [tab,         setTab]         = useState('generate')

  // Generate tab state
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [generateError, setGenerateError] = useState('')
  const [selected,    setSelected]    = useState(new Set())
  const [addCols,     setAddCols]     = useState(true)

  // Command tab state
  const [cmdInput,    setCmdInput]    = useState('')
  const [cmdLog,      setCmdLog]      = useState([
    { role: 'ai', text: 'I can generate starter tasks or edit the board directly. Try a topic like "linear algebra", "launch a cafe", or "python lambda", or tell me to move, add, rename, recolor, or clean up the board.' },
  ])
  const [cmdLoading,  setCmdLoading]  = useState(false)
  const logRef  = useRef(null)
  const hintIdx = useRef(0)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [cmdLog])

  // ── Generate tab ────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setResult(null)
    setGenerateError('')
    setSelected(new Set())
    try {
      sounds?.playAIGenerate?.()
      const res = await generateTasks(description, columns)
      setResult(res)
      setSelected(new Set(res.tasks.map(t => t.id)))
    } catch (error) {
      setResult(null)
      setGenerateError(error.message || 'The assistant could not generate a board right now.')
    } finally {
      setLoading(false)
    }
  }

  function toggleTask(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleAdd() {
    if (!result) return
    onApplyGeneratedResult?.({
      result,
      selectedIds: [...selected],
      addSuggestedColumns: addCols,
    })
    onClose()
  }

  // ── Command tab ─────────────────────────────────────────────────────────────
  async function handleCommand(inputOverride) {
    const raw = (inputOverride ?? cmdInput).trim()
    if (!raw) return

    setCmdLog(log => [...log, { role: 'user', text: raw }])
    setCmdInput('')
    setCmdLoading(true)

    try {
      const res = await parseCommand(raw, columns, tasks)
      let reply = res.response

      const task = res.taskQuery ? fuzzyFindTask(res.taskQuery, tasks) : null
      const column = res.columnQuery ? fuzzyFindColumn(res.columnQuery, columns) : null

      switch (res.type) {
        case 'delete_task':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else onDeleteTask(task.id)
          break
        case 'mark_done':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { done: res.done, completedAt: res.done ? new Date().toISOString() : null })
            if (res.done) sounds?.playComplete?.()
            else sounds?.playUncomplete?.()
          }
          break
        case 'move_task':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else {
            onMoveTask(task.id, column.id)
            sounds?.playClick?.()
          }
          break
        case 'rename_col':
          if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else if (!res.title) reply = 'I need a new column name to do that.'
          else {
            onRenameColumn(column.id, res.title)
            sounds?.playClick?.()
          }
          break
        case 'delete_col':
          if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else onDeleteColumn(column.id)
          break
        case 'add_col':
          if (!res.title) reply = 'I need a column name to add it.'
          else onAddColumns([createColumn({ id: generateId(), title: res.title, color: res.color, icon: res.icon, soundPreset: res.soundPreset || undefined, custom: true })])
          break
        case 'add_task': {
          const targetColumn = column || columns[0]
          if (!res.title) reply = 'I need a task title to add it.'
          else {
            onAddTasks([{
              id: generateId(),
              title: res.title,
              description: res.description || '',
              priority: res.priority || 'medium',
              columnId: targetColumn?.id,
              tags: [],
              dueDate: null,
              done: false,
              createdAt: new Date().toISOString(),
              emoji: res.emoji || '',
              accentColor: res.color || '',
            }])
          }
          break
        }
        case 'set_description':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { description: res.description })
            sounds?.playClick?.()
          }
          break
        case 'set_column_color':
          if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else if (!res.color) reply = 'I need a valid hex color for that column.'
          else {
            onUpdateColumn(column.id, { color: res.color })
            sounds?.playClick?.()
          }
          break
        case 'set_column_sound':
          if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else if (!res.soundPreset) reply = 'I need a valid sound preset for that column.'
          else {
            onUpdateColumn(column.id, { soundPreset: res.soundPreset })
            sounds?.playColumnPreview?.({ soundPreset: res.soundPreset })
          }
          break
        case 'set_column_icon':
          if (!column) reply = `I couldn't find a column matching "${res.columnQuery}".`
          else if (!res.icon) reply = 'I need an icon or emoji for that column.'
          else {
            onUpdateColumn(column.id, { icon: res.icon })
            sounds?.playClick?.()
          }
          break
        case 'set_task_emoji':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { emoji: res.emoji })
            sounds?.playClick?.()
          }
          break
        case 'set_task_color':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { accentColor: res.color })
            sounds?.playClick?.()
          }
          break
        case 'set_priority':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else {
            onUpdateTask(task.id, { priority: res.priority || 'medium' })
            sounds?.playClick?.()
          }
          break
        case 'rename_task':
          if (!task) reply = `I couldn't find a task matching "${res.taskQuery}".`
          else if (!res.title) reply = 'I need a new task title to rename it.'
          else {
            onUpdateTask(task.id, { title: res.title })
            sounds?.playClick?.()
          }
          break
        case 'info':
          sounds?.playClick?.()
          break
        case 'unknown':
          reply = reply || "I couldn't pin that down. Try being more direct about the task or column you want changed."
          break
        default:
          reply = "I couldn't pin that down. Try being more direct about the task or column you want changed."
          break
      }

      if (reply) setCmdLog(log => [...log, { role: 'ai', text: reply }])
    } catch (error) {
      setCmdLog(log => [...log, { role: 'ai', text: error.message || 'The assistant could not edit the board right now.' }])
    } finally {
      setCmdLoading(false)
    }
  }

  function useHint() {
    setCmdInput(COMMAND_HINTS[hintIdx.current % COMMAND_HINTS.length])
    hintIdx.current++
  }

  const selectedCount = selected.size

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel__header">
        <div className="ai-panel__title">
          <div className="ai-panel__title-icon">🤖</div>
          Board Assistant
        </div>
        <button className="ai-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Tabs */}
      <div className="ai-panel__tabs">
        <button
          className={`ai-panel__tab ${tab === 'generate' ? 'ai-panel__tab--active' : ''}`}
          onClick={() => setTab('generate')}
        >✦ Generate</button>
        <button
          className={`ai-panel__tab ${tab === 'command' ? 'ai-panel__tab--active' : ''}`}
          onClick={() => setTab('command')}
        >⌘ Edit board</button>
      </div>

      {/* ── Generate tab ── */}
      {tab === 'generate' && (
        <div className="ai-panel__body">
          <div>
            <div className="ai-panel__prompt-label">Describe the project or workflow</div>
            <textarea
              className="ai-panel__textarea"
              placeholder="Try a full brief or a single topic like algebra, python lambda, cricket, or chicken curry."
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            />
          </div>

          <button
            className="ai-panel__gen-btn"
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
          >
            {loading
              ? <><div className="ai-panel__spinner" />Generating…</>
              : <>✦ Generate Starter Tasks</>}
          </button>

          {result && !loading && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Detected: <strong style={{ color: 'var(--accent)' }}>{result.patternLabel}</strong>
                {' · '}Generated {result.tasks.length} tasks
              </div>

              {result.suggestedColumns && (
                <>
                  <div className="ai-panel__divider">Suggested columns</div>
                  <div>
                    <div className="ai-panel__col-suggestions">
                      {result.suggestedColumns.map((col, i) => {
                        const exists = columns.some(c => c.title.toLowerCase() === col.toLowerCase())
                        return (
                          <div key={i} className={`ai-col-chip ${exists ? '' : 'ai-col-chip--new'}`}>
                            {exists ? '✓' : '+'} {col}
                          </div>
                        )
                      })}
                    </div>
                    {result.suggestedColumns.some(c => !columns.find(ec => ec.title.toLowerCase() === c.toLowerCase())) && (
                      <label style={{ display:'flex', alignItems:'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--text-2)', cursor:'pointer' }}>
                        <input type="checkbox" checked={addCols} onChange={e => setAddCols(e.target.checked)} style={{ accentColor:'var(--accent)' }} />
                        Add new columns to board
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="ai-panel__divider">Tasks — {selectedCount} selected</div>

              <div style={{ display:'flex', gap: 8 }}>
                <button onClick={() => setSelected(new Set(result.tasks.map(t => t.id)))}
                  style={{ fontSize: 11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding: 0 }}>
                  Select all
                </button>
                <span style={{ fontSize: 11, color:'var(--text-3)' }}>·</span>
                <button onClick={() => setSelected(new Set())}
                  style={{ fontSize: 11, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', padding: 0 }}>
                  None
                </button>
              </div>

              <div className="ai-task-list">
                {result.tasks.map(task => {
                  const isSel = selected.has(task.id)
                  return (
                    <div key={task.id} className={`ai-task-item ${isSel ? 'ai-task-item--checked' : ''}`} onClick={() => toggleTask(task.id)}>
                      <div className="ai-task-item__check">{isSel && '✓'}</div>
                      <div className="ai-task-item__info">
                        <div className="ai-task-item__title">{task.title}</div>
                        <div className="ai-task-item__meta">
                          <div className="ai-task-item__prio" style={{ background: PRIO_COLORS[task.priority] }} />
                          <div className="ai-task-item__col">→ {task.suggestedColumn}</div>
                          {task.tags?.map(tag => <div key={tag} className="ai-task-item__col">{tag}</div>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button className="ai-panel__add-btn" onClick={handleAdd} disabled={selectedCount === 0}>
                Add {selectedCount} task{selectedCount !== 1 ? 's' : ''} to board
              </button>

              <button onClick={handleGenerate} style={{ fontSize: 12, color:'var(--text-3)', textAlign:'center', padding:'4px 0', background:'none', border:'none', cursor:'pointer', width:'100%' }}>
                ↺ Regenerate
              </button>
            </>
          )}

          {!result && !loading && (
            <div style={{ padding:'20px 0', textAlign:'center', fontSize: 12, color:'var(--text-3)', lineHeight: 1.6 }}>
              Describe your project in plain language or drop in a short topic.<br/>
              I'll guess a useful board structure, starter tasks, and columns.<br/>
              <span style={{ fontSize: 11, opacity: 0.7 }}>⌘↵ or Ctrl+↵ to generate</span>
            </div>
          )}

          {generateError && !loading && (
            <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 12px', background: 'rgba(239,107,87,0.1)', border: '1px solid rgba(239,107,87,0.22)', color: '#ef6b57', fontSize: 12, lineHeight: 1.55 }}>
              {generateError}
            </div>
          )}
        </div>
      )}

      {/* ── Command tab ── */}
      {tab === 'command' && (
        <div className="ai-panel__body ai-panel__body--cmd">
          <div className="cmd-log" ref={logRef}>
            {cmdLog.map((msg, i) => (
              <div key={i} className={`cmd-msg cmd-msg--${msg.role}`}>
                {msg.role === 'ai' && <div className="cmd-msg__avatar">🤖</div>}
                <div className="cmd-msg__bubble">
                  {msg.text.split('\n').map((line, j, arr) => (
                    <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}
            {cmdLoading && (
              <div className="cmd-msg cmd-msg--ai">
                <div className="cmd-msg__avatar">🤖</div>
                <div className="cmd-msg__bubble cmd-msg__bubble--loading">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <button className="cmd-hint-btn" onClick={useHint}>💡 Example command</button>

          <div className="cmd-input-row">
            <input
              className="cmd-input"
              placeholder="e.g. move homepage draft to Review"
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommand() } }}
            />
            <button className="cmd-send-btn" onClick={() => handleCommand()} disabled={!cmdInput.trim() || cmdLoading}>
              →
            </button>
          </div>
        </div>
      )}

      <div className="ai-panel__footer">
        Dynamic online assistant · Server-side model · Structured board actions
      </div>
    </div>
  )
}
