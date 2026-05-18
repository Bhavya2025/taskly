import { createColumn, generateId } from './data.js'

const SOUND_PRESETS = new Set(['soft', 'bright', 'lift', 'chime', 'reward'])
const THEMES = new Set(['dark', 'light', 'teal', 'midnight', 'neon'])
const PRIORITIES = new Set(['urgent', 'high', 'medium', 'low'])

function normalizeHex(value = '') {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : ''
}

function normalizeTheme(value = '') {
  return THEMES.has(value) ? value : 'light'
}

function normalizePriority(value = '') {
  return PRIORITIES.has(value) ? value : 'medium'
}

function normalizeSoundPreset(value = '') {
  return SOUND_PRESETS.has(value) ? value : 'soft'
}

function normalizeTagList(tags = []) {
  return Array.isArray(tags)
    ? tags.filter(Boolean).map(tag => String(tag).trim()).slice(0, 4)
    : []
}

async function postAi(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.error || 'Taskly AI is unavailable right now.')
  }
  return json
}

function normalizeColumnDetails(columns = []) {
  return columns
    .filter(column => column && typeof column.title === 'string' && column.title.trim())
    .slice(0, 6)
    .map(column => ({
      title: column.title.trim(),
      color: normalizeHex(column.color),
      icon: typeof column.icon === 'string' ? column.icon : '',
      soundPreset: normalizeSoundPreset(column.soundPreset),
    }))
}

function normalizeGeneratedTasks(tasks = [], suggestedColumns = []) {
  const allowedColumns = new Set(suggestedColumns.map(column => column.title.toLowerCase()))
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => task && typeof task.title === 'string' && task.title.trim())
    .slice(0, 18)
    .map(task => ({
      id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: task.title.trim(),
      description: typeof task.description === 'string' ? task.description.trim() : '',
      priority: normalizePriority(task.priority),
      suggestedColumn: allowedColumns.has(String(task.suggestedColumn || '').toLowerCase())
        ? String(task.suggestedColumn).trim()
        : (suggestedColumns[0]?.title || 'To Do'),
      tags: normalizeTagList(task.tags),
      emoji: typeof task.emoji === 'string' ? task.emoji : '',
      accentColor: normalizeHex(task.accentColor),
    }))
}

function buildBoardDataFromResult(result) {
  const suggestedColumnDetails = normalizeColumnDetails(result.suggestedColumns)
  const columns = suggestedColumnDetails.map(column =>
    createColumn({
      id: generateId(),
      title: column.title,
      color: column.color,
      icon: column.icon,
      soundPreset: column.soundPreset,
      custom: true,
    })
  )

  const tasks = normalizeGeneratedTasks(result.tasks, suggestedColumnDetails).map(task => {
    const column = columns.find(entry => entry.title.toLowerCase() === task.suggestedColumn.toLowerCase()) || columns[0]
    return {
      id: generateId(),
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      columnId: column?.id || columns[0]?.id,
      tags: task.tags || [],
      dueDate: null,
      done: false,
      createdAt: new Date().toISOString(),
      emoji: task.emoji || '',
      accentColor: task.accentColor || '',
    }
  })

  return { columns, tasks }
}

function normalizeGenerateResult(json = {}) {
  const suggestedColumnDetails = normalizeColumnDetails(json.suggestedColumns)
  return {
    patternLabel: typeof json.patternLabel === 'string' && json.patternLabel.trim()
      ? json.patternLabel.trim()
      : 'Taskly Plan',
    summary: typeof json.summary === 'string' ? json.summary.trim() : '',
    suggestedTheme: normalizeTheme(json.suggestedTheme),
    suggestedEmoji: typeof json.suggestedEmoji === 'string' && json.suggestedEmoji.trim()
      ? json.suggestedEmoji.trim()
      : '📝',
    suggestedColumns: suggestedColumnDetails.map(column => column.title),
    suggestedColumnDetails,
    tasks: normalizeGeneratedTasks(json.tasks, suggestedColumnDetails),
    model: typeof json.model === 'string' ? json.model : '',
  }
}

