import { useState } from 'react'
import ProfilePanel from './ProfilePanel'

// ── Animal SVGs ───────────────────────────────────────────────────────────────
// All drawn white-on-color, viewBox 0 0 40 40

const SVGS = {
  cat: (
    <svg viewBox="0 0 40 40" fill="none">
      <polygon points="9,19 13,5 19,16"  fill="white" fillOpacity=".9"/>
      <polygon points="31,19 27,5 21,16" fill="white" fillOpacity=".9"/>
      <circle cx="20" cy="24" r="13" fill="white" fillOpacity=".9"/>
      <ellipse cx="15.5" cy="21.5" rx="2" ry="2.5" fill="rgba(0,0,0,.32)"/>
      <ellipse cx="24.5" cy="21.5" rx="2" ry="2.5" fill="rgba(0,0,0,.32)"/>
      <ellipse cx="20" cy="26"   rx="1.5" ry="1"   fill="rgba(0,0,0,.25)"/>
      <line x1="5"  y1="24.5" x2="15" y2="25"  stroke="rgba(0,0,0,.18)" strokeWidth=".9"/>
      <line x1="5"  y1="27"   x2="15" y2="27"  stroke="rgba(0,0,0,.18)" strokeWidth=".9"/>
      <line x1="35" y1="24.5" x2="25" y2="25"  stroke="rgba(0,0,0,.18)" strokeWidth=".9"/>
      <line x1="35" y1="27"   x2="25" y2="27"  stroke="rgba(0,0,0,.18)" strokeWidth=".9"/>
    </svg>
  ),
  dog: (
    <svg viewBox="0 0 40 40" fill="none">
      <ellipse cx="9"  cy="26" rx="5.5" ry="8.5" fill="white" fillOpacity=".82" transform="rotate(-8 9 26)"/>
      <ellipse cx="31" cy="26" rx="5.5" ry="8.5" fill="white" fillOpacity=".82" transform="rotate(8 31 26)"/>
      <circle cx="20" cy="21" r="13" fill="white" fillOpacity=".9"/>
      <circle cx="15" cy="19" r="2.5" fill="rgba(0,0,0,.3)"/>
      <circle cx="25" cy="19" r="2.5" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="20" cy="25.5" rx="4"   ry="2.5" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="18.5" cy="26" rx=".9"  ry=".7"  fill="rgba(0,0,0,.45)"/>
      <ellipse cx="21.5" cy="26" rx=".9"  ry=".7"  fill="rgba(0,0,0,.45)"/>
    </svg>
  ),
  fox: (
    <svg viewBox="0 0 40 40" fill="none">
      <polygon points="8,21 12,4 19,18"  fill="white" fillOpacity=".9"/>
      <polygon points="32,21 28,4 21,18" fill="white" fillOpacity=".9"/>
      <polygon points="9.5,19 12.5,8 17,17"  fill="rgba(0,0,0,.15)"/>
      <polygon points="30.5,19 27.5,8 23,17" fill="rgba(0,0,0,.15)"/>
      <ellipse cx="20" cy="24" rx="12" ry="13" fill="white" fillOpacity=".9"/>
      <ellipse cx="15" cy="21" rx="2.5" ry="2" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="25" cy="21" rx="2.5" ry="2" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="20" cy="26" rx="2"   ry="1.5" fill="rgba(0,0,0,.3)"/>
    </svg>
  ),
  rabbit: (
    <svg viewBox="0 0 40 40" fill="none">
      <ellipse cx="14" cy="12" rx="4.5" ry="10" fill="white" fillOpacity=".9"/>
      <ellipse cx="26" cy="12" rx="4.5" ry="10" fill="white" fillOpacity=".9"/>
      <ellipse cx="14" cy="12" rx="2.5" ry="7"  fill="rgba(0,0,0,.12)"/>
      <ellipse cx="26" cy="12" rx="2.5" ry="7"  fill="rgba(0,0,0,.12)"/>
      <circle cx="20" cy="27" r="12" fill="white" fillOpacity=".9"/>
      <circle cx="15.5" cy="25" r="2" fill="rgba(0,0,0,.3)"/>
      <circle cx="24.5" cy="25" r="2" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="20" cy="29" rx="1.5" ry="1" fill="rgba(220,80,80,.5)"/>
    </svg>
  ),
  bear: (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="10" cy="14" r="6.5" fill="white" fillOpacity=".85"/>
      <circle cx="30" cy="14" r="6.5" fill="white" fillOpacity=".85"/>
      <circle cx="10" cy="14" r="4"   fill="rgba(0,0,0,.12)"/>
      <circle cx="30" cy="14" r="4"   fill="rgba(0,0,0,.12)"/>
      <circle cx="20" cy="24" r="14"  fill="white" fillOpacity=".9"/>
      <ellipse cx="20" cy="27.5" rx="5.5" ry="4" fill="rgba(0,0,0,.06)"/>
      <ellipse cx="20" cy="26"   rx="3"   ry="2" fill="rgba(0,0,0,.3)"/>
      <circle cx="14.5" cy="21" r="2" fill="rgba(0,0,0,.3)"/>
      <circle cx="25.5" cy="21" r="2" fill="rgba(0,0,0,.3)"/>
    </svg>
  ),
  penguin: (
    <svg viewBox="0 0 40 40" fill="none">
      <ellipse cx="20" cy="29" rx="13" ry="11" fill="rgba(0,0,0,.45)"/>
      <ellipse cx="20" cy="27" rx="8"  ry="9"  fill="white" fillOpacity=".9"/>
      <circle  cx="20" cy="16" r="11"  fill="rgba(0,0,0,.45)"/>
      <ellipse cx="20" cy="17" rx="7.5" ry="7" fill="white" fillOpacity=".9"/>
      <circle cx="15.5" cy="15" r="2.5" fill="rgba(0,0,0,.65)"/>
      <circle cx="24.5" cy="15" r="2.5" fill="rgba(0,0,0,.65)"/>
      <circle cx="15.5" cy="14.2" r=".9" fill="white" fillOpacity=".8"/>
      <circle cx="24.5" cy="14.2" r=".9" fill="white" fillOpacity=".8"/>
      <polygon points="20,19 17.5,22.5 22.5,22.5" fill="rgba(255,160,30,.85)"/>
    </svg>
  ),
  panda: (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="9.5"  cy="14" r="7" fill="rgba(0,0,0,.5)"/>
      <circle cx="30.5" cy="14" r="7" fill="rgba(0,0,0,.5)"/>
      <circle cx="20"   cy="24" r="14" fill="white" fillOpacity=".92"/>
      <ellipse cx="14" cy="22" rx="4.5" ry="4"  fill="rgba(0,0,0,.35)"/>
      <ellipse cx="26" cy="22" rx="4.5" ry="4"  fill="rgba(0,0,0,.35)"/>
      <circle cx="14"   cy="22"   r="2.2" fill="rgba(0,0,0,.7)"/>
      <circle cx="26"   cy="22"   r="2.2" fill="rgba(0,0,0,.7)"/>
      <circle cx="13.5" cy="21.5" r=".8"  fill="white" fillOpacity=".9"/>
      <circle cx="25.5" cy="21.5" r=".8"  fill="white" fillOpacity=".9"/>
      <ellipse cx="20" cy="28" rx="2" ry="1.5" fill="rgba(0,0,0,.25)"/>
    </svg>
  ),
  bird: (
    <svg viewBox="0 0 40 40" fill="none">
      <circle  cx="20" cy="22" r="13" fill="white" fillOpacity=".9"/>
      <ellipse cx="8"  cy="27" rx="5" ry="7" fill="white" fillOpacity=".75" transform="rotate(20 8 27)"/>
      <ellipse cx="32" cy="27" rx="5" ry="7" fill="white" fillOpacity=".75" transform="rotate(-20 32 27)"/>
      <ellipse cx="20" cy="9"  rx="4" ry="3" fill="white" fillOpacity=".85"/>
      <circle cx="15" cy="20" r="2.5" fill="rgba(0,0,0,.28)"/>
      <circle cx="25" cy="20" r="2.5" fill="rgba(0,0,0,.28)"/>
      <circle cx="15" cy="19.2" r="1"  fill="white" fillOpacity=".8"/>
      <circle cx="25" cy="19.2" r="1"  fill="white" fillOpacity=".8"/>
      <polygon points="17.5,24 22.5,24 20,27.5" fill="rgba(255,160,30,.8)"/>
    </svg>
  ),
}

