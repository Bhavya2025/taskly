import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getDueStatus, formatDate } from '../utils/dateUtils'
import PortalMenu from './PortalMenu'

const PRIO_COLORS = { urgent: '#e85555', high: '#e8924a', medium: '#d4b84a', low: '#4a9e6b' }
const PRIO_LABELS = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

export default function TaskCard({
  task, isSelected,
  onToggleDone, onEdit, onDelete, onClick,
  overlay, isUndoMoved,
}) {
  const btnRef   = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id, disabled: !!overlay, data: { type: 'task', columnId: task.columnId } })

  const style = overlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    '--task-accent': task.accentColor || 'transparent',
  }

  const dueStatus = getDueStatus(task.dueDate)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'task-card',
        task.done    ? 'task-card--done'      : '',
        isSelected   ? 'task-card--selected'  : '',
        isDragging   ? 'task-card--dragging'  : '',
        overlay      ? 'task-card--overlay'   : '',
        isUndoMoved  ? 'task-card--undo-snap' : '',
      ].join(' ')}
      onClick={onClick}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      <div className="task-card__grip">⠿⠿</div>

      <div className="task-card__body">
        <p className="task-card__title">
          {task.emoji && <span className="task-card__emoji">{task.emoji}</span>}
          <span>{task.title}</span>
        </p>
        {task.description && (
          <p className="task-card__desc">{task.description}</p>
        )}
      </div>

      <div className="task-card__footer">
        <button
          className={`task-card__check ${task.done ? 'task-card__check--done' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleDone() }}
          title={task.done ? 'Mark active' : 'Mark complete'}
        >
          {task.done ? '✓' : ''}
        </button>

        <span
          className="task-card__prio"
          style={{ background: PRIO_COLORS[task.priority] }}
          title={PRIO_LABELS[task.priority]}
        />

        {task.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="task-card__tag">{tag}</span>
        ))}

        {task.dueDate && (
          <span className={`task-card__due task-card__due--${dueStatus}`}>
            {formatDate(task.dueDate)}
          </span>
        )}

        {!overlay && (
          <div className="task-card__menu-wrap" onClick={e => e.stopPropagation()}>
            <button
              ref={btnRef}
              className="task-card__menu-btn"
              onClick={() => setMenuOpen(s => !s)}
            >···</button>
            <PortalMenu
              btnRef={btnRef}
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </div>
  )
}
