import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function DatePicker({ value, onChange, onClose, triggerRef }) {
  const today = new Date()
  const init  = value ? new Date(value + 'T00:00:00') : today

  const [year,  setYear]  = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())
  const [pos,   setPos]   = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  // Position after render so we can measure the picker's actual height
  useLayoutEffect(() => {
    if (!triggerRef?.current || !ref.current) return
    const r  = triggerRef.current.getBoundingClientRect()
    const ph = ref.current.offsetHeight || 290
    const gap = 6
    const spaceBelow = window.innerHeight - r.bottom - gap
    const spaceAbove = r.top - gap
    // Flip above the trigger if it would clip the bottom
    const top = spaceBelow >= ph || spaceBelow >= spaceAbove
      ? r.bottom + gap
      : Math.max(8, r.top - ph - gap)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - 268)
    setPos({ top, left })
  }, [])

  useEffect(() => {
    function handler(e) {
      const inPicker  = ref.current?.contains(e.target)
      const inTrigger = triggerRef?.current?.contains(e.target)
      if (!inPicker && !inTrigger) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 60)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function selectDay(day) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(iso)
    onClose()
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()
  const selected    = value ? new Date(value + 'T00:00:00') : null

  const cells = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return createPortal(
    <div ref={ref} className="datepicker" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}>
      <div className="datepicker__nav">
        <button className="datepicker__arrow" onClick={prevMonth}>‹</button>
        <span className="datepicker__label">{MONTH_NAMES[month]} {year}</span>
        <button className="datepicker__arrow" onClick={nextMonth}>›</button>
      </div>

      <div className="datepicker__weekdays">
        {DAY_NAMES.map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="datepicker__grid">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} className="datepicker__empty" />
          const isToday = (
            day === today.getDate() &&
            month === today.getMonth() &&
            year  === today.getFullYear()
          )
          const isSelected = selected && (
            day === selected.getDate() &&
            month === selected.getMonth() &&
            year  === selected.getFullYear()
          )
          return (
            <button
              key={day}
              onClick={() => selectDay(day)}
              className={[
                'datepicker__day',
                isToday    ? 'datepicker__day--today'    : '',
                isSelected ? 'datepicker__day--selected' : '',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>

      {value && (
        <div className="datepicker__footer">
          <button onClick={() => { onChange(''); onClose() }}>Clear date</button>
        </div>
      )}
    </div>,
    document.body
  )
}
