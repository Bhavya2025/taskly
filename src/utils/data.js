export const COLUMN_COLOR_OPTIONS = [
  '#7c3aed', '#5b8cff', '#14b8a6', '#22c55e', '#f59e0b',
  '#f97316', '#ef4444', '#ec4899', '#64748b', '#0ea5e9',
]

export const TASK_COLOR_OPTIONS = [
  '', '#7c3aed', '#5b8cff', '#14b8a6', '#22c55e',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
]

export const COLUMN_ICON_OPTIONS = [
  '📝', '📌', '💡', '🧠', '🛠️', '🚧', '🔎', '🧪', '📣', '✅', '🎯', '📚',
]

export const TASK_EMOJI_OPTIONS = [
  '', '📝', '💡', '🧠', '🛠️', '🔎', '⚡', '📦', '📣', '🎯', '✅', '🧪', '🗂️', '📚',
]

export const COLUMN_SOUND_OPTIONS = [
  { id: 'soft', label: 'Soft rise' },
  { id: 'bright', label: 'Bright click' },
  { id: 'lift', label: 'Lift' },
  { id: 'chime', label: 'Chime' },
  { id: 'reward', label: 'Reward' },
]

const DEFAULT_COLUMNS = [
  { id: 'col-todo', title: 'To Do', color: '#7c3aed', icon: '📝', soundPreset: 'soft' },
  { id: 'col-inprogress', title: 'Doing', color: '#5b8cff', icon: '⚡', soundPreset: 'bright' },
  { id: 'col-review', title: 'Review', color: '#f59e0b', icon: '🔎', soundPreset: 'lift' },
  { id: 'col-done', title: 'Done', color: '#22c55e', icon: '✅', soundPreset: 'reward' },
]

export function generateId() {
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function suggestColumnMeta(title = '', index = 0, total = 4) {
  const lower = title.toLowerCase()
  const isFinal = index >= total - 1 || /(done|complete|finished|published|closed|submitted|achieved)/.test(lower)

  if (/(idea|backlog|todo|learn|research|plan|inbox)/.test(lower)) {
    return { color: '#7c3aed', icon: '📝', soundPreset: 'soft' }
  }
  if (/(progress|doing|build|practice|create|active)/.test(lower)) {
    return { color: '#5b8cff', icon: '⚡', soundPreset: 'bright' }
  }
  if (/(review|test|check|refine|feedback)/.test(lower)) {
    return { color: '#f59e0b', icon: '🔎', soundPreset: 'lift' }
  }
  if (isFinal) {
    return { color: '#22c55e', icon: '✅', soundPreset: 'reward' }
  }

  return {
    color: COLUMN_COLOR_OPTIONS[index % COLUMN_COLOR_OPTIONS.length],
    icon: COLUMN_ICON_OPTIONS[index % COLUMN_ICON_OPTIONS.length],
    soundPreset: COLUMN_SOUND_OPTIONS[index % COLUMN_SOUND_OPTIONS.length].id,
  }
}

export function createColumn({
  id = generateId(),
  title,
  color,
  icon,
  soundPreset,
  custom = true,
}) {
  const fallback = suggestColumnMeta(title, 0, 4)
  return {
    id,
    title,
    color: color || fallback.color,
    icon: icon || fallback.icon,
    soundPreset: soundPreset || fallback.soundPreset,
    custom,
  }
}

export function normalizeTask(task = {}) {
  return {
    id: task.id || generateId(),
    title: task.title || 'Untitled task',
    description: task.description || '',
    priority: task.priority || 'medium',
    columnId: task.columnId || DEFAULT_COLUMNS[0].id,
    tags: Array.isArray(task.tags) ? task.tags : [],
    dueDate: task.dueDate || null,
    done: !!task.done,
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null,
    emoji: task.emoji || '',
    accentColor: task.accentColor || '',
  }
}

export function normalizeColumn(column = {}, index = 0, total = 4) {
  const fallback = suggestColumnMeta(column.title, index, total)
  return {
    id: column.id || generateId(),
    title: column.title || `Column ${index + 1}`,
    color: column.color || fallback.color,
    icon: column.icon || fallback.icon,
    soundPreset: column.soundPreset || fallback.soundPreset,
    custom: column.custom ?? true,
  }
}

export function normalizeBoardData(data) {
  const base = data || {}
  const columns = (base.columns?.length ? base.columns : DEFAULT_COLUMNS).map((column, index, list) =>
    normalizeColumn(column, index, list.length || DEFAULT_COLUMNS.length)
  )
  const firstColumnId = columns[0]?.id || DEFAULT_COLUMNS[0].id
  const validColumnIds = new Set(columns.map(column => column.id))
  const tasks = (base.tasks || []).map(task => normalizeTask({
    ...task,
    columnId: validColumnIds.has(task.columnId) ? task.columnId : firstColumnId,
  }))
  return { columns, tasks }
}

export function getDefaultData() {
  return normalizeBoardData({
    columns: DEFAULT_COLUMNS.map(column => ({ ...column, custom: false })),
    tasks: [],
  })
}
