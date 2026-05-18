import { getDueStatus, formatDate } from '../utils/dateUtils'

const PRIO_COLORS = { urgent: '#e85555', high: '#e8924a', medium: '#d4b84a', low: '#4a9e6b' }

export default function ListView({
  columns, tasks,
  onToggleDone, onEditTask, onDeleteTask,
  selectedTaskId, onSelectTask,
}) {
  const sections = columns
    .map(col => ({ ...col, tasks: tasks.filter(t => t.columnId === col.id) }))
    .filter(c => c.tasks.length > 0)

  if (tasks.length === 0) {
    return (
      <div className="list-view__empty">
        No tasks found. Press <kbd>N</kbd> to create one.
      </div>
    )
  }

  return (
    <div className="list-view">
      {sections.map(col => (
        <div key={col.id} className="list-section">
          <div className="list-section__header">
            <span className="list-section__dot" style={{ background: col.color }} />
            <span className="list-section__title">{col.title}</span>
            <span className="list-section__count">{col.tasks.length}</span>
          </div>

          <div className="list-section__rows">
            {col.tasks.map(task => {
              const dueStatus = getDueStatus(task.dueDate)
              return (
                <div
                  key={task.id}
                  className={[
                    'list-row',
                    task.done           ? 'list-row--done'     : '',
                    task.id === selectedTaskId ? 'list-row--selected' : '',
                  ].join(' ')}
                  onClick={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
                >
                  <button
                    className={`list-row__check ${task.done ? 'list-row__check--done' : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleDone(task.id) }}
                  >
                    {task.done ? '✓' : ''}
                  </button>

                  <span
                    className="list-row__prio"
                    style={{ background: PRIO_COLORS[task.priority] }}
                  />

                  <span className="list-row__title">
                    {task.emoji && <span className="list-row__emoji">{task.emoji}</span>}
                    <span className="list-row__title-text">{task.title}</span>
                  </span>

                  <div className="list-row__tags">
                    {task.tags?.map(t => (
                      <span key={t} className="list-row__tag">{t}</span>
                    ))}
                  </div>

                  {task.dueDate && (
                    <span className={`list-row__due list-row__due--${dueStatus}`}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}

                  <div className="list-row__actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onEditTask(task)}>Edit</button>
                    <button className="danger" onClick={() => onDeleteTask(task.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