function snapshotColumns(columns = []) {
  return columns.map(column => ({
    title: column.title,
    color: column.color,
    icon: column.icon,
    soundPreset: column.soundPreset,
  }))
}

function snapshotTasks(tasks = [], columns = []) {
  const byId = new Map(columns.map(column => [column.id, column.title]))
  return tasks.map(task => ({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    column: byId.get(task.columnId) || '',
    done: !!task.done,
    tags: normalizeTagList(task.tags),
    emoji: task.emoji || '',
    accentColor: task.accentColor || '',
  }))
}

function scoreOverlap(query, candidate) {
  if (!query || !candidate) return 0
  const q = query.toLowerCase().trim()
  const c = candidate.toLowerCase().trim()
  if (!q || !c) return 0
  if (q === c) return 100
  if (c.includes(q) || q.includes(c)) return 70

  const qWords = q.split(/\s+/).filter(word => word.length > 1)
  const cWords = c.split(/\s+/).filter(word => word.length > 1)
  const overlap = qWords.filter(word => cWords.some(candidateWord => candidateWord.includes(word) || word.includes(candidateWord))).length
  return overlap ? Math.round((overlap / Math.max(qWords.length, 1)) * 50) : 0
}

export function fuzzyFindTask(query, tasks = []) {
  let best = null
  let bestScore = 0
  for (const task of tasks) {
    const score = scoreOverlap(query, task.title)
    if (score > bestScore) {
      best = task
      bestScore = score
    }
  }
  return bestScore >= 25 ? best : null
}

export function fuzzyFindColumn(query, columns = []) {
  let best = null
  let bestScore = 0
  for (const column of columns) {
    const score = scoreOverlap(query, column.title)
    if (score > bestScore) {
      best = column
      bestScore = score
    }
  }
  return bestScore >= 25 ? best : (columns[0] || null)
}

export async function generateTasks(description, existingColumns = []) {
  const json = await postAi('/api/ai/generate', {
    prompt: description,
    existingColumns: snapshotColumns(existingColumns),
  })
  return normalizeGenerateResult(json)
}

export async function buildProjectSeed(projectName, description = '') {
  if (!description.trim()) {
    return {
      summary: '',
      suggestedTheme: 'light',
      suggestedEmoji: '📝',
      data: null,
      model: '',
    }
  }

  const json = await postAi('/api/ai/project-seed', {
    projectName,
    description,
  })
  const result = normalizeGenerateResult(json)
  return {
    summary: result.summary,
    suggestedTheme: result.suggestedTheme,
    suggestedEmoji: result.suggestedEmoji,
    data: buildBoardDataFromResult(result),
    model: result.model,
  }
}

export async function parseCommand(input, columns = [], tasks = []) {
  const json = await postAi('/api/ai/command', {
    input,
    columns: snapshotColumns(columns),
    tasks: snapshotTasks(tasks, columns),
  })

  return {
    type: typeof json.type === 'string' ? json.type : 'unknown',
    response: typeof json.response === 'string' ? json.response : '',
    taskQuery: typeof json.taskQuery === 'string' ? json.taskQuery.trim() : '',
    columnQuery: typeof json.columnQuery === 'string' ? json.columnQuery.trim() : '',
    title: typeof json.title === 'string' ? json.title.trim() : '',
    description: typeof json.description === 'string' ? json.description.trim() : '',
    priority: json.priority && PRIORITIES.has(json.priority) ? json.priority : '',
    color: normalizeHex(json.color),
    icon: typeof json.icon === 'string' ? json.icon : '',
    emoji: typeof json.emoji === 'string' ? json.emoji : '',
    soundPreset: json.soundPreset && SOUND_PRESETS.has(json.soundPreset) ? json.soundPreset : '',
    done: !!json.done,
    model: typeof json.model === 'string' ? json.model : '',
  }
}
