import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Topbar from './components/Topbar'
import Board from './components/Board'
import ListView from './components/ListView'
import TaskModal from './components/TaskModal'
import ColumnModal from './components/ColumnModal'
import SettingsPanel from './components/SettingsPanel'
import AIAgent from './components/AIAgent'
import IntroAnimation from './components/IntroAnimation'
import Tutorial from './components/Tutorial'
import Toast from './components/Toast'
import { createColumn, generateId, getDefaultData, normalizeBoardData } from './utils/data'
import { useSounds } from './hooks/useSounds'
import {
  supabase,
  fetchProjects,
  fetchBoardData,
  upsertProject,
  saveBoardData,
  moveToTrash,
  restoreProjectFromTrash,
  permanentlyDeleteProject,
  emptyTrash,
  cleanupExpiredTrash,
  fetchTrashedProjects,
  mapProjectRow,
  fetchProfile,
  upsertProfile,
  randomAvatarAnimal,
  randomAvatarColor,
  deleteProjectImage,
} from './lib/supabase'
import AuthModal from './components/AuthModal'
import UserAvatar from './components/UserAvatar'
import ProjectSettingsModal from './components/ProjectSettingsModal'
import MobileHome from './mobile/MobileHome'
import MobileBoard from './mobile/MobileBoard'
import { useIsMobile } from './hooks/useIsMobile'

function loadGlobalSettings() {
  try {
    const saved = localStorage.getItem('taskly-global-settings')
    return saved ? JSON.parse(saved) : { defaultTheme: 'light', soundEnabled: true }
  } catch {
    return { defaultTheme: 'light', soundEnabled: true }
  }
}

function loadProjects() {
  try {
    const saved = localStorage.getItem('taskly-projects')
    if (saved) return JSON.parse(saved)

    const oldData = localStorage.getItem('taskly-data')
    if (oldData) {
      const data = JSON.parse(oldData)
      const proj = {
        id: 'proj-default',
        name: 'My Tasks',
        emoji: '📝',
        color: '#6c63ff',
        theme: null,
        summary: '',
        createdAt: new Date().toISOString(),
        taskCount: data.tasks?.length ?? 0,
        tasksDone: data.tasks?.filter(task => task.done).length ?? 0,
      }
      localStorage.setItem('taskly-data-proj-default', oldData)
      localStorage.setItem('taskly-projects', JSON.stringify([proj]))
      return [proj]
    }

    return []
  } catch {
    return []
  }
}

function loadProjectData(id) {
  try {
    const saved = localStorage.getItem(`taskly-data-${id}`)
    return saved ? normalizeBoardData(JSON.parse(saved)) : getDefaultData()
  } catch {
    return getDefaultData()
  }
}

function hasSeenIntro() {
  return sessionStorage.getItem('taskly-intro-seen') === '1'
}

const HOME_TUTORIAL_STEPS = [
  {
    target: '.home-hero__title',
    title: 'Start here',
    desc: 'Taskly can organize work, school, life admin, clients, writing, planning, and more.',
    pos: 'bottom',
  },
  {
    target: '.home-bar__icon-btn--theme',
    title: 'Change the look',
    desc: 'Cycle the interface theme from the home bar whenever you want a different feel.',
    pos: 'bottom',
  },
  {
    target: '.home-bar__icon-btn--sound',
    title: 'Toggle sound',
    desc: 'Turn interface sounds on or off globally.',
    pos: 'bottom',
  },
  {
    target: '.btn-settings-home',
    title: 'Set defaults',
    desc: 'Choose the default theme and sound settings for future projects.',
    pos: 'bottom',
  },
  {
    target: '.btn-new-project',
    title: 'Create a project',
    desc: 'Make a blank board, or add context and let the assistant pre-build starter columns and tasks.',
    pos: 'bottom',
  },
]

const BOARD_TUTORIAL_STEPS = [
  {
    target: '.topbar__back',
    title: 'Project switcher',
    desc: 'Return to the homepage and jump between projects from here.',
    pos: 'bottom',
  },
  {
    target: '.topbar__search',
    title: 'Search instantly',
    desc: 'Filter tasks by title, description, or tags. Press / to jump here.',
    pos: 'bottom',
  },
  {
    target: '.view-switcher',
    title: 'Board or list',
    desc: 'Swap between the kanban board and the list view without losing your place.',
    pos: 'bottom',
  },
  {
    target: '.history-controls',
    title: 'Undo and redo',
    desc: 'Use the arrow buttons or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z to reverse mistakes, including assistant actions.',
    pos: 'bottom',
  },
  {
    target: '.ai-btn',
    title: 'Board assistant',
    desc: 'Generate starter tasks, add columns, move work around, rename items, or delete them from the assistant panel.',
    pos: 'bottom',
  },
  {
    target: '.new-task-btn',
    title: 'Add work quickly',
    desc: 'Create tasks manually at any time. Double-click a column title to rename it.',
    pos: 'bottom',
  },
]

