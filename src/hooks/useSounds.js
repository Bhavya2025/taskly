import { useRef, useCallback } from 'react'

// ── Per-theme sound profiles ───────────────────────────────────────────────────
const THEME_PROFILES = {
  dark:   { fMult: 1.00, durMult: 1.10, volMult: 1.05, type: 'sine',     clickFreq: 560, clickDur: 0.07, clickVol: 0.065 },
  light:  { fMult: 1.50, durMult: 0.72, volMult: 0.90, type: 'sine',     clickFreq: 860, clickDur: 0.038, clickVol: 0.062 },
  system: { fMult: 1.00, durMult: 1.00, volMult: 1.00, type: 'sine',     clickFreq: 580, clickDur: 0.055, clickVol: 0.055 },
}

export function useSounds(enabled, theme = 'dark') {
  const ctxRef = useRef(null)

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  // Core note builder
  function n(freq, dur, vol, freqEnd = null, delay = 0, typeOverride = null) {
    if (!enabled) return
    const profile = THEME_PROFILES[theme] || THEME_PROFILES.dark
    try {
      const ctx  = getCtx()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      const waveType = typeOverride || profile.type
      osc.type = ['square','triangle','sawtooth','sine'].includes(waveType) ? waveType : 'sine'

      const f  = freq  * profile.fMult
      const d  = dur   * profile.durMult
      const v  = vol   * profile.volMult
      const fe = freqEnd ? freqEnd * profile.fMult : null
      const t  = ctx.currentTime + delay

      osc.frequency.setValueAtTime(Math.max(20, f), t)
      if (fe) osc.frequency.exponentialRampToValueAtTime(Math.max(20, fe), t + d)

      gain.gain.setValueAtTime(v, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + d)
      osc.start(t)
      osc.stop(t + d + 0.025)
    } catch (e) {}
  }

  // ── Click ─────────────────────────────────────────────────────────────────────
  const playClick = useCallback(() => {
    if (!enabled) return
    const p = THEME_PROFILES[theme] || THEME_PROFILES.dark
    if (theme === 'light') {
      // Bright, airy double-tap — two harmonics
      n(p.clickFreq, p.clickDur, p.clickVol)
      n(p.clickFreq * 1.5, p.clickDur * 0.55, p.clickVol * 0.28, null, 0.016)
      n(p.clickFreq * 2.0, p.clickDur * 0.35, p.clickVol * 0.12, null, 0.028)
    } else {
      // Dark: warm thud with subtle harmonic ring
      n(p.clickFreq, p.clickDur, p.clickVol)
      n(p.clickFreq * 1.22, p.clickDur * 0.55, p.clickVol * 0.30, null, 0.022)
      n(p.clickFreq * 0.75, p.clickDur * 0.8, p.clickVol * 0.14, null, 0.010)
    }
  }, [enabled, theme])

  // ── Drag pickup ───────────────────────────────────────────────────────────────
  const PRIO_FREQS = { urgent: 560, high: 440, medium: 340, low: 260 }

  const playPickup = useCallback((priority = 'medium') => {
    const f = PRIO_FREQS[priority] ?? 340
    n(f * 0.85, 0.09, 0.07, f * 1.20)
    n(f * 1.30, 0.06, 0.04, null, 0.07)
  }, [enabled, theme])

  function playPresetSound(soundPreset = 'soft', baseFreq = 260, isFinal = false) {
    if (soundPreset === 'reward' || isFinal) {
      n(baseFreq * 1.1, 0.22, 0.10, null, 0.00)
      n(baseFreq * 1.36, 0.20, 0.09, null, 0.06)
      n(baseFreq * 1.68, 0.24, 0.09, null, 0.12)
      return
    }
    if (soundPreset === 'bright') {
      n(baseFreq, 0.14, 0.10, baseFreq * 1.16, 0.00, 'sine')
      n(baseFreq * 1.3, 0.08, 0.05, null, 0.04, 'triangle')
      return
    }
    if (soundPreset === 'lift') {
      n(baseFreq * 0.9, 0.17, 0.09, baseFreq * 1.18, 0.00, 'triangle')
      n(baseFreq * 1.28, 0.10, 0.05, null, 0.06, 'sine')
      return
    }
    if (soundPreset === 'chime') {
      n(baseFreq, 0.18, 0.09, null, 0.00, 'sine')
      n(baseFreq * 1.5, 0.18, 0.06, null, 0.05, 'sine')
      return
    }
    // soft (default)
    n(baseFreq * 0.86, 0.18, 0.10, baseFreq, 0.00, 'triangle')
    n(baseFreq * 1.1, 0.10, 0.04, null, 0.05, 'sine')
  }

  // ── Drop ──────────────────────────────────────────────────────────────────────
  const playDrop = useCallback((meta = '') => {
    const column = typeof meta === 'object' ? meta.column : null
    const title = String(column?.title || meta || '').toLowerCase()
    const totalColumns = typeof meta === 'object' ? Math.max(meta.totalColumns || 4, 1) : 4
    const toIndex = typeof meta === 'object' ? Math.max(meta.toIndex ?? 0, 0) : 0
    const fromIndex = typeof meta === 'object' ? Math.max(meta.fromIndex ?? toIndex, 0) : toIndex
    const progress = totalColumns <= 1 ? 1 : toIndex / (totalColumns - 1)
    const isFinal = /(done|complete|finished|published|closed|submitted|achieved)/.test(title) || toIndex >= totalColumns - 1
    const movingForward = toIndex >= fromIndex
    const baseFreq = 220 + progress * 280 + (movingForward ? 24 : -8)
    const soundPreset = column?.soundPreset || (isFinal ? 'reward' : 'soft')
    playPresetSound(soundPreset, baseFreq, isFinal)
  }, [enabled, theme])

  const playColumnPreview = useCallback((columnLike = {}) => {
    const soundPreset = typeof columnLike === 'string' ? columnLike : columnLike.soundPreset
    playPresetSound(soundPreset || 'soft', 320, soundPreset === 'reward')
  }, [enabled, theme])

  // ── Complete — warm ascending chord ───────────────────────────────────────────
  const playComplete = useCallback(() => {
    n(494, 0.28, 0.10, null, 0.00)
    n(622, 0.26, 0.10, null, 0.07)
    n(784, 0.24, 0.09, null, 0.14)
    n(988, 0.28, 0.09, null, 0.21)
    n(1245,0.32, 0.08, null, 0.28)
  }, [enabled, theme])

  // ── Un-complete — descending ──────────────────────────────────────────────────
  const playUncomplete = useCallback(() => {
    n(784, 0.18, 0.08, null, 0.00)
    n(622, 0.16, 0.07, null, 0.07)
    n(494, 0.14, 0.06, null, 0.14)
    n(370, 0.18, 0.05, null, 0.21)
  }, [enabled, theme])

  // ── Add ───────────────────────────────────────────────────────────────────────
  const playAdd = useCallback(() => {
    n(440, 0.11, 0.08, 560)
    n(580, 0.08, 0.05, null, 0.09)
    n(700, 0.06, 0.03, null, 0.16)
  }, [enabled, theme])

  // ── Delete ────────────────────────────────────────────────────────────────────
  const playDelete = useCallback(() => {
    n(320, 0.07, 0.07)
    n(210, 0.16, 0.07, 130, 0.05)
  }, [enabled, theme])

  // ── Open project — welcoming ascending melody ─────────────────────────────────
  const playOpenProject = useCallback(() => {
    n(330, 0.28, 0.09, null, 0.00)
    n(440, 0.26, 0.09, null, 0.08)
    n(554, 0.24, 0.08, null, 0.16)
    n(660, 0.28, 0.08, null, 0.24)
    n(880, 0.32, 0.07, null, 0.32)
  }, [enabled, theme])

  // ── Create project — uplifting fanfare ────────────────────────────────────────
  const playCreateProject = useCallback(() => {
    n(261, 0.18, 0.09, null, 0.00)
    n(329, 0.18, 0.09, null, 0.08)
    n(392, 0.18, 0.09, null, 0.16)
    n(523, 0.18, 0.09, null, 0.24)
    n(659, 0.28, 0.10, null, 0.32)
    n(784, 0.30, 0.09, null, 0.40)
  }, [enabled, theme])

  // ── AI generate — futuristic rising arpeggio ──────────────────────────────────
  const playAIGenerate = useCallback(() => {
    if (!enabled) return
    n(200, 0.14, 0.06, 400,  0.00)
    n(300, 0.12, 0.06, 500,  0.08)
    n(400, 0.12, 0.06, 650,  0.16)
    n(500, 0.12, 0.07, 800,  0.24)
    n(700, 0.20, 0.08, 1100, 0.32)
  }, [enabled, theme])

  // ── AI tasks added ─────────────────────────────────────────────────────────────
  const playAITaskAdded = useCallback(() => {
    n(440, 0.16, 0.08, 660, 0.00)
    n(660, 0.18, 0.07, null, 0.10)
    n(880, 0.14, 0.05, null, 0.20)
  }, [enabled, theme])

  return {
    playPickup, playDrop,
    playComplete, playUncomplete,
    playAdd, playDelete, playClick,
    playOpenProject, playCreateProject,
    playAIGenerate, playAITaskAdded,
    playColumnPreview,
  }
}
