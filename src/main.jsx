import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { inject } from '@vercel/analytics'
import { supabase } from './lib/supabase.js'

inject()

function Root() {
  // undefined = still checking session, null = not logged in, object = logged in
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Still checking session — render nothing briefly to avoid flash
  if (session === undefined) return null

  // key changes on sign-in/out → forces App to fully remount with clean state
  return <App key={session?.user?.id ?? 'guest'} user={session?.user ?? null} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
)
