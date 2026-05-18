import { useEffect, useRef, useState } from 'react'
import { generateId } from '../utils/data'
import { buildProjectSeed } from '../utils/aiAgent'
import UserAvatar from '../components/UserAvatar'
import TrashPanel from '../components/TrashPanel'

const COLORS = [
  '#5b8cff', '#ef6b57', '#f59e0b', '#14b8a6', '#8b5cf6',
  '#ec4899', '#22c55e', '#0ea5e9', '#f97316', '#64748b',
]

const PROJECT_ICONS = [
  '📝','💻','📚','📣','🖌️','💰','✈️','🌿','💼','🔎',
  '🎉','🏠','🛍️','🍽️','📷','⚖️','🚀','🎮','🎵','📦',
  '🧪','🎓','🏋️','🤝','📊','🗓️','🔧','🌍','💡','🎯',
]

const THEMES = [
  { id: 'dark',  label: 'Dark',  previewCls: 'theme-opt__preview--dark'  },
  { id: 'light', label: 'Light', previewCls: 'theme-opt__preview--light' },
]

const ROTATE_TEXTS = [
  'your product launch.',
  'your study plan.',
  'your side project.',
  "your team's workflow.",
  'your client work.',
  'your next big idea.',
]

// Auto-pick a sensible emoji from the project name
function autoEmoji(name = '') {
  const l = name.toLowerCase()
  if (/code|dev|soft|app|web|api|tech|program|react|node|bug|deploy/.test(l)) return '💻'
  if (/study|learn|school|exam|course|lecture|homework|class|uni/.test(l)) return '📚'
  if (/market|brand|social|content|campaign|ads|seo|email/.test(l)) return '📣'
  if (/design|ui|ux|figma|sketch|creative|art|illustrat/.test(l)) return '🖌️'
  if (/finance|budget|money|invest|expense|revenue|tax/.test(l)) return '💰'
  if (/travel|trip|vacation|holiday|flight|hotel/.test(l)) return '✈️'
  if (/health|fit|habit|workout|gym|diet|run|meditat/.test(l)) return '🌿'
  if (/client|business|work|job|consult|service/.test(l)) return '💼'
  if (/research|analysis|data|report|survey|paper/.test(l)) return '🔎'
  if (/event|party|wedding|conference|meetup|birthday/.test(l)) return '🎉'
  if (/home|house|apart|move|rent|garden/.test(l)) return '🏠'
  if (/shop|buy|order|errand|list|grocery/.test(l)) return '🛍️'
  if (/food|meal|cook|recipe|restaurant|cafe/.test(l)) return '🍽️'
  if (/photo|video|media|podcast|film|record/.test(l)) return '📷'
  if (/launch|ship|release|product|startup/.test(l)) return '🚀'
  if (/game|play|entertain|fun|hobby/.test(l)) return '🎮'
  if (/music|band|song|record|studio/.test(l)) return '🎵'
  return '📝'
}