export default function App({ user }) {
  const isMobile = useIsMobile()
  const [globalSettings, setGlobalSettings] = useState(loadGlobalSettings)
  const [globalTheme, setGlobalTheme] = useState(
    () => localStorage.getItem('taskly-theme') || globalSettings.defaultTheme || 'light'
  )
  const [soundEnabled, setSoundEnabled] = useState(
    () => JSON.parse(localStorage.getItem('taskly-sound') ?? String(globalSettings.soundEnabled ?? true))
  )

  const [projects, setProjects] = useState(() => user ? [] : loadProjects())
  const [isLoadingProjects, setIsLoadingProjects] = useState(!!user)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [boardState, setBoardState] = useState({ present: null, past: [], future: [] })

  const [view, setView] = useState('board')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editingColumn, setEditingColumn] = useState(null)
  const [defaultColId, setDefaultColId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [movedTaskIds, setMovedTaskIds] = useState([])
  const movedTimerRef = useRef(null)
  const [showIntro, setShowIntro] = useState(!hasSeenIntro())
  const [showHomeTutorial, setShowHomeTutorial] = useState(
    () => localStorage.getItem('taskly-home-tutorial-seen') !== '1'
  )
  const [showBoardTutorial, setShowBoardTutorial] = useState(
    () => localStorage.getItem('taskly-board-tutorial-seen') !== '1'
  )
  const [remoteDeletedProject, setRemoteDeletedProject] = useState(null) // { id, name }
  const [trashedProjects, setTrashedProjects] = useState([])
  const [trashPanelOpen, setTrashPanelOpen] = useState(false)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  // In-project delete confirm (mirrors Home.jsx's confirm modal)
  const [inProjectDeleteTarget, setInProjectDeleteTarget] = useState(null)
  const [inProjectDeleteText, setInProjectDeleteText] = useState('')

  const navigate = useNavigate()
  const location = useLocation()
  const activeProject = projects.find(project => project.id === activeProjectId)
  const data = boardState.present
  const effectiveTheme = activeProjectId && activeProject?.theme ? activeProject.theme : globalTheme
  const sounds = useSounds(soundEnabled, effectiveTheme)

  const toastKey = useRef(0)
  const searchRef = useRef(null)
  const filteredTasksRef = useRef([])
  const boardStateRef = useRef(boardState)
  const boardSaveTimerRef = useRef(null)
  const projectsSaveTimerRef = useRef(null)
  const skipNextProjectsSave = useRef(true) // skip save on initial Supabase load
  const projectsRef = useRef(projects)
  const activeProjectIdRef = useRef(activeProjectId)
  const trashedProjectsRef = useRef(trashedProjects)

  useEffect(() => { projectsRef.current = projects }, [projects])
  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])
  useEffect(() => { trashedProjectsRef.current = trashedProjects }, [trashedProjects])

  useEffect(() => {
    boardStateRef.current = boardState
  }, [boardState])

  // ── Load projects from Supabase on mount ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function init() {
      // Read localStorage BEFORE any await — the projects save effect fires
      // during the first await and overwrites localStorage with [], so we must
      // capture guest projects synchronously before that happens
      const localProjects = loadProjects()

      setIsLoadingProjects(true)
      try {
        const dbProjects = await fetchProjects(user.id)
        const cloudIds = new Set(dbProjects.map(p => p.id))
        const localOnly = localProjects.filter(p => !cloudIds.has(p.id))

        if (localOnly.length > 0) {
          // Read all board data synchronously before any awaits
          const localBoardData = {}
          localOnly.forEach(proj => { localBoardData[proj.id] = loadProjectData(proj.id) })

          // Push any new local projects up to Supabase and merge into the list
          for (const proj of localOnly) {
            await upsertProject(proj, user.id)
            const localData = localBoardData[proj.id]
            if (localData) {
              await saveBoardData(proj.id, user.id, localData.columns, localData.tasks)
            }
          }
          skipNextProjectsSave.current = true
          setProjects([...dbProjects, ...localOnly])
          if (localOnly.length === 1) showToast(`"${localOnly[0].name}" saved to your account`)
          else if (localOnly.length > 1) showToast(`${localOnly.length} local projects saved to your account`)
        } else {
          skipNextProjectsSave.current = true
          setProjects(dbProjects)
        }
      } catch (err) {
        console.error('Failed to load projects from Supabase:', err)
        setProjects(loadProjects()) // fall back to localStorage
      } finally {
        setIsLoadingProjects(false)
      }
    }
    init()
  }, [user])

  // ── Load / create user profile ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function initProfile() {
      const existing = await fetchProfile(user.id)
      if (existing) {
        setProfile(existing)
        // Apply cloud settings to local UI
        setGlobalTheme(existing.global_theme || 'dark')
        setSoundEnabled(existing.sound_enabled ?? true)
      } else {
        // First login — create profile, carry over current local settings
        const newProfile = {
          display_name: user.email.split('@')[0],
          avatar_animal: randomAvatarAnimal(),
          avatar_color: randomAvatarColor(),
          global_theme: globalTheme,
          sound_enabled: soundEnabled,
        }
        setProfile(newProfile)
        await upsertProfile(user.id, newProfile)
      }
    }
    initProfile()
  }, [user])

  // ── Load trash + auto-expire items older than 15 days ────────────────────
  useEffect(() => {
    if (!user) return
    async function initTrash() {
      try {
        await cleanupExpiredTrash(user.id)          // silently purge expired items
        const trashed = await fetchTrashedProjects(user.id)
        setTrashedProjects(trashed)
      } catch (err) {
        console.error('initTrash error:', err)
      }
    }
    initTrash()
  }, [user])

  // ── Realtime: sync project changes across browsers ───────────────────────
  // We use UPDATE events (not DELETE) because:
  //   - Soft-delete sets deleted_at → UPDATE fires with full new row including user_id
  //   - DELETE events without REPLICA IDENTITY FULL only send the PK, so user_id
  //     filter never matches and no event reaches the browser
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`projects-sync-${user.id}`)

      // ── Soft delete / restore ─────────────────────────────────────────────
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new
          if (!row) return

          if (row.deleted_at) {
            // Project was moved to trash on another device
            const id   = row.id
            const name = projectsRef.current.find(p => p.id === id)?.name || row.name || 'This project'
            const isOpen = activeProjectIdRef.current === id

            setProjects(prev => prev.filter(p => p.id !== id))
            setTrashedProjects(prev =>
              prev.some(p => p.id === id) ? prev : [mapProjectRow(row), ...prev]
            )
            if (isOpen) setRemoteDeletedProject({ id, name })
            localStorage.removeItem(`taskly-data-${id}`)
          } else {
            // Project was restored from trash on another device
            const id = row.id
            setTrashedProjects(prev => prev.filter(p => p.id !== id))
            setProjects(prev =>
              prev.some(p => p.id === id) ? prev : [...prev, mapProjectRow(row)]
            )
          }
        }
      )

      // ── Permanent delete (from trash) ─────────────────────────────────────
      // With REPLICA IDENTITY FULL, payload.old includes user_id.
      // We still check against our local lists as a safety net.
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'projects' },
        (payload) => {
          const id = payload.old?.id
          if (!id) return
          // Only act if this project belongs to the current user
          const inTrash    = trashedProjectsRef.current.some(p => p.id === id)
          const inProjects = projectsRef.current.some(p => p.id === id)
          if (!inTrash && !inProjects) return

          setTrashedProjects(prev => prev.filter(p => p.id !== id))
          setProjects(prev => prev.filter(p => p.id !== id))
          localStorage.removeItem(`taskly-data-${id}`)
        }
      )

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // ── URL-based routing ──────────────────────────────────────────────────────
  // When loading finishes (or on guest), auto-open the project from the URL
  const hasHandledUrl = useRef(false)
  useEffect(() => {
    if (isLoadingProjects || hasHandledUrl.current) return
    hasHandledUrl.current = true

    const match = location.pathname.match(/^\/p\/(.+)$/)
    if (!match) return
    const urlProjectId = match[1]

    if (!user) {
      // Not logged in — redirect home and prompt sign-in
      navigate('/', { replace: true })
      setAuthModalOpen(true)
      return
    }
    openProject(urlProjectId)
  }, [isLoadingProjects])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    localStorage.setItem('taskly-theme', globalTheme)
  }, [effectiveTheme, globalTheme])

  // ── First-ever welcome sound ───────────────────────────────────────────────
  useEffect(() => {
    const KEY = 'taskly-welcome-v1'
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, '1')
    // Delay so browser audio policy allows it after any user gesture during intro
    const t = setTimeout(() => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        // Warm rising arpeggio: C4 → E4 → G4 → C5 → E5
        const notes = [
          { freq: 261.63, t: 0.00, dur: 0.55, vol: 0.07 },
          { freq: 329.63, t: 0.13, dur: 0.55, vol: 0.07 },
          { freq: 392.00, t: 0.26, dur: 0.55, vol: 0.07 },
          { freq: 523.25, t: 0.39, dur: 0.65, vol: 0.08 },
          { freq: 659.25, t: 0.54, dur: 0.80, vol: 0.07 },
        ]
        notes.forEach(({ freq, t: delay, dur, vol }) => {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.value = freq
          const at = ctx.currentTime + delay
          gain.gain.setValueAtTime(0, at)
          gain.gain.linearRampToValueAtTime(vol, at + 0.04)
          gain.gain.exponentialRampToValueAtTime(0.001, at + dur)
          osc.start(at); osc.stop(at + dur + 0.05)
        })
      } catch (_) {}
    }, 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    localStorage.setItem('taskly-sound', JSON.stringify(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('taskly-projects', JSON.stringify(projects))
    if (skipNextProjectsSave.current) {
      skipNextProjectsSave.current = false
      return
    }
    if (!user || projects.length === 0) return
    clearTimeout(projectsSaveTimerRef.current)
    projectsSaveTimerRef.current = setTimeout(() => {
      projects.forEach(proj => upsertProject(proj, user.id))
    }, 750)
  }, [projects, user])

  useEffect(() => {
    if (!activeProjectId || !data) return
    localStorage.setItem(`taskly-data-${activeProjectId}`, JSON.stringify(data))
    const taskCount = data.tasks.length
    const tasksDone = data.tasks.filter(task => task.done).length
    setProjects(currentProjects => currentProjects.map(project => (
      project.id === activeProjectId
        ? { ...project, taskCount, tasksDone, updatedAt: new Date().toISOString() }
        : project
    )))
    // Debounced Supabase save (1 second after last change)
    if (user) {
      clearTimeout(boardSaveTimerRef.current)
      boardSaveTimerRef.current = setTimeout(() => {
        saveBoardData(activeProjectId, user.id, data.columns, data.tasks)
      }, 500)
    }
  }, [activeProjectId, data, user])

  function showToast(message) {
    toastKey.current += 1
    setToast({ msg: message, key: toastKey.current })
  }

  function setPresentBoard(present) {
    const nextState = { present, past: [], future: [] }
    boardStateRef.current = nextState
    setBoardState(nextState)
  }

  function commitBoardChange(updater, options = {}) {
    const currentState = boardStateRef.current
    const current = currentState.present
    if (!current) return false

    const next = typeof updater === 'function' ? updater(current) : updater
    if (!next) return false

    const unchanged = JSON.stringify(current) === JSON.stringify(next)
    if (unchanged) return false

    const nextState = options.trackHistory === false
      ? { ...currentState, present: next }
      : {
          present: next,
          past: [...currentState.past, current].slice(-80),
          future: [],
        }

    boardStateRef.current = nextState
    setBoardState(nextState)

    if (options.sound) options.sound()
    if (options.toastMessage) showToast(options.toastMessage)
    return true
  }

  function flashMovedTasks(fromState, toState) {
    const changed = (toState.tasks || [])
      .filter(toTask => {
        const fromTask = (fromState.tasks || []).find(t => t.id === toTask.id)
        return fromTask && fromTask.columnId !== toTask.columnId
      })
      .map(t => t.id)
    if (changed.length > 0) {
      clearTimeout(movedTimerRef.current)
      setMovedTaskIds(changed)
      movedTimerRef.current = setTimeout(() => setMovedTaskIds([]), 900)
    }
  }

  function undoBoard() {
    const currentState = boardStateRef.current
    if (!currentState.present || currentState.past.length === 0) return

    const previous = currentState.past[currentState.past.length - 1]
    const nextState = {
      present: previous,
      past: currentState.past.slice(0, -1),
      future: [currentState.present, ...currentState.future].slice(0, 80),
    }

    flashMovedTasks(currentState.present, previous)
    boardStateRef.current = nextState
    setBoardState(nextState)
    sounds.playClick()
    showToast('Undid last change')
  }

  function redoBoard() {
    const currentState = boardStateRef.current
    if (!currentState.present || currentState.future.length === 0) return

    const [nextPresent, ...restFuture] = currentState.future
    const nextState = {
      present: nextPresent,
      past: [...currentState.past, currentState.present].slice(-80),
      future: restFuture,
    }

    flashMovedTasks(currentState.present, nextPresent)
    boardStateRef.current = nextState
    setBoardState(nextState)
    sounds.playClick()
    showToast('Redid change')
  }

  function cycleTheme(themeId) {
    if (themeId && typeof themeId === 'string' && themeId !== 'synthetic') {
      setGlobalTheme(themeId)
      return
    }

    const order = ['dark', 'light']
    setGlobalTheme(theme => order[(order.indexOf(theme) + 1) % order.length])
  }

  function handleGlobalSettingsChange(settings) {
    const next = { ...globalSettings, ...settings }
    setGlobalSettings(next)
    if (settings.defaultTheme) setGlobalTheme(settings.defaultTheme)
    if (settings.soundEnabled !== undefined) setSoundEnabled(settings.soundEnabled)
    localStorage.setItem('taskly-global-settings', JSON.stringify(next))
  }

  async function handleProfileUpdate(updates) {
    const updated = { ...profile, ...updates }
    setProfile(updated)
    if (updates.global_theme)                setGlobalTheme(updates.global_theme)
    if (updates.sound_enabled !== undefined)  setSoundEnabled(updates.sound_enabled)
    if (user) await upsertProfile(user.id, updated)
  }

  function handleSignOut() {
    try {
      const saved = JSON.parse(localStorage.getItem('taskly-projects') || '[]')
      saved.forEach(p => localStorage.removeItem(`taskly-data-${p.id}`))
      localStorage.removeItem('taskly-projects')
    } catch (_) {}
    supabase.auth.signOut()
  }

  function setProjectTheme(theme) {
    if (!activeProjectId) return
    setProjects(currentProjects => currentProjects.map(project => (
      project.id === activeProjectId ? { ...project, theme: theme || null } : project
    )))
  }

  async function openProject(id) {
    // Update URL first so refresh lands on the right project
    if (location.pathname !== `/p/${id}`) {
      navigate(`/p/${id}`)
    }
    // Show localStorage data immediately so the board feels instant
    setPresentBoard(loadProjectData(id))
    setActiveProjectId(id)
    setSelectedId(null)
    setSearchQuery('')
    setFilterPriority('all')
    setAiOpen(false)
    sounds.playOpenProject()
    // Then load the freshest data from Supabase (overwrites local if different)
    if (user) {
      try {
        const dbData = await fetchBoardData(id)
        if (dbData) {
          setPresentBoard(normalizeBoardData(dbData))
        }
      } catch (err) {
        console.error('Failed to load board from Supabase:', err)
      }
    }
  }

  function closeProject() {
    navigate('/')
    setActiveProjectId(null)
    setPresentBoard(null)
    setSettingsOpen(false)
    setModalOpen(false)
    setColumnModalOpen(false)
    setAiOpen(false)
  }

  async function createProject({ project, boardData }) {
    const initialData = normalizeBoardData(boardData || getDefaultData())
    localStorage.setItem(`taskly-data-${project.id}`, JSON.stringify(initialData))
    setProjects(currentProjects => [...currentProjects, project])
    sounds.playCreateProject()
    showToast(`"${project.name}" created`)
    // auto-open is handled by Home.jsx calling onOpenProject after onCreateProject
    // Save to Supabase
    if (user) {
      await upsertProject(project, user.id)
      await saveBoardData(project.id, user.id, initialData.columns, initialData.tasks)
    }
  }

  function deleteProject(id) {
    const project = projectsRef.current.find(p => p.id === id)
    // Move to trash locally
    setProjects(prev => prev.filter(p => p.id !== id))
    if (project) {
      setTrashedProjects(prev => [{ ...project, deletedAt: new Date().toISOString() }, ...prev])
    }
    showToast('Moved to trash')
    // Soft-delete in Supabase — this fires an UPDATE event that other browsers receive
    if (user) moveToTrash(id)
    // For guests: remove from localStorage permanently
    if (!user) localStorage.removeItem(`taskly-data-${id}`)
  }

  async function handleRestoreProject(id) {
    const project = trashedProjectsRef.current.find(p => p.id === id)
    if (!project) return
    setTrashedProjects(prev => prev.filter(p => p.id !== id))
    setProjects(prev => [...prev, { ...project, deletedAt: null }])
    showToast(`"${project.name}" restored`)
    if (user) await restoreProjectFromTrash(id)
  }

  async function handlePermanentDelete(id) {
    const project = trashedProjectsRef.current.find(p => p.id === id)
    setTrashedProjects(prev => prev.filter(p => p.id !== id))
    localStorage.removeItem(`taskly-data-${id}`)
    showToast(project ? `"${project.name}" permanently deleted` : 'Deleted')
    if (user) await permanentlyDeleteProject(id)
  }

  async function handleEmptyTrash() {
    const count = trashedProjectsRef.current.length
    trashedProjectsRef.current.forEach(p => localStorage.removeItem(`taskly-data-${p.id}`))
    setTrashedProjects([])
    showToast(`${count} project${count !== 1 ? 's' : ''} permanently deleted`)
    if (user) await emptyTrash(user.id)
  }

  function handleProjectRename(id, newName) {
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p
    ))
    showToast('Project renamed')
  }

  function handleProjectImageUpdate(id, imageUrl, emoji) {
    setProjects(prev => prev.map(p =>
      p.id === id
        ? { ...p, image_url: imageUrl ?? null, emoji: emoji ?? p.emoji, updatedAt: new Date().toISOString() }
        : p
    ))
  }

  const addTask = useCallback((taskData) => {
    const task = {
      id: generateId(),
      ...taskData,
      done: false,
      createdAt: new Date().toISOString(),
    }
    commitBoardChange(
      current => ({ ...current, tasks: [task, ...current.tasks] }),
      { toastMessage: 'Task added', sound: sounds.playAdd }
    )
  }, [sounds])

  const addTasksBulk = useCallback((tasksToAdd, options = {}) => {
    if (!tasksToAdd.length) return
    commitBoardChange(
      current => ({ ...current, tasks: [...tasksToAdd, ...current.tasks] }),
      {
        toastMessage: options.toastMessage || `${tasksToAdd.length} task${tasksToAdd.length !== 1 ? 's' : ''} added`,
        sound: options.sound || sounds.playAdd,
      }
    )
  }, [sounds])

  const applyGeneratedResult = useCallback(({ result, selectedIds, addSuggestedColumns }) => {
    if (!result) return

    commitBoardChange(current => {
      const existingTitles = new Set(current.columns.map(column => column.title.toLowerCase()))
      const suggestedColumns = result.suggestedColumnDetails || (result.suggestedColumns || []).map(title => ({ title }))
      const newColumns = addSuggestedColumns
        ? suggestedColumns
            .filter(column => !existingTitles.has(column.title.toLowerCase()))
            .map(column => createColumn({ id: generateId(), ...column, custom: true }))
        : []

      const allColumns = [...current.columns, ...newColumns]
      const tasksToAdd = result.tasks
        .filter(task => selectedIds.includes(task.id))
        .map(task => {
          const column = allColumns.find(entry => entry.title.toLowerCase() === task.suggestedColumn.toLowerCase()) || allColumns[0]
          return {
            id: generateId(),
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            columnId: column?.id || allColumns[0]?.id,
            tags: task.tags || [],
            dueDate: null,
            done: false,
            createdAt: new Date().toISOString(),
            emoji: task.emoji || '',
            accentColor: task.accentColor || '',
          }
        })

      if (tasksToAdd.length === 0 && newColumns.length === 0) return current

      return {
        columns: allColumns,
        tasks: [...tasksToAdd, ...current.tasks],
      }
    }, {
      toastMessage: `Assistant added ${selectedIds.length} task${selectedIds.length !== 1 ? 's' : ''}`,
      sound: sounds.playAITaskAdded,
    })
  }, [sounds])

  const updateTask = useCallback((id, updates) => {
    commitBoardChange(current => ({
      ...current,
      tasks: current.tasks.map(task => task.id === id ? { ...task, ...updates } : task),
    }))
  }, [])

  const deleteTask = useCallback((id) => {
    const wasSelected = selectedId === id
    const changed = commitBoardChange(
      current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) }),
      { toastMessage: 'Task deleted', sound: sounds.playDelete }
    )
    if (changed && wasSelected) setSelectedId(null)
  }, [selectedId, sounds])

  const toggleDone = useCallback((id) => {
    const task = boardStateRef.current.present?.tasks.find(entry => entry.id === id)
    if (!task) return

    const done = !task.done
    commitBoardChange(current => ({
      ...current,
      tasks: current.tasks.map(entry => (
        entry.id === id
          ? { ...entry, done, completedAt: done ? new Date().toISOString() : null }
          : entry
      )),
    }), {
      toastMessage: done ? 'Task complete' : 'Marked active',
      sound: done ? sounds.playComplete : sounds.playUncomplete,
    })
  }, [sounds])

  const moveTask = useCallback((taskId, toColumnId) => {
    commitBoardChange(current => ({
      ...current,
      tasks: current.tasks.map(task => task.id === taskId ? { ...task, columnId: toColumnId } : task),
    }))
  }, [])

  const reorderTask = useCallback((activeId, overId) => {
    commitBoardChange(current => {
      const tasks = [...current.tasks]
      const oldIndex = tasks.findIndex(task => task.id === activeId)
      const newIndex = tasks.findIndex(task => task.id === overId)
      if (oldIndex === -1 || newIndex === -1) return current
      const [moved] = tasks.splice(oldIndex, 1)
      tasks.splice(newIndex, 0, moved)
      return { ...current, tasks }
    })
  }, [])

  const reorderColumns = useCallback((columnIds) => {
    commitBoardChange(current => {
      const colMap = new Map(current.columns.map(c => [c.id, c]))
      const reordered = columnIds.map(id => colMap.get(id)).filter(Boolean)
      // Guard: don't commit if the result is missing columns
      if (reordered.length !== current.columns.length) return current
      return { ...current, columns: reordered }
    })
  }, [])

  const addColumn = useCallback((columnData) => {
    const column = createColumn({ id: generateId(), ...columnData, custom: true })
    commitBoardChange(
      current => ({ ...current, columns: [...current.columns, column] }),
      { toastMessage: 'Column added', sound: sounds.playAdd }
    )
  }, [sounds])

  const addColumnsBulk = useCallback((columnsToAdd, options = {}) => {
    if (!columnsToAdd.length) return
    commitBoardChange(current => {
      const existing = new Set(current.columns.map(column => column.title.toLowerCase()))
      const nextColumns = columnsToAdd
        .filter(column => !existing.has(column.title.toLowerCase()))
        .map(column => createColumn(column))
      if (!nextColumns.length) return current
      return { ...current, columns: [...current.columns, ...nextColumns] }
    }, {
      toastMessage: options.toastMessage || `Added ${columnsToAdd.length} column${columnsToAdd.length !== 1 ? 's' : ''}`,
      sound: options.sound || sounds.playAdd,
    })
  }, [sounds])

  const deleteColumn = useCallback((columnId) => {
    const current = boardStateRef.current.present
    if (!current) return
    if (current.columns.length <= 1) {
      showToast('At least one column is required')
      return
    }

    const deletedTaskIds = new Set(current.tasks.filter(task => task.columnId === columnId).map(task => task.id))
    const changed = commitBoardChange(currentBoard => ({
      ...currentBoard,
      columns: currentBoard.columns.filter(column => column.id !== columnId),
      tasks: currentBoard.tasks.filter(task => task.columnId !== columnId),
    }), {
      toastMessage: 'Column deleted',
      sound: sounds.playDelete,
    })

    if (changed && deletedTaskIds.has(selectedId)) setSelectedId(null)
  }, [selectedId, sounds])

  const renameColumn = useCallback((columnId, title) => {
    commitBoardChange(current => ({
      ...current,
      columns: current.columns.map(column => column.id === columnId ? { ...column, title } : column),
    }), {
      toastMessage: 'Column renamed',
    })
  }, [])

  const updateColumn = useCallback((columnId, updates) => {
    commitBoardChange(current => ({
      ...current,
      columns: current.columns.map(column => column.id === columnId ? { ...column, ...updates } : column),
    }), {
      toastMessage: 'Column updated',
      sound: sounds.playClick,
    })
  }, [sounds])

  function openAdd(columnId) {
    setDefaultColId(columnId || data?.columns[0]?.id)
    setEditingTask(null)
    setModalOpen(true)
  }

  function openNewColumn() {
    setEditingColumn(null)
    setColumnModalOpen(true)
  }

  function openEditColumn(column) {
    setEditingColumn(column)
    setColumnModalOpen(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setModalOpen(true)
  }

  function handleModalSave(formData) {
    if (editingTask) {
      updateTask(editingTask.id, formData)
      showToast('Task updated')
    } else {
      addTask({ ...formData, columnId: formData.columnId || defaultColId })
    }
    setModalOpen(false)
  }

  function handleColumnSave(formData) {
    if (editingColumn) {
      updateColumn(editingColumn.id, formData)
    } else {
      addColumn(formData)
    }
    setColumnModalOpen(false)
  }

  useEffect(() => {
    if (!activeProjectId) return

    function handler(event) {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (isTyping) return
        event.preventDefault()
        if (event.shiftKey) redoBoard()
        else undoBoard()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        if (isTyping) return
        event.preventDefault()
        redoBoard()
        return
      }

      if (isTyping) return

      switch (event.key) {
        case 'n':
        case 'N':
          event.preventDefault()
          openAdd(data?.columns[0]?.id)
          break
        case '/':
          event.preventDefault()
          searchRef.current?.focus()
          break
        case 'v':
        case 'V':
          setView(current => current === 'board' ? 'list' : 'board')
          break
        case '?':
          setSettingsOpen(current => !current)
          break
        case 'a':
        case 'A':
          setAiOpen(current => !current)
          break
        case 'Escape':
          setModalOpen(false)
          setColumnModalOpen(false)
          setSettingsOpen(false)
          setAiOpen(false)
          setSelectedId(null)
          searchRef.current?.blur()
          break
        case 'e':
        case 'E': {
          if (!selectedId) break
          const task = data?.tasks.find(entry => entry.id === selectedId)
          if (task) openEdit(task)
          break
        }
        case 'Delete':
          if (selectedId) deleteTask(selectedId)
          break
        case 'c':
        case 'C':
          if (selectedId) toggleDone(selectedId)
          break
        case 'j':
        case 'J': {
          const visibleTasks = filteredTasksRef.current
          const index = visibleTasks.findIndex(task => task.id === selectedId)
          if (index < visibleTasks.length - 1) setSelectedId(visibleTasks[index + 1]?.id)
          break
        }
        case 'k':
        case 'K': {
          const visibleTasks = filteredTasksRef.current
          const index = visibleTasks.findIndex(task => task.id === selectedId)
          if (index > 0) setSelectedId(visibleTasks[index - 1]?.id)
          break
        }
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProjectId, data, deleteTask, selectedId, toggleDone])

  const filteredTasks = (data?.tasks ?? []).filter(task => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = !query ||
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.tags?.some(tag => tag.toLowerCase().includes(query))

    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
    return matchesSearch && matchesPriority
  })

  filteredTasksRef.current = filteredTasks

  if (showIntro) {
    return (
      <IntroAnimation
        soundEnabled={soundEnabled}
        onComplete={() => {
          sessionStorage.setItem('taskly-intro-seen', '1')
          setShowIntro(false)
        }}
      />
    )
  }

  if (isLoadingProjects) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-2)',
        fontFamily: 'var(--font)',
        fontSize: '15px',
        gap: '10px',
      }}>
        <span style={{ fontSize: '22px', color: 'var(--accent)' }}>✦</span>
        Loading your boards…
      </div>
    )
  }

  if (!activeProjectId) {
    if (isMobile) {
      return (
        <>
          <MobileHome
            projects={projects}
            onOpenProject={openProject}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            user={user}
            profile={profile}
            sounds={sounds}
            theme={globalTheme}
            onCycleTheme={cycleTheme}
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(current => !current)}
            onAuthClick={() => setAuthModalOpen(true)}
            onSignOut={handleSignOut}
            trashedProjects={trashedProjects}
          />
          {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
          {toast && <Toast key={toast.key} message={toast.msg} />}
        </>
      )
    }

    return (
      <>
        <Home
          projects={projects}
          onOpenProject={openProject}
          onCreateProject={createProject}
          onDeleteProject={deleteProject}
          theme={globalTheme}
          onCycleTheme={cycleTheme}
          soundEnabled={soundEnabled}
          onSoundToggle={() => setSoundEnabled(current => !current)}
          globalSettings={globalSettings}
          onGlobalSettingsChange={handleGlobalSettingsChange}
          sounds={sounds}
          user={user}
          profile={profile}
          onProfileUpdate={handleProfileUpdate}
          onAuthClick={() => setAuthModalOpen(true)}
          onSignOut={handleSignOut}
          tutorialActive={showHomeTutorial}
          trashedProjects={trashedProjects}
          trashPanelOpen={trashPanelOpen}
          onTrashPanelOpen={() => setTrashPanelOpen(true)}
          onTrashPanelClose={() => setTrashPanelOpen(false)}
          onRestoreProject={handleRestoreProject}
          onPermanentDelete={handlePermanentDelete}
          onEmptyTrash={handleEmptyTrash}
        />
        {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
        {showHomeTutorial && (
          <Tutorial
            steps={HOME_TUTORIAL_STEPS}
            storageKey="taskly-home-tutorial-seen"
            soundEnabled={soundEnabled}
            onComplete={() => setShowHomeTutorial(false)}
          />
        )}
        {toast && <Toast key={toast.key} message={toast.msg} />}
      </>
    )
  }

  const canUndo = boardState.past.length > 0
  const canRedo = boardState.future.length > 0

  // ── Mobile board view ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <MobileBoard
          activeProject={activeProject}
          data={data}
          onClose={closeProject}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onToggleDone={toggleDone}
          onMoveTask={moveTask}
          onAddTasks={addTasksBulk}
          onAddColumns={addColumnsBulk}
          onApplyGeneratedResult={applyGeneratedResult}
          onDeleteColumn={deleteColumn}
          onRenameColumn={renameColumn}
          onUpdateColumn={updateColumn}
          onReorderColumns={reorderColumns}
          sounds={sounds}
          user={user}
          profile={profile}
          onAuthClick={() => setAuthModalOpen(true)}
          onSignOut={handleSignOut}
          theme={globalTheme}
          onCycleTheme={cycleTheme}
          soundEnabled={soundEnabled}
          onSoundToggle={() => setSoundEnabled(current => !current)}
        />
        {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
        {toast && <Toast key={toast.key} message={toast.msg} />}
      </>
    )
  }

  return (
    <div className="app">
      <Topbar
        projectName={activeProject?.name}
        projectEmoji={activeProject?.emoji}
        projectColor={activeProject?.color}
        projectImageUrl={activeProject?.image_url}
        onBack={closeProject}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        searchRef={searchRef}
        filterPriority={filterPriority}
        onFilterPriority={setFilterPriority}
        view={view}
        onViewChange={setView}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoBoard}
        onRedo={redoBoard}
        settingsOpen={projectSettingsOpen}
        onSettingsToggle={() => setSettingsOpen(current => !current)}
        onProjectSettingsOpen={() => { setProjectSettingsOpen(true); sounds.playClick() }}
        onProjectRename={name => handleProjectRename(activeProjectId, name)}
        tasks={data?.tasks ?? []}
        onNewTask={() => openAdd(data?.columns[0]?.id)}
        aiOpen={aiOpen}
        onAiToggle={() => {
          setAiOpen(current => !current)
          sounds.playClick()
        }}
        user={user}
        profile={profile}
        onProfileUpdate={handleProfileUpdate}
        onSignOut={handleSignOut}
        onAuthClick={() => setAuthModalOpen(true)}
        globalTheme={globalTheme}
        onThemeChange={cycleTheme}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled(current => !current)}
      />

      <div className="app__content">
        {view === 'board' ? (
          <div className="board-wrapper">
            <Board
              columns={data?.columns ?? []}
              tasks={filteredTasks}
              onMoveTask={moveTask}
              onReorderTask={reorderTask}
              onToggleDone={toggleDone}
              onEditTask={openEdit}
              onDeleteTask={deleteTask}
              onAddTask={openAdd}
              onAddColumn={openNewColumn}
              onDeleteColumn={deleteColumn}
              onRenameColumn={renameColumn}
              onEditColumn={openEditColumn}
              onReorderColumns={reorderColumns}
              selectedTaskId={selectedId}
              onSelectTask={setSelectedId}
              sounds={sounds}
              movedTaskIds={movedTaskIds}
            />
            {aiOpen && (
              <AIAgent
                columns={data?.columns ?? []}
                tasks={data?.tasks ?? []}
                onAddTasks={tasksToAdd => addTasksBulk(tasksToAdd, {
                  toastMessage: `${tasksToAdd.length} assistant task${tasksToAdd.length !== 1 ? 's' : ''} added`,
                  sound: sounds.playAITaskAdded,
                })}
                onApplyGeneratedResult={applyGeneratedResult}
                onAddColumns={columnsToAdd => addColumnsBulk(columnsToAdd, {
                  toastMessage: `${columnsToAdd.length} column${columnsToAdd.length !== 1 ? 's' : ''} added`,
                })}
                onDeleteTask={deleteTask}
                onUpdateTask={updateTask}
                onMoveTask={moveTask}
                onDeleteColumn={deleteColumn}
                onRenameColumn={renameColumn}
                onUpdateColumn={updateColumn}
                onClose={() => setAiOpen(false)}
                sounds={sounds}
              />
            )}
          </div>
        ) : (
          <ListView
            columns={data?.columns ?? []}
            tasks={filteredTasks}
            onToggleDone={toggleDone}
            onEditTask={openEdit}
            onDeleteTask={deleteTask}
            selectedTaskId={selectedId}
            onSelectTask={setSelectedId}
          />
        )}
      </div>

      {/* Project Settings Modal (icon click / ⚙ button) */}
      {projectSettingsOpen && activeProject && (
        <ProjectSettingsModal
          project={activeProject}
          user={user}
          onClose={() => setProjectSettingsOpen(false)}
          onRename={(id, newName) => handleProjectRename(id, newName)}
          onImageUpdate={(id, imageUrl, emoji) => handleProjectImageUpdate(id, imageUrl, emoji)}
          onProjectThemeChange={theme => {
            setProjectTheme(theme)
            sounds.playClick()
          }}
          onDeleteRequest={project => {
            setInProjectDeleteTarget(project)
            setInProjectDeleteText('')
          }}
        />
      )}

      {/* In-project delete confirmation (triggered from ProjectSettingsModal) */}
      {inProjectDeleteTarget && (
        <div className="delete-confirm-overlay" onClick={() => setInProjectDeleteTarget(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-modal__icon">🗑️</div>
            <div className="delete-confirm-modal__title">
              Delete "{inProjectDeleteTarget.name}"?
            </div>
            <div className="delete-confirm-modal__sub">
              This moves the project to trash. Type <strong>confirm</strong> below to proceed.
            </div>
            <input
              className={`delete-confirm-modal__input${inProjectDeleteText === 'confirm' ? ' delete-confirm-modal__input--valid' : ''}`}
              placeholder="confirm"
              value={inProjectDeleteText}
              onChange={e => setInProjectDeleteText(e.target.value.toLowerCase())}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && inProjectDeleteText === 'confirm') {
                  deleteProject(inProjectDeleteTarget.id)
                  setInProjectDeleteTarget(null)
                  closeProject()
                }
                if (e.key === 'Escape') setInProjectDeleteTarget(null)
              }}
            />
            <div className="delete-confirm-modal__actions">
              <button
                className="delete-confirm-modal__cancel"
                onClick={() => setInProjectDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className={`delete-confirm-modal__delete${inProjectDeleteText === 'confirm' ? ' delete-confirm-modal__delete--ready' : ''}`}
                disabled={inProjectDeleteText !== 'confirm'}
                onClick={() => {
                  deleteProject(inProjectDeleteTarget.id)
                  setInProjectDeleteTarget(null)
                  closeProject()
                }}
              >
                Move to trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy settings panel — still accessible via ? shortcut */}
      {settingsOpen && (
        <SettingsPanel
          theme={effectiveTheme}
          projectTheme={activeProject?.theme || null}
          onThemeChange={theme => {
            setGlobalTheme(theme)
            sounds.playClick()
          }}
          onProjectThemeChange={theme => {
            setProjectTheme(theme)
            sounds.playClick()
          }}
          soundEnabled={soundEnabled}
          onSoundToggle={() => {
            setSoundEnabled(current => !current)
            sounds.playClick()
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {modalOpen && (
        <TaskModal
          task={editingTask}
          columns={data?.columns ?? []}
          defaultColumnId={defaultColId}
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {columnModalOpen && (
        <ColumnModal
          column={editingColumn}
          onSave={handleColumnSave}
          onClose={() => setColumnModalOpen(false)}
          onPreviewSound={soundPreset => sounds.playColumnPreview({ soundPreset, title: editingColumn?.title || 'Column' })}
        />
      )}

      {showBoardTutorial && (
        <Tutorial
          steps={BOARD_TUTORIAL_STEPS}
          storageKey="taskly-board-tutorial-seen"
          soundEnabled={soundEnabled}
          onComplete={() => setShowBoardTutorial(false)}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.msg} />}

      {/* ── Remote project-deleted overlay ──────────────────────────────────── */}
      {remoteDeletedProject && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: 'var(--chrome-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 28px',
            maxWidth: '360px', width: '100%',
            boxShadow: 'var(--shadow)',
            textAlign: 'center',
            animation: 'modalPop 0.2s ease',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗑️</div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
              Project deleted
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-1)' }}>"{remoteDeletedProject.name}"</strong> was
              deleted from another device or browser. It's no longer available.
            </p>
            <button
              onClick={() => {
                setRemoteDeletedProject(null)
                closeProject()
              }}
              style={{
                width: '100%', padding: '11px 0',
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Back to home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
