import { useState, useEffect, useRef } from 'react'

// ── Tutorial sound engine ─────────────────────────────────────────────────────
function playStepSound(stepIdx, totalSteps, enabled = true) {
  if (!enabled) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const isLast = stepIdx >= totalSteps - 1

    if (isLast) {
      // Winning chord: C-E-G-C arpeggio
      const freqs = [523.25, 659.25, 783.99, 1046.50]
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = ctx.currentTime + i * 0.07
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.14, t + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
        osc.start(t); osc.stop(t + 0.7)
      })
    } else {
      // Ascending note: maps step index to frequency range 300–800 Hz
      const minF = 300, maxF = 800
      const freq = minF + ((stepIdx) / Math.max(totalSteps - 2, 1)) * (maxF - minF)
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc.start(); osc.stop(ctx.currentTime + 0.25)
    }
  } catch (_) { /* audio not available */ }
}

// ── Tutorial component ────────────────────────────────────────────────────────
// steps: Array<{ target?: string, title: string, desc: string, pos?: 'top'|'bottom'|'left'|'right'|'center' }>
export default function Tutorial({ steps, onComplete, storageKey, soundEnabled = true }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(null)

  const current = steps[step]

  // Lock page scroll for the entire tutorial lifetime
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Measure target element and update on resize
  useEffect(() => {
    function measure() {
      if (current?.target) {
        const el = document.querySelector(current.target)
        if (el) {
          const r = el.getBoundingClientRect()
          setRect(r)
        } else {
          setRect(null)
        }
      } else {
        setRect(null)
      }
    }

    measure()
    rafRef.current = requestAnimationFrame(() => setVisible(true))

    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [step, current])

  function advance() {
    playStepSound(step, steps.length, soundEnabled)
    if (step < steps.length - 1) {
      setVisible(false)
      setTimeout(() => { setStep(s => s + 1); setVisible(true) }, 180)
    } else {
      finish()
    }
  }

  function finish() {
    if (storageKey) localStorage.setItem(storageKey, '1')
    onComplete?.()
  }

  function skip() {
    playStepSound(steps.length - 1, steps.length, soundEnabled)
    finish()
  }

  // Compute tooltip card position — always clamped inside viewport
  function cardStyle() {
    if (!rect || current?.pos === 'center') {
      return {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }
    const pad      = 14
    const CARD_H   = 240   // conservative max card height
    const CARD_W   = 320
    const pos      = current?.pos || 'bottom'
    const centreX  = Math.max(16, Math.min(rect.left + rect.width / 2 - CARD_W / 2, window.innerWidth - CARD_W - 16))

    const spaceBelow = window.innerHeight - rect.bottom - pad
    const spaceAbove = rect.top - pad

    if (pos === 'bottom' || (pos !== 'top' && pos !== 'left' && pos !== 'right')) {
      // Flip above if not enough room below
      if (spaceBelow < CARD_H && spaceAbove >= CARD_H) {
        return { position: 'fixed', bottom: window.innerHeight - rect.top + pad, left: centreX }
      }
      // Clamp so card never goes below viewport
      const top = Math.min(rect.bottom + pad, window.innerHeight - CARD_H - 8)
      return { position: 'fixed', top: Math.max(8, top), left: centreX }
    }
    if (pos === 'top') {
      const top = Math.max(8, rect.top - CARD_H - pad)
      return { position: 'fixed', top, left: centreX }
    }
    if (pos === 'right') return {
      position: 'fixed',
      top:  Math.max(8, Math.min(rect.top + rect.height / 2 - 70, window.innerHeight - CARD_H - 8)),
      left: Math.min(rect.right + pad, window.innerWidth - CARD_W - 8),
    }
    if (pos === 'left') return {
      position: 'fixed',
      top:   Math.max(8, Math.min(rect.top + rect.height / 2 - 70, window.innerHeight - CARD_H - 8)),
      right: Math.min(window.innerWidth - rect.left + pad, window.innerWidth - CARD_W - 8),
    }
    return { position: 'fixed', top: Math.max(8, rect.bottom + pad), left: centreX }
  }

  function arrowStyle() {
    if (!rect || current?.pos === 'center') return null
    const pos = current?.pos || 'bottom'
    if (pos === 'bottom') return { style: 'arrow-up'   }
    if (pos === 'top')    return { style: 'arrow-down' }
    if (pos === 'right')  return { style: 'arrow-left' }
    if (pos === 'left')   return { style: 'arrow-right'}
    return { style: 'arrow-up' }
  }

  const arrowDir = arrowStyle()
  const spotlightPad = 12
  const spotlightRect = rect ? {
    left: rect.left - spotlightPad,
    top: rect.top - spotlightPad,
    width: rect.width + spotlightPad * 2,
    height: rect.height + spotlightPad * 2,
  } : null

  const dimPanes = spotlightRect ? [
    {
      className: 'tutorial-dim-pane tutorial-dim-pane--top',
      style: { left: 0, top: 0, width: '100vw', height: Math.max(spotlightRect.top, 0) },
    },
    {
      className: 'tutorial-dim-pane tutorial-dim-pane--left',
      style: { left: 0, top: Math.max(spotlightRect.top, 0), width: Math.max(spotlightRect.left, 0), height: spotlightRect.height },
    },
    {
      className: 'tutorial-dim-pane tutorial-dim-pane--right',
      style: {
        left: spotlightRect.left + spotlightRect.width,
        top: Math.max(spotlightRect.top, 0),
        width: Math.max(window.innerWidth - (spotlightRect.left + spotlightRect.width), 0),
        height: spotlightRect.height,
      },
    },
    {
      className: 'tutorial-dim-pane tutorial-dim-pane--bottom',
      style: {
        left: 0,
        top: spotlightRect.top + spotlightRect.height,
        width: '100vw',
        height: Math.max(window.innerHeight - (spotlightRect.top + spotlightRect.height), 0),
      },
    },
  ] : []

  return (
    <div className={`tutorial-overlay ${visible ? 'tutorial-overlay--visible' : ''}`}>
      {/* Dim only the surrounding area, not the target itself */}
      {spotlightRect
        ? dimPanes.map((pane, index) => (
            <div key={index} className={pane.className} style={pane.style} />
          ))
        : <div className="tutorial-dim" />}

      {/* Spotlight cutout around target */}
      {spotlightRect && (
        <div
          className="tutorial-spotlight"
          style={{
            left: spotlightRect.left,
            top: spotlightRect.top,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div className="tutorial-card" style={cardStyle()}>
        {arrowDir && <div className={`tutorial-arrow tutorial-arrow--${arrowDir.style}`} />}

        <div className="tutorial-card__progress">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`tutorial-card__dot ${i === step ? 'tutorial-card__dot--active' : i < step ? 'tutorial-card__dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial-card__title">{current.title}</div>
        <div className="tutorial-card__desc">{current.desc}</div>

        <div className="tutorial-card__actions">
          <button className="tutorial-skip" onClick={skip}>Skip all</button>
          <button className="tutorial-ok" onClick={advance}>
            {step === steps.length - 1 ? 'Ready' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
