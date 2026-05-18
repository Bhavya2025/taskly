import { useState, useMemo, useRef, useEffect } from 'react'
import MobileTaskSheet from './MobileTaskSheet'
import MobileAISheet from './MobileAISheet'
import { AnimalSVG } from '../components/UserAvatar'

const PRIORITY_COLOR = { low: '#6bcb77', medium: '#ffd93d', high: '#ff6b6b' }
const PRIORITY_LABEL = { low: 'Low', medium: 'Med', high: 'High' }

// ── Task card ────────────────────────────────────────────────────────────────
function MobileTaskCard({ task, columns, onToggleDone, onEdit, onDelete, onMove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const otherCols = columns.filter(c => c.id !== task.columnId)

  // Close menu on outside tap
  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('touchstart', handler, { passive: true })
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousedown', handler)
    }
  }, [menuOpen])

  const pColor = task.priority && task.priority !== 'none' ? PRIORITY_COLOR[task.priority] : null

  return (
    <div
      className={`mob-task-card${task.done ? ' mob-task-card--done' : ''}${task.accentColor ? ' mob-task-card--accented' : ''}`}
      style={task.accentColor ? { '--task-accent': task.accentColor } : {}}
    >
      {/* Checkbox */}
      <button
        className={`mob-task-card__check${task.done ? ' mob-task-card__check--done' : ''}`}
        onClick={() => onToggleDone(task.id)}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.done && <span>✓</span>}
      </button>

      {/* Body — tap to edit */}
      <button className="mob-task-card__body" onClick={() => onEdit(task)}>
        <div className="mob-task-card__top-row">
          {task.emoji && <span className="mob-task-card__emoji">{task.emoji}</span>}
          <span className="mob-task-card__title">{task.title}</span>
        </div>
        {task.description ? (
          <p className="mob-task-card__desc">{task.description}</p>
        ) : null}
        {(pColor || task.dueDate || task.tags?.length > 0) && (
          <div className="mob-task-card__chips">
            {pColor && (
              <span
                className="mob-task-card__chip mob-task-card__chip--priority"
                style={{ background: pColor + '28', color: pColor }}
              >
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}
            {task.dueDate && (
              <span className="mob-task-card__chip mob-task-card__chip--date">
                📅 {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="mob-task-card__chip mob-task-card__chip--tag">{tag}</span>
            ))}
          </div>
        )}
      </button>

      {/* ··· menu — anchored to avoid clipping */}
      <div className="mob-task-card__menu-wrap" ref={menuRef}>
        <button
          className="mob-task-card__more"
          onClick={e => { e.stopPropagation(); setMenuOpen(m => !m) }}
          aria-label="Task options"
        >
          ···
        </button>
        {menuOpen && (
          <div className="mob-task-card__dropdown">
            <button
              className="mob-task-card__dd-item"
              onClick={() => { setMenuOpen(false); onEdit(task) }}
            >
              <span>✏️</span> Edit
            </button>
            {otherCols.length > 0 && (
              <div className="mob-task-card__dd-section">Move to</div>
            )}
            {otherCols.map(col => (
              <button
                key={col.id}
                className="mob-task-card__dd-item"
                onClick={() => { setMenuOpen(false); onMove(task.id, col.id) }}
              >
                <span>→</span> {col.title}
              </button>
            ))}
            <div className="mob-task-card__dd-divider" />
            <button
              className="mob-task-card__dd-item mob-task-card__dd-item--danger"
              onClick={() => { setMenuOpen(false); onDelete(task.id) }}
            >
              <span>🗑️</span> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function MobileBoard({
  activeProject,
  data,
  onClose,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleDone,
  onMoveTask,
  onAddTasks,
  onAddColumns,
  onApplyGeneratedResult,
  onDeleteColumn,
  onRenameColumn,
  onUpdateColumn,
  onReorderColumns,
  sounds,
  user,
  profile,
  onAuthClick,
  onSignOut,
  theme,
  onCycleTheme,
  soundEnabled,
  onSoundToggle,
}) {
  const columns = data?.columns ?? []
  const tasks   = data?.tasks   ?? []

  // Active column tracked by ID so it survives reorder
  const [activeColId,   setActiveColId]   = useState(() => columns[0]?.id || null)
  // Local column order — updated optimistically on drag, synced from prop otherwise
  const [orderedCols,   setOrderedCols]   = useState(columns)
  // Reorder / shake-mode state
  const [reorderMode,   setReorderMode]   = useState(false)
  const [dragIdx,       setDragIdx]       = useState(null)

  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [editingTask,   setEditingTask]   = useState(null)
  const [aiOpen,        setAiOpen]        = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')

  const longPressTimer   = useRef(null)
  const tabsContainerRef = useRef(null)
  const isDragging       = useRef(false)

  const activeCol = orderedCols.find(c => c.id === activeColId) || orderedCols[0]

  // Sync orderedCols from prop whenever columns change (skip during drag to avoid jitter)
  useEffect(() => {
    if (!isDragging.current) setOrderedCols(columns)
  }, [columns])

  // Keep activeColId valid when columns change
  useEffect(() => {
    if (orderedCols.length > 0 && !orderedCols.find(c => c.id === activeColId)) {
      setActiveColId(orderedCols[0].id)
    }
  }, [orderedCols, activeColId])

  // ── Column reorder handlers — pointer capture approach ───────────────────
  const dragIdxRef = useRef(null)
  const orderedRef = useRef(columns)
  const startXRef  = useRef(0)
  useEffect(() => { orderedRef.current = orderedCols }, [orderedCols])

  function onGripPointerDown(e, idx) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId) // all subsequent events come here
    startXRef.current = e.clientX
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(8)
      isDragging.current = true
      dragIdxRef.current = idx
      setReorderMode(true)
      setDragIdx(idx)
    }, 220)
  }

  function onGripPointerMove(e) {
    if (!isDragging.current) {
      if (Math.abs(e.clientX - startXRef.current) > 6) clearTimeout(longPressTimer.current)
      return
    }
    const container = tabsContainerRef.current
    if (!container) return
    const tabEls = [...container.querySelectorAll('[data-col-idx]')]
    const cur = dragIdxRef.current
    for (let i = 0; i < tabEls.length; i++) {
      const rect = tabEls[i].getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        if (i !== cur) {
          setOrderedCols(prev => {
            const next = [...prev]
            const [item] = next.splice(cur, 1)
            next.splice(i, 0, item)
            return next
          })
          dragIdxRef.current = i
          setDragIdx(i)
        }
        break
      }
    }
  }

  function onGripPointerUp() {
    clearTimeout(longPressTimer.current)
    if (isDragging.current) {
      onReorderColumns?.(orderedRef.current.map(c => c.id))
      isDragging.current = false
    }
    dragIdxRef.current = null
    setDragIdx(null)
  }

  function cancelLongPress() { clearTimeout(longPressTimer.current) }

  function exitReorderMode() {
    setReorderMode(false)
    setDragIdx(null)
    isDragging.current = false
    dragIdxRef.current = null
  }

  const colTasks = useMemo(() => {
    if (!activeCol) return []
    return tasks.filter(t => {
      if (t.columnId !== activeCol.id) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [tasks, activeCol, searchQuery])

  const totalTasks = tasks.length
  const doneTasks  = tasks.filter(t => t.done).length
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  function openAdd() {
    sounds?.playClick?.()
    setEditingTask(null)
    setTaskSheetOpen(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setTaskSheetOpen(true)
  }

  function handleSave(formData) {
    if (editingTask) {
      onUpdateTask(editingTask.id, formData)
    } else {
      onAddTask({ ...formData, columnId: formData.columnId || activeCol?.id })
    }
    setTaskSheetOpen(false)
    setEditingTask(null)
  }

  const projColor = activeProject?.color || '#7c6ff7'
  const displayName = profile?.display_name || user?.email?.split('@')[0] || null
  const avatarColor = profile?.avatar_color || '#7c6ff7'
  const avatarAnimal = profile?.avatar_animal || (user ? '🐱' : '👤')

  return (
    <div className="mob-board">
      {/* ── Header ── */}
      <header className="mob-board__header">
        <button className="mob-board__back-btn" onClick={onClose} aria-label="Back">
          <span className="mob-board__back-chevron">‹</span>
        </button>

        <div className="mob-board__proj-info">
          <div className="mob-board__proj-icon" style={{ background: projColor + '33' }}>
            {activeProject?.image_url
              ? <img src={activeProject.image_url} alt="" className="mob-board__proj-img" />
              : <span>{activeProject?.emoji || '📋'}</span>
            }
          </div>
          <div className="mob-board__proj-text">
            <span className="mob-board__proj-name">{activeProject?.name || 'Board'}</span>
            {totalTasks > 0 && (
              <span className="mob-board__proj-sub">{doneTasks}/{totalTasks} done</span>
            )}
          </div>
        </div>

        <div className="mob-board__header-actions">
          <button
            className="mob-board__hdr-btn"
            onClick={() => setSearchOpen(s => !s)}
            aria-label="Search"
          >
            🔍
          </button>
          <button
            className={`mob-board__hdr-btn mob-board__hdr-btn--ai${aiOpen ? ' mob-board__hdr-btn--ai-on' : ''}`}
            onClick={() => { sounds?.playClick?.(); setAiOpen(true) }}
            aria-label="AI Assistant"
          >
            ✦
          </button>
          <button
            className="mob-board__avatar-btn"
            style={user ? { background: avatarColor } : {}}
            onClick={() => setProfileOpen(true)}
            aria-label="Profile"
          >
            {user
              ? <AnimalSVG animal={avatarAnimal} size={22} />
              : <span style={{ fontSize: 16 }}>👤</span>
            }
          </button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {totalTasks > 0 && (
        <div className="mob-board__progress">
          <div
            className="mob-board__progress-fill"
            style={{ width: `${pct}%`, background: projColor }}
          />
        </div>
      )}

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className="mob-board__search-bar">
          <span className="mob-board__search-icon">🔍</span>
          <input
            className="mob-board__search-input"
            placeholder="Search tasks in this column…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="mob-board__search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      )}

      {/* ── Column tabs ── */}
      <div
        className={`mob-board__tabs${reorderMode ? ' mob-board__tabs--reorder' : ''}`}
        ref={tabsContainerRef}
      >
        {orderedCols.map((col, idx) => {
          const count          = tasks.filter(t => t.columnId === col.id).length
          const isActive       = col.id === activeColId
          const isBeingDragged = reorderMode && dragIdx === idx
          return (
            <button
              key={col.id}
              data-col-idx={idx}
              className={[
                'mob-board__tab',
                isActive       && 'mob-board__tab--active',
                reorderMode && !isBeingDragged && 'mob-board__tab--shake',
                isBeingDragged && 'mob-board__tab--dragging',
              ].filter(Boolean).join(' ')}
              style={{
                ...(isActive ? { '--tab-accent': projColor } : {}),
                ...(reorderMode && !isBeingDragged ? { animationDelay: `${idx * 0.07}s` } : {}),
              }}
              onClick={reorderMode ? undefined : () => setActiveColId(col.id)}
            >
              {/* Grip — hold to enter reorder mode */}
              <span
                className="mob-board__tab-grip"
                style={{ touchAction: 'none' }}
                onPointerDown={e => onGripPointerDown(e, idx)}
                onPointerMove={onGripPointerMove}
                onPointerUp={onGripPointerUp}
                onPointerCancel={onGripPointerUp}
                aria-label="Hold to reorder"
              >⠿</span>
              <span className="mob-board__tab-label">{col.title}</span>
              <span
                className={`mob-board__tab-count${isActive ? ' mob-board__tab-count--active' : ''}`}
                style={isActive ? { background: projColor + '28', color: projColor } : {}}
              >
                {count}
              </span>
            </button>
          )
        })}
        {reorderMode && (
          <button className="mob-board__reorder-done" onClick={exitReorderMode}>
            Done
          </button>
        )}
      </div>

      {/* ── Task list ── */}
      <div className="mob-board__scroll">
        {colTasks.length === 0 ? (
          <div className="mob-board__empty">
            <span className="mob-board__empty-glyph">✦</span>
            <p className="mob-board__empty-title">
              {searchQuery ? 'No matching tasks' : 'Nothing here yet'}
            </p>
            <p className="mob-board__empty-sub">
              {searchQuery ? 'Try a different search term' : 'Tap + to add your first task'}
            </p>
          </div>
        ) : (
          <div className="mob-board__list">
            {colTasks.map(task => (
              <MobileTaskCard
                key={task.id}
                task={task}
                columns={columns}
                onToggleDone={onToggleDone}
                onEdit={openEdit}
                onDelete={onDeleteTask}
                onMove={(taskId, colId) => { onMoveTask(taskId, colId); sounds?.playClick?.() }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <button className="mob-fab mob-fab--board" onClick={openAdd} aria-label="Add task">
        <span className="mob-fab__icon">+</span>
      </button>

      {/* ── Task sheet ── */}
      {taskSheetOpen && (
        <MobileTaskSheet
          task={editingTask}
          columns={columns}
          defaultColumnId={activeCol?.id}
          onSave={handleSave}
          onClose={() => { setTaskSheetOpen(false); setEditingTask(null) }}
          onDelete={editingTask
            ? () => { onDeleteTask(editingTask.id); setTaskSheetOpen(false); setEditingTask(null) }
            : null}
          sounds={sounds}
        />
      )}

      {/* ── AI sheet ── */}
      {aiOpen && (
        <MobileAISheet
          columns={columns}
          tasks={tasks}
          onAddTasks={tasksToAdd => onAddTasks(tasksToAdd, {
            toastMessage: `${tasksToAdd.length} task${tasksToAdd.length !== 1 ? 's' : ''} added`,
            sound: sounds?.playAITaskAdded,
          })}
          onAddColumns={onAddColumns}
          onApplyGeneratedResult={onApplyGeneratedResult}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
          onMoveTask={onMoveTask}
          onDeleteColumn={onDeleteColumn}
          onRenameColumn={onRenameColumn}
          onUpdateColumn={onUpdateColumn}
          onClose={() => setAiOpen(false)}
          sounds={sounds}
        />
      )}

      {/* ── Profile sheet ── */}
      {profileOpen && (
        <div className="mob-overlay" onClick={() => setProfileOpen(false)}>
          <div className="mob-sheet mob-sheet--sm" onClick={e => e.stopPropagation()}>
            <div className="mob-sheet__drag-handle" />
            {user ? (
              <>
                <div className="mob-sheet__profile-head">
                  <div className="mob-sheet__profile-avatar" style={{ background: avatarColor }}>
                    <AnimalSVG animal={avatarAnimal} size={30} />
                  </div>
                  <div>
                    <div className="mob-sheet__profile-name">{displayName || user.email}</div>
                    <div className="mob-sheet__profile-email">{user.email}</div>
                  </div>
                </div>
                <div className="mob-sheet__menu-list">
                  <button className="mob-sheet__menu-item" onClick={() => { setProfileOpen(false); onCycleTheme() }}>
                    <span className="mob-sheet__menu-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
                    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                  <button className="mob-sheet__menu-item" onClick={onSoundToggle}>
                    <span className="mob-sheet__menu-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                    <span>{soundEnabled ? 'Sound on' : 'Sound off'}</span>
                  </button>
                </div>
                <div className="mob-sheet__divider" />
                <button
                  className="mob-sheet__danger-btn"
                  onClick={() => { setProfileOpen(false); onSignOut() }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="mob-sheet__title">Not signed in</div>
                <p style={{ color: 'var(--text-2)', fontSize: '14px', margin: '0 0 16px' }}>
                  Sign in to sync projects across devices.
                </p>
                <button
                  className="mob-sheet__primary-btn"
                  onClick={() => { setProfileOpen(false); onAuthClick() }}
                >
                  Sign in / Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
