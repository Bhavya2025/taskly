const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function getDueStatus(dateStr) {
  if (!dateStr) return null
  const due = new Date(dateStr + 'T23:59:59')
  const now = new Date()
  const diff = due - now
  if (diff < 0) return 'overdue'
  if (diff < 86400000 * 2) return 'soon'
  return 'normal'
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
