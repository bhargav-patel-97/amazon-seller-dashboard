import '../styles/globals.css'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <Component {...pageProps} session={session} />
}