// ── Project templates ──────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'study',
    emoji: '📚',
    label: 'Study Plan',
    desc: 'Organise coursework, readings, and exam prep.',
    color: '#0ea5e9',
    columns: [
      { title: 'Backlog',      color: '#64748b' },
      { title: 'In Progress',  color: '#0ea5e9' },
      { title: 'Review',       color: '#f59e0b' },
      { title: 'Done',         color: '#22c55e' },
    ],
    tasks: [
      { title: 'Read Chapter 1', col: 'Backlog',     priority: 'medium', tags: ['reading'] },
      { title: 'Complete problem set', col: 'Backlog', priority: 'high', tags: ['homework'] },
      { title: 'Write summary notes', col: 'In Progress', priority: 'medium', tags: ['notes'] },
      { title: 'Practice past exams', col: 'Backlog', priority: 'urgent', tags: ['exam'] },
    ],
  },
  {
    id: 'work',
    emoji: '💼',
    label: 'Work Sprint',
    desc: 'Two-week sprint with tasks and reviews.',
    color: '#8b5cf6',
    columns: [
      { title: 'To Do',        color: '#64748b' },
      { title: 'In Progress',  color: '#8b5cf6' },
      { title: 'In Review',    color: '#f59e0b' },
      { title: 'Done',         color: '#22c55e' },
    ],
    tasks: [
      { title: 'Morning standup prep', col: 'To Do',       priority: 'low',    tags: ['daily'] },
      { title: 'Write weekly report',  col: 'To Do',       priority: 'medium', tags: ['report'] },
      { title: 'Code review PR #12',   col: 'In Progress', priority: 'high',   tags: ['dev'] },
      { title: 'Update documentation', col: 'To Do',       priority: 'medium', tags: ['docs'] },
    ],
  },
  {
    id: 'personal',
    emoji: '🌿',
    label: 'Personal Goals',
    desc: 'Track habits and life goals.',
    color: '#22c55e',
    columns: [
      { title: 'Ideas',     color: '#64748b' },
      { title: 'Active',    color: '#22c55e' },
      { title: 'Tracking',  color: '#0ea5e9' },
      { title: 'Done',      color: '#f59e0b' },
    ],
    tasks: [
      { title: 'Morning workout 3×/week', col: 'Active',   priority: 'high',   tags: ['health'] },
      { title: 'Read 20 pages daily',     col: 'Tracking', priority: 'medium', tags: ['reading'] },
      { title: 'Meal prep on Sunday',     col: 'Active',   priority: 'medium', tags: ['food'] },
      { title: 'Learn a new skill',       col: 'Ideas',    priority: 'low',    tags: ['growth'] },
    ],
  },
  {
    id: 'dev',
    emoji: '💻',
    label: 'Dev Project',
    desc: 'Software development with a CI/CD flow.',
    color: '#6c63ff',
    columns: [
      { title: 'Backlog',    color: '#64748b' },
      { title: 'In Progress',color: '#6c63ff' },
      { title: 'Testing',    color: '#f59e0b' },
      { title: 'Deployed',   color: '#22c55e' },
    ],
    tasks: [
      { title: 'Set up repo & CI',       col: 'Deployed',   priority: 'high',   tags: ['setup'] },
      { title: 'Design DB schema',       col: 'In Progress',priority: 'high',   tags: ['backend'] },
      { title: 'Build auth flow',        col: 'Backlog',    priority: 'urgent', tags: ['auth'] },
      { title: 'Write unit tests',       col: 'Backlog',    priority: 'medium', tags: ['testing'] },
    ],
  },
  {
    id: 'event',
    emoji: '🎉',
    label: 'Event Planning',
    desc: 'Coordinate any event from idea to wrap-up.',
    color: '#ec4899',
    columns: [
      { title: 'Ideas',      color: '#64748b' },
      { title: 'Confirmed',  color: '#ec4899' },
      { title: 'In Progress',color: '#f59e0b' },
      { title: 'Done',       color: '#22c55e' },
    ],
    tasks: [
      { title: 'Book venue',      col: 'Confirmed',  priority: 'urgent', tags: ['venue'] },
      { title: 'Send invites',    col: 'In Progress',priority: 'high',   tags: ['comms'] },
      { title: 'Arrange catering',col: 'Ideas',      priority: 'medium', tags: ['food'] },
      { title: 'Create schedule', col: 'In Progress',priority: 'high',   tags: ['planning'] },
    ],
  },
  {
    id: 'habits',
    emoji: '🏋️',
    label: 'Habit Tracker',
    desc: 'Build and maintain daily + weekly habits.',
    color: '#f59e0b',
    columns: [
      { title: 'Daily',    color: '#f59e0b' },
      { title: 'Weekly',   color: '#0ea5e9' },
      { title: 'Monthly',  color: '#8b5cf6' },
      { title: 'Achieved', color: '#22c55e' },
    ],
    tasks: [
      { title: '10 min meditation',  col: 'Daily',  priority: 'medium', tags: ['mindset'] },
      { title: 'Review goals',       col: 'Weekly', priority: 'medium', tags: ['planning'] },
      { title: 'Strength training',  col: 'Daily',  priority: 'high',   tags: ['fitness'] },
      { title: 'Monthly reflection', col: 'Monthly',priority: 'low',    tags: ['growth'] },
    ],
  },
]

// ── Demo board data ────────────────────────────────────────────────────────────
const DEMO_COLS = [
  { title: 'Backlog',     color: '#5b8cff' },
  { title: 'In Progress', color: '#8b5cf6' },
  { title: 'Review',      color: '#f59e0b' },
  { title: 'Done',        color: '#22c55e' },
]

