import { useState, useRef } from 'react'
import UserAvatar from './UserAvatar'

export default function Topbar({
  projectName, projectEmoji, projectColor, projectImageUrl, onBack,
  searchQuery, onSearch, searchRef,
  filterPriority, onFilterPriority,
  view, onViewChange,
  canUndo, canRedo, onUndo, onRedo,
  settingsOpen, onSettingsToggle,
  onProjectSettingsOpen,
  onProjectRename,
  tasks, onNewTask,
  aiOpen, onAiToggle,
  user, profile, onProfileUpdate, onSignOut, onAuthClick,
  globalTheme, onThemeChange, soundEnabled, onSoundToggle,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const nameInputRef = useRef(null)

  const dueToday = tasks.filter(t => {
    if (!t.dueDate || t.done) return false
    const d = new Date(t.dueDate + 'T00:00:00')
    return d.toDateString() === new Date().toDateString()
  }).length

  function startEditName() {
    setNameInput(projectName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 40)
  }

  function commitName() {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== projectName) {
      onProjectRename?.(trimmed)
    }
    setEditingName(false)
  }

  return (
    <header className="topbar">
      {/* Back + project identity */}
      <div className="topbar__left">
        <button className="topbar__back" onClick={onBack} title="Back to projects">←</button>
        <div className="topbar__project">

          {/* Clickable icon → project settings */}
          <button
            className="topbar__project-emoji topbar__project-emoji--btn"
            style={{ background: projectColor + '22', borderColor: projectColor + '44' }}
            onClick={onProjectSettingsOpen}
            title="Project settings"
          >
            {projectImageUrl
              ? <img src={projectImageUrl} alt="" className="topbar__project-img" />
              : projectEmoji}
          </button>

          {/* Inline-editable project name */}
          {editingName ? (
            <input
              ref={nameInputRef}
              className="topbar__project-name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitName(); nameInputRef.current?.blur() }
                if (e.key === 'Escape') { setEditingName(false) }
              }}
              maxLength={60}
            />
          ) : (
            <span
              className="topbar__project-name topbar__project-name--editable"
              onClick={startEditName}
              title="Click to rename"
            >
              {projectName}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="topbar__search">
        <span className="topbar__search-icon">⌕</span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search tasks…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        {!searchQuery && <span className="topbar__search-kbd">/</span>}
        {searchQuery && (
          <button className="topbar__search-clear" onClick={() => onSearch('')}>✕</button>
        )}
      </div>

      {/* Right controls */}
      <div className="topbar__right">
        <div className="view-switcher">
          <button className={view === 'board' ? 'active' : ''} onClick={() => onViewChange('board')}>Board</button>
          <button className={view === 'list'  ? 'active' : ''} onClick={() => onViewChange('list')}>List</button>
        </div>

        {/* Undo / Redo */}
        <div className="history-controls">
          <button
            className={`history-btn ${canUndo ? 'history-btn--live' : ''}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Cmd/Ctrl+Z)"
          >
            <span className="history-btn__arrow">↶</span>
            <span className="history-btn__word">Undo</span>
          </button>
          <button
            className={`history-btn ${canRedo ? 'history-btn--live' : ''}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Shift+Cmd/Ctrl+Z)"
          >
            <span className="history-btn__word">Redo</span>
            <span className="history-btn__arrow">↷</span>
          </button>
        </div>

        <select
          className="priority-filter"
          value={filterPriority}
          onChange={e => onFilterPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>

        {dueToday > 0 && (
          <div className="due-pill">
            <span className="due-pill__dot" />
            {dueToday} due today
          </div>
        )}

        <button
          className={`ai-btn ${aiOpen ? 'ai-btn--active' : ''}`}
          onClick={onAiToggle}
          title="Board assistant (A)"
        >
          <span className="ai-btn__pulse" />
          <span className="ai-btn__icon">✦</span>
          <span className="ai-btn__label">
            <strong>Assistant</strong>
            <small>Generate or edit</small>
          </span>
        </button>

        {/* ⚙ → Project settings (same as icon click) */}
        <button
          className={`settings-btn ${settingsOpen ? 'settings-btn--active' : ''}`}
          onClick={onProjectSettingsOpen}
          title="Project settings"
        >⚙</button>

        <button className="new-task-btn" onClick={onNewTask}>+ New task</button>

        <UserAvatar
          user={user}
          profile={profile}
          onProfileUpdate={onProfileUpdate}
          onSignOut={onSignOut}
          onAuthClick={onAuthClick}
          globalTheme={globalTheme}
          onThemeChange={onThemeChange}
          soundEnabled={soundEnabled}
          onSoundToggle={onSoundToggle}
        />
      </div>
    </header>
  )
}
