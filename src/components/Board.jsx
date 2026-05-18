import { useState, useRef } from 'react'
import {
  DndContext, DragOverlay,
  closestCorners, closestCenter, pointerWithin,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Column from './Column'
import TaskCard from './TaskCard'

// ── Custom collision: when dragging a column, only hit other columns.
// Use pointer position (pointerWithin) so the swap follows the cursor exactly.
function collisionDetection(args) {
  if (args.active.data.current?.type === 'column') {
    const onlyCols = args.droppableContainers.filter(
      c => c.data.current?.type === 'column'
    )
    const hits = pointerWithin({ ...args, droppableContainers: onlyCols })
    if (hits.length > 0) return hits
    return closestCenter({ ...args, droppableContainers: onlyCols })
  }
  return closestCorners(args)
}

// ── Ghost shown in DragOverlay while a column is dragged ─────────────────────
function ColGhost({ col, tasks }) {
  const colTasks = tasks.filter(t => t.columnId === col.id)
  return (
    <div className="col-ghost">
      <div className="col-ghost__header">
        <span className="col-ghost__dot" style={{ background: col.color }} />
        {col.icon && <span className="col-ghost__icon">{col.icon}</span>}
        <span className="col-ghost__title">{col.title}</span>
        <span className="col-ghost__count">{colTasks.length}</span>
      </div>
      <div className="col-ghost__body">
        {colTasks.slice(0, 4).map(t => (
          <div key={t.id} className="col-ghost__task">
            {t.emoji && `${t.emoji} `}{t.title}
          </div>
        ))}
        {colTasks.length > 4 && (
          <div className="col-ghost__more">+{colTasks.length - 4} more</div>
        )}
      </div>
    </div>
  )
}

// ── Sortable column wrapper ───────────────────────────────────────────────────
function SortableCol({
  col, allTasks, isDraggingCol,
  onToggleDone, onEditTask, onDeleteTask, onAddTask,
  onDeleteColumn, onRenameColumn, onEditColumn,
  columnsCount, selectedTaskId, onSelectTask, movedTaskIds,
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: col.id, data: { type: 'column' } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.18 : 1,
    filter:  isDragging ? 'blur(1px)' : 'none',
  }

  const colTasks = allTasks.filter(t => t.columnId === col.id)

  return (
    <div ref={setNodeRef} className="col-wrap" style={style}>
      <Column
        column={col}
        columnsCount={columnsCount}
        tasks={colTasks}
        onToggleDone={onToggleDone}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onAddTask={onAddTask}
        onDeleteColumn={onDeleteColumn}
        onRenameColumn={onRenameColumn}
        onEditColumn={onEditColumn}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        movedTaskIds={movedTaskIds}
        gripProps={{ ...listeners, ...attributes }}
        isReordering={isDraggingCol}
      />
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────
export default function Board({
  columns, tasks,
  onMoveTask, onReorderTask,
  onToggleDone, onEditTask, onDeleteTask, onAddTask,
  onAddColumn, onDeleteColumn, onRenameColumn, onEditColumn,
  onReorderColumns,
  selectedTaskId, onSelectTask,
  sounds,
  movedTaskIds,
}) {
  const [activeType, setActiveType] = useState(null)
  const [activeId,   setActiveId]   = useState(null)
  const dragOriginColId = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    const type = active.data.current?.type
    setActiveType(type)
    setActiveId(active.id)
    if (type === 'task') {
      const task = tasks.find(t => t.id === active.id)
      dragOriginColId.current = task?.columnId ?? null
      sounds.playPickup(task?.priority)
    }
  }

  function handleDragOver({ active, over }) {
    if (!over || active.id === over.id) return
    // Column drag: nothing to do here — useSortable handles the visual preview
    // via its own transforms. We only commit on dragEnd.
    if (active.data.current?.type === 'column') return

    // Task drag: move task to a different column if needed
    if (active.data.current?.type === 'task') {
      const overData = over.data.current
      let targetColId = null
      if (overData?.type === 'column')           targetColId = over.id
      else if (overData?.type === 'task')        targetColId = overData.columnId
      else if (String(over.id).startsWith('drop-')) targetColId = String(over.id).slice(5)

      const task = tasks.find(t => t.id === active.id)
      if (targetColId && task && task.columnId !== targetColId) {
        onMoveTask(active.id, targetColId)
      }
    }
  }

  function handleDragEnd({ active, over }) {
    const type = activeType
    setActiveType(null)
    setActiveId(null)

    if (type === 'column') {
      // Commit new column order only on drop
      if (over && active.id !== over.id) {
        const oldIdx = columns.findIndex(c => c.id === active.id)
        const newIdx = columns.findIndex(c => c.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1) {
          onReorderColumns?.(arrayMove(columns, oldIdx, newIdx).map(c => c.id))
        }
      }
      dragOriginColId.current = null
      return
    }

    if (type === 'task') {
      if (!over) { dragOriginColId.current = null; return }
      const overData = over.data.current
      const task     = tasks.find(t => t.id === active.id)
      if (!task) { dragOriginColId.current = null; return }

      // Play drop sound
      let landedColId = task.columnId
      if (overData?.type === 'task')   landedColId = overData.columnId
      if (overData?.type === 'column') landedColId = over.id
      sounds.playDrop({
        column:       columns.find(c => c.id === landedColId),
        fromIndex:    columns.findIndex(c => c.id === (dragOriginColId.current ?? task.columnId)),
        toIndex:      columns.findIndex(c => c.id === landedColId),
        totalColumns: columns.length,
      })

      // Reorder within the same column
      const overTask = tasks.find(t => t.id === over.id)
      if (overTask && overTask.id !== active.id && overTask.columnId === task.columnId) {
        onReorderTask(active.id, over.id)
      }
      dragOriginColId.current = null
    }
  }

  function handleDragCancel() {
    setActiveType(null)
    setActiveId(null)
    dragOriginColId.current = null
  }

  const colIds     = columns.map(c => c.id)
  const activeTask = activeType === 'task'   ? tasks.find(t => t.id === activeId)   : null
  const activeCol  = activeType === 'column' ? columns.find(c => c.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
        <div className="board">
          {columns.map(col => (
            <SortableCol
              key={col.id}
              col={col}
              allTasks={tasks}
              isDraggingCol={activeType === 'column'}
              columnsCount={columns.length}
              onToggleDone={onToggleDone}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onAddTask={onAddTask}
              onDeleteColumn={onDeleteColumn}
              onRenameColumn={onRenameColumn}
              onEditColumn={onEditColumn}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              movedTaskIds={movedTaskIds}
            />
          ))}

          <div className="add-column">
            <button className="add-column__btn" onClick={onAddColumn}>
              + Add column
            </button>
          </div>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={activeType === 'column'
        ? null
        : { duration: 220, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }
      }>
        {activeCol  ? <ColGhost col={activeCol} tasks={tasks} /> : null}
        {activeTask ? <TaskCard task={activeTask} overlay />    : null}
      </DragOverlay>
    </DndContext>
  )
}