const DEMO_TASKS = [
  { col: 0, label: 'Set up analytics',    prio: '#ef6b57', tag: 'data'    },
  { col: 0, label: 'Write pricing copy',  prio: '#f59e0b', tag: 'content' },
  { col: 1, label: 'Landing page build',  prio: '#8b5cf6', tag: 'dev',     active: true },
  { col: 1, label: 'Stripe integration',  prio: '#ec4899', tag: 'dev'     },
  { col: 2, label: 'Design review',       prio: '#f59e0b', tag: 'design'  },
  { col: 3, label: 'Brand guidelines',    prio: '#22c55e', tag: 'done',    done: true },
]

const FEATURES = [
  {
    icon: '✦',
    title: 'AI board setup',
    desc: 'Describe your project in plain text. Get columns and starter tasks in seconds.',
  },
  {
    icon: '↶',
    title: 'Undo anything',
    desc: 'Every action — including drag-and-drop — can be reversed with one click.',
  },
  {
    icon: '⌘',
    title: 'Keyboard-first',
    desc: 'Navigate, create, and edit without ever touching the mouse.',
  },
]

export default function Home({
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  theme,
  onCycleTheme,
  soundEnabled,
  onSoundToggle,
  globalSettings,
  onGlobalSettingsChange,
  sounds,
  user,
  profile,
  onProfileUpdate,
  onAuthClick,
  onSignOut,
  tutorialActive,
  trashedProjects = [],
  trashPanelOpen,
  onTrashPanelOpen,
  onTrashPanelClose,
  onRestoreProject,
  onPermanentDelete,
  onEmptyTrash,
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [customEmoji, setCustomEmoji] = useState(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [aiContext, setAiContext] = useState('')
  const [createMode, setCreateMode] = useState('blank')
  const [aiSeed, setAiSeed] = useState({ summary: '', suggestedTheme: 'dark', suggestedEmoji: '', data: null, model: '' })
  const [aiSeedLoading, setAiSeedLoading] = useState(false)
  const [aiSeedError, setAiSeedError] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)   // project to confirm-delete
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [uniOpen, setUniOpen] = useState(false)
  const [uniTheme, setUniTheme] = useState(globalSettings?.defaultTheme || 'dark')
  const [uniSound, setUniSound] = useState(globalSettings?.soundEnabled ?? true)
  const [rotateIndex, setRotateIndex] = useState(0)
  const [rotateVisible, setRotateVisible] = useState(true)
  const aiSeedReqRef = useRef(0)

  // Rotating hero text
  useEffect(() => {
    const interval = setInterval(() => {
      setRotateVisible(false)
      setTimeout(() => {
        setRotateIndex(i => (i + 1) % ROTATE_TEXTS.length)
        setRotateVisible(true)
      }, 350)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const themeIcon = theme === 'dark' ? '☀' : '◑'
  const shouldGenerate = createMode === 'generate' && aiContext.trim().length > 0
  const previewTaskCount = shouldGenerate ? (aiSeed.data?.tasks.length ?? 0) : 0
  const previewColumnCount = shouldGenerate ? (aiSeed.data?.columns.length ?? 0) : 0

  // Emoji priority: user-selected > AI suggested > auto from name
  const projectEmoji = customEmoji
    || (shouldGenerate && aiSeed.suggestedEmoji ? aiSeed.suggestedEmoji : autoEmoji(name))

  // ── AI debounce: 2.5 s after user stops typing ─────────────────────────────
  useEffect(() => {
    if (!creating || !shouldGenerate) {
      setAiSeed({ summary: '', suggestedTheme: 'dark', suggestedEmoji: '', data: null, model: '' })
      setAiSeedLoading(false)
      setAiSeedError('')
      return
    }

    const requestId = aiSeedReqRef.current + 1
    aiSeedReqRef.current = requestId
    setAiSeedLoading(true)
    setAiSeedError('')

    // Wait 2.5 s after the last keystroke before hitting the API
    const timer = setTimeout(async () => {
      try {
        const nextSeed = await buildProjectSeed(name.trim(), aiContext.trim())
        if (aiSeedReqRef.current !== requestId) return
        setAiSeed(nextSeed)
      } catch (error) {
        if (aiSeedReqRef.current !== requestId) return
        setAiSeed({ summary: '', suggestedTheme: 'dark', suggestedEmoji: '', data: null, model: '' })
        setAiSeedError(error.message || 'The assistant could not build a preview.')
      } finally {
        if (aiSeedReqRef.current === requestId) setAiSeedLoading(false)
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [creating, shouldGenerate, name, aiContext])

  function openCreate(tmpl) {
    // Guard: a real template has a `columns` array; ignore synthetic event objects
    const validTmpl = tmpl && Array.isArray(tmpl.columns) ? tmpl : null

    setName(validTmpl ? validTmpl.label : '')
    setColor(validTmpl ? validTmpl.color : COLORS[0])
    setCustomEmoji(validTmpl ? validTmpl.emoji : null)
    setEmojiPickerOpen(false)
    setAiContext('')
    setCreateMode('blank')
    setAiSeed({ summary: '', suggestedTheme: 'dark', suggestedEmoji: '', data: null, model: '' })
    setAiSeedError('')
    setAiSeedLoading(false)
    setCreatingProject(false)
    setSelectedTemplate(validTmpl)
    setCreating(true)
    sounds?.playClick?.()
  }

  function applyTemplate(tmpl) {
    setSelectedTemplate(tmpl)
    setName(tmpl.label)
    setColor(tmpl.color)
    setCustomEmoji(tmpl.emoji)
    setCreateMode('blank') // templates bypass AI mode
  }

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName || creatingProject) return

    let nextSeed = aiSeed
    if (shouldGenerate && !nextSeed.data) {
      try {
        setCreatingProject(true)
        setAiSeedError('')
        nextSeed = await buildProjectSeed(trimmedName, aiContext.trim())
        setAiSeed(nextSeed)
      } catch (error) {
        setAiSeedError(error.message || 'The assistant could not build this project yet.')
        setCreatingProject(false)
        return
      }
    }

    const emoji = customEmoji
      || (shouldGenerate && nextSeed.suggestedEmoji ? nextSeed.suggestedEmoji : autoEmoji(trimmedName))

    // Build board data from template if one was selected
    let templateBoardData = null
    if (selectedTemplate) {
      const cols = selectedTemplate.columns.map(c => ({
        id: generateId(), title: c.title, color: c.color, custom: true,
      }))
      const tasks = selectedTemplate.tasks.map(t => {
        const col = cols.find(c => c.title === t.col) || cols[0]
        return {
          id: generateId(), title: t.title, description: '', priority: t.priority,
          columnId: col.id, tags: t.tags || [], dueDate: null, done: false,
          createdAt: new Date().toISOString(), emoji: '', accentColor: '',
        }
      })
      templateBoardData = { columns: cols, tasks }
    }

    const project = {
      id: generateId(),
      name: trimmedName,
      color,
      emoji,
      summary: shouldGenerate ? nextSeed.summary : (selectedTemplate?.desc || ''),
      theme: null,
      createdAt: new Date().toISOString(),
      taskCount: selectedTemplate
        ? selectedTemplate.tasks.length
        : shouldGenerate ? (nextSeed.data?.tasks.length ?? 0) : 0,
      tasksDone: 0,
    }

    onCreateProject({ project, boardData: templateBoardData || (shouldGenerate ? nextSeed.data : null) })
    setCreatingProject(false)
    setCreating(false)
    onOpenProject(project.id)
  }

  function handleSaveUniSettings() {
    onGlobalSettingsChange?.({ defaultTheme: uniTheme, soundEnabled: uniSound })
    setUniOpen(false)
    sounds?.playClick?.()
  }

  return (
    <div className="home">
      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <header className="home-bar">
        <div className="home-bar__logo">
          <div className="home-bar__logo-icon">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.9" />
              <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.5" />
              <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.5" />
              <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.9" />
            </svg>
          </div>
          Taskly
        </div>

        <div className="home-bar__right">
          <button
            className="home-bar__icon-btn home-bar__icon-btn--theme"
            onClick={onCycleTheme}
            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          >
            {themeIcon}
          </button>
          <button
            className={`home-bar__icon-btn home-bar__icon-btn--sound ${soundEnabled ? '' : 'muted'}`}
            onClick={onSoundToggle}
            title="Toggle sound"
          >
            ♪
          </button>
          {user && trashedProjects.length > 0 && !tutorialActive && (
            <button
              className="home-bar__icon-btn"
              style={{ position: 'relative' }}
              onClick={onTrashPanelOpen}
              title="Trash"
            >
              🗑️
              <span style={{
                position: 'absolute', top: -3, right: -3,
                background: '#e05252', color: '#fff',
                fontSize: '9px', fontWeight: 700,
                borderRadius: '50%', width: 14, height: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {trashedProjects.length}
              </span>
            </button>
          )}
          {!tutorialActive && (
            <UserAvatar
              user={user}
              profile={profile}
              onProfileUpdate={onProfileUpdate}
              onSignOut={onSignOut}
              onAuthClick={onAuthClick}
              globalTheme={theme}
              onThemeChange={onCycleTheme}
              soundEnabled={soundEnabled}
              onSoundToggle={onSoundToggle}
            />
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="home-hero">
        {/* Ambient glow orbs */}
        <div className="home-hero__orb home-hero__orb--a" />
        <div className="home-hero__orb home-hero__orb--b" />
        <div className="home-hero__orb home-hero__orb--c" />

        <div className="home-hero__inner">
          {/* Left: copy */}
          <div className="home-hero__brand">
            <div className="home-hero__eyebrow">
              <span className="home-hero__eyebrow-dot" />
              AI-powered task boards
            </div>

            <h1 className="home-hero__title">
              Plan<br />
              <span className="home-hero__title-accent">anything.</span>
            </h1>

            <div className="home-hero__rotate-wrap">
              <span className="home-hero__rotate-prefix">Built for </span>
              <span
                className={`home-hero__rotate-text ${rotateVisible ? 'home-hero__rotate-text--in' : 'home-hero__rotate-text--out'}`}
              >
                {ROTATE_TEXTS[rotateIndex]}
              </span>
            </div>

            <p className="home-hero__sub">
              Start with a blank board or describe your project — the AI sets up columns and tasks so you can start working immediately.
            </p>

            <div className="home-hero__actions">
              <button className="home-hero__cta" onClick={openCreate}>
                Start a project
                <span className="home-hero__cta-arrow">→</span>
              </button>
              {projects.length > 0 && (
                <button
                  className="home-hero__cta-ghost"
                  onClick={() => document.querySelector('.home-main')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  View projects ({projects.length})
                </button>
              )}
            </div>
          </div>

          {/* Right: animated board demo */}
          <div className="home-hero__demo">
            <div className="demo-surface">
              {/* Title bar */}
              <div className="demo-surface__titlebar">
                <div className="demo-surface__dots">
                  <span className="demo-surface__dot demo-surface__dot--red" />
                  <span className="demo-surface__dot demo-surface__dot--yellow" />
                  <span className="demo-surface__dot demo-surface__dot--green" />
                </div>
                <div className="demo-surface__title">launch prep · 6 tasks</div>
                <div className="demo-surface__controls">
                  <span className="demo-surface__ctrl-pill">↶ Undo</span>
                  <span className="demo-surface__ctrl-pill demo-surface__ctrl-pill--accent">+ Task</span>
                </div>
              </div>

              {/* Board columns */}
              <div className="demo-board">
                {DEMO_COLS.map((col, ci) => {
                  const tasks = DEMO_TASKS.filter(t => t.col === ci)
                  return (
                    <div key={col.title} className="demo-col">
                      <div className="demo-col__header">
                        <span className="demo-col__dot" style={{ background: col.color }} />
                        <span className="demo-col__name">{col.title}</span>
                        <span className="demo-col__count">{tasks.length}</span>
                      </div>
                      {tasks.map((task, ti) => (
                        <div
                          key={ti}
                          className={`demo-task ${task.active ? 'demo-task--active' : ''} ${task.done ? 'demo-task--done' : ''}`}
                          style={{ animationDelay: `${ci * 0.12 + ti * 0.09}s` }}
                        >
                          <span className="demo-task__prio" style={{ background: task.prio }} />
                          <span className="demo-task__label">{task.label}</span>
                          <span className="demo-task__tag">{task.tag}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Floating dragged card */}
                <div className="demo-drag-task">
                  <span className="demo-task__prio" style={{ background: '#14b8a6' }} />
                  <span className="demo-task__label">SEO audit</span>
                  <span className="demo-task__tag">seo</span>
                </div>

                {/* Modern circle cursor */}
                <div className="demo-cursor">
                  <div className="demo-cursor__glow" />
                  <div className="demo-cursor__ring" />
                  <div className="demo-cursor__dot" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature strip ───────────────────────────────────────────────────── */}
      <section className="home-features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="home-feature" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="home-feature__icon">{f.icon}</div>
            <div className="home-feature__text">
              <div className="home-feature__title">{f.title}</div>
              <div className="home-feature__desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Projects section ─────────────────────────────────────────────────── */}
      <main className="home-main">
        <div className="home-main__header">
          <h2>Your projects</h2>
          <div className="home-main__actions">
            <button
              className="btn-settings-home"
              title="Global settings"
              onClick={() => { setUniOpen(true); sounds?.playClick?.() }}
            >
              ⚙
            </button>
            <button className="btn-new-project" onClick={openCreate}>+ New project</button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty__icon">🗂️</div>
            <p className="home-empty__text">No projects yet</p>
            <p className="home-empty__sub">Create a blank board or let the AI draft one from your brief.</p>
            <button className="home-empty__btn" onClick={openCreate}>Create first project</button>
          </div>
        ) : (
          <div className="home-grid">
            {projects.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={i}
                onOpen={() => onOpenProject(project.id)}
                onDeleteRequest={() => { setDeleteTarget(project); setDeleteConfirmText('') }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Template showcase ───────────────────────────────────────────────── */}
      <section className="home-templates">
        <div className="home-templates__header">
          <div>
            <div className="home-templates__title">Quick start templates</div>
            <div className="home-templates__sub">One click to create a ready-made project board</div>
          </div>
        </div>
        <div className="home-tmpl-grid">
          {TEMPLATES.map(tmpl => (
            <div
              key={tmpl.id}
              className="home-tmpl-card"
              onClick={() => openCreate(tmpl)}
            >
              <div className="home-tmpl-card__top">
                <span
                  className="home-tmpl-card__icon"
                  style={{ background: tmpl.color + '20' }}
                >
                  {tmpl.emoji}
                </span>
                <div>
                  <div className="home-tmpl-card__name">{tmpl.label}</div>
                </div>
              </div>
              <p className="home-tmpl-card__desc">{tmpl.desc}</p>
              <div className="home-tmpl-card__cols">
                {tmpl.columns.slice(0, 3).map(col => (
                  <span
                    key={col.title}
                    className="home-tmpl-card__col-tag"
                    style={{ background: col.color + '22', color: col.color }}
                  >
                    {col.title}
                  </span>
                ))}
                {tmpl.columns.length > 3 && (
                  <span
                    className="home-tmpl-card__col-tag"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-3)' }}
                  >
                    +{tmpl.columns.length - 3}
                  </span>
                )}
              </div>
              <button
                className="home-tmpl-card__use"
                onClick={e => { e.stopPropagation(); openCreate(tmpl) }}
              >
                Use template →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <div className="home-footer__ribbon">
          {['Plan launches','Study topics','Track habits','Practice skills','Organize clients','Ship projects'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="home-footer__credit">
          <span className="home-footer__credit-dot" />
          <span>by</span>
          <strong className="home-footer__credit-name">Bhavya Kumar</strong>
        </div>
      </footer>

      {/* ── Create project modal ─────────────────────────────────────────────── */}
      {creating && (
        <div className="create-overlay" onClick={e => e.target === e.currentTarget && setCreating(false)}>
          <div className="create-modal">
            <div className="create-modal__header">
              <span>New project</span>
              <button onClick={() => setCreating(false)}>✕</button>
            </div>

            {/* Preview banner */}
            <div className="create-modal__preview" style={{ background: color }}>
              <button
                className="create-modal__prev-emoji"
                onClick={() => setEmojiPickerOpen(o => !o)}
                title="Click to choose icon"
              >
                {projectEmoji}
                <span className="create-modal__prev-emoji-hint">✏</span>
              </button>
              <span className="create-modal__prev-name">{name || 'Project name'}</span>
            </div>

            {/* Emoji picker panel */}
            {emojiPickerOpen && (
              <div className="emoji-picker-panel">
                <div className="emoji-picker-panel__header">
                  <span>Choose icon</span>
                  <button
                    className="emoji-picker-panel__cancel"
                    onClick={() => { setEmojiPickerOpen(false); setCustomEmoji(null) }}
                  >
                    Reset to auto
                  </button>
                  <button
                    className="emoji-picker-panel__close"
                    onClick={() => setEmojiPickerOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="emoji-picker-panel__grid">
                  {PROJECT_ICONS.map(em => (
                    <button
                      key={em}
                      className={`emoji-picker-opt ${customEmoji === em ? 'emoji-picker-opt--active' : ''}`}
                      onClick={() => { setCustomEmoji(em); setEmojiPickerOpen(false) }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="create-modal__body">
              <div className="field-stack">
                <div className="create-modal__section-label">Project name</div>
                <input
                  autoFocus
                  className="create-modal__input"
                  placeholder="e.g. Website redesign, Study plan, Launch checklist…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) handleCreate()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                />
              </div>

              {/* Templates */}
              <div className="field-stack">
                <div className="create-modal__section-label">Start from a template</div>
                <div className="template-grid">
                  {TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl.id}
                      className={`template-card ${selectedTemplate?.id === tmpl.id ? 'template-card--active' : ''}`}
                      style={{ '--tmpl-color': tmpl.color }}
                      onClick={() => applyTemplate(tmpl)}
                    >
                      <span className="template-card__emoji">{tmpl.emoji}</span>
                      <span className="template-card__label">{tmpl.label}</span>
                    </button>
                  ))}
                  {selectedTemplate && (
                    <button
                      className="template-card template-card--clear"
                      onClick={() => { setSelectedTemplate(null); setCustomEmoji(null); setName('') }}
                    >
                      <span className="template-card__emoji">✕</span>
                      <span className="template-card__label">Clear</span>
                    </button>
                  )}
                </div>
                {selectedTemplate && (
                  <p className="template-selected-hint">
                    Using <strong>{selectedTemplate.label}</strong> — {selectedTemplate.desc}
                  </p>
                )}
              </div>

              <div className="field-stack">
                <div className="create-modal__section-label">How should this start?</div>
                <div className="create-mode-toggle">
                  <button
                    className={`create-mode-toggle__btn ${createMode === 'blank' ? 'create-mode-toggle__btn--active' : ''}`}
                    onClick={() => setCreateMode('blank')}
                  >
                    🗒 Blank board
                  </button>
                  <button
                    className={`create-mode-toggle__btn ${createMode === 'generate' ? 'create-mode-toggle__btn--active' : ''}`}
                    onClick={() => setCreateMode('generate')}
                  >
                    ✦ AI starter board
                  </button>
                </div>
              </div>

              {createMode === 'generate' && (
                <div className="field-stack">
                  <div className="create-modal__section-label">Describe your project</div>
                  <textarea
                    className="create-modal__textarea"
                    placeholder="What is this project about? The AI will draft columns and tasks once you stop typing for a moment."
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
                    rows={4}
                  />
                </div>
              )}

              {createMode === 'generate' && (
                <div className="create-modal__assistant-card">
                  <div className="create-modal__assistant-head">
                    <div>
                      <div className="create-modal__assistant-title">✦ AI preview</div>
                      <div className="create-modal__assistant-sub">
                        {aiSeedLoading
                          ? 'Thinking through your board…'
                          : aiSeedError
                          ? 'Could not build a preview yet.'
                          : shouldGenerate && aiSeed.data
                          ? `${previewColumnCount} columns · ${previewTaskCount} tasks ready`
                          : !aiContext.trim()
                          ? 'Add a description to preview your AI-generated board.'
                          : 'Waiting for you to stop typing…'}
                      </div>
                    </div>
                    {aiSeedLoading && <div className="create-modal__ai-spinner" />}
                  </div>

                  {aiSeedError ? (
                    <div className="create-modal__ai-error">{aiSeedError}</div>
                  ) : shouldGenerate && (aiSeed.summary || aiSeedLoading) ? (
                    <div className="create-modal__ai-summary">
                      <div className="create-modal__ai-badge">AI</div>
                      <div>{aiSeedLoading ? 'Building your board…' : aiSeed.summary}</div>
                    </div>
                  ) : null}
                </div>
              )}

              <div>
                <div className="create-modal__section-label">Color</div>
                <div className="create-modal__colors">
                  {COLORS.map(swatch => (
                    <button
                      key={swatch}
                      className={`color-swatch ${color === swatch ? 'color-swatch--active' : ''}`}
                      style={{ background: swatch }}
                      onClick={() => setColor(swatch)}
                    />
                  ))}
                </div>
              </div>

              <div className="create-modal__actions">
                <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={handleCreate}
                  disabled={creatingProject || !name.trim() || (shouldGenerate && aiSeedLoading)}
                >
                  {creatingProject
                    ? 'Creating…'
                    : shouldGenerate
                      ? 'Create with AI board'
                      : 'Create project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Home settings modal ───────────────────────────────────────────────── */}
      {uniOpen && (
        <div className="uni-settings-overlay" onClick={e => e.target === e.currentTarget && setUniOpen(false)}>
          <div className="uni-settings-modal">
            <div className="uni-settings-modal__header">
              <span>Home settings</span>
              <button onClick={() => setUniOpen(false)}>✕</button>
            </div>

            <div className="uni-settings-modal__body">
              <div>
                <div className="uni-settings-label">Current theme</div>
                <div className="uni-settings-themes">
                  {THEMES.map(entry => (
                    <button
                      key={entry.id}
                      className={`theme-opt ${theme === entry.id ? 'theme-opt--active' : ''}`}
                      onClick={() => { onCycleTheme(entry.id); sounds?.playClick?.() }}
                    >
                      <div className={`theme-opt__preview ${entry.previewCls}`} />
                      <span>{entry.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="uni-settings-label">Default theme for new projects</div>
                <div className="uni-settings-themes">
                  {THEMES.map(entry => (
                    <button
                      key={entry.id}
                      className={`theme-opt ${uniTheme === entry.id ? 'theme-opt--active' : ''}`}
                      onClick={() => setUniTheme(entry.id)}
                    >
                      <div className={`theme-opt__preview ${entry.previewCls}`} />
                      <span>{entry.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="uni-settings-label">Sound</div>
                <label className="uni-sound-row">
                  <input
                    type="checkbox"
                    checked={uniSound}
                    onChange={e => setUniSound(e.target.checked)}
                  />
                  Enable sounds globally
                </label>
              </div>
            </div>

            <div className="uni-settings-modal__footer">
              <button className="btn-secondary" onClick={() => setUniOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveUniSettings}>Save settings</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon">🗑️</div>
            <div className="delete-confirm-modal__title">Delete "{deleteTarget.name}"?</div>
            <div className="delete-confirm-modal__sub">
              This will permanently remove the project and all its tasks.
              Type <strong>confirm</strong> below to proceed.
            </div>
            <input
              className={`delete-confirm-modal__input${deleteConfirmText === 'confirm' ? ' delete-confirm-modal__input--valid' : ''}`}
              placeholder="confirm"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value.toLowerCase())}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && deleteConfirmText === 'confirm') {
                  onDeleteProject(deleteTarget.id); setDeleteTarget(null)
                }
                if (e.key === 'Escape') setDeleteTarget(null)
              }}
            />
            <div className="delete-confirm-modal__actions">
              <button className="delete-confirm-modal__cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className={`delete-confirm-modal__delete${deleteConfirmText === 'confirm' ? ' delete-confirm-modal__delete--ready' : ''}`}
                disabled={deleteConfirmText !== 'confirm'}
                onClick={() => { onDeleteProject(deleteTarget.id); setDeleteTarget(null) }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trash panel ────────────────────────────────────────────────────── */}
      {trashPanelOpen && (
        <TrashPanel
          trashedProjects={trashedProjects}
          onRestore={onRestoreProject}
          onPermanentDelete={onPermanentDelete}
          onEmptyTrash={onEmptyTrash}
          onClose={onTrashPanelClose}
        />
      )}

    </div>
  )
}

function ProjectCard({ project, onOpen, onDeleteRequest, index }) {
  const progress = project.taskCount ? Math.round((project.tasksDone / project.taskCount) * 100) : 0

  return (
    <div
      className="project-card"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={onOpen}
    >
      <div className="project-card__color-bar" style={{ background: project.color }} />
      <div className="project-card__body">
        <div className="project-card__top">
          <span className="project-card__emoji" style={{ background: project.color + '22' }}>
            {project.emoji}
          </span>
          <div className="project-card__info">
            <div className="project-card__name">{project.name}</div>
            {project.summary && <div className="project-card__summary">{project.summary}</div>}
            <div className="project-card__meta">{project.tasksDone}/{project.taskCount} done</div>
          </div>
          <div className="project-card__right">
            <button
              className="project-card__delete"
              onClick={e => { e.stopPropagation(); onDeleteRequest() }}
              title="Delete project"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="project-card__progress">
          <div
            className="project-card__progress-fill"
            style={{ width: `${Math.max(progress, project.taskCount ? 6 : 0)}%`, background: project.color }}
          />
        </div>
      </div>
    </div>
  )
}