export function AnimalSVG({ animal, size = 40 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      {SVGS[animal] || SVGS.cat}
    </div>
  )
}

// ── UserAvatar ────────────────────────────────────────────────────────────────

export default function UserAvatar({ user, profile, onProfileUpdate, onSignOut, onAuthClick, globalTheme, onThemeChange, soundEnabled, onSoundToggle, size = 36 }) {
  const [panelOpen, setPanelOpen] = useState(false)

  const color  = profile?.avatar_color  || '#6c63ff'
  const animal = profile?.avatar_animal || 'cat'
  const initials = user?.email?.[0]?.toUpperCase() || '?'

  if (!user) {
    return (
      <button
        onClick={onAuthClick}
        title="Sign in to sync your boards"
        style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
          padding: '5px 11px', border: '1px solid var(--accent-glow)',
          borderRadius: 'var(--radius-sm)', background: 'var(--accent-dim)',
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ☁ Sign in
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        title="Your profile"
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: color,
          border: '2px solid rgba(255,255,255,0.25)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          padding: 0,
          boxShadow: `0 0 0 2px ${color}44`,
          transition: 'box-shadow 0.15s, transform 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="avatar"
            style={{ width: size, height: size, objectFit: 'cover', display: 'block' }} />
        ) : profile ? (
          <AnimalSVG animal={animal} size={size} />
        ) : (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: size * 0.42 }}>{initials}</span>
        )}
      </button>

      {panelOpen && (
        <ProfilePanel
          user={user}
          profile={profile}
          onProfileUpdate={updates => { onProfileUpdate(updates); }}
          onSignOut={onSignOut}
          onClose={() => setPanelOpen(false)}
          globalTheme={globalTheme}
          onThemeChange={onThemeChange}
          soundEnabled={soundEnabled}
          onSoundToggle={onSoundToggle}
        />
      )}
    </>
  )
}
