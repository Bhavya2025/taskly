import { useState } from 'react'
import { generateId } from '../utils/data'
import { AnimalSVG } from '../components/UserAvatar'
import { buildProjectSeed } from '../utils/aiAgent'

const COLORS = ['#7c6ff7', '#3b9eff', '#ff6b6b', '#ffd93d', '#6bcb77', '#ff9f43', '#a29bfe', '#fd79a8']

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

// ── Avatar button using the proper animal SVG ───────────────────────────────
function MobAvatar({ profile, user, size = 38, onClick, className = '' }) {
  const animal = profile?.avatar_animal || 'cat'
  const color  = profile?.avatar_color  || '#7c6ff7'
  return (
    <button
      className={`mob-avatar-btn ${className}`}
      style={user ? { background: color } : {}}
      onClick={onClick}
      aria-label="Profile"
    >
      {user
        ? <AnimalSVG animal={animal} size={size * 0.7} />
        : <span style={{ fontSize: 18 }}>👤</span>
      }
    </button>
  )
}

export default function MobileHome({
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  user,
  profile,
  sounds,
  theme,
  onCycleTheme,
  soundEnabled,
  onSoundToggle,
  onAuthClick,
  onSignOut,
  trashedProjects,
}) {
  const [creating, setCreating]         = useState(false)
  const [name, setName]                 = useState('')
  const [color, setColor]               = useState(COLORS[0])
  const [customEmoji, setCustomEmoji]   = useState(null)
  const [profileOpen, setProfileOpen]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')

  // AI task generation inside create flow
  const [aiStep,       setAiStep]       = useState(false)   // show AI panel inside sheet
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiResult,     setAiResult]     = useState(null)
  const [aiSelected,   setAiSelected]   = useState(new Set())
  const [aiError,      setAiError]      = useState('')

  async function handleGenerateAI() {
    if (!name.trim()) return
    setAiLoading(true)
    setAiResult(null)
    setAiError('')
    setAiSelected(new Set())
    try {
      sounds?.playAIGenerate?.()
      // buildProjectSeed uses the 4096-token project-seed prompt which returns
      // fully built columns + tasks (8-14) with proper columnId mapping
      const seed = await buildProjectSeed(name.trim(), name.trim())
      setAiResult(seed)
      setAiSelected(new Set((seed.data?.tasks || []).map(t => t.id)))
    } catch (err) {
      setAiError(err.message || 'Could not generate tasks right now.')
    } finally {
      setAiLoading(false)
    }
  }

  function toggleAiTask(id) {
    setAiSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim()) return
    const emoji = customEmoji || autoEmoji(name.trim())
    const project = {
      id: generateId(),
      name: name.trim(),
      emoji,
      color,
      image_url: null,
      taskCount: 0,
      tasksDone: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Build starter board data from the seed (columns + tasks already fully mapped)
    let boardData = null
    if (aiResult && aiSelected.size > 0) {
      const seedColumns = aiResult.data?.columns || []
      const seedTasks   = (aiResult.data?.tasks || []).filter(t => aiSelected.has(t.id))
      // Remove columns that have no selected tasks (keep board tidy)
      const usedColIds  = new Set(seedTasks.map(t => t.columnId))
      const keptColumns = seedColumns.filter(c => usedColIds.has(c.id))
      // Fallback: keep all columns if filter is too aggressive
      boardData = {
        columns: keptColumns.length > 0 ? keptColumns : seedColumns,
        tasks:   seedTasks,
      }
    }

    await onCreateProject({ project, boardData })
    sounds?.playCreateProject?.()
    setCreating(false)
    setName('')
    setCustomEmoji(null)
    setColor(COLORS[0])
    setAiStep(false)
    setAiResult(null)
    setAiSelected(new Set())
    onOpenProject(project.id)
  }

  function closeCreate() {
    setCreating(false)
    setAiStep(false)
    setAiResult(null)
    setAiSelected(new Set())
    setName('')
    setColor(COLORS[0])
    setCustomEmoji(null)
  }

  const sortedProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'there'
  const avatarColor = profile?.avatar_color || '#7c6ff7'

  return (
    <div className="mob-home">
      {/* ── Header ── */}
      <header className="mob-home__header">
        <div className="mob-home__brand">
          <span className="mob-home__logo-mark">✦</span>
          <span className="mob-home__app-name">Taskly</span>
        </div>
        <MobAvatar
          profile={profile}
          user={user}
          size={38}
          onClick={() => setProfileOpen(true)}
        />
      </header>

      {/* ── Greeting ── */}
      <div className="mob-home__hero">
        <p className="mob-home__greeting">Hey, {displayName} 👋</p>
        <p className="mob-home__sub">
          {projects.length === 0
            ? 'Create your first project below.'
            : `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${
                projects.reduce((s, p) => s + (p.tasksDone || 0), 0)
              } tasks done`
          }
        </p>
        {projects.length > 2 && (
          <div className="mob-home__search-wrap">
            <span className="mob-home__search-icon">🔍</span>
            <input
              className="mob-home__search"
              placeholder="Search projects…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="mob-home__search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* ── Project list ── */}
      <div className="mob-home__scroll">
        {sortedProjects.length === 0 && !searchQuery ? (
          <div className="mob-home__empty">
            <div className="mob-home__empty-icon">📋</div>
            <p className="mob-home__empty-title">No projects yet</p>
            <p className="mob-home__empty-sub">Tap the <strong>+</strong> button to get started</p>
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="mob-home__empty">
            <div className="mob-home__empty-icon">🔍</div>
            <p className="mob-home__empty-title">No results</p>
            <p className="mob-home__empty-sub">Try a different search</p>
          </div>
        ) : (
          <div className="mob-home__list">
            {sortedProjects.map(project => {
              const done  = project.tasksDone || 0
              const total = project.taskCount || 0
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <div key={project.id} className="mob-proj-card" style={{ '--proj-color': project.color || '#7c6ff7' }}>
                  <button
                    className="mob-proj-card__main"
                    onClick={() => { sounds?.playOpenProject?.(); onOpenProject(project.id) }}
                  >
                    <div className="mob-proj-card__icon">
                      {project.image_url
                        ? <img src={project.image_url} alt="" className="mob-proj-card__img" />
                        : <span>{project.emoji || '📋'}</span>
                      }
                    </div>
                    <div className="mob-proj-card__info">
                      <span className="mob-proj-card__name">{project.name}</span>
                      <div className="mob-proj-card__stats">
                        <span className="mob-proj-card__stat">{total} task{total !== 1 ? 's' : ''}</span>
                        {total > 0 && (
                          <span className="mob-proj-card__stat mob-proj-card__stat--done">{pct}% done</span>
                        )}
                      </div>
                      {total > 0 && (
                        <div className="mob-proj-card__bar-track">
                          <div className="mob-proj-card__bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <span className="mob-proj-card__chevron">›</span>
                  </button>
                  <button
                    className="mob-proj-card__more"
                    onClick={() => setDeleteTarget(project)}
                    aria-label="Project options"
                  >
                    ···
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <button
        className="mob-fab"
        onClick={() => { sounds?.playClick?.(); setCreating(true) }}
        aria-label="New project"
      >
        <span className="mob-fab__icon">+</span>
      </button>

      {/* ── Profile sheet ── */}
      {profileOpen && (
        <div className="mob-overlay" onClick={() => setProfileOpen(false)}>
          <div className="mob-sheet" onClick={e => e.stopPropagation()}>
            <div className="mob-sheet__drag-handle" />
            <div className="mob-sheet__profile-head">
              <div className="mob-sheet__profile-avatar" style={user ? { background: avatarColor } : {}}>
                {user
                  ? <AnimalSVG animal={profile?.avatar_animal || 'cat'} size={30} />
                  : <span style={{ fontSize: 22 }}>👤</span>
                }
              </div>
              <div>
                <div className="mob-sheet__profile-name">{displayName}</div>
                {user && <div className="mob-sheet__profile-email">{user.email}</div>}
              </div>
            </div>
            <div className="mob-sheet__menu-list">
              <button className="mob-sheet__menu-item" onClick={() => { setProfileOpen(false); onCycleTheme() }}>
                <span className="mob-sheet__menu-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
              </button>
              <button className="mob-sheet__menu-item" onClick={onSoundToggle}>
                <span className="mob-sheet__menu-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                <span>{soundEnabled ? 'Sound on' : 'Sound off'}</span>
              </button>
            </div>
            <div className="mob-sheet__divider" />
            {user ? (
              <button
                className="mob-sheet__danger-btn"
                onClick={() => { setProfileOpen(false); onSignOut() }}
              >
                Sign out
              </button>
            ) : (
              <button
                className="mob-sheet__primary-btn"
                onClick={() => { setProfileOpen(false); onAuthClick() }}
              >
                Sign in / Sign up
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create project sheet ── */}
      {creating && (
        <div className="mob-overlay" onClick={closeCreate}>
          <div className="mob-sheet" onClick={e => e.stopPropagation()}>
            <div className="mob-sheet__drag-handle" />
            <div className="mob-sheet__header">
              <h2 className="mob-sheet__title">New project</h2>
              <button className="mob-sheet__x" onClick={closeCreate}>✕</button>
            </div>

            {/* ── Step 1: Project details ── */}
            <div className="mob-form__group">
              <label className="mob-form__label">Name</label>
              <input
                className="mob-form__input"
                placeholder="e.g. Study Plan, Work Tasks…"
                value={name}
                onChange={e => { setName(e.target.value); setAiResult(null); setAiStep(false) }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && !aiStep && handleCreate()}
              />
            </div>

            <div className="mob-form__group">
              <label className="mob-form__label">Colour</label>
              <div className="mob-form__color-row">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`mob-form__color-dot${color === c ? ' mob-form__color-dot--on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="mob-form__group">
              <label className="mob-form__label">
                Custom emoji <span className="mob-form__label-hint">(optional)</span>
              </label>
              <input
                className="mob-form__input mob-form__input--sm"
                placeholder="🎯"
                value={customEmoji || ''}
                onChange={e => setCustomEmoji(e.target.value || null)}
                maxLength={2}
                style={{ textAlign: 'center', fontSize: '20px', padding: '10px' }}
              />
            </div>

            {/* ── AI starter tasks ── */}
            {!aiStep ? (
              <button
                className="mob-ai-suggest-btn"
                onClick={() => { setAiStep(true); if (name.trim()) handleGenerateAI() }}
                disabled={!name.trim()}
              >
                <span className="mob-ai-suggest-btn__spark">✦</span>
                Generate starter tasks with AI
              </button>
            ) : (
              <div className="mob-ai-inline">
                <div className="mob-ai-inline__header">
                  <span className="mob-ai-inline__title">✦ AI Starter Tasks</span>
                  <button
                    className="mob-ai-inline__refresh"
                    onClick={handleGenerateAI}
                    disabled={aiLoading}
                    title="Regenerate"
                  >
                    ↺
                  </button>
                </div>

                {aiLoading && (
                  <div className="mob-ai-inline__loading">
                    <span className="mob-ai-inline__dot" />
                    <span className="mob-ai-inline__dot" style={{ animationDelay: '0.2s' }} />
                    <span className="mob-ai-inline__dot" style={{ animationDelay: '0.4s' }} />
                    <span>Generating…</span>
                  </div>
                )}

                {aiError && (
                  <p className="mob-ai-sheet__error">{aiError}</p>
                )}

                {aiResult && !aiLoading && (() => {
                  const seedTasks = aiResult.data?.tasks || []
                  const colById   = Object.fromEntries(
                    (aiResult.data?.columns || []).map(c => [c.id, c.title])
                  )
                  return (
                    <>
                      <p className="mob-ai-inline__sub">
                        {aiSelected.size} of {seedTasks.length} tasks selected
                      </p>
                      <div className="mob-ai-inline__list">
                        {seedTasks.map(task => (
                          <button
                            key={task.id}
                            className={`mob-ai-task${aiSelected.has(task.id) ? ' mob-ai-task--on' : ''}`}
                            onClick={() => toggleAiTask(task.id)}
                          >
                            <span className={`mob-ai-task__check${aiSelected.has(task.id) ? ' mob-ai-task__check--on' : ''}`}>
                              {aiSelected.has(task.id) ? '✓' : ''}
                            </span>
                            <span className="mob-ai-task__title">{task.title}</span>
                            {colById[task.columnId] && (
                              <span className="mob-ai-task__col">{colById[task.columnId]}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            <div className="mob-sheet__actions">
              <button className="mob-sheet__cancel-btn" onClick={closeCreate}>Cancel</button>
              <button
                className="mob-sheet__primary-btn"
                onClick={handleCreate}
                disabled={!name.trim() || aiLoading}
              >
                {aiResult?.data?.tasks && aiSelected.size > 0
                  ? `Create with ${aiSelected.size} task${aiSelected.size !== 1 ? 's' : ''}`
                  : 'Create project'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Project options sheet ── */}
      {deleteTarget && (
        <div className="mob-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="mob-sheet mob-sheet--sm" onClick={e => e.stopPropagation()}>
            <div className="mob-sheet__drag-handle" />
            <div className="mob-sheet__confirm-icon">🗑️</div>
            <p className="mob-sheet__confirm-title">Move to trash?</p>
            <p className="mob-sheet__confirm-sub">
              <strong>{deleteTarget.name}</strong> will be moved to trash and can be restored later.
            </p>
            <div className="mob-sheet__actions">
              <button className="mob-sheet__cancel-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="mob-sheet__danger-btn"
                onClick={() => { onDeleteProject(deleteTarget.id); setDeleteTarget(null) }}
              >
                Move to trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
