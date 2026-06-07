'use client'
import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'

export default function ThemeSync() {
  const { data: session, status } = useSession()
  const { setTheme } = useTheme()
  const synced = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || synced.current) return
    synced.current = true
    fetch('/api/profile')
      .then(r => r.json())
      .then(p => {
        if (p?.theme_preference) setTheme(p.theme_preference)
      })
      .catch(() => {})
  }, [status, setTheme])

  return null
}
