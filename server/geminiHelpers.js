// ── Taskly AI — Groq helpers ──────────────────────────────────────────────────
// Shared by the Vite dev-server plugin and the Vercel serverless functions.
// Model: deepseek-r1-distill-llama-70b via Groq (free, stronger reasoning)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function getModel() {
  return process.env.TASKLY_GROQ_MODEL || 'deepseek-r1-distill-llama-70b'
}

export function getGeminiModel() { return getModel() }
export const GEMINI_MODEL = 'deepseek-r1-distill-llama-70b'

// ── System prompt ─────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are Taskly, the AI board assistant for a kanban-style task manager.
Your ONLY job is to help users create and edit project boards.
Return concise, actionable work items — never generic motivational fluff.
When the prompt is short or vague, infer the most common real-world interpretation and produce concrete subtopics.
Prefer 3–6 columns and 6–14 tasks unless the user clearly needs more or fewer.
Task titles must be short, specific, and actionable (under 10 words).
Column titles must be clear workflow-stage names (e.g. To Do, In Progress, Review, Done).
You may suggest hex colors for columns (#rrggbb), emoji icons, task accent colors, and sound presets (soft, bright, lift, chime, reward).
Do NOT invent tasks for blank-project requests.
IGNORE any message not about managing a project board — return type "unknown" with a polite redirect.
ALWAYS return valid JSON matching the exact structure specified in the user message.`

// ── Enums ─────────────────────────────────────────────────────────────────────
export const THEME_ENUM    = ['dark', 'light', 'teal', 'midnight', 'neon']
export const PRIORITY_ENUM = ['urgent', 'high', 'medium', 'low']
export const SOUND_ENUM    = ['soft', 'bright', 'lift', 'chime', 'reward']

// ── Schemas (kept for structure reference — Groq uses json_object mode) ────────
export const generateSchema = { type: 'json_object' }
export const commandSchema  = { type: 'json_object' }

// ── JSON structure descriptions injected into prompts ─────────────────────────
const GENERATE_JSON_STRUCTURE = `
Return ONLY a JSON object with this exact structure (no extra keys):
{
  "patternLabel": "short project type label e.g. 'Marketing Campaign'",
  "summary": "one sentence project summary",
  "suggestedTheme": "one of: dark, light, teal, midnight, neon",
  "suggestedEmoji": "single relevant emoji",
  "suggestedColumns": [
    { "title": "column name", "color": "#rrggbb or empty string", "icon": "emoji or empty string", "soundPreset": "one of: soft, bright, lift, chime, reward" }
  ],
  "tasks": [
    {
      "title": "short actionable task title",
      "description": "one sentence detail or empty string",
      "priority": "one of: urgent, high, medium, low",
      "suggestedColumn": "must match one of the suggestedColumns titles exactly",
      "tags": ["tag1"],
      "emoji": "single emoji or empty string",
      "accentColor": "#rrggbb or empty string"
    }
  ]
}`

const COMMAND_JSON_STRUCTURE = `
Return ONLY a JSON object with this exact structure (no extra keys):
{
  "type": "one of: delete_task, mark_done, move_task, rename_col, delete_col, add_col, add_task, set_description, set_column_color, set_column_sound, set_column_icon, set_task_emoji, set_task_color, set_priority, rename_task, info, unknown",
  "response": "short human-readable confirmation or info message",
  "taskQuery": "approximate task title to find (empty string if not applicable)",
  "columnQuery": "approximate column title to find (empty string if not applicable)",
  "title": "new title if renaming (empty string if not applicable)",
  "description": "new description if setting (empty string if not applicable)",
  "priority": "one of: urgent, high, medium, low, or empty string",
  "color": "#rrggbb hex color or empty string",
  "icon": "emoji icon or empty string",
  "emoji": "task emoji or empty string",
  "soundPreset": "one of: soft, bright, lift, chime, reward, or empty string",
  "done": true or false
}`

// ── Normalization helpers ─────────────────────────────────────────────────────
export function normalizeHex(v = '') {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : ''
}

function normalizeColumns(columns = []) {
  return columns.map((c, i) => ({
    title:       String(c?.title || `Column ${i + 1}`),
    color:       normalizeHex(c?.color),
    icon:        String(c?.icon  || ''),
    soundPreset: String(c?.soundPreset || ''),
  }))
}

function normalizeTasks(tasks = [], columns = []) {
  const byId = new Map(columns.map(c => [c.id, c.title]))
  return tasks.map(t => ({
    title:       String(t?.title || 'Untitled'),
    description: String(t?.description || ''),
    priority:    String(t?.priority || 'medium'),
    column:      byId.get(t?.columnId) || '',
    done:        !!t?.done,
    tags:        Array.isArray(t?.tags) ? t.tags.slice(0, 4) : [],
    emoji:       String(t?.emoji || ''),
    accentColor: normalizeHex(t?.accentColor),
  }))
}

// ── Prompt builders ───────────────────────────────────────────────────────────
export function buildGeneratePrompt({ prompt, existingColumns }) {
  return [
    'Generate a Taskly board plan based on the following context.',
    'If the prompt is only 1–2 words, infer the topic and produce concrete subtopics.',
    'Map tasks to existing columns where possible, suggest better ones if current ones are weak.',
    '',
    'Project context:',
    prompt,
    '',
    'Existing columns (use if suitable):',
    JSON.stringify(normalizeColumns(existingColumns), null, 2),
    '',
    'Use concise task titles. Be practical and specific.',
    GENERATE_JSON_STRUCTURE,
  ].join('\n')
}

export function buildProjectSeedPrompt({ projectName, description }) {
  return [
    'You are generating the FIRST board a user will ever see for their new project.',
    'This is their first impression — make it outstanding.',
    '',
    'Before producing output, deeply reason through:',
    '  1. What domain/industry does this project belong to?',
    '  2. What are the real workflow stages someone in this domain actually uses?',
    '  3. What are the most important concrete tasks to get started immediately?',
    '  4. What theme, emoji, and colors would feel cohesive and professional for this context?',
    '  5. Are the task titles specific and actionable — not generic filler?',
    '',
    `Project name: ${projectName || 'Untitled'}`,
    `User description: ${description || '(none — infer from the project name)'}`,
    '',
    'Requirements:',
    '  - 4–6 columns that reflect a REAL workflow for this specific domain (not generic "To Do / Done")',
    '  - 8–14 tasks spread across columns, each immediately useful and specific to this project',
    '  - Every task must have a clear description (1–2 sentences explaining why it matters)',
    '  - Assign priorities thoughtfully: 1–2 urgent, 2–3 high, rest medium/low',
    '  - Choose a suggestedTheme that fits the mood of the project',
    '  - Each column should have a fitting emoji icon and a hex color that complements the theme',
    '  - Tags should be short and genuinely useful for filtering (2–3 per task max)',
    '  - The summary should be one confident, specific sentence describing what this board helps the user achieve',
    '',
    GENERATE_JSON_STRUCTURE,
  ].join('\n')
}

export function buildCommandPrompt({ input, columns, tasks }) {
  return [
    'Interpret exactly one Taskly board command and return one structured action.',
    'Use taskQuery and columnQuery to reference existing items by approximate name.',
    'If the user asks for a summary or board status, return type "info" with the info in "response".',
    'If the request is off-topic, return type "unknown".',
    '',
    `User command: ${input}`,
    '',
    'Current columns:',
    JSON.stringify(normalizeColumns(columns), null, 2),
    '',
    'Current tasks:',
    JSON.stringify(normalizeTasks(tasks, columns), null, 2),
    '',
    COMMAND_JSON_STRUCTURE,
  ].join('\n')
}

// ── Groq API caller ───────────────────────────────────────────────────────────
export async function callGemini({ apiKey, schema, userPrompt, maxTokens = 2048 }) {
  if (!apiKey) {
    const err = new Error('Missing TASKLY_GROQ_API_KEY on the server.')
    err.statusCode = 503
    throw err
  }

  // Use node:https to avoid any fetch availability issues on Vercel runtimes
  const https = await import('node:https')
  const payload = JSON.stringify({
    model:           getModel(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt    },
    ],
    response_format: { type: 'json_object' },
    temperature:     0.7,
    max_tokens:      maxTokens,
  })

  const json = await new Promise((resolve, reject) => {
    const url = new URL(GROQ_URL)
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString())
          if (res.statusCode >= 400) {
            const err = new Error(body?.error?.message || `Groq error ${res.statusCode}`)
            err.statusCode = res.statusCode
            reject(err)
          } else {
            resolve(body)
          }
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })

  const text = json?.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq returned an empty response.')

  // Strip <think>…</think> blocks produced by reasoning models (e.g. deepseek-r1)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // If the text isn't pure JSON, extract the first JSON object as a fallback
  if (!cleaned.startsWith('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) cleaned = match[0]
  }
  return JSON.parse(cleaned)
}

// ── Shared JSON response helper ───────────────────────────────────────────────
export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

// ── Read JSON body — works in both Vercel (pre-parsed) and dev server (stream) ─
export async function readJsonBody(req) {
  // Vercel pre-parses JSON bodies into req.body
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  // Dev server: read raw stream
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}
