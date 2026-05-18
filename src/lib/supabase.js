import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Projects ──────────────────────────────────────────────────────────────────

export function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    theme: row.theme || null,
    summary: row.summary || '',
    image_url: row.image_url || null,
    taskCount: row.task_count ?? 0,
    tasksDone: row.tasks_done ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  }
}

export async function fetchProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)          // only active (non-trashed) projects
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(mapProjectRow)
}

export async function fetchTrashedProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data.map(mapProjectRow)
}

// Soft-delete: moves project to trash
export async function moveToTrash(projectId) {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) console.error('moveToTrash error:', error)
}

// Restore a trashed project
export async function restoreProjectFromTrash(projectId) {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', projectId)
  if (error) console.error('restoreProject error:', error)
}

// Permanently delete one project (called from trash panel)
export async function permanentlyDeleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
  if (error) console.error('permanentlyDeleteProject error:', error)
}

// Empty the whole trash
export async function emptyTrash(userId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
  if (error) console.error('emptyTrash error:', error)
}

// Auto-expire: permanently delete trash items older than 15 days
export async function cleanupExpiredTrash(userId) {
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
  if (error) console.error('cleanupExpiredTrash error:', error)
}

export async function upsertProject(project, userId) {
  const { error } = await supabase
    .from('projects')
    .upsert({
      id: project.id,
      user_id: userId,
      name: project.name,
      emoji: project.emoji || '📝',
      color: project.color || '#6c63ff',
      theme: project.theme || null,
      summary: project.summary || '',
      image_url: project.image_url || null,
      task_count: project.taskCount ?? 0,
      tasks_done: project.tasksDone ?? 0,
      created_at: project.createdAt,
      updated_at: project.updatedAt || new Date().toISOString(),
    })
  if (error) console.error('Failed to save project:', error)
}

// kept for internal use; prefer permanentlyDeleteProject
export async function deleteProjectFromDB(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
  if (error) console.error('Failed to delete project:', error)
}

// ── Board data ────────────────────────────────────────────────────────────────

export async function fetchBoardData(projectId) {
  const { data, error } = await supabase
    .from('board_data')
    .select('columns, tasks')
    .eq('project_id', projectId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // row not found yet
    throw error
  }
  return { columns: data.columns || [], tasks: data.tasks || [] }
}

export async function saveBoardData(projectId, userId, columns, tasks) {
  const { error } = await supabase
    .from('board_data')
    .upsert({
      project_id: projectId,
      user_id: userId,
      columns,
      tasks,
      updated_at: new Date().toISOString(),
    })
  if (error) console.error('Failed to save board data:', error)
}

// ── User profiles ─────────────────────────────────────────────────────────────

export const AVATAR_ANIMALS = ['cat','dog','fox','rabbit','bear','penguin','panda','bird']

export const AVATAR_COLORS = [
  '#6c63ff','#e05252','#f59e0b','#14b8a6',
  '#ec4899','#22c55e','#0ea5e9','#8b5cf6',
  '#f97316','#06b6d4','#a855f7','#64748b',
]

export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

export function randomAvatarAnimal() {
  return AVATAR_ANIMALS[Math.floor(Math.random() * AVATAR_ANIMALS.length)]
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') console.error('fetchProfile error:', error)
  return data || null
}

export async function upsertProfile(userId, profile) {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() })
  if (error) console.error('upsertProfile error:', error)
}

// ── Avatar image storage ──────────────────────────────────────────────────────
// Bucket name: "avatars" (create in Supabase → Storage → New bucket, set Public)

async function compressImage(file, maxSize = 128, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Crop to square from centre, then scale to maxSize
      const srcMin = Math.min(img.width, img.height)
      const sx = (img.width  - srcMin) / 2
      const sy = (img.height - srcMin) / 2
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = maxSize
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, sx, sy, srcMin, srcMin, 0, 0, maxSize, maxSize)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg', quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}

export async function uploadAvatar(userId, file) {
  const blob = await compressImage(file, 128, 0.72)
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so browser reloads after re-upload
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function deleteAvatar(userId) {
  const { error } = await supabase.storage
    .from('avatars')
    .remove([`${userId}/avatar.jpg`])
  if (error) console.error('deleteAvatar error:', error)
}

// ── Project image storage ─────────────────────────────────────────────────────
// Bucket name: "project-images" (create in Supabase → Storage → New bucket, set Public)

export async function uploadProjectImage(projectId, userId, file) {
  const blob = await compressImage(file, 256, 0.82)
  const path = `${userId}/${projectId}.jpg`
  const { error } = await supabase.storage
    .from('project-images')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('project-images').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function deleteProjectImage(projectId, userId) {
  const { error } = await supabase.storage
    .from('project-images')
    .remove([`${userId}/${projectId}.jpg`])
  if (error) console.error('deleteProjectImage error:', error)
}
