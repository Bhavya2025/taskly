import { useEffect, useRef } from 'react'

const SHORTCUTS = [
  { key: 'N',     desc: 'New task'            },
  { key: '/',     desc: 'Focus search'        },
  { key: 'Cmd/Ctrl+Z', desc: 'Undo change'    },
  { key: 'Shift+Cmd/Ctrl+Z', desc: 'Redo change' },
  { key: 'J / K', desc: 'Navigate tasks'      },
  { key: 'C',     desc: 'Mark complete'       },
  { key: 'E',     desc: 'Edit selected task'  },
  { key: 'Del',   desc: 'Delete selected'     },
  { key: 'A',     desc: 'Toggle assistant'    },
  { key: 'V',     desc: 'Toggle board / list' },
  { key: '?',     desc: 'Open settings'       },
  { key: 'Esc',   desc: 'Close / cancel'      },
]

const THEMES = [
  { id: 'dark',  label: 'Dark',  previewCls: 'theme-opt__preview--dark'  },
  { id: 'light', label: 'Light', previewCls: 'theme-opt__preview--light' },
]

const THEME_SOUND_DESC = {
  dark:  'Warm · resonant · deep tones',
  light: 'Bright · crisp · airy notes',
}

export default function SettingsPanel({
  theme, projectTheme,
  onThemeChange, onProjectThemeChange,
  soundEnabled, onSoundToggle,
  onClose,
}) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 120)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick) }
  }, [onClose])

  const hasOverride = !!projectTheme

  return (
    <div className="settings-panel" ref={ref}>
      <div className="settings-panel__header">
        <span>Settings</span>
        <button className="settings-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Global theme */}
      <div className="settings-panel__section">
        <div className="settings-panel__label">Global theme</div>
        <div className="settings-panel__themes settings-panel__themes--two">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-opt ${theme === t.id && !hasOverride ? 'theme-opt--active' : ''}`}
              onClick={() => { onThemeChange(t.id); onProjectThemeChange(null) }}
            >
              <div className={`theme-opt__preview ${t.previewCls}`} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.4 }}>
          🔊 {THEME_SOUND_DESC[theme] || ''}
        </div>
      </div>

      <div className="settings-panel__divider" />

      {/* Per-project theme override */}
      <div className="settings-panel__section">
        <div className="settings-panel__label">Project theme override</div>
        <div className="settings-panel__themes settings-panel__themes--two">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-opt ${projectTheme === t.id ? 'theme-opt--active' : ''}`}
              onClick={() => onProjectThemeChange(projectTheme === t.id ? null : t.id)}
            >
              <div className={`theme-opt__preview ${t.previewCls}`} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="settings-override-row">
          <input
            type="checkbox"
            checked={hasOverride}
            onChange={e => onProjectThemeChange(e.target.checked ? (projectTheme || theme) : null)}
          />
          <span>Override global theme for this project</span>
        </div>
        {hasOverride && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5 }}>
            ✓ This project uses: <strong>{projectTheme}</strong>
          </div>
        )}
      </div>

      <div className="settings-panel__divider" />

      {/* Sound */}
      <div className="settings-panel__section">
        <div className="settings-panel__label">Sound effects</div>
        <button
          className={`sound-toggle ${soundEnabled ? 'sound-toggle--on' : ''}`}
          onClick={onSoundToggle}
        >
          <span className="sound-toggle__icon">♪</span>
          <span>{soundEnabled ? 'On' : 'Off'}</span>
          <div className={`sound-toggle__pill ${soundEnabled ? 'sound-toggle__pill--on' : ''}`}>
            <div className="sound-toggle__knob" />
          </div>
        </button>
      </div>

      <div className="settings-panel__divider" />

      {/* Shortcuts */}
      <div className="settings-panel__section">
        <div className="settings-panel__label">Keyboard shortcuts</div>
        <div className="shortcuts-list">
          {SHORTCUTS.map(s => (
            <div className="shortcut-row" key={s.key}>
              <span className="shortcut-desc">{s.desc}</span>
              <div className="shortcut-keys">
                {s.key.split('/').map(k => <kbd key={k}>{k.trim()}</kbd>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-panel__footer">
        Project overrides apply to this board only · Global settings via ⚙ on Home
      </div>
    </div>
  )
}
