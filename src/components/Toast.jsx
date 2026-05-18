import { useEffect, useState } from 'react'

export default function Toast({ message }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 1800)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className={`toast ${visible ? 'toast--visible' : ''}`}>
      {message}
    </div>
  )
}
