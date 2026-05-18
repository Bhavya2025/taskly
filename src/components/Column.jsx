import { useState, useRef, useEffect, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'

export default function Column({
  column, columnsCount, tasks,
  onToggleDone, onEditTask, onDeleteTask, onAddTask,
  onDeleteColumn, onRenameColumn, onEditColumn,
  selectedTaskId, onSelectTask,
  movedTaskIds,
  gripProps,
  isReordering,
}) {
  const [renaming, setRenaming]   = useState(false)
  const [renameVal, setRenameVal] = useState(column.title)
  const [overflow, setOverflow]   = useState(false)

  const bodyRef  = useRef(null)
  const thumbRef = useRef(null)   // direct DOM ref — no React state for position

  // Use 'drop-{id}' to avoid ID collision with the column's own useSortable in Board.jsx
  const { setNodeRef, isOver } = useDroppable({ id: `drop-${column.id}` })

  const setRefs = useCallback((node) => {
    setNodeRef(node)
    bodyRef.current = node
  }, [setNodeRef])

  // Write thumb position directly to DOM — zero re-renders, zero lag
  const updateThumb = useCallback(() => {
    const el    = bodyRef.current
    const thumb = thumbRef.current
    if (!el || !thumb) return
    const ratio = el.clientHeight / el.scrollHeight
    const h     = Math.max(ratio * 100, 12)
    const top   = (el.scrollTop / el.scrollHeight) * 100
    thumb.style.height = `${h}%`
    thumb.style.top    = `${top}%`
  }, [])

  // Only use React state for the overflow flag (rare, not on every scroll)
  const recalc = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    const isOvf = el.scrollHeight > el.clientHeight + 2
    setOverflow(isOvf)
    updateThumb()
  }, [updateThumb])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    recalc()
    // Passive listener — never blocks the scroll thread
    el.addEventListener('scroll', updateThumb, { passive: true })
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateThumb)
      ro.disconnect()
    }
  }, [tasks.length, recalc, updateThumb])

  const taskIds = tasks.map(t => t.id)

  function commitRename() {
    if (renameVal.trim()) onRenameColumn(column.id, renameVal.trim())
    setRenaming(false)
  }

  return (
    <div className="column">
      <div className="column__header">
        {/* Grip — hold to enter column reorder mode */}
        <span
          className={`column__grip${isReordering ? ' column__grip--active' : ''}`}
          title="Hold to reorder columns"
          style={{ touchAction: 'none' }}
          {...(gripProps || {})}
        >⠿</span>
        <span className="column__dot" style={{ background: column.color }} />
        <span className="column__icon">{column.icon}</span>

        {renaming ? (
          <input
            className="column__rename-input"
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span
            className="column__title"
            onDoubleClick={() => { setRenameVal(column.title); setRenaming(true) }}
            title="Double-click to rename"
          >
            {column.title}
          </span>
        )}

        <span className="column__count">{tasks.length}</span>

        <div className="column__actions">
          <button className="column__add-btn" onClick={() => onAddTask(column.id)} title="Add task">+</button>
          <button className="column__cfg-btn" onClick={() => onEditColumn(column)} title="Column settings">⋯</button>
          {onDeleteColumn && (
            <button
              className="column__del-btn"
              onClick={() => onDeleteColumn(column.id)}
              title={columnsCount > 1 ? 'Delete column' : 'At least one column is required'}
              disabled={columnsCount <= 1}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scroll wrapper — custom scrollbar lives here */}
      <div className="column__scroll-wrap">
        <div
          ref={setRefs}
          className={`column__body ${isOver ? 'column__body--over' : ''}`}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                isUndoMoved={movedTaskIds?.includes(task.id)}
                onToggleDone={() => onToggleDone(task.id)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <div className="column__empty">Drop tasks here</div>
          )}
        </div>

        {/* Custom always-visible scrollbar — only rendered when overflowing */}
        {overflow && (
          <div className="column__scrolltrack">
            <div ref={thumbRef} className="column__scrollthumb" />
          </div>
        )}
      </div>
    </div>
  )
}
