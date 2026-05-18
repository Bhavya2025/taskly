import { useState, useEffect } from 'react'

const FEATURES = [
  { icon: '🗂️', text: 'Flexible task boards' },
  { icon: '⚡', text: 'Dynamic AI assistant' },
  { icon: '↺', text: 'Undo and redo' },
  { icon: '⌨', text: 'Keyboard-first' },
]

function playIntroCue(enabled = true) {
  if (!enabled) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [
      { freq: 294, at: 0.00, dur: 0.18, gain: 0.05, type: 'triangle' },
      { freq: 392, at: 0.09, dur: 0.22, gain: 0.05, type: 'sine' },
      { freq: 523, at: 0.18, dur: 0.28, gain: 0.06, type: 'sine' },
      { freq: 659, at: 0.28, dur: 0.38, gain: 0.045, type: 'triangle' },
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + note.at
      osc.type = note.type
      osc.frequency.setValueAtTime(note.freq, start)
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur)
      osc.start(start)
      osc.stop(start + note.dur + 0.04)
    }
  } catch (_) {
    // Audio not available.
  }
}

export default function IntroAnimation({ onComplete, soundEnabled = true }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    playIntroCue(soundEnabled)

    // Progress bar — fills over 5 seconds
    const start  = Date.now()
    const total  = 5000
    let raf

    function tick() {
      const elapsed = Date.now() - start
      const pct     = Math.min((elapsed / total) * 100, 100)
      setProgress(pct)
      if (pct < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        onComplete()
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onComplete, soundEnabled])

  return (
    <div className="intro-overlay" onClick={onComplete}>
      {/* Animated grid background */}
      <div className="intro-orb intro-orb--1" />
      <div className="intro-orb intro-orb--2" />

      <div className="intro-content">
        {/* Logo */}
        <div className="intro-logo-wrap">
          <div className="intro-logo-icon">
            <svg width="48" height="48" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
              <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
              <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.9"/>
            </svg>
          </div>
        </div>

        {/* Kinetic title — each letter pops in */}
        <div className="intro-title">
          {'TASKLY'.split('').map((char, i) => (
            <span
              key={i}
              className="intro-title__char"
              style={{ '--delay': `${i * 0.07}s` }}
            >
              {char}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <div className="intro-tagline">
          Organize projects without the setup drag
        </div>

        {/* Feature pills */}
        <div className="intro-features">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="intro-feature"
              style={{ '--delay': `${i * 0.12}s` }}
            >
              <span className="intro-feature__icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA + progress */}
        <div className="intro-cta">
          <div className="intro-skip">Click anywhere to begin</div>
          <div className="intro-progress">
            <div
              className="intro-progress__bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
