import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PortalMenu({ btnRef, open, onClose, onEdit, onDelete }) {
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const left = Math.min(r.right - 120, window.innerWidth - 132)
      setPos({ top: r.bottom + 4, left: Math.max(8, left) })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      const inMenu = menuRef.current?.contains(e.target)
      const inBtn  = btnRef.current?.contains(e.target)
      if (!inMenu && !inBtn) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 60)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      className="portal-menu"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <button onClick={() => { onClose(); onEdit() }}>Edit</button>
      <button className="danger" onClick={() => { onClose(); onDelete() }}>Delete</button>
    </div>,
    document.body
  )
}
